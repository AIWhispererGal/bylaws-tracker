-- Migration 007: Service Role Bypass for user_organizations
-- Fixes infinite recursion during setup by allowing service_role to bypass RLS

-- ============================================================================
-- IMMEDIATE FIX: Add service_role bypass policy
-- ============================================================================
-- This allows the setup wizard (which uses service_role) to insert records
-- without triggering RLS policy evaluation

-- Drop any existing service_role policies first
DROP POLICY IF EXISTS "service_role_bypass" ON user_organizations;
DROP POLICY IF EXISTS "service_role_full_access" ON user_organizations;

-- Create a permissive policy for service_role that bypasses ALL checks
CREATE POLICY "service_role_bypass"
  ON user_organizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify RLS is enabled (it should be)
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to service_role
GRANT ALL ON user_organizations TO service_role;

-- Verification
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_organizations'
ORDER BY policyname;
