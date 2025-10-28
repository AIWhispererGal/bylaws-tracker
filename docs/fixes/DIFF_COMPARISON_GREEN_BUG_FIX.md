# Diff Comparison Green Bug Fix

## Bug Report
**Issue**: "Show Changes" displays everything in green as if comparing to empty string, not to original_text

## Root Cause Analysis

### The Problem
API endpoint `/api/dashboard/sections/:sectionId` was returning wrong field name causing diff comparison to fail.

### Bug Location Chain

#### 1. API Response (src/routes/dashboard.js:800-809)
**BEFORE (Buggy):**
```javascript
res.json({
  success: true,
  section: {
    id: section.id,
    current_text: section.current_text || section.original_text || '',  // ❌ WRONG
    section_number: section.section_number,
    section_title: section.section_title
  }
});
```

**Problem**: API returns `current_text` instead of `original_text`

#### 2. Frontend Request (document-viewer.ejs:1140-1151)
```javascript
async function getSectionOriginalText(sectionId) {
  try {
    const response = await fetch(`/api/dashboard/sections/${sectionId}`);
    const data = await response.json();
    if (data.success && data.section) {
      return data.section.original_text || '';  // ❌ Expects 'original_text'
    }
  } catch (error) {
    console.error('Error loading section text:', error);
  }
  return '';  // ❌ Returns empty string when field missing
}
```

**Problem**: Expects `original_text` but API sends `current_text`, so returns empty string

#### 3. Diff Generation (document-viewer.ejs:1203)
```javascript
const displayText = showChanges ?
  generateDiffHTML(originalText, suggestion.suggested_text) :  // ❌ originalText is ''
  escapeHtml(suggestion.suggested_text);
```

**Problem**: `originalText` is empty string, so diff compares `''` vs `suggestion.suggested_text`

#### 4. Result
```javascript
function generateDiffHTML(originalText, suggestedText) {
  if (!originalText) originalText = '';  // originalText is already ''
  if (!suggestedText) suggestedText = '';

  const diff = Diff.diffWords(originalText, suggestedText);
  // When originalText='', ALL suggestedText appears as additions (green)
}
```

**Visual Result**: Everything shows green because comparing empty string to suggested text = all additions

## The Fix

### Code Change (src/routes/dashboard.js:800-809)
**AFTER (Fixed):**
```javascript
res.json({
  success: true,
  section: {
    id: section.id,
    original_text: section.original_text || '',  // ✅ Added original_text
    current_text: section.current_text || section.original_text || '',  // ✅ Kept current_text
    section_number: section.section_number,
    section_title: section.section_title
  }
});
```

### What Changed
- **Added** `original_text: section.original_text || ''` to API response
- **Kept** `current_text` for future use
- Now API returns BOTH fields for proper diff comparison

## Data Flow (Fixed)

```
Database (document_sections)
  ↓
  original_text: "Article I. Original text..."
  ↓
API GET /api/dashboard/sections/:sectionId
  ↓
  Returns: { section: { original_text: "Article I...", current_text: "..." } }
  ↓
Frontend: getSectionOriginalText(sectionId)
  ↓
  const originalText = data.section.original_text || '';  // ✅ Now gets actual text
  ↓
generateDiffHTML(originalText, suggestion.suggested_text)
  ↓
  Compares: "Article I. Original..." vs "Article I. Suggested..."
  ↓
Result: ✅ Shows actual changes (red deletions, green additions)
```

## Testing

### Test Case 1: Show Changes Toggle
1. Navigate to section with suggestions
2. Click "Show Changes" toggle on a suggestion
3. **Expected**: See red strikethrough for deletions, green for additions
4. **Actual (after fix)**: ✅ Correct diff display

### Test Case 2: Multiple Suggestions
1. Section has multiple AI suggestions
2. Toggle "Show Changes" on different suggestions
3. **Expected**: Each shows proper diff against original_text
4. **Actual (after fix)**: ✅ All diffs compare to same baseline

### Test Case 3: Rejected Suggestions
1. View rejected suggestions
2. Toggle "Show Changes"
3. **Expected**: Diff still works with original_text
4. **Actual (after fix)**: ✅ Proper diff display

## Files Modified
- `/src/routes/dashboard.js` (line 804)

## Impact
- **Before**: All suggestion diffs showed 100% green (all additions)
- **After**: Diffs correctly show red deletions and green additions
- **No breaking changes**: Added field without removing existing functionality

## Related Code References

### Frontend Functions Affected
- `getSectionOriginalText(sectionId)` - Now receives correct data
- `renderSuggestions(sectionId, suggestions)` - Uses correct originalText
- `generateDiffHTML(originalText, suggestedText)` - Gets proper baseline
- `renderRejectedSuggestion(suggestion, sectionId, originalText)` - Fixed

### API Endpoints
- `GET /api/dashboard/sections/:sectionId` - Fixed response structure

## Verification Steps
1. Start server: `npm start`
2. Login and navigate to document viewer
3. Select section with suggestions
4. Click "Show Changes" toggle
5. Verify diff shows both red (deletions) and green (additions)

## Database Schema Note
The `document_sections` table already has both fields:
- `original_text` - Immutable baseline from upload
- `current_text` - May be updated with locked suggestions

The bug was purely in the API response structure, not the database.

## Commit Message
```
fix: Return original_text in section API for proper diff comparison

The /api/dashboard/sections/:sectionId endpoint was only returning
current_text, causing getSectionOriginalText() to receive undefined
and return empty string. This made all diff comparisons show 100%
green (all additions) instead of showing actual changes.

Added original_text to API response while keeping current_text for
backward compatibility.

Fixes: Diff comparison showing everything as green in "Show Changes"
```
