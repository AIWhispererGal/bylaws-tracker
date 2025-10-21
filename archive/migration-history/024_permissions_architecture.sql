-- Migration 024: Permissions Architecture Redesign
-- Date: 2025-10-19
-- Purpose: Centralize permissions in clean architecture
--   - Separate global user types from organization roles
--   - Eliminate RLS recursion issues
--   - Provide backwards compatibility during migration
--
-- IMPORTANT: This is a NON-BREAKING migration
--   - Adds new tables and columns
--   - Keeps old columns for backwards compatibility
--   - Old columns will be deprecated in v3.0

-- ============================================================================
-- PART 1: CREATE USER TYPES TABLE (GLOBAL/PLATFORM-LEVEL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  type_code VARCHAR(50) UNIQUE NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Global permissions (platform-wide)
  global_permissions JSONB DEFAULT '{
    "can_access_all_organizations": false,
    "can_create_organizations": false,
    "can_delete_organizations": false,
    "can_manage_platform_users": false,
    "can_view_system_logs": false,
    "can_configure_system": false
  }'::jsonb,

  -- Metadata
  is_system_type BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_types_code ON user_types(type_code);
COMMENT ON TABLE user_types IS 'Platform-level user types (global_admin vs regular_user)';

-- Insert default user types
INSERT INTO user_types (type_code, type_name, description, global_permissions, is_system_type)
VALUES
  ('global_admin', 'Global Administrator',
   'Platform-wide administrator with access to all organizations',
   '{"can_access_all_organizations": true, "can_create_organizations": true, "can_delete_organizations": true, "can_manage_platform_users": true, "can_view_system_logs": true, "can_configure_system": true}'::jsonb,
   true),

  ('regular_user', 'Regular User',
   'Standard user with organization-based access only',
   '{"can_access_all_organizations": false, "can_create_organizations": false, "can_delete_organizations": false, "can_manage_platform_users": false, "can_view_system_logs": false, "can_configure_system": false}'::jsonb,
   true)
ON CONFLICT (type_code) DO NOTHING;

-- ============================================================================
-- PART 2: CREATE ORGANIZATION ROLES TABLE (ORG-SPECIFIC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  role_code VARCHAR(50) UNIQUE NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  hierarchy_level INTEGER NOT NULL,

  -- Organization-level permissions
  org_permissions JSONB DEFAULT '{
    "can_edit_sections": false,
    "can_create_suggestions": false,
    "can_vote": false,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false,
    "can_upload_documents": false,
    "can_delete_documents": false,
    "can_configure_organization": false
  }'::jsonb,

  -- Metadata
  is_system_role BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(hierarchy_level)
);

CREATE INDEX idx_org_roles_code ON organization_roles(role_code);
CREATE INDEX idx_org_roles_level ON organization_roles(hierarchy_level);
COMMENT ON TABLE organization_roles IS 'Organization-specific roles (owner, admin, member, viewer)';

-- Insert default organization roles
INSERT INTO organization_roles (role_code, role_name, description, hierarchy_level, org_permissions, is_system_role)
VALUES
  ('owner', 'Owner',
   'Organization owner with full permissions',
   4,
   '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": ["all"], "can_manage_users": true, "can_manage_workflows": true, "can_upload_documents": true, "can_delete_documents": true, "can_configure_organization": true}'::jsonb,
   true),

  ('admin', 'Administrator',
   'Organization administrator with management permissions',
   3,
   '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": ["committee", "board"], "can_manage_users": true, "can_manage_workflows": true, "can_upload_documents": true, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
   true),

  ('member', 'Member',
   'Regular member with editing permissions',
   2,
   '{"can_edit_sections": true, "can_create_suggestions": true, "can_vote": true, "can_approve_stages": [], "can_manage_users": false, "can_manage_workflows": false, "can_upload_documents": false, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
   true),

  ('viewer', 'Viewer',
   'Read-only access to organization',
   1,
   '{"can_edit_sections": false, "can_create_suggestions": false, "can_vote": false, "can_approve_stages": [], "can_manage_users": false, "can_manage_workflows": false, "can_upload_documents": false, "can_delete_documents": false, "can_configure_organization": false}'::jsonb,
   true)
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================================
-- PART 3: ADD NEW COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add user_type_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_type_id'
  ) THEN
    ALTER TABLE users ADD COLUMN user_type_id UUID REFERENCES user_types(id);
    RAISE NOTICE 'Added user_type_id column to users table';
  END IF;
END $$;

-- Add org_role_id to user_organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_organizations' AND column_name = 'org_role_id'
  ) THEN
    ALTER TABLE user_organizations ADD COLUMN org_role_id UUID REFERENCES organization_roles(id);
    RAISE NOTICE 'Added org_role_id column to user_organizations table';
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_role_id ON user_organizations(org_role_id);

-- ============================================================================
-- PART 4: MIGRATE EXISTING DATA
-- ============================================================================

-- Migrate is_global_admin from user_organizations to users.user_type_id
UPDATE users
SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'global_admin'
)
WHERE (is_global_admin = true OR id IN (
  SELECT DISTINCT user_id
  FROM user_organizations
  WHERE is_global_admin = true
))
AND user_type_id IS NULL;

-- Set regular users (anyone not already set)
UPDATE users
SET user_type_id = (
  SELECT id FROM user_types WHERE type_code = 'regular_user'
)
WHERE user_type_id IS NULL;

-- Migrate role strings to role IDs in user_organizations
UPDATE user_organizations uo
SET org_role_id = (
  SELECT id FROM organization_roles WHERE role_code = uo.role
)
WHERE org_role_id IS NULL AND role IS NOT NULL;

-- ============================================================================
-- PART 5: PERMISSION HELPER FUNCTIONS (CENTRALIZED LOGIC)
-- ============================================================================

-- Check if user has global permission
CREATE OR REPLACE FUNCTION user_has_global_permission(
  p_user_id UUID,
  p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  SELECT (ut.global_permissions->>p_permission)::boolean
  INTO has_permission
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = p_user_id;

  RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION user_has_global_permission IS
  'Check if user has specific global/platform permission. Safe SECURITY DEFINER function.';

-- Check if user has organization permission
CREATE OR REPLACE FUNCTION user_has_org_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  -- Global admins have all org permissions
  IF user_has_global_permission(p_user_id, 'can_access_all_organizations') THEN
    RETURN TRUE;
  END IF;

  -- Check org-specific permission
  SELECT (r.org_permissions->>p_permission)::boolean
  INTO has_permission
  FROM user_organizations uo
  JOIN organization_roles r ON uo.org_role_id = r.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE;

  RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION user_has_org_permission IS
  'Check if user has specific organization permission. Respects global admin override.';

-- Check if user has minimum role level in organization
CREATE OR REPLACE FUNCTION user_has_min_role_level(
  p_user_id UUID,
  p_organization_id UUID,
  p_min_level INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  user_level INTEGER;
BEGIN
  -- Global admins have max level (4 = owner)
  IF user_has_global_permission(p_user_id, 'can_access_all_organizations') THEN
    RETURN TRUE;
  END IF;

  -- Get user's role level
  SELECT r.hierarchy_level
  INTO user_level
  FROM user_organizations uo
  JOIN organization_roles r ON uo.org_role_id = r.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE;

  RETURN COALESCE(user_level, 0) >= p_min_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION user_has_min_role_level IS
  'Check if user has minimum role hierarchy level (4=owner, 3=admin, 2=member, 1=viewer).';

-- Get user's effective permissions (merged global + org)
CREATE OR REPLACE FUNCTION get_user_effective_permissions(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
  global_perms JSONB;
  org_perms JSONB;
  effective_perms JSONB;
BEGIN
  -- Get global permissions
  SELECT ut.global_permissions
  INTO global_perms
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE u.id = p_user_id;

  -- Get org permissions
  SELECT r.org_permissions
  INTO org_perms
  FROM user_organizations uo
  JOIN organization_roles r ON uo.org_role_id = r.id
  WHERE uo.user_id = p_user_id
    AND uo.organization_id = p_organization_id
    AND uo.is_active = TRUE;

  -- Merge permissions (global || org)
  effective_perms := COALESCE(global_perms, '{}'::jsonb) || COALESCE(org_perms, '{}'::jsonb);

  RETURN effective_perms;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_user_effective_permissions IS
  'Get merged global + organization permissions for user in specific org.';

-- ============================================================================
-- PART 6: DEPRECATION WARNINGS
-- ============================================================================

-- Add deprecation comments to old columns
COMMENT ON COLUMN user_organizations.role IS
  'DEPRECATED: Use org_role_id instead. Will be removed in v3.0. Kept for backwards compatibility.';

COMMENT ON COLUMN user_organizations.is_global_admin IS
  'DEPRECATED: Use users.user_type_id instead. Will be removed in v3.0. Kept for backwards compatibility.';

COMMENT ON COLUMN user_organizations.permissions IS
  'DEPRECATED: Use organization_roles.org_permissions instead. Will be removed in v3.0. Kept for backwards compatibility.';

-- ============================================================================
-- PART 7: ENABLE RLS ON NEW TABLES
-- ============================================================================

ALTER TABLE user_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read user types and roles
CREATE POLICY "Anyone can read user types"
  ON user_types FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read organization roles"
  ON organization_roles FOR SELECT
  USING (true);

-- Only global admins can modify
CREATE POLICY "Global admins can manage user types"
  ON user_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()
      AND (ut.global_permissions->>'can_configure_system')::boolean = true
    )
  );

CREATE POLICY "Global admins can manage organization roles"
  ON organization_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id = auth.uid()
      AND (ut.global_permissions->>'can_configure_system')::boolean = true
    )
  );

-- ============================================================================
-- PART 8: MIGRATION SUMMARY
-- ============================================================================

DO $$
DECLARE
  global_admin_count INTEGER;
  regular_user_count INTEGER;
  total_users INTEGER;
BEGIN
  -- Count migrated users
  SELECT COUNT(*) INTO global_admin_count
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE ut.type_code = 'global_admin';

  SELECT COUNT(*) INTO regular_user_count
  FROM users u
  JOIN user_types ut ON u.user_type_id = ut.id
  WHERE ut.type_code = 'regular_user';

  SELECT COUNT(*) INTO total_users FROM users;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 024 Completed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'New Tables:';
  RAISE NOTICE '✅ user_types (2 default types)';
  RAISE NOTICE '✅ organization_roles (4 default roles)';
  RAISE NOTICE '';
  RAISE NOTICE 'Data Migration:';
  RAISE NOTICE '✅ % global admins migrated', global_admin_count;
  RAISE NOTICE '✅ % regular users migrated', regular_user_count;
  RAISE NOTICE '✅ %/% total users migrated', (global_admin_count + regular_user_count), total_users;
  RAISE NOTICE '';
  RAISE NOTICE 'Helper Functions:';
  RAISE NOTICE '✅ user_has_global_permission()';
  RAISE NOTICE '✅ user_has_org_permission()';
  RAISE NOTICE '✅ user_has_min_role_level()';
  RAISE NOTICE '✅ get_user_effective_permissions()';
  RAISE NOTICE '';
  RAISE NOTICE 'Backwards Compatibility:';
  RAISE NOTICE '⚠️  Old columns kept (role, is_global_admin, permissions)';
  RAISE NOTICE '⚠️  Deprecation warnings added';
  RAISE NOTICE '⚠️  Will be removed in v3.0';
  RAISE NOTICE '========================================';
END $$;
