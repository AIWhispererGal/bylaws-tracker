-- ============================================================================
-- DIAGNOSE WHY RLS POLICY IS FAILING
-- Issue: INSERT policy exists but still getting RLS violation
-- ============================================================================

-- ============================================================================
-- 1. Show ALL policies on suggestion_sections in detail
-- ============================================================================
SELECT
    policyname,
    cmd as command,
    roles,
    permissive,
    qual::text as using_clause,
    with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'suggestion_sections'
ORDER BY cmd, policyname;

-- ============================================================================
-- 2. Check for RESTRICTIVE policies (these can block even if permissive allows)
-- ============================================================================
SELECT
    policyname,
    cmd,
    permissive,
    CASE
        WHEN permissive = 'PERMISSIVE' THEN '✓ Allows access if condition met'
        WHEN permissive = 'RESTRICTIVE' THEN '⚠️ BLOCKS access - must ALL pass!'
        ELSE permissive
    END as policy_type,
    with_check::text as check_condition
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND cmd IN ('INSERT', 'ALL')
ORDER BY permissive DESC; -- RESTRICTIVE first

-- ============================================================================
-- 3. Test if the WITH CHECK clause is the problem
-- ============================================================================
-- Show the exact WITH CHECK conditions that must be satisfied
SELECT
    policyname,
    cmd,
    'WITH CHECK clause (must be TRUE to insert):' as description,
    with_check::text as condition
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND cmd IN ('INSERT', 'ALL')
AND with_check IS NOT NULL
ORDER BY policyname;

-- ============================================================================
-- 4. Check if related tables have proper data
-- ============================================================================
-- Test: Do we have document_sections linked to documents in organizations?
SELECT
    'Data validation check' as test,
    (SELECT COUNT(*) FROM document_sections) as document_sections_count,
    (SELECT COUNT(*) FROM documents) as documents_count,
    (SELECT COUNT(*) FROM user_organizations) as user_orgs_count,
    (SELECT COUNT(*) FROM suggestions) as suggestions_count;

-- ============================================================================
-- 5. Simulate the policy check
-- ============================================================================
-- This tests if the typical JOIN path exists
-- (Replace UUIDs with actual values from your error)
WITH test_values AS (
    SELECT
        'REPLACE_WITH_SECTION_ID'::uuid as test_section_id,
        'REPLACE_WITH_USER_ID'::uuid as test_user_id
)
SELECT
    'Policy check simulation' as test,
    ds.id as section_id,
    d.id as document_id,
    d.organization_id,
    uo.user_id,
    uo.is_active,
    CASE
        WHEN uo.user_id IS NOT NULL AND uo.is_active THEN '✅ Policy SHOULD pass'
        ELSE '❌ Policy WILL FAIL - user not in org or inactive'
    END as policy_result
FROM test_values tv
LEFT JOIN document_sections ds ON ds.id = tv.test_section_id
LEFT JOIN documents d ON d.id = ds.document_id
LEFT JOIN user_organizations uo ON uo.organization_id = d.organization_id AND uo.user_id = tv.test_user_id;

-- ============================================================================
-- 6. Check auth.uid() context
-- ============================================================================
-- This shows if auth.uid() is being set correctly
SELECT
    'Auth context check' as test,
    auth.uid() as current_user_id,
    CASE
        WHEN auth.uid() IS NULL THEN '❌ No auth context - using service role or anonymous!'
        ELSE '✅ Auth context exists'
    END as status;

-- ============================================================================
-- 7. Find the most restrictive policy
-- ============================================================================
SELECT
    policyname,
    cmd,
    permissive,
    LENGTH(with_check::text) as check_complexity,
    with_check::text as restriction
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND cmd IN ('INSERT', 'ALL')
ORDER BY LENGTH(with_check::text) DESC NULLS LAST
LIMIT 5;

-- ============================================================================
-- 8. Check for policy that might be checking wrong column
-- ============================================================================
SELECT
    policyname,
    cmd,
    CASE
        WHEN with_check::text LIKE '%section_id%' THEN '✓ Checks section_id'
        WHEN with_check::text LIKE '%suggestion_id%' THEN '⚠️ Checks suggestion_id'
        WHEN with_check::text LIKE '%organization_id%' THEN '⚠️ Checks organization_id directly'
        ELSE '⚠️ Unknown check'
    END as what_it_checks,
    with_check::text as full_condition
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND cmd IN ('INSERT', 'ALL');

-- ============================================================================
-- 9. Show service role policies
-- ============================================================================
SELECT
    'Service role policies' as category,
    policyname,
    cmd,
    roles::text,
    CASE
        WHEN roles::text LIKE '%service_role%' THEN '✓ Service role can bypass'
        ELSE '❌ Service role NOT allowed'
    END as service_access
FROM pg_policies
WHERE tablename = 'suggestion_sections'
AND cmd IN ('INSERT', 'ALL');

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
/*
COMMON CAUSES OF RLS FAILURE (even with INSERT policy):

1. RESTRICTIVE policy blocks the insert
   - Look for permissive = 'RESTRICTIVE' in section 2
   - These policies must ALL pass (unlike PERMISSIVE which only needs one)

2. WITH CHECK clause references data that doesn't exist yet
   - Section being linked doesn't exist
   - Section's document doesn't exist
   - User not in organization
   - User organization membership is_active = false

3. auth.uid() is NULL
   - Using service_role key but policy checks auth.uid()
   - Need separate service_role policy

4. Policy checks wrong relationship
   - Might check suggestion_id first (but suggestion might not be linked to org)
   - Should check section_id → document → organization → user

RECOMMENDED FIX PATTERNS:

Pattern A: Two policies (best practice)
  - One for authenticated users (checks organization)
  - One for service_role (allows all)

Pattern B: Simplified WITH CHECK
  - Just check section exists in user's organization
  - Don't check suggestion (it might not have org yet)

Pattern C: Temporarily disable for testing
  - ALTER TABLE suggestion_sections DISABLE ROW LEVEL SECURITY;
  - Test if app works
  - Re-enable with better policy
*/
