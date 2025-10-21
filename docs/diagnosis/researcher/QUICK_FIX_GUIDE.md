# ⚡ QUICK FIX GUIDE: Permissions & Org Selector Bugs

**For Coder Agent** | **From Researcher Agent** | **Time: 15 min**

---

## 🎯 THE BUGS

1. **User shows as "Viewer"** instead of "Owner" after setup
2. **Org selector shows "No Organizations Found"** after creation

---

## 🔧 THE FIXES (3 Changes)

### FIX 1: Apply Migration 025 (2 min)

**In Supabase SQL Editor**:
```sql
-- Paste entire file: database/migrations/025_seed_organization_roles.sql
-- Click "Run"
```

**Verify**:
```sql
SELECT COUNT(*) FROM organization_roles;
-- Should return: 5
```

---

### FIX 2: Change Client in Auth Route (1 min)

**File**: `src/routes/auth.js`
**Line**: 1257

**Change**:
```diff
  } else {
    // Regular user: show only their organizations
-   const { data, error } = await supabase
+   const { data, error } = await supabaseService
      .from('user_organizations')
      .select(`
        organization_id,
```

**Why**: Use service client to bypass RLS and guarantee query succeeds.

---

### FIX 3: Better Error Message (2 min)

**File**: `src/routes/setup.js`
**Line**: 750-753

**Change**:
```diff
  if (roleError || !ownerRole) {
      console.error('[SETUP-DEBUG] ❌ Error getting owner role:', roleError);
+
+     // Better error message if roles table is empty
+     if (roleError?.code === 'PGRST116') {
+         throw new Error(
+             'Organization roles not configured. ' +
+             'Please run migration: database/migrations/025_seed_organization_roles.sql'
+         );
+     }
+
      throw new Error('Failed to get owner role for organization creator');
  }
```

**Why**: Help developers diagnose missing migration faster.

---

## ✅ TESTING (10 min)

### Test 1: Permission Assignment
```bash
# 1. Run setup wizard
# 2. Check database:
```

```sql
SELECT
    u.email,
    uo.role,
    oRole.role_code,
    oRole.role_name
FROM users u
JOIN user_organizations uo ON uo.user_id = u.id
LEFT JOIN organization_roles oRole ON uo.org_role_id = oRole.id
WHERE u.email = 'your-test@email.com';
```

**Expected**: `role_code = 'owner'`

---

### Test 2: Organization Selector
```bash
# 1. Login
# 2. Create new organization
# 3. Redirected to /auth/select
# 4. Check: Organization appears in list
```

**Expected**: See organization immediately, no "No Organizations Found"

---

### Test 3: Dashboard Permissions
```bash
# 1. Select organization from selector
# 2. Go to dashboard
# 3. Check top-right corner for role badge
```

**Expected**: Shows "Owner" badge, NOT "Viewer"

---

## 🐛 DEBUG QUERIES

If tests fail, run diagnostic file:

```bash
# In Supabase SQL Editor
# Paste: database/diagnosis/verify_permissions_selector_bugs.sql
# Read output for specific failure point
```

---

## 📊 CHECKLIST

- [ ] Migration 025 applied (verify 5 roles exist)
- [ ] `auth.js` line 1257 changed to `supabaseService`
- [ ] `setup.js` error handling improved
- [ ] Test 1 passed (owner role in database)
- [ ] Test 2 passed (org appears in selector)
- [ ] Test 3 passed (dashboard shows "Owner")
- [ ] Commit changes with message: "Fix permissions assignment and org selector bugs"

---

## 🎤 HANDOFF TO TESTER

After applying fixes, tester should verify:

1. ✅ Fresh setup wizard completes successfully
2. ✅ User assigned "owner" role in database
3. ✅ Organization appears in selector immediately
4. ✅ Dashboard shows correct "Owner" badge
5. ✅ Admin menu items visible (not viewer-only)

---

**RESEARCH COMPLETE** ✅ | **READY FOR IMPLEMENTATION** 🚀
