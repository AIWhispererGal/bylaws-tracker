-- FIX: RLS Infinite Recursion in user_organizations
-- The policy from migration 022 causes infinite recursion because it queries
-- user_organizations while checking permissions ON user_organizations

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can access their organizations" ON user_organizations;

-- Create a fixed policy WITHOUT recursion
-- Instead of querying user_organizations IN the policy for user_organizations,
-- we use a simpler approach

CREATE POLICY "Users can access their organizations" ON user_organizations
  FOR SELECT
  USING (
    -- Users can see their own organization memberships
    auth.uid() = user_id
  );

-- Separate policy for global admins
-- Global admins need special handling to avoid recursion
CREATE POLICY "Global admins can access all organizations" ON user_organizations
  FOR ALL
  USING (
    -- Check if user is global admin by direct column check
    -- This avoids recursion by not querying user_organizations again
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_global_admin = true
    )
  );

-- Update users table to have is_global_admin column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='is_global_admin') THEN
    ALTER TABLE users ADD COLUMN is_global_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Migrate existing global admin flags from user_organizations to users
UPDATE users
SET is_global_admin = true
WHERE id IN (
  SELECT DISTINCT user_id
  FROM user_organizations
  WHERE is_global_admin = true
);

-- Add comment
COMMENT ON COLUMN users.is_global_admin IS
  'Global admin flag at user level to avoid RLS recursion. Synced from user_organizations.';
