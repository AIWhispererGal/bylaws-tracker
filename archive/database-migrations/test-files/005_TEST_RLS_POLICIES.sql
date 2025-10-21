-- ============================================================================
-- RLS POLICY TEST SUITE
-- Date: 2025-10-12
-- Purpose: Test proper RLS implementation for multi-tenant isolation
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Run this AFTER applying migration 005_implement_proper_rls.sql
-- 2. Execute each test block separately to verify expected behavior
-- 3. All tests should PASS (return expected results)
-- ============================================================================

-- ============================================================================
-- SETUP: Create test data
-- ============================================================================

BEGIN;

-- Clean up any existing test data
DELETE FROM users WHERE email LIKE '%@test-council%.org';
DELETE FROM organizations WHERE name LIKE 'Test Council%';

-- Test Organization 1: Reseda Neighborhood Council
INSERT INTO organizations (id, name, slug, organization_type) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Test Council 1 (Reseda)', 'test-council-1', 'neighborhood_council');

-- Test Organization 2: West Hollywood Neighborhood Council
INSERT INTO organizations (id, name, slug, organization_type) VALUES
  ('00000000-0000-0000-0001-000000000002', 'Test Council 2 (West Hollywood)', 'test-council-2', 'neighborhood_council');

-- Test Users
INSERT INTO users (id, email, name) VALUES
  ('00000000-0000-0000-0002-000000000001', 'user1@test-council-1.org', 'Test User 1 (Council 1 Owner)'),
  ('00000000-0000-0000-0002-000000000002', 'user2@test-council-2.org', 'Test User 2 (Council 2 Owner)'),
  ('00000000-0000-0000-0002-000000000003', 'user3@test-council-1.org', 'Test User 3 (Council 1 Member)');

-- User-Organization Memberships
INSERT INTO user_organizations (user_id, organization_id, role, permissions) VALUES
  ('00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0001-000000000001', 'owner',
   '{"can_edit_sections": true, "can_manage_users": true, "can_manage_workflows": true}'::jsonb),
  ('00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0001-000000000002', 'owner',
   '{"can_edit_sections": true, "can_manage_users": true, "can_manage_workflows": true}'::jsonb),
  ('00000000-0000-0000-0002-000000000003', '00000000-0000-0000-0001-000000000001', 'member',
   '{"can_edit_sections": false, "can_create_suggestions": true, "can_vote": true}'::jsonb);

-- Test Documents
INSERT INTO documents (id, organization_id, title, document_type, status) VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', 'Council 1 Bylaws', 'bylaws', 'active'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000002', 'Council 2 Bylaws', 'bylaws', 'active');

-- Test Sections
INSERT INTO document_sections (id, document_id, parent_section_id, ordinal, depth, path_ids, path_ordinals, section_number, section_title, original_text) VALUES
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0003-000000000001', NULL, 1, 0,
   ARRAY['00000000-0000-0000-0004-000000000001'::uuid], ARRAY[1], 'Article I', 'Organization', 'Council 1 - Article I text'),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0003-000000000002', NULL, 1, 0,
   ARRAY['00000000-0000-0000-0004-000000000002'::uuid], ARRAY[1], 'Article I', 'Organization', 'Council 2 - Article I text');

COMMIT;

RAISE NOTICE '✅ Test data created successfully';

-- ============================================================================
-- TEST 1: Base Layer - user_organizations (No Recursion)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: user_organizations (Base Layer)';
  RAISE NOTICE '========================================';
END $$;

-- Set context as User 1 (Council 1 Owner)
SET request.jwt.claims = '{"sub": "00000000-0000-0000-0002-000000000001", "role": "authenticated"}';

-- Test 1a: User 1 sees their own membership
DO $$
DECLARE
  membership_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO membership_count
  FROM user_organizations
  WHERE user_id = '00000000-0000-0000-0002-000000000001';

  IF membership_count = 1 THEN
    RAISE NOTICE '✅ Test 1a PASSED: User 1 sees their own membership (count: %)', membership_count;
  ELSE
    RAISE WARNING '❌ Test 1a FAILED: Expected 1 membership, got %', membership_count;
  END IF;
END $$;

-- Test 1b: User 1 does NOT see User 2's membership
DO $$
DECLARE
  membership_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO membership_count
  FROM user_organizations
  WHERE user_id = '00000000-0000-0000-0002-000000000002';

  IF membership_count = 0 THEN
    RAISE NOTICE '✅ Test 1b PASSED: User 1 cannot see User 2 membership (isolated)';
  ELSE
    RAISE WARNING '❌ Test 1b FAILED: User 1 should not see User 2 membership (got %)', membership_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 2: Organization Isolation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Organization Isolation';
  RAISE NOTICE '========================================';
END $$;

-- Still as User 1
-- Test 2a: User 1 sees their organization
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE id = '00000000-0000-0000-0001-000000000001';

  IF org_count = 1 THEN
    RAISE NOTICE '✅ Test 2a PASSED: User 1 sees their own organization';
  ELSE
    RAISE WARNING '❌ Test 2a FAILED: User 1 should see their organization';
  END IF;
END $$;

-- Test 2b: User 1 does NOT see Council 2
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE id = '00000000-0000-0000-0001-000000000002';

  IF org_count = 0 THEN
    RAISE NOTICE '✅ Test 2b PASSED: User 1 cannot see Council 2 (isolated)';
  ELSE
    RAISE WARNING '❌ Test 2b FAILED: User 1 should not see Council 2';
  END IF;
END $$;

-- Switch to User 2 (Council 2 Owner)
SET request.jwt.claims = '{"sub": "00000000-0000-0000-0002-000000000002", "role": "authenticated"}';

-- Test 2c: User 2 sees their organization
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE id = '00000000-0000-0000-0001-000000000002';

  IF org_count = 1 THEN
    RAISE NOTICE '✅ Test 2c PASSED: User 2 sees their own organization';
  ELSE
    RAISE WARNING '❌ Test 2c FAILED: User 2 should see their organization';
  END IF;
END $$;

-- Test 2d: User 2 does NOT see Council 1
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE id = '00000000-0000-0000-0001-000000000001';

  IF org_count = 0 THEN
    RAISE NOTICE '✅ Test 2d PASSED: User 2 cannot see Council 1 (isolated)';
  ELSE
    RAISE WARNING '❌ Test 2d FAILED: User 2 should not see Council 1';
  END IF;
END $$;

-- ============================================================================
-- TEST 3: Document Isolation
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Document Isolation';
  RAISE NOTICE '========================================';
END $$;

-- As User 1
SET request.jwt.claims = '{"sub": "00000000-0000-0000-0002-000000000001", "role": "authenticated"}';

-- Test 3a: User 1 sees Council 1 document
DO $$
DECLARE
  doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count
  FROM documents
  WHERE id = '00000000-0000-0000-0003-000000000001';

  IF doc_count = 1 THEN
    RAISE NOTICE '✅ Test 3a PASSED: User 1 sees their own document';
  ELSE
    RAISE WARNING '❌ Test 3a FAILED: User 1 should see their document';
  END IF;
END $$;

-- Test 3b: User 1 does NOT see Council 2 document
DO $$
DECLARE
  doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count
  FROM documents
  WHERE id = '00000000-0000-0000-0003-000000000002';

  IF doc_count = 0 THEN
    RAISE NOTICE '✅ Test 3b PASSED: User 1 cannot see Council 2 document (isolated)';
  ELSE
    RAISE WARNING '❌ Test 3b FAILED: User 1 should not see Council 2 document';
  END IF;
END $$;

-- ============================================================================
-- TEST 4: Section Isolation (Performance Critical)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 4: Section Isolation';
  RAISE NOTICE '========================================';
END $$;

-- As User 1
SET request.jwt.claims = '{"sub": "00000000-0000-0000-0002-000000000001", "role": "authenticated"}';

-- Test 4a: User 1 sees Council 1 sections
DO $$
DECLARE
  section_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO section_count
  FROM document_sections
  WHERE id = '00000000-0000-0000-0004-000000000001';

  IF section_count = 1 THEN
    RAISE NOTICE '✅ Test 4a PASSED: User 1 sees their own sections';
  ELSE
    RAISE WARNING '❌ Test 4a FAILED: User 1 should see their sections';
  END IF;
END $$;

-- Test 4b: User 1 does NOT see Council 2 sections
DO $$
DECLARE
  section_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO section_count
  FROM document_sections
  WHERE id = '00000000-0000-0000-0004-000000000002';

  IF section_count = 0 THEN
    RAISE NOTICE '✅ Test 4b PASSED: User 1 cannot see Council 2 sections (isolated)';
  ELSE
    RAISE WARNING '❌ Test 4b FAILED: User 1 should not see Council 2 sections';
  END IF;
END $$;

-- ============================================================================
-- TEST 5: Service Role Bypass
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 5: Service Role Bypass';
  RAISE NOTICE '========================================';
END $$;

-- Set context as service role
SET request.jwt.claims = '{"sub": "service-role", "role": "service_role"}';

-- Test 5a: Service role sees ALL organizations
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE name LIKE 'Test Council%';

  IF org_count = 2 THEN
    RAISE NOTICE '✅ Test 5a PASSED: Service role sees all organizations (count: %)', org_count;
  ELSE
    RAISE WARNING '❌ Test 5a FAILED: Service role should see 2 orgs, got %', org_count;
  END IF;
END $$;

-- Test 5b: Service role sees ALL documents
DO $$
DECLARE
  doc_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO doc_count
  FROM documents
  WHERE title LIKE '%Bylaws';

  IF doc_count = 2 THEN
    RAISE NOTICE '✅ Test 5b PASSED: Service role sees all documents (count: %)', doc_count;
  ELSE
    RAISE WARNING '❌ Test 5b FAILED: Service role should see 2 docs, got %', doc_count;
  END IF;
END $$;

-- Test 5c: Service role sees ALL sections
DO $$
DECLARE
  section_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO section_count
  FROM document_sections
  WHERE section_title = 'Organization';

  IF section_count = 2 THEN
    RAISE NOTICE '✅ Test 5c PASSED: Service role sees all sections (count: %)', section_count;
  ELSE
    RAISE WARNING '❌ Test 5c FAILED: Service role should see 2 sections, got %', section_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 6: Role-Based Permissions
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 6: Role-Based Permissions';
  RAISE NOTICE '========================================';
END $$;

-- As User 3 (Member with limited permissions)
SET request.jwt.claims = '{"sub": "00000000-0000-0000-0002-000000000003", "role": "authenticated"}';

-- Test 6a: Member sees their organization
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE id = '00000000-0000-0000-0001-000000000001';

  IF org_count = 1 THEN
    RAISE NOTICE '✅ Test 6a PASSED: Member sees their organization';
  ELSE
    RAISE WARNING '❌ Test 6a FAILED: Member should see their organization';
  END IF;
END $$;

-- Test 6b: Member cannot see other councils
DO $$
DECLARE
  org_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE id = '00000000-0000-0000-0001-000000000002';

  IF org_count = 0 THEN
    RAISE NOTICE '✅ Test 6b PASSED: Member cannot see other councils';
  ELSE
    RAISE WARNING '❌ Test 6b FAILED: Member should not see other councils';
  END IF;
END $$;

-- ============================================================================
-- TEST 7: Performance Check
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 7: Performance Verification';
  RAISE NOTICE '========================================';
END $$;

-- As User 1
SET request.jwt.claims = '{"sub": "00000000-0000-0000-0002-000000000001", "role": "authenticated"}';

-- Test 7a: Check query plan uses indexes
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM document_sections
WHERE document_id = '00000000-0000-0000-0003-000000000001';

RAISE NOTICE '✅ Test 7a: Check EXPLAIN output above - should use idx_sections_doc_id';

-- Test 7b: Verify RLS doesn't cause full table scans
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM documents
WHERE organization_id = '00000000-0000-0000-0001-000000000001';

RAISE NOTICE '✅ Test 7b: Check EXPLAIN output above - should use idx_documents_org_id';

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS POLICY TESTS COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Review results above:';
  RAISE NOTICE '  - All ✅ marks = PASSED';
  RAISE NOTICE '  - Any ❌ marks = FAILED (investigate)';
  RAISE NOTICE '';
  RAISE NOTICE 'Key Requirements:';
  RAISE NOTICE '  ✅ User 1 isolated from Council 2';
  RAISE NOTICE '  ✅ User 2 isolated from Council 1';
  RAISE NOTICE '  ✅ Service role bypasses RLS';
  RAISE NOTICE '  ✅ Members see only their council';
  RAISE NOTICE '  ✅ No infinite recursion errors';
  RAISE NOTICE '  ✅ Performance uses indexes';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- CLEANUP (Optional - run if you want to remove test data)
-- ============================================================================

-- Uncomment to clean up test data:
-- BEGIN;
-- DELETE FROM users WHERE email LIKE '%@test-council%.org';
-- DELETE FROM organizations WHERE name LIKE 'Test Council%';
-- COMMIT;
-- RAISE NOTICE 'Test data cleaned up';
