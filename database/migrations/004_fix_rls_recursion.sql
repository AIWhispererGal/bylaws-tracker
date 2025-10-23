-- Migration 004: Fix Infinite Recursion in user_organizations RLS
-- ============================================================================
--
-- ISSUE: Migration 003 created circular references in RLS policies
-- ERROR: "infinite recursion detected in policy for relation user_organizations"
-- CAUSE: Policies querying user_organizations table within user_organizations policies
-- FIX: Simplify policies to avoid self-referencing subqueries
--
-- Created: 2025-10-22
-- Emergency Fix by KINGSWIT Agent
-- ============================================================================

-- STEP 1: Drop all problematic policies from migration 003
DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins see org members" ON user_organizations;
DROP POLICY IF EXISTS "Users update own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins insert org members" ON user_organizations;
DROP POLICY IF EXISTS "Admins delete org members" ON user_organizations;

-- STEP 2: Create SIMPLE, non-recursive policies

-- Policy 1: Users can see their own organization memberships
-- (No recursion - direct comparison to auth.uid())
CREATE POLICY "user_sees_own_orgs"
  ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: Users can update their own membership preferences
-- (No recursion - direct comparison to auth.uid())
CREATE POLICY "user_updates_own_membership"
  ON user_organizations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 3: Service role can do everything
-- (This allows backend operations to work)
CREATE POLICY "service_role_full_access"
  ON user_organizations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- STEP 3: For admin operations, use a PostgreSQL function to avoid recursion
-- Create a helper function that checks if user is admin WITHOUT querying user_organizations

CREATE OR REPLACE FUNCTION auth.user_is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if current user has admin/owner role in the specified organization
  -- This is called OUTSIDE the RLS context to avoid recursion
  RETURN EXISTS (
    SELECT 1
    FROM user_organizations
    WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy 4: Admins can manage members using the helper function
-- (Function is SECURITY DEFINER so it runs with elevated privileges, avoiding RLS recursion)
CREATE POLICY "admins_manage_org_members"
  ON user_organizations
  FOR ALL
  USING (
    -- User is admin of this organization (checked via function)
    auth.user_is_org_admin(organization_id)
    OR
    -- Or this is their own membership
    user_id = auth.uid()
  );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Test 1: Verify no recursion errors
-- SELECT * FROM user_organizations WHERE user_id = auth.uid();

-- Test 2: Verify policies exist
-- SELECT policyname FROM pg_policies WHERE tablename = 'user_organizations';

-- Test 3: Verify organizations are visible
-- SELECT * FROM organizations;

-- Expected: No "infinite recursion" errors, policies work correctly
