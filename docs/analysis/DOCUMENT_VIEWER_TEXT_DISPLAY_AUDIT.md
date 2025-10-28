# Document Viewer Text Display Audit Report

## Executive Summary

**CRITICAL BUG FOUND**: Line 1145 incorrectly uses `current_text` as the baseline for diff comparisons instead of `original_text`. This causes suggestions to be compared against the wrong baseline text.

### Database Schema Recap
- `original_text`: NEVER modified, always the baseline for comparisons
- `current_text`: Updated when changes are locked
- `locked_text`: Copy of text when section is locked

---

## Critical Issues Found

### 🚨 ISSUE #1: Wrong Baseline for Diff Comparisons (Line 1145)

**Location**: `getSectionOriginalText()` function
**Severity**: CRITICAL
**Impact**: All suggestion diffs show changes against current_text instead of original_text

```javascript
// Line 1139-1151
async function getSectionOriginalText(sectionId) {
  try {
    const response = await fetch(`/api/dashboard/sections/${sectionId}`);
    const data = await response.json();
    if (data.success && data.section) {
      return data.section.current_text || '';  // ❌ WRONG! Should be original_text
    }
  } catch (error) {
    console.error('Error loading section text:', error);
  }
  return '';
}
```

**Used By**:
- Line 1168: `renderSuggestions()` - displays suggestion diffs
- Line 1583: `renderRejectedSuggestion()` - displays rejected suggestion diffs

**Fix Required**:
```javascript
return data.section.original_text || '';  // ✅ CORRECT
```

---

## Text Display Analysis by Section

### 1. Section Card Preview (Lines 545-560)

**Display Logic**:
```javascript
// Lines 550-553
const displayText = section.is_locked && section.locked_text
  ? section.locked_text
  : (section.current_text || section.original_text);
```

**Status**: ✅ CORRECT
- Shows `locked_text` when locked (what was approved)
- Shows `current_text` when unlocked (if modified)
- Falls back to `original_text` (initial baseline)

**Label**: None (preview only)

---

### 2. Full Section Text Display (Lines 586-595)

**Display Logic**:
```javascript
// Lines 589-592
const fullText = section.is_locked && section.locked_text
  ? section.locked_text
  : (section.current_text || section.original_text || 'No text available');
```

**Status**: ✅ CORRECT
- Same logic as preview
- Shows approved text when locked
- Shows working text when unlocked

**Label**: "Full Section Text" (implicit, no explicit label in UI)

---

### 3. Locked Section Diff View (Lines 1450-1480)

**Display Logic**:
```javascript
// Lines 1462-1470
const originalText = data.section.original_text || '';  // ✅ CORRECT

const sections = <%- JSON.stringify(sections) %>;
const section = sections.find(s => s.id === sectionId);
const lockedText = section?.locked_text || '';

const diffHTML = generateDiffHTML(originalText, lockedText);
```

**Status**: ✅ CORRECT
- Compares `original_text` vs `locked_text`
- Shows what changed from the baseline

**Label**: "Show Changes" button (line 577-579)

---

### 4. Suggestion Text Display (Lines 1154-1204)

**Display Logic**:
```javascript
// Lines 1167-1168
const originalText = await getSectionOriginalText(sectionId);  // ❌ WRONG! Returns current_text

// Lines 1201-1204
const showChanges = suggestionTrackChanges.get(suggestion.id) || false;
const displayText = showChanges ?
  generateDiffHTML(originalText, suggestion.suggested_text) :  // ❌ Comparing to current_text!
  escapeHtml(suggestion.suggested_text);
```

**Status**: ❌ INCORRECT
- Uses `getSectionOriginalText()` which returns `current_text`
- All suggestion diffs compare against `current_text` instead of `original_text`

**Label**: "Suggested Text" (implicit)

---

### 5. "Keep Original Text" Option (Lines 1172-1198)

**Display Logic**:
```javascript
// Lines 1172-1198
html += `
  <div class="suggestion-item border-primary">
    <div class="d-flex justify-content-between align-items-start">
      <div class="form-check me-3 mt-1">
        <input class="form-check-input" type="radio"
               name="suggestion-select-${sectionId}"
               id="suggestion-original-${sectionId}"
               value="original"
               onchange="updateLockButton('${sectionId}', 'original')">
        <label class="form-check-label" for="suggestion-original-${sectionId}"></label>
      </div>
      <div class="flex-grow-1">
        <h6 class="mb-2">
          <i class="bi bi-file-text me-2"></i>Keep Original Text  // ✅ Label is correct
          <span class="badge bg-info ms-2">No Changes</span>
        </h6>
```

**Status**: ⚠️ MISLEADING LABEL
- Label says "Keep Original Text"
- But the text shown to user comes from `getSectionOriginalText()` which returns `current_text`
- After unlock, this option will lock `current_text` (not `original_text`)

**What it should say**:
- If `current_text == original_text`: "Keep Original Text" ✅
- If `current_text != original_text`: "Keep Current Text" or "Revert to Last Locked State"

---

### 6. Suggestion Form Pre-fill (Lines 637-640)

**Display Logic**:
```javascript
// Lines 639-640
<textarea class="form-control" id="suggested-text-<%= section.id %>"
          rows="4" placeholder="Enter your suggested amendment"><%= section.current_text || '' %></textarea>
```

**Status**: ✅ CORRECT
- Pre-fills with `current_text` so users can edit from working state
- This is the expected behavior for a suggestion form

**Label**: "Suggested Text"

---

### 7. Rejected Suggestion Display (Lines 1581-1607)

**Display Logic**:
```javascript
// Lines 1587-1590
const showChanges = suggestionTrackChanges.get(suggestion.id) || false;
const displayText = showChanges ?
  generateDiffHTML(originalText, suggestion.suggested_text) :  // ❌ Uses wrong originalText
  escapeHtml(suggestion.suggested_text);
```

**Status**: ❌ INCORRECT
- Same issue as active suggestions
- Uses `current_text` as baseline instead of `original_text`

**Label**: "Rejected" badge

---

## Workflow State Analysis

### When Section is Unlocked:
1. User sees `current_text` in section display ✅
2. Suggestions compare against `current_text` ❌ (should be `original_text`)
3. "Keep Original Text" option references `current_text` ⚠️ (misleading label)

### When Section is Locked:
1. User sees `locked_text` in section display ✅
2. "Show Changes" compares `original_text` vs `locked_text` ✅
3. Section cannot be edited (correct)

### When Section is Unlocked After Being Locked:
1. `current_text` is set to `locked_text` ✅
2. User sees `current_text` (= previous `locked_text`) ✅
3. Suggestions now compare against `current_text` ❌ (should still compare to `original_text`)
4. "Keep Original Text" would lock `current_text` ⚠️ (misleading - not actually original)

---

## Summary of All Text Field References

| Line(s) | Function/Context | Field Used | Label/Purpose | Status |
|---------|------------------|------------|---------------|--------|
| 534 | Badge condition | `locked_text` vs `original_text` | Amended badge | ✅ Correct |
| 550-553 | Card preview | `locked_text` → `current_text` → `original_text` | Preview text | ✅ Correct |
| 575 | Lock notice condition | `locked_text` vs `original_text` | Changes notice | ✅ Correct |
| 589-592 | Full text display | `locked_text` → `current_text` → `original_text` | Section text | ✅ Correct |
| 597 | Diff view condition | `locked_text` vs `original_text` | Show diff button | ✅ Correct |
| 640 | Suggestion form | `current_text` | Pre-fill | ✅ Correct |
| 1145 | Get baseline text | `current_text` | Diff baseline | ❌ **CRITICAL BUG** |
| 1168 | Render suggestions | Uses line 1145 | Suggestion diffs | ❌ Wrong baseline |
| 1186 | "Keep Original" label | None (option value) | User choice | ⚠️ Misleading |
| 1203 | Suggestion diff | Uses line 1168 | Display | ❌ Wrong baseline |
| 1462 | Locked section diff | `original_text` | Diff view | ✅ Correct |
| 1467 | Locked section diff | `locked_text` | Diff view | ✅ Correct |
| 1589 | Rejected suggestion | Uses line 1145 | Display | ❌ Wrong baseline |
| 2200 | Split section check | `current_text` → `original_text` | Validation | ✅ Correct |
| 2363 | Checkbox label | `current_text` | Display | ✅ Correct |

---

## Recommended Fixes

### Fix #1: Correct the Baseline Function (CRITICAL)

**File**: `views/dashboard/document-viewer.ejs`
**Line**: 1145

```javascript
// BEFORE (WRONG):
return data.section.current_text || '';

// AFTER (CORRECT):
return data.section.original_text || '';
```

**Impact**: Fixes all suggestion diff displays to show changes from true baseline

---

### Fix #2: Update "Keep Original Text" Label (RECOMMENDED)

**File**: `views/dashboard/document-viewer.ejs`
**Lines**: 1172-1198

Add logic to show correct label based on section state:

```javascript
// Add before the "Keep Original Text" HTML block (around line 1172)
const sections = <%- JSON.stringify(sections) %>;
const section = sections.find(s => s.id === sectionId);
const isActuallyOriginal = !section ||
  section.current_text === section.original_text ||
  !section.current_text;

const keepLabel = isActuallyOriginal
  ? 'Keep Original Text'
  : 'Keep Current Text (Previously Locked)';
const keepBadge = isActuallyOriginal
  ? 'No Changes'
  : 'Previously Approved';
```

Then update the HTML:
```javascript
<h6 class="mb-2">
  <i class="bi bi-file-text me-2"></i>${keepLabel}
  <span class="badge bg-info ms-2">${keepBadge}</span>
</h6>
```

**Impact**: Clarifies to users what they're actually keeping

---

### Fix #3: Add Visual Indicator for Diff Baseline (OPTIONAL)

**File**: `views/dashboard/document-viewer.ejs`
**Lines**: Around suggestion rendering

Add a small info badge showing diff is against original:

```html
<button class="btn btn-sm btn-outline-secondary"
        onclick="toggleSuggestionTrackChanges('${suggestion.id}', '${sectionId}')">
  <i class="bi bi-eye${showChanges ? '-slash' : ''}"></i>
  ${showChanges ? 'Hide' : 'Show'} Changes
  <span class="badge bg-secondary ms-1" title="Compared to original baseline text">vs Original</span>
</button>
```

**Impact**: Makes it explicit what the diff is comparing against

---

## Testing Checklist

After applying fixes, verify:

- [ ] Unlocked section: suggestions show diff vs `original_text`
- [ ] Locked section: "Show Changes" displays diff vs `original_text`
- [ ] After unlock: suggestions still compare to `original_text` (not `locked_text`)
- [ ] "Keep Original Text" label reflects actual state
- [ ] Multiple lock/unlock cycles maintain correct baseline
- [ ] Database never modifies `original_text` field

---

## Root Cause

The bug appears to be a semantic confusion between:
- "Original text" = initial baseline (database `original_text`)
- "Original text" = text before editing (could be `current_text`)

The function name `getSectionOriginalText()` implies it returns `original_text`, but it was implemented to return `current_text`, likely because someone thought "original" meant "the text that's currently there before any suggestions are applied."

**Correct Interpretation**: "Original" ALWAYS means the immutable baseline in `original_text` column.

---

## Impact Assessment

**Users Affected**: All users viewing suggestions on unlocked sections
**Data Integrity**: No data corruption (only display issue)
**Severity**: HIGH - Confusing UX, users can't see true changes from baseline
**Urgency**: Should fix before production use

---

## Generated: 2025-10-27
## Analyzed File: `/views/dashboard/document-viewer.ejs`
## Total Lines Analyzed: 2500+ lines
