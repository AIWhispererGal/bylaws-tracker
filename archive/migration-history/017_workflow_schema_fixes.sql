-- Migration 017: Workflow Schema Fixes
-- Date: 2025-10-15
-- Purpose: Fix schema inconsistencies and add missing RLS policies
-- Depends on: Migration 012 (workflow enhancements must exist)

-- ============================================================================
-- PART 1: FIX MISSING COLUMNS
-- ============================================================================

-- Ensure document_workflows has required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'document_workflows'
                 AND column_name = 'status') THEN
    ALTER TABLE document_workflows ADD COLUMN status VARCHAR(50) DEFAULT 'active';
    RAISE NOTICE '✅ Added status column to document_workflows';
  ELSE
    RAISE NOTICE '✅ Status column already exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'document_workflows'
                 AND column_name = 'current_stage_id') THEN
    ALTER TABLE document_workflows
      ADD COLUMN current_stage_id UUID REFERENCES workflow_stages(id);
    RAISE NOTICE '✅ Added current_stage_id column to document_workflows';
  ELSE
    RAISE NOTICE '✅ current_stage_id column already exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'document_workflows'
                 AND column_name = 'created_at') THEN
    ALTER TABLE document_workflows ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    RAISE NOTICE '✅ Added created_at column to document_workflows';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'document_workflows'
                 AND column_name = 'updated_at') THEN
    ALTER TABLE document_workflows ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    RAISE NOTICE '✅ Added updated_at column to document_workflows';
  END IF;
END $$;

-- Ensure section_workflow_states has approval_metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'section_workflow_states'
                 AND column_name = 'approval_metadata') THEN
    ALTER TABLE section_workflow_states
      ADD COLUMN approval_metadata JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE '✅ Added approval_metadata column to section_workflow_states';
  ELSE
    RAISE NOTICE '✅ approval_metadata column already exists';
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN document_workflows.status IS 'Workflow status: active, paused, completed, cancelled';
COMMENT ON COLUMN document_workflows.current_stage_id IS 'Current workflow stage for the document';
COMMENT ON COLUMN section_workflow_states.approval_metadata IS 'JSON metadata about the approval (reviewer comments, timestamps, etc.)';

-- ============================================================================
-- PART 2: FIX UNIQUE CONSTRAINT TO ALLOW RESUBMISSIONS
-- ============================================================================

-- Drop old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'section_workflow_states_section_id_workflow_stage_id_key'
  ) THEN
    ALTER TABLE section_workflow_states
      DROP CONSTRAINT section_workflow_states_section_id_workflow_stage_id_key;
    RAISE NOTICE '✅ Dropped old unique constraint';
  END IF;
END $$;

-- Add partial unique index (only for active states)
CREATE UNIQUE INDEX IF NOT EXISTS idx_section_stage_active_unique
  ON section_workflow_states(section_id, workflow_stage_id)
  WHERE status IN ('pending', 'in_progress', 'locked');

COMMENT ON INDEX idx_section_stage_active_unique IS
  'Prevents duplicate active states while allowing historical records for resubmissions';

DO $$ BEGIN
  RAISE NOTICE '✅ Created partial unique index for active workflow states';
END $$;

-- ============================================================================
-- PART 3: ADD MISSING RLS POLICIES
-- ============================================================================

-- Workflow stages
DROP POLICY IF EXISTS "Users see stages in their organization workflows" ON workflow_stages;
CREATE POLICY "Users see stages in their organization workflows"
  ON workflow_stages FOR SELECT
  USING (
    workflow_template_id IN (
      SELECT id FROM workflow_templates wt
      WHERE wt.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

DO $$ BEGIN
  RAISE NOTICE '✅ Added RLS policy for workflow_stages';
END $$;

-- Document workflows
DROP POLICY IF EXISTS "Users see workflows for accessible documents" ON document_workflows;
CREATE POLICY "Users see workflows for accessible documents"
  ON document_workflows FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

DO $$ BEGIN
  RAISE NOTICE '✅ Added RLS policy for document_workflows';
END $$;

-- Section workflow states - SELECT
DROP POLICY IF EXISTS "Users see workflow states in their organizations" ON section_workflow_states;
CREATE POLICY "Users see workflow states in their organizations"
  ON section_workflow_states FOR SELECT
  USING (
    section_id IN (
      SELECT ds.id FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      WHERE d.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

DO $$ BEGIN
  RAISE NOTICE '✅ Added RLS SELECT policy for section_workflow_states';
END $$;

-- Section workflow states - INSERT
DROP POLICY IF EXISTS "Users can create workflow states for sections they can approve" ON section_workflow_states;
CREATE POLICY "Users can create workflow states for sections they can approve"
  ON section_workflow_states FOR INSERT
  WITH CHECK (
    user_can_approve_stage(auth.uid(), workflow_stage_id)
  );

DO $$ BEGIN
  RAISE NOTICE '✅ Added RLS INSERT policy for section_workflow_states';
END $$;

-- Section workflow states - UPDATE
DROP POLICY IF EXISTS "Users can update their own workflow state actions" ON section_workflow_states;
CREATE POLICY "Users can update their own workflow state actions"
  ON section_workflow_states FOR UPDATE
  USING (actioned_by = auth.uid() OR is_global_admin(auth.uid()))
  WITH CHECK (actioned_by = auth.uid() OR is_global_admin(auth.uid()));

DO $$ BEGIN
  RAISE NOTICE '✅ Added RLS UPDATE policy for section_workflow_states';
END $$;

-- ============================================================================
-- PART 4: ADD PERFORMANCE INDEXES
-- ============================================================================

-- Index for workflow progress queries
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_status_created
  ON section_workflow_states(status, created_at DESC)
  WHERE status IN ('pending', 'in_progress');

DO $$ BEGIN
  RAISE NOTICE '✅ Added index for pending workflow queries';
END $$;

-- Index for user pending approvals
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_stage_status
  ON section_workflow_states(workflow_stage_id, status)
  WHERE status = 'pending';

DO $$ BEGIN
  RAISE NOTICE '✅ Added index for stage status queries';
END $$;

-- Index for actioned_by queries (approval history)
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_actioned_by
  ON section_workflow_states(actioned_by)
  WHERE actioned_by IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE '✅ Added index for approval history queries';
END $$;

-- ============================================================================
-- PART 5: VERIFY CRITICAL FUNCTIONS EXIST
-- ============================================================================

DO $$
BEGIN
  -- Check if user_can_approve_stage exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'user_can_approve_stage'
  ) THEN
    RAISE WARNING '⚠️ Function user_can_approve_stage does not exist. Run migration 012 first.';
  END IF;

  -- Check if is_global_admin exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_global_admin'
  ) THEN
    RAISE WARNING '⚠️ Function is_global_admin does not exist. Run migration 012 first.';
  END IF;
END $$;

-- ============================================================================
-- PART 6: DATA INTEGRITY CHECKS
-- ============================================================================

-- Ensure all workflow templates have at least one stage
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM workflow_templates wt
  WHERE NOT EXISTS (
    SELECT 1 FROM workflow_stages ws WHERE ws.workflow_template_id = wt.id
  );

  IF v_count > 0 THEN
    RAISE WARNING '⚠️ Found % workflow templates with no stages', v_count;
  ELSE
    RAISE NOTICE '✅ All workflow templates have stages';
  END IF;
END $$;

-- Ensure all documents with workflows have a valid template
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM document_workflows dw
  WHERE NOT EXISTS (
    SELECT 1 FROM workflow_templates wt WHERE wt.id = dw.workflow_template_id
  );

  IF v_count > 0 THEN
    RAISE WARNING '⚠️ Found % document workflows with invalid templates', v_count;
  ELSE
    RAISE NOTICE '✅ All document workflows reference valid templates';
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 017 Completed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '✅ Added missing columns to document_workflows (status, current_stage_id, timestamps)';
  RAISE NOTICE '✅ Added approval_metadata to section_workflow_states';
  RAISE NOTICE '✅ Fixed unique constraint to allow resubmissions';
  RAISE NOTICE '✅ Added 5 RLS policies for workflow tables';
  RAISE NOTICE '✅ Added 3 performance indexes';
  RAISE NOTICE '✅ Verified data integrity';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Update setupService.js to use "name" instead of "template_name"';
  RAISE NOTICE '2. Test workflow creation in UI';
  RAISE NOTICE '3. Verify RLS policies work for all user roles';
  RAISE NOTICE '4. Monitor performance of bulk approval operations';
  RAISE NOTICE '========================================';
END $$;
