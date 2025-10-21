-- ============================================================================
-- Database State Diagnostic: user_types and user_organizations
-- Purpose: Verify schema, RLS, and data integrity
-- Date: 2025-10-20
-- ============================================================================

\echo '===================================================='
\echo 'DATABASE STATE DIAGNOSTIC'
\echo '===================================================='
\echo ''

-- ============================================================================
-- SECTION 1: TABLE EXISTENCE CHECK
-- ============================================================================

\echo '1. CHECKING TABLE EXISTENCE'
\echo '----------------------------'

SELECT
  table_name,
  CASE
    WHEN table_name IN (
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END AS status
FROM (
  VALUES
    ('user_types'),
    ('organization_roles'),
    ('users'),
    ('user_organizations')
) AS t(table_name);

\echo ''

-- ============================================================================
-- SECTION 2: RLS STATUS
-- ============================================================================

\echo '2. ROW LEVEL SECURITY STATUS'
\echo '-----------------------------'

SELECT
  tablename,
  CASE
    WHEN rowsecurity = true THEN '⚠️  ENABLED (may block queries)'
    WHEN rowsecurity = false THEN '✅ DISABLED'
    ELSE '❓ UNKNOWN'
  END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_types', 'organization_roles', 'users', 'user_organizations')
ORDER BY tablename;

\echo ''

-- ============================================================================
-- SECTION 3: RLS POLICIES (if enabled)
-- ============================================================================

\echo '3. ACTIVE RLS POLICIES ON user_types'
\echo '-------------------------------------'

SELECT
  schemaname,
  tablename,
  policyname,
  CASE cmd
    WHEN 'ALL' THEN 'ALL OPERATIONS'
    WHEN 'SELECT' THEN 'SELECT'
    WHEN 'INSERT' THEN 'INSERT'
    WHEN 'UPDATE' THEN 'UPDATE'
    WHEN 'DELETE' THEN 'DELETE'
  END AS applies_to,
  CASE
    WHEN qual IS NOT NULL THEN '✅ Has USING clause'
    ELSE '❌ No USING clause'
  END AS using_policy,
  CASE
    WHEN with_check IS NOT NULL THEN '✅ Has WITH CHECK clause'
    ELSE '❌ No WITH CHECK'
  END AS check_policy
FROM pg_policies
WHERE tablename = 'user_types'
ORDER BY policyname;

\echo ''

-- ============================================================================
-- SECTION 4: user_types DATA
-- ============================================================================

\echo '4. user_types TABLE DATA'
\echo '-------------------------'

SELECT
  type_code,
  type_name,
  CASE
    WHEN is_system_type = true THEN '✅ System Type'
    ELSE '❌ Custom Type'
  END AS type_category,
  (global_permissions->>'can_access_all_organizations')::boolean AS is_global_admin,
  created_at
FROM user_types
ORDER BY type_code;

\echo ''
\echo 'Expected: 2 rows (global_admin, regular_user)'
\echo ''

-- ============================================================================
-- SECTION 5: organization_roles DATA
-- ============================================================================

\echo '5. organization_roles TABLE DATA'
\echo '---------------------------------'

SELECT
  role_code,
  role_name,
  hierarchy_level,
  CASE
    WHEN is_system_role = true THEN '✅ System Role'
    ELSE '❌ Custom Role'
  END AS role_category
FROM organization_roles
ORDER BY hierarchy_level DESC;

\echo ''
\echo 'Expected: 4 rows (owner=4, admin=3, member=2, viewer=1)'
\echo ''

-- ============================================================================
-- SECTION 6: USERS WITHOUT user_type_id
-- ============================================================================

\echo '6. USERS WITHOUT user_type_id (PROBLEMATIC)'
\echo '--------------------------------------------'

SELECT
  u.id,
  u.email,
  u.name,
  u.user_type_id,
  COUNT(uo.id) AS org_count,
  STRING_AGG(o.name, ', ') AS organizations
FROM users u
LEFT JOIN user_organizations uo ON u.id = uo.user_id
LEFT JOIN organizations o ON uo.organization_id = o.id
WHERE u.user_type_id IS NULL
GROUP BY u.id, u.email, u.name, u.user_type_id
ORDER BY u.created_at;

\echo ''
\echo 'Note: Any users shown here need user_type_id assigned!'
\echo ''

-- ============================================================================
-- SECTION 7: USERS WITH PROPER user_type_id
-- ============================================================================

\echo '7. USERS WITH PROPER user_type_id (CORRECT)'
\echo '--------------------------------------------'

SELECT
  u.id,
  u.email,
  u.name,
  ut.type_code,
  ut.type_name,
  COUNT(uo.id) AS org_count
FROM users u
JOIN user_types ut ON u.user_type_id = ut.id
LEFT JOIN user_organizations uo ON u.id = uo.user_id
GROUP BY u.id, u.email, u.name, ut.type_code, ut.type_name
ORDER BY ut.type_code, u.email;

\echo ''

-- ============================================================================
-- SECTION 8: user_organizations WITHOUT org_role_id
-- ============================================================================

\echo '8. user_organizations WITHOUT org_role_id (NEEDS MIGRATION)'
\echo '-------------------------------------------------------------'

SELECT
  uo.id,
  u.email,
  o.name AS organization,
  uo.role AS old_role_column,
  uo.org_role_id
FROM user_organizations uo
JOIN users u ON uo.user_id = u.id
JOIN organizations o ON uo.organization_id = o.id
WHERE uo.org_role_id IS NULL
ORDER BY o.name, u.email;

\echo ''

-- ============================================================================
-- SECTION 9: SCHEMA VERSION CHECK
-- ============================================================================

\echo '9. COLUMN EXISTENCE CHECK'
\echo '--------------------------'

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'user_organizations')
  AND column_name IN ('user_type_id', 'org_role_id')
ORDER BY table_name, column_name;

\echo ''

-- ============================================================================
-- SECTION 10: FOREIGN KEY CONSTRAINTS
-- ============================================================================

\echo '10. FOREIGN KEY CONSTRAINTS'
\echo '----------------------------'

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    kcu.column_name = 'user_type_id'
    OR kcu.column_name = 'org_role_id'
  )
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo '===================================================='
\echo 'DIAGNOSTIC SUMMARY'
\echo '===================================================='
\echo ''
\echo 'Run this script to diagnose:'
\echo '  1. Whether user_types table exists'
\echo '  2. Whether RLS is blocking queries'
\echo '  3. Whether default data is present'
\echo '  4. Which users need user_type_id assigned'
\echo '  5. Which user_organizations need org_role_id migrated'
\echo ''
\echo 'If you see "relation user_types does not exist" error,'
\echo 'it is likely an RLS issue, not a missing table!'
\echo '===================================================='
