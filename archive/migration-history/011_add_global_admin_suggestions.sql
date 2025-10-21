-- ============================================================================
-- MIGRATION 011: Add Global Admin Policies for Suggestions and Related Tables
-- Date: 2025-10-13
-- Purpose: Complete global admin RLS coverage for all suggestion-related tables
--
-- ISSUE ADDRESSED:
-- Migration 007 added global admin policies for documents, document_sections,
-- and organizations, but MISSED the suggestions table. This migration completes
-- the global admin RLS implementation.
--
-- SECURITY IMPACT:
-- Allows is_global_admin users to see and manage ALL suggestions across ALL
-- organizations, consistent with their access to documents and sections.
-- ============================================================================

-- ============================================================================
-- STEP 1: Verify is_global_admin function exists
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_global_admin'
  ) THEN
    RAISE EXCEPTION 'is_global_admin function not found. Run migration 007 first!';
  END IF;

  RAISE NOTICE '✅ is_global_admin function exists';
END $$;

-- ============================================================================
-- STEP 2: Add Global Admin Policies for SUGGESTIONS Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_suggestions" ON suggestions;
DROP POLICY IF EXISTS "global_admin_manage_all_suggestions" ON suggestions;

-- Allow global admins to SELECT all suggestions
CREATE POLICY "global_admin_see_all_suggestions"
  ON suggestions
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_suggestions" ON suggestions IS
  'Global admins can view suggestions from all organizations';

-- Allow global admins to manage (INSERT, UPDATE, DELETE) all suggestions
CREATE POLICY "global_admin_manage_all_suggestions"
  ON suggestions
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_suggestions" ON suggestions IS
  'Global admins can create, update, and delete suggestions in any organization';

-- ============================================================================
-- STEP 3: Add Global Admin Policies for SUGGESTION_SECTIONS Junction Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_suggestion_sections" ON suggestion_sections;
DROP POLICY IF EXISTS "global_admin_manage_all_suggestion_sections" ON suggestion_sections;

-- Allow global admins to SELECT all suggestion_sections
CREATE POLICY "global_admin_see_all_suggestion_sections"
  ON suggestion_sections
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_suggestion_sections" ON suggestion_sections IS
  'Global admins can view suggestion-section links from all organizations';

-- Allow global admins to manage all suggestion_sections
CREATE POLICY "global_admin_manage_all_suggestion_sections"
  ON suggestion_sections
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_suggestion_sections" ON suggestion_sections IS
  'Global admins can link suggestions to sections in any organization';

-- ============================================================================
-- STEP 4: Add Global Admin Policies for SUGGESTION_VOTES Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_suggestion_votes" ON suggestion_votes;
DROP POLICY IF EXISTS "global_admin_manage_all_suggestion_votes" ON suggestion_votes;

-- Allow global admins to SELECT all suggestion_votes
CREATE POLICY "global_admin_see_all_suggestion_votes"
  ON suggestion_votes
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_suggestion_votes" ON suggestion_votes IS
  'Global admins can view votes on suggestions from all organizations';

-- Allow global admins to manage all suggestion_votes
CREATE POLICY "global_admin_manage_all_suggestion_votes"
  ON suggestion_votes
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_suggestion_votes" ON suggestion_votes IS
  'Global admins can manage votes on suggestions in any organization';

-- ============================================================================
-- STEP 5: Add Global Admin Policies for WORKFLOW_TEMPLATES Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_workflow_templates" ON workflow_templates;
DROP POLICY IF EXISTS "global_admin_manage_all_workflow_templates" ON workflow_templates;

-- Allow global admins to SELECT all workflow_templates
CREATE POLICY "global_admin_see_all_workflow_templates"
  ON workflow_templates
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_workflow_templates" ON workflow_templates IS
  'Global admins can view workflow templates from all organizations';

-- Allow global admins to manage all workflow_templates
CREATE POLICY "global_admin_manage_all_workflow_templates"
  ON workflow_templates
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_workflow_templates" ON workflow_templates IS
  'Global admins can manage workflow templates in any organization';

-- ============================================================================
-- STEP 6: Add Global Admin Policies for WORKFLOW_STAGES Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_workflow_stages" ON workflow_stages;
DROP POLICY IF EXISTS "global_admin_manage_all_workflow_stages" ON workflow_stages;

-- Allow global admins to SELECT all workflow_stages
CREATE POLICY "global_admin_see_all_workflow_stages"
  ON workflow_stages
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_workflow_stages" ON workflow_stages IS
  'Global admins can view workflow stages from all organizations';

-- Allow global admins to manage all workflow_stages
CREATE POLICY "global_admin_manage_all_workflow_stages"
  ON workflow_stages
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_workflow_stages" ON workflow_stages IS
  'Global admins can manage workflow stages in any organization';

-- ============================================================================
-- STEP 7: Add Global Admin Policies for DOCUMENT_WORKFLOWS Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_document_workflows" ON document_workflows;
DROP POLICY IF EXISTS "global_admin_manage_all_document_workflows" ON document_workflows;

-- Allow global admins to SELECT all document_workflows
CREATE POLICY "global_admin_see_all_document_workflows"
  ON document_workflows
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_document_workflows" ON document_workflows IS
  'Global admins can view document workflows from all organizations';

-- Allow global admins to manage all document_workflows
CREATE POLICY "global_admin_manage_all_document_workflows"
  ON document_workflows
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_document_workflows" ON document_workflows IS
  'Global admins can manage document workflows in any organization';

-- ============================================================================
-- STEP 8: Add Global Admin Policies for SECTION_WORKFLOW_STATES Table
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_section_workflow_states" ON section_workflow_states;
DROP POLICY IF EXISTS "global_admin_manage_all_section_workflow_states" ON section_workflow_states;

-- Allow global admins to SELECT all section_workflow_states
CREATE POLICY "global_admin_see_all_section_workflow_states"
  ON section_workflow_states
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_section_workflow_states" ON section_workflow_states IS
  'Global admins can view section workflow states from all organizations';

-- Allow global admins to manage all section_workflow_states
CREATE POLICY "global_admin_manage_all_section_workflow_states"
  ON section_workflow_states
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_section_workflow_states" ON section_workflow_states IS
  'Global admins can manage section workflow states in any organization';

-- ============================================================================
-- STEP 9: Add Global Admin Policies for DOCUMENT_VERSIONS Table (from Migration 008)
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_document_versions" ON document_versions;
DROP POLICY IF EXISTS "global_admin_manage_all_document_versions" ON document_versions;

-- Allow global admins to SELECT all document_versions
CREATE POLICY "global_admin_see_all_document_versions"
  ON document_versions
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_document_versions" ON document_versions IS
  'Global admins can view document versions from all organizations';

-- Allow global admins to manage all document_versions
CREATE POLICY "global_admin_manage_all_document_versions"
  ON document_versions
  FOR ALL
  USING (
    is_global_admin(auth.uid())
  )
  WITH CHECK (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_manage_all_document_versions" ON document_versions IS
  'Global admins can manage document versions in any organization';

-- ============================================================================
-- STEP 10: Add Global Admin Policies for USER_ACTIVITY_LOG Table (from Migration 008)
-- ============================================================================

-- Drop if exists (idempotent)
DROP POLICY IF EXISTS "global_admin_see_all_activity_logs" ON user_activity_log;
DROP POLICY IF EXISTS "global_admin_manage_all_activity_logs" ON user_activity_log;

-- Allow global admins to SELECT all activity logs
CREATE POLICY "global_admin_see_all_activity_logs"
  ON user_activity_log
  FOR SELECT
  USING (
    is_global_admin(auth.uid())
  );

COMMENT ON POLICY "global_admin_see_all_activity_logs" ON user_activity_log IS
  'Global admins can view activity logs from all organizations';

-- Note: Global admins typically should NOT modify audit logs
-- Only allowing SELECT, not full management

-- ============================================================================
-- STEP 11: Verification Query
-- ============================================================================

-- Create a view to audit all global admin policies
CREATE OR REPLACE VIEW global_admin_policy_audit AS
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  CASE
    WHEN policyname LIKE '%global_admin%' THEN '✅ Has Global Admin Policy'
    ELSE '⚠️ Standard Policy Only'
  END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'documents',
    'document_sections',
    'suggestions',
    'suggestion_sections',
    'suggestion_votes',
    'organizations',
    'workflow_templates',
    'workflow_stages',
    'document_workflows',
    'section_workflow_states',
    'document_versions',
    'user_activity_log'
  )
ORDER BY tablename, policyname;

COMMENT ON VIEW global_admin_policy_audit IS
  'Audit view showing which tables have global admin RLS policies';

-- ============================================================================
-- STEP 12: Success Message and Verification
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
  v_table_coverage INTEGER;
BEGIN
  -- Count global admin policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE policyname LIKE '%global_admin%';

  -- Count tables with global admin coverage
  SELECT COUNT(DISTINCT tablename) INTO v_table_coverage
  FROM pg_policies
  WHERE policyname LIKE '%global_admin%';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION 011 COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Global Admin RLS Policies Added:';
  RAISE NOTICE '  ✅ suggestions (SELECT + ALL)';
  RAISE NOTICE '  ✅ suggestion_sections (SELECT + ALL)';
  RAISE NOTICE '  ✅ suggestion_votes (SELECT + ALL)';
  RAISE NOTICE '  ✅ workflow_templates (SELECT + ALL)';
  RAISE NOTICE '  ✅ workflow_stages (SELECT + ALL)';
  RAISE NOTICE '  ✅ document_workflows (SELECT + ALL)';
  RAISE NOTICE '  ✅ section_workflow_states (SELECT + ALL)';
  RAISE NOTICE '  ✅ document_versions (SELECT + ALL)';
  RAISE NOTICE '  ✅ user_activity_log (SELECT only)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Policy Statistics:';
  RAISE NOTICE '  Total global_admin policies: %', v_policy_count;
  RAISE NOTICE '  Tables with global admin access: %', v_table_coverage;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Verification:';
  RAISE NOTICE '  Run: SELECT * FROM global_admin_policy_audit;';
  RAISE NOTICE '  Or: SELECT tablename, COUNT(*) FROM pg_policies';
  RAISE NOTICE '      WHERE policyname LIKE ''%%global_admin%%''';
  RAISE NOTICE '      GROUP BY tablename;';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next Steps:';
  RAISE NOTICE '  1. Test global admin access with test user';
  RAISE NOTICE '  2. Run: SELECT link_global_admin_to_all_orgs(''user-id'');';
  RAISE NOTICE '  3. Verify cross-organization access works';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- TESTING QUERIES (Optional - for development/verification)
-- ============================================================================

-- Test 1: Verify all tables have global admin policies
COMMENT ON VIEW global_admin_policy_audit IS 'Use: SELECT * FROM global_admin_policy_audit;';

-- Test 2: Count policies per table
-- SELECT
--   tablename,
--   COUNT(CASE WHEN policyname LIKE '%global_admin%' THEN 1 END) as global_admin_policies,
--   COUNT(*) as total_policies
-- FROM pg_policies
-- WHERE tablename IN (
--   'suggestions', 'suggestion_sections', 'suggestion_votes',
--   'workflow_templates', 'workflow_stages', 'document_workflows',
--   'section_workflow_states', 'document_versions', 'user_activity_log'
-- )
-- GROUP BY tablename
-- ORDER BY tablename;

-- Test 3: Verify is_global_admin function works
-- SELECT is_global_admin('YOUR-USER-ID'::uuid);

-- Test 4: Create test global admin user
-- SELECT link_global_admin_to_all_orgs('YOUR-USER-ID'::uuid);

-- Test 5: Verify global admin can see all suggestions
-- SET LOCAL request.jwt.claims = '{"sub": "YOUR-USER-ID"}';
-- SELECT COUNT(*) FROM suggestions; -- Should see ALL suggestions
