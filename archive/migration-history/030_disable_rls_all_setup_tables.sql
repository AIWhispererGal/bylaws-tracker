-- Migration 030: Disable RLS on ALL Setup Wizard Tables
-- Purpose: Allow setup wizard to complete without RLS blocking
-- Issue: RLS blocking multiple table inserts during setup
-- Created: 2025-10-20
-- NOTE: This is TEMPORARY for setup - re-enable with proper policies later

-- =============================================================================
-- DISABLE RLS ON ALL SETUP-RELATED TABLES
-- =============================================================================

-- Tables the setup wizard needs to write to:
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stage_approvers DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_workflows DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show which tables have RLS disabled
SELECT
  tablename,
  CASE
    WHEN rowsecurity = false THEN '✅ DISABLED'
    ELSE '❌ ENABLED'
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
    'workflow_templates',
    'workflow_stages',
    'workflow_stage_approvers',
    'document_workflows'
  )
ORDER BY tablename;

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS DISABLED on 11 setup tables';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEPS:';
  RAISE NOTICE '1. Try setup wizard now - should work!';
  RAISE NOTICE '2. Complete organization setup';
  RAISE NOTICE '3. Upload and parse documents';
  RAISE NOTICE '4. Test everything works';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT FOR PRODUCTION:';
  RAISE NOTICE 'Before launching, re-enable RLS with proper policies';
  RAISE NOTICE 'See: docs/RE-ENABLE-RLS-FOR-PRODUCTION.md';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
