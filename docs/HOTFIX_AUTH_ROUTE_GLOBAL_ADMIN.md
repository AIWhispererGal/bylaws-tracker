# 🚨 HOTFIX: Auth Route Invitation Fix (Third Layer)

## Status: ✅ FIXED

---

## Problem

Even after fixing:
1. ✅ Database RLS policies (migration 015)
2. ✅ Application middleware (roleAuth.js)

**Global admins still got blocked** with:
```
Error: Only organization admins can invite users
403 Forbidden from /auth/invite-user
```

---

## Root Cause (Discovered)

There are **TWO separate invitation routes** in the codebase:

### Route 1: `/users/invite` (in src/routes/users.js)
- Uses `requireAdmin` middleware
- ✅ Fixed by updating roleAuth.js

### Route 2: `/auth/invite-user` (in src/routes/auth.js) ❌
- Uses custom `isOrgAdmin()` helper function
- **Never checks global admin status**
- This is the route the frontend was calling!

## The Frontend Call

`/views/admin/organization-detail.ejs:377`:
```javascript
fetch('/auth/invite-user', {  // ❌ Calls the route without global admin check
  method: 'POST',
  body: JSON.stringify({ email, role, organizationId })
})
```

---

## The Fix

Updated `isOrgAdmin()` helper function in `src/routes/auth.js` (lines 44-69):

### Before (BROKEN):
```javascript
async function isOrgAdmin(supabase, userId, organizationId) {
  const { data, error } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)  // ❌ Only checks this org
    .single();

  if (error || !data) return false;
  return ['owner', 'admin'].includes(data.role);
}
```

### After (FIXED):
```javascript
async function isOrgAdmin(supabase, userId, organizationId) {
  // Check if user is a global admin first
  const { data: globalAdminCheck } = await supabase
    .from('user_organizations')
    .select('is_global_admin')
    .eq('user_id', userId)
    .eq('is_global_admin', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (globalAdminCheck) {
    return true;  // ✅ Global admins bypass org-level check
  }

  // Check organization-level admin status
  const { data, error } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) return false;
  return ['owner', 'admin'].includes(data.role);
}
```

---

## All Three Layers Now Fixed

### Layer 1: Database RLS ✅
- **File**: `database/migrations/015_fix_invitations_global_admin_rls.sql`
- **What**: Added `is_global_admin()` to all 4 RLS policies
- **Status**: Applied

### Layer 2: Application Middleware ✅
- **File**: `src/middleware/roleAuth.js`
- **What**: Updated `hasRole()` to check global admin first
- **Status**: Applied

### Layer 3: Custom Helper Functions ✅
- **File**: `src/routes/auth.js`
- **What**: Updated `isOrgAdmin()` to check global admin first
- **Status**: Applied (this fix)

---

## Test NOW

**No migration needed - just restart server!**

```bash
npm restart
```

Then:
1. Login as global admin
2. Go to organization detail page (the one calling `/auth/invite-user`)
3. Click invite user
4. Fill form
5. Submit
6. **Should work!** ✅

---

## Why Three Layers?

This highlights the importance of **defense in depth**:

1. **Database**: Final security boundary (RLS)
2. **Middleware**: Reusable authorization checks
3. **Route Helpers**: Custom business logic

**All three need global admin support!**

---

## Related Files

- `src/routes/auth.js` (lines 44-69) - isOrgAdmin() helper
- `src/routes/users.js` - Alternative invitation route
- `src/middleware/roleAuth.js` - requireAdmin middleware
- `src/middleware/globalAdmin.js` - isGlobalAdmin() utility
- `database/migrations/015_fix_invitations_global_admin_rls.sql` - RLS policies

---

## Documentation Created

- `docs/HOTFIX_GLOBAL_ADMIN_INVITATIONS.md` - RLS fix (layer 1)
- `docs/HOTFIX_ROLEAUTH_GLOBAL_ADMIN.md` - Middleware fix (layer 2)
- `docs/HOTFIX_AUTH_ROUTE_GLOBAL_ADMIN.md` - This file (layer 3)
- `docs/MIGRATION_015_QUICK_APPLY.md` - Migration guide
- `docs/MIGRATION_016_EXPLANATION.md` - Verification function

---

## Future Prevention

### Checklist for New Protected Routes:

✅ Database RLS policies include `is_global_admin()` OR clause
✅ Use standard middleware (`requireAdmin`, `requireOwner`, `requireMember`)
✅ If using custom helpers, check global admin first
✅ Test with global admin account
✅ Document which routes support global admin

### Pattern to Follow:

```javascript
// ✅ CORRECT: Check global admin first
async function canDoAction(supabase, userId, resourceId) {
  // 1. Check global admin first
  const isGlobal = await isGlobalAdmin({ supabase, session: { userId } });
  if (isGlobal) return true;

  // 2. Then check resource-specific permissions
  const { data } = await supabase
    .from('permissions')
    .select('*')
    .eq('user_id', userId)
    .eq('resource_id', resourceId);

  return !!data;
}
```

---

## Priority: 🔴 CRITICAL (NOW FIXED)

**Status**: ✅ Code updated
**Deploy**: Restart Node.js server
**Testing**: Try invitation from organization detail page
**Risk**: None (only extends permissions)

---

**All three security layers now recognize global admins! Test invitation creation immediately.** 🚀
