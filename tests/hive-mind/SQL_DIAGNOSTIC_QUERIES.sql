-- ============================================================================
-- RLS Recursion Diagnostic SQL Queries
-- ============================================================================
-- Purpose: Execute these queries in Supabase SQL Editor to diagnose recursion
-- Agent: Tester
-- Session: swarm-1761672858022-3dg3qahxf
-- Created: 2025-10-28
-- ============================================================================

-- ============================================================================
-- PHASE 1: DISCOVERY TESTS (Run these first)
-- ============================================================================

-- TEST A1: Current Policy Inventory
-- Expected: 5-7 policies, single version
-- Recursion indicator: Multiple version suffixes (v2, v3) or old policy names
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 100) AS using_clause_preview,
  LEFT(with_check::text, 100) AS with_check_preview
FROM pg_policies
WHERE tablename = 'user_organizations'
ORDER BY policyname;

-- ANALYSIS CHECKLIST:
-- [ ] How many policies exist? ___________
-- [ ] Version suffix present? (none / v2 / v3) ___________
-- [ ] Any old policy names from migration 003 or 004? ___________

-- ============================================================================
-- TEST A2: Detect Recursive Policy Patterns
-- Expected: USES_FUNCTION for admin policies, SIMPLE for user policies
-- Recursion indicator: RECURSIVE pattern detected
-- ============================================================================
SELECT
  policyname,
  CASE
    WHEN qual::text LIKE '%FROM user_organizations%' THEN '🚨 RECURSIVE'
    WHEN qual::text LIKE '%is_org_admin%' THEN '✓ USES_FUNCTION'
    WHEN qual::text LIKE '%auth.uid()%' THEN '✓ SIMPLE'
    ELSE '⚠️ UNKNOWN'
  END AS pattern_type,
  qual::text AS full_using_clause
FROM pg_policies
WHERE tablename = 'user_organizations'
  AND qual IS NOT NULL
ORDER BY pattern_type, policyname;

-- CRITICAL: If ANY policy shows "🚨 RECURSIVE", recursion is present!

-- ============================================================================
-- TEST A3: RLS Enable Status
-- Expected: rls_enabled = true
-- ============================================================================
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity THEN '✓ RLS Active'
    ELSE '⚠️ RLS Disabled'
  END AS status
FROM pg_tables
WHERE tablename = 'user_organizations';

-- ============================================================================
-- TEST B1: SECURITY DEFINER Function Inventory
-- Expected: One function (is_org_admin or is_org_admin_for_org) in public schema
-- Recursion indicator: No functions found OR wrong schema (auth)
-- ============================================================================
SELECT
  routine_schema,
  routine_name,
  routine_type,
  security_type,
  data_type,
  CASE
    WHEN security_type = 'DEFINER' THEN '✓ Bypass RLS'
    ELSE '⚠️ No Bypass'
  END AS bypass_status,
  LEFT(routine_definition::text, 200) AS definition_preview
FROM information_schema.routines
WHERE routine_name IN ('is_org_admin', 'is_org_admin_for_org', 'user_is_org_admin')
   OR routine_definition LIKE '%user_organizations%'
ORDER BY routine_schema, routine_name;

-- ANALYSIS CHECKLIST:
-- [ ] Function exists? (yes/no) ___________
-- [ ] Schema: (public / auth / none) ___________
-- [ ] Security type: (DEFINER / INVOKER) ___________
-- [ ] Queries user_organizations? (yes/no) ___________

-- ============================================================================
-- TEST B2: Function Execution Test
-- Expected: Returns false without error
-- Recursion indicator: Timeout or "infinite recursion" error
-- ============================================================================
-- Replace function name with result from TEST B1

-- For is_org_admin_for_org:
SELECT
  is_org_admin_for_org(
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  ) AS can_execute,
  'Function executed successfully' AS status;

-- For public.is_org_admin (from migration 005):
-- SELECT
--   public.is_org_admin(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     '00000000-0000-0000-0000-000000000000'::uuid
--   ) AS can_execute;

-- If timeout occurs: Function is causing recursion or doesn't exist

-- ============================================================================
-- TEST B3: Function Privilege Check
-- Expected: authenticated and service_role have EXECUTE
-- ============================================================================
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type,
  CASE
    WHEN grantee = 'authenticated' AND privilege_type = 'EXECUTE' THEN '✓ Good'
    WHEN grantee = 'service_role' AND privilege_type = 'EXECUTE' THEN '✓ Good'
    ELSE '⚠️ Check Needed'
  END AS status
FROM information_schema.routine_privileges
WHERE routine_name IN ('is_org_admin', 'is_org_admin_for_org', 'user_is_org_admin')
ORDER BY routine_name, grantee;

-- ============================================================================
-- PHASE 2: ISOLATION TESTS (Run if Phase 1 shows potential issues)
-- ============================================================================

-- TEST D1: Test User Own Membership Query Performance
-- Expected: <10ms execution time, simple index scan
-- Recursion indicator: >100ms or timeout
-- ============================================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM user_organizations
WHERE user_id = auth.uid()
LIMIT 10;

-- ANALYSIS CHECKLIST:
-- [ ] Execution Time: ___________ ms
-- [ ] Planning Time: ___________ ms
-- [ ] Uses Index? (yes/no) ___________
-- [ ] SubPlan present? (yes/no) ___________
-- [ ] Nested Loop on user_organizations? (yes/no) ___________

-- ============================================================================
-- TEST D2: Test Admin View All Org Members Performance
-- Expected: <50ms, uses function call, no nested loops
-- Recursion indicator: Timeout or nested user_organizations scan
-- ============================================================================
-- Replace UUIDs with actual test data
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT * FROM user_organizations
WHERE organization_id = '00000000-0000-0000-0000-000000000999'
LIMIT 10;

-- CRITICAL ANALYSIS:
-- [ ] Execution Time: ___________ ms
-- [ ] Shows function call (is_org_admin_for_org)? (yes/no) ___________
-- [ ] Nested Loop on user_organizations? (yes/no) ___________
-- [ ] SubPlan with user_organizations? (yes/no) ___________

-- ============================================================================
-- TEST D3: Performance Benchmark (10 Iterations)
-- Expected: Consistent 1-10ms per query
-- Recursion indicator: Increasing times or timeout
-- ============================================================================
DO $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  duration_ms numeric;
  i integer;
BEGIN
  RAISE NOTICE 'Starting performance benchmark...';

  FOR i IN 1..10 LOOP
    start_time := clock_timestamp();

    -- Test query: user sees own memberships
    PERFORM * FROM user_organizations WHERE user_id = auth.uid();

    end_time := clock_timestamp();
    duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time));

    RAISE NOTICE 'Iteration %: %.2f ms', i, duration_ms;
  END LOOP;

  RAISE NOTICE 'Benchmark complete';
END $$;

-- ANALYSIS:
-- [ ] Average time: ___________ ms
-- [ ] Consistent times? (yes/no) ___________
-- [ ] Any timeouts? (yes/no) ___________

-- ============================================================================
-- PHASE 3: DEEP DIVE (Run if recursion detected)
-- ============================================================================

-- TEST F1: Find Circular Policy References
-- Shows which policies reference user_organizations in their definitions
-- ============================================================================
WITH policy_details AS (
  SELECT
    policyname,
    qual::text AS using_clause,
    with_check::text AS check_clause
  FROM pg_policies
  WHERE tablename = 'user_organizations'
)
SELECT
  policyname,
  'USING clause' AS clause_type,
  using_clause AS clause_content
FROM policy_details
WHERE using_clause LIKE '%user_organizations%'
UNION ALL
SELECT
  policyname,
  'WITH CHECK clause' AS clause_type,
  check_clause
FROM policy_details
WHERE check_clause LIKE '%user_organizations%'
ORDER BY policyname, clause_type;

-- CRITICAL: Any results = circular reference = recursion!

-- ============================================================================
-- TEST F2: Check for Global Admin Function
-- Migration 008c references is_global_admin function
-- ============================================================================
SELECT
  routine_schema,
  routine_name,
  security_type,
  routine_definition::text AS definition
FROM information_schema.routines
WHERE routine_name = 'is_global_admin';

-- Expected: If exists, should be SECURITY DEFINER

-- ============================================================================
-- TEST F3: Verify Migration History
-- Check which migrations have been applied
-- ============================================================================
SELECT
  version,
  description,
  installed_on,
  execution_time,
  success
FROM supabase_migrations.schema_migrations
WHERE description LIKE '%rls%' OR description LIKE '%recursion%'
ORDER BY installed_on DESC;

-- Note: This table may not exist in all Supabase projects
-- If error occurs, migrations are not tracked

-- ============================================================================
-- TEST F4: Count User Organizations Records
-- Verify table has data
-- ============================================================================
SELECT
  COUNT(*) AS total_records,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT organization_id) AS unique_orgs,
  COUNT(CASE WHEN role = 'owner' THEN 1 END) AS owners,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) AS admins,
  COUNT(CASE WHEN is_active THEN 1 END) AS active_memberships
FROM user_organizations;

-- Baseline data context

-- ============================================================================
-- EMERGENCY DIAGNOSTICS (If recursion is blocking everything)
-- ============================================================================

-- EMERGENCY TEST E1: Bypass RLS Completely (Service Role)
-- This should always work - if it fails, database corruption
-- ============================================================================
SET ROLE service_role;
SELECT COUNT(*) AS total_user_orgs FROM user_organizations;
RESET ROLE;

-- Expected: Returns count without error

-- ============================================================================
-- EMERGENCY TEST E2: Disable RLS Temporarily (DANGER - Testing Only!)
-- DO NOT RUN IN PRODUCTION unless critical diagnosis needed
-- ============================================================================
-- ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
-- SELECT * FROM user_organizations LIMIT 5;
-- ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Uncomment ONLY if all other tests fail and you need to verify table access

-- ============================================================================
-- VALIDATION QUERIES (Run after fix applied)
-- ============================================================================

-- VALIDATION V1: Verify No Recursive Patterns
SELECT
  policyname,
  CASE
    WHEN qual::text LIKE '%FROM user_organizations%' THEN '❌ Still Recursive!'
    WHEN qual::text LIKE '%is_org_admin%' THEN '✓ Fixed - Uses Function'
    ELSE '✓ Fixed - Simple'
  END AS fix_status
FROM pg_policies
WHERE tablename = 'user_organizations'
  AND qual IS NOT NULL;

-- Expected: No "❌ Still Recursive!" entries

-- VALIDATION V2: Test Performance After Fix
EXPLAIN ANALYZE
SELECT * FROM user_organizations WHERE user_id = auth.uid();

-- Expected: <10ms execution time

-- VALIDATION V3: Verify Function Exists and Works
SELECT
  is_org_admin_for_org(auth.uid(), organization_id) AS is_admin,
  organization_id
FROM user_organizations
LIMIT 1;

-- Expected: Returns boolean without error

-- ============================================================================
-- RESULT SUMMARY TEMPLATE
-- ============================================================================

-- Copy this template and fill in results:

/*
DIAGNOSTIC TEST RESULTS
=======================
Date: ___________
Tester: ___________

PHASE 1: DISCOVERY
------------------
A1 - Policy Count: _______
A1 - Version Suffix: _______
A2 - Recursive Patterns: [ ] Yes [ ] No
A3 - RLS Enabled: [ ] Yes [ ] No
B1 - Function Exists: [ ] Yes [ ] No
B1 - Function Schema: _______
B1 - Security Type: _______
B2 - Function Executes: [ ] Yes [ ] No [ ] Timeout
B3 - Privileges Granted: [ ] Yes [ ] No

PHASE 2: ISOLATION
------------------
D1 - Execution Time: _______ ms
D2 - Execution Time: _______ ms
D3 - Avg Time: _______ ms
D3 - Consistent: [ ] Yes [ ] No

PHASE 3: DEEP DIVE
------------------
F1 - Circular Refs: [ ] Found [ ] None
F2 - Global Admin Fn: [ ] Exists [ ] Missing
F3 - Migration History: _______
F4 - Total Records: _______

CONCLUSION
----------
Recursion Present: [ ] Yes [ ] No
Root Cause: _______________________________
Recommended Fix: __________________________

EVIDENCE
--------
Error Messages: ___________________________
Query Plans: ______________________________
Performance: ______________________________
*/

-- ============================================================================
-- END OF DIAGNOSTIC QUERIES
-- ============================================================================
