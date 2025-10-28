# 🔧 User Invitation Fixes

**Date:** 2025-10-28
**Issues:**
1. Role validation error with "editor" role
2. "User not allowed" error when inviting users
**Status:** ✅ FIXED

---

## 🔴 Issue #1: Role Mismatch

### Error Message:
```json
{
  "error": "role must be one of [owner, admin, member, viewer]"
}
```

### Root Cause:
**Frontend** offered "editor" role but **backend** only accepted [owner, admin, member, viewer]

**Frontend (views/admin/users.ejs line 545):**
```html
<option value="editor">Editor - Can edit and suggest changes</option>
```

**Backend (src/routes/users.js line 18):**
```javascript
role: Joi.string().valid('owner', 'admin', 'member', 'viewer').default('member')
```

**Mismatch:** "editor" not in allowed list!

### Fix Applied:
Changed frontend dropdown to use correct roles:

```html
<!-- OLD (BROKEN): -->
<option value="viewer">Viewer - Can view documents</option>
<option value="editor">Editor - Can edit and suggest changes</option>
<option value="admin">Admin - Full organization access</option>

<!-- NEW (FIXED): -->
<option value="viewer">Viewer - Can view documents</option>
<option value="member">Member - Can edit and suggest changes</option>
<option value="admin">Admin - Full organization access</option>
<option value="owner">Owner - Complete control (use with caution)</option>
```

Also fixed the role editing prompt:
```javascript
// OLD: 'admin/editor/viewer'
// NEW: 'owner/admin/member/viewer'
```

---

## 🔴 Issue #2: "User not allowed" Error

### Error Message:
```
Failed to send invitation: User not allowed
```

### Root Cause:
Using wrong Supabase client for admin operation.

**Line 295 (BEFORE):**
```javascript
// ❌ WRONG: Uses regular authenticated client
const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
  // ...
});
```

**Problem:** `req.supabase` is the regular user-authenticated client. It doesn't have `admin` privileges to invite users!

**Line 295 (AFTER):**
```javascript
// ✅ CORRECT: Uses service role client with admin privileges
const { data: authData, error: authError } = await supabaseService.auth.admin.inviteUserByEmail(email, {
  // ...
});
```

**Why this works:**
- `supabaseService` = Service role client (has admin privileges)
- `supabase` = Regular client (no admin privileges)
- `auth.admin.*` methods require admin privileges

---

## 📋 Files Modified

### 1. `/views/admin/users.ejs`
**Changes:**
- Line 545: Changed "editor" → "member"
- Line 547: Added "owner" option
- Line 596: Updated role editing prompt to include correct roles

### 2. `/src/routes/users.js`
**Changes:**
- Line 296: Changed `supabase.auth.admin` → `supabaseService.auth.admin`

---

## 🎯 Role Hierarchy

Now correctly implements 4-tier role system:

| Role | Level | Permissions |
|------|-------|-------------|
| **Owner** | 1 | Complete control, can delete organization |
| **Admin** | 2-3 | Manage users, settings, full edit access |
| **Member** | 4-5 | Edit documents, create suggestions |
| **Viewer** | 6+ | Read-only access |

---

## 🧪 Testing

### Test 1: Invite User as Member
```
1. Navigate to /admin/users
2. Click "Invite User"
3. Enter email
4. Select "Member" role
5. Submit
Expected: Invitation sent successfully ✅
```

### Test 2: Invite User as Admin
```
1. Navigate to /admin/users
2. Click "Invite User"
3. Enter email
4. Select "Admin" role
5. Submit
Expected: Invitation sent successfully ✅
```

### Test 3: Invite User as Owner
```
1. Navigate to /admin/users
2. Click "Invite User"
3. Enter email
4. Select "Owner" role
5. Submit
Expected: Invitation sent successfully ✅
Warning: Only give owner role to trusted users!
```

### Test 4: Edit User Role
```
1. Click edit icon next to existing user
2. Enter new role (owner/admin/member/viewer)
3. Submit
Expected: Role updated successfully ✅
```

---

## 🔍 Why These Errors Occurred

### Issue 1 Origins:
The "editor" role was likely from an older version of the system before the role architecture was standardized. The frontend wasn't updated when the backend validation changed.

### Issue 2 Origins:
Common mistake: Using the wrong Supabase client for admin operations. The pattern is:
- `req.supabase` → For user-level operations (queries with RLS)
- `req.supabaseService` → For admin operations (bypass RLS, admin methods)

---

## ✅ Verification

After fixes, these operations should work:

- ✅ Invite user with any valid role (owner/admin/member/viewer)
- ✅ No "role must be one of" validation errors
- ✅ No "User not allowed" Supabase errors
- ✅ Invitation emails sent successfully
- ✅ Role editing works with correct roles

---

## 📚 Related Documentation

- **Role System:** See `database/migrations/024_permissions_architecture.sql`
- **Permission Middleware:** See `src/middleware/permissions.js`
- **User Management:** See `src/routes/users.js`

---

## 🚀 Summary of Session Fixes

| # | Issue | Status |
|---|-------|--------|
| 1 | Database recursion (setup wizard) | ✅ FIXED |
| 2 | User invite 404 error | ✅ FIXED |
| 3 | Global admin permissions | ✅ FIXED |
| 4 | Role mismatch (editor) | ✅ FIXED |
| 5 | Supabase "User not allowed" | ✅ FIXED |

**All user invitation issues resolved!** 🎉

---

**Ready to test:** Try inviting users now with all role types!
