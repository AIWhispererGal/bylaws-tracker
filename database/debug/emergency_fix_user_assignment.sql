-- ============================================================================
-- Emergency Fix: Assign User to Organization
-- ============================================================================
-- RUN THIS ONLY AFTER quick_diagnosis.sql confirms user is not assigned
-- This script safely assigns the latest user to organization
-- ============================================================================

-- SAFETY CHECKS FIRST
DO $$
DECLARE
  v_user_count INTEGER;
  v_org_exists BOOLEAN;
  v_already_assigned BOOLEAN;
  v_user_id UUID;
  v_org_id UUID := '5bc79ee9-ac8d-4638-864c-3e05d4e60810';
BEGIN
  -- Check 1: Ensure organization exists
  SELECT EXISTS (
    SELECT 1 FROM organizations WHERE id = v_org_id
  ) INTO v_org_exists;

  IF NOT v_org_exists THEN
    RAISE EXCEPTION 'Organization % does not exist!', v_org_id;
  END IF;

  RAISE NOTICE '✓ Organization exists: %', v_org_id;

  -- Check 2: Get the most recent user from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users table!';
  END IF;

  RAISE NOTICE '✓ Found user ID: %', v_user_id;

  -- Check 3: Verify user is NOT already assigned
  SELECT EXISTS (
    SELECT 1
    FROM user_organizations
    WHERE user_id = v_user_id
      AND organization_id = v_org_id
  ) INTO v_already_assigned;

  IF v_already_assigned THEN
    RAISE NOTICE '⚠️  User is already assigned to this organization';
    RAISE NOTICE 'Checking if assignment is active...';

    -- Check if inactive and fix
    UPDATE user_organizations
    SET is_active = true
    WHERE user_id = v_user_id
      AND organization_id = v_org_id
      AND is_active = false;

    IF FOUND THEN
      RAISE NOTICE '✓ FIXED: Activated inactive user assignment';
    ELSE
      RAISE NOTICE '✓ Assignment is already active - no fix needed';
    END IF;

  ELSE
    -- User is not assigned - create the assignment
    RAISE NOTICE 'Creating user_organization assignment...';

    INSERT INTO user_organizations (
      user_id,
      organization_id,
      role,
      is_active,
      is_global_admin,
      joined_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_org_id,
      'owner',  -- First user gets owner role
      true,
      false,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE '✓ SUCCESS: User assigned to organization as owner';
  END IF;

  -- Verify the fix
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';

  SELECT COUNT(*) INTO v_user_count
  FROM user_organizations
  WHERE user_id = v_user_id
    AND organization_id = v_org_id
    AND is_active = true;

  IF v_user_count > 0 THEN
    RAISE NOTICE '✓ User can now access organization';
    RAISE NOTICE '';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Organization ID: %', v_org_id;
    RAISE NOTICE 'Role: owner';
    RAISE NOTICE 'Status: active';
  ELSE
    RAISE EXCEPTION 'Verification failed - user assignment not found!';
  END IF;

END $$;

-- Show final state
SELECT
  'FINAL STATE' AS status,
  uo.user_id,
  u.email AS user_email,
  uo.organization_id,
  o.name AS organization_name,
  uo.role,
  uo.is_active,
  uo.joined_at
FROM user_organizations uo
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE uo.organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810'
ORDER BY uo.created_at DESC;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
\echo ''
\echo '========================================='
\echo 'FIX APPLIED SUCCESSFULLY'
\echo '========================================='
\echo ''
\echo 'Next steps:'
\echo '1. User should now be able to log in and see the organization'
\echo '2. Test by logging out and logging back in'
\echo '3. Dashboard should display organization data'
\echo '4. Run test_user_context.sql to verify RLS policies work correctly'
\echo ''
