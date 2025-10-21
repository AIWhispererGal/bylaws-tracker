-- =====================================================
-- DIAGNOSTIC SQL: User Authentication Error Investigation
-- User ID: 2234d0d2-60d5-4f86-84b8-dd0dd44dc042
-- =====================================================
-- Run these queries in Supabase SQL Editor or via psql
-- Copy-paste each section individually for best results
-- =====================================================

-- =====================================================
-- 1. CHECK USER EXISTENCE IN AUTH.USERS
-- =====================================================
-- This verifies the user exists in Supabase Auth system
SELECT
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users
WHERE id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';

-- Expected: 1 row with user details
-- If 0 rows: User doesn't exist in auth system (CRITICAL)
-- =====================================================

-- =====================================================
-- 2. CHECK USER_TYPES TABLE (THE FAILING QUERY)
-- =====================================================
-- This is the exact query pattern from middleware that's failing
SELECT
    user_id,
    is_global_admin,
    created_at,
    updated_at
FROM public.user_types
WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';

-- Expected: 1 row with is_global_admin = true/false
-- If 0 rows: Missing user_types record (ROOT CAUSE)
-- =====================================================

-- =====================================================
-- 3. CHECK USER_ORGANIZATIONS TABLE
-- =====================================================
-- Verify user has organization memberships
SELECT
    uo.id,
    uo.user_id,
    uo.organization_id,
    uo.role,
    uo.created_at,
    o.name as organization_name,
    o.subdomain
FROM public.user_organizations uo
LEFT JOIN public.organizations o ON o.id = uo.organization_id
WHERE uo.user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';

-- Expected: 1+ rows showing organization memberships
-- If 0 rows: User not linked to any organization
-- =====================================================

-- =====================================================
-- 4. CHECK FOR ORPHANED AUTH RECORDS
-- =====================================================
-- Find users in auth.users without user_types records
SELECT
    au.id,
    au.email,
    au.created_at,
    CASE
        WHEN ut.user_id IS NULL THEN 'MISSING user_types'
        ELSE 'Has user_types'
    END as user_types_status,
    CASE
        WHEN uo.user_id IS NULL THEN 'MISSING user_organizations'
        ELSE 'Has user_organizations'
    END as user_orgs_status
FROM auth.users au
LEFT JOIN public.user_types ut ON ut.user_id = au.id
LEFT JOIN public.user_organizations uo ON uo.user_id = au.id
WHERE au.id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';

-- Expected: Shows which records are missing
-- This identifies orphaned authentication data
-- =====================================================

-- =====================================================
-- 5. VERIFY RLS POLICIES ON USER_TYPES
-- =====================================================
-- Check if RLS policies exist and are enabled
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'user_types'
ORDER BY policyname;

-- Expected: List of RLS policies
-- Check if policies might be blocking SELECT access
-- =====================================================

-- =====================================================
-- 6. CHECK RLS ENABLEMENT
-- =====================================================
-- Verify if RLS is enabled on critical tables
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_types', 'user_organizations', 'organizations')
ORDER BY tablename;

-- Expected: rowsecurity = true/false for each table
-- If RLS is enabled but policies are wrong, queries fail
-- =====================================================

-- =====================================================
-- 7. COUNT ALL USER_TYPES RECORDS (BYPASS RLS)
-- =====================================================
-- See total records in user_types (requires service_role or SECURITY DEFINER)
SELECT COUNT(*) as total_user_types_records
FROM public.user_types;

-- Then check if our specific user exists:
SELECT EXISTS (
    SELECT 1
    FROM public.user_types
    WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042'
) as user_types_exists;

-- Expected: Shows if record exists but RLS is hiding it
-- =====================================================

-- =====================================================
-- 8. SHOW WHAT DATA SHOULD EXIST VS WHAT DOES EXIST
-- =====================================================
-- Comprehensive comparison query
SELECT
    '2234d0d2-60d5-4f86-84b8-dd0dd44dc042' as expected_user_id,

    -- Does user exist in auth?
    (SELECT COUNT(*) FROM auth.users
     WHERE id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') as auth_users_count,

    -- Does user_types record exist?
    (SELECT COUNT(*) FROM public.user_types
     WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') as user_types_count,

    -- Does user_organizations record exist?
    (SELECT COUNT(*) FROM public.user_organizations
     WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') as user_orgs_count,

    -- What SHOULD exist
    CASE
        WHEN (SELECT COUNT(*) FROM auth.users
              WHERE id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') > 0
        THEN 'user_types and user_organizations records'
        ELSE 'User does not exist in auth system'
    END as expected_records,

    -- What's MISSING
    CASE
        WHEN (SELECT COUNT(*) FROM public.user_types
              WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') = 0
        THEN 'MISSING: user_types record'
        WHEN (SELECT COUNT(*) FROM public.user_organizations
              WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') = 0
        THEN 'MISSING: user_organizations record'
        ELSE 'All records present'
    END as diagnosis;

-- =====================================================

-- =====================================================
-- 9. CHECK FOR RECENT USER REGISTRATIONS
-- =====================================================
-- See if this is a newly registered user
SELECT
    id,
    email,
    created_at,
    email_confirmed_at,
    (NOW() - created_at) as account_age
FROM auth.users
WHERE id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';

-- If account_age is very recent, trigger function may not have fired
-- =====================================================

-- =====================================================
-- 10. CHECK TRIGGER FUNCTIONS FOR USER CREATION
-- =====================================================
-- Verify if triggers exist to auto-create user_types
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- Expected: Triggers that create user_types on user registration
-- If missing: No automatic user_types creation (ARCHITECTURE ISSUE)
-- =====================================================

-- =====================================================
-- SUMMARY DIAGNOSTIC QUERY
-- =====================================================
-- Single query showing complete status
WITH user_check AS (
    SELECT
        '2234d0d2-60d5-4f86-84b8-dd0dd44dc042'::uuid as user_id,
        EXISTS(SELECT 1 FROM auth.users WHERE id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') as has_auth,
        EXISTS(SELECT 1 FROM public.user_types WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') as has_types,
        EXISTS(SELECT 1 FROM public.user_organizations WHERE user_id = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042') as has_orgs
)
SELECT
    user_id,
    has_auth,
    has_types,
    has_orgs,
    CASE
        WHEN NOT has_auth THEN 'ERROR: User does not exist in auth.users'
        WHEN NOT has_types THEN 'ERROR: Missing user_types record (ROOT CAUSE)'
        WHEN NOT has_orgs THEN 'WARNING: No organization membership'
        ELSE 'OK: All records present'
    END as status,
    CASE
        WHEN NOT has_types THEN 'Run repair script to create user_types record'
        WHEN NOT has_orgs THEN 'User needs organization assignment'
        ELSE 'No action needed'
    END as recommended_action
FROM user_check;

-- =====================================================
-- END OF DIAGNOSTIC QUERIES
-- =====================================================
-- Next Steps:
-- 1. Run queries in order
-- 2. Note which queries return 0 rows
-- 3. Use diagnose-auth-error.js for automated testing
-- 4. Apply fix based on findings
-- =====================================================
