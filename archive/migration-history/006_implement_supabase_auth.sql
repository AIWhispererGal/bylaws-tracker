-- ============================================================================
-- MIGRATION 006: Implement Supabase Authentication Integration
-- Date: 2025-10-12
-- Version: 2.2.0
-- Purpose: Enhance multi-tenant system with Supabase Auth integration
--
-- FEATURES:
-- - Integrate with auth.users for authentication
-- - Add user roles and invitation system
-- - Create user profiles linked to auth
-- - Add superuser initialization
-- - Maintain existing RLS patterns
-- - Support user management features
--
-- PREREQUISITES:
-- - Migration 005 must be applied (RLS policies in place)
-- - Supabase Auth must be enabled
-- - SUPABASE_SERVICE_ROLE_KEY must be configured
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE USER PROFILES TABLE
-- ============================================================================
-- Links to Supabase auth.users and stores display information
-- This separates auth concerns from profile data

CREATE TABLE IF NOT EXISTS user_profiles (
  -- Primary key matches auth.users.id (UUID)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Display information
  display_name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  avatar_url TEXT,

  -- Additional profile fields
  phone VARCHAR(50),
  bio TEXT,
  timezone VARCHAR(100) DEFAULT 'UTC',

  -- Preferences
  preferences JSONB DEFAULT '{
    "email_notifications": true,
    "theme": "light",
    "language": "en"
  }'::jsonb,

  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Soft delete (for audit trail)
  deleted_at TIMESTAMP
);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_profiles_deleted ON user_profiles(deleted_at) WHERE deleted_at IS NULL;

COMMENT ON TABLE user_profiles IS 'User profile information linked to Supabase auth.users. Stores display info and preferences.';
COMMENT ON COLUMN user_profiles.id IS 'References auth.users(id) - primary authentication identity';

-- ============================================================================
-- STEP 2: ENHANCE USER_ORGANIZATIONS TABLE
-- ============================================================================
-- Add role hierarchy, invitation tracking, and user limits

-- Add new columns to user_organizations
DO $$
BEGIN
  -- Add role column if it doesn't exist (migration-safe)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
    AND column_name = 'role'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'member';
  END IF;

  -- Add invited_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
    AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN invited_by UUID REFERENCES user_profiles(id);
  END IF;

  -- Add invited_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
    AND column_name = 'invited_at'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN invited_at TIMESTAMP;
  END IF;

  -- Add is_active column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Add invitation_token column (for email invitations)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
    AND column_name = 'invitation_token'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN invitation_token VARCHAR(255) UNIQUE;
  END IF;

  -- Add invitation_accepted_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations'
    AND column_name = 'invitation_accepted_at'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN invitation_accepted_at TIMESTAMP;
  END IF;
END $$;

-- Add check constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_user_role'
  ) THEN
    ALTER TABLE user_organizations
    ADD CONSTRAINT valid_user_role
    CHECK (role IN ('superuser', 'org_admin', 'admin', 'member', 'viewer'));
  END IF;
END $$;

-- Update existing rows to have proper role if they're NULL or invalid
UPDATE user_organizations
SET role = 'member'
WHERE role IS NULL OR role NOT IN ('superuser', 'org_admin', 'admin', 'member', 'viewer');

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_orgs_invited_by ON user_organizations(invited_by);
CREATE INDEX IF NOT EXISTS idx_user_orgs_active ON user_organizations(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_orgs_invitation_token ON user_organizations(invitation_token) WHERE invitation_token IS NOT NULL;

COMMENT ON COLUMN user_organizations.role IS 'User role: superuser (global admin), org_admin (org owner), admin (org manager), member (standard user), viewer (read-only)';
COMMENT ON COLUMN user_organizations.invited_by IS 'User who sent the invitation';
COMMENT ON COLUMN user_organizations.is_active IS 'Whether membership is active (can be deactivated without deletion)';
COMMENT ON COLUMN user_organizations.invitation_token IS 'Token for email-based invitations (before user signs up)';

-- ============================================================================
-- STEP 3: MIGRATE EXISTING USERS TABLE TO USER_PROFILES
-- ============================================================================
-- Safely migrate data from old users table to new user_profiles

DO $$
DECLARE
  users_table_exists BOOLEAN;
BEGIN
  -- Check if old users table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'users'
    AND table_schema = 'public'
  ) INTO users_table_exists;

  IF users_table_exists THEN
    RAISE NOTICE 'Migrating data from users table to user_profiles...';

    -- For existing users without auth.users entry, we'll need to handle them separately
    -- This migration assumes Supabase Auth will be set up and users will be created there

    -- Create a temporary mapping table for migration
    CREATE TEMP TABLE IF NOT EXISTS user_migration_map (
      old_user_id UUID,
      new_user_id UUID,
      email VARCHAR(255),
      migrated BOOLEAN DEFAULT false
    );

    -- Insert mapping for users that need migration
    INSERT INTO user_migration_map (old_user_id, email)
    SELECT id, email
    FROM users
    WHERE email IS NOT NULL
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Users table found with % records to migrate', (SELECT COUNT(*) FROM users);
    RAISE NOTICE '⚠️  MANUAL STEP REQUIRED: Create auth.users entries for existing users';
    RAISE NOTICE '   Then update user_migration_map with new_user_id values';
    RAISE NOTICE '   Finally, update user_organizations.user_id references';
  ELSE
    RAISE NOTICE 'No existing users table found. Starting fresh with user_profiles.';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: CREATE ORGANIZATION USER LIMIT CONSTRAINT
-- ============================================================================
-- Enforce maximum users per organization (configurable by plan)

-- Function to check user limit for organization
CREATE OR REPLACE FUNCTION check_org_user_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_user_count INTEGER;
  max_users INTEGER;
  user_role TEXT;
BEGIN
  -- Get the role of the user being added/updated
  SELECT role INTO user_role FROM user_organizations WHERE id = NEW.id;

  -- Superusers bypass all limits
  IF user_role = 'superuser' THEN
    RETURN NEW;
  END IF;

  -- Count active users in organization
  SELECT COUNT(*) INTO current_user_count
  FROM user_organizations
  WHERE organization_id = NEW.organization_id
    AND is_active = true
    AND id != NEW.id; -- Don't count the current record

  -- Get max_users from organization
  SELECT COALESCE(max_users, 10) INTO max_users
  FROM organizations
  WHERE id = NEW.organization_id;

  -- Check if limit exceeded
  IF NEW.is_active = true AND current_user_count >= max_users THEN
    RAISE EXCEPTION 'Organization has reached maximum user limit of %', max_users
      USING HINT = 'Upgrade plan or deactivate existing users';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user limit enforcement
DROP TRIGGER IF EXISTS trg_check_org_user_limit ON user_organizations;
CREATE TRIGGER trg_check_org_user_limit
  BEFORE INSERT OR UPDATE OF is_active
  ON user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION check_org_user_limit();

COMMENT ON FUNCTION check_org_user_limit IS 'Enforces organization user limits based on plan. Superusers bypass limits.';

-- ============================================================================
-- STEP 5: CREATE SUPERUSER INITIALIZATION FUNCTION
-- ============================================================================
-- Function to create the first superuser and link to organization

CREATE OR REPLACE FUNCTION initialize_superuser(
  p_auth_user_id UUID,
  p_email VARCHAR(255),
  p_display_name VARCHAR(255),
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_profile_id UUID;
  v_org_id UUID;
  v_membership_id UUID;
  v_result JSONB;
BEGIN
  -- Create user profile
  INSERT INTO user_profiles (id, email, display_name, is_active)
  VALUES (p_auth_user_id, p_email, p_display_name, true)
  ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      updated_at = NOW()
  RETURNING id INTO v_profile_id;

  -- If no organization specified, create a default one
  IF p_organization_id IS NULL THEN
    INSERT INTO organizations (
      name,
      slug,
      organization_type,
      plan_type,
      max_users,
      max_documents
    )
    VALUES (
      p_display_name || '''s Organization',
      lower(regexp_replace(p_display_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-org',
      'general',
      'free',
      50,
      10
    )
    RETURNING id INTO v_org_id;
  ELSE
    v_org_id := p_organization_id;
  END IF;

  -- Create superuser membership
  INSERT INTO user_organizations (
    user_id,
    organization_id,
    role,
    is_active,
    permissions
  )
  VALUES (
    v_profile_id,
    v_org_id,
    'superuser',
    true,
    '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["all"],
      "can_manage_users": true,
      "can_manage_workflows": true,
      "is_superuser": true
    }'::jsonb
  )
  ON CONFLICT (user_id, organization_id) DO UPDATE
  SET role = 'superuser',
      is_active = true,
      updated_at = NOW()
  RETURNING id INTO v_membership_id;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'organization_id', v_org_id,
    'membership_id', v_membership_id,
    'message', 'Superuser initialized successfully'
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to initialize superuser'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initialize_superuser IS 'Creates first superuser with profile and organization membership. Safe to call multiple times.';

-- ============================================================================
-- STEP 6: UPDATE RLS POLICIES FOR USER_PROFILES
-- ============================================================================
-- Enable RLS and create policies for user profile access

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can see all user profiles (for mentions, collaboration)
CREATE POLICY "users_see_all_profiles"
  ON user_profiles
  FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "users_update_own_profile"
  ON user_profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- New users can create their profile during signup
CREATE POLICY "users_create_own_profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Service role can manage all profiles
CREATE POLICY "service_role_manage_profiles"
  ON user_profiles
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Superusers can manage all profiles
CREATE POLICY "superusers_manage_profiles"
  ON user_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND role = 'superuser'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
      AND role = 'superuser'
      AND is_active = true
    )
  );

-- ============================================================================
-- STEP 7: CREATE USER MANAGEMENT HELPER FUNCTIONS
-- ============================================================================

-- Function to invite user to organization
CREATE OR REPLACE FUNCTION invite_user_to_organization(
  p_inviter_id UUID,
  p_email VARCHAR(255),
  p_organization_id UUID,
  p_role VARCHAR(50) DEFAULT 'member'
)
RETURNS JSONB AS $$
DECLARE
  v_inviter_role TEXT;
  v_can_invite BOOLEAN;
  v_invitation_token TEXT;
  v_existing_user_id UUID;
  v_membership_id UUID;
  v_result JSONB;
BEGIN
  -- Check if inviter has permission
  SELECT role INTO v_inviter_role
  FROM user_organizations
  WHERE user_id = p_inviter_id
    AND organization_id = p_organization_id
    AND is_active = true;

  IF v_inviter_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not a member of organization'
    );
  END IF;

  -- Only admins and superusers can invite
  v_can_invite := v_inviter_role IN ('superuser', 'org_admin', 'admin');

  IF NOT v_can_invite THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to invite users'
    );
  END IF;

  -- Check if user already exists
  SELECT id INTO v_existing_user_id
  FROM user_profiles
  WHERE email = p_email;

  -- Generate invitation token
  v_invitation_token := encode(gen_random_bytes(32), 'base64');

  -- Create membership record
  IF v_existing_user_id IS NOT NULL THEN
    -- User exists, create active membership
    INSERT INTO user_organizations (
      user_id,
      organization_id,
      role,
      invited_by,
      invited_at,
      is_active,
      invitation_token
    )
    VALUES (
      v_existing_user_id,
      p_organization_id,
      p_role,
      p_inviter_id,
      NOW(),
      true,
      v_invitation_token
    )
    ON CONFLICT (user_id, organization_id) DO UPDATE
    SET invited_by = EXCLUDED.invited_by,
        invited_at = EXCLUDED.invited_at,
        invitation_token = EXCLUDED.invitation_token,
        is_active = true
    RETURNING id INTO v_membership_id;

    v_result := jsonb_build_object(
      'success', true,
      'membership_id', v_membership_id,
      'invitation_token', v_invitation_token,
      'user_exists', true,
      'message', 'Existing user invited successfully'
    );
  ELSE
    -- User doesn't exist, create pending invitation
    -- This will need to be claimed when user signs up
    INSERT INTO user_organizations (
      user_id,
      organization_id,
      role,
      invited_by,
      invited_at,
      is_active,
      invitation_token
    )
    VALUES (
      gen_random_uuid(), -- Temporary ID until user signs up
      p_organization_id,
      p_role,
      p_inviter_id,
      NOW(),
      false, -- Not active until claimed
      v_invitation_token
    )
    RETURNING id INTO v_membership_id;

    v_result := jsonb_build_object(
      'success', true,
      'membership_id', v_membership_id,
      'invitation_token', v_invitation_token,
      'user_exists', false,
      'message', 'Invitation created for new user'
    );
  END IF;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION invite_user_to_organization IS 'Invite user to organization by email. Creates pending invitation if user does not exist.';

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_organization_invitation(
  p_user_id UUID,
  p_invitation_token VARCHAR(255)
)
RETURNS JSONB AS $$
DECLARE
  v_membership_id UUID;
  v_organization_id UUID;
  v_result JSONB;
BEGIN
  -- Find and update membership
  UPDATE user_organizations
  SET user_id = p_user_id,
      is_active = true,
      invitation_accepted_at = NOW(),
      updated_at = NOW()
  WHERE invitation_token = p_invitation_token
    AND (is_active = false OR user_id != p_user_id)
  RETURNING id, organization_id INTO v_membership_id, v_organization_id;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invitation token'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'organization_id', v_organization_id,
    'message', 'Invitation accepted successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION accept_organization_invitation IS 'Accept organization invitation using token. Links user to organization.';

-- ============================================================================
-- STEP 8: CREATE AUDIT TRIGGER FOR USER_PROFILES
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_profile_updated ON user_profiles;
CREATE TRIGGER trg_user_profile_updated
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_timestamp();

-- ============================================================================
-- STEP 9: CREATE VIEWS FOR USER MANAGEMENT
-- ============================================================================

-- View: Organization members with full profile info
CREATE OR REPLACE VIEW v_organization_members AS
SELECT
  uo.id as membership_id,
  uo.organization_id,
  o.name as organization_name,
  uo.user_id,
  up.display_name,
  up.email,
  up.avatar_url,
  uo.role,
  uo.is_active,
  uo.joined_at,
  uo.invited_by,
  inviter.display_name as invited_by_name,
  uo.invited_at,
  uo.invitation_accepted_at,
  uo.permissions
FROM user_organizations uo
JOIN organizations o ON uo.organization_id = o.id
LEFT JOIN user_profiles up ON uo.user_id = up.id
LEFT JOIN user_profiles inviter ON uo.invited_by = inviter.id
WHERE uo.is_active = true
  AND up.deleted_at IS NULL;

COMMENT ON VIEW v_organization_members IS 'Complete view of organization members with profile information';

-- View: Pending invitations
CREATE OR REPLACE VIEW v_pending_invitations AS
SELECT
  uo.id as invitation_id,
  uo.organization_id,
  o.name as organization_name,
  uo.invitation_token,
  uo.role as invited_role,
  uo.invited_by,
  inviter.display_name as invited_by_name,
  inviter.email as invited_by_email,
  uo.invited_at
FROM user_organizations uo
JOIN organizations o ON uo.organization_id = o.id
LEFT JOIN user_profiles inviter ON uo.invited_by = inviter.id
WHERE uo.is_active = false
  AND uo.invitation_token IS NOT NULL
  AND uo.invited_at > NOW() - INTERVAL '30 days'; -- Show invitations from last 30 days

COMMENT ON VIEW v_pending_invitations IS 'Pending organization invitations not yet accepted';

-- ============================================================================
-- STEP 10: VERIFICATION AND SUCCESS MESSAGE
-- ============================================================================

-- Function to verify authentication setup
CREATE OR REPLACE FUNCTION verify_auth_setup()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check user_profiles table
  RETURN QUERY
  SELECT
    'user_profiles table'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_profiles')
      THEN '✅ EXISTS' ELSE '❌ MISSING' END,
    (SELECT COUNT(*)::TEXT || ' profiles' FROM user_profiles);

  -- Check RLS on user_profiles
  RETURN QUERY
  SELECT
    'user_profiles RLS'::TEXT,
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_profiles')
      THEN '✅ ENABLED' ELSE '❌ DISABLED' END,
    (SELECT COUNT(*)::TEXT || ' policies' FROM pg_policies WHERE tablename = 'user_profiles');

  -- Check user_organizations enhancements
  RETURN QUERY
  SELECT
    'user_organizations.role'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_organizations' AND column_name = 'role'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END,
    (SELECT COUNT(*)::TEXT || ' members' FROM user_organizations);

  -- Check invitation system
  RETURN QUERY
  SELECT
    'Invitation system'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'user_organizations' AND column_name = 'invitation_token'
    ) THEN '✅ READY' ELSE '❌ NOT READY' END,
    (SELECT COUNT(*)::TEXT || ' pending' FROM user_organizations WHERE invitation_token IS NOT NULL);

  -- Check helper functions
  RETURN QUERY
  SELECT
    'Helper functions'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'initialize_superuser')
      THEN '✅ INSTALLED' ELSE '❌ MISSING' END,
    'initialize_superuser, invite_user_to_organization, accept_organization_invitation';

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
DECLARE
  auth_check RECORD;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 006 COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Supabase Authentication Features:';
  RAISE NOTICE '  ✅ user_profiles table created';
  RAISE NOTICE '  ✅ user_organizations enhanced with roles';
  RAISE NOTICE '  ✅ Invitation system implemented';
  RAISE NOTICE '  ✅ Superuser initialization function';
  RAISE NOTICE '  ✅ User management helper functions';
  RAISE NOTICE '  ✅ RLS policies for user profiles';
  RAISE NOTICE '  ✅ Organization user limits enforced';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Setup Verification:';

  FOR auth_check IN SELECT * FROM verify_auth_setup() LOOP
    RAISE NOTICE '  % - %: %', auth_check.check_name, auth_check.status, auth_check.details;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '👤 User Roles:';
  RAISE NOTICE '  - superuser: Global admin, bypasses all limits';
  RAISE NOTICE '  - org_admin: Organization owner, full org access';
  RAISE NOTICE '  - admin: Organization manager, can invite users';
  RAISE NOTICE '  - member: Standard user with edit permissions';
  RAISE NOTICE '  - viewer: Read-only access';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next Steps:';
  RAISE NOTICE '  1. Configure Supabase Auth (email, OAuth, etc.)';
  RAISE NOTICE '  2. Create first superuser:';
  RAISE NOTICE '     SELECT initialize_superuser(';
  RAISE NOTICE '       auth_user_id, ';
  RAISE NOTICE '       ''admin@example.com'', ';
  RAISE NOTICE '       ''Admin User''';
  RAISE NOTICE '     );';
  RAISE NOTICE '  3. Update application code to use auth.uid()';
  RAISE NOTICE '  4. Test user invitation flow';
  RAISE NOTICE '  5. Verify RLS policies with test users';
  RAISE NOTICE '';
  RAISE NOTICE '📚 Helper Functions:';
  RAISE NOTICE '  - initialize_superuser(auth_id, email, name, org_id)';
  RAISE NOTICE '  - invite_user_to_organization(inviter_id, email, org_id, role)';
  RAISE NOTICE '  - accept_organization_invitation(user_id, token)';
  RAISE NOTICE '  - verify_auth_setup() - Run this to check setup';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Verification Command:';
  RAISE NOTICE '  SELECT * FROM verify_auth_setup();';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '⚠️  IMPORTANT NOTES:';
  RAISE NOTICE '';
  RAISE NOTICE '1. USER MIGRATION: If you have existing users in the old';
  RAISE NOTICE '   users table, you need to:';
  RAISE NOTICE '   a) Create corresponding auth.users entries';
  RAISE NOTICE '   b) Create user_profiles for each';
  RAISE NOTICE '   c) Update user_organizations.user_id references';
  RAISE NOTICE '';
  RAISE NOTICE '2. SERVICE ROLE KEY: Ensure SUPABASE_SERVICE_ROLE_KEY';
  RAISE NOTICE '   is set for setup wizard and admin operations';
  RAISE NOTICE '';
  RAISE NOTICE '3. USER LIMITS: Organizations enforce max_users limit';
  RAISE NOTICE '   (default 10 for free plan, configurable)';
  RAISE NOTICE '';
  RAISE NOTICE '4. BACKWARD COMPATIBILITY: Existing RLS policies';
  RAISE NOTICE '   from migration 005 are maintained and enhanced';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- ============================================================================
/*
-- To rollback this migration:

-- 1. Drop new views
DROP VIEW IF EXISTS v_pending_invitations;
DROP VIEW IF EXISTS v_organization_members;

-- 2. Drop new functions
DROP FUNCTION IF EXISTS verify_auth_setup();
DROP FUNCTION IF EXISTS accept_organization_invitation(UUID, VARCHAR);
DROP FUNCTION IF EXISTS invite_user_to_organization(UUID, VARCHAR, UUID, VARCHAR);
DROP FUNCTION IF EXISTS initialize_superuser(UUID, VARCHAR, VARCHAR, UUID);
DROP FUNCTION IF EXISTS check_org_user_limit();

-- 3. Drop triggers
DROP TRIGGER IF EXISTS trg_user_profile_updated ON user_profiles;
DROP TRIGGER IF EXISTS trg_check_org_user_limit ON user_organizations;

-- 4. Remove new columns from user_organizations
ALTER TABLE user_organizations DROP COLUMN IF EXISTS invitation_accepted_at;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS invitation_token;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS is_active;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS invited_at;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS invited_by;

-- 5. Drop new table
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 6. Re-enable old users table if it was disabled
-- (Manual step - depends on your specific setup)

NOTICE: 'Migration 006 rolled back successfully';
*/
