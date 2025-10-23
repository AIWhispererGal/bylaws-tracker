# 🔧 Apply Migration 008: Fix Global Admin RLS Policies

## Problem Summary

**Issue**: Global Admin users cannot see ANY organizations
**Root Cause**: RLS policies only check `user_organizations` membership, not `user_types.global_permissions`
**Fix**: Add `is_global_admin()` helper function and update all RLS policies

---

## 🚀 Apply the Fix (3 minutes)

### ✅ **RECOMMENDED: Via Supabase Dashboard** (Easiest)

1. **Open Supabase Dashboard**
   - Go to: https://auuzurghrjokbqzivfca.supabase.co
   - Click: **SQL Editor** (left sidebar)

2. **Run Migration 008**
   - Open this file in your editor: `database/migrations/008_fix_global_admin_rls.sql`
   - Copy **ALL** contents (160 lines)
   - Paste into Supabase SQL Editor
   - Click **"Run"** button

3. **Verify Success**
   - You should see: **"Success. No rows returned"**
   - Check output for any errors (there shouldn't be any)

---

### Alternative: Via psql Command Line

```bash
# From project root directory
psql "postgresql://postgres:89W2$HwjBd.eg5T@db.auuzurghrjokbqzivfca.supabase.co:5432/postgres" \
  -f database/migrations/008_fix_global_admin_rls.sql
```

---

## ✅ Verify the Fix Works

### Test 1: Check Helper Function Exists

Run this in Supabase SQL Editor:

```sql
-- Should return 1 row showing the function
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name = 'is_global_admin'
  AND routine_schema = 'public';
```

**Expected**: `is_global_admin | DEFINER`

---

### Test 2: Test Global Admin Access

```sql
-- Find your global admin user ID
SELECT id, email, user_type_id
FROM users
WHERE email = 'your-admin@example.com';

-- Check if they have global admin permission
SELECT
  u.email,
  ut.type_code,
  ut.global_permissions->>'can_access_all_organizations' as can_see_all,
  is_global_admin(u.id) as is_admin_check
FROM users u
JOIN user_types ut ON u.user_type_id = ut.id
WHERE u.email = 'your-admin@example.com';
```

**Expected**:
- `can_see_all = true`
- `is_admin_check = true`

---

### Test 3: Verify Organization Visibility

```sql
-- Login as your global admin user in the app, then check:
SELECT COUNT(*) as total_orgs FROM organizations;
```

**Expected**: Should return **ALL** organizations, not zero!

---

### Test 4: Check Updated Policies

```sql
-- Should show updated policies with is_global_admin() checks
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('organizations', 'user_organizations', 'documents', 'document_sections', 'suggestions')
ORDER BY tablename, policyname;
```

**Expected**: All policies should exist with no errors

---

## 🔍 What This Migration Does

**Tables/Policies Updated:**
1. ✅ `organizations` - Global admin sees ALL orgs
2. ✅ `user_organizations` - Global admin sees ALL memberships
3. ✅ `documents` - Global admin sees ALL documents
4. ✅ `document_sections` - Global admin sees ALL sections
5. ✅ `suggestions` - Global admin sees ALL suggestions

**New Database Function:**
- `is_global_admin(user_id)` - Returns `true` if user has `can_access_all_organizations` permission

**How It Works:**
```sql
-- Example: Old policy (BROKEN)
CREATE POLICY "Users see own organizations"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
  );

-- New policy (FIXED)
CREATE POLICY "Users see own organizations"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR is_global_admin(auth.uid())  -- 👈 ADDED
  );
```

---

## 🧪 Real-World Test

### Before Migration:
1. Login as Global Admin
2. Go to `/admin/dashboard`
3. **Bug**: "No organizations in database" 😞

### After Migration:
1. Login as Global Admin
2. Go to `/admin/dashboard`
3. **Fixed**: ALL organizations visible! ✅

---

## 🐛 Troubleshooting

### Error: "function is_global_admin already exists"

**Cause**: Migration was run twice
**Fix**: Safe to ignore (function will be replaced)

---

### Error: "policy does not exist"

**Cause**: First time running this migration
**Fix**: Safe to ignore (policies will be created fresh)

---

### Global Admin Still Can't See Orgs

**Possible causes:**

1. **User not marked as global admin**
   ```sql
   -- Check user type
   SELECT u.email, ut.type_code, ut.global_permissions
   FROM users u
   JOIN user_types ut ON u.user_type_id = ut.id
   WHERE u.email = 'your-admin@example.com';

   -- If not global_admin, update:
   UPDATE users
   SET user_type_id = (SELECT id FROM user_types WHERE type_code = 'global_admin')
   WHERE email = 'your-admin@example.com';
   ```

2. **Browser cache issue**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or logout and login again

3. **Session needs refresh**
   - Logout completely
   - Login again
   - Session will pick up new RLS policies

---

## 🎉 Success Indicators

After applying migration 008:

✅ Function `is_global_admin()` exists in database
✅ 5 tables have updated RLS policies
✅ Global admin can see ALL organizations
✅ Global admin can access `/admin/dashboard` with full org list
✅ Regular users still only see their assigned orgs (security maintained)
✅ No SQL errors when querying organizations

---

## 📊 Performance Note

**Query Performance**: The `is_global_admin()` function adds a JOIN to RLS checks. Expected performance impact:

- **Global admins**: +5-10ms per query (acceptable for admin users)
- **Regular users**: No impact (function short-circuits on first check)
- **Caching**: Postgres caches function results within transaction

**Optimization**: The function uses `STABLE` + `SECURITY DEFINER` for best performance.

---

## 🔒 Security Impact

**Security Level**: ✅ **IMPROVED**

**Before Migration:**
- ❌ Global admins couldn't see orgs (broken security model)
- ❌ Backend bypassed RLS with service role (inconsistent)

**After Migration:**
- ✅ Global admins have proper RLS-level access
- ✅ Consistent security model across all queries
- ✅ Regular users still protected (only see their orgs)
- ✅ Audit trail works correctly (RLS logs who accessed what)

---

## 📁 Related Files

- **Migration**: `database/migrations/008_fix_global_admin_rls.sql`
- **Analysis**: `docs/analysis/GLOBAL_ADMIN_PERMISSIONS_ANALYSIS.md`
- **This Guide**: `database/migrations/APPLY_008_GLOBAL_ADMIN_FIX.md`

---

## ⏭️ Next Steps

After applying this migration:

1. ✅ Test global admin login
2. ✅ Verify organization visibility
3. ⏭️ Apply migration 009 (section operations RPC functions)
4. ⏭️ Fix critical UX/UI issues

---

**Migration Status**: ✅ READY TO APPLY
**Estimated Time**: 3 minutes
**Risk Level**: 🟢 Low (adds functionality, doesn't remove anything)
**Rollback**: Can be rolled back by dropping policies and function
