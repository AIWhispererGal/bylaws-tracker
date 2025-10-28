# 🚨 QUICK FIX: Setup Wizard Infinite Recursion

**Problem:** Setup wizard fails with "infinite recursion detected in policy for relation 'user_organizations'"

**Root Cause:** Circular RLS policy references in Supabase

**Time to Fix:** 2 minutes

---

## Step 1: Diagnose (30 seconds)

Open **Supabase Dashboard** → **SQL Editor** and run:

```sql
-- Check which policies are active
SELECT policyname
FROM pg_policies
WHERE tablename = 'user_organizations'
ORDER BY policyname;
```

### What to Look For:

❌ **BROKEN (Migration 008):**
```
"Admins see org members"
"Users see own memberships"
```

✅ **FIXED (Migration 008c):**
```
"admins_delete_members_v3"
"admins_insert_members_v3"
"service_role_access_v3"
"users_see_memberships_v3"
"users_update_memberships_v3"
```

---

## Step 2: Apply Fix (2 minutes)

### If you see policies WITHOUT "_v3" suffix:

1. **Open Supabase Dashboard** → **SQL Editor**
2. **Copy** the entire contents of this file:
   ```
   /database/migrations/008c_fix_recursion_properly.sql
   ```
3. **Paste** into SQL Editor
4. **Click "Run"**
5. **Wait** for "Success" message

---

## Step 3: Verify (30 seconds)

Run this query again:

```sql
SELECT policyname
FROM pg_policies
WHERE tablename = 'user_organizations'
ORDER BY policyname;
```

You should now see 5 policies ending in `_v3`:
- ✅ `admins_delete_members_v3`
- ✅ `admins_insert_members_v3`
- ✅ `service_role_access_v3`
- ✅ `users_see_memberships_v3`
- ✅ `users_update_memberships_v3`

---

## Step 4: Test Setup Wizard

1. **Clear your browser cache** (or open incognito window)
2. **Navigate to** `/setup`
3. **Complete the setup wizard**
4. **Verify** no recursion error at organization creation step

---

## What This Fix Does

### Before (Migration 008):
```sql
-- ❌ BROKEN: Queries user_organizations from within user_organizations policy
CREATE POLICY ON user_organizations USING (
  organization_id IN (
    SELECT organization_id FROM user_organizations  -- RECURSION!
    WHERE user_id = auth.uid()
  )
);
```

### After (Migration 008c):
```sql
-- ✅ FIXED: Uses SECURITY DEFINER function to bypass RLS
CREATE FUNCTION is_org_admin_for_org(user_id, org_id)
RETURNS BOOLEAN
SECURITY DEFINER  -- Bypasses RLS!
AS $$
  SELECT EXISTS (...);
$$;

CREATE POLICY ON user_organizations USING (
  is_org_admin_for_org(auth.uid(), organization_id)  -- No recursion!
);
```

---

## If You Still See Errors

1. Check Supabase logs for detailed error messages
2. Verify the function exists:
   ```sql
   SELECT routine_name, security_type
   FROM information_schema.routines
   WHERE routine_name = 'is_org_admin_for_org';
   ```
   Expected: 1 row with `security_type = 'DEFINER'`

3. If function is missing, re-run Migration 008c

---

## Need More Help?

See full diagnosis in: `/docs/HIVE_MIND_DIAGNOSIS_REPORT.md`

---

**Created by:** Hive Mind Collective Intelligence
**Date:** 2025-10-28
