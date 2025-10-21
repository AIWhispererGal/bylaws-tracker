-- ============================================================================
-- VERIFICATION SQL QUERIES
-- Quick diagnostic queries to confirm the two critical issues
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ISSUE #1: Wrong Permissions - Verify Role Assignment
-- ----------------------------------------------------------------------------

-- Query 1: Check what roles were actually assigned during setup
-- Expected: role = 'owner', NOT 'superuser' or 'org_admin'
SELECT
  u.email,
  u.created_at as user_created,
  uo.role as legacy_role_column,
  uo.org_role_id as new_role_id,
  org_roles.role_code as actual_role_from_new_system,
  org_roles.role_name,
  org_roles.hierarchy_level,
  o.name as organization_name,
  uo.is_active
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
LEFT JOIN organization_roles org_roles ON org_roles.id = uo.org_role_id
ORDER BY u.created_at DESC
LIMIT 10;

-- Expected Output:
-- legacy_role_column | actual_role_from_new_system | hierarchy_level
-- -------------------|----------------------------|----------------
-- 'owner'            | 'owner'                    | 4              ✅ CORRECT
-- 'superuser'        | 'owner'                    | 4              ❌ BUG (Issue #1)
-- 'org_admin'        | 'owner'                    | 4              ❌ BUG (Issue #1)


-- Query 2: Find users with mismatched role assignments
-- These users will experience "wrong permissions" bug
SELECT
  u.email,
  uo.role as legacy_role,
  org_roles.role_code as new_role,
  CASE
    WHEN uo.role != org_roles.role_code THEN '❌ MISMATCH - BUG CONFIRMED'
    ELSE '✅ CORRECT'
  END as status
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
LEFT JOIN organization_roles org_roles ON org_roles.id = uo.org_role_id
WHERE uo.role != org_roles.role_code;

-- If this returns ANY rows, Issue #1 is present


-- Query 3: Check user_types assignment (global_admin vs regular_user)
SELECT
  u.email,
  ut.type_code as user_type,
  COUNT(uo.organization_id) as num_organizations,
  CASE
    WHEN ut.type_code = 'global_admin' THEN 'Should be first user in system'
    WHEN ut.type_code = 'regular_user' THEN 'Normal user'
    ELSE 'Unknown type'
  END as note
FROM users u
LEFT JOIN user_types ut ON ut.id = u.user_type_id
LEFT JOIN user_organizations uo ON uo.user_id = u.id
GROUP BY u.id, u.email, ut.type_code
ORDER BY u.created_at;


-- ----------------------------------------------------------------------------
-- ISSUE #2: Organization Selector - Verify Data Exists
-- ----------------------------------------------------------------------------

-- Query 4: Verify organizations exist in database
-- If empty: Setup never completed
-- If populated: Issue is with AUTH ROUTE query
SELECT
  id,
  name,
  slug,
  organization_type,
  is_configured,
  created_at,
  CASE
    WHEN is_configured = true THEN '✅ Configured'
    ELSE '⚠️ Not Configured'
  END as status
FROM organizations
ORDER BY created_at DESC;


-- Query 5: Verify user_organizations links exist
-- This is the table that the org selector queries
SELECT
  u.email,
  o.name as organization_name,
  uo.role,
  uo.is_active,
  CASE
    WHEN uo.is_active = true THEN '✅ Active'
    ELSE '⚠️ Inactive'
  END as membership_status
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
ORDER BY u.created_at DESC, o.created_at DESC;

-- If this returns results, data exists
-- If org selector still shows "No organizations found", Issue #2 is confirmed


-- Query 6: Test the EXACT query used by org selector
-- This simulates what the auth route does (regular user path)
-- Replace USER_EMAIL with the email of the logged-in user
WITH target_user AS (
  SELECT id FROM users WHERE email = 'YOUR_EMAIL_HERE' LIMIT 1
)
SELECT
  uo.organization_id,
  uo.role,
  o.id,
  o.name,
  o.organization_type,
  o.created_at
FROM user_organizations uo
JOIN organizations o ON o.id = uo.organization_id
WHERE uo.user_id = (SELECT id FROM target_user)
  AND uo.is_active = true;

-- If this returns results: Data is fine, issue is RLS or client context
-- If this returns empty: User is not linked to any organizations


-- ----------------------------------------------------------------------------
-- RLS DIAGNOSTICS
-- ----------------------------------------------------------------------------

-- Query 7: Check RLS status on critical tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ RLS Enabled'
    ELSE '⚠️ RLS Disabled'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'user_organizations',
    'users',
    'user_types',
    'organization_roles'
  )
ORDER BY tablename;

-- Expected:
-- organizations: RLS Disabled ✅ (migration 028)
-- user_organizations: RLS Enabled ⚠️ (this is why service client needed)


-- Query 8: Check RLS policies on user_organizations
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_organizations'
ORDER BY policyname;

-- This shows what RLS policies are blocking the org selector


-- ----------------------------------------------------------------------------
-- QUICK FIX VERIFICATION
-- ----------------------------------------------------------------------------

-- Query 9: After applying Fix #1, verify roles are correct
-- Run this AFTER changing setup.js
SELECT
  u.email,
  uo.role,
  org_roles.role_code,
  CASE
    WHEN uo.role = 'owner' AND org_roles.role_code = 'owner' THEN '✅ FIX APPLIED CORRECTLY'
    WHEN uo.role IN ('superuser', 'org_admin') THEN '❌ BUG STILL PRESENT - FIX NOT APPLIED'
    ELSE '⚠️ UNEXPECTED STATE'
  END as verification
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
JOIN organization_roles org_roles ON org_roles.id = uo.org_role_id
WHERE u.created_at > NOW() - INTERVAL '1 hour' -- Recent users only
ORDER BY u.created_at DESC;


-- Query 10: Manual fix for existing users with wrong permissions
-- EMERGENCY FIX: Run this to fix users already affected by Issue #1
UPDATE user_organizations
SET role = 'owner'
WHERE org_role_id = (
  SELECT id FROM organization_roles WHERE role_code = 'owner'
)
AND role IN ('superuser', 'org_admin');

-- After running this, verify with Query 9


-- ----------------------------------------------------------------------------
-- FULL SYSTEM HEALTH CHECK
-- ----------------------------------------------------------------------------

-- Query 11: Comprehensive health check
SELECT
  'Total Users' as metric,
  COUNT(*) as count
FROM users
UNION ALL
SELECT
  'Total Organizations',
  COUNT(*)
FROM organizations
UNION ALL
SELECT
  'Total User-Org Links',
  COUNT(*)
FROM user_organizations
UNION ALL
SELECT
  'Users with Mismatched Roles',
  COUNT(*)
FROM user_organizations uo
LEFT JOIN organization_roles org_roles ON org_roles.id = uo.org_role_id
WHERE uo.role != org_roles.role_code
UNION ALL
SELECT
  'Organizations with No Users',
  COUNT(*)
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations uo
  WHERE uo.organization_id = o.id
  AND uo.is_active = true
)
UNION ALL
SELECT
  'Users with No Organizations',
  COUNT(*)
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations uo
  WHERE uo.user_id = u.id
  AND uo.is_active = true
);


-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
--
-- 1. Connect to your Supabase database using psql or SQL Editor
-- 2. Run queries 1-6 to diagnose the issues
-- 3. If Issue #1 confirmed: Apply code fix to setup.js, then run Query 10
-- 4. If Issue #2 confirmed: Apply code fix to auth.js
-- 5. Run Query 11 to verify overall system health
--
-- ============================================================================
