-- Migration 014: User Invitations System
-- Creates table for managing user invitations to organizations
-- Supports email-based invitations with expiration and token-based acceptance

-- Create user_invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_organization ON user_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_invitations_org_status ON user_invitations(organization_id, status);

-- Enable Row Level Security
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view invitations sent to their email
CREATE POLICY "Users can view their own invitations"
  ON user_invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR invited_by = auth.uid()
  );

-- Policy: Org admins can create invitations for their organizations
CREATE POLICY "Org admins can create invitations"
  ON user_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy: Org admins can update invitations (revoke, etc.)
CREATE POLICY "Org admins can update invitations"
  ON user_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Policy: Org admins can delete invitations
CREATE POLICY "Org admins can delete invitations"
  ON user_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND organization_id = user_invitations.organization_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on record changes
DROP TRIGGER IF EXISTS user_invitations_updated_at ON user_invitations;
CREATE TRIGGER user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_invitations_updated_at();

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE user_invitations
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_invitations TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add helpful comment
COMMENT ON TABLE user_invitations IS 'Stores user invitations to organizations with email-based token authentication';
COMMENT ON COLUMN user_invitations.token IS 'Secure random token for invitation acceptance link';
COMMENT ON COLUMN user_invitations.expires_at IS 'Invitation expiration timestamp (default 7 days)';
COMMENT ON COLUMN user_invitations.status IS 'Invitation status: pending, accepted, expired, or revoked';
