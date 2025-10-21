-- Migration 028: EMERGENCY - Temporarily Disable RLS on Organizations
-- Purpose: Unblock setup wizard by disabling RLS on organizations table
-- THIS IS TEMPORARY - Re-enable after setup works
-- Created: 2025-10-20

-- =============================================================================
-- WARNING: THIS DISABLES RLS FOR SETUP DEBUGGING
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '⚠️  WARNING: Temporarily disabling RLS on organizations table';
  RAISE NOTICE '⚠️  This is for setup debugging only';
  RAISE NOTICE '⚠️  Re-enable RLS after setup works';
END $$;

-- =============================================================================
-- STEP 1: Check Current RLS Status
-- =============================================================================

-- Show current status
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'organizations';

-- Show current policies
SELECT
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'organizations';

-- =============================================================================
-- STEP 2: Disable RLS on Organizations Table
-- =============================================================================

-- Disable RLS completely (temporary)
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: Verify RLS is Disabled
-- =============================================================================

SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '❌ RLS still enabled'
    ELSE '✅ RLS disabled'
  END as status
FROM pg_tables
WHERE tablename = 'organizations';

-- =============================================================================
-- INSTRUCTIONS FOR RE-ENABLING AFTER SETUP WORKS
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS DISABLED on organizations table';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEPS:';
  RAISE NOTICE '1. Try setup wizard now - should work';
  RAISE NOTICE '2. Create your organization';
  RAISE NOTICE '3. Test that it works';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  TO RE-ENABLE RLS AFTER TESTING:';
  RAISE NOTICE '';
  RAISE NOTICE 'ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;';
  RAISE NOTICE '';
  RAISE NOTICE 'CREATE POLICY "Users can view their orgs" ON organizations';
  RAISE NOTICE '  FOR SELECT TO authenticated';
  RAISE NOTICE '  USING (id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));';
  RAISE NOTICE '';
  RAISE NOTICE 'CREATE POLICY "Service role can insert orgs" ON organizations';
  RAISE NOTICE '  FOR INSERT TO authenticated';
  RAISE NOTICE '  WITH CHECK (true);';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
