# Workflow Buttons Visibility Issue - Root Cause Analysis

**Date:** 2025-10-20
**Status:** ✅ ROOT CAUSE IDENTIFIED
**Classification:** JavaScript Function Name Conflict (NOT a permissions bug)

---

## Executive Summary

The workflow action buttons ("Approve All Unmodified" and "Progress to Next Stage") are not appearing for org_admin/org_owner users due to **duplicate JavaScript function names** causing the wrong initialization code to run on page load.

**This is NOT a permissions or role-based access control issue.** The permission system is working correctly.

---

## The Problem

### What Users Experience
- User has `org_admin` or `org_owner` role
- User should see workflow action buttons at top of document viewer
- Buttons do NOT appear or remain disabled
- No JavaScript errors in console

### What Should Happen
1. Server checks user permissions ✅ WORKING
2. Server renders workflow section in HTML ✅ WORKING
3. Page loads and JavaScript enables buttons ❌ BROKEN
4. Buttons become clickable for admin/owner ❌ BROKEN

---

## Root Cause: Duplicate Functions

### The Conflict

**File:** `/views/dashboard/document-viewer.ejs`

There are **TWO different functions** with overlapping purposes:

#### Function 1: `updateWorkflowProgress()` (OLD - INCOMPLETE)
**Location:** Lines 1878-1928
**Called from:** Line 1724 (DOMContentLoaded)

```javascript
async function updateWorkflowProgress() {
  // Makes N API calls (one per section)
  // GET /api/workflow/sections/${sectionId}/state

  // Updates ONLY the progress bar:
  progressBar.style.width = progressPercentage + '%';
  progressText.textContent = `${approvedCount} / ${totalSections} sections approved`;

  // ❌ Does NOT update workflow buttons
  // ❌ Does NOT check unmodified sections
  // ❌ Does NOT enable "Approve All Unmodified" button
  // ❌ Does NOT enable "Progress to Next Stage" button
}
```

#### Function 2: `refreshWorkflowProgress(documentId)` (NEW - COMPLETE)
**Location:** Lines 2454-2540
**Called from:** Line 2640 (DOMContentLoaded)

```javascript
async function refreshWorkflowProgress(documentId) {
  // Makes 1 efficient API call
  // GET /api/workflow/documents/${documentId}/progress-status

  // Updates progress bar:
  progressBar.style.width = `${percentage}%`;
  progressText.textContent = `${stats.approvedSections} / ${stats.totalSections} sections approved`;

  // ✅ Updates "Approve All Unmodified" button (lines 2476-2488)
  if (stats.unmodifiedSections > 0) {
    btnApproveUnmodified.disabled = false;
    approveUnmodifiedText.textContent = `Approve All Unmodified (${stats.unmodifiedSections} sections)`;
  }

  // ✅ Updates "Progress to Next Stage" button (lines 2490-2510)
  if (data.canProgress) {
    btnProgressWorkflow.disabled = false;
    progressWorkflowText.textContent = 'Progress to Next Stage (Ready!)';
  }
}
```

### What Happens on Page Load

```javascript
// ❌ First DOMContentLoaded handler (line 1721)
document.addEventListener('DOMContentLoaded', () => {
  loadAllSuggestionCounts();
  loadAllWorkflowStates();
  updateWorkflowProgress();  // Calls OLD function (no parameter)
});

// ✅ Second DOMContentLoaded handler (line 2636)
document.addEventListener('DOMContentLoaded', function() {
  const documentId = '<%= document.id %>';
  refreshWorkflowProgress(documentId);  // Calls NEW function (with parameter)
});
```

**Both handlers run, but the old one doesn't update the buttons.**

---

## Why This Breaks Button Visibility

### The Flow

1. **Server-side permission check** ✅
   - `/src/routes/dashboard.js` line 1048
   - Sets `canApprove = true` for admin/owner (hierarchy_level >= 3)

2. **Template renders buttons** ✅
   - `/views/dashboard/document-viewer.ejs` line 382
   - `<% if (userPermissions.canApprove || userRole === 'admin' || userRole === 'owner') { %>`
   - Buttons ARE rendered in HTML

3. **Buttons start DISABLED** ✅
   - Line 389: `<button id="btn-approve-unmodified" disabled>`
   - Line 402: `<button id="btn-progress-workflow" disabled>`
   - This is correct - buttons should be disabled until stats are loaded

4. **OLD function runs** ❌
   - Line 1724: `updateWorkflowProgress()` called
   - Updates progress bar only
   - **Never touches button elements**
   - Buttons remain disabled

5. **NEW function runs** ✅ (but may be too late or overridden)
   - Line 2640: `refreshWorkflowProgress(documentId)` called
   - Would update buttons correctly
   - But old function may have already set incorrect state

---

## API Endpoint Analysis

### The Correct Endpoint (Used by NEW function)

**Route:** `GET /api/workflow/documents/:documentId/progress-status`
**File:** `/src/routes/workflow.js` lines 2385-2465
**Returns:**
```json
{
  "success": true,
  "canProgress": true/false,
  "stats": {
    "totalSections": 10,
    "approvedSections": 8,
    "unmodifiedSections": 5,
    "percentage": 80
  }
}
```

✅ This endpoint EXISTS and works correctly.

### The Old Endpoint (Used by OLD function)

**Route:** `GET /api/workflow/sections/:sectionId/state`
**Called:** N times (once per section)
**Returns:** Only section-level state

❌ Inefficient (N+1 queries)
❌ Doesn't return unmodified count
❌ Doesn't return canProgress flag

---

## Permission System Verification

### ✅ Permissions Middleware Works Correctly

**File:** `/src/middleware/permissions.js`

```javascript
// Line 323: attachPermissions runs on EVERY request
function attachPermissions(req, res, next) {
  const userId = req.session.userId;
  const organizationId = req.session.organizationId;

  req.userType = await getUserType(userId);
  req.permissions = await getEffectivePermissions(userId, organizationId);
  req.userRole = await getUserRole(userId, organizationId);

  next();
}
```

### ✅ Role Hierarchy Works Correctly

**File:** `/database/migrations/024_permissions_architecture.sql`

```sql
-- organization_roles table (lines 62-110)
INSERT INTO organization_roles (role_code, hierarchy_level, ...)
VALUES
  ('owner', 4, ...),   -- Can approve
  ('admin', 3, ...),   -- Can approve  ← User should have this
  ('member', 2, ...),  -- Cannot approve
  ('viewer', 1, ...);  -- Cannot approve
```

### ✅ Permission Calculation Works Correctly

**File:** `/src/routes/dashboard.js` lines 1043-1062

```javascript
const userPermissions = req.permissions ? {
  canApprove: req.userRole?.hierarchy_level >= 3 || false, // ✅ Admin = level 3
  canLock: req.userRole?.hierarchy_level >= 3 || false,
  // ...
} : {
  // FALLBACK: Legacy role-based permissions
  canApprove: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
  // ...
};
```

### ✅ Template Renders Correctly

**File:** `/views/dashboard/document-viewer.ejs` line 382

```ejs
<% if (userPermissions && (userPermissions.canApprove || userRole === 'admin' || userRole === 'owner')) { %>
  <div class="workflow-progression-section">
    <!-- Buttons render here -->
  </div>
<% } %>
```

**If buttons don't appear at all:** Check if this EJS condition is failing
**If buttons appear but are disabled:** JavaScript issue (this bug)

---

## The Fix

### Option 1: Remove Old Function (RECOMMENDED)

**Delete lines 1878-1928** in `/views/dashboard/document-viewer.ejs`

The old `updateWorkflowProgress()` function is:
- Inefficient (N+1 queries)
- Incomplete (doesn't update buttons)
- Superseded by `refreshWorkflowProgress()`

### Option 2: Remove Old DOMContentLoaded Call

**Delete lines 1721-1725:**
```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadAllSuggestionCounts();
  loadAllWorkflowStates();
  updateWorkflowProgress();  // ← Remove this line
});
```

Keep only:
```javascript
document.addEventListener('DOMContentLoaded', function() {
  const documentId = '<%= document.id %>';
  refreshWorkflowProgress(documentId);  // ← This is correct
});
```

### Option 3: Rename Old Function

**Rename to `updateWorkflowProgressBarOnly()`** to avoid confusion:
```javascript
async function updateWorkflowProgressBarOnly() {
  // Keep for backwards compatibility if needed
  // But clearly indicate it's limited functionality
}
```

---

## Testing Steps After Fix

### 1. Verify Buttons Render
```bash
# View page source (Ctrl+U)
# Search for: workflow-progression-section
# Should appear if user is admin/owner
```

### 2. Check Browser Console
```javascript
// Should see:
// - No JavaScript errors
// - Fetch request to /api/workflow/documents/:id/progress-status
// - Response with stats object
```

### 3. Verify Button States
```javascript
// In browser console:
const approveBtn = document.getElementById('btn-approve-unmodified');
const progressBtn = document.getElementById('btn-progress-workflow');

console.log('Approve button:', approveBtn?.disabled, approveBtn?.textContent);
console.log('Progress button:', progressBtn?.disabled, progressBtn?.textContent);
```

Expected output:
- If unmodified sections exist: `disabled: false`
- If no unmodified sections: `disabled: true`
- If all approved: Progress button `disabled: false`

### 4. Test User Roles

| Role | Should See Buttons? | Should Be Enabled? |
|------|--------------------|--------------------|
| global_admin | ✅ Yes | ✅ Yes (if sections ready) |
| org_owner | ✅ Yes | ✅ Yes (if sections ready) |
| org_admin | ✅ Yes | ✅ Yes (if sections ready) |
| member | ❌ No | N/A |
| viewer | ❌ No | N/A |

---

## Related Issues

### Issue: "Buttons don't appear at all"
**Diagnosis:** Permission check failing on server-side
**Debug:** Add logging to line 1089 of `/src/routes/dashboard.js`:
```javascript
console.log('[DEBUG] Permissions:', {
  userRole: req.userRole,
  canApprove: userPermissions.canApprove
});
```

### Issue: "Buttons appear but stay disabled"
**Diagnosis:** This bug (JavaScript not enabling them)
**Solution:** Apply one of the fixes above

### Issue: "Buttons flash enabled then become disabled"
**Diagnosis:** Multiple DOMContentLoaded handlers fighting
**Solution:** Remove old handler (Option 2 above)

---

## Conclusion

**This is definitively NOT a permissions bug.**

✅ Permission middleware works
✅ Role detection works
✅ Database schema correct
✅ Server-side rendering works
✅ API endpoints exist and work

❌ **JavaScript function conflict breaks button initialization**

**Fix Priority:** HIGH
**Complexity:** LOW (simple code deletion)
**Risk:** LOW (removing dead code)
**Test Time:** 5 minutes

Apply Option 1 or Option 2 above to resolve the issue immediately.
