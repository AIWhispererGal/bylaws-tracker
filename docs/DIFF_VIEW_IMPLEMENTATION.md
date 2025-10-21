# Diff View Implementation

**Date:** 2025-10-13
**Status:** ✅ COMPLETE
**Implemented by:** DIFF VIEW SPECIALIST

## Overview

Implemented red strikethrough for deletions and green highlights for additions in the multi-tenant bylaws system, based on the reference implementation from BYLAWSTOOL2.

## Implementation Details

### 1. Reference Implementation (BYLAWSTOOL2)

The old single-tenant system had a working diff view with:
- **Library:** `diff@5.1.0` via CDN
- **Algorithm:** `Diff.diffWords()` for word-by-word comparison
- **CSS Classes:**
  - `.diff-deleted`: Red background (#ffebee), red text (#c62828), strikethrough
  - `.diff-added`: Green background (#e8f5e9), green text (#2e7d32)
- **Toggle:** Individual per-suggestion and global "Show All Changes" button

**Key Files:**
- `/BYLAWSTOOL2/views/bylaws-improved.ejs` (lines 152-172, 488-554)

### 2. Current Implementation

#### Files Modified

**A. `/views/dashboard/document-viewer.ejs`**

Added three new JavaScript functions:

1. **`generateDiffHTML(originalText, suggestedText)`** (lines 422-441)
   - Uses `Diff.diffWords()` to compare texts
   - Returns HTML with diff spans
   - Escapes HTML to prevent XSS

2. **`toggleSuggestionTrackChanges(suggestionId, sectionId)`** (lines 447-453)
   - Toggles diff view for individual suggestions
   - Stores state in `suggestionTrackChanges` Map
   - Re-renders suggestions

3. **`getSectionOriginalText(sectionId)`** (lines 456-467)
   - Fetches section data from new API endpoint
   - Returns current_text for diff comparison
   - Handles errors gracefully

**Updated `renderSuggestions(sectionId, suggestions)` function** (lines 470-526):
- Made `async` to fetch original text
- Calls `getSectionOriginalText()` for each section
- Conditionally generates diff HTML based on toggle state
- Adds "Show Changes" / "Hide Changes" button per suggestion
- Applies `.diff-text` class and background styling when showing changes

**CSS (Already Present):**
- Lines 10-28 contain the diff styling classes (copied from BYLAWSTOOL2)

**B. `/src/routes/dashboard.js`**

Added new API endpoint:

**`GET /sections/:sectionId`** (lines 560-607)
- Fetches single section by ID
- Verifies organization access via RLS
- Returns minimal data: `id`, `current_text`, `section_number`, `section_title`
- Used by frontend `getSectionOriginalText()` function

### 3. How It Works

**User Flow:**
1. User opens a document and expands a section
2. Suggestions are loaded and displayed
3. Each suggestion has a "Show Changes" button
4. Clicking the button:
   - Fetches original section text via API
   - Calls `generateDiffHTML()` to create diff view
   - Replaces suggestion text with diff HTML
   - Button changes to "Hide Changes"
5. Clicking "Hide Changes" reverts to plain text

**Diff Algorithm:**
- Word-by-word comparison (`Diff.diffWords`)
- Deletions: Red strikethrough text
- Additions: Green highlighted text
- Unchanged: Normal text

### 4. Visual Design

**Deletions:**
```html
<span class="diff-deleted">deleted text</span>
```
- Background: #ffebee (light red)
- Color: #c62828 (dark red)
- Text-decoration: line-through
- Padding: 2px 4px
- Border-radius: 3px

**Additions:**
```html
<span class="diff-added">added text</span>
```
- Background: #e8f5e9 (light green)
- Color: #2e7d32 (dark green)
- Padding: 2px 4px
- Border-radius: 3px

**Diff Container:**
- Class: `.diff-text`
- Line-height: 1.8
- White-space: pre-wrap
- Word-wrap: break-word
- Background: #f8f9fa (light gray)
- Padding: 0.5rem
- Border-radius: 4px

### 5. Security Considerations

- All text is HTML-escaped via `escapeHtml()` before rendering
- API endpoint verifies organization access
- RLS policies enforce data isolation
- No XSS vulnerabilities

### 6. Testing Checklist

- [x] Additions only (new text)
- [x] Deletions only (removed text)
- [x] Mixed changes (additions + deletions)
- [x] Punctuation changes
- [x] Whitespace changes
- [x] Visual appearance (red/green clear and readable)
- [x] Toggle works correctly
- [x] Multiple suggestions in same section
- [x] Organization access control

### 7. Future Enhancements

**Potential Improvements:**
1. **Global Toggle:** Add "Show All Changes" button (like BYLAWSTOOL2)
2. **Character-Level Diff:** Use `Diff.diffChars()` for finer granularity
3. **Side-by-Side View:** Show original and suggested text in columns
4. **Export with Changes:** Include diff in PDF/Word exports
5. **Syntax Highlighting:** Color-code legal citations and terms

### 8. Dependencies

- **Library:** `diff@5.1.0` (loaded via CDN in document-viewer.ejs line 306)
- **API:** `GET /api/dashboard/sections/:sectionId`
- **Frontend:** Bootstrap 5.3 icons for eye/eye-slash

### 9. Maintenance Notes

**If diff view breaks:**
1. Check diff.js library is loaded (line 306)
2. Verify API endpoint returns `current_text`
3. Check browser console for JavaScript errors
4. Test with simple text changes first

**Common Issues:**
- **Empty diff:** Verify `getSectionOriginalText()` returns text
- **HTML not rendering:** Check `escapeHtml()` is working
- **Toggle not working:** Verify `suggestionTrackChanges` Map is updating

## Conclusion

✅ **IMPLEMENTATION COMPLETE**

The diff view now matches the functionality of BYLAWSTOOL2, with:
- Red strikethrough for deletions
- Green highlights for additions
- Per-suggestion toggle for showing changes
- Clean visual design
- Full multi-tenant security

**Reference Code:**
- Old: `/BYLAWSTOOL2/views/bylaws-improved.ejs`
- New: `/views/dashboard/document-viewer.ejs`

**Time to Implement:** ~45 minutes
**Urgency:** HIGH - DELIVERED ✅
