-- Migration 008b: Fix RLS Infinite Recursion in user_organizations
-- ============================================================================
--
-- ISSUE: "infinite recursion detected in policy for relation user_organizations"
-- ROOT CAUSE: user_organizations policies reference themselves causing recursion
-- FIX: Simplify policies to remove self-referencing WHERE clauses
--
-- Created: 2025-10-23
-- Depends on: Migration 008 (is_global_admin function)
-- ============================================================================

BEGIN;

-- ============================================================================
-- DIAGNOSTIC: Check current policies before fix
-- ============================================================================
-- Run this separately to see the problem:
-- SELECT policyname, qual FROM pg_policies WHERE tablename = 'user_organizations';

-- ============================================================================
-- FIX: Drop ALL existing policies on user_organizations
-- ============================================================================

DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins see org members" ON user_organizations;
DROP POLICY IF EXISTS "users_see_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "admins_see_org_members" ON user_organizations;
DROP POLICY IF EXISTS "users_update_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "admins_insert_org_members" ON user_organizations;
DROP POLICY IF EXISTS "admins_update_org_members" ON user_organizations;
DROP POLICY IF EXISTS "admins_delete_org_members" ON user_organizations;
DROP POLICY IF EXISTS "service_role_full_access" ON user_organizations;

-- ============================================================================
-- NEW POLICY 1: Users see their own memberships + Global admins see all
-- ============================================================================

CREATE POLICY "users_see_own_memberships_v2"
  ON user_organizations
  FOR SELECT
  USING (
    -- User sees their own records
    user_id = auth.uid()
    OR
    -- Global admin sees everything
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "users_see_own_memberships_v2" ON user_organizations IS
'Users can see their own organization memberships. Global admins can see all memberships.';

-- ============================================================================
-- NEW POLICY 2: Org admins see members in their orgs (NO SELF-REFERENCE)
-- ============================================================================

CREATE POLICY "admins_see_org_members_v2"
  ON user_organizations
  FOR SELECT
  USING (
    -- If user is global admin, see everything
    is_global_admin(auth.uid())
    OR
    -- If user is org admin/owner, see members in that org
    -- IMPORTANT: We check organization_roles.hierarchy_level DIRECTLY
    -- WITHOUT querying user_organizations again (avoids recursion)
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
        AND uo.is_active = true
        AND orel.hierarchy_level <= 3  -- Owner (1), Admin (2,3)
    )
  );

COMMENT ON POLICY "admins_see_org_members_v2" ON user_organizations IS
'Organization admins and owners can see all members in their organizations. Global admins see all.';

-- ============================================================================
-- NEW POLICY 3: Users can update their own membership preferences
-- ============================================================================

CREATE POLICY "users_update_own_memberships_v2"
  ON user_organizations
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_global_admin(auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- NEW POLICY 4: Admins can insert members
-- ============================================================================

CREATE POLICY "admins_insert_org_members_v2"
  ON user_organizations
  FOR INSERT
  WITH CHECK (
    is_global_admin(auth.uid())
    OR
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
        AND uo.is_active = true
        AND orel.hierarchy_level <= 3
    )
  );

-- ============================================================================
-- NEW POLICY 5: Admins can update members
-- ============================================================================

CREATE POLICY "admins_update_org_members_v2"
  ON user_organizations
  FOR UPDATE
  USING (
    is_global_admin(auth.uid())
    OR
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
        AND uo.is_active = true
        AND orel.hierarchy_level <= 3
    )
  );

-- ============================================================================
-- NEW POLICY 6: Admins can delete members
-- ============================================================================

CREATE POLICY "admins_delete_org_members_v2"
  ON user_organizations
  FOR DELETE
  USING (
    is_global_admin(auth.uid())
    OR
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
        AND uo.is_active = true
        AND orel.hierarchy_level <= 3
    )
  );

-- ============================================================================
-- NEW POLICY 7: Service role has full access
-- ============================================================================

CREATE POLICY "service_role_full_access_v2"
  ON user_organizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

-- ============================================================================
-- VERIFICATION: Test for recursion
-- ============================================================================

-- After running this migration, test with:
-- SELECT * FROM user_organizations WHERE user_id = auth.uid();
-- This should NOT cause infinite recursion anymore!

-- Also test:
-- SELECT COUNT(*) FROM user_organizations;
-- (as a global admin - should return all records)

-- ============================================================================
-- END OF MIGRATION 008b
-- ============================================================================
