# 🚨 URGENT: Fix Owner Cannot See Section Edit Buttons

## THE PROBLEM
Owner user cannot see Split/Indent/Merge buttons needed to fix document sections.

## THE CAUSE
**File:** `/views/dashboard/document-viewer.ejs` line 673

**Broken Code:**
```ejs
<% if (req.session.isGlobalAdmin || userRole === 'admin' || userRole === 'owner') { %>
```

**Why it fails:**
- `userRole` is an OBJECT: `{ role_code: 'owner', hierarchy_level: 4 }`
- Template compares object to string: `{ role_code: 'owner' } === 'owner'` ❌ FALSE

## ⚡ QUICK FIX (2 MINUTES)

### Step 1: Edit the Template
**File:** `/views/dashboard/document-viewer.ejs`

**Find line 673:**
```ejs
<% if (req.session.isGlobalAdmin || userRole === 'admin' || userRole === 'owner') { %>
```

**Replace with:**
```ejs
<% if (req.session.isGlobalAdmin || userRole?.role_code === 'admin' || userRole?.role_code === 'owner') { %>
```

### Step 2: Restart Server
```bash
npm restart
# OR
node src/server.js
```

### Step 3: Test
1. Log in as organization owner
2. Open a document
3. Expand any section
4. ✅ You should now see: Split, Indent, Dedent, Move, Join, Rename buttons

## 🎯 VERIFY IT WORKS

**Expected UI:**
```
[Section Content]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Edit Section:  [Rename] [↑] [↓] [→ Indent] [← Dedent] [Split] [Join]
```

**Buttons should:**
- ✅ Appear for Owner role
- ✅ Appear for Admin role
- ✅ Appear for Global Admin
- ❌ NOT appear for Member role
- ❌ NOT appear for Viewer role

## 📞 IF IT STILL DOESN'T WORK

**Check session data:**
```javascript
// Add to document-viewer.ejs temporarily (top of file)
<% console.log('DEBUG userRole:', JSON.stringify(userRole)); %>
<% console.log('DEBUG session.isGlobalAdmin:', req.session.isGlobalAdmin); %>
<% console.log('DEBUG session.userRole:', req.session.userRole); %>
```

**Expected output in server logs:**
```
DEBUG userRole: {"role_code":"owner","role_name":"Owner","hierarchy_level":4}
DEBUG session.isGlobalAdmin: false
DEBUG session.userRole: undefined or owner
```

**If userRole is null/undefined:**
- Check `/src/middleware/permissions.js` is loaded
- Verify `attachPermissions` middleware is called in route
- Check database: `SELECT * FROM user_organizations WHERE user_id = 'YOUR_USER_ID';`

## 🔧 PROPER FIX (Later - 15 minutes)

For production, add helper at top of template:

```ejs
<%
  // Normalize userRole to handle both object and string formats
  const roleCode = userRole?.role_code || userRole || 'viewer';
  const roleLevel = userRole?.hierarchy_level || 0;
  const isOwner = roleCode === 'owner';
  const isAdmin = roleCode === 'admin' || isOwner;
  const isGlobalAdmin = req.session.isGlobalAdmin;
  const canEditSections = isGlobalAdmin || isAdmin;
%>

<!-- Then use throughout template -->
<% if (canEditSections) { %>
  <!-- Section editing buttons -->
<% } %>
```

This makes permissions clearer and handles both old and new permission systems.

---

**Full diagnosis:** See `SPLIT_INDENT_UI_DIAGNOSIS.md` in this folder
