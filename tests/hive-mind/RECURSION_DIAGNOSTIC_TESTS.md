# Recursion Issue Diagnostic Tests
**Created:** 2025-10-28
**Agent:** Tester
**Session:** swarm-1761672858022-3dg3qahxf

## Executive Summary

Based on analysis of migrations 003-008c, the RLS recursion issue has a clear pattern:
- **Root Cause:** Policies on `user_organizations` that query `user_organizations` create circular references
- **Multiple Fix Attempts:** Migrations 004, 005, and 008c all attempted to fix using SECURITY DEFINER functions
- **Current State:** Unknown which migration is actually applied in production

## Test Strategy Overview

```
┌─────────────────────────────────────────────────────────┐
│ TEST SUITE: RLS Recursion Diagnostics                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  A. Policy State Analysis (SQL)                        │
│     → Identify which policies are currently active     │
│     → Check for recursive patterns                     │
│                                                         │
│  B. Function State Analysis (SQL)                      │
│     → Verify SECURITY DEFINER functions exist         │
│     → Test function execution isolation               │
│                                                         │
│  C. Setup Flow Reproduction (JS)                       │
│     → Mock setup.js workflow                          │
│     → Isolate user-organization linking               │
│                                                         │
│  D. Direct Policy Testing (SQL)                        │
│     → Test each policy individually                    │
│     → Measure query execution time                    │
│     → Detect recursion patterns                       │
│                                                         │
│  E. Integration Test (Full Flow)                       │
│     → Complete setup wizard simulation                │
│     → Monitor for recursion errors                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Test Suite A: Policy State Analysis

### TEST A1: Current Policy Inventory
**Purpose:** Identify which policies are active on user_organizations
**Expected:** Should see policies from ONE migration only
**Actual:** TBD

```sql
-- TEST A1: List all active policies on user_organizations
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,  -- USING clause
  with_check  -- WITH CHECK clause
FROM pg_policies
WHERE tablename = 'user_organizations'
ORDER BY policyname;

-- ANALYSIS QUESTIONS:
-- 1. How many policies exist? (Expected: 5-7)
-- 2. Which version suffix? (v2, v3, or none?)
-- 3. Do any USING/WITH CHECK clauses contain subqueries on user_organizations?
```

### TEST A2: Detect Recursive Policy Patterns
**Purpose:** Find policies that query user_organizations within their USING clause
**Expected:** If 005 or 008c applied correctly, should use function calls only
**Actual:** TBD

```sql
-- TEST A2: Detect recursive subqueries in policies
SELECT
  policyname,
  CASE
    WHEN qual::text LIKE '%FROM user_organizations%' THEN 'RECURSIVE'
    WHEN qual::text LIKE '%is_org_admin%' THEN 'USES_FUNCTION'
    WHEN qual::text LIKE '%auth.uid()%' THEN 'SIMPLE'
    ELSE 'UNKNOWN'
  END AS pattern_type,
  qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'user_organizations'
  AND qual IS NOT NULL
ORDER BY pattern_type, policyname;

-- EXPECTED RESULTS:
-- - "USES_FUNCTION" for admin policies (good - no recursion)
-- - "SIMPLE" for user self-access policies (good)
-- - "RECURSIVE" = PROBLEM DETECTED
```

### TEST A3: RLS Enable Status
**Purpose:** Verify RLS is actually enabled
**Expected:** rowsecurity = true
**Actual:** TBD

```sql
-- TEST A3: Verify RLS is enabled on user_organizations
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'user_organizations';

-- EXPECTED: rls_enabled = true
```

---

## Test Suite B: Function State Analysis

### TEST B1: SECURITY DEFINER Function Inventory
**Purpose:** Check which helper functions exist
**Expected:** One of: is_org_admin, is_org_admin_for_org, or public.is_org_admin
**Actual:** TBD

```sql
-- TEST B1: List all SECURITY DEFINER functions for org admin checks
SELECT
  routine_schema,
  routine_name,
  routine_type,
  security_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name IN ('is_org_admin', 'is_org_admin_for_org')
   OR routine_definition LIKE '%user_organizations%'
ORDER BY routine_schema, routine_name;

-- ANALYSIS QUESTIONS:
-- 1. Which schema? (public, auth, or none?)
-- 2. Is security_type = 'DEFINER'? (Required for bypass)
-- 3. Does definition query user_organizations?
```

### TEST B2: Function Execution Test (Bypass RLS)
**Purpose:** Verify function can query user_organizations without triggering policies
**Expected:** Function returns boolean without recursion
**Actual:** TBD

```sql
-- TEST B2: Test function execution
-- Replace with actual function name from TEST B1
SELECT
  is_org_admin_for_org(
    '00000000-0000-0000-0000-000000000000'::uuid,  -- test user
    '00000000-0000-0000-0000-000000000000'::uuid   -- test org
  ) AS can_execute_without_error;

-- EXPECTED: Returns false (or true) without error
-- RECURSION ERROR: Would timeout or throw "infinite recursion" error
```

### TEST B3: Function Privilege Check
**Purpose:** Verify authenticated role can execute the function
**Expected:** EXECUTE privilege granted to authenticated
**Actual:** TBD

```sql
-- TEST B3: Check function privileges
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name IN ('is_org_admin', 'is_org_admin_for_org')
ORDER BY routine_name, grantee;

-- EXPECTED: authenticated and service_role should have EXECUTE
```

---

## Test Suite C: Setup Flow Reproduction

### TEST C1: Mock Organization Creation
**Purpose:** Isolate the first step of setup - creating organization
**Expected:** Organization created successfully
**Actual:** TBD

```javascript
// FILE: tests/unit/setup-service-mock.test.js
const { createClient } = require('@supabase/supabase-js');

describe('Setup Service - Organization Creation', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  });

  test('C1: Create organization without user link', async () => {
    const orgData = {
      name: 'Test Recursion Org',
      org_type: 'neighborhood-council',
      settings: {},
      is_configured: false
    };

    const { data, error } = await supabase
      .from('organizations')
      .insert(orgData)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toHaveProperty('id');
    expect(data.name).toBe('Test Recursion Org');

    // Cleanup
    await supabase.from('organizations').delete().eq('id', data.id);
  });
});
```

### TEST C2: Mock User-Organization Link
**Purpose:** Isolate the step that triggers recursion - linking user to org
**Expected:** If recursion exists, this will fail
**Actual:** TBD

```javascript
// FILE: tests/unit/setup-user-org-link.test.js
describe('Setup Service - User Organization Link', () => {
  let supabase, testUserId, testOrgId;

  beforeAll(async () => {
    // Use service role to bypass RLS for setup
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Create test org
    const { data: org } = await supabase
      .from('organizations')
      .insert({ name: 'Test Org', is_configured: false })
      .select()
      .single();
    testOrgId = org.id;

    // Create test user (or use existing)
    testUserId = '00000000-0000-0000-0000-000000000001';
  });

  afterAll(async () => {
    await supabase.from('user_organizations').delete().eq('organization_id', testOrgId);
    await supabase.from('organizations').delete().eq('id', testOrgId);
  });

  test('C2: Link user to organization as owner', async () => {
    const { data, error } = await supabase
      .from('user_organizations')
      .insert({
        user_id: testUserId,
        organization_id: testOrgId,
        role: 'owner',
        is_active: true
      })
      .select()
      .single();

    // THIS IS WHERE RECURSION WOULD OCCUR
    expect(error).toBeNull();
    expect(data).toHaveProperty('id');
    expect(data.user_id).toBe(testUserId);
    expect(data.organization_id).toBe(testOrgId);
  });

  test('C3: Query user_organizations after link', async () => {
    // Switch to authenticated user context (this triggers RLS)
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${testUserToken}` } } }
    );

    const { data, error } = await userSupabase
      .from('user_organizations')
      .select('*')
      .eq('user_id', testUserId);

    // RECURSION WOULD CAUSE TIMEOUT OR ERROR HERE
    expect(error).toBeNull();
    expect(data.length).toBeGreaterThan(0);
  });
});
```

---

## Test Suite D: Direct Policy Testing

### TEST D1: Test Individual Policy Execution
**Purpose:** Test each policy in isolation
**Expected:** All policies execute without recursion
**Actual:** TBD

```sql
-- TEST D1: Test user's own membership policy
-- This should be fast (<10ms) and never recurse
SET ROLE authenticated;
SET request.jwt.claims.sub TO '00000000-0000-0000-0000-000000000001';

EXPLAIN ANALYZE
SELECT * FROM user_organizations WHERE user_id = auth.uid();

-- ANALYSIS:
-- 1. Execution time: <10ms = good, >100ms = problem
-- 2. Query plan: Should show simple index scan
-- 3. No "SubPlan" with user_organizations = good
```

### TEST D2: Test Admin Policy Execution
**Purpose:** Test policy that historically caused recursion
**Expected:** Uses function, no recursion
**Actual:** TBD

```sql
-- TEST D2: Test admin viewing all org members
-- If using SECURITY DEFINER function: fast
-- If recursive: timeout or error

SET ROLE authenticated;
SET request.jwt.claims.sub TO '<admin-user-uuid>';

EXPLAIN ANALYZE
SELECT * FROM user_organizations
WHERE organization_id = '<test-org-uuid>';

-- ANALYSIS:
-- 1. Check for function call in query plan (good)
-- 2. Check for nested loop on user_organizations (bad - recursion)
-- 3. Execution time: <50ms = good, timeout = recursion
```

### TEST D3: Measure Policy Performance
**Purpose:** Detect performance degradation from recursion
**Expected:** Consistent sub-50ms response times
**Actual:** TBD

```sql
-- TEST D3: Benchmark policy performance
DO $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  i integer;
BEGIN
  FOR i IN 1..10 LOOP
    start_time := clock_timestamp();

    PERFORM * FROM user_organizations WHERE user_id = auth.uid();

    end_time := clock_timestamp();
    RAISE NOTICE 'Iteration %: % ms', i, EXTRACT(MILLISECONDS FROM (end_time - start_time));
  END LOOP;
END $$;

-- EXPECTED: Consistent 1-10ms per query
-- RECURSION: Increasing times or timeout
```

---

## Test Suite E: Integration Test (Full Flow)

### TEST E1: Complete Setup Wizard Simulation
**Purpose:** End-to-end test of entire setup process
**Expected:** Setup completes without recursion errors
**Actual:** TBD

```javascript
// FILE: tests/integration/setup-wizard-flow.test.js
describe('Setup Wizard - Full Flow', () => {
  let supabase, testUser, testOrg;

  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  });

  test('E1: Complete setup wizard without recursion', async () => {
    // Step 1: Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Integration Test Org',
        org_type: 'neighborhood-council',
        is_configured: false
      })
      .select()
      .single();

    expect(orgError).toBeNull();
    testOrg = org;

    // Step 2: Link user to organization (CRITICAL STEP)
    const { data: userOrg, error: linkError } = await supabase
      .from('user_organizations')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000001',
        organization_id: org.id,
        role: 'owner',
        is_active: true
      })
      .select()
      .single();

    expect(linkError).toBeNull();  // RECURSION WOULD FAIL HERE

    // Step 3: Configure hierarchy
    const { error: hierError } = await supabase
      .from('organizations')
      .update({
        hierarchy_config: {
          levels: [
            { name: 'Article', type: 'article', depth: 0 },
            { name: 'Section', type: 'section', depth: 1 }
          ]
        }
      })
      .eq('id', org.id);

    expect(hierError).toBeNull();

    // Step 4: Create workflow template
    const { data: workflow, error: workflowError } = await supabase
      .from('workflow_templates')
      .insert({
        organization_id: org.id,
        name: 'Default Workflow',
        is_default: true,
        is_active: true
      })
      .select()
      .single();

    expect(workflowError).toBeNull();

    // Step 5: Mark as configured
    const { error: completeError } = await supabase
      .from('organizations')
      .update({ is_configured: true })
      .eq('id', org.id);

    expect(completeError).toBeNull();

    // Cleanup
    await supabase.from('workflow_templates').delete().eq('id', workflow.id);
    await supabase.from('user_organizations').delete().eq('organization_id', org.id);
    await supabase.from('organizations').delete().eq('id', org.id);
  });
});
```

---

## Test Execution Plan

### Phase 1: Discovery (SQL Tests - 5 minutes)
```bash
# Run in Supabase SQL Editor or psql
1. Execute TEST A1 - Current Policy Inventory
2. Execute TEST A2 - Detect Recursive Patterns
3. Execute TEST A3 - RLS Status
4. Execute TEST B1 - Function Inventory
5. Execute TEST B2 - Function Execution
6. Execute TEST B3 - Function Privileges
```

**Stop Point:** If TEST A2 shows "RECURSIVE" patterns, we've found the issue.

### Phase 2: Isolation (SQL Tests - 10 minutes)
```bash
# Run with test user credentials
7. Execute TEST D1 - User Own Membership
8. Execute TEST D2 - Admin View Members
9. Execute TEST D3 - Performance Benchmark
```

**Stop Point:** If timeouts occur in D2, recursion confirmed.

### Phase 3: Reproduction (JS Tests - 15 minutes)
```bash
# Run Jest tests
npm test tests/unit/setup-service-mock.test.js
npm test tests/unit/setup-user-org-link.test.js
```

**Stop Point:** If C2 fails with "infinite recursion", exact trigger identified.

### Phase 4: Validation (Integration Test - 10 minutes)
```bash
# Full flow test
npm test tests/integration/setup-wizard-flow.test.js
```

**Stop Point:** If passes, issue is intermittent or environment-specific.

---

## Expected Test Results Matrix

| Test ID | No Recursion | Recursion Present | Notes |
|---------|--------------|-------------------|-------|
| A1 | 5-7 policies | Mixed versions | Policy cleanup needed |
| A2 | USES_FUNCTION | RECURSIVE | Direct evidence |
| A3 | true | true | RLS always enabled |
| B1 | 1 function | 0 or multiple | Function state |
| B2 | Returns boolean | Timeout/error | Bypass working? |
| B3 | EXECUTE granted | Missing grants | Permission issue |
| D1 | <10ms | >100ms or timeout | User policy |
| D2 | <50ms | Timeout | Admin policy |
| D3 | Consistent | Increasing times | Performance |
| C2 | Success | Recursion error | Link trigger |
| E1 | All pass | Fails at link | Full flow |

---

## Diagnostic Output Format

For each test, document:

```
TEST_CASE: [A1, A2, B1, etc.]
PURPOSE: [What it tests]
QUERY/CODE: [SQL or JS used]
EXPECTED: [Expected result]
ACTUAL: [Actual result from production]
STATUS: [PASS / FAIL / BLOCKED]
EVIDENCE: [Error messages, query plans, timings]
CONCLUSION: [What this tells us]
```

---

## Next Steps After Testing

### If Recursion Detected (TEST A2 = "RECURSIVE"):
1. Apply migration 008c to fix policies
2. Re-run TEST A2 to verify fix
3. Run TEST D2 to confirm no timeout
4. Run TEST E1 to validate full flow

### If No Recursion (All tests pass):
1. Issue may be intermittent or environment-specific
2. Check Supabase logs for actual error messages
3. Test with actual production user credentials
4. Investigate if issue occurs only during specific operations

### If Functions Missing (TEST B1 = 0 rows):
1. Apply migration 005 or 008c
2. Verify function creation with TEST B1
3. Re-run policy tests (D1, D2)

---

## Test Data Requirements

### Minimal Test Data Setup:
```sql
-- Create test organization
INSERT INTO organizations (id, name, is_configured)
VALUES ('00000000-0000-0000-0000-000000000999', 'Test Org', false);

-- Create test user-org link (THIS IS WHERE RECURSION OCCURS)
INSERT INTO user_organizations (user_id, organization_id, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',  -- test user
  '00000000-0000-0000-0000-000000000999',  -- test org
  'owner',
  true
);
```

### Cleanup:
```sql
DELETE FROM user_organizations WHERE organization_id = '00000000-0000-0000-0000-000000000999';
DELETE FROM organizations WHERE id = '00000000-0000-0000-0000-000000000999';
```

---

## Appendix: Historical Context

### Migration Timeline:
1. **003_enable_user_organizations_rls.sql**: Enabled RLS, created recursive policies
2. **004_fix_rls_recursion.sql**: First fix attempt - tried auth schema function (failed)
3. **005_fix_rls_recursion_safe.sql**: Second attempt - public schema SECURITY DEFINER
4. **008c_fix_recursion_properly.sql**: Third attempt - improved function approach

### Known Issues:
- Multiple migrations may have been partially applied
- No clear rollback history
- Function names changed between migrations (is_org_admin vs is_org_admin_for_org)
- Policy names have version suffixes (v2, v3) indicating multiple attempts

---

## Summary

This test suite provides:
1. **Rapid diagnosis** - 5 minutes to identify recursion
2. **Precise isolation** - Pinpoint exact policy causing issue
3. **Reproducible cases** - JS tests for CI/CD integration
4. **Clear evidence** - Query plans and timings
5. **Fix validation** - Re-run tests after applying migration

**Next Action:** Execute Phase 1 (Discovery) SQL tests in Supabase SQL Editor.
