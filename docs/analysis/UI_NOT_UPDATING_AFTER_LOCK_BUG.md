# UI Not Updating After Lock Bug - Root Cause Analysis

## Problem Statement
After locking "Keep Original Text", the section should display `original_text` but still shows the previously locked suggestion. The display doesn't update even though the backend correctly sets `locked_text` to `original_text`.

## Root Cause: MISSING REFRESH FUNCTION

**Location:** `document-viewer.ejs` lines 1362-1368

### The Bug
```javascript
// Line 1362-1368
if (typeof window.refreshSectionAfterLock === 'function') {
  await window.refreshSectionAfterLock(sectionId, data);
} else {
  // Fallback to old behavior if refresh function not available
  await loadSectionWorkflowState(sectionId);
  await loadSuggestions(sectionId);
}
```

**CRITICAL ISSUE:** `window.refreshSectionAfterLock` is **NEVER DEFINED** anywhere in the codebase.

### Proof - Grep Results
```bash
# Searched entire document-viewer.ejs for function definition
grep -n "function refreshSectionAfterLock\|refreshSectionAfterLock\s*=\|const refreshSectionAfterLock"

# Result: ONLY FOUND THE CHECK, NOT THE DEFINITION
Line 1362: if (typeof window.refreshSectionAfterLock === 'function') {
```

This means the code **ALWAYS** falls back to the old behavior at lines 1365-1367.

## Why the Fallback Doesn't Work

### 1. `loadSectionWorkflowState(sectionId)` (Lines 995-1011)
- Only updates workflow badges (status, stage, approval buttons)
- Calls `updateSectionWorkflowBadge()` which updates DOM elements:
  - `#workflow-status-{sectionId}` - just the badge
  - `#approval-actions-{sectionId}` - just the buttons
- **DOES NOT update the section text display**

### 2. `loadSuggestions(sectionId)`
- Only refreshes the suggestions list
- Updates `#suggestions-list-{sectionId}`
- **DOES NOT update the section text display**

### 3. The Section Text Display (Lines 550-595)

**Server-side rendering (EJS):**
```ejs
<%
  // Line 550-553: Display logic
  const displayText = section.is_locked && section.locked_text
    ? section.locked_text
    : (section.current_text || section.original_text);
%>

<!-- Line 555-556: Rendered in card preview -->
<p class="text-muted mb-0">
  <%= displayText.substring(0, 150) %>...
</p>

<!-- Line 587-595: Full section text -->
<div class="section-text-full" id="section-text-<%= section.id %>">
  <%
    const fullText = section.is_locked && section.locked_text
      ? section.locked_text
      : (section.current_text || section.original_text || 'No text available');
  %>
  <%= fullText %>
</div>
```

**THE PROBLEM:** This is **EJS server-side rendering**. The `section` object is from the initial page load. The JavaScript fallback functions (`loadSectionWorkflowState` and `loadSuggestions`) don't update this static HTML.

## Backend is Correct

**Location:** `src/routes/workflow.js` lines 1970-1992

```javascript
// Backend correctly sets both locked_text AND current_text
const { data: section, error: lockError } = await supabaseService
  .from('document_sections')
  .update({
    is_locked: true,
    locked_at: new Date().toISOString(),
    locked_by: userId,
    selected_suggestion_id: suggestionId,
    locked_text: textToLock,        // ✅ Set to original_text when suggestionId='original'
    current_text: textToLock         // ✅ Also updated
  })
  .eq('id', sectionId)
  .select()
  .single();
```

**Backend returns complete data (lines 2048-2072):**
```javascript
res.json({
  success: true,
  message: 'Section locked successfully',
  section: {
    id: section.id,
    is_locked: section.is_locked,
    locked_at: section.locked_at,
    locked_by: section.locked_by,
    locked_text: section.locked_text,      // ✅ NEW locked_text
    current_text: section.current_text,    // ✅ NEW current_text
    original_text: section.original_text,
    selected_suggestion_id: section.selected_suggestion_id
  },
  workflow: { /* ... */ },
  suggestions: [ /* ... */ ]
});
```

The backend returns **ALL the data needed** to update the UI!

## Why Other Operations Work

**Compare with other operations that DO work:**

### Unlock Section (lines 1409-1410)
```javascript
await loadSectionWorkflowState(sectionId);
await loadSuggestions(sectionId);
await refreshWorkflowProgress();

// Refresh the page to show updated lock status
location.reload();  // ✅ Full page reload fixes stale display
```

### Retitle, Delete, Move, Split, Join (multiple locations)
```javascript
// All use location.reload()
setTimeout(() => location.reload(), 1000);  // ✅ Full page reload
```

**They all use `location.reload()`** which re-renders the entire page with fresh server data.

## The Fix Required

### Option 1: Implement `refreshSectionAfterLock()` (Recommended)

Create the missing function to update the DOM with fresh data from the backend response:

```javascript
window.refreshSectionAfterLock = async function(sectionId, lockResponseData) {
  // Update section text displays with new locked_text
  const section = lockResponseData.section;

  // Update full text display
  const fullTextElement = document.getElementById(`section-text-${sectionId}`);
  if (fullTextElement) {
    fullTextElement.textContent = section.locked_text || section.current_text;
  }

  // Update preview text (first 150 chars)
  const card = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (card) {
    const previewElement = card.querySelector('.text-muted.mb-0');
    if (previewElement) {
      const displayText = section.locked_text || section.current_text || section.original_text;
      previewElement.textContent = displayText.substring(0, 150) + '...';
    }
  }

  // Update workflow badges and buttons
  await loadSectionWorkflowState(sectionId);

  // Refresh suggestions list
  await loadSuggestions(sectionId);
};
```

### Option 2: Add `location.reload()` (Quick Fix)

Simply add a page reload like other operations:

```javascript
if (data.success) {
  showToast('Section locked successfully', 'success');

  // Quick fix: just reload the page
  setTimeout(() => location.reload(), 500);
}
```

### Option 3: Hybrid Approach

Implement refresh function with fallback to reload:

```javascript
if (data.success) {
  showToast('Section locked successfully', 'success');

  try {
    if (typeof window.refreshSectionAfterLock === 'function') {
      await window.refreshSectionAfterLock(sectionId, data);
    } else {
      // Fallback: reload page
      setTimeout(() => location.reload(), 500);
    }
  } catch (error) {
    console.error('[LOCK] Refresh error:', error);
    // Final fallback: reload
    setTimeout(() => location.reload(), 500);
  }
}
```

## Exact Line Numbers of Bug

1. **Line 1362:** Checks for non-existent function `window.refreshSectionAfterLock`
2. **Lines 1365-1367:** Fallback that doesn't update section text
3. **Lines 550-595:** Server-rendered text displays that aren't updated by JavaScript

## Why This Only Affects Lock

Other section operations reload the entire page, so they don't have this problem. Lock was designed to be "smarter" with client-side updates, but the refresh function was never implemented.

## Testing the Fix

After implementing the fix:

1. Upload document with section "Test Section"
2. Create suggestion "Suggested Amendment"
3. Lock "Suggested Amendment" → verify display shows suggestion
4. Unlock section
5. Lock "Keep Original Text" → **verify display shows original text** (this currently fails)
6. Check diff view → should show no changes (original = locked)

## Recommendation

**Use Option 1** (implement `refreshSectionAfterLock`) because:
- Backend already returns all needed data
- Avoids unnecessary page reloads
- Maintains the "Phase 2" enhancement intent
- Better user experience (instant update)
- Consistent with the architecture design

Add the function definition right before line 1336 (`lockSelectedSuggestion` function).
