-- Migration 008: Fix Global Admin RLS Policies
-- ============================================================================
--
-- ISSUE: Global admins cannot see organizations despite can_access_all_organizations permission
-- ROOT CAUSE: RLS policies only check user_organizations membership, not user_types permissions
-- FIX: Add global admin checks to all organization-related RLS policies
--
-- Created: 2025-10-23
-- Detective Case: "The Invisible Admin Mystery"
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Check if user is global admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN user_types ut ON u.user_type_id = ut.id
    WHERE u.id = p_user_id
    AND (ut.global_permissions->>'can_access_all_organizations')::boolean = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_global_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_global_admin(UUID) TO service_role;

COMMENT ON FUNCTION is_global_admin IS 'Check if user has global admin permissions (can_access_all_organizations)';

-- ============================================================================
-- FIX: Organizations Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see own organizations" ON organizations;

CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    -- Regular users: see orgs they're members of
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR
    -- Global admins: see ALL organizations
    is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: user_organizations Table RLS Policies
-- ============================================================================

DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins see org members" ON user_organizations;

-- Policy 1: Users see their own memberships OR global admins see all
CREATE POLICY "Users see own memberships"
  ON user_organizations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_global_admin(auth.uid())
  );

-- Policy 2: Org admins see org members (using new role architecture)
CREATE POLICY "Admins see org members"
  ON user_organizations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      JOIN organization_roles orel ON uo.org_role_id = orel.id
      WHERE uo.user_id = auth.uid()
      AND uo.is_active = true
      AND orel.hierarchy_level <= 3  -- Admin level or higher
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: Documents Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see own organization documents" ON documents;

CREATE POLICY "Users see own organization documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND is_active = true
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: Document Sections Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see sections in accessible documents" ON document_sections;

CREATE POLICY "Users see sections in accessible documents"
  ON document_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
      AND uo.user_id = auth.uid()
      AND uo.is_active = true
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- FIX: Suggestions Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see suggestions in accessible documents" ON suggestions;

CREATE POLICY "Users see suggestions in accessible documents"
  ON suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = suggestions.document_id
      AND uo.user_id = auth.uid()
      AND uo.is_active = true
    )
    OR is_global_admin(auth.uid())
  );

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test the fix)
-- ============================================================================

-- To test, run these as different user types:

-- 1. Verify global admin can see all organizations:
--    SET LOCAL jwt.claims.sub TO '<global_admin_user_id>';
--    SELECT COUNT(*) FROM organizations; -- Should return total org count

-- 2. Verify regular user sees limited organizations:
--    SET LOCAL jwt.claims.sub TO '<regular_user_id>';
--    SELECT COUNT(*) FROM organizations; -- Should return only user's orgs

-- 3. Verify is_global_admin function works:
--    SELECT is_global_admin(auth.uid()); -- Should return true for global admin

-- ============================================================================
-- END OF MIGRATION 008
-- ============================================================================
