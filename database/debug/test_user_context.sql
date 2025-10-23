-- ============================================================================
-- Test User Authentication Context
-- ============================================================================
-- This script tests RLS policies from a user's perspective
-- Run this AFTER authenticating as a user (not with service role)
-- ============================================================================

-- IMPORTANT: This file should be run with a user JWT token, not service role
-- To test as a user in Supabase:
-- 1. Use Supabase SQL Editor
-- 2. Select "Run as: Authenticated user" (not service role)
-- 3. Provide a valid JWT token from a logged-in user

\echo '========================================='
\echo 'USER CONTEXT TEST'
\echo '========================================='
\echo ''
\echo 'This test verifies RLS policies work correctly for authenticated users'
\echo ''

-- Test 1: Check auth.uid()
\echo 'TEST 1: Check auth.uid() returns valid user ID'
\echo '---------------------------------------'
SELECT
  auth.uid() AS current_user_id,
  CASE
    WHEN auth.uid() IS NULL THEN '❌ FAILED - auth.uid() is NULL (not authenticated)'
    ELSE '✓ PASSED - User is authenticated'
  END AS test_result;
\echo ''

-- Test 2: Check JWT role
\echo 'TEST 2: Check JWT role'
\echo '---------------------------------------'
SELECT
  (auth.jwt() ->> 'role')::text AS jwt_role,
  CASE
    WHEN (auth.jwt() ->> 'role')::text = 'authenticated' THEN '✓ PASSED - Using authenticated role'
    WHEN (auth.jwt() ->> 'role')::text = 'service_role' THEN '⚠️ WARNING - Using service role (bypasses RLS)'
    WHEN (auth.jwt() ->> 'role')::text = 'anon' THEN '❌ FAILED - Using anonymous role'
    ELSE '❌ FAILED - Unknown role'
  END AS test_result;
\echo ''

-- Test 3: Can user see their own user_organizations?
\echo 'TEST 3: Can user query their own user_organizations?'
\echo '---------------------------------------'
SELECT
  id,
  organization_id,
  role,
  is_active,
  CASE
    WHEN is_active THEN '✓ Active'
    ELSE '❌ Inactive'
  END AS status
FROM user_organizations
WHERE user_id = auth.uid();

\echo ''
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASSED - User can see their user_organizations'
    ELSE '❌ FAILED - No user_organizations visible (RLS policy issue or no assignments)'
  END AS test_result,
  COUNT(*) AS records_found
FROM user_organizations
WHERE user_id = auth.uid();
\echo ''

-- Test 4: Can user see organizations through join?
\echo 'TEST 4: Can user query organizations via user_organizations join?'
\echo '---------------------------------------'
SELECT
  o.id,
  o.name,
  o.organization_type,
  uo.role AS user_role
FROM organizations o
INNER JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.user_id = auth.uid();

\echo ''
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASSED - User can see organizations'
    ELSE '❌ FAILED - No organizations visible'
  END AS test_result,
  COUNT(*) AS organizations_found
FROM organizations o
INNER JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.user_id = auth.uid();
\echo ''

-- Test 5: Can user see the specific organization?
\echo 'TEST 5: Can user see organization 5bc79ee9-ac8d-4638-864c-3e05d4e60810?'
\echo '---------------------------------------'
SELECT
  o.id,
  o.name,
  uo.role AS user_role,
  uo.is_active
FROM organizations o
INNER JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.user_id = auth.uid()
  AND o.id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

\echo ''
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✓ PASSED - User can see the target organization'
    ELSE '❌ FAILED - User cannot see organization (not assigned or RLS blocking)'
  END AS test_result
FROM organizations o
INNER JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.user_id = auth.uid()
  AND o.id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
\echo ''

-- Test 6: Test the is_org_admin function
\echo 'TEST 6: Test is_org_admin helper function'
\echo '---------------------------------------'
SELECT
  public.is_org_admin(
    auth.uid(),
    '5bc79ee9-ac8d-4638-864c-3e05d4e60810'
  ) AS is_admin,
  CASE
    WHEN public.is_org_admin(auth.uid(), '5bc79ee9-ac8d-4638-864c-3e05d4e60810') THEN
      '✓ PASSED - User is admin of this org'
    ELSE
      '⚠️ INFO - User is not admin (may still be a member)'
  END AS test_result;
\echo ''

-- Test 7: Summary
\echo 'TEST 7: SUMMARY'
\echo '---------------------------------------'
WITH test_results AS (
  SELECT
    auth.uid() IS NOT NULL AS auth_works,
    EXISTS (SELECT 1 FROM user_organizations WHERE user_id = auth.uid()) AS has_memberships,
    EXISTS (
      SELECT 1 FROM organizations o
      INNER JOIN user_organizations uo ON o.id = uo.organization_id
      WHERE uo.user_id = auth.uid()
    ) AS can_see_orgs,
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810'
        AND is_active = true
    ) AS assigned_to_target_org
)
SELECT
  auth_works,
  has_memberships,
  can_see_orgs,
  assigned_to_target_org,
  CASE
    WHEN NOT auth_works THEN
      '❌ CRITICAL: User authentication is not working (auth.uid() is NULL)'
    WHEN NOT has_memberships THEN
      '❌ PROBLEM: User has no organization memberships - need to assign user to org'
    WHEN NOT can_see_orgs THEN
      '❌ PROBLEM: RLS policies are blocking organization visibility'
    WHEN NOT assigned_to_target_org THEN
      '❌ PROBLEM: User is not assigned to organization 5bc79ee9-ac8d-4638-864c-3e05d4e60810'
    ELSE
      '✓ ALL TESTS PASSED - User should be able to see their organizations'
  END AS overall_diagnosis
FROM test_results;

\echo ''
\echo '========================================='
\echo 'NEXT STEPS'
\echo '========================================='
\echo ''
\echo 'If tests failed, check:'
\echo '1. JWT token is valid and contains user ID'
\echo '2. User exists in auth.users table'
\echo '3. User is assigned to organization in user_organizations table'
\echo '4. Assignment has is_active = true'
\echo '5. RLS policies are correctly applied'
\echo ''
\echo 'To fix user assignment, run as service role:'
\echo 'INSERT INTO user_organizations (user_id, organization_id, role, is_active)'
\echo 'VALUES ('[USER_ID]', '5bc79ee9-ac8d-4638-864c-3e05d4e60810', 'owner', true);'
\echo ''
