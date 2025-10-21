-- =============================================================================
-- DIAGNOSTIC QUERIES: Permissions & Organization Selector Bugs
-- Research Agent Investigation
-- Date: 2025-10-20
-- =============================================================================
--
-- PURPOSE: Verify root causes of two critical bugs:
--   1. User shows as "Viewer" instead of "Owner" after setup
--   2. Organization selector shows "No Organizations Found"
--
-- USAGE: Run these queries in Supabase SQL Editor
--        Replace [user-uuid] with actual test user ID
--
-- =============================================================================

-- =============================================================================
-- TEST 1: Check Organization Roles Table Seeding
-- =============================================================================
-- EXPECTED: 5 rows (owner, admin, editor, member, viewer)
-- IF 0 ROWS: Migration 025 not applied → BUG 1 CONFIRMED

SELECT
    '=== TEST 1: Organization Roles Table ===' as test_name;

SELECT
    id,
    role_code,
    role_name,
    hierarchy_level,
    (org_permissions->>'can_manage_users')::boolean as can_manage_users,
    (org_permissions->>'can_configure_organization')::boolean as can_configure_org,
    is_system_role
FROM organization_roles
ORDER BY hierarchy_level;

-- Specific check for 'owner' role
SELECT
    '=== TEST 1.1: Owner Role Exists? ===' as test_name;

SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '❌ FAIL: Owner role missing (Migration 025 not applied)'
        WHEN COUNT(*) > 0 THEN '✅ PASS: Owner role exists'
    END as status,
    COUNT(*) as owner_role_count
FROM organization_roles
WHERE role_code = 'owner';

-- =============================================================================
-- TEST 2: Check User Organizations Link
-- =============================================================================
-- EXPECTED: org_role_id should NOT be NULL
-- IF NULL: Role assignment failed → BUG 1 CONFIRMED

SELECT
    '=== TEST 2: User Organizations with Roles ===' as test_name;

SELECT
    uo.user_id,
    uo.organization_id,
    uo.role as old_role_column,
    uo.org_role_id,
    uo.is_active,
    oRole.role_code,
    oRole.role_name,
    oRole.hierarchy_level,
    CASE
        WHEN uo.org_role_id IS NULL THEN '❌ FAIL: org_role_id is NULL'
        WHEN oRole.role_code IS NULL THEN '❌ FAIL: organization_roles lookup failed'
        WHEN oRole.role_code != 'owner' THEN '⚠️  WARN: User is not owner (' || oRole.role_code || ')'
        ELSE '✅ PASS: User is owner'
    END as status
FROM user_organizations uo
LEFT JOIN organization_roles oRole ON uo.org_role_id = oRole.id
ORDER BY uo.created_at DESC
LIMIT 10;

-- =============================================================================
-- TEST 3: Check Organizations Exist
-- =============================================================================
-- EXPECTED: Organizations exist in database
-- IF EXISTS BUT SELECTOR EMPTY: Query filtering issue → BUG 2 CONFIRMED

SELECT
    '=== TEST 3: Organizations and User Links ===' as test_name;

SELECT
    o.id as org_id,
    o.name as org_name,
    o.is_configured,
    o.created_at,
    uo.user_id,
    uo.is_active,
    u.email as user_email,
    CASE
        WHEN uo.user_id IS NULL THEN '❌ FAIL: Organization has no users'
        WHEN NOT uo.is_active THEN '⚠️  WARN: User is inactive'
        ELSE '✅ PASS: User linked to organization'
    END as status
FROM organizations o
LEFT JOIN user_organizations uo ON uo.organization_id = o.id
LEFT JOIN users u ON uo.user_id = u.id
WHERE o.created_at > NOW() - INTERVAL '1 hour'
ORDER BY o.created_at DESC
LIMIT 10;

-- =============================================================================
-- TEST 4: Simulate User-Authenticated Query (RLS Test)
-- =============================================================================
-- IMPORTANT: Replace [user-uuid] with actual test user ID
--
-- This simulates what happens when auth.js line 1257 uses user client
-- instead of service client
--
-- EXPECTED: Should return rows (user can see their orgs)
-- IF 0 ROWS: RLS policy blocking query → BUG 2 CONFIRMED

SELECT
    '=== TEST 4: RLS User Context Simulation ===' as test_name;

-- NOTE: You need to replace '[user-uuid]' below with actual UUID

/*
-- Uncomment and replace [user-uuid] to test RLS
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = '[user-uuid]';

SELECT
    uo.organization_id,
    uo.role,
    uo.is_active,
    o.name as org_name,
    CASE
        WHEN COUNT(*) OVER () = 0 THEN '❌ FAIL: RLS blocking user query'
        ELSE '✅ PASS: User can see their organizations'
    END as status
FROM user_organizations uo
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE uo.user_id = '[user-uuid]'
  AND uo.is_active = true;

ROLLBACK;
*/

SELECT '⚠️  TEST 4 SKIPPED: Uncomment and provide [user-uuid] to test RLS' as status;

-- =============================================================================
-- TEST 5: Verify Permissions Middleware Query
-- =============================================================================
-- This replicates the query from permissions.js getUserRole()
-- EXPECTED: Should return role information
-- IF NULL: Permissions lookup failing

SELECT
    '=== TEST 5: Permissions Middleware Query ===' as test_name;

-- Replace [user-uuid] and [org-uuid] with actual values
/*
SELECT
    uo.user_id,
    uo.organization_id,
    oRole.role_code,
    oRole.role_name,
    oRole.hierarchy_level,
    CASE
        WHEN oRole.role_code IS NULL THEN '❌ FAIL: Permission lookup returns NULL'
        WHEN oRole.role_code = 'viewer' THEN '⚠️  WARN: User is viewer (expected owner/admin)'
        ELSE '✅ PASS: User has elevated role (' || oRole.role_code || ')'
    END as status
FROM user_organizations uo
INNER JOIN organization_roles oRole ON uo.org_role_id = oRole.id
WHERE uo.user_id = '[user-uuid]'
  AND uo.organization_id = '[org-uuid]'
  AND uo.is_active = true;
*/

SELECT '⚠️  TEST 5 SKIPPED: Uncomment and provide [user-uuid] and [org-uuid]' as status;

-- =============================================================================
-- TEST 6: Full Diagnostic Summary
-- =============================================================================

SELECT
    '=== TEST 6: Full Diagnostic Summary ===' as test_name;

WITH diagnostics AS (
    SELECT
        (SELECT COUNT(*) FROM organization_roles WHERE role_code = 'owner') as has_owner_role,
        (SELECT COUNT(*) FROM user_organizations WHERE org_role_id IS NULL) as null_org_role_count,
        (SELECT COUNT(*) FROM user_organizations uo
         LEFT JOIN organization_roles oRole ON uo.org_role_id = oRole.id
         WHERE oRole.role_code IS NULL AND uo.org_role_id IS NOT NULL) as invalid_role_links,
        (SELECT COUNT(*) FROM organizations WHERE created_at > NOW() - INTERVAL '1 hour') as recent_orgs,
        (SELECT COUNT(*) FROM user_organizations WHERE created_at > NOW() - INTERVAL '1 hour') as recent_user_orgs
)
SELECT
    CASE
        WHEN has_owner_role = 0 THEN '❌ CRITICAL: Migration 025 not applied'
        ELSE '✅ Organization roles seeded'
    END as bug1_status,

    CASE
        WHEN null_org_role_count > 0 THEN '❌ CRITICAL: ' || null_org_role_count || ' users with NULL org_role_id'
        WHEN invalid_role_links > 0 THEN '❌ CRITICAL: ' || invalid_role_links || ' users with invalid role links'
        ELSE '✅ All users have valid role assignments'
    END as bug1_severity,

    CASE
        WHEN recent_orgs > 0 AND recent_user_orgs = 0 THEN '❌ CRITICAL: Orgs exist but no user links'
        WHEN recent_user_orgs > 0 THEN '⚠️  WARN: Check if selector showing orgs (may be RLS issue)'
        ELSE '✅ No recent setup activity'
    END as bug2_status,

    recent_orgs as organizations_created_last_hour,
    recent_user_orgs as user_org_links_last_hour
FROM diagnostics;

-- =============================================================================
-- RECOMMENDED ACTIONS
-- =============================================================================

SELECT
    '=== RECOMMENDED ACTIONS ===' as section;

SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM organization_roles WHERE role_code = 'owner') = 0
        THEN '1. ⚠️  URGENT: Run migration 025_seed_organization_roles.sql'
        ELSE '1. ✅ Organization roles already seeded'
    END as action_1,

    CASE
        WHEN (SELECT COUNT(*) FROM user_organizations WHERE org_role_id IS NULL) > 0
        THEN '2. ⚠️  URGENT: Fix NULL org_role_id entries (run migration or update manually)'
        ELSE '2. ✅ All users have role assignments'
    END as action_2,

    '3. ⚠️  APPLY: Change auth.js line 1257 from `supabase` to `supabaseService`' as action_3,

    '4. ⚠️  TEST: Run setup wizard with fresh user to verify fixes' as action_4;

-- =============================================================================
-- END OF DIAGNOSTICS
-- =============================================================================

SELECT
    '=== DIAGNOSTICS COMPLETE ===' as final_message,
    NOW() as executed_at;
