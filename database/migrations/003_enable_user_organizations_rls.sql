-- Migration 003: Enable RLS on user_organizations table
-- ============================================================================
--
-- ISSUE: Migration 001 enabled RLS on 10 tables but missed user_organizations
-- IMPACT: Users cannot see organizations after creation (inconsistent RLS context)
-- FIX: Enable RLS and create appropriate policies
--
-- Created: 2025-10-22
-- Detective Agent Case: "The Phantom Organization Mystery"
-- ============================================================================

-- Enable Row Level Security on user_organizations
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can see their own organization memberships
CREATE POLICY "Users see own memberships"
  ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: Organization admins can see all members of their organizations
CREATE POLICY "Admins see org members"
  ON user_organizations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policy 3: Users can update their own membership (e.g., preferences)
CREATE POLICY "Users update own memberships"
  ON user_organizations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 4: Organization owners/admins can insert new members
CREATE POLICY "Admins insert org members"
  ON user_organizations
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policy 5: Organization owners/admins can remove members
CREATE POLICY "Admins delete org members"
  ON user_organizations
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- VERIFICATION QUERIES (run these to test)
-- ============================================================================

-- As authenticated user, verify you can see your own memberships:
-- SELECT * FROM user_organizations WHERE user_id = auth.uid();

-- As organization admin, verify you can see all org members:
-- SELECT * FROM user_organizations WHERE organization_id = '<your-org-id>';

-- Verify organizations are now visible:
-- SELECT * FROM organizations;
