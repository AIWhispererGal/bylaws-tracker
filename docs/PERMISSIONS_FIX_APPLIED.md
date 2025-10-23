# 🔐 Permissions System Fix - APPLIED

**Date**: October 22, 2025
**Status**: 🟢 CRITICAL FIXES APPLIED - MIGRATION REQUIRED

---

## 🚨 Problem Summary

**Org Owner gets:** `{"error":"Insufficient permissions","code":"INSUFFICIENT_ROLE_LEVEL","required_level":3}`

**Root Cause**: Two issues found:
1. `/admin/users` route used OLD `requireMinRoleLevel(3)` from user_types system
2. **RPC functions don't exist** in database (all permission checks were failing!)

---

## ✅ Fixes Applied

### **Fix #1: Update Route to Use Permission System**
**File**: `src/routes/admin.js:38`

**BEFORE** (broken):
```javascript
router.get('/users', requireMinRoleLevel(3), attachPermissions, async (req, res) => {
```
- Uses hardcoded level `3` from OLD user_types (ORG_ADMIN)
- Doesn't match NEW organization_roles hierarchy (0, 10, 20, 30, 40)

**AFTER** (fixed):
```javascript
router.get('/users', requirePermission('can_manage_users', true), attachPermissions, async (req, res) => {
```
- Checks actual permission `can_manage_users` from org_permissions JSON
- Owner role has `"can_manage_users": true` ✅

---

### **Fix #2: Create Missing RPC Functions**
**File**: `database/migrations/006_create_permission_rpc_functions.sql`

Created 4 critical functions that were missing:

1. **`user_has_org_permission(user_id, org_id, permission)`**
   - Checks if user has specific org permission
   - Reads from `organization_roles.org_permissions` JSON
   - Handles special case for `can_approve_stages` array

2. **`user_has_global_permission(user_id, permission)`**
   - Checks if user has global permission
   - Reads from `user_types.global_permissions` JSON

3. **`user_has_min_role_level(user_id, org_id, min_level)`**
   - Checks if user meets minimum hierarchy level
   - Uses `organization_roles.hierarchy_level`
   - **CRITICAL**: Lower number = higher privilege (0 > 10 > 20 > 30 > 40)

4. **`get_user_effective_permissions(user_id, org_id)`**
   - Merges global + org permissions
   - Org permissions take precedence

---

## 🎯 Organization Roles Hierarchy

Your organization_roles table uses this hierarchy:

| Role | hierarchy_level | can_manage_users | Description |
|------|----------------|------------------|-------------|
| **owner** | **0** (highest) | **true** ✅ | Full control |
| **admin** | **10** | **true** ✅ | Administrative privileges |
| **editor** | **20** | **false** ❌ | Edit docs, no user mgmt |
| **member** | **30** | **false** ❌ | View & vote |
| **viewer** | **40** (lowest) | **false** ❌ | Read-only |

**Permission Check Logic**:
- Owner (level 0) has `can_manage_users: true` → ✅ PASS
- Admin (level 10) has `can_manage_users: true` → ✅ PASS
- Editor (level 20) has `can_manage_users: false` → ❌ FAIL

---

## 🧪 How to Apply Fix

### **Step 1: Run Database Migration**
```bash
# Apply the migration to Supabase
# Option A: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Copy contents of database/migrations/006_create_permission_rpc_functions.sql
# 3. Execute the SQL

# Option B: Via CLI (if you have supabase CLI installed)
supabase db push
```

### **Step 2: Restart Server**
```bash
npm start
```

### **Step 3: Test As Org Owner**
1. Login to your org owner account
2. Navigate to: http://localhost:3000/admin/users
3. **Expected**: User list loads successfully ✅
4. **NOT**: `{"error":"Insufficient permissions"}` ❌

---

## 🧪 Testing Checklist

- [ ] Run migration `006_create_permission_rpc_functions.sql` in Supabase
- [ ] Restart Node.js server
- [ ] Login as org owner
- [ ] Navigate to /admin/users
- [ ] See user list (not error)
- [ ] Try other routes to ensure no regression

---

## 📊 Expected Behavior After Fix

**As Organization Owner:**
```
GET /admin/users
→ requirePermission('can_manage_users', true)
  → user_has_org_permission(userId, orgId, 'can_manage_users')
    → SELECT org_permissions->>'can_manage_users'
      FROM organization_roles WHERE role_code = 'owner'
    → Returns: true (because owner.org_permissions has can_manage_users: true)
→ ✅ PERMISSION GRANTED
→ User list page loads
```

**As Editor (no permission):**
```
GET /admin/users
→ requirePermission('can_manage_users', true)
  → user_has_org_permission(userId, orgId, 'can_manage_users')
    → SELECT org_permissions->>'can_manage_users'
      FROM organization_roles WHERE role_code = 'editor'
    → Returns: false (because editor.org_permissions has can_manage_users: false)
→ ❌ PERMISSION DENIED
→ 403 error
```

---

## 🐛 Troubleshooting

### Still getting permission error?

**Check 1**: Verify migration ran successfully
```sql
-- In Supabase SQL editor
SELECT proname FROM pg_proc WHERE proname LIKE 'user_has%';
```
Should return 4 functions:
- user_has_global_permission
- user_has_min_role_level
- user_has_org_permission
- get_user_effective_permissions

**Check 2**: Verify your user has owner role
```sql
SELECT
  uo.user_id,
  uo.organization_id,
  or_table.role_code,
  or_table.role_name,
  or_table.hierarchy_level,
  or_table.org_permissions->>'can_manage_users' as can_manage_users
FROM user_organizations uo
INNER JOIN organization_roles or_table ON uo.org_role_id = or_table.id
WHERE uo.user_id = 'your-user-id';
```
Should show:
- role_code: 'owner'
- hierarchy_level: 0
- can_manage_users: 'true'

**Check 3**: Check server logs
Look for:
```
[Permissions] User [uuid] denied: can_manage_users (orgLevel: true)
```
If you see this, the RPC function returned false - check your role assignment.

---

## 📁 Files Modified

1. **`src/routes/admin.js`** - Line 38: Changed to use `requirePermission`
2. **`database/migrations/006_create_permission_rpc_functions.sql`** - NEW: 4 RPC functions

---

## 🎉 Summary

**Old System (Broken)**:
- ❌ Hardcoded `requireMinRoleLevel(3)` from user_types
- ❌ RPC functions didn't exist
- ❌ Owner couldn't access /admin/users

**New System (Fixed)**:
- ✅ Uses `requirePermission('can_manage_users', true)`
- ✅ RPC functions created in database
- ✅ Owner can access /admin/users

**After applying migration and restarting server, org owners will be able to manage users!** 🚀
