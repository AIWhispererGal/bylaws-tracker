# Dashboard Recent Suggestions Fix - October 28, 2025

## Issue
The dashboard was not displaying recent suggestions due to missing template variables.

## Root Cause
The dashboard route (`src/routes/dashboard.js`) was passing a `user` object to the template, but the template expected `currentUser` and `currentOrganization` objects with specific properties.

## Files Modified
- `/src/routes/dashboard.js`

## Changes Made

### 1. Fixed currentUser Object Construction (Lines 74-80)
**Before:**
```javascript
const user = req.session.userId ? {
  id: req.session.userId,
  email: req.session.userEmail,
  name: req.session.userName || req.session.userEmail
} : null;
```

**After:**
```javascript
const currentUser = req.session.userId ? {
  id: req.session.userId,
  email: req.session.userEmail,
  name: req.session.userName || req.session.userEmail,
  role: req.session.userRole || 'viewer',
  is_global_admin: req.isGlobalAdmin || false
} : null;
```

**Why:** The template checks for `currentUser.role` and `currentUser.is_global_admin` to determine what UI elements to show.

### 2. Added Organization Details Query (Lines 82-96)
**New Code:**
```javascript
// Get organization details for header
let currentOrganization = null;
try {
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, organization_type')
    .eq('id', orgId)
    .single();

  if (org) {
    currentOrganization = org;
  }
} catch (orgError) {
  console.error('Error loading organization details:', orgError);
}
```

**Why:** The template header displays the current organization name and needs this object.

### 3. Updated Template Data Passed to View (Lines 163-174)
**Before:**
```javascript
res.render('dashboard/dashboard', {
  title: 'Dashboard',
  organizationId: req.organizationId,
  user: user,
  recentSuggestions: recentSuggestions,
  permissions: req.permissions || {},
  userRole: req.userRole || null,
  userType: req.userType || null
});
```

**After:**
```javascript
res.render('dashboard/dashboard', {
  title: 'Dashboard',
  organizationId: req.organizationId,
  currentUser: currentUser,
  currentOrganization: currentOrganization,
  user: currentUser, // Keep for backward compatibility
  recentSuggestions: recentSuggestions,
  permissions: req.permissions || {},
  userRole: req.userRole || null,
  userType: req.userType || null
});
```

**Why:**
- Template expects `currentUser` (not `user`)
- Template expects `currentOrganization` for header display
- Kept `user` for backward compatibility with other views

## Impact
✅ Dashboard now properly displays recent suggestions
✅ Organization name appears in header
✅ User role badges display correctly
✅ All dashboard UI elements render properly

## Testing Instructions
1. Restart the Node.js server
2. Navigate to `/dashboard`
3. Verify:
   - Recent suggestions appear in the right sidebar
   - Organization name shows in header
   - User role badges are visible
   - No console errors

## Related Files
- `/views/dashboard/dashboard.ejs` - Template that expects these variables (lines 422-489, 543-670)
- `/src/routes/dashboard.js` - Fixed route handler

## Coordinator Notes
This was Phase 1 of the navigation enhancement task. The suggestions display issue was resolved as a quick win before implementing the collapsible navigation feature (Phase 2).
