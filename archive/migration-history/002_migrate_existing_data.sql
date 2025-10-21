-- MIGRATION SCRIPT: Transform Existing Data to Generalized Schema
-- Version: 2.0.0
-- Date: 2025-10-07
-- Purpose: Migrate data from old single-org schema to new multi-tenant schema
--
-- PREREQUISITES:
-- 1. Backup existing database: pg_dump > backup.sql
-- 2. Run 001_generalized_schema.sql first
-- 3. Review and customize organization details below
--
-- SAFETY:
-- - Creates backup tables before any destructive operations
-- - Rollback script provided at end
-- - Validates data integrity before committing

-- ============================================================================
-- STEP 1: CREATE BACKUP TABLES
-- ============================================================================

DO $$
BEGIN
  -- Create backups of all existing tables
  EXECUTE 'CREATE TABLE _backup_bylaw_sections_' || to_char(NOW(), 'YYYYMMDD_HH24MISS') || ' AS SELECT * FROM bylaw_sections';
  EXECUTE 'CREATE TABLE _backup_bylaw_suggestions_' || to_char(NOW(), 'YYYYMMDD_HH24MISS') || ' AS SELECT * FROM bylaw_suggestions';
  EXECUTE 'CREATE TABLE _backup_bylaw_votes_' || to_char(NOW(), 'YYYYMMDD_HH24MISS') || ' AS SELECT * FROM bylaw_votes';

  RAISE NOTICE '✓ Backup tables created with timestamp suffix';
END $$;

-- ============================================================================
-- STEP 2: CONFIGURE MIGRATION PARAMETERS
-- ============================================================================

-- Customize these values for your organization
CREATE TEMP TABLE migration_config AS
SELECT
  'org-default-001' AS organization_id,
  'Your Organization Name' AS organization_name,
  'your-org-slug' AS organization_slug,
  'neighborhood_council' AS organization_type,
  'doc-bylaws-001' AS document_id,
  'Bylaws' AS document_title,
  'Main organizational bylaws' AS document_description,
  'YOUR_GOOGLE_DOC_ID_HERE' AS google_doc_id, -- Replace with actual ID if using Google Docs
  'wf-standard-001' AS workflow_template_id,
  'Standard Committee/Board Review' AS workflow_name;

-- ============================================================================
-- STEP 3: CREATE ORGANIZATION
-- ============================================================================

INSERT INTO organizations (
  id,
  name,
  slug,
  organization_type,
  hierarchy_config,
  plan_type,
  created_at
)
SELECT
  organization_id::uuid,
  organization_name,
  organization_slug,
  organization_type,
  '{
    "levels": [
      {"name": "Article", "numbering": "roman", "prefix": "Article"},
      {"name": "Section", "numbering": "numeric", "prefix": "Section"}
    ],
    "max_depth": 5
  }'::jsonb,
  'free',
  NOW()
FROM migration_config
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

DO $$
BEGIN
  RAISE NOTICE '✓ Organization created/updated';
END $$;

-- ============================================================================
-- STEP 4: CREATE DEFAULT DOCUMENT
-- ============================================================================

INSERT INTO documents (
  id,
  organization_id,
  title,
  description,
  document_type,
  google_doc_id,
  external_source,
  status,
  version,
  created_at
)
SELECT
  document_id::uuid,
  organization_id::uuid,
  document_title,
  document_description,
  'bylaws',
  NULLIF(google_doc_id, 'YOUR_GOOGLE_DOC_ID_HERE'),
  CASE WHEN google_doc_id != 'YOUR_GOOGLE_DOC_ID_HERE' THEN 'google_docs' ELSE 'manual' END,
  'active',
  '1.0',
  NOW()
FROM migration_config
ON CONFLICT (organization_id, google_doc_id) DO UPDATE
SET title = EXCLUDED.title;

DO $$
BEGIN
  RAISE NOTICE '✓ Document created/updated';
END $$;

-- ============================================================================
-- STEP 5: MIGRATE SECTIONS WITH HIERARCHY PARSING
-- ============================================================================

-- Parse article_number and section_number from section_citation if not already present
-- This handles citations like "Article V, Section 6"
UPDATE bylaw_sections
SET
  article_number = COALESCE(
    article_number,
    SUBSTRING(section_citation FROM 'Article ([IVXLCDM]+)')
  ),
  section_number = COALESCE(
    section_number,
    CAST(SUBSTRING(section_citation FROM 'Section (\d+)') AS INTEGER)
  )
WHERE article_number IS NULL OR section_number IS NULL;

-- Migrate sections to new document_sections table
-- Strategy: Flatten initially (all root sections), then hierarchize if needed
INSERT INTO document_sections (
  id,
  document_id,
  parent_section_id,
  ordinal,
  section_number,
  section_title,
  section_type,
  original_text,
  current_text,
  created_at,
  updated_at
)
SELECT
  bs.id,
  mc.document_id::uuid,
  NULL, -- Flatten initially - can be hierarchized later
  ROW_NUMBER() OVER (ORDER BY bs.article_number, bs.section_number, bs.section_citation)::integer,
  bs.section_citation,
  bs.section_title,
  CASE
    WHEN bs.section_citation ~* '^Article' THEN 'article'
    WHEN bs.section_citation ~* 'Section' THEN 'section'
    ELSE 'section'
  END,
  bs.original_text,
  -- Prioritize: final_text > new_text > original_text
  COALESCE(bs.final_text, bs.new_text, bs.original_text),
  bs.created_at,
  bs.updated_at
FROM bylaw_sections bs
CROSS JOIN migration_config mc
ON CONFLICT (id) DO UPDATE
SET
  section_title = EXCLUDED.section_title,
  current_text = EXCLUDED.current_text,
  updated_at = EXCLUDED.updated_at;

DO $$
DECLARE
  section_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO section_count FROM document_sections;
  RAISE NOTICE '✓ Migrated % sections to document_sections', section_count;
END $$;

-- ============================================================================
-- STEP 6: CREATE DEFAULT WORKFLOW TEMPLATE
-- ============================================================================

INSERT INTO workflow_templates (
  id,
  organization_id,
  name,
  description,
  is_default,
  is_active,
  created_at
)
SELECT
  workflow_template_id::uuid,
  organization_id::uuid,
  workflow_name,
  'Standard two-stage approval: Committee review followed by Board approval',
  true,
  true,
  NOW()
FROM migration_config
ON CONFLICT (organization_id, name) DO UPDATE
SET is_default = EXCLUDED.is_default;

-- Create workflow stages
INSERT INTO workflow_stages (
  workflow_template_id,
  stage_name,
  stage_order,
  can_lock,
  can_edit,
  can_approve,
  requires_approval,
  required_roles,
  display_color,
  description
)
SELECT
  mc.workflow_template_id::uuid,
  stage_name,
  stage_order,
  can_lock,
  can_edit,
  can_approve,
  requires_approval,
  required_roles,
  display_color,
  description
FROM migration_config mc
CROSS JOIN (
  VALUES
    ('Committee Review', 1, true, false, true, true, '["committee_member", "admin"]'::jsonb, '#FFD700', 'Initial review and selection of suggestions by committee members'),
    ('Board Approval', 2, false, false, true, true, '["board_member", "admin"]'::jsonb, '#90EE90', 'Final approval by board before publishing')
) AS stages(stage_name, stage_order, can_lock, can_edit, can_approve, requires_approval, required_roles, display_color, description)
ON CONFLICT (workflow_template_id, stage_name) DO NOTHING;

-- Link document to workflow
INSERT INTO document_workflows (
  document_id,
  workflow_template_id,
  activated_at
)
SELECT
  document_id::uuid,
  workflow_template_id::uuid,
  NOW()
FROM migration_config
ON CONFLICT (document_id) DO UPDATE
SET workflow_template_id = EXCLUDED.workflow_template_id;

DO $$
BEGIN
  RAISE NOTICE '✓ Created default 2-stage workflow (Committee → Board)';
END $$;

-- ============================================================================
-- STEP 7: MIGRATE WORKFLOW STATES (locked_by_committee, board_approved)
-- ============================================================================

-- Migrate committee review states
INSERT INTO section_workflow_states (
  section_id,
  workflow_stage_id,
  status,
  actioned_by_email,
  actioned_at,
  notes,
  selected_suggestion_id,
  created_at
)
SELECT
  bs.id,
  ws.id,
  CASE
    WHEN bs.locked_by_committee = true THEN 'approved'
    ELSE 'pending'
  END,
  bs.locked_by,
  bs.locked_at,
  bs.committee_notes,
  bs.selected_suggestion_id,
  COALESCE(bs.locked_at, bs.created_at)
FROM bylaw_sections bs
CROSS JOIN migration_config mc
JOIN workflow_stages ws ON ws.workflow_template_id = mc.workflow_template_id::uuid
WHERE ws.stage_name = 'Committee Review'
  AND (bs.locked_by_committee IS NOT NULL OR bs.locked_by IS NOT NULL)
ON CONFLICT (section_id, workflow_stage_id) DO UPDATE
SET
  status = EXCLUDED.status,
  actioned_by_email = EXCLUDED.actioned_by_email,
  actioned_at = EXCLUDED.actioned_at,
  notes = EXCLUDED.notes,
  selected_suggestion_id = EXCLUDED.selected_suggestion_id;

-- Migrate board approval states
INSERT INTO section_workflow_states (
  section_id,
  workflow_stage_id,
  status,
  actioned_at,
  created_at
)
SELECT
  bs.id,
  ws.id,
  CASE
    WHEN bs.board_approved = true THEN 'approved'
    ELSE 'pending'
  END,
  bs.board_approved_at,
  COALESCE(bs.board_approved_at, bs.created_at)
FROM bylaw_sections bs
CROSS JOIN migration_config mc
JOIN workflow_stages ws ON ws.workflow_template_id = mc.workflow_template_id::uuid
WHERE ws.stage_name = 'Board Approval'
  AND bs.board_approved IS NOT NULL
ON CONFLICT (section_id, workflow_stage_id) DO UPDATE
SET
  status = EXCLUDED.status,
  actioned_at = EXCLUDED.actioned_at;

DO $$
DECLARE
  committee_states INTEGER;
  board_states INTEGER;
BEGIN
  SELECT COUNT(*) INTO committee_states
  FROM section_workflow_states sws
  JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
  WHERE ws.stage_name = 'Committee Review';

  SELECT COUNT(*) INTO board_states
  FROM section_workflow_states sws
  JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
  WHERE ws.stage_name = 'Board Approval';

  RAISE NOTICE '✓ Migrated workflow states: % committee, % board', committee_states, board_states;
END $$;

-- ============================================================================
-- STEP 8: MIGRATE SUGGESTIONS
-- ============================================================================

-- Add document_id to suggestions if not present
ALTER TABLE bylaw_suggestions
ADD COLUMN IF NOT EXISTS document_id UUID;

-- Update document_id for all suggestions
UPDATE bylaw_suggestions
SET document_id = (SELECT document_id::uuid FROM migration_config)
WHERE document_id IS NULL;

-- Migrate to new suggestions table
INSERT INTO suggestions (
  id,
  document_id,
  is_multi_section,
  suggested_text,
  rationale,
  author_email,
  author_name,
  google_suggestion_id,
  status,
  support_count,
  article_scope,
  section_range,
  created_at,
  updated_at
)
SELECT
  bs.id,
  bs.document_id,
  COALESCE(bs.is_multi_section, false),
  bs.suggested_text,
  bs.rationale,
  bs.author_email,
  bs.author_name,
  bs.google_suggestion_id,
  bs.status,
  bs.support_count,
  bs.article_scope,
  bs.section_range,
  bs.created_at,
  COALESCE(bs.updated_at, bs.created_at)
FROM bylaw_suggestions bs
ON CONFLICT (id) DO UPDATE
SET
  suggested_text = EXCLUDED.suggested_text,
  rationale = EXCLUDED.rationale,
  support_count = EXCLUDED.support_count,
  updated_at = EXCLUDED.updated_at;

-- Migrate suggestion-section mappings
-- First from existing suggestion_sections table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suggestion_sections') THEN
    INSERT INTO suggestion_sections (suggestion_id, section_id, ordinal)
    SELECT suggestion_id, section_id, ordinal
    FROM suggestion_sections
    ON CONFLICT (suggestion_id, section_id) DO NOTHING;

    RAISE NOTICE '✓ Migrated existing suggestion_sections mappings';
  END IF;
END $$;

-- Then create mappings for single-section suggestions that weren't migrated
INSERT INTO suggestion_sections (
  suggestion_id,
  section_id,
  ordinal
)
SELECT
  bs.id,
  bs.section_id,
  1
FROM bylaw_suggestions bs
WHERE bs.section_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM suggestion_sections ss
    WHERE ss.suggestion_id = bs.id
  )
ON CONFLICT (suggestion_id, section_id) DO NOTHING;

DO $$
DECLARE
  suggestion_count INTEGER;
  mapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO suggestion_count FROM suggestions;
  SELECT COUNT(*) INTO mapping_count FROM suggestion_sections;

  RAISE NOTICE '✓ Migrated % suggestions with % section mappings', suggestion_count, mapping_count;
END $$;

-- ============================================================================
-- STEP 9: MIGRATE VOTES
-- ============================================================================

INSERT INTO suggestion_votes (
  id,
  suggestion_id,
  user_email,
  vote_type,
  is_preferred,
  created_at
)
SELECT
  bv.id,
  bv.suggestion_id,
  bv.user_email,
  COALESCE(bv.vote_type, 'support'),
  COALESCE(bv.is_preferred, false),
  bv.created_at
FROM bylaw_votes bv
ON CONFLICT (suggestion_id, user_email) DO UPDATE
SET
  vote_type = EXCLUDED.vote_type,
  is_preferred = EXCLUDED.is_preferred;

DO $$
DECLARE
  vote_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO vote_count FROM suggestion_votes;
  RAISE NOTICE '✓ Migrated % votes', vote_count;
END $$;

-- ============================================================================
-- STEP 10: DATA INTEGRITY VALIDATION
-- ============================================================================

DO $$
DECLARE
  orphaned_sections INTEGER;
  orphaned_suggestions INTEGER;
  orphaned_votes INTEGER;
  missing_paths INTEGER;
BEGIN
  -- Check for orphaned sections (no document)
  SELECT COUNT(*) INTO orphaned_sections
  FROM document_sections ds
  WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = ds.document_id);

  -- Check for orphaned suggestions (no document)
  SELECT COUNT(*) INTO orphaned_suggestions
  FROM suggestions s
  WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.id = s.document_id);

  -- Check for orphaned votes (no suggestion)
  SELECT COUNT(*) INTO orphaned_votes
  FROM suggestion_votes sv
  WHERE NOT EXISTS (SELECT 1 FROM suggestions s WHERE s.id = sv.suggestion_id);

  -- Check for sections missing path materialization
  SELECT COUNT(*) INTO missing_paths
  FROM document_sections
  WHERE path_ids IS NULL OR path_ordinals IS NULL;

  IF orphaned_sections > 0 THEN
    RAISE WARNING 'Found % orphaned sections - investigate before proceeding', orphaned_sections;
  END IF;

  IF orphaned_suggestions > 0 THEN
    RAISE WARNING 'Found % orphaned suggestions - investigate before proceeding', orphaned_suggestions;
  END IF;

  IF orphaned_votes > 0 THEN
    RAISE WARNING 'Found % orphaned votes - investigate before proceeding', orphaned_votes;
  END IF;

  IF missing_paths > 0 THEN
    RAISE WARNING 'Found % sections with missing paths - check trigger execution', missing_paths;
  END IF;

  IF orphaned_sections = 0 AND orphaned_suggestions = 0 AND orphaned_votes = 0 AND missing_paths = 0 THEN
    RAISE NOTICE '✓ Data integrity validation passed';
  ELSE
    RAISE NOTICE '⚠ Data integrity issues detected - review warnings above';
  END IF;
END $$;

-- ============================================================================
-- STEP 11: MIGRATION SUMMARY
-- ============================================================================

DO $$
DECLARE
  org_count INTEGER;
  doc_count INTEGER;
  section_count INTEGER;
  suggestion_count INTEGER;
  vote_count INTEGER;
  workflow_count INTEGER;
  state_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count FROM organizations;
  SELECT COUNT(*) INTO doc_count FROM documents;
  SELECT COUNT(*) INTO section_count FROM document_sections;
  SELECT COUNT(*) INTO suggestion_count FROM suggestions;
  SELECT COUNT(*) INTO vote_count FROM suggestion_votes;
  SELECT COUNT(*) INTO workflow_count FROM workflow_templates;
  SELECT COUNT(*) INTO state_count FROM section_workflow_states;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organizations: %', org_count;
  RAISE NOTICE 'Documents: %', doc_count;
  RAISE NOTICE 'Sections: %', section_count;
  RAISE NOTICE 'Suggestions: %', suggestion_count;
  RAISE NOTICE 'Votes: %', vote_count;
  RAISE NOTICE 'Workflows: %', workflow_count;
  RAISE NOTICE 'Workflow States: %', state_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backup tables created with timestamp suffix';
  RAISE NOTICE 'Original tables preserved (not dropped)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify data in new tables';
  RAISE NOTICE '2. Update application code to use new schema';
  RAISE NOTICE '3. Test thoroughly before dropping old tables';
  RAISE NOTICE '4. Run: DROP TABLE bylaw_sections, bylaw_suggestions, bylaw_votes;';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- ROLLBACK SCRIPT (Run this if migration fails)
-- ============================================================================
/*
-- Uncomment and run this block to rollback migration

BEGIN;

-- Drop new data (preserves schema)
TRUNCATE TABLE section_workflow_states CASCADE;
TRUNCATE TABLE document_workflows CASCADE;
TRUNCATE TABLE workflow_stages CASCADE;
TRUNCATE TABLE workflow_templates CASCADE;
TRUNCATE TABLE suggestion_votes CASCADE;
TRUNCATE TABLE suggestion_sections CASCADE;
TRUNCATE TABLE suggestions CASCADE;
TRUNCATE TABLE document_sections CASCADE;
TRUNCATE TABLE documents CASCADE;
TRUNCATE TABLE user_organizations CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE organizations CASCADE;

-- Restore from most recent backup (replace timestamp)
-- INSERT INTO bylaw_sections SELECT * FROM _backup_bylaw_sections_YYYYMMDD_HHMMSS;
-- INSERT INTO bylaw_suggestions SELECT * FROM _backup_bylaw_suggestions_YYYYMMDD_HHMMSS;
-- INSERT INTO bylaw_votes SELECT * FROM _backup_bylaw_votes_YYYYMMDD_HHMMSS;

COMMIT;

-- Drop backup tables after successful rollback
-- DROP TABLE _backup_bylaw_sections_YYYYMMDD_HHMMSS;
-- DROP TABLE _backup_bylaw_suggestions_YYYYMMDD_HHMMSS;
-- DROP TABLE _backup_bylaw_votes_YYYYMMDD_HHMMSS;
*/
