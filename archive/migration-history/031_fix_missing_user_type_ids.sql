-- Migration 031: Fix existing users with NULL user_type_id
-- Purpose: Backfill missing user_type_id for users created via registration
-- Issue: Users created via /auth/register lack user_type_id, breaking permissions
-- Root Cause: upsertUser() function in auth.js didn't set user_type_id
-- Created: 2025-10-20
-- Related: Case №DETECTIVE-A - "The Missing User Types Mystery"

-- =============================================================================
-- DIAGNOSTIC: Count users missing user_type_id
-- =============================================================================

DO $$
DECLARE
  missing_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM users
  WHERE user_type_id IS NULL;

  SELECT COUNT(*) INTO total_count
  FROM users;

  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 USER TYPE DIAGNOSTIC';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total users: %', total_count;
  RAISE NOTICE 'Users with NULL user_type_id: %', missing_count;
  RAISE NOTICE 'Users with valid user_type_id: %', total_count - missing_count;
  RAISE NOTICE '';

  IF missing_count = 0 THEN
    RAISE NOTICE '✅ No users need fixing!';
  ELSE
    RAISE NOTICE '⚠️  % users need user_type_id backfill', missing_count;
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- SHOW AFFECTED USERS (for logging/debugging)
-- =============================================================================

DO $$
DECLARE
  user_record RECORD;
  count INTEGER := 0;
BEGIN
  RAISE NOTICE '📋 USERS WITH NULL user_type_id:';
  RAISE NOTICE '----------------------------------------';

  FOR user_record IN
    SELECT id, email, created_at
    FROM users
    WHERE user_type_id IS NULL
    ORDER BY created_at DESC
    LIMIT 20
  LOOP
    count := count + 1;
    RAISE NOTICE '%: % (%) - created %',
      count,
      user_record.email,
      user_record.id,
      user_record.created_at;
  END LOOP;

  IF count = 0 THEN
    RAISE NOTICE '(none - all users have user_type_id)';
  END IF;

  RAISE NOTICE '----------------------------------------';
  RAISE NOTICE '';
END $$;

-- =============================================================================
-- FIX: Backfill all users with NULL user_type_id to 'regular_user'
-- =============================================================================

-- Step 1: Verify user_types exist
DO $$
DECLARE
  regular_user_exists BOOLEAN;
  global_admin_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_types WHERE type_code = 'regular_user')
    INTO regular_user_exists;

  SELECT EXISTS(SELECT 1 FROM user_types WHERE type_code = 'global_admin')
    INTO global_admin_exists;

  IF NOT regular_user_exists THEN
    RAISE EXCEPTION 'user_types table missing regular_user type! Run migration 024 first.';
  END IF;

  IF NOT global_admin_exists THEN
    RAISE EXCEPTION 'user_types table missing global_admin type! Run migration 024 first.';
  END IF;

  RAISE NOTICE '✅ User types verified: regular_user and global_admin exist';
END $$;

-- Step 2: Perform the backfill
UPDATE users
SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'regular_user'
)
WHERE user_type_id IS NULL;

-- =============================================================================
-- VERIFICATION: Check the fix worked
-- =============================================================================

DO $$
DECLARE
  fixed_count INTEGER;
  remaining_null INTEGER;
  regular_user_count INTEGER;
  global_admin_count INTEGER;
BEGIN
  -- Count users by type
  SELECT COUNT(*) INTO regular_user_count
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE ut.type_code = 'regular_user';

  SELECT COUNT(*) INTO global_admin_count
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE ut.type_code = 'global_admin';

  -- Count remaining NULL
  SELECT COUNT(*) INTO remaining_null
  FROM users
  WHERE user_type_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ BACKFILL COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 USER TYPE DISTRIBUTION:';
  RAISE NOTICE '  Regular Users: %', regular_user_count;
  RAISE NOTICE '  Global Admins: %', global_admin_count;
  RAISE NOTICE '  NULL user_type_id: %', remaining_null;
  RAISE NOTICE '';

  IF remaining_null > 0 THEN
    RAISE WARNING '⚠️  % users still have NULL user_type_id - investigate!', remaining_null;
  ELSE
    RAISE NOTICE '✅ All users have valid user_type_id';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- SHOW FIXED USERS (sample)
-- =============================================================================

SELECT
  u.id,
  u.email,
  ut.type_code as user_type,
  ut.type_name,
  u.created_at,
  u.last_login
FROM users u
JOIN user_types ut ON u.user_type_id = ut.id
ORDER BY u.created_at DESC
LIMIT 10;

-- =============================================================================
-- FUTURE: Add NOT NULL constraint (commented out for safety)
-- =============================================================================

-- Uncomment these lines AFTER verifying all users have user_type_id

-- Step 1: Add NOT NULL constraint
-- ALTER TABLE users ALTER COLUMN user_type_id SET NOT NULL;

-- Step 2: Add check constraint
-- ALTER TABLE users ADD CONSTRAINT users_user_type_id_valid
--   CHECK (user_type_id IS NOT NULL);

-- Step 3: Add default for new users (defensive)
-- ALTER TABLE users ALTER COLUMN user_type_id SET DEFAULT (
--   SELECT id FROM user_types WHERE type_code = 'regular_user'
-- );

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎯 MIGRATION 031 COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Fixed: All users now have user_type_id';
  RAISE NOTICE '✅ Permissions middleware will now work';
  RAISE NOTICE '✅ Users can access dashboard without errors';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEPS:';
  RAISE NOTICE '1. Fix auth.js upsertUser() to set user_type_id';
  RAISE NOTICE '2. Test user registration creates valid users';
  RAISE NOTICE '3. Test existing users can login successfully';
  RAISE NOTICE '4. After verification, add NOT NULL constraint';
  RAISE NOTICE '';
  RAISE NOTICE 'See: docs/diagnosis/auth-errors-investigation.md';
  RAISE NOTICE '========================================';
END $$;
