# 🚀 QUICK FIX: User Types Query Failure

## Problem
```
Error: Failed to get regular_user user type
at processSetupData (setup.js:721)
```

## Root Cause
RLS policy on `user_types` table blocks service role queries because it requires authentication context, but service role operates without `auth.uid()` during setup wizard.

## Fix (30 seconds)

### Option 1: Apply Migration (Recommended)

```bash
# Apply the fix migration
psql -h <your-supabase-host> \
     -U postgres \
     -d postgres \
     -f database/migrations/027_fix_user_types_rls.sql
```

### Option 2: Quick SQL Fix (Copy-Paste)

```sql
-- Drop restrictive policy
DROP POLICY IF EXISTS "Anyone can read user types" ON user_types;

-- Create role-specific policies
CREATE POLICY "service_role_select_user_types"
  ON user_types FOR SELECT TO service_role USING (true);

CREATE POLICY "authenticated_select_user_types"
  ON user_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "anon_select_user_types"
  ON user_types FOR SELECT TO anon USING (true);
```

### Option 3: Via Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL from Option 2
3. Click Run
4. Verify no errors

## Verification

```bash
# Test the fix by running setup wizard again
npm start
# Navigate to /setup and complete wizard
# Should complete without error
```

## What This Fix Does

- ✅ Allows service role to query `user_types` during setup
- ✅ Keeps security intact (authenticated/anon users can still read)
- ✅ Maintains admin controls (global admins can manage)
- ✅ Solves "Failed to get regular_user user type" error

## Why This Works

**Before Fix**:
- Policy: `USING (true)` → Requires authentication
- Service Role: No `auth.uid()` → Query returns 0 rows
- Setup: Fails with error

**After Fix**:
- Policy: `TO service_role USING (true)` → Explicit role permission
- Service Role: Direct access granted → Query returns data
- Setup: Completes successfully

---

**Time to Apply**: 30 seconds
**Risk Level**: Low (only affects RLS policies, not data)
**Tested**: Yes (verified with service role queries)

For detailed diagnosis, see: `docs/reports/RESEARCHER_DIAGNOSIS_USER_TYPES_ERROR.md`
