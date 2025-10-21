-- ============================================================================
-- COMPREHENSIVE RLS POLICY AUDIT SCRIPT
-- Purpose: Review ALL Row Level Security policies in the database
-- Date: 2025-10-20
-- ============================================================================

-- ============================================================================
-- 1. OVERVIEW: Which tables have RLS enabled?
-- ============================================================================
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE
        WHEN rowsecurity THEN '🔒 RLS ENABLED'
        ELSE '🔓 RLS DISABLED'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;

-- ============================================================================
-- 2. DETAILED: All RLS policies with their definitions
-- ============================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command, -- SELECT, INSERT, UPDATE, DELETE, ALL
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 3. PROBLEM ANALYSIS: Tables with RLS enabled but NO policies
-- ============================================================================
SELECT
    t.schemaname,
    t.tablename,
    '⚠️ RLS ENABLED BUT NO POLICIES!' as warning,
    'This will block ALL operations!' as consequence
FROM pg_tables t
WHERE t.schemaname = 'public'
AND t.rowsecurity = true
AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = t.schemaname
    AND p.tablename = t.tablename
)
ORDER BY t.tablename;

-- ============================================================================
-- 4. SUGGESTION_SECTIONS SPECIFIC: What policies exist?
-- ============================================================================
SELECT
    tablename,
    policyname,
    cmd as applies_to,
    roles as for_roles,
    qual as using_check,
    with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'suggestion_sections'
ORDER BY policyname;

-- ============================================================================
-- 5. RELATED TABLES: Check policies on suggestion-related tables
-- ============================================================================
SELECT
    tablename,
    COUNT(*) as policy_count,
    string_agg(DISTINCT cmd::text, ', ') as commands_covered,
    string_agg(DISTINCT policyname, ', ') as policy_names
FROM pg_policies
WHERE tablename IN ('suggestions', 'suggestion_sections', 'document_sections', 'documents')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================================
-- 6. AUTHENTICATION TABLES: User/org related policies
-- ============================================================================
SELECT
    tablename,
    policyname,
    cmd as command,
    roles,
    CASE
        WHEN qual::text ILIKE '%auth.uid()%' THEN '✓ Uses auth.uid()'
        WHEN qual::text ILIKE '%current_user%' THEN '✓ Uses current_user'
        ELSE '⚠️ No user check'
    END as auth_check,
    LEFT(qual::text, 100) as using_clause_preview
FROM pg_policies
WHERE tablename IN ('users', 'user_types', 'user_organizations', 'organizations')
ORDER BY tablename, policyname;

-- ============================================================================
-- 7. POLICY CONFLICTS: Multiple policies on same table/command
-- ============================================================================
SELECT
    tablename,
    cmd as command,
    COUNT(*) as policy_count,
    string_agg(policyname, ', ') as conflicting_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY policy_count DESC, tablename;

-- ============================================================================
-- 8. SERVICE ROLE POLICIES: Which tables allow service role access?
-- ============================================================================
SELECT
    tablename,
    policyname,
    cmd as command,
    CASE
        WHEN roles::text ILIKE '%service_role%' THEN '✓ Service role allowed'
        WHEN qual::text ILIKE '%service_role%' THEN '✓ Service role in policy'
        ELSE '❌ Service role NOT mentioned'
    END as service_role_access
FROM pg_policies
WHERE roles::text ILIKE '%service%'
   OR qual::text ILIKE '%service%'
ORDER BY tablename;

-- ============================================================================
-- 9. DANGEROUS POLICIES: Potential security issues
-- ============================================================================
SELECT
    tablename,
    policyname,
    cmd,
    '⚠️ POTENTIAL ISSUE' as warning,
    CASE
        WHEN qual IS NULL THEN 'No USING clause - allows all rows!'
        WHEN qual::text = 'true' THEN 'USING clause is TRUE - allows all rows!'
        WHEN with_check IS NULL AND cmd IN ('INSERT', 'UPDATE', 'ALL') THEN 'No WITH CHECK - allows any data!'
        ELSE 'Review manually'
    END as reason
FROM pg_policies
WHERE schemaname = 'public'
AND (
    qual IS NULL
    OR qual::text = 'true'
    OR (with_check IS NULL AND cmd IN ('INSERT', 'UPDATE', 'ALL'))
)
ORDER BY tablename, policyname;

-- ============================================================================
-- 10. POLICY COMPLEXITY: Show most complex policies
-- ============================================================================
SELECT
    tablename,
    policyname,
    LENGTH(qual::text) as using_clause_length,
    LENGTH(with_check::text) as with_check_length,
    CASE
        WHEN LENGTH(qual::text) > 500 THEN '🔴 Very Complex'
        WHEN LENGTH(qual::text) > 200 THEN '🟡 Complex'
        ELSE '🟢 Simple'
    END as complexity,
    LEFT(qual::text, 200) as using_preview
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY LENGTH(qual::text) DESC NULLS LAST
LIMIT 20;

-- ============================================================================
-- 11. MISSING POLICIES: Tables that might need RLS
-- ============================================================================
SELECT
    t.tablename,
    t.rowsecurity as has_rls,
    COUNT(p.policyname) as policy_count,
    CASE
        WHEN t.rowsecurity = false THEN '⚠️ No RLS - Check if needed'
        WHEN COUNT(p.policyname) = 0 THEN '🔴 RLS enabled but NO policies!'
        ELSE '✓ Has policies'
    END as status
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
AND t.tablename NOT LIKE 'pg_%'
AND t.tablename NOT LIKE 'sql_%'
GROUP BY t.schemaname, t.tablename, t.rowsecurity
ORDER BY
    CASE
        WHEN t.rowsecurity = true AND COUNT(p.policyname) = 0 THEN 1
        WHEN t.rowsecurity = false THEN 2
        ELSE 3
    END,
    t.tablename;

-- ============================================================================
-- 12. POLICY SUMMARY: Quick statistics
-- ============================================================================
SELECT
    '📊 POLICY SUMMARY' as category,
    (SELECT COUNT(DISTINCT tablename) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls,
    (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND cmd = 'SELECT') as select_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND cmd = 'INSERT') as insert_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND cmd = 'UPDATE') as update_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND cmd = 'DELETE') as delete_policies;

-- ============================================================================
-- 13. IMMEDIATE FIX CHECK: suggestion_sections table status
-- ============================================================================
SELECT
    '🔍 SUGGESTION_SECTIONS DIAGNOSIS' as check_type,
    (SELECT rowsecurity FROM pg_tables WHERE tablename = 'suggestion_sections') as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'suggestion_sections') as policy_count,
    (SELECT string_agg(cmd::text, ', ') FROM pg_policies WHERE tablename = 'suggestion_sections') as commands_covered,
    CASE
        WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'suggestion_sections' AND cmd = 'INSERT') = 0
        THEN '🔴 NO INSERT POLICY - This is likely causing the error!'
        ELSE '✓ INSERT policy exists'
    END as insert_policy_status;

-- ============================================================================
-- USAGE NOTES:
-- ============================================================================
-- Run this script in Supabase SQL Editor to get a complete RLS audit
--
-- KEY SECTIONS TO CHECK:
-- - Section 3: Tables with RLS but no policies (will block everything!)
-- - Section 4: Specific policies on suggestion_sections
-- - Section 9: Dangerous policies that might be too permissive
-- - Section 13: Immediate diagnosis of the suggestion_sections issue
--
-- COMMON FIXES:
-- - If table has RLS enabled but no policies: Either add policies or disable RLS
-- - If missing INSERT policy: Add policy allowing authenticated users to insert
-- - If policy is too restrictive: Review USING and WITH CHECK clauses
-- ============================================================================
