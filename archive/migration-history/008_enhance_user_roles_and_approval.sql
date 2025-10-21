-- Migration 008: Enhanced User Roles and Approval Workflow System
-- Date: 2025-10-13
-- Purpose: Add organization-level user management and approval workflow enhancements

-- ============================================================================
-- PART 1: ENHANCE USER_ORGANIZATIONS TABLE
-- ============================================================================

-- Add additional role management fields
DO $$
BEGIN
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_organizations' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_organizations ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column';
    END IF;

    -- Add invited_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_organizations' AND column_name = 'invited_at'
    ) THEN
        ALTER TABLE user_organizations ADD COLUMN invited_at TIMESTAMP;
        RAISE NOTICE 'Added invited_at column';
    END IF;

    -- Add invited_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_organizations' AND column_name = 'invited_by'
    ) THEN
        ALTER TABLE user_organizations ADD COLUMN invited_by UUID REFERENCES users(id);
        RAISE NOTICE 'Added invited_by column';
    END IF;

    -- Add last_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_organizations' AND column_name = 'last_active'
    ) THEN
        ALTER TABLE user_organizations ADD COLUMN last_active TIMESTAMP;
        RAISE NOTICE 'Added last_active column';
    END IF;

    -- Add is_global_admin column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_organizations' AND column_name = 'is_global_admin'
    ) THEN
        ALTER TABLE user_organizations ADD COLUMN is_global_admin BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_global_admin column';
    END IF;
END $$;

-- Create index for active users
CREATE INDEX IF NOT EXISTS idx_user_orgs_active
    ON user_organizations(organization_id, is_active)
    WHERE is_active = TRUE;

-- Create index for global admins
CREATE INDEX IF NOT EXISTS idx_user_orgs_global_admin
    ON user_organizations(user_id, is_global_admin)
    WHERE is_global_admin = TRUE;

COMMENT ON COLUMN user_organizations.is_active IS 'Whether the user membership is active';
COMMENT ON COLUMN user_organizations.invited_at IS 'When the user was invited to the organization';
COMMENT ON COLUMN user_organizations.invited_by IS 'User ID of who sent the invitation';
COMMENT ON COLUMN user_organizations.last_active IS 'Last time user performed an action in this organization';
COMMENT ON COLUMN user_organizations.is_global_admin IS 'Whether user is a platform-wide administrator';

-- ============================================================================
-- PART 2: APPROVAL WORKFLOW ENHANCEMENTS
-- ============================================================================

-- Add approval metadata to section_workflow_states if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'section_workflow_states' AND column_name = 'approval_metadata'
    ) THEN
        ALTER TABLE section_workflow_states ADD COLUMN approval_metadata JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added approval_metadata column';
    END IF;
END $$;

COMMENT ON COLUMN section_workflow_states.approval_metadata IS 'JSON metadata about the approval (reviewer comments, timestamps, etc.)';

-- ============================================================================
-- PART 3: DOCUMENT VERSIONING FOR APPROVAL WORKFLOW
-- ============================================================================

-- Create document versions table for tracking approved versions
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    -- Version information
    version_number VARCHAR(50) NOT NULL,
    version_name VARCHAR(255),
    description TEXT,

    -- Snapshot of document state
    sections_snapshot JSONB NOT NULL, -- Complete snapshot of all sections
    approval_snapshot JSONB, -- Snapshot of approval states

    -- Version metadata
    created_by UUID REFERENCES users(id),
    created_by_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Approval information
    approved_at TIMESTAMP,
    approved_by UUID REFERENCES users(id),
    approval_stage VARCHAR(100), -- Which workflow stage approved this version

    -- Status
    is_current BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    UNIQUE(document_id, version_number)
);

CREATE INDEX idx_doc_versions_doc ON document_versions(document_id);
CREATE INDEX idx_doc_versions_current ON document_versions(document_id, is_current) WHERE is_current = TRUE;
CREATE INDEX idx_doc_versions_published ON document_versions(document_id, is_published) WHERE is_published = TRUE;
CREATE INDEX idx_doc_versions_created ON document_versions(created_at);

COMMENT ON TABLE document_versions IS 'Version history for documents, capturing state at each approval milestone';
COMMENT ON COLUMN document_versions.sections_snapshot IS 'Complete JSON snapshot of all sections at this version';
COMMENT ON COLUMN document_versions.approval_snapshot IS 'Approval workflow states at time of version creation';

-- ============================================================================
-- PART 4: USER ACTIVITY AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Activity details
    action_type VARCHAR(100) NOT NULL, -- 'user.invited', 'user.role_changed', 'section.approved', etc.
    entity_type VARCHAR(50), -- 'user', 'document', 'section', 'suggestion'
    entity_id UUID,

    -- Action metadata
    action_data JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON user_activity_log(user_id);
CREATE INDEX idx_activity_org ON user_activity_log(organization_id);
CREATE INDEX idx_activity_type ON user_activity_log(action_type);
CREATE INDEX idx_activity_created ON user_activity_log(created_at);
CREATE INDEX idx_activity_entity ON user_activity_log(entity_type, entity_id);

COMMENT ON TABLE user_activity_log IS 'Audit trail of user actions within organizations';

-- ============================================================================
-- PART 5: ROLE-BASED ACCESS CONTROL HELPER FUNCTIONS
-- ============================================================================
-- These functions use SECURITY DEFINER to bypass RLS for permission checks.
-- This is safe because:
--   1. All parameters are properly typed (UUID, VARCHAR)
--   2. Queries use parameterized WHERE clauses (no SQL injection risk)
--   3. Functions only read data, never modify
--   4. Return values are booleans or simple types (no sensitive data exposure)
--   5. search_path is explicitly set to 'public' to prevent schema injection
-- ============================================================================

-- Function to check if user has specific role in organization
-- SECURITY ANALYSIS:
--   - SECURITY DEFINER: Required to bypass RLS and check permissions
--   - SQL Injection: Protected by typed parameters and parameterized query
--   - Data Exposure: Returns only boolean, no sensitive data
--   - Schema Injection: Prevented by SET search_path = public
--   - Privilege Escalation: Not possible - only reads user_organizations table
CREATE OR REPLACE FUNCTION user_has_role(
    p_user_id UUID,
    p_organization_id UUID,
    p_required_role VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
    role_hierarchy JSONB := '{"owner": 4, "admin": 3, "member": 2, "viewer": 1}'::jsonb;
BEGIN
    -- Get user's role in organization
    -- SECURITY: Parameterized query prevents SQL injection
    SELECT role INTO user_role
    FROM user_organizations
    WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if user's role level >= required role level
    -- SECURITY: JSONB operations are safe, no code execution
    RETURN (role_hierarchy->>user_role)::int >= (role_hierarchy->>p_required_role)::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;  -- SECURITY: Prevent schema injection attacks

COMMENT ON FUNCTION user_has_role IS 'Check if user has sufficient role level in organization. Uses SECURITY DEFINER to bypass RLS for permission checking. Safe because: parameters are typed, query is parameterized, only reads data, returns boolean only.';

-- Function to check if user can approve at specific workflow stage
-- SECURITY ANALYSIS:
--   - SECURITY DEFINER: Required to check permissions across organizations
--   - SQL Injection: Protected by UUID type enforcement
--   - Data Exposure: Returns boolean only
--   - Authorization: Checks both role-based permissions
--   - Schema Protection: search_path restricted to public
CREATE OR REPLACE FUNCTION user_can_approve_stage(
    p_user_id UUID,
    p_workflow_stage_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
    required_roles JSONB;
    org_id UUID;
BEGIN
    -- Get required roles for this stage and organization
    -- SECURITY: Parameterized query with proper JOINs
    SELECT ws.required_roles, wt.organization_id
    INTO required_roles, org_id
    FROM workflow_stages ws
    JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
    WHERE ws.id = p_workflow_stage_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Get user's role in organization
    -- SECURITY: Parameterized query with typed parameters
    SELECT role INTO user_role
    FROM user_organizations
    WHERE user_id = p_user_id
    AND organization_id = org_id
    AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if user's role is in required roles
    -- SECURITY: JSONB containment operator is safe
    RETURN required_roles ? user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;  -- SECURITY: Prevent schema injection

COMMENT ON FUNCTION user_can_approve_stage IS 'Check if user has permission to approve at specific workflow stage. Uses SECURITY DEFINER to check cross-organizational permissions. Safe because: all parameters typed as UUID, queries are parameterized, returns boolean only.';

-- ============================================================================
-- PART 6: UPDATE RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- document_versions: Users can see versions of documents they have access to
CREATE POLICY "Users see versions of accessible documents"
    ON document_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM documents d
            JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE d.id = document_versions.document_id
            AND uo.user_id = auth.uid()
        )
    );

-- user_activity_log: Users can see activity in their organizations
CREATE POLICY "Users see activity in their organizations"
    ON user_activity_log
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM user_organizations
            WHERE user_id = auth.uid()
        )
    );

-- user_activity_log: Users can insert their own activity
CREATE POLICY "Users can log their own activity"
    ON user_activity_log
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- PART 7: CREATE DEFAULT WORKFLOW TEMPLATE FOR EXISTING ORGANIZATIONS
-- ============================================================================

-- Create default 2-stage workflow for organizations that don't have one
DO $$
DECLARE
    org_record RECORD;
    template_id UUID;
    stage1_id UUID;
    stage2_id UUID;
BEGIN
    FOR org_record IN SELECT id, name FROM organizations
    LOOP
        -- Check if organization already has a workflow template
        IF NOT EXISTS (
            SELECT 1 FROM workflow_templates WHERE organization_id = org_record.id
        ) THEN
            -- Create default workflow template
            INSERT INTO workflow_templates (
                organization_id, name, description, is_default, is_active
            ) VALUES (
                org_record.id,
                'Standard Approval Process',
                'Two-stage approval: Committee Review → Board Approval',
                TRUE,
                TRUE
            ) RETURNING id INTO template_id;

            -- Create Stage 1: Committee Review
            INSERT INTO workflow_stages (
                workflow_template_id, stage_name, stage_order,
                can_lock, can_edit, can_approve, requires_approval,
                required_roles, display_color, icon, description
            ) VALUES (
                template_id,
                'Committee Review',
                1,
                TRUE, FALSE, TRUE, TRUE,
                '["admin", "owner"]'::jsonb,
                '#FFA500',
                'users',
                'Committee reviews and selects preferred suggestions'
            ) RETURNING id INTO stage1_id;

            -- Create Stage 2: Board Approval
            INSERT INTO workflow_stages (
                workflow_template_id, stage_name, stage_order,
                can_lock, can_edit, can_approve, requires_approval,
                required_roles, display_color, icon, description
            ) VALUES (
                template_id,
                'Board Approval',
                2,
                TRUE, FALSE, TRUE, TRUE,
                '["owner"]'::jsonb,
                '#28A745',
                'check-circle',
                'Final board approval for amendments'
            ) RETURNING id INTO stage2_id;

            RAISE NOTICE 'Created default workflow for organization: %', org_record.name;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- PART 8: MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 008 Completed Successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Enhancements:';
    RAISE NOTICE '✅ Enhanced user_organizations with role management fields';
    RAISE NOTICE '✅ Added document versioning system';
    RAISE NOTICE '✅ Created user activity audit log';
    RAISE NOTICE '✅ Added role-based access control functions';
    RAISE NOTICE '✅ Created default workflows for existing organizations';
    RAISE NOTICE '✅ Updated RLS policies for new tables';
    RAISE NOTICE '========================================';
END $$;
