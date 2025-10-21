-- ============================================================================
-- QUICK FIX: User Organizations & Missing Columns
-- ============================================================================
-- Issue Summary:
-- 1. User created via setup but NOT linked to organization (user_organizations count = 0)
-- 2. Missing 'is_active' column in user_organizations table
-- 3. Dashboard document query failing due to missing 'is_active' column
--
-- This script fixes all three issues in correct dependency order
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

    -- Add created_at column if it doesn't exist (already added via migration 006)
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

-- STEP 3: Fix missing user-organization link for recent setup user
-- ============================================================================
-- This links the user created during setup to their organization

DO $$
DECLARE
    v_user_id UUID := '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;
    v_user_email TEXT;
    v_org_id UUID;
    v_org_name TEXT;
    v_existing_count INTEGER;
BEGIN
    -- Verify the user exists in auth.users
    SELECT email INTO v_user_email
    FROM auth.users
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RAISE NOTICE '❌ User ID % not found in auth.users', v_user_id;
        RAISE EXCEPTION 'Cannot link user - user does not exist';
    END IF;

    RAISE NOTICE '✅ Found user: %', v_user_email;

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

        -- Create the user-organization link
        INSERT INTO user_organizations (
            user_id,
            organization_id,
            role,
            is_active,
            is_global_admin,
            created_at
        ) VALUES (
            v_user_id,
            v_org_id,
            'org_admin', -- First user gets admin role
            TRUE,
            FALSE,
            NOW()
        )
        ON CONFLICT (user_id, organization_id) DO UPDATE
        SET
            is_active = TRUE,
            updated_at = NOW();

        RAISE NOTICE '✅ Successfully linked user % to organization %', v_user_email, v_org_name;
        RAISE NOTICE '   Role: org_admin';
    END IF;
END $$;

-- STEP 4: Verify the fix worked
-- ============================================================================

DO $$
DECLARE
    v_user_id UUID := '7193f7ad-2f86-4e13-af61-102de9e208de'::uuid;
    v_org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_org_count
    FROM user_organizations
    WHERE user_id = v_user_id;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION RESULTS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Organization links: %', v_org_count;

    IF v_org_count = 0 THEN
        RAISE NOTICE '❌ FAILED: User still has no organization links';
    ELSE
        RAISE NOTICE '✅ SUCCESS: User is linked to % organization(s)', v_org_count;
    END IF;
    RAISE NOTICE '========================================';
END $$;

-- STEP 5: Show current user_organizations schema
-- ============================================================================

SELECT
    '========================================' as separator;

SELECT
    'CURRENT user_organizations SCHEMA' as info;

SELECT
    '========================================' as separator;

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
-- END OF QUICK FIX
-- ============================================================================
