# Original Text Display Bug Analysis

## The Bug
When locking to "Keep Original Text", the section still displays the old suggestion text instead of the original text.

## Root Cause Found

### Backend is CORRECT ✅
The backend (workflow.js lines 1959-1980) correctly:
1. Sets `textToLock = currentSection.original_text` when `suggestionId === 'original'`
2. Updates both `locked_text` and `current_text` to the original text
3. Returns complete section data including all three text fields

**Backend response structure (lines 2052-2060):**
```javascript
section: {
  id: section.id,
  is_locked: section.is_locked,
  locked_at: section.locked_at,
  locked_by: section.locked_by,
  locked_text: section.locked_text,      // ✅ Has original_text
  current_text: section.current_text,    // ✅ Has original_text
  original_text: section.original_text,  // ✅ Has original_text
  selected_suggestion_id: section.selected_suggestion_id
}
```

### Frontend is WRONG ❌
The `refreshSectionAfterLock` function (document-viewer.ejs lines 1385-1413) has the RIGHT approach but WRONG execution order.

**The problem:**
```javascript
// Line 1391: Updates DOM with correct text
const newText = lockResponseData.section.locked_text || lockResponseData.section.current_text || '';
textDiv.textContent = newText;  // ✅ Sets to original_text

// Lines 1407-1408: OVERWRITES the correct text!
await loadSectionWorkflowState(sectionId);  // Fetches old data
await loadSuggestions(sectionId);           // Fetches old data and re-renders UI
```

**What happens:**
1. Line 1392 correctly sets `textDiv.textContent` to original_text
2. Line 1408 calls `loadSuggestions(sectionId)`
3. `loadSuggestions` fetches data from server and re-renders the section
4. The re-render uses stale cached data or doesn't use the fresh `locked_text`
5. The correct text gets overwritten with old suggestion text

## Why This Happens

The `loadSuggestions` function likely:
1. Fetches section data from `/api/workflow/:sectionId/suggestions`
2. Re-renders the entire section UI
3. Uses `current_text` from the response
4. But there might be a race condition or caching issue

## The Fix

**Option 1: Don't re-fetch after updating (RECOMMENDED)**
```javascript
window.refreshSectionAfterLock = async function(sectionId, lockResponseData) {
  try {
    // Update the displayed section text with the new locked text
    const textDiv = document.getElementById('section-text-' + sectionId);
    if (textDiv && lockResponseData.section) {
      const newText = lockResponseData.section.locked_text || lockResponseData.section.current_text || '';
      textDiv.textContent = newText;
    }

    // Update the preview text in collapsed section header
    const sectionCard = document.getElementById('section-' + sectionId);
    if (sectionCard && lockResponseData.section) {
      const previewP = sectionCard.querySelector('.text-muted.mb-0');
      if (previewP) {
        const previewText = lockResponseData.section.locked_text || lockResponseData.section.current_text || '';
        const preview = previewText.substring(0, 200);
        previewP.textContent = preview + (previewText.length > 200 ? '...' : '');
      }
    }

    // DON'T re-fetch - we already have fresh data from lock response!
    // The backend returns complete section data, so use it directly

    // Update workflow UI state (buttons, badges) without re-fetching section text
    await updateWorkflowUIFromData(sectionId, lockResponseData.workflow);

    // Update suggestions list (but don't re-render section text)
    await updateSuggestionsListOnly(sectionId);

  } catch (error) {
    console.error('[REFRESH AFTER LOCK] Error:', error);
  }
};
```

**Option 2: Pass fresh data to loadSuggestions**
```javascript
// Modify loadSuggestions to accept optional pre-fetched data
async function loadSuggestions(sectionId, freshSectionData = null) {
  let section;
  if (freshSectionData) {
    section = freshSectionData;
  } else {
    // Fetch from server
    const response = await fetch(`/api/workflow/${sectionId}/suggestions`);
    section = await response.json();
  }
  // Render with guaranteed fresh data
  renderSection(section);
}

// In refreshSectionAfterLock:
await loadSuggestions(sectionId, lockResponseData.section);
```

**Option 3: Add delay before re-fetch (HACKY - NOT RECOMMENDED)**
```javascript
// Wait for database to fully commit before re-fetching
await new Promise(resolve => setTimeout(resolve, 100));
await loadSuggestions(sectionId);
```

## Recommended Solution

**Use Option 1** - Don't re-fetch data we already have. The lock endpoint returns complete, fresh section data. Use it directly and only update UI elements that need updating.

## Testing Checklist

After fix:
- [ ] Lock to "Keep Original Text" - displays original_text
- [ ] Lock to a suggestion - displays suggestion text
- [ ] Collapsed preview shows correct locked text
- [ ] Workflow buttons update correctly
- [ ] Suggestions list refreshes correctly
- [ ] No race conditions or flickering

## Files to Modify

1. `/views/dashboard/document-viewer.ejs` - Lines 1385-1413 (refreshSectionAfterLock)
2. Possibly create helper functions:
   - `updateWorkflowUIFromData(sectionId, workflowData)`
   - `updateSuggestionsListOnly(sectionId)`
