-- ============================================================================
-- QUICK FIX V2: User Organizations & Missing User Record
-- ============================================================================
-- Issue Summary:
-- 1. User exists in auth.users but NOT in public.users table
-- 2. Missing 'is_active' column in user_organizations table
-- 3. Cannot create user_organizations link due to FK constraint
--
-- This script fixes all issues in correct dependency order
-- ============================================================================

-- STEP 1: Add missing columns to user_organizations table
-- ============================================================================

DO $$
BEGIN
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_organizations'
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_organizations
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

        RAISE NOTICE '✅ Added is_active column to user_organizations';
    ELSE
        RAISE NOTICE '⏭️  Column is_active already exists in user_organizations';
    END IF;

    -- Add is_global_admin column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_organizations'
        AND column_name = 'is_global_admin'
    ) THEN
        ALTER TABLE user_organizations
        ADD COLUMN is_global_admin BOOLEAN DEFAULT FALSE NOT NULL;

        RAISE NOTICE '✅ Added is_global_admin column to user_organizations';
    ELSE
        RAISE NOTICE '⏭️  Column is_global_admin already exists in user_organizations';
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_organizations'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_organizations
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

        RAISE NOTICE '✅ Added created_at column to user_organizations';
    ELSE
        RAISE NOTICE '⏭️  Column created_at already exists in user_organizations';
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_organizations'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_organizations
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

        RAISE NOTICE '✅ Added updated_at column to user_organizations';
    ELSE
        RAISE NOTICE '⏭️  Column updated_at already exists in user_organizations';
    END IF;
END $$;

-- STEP 2: Create index on is_active for query performance
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'user_organizations'
        AND indexname = 'idx_user_orgs_is_active'
    ) THEN
        CREATE INDEX idx_user_orgs_is_active
        ON user_organizations(user_id, is_active)
        WHERE is_active = TRUE;

        RAISE NOTICE '✅ Created index on user_organizations(is_active)';
    ELSE
        RAISE NOTICE '⏭️  Index idx_user_orgs_is_active already exists';
    END IF;
END $$;

-- STEP 3: Create user in public.users table (from auth.users)
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID := '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;
    v_user_email TEXT;
    v_user_name TEXT;
    v_user_created_at TIMESTAMPTZ;
    v_user_exists BOOLEAN;
BEGIN
    -- Check if user exists in auth.users
    SELECT
        email,
        COALESCE(raw_user_meta_data->>'name', email_confirmed_at::text),
        created_at
    INTO v_user_email, v_user_name, v_user_created_at
    FROM auth.users
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '❌ User ID % not found in auth.users', v_user_id;
    END IF;

    RAISE NOTICE '✅ Found user in auth.users: %', v_user_email;

    -- Check if user exists in public.users
    SELECT EXISTS(
        SELECT 1 FROM users WHERE id = v_user_id
    ) INTO v_user_exists;

    IF v_user_exists THEN
        RAISE NOTICE '⏭️  User already exists in public.users';

        -- Update last_login
        UPDATE users
        SET last_login = NOW()
        WHERE id = v_user_id;

        RAISE NOTICE '✅ Updated last_login for user %', v_user_email;
    ELSE
        RAISE NOTICE '❌ User NOT in public.users - creating record';

        -- Create user in public.users
        INSERT INTO users (
            id,
            email,
            name,
            auth_provider,
            created_at,
            last_login
        ) VALUES (
            v_user_id,
            v_user_email,
            v_user_name,
            'supabase',
            v_user_created_at,
            NOW()
        );

        RAISE NOTICE '✅ Created user in public.users: %', v_user_email;
    END IF;
END $$;

-- STEP 4: Create user-organization link
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID := '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;
    v_user_email TEXT;
    v_org_id UUID;
    v_org_name TEXT;
    v_existing_count INTEGER;
    v_is_first_org BOOLEAN;
    v_role TEXT;
BEGIN
    -- Get user email
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;

    -- Check if user already has organization links
    SELECT COUNT(*) INTO v_existing_count
    FROM user_organizations
    WHERE user_id = v_user_id;

    IF v_existing_count > 0 THEN
        RAISE NOTICE '⚠️  User already has % organization link(s)', v_existing_count;
        -- Show existing links
        FOR v_org_id, v_org_name IN
            SELECT uo.organization_id, o.name
            FROM user_organizations uo
            JOIN organizations o ON o.id = uo.organization_id
            WHERE uo.user_id = v_user_id
        LOOP
            RAISE NOTICE '   - Linked to: % (ID: %)', v_org_name, v_org_id;
        END LOOP;
    ELSE
        RAISE NOTICE '❌ User has NO organization links - will create link';

        -- Find the most recently created organization (likely the one just setup)
        SELECT id, name INTO v_org_id, v_org_name
        FROM organizations
        ORDER BY created_at DESC
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION '❌ No organizations found in database';
        END IF;

        RAISE NOTICE '✅ Found most recent organization: % (ID: %)', v_org_name, v_org_id;

        -- Check if this is the first organization (for superuser role)
        SELECT COUNT(*) = 1 INTO v_is_first_org
        FROM organizations;

        -- Determine role: superuser for first org, org_admin for others
        v_role := CASE WHEN v_is_first_org THEN 'superuser' ELSE 'org_admin' END;

        RAISE NOTICE '🎯 Assigning role: % (is_first_org: %)', v_role, v_is_first_org;

        -- Create the user-organization link
        INSERT INTO user_organizations (
            user_id,
            organization_id,
            role,
            is_active,
            is_global_admin,
            permissions,
            joined_at,
            created_at
        ) VALUES (
            v_user_id,
            v_org_id,
            v_role,
            TRUE,
            v_is_first_org, -- First org user becomes global admin
            jsonb_build_object(
                'can_edit_sections', true,
                'can_create_suggestions', true,
                'can_vote', true,
                'can_approve_stages', ARRAY[]::text[],
                'can_manage_users', true,
                'can_manage_workflows', true
            ),
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, organization_id) DO UPDATE
        SET
            is_active = TRUE,
            updated_at = NOW();

        RAISE NOTICE '✅ Successfully linked user % to organization %', v_user_email, v_org_name;
        RAISE NOTICE '   Role: %', v_role;
        RAISE NOTICE '   Global Admin: %', v_is_first_org;
    END IF;
END $$;

-- STEP 5: Verify the fix worked
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID := '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;
    v_user_in_public BOOLEAN;
    v_org_count INTEGER;
    v_org_name TEXT;
    v_role TEXT;
BEGIN
    -- Check if user exists in public.users
    SELECT EXISTS(
        SELECT 1 FROM users WHERE id = v_user_id
    ) INTO v_user_in_public;

    -- Check organization links
    SELECT COUNT(*) INTO v_org_count
    FROM user_organizations
    WHERE user_id = v_user_id;

    -- Get org details if linked
    IF v_org_count > 0 THEN
        SELECT o.name, uo.role
        INTO v_org_name, v_role
        FROM user_organizations uo
        JOIN organizations o ON o.id = uo.organization_id
        WHERE uo.user_id = v_user_id
        LIMIT 1;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION RESULTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE '';
    RAISE NOTICE 'User in public.users: %', CASE WHEN v_user_in_public THEN '✅ YES' ELSE '❌ NO' END;
    RAISE NOTICE 'Organization links: %', v_org_count;

    IF v_org_count > 0 THEN
        RAISE NOTICE '✅ SUCCESS: User is linked to: %', v_org_name;
        RAISE NOTICE '   Role: %', v_role;
    ELSE
        RAISE NOTICE '❌ FAILED: User still has no organization links';
    END IF;

    RAISE NOTICE '========================================';
END $$;

-- STEP 6: Show current schema
-- ============================================================================

SELECT '========================================' as separator;
SELECT 'PUBLIC.USERS TABLE VERIFICATION' as info;
SELECT '========================================' as separator;

SELECT
    id,
    email,
    name,
    auth_provider,
    created_at,
    last_login
FROM users
WHERE id = '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;

SELECT '========================================' as separator;
SELECT 'USER_ORGANIZATIONS TABLE VERIFICATION' as info;
SELECT '========================================' as separator;

SELECT
    uo.id,
    uo.user_id,
    uo.organization_id,
    o.name as organization_name,
    uo.role,
    uo.is_active,
    uo.is_global_admin,
    uo.joined_at
FROM user_organizations uo
LEFT JOIN organizations o ON o.id = uo.organization_id
WHERE uo.user_id = '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;

SELECT '========================================' as separator;
SELECT 'CURRENT user_organizations SCHEMA' as info;
SELECT '========================================' as separator;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_organizations'
ORDER BY ordinal_position;

-- ============================================================================
-- END OF QUICK FIX V2
-- ============================================================================
