# Workflow Lock System Analysis

## Executive Summary

The current workflow system has **incomplete implementation** for the SELECT → LOCK → APPROVE workflow. Critical gaps exist in:
1. **Suggestion selection UI** - No visual interface to select which suggestion to lock
2. **Lock button visibility logic** - Shows only when status='approved', but should show at stages with `can_lock=true`
3. **API parameter handling** - Lock endpoint accepts `suggestionId` but frontend doesn't provide it
4. **Workflow progression order** - System approves THEN locks, but user story requires LOCK then APPROVE

---

## Issue #1: Lock Button Logic ❌ INCORRECT

### Current Implementation (document-viewer.ejs:818-824)

```javascript
if (permissions.canLock && state.status === 'approved' && stage.can_lock) {
  actionsHTML += `
    <button class="btn btn-primary btn-sm" onclick="lockSection('${sectionId}')">
      <i class="bi bi-lock me-1"></i>Lock Section
    </button>
  `;
}
```

**Problem:** Lock button only shows when section is **already approved**. This contradicts the intended workflow where:
- User selects a suggestion
- User locks the suggestion
- User approves the section

### Correct Logic Should Be:

```javascript
// Lock button should show when:
// 1. Current stage allows locking (stage.can_lock = true)
// 2. User has permission (permissions.canLock = true)
// 3. Section is NOT already locked
// 4. Status can be 'pending', 'in_progress', or 'approved'

if (permissions.canLock && stage.can_lock && state.status !== 'locked') {
  actionsHTML += `
    <button class="btn btn-primary btn-sm" onclick="lockSection('${sectionId}')">
      <i class="bi bi-lock me-1"></i>Lock Section
    </button>
  `;
}
```

**Location to Fix:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs:818-824`

---

## Issue #2: No Suggestion Selection UI ❌ MISSING

### Current Implementation (workflow-actions.js:179-184)

```javascript
function getSelectedSuggestion(sectionId) {
  // This will be implemented when suggestion selection UI is added
  // For now, return null to indicate no suggestion selected
  console.warn('Suggestion selection not yet implemented');
  return null;
}
```

**Problem:** Frontend has **NO UI** to select which suggestion to lock. The function always returns `null`, causing the lock action to fail.

### Required UI Components:

1. **Radio buttons in suggestions list** (document-viewer.ejs:604-660)
   - Add radio input for each suggestion
   - Store selected suggestion ID in data attribute
   - Visual indicator when suggestion is selected

2. **Selection state tracking**
   - Track which suggestion is selected per section
   - Clear selection when section collapses
   - Persist selection across UI updates

### Recommended Implementation:

```javascript
// Add to document-viewer.ejs suggestion rendering (line 627)
html += `
  <div class="suggestion-item">
    <div class="d-flex justify-content-between align-items-start">
      <div class="flex-grow-1">
        <!-- ADD SELECTION RADIO -->
        <div class="form-check mb-2">
          <input class="form-check-input"
                 type="radio"
                 name="suggestion-select-${sectionId}"
                 id="suggestion-radio-${suggestion.id}"
                 value="${suggestion.id}"
                 onchange="selectSuggestion('${sectionId}', '${suggestion.id}')">
          <label class="form-check-label" for="suggestion-radio-${suggestion.id}">
            <strong>Select for Locking</strong>
          </label>
        </div>

        <div class="d-flex justify-content-between align-items-start mb-2">
          <h6 class="mb-0">${escapeHtml(suggestion.author_name)}</h6>
          ...
        </div>
      </div>
    </div>
  </div>
`;
```

```javascript
// Update workflow-actions.js
const selectedSuggestions = new Map(); // Track selections per section

function selectSuggestion(sectionId, suggestionId) {
  selectedSuggestions.set(sectionId, suggestionId);
  console.log(`Section ${sectionId} - Selected suggestion ${suggestionId}`);

  // Update UI to show selected state
  const radio = document.getElementById(`suggestion-radio-${suggestionId}`);
  if (radio) {
    radio.closest('.suggestion-item').classList.add('selected');
  }
}

function getSelectedSuggestion(sectionId) {
  const suggestionId = selectedSuggestions.get(sectionId);
  if (!suggestionId) {
    console.warn('No suggestion selected for section:', sectionId);
  }
  return suggestionId || null;
}
```

**Files to Modify:**
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs:604-660`
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/public/js/workflow-actions.js:179-184`

---

## Issue #3: Lock API Endpoint - Parameter Handling ✅ CORRECT

### Backend Implementation (src/routes/workflow.js:1630-1729)

```javascript
router.post('/sections/:sectionId/lock', requireAuth, async (req, res) => {
  const { sectionId } = req.params;
  const { suggestionId, notes } = req.body; // ✅ Accepts suggestionId

  // Get suggestion if provided
  let suggestedText = null;
  if (suggestionId) {
    const { data: suggestion } = await supabaseService
      .from('suggestions')
      .select('suggested_text')
      .eq('id', suggestionId)
      .single();

    if (!suggestionError && suggestion) {
      suggestedText = suggestion.suggested_text;
    }
  }

  // Lock the section
  await supabaseService
    .from('document_sections')
    .update({
      is_locked: true,
      locked_at: new Date().toISOString(),
      locked_by: userId,
      selected_suggestion_id: suggestionId,  // ✅ Stores suggestion
      locked_text: suggestedText             // ✅ Stores text
    })
    .eq('id', sectionId);
});
```

**Status:** ✅ Backend correctly accepts and processes `suggestionId` parameter

### Frontend Implementation (workflow-actions.js:154-161)

```javascript
const response = await fetch(`/api/workflow/sections/${sectionId}/lock`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    suggestionId,  // ✅ Sends suggestionId
    notes
  })
});
```

**Status:** ✅ Frontend sends `suggestionId` parameter correctly

**Problem:** The `suggestionId` is always `null` because `getSelectedSuggestion()` is not implemented.

---

## Issue #4: Workflow Progression Order 🔄 DESIGN QUESTION

### Current Workflow (Backend Enforces):

```
1. Section created → status='pending'
2. User approves → status='approved'
3. User locks → status='locked'
```

This is enforced in `document-viewer.ejs:818`:
```javascript
if (permissions.canLock && state.status === 'approved' && stage.can_lock)
```

### User Story Workflow (SELECT → LOCK → APPROVE):

```
1. Section created → status='pending'
2. User selects suggestion → (no status change)
3. User locks suggestion → status='locked'
4. User approves locked section → status='approved'
```

### Analysis:

The **backend lock endpoint does NOT require status='approved'** (workflow.js:1630-1729):
```javascript
// No status check - can lock at any status
if (!currentState.workflow_stage.can_lock) {
  return res.status(400).json({
    error: 'Current workflow stage does not allow section locking'
  });
}
```

**Conclusion:**
- Backend allows locking at any status if `stage.can_lock=true`
- Frontend artificially restricts to `status='approved'` only
- **This is a frontend UI bug, not a backend limitation**

### Recommended Fix:

Remove the `state.status === 'approved'` requirement from the Lock button visibility logic.

---

## Database Schema Check

### document_sections table (supports locking):
```sql
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  selected_suggestion_id UUID REFERENCES suggestions(id),
  locked_text TEXT
);
```
✅ Schema supports storing selected suggestion and locked text

### section_workflow_states table (tracks approval):
```sql
CREATE TABLE section_workflow_states (
  id UUID PRIMARY KEY,
  section_id UUID REFERENCES document_sections(id),
  workflow_stage_id UUID REFERENCES workflow_stages(id),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'locked')),
  actioned_by UUID,
  actioned_at TIMESTAMPTZ
);
```
✅ Schema supports 'locked' status

---

## Summary of Required Changes

### 1. Fix Lock Button Visibility Logic (HIGH PRIORITY)

**File:** `views/dashboard/document-viewer.ejs`
**Line:** 818
**Change:**
```javascript
// OLD (WRONG):
if (permissions.canLock && state.status === 'approved' && stage.can_lock) {

// NEW (CORRECT):
if (permissions.canLock && stage.can_lock && state.status !== 'locked') {
```

### 2. Implement Suggestion Selection UI (HIGH PRIORITY)

**Files:**
- `views/dashboard/document-viewer.ejs` (lines 604-660)
- `public/js/workflow-actions.js` (lines 179-184)

**Components to Add:**
- Radio buttons for each suggestion
- `selectSuggestion(sectionId, suggestionId)` function
- `Map` to track selected suggestions per section
- Visual styling for selected suggestions

### 3. Update Lock API Call Validation (MEDIUM PRIORITY)

**File:** `public/js/workflow-actions.js`
**Line:** 129
**Enhancement:**
```javascript
async function lockSection(sectionId) {
  const suggestionId = getSelectedSuggestion(sectionId);

  if (!suggestionId) {
    showToast('Please select a suggestion to lock', 'danger');
    // Highlight suggestions area to guide user
    const suggestionsContainer = document.getElementById(`suggestions-list-${sectionId}`);
    suggestionsContainer?.classList.add('highlight-required');
    setTimeout(() => suggestionsContainer?.classList.remove('highlight-required'), 2000);
    return;
  }
  // ... rest of function
}
```

### 4. Add Visual Feedback (LOW PRIORITY)

**CSS to Add:**
```css
.suggestion-item.selected {
  border: 2px solid #0066cc;
  background: #f0f8ff;
  box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
}

.highlight-required {
  animation: pulse-border 1s ease-in-out 2;
}

@keyframes pulse-border {
  0%, 100% { border-color: #dee2e6; }
  50% { border-color: #dc3545; }
}
```

---

## Workflow States Comparison

### Current Implementation:
```
Draft/Pending → Approve → Lock → (Final)
```

### Intended Design (from user story):
```
Draft/Pending → Select Suggestion → Lock → Approve → (Final)
```

### Recommended Implementation:
```
1. Section at stage with can_lock=true
2. User views suggestions (Show/Hide Changes button)
3. User selects suggestion via radio button
4. User clicks "Lock Section" button
   - Validates suggestion selected
   - Calls POST /api/workflow/sections/:id/lock with suggestionId
   - Backend stores selected_suggestion_id and locked_text
   - Section marked is_locked=true
5. User clicks "Approve" button
   - Section status changes to 'approved'
   - Workflow advances to next stage (if applicable)
```

---

## Testing Checklist

After implementing fixes:

- [ ] Lock button appears when `stage.can_lock=true` (not just when approved)
- [ ] Suggestion selection radio buttons render correctly
- [ ] Clicking radio button selects and highlights the suggestion
- [ ] `getSelectedSuggestion()` returns correct UUID
- [ ] Lock API call includes `suggestionId` in request body
- [ ] Backend stores `selected_suggestion_id` and `locked_text` in database
- [ ] Section shows as locked after successful lock operation
- [ ] Locked sections cannot be edited (existing functionality)
- [ ] Approval can happen after locking
- [ ] Workflow progress bar updates correctly

---

## API Endpoints Reference

### GET /api/workflow/sections/:sectionId/state
Returns current workflow state including permissions

**Response:**
```json
{
  "success": true,
  "state": {
    "status": "pending|approved|rejected|locked",
    "workflow_stage_id": "uuid"
  },
  "permissions": {
    "canApprove": true,
    "canReject": true,
    "canLock": true,
    "canEdit": false
  },
  "stage": {
    "stage_name": "Review",
    "can_lock": true,
    "can_approve": true
  }
}
```

### POST /api/workflow/sections/:sectionId/lock
Locks section with selected suggestion

**Request:**
```json
{
  "suggestionId": "uuid-of-selected-suggestion",
  "notes": "Optional locking notes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Section locked successfully",
  "section": {
    "id": "uuid",
    "is_locked": true,
    "selected_suggestion_id": "uuid",
    "locked_text": "The locked suggestion text"
  }
}
```

### POST /api/workflow/sections/:sectionId/approve
Approves section at current stage

**Request:**
```json
{
  "notes": "Optional approval notes"
}
```

---

## Conclusion

The workflow system has solid backend infrastructure but **incomplete frontend implementation**. The main gaps are:

1. ❌ **No suggestion selection UI** - Must add radio buttons
2. ❌ **Incorrect lock button logic** - Remove status='approved' requirement
3. ✅ **Backend API works correctly** - Accepts and processes suggestionId
4. 🔄 **Workflow order confusion** - Frontend restricts incorrectly

**Estimated Fix Effort:** 4-6 hours
- 2 hours: Suggestion selection UI
- 1 hour: Lock button visibility fix
- 1 hour: Testing and validation
- 1-2 hours: CSS and UX polish

**Priority:** HIGH - This blocks the entire SELECT → LOCK → APPROVE workflow
