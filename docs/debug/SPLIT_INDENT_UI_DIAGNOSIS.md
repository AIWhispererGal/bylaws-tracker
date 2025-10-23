# Split/Indent UI Controls Missing for Owner - DIAGNOSIS

**Date:** 2025-10-22
**Status:** ✅ ROOT CAUSE IDENTIFIED
**Priority:** 🚨 URGENT - User Cannot Edit Document Sections

---

## 🔍 PROBLEM SUMMARY

Owner user cannot see split/indent/merge controls for manually adjusting document sections after upload.

**Expected Behavior:**
- Owner should see section editing buttons (Split, Indent, Dedent, Move, Join, Rename)
- These controls are essential for fixing section ordering/hierarchy after document import

**Actual Behavior:**
- Section editing buttons not appearing
- Owner cannot manually adjust section structure

---

## 🎯 ROOT CAUSE IDENTIFIED

### Location of UI Controls
**File:** `/views/dashboard/document-viewer.ejs`
**Lines:** 673-730

```ejs
<!-- Section Editing Buttons (Admin Only) -->
<% if (req.session.isGlobalAdmin || userRole === 'admin' || userRole === 'owner') { %>
<div class="section-edit-actions mt-3 pt-3 border-top">
  <!-- Split, Indent, Dedent, Move, Join buttons -->
</div>
<% } %>
```

### ❌ THE BUG: Permissions Mismatch

**The Problem:**
```ejs
<% if (req.session.isGlobalAdmin || userRole === 'admin' || userRole === 'owner') { %>
```

**This condition checks THREE things:**
1. ✅ `req.session.isGlobalAdmin` - Works (but user is not global admin)
2. ❓ `userRole === 'admin'` - **BROKEN** (wrong variable type)
3. ❓ `userRole === 'owner'` - **BROKEN** (wrong variable type)

---

## 🐛 WHY IT FAILS FOR OWNERS

### What `userRole` Actually Contains

**From `/src/routes/dashboard.js` (line 1089):**
```javascript
userRole: req.userRole || req.session.userRole || 'viewer'
```

**Where `req.userRole` comes from:**
The `attachPermissions` middleware sets `req.userRole` to an **OBJECT**, not a string!

**From `/src/middleware/permissions.js` (lines 139-165):**
```javascript
async function getUserRole(userId, organizationId) {
  const { data, error } = await supabase
    .from('user_organizations')
    .select('organization_roles!inner(role_code, role_name, hierarchy_level)')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  return data?.organization_roles || null;
  // ⚠️ RETURNS OBJECT: { role_code: 'owner', role_name: 'Owner', hierarchy_level: 4 }
}
```

### The Type Mismatch

**EJS Template Expects:**
```javascript
userRole === 'owner'  // String comparison
```

**But Actually Gets:**
```javascript
userRole = {
  role_code: 'owner',      // ← The actual role string is HERE
  role_name: 'Owner',
  hierarchy_level: 4
}
```

**Result:**
```javascript
{ role_code: 'owner' } === 'owner'  // ❌ FALSE - object !== string
```

---

## 📊 FALLBACK MECHANISMS ALSO FAILING

### Fallback 1: `req.session.userRole`
**Location:** `/src/routes/auth.js` or `/src/middleware/roleAuth.js`
**Status:** ⚠️ May not be set consistently

The session might have:
- `req.session.userId` ✅
- `req.session.userEmail` ✅
- `req.session.organizationId` ✅
- `req.session.userRole` ❓ (might not exist or might be stale)

### Fallback 2: Default to 'viewer'
If both `req.userRole` and `req.session.userRole` are falsy/wrong, it defaults to `'viewer'`, which also fails the check.

---

## 🔧 THE FIX

### Option 1: Fix the EJS Template (RECOMMENDED - Quick Fix)

**File:** `/views/dashboard/document-viewer.ejs` (line 673)

**Change from:**
```ejs
<% if (req.session.isGlobalAdmin || userRole === 'admin' || userRole === 'owner') { %>
```

**Change to:**
```ejs
<%
  const roleCode = userRole?.role_code || userRole || 'viewer';
  const isAdmin = req.session.isGlobalAdmin || roleCode === 'admin' || roleCode === 'owner';
%>
<% if (isAdmin) { %>
```

**OR (simpler):**
```ejs
<% if (req.session.isGlobalAdmin || userRole?.role_code === 'admin' || userRole?.role_code === 'owner') { %>
```

### Option 2: Fix the Backend to Send String (BETTER - Consistent)

**File:** `/src/routes/dashboard.js` (line 1089)

**Change from:**
```javascript
userRole: req.userRole || req.session.userRole || 'viewer'
```

**Change to:**
```javascript
userRole: req.userRole?.role_code || req.session.userRole || 'viewer',
userRoleData: req.userRole || null  // Keep full object available if needed
```

**AND update EJS to:**
```ejs
<% if (req.session.isGlobalAdmin || userRole === 'admin' || userRole === 'owner') { %>
```

---

## 📍 ADDITIONAL PERMISSION CHECKS TO FIX

### Other places in `document-viewer.ejs` using same pattern:

1. **Line 673** - Section edit actions (MAIN ISSUE)
2. **Line 1048-1062** - User permissions object construction
3. **Line 1089** - userRole passed to template

### Recommended: Global Fix Strategy

**Create a helper variable at top of EJS:**
```ejs
<%
  // Normalize userRole to string for permission checks
  const roleCode = userRole?.role_code || userRole || 'viewer';
  const roleLevel = userRole?.hierarchy_level || 0;
  const isOwner = roleCode === 'owner';
  const isAdmin = roleCode === 'admin' || isOwner;
  const isGlobalAdmin = req.session.isGlobalAdmin;
  const canEditSections = isGlobalAdmin || isAdmin;
%>
```

**Then use:**
```ejs
<% if (canEditSections) { %>
  <!-- Section editing buttons -->
<% } %>
```

---

## ✅ VERIFICATION CHECKLIST

After applying fix, verify:

- [ ] Owner user can see section editing buttons
- [ ] Admin user can see section editing buttons
- [ ] Member user CANNOT see section editing buttons
- [ ] Viewer user CANNOT see section editing buttons
- [ ] Global admin can see buttons across all orgs
- [ ] Split/Indent/Merge buttons are functional
- [ ] No JavaScript console errors

---

## 🎯 IMMEDIATE ACTION REQUIRED

**User needs this NOW to fix section ordering!**

**Quick Fix (5 minutes):**
1. Edit `/views/dashboard/document-viewer.ejs` line 673
2. Change to: `<% if (req.session.isGlobalAdmin || userRole?.role_code === 'admin' || userRole?.role_code === 'owner') { %>`
3. Restart server
4. Test with owner account

**Proper Fix (15 minutes):**
1. Add helper variables at top of document-viewer.ejs template
2. Update all permission checks to use helper variables
3. Add comment explaining the userRole object structure
4. Test all user roles (owner, admin, member, viewer)

---

## 📚 RELATED FILES

**Backend:**
- `/src/routes/dashboard.js` - Sets userRole variable (line 1089)
- `/src/middleware/permissions.js` - Returns role object (line 161)
- `/src/routes/admin.js` - Admin section editing endpoints (lines 1592-1927)

**Frontend:**
- `/views/dashboard/document-viewer.ejs` - UI controls (line 673)
- `/public/js/document-viewer-enhancements.js` - Enhancement behaviors

**API Endpoints:**
- `POST /admin/sections/:id/split` - Split section (line 1605)
- `POST /admin/sections/join` - Join sections (line 1771)
- `PUT /admin/sections/:id/move` - Move section (line 1399)
- `PUT /admin/sections/:id/retitle` - Rename section (line 1195)

---

## 🚨 SECURITY NOTE

The backend routes properly check permissions via middleware:
```javascript
router.post('/sections/:id/split', requireAdmin, validateSectionEditable, ...)
router.post('/sections/join', requireAdmin, validateAdjacentSiblings, ...)
```

So hiding the UI is for UX only - actual security is enforced server-side. ✅

---

## 🎓 LESSONS LEARNED

1. **Type Consistency:** When passing data to templates, ensure consistent types (string vs object)
2. **Migration Impact:** New permissions system changed `userRole` from string to object
3. **Fallback Chains:** Multiple fallbacks (`||` chains) can hide type mismatches
4. **Template Testing:** Need to test templates with different user role types
5. **Documentation:** Object structures should be documented at point of use

---

**Report Generated:** 2025-10-22
**Analyst:** Code Quality Analyzer (Claude)
**Next Steps:** Apply Quick Fix immediately, then proper fix for production
