-- Verification Script for Migration 008
-- Run this in Supabase SQL Editor to check if migration 008 applied correctly

-- ============================================================================
-- CHECK 1: Does is_global_admin function exist?
-- ============================================================================
SELECT
  routine_name,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'is_global_admin'
  AND routine_schema = 'public';

-- Expected: 1 row with security_type = 'DEFINER'

-- ============================================================================
-- CHECK 2: What RLS policies exist on user_organizations?
-- ============================================================================
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
WHERE tablename = 'user_organizations'
ORDER BY policyname;

-- Expected: Should see policies WITHOUT self-referencing WHERE clauses

-- ============================================================================
-- CHECK 3: What RLS policies exist on organizations?
-- ============================================================================
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'organizations';

-- Expected: "Users see own organizations" policy should include is_global_admin() check

-- ============================================================================
-- CHECK 4: Test the is_global_admin function directly
-- ============================================================================
-- Replace <your-user-id> with actual UUID
-- SELECT is_global_admin('<your-user-id>'::UUID);

-- ============================================================================
-- DIAGNOSTIC: Find problematic policies causing recursion
-- ============================================================================

-- This query shows all policies that reference user_organizations FROM user_organizations
-- (which causes infinite recursion)
SELECT
  policyname,
  tablename,
  qual
FROM pg_policies
WHERE tablename = 'user_organizations'
  AND (
    qual LIKE '%user_organizations%'
    OR with_check LIKE '%user_organizations%'
  );

-- If any rows returned: THAT'S THE PROBLEM - self-referencing policy!
