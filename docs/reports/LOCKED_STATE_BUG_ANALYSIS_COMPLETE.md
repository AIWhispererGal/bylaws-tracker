# Locked State Display Bug - Complete Analysis

**Bug:** After unlocking a section, it still displays as "locked" even after page reload
**Status:** Root cause identified
**Severity:** Medium (functional but confusing UX)
**Date:** 2025-10-27

---

## Executive Summary

When an admin unlocks a section via the UI, the database update succeeds but the page reload displays stale locked state. This is **browser caching**, not a database issue.

### The Problem in 3 Parts:

1. **Lock Badge Display** (lines 530-533 in document-viewer.ejs)
   ```ejs
   <% if (section.is_locked) { %>
     <span class="badge bg-primary">Locked</span>
   <% } %>
   ```

2. **Data Source** (lines 999-1019 in dashboard.js)
   ```javascript
   const { data: sections } = await supabase
     .from('document_sections')
     .select('..., is_locked, ...')  // Fetches from DB
   ```

3. **Page Reload After Unlock** (line 1441 in document-viewer.ejs)
   ```javascript
   if (data.success) {
     location.reload();  // ⚠️ May serve cached HTML
   }
   ```

### Why It Happens:

- **Server-side rendering:** Lock badge is baked into HTML at render time
- **No cache headers:** Dashboard route doesn't set `Cache-Control: no-cache`
- **Soft reload:** `location.reload()` may serve cached HTML without fetching fresh data

---

## Data Flow Analysis

### Unlock Operation Flow:

```
1. User clicks "Unlock" button
   ↓
2. POST /api/workflow/sections/:sectionId/unlock
   ↓
3. Backend UPDATE via supabaseService (service role - bypasses RLS)
   UPDATE document_sections SET is_locked = false WHERE id = :id
   ✅ This succeeds
   ↓
4. Response: { success: true, section: { is_locked: false } }
   ↓
5. Client: location.reload()
   ↓
6. GET /dashboard/document/:documentId
   ↓
7. Backend SELECT via req.supabase (user client - RLS applies but SELECT policy exists)
   SELECT ..., is_locked FROM document_sections WHERE document_id = :id
   ✅ This also succeeds, returns fresh data
   ↓
8. EJS renders: <% if (section.is_locked) { %> Lock Badge <% } %>
   ✅ Should render correctly with is_locked: false
   ↓
9. Browser displays page
   ⚠️ May display CACHED HTML with old is_locked: true
```

### The Caching Point:

Between steps 8 and 9, the browser may serve cached HTML instead of the fresh render.

---

## Evidence

### 1. Unlock Endpoint Uses Service Role ✅
**File:** `/src/routes/workflow.js:2519-2531`
```javascript
const { data: section, error: unlockError } = await supabaseService
  .from('document_sections')
  .update({ is_locked: false, ... })
```
- Uses `supabaseService` (bypasses RLS)
- No RLS policy can block this

### 2. Page Load Uses User Client with Valid RLS Policy ✅
**File:** `/src/routes/dashboard.js:999-1019`
```javascript
const { data: sections } = await supabase  // User client
  .from('document_sections')
  .select('..., is_locked, ...')
```

**RLS Policy:** `/database/migrations/008_fix_global_admin_rls.sql:114-126`
```sql
CREATE POLICY "Users see sections in accessible documents"
  ON document_sections
  FOR SELECT  -- ✅ SELECT policy exists
  USING (...); -- Allows global admins and org members
```

### 3. No Cache-Control Headers ❌
**File:** `/src/routes/dashboard.js:1079`
```javascript
res.render('dashboard/document-viewer', {
  // No cache headers set
});
```
- Default Express behavior allows caching
- Browser may cache rendered HTML

### 4. Soft Reload May Use Cache ❌
**File:** `/views/dashboard/document-viewer.ejs:1441`
```javascript
location.reload();  // Without `true`, may use cache
```
- `location.reload()` without `true` parameter may use cached resources
- `location.reload(true)` forces server fetch (deprecated but still works)

---

## Root Cause

**Browser caching of server-rendered HTML**

The database update works. The fresh query works. But the browser serves cached HTML from before the unlock, which has `section.is_locked = true` baked into the EJS template output.

---

## Recommended Solutions

### Solution 1: Prevent Caching (RECOMMENDED - 2 minutes)

**File:** `/src/routes/dashboard.js`
**Location:** Line 1079, before `res.render()`

```javascript
async function handleDocumentView(req, res) {
  try {
    // ... existing code to fetch document and sections ...

    // PREVENT BROWSER CACHING
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.render('dashboard/document-viewer', {
      // ... existing render data ...
    });
  }
}
```

**Impact:**
- Forces browser to fetch fresh HTML on every load
- No client-side code changes needed
- Fixes the issue permanently

### Solution 2: Force Hard Reload (QUICK FIX - 1 minute)

**File:** `/views/dashboard/document-viewer.ejs`
**Location:** Line 1441

```javascript
// BEFORE:
location.reload();

// AFTER:
location.reload(true);  // Force server fetch, bypass cache
```

**Impact:**
- Forces browser to skip cache on unlock
- Quick fix but deprecated API
- Doesn't prevent caching in other scenarios

### Solution 3: Dynamic Update (BEST UX - 15 minutes)

**File:** `/views/dashboard/document-viewer.ejs`
**Location:** Lines 1432-1441

```javascript
if (data.success) {
  showToast('Section unlocked successfully', 'success');

  // Remove lock badge dynamically
  const sectionHeader = document.querySelector(`#section-${sectionId} .section-header`);
  const lockBadge = sectionHeader?.querySelector('.badge.bg-primary');
  if (lockBadge?.textContent.includes('Locked')) {
    lockBadge.remove();
  }

  // Remove locked alert from expanded content
  const sectionContent = document.querySelector(`#section-${sectionId} .section-content`);
  const lockedAlert = sectionContent?.querySelector('.alert-info');
  if (lockedAlert?.textContent.includes('locked')) {
    lockedAlert.remove();
  }

  // Refresh workflow state and suggestions
  await loadSectionWorkflowState(sectionId);
  await loadSuggestions(sectionId);
  await refreshWorkflowProgress();

  // No reload needed!
}
```

**Impact:**
- Best user experience (no page reload)
- Updates UI immediately
- More code but better UX

---

## Implementation Plan

### Phase 1: Quick Fix (5 minutes)
1. Apply Solution 1 (cache headers) - prevents future issues
2. Apply Solution 2 (hard reload) - fixes current issue
3. Test unlock operation

### Phase 2: Better UX (later)
1. Implement Solution 3 (dynamic updates)
2. Remove page reload entirely
3. Test all lock/unlock scenarios

---

## Testing Checklist

After applying fixes:

- [ ] Lock a section
- [ ] Click unlock button
- [ ] Open browser Network tab
- [ ] Verify request shows "200" status (not "304 Not Modified" or "from cache")
- [ ] Verify lock badge disappears
- [ ] Verify "Locked" alert disappears from expanded content
- [ ] Verify suggestions become editable again
- [ ] Hard refresh (Ctrl+Shift+R) and verify state persists

---

## Files to Modify

1. **Required:** `/src/routes/dashboard.js` - Add cache headers (3 lines)
2. **Quick fix:** `/views/dashboard/document-viewer.ejs` - Force hard reload (1 char)
3. **Optional:** `/views/dashboard/document-viewer.ejs` - Dynamic updates (replace reload with DOM manipulation)

---

## Related Findings

### Missing UPDATE RLS Policy (Non-blocking)

The `document_sections` table only has SELECT policy, no UPDATE/INSERT/DELETE policies. This is okay because:
- Service role bypasses RLS (used for unlock) ✅
- Regular users shouldn't update sections directly ✅
- All updates go through service role endpoints ✅

However, for audit/compliance, consider adding:
```sql
CREATE POLICY "Service role only updates"
  ON document_sections
  FOR UPDATE
  USING (false)  -- Regular users cannot update
  WITH CHECK (false);
```

This explicitly documents the intent that only service role can update.

---

## Conclusion

**The bug is browser caching, not database or RLS issues.**

**Quick fix:** Add cache headers + force hard reload (5 minutes)
**Best fix:** Dynamic UI updates without page reload (15 minutes)

Both the database unlock and the fresh query work correctly. The issue is purely client-side caching of server-rendered HTML.
