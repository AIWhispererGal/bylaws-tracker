-- Quick Fix for Organization Visibility (Supabase SQL Editor Compatible)
-- ============================================================================
-- This script assigns your user to the organization
-- Run this directly in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Show current state
SELECT
  '=== CURRENT STATE ===' as step,
  (SELECT count(*) FROM organizations) as org_count,
  (SELECT count(*) FROM auth.users) as user_count,
  (SELECT count(*) FROM user_organizations) as assignment_count;

-- STEP 2: Show the organization
SELECT
  '=== ORGANIZATION ===' as step,
  id,
  name,
  created_at
FROM organizations
WHERE id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

-- STEP 3: Show all users (to identify which one to assign)
SELECT
  '=== USERS ===' as step,
  id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- STEP 4: Show current user_organizations assignments
SELECT
  '=== CURRENT ASSIGNMENTS ===' as step,
  uo.user_id,
  uo.organization_id,
  uo.role,
  uo.is_active,
  u.email
FROM user_organizations uo
JOIN auth.users u ON u.id = uo.user_id
WHERE uo.organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

-- ============================================================================
-- STEP 5: AUTOMATIC FIX
-- This will assign the MOST RECENT user to the organization
-- If you have multiple users, you may want to verify Step 3 first
-- ============================================================================

-- Insert or update user assignment
INSERT INTO user_organizations (
  user_id,
  organization_id,
  role,
  is_active,
  joined_at
)
SELECT
  u.id,
  '5bc79ee9-ac8d-4638-864c-3e05d4e60810'::uuid,
  'owner',
  true,
  NOW()
FROM auth.users u
WHERE u.email = (
  -- REPLACE THIS EMAIL with your actual user email
  -- Or use the most recent user:
  SELECT email FROM auth.users ORDER BY created_at DESC LIMIT 1
)
ON CONFLICT (user_id, organization_id)
DO UPDATE SET
  is_active = true,
  role = 'owner',
  joined_at = COALESCE(user_organizations.joined_at, NOW());

-- STEP 6: Verify the fix
SELECT
  '=== FIX VERIFICATION ===' as step,
  uo.user_id,
  uo.organization_id,
  uo.role,
  uo.is_active,
  u.email,
  o.name as org_name
FROM user_organizations uo
JOIN auth.users u ON u.id = uo.user_id
JOIN organizations o ON o.id = uo.organization_id
WHERE uo.organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

-- ============================================================================
-- SUCCESS!
-- If you see a row in STEP 6 with your email and is_active = true,
-- the fix is complete. Log out and log back in to see your organization.
-- ============================================================================
