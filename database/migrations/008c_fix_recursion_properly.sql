-- Migration 008c: Properly Fix RLS Recursion with SECURITY DEFINER
-- ============================================================================
--
-- ISSUE: Migration 008b STILL had recursion because policies queried
--        user_organizations from within user_organizations policies!
--
-- ROOT CAUSE: This subquery causes recursion:
--   SELECT uo.organization_id FROM user_organizations uo WHERE uo.user_id = auth.uid()
--
-- FIX: Create SECURITY DEFINER function to check org admin status
--      WITHOUT triggering RLS (bypasses the recursion)
--
-- Created: 2025-10-23
-- ============================================================================

BEGIN;

-- ============================================================================
-- HELPER FUNCTION: Check if user is org admin WITHOUT triggering RLS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_org_admin_for_org(
  p_user_id UUID,
  p_org_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER  -- 👈 This bypasses RLS and prevents recursion!
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_organizations uo
    JOIN organization_roles orel ON uo.org_role_id = orel.id
    WHERE uo.user_id = p_user_id
      AND uo.organization_id = p_org_id
      AND uo.is_active = true
      AND orel.hierarchy_level <= 3  -- Owner (1), Admin (2,3)
  );
$$;

GRANT EXECUTE ON FUNCTION is_org_admin_for_org(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_admin_for_org(UUID, UUID) TO service_role;

COMMENT ON FUNCTION is_org_admin_for_org IS
'Check if user is admin/owner in specific organization. Uses SECURITY DEFINER to bypass RLS and prevent recursion.';

-- ============================================================================
-- DROP OLD POLICIES (from migration 008b)
-- ============================================================================

DROP POLICY IF EXISTS "users_see_own_memberships_v2" ON user_organizations;
DROP POLICY IF EXISTS "admins_see_org_members_v2" ON user_organizations;
DROP POLICY IF EXISTS "users_update_own_memberships_v2" ON user_organizations;
DROP POLICY IF EXISTS "admins_insert_org_members_v2" ON user_organizations;
DROP POLICY IF EXISTS "admins_update_org_members_v2" ON user_organizations;
DROP POLICY IF EXISTS "admins_delete_org_members_v2" ON user_organizations;
DROP POLICY IF EXISTS "service_role_full_access_v2" ON user_organizations;

-- ============================================================================
-- NEW POLICY 1: SELECT - See own memberships + global admin + org admin
-- ============================================================================

CREATE POLICY "users_see_memberships_v3"
  ON user_organizations
  FOR SELECT
  USING (
    -- User sees their own records
    user_id = auth.uid()
    OR
    -- Global admin sees everything
    is_global_admin(auth.uid())
    OR
    -- Org admin sees members in their org (NO RECURSION - uses SECURITY DEFINER function)
    is_org_admin_for_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- NEW POLICY 2: UPDATE - Users update own, admins update in their org
-- ============================================================================

CREATE POLICY "users_update_memberships_v3"
  ON user_organizations
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR is_global_admin(auth.uid())
    OR is_org_admin_for_org(auth.uid(), organization_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_global_admin(auth.uid())
    OR is_org_admin_for_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- NEW POLICY 3: INSERT - Admins can add members
-- ============================================================================

CREATE POLICY "admins_insert_members_v3"
  ON user_organizations
  FOR INSERT
  WITH CHECK (
    is_global_admin(auth.uid())
    OR is_org_admin_for_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- NEW POLICY 4: DELETE - Admins can remove members
-- ============================================================================

CREATE POLICY "admins_delete_members_v3"
  ON user_organizations
  FOR DELETE
  USING (
    is_global_admin(auth.uid())
    OR is_org_admin_for_org(auth.uid(), organization_id)
  );

-- ============================================================================
-- NEW POLICY 5: Service role full access
-- ============================================================================

CREATE POLICY "service_role_access_v3"
  ON user_organizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;

-- ============================================================================
-- VERIFICATION: Test for recursion (SHOULD WORK NOW!)
-- ============================================================================

-- Test 1: This should NOT cause infinite recursion
-- SELECT * FROM user_organizations WHERE user_id = auth.uid();

-- Test 2: Count all (as global admin)
-- SELECT COUNT(*) FROM user_organizations;

-- Test 3: Check policies exist
-- SELECT policyname FROM pg_policies WHERE tablename = 'user_organizations' ORDER BY policyname;
-- Expected: 5 policies ending in _v3

-- Test 4: Check function exists
-- SELECT routine_name, security_type FROM information_schema.routines
-- WHERE routine_name = 'is_org_admin_for_org';
-- Expected: 1 row with security_type = 'DEFINER'

-- ============================================================================
-- END OF MIGRATION 008c
-- ============================================================================
