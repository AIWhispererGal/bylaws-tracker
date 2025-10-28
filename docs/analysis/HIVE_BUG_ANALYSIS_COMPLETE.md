# Hive Mind Bug Analysis - Complete Report
**Date:** 2025-10-27
**Analyst:** Analyst Agent
**Swarm:** swarm-1761627819200-fnb2ykjdl

## Executive Summary

Analysis complete. Two bugs identified with specific remediation paths:

1. **BUG1**: Incorrect user column reference (`full_name` vs `name`)
2. **BUG2**: Missing route protection allowing org owners to access global admin pages

---

## BUG1: Incorrect User Column Reference

### Problem
Code is attempting to fetch `full_name` from the users table, but the actual column is named `name`.

### Users Table Schema (Actual)
```sql
id              uuid PRIMARY KEY
email           text
name            text          ← CORRECT COLUMN
avatar_url      text
auth_provider   text
created_at      timestamp
last_login      timestamp
is_global_admin boolean
user_type_id    uuid
```

### Locations with Incorrect References

#### 1. `/src/routes/admin.js` - Line 73, 99, 353
```javascript
// ❌ INCORRECT (Line 73):
.select('id, email, full_name, is_global_admin, created_at')

// ❌ INCORRECT (Line 99):
full_name: userDetail.full_name || userDetail.email || 'Unknown User',

// ❌ INCORRECT (Line 353):
.select('id, email, full_name')

// ✅ SHOULD BE:
.select('id, email, name, is_global_admin, created_at')
name: userDetail.name || userDetail.email || 'Unknown User',
.select('id, email, name')
```

#### 2. `/src/routes/auth.js` - Line 1035
```javascript
// ❌ INCORRECT (Line 1035):
const { token, full_name, password } = req.body;

// ✅ SHOULD BE:
const { token, name, password } = req.body;
// Also check view template: views/auth/accept-invite.ejs
```

### Impact
- User management page fails to load user details
- Accept invitation form fails to process submissions
- Users see "Unknown User" instead of actual names

### Recommended Fix

**Priority:** HIGH
**Estimated Time:** 15 minutes
**Risk:** LOW (simple column rename)

**Steps:**
1. Edit `/src/routes/admin.js`:
   - Line 73: Change `full_name` → `name`
   - Line 99: Change `userDetail.full_name` → `userDetail.name`
   - Line 353: Change `full_name` → `name`

2. Edit `/src/routes/auth.js`:
   - Line 1035: Change `full_name` → `name`

3. Verify frontend form field names match (check `views/auth/accept-invite.ejs`)

---

## BUG2: Missing Route Protection - Global Admin Access

### Problem
Organization owners can accidentally access global admin pages because middleware checks are incomplete. The codebase has TWO protection patterns:

1. `requireGlobalAdmin` middleware (correct - from `/src/middleware/globalAdmin.js`)
2. `requireAdmin` function (incorrect - allows org admins)

### Current Vulnerable Routes

#### Admin Routes Without Global Admin Protection

**File:** `/src/routes/admin.js`

| Route | Current Middleware | Issue |
|-------|-------------------|-------|
| `GET /admin/dashboard` | `attachPermissions` only | ❌ No admin check |
| `GET /admin/organization` | `requirePermission('can_configure_organization', true)` | ✅ OK (permission-based) |
| `GET /admin/organization/:id` | `requireAdmin` | ❌ Allows org owners |
| `GET /admin/workflows` | `requireAdmin` | ❌ Allows org owners |
| `POST /admin/documents/upload` | `attachGlobalAdminStatus, requireAdmin` | ❌ Still allows org owners |

### The requireAdmin Problem

```javascript
// Line 22-32 in /src/routes/admin.js
function requireAdmin(req, res, next) {
  // ❌ INCORRECT: This allows BOTH org admins AND global admins
  if (!req.session.isAdmin && !req.isGlobalAdmin) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Admin access required',
      error: { status: 403 }
    });
  }
  next();
}
```

**Issue:** `req.session.isAdmin` is set to `true` for organization owners/admins (see auth.js line 393), so they bypass this check.

### Correct Protection Pattern

**From `/src/middleware/globalAdmin.js`:**
```javascript
// ✅ CORRECT - Only allows global admins
function requireGlobalAdmin(req, res, next) {
  if (!req.isGlobalAdmin) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Global administrator access required',
      error: { status: 403 }
    });
  }
  next();
}
```

### Routes That Need Global Admin Protection

**Should be restricted to global admins ONLY:**
- `/admin/organization/:id` - View ANY organization (cross-org access)
- `/admin/dashboard` - View ALL organizations (global overview)
- `/admin/users` - Uses permission check (currently OK)

**Should allow org admins within their own org:**
- `/admin/workflows` - Manage workflow templates
- `/admin/documents/upload` - Upload documents
- `/admin/documents/:docId/hierarchy` - Edit hierarchy

### Permission Middleware Analysis

**File:** `/src/middleware/permissions.js`

The new permissions system (migration 024) is CORRECT:

```javascript
// ✅ CORRECT - Proper global admin check (Line 326)
function requireGlobalAdmin(req, res, next) {
  return requirePermission('can_access_all_organizations', false)(req, res, next);
}
```

**Key Insight:**
- `requirePermission(..., false)` = global permission check
- `requirePermission(..., true)` = organization-level permission check
- Global admins have `can_access_all_organizations` permission
- Org owners do NOT have this permission

### Recommended Fix

**Priority:** HIGH
**Estimated Time:** 30 minutes
**Risk:** MEDIUM (affects access control)

**Strategy:** Use permission system instead of `requireAdmin`

#### Option A: Replace requireAdmin with Permission Checks (RECOMMENDED)

```javascript
// For routes that should be global admin only:
router.get('/organization/:id',
  requirePermission('can_access_all_organizations', false),  // Global only
  async (req, res) => { ... }
);

// For routes that should allow org admins:
router.get('/workflows',
  requirePermission('can_manage_workflows', true),  // Org-level
  async (req, res) => { ... }
);
```

#### Option B: Fix requireAdmin Function (Quick Fix)

```javascript
// In /src/routes/admin.js, replace requireAdmin with:
function requireOrgAdmin(req, res, next) {
  // Only check org-level admin status, not global admin
  if (!req.session.isAdmin) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Organization administrator access required',
      error: { status: 403 }
    });
  }
  next();
}

// For global admin routes, explicitly use:
const { requireGlobalAdmin } = require('../middleware/globalAdmin');
router.get('/organization/:id', requireGlobalAdmin, async (req, res) => { ... });
```

---

## Current Protection State Summary

### Correctly Protected Routes
✅ `/auth/admin` - `requireGlobalAdmin` (line 1445)
✅ `/admin/users` - `requirePermission('can_manage_users', true)` (line 38)
✅ `/admin/organization` - `requirePermission('can_configure_organization', true)` (line 260)

### Incorrectly Protected Routes (Org Owners Can Access)
❌ `/admin/organization/:id` - Uses `requireAdmin` (should be global only)
❌ `/admin/dashboard` - No admin check (should be global only)
❌ `/admin/workflows` - Uses `requireAdmin` (OK for org admins)
❌ POST `/admin/documents/upload` - Uses `requireAdmin` (OK for org admins)

### Routes That Need Clarification
⚠️ `/admin/documents/:docId/hierarchy` - Uses `requireAdmin` (unclear if global or org-level)

---

## Database State

### Users Table
- ✅ `name` column exists
- ❌ `full_name` column does NOT exist
- Schema verified via permissions.js line 116

### User Types System (Migration 024)
- ✅ `user_types` table with `type_code` ('global_admin', 'regular_user')
- ✅ `users.user_type_id` foreign key to `user_types.id`
- ✅ `users.is_global_admin` boolean flag (legacy, still used)

### Permission System
- ✅ RPC functions: `user_has_global_permission`, `user_has_org_permission`
- ✅ Global permissions include: `can_access_all_organizations`
- ✅ Org permissions include: `can_manage_users`, `can_configure_organization`

---

## Testing Recommendations

### Test Case 1: User Column Reference
```javascript
// Should display user name correctly
const user = await supabase
  .from('users')
  .select('id, email, name')
  .eq('id', userId)
  .single();

console.log(user.name); // Should print actual name, not undefined
```

### Test Case 2: Route Protection
```javascript
// As org owner (not global admin):
// ❌ Should FAIL: GET /admin/organization/:otherOrgId
// ✅ Should SUCCEED: GET /admin/workflows (own org)

// As global admin:
// ✅ Should SUCCEED: GET /admin/organization/:anyOrgId
// ✅ Should SUCCEED: GET /admin/dashboard
```

---

## Coordination Notes

**Stored in Memory:**
- `hive/analyst/bug1-findings` - User column analysis
- `hive/analyst/bug2-routes` - Route protection gaps

**Next Steps for Coder:**
1. Apply BUG1 fixes (4 file locations)
2. Choose route protection strategy (Option A or B)
3. Apply BUG2 fixes to vulnerable routes
4. Test user management page load
5. Test route protection with org owner account

**Files to Modify:**
- `/src/routes/admin.js` (both bugs)
- `/src/routes/auth.js` (BUG1 only)
- Potentially `/views/auth/accept-invite.ejs` (verify form field name)

---

## Appendix: Permission Middleware Reference

### Global Admin Check Pattern
```javascript
const { requireGlobalAdmin } = require('../middleware/globalAdmin');
// OR
const { requirePermission } = require('../middleware/permissions');
router.get('/route', requirePermission('can_access_all_organizations', false), ...);
```

### Org Admin Check Pattern
```javascript
const { requirePermission } = require('../middleware/permissions');
router.get('/route', requirePermission('can_manage_users', true), ...);
```

### Available Global Permissions
- `can_access_all_organizations` - Global admin only
- (Others TBD - check user_type_permissions table)

### Available Org Permissions
- `can_manage_users`
- `can_configure_organization`
- `can_manage_workflows`
- `can_create_suggestions`
- `can_edit_sections`
- (Full list in organization_role_permissions table)

---

**Analysis Complete**
**Status:** Ready for Coder Agent Implementation
