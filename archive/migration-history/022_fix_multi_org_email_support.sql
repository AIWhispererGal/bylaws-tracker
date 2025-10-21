-- FIX-3: Multi-Organization Email Support
-- Allow the same email to be registered in multiple organizations
-- The user_organizations table already supports many-to-many relationships

-- 1. Remove UNIQUE constraint on email in users table (if exists)
-- This allows the same email to be used across multiple Supabase auth users
-- Note: Supabase Auth handles user uniqueness by auth.uid, not email
-- We just need to ensure our application logic supports it

-- 2. Ensure user_organizations table properly supports many-to-many
-- This should already be in place from previous migrations
-- Verify the structure:
-- - user_id (references auth.users.id)
-- - organization_id (references organizations.id)
-- - UNIQUE(user_id, organization_id) <- prevents duplicate membership
-- - No UNIQUE constraint on just user_id or just organization_id

-- 3. Update RLS policies to support multi-org access
-- Users should see data from ALL organizations they belong to

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can access their organizations" ON user_organizations;

-- Create updated policy
CREATE POLICY "Users can access their organizations" ON user_organizations
  FOR SELECT
  USING (
    -- User can see their own organization memberships
    auth.uid() = user_id
    OR
    -- Global admins can see all organization memberships
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.is_global_admin = true
      AND uo.is_active = true
    )
  );

-- 4. Add helper function to get all organizations for a user
CREATE OR REPLACE FUNCTION get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  user_role TEXT,
  is_global_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uo.organization_id,
    o.name AS organization_name,
    uo.role AS user_role,
    uo.is_global_admin
  FROM user_organizations uo
  JOIN organizations o ON o.id = uo.organization_id
  WHERE uo.user_id = p_user_id
  AND uo.is_active = true
  ORDER BY o.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_organizations(UUID) TO authenticated;

-- 5. Add comment explaining multi-org support
COMMENT ON TABLE user_organizations IS
  'Junction table supporting many-to-many relationship between users and organizations.
   A user can belong to multiple organizations with different roles in each.
   The same email can be registered across multiple organizations.';

-- 6. Verify indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_active ON user_organizations(user_id, is_active);
