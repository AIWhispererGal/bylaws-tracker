-- FIX: RLS Infinite Recursion in user_organizations
-- Step-by-step fix to avoid errors

-- Step 1: Drop the problematic policies first
DROP POLICY IF EXISTS "Users can access their organizations" ON user_organizations;
DROP POLICY IF EXISTS "Global admins can access all organizations" ON user_organizations;

-- Step 2: Add is_global_admin column to users table FIRST
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN DEFAULT FALSE;

-- Step 3: Migrate existing global admin flags from user_organizations to users
UPDATE users
SET is_global_admin = true
WHERE id IN (
  SELECT DISTINCT user_id
  FROM user_organizations
  WHERE is_global_admin = true
);

-- Step 4: Create simple policy for regular users (no recursion)
CREATE POLICY "Users can access their organizations" ON user_organizations
  FOR SELECT
  USING (
    -- Users can see their own organization memberships
    auth.uid() = user_id
  );

-- Step 5: Create separate policy for global admins (no recursion)
CREATE POLICY "Global admins can access all organizations" ON user_organizations
  FOR ALL
  USING (
    -- Check users table directly - no recursion!
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_global_admin = true
    )
  );

-- Step 6: Add comment
COMMENT ON COLUMN users.is_global_admin IS
  'Global admin flag at user level to avoid RLS recursion. Synced from user_organizations.';

-- Verification query (optional - run to verify it worked)
-- SELECT COUNT(*) FROM users WHERE is_global_admin = true;
