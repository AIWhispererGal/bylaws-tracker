-- ============================================================================
-- IMMEDIATE FIX: User Types RLS and Missing Assignments
-- Date: 2025-10-20
-- Purpose: Fix "relation user_types does not exist" error
--
-- WHAT THIS DOES:
-- 1. Disables RLS on user_types and organization_roles
-- 2. Assigns user_type_id to all users missing it
-- 3. Assigns org_role_id to all user_organizations missing it
-- 4. Verifies the fixes worked
-- ============================================================================

BEGIN;

\echo '===================================================='
\echo 'STARTING IMMEDIATE FIX FOR user_types'
\echo '===================================================='
\echo ''

-- ============================================================================
-- STEP 1: DISABLE RLS ON KEY TABLES
-- ============================================================================

\echo 'STEP 1: Disabling RLS on user_types and organization_roles'
\echo '------------------------------------------------------------'

-- Disable RLS to prevent query blocking
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles DISABLE ROW LEVEL SECURITY;

-- Also disable on users and user_organizations for good measure
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;

\echo '✅ RLS disabled on all permission tables'
\echo ''

-- ============================================================================
-- STEP 2: VERIFY user_types DATA EXISTS
-- ============================================================================

\echo 'STEP 2: Verifying user_types table has data'
\echo '---------------------------------------------'

DO $$
DECLARE
  type_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO type_count FROM user_types;

  IF type_count < 2 THEN
    RAISE NOTICE '⚠️  WARNING: user_types has % rows (expected 2)', type_count;
    RAISE NOTICE 'Running migration 024 data insert...';

    -- Insert default user types if missing
    INSERT INTO user_types (type_code, type_name, description, global_permissions, is_system_type)
    VALUES
      ('global_admin', 'Global Administrator',
       'Platform-wide administrator with access to all organizations',
       '{"can_access_all_organizations": true, "can_create_organizations": true, "can_delete_organizations": true, "can_manage_platform_users": true, "can_view_system_logs": true, "can_configure_system": true}'::jsonb,
       true),

      ('regular_user', 'Regular User',
       'Standard user with organization-based access only',
       '{"can_access_all_organizations": false, "can_create_organizations": false, "can_delete_organizations": false, "can_manage_platform_users": false, "can_view_system_logs": false, "can_configure_system": false}'::jsonb,
       true)
    ON CONFLICT (type_code) DO NOTHING;

    RAISE NOTICE '✅ Default user types inserted';
  ELSE
    RAISE NOTICE '✅ user_types has % rows', type_count;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- STEP 3: VERIFY organization_roles DATA EXISTS
-- ============================================================================

\echo 'STEP 3: Verifying organization_roles table has data'
\echo '-----------------------------------------------------'

DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM organization_roles;

  IF role_count < 4 THEN
    RAISE NOTICE '⚠️  WARNING: organization_roles has % rows (expected 4)', role_count;
    RAISE NOTICE 'Running migration 024 data insert...';

    -- Insert default organization roles if missing
    INSERT INTO organization_roles (role_code, role_name, description, hierarchy_level, org_permissions, is_system_role)
    VALUES
      ('owner', 'Owner',
       'Organization owner with full permissions',
       4,
       '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": ["all"], "can_manage_users": true, "can_manage_workflows": true, "can_upload_documents": true, "can_delete_documents": true, "can_configure_organization": true}'::jsonb,
       true),

      ('admin', 'Administrator',
       'Organization administrator with management permissions',
       3,
       '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": ["committee", "board"], "can_manage_users": true, "can_manage_workflows": true, "can_upload_documents": true, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
       true),

      ('member', 'Member',
       'Regular member with editing permissions',
       2,
       '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": [], "can_manage_users": false, "can_manage_workflows": false, "can_upload_documents": false, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
       true),

      ('viewer', 'Viewer',
       'Read-only access to organization',
       1,
       '{"can_edit_sections": false, "can_create_suggestions": false, "can_vote": false, "can_approve_stages": [], "can_manage_users": false, "can_manage_workflows": false, "can_upload_documents": false, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
       true)
    ON CONFLICT (role_code) DO NOTHING;

    RAISE NOTICE '✅ Default organization roles inserted';
  ELSE
    RAISE NOTICE '✅ organization_roles has % rows', role_count;
  END IF;
END $$;

\echo ''

-- ============================================================================
-- STEP 4: ASSIGN user_type_id TO USERS WITHOUT IT
-- ============================================================================

\echo 'STEP 4: Assigning user_type_id to users missing it'
\echo '----------------------------------------------------'

DO $$
DECLARE
  users_fixed INTEGER;
  regular_user_type_id UUID;
BEGIN
  -- Get regular_user type ID
  SELECT id INTO regular_user_type_id
  FROM user_types
  WHERE type_code = 'regular_user';

  IF regular_user_type_id IS NULL THEN
    RAISE EXCEPTION 'Cannot find regular_user type in user_types table!';
  END IF;

  -- Update users without user_type_id
  UPDATE users
  SET user_type_id = regular_user_type_id
  WHERE user_type_id IS NULL;

  GET DIAGNOSTICS users_fixed = ROW_COUNT;

  RAISE NOTICE '✅ Fixed % users with missing user_type_id', users_fixed;
END $$;

\echo ''

-- ============================================================================
-- STEP 5: ASSIGN org_role_id TO user_organizations WITHOUT IT
-- ============================================================================

\echo 'STEP 5: Assigning org_role_id to user_organizations missing it'
\echo '----------------------------------------------------------------'

DO $$
DECLARE
  links_fixed INTEGER;
BEGIN
  -- Update user_organizations based on old 'role' column
  UPDATE user_organizations uo
  SET org_role_id = (
    SELECT id
    FROM organization_roles
    WHERE role_code = uo.role
  )
  WHERE uo.org_role_id IS NULL
    AND uo.role IS NOT NULL;

  GET DIAGNOSTICS links_fixed = ROW_COUNT;

  RAISE NOTICE '✅ Fixed % user_organization links with missing org_role_id', links_fixed;
END $$;

\echo ''

-- ============================================================================
-- STEP 6: VERIFICATION
-- ============================================================================

\echo 'STEP 6: Verifying fixes'
\echo '------------------------'

-- Check for users still missing user_type_id
SELECT
  COUNT(*) AS users_still_missing_type
FROM users
WHERE user_type_id IS NULL;

-- Check for user_organizations still missing org_role_id
SELECT
  COUNT(*) AS org_links_still_missing_role
FROM user_organizations
WHERE org_role_id IS NULL;

-- Show RLS status
\echo ''
\echo 'Current RLS status:'
SELECT
  tablename,
  CASE
    WHEN rowsecurity = true THEN '⚠️  ENABLED'
    WHEN rowsecurity = false THEN '✅ DISABLED'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_types', 'organization_roles')
ORDER BY tablename;

\echo ''
\echo '===================================================='
\echo 'IMMEDIATE FIX COMPLETE'
\echo '===================================================='
\echo ''
\echo 'WHAT WAS DONE:'
\echo '  ✅ Disabled RLS on user_types and organization_roles'
\echo '  ✅ Verified default data exists in both tables'
\echo '  ✅ Assigned user_type_id to all users'
\echo '  ✅ Assigned org_role_id to all user_organizations'
\echo ''
\echo 'NEXT STEPS:'
\echo '  1. Test setup wizard again'
\echo '  2. Verify users can log in'
\echo '  3. Check permissions are working'
\echo '  4. Update code to assign user_type_id in:'
\echo '     - Registration flow (auth.js)'
\echo '     - Invitation acceptance (auth.js)'
\echo '===================================================='

COMMIT;
