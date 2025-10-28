# Global Admin Upload Permission Fix ✅

**Date**: 2025-10-27
**Agent**: Coder
**Status**: COMPLETE

## Problem

Global admins could not upload documents to client organizations because the upload route was missing the `attachGlobalAdminStatus` middleware, resulting in `req.isGlobalAdmin` being undefined.

## Root Cause

The `/admin/documents/upload` route (line 629 in `src/routes/admin.js`) had the following middleware chain:

```javascript
// BEFORE (BROKEN)
router.post('/documents/upload', requireAdmin, async (req, res) => {
```

The `requireAdmin` middleware checks `req.isGlobalAdmin`, but this property was never set because `attachGlobalAdminStatus` was not in the middleware chain.

## Solution Applied

### 1. Import the middleware

```javascript
// Line 10
const { requireGlobalAdmin, attachGlobalAdminStatus } = require('../middleware/globalAdmin');
```

### 2. Add to route middleware chain

```javascript
// Line 629 (FIXED)
router.post('/documents/upload', attachGlobalAdminStatus, requireAdmin, async (req, res) => {
```

## How It Works

### Middleware Execution Order (CORRECT):

1. **`attachGlobalAdminStatus`** (NEW!)
   - Queries `users` table for `is_global_admin = true`
   - Sets `req.isGlobalAdmin = true/false`
   - Sets `req.accessibleOrganizations = [...]`

2. **`requireAdmin`**
   - Checks `req.session.isAdmin` OR `req.isGlobalAdmin` ✅
   - Now works correctly for global admins!

3. **Route handler**
   - Uses `req.isGlobalAdmin` to skip org membership check (line 704)

## Code Changes

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/admin.js`

```diff
- const { requireGlobalAdmin } = require('../middleware/globalAdmin');
+ const { requireGlobalAdmin, attachGlobalAdminStatus } = require('../middleware/globalAdmin');

- router.post('/documents/upload', requireAdmin, async (req, res) => {
+ router.post('/documents/upload', attachGlobalAdminStatus, requireAdmin, async (req, res) => {
```

## Verification

The route handler already had proper logic to handle global admins:

```javascript
// Line 704-724
if (!req.isGlobalAdmin) {
  const { data: userOrg } = await supabaseService
    .from('user_organizations')
    .select('role')
    .eq('user_id', req.session.userId)
    .eq('organization_id', organizationId)
    .single();

  if (!userOrg || !['admin', 'owner', 'superuser'].includes(userOrg.role)) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
}
```

This skip logic now works correctly because `req.isGlobalAdmin` is properly set! ✅

## Testing Checklist

- [x] Import `attachGlobalAdminStatus` middleware
- [x] Add middleware to upload route chain BEFORE `requireAdmin`
- [x] Verify middleware execution order
- [x] Confirm `req.isGlobalAdmin` is set correctly
- [x] Document changes in memory via hooks

## Related Files

- `/src/routes/admin.js` (upload route)
- `/src/middleware/globalAdmin.js` (middleware definition)
- `/src/routes/auth.js` (reference implementation)

## Coordination

- Pre-task hook: ✅ Executed
- Post-edit hook: ✅ Stored in `hive/coder/permission-fix`
- Post-task hook: ✅ Completed `global-admin-upload-fix`

---

**Result**: Global admins can now upload documents to ANY organization without being members! 🎉
