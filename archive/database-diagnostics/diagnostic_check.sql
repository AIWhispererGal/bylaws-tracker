-- ============================================================================
-- DATABASE DIAGNOSTIC CHECK
-- ============================================================================
-- Purpose: Check what tables exist and their schema version
-- Usage: Run this in Supabase SQL Editor to diagnose database state
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '======================================';
  RAISE NOTICE 'DATABASE DIAGNOSTIC REPORT';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 1: TABLE EXISTENCE CHECK
-- ============================================================================

DO $$
DECLARE
  v_table_name TEXT;
  v_exists BOOLEAN;
  v_count INTEGER := 0;
  v_total INTEGER := 0;
BEGIN
  RAISE NOTICE '1. TABLE EXISTENCE CHECK';
  RAISE NOTICE '========================';
  RAISE NOTICE '';

  -- Check each required table
  FOR v_table_name IN
    SELECT unnest(ARRAY[
      'organizations',
      'users',
      'user_organizations',
      'documents',
      'document_sections',
      'workflow_templates',
      'workflow_stages',
      'document_workflows',
      'section_workflow_states',
      'suggestions',
      'suggestion_sections',
      'suggestion_votes'
    ])
  LOOP
    v_total := v_total + 1;
    SELECT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = v_table_name
    ) INTO v_exists;

    IF v_exists THEN
      v_count := v_count + 1;
      RAISE NOTICE '✅ % - EXISTS', v_table_name;
    ELSE
      RAISE NOTICE '❌ % - MISSING', v_table_name;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE 'Summary: % of % required tables exist', v_count, v_total;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 2: SCHEMA VERSION DETECTION
-- ============================================================================

DO $$
DECLARE
  v_has_hierarchy_config BOOLEAN;
  v_has_bylaw_sections BOOLEAN;
  v_schema_version TEXT;
BEGIN
  RAISE NOTICE '2. SCHEMA VERSION DETECTION';
  RAISE NOTICE '===========================';
  RAISE NOTICE '';

  -- Check for v2.0 marker (hierarchy_config column)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'hierarchy_config'
  ) INTO v_has_hierarchy_config;

  -- Check for old schema marker (bylaw_sections table)
  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'bylaw_sections'
  ) INTO v_has_bylaw_sections;

  -- Determine schema version
  IF v_has_hierarchy_config AND NOT v_has_bylaw_sections THEN
    v_schema_version := 'v2.0 (Generalized Schema) ✅';
  ELSIF v_has_hierarchy_config AND v_has_bylaw_sections THEN
    v_schema_version := 'Mixed (Both v1.0 and v2.0) ⚠️';
  ELSIF v_has_bylaw_sections THEN
    v_schema_version := 'v1.0 (Legacy Schema) ⚠️';
  ELSE
    v_schema_version := 'Unknown or Empty ❌';
  END IF;

  RAISE NOTICE 'Schema Version: %', v_schema_version;
  RAISE NOTICE '';

  IF v_has_hierarchy_config THEN
    RAISE NOTICE '✅ organizations.hierarchy_config column exists';
  ELSE
    RAISE NOTICE '❌ organizations.hierarchy_config column MISSING';
  END IF;

  IF v_has_bylaw_sections THEN
    RAISE NOTICE '⚠️  bylaw_sections table exists (old schema)';
  ELSE
    RAISE NOTICE '✅ bylaw_sections table not found (clean v2.0)';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: ROW COUNTS
-- ============================================================================

DO $$
DECLARE
  v_org_count INTEGER;
  v_doc_count INTEGER;
  v_section_count INTEGER;
  v_workflow_count INTEGER;
  v_suggestion_count INTEGER;
BEGIN
  RAISE NOTICE '3. ROW COUNTS';
  RAISE NOTICE '=============';
  RAISE NOTICE '';

  -- Count organizations
  BEGIN
    SELECT COUNT(*) INTO v_org_count FROM organizations;
    RAISE NOTICE 'Organizations: %', v_org_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Organizations: (table does not exist)';
    v_org_count := 0;
  END;

  -- Count documents
  BEGIN
    SELECT COUNT(*) INTO v_doc_count FROM documents;
    RAISE NOTICE 'Documents: %', v_doc_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Documents: (table does not exist)';
    v_doc_count := 0;
  END;

  -- Count sections
  BEGIN
    SELECT COUNT(*) INTO v_section_count FROM document_sections;
    RAISE NOTICE 'Document Sections: %', v_section_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Document Sections: (table does not exist)';
    v_section_count := 0;
  END;

  -- Count workflows
  BEGIN
    SELECT COUNT(*) INTO v_workflow_count FROM workflow_templates;
    RAISE NOTICE 'Workflow Templates: %', v_workflow_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Workflow Templates: (table does not exist)';
    v_workflow_count := 0;
  END;

  -- Count suggestions
  BEGIN
    SELECT COUNT(*) INTO v_suggestion_count FROM suggestions;
    RAISE NOTICE 'Suggestions: %', v_suggestion_count;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Suggestions: (table does not exist)';
    v_suggestion_count := 0;
  END;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 4: RLS (ROW LEVEL SECURITY) STATUS
-- ============================================================================

DO $$
DECLARE
  v_rls_count INTEGER;
  v_total_tables INTEGER;
BEGIN
  RAISE NOTICE '4. ROW LEVEL SECURITY (RLS) STATUS';
  RAISE NOTICE '===================================';
  RAISE NOTICE '';

  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO v_rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = TRUE;

  -- Count total tables
  SELECT COUNT(*) INTO v_total_tables
  FROM pg_tables
  WHERE schemaname = 'public';

  RAISE NOTICE 'Tables with RLS enabled: % of %', v_rls_count, v_total_tables;
  RAISE NOTICE '';
END $$;

-- Show detailed RLS status for key tables
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'documents',
    'document_sections',
    'suggestions',
    'workflow_templates'
  )
ORDER BY tablename;

-- ============================================================================
-- PART 5: TRIGGER STATUS
-- ============================================================================

DO $$
DECLARE
  v_trigger_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '5. TRIGGER STATUS';
  RAISE NOTICE '=================';
  RAISE NOTICE '';

  -- Check for critical path trigger
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'document_sections'
      AND t.tgname = 'trg_update_section_path'
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    RAISE NOTICE '✅ trg_update_section_path trigger exists';
  ELSE
    RAISE NOTICE '❌ trg_update_section_path trigger MISSING';
  END IF;

  -- Check if function exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_section_path'
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    RAISE NOTICE '✅ update_section_path() function exists';
  ELSE
    RAISE NOTICE '❌ update_section_path() function MISSING';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 6: RECENT ORGANIZATION DATA
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '6. RECENT ORGANIZATION DATA';
  RAISE NOTICE '============================';
  RAISE NOTICE '';
END $$;

-- Show most recent organization (if exists)
DO $$
DECLARE
  v_org_record RECORD;
BEGIN
  BEGIN
    SELECT
      id,
      name,
      slug,
      organization_type,
      is_configured,
      created_at
    INTO v_org_record
    FROM organizations
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RAISE NOTICE 'Most Recent Organization:';
      RAISE NOTICE '  ID: %', v_org_record.id;
      RAISE NOTICE '  Name: %', v_org_record.name;
      RAISE NOTICE '  Slug: %', v_org_record.slug;
      RAISE NOTICE '  Type: %', v_org_record.organization_type;
      RAISE NOTICE '  Configured: %', v_org_record.is_configured;
      RAISE NOTICE '  Created: %', v_org_record.created_at;
    ELSE
      RAISE NOTICE 'No organizations found';
    END IF;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Organizations table does not exist';
  END;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 7: DIAGNOSIS SUMMARY
-- ============================================================================

DO $$
DECLARE
  v_documents_exists BOOLEAN;
  v_sections_exists BOOLEAN;
  v_org_has_hierarchy BOOLEAN;
  v_diagnosis TEXT;
  v_recommendation TEXT;
BEGIN
  RAISE NOTICE '7. DIAGNOSIS & RECOMMENDATION';
  RAISE NOTICE '==============================';
  RAISE NOTICE '';

  -- Check key indicators
  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'documents'
  ) INTO v_documents_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'document_sections'
  ) INTO v_sections_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'hierarchy_config'
  ) INTO v_org_has_hierarchy;

  -- Determine diagnosis
  IF v_documents_exists AND v_sections_exists AND v_org_has_hierarchy THEN
    v_diagnosis := '✅ HEALTHY - v2.0 schema fully deployed';
    v_recommendation := 'Your database is ready. Re-run setup wizard to complete configuration.';
  ELSIF v_org_has_hierarchy AND NOT v_documents_exists THEN
    v_diagnosis := '⚠️  INCOMPLETE - Partial v2.0 migration';
    v_recommendation := 'Run the full migration: /database/migrations/001_generalized_schema.sql';
  ELSIF NOT v_org_has_hierarchy THEN
    v_diagnosis := '❌ MISSING SCHEMA - No v2.0 tables detected';
    v_recommendation := 'Run the complete migration: /database/migrations/001_generalized_schema.sql';
  ELSE
    v_diagnosis := '❓ UNKNOWN - Mixed or corrupted state';
    v_recommendation := 'Contact support or check logs for details';
  END IF;

  RAISE NOTICE 'Diagnosis: %', v_diagnosis;
  RAISE NOTICE '';
  RAISE NOTICE 'Recommendation: %', v_recommendation;
  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'END OF DIAGNOSTIC REPORT';
  RAISE NOTICE '======================================';
END $$;

-- ============================================================================
-- OPTIONAL: LIST ALL PUBLIC TABLES
-- ============================================================================

-- Uncomment to see all tables in your database:
/*
SELECT
  tablename,
  CASE WHEN rowsecurity THEN 'RLS' ELSE '' END as security
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
*/
