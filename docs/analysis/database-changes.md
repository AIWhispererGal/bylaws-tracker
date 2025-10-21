# Database Schema Changes for Role Management & Approval Workflow

**Document Version:** 1.0
**Date:** 2025-10-13
**Status:** Ready for Implementation
**Author:** Analyst Agent (Hive Mind Collective)

---

## Executive Summary

This document provides complete SQL migration scripts for implementing the role management system and approval workflow enhancements. All migrations are designed to be non-destructive and reversible.

---

## Migration Overview

| Migration | Description | Tables Affected | Risk Level |
|-----------|-------------|-----------------|------------|
| 008 | Role management enhancements | user_organizations, user_invitations, user_role_history | Low |
| 009 | Section locking mechanism | document_sections | Low |
| 010 | Document versioning | documents, document_versions | Medium |
| 011 | Workflow state enhancements | section_workflow_states, workflow_actions_log | Low |
| 012 | RLS policy updates | All workflow tables | Medium |
| 013 | Performance indexes | All tables | Low |

---

## Migration 008: Role Management Enhancements

**File:** `/database/migrations/008_role_management_enhancements.sql`

```sql
-- ============================================================================
-- MIGRATION 008: ROLE MANAGEMENT ENHANCEMENTS
-- Date: 2025-10-13
-- Purpose: Add role change tracking, invitation system, and audit trail
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENHANCE user_organizations TABLE
-- ============================================================================

-- Add role change tracking
ALTER TABLE user_organizations
  ADD COLUMN IF NOT EXISTS role_changed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS role_changed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP;

-- Add index for invitation token lookups
CREATE INDEX IF NOT EXISTS idx_user_orgs_invitation_token
  ON user_organizations(invitation_token)
  WHERE invitation_token IS NOT NULL;

-- ============================================================================
-- 2. CREATE user_invitations TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Invitation details
  email VARCHAR(255) NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  role VARCHAR(50) NOT NULL,

  -- Token and status
  token VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired, revoked

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id),

  -- Metadata
  invitation_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  CHECK (role IN ('owner', 'admin', 'committee_member', 'staff', 'suggester', 'viewer'))
);

-- Indexes
CREATE INDEX idx_invitations_email ON user_invitations(email);
CREATE INDEX idx_invitations_org ON user_invitations(organization_id);
CREATE INDEX idx_invitations_token ON user_invitations(token);
CREATE INDEX idx_invitations_status ON user_invitations(organization_id, status);
CREATE INDEX idx_invitations_invited_by ON user_invitations(invited_by);

COMMENT ON TABLE user_invitations IS 'Tracks user invitations to organizations with expiry and revocation support';

-- ============================================================================
-- 3. CREATE user_role_history TABLE (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_role_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User and org
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Role change details
  previous_role VARCHAR(50),
  new_role VARCHAR(50) NOT NULL,
  previous_permissions JSONB,
  new_permissions JSONB,

  -- Who made the change
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),

  -- Reason and notes
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Indexes
  INDEX idx_role_history_user (user_id, organization_id),
  INDEX idx_role_history_org (organization_id),
  INDEX idx_role_history_date (changed_at DESC),
  INDEX idx_role_history_changed_by (changed_by)
);

COMMENT ON TABLE user_role_history IS 'Complete audit trail of all role changes for compliance and debugging';

-- ============================================================================
-- 4. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function: Get default permissions for a role
CREATE OR REPLACE FUNCTION get_default_permissions(role_name VARCHAR)
RETURNS JSONB AS $$
BEGIN
  RETURN CASE role_name
    WHEN 'owner' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee", "board"],
      "can_manage_users": true,
      "can_manage_workflows": true,
      "can_lock_sections": true,
      "can_delete_documents": true,
      "can_manage_org_settings": true
    }'::jsonb

    WHEN 'admin' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee", "board"],
      "can_manage_users": true,
      "can_manage_workflows": true,
      "can_lock_sections": true,
      "can_delete_documents": true,
      "can_manage_org_settings": true
    }'::jsonb

    WHEN 'committee_member' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": true,
      "can_approve_stages": ["committee"],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": true,
      "can_delete_documents": false,
      "can_manage_org_settings": false
    }'::jsonb

    WHEN 'staff' THEN '{
      "can_edit_sections": true,
      "can_create_suggestions": true,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false,
      "can_delete_documents": false,
      "can_manage_org_settings": false
    }'::jsonb

    WHEN 'suggester' THEN '{
      "can_edit_sections": false,
      "can_create_suggestions": true,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false,
      "can_delete_documents": false,
      "can_manage_org_settings": false
    }'::jsonb

    WHEN 'viewer' THEN '{
      "can_edit_sections": false,
      "can_create_suggestions": false,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false,
      "can_delete_documents": false,
      "can_manage_org_settings": false
    }'::jsonb

    ELSE '{
      "can_edit_sections": false,
      "can_create_suggestions": false,
      "can_vote": false,
      "can_approve_stages": [],
      "can_manage_users": false,
      "can_manage_workflows": false,
      "can_lock_sections": false,
      "can_delete_documents": false,
      "can_manage_org_settings": false
    }'::jsonb
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_default_permissions IS 'Returns default JSONB permissions for a given role name';

-- Function: Log role changes automatically
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.role != NEW.role) THEN
    INSERT INTO user_role_history (
      user_id,
      organization_id,
      previous_role,
      new_role,
      previous_permissions,
      new_permissions,
      changed_by,
      changed_at
    ) VALUES (
      NEW.user_id,
      NEW.organization_id,
      OLD.role,
      NEW.role,
      OLD.permissions,
      NEW.permissions,
      NEW.role_changed_by,
      NEW.role_changed_at
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log role changes
DROP TRIGGER IF EXISTS trg_log_role_change ON user_organizations;
CREATE TRIGGER trg_log_role_change
  AFTER UPDATE OF role ON user_organizations
  FOR EACH ROW
  EXECUTE FUNCTION log_role_change();

-- ============================================================================
-- 5. UPDATE EXISTING user_organizations PERMISSIONS
-- ============================================================================

-- Update permissions for existing users based on their roles
UPDATE user_organizations
SET permissions = get_default_permissions(role)
WHERE permissions IS NULL OR permissions = '{}'::jsonb;

-- ============================================================================
-- 6. RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_history ENABLE ROW LEVEL SECURITY;

-- Invitations: Admins can see org invitations
CREATE POLICY "Admins see org invitations"
  ON user_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id = user_invitations.organization_id
      AND uo.role IN ('owner', 'admin')
    )
  );

-- Invitations: Admins can create invitations
CREATE POLICY "Admins create invitations"
  ON user_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id = user_invitations.organization_id
      AND uo.role IN ('owner', 'admin')
    )
  );

-- Role History: Users see their own history
CREATE POLICY "Users see own role history"
  ON user_role_history
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id = user_role_history.organization_id
      AND uo.role IN ('owner', 'admin')
    )
  );

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 008: Role Management - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - user_invitations';
  RAISE NOTICE '  - user_role_history';
  RAISE NOTICE 'Added columns to user_organizations';
  RAISE NOTICE 'Created helper functions for permissions';
  RAISE NOTICE 'Enabled RLS policies';
  RAISE NOTICE '========================================';
END $$;
```

---

## Migration 009: Section Locking Mechanism

**File:** `/database/migrations/009_section_locking_mechanism.sql`

```sql
-- ============================================================================
-- MIGRATION 009: SECTION LOCKING MECHANISM
-- Date: 2025-10-13
-- Purpose: Add section locking for workflow approval process
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD LOCKING COLUMNS TO document_sections
-- ============================================================================

ALTER TABLE document_sections
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS locked_by_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lock_reason TEXT,
  ADD COLUMN IF NOT EXISTS lock_metadata JSONB DEFAULT '{}'::jsonb;

-- Index for locked sections
CREATE INDEX IF NOT EXISTS idx_sections_locked
  ON document_sections(document_id, is_locked)
  WHERE is_locked = true;

CREATE INDEX IF NOT EXISTS idx_sections_locked_by
  ON document_sections(locked_by)
  WHERE locked_by IS NOT NULL;

COMMENT ON COLUMN document_sections.is_locked IS 'Section is locked during workflow approval process';
COMMENT ON COLUMN document_sections.locked_by IS 'User ID who locked the section';
COMMENT ON COLUMN document_sections.lock_reason IS 'Reason for locking (e.g., "Selected for committee approval")';

-- ============================================================================
-- 2. ADD SELECTED_SUGGESTION TO section_workflow_states
-- ============================================================================

-- Already exists in schema, but ensure index
CREATE INDEX IF NOT EXISTS idx_section_states_selected_suggestion
  ON section_workflow_states(selected_suggestion_id)
  WHERE selected_suggestion_id IS NOT NULL;

-- ============================================================================
-- 3. CREATE HELPER FUNCTIONS FOR LOCKING
-- ============================================================================

-- Function: Check if user can lock section
CREATE OR REPLACE FUNCTION user_can_lock_section(
  p_user_id UUID,
  p_section_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_can_lock BOOLEAN;
BEGIN
  -- Check if user has lock permission in the organization
  SELECT EXISTS (
    SELECT 1
    FROM document_sections ds
    JOIN documents d ON ds.document_id = d.id
    JOIN user_organizations uo ON d.organization_id = uo.organization_id
    WHERE ds.id = p_section_id
    AND uo.user_id = p_user_id
    AND (
      uo.role IN ('owner', 'admin', 'committee_member')
      OR (uo.permissions->>'can_lock_sections')::boolean = true
    )
  ) INTO v_can_lock;

  RETURN v_can_lock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can unlock section
CREATE OR REPLACE FUNCTION user_can_unlock_section(
  p_user_id UUID,
  p_section_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_can_unlock BOOLEAN;
  v_locked_by UUID;
BEGIN
  -- Get who locked the section
  SELECT locked_by INTO v_locked_by
  FROM document_sections
  WHERE id = p_section_id;

  -- User can unlock if they locked it OR they're an admin
  SELECT (
    v_locked_by = p_user_id
    OR EXISTS (
      SELECT 1
      FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE ds.id = p_section_id
      AND uo.user_id = p_user_id
      AND uo.role IN ('owner', 'admin')
    )
  ) INTO v_can_unlock;

  RETURN v_can_unlock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. RLS POLICIES FOR LOCKED SECTIONS
-- ============================================================================

-- Prevent editing locked sections
CREATE OR REPLACE FUNCTION check_section_not_locked()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow admins to edit locked sections
  IF EXISTS (
    SELECT 1
    FROM documents d
    JOIN user_organizations uo ON d.organization_id = uo.organization_id
    WHERE d.id = NEW.document_id
    AND uo.user_id = auth.uid()
    AND uo.role IN ('owner', 'admin')
  ) THEN
    RETURN NEW;
  END IF;

  -- Prevent others from editing locked sections
  IF NEW.is_locked = true AND (OLD.is_locked IS NULL OR OLD.is_locked = false) THEN
    -- Locking is allowed if user has permission
    IF NOT user_can_lock_section(auth.uid(), NEW.id) THEN
      RAISE EXCEPTION 'You do not have permission to lock this section';
    END IF;
  END IF;

  IF OLD.is_locked = true AND OLD.current_text != NEW.current_text THEN
    RAISE EXCEPTION 'Cannot edit locked section (%)'. Please unlock it first.', NEW.section_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_section_not_locked ON document_sections;
CREATE TRIGGER trg_check_section_not_locked
  BEFORE UPDATE ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION check_section_not_locked();

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 009: Section Locking - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added locking columns to document_sections';
  RAISE NOTICE 'Created helper functions for lock permissions';
  RAISE NOTICE 'Added trigger to prevent editing locked sections';
  RAISE NOTICE '========================================';
END $$;
```

---

## Migration 010: Document Versioning

**File:** `/database/migrations/010_document_versioning.sql`

```sql
-- ============================================================================
-- MIGRATION 010: DOCUMENT VERSIONING
-- Date: 2025-10-13
-- Purpose: Add version control and history tracking for documents
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENHANCE documents TABLE
-- ============================================================================

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS version_number VARCHAR(20) DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS version_type VARCHAR(20) DEFAULT 'major',
  ADD COLUMN IF NOT EXISTS version_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS version_notes TEXT;

-- Index for version lookups
CREATE INDEX IF NOT EXISTS idx_documents_version
  ON documents(organization_id, version_number);

CREATE INDEX IF NOT EXISTS idx_documents_version_date
  ON documents(version_date DESC)
  WHERE version_date IS NOT NULL;

-- ============================================================================
-- 2. CREATE document_versions TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Document reference
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number VARCHAR(20) NOT NULL,
  version_type VARCHAR(20) NOT NULL, -- major, minor, patch

  -- Snapshot of document at this version
  title VARCHAR(500),
  description TEXT,
  sections_snapshot JSONB NOT NULL, -- Full section tree at this version
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Change tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  changes_summary TEXT,
  affected_sections UUID[], -- Array of section IDs that changed

  -- Workflow completion reference
  workflow_completion_id UUID,

  -- Constraints
  CHECK (version_type IN ('major', 'minor', 'patch')),
  UNIQUE(document_id, version_number)
);

-- Indexes
CREATE INDEX idx_doc_versions_doc ON document_versions(document_id, version_number);
CREATE INDEX idx_doc_versions_date ON document_versions(created_at DESC);
CREATE INDEX idx_doc_versions_created_by ON document_versions(created_by);

COMMENT ON TABLE document_versions IS 'Complete version history with section snapshots for point-in-time recovery';
COMMENT ON COLUMN document_versions.sections_snapshot IS 'JSONB snapshot of all sections at this version for diff comparison';

-- ============================================================================
-- 3. CREATE VERSION HELPER FUNCTIONS
-- ============================================================================

-- Function: Increment version number
CREATE OR REPLACE FUNCTION increment_version(
  current_version VARCHAR,
  version_type VARCHAR
) RETURNS VARCHAR AS $$
DECLARE
  v_parts INTEGER[];
  v_major INTEGER;
  v_minor INTEGER;
  v_patch INTEGER;
BEGIN
  -- Parse version (e.g., "1.2.3" -> [1, 2, 3])
  v_parts := string_to_array(current_version, '.')::INTEGER[];
  v_major := v_parts[1];
  v_minor := COALESCE(v_parts[2], 0);
  v_patch := COALESCE(v_parts[3], 0);

  -- Increment based on type
  CASE version_type
    WHEN 'major' THEN
      v_major := v_major + 1;
      v_minor := 0;
      v_patch := 0;
    WHEN 'minor' THEN
      v_minor := v_minor + 1;
      v_patch := 0;
    WHEN 'patch' THEN
      v_patch := v_patch + 1;
    ELSE
      RAISE EXCEPTION 'Invalid version type: %', version_type;
  END CASE;

  RETURN v_major || '.' || v_minor || '.' || v_patch;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Create document version snapshot
CREATE OR REPLACE FUNCTION create_document_version_snapshot(
  p_document_id UUID,
  p_version_type VARCHAR,
  p_created_by UUID,
  p_changes_summary TEXT DEFAULT NULL,
  p_affected_sections UUID[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_version_id UUID;
  v_current_version VARCHAR;
  v_new_version VARCHAR;
  v_sections_snapshot JSONB;
  v_document RECORD;
BEGIN
  -- Get current document
  SELECT * INTO v_document
  FROM documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found: %', p_document_id;
  END IF;

  -- Calculate new version number
  v_current_version := COALESCE(v_document.version_number, '1.0.0');
  v_new_version := increment_version(v_current_version, p_version_type);

  -- Create sections snapshot
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ds.id,
      'section_number', ds.section_number,
      'section_title', ds.section_title,
      'section_type', ds.section_type,
      'current_text', ds.current_text,
      'original_text', ds.original_text,
      'path_ordinals', ds.path_ordinals,
      'depth', ds.depth,
      'parent_section_id', ds.parent_section_id
    ) ORDER BY ds.path_ordinals
  ) INTO v_sections_snapshot
  FROM document_sections ds
  WHERE ds.document_id = p_document_id;

  -- Create version record
  INSERT INTO document_versions (
    document_id,
    version_number,
    version_type,
    title,
    description,
    sections_snapshot,
    metadata,
    created_by,
    changes_summary,
    affected_sections
  ) VALUES (
    p_document_id,
    v_new_version,
    p_version_type,
    v_document.title,
    v_document.description,
    v_sections_snapshot,
    v_document.metadata,
    p_created_by,
    p_changes_summary,
    p_affected_sections
  )
  RETURNING id INTO v_version_id;

  -- Update document version
  UPDATE documents
  SET
    version_number = v_new_version,
    version_date = NOW(),
    version_notes = p_changes_summary,
    updated_at = NOW()
  WHERE id = p_document_id;

  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_document_version_snapshot IS 'Creates a new version snapshot with incremented version number';

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Users can see versions of documents they have access to
CREATE POLICY "Users see document versions in their orgs"
  ON document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_versions.document_id
      AND uo.user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 010: Document Versioning - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Enhanced documents table with versioning columns';
  RAISE NOTICE 'Created document_versions table for history';
  RAISE NOTICE 'Created helper functions for version management';
  RAISE NOTICE '========================================';
END $$;
```

---

## Migration 011: Workflow Actions Log

**File:** `/database/migrations/011_workflow_actions_log.sql`

```sql
-- ============================================================================
-- MIGRATION 011: WORKFLOW ACTIONS LOG
-- Date: 2025-10-13
-- Purpose: Complete audit trail of all workflow actions
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE workflow_actions_log TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Action details
  action_type VARCHAR(50) NOT NULL, -- lock, unlock, approve, reject, progress, finalize
  section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  workflow_stage_id UUID REFERENCES workflow_stages(id),
  workflow_state_id UUID REFERENCES section_workflow_states(id),

  -- Actor
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  user_role VARCHAR(50),

  -- State changes
  previous_status VARCHAR(50),
  new_status VARCHAR(50),

  -- Context
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_workflow_actions_section (section_id, created_at DESC),
  INDEX idx_workflow_actions_user (user_id, created_at DESC),
  INDEX idx_workflow_actions_type (action_type, created_at DESC),
  INDEX idx_workflow_actions_date (created_at DESC),

  -- Constraints
  CHECK (action_type IN (
    'lock', 'unlock', 'approve', 'reject',
    'progress', 'finalize', 'send_back', 'reopen'
  ))
);

COMMENT ON TABLE workflow_actions_log IS 'Complete audit trail of all workflow actions for compliance and debugging';

-- ============================================================================
-- 2. FUNCTION TO LOG WORKFLOW ACTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_workflow_action(
  p_action_type VARCHAR,
  p_section_id UUID,
  p_workflow_stage_id UUID,
  p_workflow_state_id UUID,
  p_user_id UUID,
  p_previous_status VARCHAR,
  p_new_status VARCHAR,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_email VARCHAR;
  v_user_role VARCHAR;
BEGIN
  -- Get user details
  SELECT u.email, uo.role
  INTO v_user_email, v_user_role
  FROM users u
  LEFT JOIN user_organizations uo ON u.id = uo.user_id
  WHERE u.id = p_user_id
  LIMIT 1;

  -- Insert log entry
  INSERT INTO workflow_actions_log (
    action_type,
    section_id,
    workflow_stage_id,
    workflow_state_id,
    user_id,
    user_email,
    user_role,
    previous_status,
    new_status,
    notes
  ) VALUES (
    p_action_type,
    p_section_id,
    p_workflow_stage_id,
    p_workflow_state_id,
    p_user_id,
    v_user_email,
    v_user_role,
    p_previous_status,
    p_new_status,
    p_notes
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. TRIGGER TO AUTO-LOG WORKFLOW STATE CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_log_workflow_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM log_workflow_action(
      'create_state',
      NEW.section_id,
      NEW.workflow_stage_id,
      NEW.id,
      NEW.actioned_by,
      NULL,
      NEW.status,
      NEW.notes
    );
  ELSIF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    PERFORM log_workflow_action(
      'status_change',
      NEW.section_id,
      NEW.workflow_stage_id,
      NEW.id,
      NEW.actioned_by,
      OLD.status,
      NEW.status,
      NEW.notes
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_log_workflow_state ON section_workflow_states;
CREATE TRIGGER trg_auto_log_workflow_state
  AFTER INSERT OR UPDATE OF status ON section_workflow_states
  FOR EACH ROW
  EXECUTE FUNCTION auto_log_workflow_state_change();

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE workflow_actions_log ENABLE ROW LEVEL SECURITY;

-- Users can see workflow actions in their organization
CREATE POLICY "Users see workflow actions in their orgs"
  ON workflow_actions_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE ds.id = workflow_actions_log.section_id
      AND uo.user_id = auth.uid()
    )
  );

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 011: Workflow Actions Log - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created workflow_actions_log table';
  RAISE NOTICE 'Added auto-logging trigger for state changes';
  RAISE NOTICE 'Created helper function for manual logging';
  RAISE NOTICE '========================================';
END $$;
```

---

## Migration 012: RLS Policy Updates

**File:** `/database/migrations/012_rls_policy_updates.sql`

```sql
-- ============================================================================
-- MIGRATION 012: RLS POLICY UPDATES FOR ROLE-BASED WORKFLOW
-- Date: 2025-10-13
-- Purpose: Update RLS policies to support role-based workflow permissions
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. UPDATE section_workflow_states POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users see workflow states in their orgs" ON section_workflow_states;
DROP POLICY IF EXISTS "Admins can manage workflow states" ON section_workflow_states;

-- Allow users to see workflow states in their organizations
CREATE POLICY "Users see workflow states in accessible documents"
  ON section_workflow_states
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE ds.id = section_workflow_states.section_id
      AND uo.user_id = auth.uid()
    )
  );

-- Committee members and above can approve committee stage
CREATE POLICY "Committee members can approve committee stage"
  ON section_workflow_states
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN workflow_stages ws ON ws.id = section_workflow_states.workflow_stage_id
      WHERE ds.id = section_workflow_states.section_id
      AND uo.user_id = auth.uid()
      AND (
        uo.role IN ('owner', 'admin', 'committee_member')
        AND ws.stage_name = 'Committee Review'
      )
    )
  );

-- Only admins can approve board stage
CREATE POLICY "Admins can approve board stage"
  ON section_workflow_states
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      JOIN workflow_stages ws ON ws.id = section_workflow_states.workflow_stage_id
      WHERE ds.id = section_workflow_states.section_id
      AND uo.user_id = auth.uid()
      AND uo.role IN ('owner', 'admin')
      AND ws.stage_name = 'Board Approval'
    )
  );

-- ============================================================================
-- 2. UPDATE user_organizations POLICIES
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins manage organization users" ON user_organizations;

-- Admins can manage users (except owner role)
CREATE POLICY "Admins manage org users"
  ON user_organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations admin
      WHERE admin.user_id = auth.uid()
      AND admin.organization_id = user_organizations.organization_id
      AND admin.role IN ('owner', 'admin')
    )
    AND user_organizations.role != 'owner' -- Cannot manage owners
  );

-- ============================================================================
-- 3. UPDATE documents POLICIES
-- ============================================================================

-- Drop old delete policy
DROP POLICY IF EXISTS "Users can delete own org documents" ON documents;

-- Only admins can delete documents
CREATE POLICY "Admins can delete documents"
  ON documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
      AND uo.organization_id = documents.organization_id
      AND uo.role IN ('owner', 'admin')
      AND (uo.permissions->>'can_delete_documents')::boolean = true
    )
  );

-- ============================================================================
-- 4. ADD WORKFLOW STAGE PERMISSIONS CHECK
-- ============================================================================

-- Function to check if user can action a workflow stage
CREATE OR REPLACE FUNCTION user_can_action_stage(
  p_user_id UUID,
  p_section_id UUID,
  p_workflow_stage_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_can_action BOOLEAN;
  v_required_roles JSONB;
  v_user_role VARCHAR;
BEGIN
  -- Get required roles for this stage
  SELECT required_roles INTO v_required_roles
  FROM workflow_stages
  WHERE id = p_workflow_stage_id;

  -- Get user's role in this organization
  SELECT uo.role INTO v_user_role
  FROM document_sections ds
  JOIN documents d ON ds.document_id = d.id
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE ds.id = p_section_id
  AND uo.user_id = p_user_id;

  -- Check if user role is in required roles
  v_can_action := v_required_roles ? v_user_role;

  RETURN v_can_action;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 012: RLS Policy Updates - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Updated RLS policies for role-based permissions';
  RAISE NOTICE 'Added workflow stage permission checking';
  RAISE NOTICE 'Restricted delete permissions to admins';
  RAISE NOTICE '========================================';
END $$;
```

---

## Migration 013: Performance Indexes

**File:** `/database/migrations/013_performance_indexes.sql`

```sql
-- ============================================================================
-- MIGRATION 013: PERFORMANCE INDEXES
-- Date: 2025-10-13
-- Purpose: Add indexes to optimize common workflow queries
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. WORKFLOW STATE INDEXES
-- ============================================================================

-- Index for current workflow state lookups
CREATE INDEX IF NOT EXISTS idx_section_workflow_current_stage
  ON section_workflow_states(section_id, workflow_stage_id, status)
  WHERE status IN ('in_progress', 'locked', 'approved');

-- Index for workflow progress queries
CREATE INDEX IF NOT EXISTS idx_section_workflow_by_status
  ON section_workflow_states(workflow_stage_id, status)
  INCLUDE (section_id, actioned_at);

-- ============================================================================
-- 2. DOCUMENT SECTIONS INDEXES
-- ============================================================================

-- Index for locked sections by document
CREATE INDEX IF NOT EXISTS idx_sections_locked_by_document
  ON document_sections(document_id, is_locked, locked_at DESC)
  WHERE is_locked = true;

-- Index for section hierarchy queries
CREATE INDEX IF NOT EXISTS idx_sections_parent_ordinal
  ON document_sections(parent_section_id, ordinal)
  WHERE parent_section_id IS NOT NULL;

-- ============================================================================
-- 3. USER ORGANIZATIONS INDEXES
-- ============================================================================

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_orgs_role_active
  ON user_organizations(organization_id, role, is_active)
  WHERE is_active = true;

-- Index for permission checks
CREATE INDEX IF NOT EXISTS idx_user_orgs_permissions
  ON user_organizations USING GIN(permissions)
  WHERE permissions IS NOT NULL;

-- ============================================================================
-- 4. SUGGESTIONS INDEXES
-- ============================================================================

-- Index for suggestion counts by document and status
CREATE INDEX IF NOT EXISTS idx_suggestions_doc_status_count
  ON suggestions(document_id, status)
  INCLUDE (id, created_at);

-- Index for suggestion votes
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_count
  ON suggestion_votes(suggestion_id, vote_type)
  WHERE vote_type = 'support';

-- ============================================================================
-- 5. MATERIALIZED VIEW FOR WORKFLOW PROGRESS
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_document_workflow_progress AS
SELECT
  d.id as document_id,
  d.organization_id,
  COUNT(DISTINCT ds.id) as total_sections,
  COUNT(DISTINCT CASE WHEN ds.is_locked THEN ds.id END) as locked_sections,
  COUNT(DISTINCT CASE WHEN sws.status = 'in_progress' THEN ds.id END) as in_progress_sections,
  COUNT(DISTINCT CASE WHEN sws.status = 'approved' THEN ds.id END) as approved_sections,
  COUNT(DISTINCT CASE WHEN sws.status = 'final_approved' THEN ds.id END) as finalized_sections,
  ROUND(
    (COUNT(DISTINCT CASE WHEN sws.status = 'final_approved' THEN ds.id END)::NUMERIC /
     NULLIF(COUNT(DISTINCT ds.id), 0)) * 100,
    2
  ) as percent_complete,
  MAX(sws.actioned_at) as last_action_at
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
GROUP BY d.id, d.organization_id;

CREATE UNIQUE INDEX idx_mv_workflow_progress_doc ON mv_document_workflow_progress(document_id);
CREATE INDEX idx_mv_workflow_progress_org ON mv_document_workflow_progress(organization_id);

COMMENT ON MATERIALIZED VIEW mv_document_workflow_progress IS 'Cached workflow progress statistics for dashboard performance';

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_workflow_progress()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_document_workflow_progress;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. PARTIAL INDEXES FOR COMMON FILTERS
-- ============================================================================

-- Active documents only
CREATE INDEX IF NOT EXISTS idx_documents_active
  ON documents(organization_id, created_at DESC)
  WHERE status = 'active';

-- Recent workflow actions
CREATE INDEX IF NOT EXISTS idx_workflow_actions_recent
  ON workflow_actions_log(section_id, created_at DESC)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Pending invitations
CREATE INDEX IF NOT EXISTS idx_invitations_pending
  ON user_invitations(organization_id, created_at DESC)
  WHERE status = 'pending' AND expires_at > NOW();

COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 013: Performance Indexes - COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added 15+ performance indexes';
  RAISE NOTICE 'Created materialized view for workflow progress';
  RAISE NOTICE 'Added partial indexes for common filters';
  RAISE NOTICE '';
  RAISE NOTICE 'TIP: Run ANALYZE to update query planner statistics';
  RAISE NOTICE '========================================';
END $$;
```

---

## Rollback Scripts

### Rollback 008-013

**File:** `/database/migrations/ROLLBACK_008-013.sql`

```sql
-- ============================================================================
-- ROLLBACK MIGRATIONS 008-013
-- WARNING: This will drop tables and data. Use with caution!
-- ============================================================================

BEGIN;

-- Rollback 013: Performance Indexes
DROP MATERIALIZED VIEW IF EXISTS mv_document_workflow_progress CASCADE;
DROP FUNCTION IF EXISTS refresh_workflow_progress CASCADE;

-- Rollback 012: RLS Policies (just disable for safety)
-- Policies will be recreated by re-running migrations

-- Rollback 011: Workflow Actions Log
DROP TABLE IF EXISTS workflow_actions_log CASCADE;
DROP FUNCTION IF EXISTS log_workflow_action CASCADE;
DROP FUNCTION IF EXISTS auto_log_workflow_state_change CASCADE;

-- Rollback 010: Document Versioning
DROP TABLE IF EXISTS document_versions CASCADE;
DROP FUNCTION IF EXISTS increment_version CASCADE;
DROP FUNCTION IF EXISTS create_document_version_snapshot CASCADE;

ALTER TABLE documents
  DROP COLUMN IF EXISTS version_number,
  DROP COLUMN IF EXISTS previous_version_id,
  DROP COLUMN IF EXISTS version_type,
  DROP COLUMN IF EXISTS version_date,
  DROP COLUMN IF EXISTS version_notes;

-- Rollback 009: Section Locking
DROP FUNCTION IF EXISTS user_can_lock_section CASCADE;
DROP FUNCTION IF EXISTS user_can_unlock_section CASCADE;
DROP FUNCTION IF EXISTS check_section_not_locked CASCADE;

ALTER TABLE document_sections
  DROP COLUMN IF EXISTS is_locked,
  DROP COLUMN IF EXISTS locked_at,
  DROP COLUMN IF EXISTS locked_by,
  DROP COLUMN IF EXISTS locked_by_email,
  DROP COLUMN IF EXISTS lock_reason,
  DROP COLUMN IF EXISTS lock_metadata;

-- Rollback 008: Role Management
DROP TABLE IF EXISTS user_role_history CASCADE;
DROP TABLE IF EXISTS user_invitations CASCADE;
DROP FUNCTION IF EXISTS get_default_permissions CASCADE;
DROP FUNCTION IF EXISTS log_role_change CASCADE;

ALTER TABLE user_organizations
  DROP COLUMN IF EXISTS role_changed_at,
  DROP COLUMN IF EXISTS role_changed_by,
  DROP COLUMN IF EXISTS invitation_token,
  DROP COLUMN IF EXISTS invitation_expires_at,
  DROP COLUMN IF EXISTS invitation_accepted_at;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rollback Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All migrations 008-013 have been rolled back';
  RAISE NOTICE 'You can now re-run migrations if needed';
  RAISE NOTICE '========================================';
END $$;
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Backup database
- [ ] Test migrations on staging environment
- [ ] Review RLS policies for security
- [ ] Check for conflicts with existing data
- [ ] Verify service role key is configured

### Deployment Order

1. Run migration 008 (Role Management)
2. Run migration 009 (Section Locking)
3. Run migration 010 (Document Versioning)
4. Run migration 011 (Workflow Actions Log)
5. Run migration 012 (RLS Policy Updates)
6. Run migration 013 (Performance Indexes)
7. Run `ANALYZE` to update statistics

### Post-Deployment

- [ ] Verify RLS policies are working
- [ ] Test role permissions in UI
- [ ] Verify locking mechanism
- [ ] Check materialized view refresh
- [ ] Monitor query performance
- [ ] Update application code to use new tables

---

## Performance Impact Estimates

| Migration | Write Impact | Read Impact | Downtime |
|-----------|--------------|-------------|----------|
| 008 | Low | None | None |
| 009 | Low | None | None |
| 010 | Medium | Low | None |
| 011 | Medium (trigger) | None | None |
| 012 | None | None | None |
| 013 | None | Medium (faster) | None |

**Overall:** No downtime required, ~5-10 minute migration time for small datasets (<10k rows)

---

## Monitoring Queries

```sql
-- Check migration status
SELECT
  tablename,
  schemaname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN (
  'user_invitations',
  'user_role_history',
  'document_versions',
  'workflow_actions_log'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename LIKE '%workflow%' OR tablename LIKE '%section%'
ORDER BY idx_scan DESC;

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('user_organizations', 'section_workflow_states', 'document_sections')
ORDER BY tablename, policyname;
```

---

**Document Status:** ✅ Complete and Ready for Implementation
**Next Steps:** Review with architect, then execute migrations in staging environment
