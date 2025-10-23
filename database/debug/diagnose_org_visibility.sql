-- ============================================================================
-- Organization Visibility Diagnostic Script
-- ============================================================================
-- PURPOSE: Diagnose why user can't see organizations after RLS fix
-- CREATED: 2025-10-22
-- CONTEXT: Migration 005 fixed infinite recursion, but user still can't see orgs
-- ============================================================================

-- ============================================================================
-- SECTION 1: AUTHENTICATION CONTEXT
-- ============================================================================
-- Check what user is currently authenticated

\echo '========================================='
\echo 'SECTION 1: AUTHENTICATION CONTEXT'
\echo '========================================='
\echo ''

-- 1.1: Check current user authentication
\echo '1.1: Current PostgreSQL User Role:'
SELECT current_user, session_user;
\echo ''

-- 1.2: Check Supabase auth context
\echo '1.2: Supabase Auth Context (auth.uid()):'
SELECT auth.uid() AS current_user_id;
\echo ''

-- 1.3: Check JWT claims
\echo '1.3: JWT Role:'
SELECT (auth.jwt() ->> 'role')::text AS jwt_role;
\echo ''

-- ============================================================================
-- SECTION 2: USER DATA INSPECTION
-- ============================================================================

\echo '========================================='
\echo 'SECTION 2: USER DATA INSPECTION'
\echo '========================================='
\echo ''

-- 2.1: List all users in auth.users
\echo '2.1: All Users in auth.users table:'
SELECT
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at,
  raw_user_meta_data->>'name' AS name
FROM auth.users
ORDER BY created_at DESC;
\echo ''

-- 2.2: List all users in public.users
\echo '2.2: All Users in public.users table:'
SELECT
  id,
  email,
  name,
  created_at,
  last_login,
  auth_provider
FROM public.users
ORDER BY created_at DESC;
\echo ''

-- ============================================================================
-- SECTION 3: ORGANIZATION DATA
-- ============================================================================

\echo '========================================='
\echo 'SECTION 3: ORGANIZATION DATA'
\echo '========================================='
\echo ''

-- 3.1: List all organizations
\echo '3.1: All Organizations (using service role):'
SELECT
  id,
  name,
  organization_type,
  is_configured,
  created_at
FROM public.organizations
ORDER BY created_at DESC;
\echo ''

-- 3.2: Specific organization check
\echo '3.2: Check specific organization (5bc79ee9-ac8d-4638-864c-3e05d4e60810):'
SELECT
  id,
  name,
  organization_type,
  is_configured,
  created_at,
  settings
FROM public.organizations
WHERE id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
\echo ''

-- ============================================================================
-- SECTION 4: USER-ORGANIZATION ASSIGNMENTS
-- ============================================================================

\echo '========================================='
\echo 'SECTION 4: USER-ORGANIZATION ASSIGNMENTS'
\echo '========================================='
\echo ''

-- 4.1: List ALL user_organizations records
\echo '4.1: All user_organizations assignments (service role view):'
SELECT
  uo.id,
  uo.user_id,
  u.email AS user_email,
  u.name AS user_name,
  uo.organization_id,
  o.name AS org_name,
  uo.role,
  uo.is_active,
  uo.is_global_admin,
  uo.joined_at
FROM user_organizations uo
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN organizations o ON uo.organization_id = o.id
ORDER BY uo.created_at DESC;
\echo ''

-- 4.2: Check for organization 5bc79ee9-ac8d-4638-864c-3e05d4e60810 specifically
\echo '4.2: Users assigned to organization 5bc79ee9-ac8d-4638-864c-3e05d4e60810:'
SELECT
  uo.user_id,
  u.email,
  u.name,
  uo.role,
  uo.is_active,
  uo.joined_at
FROM user_organizations uo
LEFT JOIN users u ON uo.user_id = u.id
WHERE uo.organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
\echo ''

-- ============================================================================
-- SECTION 5: RLS POLICY VERIFICATION
-- ============================================================================

\echo '========================================='
\echo 'SECTION 5: RLS POLICY VERIFICATION'
\echo '========================================='
\echo ''

-- 5.1: Verify RLS is enabled
\echo '5.1: RLS Status for key tables:'
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN ('user_organizations', 'organizations', 'users')
  AND schemaname = 'public'
ORDER BY tablename;
\echo ''

-- 5.2: List all policies on user_organizations
\echo '5.2: All RLS Policies on user_organizations:'
SELECT
  policyname,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE tablename = 'user_organizations'
  AND schemaname = 'public'
ORDER BY policyname;
\echo ''

-- 5.3: Check helper function
\echo '5.3: Helper Function is_org_admin details:'
SELECT
  routine_name,
  routine_schema,
  security_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'is_org_admin'
  AND routine_schema = 'public';
\echo ''

-- ============================================================================
-- SECTION 6: SIMULATE USER QUERIES (WITH USER CONTEXT)
-- ============================================================================

\echo '========================================='
\echo 'SECTION 6: SIMULATE USER QUERIES'
\echo '========================================='
\echo ''

-- NOTE: These queries will return different results depending on whether
-- you're running as service_role or as an authenticated user

-- 6.1: What does auth.uid() return?
\echo '6.1: Current auth.uid() value:'
SELECT auth.uid() AS authenticated_user_id;
\echo ''

-- 6.2: Can the current user see their own user_organizations?
\echo '6.2: User_organizations visible to current user (auth.uid()):'
SELECT
  uo.id,
  uo.organization_id,
  o.name AS org_name,
  uo.role,
  uo.is_active
FROM user_organizations uo
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE uo.user_id = auth.uid();
\echo ''

-- 6.3: Can the current user see organizations through the join?
\echo '6.3: Organizations visible through user_organizations join:'
SELECT
  o.id,
  o.name,
  o.organization_type,
  uo.role AS user_role
FROM organizations o
INNER JOIN user_organizations uo ON o.id = uo.organization_id
WHERE uo.user_id = auth.uid()
  AND uo.is_active = true;
\echo ''

-- ============================================================================
-- SECTION 7: TEST SPECIFIC USER (REPLACE WITH ACTUAL USER ID)
-- ============================================================================

\echo '========================================='
\echo 'SECTION 7: TEST SPECIFIC USER'
\echo '========================================='
\echo ''

-- 7.1: Replace this UUID with the actual user ID from login
-- Get it from: SELECT id FROM auth.users WHERE email = 'user@example.com';

\echo '7.1: Replace USER_ID_HERE with actual user UUID'
\echo 'Example: SELECT * FROM user_organizations WHERE user_id = ''00000000-0000-0000-0000-000000000000'';'
\echo ''

-- ============================================================================
-- SECTION 8: COMMON ISSUES CHECKLIST
-- ============================================================================

\echo '========================================='
\echo 'SECTION 8: COMMON ISSUES CHECKLIST'
\echo '========================================='
\echo ''

-- 8.1: Check for orphaned user records (users without auth)
\echo '8.1: Users in public.users but NOT in auth.users (orphaned):'
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = u.id
);
\echo ''

-- 8.2: Check for users in auth but not in user_organizations
\echo '8.2: Auth users WITHOUT any organization assignment:'
SELECT
  au.id,
  au.email,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_organizations uo WHERE uo.user_id = au.id
);
\echo ''

-- 8.3: Check for inactive user_organization assignments
\echo '8.3: Inactive user_organization assignments:'
SELECT
  uo.user_id,
  u.email,
  uo.organization_id,
  o.name AS org_name,
  uo.is_active,
  uo.role
FROM user_organizations uo
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE uo.is_active = false;
\echo ''

-- ============================================================================
-- SECTION 9: RECOMMENDED FIXES
-- ============================================================================

\echo '========================================='
\echo 'SECTION 9: RECOMMENDED FIXES'
\echo '========================================='
\echo ''

\echo 'Based on the diagnostic results above, apply one of these fixes:'
\echo ''
\echo 'FIX 1: User exists but not assigned to organization'
\echo '  INSERT INTO user_organizations (user_id, organization_id, role)'
\echo '  VALUES (''USER_ID'', ''5bc79ee9-ac8d-4638-864c-3e05d4e60810'', ''owner'');'
\echo ''
\echo 'FIX 2: User assignment is inactive'
\echo '  UPDATE user_organizations'
\echo '  SET is_active = true'
\echo '  WHERE user_id = ''USER_ID'''
\echo '    AND organization_id = ''5bc79ee9-ac8d-4638-864c-3e05d4e60810'';'
\echo ''
\echo 'FIX 3: User does not exist in public.users table'
\echo '  Run the upsertUser function in auth.js to create the user record'
\echo ''
\echo 'FIX 4: RLS policy issue - verify auth.uid() returns correct value'
\echo '  Check JWT token is being passed correctly from frontend'
\echo ''

-- ============================================================================
-- SECTION 10: MANUAL TEST QUERIES
-- ============================================================================

\echo '========================================='
\echo 'SECTION 10: MANUAL TEST QUERIES'
\echo '========================================='
\echo ''

\echo 'Run these queries manually after replacing USER_ID with actual value:'
\echo ''
\echo '-- Test auth.uid() visibility:'
\echo 'SELECT auth.uid();'
\echo ''
\echo '-- Test user_organizations visibility:'
\echo 'SELECT * FROM user_organizations WHERE user_id = auth.uid();'
\echo ''
\echo '-- Test organizations join:'
\echo 'SELECT o.* FROM organizations o'
\echo 'INNER JOIN user_organizations uo ON o.id = uo.organization_id'
\echo 'WHERE uo.user_id = auth.uid();'
\echo ''

-- ============================================================================
-- END OF DIAGNOSTIC SCRIPT
-- ============================================================================

\echo ''
\echo '========================================='
\echo 'DIAGNOSTIC COMPLETE'
\echo '========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Review the output above to identify the issue'
\echo '2. Check if auth.uid() returns a valid UUID'
\echo '3. Verify the user is assigned to organization 5bc79ee9-ac8d-4638-864c-3e05d4e60810'
\echo '4. Check if the assignment is_active = true'
\echo '5. Apply the appropriate fix from SECTION 9'
\echo ''
