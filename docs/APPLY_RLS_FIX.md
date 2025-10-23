# Apply RLS Recursion Fix - Quick Guide

## Problem Summary

**Error**: `infinite recursion detected in policy for relation user_organizations`

**Cause**: Migration 003 created circular references in RLS policies.

**Fix**: Migration 005 uses SECURITY DEFINER function to bypass recursion.

## Pre-Flight Check

Before applying the fix, verify the current state:

```sql
-- Check if RLS is enabled (should be true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_organizations';

-- Count existing policies (will vary)
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'user_organizations';

-- Try to query (will fail with recursion error)
SELECT * FROM user_organizations LIMIT 1;
```

## Apply Migration 005

### Option 1: Via Supabase Dashboard

1. Go to **SQL Editor** in Supabase Dashboard
2. Open file: `database/migrations/005_fix_rls_recursion_safe.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **Run**
6. Verify: "Success. No rows returned"

### Option 2: Via Supabase CLI

```bash
# Apply migration
supabase db push

# Or apply specific migration
supabase migration up --version 005

# Or run SQL file directly
psql "postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres" \
  -f database/migrations/005_fix_rls_recursion_safe.sql
```

### Option 3: Via psql

```bash
# Connect to database
psql -h db.[PROJECT-REF].supabase.co -U postgres -d postgres

# Run migration
\i database/migrations/005_fix_rls_recursion_safe.sql

# Exit
\q
```

## Post-Migration Verification

Run these queries to verify the fix worked:

### Test 1: Check RLS Status

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'user_organizations';
```

**Expected**: `rowsecurity = true`

### Test 2: Count Policies

```sql
SELECT COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'user_organizations';
```

**Expected**: `7` policies

### Test 3: List All Policies

```sql
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'user_organizations'
ORDER BY policyname;
```

**Expected**:
```
policyname                      | cmd    | permissive
--------------------------------|--------|------------
admins_delete_org_members       | DELETE | PERMISSIVE
admins_insert_org_members       | INSERT | PERMISSIVE
admins_see_org_members          | SELECT | PERMISSIVE
admins_update_org_members       | UPDATE | PERMISSIVE
service_role_full_access        | ALL    | PERMISSIVE
users_see_own_memberships       | SELECT | PERMISSIVE
users_update_own_memberships    | UPDATE | PERMISSIVE
```

### Test 4: Verify Helper Function

```sql
SELECT
  routine_name,
  routine_schema,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'is_org_admin'
  AND routine_schema = 'public';
```

**Expected**:
```
routine_name  | routine_schema | security_type | return_type
--------------|----------------|---------------|-------------
is_org_admin  | public         | DEFINER       | boolean
```

### Test 5: Test User Query (NO RECURSION)

```sql
-- This should work WITHOUT "infinite recursion" error
SELECT * FROM user_organizations WHERE user_id = auth.uid();
```

**Expected**: Returns rows or empty result (no error)

### Test 6: Test Admin Query (NO RECURSION)

```sql
-- This should work WITHOUT "infinite recursion" error
SELECT *
FROM user_organizations
WHERE organization_id IN (
  SELECT organization_id
  FROM user_organizations
  WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
);
```

**Expected**: Returns rows or empty result (no "infinite recursion" error)

### Test 7: Test Organizations Visibility

```sql
-- Related table should also work
SELECT * FROM organizations;
```

**Expected**: Returns organization records

## Troubleshooting

### Error: "function public.is_org_admin does not exist"

**Cause**: Function creation failed or was not committed.

**Fix**:
```sql
-- Check if function exists
SELECT COUNT(*) FROM pg_proc WHERE proname = 'is_org_admin';

-- If 0, re-run function creation from migration 005 (lines 47-79)
```

### Error: "permission denied for schema public"

**Cause**: Insufficient privileges.

**Fix**:
```sql
-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID, UUID) TO authenticated;
```

### Error: "policy already exists"

**Cause**: Migration was partially applied.

**Fix**:
```sql
-- Drop all policies and re-run migration
DROP POLICY IF EXISTS "users_see_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "admins_see_org_members" ON user_organizations;
DROP POLICY IF EXISTS "users_update_own_memberships" ON user_organizations;
DROP POLICY IF EXISTS "admins_insert_org_members" ON user_organizations;
DROP POLICY IF EXISTS "admins_update_org_members" ON user_organizations;
DROP POLICY IF EXISTS "admins_delete_org_members" ON user_organizations;
DROP POLICY IF EXISTS "service_role_full_access" ON user_organizations;

-- Re-run migration 005
```

### Recursion Still Occurs

**Cause**: Old policies not dropped.

**Fix**:
```sql
-- Check for old policies
SELECT policyname FROM pg_policies WHERE tablename = 'user_organizations';

-- Drop any policies from migration 003 or 004
DROP POLICY IF EXISTS "Users see own memberships" ON user_organizations;
DROP POLICY IF EXISTS "Admins see org members" ON user_organizations;
DROP POLICY IF EXISTS "user_sees_own_orgs" ON user_organizations;
DROP POLICY IF EXISTS "admins_manage_org_members" ON user_organizations;

-- Re-run migration 005
```

## Emergency Rollback

If the fix causes issues, temporarily disable RLS:

```sql
-- EMERGENCY ONLY - Disables all security
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;

-- Verify issues are resolved
SELECT * FROM user_organizations;

-- Re-enable RLS when ready
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Re-apply migration 005
```

## Success Criteria

✅ All 7 policies exist
✅ Function `public.is_org_admin` exists with SECURITY DEFINER
✅ User queries work without recursion error
✅ Admin queries work without recursion error
✅ Organizations table accessible
✅ No permission errors in logs

## Support

If issues persist:

1. Check Supabase logs for detailed errors
2. Verify PostgreSQL version (should be 14+)
3. Ensure Supabase auth is configured
4. Review `DATABASE_RLS_FIX_SUMMARY.md` for technical details

## Files Reference

- **Migration**: `database/migrations/005_fix_rls_recursion_safe.sql`
- **Technical Details**: `docs/DATABASE_RLS_FIX_SUMMARY.md`
- **This Guide**: `docs/APPLY_RLS_FIX.md`
