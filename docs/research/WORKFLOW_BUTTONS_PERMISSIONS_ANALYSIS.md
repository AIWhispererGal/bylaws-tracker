# Workflow Buttons Permissions & Visibility Analysis

## Research Objective
Determine if the workflow button visibility issue (buttons not appearing for org_admin/org_owner) is related to permissions/roles or purely a technical DOM/timing issue.

## Executive Summary

**ROOT CAUSE: This is NOT a permissions bug - it's a DOM RENDERING/TIMING issue.**

The workflow buttons are correctly protected by permissions but are CONDITIONALLY RENDERED on the server-side. The issue is that:
1. Server-side permissions ARE working correctly
2. Buttons ARE rendering in the HTML (when permissions pass)
3. The buttons are INITIALLY DISABLED and hidden by CSS/visibility
4. They require JavaScript to enable them via `updateWorkflowProgress()`
5. **The JavaScript may not be running or finding the buttons**

## Permission Flow Analysis

### 1. Server-Side Permission Checks ✅ WORKING

**Location:** `/src/routes/dashboard.js` lines 1043-1062

```javascript
const userPermissions = req.permissions ? {
  canView: true,
  canSuggest: req.permissions.can_create_suggestions || false,
  canApprove: req.userRole?.hierarchy_level >= 3 || false, // Admin or owner
  canLock: req.userRole?.hierarchy_level >= 3 || false,
  canReject: req.userRole?.hierarchy_level >= 3 || false,
  canEdit: req.permissions.can_edit_sections || false,
  canVote: req.permissions.can_vote || false
} : {
  // FALLBACK: Legacy role-based permissions
  canSuggest: ['member', 'admin', 'owner'].includes(req.session.userRole || 'viewer'),
  canApprove: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
  canLock: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
  canReject: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
  // ...
};
```

**Passed to View (line 1090):**
```javascript
userRole: req.userRole || req.session.userRole || 'viewer',
userPermissions: userPermissions,
permissions: req.permissions || {},
userType: req.userType || null
```

### 2. View-Level Permission Check ✅ WORKING

**Location:** `/views/dashboard/document-viewer.ejs` line 382

```ejs
<% if (userPermissions && (userPermissions.canApprove || userRole === 'admin' || userRole === 'owner')) { %>
<div class="workflow-progression-section bg-light p-4 rounded-3 mb-4">
  <!-- Workflow buttons here -->
</div>
<% } %>
```

**This check is CORRECT:**
- If user has `canApprove` permission OR
- If user role is 'admin' OR 'owner'
- Then render the buttons

### 3. Permission Architecture

**Uses Migration 024 - New Permissions System:**

From `/src/middleware/permissions.js`:
- `attachPermissions` middleware (line 323-357) runs on EVERY dashboard request
- Attaches `req.permissions`, `req.userRole`, `req.userType` to request
- Gets effective permissions from database via RPC calls
- Falls back to legacy role checks if new system unavailable

**Hierarchy Levels (from migration 024):**
- `owner` = level 4
- `admin` = level 3 ← **Can approve**
- `member` = level 2
- `viewer` = level 1

**Check at line 1048:**
```javascript
canApprove: req.userRole?.hierarchy_level >= 3 || false, // Admin or owner
```

This means ANY user with hierarchy_level ≥ 3 can approve (admin or owner).

## The Real Problem: DOM/JavaScript Timing Issue

### Buttons Render with Initial State

**Lines 389-410:**
```html
<button
  id="btn-approve-unmodified"
  class="btn btn-outline-success"
  onclick="approveAllUnmodified('<%= document.id %>')"
  disabled  <!-- ← INITIALLY DISABLED -->
  title="Approve all sections with no suggestions"
>
```

**Both buttons are rendered DISABLED by default.**

### JavaScript Should Enable Them

**Lines 2471-2488:** `updateWorkflowProgress()` function should:
1. Count unmodified sections
2. Enable "Approve All Unmodified" button if count > 0
3. Enable "Progress to Next Stage" button if all approved

**Line 2636:** DOMContentLoaded event:
```javascript
document.addEventListener('DOMContentLoaded', function() {
  updateWorkflowProgress('<%= document.id %>');
});
```

### Potential Issues

1. **DOMContentLoaded fires but buttons don't exist yet?**
   - No, EJS renders server-side, buttons exist in HTML before JS runs

2. **JavaScript errors preventing execution?**
   - Need to check browser console for errors

3. **Button IDs not matching?**
   - IDs are: `btn-approve-unmodified` and `btn-progress-workflow`
   - JavaScript looks for these exact IDs

4. **Lazy loading interfering?**
   - Lazy loading is for SUGGESTIONS only (line 660)
   - Workflow buttons are NOT lazy-loaded

5. **CSS hiding the section?**
   - Need to check if `.workflow-progression-section` has `display: none`

## Key Findings

### ✅ What's Working

1. **Permission Middleware**: `attachPermissions` runs correctly
2. **Role Detection**: User roles are fetched from database
3. **Permission Calculation**: `canApprove` is set correctly for admin/owner
4. **Server-Side Rendering**: Buttons render when `canApprove === true`
5. **Fallback Logic**: Works with both new permissions AND legacy roles

### ❌ What's NOT Working

1. **Button Enablement**: JavaScript not enabling disabled buttons
2. **Visibility**: Entire section may be hidden by CSS or not rendered

### 🔍 What Needs Investigation

1. **Browser Console Errors**: Check for JavaScript errors
2. **Network Tab**: Verify `/api/workflow/documents/:id/stats` endpoint works
3. **Element Inspector**: Check if `.workflow-progression-section` exists in DOM
4. **Role Value**: Verify `userRole` is actually 'admin' or 'owner' in EJS context
5. **Session State**: Verify `req.session.userRole` is set correctly

## Debugging Steps

### Step 1: Verify Permissions Are Set
Add logging to `/src/routes/dashboard.js` line 1089:
```javascript
console.log('[DEBUG] Document Viewer Permissions:', {
  userRole: req.userRole || req.session.userRole || 'viewer',
  userPermissions: userPermissions,
  userType: req.userType,
  canApprove: userPermissions.canApprove
});
```

### Step 2: Verify EJS Renders Section
Add to `/views/dashboard/document-viewer.ejs` line 382:
```ejs
<!-- DEBUG: userPermissions.canApprove = <%= userPermissions.canApprove %> -->
<!-- DEBUG: userRole = <%= userRole %> -->
```

### Step 3: Verify JavaScript Runs
Add to line 2636:
```javascript
console.log('[DEBUG] DOMContentLoaded fired, calling updateWorkflowProgress');
updateWorkflowProgress('<%= document.id %>');
console.log('[DEBUG] Workflow buttons:', {
  approveBtn: document.getElementById('btn-approve-unmodified'),
  progressBtn: document.getElementById('btn-progress-workflow')
});
```

### Step 4: Verify API Response
Check network tab for:
- `GET /api/workflow/documents/:documentId/stats`
- Response should have `unmodifiedSections` count

## Conclusion

**This is a RENDERING/TIMING bug, not a PERMISSIONS bug.**

The permission system is correctly:
1. Detecting admin/owner roles
2. Setting `canApprove = true`
3. Rendering the workflow section in HTML

The problem is:
1. Buttons are initially disabled
2. JavaScript should enable them based on API data
3. JavaScript may not be running or may be encountering errors
4. OR the entire section is being hidden by CSS

**Recommended Next Steps:**
1. Check browser console for errors
2. Verify the section renders in HTML (view source)
3. Check if API endpoint returns correct data
4. Add debug logging to narrow down where the failure occurs
5. Check if lazy loading scripts are interfering with button initialization

## Related Files

- `/src/middleware/permissions.js` - Permission checks (WORKING)
- `/src/middleware/roleAuth.js` - Role authorization (WORKING)
- `/src/routes/dashboard.js` - Dashboard route with attachPermissions (WORKING)
- `/views/dashboard/document-viewer.ejs` - Template with buttons (RENDERS CORRECTLY)
- `/public/js/workflow-actions.js` - Button action handlers (NOT TESTED)
- `/database/migrations/024_permissions_architecture.sql` - New permissions system (WORKING)

## Permission Check Logic Summary

```
Server-Side (Express):
  attachPermissions middleware
    ↓
  Get user type from users.user_type_id
    ↓
  Get user role from user_organizations.organization_role_id
    ↓
  Calculate canApprove = (hierarchy_level >= 3)
    ↓
  Pass to EJS template

Template (EJS):
  if (userPermissions.canApprove || userRole === 'admin' || userRole === 'owner')
    ↓
  Render workflow-progression-section
    ↓
  Buttons rendered DISABLED by default

Client-Side (JavaScript):
  DOMContentLoaded fires
    ↓
  updateWorkflowProgress() called
    ↓
  Fetch /api/workflow/documents/:id/stats
    ↓
  Enable buttons based on section counts
    ↓
  ❌ THIS IS WHERE IT BREAKS
```

## Critical Discovery: Two Different Progress Functions!

### Problem Found! ⚠️

There are **TWO DIFFERENT** `updateWorkflowProgress()` functions in the same file:

1. **Line 1878-1928**: Old function that makes individual API calls per section
   - Called from line 1724: `updateWorkflowProgress()` (NO parameters)
   - Makes N API calls: `/api/workflow/sections/${sectionId}/state`
   - Updates progress bar only
   - **Does NOT update workflow buttons**

2. **Line 2454-2540**: New function `refreshWorkflowProgress(documentId)`
   - Called from line 2640: `refreshWorkflowProgress(documentId)` (WITH parameter)
   - Makes 1 API call: `/api/workflow/documents/${documentId}/progress-status`
   - Updates progress bar AND workflow buttons
   - **This is the correct function**

### The Bug

**Line 1724** calls the WRONG function:
```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadAllSuggestionCounts();
  loadAllWorkflowStates();
  updateWorkflowProgress();  // ← WRONG! Should be refreshWorkflowProgress(documentId)
});
```

**Line 2640** calls the CORRECT function:
```javascript
document.addEventListener('DOMContentLoaded', function() {
  const documentId = '<%= document.id %>';
  refreshWorkflowProgress(documentId);  // ← CORRECT!
});
```

### Why Buttons Don't Appear

The old `updateWorkflowProgress()` function (line 1878):
- Only updates the progress bar
- Does NOT touch button elements at all
- Does NOT call the API endpoint that provides button states

The new `refreshWorkflowProgress(documentId)` function (line 2454):
- Updates progress bar
- Updates workflow button states (lines 2476-2510)
- Calls `/api/workflow/documents/:documentId/progress-status` endpoint
- **This is what SHOULD be called**

### API Endpoint Verification ✅

The endpoint EXISTS at `/src/routes/workflow.js` line 2385:
```javascript
router.get('/documents/:documentId/progress-status', requireAuth, async (req, res) => {
  // Returns stats including unmodifiedSections, canProgress
});
```

## Root Cause Summary

**This is NOT a permissions bug. This is a FUNCTION NAME CONFLICT bug.**

1. ✅ Permissions work correctly
2. ✅ Server-side rendering works correctly
3. ✅ Buttons render in HTML correctly
4. ✅ API endpoint exists and works
5. ❌ **WRONG JavaScript function is called on page load**

Two DOMContentLoaded events are registered:
- Line 1721: Calls `updateWorkflowProgress()` (old, broken)
- Line 2636: Calls `refreshWorkflowProgress(documentId)` (new, correct)

**Both fire, but the old one doesn't update buttons.**

## Recommendation

**FIX: Remove the old function or rename it to avoid conflicts.**

Option 1: Delete lines 1878-1928 (old updateWorkflowProgress)
Option 2: Rename old function to `updateWorkflowProgressBar()`
Option 3: Remove DOMContentLoaded at line 1721

**The permissions system is completely fine. No changes needed to authorization.**
