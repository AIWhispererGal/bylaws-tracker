# Quick Fix: Workflow Buttons Not Appearing

**Issue:** Workflow action buttons don't appear for org_admin/org_owner users
**Root Cause:** Duplicate JavaScript function names causing wrong initialization
**Fix Time:** 2 minutes
**Risk:** LOW

---

## The Fix (Choose One)

### Option 1: Remove Old Function (RECOMMENDED)

**File:** `/views/dashboard/document-viewer.ejs`
**Action:** Delete lines 1878-1928

**Before:**
```javascript
// Update workflow progress bar
async function updateWorkflowProgress() {
  try {
    // TODO: Implement /api/workflow/documents/:id/progress endpoint
    // For now, calculate progress from section states
    const sectionIds = [
      <% sections.forEach((section, index) => { %>
        '<%= section.id %>'<%= index < sections.length - 1 ? ',' : '' %>
      <% }); %>
    ];
    // ... 50 lines of code that only update progress bar
  } catch (error) {
    console.error('Error updating workflow progress:', error);
  }
}
```

**After:** (delete entire function)

---

### Option 2: Remove Old Handler Call

**File:** `/views/dashboard/document-viewer.ejs`
**Action:** Comment out or delete lines 1721-1725

**Before:**
```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadAllSuggestionCounts();
  loadAllWorkflowStates();
  updateWorkflowProgress();
});
```

**After:**
```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadAllSuggestionCounts();
  loadAllWorkflowStates();
  // updateWorkflowProgress(); // ← REMOVED: Use refreshWorkflowProgress() instead
});
```

---

## Why This Fixes It

**Current Situation:**
- Two DOMContentLoaded handlers run on page load
- First handler calls `updateWorkflowProgress()` (old, incomplete)
- Second handler calls `refreshWorkflowProgress(documentId)` (new, complete)
- Old function only updates progress bar, **doesn't enable buttons**

**After Fix:**
- Only new handler runs
- Calls `refreshWorkflowProgress(documentId)`
- Updates progress bar AND enables buttons
- Buttons work correctly for admin/owner users

---

## Testing After Fix

### 1. Quick Visual Test
1. Login as org_admin or org_owner
2. Open any document
3. Look for "Workflow Actions" section at top
4. Verify two buttons appear (if you have permissions)

### 2. Browser Console Test
```javascript
// Check if buttons exist
console.log(document.getElementById('btn-approve-unmodified'));
console.log(document.getElementById('btn-progress-workflow'));

// Should see: <button> elements, not null
```

### 3. Functional Test
1. Create a document with sections
2. Leave some sections unmodified
3. "Approve All Unmodified" button should be **enabled** (not grayed out)
4. Click button - should approve unmodified sections

---

## Expected Behavior After Fix

| User Role | Buttons Appear? | Buttons Enabled? |
|-----------|----------------|------------------|
| global_admin | ✅ Yes | ✅ Yes (when ready) |
| org_owner | ✅ Yes | ✅ Yes (when ready) |
| org_admin | ✅ Yes | ✅ Yes (when ready) |
| member | ❌ No | N/A |
| viewer | ❌ No | N/A |

**Button States:**
- "Approve All Unmodified": Enabled when unmodified sections exist
- "Progress to Next Stage": Enabled when all sections approved

---

## Troubleshooting

### Problem: Buttons still don't appear
**Likely Cause:** User doesn't have admin/owner role
**Check:**
```javascript
// Add to line 382 of document-viewer.ejs temporarily:
<!-- DEBUG: canApprove=<%= userPermissions.canApprove %> userRole=<%= userRole %> -->
```

### Problem: Buttons appear but stay disabled
**Likely Cause:** API endpoint not returning data
**Check:**
1. Open browser Network tab
2. Look for request to `/api/workflow/documents/:id/progress-status`
3. Check response has `stats.unmodifiedSections` and `canProgress`

### Problem: JavaScript error in console
**Likely Cause:** Incomplete fix
**Check:**
- Ensure you removed ALL of lines 1878-1928 (Option 1)
- OR ensure you commented out line 1724 (Option 2)
- Clear browser cache and hard reload (Ctrl+Shift+R)

---

## Rollback Plan

If something breaks:

**Option 1 Rollback:**
```bash
git diff views/dashboard/document-viewer.ejs
git checkout views/dashboard/document-viewer.ejs
```

**Option 2 Rollback:**
Uncomment the line you commented out.

---

## Technical Notes

**This is NOT a permissions bug.**

All permission checks work correctly:
- ✅ Database schema correct
- ✅ Middleware attaches permissions
- ✅ Template checks permissions
- ✅ Server-side rendering works

The bug is purely client-side JavaScript calling the wrong function.

---

## File Locations

**Main file to edit:**
- `/views/dashboard/document-viewer.ejs`

**Files that are working correctly (no changes needed):**
- `/src/middleware/permissions.js`
- `/src/middleware/roleAuth.js`
- `/src/routes/dashboard.js`
- `/src/routes/workflow.js`

**API endpoint (working correctly):**
- `GET /api/workflow/documents/:documentId/progress-status`

---

## Summary

**What to do:**
1. Open `/views/dashboard/document-viewer.ejs`
2. Delete lines 1878-1928 OR comment out line 1724
3. Save file
4. Restart server
5. Test with admin/owner account
6. Done! ✅

**Time:** 2 minutes
**Difficulty:** Easy
**Risk:** Low (removing duplicate code)

For detailed analysis, see:
- `/docs/research/WORKFLOW_BUTTONS_ROOT_CAUSE.md`
- `/docs/research/RESEARCHER_FINDINGS_SUMMARY.md`
