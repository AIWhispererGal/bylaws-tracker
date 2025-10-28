# Lock Original Text Bug Analysis

## Executive Summary

**BUG CONFIRMED**: When user locks original text, the backend correctly updates `current_text = original_text` in the database, but the frontend UI still shows old suggestion text because:

1. ✅ **Backend is CORRECT** - Updates `current_text` properly
2. ❌ **Frontend is BROKEN** - Doesn't refresh the section text DOM element

---

## Backend Analysis (workflow.js)

### Lock Endpoint Code Review (Lines 1957-1980)

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/workflow.js`

```javascript
// Determine what text to lock
let textToLock;
if (suggestionId === 'original') {
  // User explicitly chose "Keep Original Text" - use original_text (immutable baseline)
  textToLock = currentSection.original_text;
} else if (suggestedText) {
  // User selected a suggestion
  textToLock = suggestedText;
} else {
  // Fallback: use current_text
  textToLock = currentSection.current_text || currentSection.original_text;
}

// Lock the section and update current_text to the locked text
const { data: section, error: lockError } = await supabaseService
  .from('document_sections')
  .update({
    is_locked: true,
    locked_at: new Date().toISOString(),
    locked_by: userId,
    selected_suggestion_id: suggestionId,
    locked_text: textToLock,
    // Update current_text to the locked text
    current_text: textToLock  // ← THIS IS CORRECT!
  })
  .eq('id', sectionId)
  .select()
  .single();
```

### Backend Logic Chain ✅

1. **Input**: `suggestionId === 'original'`
2. **Logic**: `textToLock = currentSection.original_text`
3. **Database UPDATE**:
   - `locked_text = textToLock` (original_text)
   - `current_text = textToLock` (original_text)
4. **Result**: Database correctly stores `current_text = original_text`

### Backend Response (Lines 2048-2072)

```javascript
res.json({
  success: true,
  message: 'Section locked successfully',
  // Complete section data
  section: {
    id: section.id,
    is_locked: section.is_locked,
    locked_at: section.locked_at,
    locked_by: section.locked_by,
    locked_text: section.locked_text,
    current_text: section.current_text,  // ← Contains updated value
    original_text: section.original_text,
    selected_suggestion_id: section.selected_suggestion_id
  },
  workflow: { ... },
  suggestions: [ ... ]
});
```

**Conclusion**: Backend correctly returns `section.current_text` with the new locked value.

---

## Frontend Analysis (document-viewer.ejs)

### Section Text Rendering (Server-Side)

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs`

**Lines 586-595**:
```html
<!-- Full Section Text -->
<div class="section-text-full" id="section-text-<%= section.id %>">
  <%
    // Display locked_text if locked, otherwise current_text
    const fullText = section.is_locked && section.locked_text
      ? section.locked_text
      : (section.current_text || section.original_text || 'No text available');
  %>
  <%= fullText %>
</div>
```

**Problem**: This is **server-side EJS rendering**. The text is baked into the HTML at page load. When the lock operation happens via AJAX, this DOM element is **NOT updated**.

### Lock Handler (Lines 1336-1382)

```javascript
async function lockSelectedSuggestion(sectionId) {
  const suggestionId = selectedSuggestions.get(sectionId);

  if (!suggestionId) {
    showToast('Please select a suggestion to lock', 'warning');
    return;
  }

  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestionId: suggestionId === 'original' ? null : suggestionId,
        notes: 'Locked via workflow'
      })
    });

    const data = await response.json();

    if (data.success) {
      showToast('Section locked successfully', 'success');

      // ============================================================
      // PHASE 2: Automatically refresh the entire section
      // ============================================================
      if (typeof window.refreshSectionAfterLock === 'function') {
        await window.refreshSectionAfterLock(sectionId, data);  // ← FUNCTION NOT DEFINED!
      } else {
        // Fallback to old behavior if refresh function not available
        await loadSectionWorkflowState(sectionId);  // ← Only updates badges/buttons
        await loadSuggestions(sectionId);           // ← Only updates suggestions list
      }

      // Clear selection
      selectedSuggestions.delete(sectionId);

      // Update overall workflow progress
      await refreshWorkflowProgress();
    }
  } catch (error) {
    console.error('[LOCK] Error:', error);
    showToast('An error occurred while locking the suggestion', 'danger');
  }
}
```

### The Missing Function

**Search Result**: `window.refreshSectionAfterLock` is **NOT DEFINED** anywhere in the file.

**Result**: Code falls back to:
- `loadSectionWorkflowState()` - Only updates workflow badge/buttons
- `loadSuggestions()` - Only updates suggestions list
- **DOES NOT UPDATE** `#section-text-${sectionId}` DOM element

### What loadSectionWorkflowState Does (Lines 995-1011)

```javascript
async function loadSectionWorkflowState(sectionId) {
  try {
    console.log('[WORKFLOW] Loading state for section:', sectionId);
    const response = await fetch(`/api/workflow/sections/${sectionId}/state`);
    const data = await response.json();

    console.log('[WORKFLOW] State response:', data);

    if (data.success) {
      updateSectionWorkflowBadge(sectionId, data);  // ← Only updates badges/buttons
    }
  } catch (error) {
    console.error('[WORKFLOW] Error loading workflow state:', error);
  }
}
```

**Problem**: This function only calls `updateSectionWorkflowBadge()`, which updates:
- Workflow status badge
- Action buttons (lock/approve/reject)
- **DOES NOT** update section text content

---

## Root Cause

### The Bug

**When locking original text**:
1. ✅ Backend correctly updates database: `current_text = original_text`
2. ✅ Backend returns updated section data with correct `current_text`
3. ❌ Frontend receives the data but **IGNORES** `data.section.current_text`
4. ❌ Frontend only updates badges/buttons, **NOT** the section text DOM

**Result**: User sees old suggestion text in the UI even though database has been updated.

### Why It Happens

The section text is rendered **server-side** in EJS. When AJAX lock operation completes, the frontend needs to:

**Option A**: Reload the entire page (heavy, bad UX)
**Option B**: Dynamically update the DOM element `#section-text-${sectionId}` with the returned `data.section.current_text` (correct approach)

**Current behavior**: Neither A nor B happens, so stale text remains visible.

---

## The Fix

### Solution: Implement refreshSectionAfterLock Function

Add this function to document-viewer.ejs (around line 1362):

```javascript
/**
 * Refresh section content and UI after locking
 * @param {string} sectionId - Section ID
 * @param {object} data - Response data from lock API
 */
window.refreshSectionAfterLock = async function(sectionId, data) {
  console.log('[REFRESH] Updating section after lock:', sectionId, data);

  // 1. Update section text content DOM
  const textContainer = document.getElementById('section-text-' + sectionId);
  if (textContainer && data.section) {
    // Use locked_text since section is now locked
    const newText = data.section.locked_text || data.section.current_text || data.section.original_text;
    textContainer.textContent = newText;
    console.log('[REFRESH] Updated section text to:', newText.substring(0, 100) + '...');
  }

  // 2. Update workflow state (badges/buttons)
  await loadSectionWorkflowState(sectionId);

  // 3. Update suggestions list
  if (data.suggestions) {
    // Refresh suggestions UI with returned data
    await loadSuggestions(sectionId);
  }

  // 4. Update lock indicator badge in section header
  const lockBadge = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (lockBadge) {
    lockBadge.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Locked';
    lockBadge.className = 'badge bg-primary';
  }

  console.log('[REFRESH] Section refresh complete');
};
```

### Where to Add It

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs`

**Location**: Before the `lockSelectedSuggestion` function (around line 1330)

---

## Verification Steps

After implementing the fix:

1. **Start from clean state**:
   - Section has original text
   - User creates a suggestion
   - Suggestion text differs from original

2. **Select "Keep Original Text (From Upload)"**:
   - Click the "Original Text" button
   - Click "Lock Selected Suggestion"

3. **Expected behavior after fix**:
   - ✅ Database: `current_text = original_text`
   - ✅ UI: Section text updates to show original_text
   - ✅ Lock badge appears
   - ✅ Action buttons update (lock disabled, approve enabled)

4. **Verify with browser DevTools**:
   - Network tab: Check API response has correct `section.current_text`
   - Console: Should see `[REFRESH] Updated section text to: ...`
   - Elements tab: Inspect `#section-text-{id}` - should contain original_text

---

## Additional Improvements

### Also Update Section Preview (Lines 547-558)

The section preview (collapsed view) also needs updating:

```javascript
// Inside refreshSectionAfterLock, add:

// 5. Update section preview text
const previewElement = document.querySelector(`#section-${sectionId} .text-muted.mb-0`);
if (previewElement && data.section) {
  const previewText = (data.section.locked_text || data.section.current_text || '').substring(0, 200);
  previewElement.textContent = previewText + (previewText.length >= 200 ? '...' : '');
}
```

---

## Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Backend Logic** | ✅ CORRECT | Properly updates `current_text = original_text` when `suggestionId === 'original'` |
| **Database UPDATE** | ✅ CORRECT | `current_text` column updated correctly |
| **API Response** | ✅ CORRECT | Returns updated `section.current_text` in response |
| **Frontend Handler** | ❌ BROKEN | Receives data but doesn't update DOM |
| **refreshSectionAfterLock** | ❌ MISSING | Function not implemented |
| **DOM Update** | ❌ MISSING | `#section-text-{id}` not updated with new text |

**Fix Required**: Implement `window.refreshSectionAfterLock()` function to update section text DOM element with `data.section.current_text` (or `locked_text`) from API response.

---

## Implementation Priority

🔥 **HIGH PRIORITY** - This is a critical UX bug that breaks the core locking workflow.

**Impact**: Users cannot trust the UI when locking original text. They must refresh the page to see correct content.

**Effort**: Low (add single function, ~20 lines of code)

**Risk**: Low (isolated change, only affects post-lock refresh)

---

## Files to Modify

1. **Primary Fix**:
   - `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs`
     - Add `window.refreshSectionAfterLock()` function

2. **No Backend Changes Required** - Backend is already correct

---

## Test Plan

### Manual Test
1. Create document with sections
2. Add suggestion to a section
3. Select "Keep Original Text (From Upload)"
4. Click "Lock Selected Suggestion"
5. **VERIFY**: Section text immediately updates to original_text (no page reload)
6. **VERIFY**: Lock badge appears
7. **VERIFY**: Approve button enables

### Automated Test (Optional)
```javascript
// Test: Lock original text updates UI
test('locking original text updates section content', async () => {
  // Mock lock API response
  const mockResponse = {
    success: true,
    section: {
      id: 'test-section',
      locked_text: 'Original text content',
      current_text: 'Original text content',
      is_locked: true
    }
  };

  // Call refreshSectionAfterLock
  await window.refreshSectionAfterLock('test-section', mockResponse);

  // Verify DOM updated
  const textElement = document.getElementById('section-text-test-section');
  expect(textElement.textContent).toBe('Original text content');
});
```

---

**End of Analysis**
