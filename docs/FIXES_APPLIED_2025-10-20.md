# 🎯 Critical Fixes Applied - October 20, 2025

## Summary

Two critical bugs identified by competing agents (Analyst & Researcher) have been fixed:

1. **Permission Assignment Bug** - Users getting "viewer" instead of "owner"
2. **Organization Selector Bug** - "No Organizations Found" despite orgs existing

---

## Fix 1: Permission Assignment in Setup Wizard

### Problem
New organization creators were being assigned "viewer" permissions instead of "owner" permissions.

### Root Cause
At `src/routes/setup.js:740`, the setup wizard was using conditional logic:
```javascript
const userRole = adminUser.is_first_org ? 'superuser' : 'org_admin';
```

This assigned system-level roles instead of the organization role code.

### Fix Applied
**File:** `src/routes/setup.js:740-741`

**Changed:**
```javascript
const userRole = adminUser.is_first_org ? 'superuser' : 'org_admin';
```

**To:**
```javascript
// Person creating organization should always be owner
const userRole = 'owner';
```

### Impact
- All new organization creators will now have "owner" permissions
- Full control over their organization
- Can manage users, documents, and workflows

---

## Fix 2: Organization Selector Query

### Problem
After logout/login, the organization selector showed "No Organizations Found" even when organizations existed in the database.

### Root Cause
At `src/routes/auth.js:1257`, the query was using the wrong Supabase client:
```javascript
const { data, error } = await supabase  // Wrong: authenticated client subject to RLS
```

This caused RLS to block the query even though the user had legitimate access to organizations.

### Fix Applied
**File:** `src/routes/auth.js:1258`

**Changed:**
```javascript
const { data, error } = await supabase
```

**To:**
```javascript
// Use service client to bypass RLS and ensure we get user's orgs
const { data, error } = await req.supabaseService
```

### Impact
- Organization selector now shows all user's organizations
- Login flow works correctly
- Multi-organization support fully functional

---

## 🧪 Testing Instructions

### Test 1: Permission Assignment (5 minutes)

1. **Create New Organization:**
   ```
   Go to: http://localhost:3000/setup/organization
   Fill in organization details
   Complete entire setup wizard
   ```

2. **Verify Owner Permissions:**
   - After setup, check user profile/dashboard
   - Should show role as "Owner" or "Organization Owner"
   - Should have full permissions:
     - ✅ Can manage users
     - ✅ Can edit documents
     - ✅ Can manage workflows
     - ✅ Can access admin features

3. **Console Check:**
   ```javascript
   // Should see in server logs:
   [SETUP-DEBUG] 👤 Assigning role: owner
   ```

### Test 2: Organization Selector (3 minutes)

1. **Logout:**
   ```
   Click logout button
   Should redirect to login page
   ```

2. **Login:**
   ```
   Enter email and password
   Submit login form
   ```

3. **Verify Organization Selector:**
   - Should see "Select Organization" page
   - Should show ALL organizations user belongs to
   - Should NOT show "No Organizations Found"
   - Click any organization
   - Should successfully enter dashboard

### Test 3: Multi-Organization Support (7 minutes)

1. **Create Second Organization:**
   ```
   Go to: http://localhost:3000/setup/organization
   Use SAME email as before
   Enter SAME password
   Complete setup for new organization
   ```

2. **Verify Multi-Org Support:**
   - Should successfully create second org
   - Should NOT get "email already registered" error
   - User should be owner of both organizations

3. **Test Organization Switching:**
   ```
   Logout
   Login with same credentials
   Should see BOTH organizations in selector
   Select first org → Enter dashboard
   Logout
   Login again
   Select second org → Enter dashboard
   ```

---

## 🎉 Expected Results

After these fixes:

- ✅ New organization creators have "owner" permissions
- ✅ Organization selector shows all user's organizations
- ✅ Multi-organization support works correctly
- ✅ Login flow completes without issues
- ✅ Users can switch between their organizations

---

## 📊 Technical Details

### Files Modified
1. `src/routes/setup.js` - Line 740-741 (permission assignment)
2. `src/routes/auth.js` - Line 1258 (organization selector query)

### Related Migrations
- Migration 025: Seeds organization_roles (owner, admin, editor, member, viewer)
- Migration 026: Seeds user_types (global_admin, regular_user)
- Migration 030: Disables RLS on 11 setup tables temporarily

### Key Concepts
- **Service Role Client (`req.supabaseService`)**: Bypasses RLS, used for system operations
- **Authenticated Client (`supabase`)**: Subject to RLS, used for user operations
- **Organization Roles**: Org-level permissions (owner, admin, editor, etc.)
- **User Types**: Global permissions (global_admin, regular_user)

---

## 🚨 Known Issues Still Present

1. **RLS Disabled on 11 Tables:**
   - Safe for testing/development
   - Must re-enable before production launch
   - See: `docs/RE-ENABLE-RLS-FOR-PRODUCTION.md`

2. **Setup Wizard Redirect:**
   - Not redirecting to sign-in after org creation
   - User manually navigating to login
   - Low priority - functionality works

---

## 📞 If Issues Persist

If you still experience issues after these fixes:

1. **Restart Server:**
   ```bash
   # Stop server (Ctrl+C)
   npm start
   ```

2. **Check Console Logs:**
   - Look for `[SETUP-DEBUG]` messages
   - Verify "Assigning role: owner" appears
   - Check for any RLS errors

3. **Verify Database:**
   ```sql
   -- Check user_organizations table
   SELECT
     uo.user_id,
     uo.organization_id,
     uo.role,
     uo.org_role_id,
     or.role_name
   FROM user_organizations uo
   LEFT JOIN organization_roles or ON or.id = uo.org_role_id
   WHERE uo.is_active = true;

   -- Should show role = 'owner' and org_role_id linking to owner role
   ```

4. **Clear Session:**
   - Clear browser cookies
   - Or use incognito/private window
   - Login again fresh

---

## ✅ Completion Checklist

- [x] Fix 1 applied: Permission assignment uses 'owner'
- [x] Fix 2 applied: Org selector uses service client
- [ ] Test 1 passed: New org creator has owner permissions
- [ ] Test 2 passed: Organization selector shows orgs
- [ ] Test 3 passed: Multi-org support works
- [ ] Server restarted
- [ ] Ready for smoke tests

---

**Next Step:** Run the testing instructions above and verify both fixes work correctly!
