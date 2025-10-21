-- Migration 027: Fix RLS Policies for Setup Wizard
-- Purpose: Allow organization creation during setup wizard
-- Issue: Setup wizard blocked by RLS when creating organizations
-- Created: 2025-10-20

-- =============================================================================
-- PROBLEM ANALYSIS
-- =============================================================================
-- The setup wizard needs to create organizations but RLS policies are blocking it.
-- The setup wizard uses service role client which should bypass RLS, but
-- we need to ensure the policies allow creation when authenticated.

-- =============================================================================
-- PART 1: Check Current RLS Status
-- =============================================================================

-- Show current RLS status for organizations table
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'organizations';

-- List all policies on organizations table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'organizations';

-- =============================================================================
-- PART 2: Fix Organizations Table RLS Policies
-- =============================================================================

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Allow organization creation" ON organizations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON organizations;

-- Create new INSERT policy that allows authenticated users to create organizations
CREATE POLICY "Allow authenticated users to insert organizations"
ON organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =============================================================================
-- PART 3: Ensure Service Role Bypass
-- =============================================================================

-- Service role should bypass RLS automatically, but let's verify
-- Note: This is just informational, service_role already bypasses RLS

DO $$
BEGIN
  RAISE NOTICE 'Service role client bypasses RLS automatically';
  RAISE NOTICE 'Authenticated users can now INSERT into organizations';
  RAISE NOTICE 'SELECT/UPDATE/DELETE still governed by other policies';
END $$;

-- =============================================================================
-- PART 4: Verify Other Required Policies Exist
-- =============================================================================

-- Ensure SELECT policy exists for users to see their organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations'
    AND cmd = 'SELECT'
  ) THEN
    -- Create SELECT policy
    EXECUTE 'CREATE POLICY "Users can view their organizations"
    ON organizations
    FOR SELECT
    TO authenticated
    USING (
      id IN (
        SELECT organization_id
        FROM user_organizations
        WHERE user_id = auth.uid()
      )
    )';
    RAISE NOTICE 'Created SELECT policy for organizations';
  ELSE
    RAISE NOTICE 'SELECT policy already exists for organizations';
  END IF;
END $$;

-- =============================================================================
-- PART 5: Show Final Policy Configuration
-- =============================================================================

-- Display all policies on organizations table
SELECT
  policyname,
  cmd as operation,
  CASE
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No conditions'
  END as policy_conditions
FROM pg_policies
WHERE tablename = 'organizations'
ORDER BY cmd, policyname;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

RAISE NOTICE '✅ Organizations table RLS policies updated';
RAISE NOTICE '✅ Setup wizard should now be able to create organizations';
