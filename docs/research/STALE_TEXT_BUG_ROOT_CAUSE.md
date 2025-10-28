# Stale Text Display Bug - Root Cause Analysis

## Bug Description
After locking to original text, the UI displays old suggestion text instead of the original text. This indicates stale data is being displayed.

## Root Cause: Server-Side Rendered Data Not Refreshed

### The Critical Issue

**Lines 550-594** in document-viewer.ejs render section text **server-side** at page load:

```ejs
<%
  // Display locked_text if locked, otherwise current_text
  const displayText = section.is_locked && section.locked_text
    ? section.locked_text
    : (section.current_text || section.original_text);
%>
<p class="text-muted mb-0">
  <%= displayText.substring(0, 200) %>...
</p>

<!-- Full Section Text -->
<div class="section-text-full" id="section-text-<%= section.id %>">
  <%
    const fullText = section.is_locked && section.locked_text
      ? section.locked_text
      : (section.current_text || section.original_text || 'No text available');
  %>
  <%= fullText %>
</div>
```

**This is server-side EJS rendering** - the HTML is baked into the page when it loads. The `section` object comes from the initial page render.

## The Problem Flow

1. **Page Loads**: EJS renders sections array with current database values
   - `section.locked_text = "old suggestion text"` (from previous lock)
   - HTML is generated with this old text

2. **User Locks to Original**: POST to `/api/workflow/sections/${sectionId}/lock`
   - Backend updates database with `locked_text = "original text"`
   - Returns success

3. **Client Refresh Strategy** (Lines 1356-1368):
   ```javascript
   if (data.success) {
     showToast('Section locked successfully', 'success');

     // PHASE 2: Automatically refresh the entire section
     if (typeof window.refreshSectionAfterLock === 'function') {
       await window.refreshSectionAfterLock(sectionId, data);
     } else {
       // Fallback to old behavior if refresh function not available
       await loadSectionWorkflowState(sectionId);
       await loadSuggestions(sectionId);
     }
   }
   ```

4. **The Failure**:
   - `window.refreshSectionAfterLock` **DOES NOT EXIST** (searched entire file)
   - Falls back to `loadSectionWorkflowState()` and `loadSuggestions()`
   - **NEITHER function updates the displayed text in the DOM**

## What Each Function Actually Does

### `loadSectionWorkflowState(sectionId)` - Lines 995-1011
```javascript
async function loadSectionWorkflowState(sectionId) {
  const response = await fetch(`/api/workflow/sections/${sectionId}/state`);
  const data = await response.json();

  if (data.success) {
    updateSectionWorkflowBadge(sectionId, data);  // ONLY UPDATES BADGE
  }
}
```
**Updates**: Workflow status badge only
**Does NOT update**: Section text display

### `loadSuggestions(sectionId)` - Lines 1086-1104
```javascript
async function loadSuggestions(sectionId) {
  const response = await fetch(`/api/dashboard/suggestions?section_id=${sectionId}`);
  const data = await response.json();

  if (data.success) {
    const activeSuggestions = data.suggestions.filter(s => !s.rejected_at);
    renderSuggestions(sectionId, activeSuggestions);  // ONLY UPDATES SUGGESTIONS LIST
  }
}
```
**Updates**: Suggestions list panel
**Does NOT update**: Section text display

### `updateSectionWorkflowBadge(sectionId, workflowData)` - Lines 1763-1819
```javascript
function updateSectionWorkflowBadge(sectionId, workflowData) {
  const statusContainer = document.getElementById('workflow-status-' + sectionId);

  let badgeHTML = `<span class="badge bg-${badgeColor}">...</span>`;
  statusContainer.innerHTML = badgeHTML;  // ONLY UPDATES BADGE HTML
}
```
**Updates**: Workflow badge HTML
**Does NOT update**: Section text display

## Why the Text Stays Stale

The **actual section text** is rendered server-side into these elements:
- `<div class="section-text-full" id="section-text-<%= section.id %>">`
- Preview text in collapsed header

After lock operation:
1. ✅ Badge gets updated (shows "Locked")
2. ✅ Suggestions list refreshes
3. ❌ **Section text remains unchanged** - still showing old EJS-rendered HTML
4. ❌ No function re-fetches and updates `#section-text-${sectionId}` innerHTML

## The Missing Piece: `window.refreshSectionAfterLock`

This function is **referenced but never implemented**:
```javascript
// Lines 1362-1363
if (typeof window.refreshSectionAfterLock === 'function') {
  await window.refreshSectionAfterLock(sectionId, data);
}
```

This was intended to refresh the section text but was never completed.

## Current Workaround

**Only the unlock function forces a refresh** (Line 1410):
```javascript
async function unlockSection(sectionId) {
  // ... unlock API call ...
  if (data.success) {
    await loadSectionWorkflowState(sectionId);
    await loadSuggestions(sectionId);

    // Refresh the page to show updated lock status
    location.reload();  // ✅ THIS WORKS - full page reload
  }
}
```

## Solutions

### Option 1: Implement `refreshSectionAfterLock` (Recommended)
```javascript
window.refreshSectionAfterLock = async function(sectionId, lockData) {
  try {
    // Fetch fresh section data
    const response = await fetch(`/api/dashboard/sections/${sectionId}`);
    const data = await response.json();

    if (data.success && data.section) {
      const section = data.section;

      // Update displayed text
      const displayText = section.is_locked && section.locked_text
        ? section.locked_text
        : (section.current_text || section.original_text);

      const textElement = document.getElementById(`section-text-${sectionId}`);
      if (textElement) {
        textElement.textContent = displayText;
      }

      // Update preview text in header (if exists)
      // ... update collapsed preview ...

      // Update workflow badge
      await loadSectionWorkflowState(sectionId);
    }
  } catch (error) {
    console.error('Error refreshing section:', error);
  }
};
```

### Option 2: Force Page Reload (Simple but Heavy)
```javascript
// In lockSelectedSuggestion after success
if (data.success) {
  showToast('Section locked successfully', 'success');
  setTimeout(() => location.reload(), 800);  // Like unlock does
}
```

### Option 3: Update DOM Directly from Lock Response
If the lock API returns the updated section object:
```javascript
if (data.success && data.section) {
  // Update DOM with fresh data
  const textElement = document.getElementById(`section-text-${data.section.id}`);
  if (textElement) {
    textElement.textContent = data.section.locked_text || data.section.original_text;
  }
}
```

## Recommendation

**Implement Option 1** - Create `refreshSectionAfterLock` function that:
1. Fetches fresh section data from `/api/dashboard/sections/${sectionId}`
2. Updates all section text displays (full text + preview)
3. Updates workflow badges
4. Refreshes suggestions list

This provides surgical updates without full page reload, maintaining scroll position and user state.

## File Location
`/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs`

## Key Lines
- Lines 550-594: Server-side EJS text rendering
- Lines 1336-1382: `lockSelectedSuggestion` function
- Lines 1362-1368: Missing refresh function reference
- Lines 995-1011: `loadSectionWorkflowState` (badge only)
- Lines 1086-1104: `loadSuggestions` (suggestions only)
