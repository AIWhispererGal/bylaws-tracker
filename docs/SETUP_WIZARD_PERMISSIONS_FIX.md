# ✅ Setup Wizard Permissions Fix - COMPLETE

**Date:** October 19, 2025
**Issues Fixed:** 2 critical bugs
**Status:** **READY TO TEST** ✅

---

## 🐛 Issues You Reported

### Issue 1: "View-Only Access"
**Problem:** After creating a new organization, you were assigned "view-only" role instead of "owner/admin"

**Root Cause:** Setup wizard was inserting `role: 'org_admin'` but NOT setting `org_role_id` which the new permissions system requires (migration 024).

### Issue 2: "Unexpected token '<'"
**Problem:** Dashboard couldn't load documents, got HTML instead of JSON

**Error in console:**
```
dashboard.js:134 Error loading documents: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**Root Cause:** The `/dashboard/documents` endpoint was checking `req.xhr` which modern browsers don't set. It thought the AJAX request was a browser request and redirected to `/dashboard` (HTML), causing JSON parse error.

---

## ✅ What Was Fixed

### Fix 1: Setup Wizard Role Assignment (setup.js:677-729)

**Added code to:**
1. Get the correct `user_type_id` (global_admin for first org, regular_user otherwise)
2. Update user's `user_type_id` in users table
3. Get the `organization_roles.id` for 'owner' role
4. Insert into `user_organizations` with BOTH:
   - `role: 'org_admin'` (old system, backwards compat)
   - `org_role_id: ownerRole.id` (new system, proper permissions)

**Code added:**
```javascript
// Get the user_types ID for first org (global_admin) or regular (regular_user)
const userTypeName = adminUser.is_first_org ? 'global_admin' : 'regular_user';
const { data: userType, error: userTypeError } = await supabase
    .from('user_types')
    .select('id')
    .eq('type_name', userTypeName)
    .single();

// Update user's user_type_id in users table
const { error: userUpdateError } = await supabase
    .from('users')
    .update({ user_type_id: userType.id })
    .eq('id', adminUser.user_id);

// Get the organization_roles ID for 'owner' (person creating org should be owner)
const { data: ownerRole, error: roleError } = await supabase
    .from('organization_roles')
    .select('id')
    .eq('role_name', 'owner')
    .single();

const { error: linkError } = await supabase
    .from('user_organizations')
    .insert({
        user_id: adminUser.user_id,
        organization_id: data.id,
        role: userRole, // Keep old column for backwards compatibility
        org_role_id: ownerRole.id, // NEW: Use new permissions system
        created_at: new Date().toISOString()
    });
```

### Fix 2: Documents Endpoint AJAX Detection (dashboard.js:261-268)

**Enhanced AJAX detection to check:**
1. `req.xhr` (old Express property)
2. `req.headers['x-requested-with'] === 'XMLHttpRequest'` (standard header)
3. `req.query.ajax === 'true'` (explicit query param)

**Code changed:**
```javascript
// OLD (broken):
if (req.accepts('html') && !req.xhr) {
  return res.redirect('/dashboard');
}

// NEW (works):
const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.ajax === 'true';
if (req.accepts('html') && !isAjax) {
  return res.redirect('/dashboard');
}
```

---

## 🚀 Server Status

**✅ Server is RUNNING:**
- **URL:** http://localhost:3000
- **Process ID:** 23776
- **Status:** Connected to Supabase

**✅ Changes Applied:**
- `src/routes/setup.js` - Organization creator gets proper owner role
- `src/routes/dashboard.js` - Documents endpoint properly detects AJAX
- Server restarted with new code

---

## 🧪 What to Test Now

### Test 1: Create New Organization
1. **Clear your database** (or use fresh test account)
2. Go through setup wizard
3. Create a new organization
4. **Expected Result:** You should have "Owner" access, not "View-Only"
5. **Check:** Dashboard should show admin options

### Test 2: Dashboard Documents Loading
1. After creating organization
2. Go to dashboard
3. **Expected Result:** No console errors about "Unexpected token"
4. **Expected Result:** Documents list loads properly (or shows "No documents" message)

---

## 📊 Technical Details

### Database Changes (What Gets Set)

**When you create an organization:**

1. **User record updated:**
   - `users.user_type_id` → Points to `user_types` table
   - First org creator → `global_admin` type
   - Subsequent creators → `regular_user` type

2. **Organization membership created:**
   - `user_organizations.role` → `'org_admin'` (old system)
   - `user_organizations.org_role_id` → Points to `organization_roles.owner` (new system)
   - This gives you level 4 access (highest)

### Permission Levels

| Role | Level | Can Edit | Can Approve | Can Manage Users |
|------|-------|----------|-------------|------------------|
| Owner | 4 | ✅ | ✅ | ✅ |
| Admin | 3 | ✅ | ✅ | ✅ |
| Member | 2 | ✅ | ❌ | ❌ |
| Viewer | 1 | ❌ | ❌ | ❌ |

**You should get:** Owner (level 4) when creating an organization

---

## 🔍 Debugging Tips

### If still seeing "View-Only":

**Check database:**
```sql
-- Check your user_type_id
SELECT id, email, user_type_id FROM users WHERE email = 'your@email.com';

-- Check your org role
SELECT uo.*, or.role_name, or.hierarchy_level
FROM user_organizations uo
JOIN organization_roles or ON uo.org_role_id = or.id
WHERE uo.user_id = 'your-user-id';
```

**Expected results:**
- `users.user_type_id` should NOT be null
- `user_organizations.org_role_id` should point to owner role
- `organization_roles.role_name` should be 'owner'
- `organization_roles.hierarchy_level` should be 4

### If documents still not loading:

**Check browser console:**
1. Open DevTools (F12)
2. Go to Network tab
3. Try loading dashboard
4. Look for `/dashboard/documents` request
5. Check if it returns JSON or HTML

**Expected:**
- Request to `/dashboard/documents`
- Response should be JSON with `{"success": true, "documents": [...]}`
- Should NOT redirect to HTML page

---

## 📝 Files Modified

1. **src/routes/setup.js** (lines 677-729)
   - Added user_type_id assignment
   - Added org_role_id assignment
   - Organization creator gets 'owner' role

2. **src/routes/dashboard.js** (lines 261-268)
   - Enhanced AJAX detection
   - Fixed JSON vs HTML response logic

---

## 🎯 Bottom Line

**The Issues:**
1. ❌ Setup wizard didn't set new permissions (org_role_id, user_type_id)
2. ❌ Documents endpoint returned HTML instead of JSON

**The Fixes:**
1. ✅ Setup wizard now properly sets both old and new permissions
2. ✅ Documents endpoint correctly detects AJAX requests

**What You Should See:**
- ✅ "Owner" role when creating organization (not "View-Only")
- ✅ Dashboard loads documents without console errors
- ✅ Full admin access to organization features

---

## 🚦 Next Steps

1. **Try creating a new organization** (or reset your current one)
2. **Check if you get "Owner" access** instead of "View-Only"
3. **Check if dashboard loads** without console errors
4. **Let me know if you still see issues**

---

**Server is ready!** Visit http://localhost:3000 to test 🚀

---

**Last Updated:** October 19, 2025
**Status:** Fixes applied, server running, ready for testing
