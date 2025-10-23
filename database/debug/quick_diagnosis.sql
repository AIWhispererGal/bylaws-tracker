-- ============================================================================
-- Quick Organization Visibility Diagnosis
-- ============================================================================
-- Run this with service role to quickly identify the problem
-- ============================================================================

-- Find the user who's trying to log in
SELECT
  'STEP 1: USER IDENTIFICATION' AS diagnostic_step,
  au.id AS user_id,
  au.email,
  au.created_at,
  au.email_confirmed_at,
  CASE
    WHEN pu.id IS NOT NULL THEN 'EXISTS in public.users'
    ELSE '❌ MISSING from public.users'
  END AS public_users_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC
LIMIT 5;

\echo ''

-- Check user_organizations assignments
SELECT
  'STEP 2: ORGANIZATION ASSIGNMENTS' AS diagnostic_step,
  uo.id AS assignment_id,
  uo.user_id,
  u.email AS user_email,
  uo.organization_id,
  o.name AS org_name,
  uo.role,
  CASE
    WHEN uo.is_active THEN '✓ ACTIVE'
    ELSE '❌ INACTIVE'
  END AS status,
  uo.joined_at
FROM user_organizations uo
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN organizations o ON uo.organization_id = o.id
ORDER BY uo.created_at DESC;

\echo ''

-- Check for the specific organization
SELECT
  'STEP 3: TARGET ORGANIZATION CHECK' AS diagnostic_step,
  id,
  name,
  organization_type,
  is_configured,
  created_at
FROM organizations
WHERE id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

\echo ''

-- Check if there are ANY user_organization assignments for this org
SELECT
  'STEP 4: USERS FOR TARGET ORG' AS diagnostic_step,
  COUNT(*) AS total_users,
  COUNT(CASE WHEN is_active THEN 1 END) AS active_users,
  COUNT(CASE WHEN role IN ('owner', 'admin') THEN 1 END) AS admin_users
FROM user_organizations
WHERE organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

\echo ''

-- Identify the exact problem
SELECT
  'STEP 5: PROBLEM IDENTIFICATION' AS diagnostic_step,
  CASE
    WHEN (SELECT COUNT(*) FROM auth.users) = 0 THEN
      '❌ NO USERS in auth.users - registration failed'
    WHEN (SELECT COUNT(*) FROM public.users) = 0 THEN
      '❌ NO USERS in public.users - upsertUser function failed'
    WHEN (SELECT COUNT(*) FROM user_organizations WHERE organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810') = 0 THEN
      '❌ NO USER ASSIGNMENTS to organization - createUserOrganization failed'
    WHEN (SELECT COUNT(*) FROM user_organizations WHERE organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810' AND is_active = true) = 0 THEN
      '❌ USER ASSIGNED but INACTIVE - need to activate'
    ELSE
      '✓ Everything looks correct - RLS query issue'
  END AS diagnosis,
  CASE
    WHEN (SELECT COUNT(*) FROM user_organizations WHERE organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810') = 0 THEN
      'FIX: Assign user to organization using service role'
    WHEN (SELECT COUNT(*) FROM user_organizations WHERE organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810' AND is_active = true) = 0 THEN
      'FIX: Activate user_organization assignment'
    ELSE
      'FIX: Check frontend is passing JWT token correctly'
  END AS recommended_fix;

\echo ''

-- Show the exact SQL to fix the most common issue
SELECT
  'STEP 6: READY-TO-RUN FIX' AS diagnostic_step,
  'Run this if user is not assigned to org:' AS instruction,
  format(
    'INSERT INTO user_organizations (user_id, organization_id, role, is_active, joined_at) VALUES (%L, %L, %L, true, NOW());',
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),
    '5bc79ee9-ac8d-4638-864c-3e05d4e60810',
    'owner'
  ) AS fix_sql;
