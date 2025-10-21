-- Migration 030: Disable RLS on ALL Setup Wizard Tables (CORRECTED)
-- Purpose: Allow setup wizard to complete without RLS blocking
-- Updated: Removed non-existent tables
-- Created: 2025-10-20

-- =============================================================================
-- DISABLE RLS ON EXISTING TABLES ONLY
-- =============================================================================

-- Core tables
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;

-- Document tables
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_workflows DISABLE ROW LEVEL SECURITY;

-- Workflow tables
ALTER TABLE workflow_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages DISABLE ROW LEVEL SECURITY;

-- Suggestion/voting tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'suggestions') THEN
    EXECUTE 'ALTER TABLE suggestions DISABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ Disabled RLS on suggestions';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'suggestion_votes') THEN
    EXECUTE 'ALTER TABLE suggestion_votes DISABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ Disabled RLS on suggestion_votes';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_invitations') THEN
    EXECUTE 'ALTER TABLE user_invitations DISABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ Disabled RLS on user_invitations';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT
  tablename,
  CASE
    WHEN rowsecurity = false THEN '✅ DISABLED'
    ELSE '❌ STILL ENABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'user_types',
    'organization_roles',
    'users',
    'user_organizations',
    'documents',
    'document_sections',
    'document_versions',
    'document_workflows',
    'workflow_templates',
    'workflow_stages',
    'suggestions',
    'suggestion_votes',
    'user_invitations'
  )
ORDER BY tablename;

-- =============================================================================
-- SHOW SUMMARY
-- =============================================================================

DO $$
DECLARE
  disabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO disabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND rowsecurity = false
    AND tablename IN (
      'organizations', 'user_types', 'organization_roles',
      'users', 'user_organizations', 'documents',
      'document_sections', 'workflow_templates', 'workflow_stages'
    );

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS DISABLED on % tables', disabled_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Setup wizard should now work!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Remember to re-enable RLS for production';
  RAISE NOTICE '========================================';
END $$;
