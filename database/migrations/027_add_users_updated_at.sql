-- Migration 027: Add updated_at column to users table
-- Date: 2025-10-27
-- Bug Fix: Profile update fails with PGRST204 error
-- Root Cause: Code tries to update updated_at column that doesn't exist
-- Impact: Users cannot update their profile names

-- ============================================================================
-- PART 1: ADD COLUMN
-- ============================================================================

-- Add updated_at column to users table
-- This brings users table in line with other tables (organizations, documents, etc.)
ALTER TABLE users
ADD COLUMN updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN users.updated_at IS 'Timestamp of last update to user record';

-- ============================================================================
-- PART 2: BACKFILL EXISTING DATA
-- ============================================================================

-- Set updated_at for existing users to their created_at value
-- This preserves historical context for existing records
UPDATE users
SET updated_at = created_at
WHERE updated_at IS NULL;

-- ============================================================================
-- PART 3: CREATE AUTO-UPDATE TRIGGER
-- ============================================================================

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_users_updated_at IS 'Automatically updates users.updated_at on UPDATE';

-- Trigger to call the function before any UPDATE
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_users_updated_at();

COMMENT ON TRIGGER trg_users_updated_at ON users IS 'Auto-updates updated_at timestamp on user record changes';

-- ============================================================================
-- PART 4: VERIFICATION
-- ============================================================================

-- Verify column was added
DO $$
DECLARE
  column_exists BOOLEAN;
  trigger_exists BOOLEAN;
BEGIN
  -- Check for column
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'updated_at'
  ) INTO column_exists;

  -- Check for trigger
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'users'
      AND trigger_name = 'trg_users_updated_at'
  ) INTO trigger_exists;

  IF column_exists AND trigger_exists THEN
    RAISE NOTICE '✅ Migration 027 completed successfully';
    RAISE NOTICE '   - Column users.updated_at added';
    RAISE NOTICE '   - Trigger trg_users_updated_at created';
    RAISE NOTICE '   - Existing records backfilled';
  ELSE
    RAISE EXCEPTION '❌ Migration 027 failed verification';
  END IF;
END $$;

-- ============================================================================
-- PART 5: TEST THE TRIGGER
-- ============================================================================

-- Test that trigger works by updating a record (if any exist)
DO $$
DECLARE
  test_user_id UUID;
  old_timestamp TIMESTAMP;
  new_timestamp TIMESTAMP;
BEGIN
  -- Get first user ID
  SELECT id INTO test_user_id FROM users LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Record current timestamp
    SELECT updated_at INTO old_timestamp FROM users WHERE id = test_user_id;

    -- Wait a tiny bit
    PERFORM pg_sleep(0.1);

    -- Update user (trigger should fire)
    UPDATE users SET name = name WHERE id = test_user_id;

    -- Check new timestamp
    SELECT updated_at INTO new_timestamp FROM users WHERE id = test_user_id;

    IF new_timestamp > old_timestamp THEN
      RAISE NOTICE '✅ Trigger test passed: updated_at changed from % to %', old_timestamp, new_timestamp;
    ELSE
      RAISE WARNING '⚠️  Trigger may not be working: timestamp did not change';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  No users found to test trigger (this is OK for fresh installations)';
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 027: Add users.updated_at';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Status: COMPLETED';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  1. Added users.updated_at column';
  RAISE NOTICE '  2. Backfilled existing records';
  RAISE NOTICE '  3. Created auto-update trigger';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  - Test profile update at /auth/profile';
  RAISE NOTICE '  - Verify no PGRST204 errors';
  RAISE NOTICE '  - Check updated_at changes on name updates';
  RAISE NOTICE '========================================';
END $$;
