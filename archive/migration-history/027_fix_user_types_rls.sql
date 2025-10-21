-- Migration 027: Fix User Types RLS for Service Role Access
-- Purpose: Allow service role to query user_types during setup wizard
-- Issue: RLS policy "Anyone can read user types" was blocking service role
-- Root Cause: USING (true) requires authentication, but service role has no auth context
-- Created: 2025-10-20

-- =============================================================================
-- PART 1: Drop Existing Restrictive Policy
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can read user types" ON user_types;

-- =============================================================================
-- PART 2: Create Role-Specific RLS Policies
-- =============================================================================

-- Allow service_role to SELECT (bypasses auth requirement)
CREATE POLICY "service_role_select_user_types"
  ON user_types FOR SELECT
  TO service_role
  USING (true);

-- Allow authenticated users to SELECT
CREATE POLICY "authenticated_select_user_types"
  ON user_types FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to SELECT (for public lookups)
CREATE POLICY "anon_select_user_types"
  ON user_types FOR SELECT
  TO anon
  USING (true);

-- =============================================================================
-- PART 3: Verification
-- =============================================================================

-- Test that policies exist
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'user_types'
    AND policyname LIKE '%select_user_types';

  IF policy_count < 3 THEN
    RAISE EXCEPTION 'Expected 3 SELECT policies on user_types, found %', policy_count;
  END IF;

  RAISE NOTICE '✅ User types RLS policies verified: % SELECT policies', policy_count;
END $$;

-- Display current policies
SELECT
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_types'
ORDER BY policyname;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- This fix allows:
-- 1. Service role (setup wizard) to query user_types without auth context
-- 2. Authenticated users to query user_types normally
-- 3. Anonymous users to query user_types for public lookups
-- 4. Global admins to still manage user_types (existing policy unchanged)
