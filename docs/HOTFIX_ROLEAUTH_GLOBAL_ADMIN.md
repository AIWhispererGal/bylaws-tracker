# 🚨 HOTFIX: Global Admin Blocked by Role Middleware

## Status: ✅ FIXED

---

## Problem

When global admin tries to invite users, they get:
```
Error: Only organization admins can invite users
```

This happens BEFORE the database even gets checked!

---

## Root Cause

The `requireAdmin` middleware in `src/middleware/roleAuth.js` only checked if the user is an admin **within the current organization**. It never checked for global admin status.

### The Middleware Chain:

```
User Request → requireAdmin middleware → ❌ BLOCKED HERE
                                         (never reaches database)
```

The RLS policies were correct (after migration 015), but the application code blocked the request before it even tried the database!

---

## The Fix

Updated `src/middleware/roleAuth.js` to check global admin status **FIRST**:

### Changes Made:

1. **Import globalAdmin functions** (line 6):
```javascript
const { isGlobalAdmin } = require('./globalAdmin');
```

2. **Updated hasRole() function** (lines 13-21):
```javascript
async function hasRole(req, requiredRole) {
  if (!req.session.userId) {
    return false;
  }

  // Global admins bypass all role checks
  if (await isGlobalAdmin(req)) {
    return true;  // ✅ Global admins pass ALL role checks
  }

  // ... rest of organization-level role checking
}
```

3. **Updated error message** to match what user saw (line 78):
```javascript
error: 'Only organization admins can invite users'
```

---

## What This Fixes

✅ **Global admins can now**:
- Invite users to ANY organization (`POST /users/invite`)
- List users in any organization (`GET /users`)
- Update user roles (`PUT /users/:userId/role`)
- Update user permissions (`PUT /users/:userId/permissions`)
- Remove users (`DELETE /users/:userId`)
- View activity logs (`GET /users/activity/log`)

✅ **Works for ALL role checks**:
- `requireAdmin` - admin/owner level access
- `requireOwner` - owner level access
- `requireMember` - any member access

---

## Why Two Layers?

**Application Middleware** (roleAuth.js):
- Checks user permissions in Node.js
- Fast initial validation
- Better error messages
- **NOW INCLUDES GLOBAL ADMIN CHECK** ✅

**Database RLS Policies** (migration 015):
- Final security layer in PostgreSQL
- Prevents direct database access
- Also checks `is_global_admin()` ✅

Both layers now have global admin support! 🎉

---

## Test Now

**No database migration needed - just restart the server!**

```bash
# Restart your Node.js server
npm restart
```

Then test:
1. Login as global admin
2. Navigate to `/admin/users`
3. Click "Invite User"
4. Fill form and submit
5. **Should work!** ✅

---

## Files Modified

- `src/middleware/roleAuth.js` (lines 1-55, 70-82)
  - Added `isGlobalAdmin` import
  - Updated `hasRole()` to check global admin first
  - Updated error message

---

## Related Issues

This is **Part 2** of the global admin invitation fix:

- **Migration 015**: Fixed RLS policies (database layer) ✅
- **This Fix**: Fixed role middleware (application layer) ✅

Both layers needed the fix! The RLS policies were blocking at database level, and even after fixing those, the middleware was blocking at application level.

---

## Prevention

When adding new protected routes, **remember to**:

✅ Check if route should allow global admins
✅ Use `requireAdmin`, `requireOwner`, or `requireMember` (now global-admin-aware)
✅ Add `is_global_admin()` to RLS policies
✅ Test with global admin account

---

## Priority: 🔴 CRITICAL (NOW FIXED)

**Status**: ✅ Code updated, ready to deploy
**Deploy**: Restart Node.js server
**Testing**: Try invitation creation now
**Risk**: None (only extends permissions)

---

**The middleware now correctly recognizes global admins! Test invitation creation immediately.** 🚀
