# 🔧 Quick Fix: Apply Migration 003

## Problem Diagnosed by Detective Agent

**Issue:** Users see "no organizations in database" after creation
**Root Cause:** `user_organizations` table missing RLS enablement in migration 001
**Fix:** Enable RLS with proper policies

---

## 🚀 Apply the Fix (2 minutes)

### Option 1: Via Supabase Dashboard (Easiest)

1. **Open Supabase Dashboard**
   - Go to: https://auuzurghrjokbqzivfca.supabase.co
   - Navigate to: SQL Editor

2. **Run Migration 003**
   - Copy the contents of `003_enable_user_organizations_rls.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Verify Success**
   - You should see: "Success. No rows returned"
   - Check: Tables → user_organizations → "RLS enabled" should show ✅

### Option 2: Via psql Command Line

```bash
# From project root
psql "postgresql://postgres:[password]@db.auuzurghrjokbqzivfca.supabase.co:5432/postgres" \
  -f database/migrations/003_enable_user_organizations_rls.sql
```

### Option 3: Via Node.js Script

```bash
# Run the migration script
node database/migrations/001-generalize-schema.js --migration=003
```

---

## ✅ Verify the Fix

### Test 1: Check RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'user_organizations';

-- Expected: rowsecurity = true
```

### Test 2: Check Policies Exist

```sql
SELECT policyname
FROM pg_policies
WHERE tablename = 'user_organizations';

-- Expected: 5 policies listed
```

### Test 3: Login as User

1. Logout current user
2. Login as the newly created user
3. Dashboard should now show the organization! ✅

---

## 🔍 What This Fix Does

**Before:**
- ❌ `user_organizations` had NO RLS (security gap!)
- ❌ RLS policies on `organizations` referencing `user_organizations` failed silently
- ❌ Users couldn't see organizations they were assigned to

**After:**
- ✅ `user_organizations` has RLS enabled
- ✅ 5 security policies protect user data properly
- ✅ Users can see their own memberships
- ✅ Admins can manage org members
- ✅ Dashboard queries work correctly

---

## 📋 The 5 Policies Created

1. **"Users see own memberships"** - Users see organizations they belong to
2. **"Admins see org members"** - Admins see all members in their orgs
3. **"Users update own memberships"** - Users can update their own preferences
4. **"Admins insert org members"** - Admins can add new members
5. **"Admins delete org members"** - Admins can remove members

---

## 🐛 If You Still See Issues

### Clear Browser Cache
```
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Check User Assignment
```sql
-- Verify user is assigned to organization
SELECT * FROM user_organizations
WHERE user_id = '<user-uuid>'
AND organization_id = '5bc79ee9-ac8d-4638-864c-3e05d4e60810';

-- Should return 1 row with role (owner, admin, or member)
```

### Re-login
- Logout completely
- Login again
- Session will refresh with correct RLS context

---

## 🎉 Success Indicators

After applying migration 003, you should see:

✅ No SQL errors when running migration
✅ 5 policies listed in Supabase dashboard
✅ User login shows organization
✅ Dashboard loads correctly
✅ No more "no organizations in database" message

---

**Detective Agent Case Status:** ✅ SOLVED

*This fix patches the security gap and restores organization visibility for all users!*
