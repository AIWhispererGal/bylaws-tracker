-- Migration 025: Seed Organization Roles
-- Purpose: Populate organization_roles table with required system roles
-- This fixes: "Failed to get owner role for organization creator" error
-- Created: 2025-10-20

-- =============================================================================
-- PART 1: Insert System Roles
-- =============================================================================

-- Clear any existing roles (in case this is re-run)
-- TRUNCATE TABLE organization_roles CASCADE;

-- Insert the required organization roles
INSERT INTO organization_roles (
  role_code,
  role_name,
  description,
  hierarchy_level,
  org_permissions,
  is_system_role
) VALUES
  -- Owner (highest level)
  (
    'owner',
    'Organization Owner',
    'Full control over the organization, including all administrative functions',
    0,
    '{
      "can_vote": true,
      "can_manage_users": true,
      "can_edit_sections": true,
      "can_approve_stages": ["all"],
      "can_delete_documents": true,
      "can_manage_workflows": true,
      "can_upload_documents": true,
      "can_create_suggestions": true,
      "can_configure_organization": true,
      "can_manage_roles": true,
      "can_delete_organization": true
    }'::jsonb,
    true
  ),

  -- Admin
  (
    'admin',
    'Organization Administrator',
    'Administrative privileges including user management and document workflows',
    10,
    '{
      "can_vote": true,
      "can_manage_users": true,
      "can_edit_sections": true,
      "can_approve_stages": ["all"],
      "can_delete_documents": true,
      "can_manage_workflows": true,
      "can_upload_documents": true,
      "can_create_suggestions": true,
      "can_configure_organization": true
    }'::jsonb,
    true
  ),

  -- Editor
  (
    'editor',
    'Editor',
    'Can create and edit documents, manage suggestions and workflows',
    20,
    '{
      "can_vote": true,
      "can_manage_users": false,
      "can_edit_sections": true,
      "can_approve_stages": [],
      "can_delete_documents": false,
      "can_manage_workflows": true,
      "can_upload_documents": true,
      "can_create_suggestions": true,
      "can_configure_organization": false
    }'::jsonb,
    true
  ),

  -- Member
  (
    'member',
    'Member',
    'Can view documents, create suggestions, and vote on proposals',
    30,
    '{
      "can_vote": true,
      "can_manage_users": false,
      "can_edit_sections": false,
      "can_approve_stages": [],
      "can_delete_documents": false,
      "can_manage_workflows": false,
      "can_upload_documents": false,
      "can_create_suggestions": true,
      "can_configure_organization": false
    }'::jsonb,
    true
  ),

  -- Viewer
  (
    'viewer',
    'Viewer',
    'Read-only access to documents and content',
    40,
    '{
      "can_vote": false,
      "can_manage_users": false,
      "can_edit_sections": false,
      "can_approve_stages": [],
      "can_delete_documents": false,
      "can_manage_workflows": false,
      "can_upload_documents": false,
      "can_create_suggestions": false,
      "can_configure_organization": false
    }'::jsonb,
    true
  )

ON CONFLICT (role_code) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  hierarchy_level = EXCLUDED.hierarchy_level,
  org_permissions = EXCLUDED.org_permissions,
  is_system_role = EXCLUDED.is_system_role,
  updated_at = now();

-- =============================================================================
-- PART 2: Verification
-- =============================================================================

-- Verify roles were inserted
DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO role_count FROM organization_roles WHERE is_system_role = true;

  IF role_count < 5 THEN
    RAISE EXCEPTION 'Expected 5 system roles, found %', role_count;
  END IF;

  RAISE NOTICE '✅ Successfully seeded % organization roles', role_count;
END $$;

-- =============================================================================
-- PART 3: Display Seeded Roles
-- =============================================================================

-- Show what was created
SELECT
  role_code,
  role_name,
  hierarchy_level,
  (org_permissions->>'can_manage_users')::boolean as can_manage_users,
  (org_permissions->>'can_configure_organization')::boolean as can_configure_org,
  is_system_role
FROM organization_roles
ORDER BY hierarchy_level;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Migration 025 applied successfully
-- Organization roles seeded
-- Setup wizard should now work correctly
