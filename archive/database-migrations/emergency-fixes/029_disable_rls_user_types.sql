-- Migration 029: Disable RLS on user_types table
-- Purpose: Allow setup wizard to query user_types
-- Issue: RLS blocking access even though data exists
-- Created: 2025-10-20

-- Check current RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_types';

-- Disable RLS on user_types (it's system data, doesn't need RLS)
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_types';

-- Show success
DO $$
BEGIN
  RAISE NOTICE '✅ RLS disabled on user_types table';
  RAISE NOTICE '✅ Setup wizard can now query user types';
END $$;
