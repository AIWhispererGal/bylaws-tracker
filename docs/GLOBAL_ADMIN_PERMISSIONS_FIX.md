# 🔒 Global Admin Permissions Fix

**Date:** 2025-10-28
**Issue:** Global admins blocked from accessing user management with "Insufficient permissions" error
**Status:** ✅ FIXED

---

## 🔴 The Problem

Global admins were getting permission denied errors when trying to access organization-level features:

```json
{
  "error": "Insufficient permissions",
  "code": "PERMISSION_DENIED",
  "required": "can_manage_users"
}
```

### Root Cause

The permission middleware had a logical flaw:

```javascript
// OLD (BROKEN):
if (orgLevel) {
  // Check org-level permission
  hasPermission = await hasOrgPermission(userId, organizationId, permission);
}

if (!hasPermission) {
  // DENIED - even for global admins!
}
```

**Problem:** Global admins don't have org-level permissions set in `user_organizations` table. They get their permissions from `user_types.global_permissions`, but the middleware only checked org-level permissions.

---

## ✅ The Solution

Modified 3 middleware functions to check for global admin status FIRST:

### 1. `requirePermission()`
```javascript
// NEW (FIXED):
// Check if user is global admin FIRST
const isGlobalAdminUser = await hasGlobalPermission(userId, 'can_access_all_organizations');

if (isGlobalAdminUser) {
  console.log(`[Permissions] User ${userId} is global admin - GRANTED`);
  req.isGlobalAdmin = true;
  return next(); // ✅ Bypass all checks
}

// Only check org permissions if NOT global admin
if (orgLevel) {
  hasPermission = await hasOrgPermission(userId, organizationId, permission);
}
```

### 2. `requireMinRoleLevel()`
```javascript
// Global admins bypass role level checks (owner, admin, member, viewer)
const isGlobalAdminUser = await hasGlobalPermission(userId, 'can_access_all_organizations');

if (isGlobalAdminUser) {
  req.isGlobalAdmin = true;
  return next(); // ✅ Bypass
}
```

### 3. `requireRole()`
```javascript
// Global admins bypass specific role requirements
const isGlobalAdminUser = await hasGlobalPermission(userId, 'can_access_all_organizations');

if (isGlobalAdminUser) {
  req.isGlobalAdmin = true;
  return next(); // ✅ Bypass
}
```

---

## 🎯 Impact

### Before Fix:
- ❌ Global admins blocked from `/admin/users` (user management)
- ❌ Global admins blocked from org-level admin routes
- ❌ Had to manually set org-level permissions for each global admin

### After Fix:
- ✅ Global admins access ALL organization features automatically
- ✅ No need to manually configure org-level permissions
- ✅ Single source of truth: `user_types.global_permissions`
- ✅ Proper permission hierarchy:
  1. **Global Admin** → Full access to everything
  2. **Org Owner** → Full access to their organization
  3. **Org Admin** → Limited admin access to their organization
  4. **Member/Viewer** → Read/limited access

---

## 📋 File Modified

**File:** `/src/middleware/permissions.js`

**Changes:**
- Line 193-200: Added global admin bypass in `requirePermission()`
- Line 263-270: Added global admin bypass in `requireMinRoleLevel()`
- Line 321-328: Added global admin bypass in `requireRole()`

---

## 🧪 Testing

### Test 1: Global Admin Access to User Management
```bash
1. Login as global admin
2. Navigate to /admin/users
3. Expected: User management page loads ✅
4. Expected: Can invite users ✅
5. Expected: Can change user roles ✅
```

### Test 2: Global Admin Access to All Organizations
```bash
1. Login as global admin
2. Navigate to /admin (global admin dashboard)
3. Expected: Can see all organizations ✅
4. Expected: Can switch between organizations ✅
5. Expected: Can manage users in any organization ✅
```

### Test 3: Regular Users Still Restricted
```bash
1. Login as regular user (non-admin)
2. Try to access /admin/users
3. Expected: Permission denied ✅
4. Expected: Cannot see other organizations ✅
```

---

## 🔍 How It Works

### Permission Check Flow (After Fix):

```
1. User requests /admin/users
   ↓
2. requirePermission('can_manage_users', true) middleware runs
   ↓
3. Check: Is user a global admin?
   ├─ YES → GRANT ACCESS (bypass all checks)
   │        Set req.isGlobalAdmin = true
   │        Continue to route handler
   │
   └─ NO → Check organization-level permissions
             ├─ Has org permission? → GRANT ACCESS
             └─ No org permission? → DENY ACCESS
```

### Why This Works:

1. **Global admins** have `can_access_all_organizations = true` in their `user_types.global_permissions`
2. The `hasGlobalPermission()` function queries this via RPC
3. If true, we skip ALL other permission checks
4. Result: Global admins can access any organization feature

---

## 🎓 Best Practices Applied

### 1. Principle of Least Privilege
- Regular users: Limited to their organization + role
- Org admins: Limited to their organization
- Global admins: Full access (necessary for platform management)

### 2. Single Source of Truth
- Global permissions stored in `user_types` table
- Org permissions stored in `organization_roles` table
- No duplication or conflicts

### 3. Fail-Safe Defaults
- Default: Deny access
- Explicitly grant access based on permissions
- Global admin check happens FIRST (most permissive)

---

## 🚀 Next Steps (Optional)

### Performance Optimization:
Cache global admin status in session to avoid repeated database calls:

```javascript
// On login:
req.session.isGlobalAdmin = await hasGlobalPermission(userId, 'can_access_all_organizations');

// In middleware:
if (req.session.isGlobalAdmin) {
  return next(); // No database call needed
}
```

### Audit Logging:
Log when global admins access organization features:

```javascript
if (isGlobalAdminUser) {
  await logAuditEvent({
    userId,
    action: 'global_admin_access',
    resource: permission,
    organizationId
  });
}
```

---

## ✅ Status

**Fix Applied:** ✅
**Testing:** Ready for testing
**Breaking Changes:** None
**Backwards Compatible:** Yes

All global admins should now have full access to organization-level features as intended.

---

**Related Issues:**
- Database recursion fix (Issue #1) ✅ Fixed
- User invite 404 error (Issue #2) ✅ Fixed
- Global admin permissions (Issue #3) ✅ Fixed (this document)
