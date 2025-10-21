-- Migration 012: Workflow System Enhancements
-- Date: 2025-10-14
-- Purpose: Add helper functions, performance indexes, and audit logging for workflow system
-- Depends on: Migration 008 (workflow schema must exist)

-- ============================================================================
-- PART 1: ENHANCED HELPER FUNCTIONS FOR WORKFLOW OPERATIONS
-- ============================================================================

-- Check if user is a global admin
CREATE OR REPLACE FUNCTION is_global_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_organizations
        WHERE user_id = p_user_id
        AND is_global_admin = TRUE
        AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_global_admin IS 'Check if user has global admin privileges';

-- Enhanced version of user_can_approve_stage that includes global admin check
CREATE OR REPLACE FUNCTION user_can_approve_stage(
    p_user_id UUID,
    p_stage_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_required_roles JSONB;
    v_user_role TEXT;
    v_org_id UUID;
BEGIN
    -- Global admins can approve anything
    IF is_global_admin(p_user_id) THEN
        RETURN TRUE;
    END IF;

    -- Get required roles for this stage
    SELECT ws.required_roles, wt.organization_id
    INTO v_required_roles, v_org_id
    FROM workflow_stages ws
    JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
    WHERE ws.id = p_stage_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Get user's role in this organization
    SELECT role INTO v_user_role
    FROM user_organizations
    WHERE user_id = p_user_id
        AND organization_id = v_org_id
        AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if user's role is in required roles
    RETURN v_required_roles ? v_user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_can_approve_stage IS 'Check if user has permission to approve at specific workflow stage (includes global admin check)';

-- Get current workflow stage for a section
CREATE OR REPLACE FUNCTION get_section_workflow_stage(
    p_section_id UUID
) RETURNS TABLE (
    stage_id UUID,
    stage_name TEXT,
    stage_order INT,
    can_lock BOOLEAN,
    can_approve BOOLEAN,
    status TEXT,
    actioned_by UUID,
    actioned_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.id,
        ws.stage_name,
        ws.stage_order,
        ws.can_lock,
        ws.can_approve,
        sws.status,
        sws.actioned_by,
        sws.actioned_at
    FROM section_workflow_states sws
    JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
    WHERE sws.section_id = p_section_id
    ORDER BY sws.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_section_workflow_stage IS 'Get the current workflow stage and state for a section';

-- Calculate document workflow progress
CREATE OR REPLACE FUNCTION calculate_document_progress(
    p_document_id UUID
) RETURNS TABLE (
    total_sections INT,
    approved_sections INT,
    pending_sections INT,
    rejected_sections INT,
    progress_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(ds.id)::INT AS total_sections,
        COUNT(CASE WHEN sws.status = 'approved' THEN 1 END)::INT AS approved_sections,
        COUNT(CASE WHEN sws.status = 'pending' THEN 1 END)::INT AS pending_sections,
        COUNT(CASE WHEN sws.status = 'rejected' THEN 1 END)::INT AS rejected_sections,
        CASE
            WHEN COUNT(ds.id) > 0 THEN
                (COUNT(CASE WHEN sws.status = 'approved' THEN 1 END)::DECIMAL / COUNT(ds.id)::DECIMAL * 100)
            ELSE 0
        END AS progress_percentage
    FROM document_sections ds
    LEFT JOIN (
        -- Get most recent workflow state for each section
        SELECT DISTINCT ON (section_id) *
        FROM section_workflow_states
        ORDER BY section_id, created_at DESC
    ) sws ON ds.id = sws.section_id
    WHERE ds.document_id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_document_progress IS 'Calculate workflow progress statistics for a document';

-- Advance section to next workflow stage
CREATE OR REPLACE FUNCTION advance_section_to_next_stage(
    p_section_id UUID,
    p_approved_by UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_current_stage_id UUID;
    v_current_stage_order INT;
    v_next_stage_id UUID;
    v_workflow_template_id UUID;
    v_new_state_id UUID;
BEGIN
    -- Get current stage
    SELECT sws.workflow_stage_id, ws.stage_order, ws.workflow_template_id
    INTO v_current_stage_id, v_current_stage_order, v_workflow_template_id
    FROM section_workflow_states sws
    JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
    WHERE sws.section_id = p_section_id
    ORDER BY sws.created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No workflow state found for section %', p_section_id;
    END IF;

    -- Get next stage
    SELECT id INTO v_next_stage_id
    FROM workflow_stages
    WHERE workflow_template_id = v_workflow_template_id
        AND stage_order > v_current_stage_order
    ORDER BY stage_order ASC
    LIMIT 1;

    -- If no next stage, mark current stage as completed
    IF v_next_stage_id IS NULL THEN
        UPDATE section_workflow_states
        SET status = 'completed',
            updated_at = NOW()
        WHERE section_id = p_section_id
            AND workflow_stage_id = v_current_stage_id;
        RETURN NULL;
    END IF;

    -- Mark current stage as approved
    UPDATE section_workflow_states
    SET status = 'approved',
        actioned_by = p_approved_by,
        actioned_at = NOW(),
        approval_metadata = approval_metadata || jsonb_build_object('notes', p_notes),
        updated_at = NOW()
    WHERE section_id = p_section_id
        AND workflow_stage_id = v_current_stage_id;

    -- Create new workflow state for next stage
    INSERT INTO section_workflow_states (
        section_id,
        workflow_stage_id,
        status,
        approval_metadata
    ) VALUES (
        p_section_id,
        v_next_stage_id,
        'pending',
        jsonb_build_object(
            'advanced_from_stage', v_current_stage_id,
            'advanced_by', p_approved_by,
            'advanced_at', NOW()
        )
    ) RETURNING id INTO v_new_state_id;

    RETURN v_new_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION advance_section_to_next_stage IS 'Advance a section to the next workflow stage, returning new state ID or NULL if completed';

-- Get pending approvals for a user
CREATE OR REPLACE FUNCTION get_user_pending_approvals(
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL
) RETURNS TABLE (
    section_id UUID,
    section_number TEXT,
    section_title TEXT,
    document_id UUID,
    document_title TEXT,
    stage_name TEXT,
    stage_order INT,
    pending_since TIMESTAMPTZ,
    organization_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ds.id AS section_id,
        ds.section_number,
        ds.section_title,
        d.id AS document_id,
        d.title AS document_title,
        ws.stage_name,
        ws.stage_order,
        sws.created_at AS pending_since,
        d.organization_id
    FROM section_workflow_states sws
    JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
    JOIN document_sections ds ON sws.section_id = ds.id
    JOIN documents d ON ds.document_id = d.id
    WHERE sws.status = 'pending'
        AND user_can_approve_stage(p_user_id, ws.id)
        AND (p_organization_id IS NULL OR d.organization_id = p_organization_id)
    ORDER BY sws.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_pending_approvals IS 'Get all sections pending approval that the user has permission to approve';

-- Get workflow history for a section
CREATE OR REPLACE FUNCTION get_section_workflow_history(
    p_section_id UUID
) RETURNS TABLE (
    stage_name TEXT,
    stage_order INT,
    status TEXT,
    actioned_by_email TEXT,
    actioned_by_name TEXT,
    actioned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.stage_name,
        ws.stage_order,
        sws.status,
        u.email AS actioned_by_email,
        COALESCE(u.full_name, u.email) AS actioned_by_name,
        sws.actioned_at,
        sws.approval_metadata->>'notes' AS notes,
        sws.created_at
    FROM section_workflow_states sws
    JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
    LEFT JOIN users u ON sws.actioned_by = u.id
    WHERE sws.section_id = p_section_id
    ORDER BY sws.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_section_workflow_history IS 'Get complete workflow history for a section including all stages and approvals';

-- ============================================================================
-- PART 2: PERFORMANCE INDEXES
-- ============================================================================

-- Speed up workflow state queries
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_section_id
    ON section_workflow_states(section_id);

CREATE INDEX IF NOT EXISTS idx_section_workflow_states_stage_id
    ON section_workflow_states(workflow_stage_id);

CREATE INDEX IF NOT EXISTS idx_section_workflow_states_status
    ON section_workflow_states(status);

CREATE INDEX IF NOT EXISTS idx_section_workflow_states_created
    ON section_workflow_states(created_at DESC);

-- Composite index for finding most recent state per section
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_section_created
    ON section_workflow_states(section_id, created_at DESC);

-- Index for finding pending approvals for a user
CREATE INDEX IF NOT EXISTS idx_pending_approvals_lookup
    ON section_workflow_states(workflow_stage_id, status)
    WHERE status = 'pending';

-- Speed up workflow stage queries
CREATE INDEX IF NOT EXISTS idx_workflow_stages_template_order
    ON workflow_stages(workflow_template_id, stage_order);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_template_id
    ON workflow_stages(workflow_template_id);

-- Speed up document workflow queries
CREATE INDEX IF NOT EXISTS idx_document_workflows_document_id
    ON document_workflows(document_id);

CREATE INDEX IF NOT EXISTS idx_document_workflows_template_id
    ON document_workflows(workflow_template_id);

CREATE INDEX IF NOT EXISTS idx_document_workflows_status
    ON document_workflows(status);

-- Speed up workflow template queries
CREATE INDEX IF NOT EXISTS idx_workflow_templates_org_default
    ON workflow_templates(organization_id, is_default)
    WHERE is_default = TRUE AND is_active = TRUE;

-- Speed up document sections queries for workflow
CREATE INDEX IF NOT EXISTS idx_document_sections_document_id
    ON document_sections(document_id);

-- ============================================================================
-- PART 3: WORKFLOW AUDIT LOG
-- ============================================================================

-- Create workflow-specific audit log table
CREATE TABLE IF NOT EXISTS workflow_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Action details
    action TEXT NOT NULL, -- 'approve', 'reject', 'lock', 'advance', 'reset'
    previous_status TEXT,
    new_status TEXT,
    stage_id UUID REFERENCES workflow_stages(id) ON DELETE SET NULL,
    stage_name TEXT,

    -- Additional context
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Request metadata
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_workflow_audit_section
    ON workflow_audit_log(section_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_document
    ON workflow_audit_log(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_user
    ON workflow_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_org
    ON workflow_audit_log(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_action
    ON workflow_audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_created
    ON workflow_audit_log(created_at DESC);

COMMENT ON TABLE workflow_audit_log IS 'Audit trail of all workflow actions for compliance and tracking';
COMMENT ON COLUMN workflow_audit_log.action IS 'Type of workflow action performed';
COMMENT ON COLUMN workflow_audit_log.metadata IS 'Additional context about the action (JSON)';

-- Trigger to automatically log workflow state changes
CREATE OR REPLACE FUNCTION log_workflow_action()
RETURNS TRIGGER AS $$
DECLARE
    v_document_id UUID;
    v_organization_id UUID;
    v_stage_name TEXT;
BEGIN
    -- Get document and organization IDs
    SELECT ds.document_id, d.organization_id
    INTO v_document_id, v_organization_id
    FROM document_sections ds
    JOIN documents d ON ds.document_id = d.id
    WHERE ds.id = NEW.section_id;

    -- Get stage name
    SELECT stage_name INTO v_stage_name
    FROM workflow_stages
    WHERE id = NEW.workflow_stage_id;

    -- Determine action type
    INSERT INTO workflow_audit_log (
        section_id,
        document_id,
        organization_id,
        user_id,
        action,
        previous_status,
        new_status,
        stage_id,
        stage_name,
        notes,
        metadata
    ) VALUES (
        NEW.section_id,
        v_document_id,
        v_organization_id,
        NEW.actioned_by,
        CASE
            WHEN NEW.status = 'approved' AND (OLD IS NULL OR OLD.status = 'pending') THEN 'approve'
            WHEN NEW.status = 'rejected' THEN 'reject'
            WHEN NEW.status = 'completed' THEN 'complete'
            WHEN OLD IS NULL THEN 'initialize'
            ELSE 'update'
        END,
        CASE WHEN OLD IS NOT NULL THEN OLD.status ELSE NULL END,
        NEW.status,
        NEW.workflow_stage_id,
        v_stage_name,
        NEW.approval_metadata->>'notes',
        NEW.approval_metadata
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on section_workflow_states
DROP TRIGGER IF EXISTS workflow_action_audit_trigger ON section_workflow_states;
CREATE TRIGGER workflow_action_audit_trigger
    AFTER INSERT OR UPDATE ON section_workflow_states
    FOR EACH ROW
    EXECUTE FUNCTION log_workflow_action();

COMMENT ON FUNCTION log_workflow_action IS 'Automatically log all workflow state changes to audit log';

-- ============================================================================
-- PART 4: MATERIALIZED VIEW FOR PERFORMANCE
-- ============================================================================

-- Materialized view for fast workflow progress lookups
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_document_workflow_progress AS
SELECT
    d.id AS document_id,
    d.organization_id,
    d.title AS document_title,
    COUNT(ds.id) AS total_sections,
    COUNT(CASE WHEN latest_sws.status = 'approved' THEN 1 END) AS approved_sections,
    COUNT(CASE WHEN latest_sws.status = 'pending' THEN 1 END) AS pending_sections,
    COUNT(CASE WHEN latest_sws.status = 'rejected' THEN 1 END) AS rejected_sections,
    COUNT(CASE WHEN latest_sws.status = 'completed' THEN 1 END) AS completed_sections,
    CASE
        WHEN COUNT(ds.id) > 0 THEN
            (COUNT(CASE WHEN latest_sws.status = 'approved' OR latest_sws.status = 'completed' THEN 1 END)::DECIMAL / COUNT(ds.id)::DECIMAL * 100)
        ELSE 0
    END AS progress_percentage,
    MAX(latest_sws.updated_at) AS last_updated,
    dw.workflow_template_id,
    wt.name AS workflow_name,
    dw.current_stage_id,
    ws.stage_name AS current_stage_name
FROM documents d
LEFT JOIN document_workflows dw ON d.id = dw.document_id
LEFT JOIN workflow_templates wt ON dw.workflow_template_id = wt.id
LEFT JOIN workflow_stages ws ON dw.current_stage_id = ws.id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN LATERAL (
    -- Get most recent workflow state for each section
    SELECT *
    FROM section_workflow_states sws
    WHERE sws.section_id = ds.id
    ORDER BY sws.created_at DESC
    LIMIT 1
) latest_sws ON TRUE
GROUP BY d.id, d.organization_id, d.title, dw.workflow_template_id, wt.name, dw.current_stage_id, ws.stage_name;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_workflow_progress_document
    ON mv_document_workflow_progress(document_id);

CREATE INDEX IF NOT EXISTS idx_mv_workflow_progress_org
    ON mv_document_workflow_progress(organization_id);

CREATE INDEX IF NOT EXISTS idx_mv_workflow_progress_percentage
    ON mv_document_workflow_progress(progress_percentage);

COMMENT ON MATERIALIZED VIEW mv_document_workflow_progress IS 'Cached workflow progress statistics for fast dashboard queries';

-- Function to refresh workflow progress view
CREATE OR REPLACE FUNCTION refresh_workflow_progress()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_document_workflow_progress;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_workflow_progress IS 'Refresh the workflow progress materialized view (call after workflow changes)';

-- ============================================================================
-- PART 5: RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS on workflow_audit_log
ALTER TABLE workflow_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs for their organizations
CREATE POLICY "Users see audit logs in their organizations"
    ON workflow_audit_log
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM user_organizations
            WHERE user_id = auth.uid()
            AND is_active = TRUE
        )
    );

-- Service role can insert audit logs
CREATE POLICY "Service can insert audit logs"
    ON workflow_audit_log
    FOR INSERT
    WITH CHECK (TRUE);

-- ============================================================================
-- PART 6: HELPER VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for pending approvals with all context
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT
    sws.id AS workflow_state_id,
    ds.id AS section_id,
    ds.section_number,
    ds.section_title,
    d.id AS document_id,
    d.title AS document_title,
    d.organization_id,
    ws.id AS stage_id,
    ws.stage_name,
    ws.stage_order,
    ws.required_roles,
    sws.status,
    sws.created_at AS pending_since,
    sws.updated_at AS last_updated
FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
JOIN document_sections ds ON sws.section_id = ds.id
JOIN documents d ON ds.document_id = d.id
WHERE sws.status = 'pending';

COMMENT ON VIEW v_pending_approvals IS 'All pending approvals across all organizations with full context';

-- View for workflow statistics per organization
CREATE OR REPLACE VIEW v_organization_workflow_stats AS
SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    COUNT(DISTINCT d.id) AS total_documents,
    COUNT(DISTINCT ds.id) AS total_sections,
    COUNT(CASE WHEN sws.status = 'pending' THEN 1 END) AS pending_approvals,
    COUNT(CASE WHEN sws.status = 'approved' THEN 1 END) AS approved_sections,
    COUNT(CASE WHEN sws.status = 'rejected' THEN 1 END) AS rejected_sections,
    COUNT(CASE WHEN sws.status = 'completed' THEN 1 END) AS completed_sections,
    CASE
        WHEN COUNT(DISTINCT ds.id) > 0 THEN
            ROUND(
                (COUNT(CASE WHEN sws.status = 'approved' OR sws.status = 'completed' THEN 1 END)::DECIMAL
                 / COUNT(DISTINCT ds.id)::DECIMAL * 100),
                2
            )
        ELSE 0
    END AS avg_progress_percentage
FROM organizations o
LEFT JOIN documents d ON o.id = d.organization_id
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN (
    SELECT DISTINCT ON (section_id) *
    FROM section_workflow_states
    ORDER BY section_id, created_at DESC
) sws ON ds.id = sws.section_id
GROUP BY o.id, o.name;

COMMENT ON VIEW v_organization_workflow_stats IS 'Workflow statistics aggregated by organization';

-- ============================================================================
-- PART 7: UTILITY FUNCTIONS
-- ============================================================================

-- Bulk approve all sections in a document at current stage
CREATE OR REPLACE FUNCTION bulk_approve_document_sections(
    p_document_id UUID,
    p_approved_by UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    WITH updated AS (
        UPDATE section_workflow_states sws
        SET
            status = 'approved',
            actioned_by = p_approved_by,
            actioned_at = NOW(),
            approval_metadata = approval_metadata || jsonb_build_object('notes', p_notes, 'bulk_approved', true),
            updated_at = NOW()
        FROM document_sections ds
        WHERE sws.section_id = ds.id
            AND ds.document_id = p_document_id
            AND sws.status = 'pending'
            AND user_can_approve_stage(p_approved_by, sws.workflow_stage_id)
        RETURNING sws.id
    )
    SELECT COUNT(*) INTO v_count FROM updated;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION bulk_approve_document_sections IS 'Approve all pending sections in a document that the user has permission to approve';

-- Reset workflow for a section (for testing or reprocessing)
CREATE OR REPLACE FUNCTION reset_section_workflow(
    p_section_id UUID,
    p_reset_by UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_document_id UUID;
    v_workflow_template_id UUID;
    v_first_stage_id UUID;
    v_new_state_id UUID;
BEGIN
    -- Get document and workflow info
    SELECT ds.document_id, dw.workflow_template_id
    INTO v_document_id, v_workflow_template_id
    FROM document_sections ds
    JOIN document_workflows dw ON ds.document_id = dw.document_id
    WHERE ds.id = p_section_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section or workflow not found for section %', p_section_id;
    END IF;

    -- Get first stage
    SELECT id INTO v_first_stage_id
    FROM workflow_stages
    WHERE workflow_template_id = v_workflow_template_id
    ORDER BY stage_order ASC
    LIMIT 1;

    -- Log the reset in audit log
    INSERT INTO workflow_audit_log (
        section_id,
        document_id,
        user_id,
        action,
        notes,
        metadata
    )
    SELECT
        p_section_id,
        v_document_id,
        p_reset_by,
        'reset',
        p_reason,
        jsonb_build_object('reset_at', NOW(), 'reset_by', p_reset_by)
    FROM document_sections ds
    JOIN documents d ON ds.document_id = d.id
    WHERE ds.id = p_section_id;

    -- Delete existing workflow states for this section
    DELETE FROM section_workflow_states WHERE section_id = p_section_id;

    -- Create new initial state
    INSERT INTO section_workflow_states (
        section_id,
        workflow_stage_id,
        status,
        approval_metadata
    ) VALUES (
        p_section_id,
        v_first_stage_id,
        'pending',
        jsonb_build_object('reset_at', NOW(), 'reset_by', p_reset_by, 'reason', p_reason)
    ) RETURNING id INTO v_new_state_id;

    RETURN v_new_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION reset_section_workflow IS 'Reset workflow state for a section back to first stage (for testing or reprocessing)';

-- ============================================================================
-- PART 8: ATOMIC SECTION LOCKING (RACE CONDITION FIX)
-- ============================================================================

-- Atomic section locking function to prevent race conditions
CREATE OR REPLACE FUNCTION lock_section_atomic(
  p_section_id UUID,
  p_stage_id UUID,
  p_user_id UUID,
  p_suggestion_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  existing_lock RECORD;
  v_new_state_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get user email for logging
  SELECT email INTO v_user_email FROM users WHERE id = p_user_id;

  -- Check for existing lock in same transaction (with row lock)
  SELECT * INTO existing_lock
  FROM section_workflow_states
  WHERE section_id = p_section_id
    AND workflow_stage_id = p_stage_id
    AND status = 'locked'
  FOR UPDATE NOWAIT;  -- Fail immediately if locked by another transaction

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Section is already locked at this stage',
      'code', 'SECTION_LOCKED'
    );
  END IF;

  -- Insert lock atomically using upsert
  INSERT INTO section_workflow_states (
    section_id,
    workflow_stage_id,
    status,
    actioned_by,
    actioned_by_email,
    actioned_at,
    approval_metadata
  ) VALUES (
    p_section_id,
    p_stage_id,
    'locked',
    p_user_id,
    v_user_email,
    NOW(),
    jsonb_build_object(
      'notes', p_notes,
      'suggestion_id', p_suggestion_id,
      'locked_at', NOW()
    )
  )
  ON CONFLICT (section_id, workflow_stage_id) DO UPDATE
  SET
    status = CASE
      WHEN section_workflow_states.status = 'locked' THEN section_workflow_states.status
      ELSE 'locked'
    END,
    actioned_by = CASE
      WHEN section_workflow_states.status = 'locked' THEN section_workflow_states.actioned_by
      ELSE p_user_id
    END,
    actioned_by_email = CASE
      WHEN section_workflow_states.status = 'locked' THEN section_workflow_states.actioned_by_email
      ELSE v_user_email
    END,
    actioned_at = CASE
      WHEN section_workflow_states.status = 'locked' THEN section_workflow_states.actioned_at
      ELSE NOW()
    END,
    approval_metadata = CASE
      WHEN section_workflow_states.status = 'locked' THEN section_workflow_states.approval_metadata
      ELSE jsonb_build_object(
        'notes', p_notes,
        'suggestion_id', p_suggestion_id,
        'locked_at', NOW()
      )
    END,
    updated_at = NOW()
  WHERE section_workflow_states.status != 'locked'
  RETURNING id INTO v_new_state_id;

  -- Check if insert/update succeeded and wasn't already locked
  IF v_new_state_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Section is already locked at this stage',
      'code', 'SECTION_LOCKED'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'state_id', v_new_state_id
  );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Section is being locked by another user. Please try again.',
      'code', 'LOCK_CONTENTION'
    );
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Section is already locked at this stage',
      'code', 'SECTION_LOCKED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION lock_section_atomic IS 'Atomically lock a section at a workflow stage. Uses row-level locking to prevent race conditions.';

-- ============================================================================
-- PART 9: MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 012 Completed Successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Enhancements:';
    RAISE NOTICE '✅ Added 10 workflow helper functions';
    RAISE NOTICE '✅ Created 15 performance indexes';
    RAISE NOTICE '✅ Implemented workflow audit logging';
    RAISE NOTICE '✅ Created materialized view for progress tracking';
    RAISE NOTICE '✅ Added utility views for common queries';
    RAISE NOTICE '✅ Implemented bulk operations functions';
    RAISE NOTICE '✅ Added RLS policies for audit log';
    RAISE NOTICE '✅ Fixed race condition in section locking';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New Functions:';
    RAISE NOTICE '  - is_global_admin(user_id)';
    RAISE NOTICE '  - user_can_approve_stage(user_id, stage_id)';
    RAISE NOTICE '  - get_section_workflow_stage(section_id)';
    RAISE NOTICE '  - calculate_document_progress(document_id)';
    RAISE NOTICE '  - advance_section_to_next_stage(section_id, user_id, notes)';
    RAISE NOTICE '  - get_user_pending_approvals(user_id, org_id)';
    RAISE NOTICE '  - get_section_workflow_history(section_id)';
    RAISE NOTICE '  - bulk_approve_document_sections(document_id, user_id, notes)';
    RAISE NOTICE '  - reset_section_workflow(section_id, user_id, reason)';
    RAISE NOTICE '  - refresh_workflow_progress()';
    RAISE NOTICE '  - lock_section_atomic(section_id, stage_id, user_id, suggestion_id, notes) 🔒';
    RAISE NOTICE '========================================';
END $$;
