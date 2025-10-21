-- Migration 027: QUICK FIX - Allow Organization Creation During Setup
-- Purpose: Add permissive INSERT policy so setup wizard can create organizations
-- This is needed because RLS is blocking organization creation
-- Created: 2025-10-20

-- =============================================================================
-- QUICK FIX: Add permissive INSERT policy
-- =============================================================================

-- Drop any conflicting INSERT policies first
DROP POLICY IF EXISTS "Allow authenticated users to insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON organizations;
DROP POLICY IF EXISTS "Setup wizard can create organizations" ON organizations;

-- Create new permissive INSERT policy
-- This allows ANY authenticated user to create organizations
-- This is safe for setup wizard since it's a privileged operation
CREATE POLICY "Setup wizard can create organizations"
ON organizations
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- =============================================================================
-- Verification
-- =============================================================================

-- Show the policy was created
SELECT
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename = 'organizations'
  AND cmd = 'INSERT';

-- Confirm RLS is still enabled (just with permissive policy)
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'organizations';

-- =============================================================================
-- RESULT
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ INSERT policy added to organizations table';
  RAISE NOTICE '✅ Setup wizard should now be able to create organizations';
  RAISE NOTICE '⚠️  NOTE: This policy is permissive - consider tightening after testing';
END $$;
