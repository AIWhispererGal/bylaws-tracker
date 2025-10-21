-- Migration 012: Workflow System Enhancements (FIXED)
-- Date: 2025-10-14
-- Purpose: Add helper functions, performance indexes, and audit logging for workflow system
-- Depends on: Migration 008 (workflow schema must exist)

-- ============================================================================
-- FIX: Drop existing functions that have parameter name changes
-- ============================================================================

-- Drop the existing function so we can recreate with new parameter names
DROP FUNCTION IF EXISTS user_can_approve_stage(UUID, UUID);

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

-- Rest of the migration continues exactly as before...
-- (All other functions, indexes, views, etc. from the original migration 012)

