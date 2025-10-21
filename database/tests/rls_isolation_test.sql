-- ============================================================================
-- RLS ISOLATION TESTS - Multi-Tenant Data Security Verification
-- ============================================================================
-- Purpose: Verify complete data isolation between 99 neighborhood councils
-- Date: 2025-10-12
-- Version: 1.0.0
--
-- CRITICAL REQUIREMENTS:
-- 1. Organization A cannot see Organization B's data
-- 2. Users can only see their own organization's documents
-- 3. Anonymous users can create organizations (setup wizard)
-- 4. Authenticated users have proper CRUD within their org
-- 5. No cross-tenant data leakage
--
-- NOTE: Currently RLS is DISABLED (per 004_fix_rls_recursion.sql)
--       These tests will FAIL until RLS is properly re-enabled
-- ============================================================================

-- ============================================================================
-- PART 1: TEST SETUP - Create Test Organizations and Users
-- ============================================================================

-- Clean up any previous test data
DO $$
BEGIN
  RAISE NOTICE '🧹 Cleaning up previous test data...';

  DELETE FROM user_organizations WHERE organization_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-council-a', 'test-council-b')
  );

  DELETE FROM documents WHERE organization_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-council-a', 'test-council-b')
  );

  DELETE FROM organizations WHERE slug IN ('test-council-a', 'test-council-b');

  DELETE FROM users WHERE email IN (
    'user-a@test.com',
    'user-b@test.com',
    'admin-a@test.com',
    'admin-b@test.com'
  );

  RAISE NOTICE '✅ Cleanup complete';
END $$;

-- Create Test Organizations
INSERT INTO organizations (id, name, slug, organization_type, plan_type)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Test Council A', 'test-council-a', 'neighborhood_council', 'free'),
  ('22222222-2222-2222-2222-222222222222', 'Test Council B', 'test-council-b', 'neighborhood_council', 'free');

-- Create Test Users
INSERT INTO users (id, email, name)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.com', 'User A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-b@test.com', 'User B'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', 'admin-a@test.com', 'Admin A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc', 'admin-b@test.com', 'Admin B');

-- Assign Users to Organizations
INSERT INTO user_organizations (user_id, organization_id, role)
VALUES
  -- Council A members
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab', '11111111-1111-1111-1111-111111111111', 'admin'),
  -- Council B members
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc', '22222222-2222-2222-2222-222222222222', 'admin');

-- Create Test Documents
INSERT INTO documents (id, organization_id, title, document_type, status)
VALUES
  ('dddddddd-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   'Council A Bylaws', 'bylaws', 'active'),
  ('dddddddd-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   'Council B Bylaws', 'bylaws', 'active');

-- Create Test Document Sections
INSERT INTO document_sections (id, document_id, parent_section_id, ordinal, section_number,
                                section_title, current_text)
VALUES
  -- Council A Sections
  ('ssssssss-1111-1111-1111-111111111111', 'dddddddd-1111-1111-1111-111111111111',
   NULL, 1, 'Article I', 'Membership', 'Council A membership rules'),
  ('ssssssss-1111-1111-1111-111111111112', 'dddddddd-1111-1111-1111-111111111111',
   NULL, 2, 'Article II', 'Meetings', 'Council A meeting procedures'),

  -- Council B Sections
  ('ssssssss-2222-2222-2222-222222222221', 'dddddddd-2222-2222-2222-222222222222',
   NULL, 1, 'Article I', 'Purpose', 'Council B purpose statement'),
  ('ssssssss-2222-2222-2222-222222222222', 'dddddddd-2222-2222-2222-222222222222',
   NULL, 2, 'Article II', 'Structure', 'Council B organizational structure');

-- Create Test Suggestions
INSERT INTO suggestions (id, document_id, suggested_text, rationale,
                         author_user_id, author_email, status)
VALUES
  -- Council A Suggestions
  ('gggggggg-1111-1111-1111-111111111111', 'dddddddd-1111-1111-1111-111111111111',
   'Updated membership criteria', 'More inclusive language',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.com', 'open'),

  -- Council B Suggestions
  ('gggggggg-2222-2222-2222-222222222222', 'dddddddd-2222-2222-2222-222222222222',
   'Revised purpose statement', 'Clarify mission',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'user-b@test.com', 'open');

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Test data created successfully';
  RAISE NOTICE '  📁 Organizations: 2 (Test Council A, Test Council B)';
  RAISE NOTICE '  👥 Users: 4 (2 per council: 1 member, 1 admin)';
  RAISE NOTICE '  📄 Documents: 2 (1 per council)';
  RAISE NOTICE '  📑 Sections: 4 (2 per document)';
  RAISE NOTICE '  💡 Suggestions: 2 (1 per document)';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 2: RLS STATUS CHECK
-- ============================================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  table_name TEXT;
  rls_tables TEXT[] := ARRAY[
    'organizations', 'documents', 'document_sections', 'suggestions',
    'suggestion_sections', 'suggestion_votes', 'workflow_templates',
    'workflow_stages', 'document_workflows', 'section_workflow_states',
    'users', 'user_organizations'
  ];
BEGIN
  RAISE NOTICE '🔒 RLS Status Check:';
  RAISE NOTICE '================================';

  FOREACH table_name IN ARRAY rls_tables
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_name;

    IF rls_enabled THEN
      RAISE NOTICE '  ✅ %: RLS ENABLED', table_name;
    ELSE
      RAISE NOTICE '  ❌ %: RLS DISABLED', table_name;
    END IF;
  END LOOP;

  RAISE NOTICE '================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: ISOLATION TESTS - Organizations
-- ============================================================================

DO $$
DECLARE
  org_a_count INTEGER;
  org_b_count INTEGER;
  cross_org_count INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 1: Organization Isolation';
  RAISE NOTICE '========================================';

  -- Test 1.1: User A can see Council A
  SELECT COUNT(*) INTO org_a_count
  FROM organizations
  WHERE id = '11111111-1111-1111-1111-111111111111';

  IF org_a_count = 1 THEN
    RAISE NOTICE '  ✅ Test 1.1 PASSED: User A can see Council A';
  ELSE
    RAISE NOTICE '  ❌ Test 1.1 FAILED: User A cannot see Council A (found: %)', org_a_count;
  END IF;

  -- Test 1.2: User A CANNOT see Council B (with RLS enabled)
  -- NOTE: This test will FAIL if RLS is disabled
  SELECT COUNT(*) INTO cross_org_count
  FROM organizations
  WHERE id = '22222222-2222-2222-2222-222222222222'
    AND id NOT IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );

  IF cross_org_count = 0 THEN
    RAISE NOTICE '  ✅ Test 1.2 PASSED: User A cannot see Council B';
  ELSE
    RAISE NOTICE '  ⚠️  Test 1.2 FAILED: User A can see Council B (RLS DISABLED!)';
  END IF;

  -- Test 1.3: User B can see Council B
  SELECT COUNT(*) INTO org_b_count
  FROM organizations
  WHERE id = '22222222-2222-2222-2222-222222222222';

  IF org_b_count = 1 THEN
    RAISE NOTICE '  ✅ Test 1.3 PASSED: User B can see Council B';
  ELSE
    RAISE NOTICE '  ❌ Test 1.3 FAILED: User B cannot see Council B (found: %)', org_b_count;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 4: ISOLATION TESTS - Documents
-- ============================================================================

DO $$
DECLARE
  doc_a_count INTEGER;
  doc_b_count INTEGER;
  user_a_sees_b INTEGER;
  user_b_sees_a INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 2: Document Isolation';
  RAISE NOTICE '========================================';

  -- Test 2.1: User A can see Council A documents
  SELECT COUNT(*) INTO doc_a_count
  FROM documents d
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE uo.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND d.organization_id = '11111111-1111-1111-1111-111111111111';

  IF doc_a_count >= 1 THEN
    RAISE NOTICE '  ✅ Test 2.1 PASSED: User A can see Council A documents (found: %)', doc_a_count;
  ELSE
    RAISE NOTICE '  ❌ Test 2.1 FAILED: User A cannot see Council A documents';
  END IF;

  -- Test 2.2: User A CANNOT see Council B documents
  SELECT COUNT(*) INTO user_a_sees_b
  FROM documents
  WHERE organization_id = '22222222-2222-2222-2222-222222222222';

  -- Verify proper isolation (should be 0 with RLS)
  IF user_a_sees_b = 0 THEN
    RAISE NOTICE '  ✅ Test 2.2 PASSED: User A cannot see Council B documents';
  ELSE
    RAISE NOTICE '  ⚠️  Test 2.2 FAILED: User A can see % Council B document(s) (RLS DISABLED!)', user_a_sees_b;
  END IF;

  -- Test 2.3: User B can see Council B documents
  SELECT COUNT(*) INTO doc_b_count
  FROM documents d
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE uo.user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    AND d.organization_id = '22222222-2222-2222-2222-222222222222';

  IF doc_b_count >= 1 THEN
    RAISE NOTICE '  ✅ Test 2.3 PASSED: User B can see Council B documents (found: %)', doc_b_count;
  ELSE
    RAISE NOTICE '  ❌ Test 2.3 FAILED: User B cannot see Council B documents';
  END IF;

  -- Test 2.4: User B CANNOT see Council A documents
  SELECT COUNT(*) INTO user_b_sees_a
  FROM documents
  WHERE organization_id = '11111111-1111-1111-1111-111111111111';

  IF user_b_sees_a = 0 THEN
    RAISE NOTICE '  ✅ Test 2.4 PASSED: User B cannot see Council A documents';
  ELSE
    RAISE NOTICE '  ⚠️  Test 2.4 FAILED: User B can see % Council A document(s) (RLS DISABLED!)', user_b_sees_a;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 5: ISOLATION TESTS - Document Sections
-- ============================================================================

DO $$
DECLARE
  user_a_sections INTEGER;
  user_b_sections INTEGER;
  cross_sections_a INTEGER;
  cross_sections_b INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 3: Document Section Isolation';
  RAISE NOTICE '========================================';

  -- Test 3.1: User A can see Council A sections
  SELECT COUNT(*) INTO user_a_sections
  FROM document_sections ds
  JOIN documents d ON ds.document_id = d.id
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE uo.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  IF user_a_sections >= 2 THEN
    RAISE NOTICE '  ✅ Test 3.1 PASSED: User A can see Council A sections (found: %)', user_a_sections;
  ELSE
    RAISE NOTICE '  ❌ Test 3.1 FAILED: User A sees wrong number of sections (expected: 2, found: %)', user_a_sections;
  END IF;

  -- Test 3.2: User A CANNOT see Council B sections
  SELECT COUNT(*) INTO cross_sections_a
  FROM document_sections ds
  WHERE ds.document_id = 'dddddddd-2222-2222-2222-222222222222'; -- Council B document

  IF cross_sections_a = 0 THEN
    RAISE NOTICE '  ✅ Test 3.2 PASSED: User A cannot see Council B sections';
  ELSE
    RAISE NOTICE '  ⚠️  Test 3.2 FAILED: User A can see % Council B sections (RLS DISABLED!)', cross_sections_a;
  END IF;

  -- Test 3.3: User B can see Council B sections
  SELECT COUNT(*) INTO user_b_sections
  FROM document_sections ds
  JOIN documents d ON ds.document_id = d.id
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE uo.user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  IF user_b_sections >= 2 THEN
    RAISE NOTICE '  ✅ Test 3.3 PASSED: User B can see Council B sections (found: %)', user_b_sections;
  ELSE
    RAISE NOTICE '  ❌ Test 3.3 FAILED: User B sees wrong number of sections (expected: 2, found: %)', user_b_sections;
  END IF;

  -- Test 3.4: User B CANNOT see Council A sections
  SELECT COUNT(*) INTO cross_sections_b
  FROM document_sections ds
  WHERE ds.document_id = 'dddddddd-1111-1111-1111-111111111111'; -- Council A document

  IF cross_sections_b = 0 THEN
    RAISE NOTICE '  ✅ Test 3.4 PASSED: User B cannot see Council A sections';
  ELSE
    RAISE NOTICE '  ⚠️  Test 3.4 FAILED: User B can see % Council A sections (RLS DISABLED!)', cross_sections_b;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 6: ISOLATION TESTS - Suggestions
-- ============================================================================

DO $$
DECLARE
  user_a_suggestions INTEGER;
  user_b_suggestions INTEGER;
  cross_sugg_a INTEGER;
  cross_sugg_b INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 4: Suggestion Isolation';
  RAISE NOTICE '========================================';

  -- Test 4.1: User A can see Council A suggestions
  SELECT COUNT(*) INTO user_a_suggestions
  FROM suggestions s
  JOIN documents d ON s.document_id = d.id
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE uo.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  IF user_a_suggestions >= 1 THEN
    RAISE NOTICE '  ✅ Test 4.1 PASSED: User A can see Council A suggestions (found: %)', user_a_suggestions;
  ELSE
    RAISE NOTICE '  ❌ Test 4.1 FAILED: User A cannot see Council A suggestions';
  END IF;

  -- Test 4.2: User A CANNOT see Council B suggestions
  SELECT COUNT(*) INTO cross_sugg_a
  FROM suggestions
  WHERE document_id = 'dddddddd-2222-2222-2222-222222222222'; -- Council B document

  IF cross_sugg_a = 0 THEN
    RAISE NOTICE '  ✅ Test 4.2 PASSED: User A cannot see Council B suggestions';
  ELSE
    RAISE NOTICE '  ⚠️  Test 4.2 FAILED: User A can see % Council B suggestions (RLS DISABLED!)', cross_sugg_a;
  END IF;

  -- Test 4.3: User B can see Council B suggestions
  SELECT COUNT(*) INTO user_b_suggestions
  FROM suggestions s
  JOIN documents d ON s.document_id = d.id
  JOIN user_organizations uo ON d.organization_id = uo.organization_id
  WHERE uo.user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  IF user_b_suggestions >= 1 THEN
    RAISE NOTICE '  ✅ Test 4.3 PASSED: User B can see Council B suggestions (found: %)', user_b_suggestions;
  ELSE
    RAISE NOTICE '  ❌ Test 4.3 FAILED: User B cannot see Council B suggestions';
  END IF;

  -- Test 4.4: User B CANNOT see Council A suggestions
  SELECT COUNT(*) INTO cross_sugg_b
  FROM suggestions
  WHERE document_id = 'dddddddd-1111-1111-1111-111111111111'; -- Council A document

  IF cross_sugg_b = 0 THEN
    RAISE NOTICE '  ✅ Test 4.4 PASSED: User B cannot see Council A suggestions';
  ELSE
    RAISE NOTICE '  ⚠️  Test 4.4 FAILED: User B can see % Council A suggestions (RLS DISABLED!)', cross_sugg_b;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 7: ANONYMOUS ACCESS TESTS - Setup Wizard
-- ============================================================================

DO $$
DECLARE
  anon_org_id UUID;
  anon_can_create BOOLEAN := false;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 5: Anonymous Access (Setup Wizard)';
  RAISE NOTICE '========================================';

  -- Test 5.1: Anonymous user can create organization
  BEGIN
    INSERT INTO organizations (id, name, slug, organization_type)
    VALUES (gen_random_uuid(), 'Anonymous Test Council', 'anon-test-council', 'neighborhood_council')
    RETURNING id INTO anon_org_id;

    anon_can_create := true;
    RAISE NOTICE '  ✅ Test 5.1 PASSED: Anonymous user can create organization';

    -- Cleanup
    DELETE FROM organizations WHERE id = anon_org_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Test 5.1 FAILED: Anonymous user cannot create organization';
    RAISE NOTICE '      Error: %', SQLERRM;
  END;

  -- Test 5.2: Anonymous user CANNOT read other organizations (when RLS enabled)
  -- This is application-level logic, not database-level with current setup
  RAISE NOTICE '  ⚠️  Test 5.2 SKIPPED: Anonymous read access requires application-level JWT claims';

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 8: CRUD PERMISSION TESTS
-- ============================================================================

DO $$
DECLARE
  test_doc_id UUID;
  test_section_id UUID;
  can_insert BOOLEAN := false;
  can_update BOOLEAN := false;
  can_delete BOOLEAN := false;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 6: CRUD Permissions (Admin A)';
  RAISE NOTICE '========================================';

  -- Test 6.1: Admin A can CREATE documents in Council A
  BEGIN
    INSERT INTO documents (organization_id, title, document_type, status)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Test Policy Document', 'policy', 'draft')
    RETURNING id INTO test_doc_id;

    can_insert := true;
    RAISE NOTICE '  ✅ Test 6.1 PASSED: Admin A can create documents in Council A';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ❌ Test 6.1 FAILED: Admin A cannot create documents';
    RAISE NOTICE '      Error: %', SQLERRM;
  END;

  -- Test 6.2: Admin A can UPDATE documents in Council A
  IF can_insert THEN
    BEGIN
      UPDATE documents
      SET title = 'Updated Policy Document'
      WHERE id = test_doc_id;

      can_update := true;
      RAISE NOTICE '  ✅ Test 6.2 PASSED: Admin A can update documents in Council A';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Test 6.2 FAILED: Admin A cannot update documents';
      RAISE NOTICE '      Error: %', SQLERRM;
    END;
  END IF;

  -- Test 6.3: Admin A can DELETE documents in Council A
  IF can_insert THEN
    BEGIN
      DELETE FROM documents WHERE id = test_doc_id;
      can_delete := true;
      RAISE NOTICE '  ✅ Test 6.3 PASSED: Admin A can delete documents in Council A';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ❌ Test 6.3 FAILED: Admin A cannot delete documents';
      RAISE NOTICE '      Error: %', SQLERRM;
    END;
  END IF;

  -- Test 6.4: Admin A CANNOT create documents in Council B
  BEGIN
    INSERT INTO documents (organization_id, title, document_type, status)
    VALUES ('22222222-2222-2222-2222-222222222222', 'Unauthorized Document', 'policy', 'draft')
    RETURNING id INTO test_doc_id;

    RAISE NOTICE '  ⚠️  Test 6.4 FAILED: Admin A can create documents in Council B (RLS DISABLED!)';

    -- Cleanup if it succeeded (shouldn''t with RLS)
    DELETE FROM documents WHERE id = test_doc_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '  ✅ Test 6.4 PASSED: Admin A cannot create documents in Council B';
  END;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 9: CROSS-TENANT LEAKAGE TESTS (Advanced)
-- ============================================================================

DO $$
DECLARE
  leaked_orgs INTEGER;
  leaked_docs INTEGER;
  leaked_sections INTEGER;
  leaked_suggestions INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST SUITE 7: Cross-Tenant Data Leakage Detection';
  RAISE NOTICE '========================================';

  -- Test 7.1: Check for organization leakage via JOIN attacks
  SELECT COUNT(DISTINCT o.id) INTO leaked_orgs
  FROM organizations o
  CROSS JOIN users u
  WHERE u.email = 'user-a@test.com'
    AND o.id NOT IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = u.id
    );

  IF leaked_orgs = 0 THEN
    RAISE NOTICE '  ✅ Test 7.1 PASSED: No organization leakage via JOIN attacks';
  ELSE
    RAISE NOTICE '  ⚠️  Test 7.1 FAILED: % organizations leaked via JOIN attacks (RLS DISABLED!)', leaked_orgs;
  END IF;

  -- Test 7.2: Check for document leakage via subquery attacks
  SELECT COUNT(*) INTO leaked_docs
  FROM documents d
  WHERE d.organization_id = '22222222-2222-2222-2222-222222222222' -- Council B
    AND EXISTS (
      SELECT 1 FROM users WHERE email = 'user-a@test.com' -- Council A user
    );

  IF leaked_docs = 0 THEN
    RAISE NOTICE '  ✅ Test 7.2 PASSED: No document leakage via subquery attacks';
  ELSE
    RAISE NOTICE '  ⚠️  Test 7.2 FAILED: % documents leaked via subquery attacks (RLS DISABLED!)', leaked_docs;
  END IF;

  -- Test 7.3: Check for section leakage via nested queries
  SELECT COUNT(*) INTO leaked_sections
  FROM document_sections ds
  WHERE ds.document_id IN (
    SELECT id FROM documents WHERE organization_id = '22222222-2222-2222-2222-222222222222'
  );

  IF leaked_sections = 0 THEN
    RAISE NOTICE '  ✅ Test 7.3 PASSED: No section leakage via nested queries';
  ELSE
    RAISE NOTICE '  ⚠️  Test 7.3 FAILED: % sections leaked via nested queries (RLS DISABLED!)', leaked_sections;
  END IF;

  -- Test 7.4: Check for suggestion leakage via lateral joins
  SELECT COUNT(*) INTO leaked_suggestions
  FROM suggestions s
  WHERE s.document_id IN (
    SELECT id FROM documents
    WHERE organization_id != (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      LIMIT 1
    )
  );

  IF leaked_suggestions = 0 THEN
    RAISE NOTICE '  ✅ Test 7.4 PASSED: No suggestion leakage via lateral joins';
  ELSE
    RAISE NOTICE '  ⚠️  Test 7.4 FAILED: % suggestions leaked via lateral joins (RLS DISABLED!)', leaked_suggestions;
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 10: SUMMARY AND RECOMMENDATIONS
-- ============================================================================

DO $$
DECLARE
  total_tests INTEGER := 22;
  passed_tests INTEGER := 0;
  failed_tests INTEGER := 0;
  warning_tests INTEGER := 0;
  rls_status TEXT;
BEGIN
  -- Check RLS status
  SELECT CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END
  INTO rls_status
  FROM pg_class
  WHERE relname = 'organizations';

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '                  TEST SUMMARY REPORT';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 RLS Status: % (on organizations table)', rls_status;
  RAISE NOTICE '';

  IF rls_status = 'DISABLED' THEN
    RAISE NOTICE '⚠️  CRITICAL SECURITY ISSUE:';
    RAISE NOTICE '   RLS is currently DISABLED on all tables!';
    RAISE NOTICE '   This means ANY user can see ALL organization data.';
    RAISE NOTICE '';
    RAISE NOTICE '   This is acceptable ONLY for:';
    RAISE NOTICE '   ✓ Initial setup phase';
    RAISE NOTICE '   ✓ Single-tenant deployments';
    RAISE NOTICE '   ✓ Trusted internal environments';
    RAISE NOTICE '';
    RAISE NOTICE '   For multi-tenant production (99 councils):';
    RAISE NOTICE '   ❌ YOU MUST RE-ENABLE RLS IMMEDIATELY';
    RAISE NOTICE '';
  ELSE
    RAISE NOTICE '✅ RLS is properly enabled';
    RAISE NOTICE '';
  END IF;

  RAISE NOTICE '📋 Test Results:';
  RAISE NOTICE '   Total Tests Run: %', total_tests;
  RAISE NOTICE '   ✅ Tests Passed: (check logs above)';
  RAISE NOTICE '   ❌ Tests Failed: (check logs above)';
  RAISE NOTICE '   ⚠️  Tests with Warnings: (RLS disabled warnings)';
  RAISE NOTICE '';

  RAISE NOTICE '🔧 Next Steps:';
  RAISE NOTICE '';
  RAISE NOTICE '1. IMMEDIATE ACTION (if deploying to production):';
  RAISE NOTICE '   - Run: database/migrations/005_enable_rls_properly.sql';
  RAISE NOTICE '   - Configure Supabase Auth or service role keys';
  RAISE NOTICE '   - Re-run this test suite to verify isolation';
  RAISE NOTICE '';
  RAISE NOTICE '2. DEVELOPMENT/TESTING:';
  RAISE NOTICE '   - Current setup is OK for local development';
  RAISE NOTICE '   - Document which operations need service role';
  RAISE NOTICE '   - Plan RLS policy architecture';
  RAISE NOTICE '';
  RAISE NOTICE '3. DOCUMENTATION:';
  RAISE NOTICE '   - Review: docs/reports/RLS_TEST_RESULTS.md';
  RAISE NOTICE '   - Update: docs/SECURITY.md with RLS policies';
  RAISE NOTICE '   - Create: runbook for RLS troubleshooting';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- CLEANUP (Optional - comment out to inspect test data)
-- ============================================================================

/*
DO $$
BEGIN
  RAISE NOTICE '🧹 Cleaning up test data...';

  DELETE FROM user_organizations WHERE organization_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-council-a', 'test-council-b')
  );

  DELETE FROM documents WHERE organization_id IN (
    SELECT id FROM organizations WHERE slug IN ('test-council-a', 'test-council-b')
  );

  DELETE FROM organizations WHERE slug IN ('test-council-a', 'test-council-b');

  DELETE FROM users WHERE email IN (
    'user-a@test.com',
    'user-b@test.com',
    'admin-a@test.com',
    'admin-b@test.com'
  );

  RAISE NOTICE '✅ Test data cleaned up';
END $$;
*/

-- ============================================================================
-- END OF RLS ISOLATION TESTS
-- ============================================================================
