-- Migration 015: Fix Global Admin Access to User Invitations
-- Adds is_global_admin() bypass to all RLS policies on user_invitations table
-- This allows global admins to manage invitations across all organizations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own invitations" ON user_invitations;
DROP POLICY IF EXISTS "Org admins can create invitations" ON user_invitations;
DROP POLICY IF EXISTS "Org admins can update invitations" ON user_invitations;
DROP POLICY IF EXISTS "Org admins can delete invitations" ON user_invitations;

-- Policy 1: SELECT - Users can view invitations OR global admins can view all
CREATE POLICY "users_view_invitations_or_global_admin"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    is_global_admin(auth.uid())
    OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    invited_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy 2: INSERT - Org admins can create OR global admins can create for any org
CREATE POLICY "admins_create_invitations_or_global_admin"
  ON user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_global_admin(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy 3: UPDATE - Org admins can update OR global admins can update any invitation
CREATE POLICY "admins_update_invitations_or_global_admin"
  ON user_invitations
  FOR UPDATE
  TO authenticated
  USING (
    is_global_admin(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy 4: DELETE - Org admins can delete OR global admins can delete any invitation
CREATE POLICY "admins_delete_invitations_or_global_admin"
  ON user_invitations
  FOR DELETE
  TO authenticated
  USING (
    is_global_admin(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Verification function
CREATE OR REPLACE FUNCTION verify_invitation_global_admin_policies()
RETURNS TABLE(
  policy_name TEXT,
  has_global_admin_check BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.policyname::TEXT,
    p.qual::TEXT LIKE '%is_global_admin%' AS has_global_admin_check
  FROM pg_policies p
  WHERE p.tablename = 'user_invitations'
  ORDER BY p.policyname;
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_invitation_global_admin_policies();

COMMENT ON POLICY "users_view_invitations_or_global_admin" ON user_invitations IS 'Allows users to view their invitations, invited users, and org admins. Global admins can view all.';
COMMENT ON POLICY "admins_create_invitations_or_global_admin" ON user_invitations IS 'Allows org admins to create invitations. Global admins can create for any org.';
COMMENT ON POLICY "admins_update_invitations_or_global_admin" ON user_invitations IS 'Allows org admins to update invitations. Global admins can update any invitation.';
COMMENT ON POLICY "admins_delete_invitations_or_global_admin" ON user_invitations IS 'Allows org admins to delete invitations. Global admins can delete any invitation.';
