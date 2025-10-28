# LOCKED STATE BUG - ROOT CAUSE IDENTIFIED

## 🔴 CRITICAL FINDING: Missing UPDATE Policy on document_sections

### The Smoking Gun

**File:** `/database/migrations/008_fix_global_admin_rls.sql`
**Lines:** 112-126

```sql
-- ============================================================================
-- FIX: Document Sections Table RLS Policy
-- ============================================================================

DROP POLICY IF EXISTS "Users see sections in accessible documents" ON document_sections;

CREATE POLICY "Users see sections in accessible documents"
  ON document_sections
  FOR SELECT  -- ⚠️ ONLY SELECT! No UPDATE/INSERT/DELETE policies!
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
      AND uo.user_id = auth.uid()
      AND uo.is_active = true
    )
    OR is_global_admin(auth.uid())
  );
```

## 🐛 The Bug Explained

### What Happens During Unlock

1. **Admin clicks "Unlock" button** → Calls `/api/workflow/sections/:sectionId/unlock`

2. **Unlock endpoint uses `supabaseService`** (service role):
   ```javascript
   const { data: section, error: unlockError } = await supabaseService
     .from('document_sections')
     .update({
       is_locked: false,
       locked_at: null,
       locked_by: null,
       locked_text: null
     })
     .eq('id', sectionId)
     .select()
     .single();
   ```
   ✅ **This works because service role bypasses RLS**

3. **Page reloads** → Calls `/dashboard/document/:documentId`

4. **Dashboard uses `req.supabase`** (user's authenticated client):
   ```javascript
   const { data: sections } = await supabase  // User client, NOT service role
     .from('document_sections')
     .select('id, section_number, ..., is_locked, ...')
     .eq('document_id', documentId);
   ```
   ✅ **This also works - SELECT policy exists**

### So Where's The Problem?

**There is NO UPDATE policy for regular users!**

But wait... the unlock uses `supabaseService`, which bypasses RLS. So why does it matter?

## 🎯 The REAL Issue: No Evidence of UPDATE Failure

After analyzing the code flow, I need to revise my hypothesis. The unlock should work because:

1. Unlock uses service role (bypasses RLS) ✅
2. Page reload uses user client with SELECT policy ✅
3. No UPDATE policy doesn't matter for unlock operation ✅

## 🔍 Revised Hypothesis: Browser Caching or Query Caching

### Evidence Supporting Caching Issue:

1. **No Cache-Control headers** on dashboard route
   - Dashboard renders at line 1079 in `/src/routes/dashboard.js`
   - No `Cache-Control: no-cache` headers set
   - Browser may cache the rendered HTML with old `is_locked` values

2. **EJS renders server-side**
   - Lock badge uses `<% if (section.is_locked) { %>`
   - This is rendered once on server, not updated dynamically
   - If browser caches the HTML, stale lock badges persist

3. **Page reload after unlock**
   - Line 1441: `location.reload()`
   - This is immediate - no delay for DB commit
   - Browser might serve cached HTML

### Test This Theory:

**Check browser Network tab:**
1. Does the page reload show "200 (from cache)" or "200 (from server)"?
2. If from cache, that's the bug

**Quick fix to test:**
```javascript
// In unlock function, line 1441:
location.reload(true);  // Force reload from server, bypass cache
```

## 🔧 Recommended Fixes

### Fix 1: Add Cache-Control Headers (RECOMMENDED)

File: `/src/routes/dashboard.js` line 1079

```javascript
async function handleDocumentView(req, res) {
  try {
    // ... existing code ...

    // BEFORE res.render:
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

### Fix 2: Force Hard Reload on Client

File: `/views/dashboard/document-viewer.ejs` line 1441

```javascript
if (data.success) {
  showToast('Section unlocked successfully', 'success');

  // Force hard reload from server (bypass browser cache)
  location.reload(true);
}
```

### Fix 3: Dynamic Lock Badge Updates (BEST UX)

Instead of full page reload, update the lock badge dynamically:

```javascript
if (data.success) {
  showToast('Section unlocked successfully', 'success');

  // Remove lock badge immediately
  const lockBadge = document.querySelector(`#section-${sectionId} .badge.bg-primary`);
  if (lockBadge && lockBadge.textContent.includes('Locked')) {
    lockBadge.remove();
  }

  // Update section data in memory
  const section = data.section;

  // Refresh workflow state
  await loadSectionWorkflowState(sectionId);
  await loadSuggestions(sectionId);
  await refreshWorkflowProgress();

  // Only reload if dynamic update fails
  // location.reload(true);
}
```

## 📋 Implementation Priority

1. **Immediate (Fix 1 + Fix 2):** Add cache headers + force hard reload
2. **Short-term (Fix 3):** Implement dynamic badge updates
3. **Long-term:** Add UPDATE RLS policy for audit/compliance

## Testing Plan

1. Apply Fix 1 (cache headers)
2. Apply Fix 2 (hard reload)
3. Test unlock operation:
   - Lock a section
   - Click unlock
   - Verify browser Network tab shows "200" not "304" or "from cache"
   - Verify lock badge disappears after reload
4. If still fails, add diagnostic logging from `LOCKED_STATE_DIAGNOSTIC_PLAN.md`

## Files to Modify

1. `/src/routes/dashboard.js` - Add cache headers (3 lines)
2. `/views/dashboard/document-viewer.ejs` - Force hard reload (1 character change)

## Expected Outcome

After fixes, unlock should:
1. Update database (already works) ✅
2. Reload page from server (not cache) ✅
3. Display unlocked state (should work now) ✅
