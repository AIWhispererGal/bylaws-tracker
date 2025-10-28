# Changed Sections Only Export Feature

**Date:** 2025-10-28
**Agent:** Coder (Hive Mind Swarm)
**Status:** ✅ COMPLETE

## Overview

Added a new export option to allow users to export **only the sections that have been modified** (where `current_text` differs from `original_text`), in addition to the existing full document export.

## User Request

> "ANOTHER export option that exports ONLY the sections that have been changed (where current_text differs from original_text)."

## Implementation Approach

**Selected:** Option 2 - Query Parameter (RECOMMENDED)

### Why Query Parameter?
- ✅ Reuses existing export endpoint
- ✅ Cleaner API design
- ✅ Easy to extend with more filters later (`?locked=true`, `?depth=2`, etc.)
- ✅ Single source of truth for export logic

## Changes Made

### 1. Backend: `/src/routes/dashboard.js`

**Route:** `GET /dashboard/documents/:documentId/export`

**Added Query Parameter Support:**
```javascript
// Filter for changed sections only if requested
let filteredSections = sections || [];
const changedOnly = req.query.changed === 'true';

if (changedOnly) {
  filteredSections = filteredSections.filter(section =>
    section.original_text !== section.current_text
  );
  console.log('[EXPORT] Filtered to changed sections only:', filteredSections.length);
}
```

**Enhanced Metadata:**
```javascript
metadata: {
  totalSections: filteredSections.length,
  originalTotalSections: sections?.length || 0,  // NEW: Original count
  changedOnly: changedOnly,                       // NEW: Export type flag
  exportFormat: 'json',
  exportVersion: '1.0',
  organizationId: orgId
}
```

**Dynamic Filename:**
```javascript
const filename = changedOnly
  ? `${sanitizedTitle}_changes_${dateStr}.json`
  : `${sanitizedTitle}_${dateStr}.json`;
```

### 2. Frontend: `/views/dashboard/document-viewer.ejs`

**Added Second Export Button:**
```html
<button id="export-document-btn" class="btn btn-outline-light me-2"
        title="Export complete document as JSON">
  <i class="bi bi-download me-1"></i>Export Full
</button>
<button id="export-changed-btn" class="btn btn-outline-warning me-2"
        title="Export only changed sections as JSON">
  <i class="bi bi-file-earmark-diff me-1"></i>Export Changes
</button>
```

**Refactored JavaScript:**
- Created reusable `exportDocument(changedOnly, button)` function
- Attached event listeners to both buttons
- Added special handling for zero changed sections
- Enhanced success messages with section counts

**Smart Empty Detection:**
```javascript
// Check if changed-only export returned no sections
if (changedOnly && jsonData.sections.length === 0) {
  showToast('No changed sections found. All sections match original text.', 'info');
  return;
}
```

## API Usage

### Full Export (existing)
```bash
GET /dashboard/documents/:documentId/export
```

### Changed Sections Only (new)
```bash
GET /dashboard/documents/:documentId/export?changed=true
```

## Export JSON Structure

Both exports use the same structure, just different section counts:

```json
{
  "document": {
    "id": "uuid",
    "title": "Document Title",
    "exportDate": "2025-10-28T...",
    "exportedBy": "user@example.com",
    "version": "1.0"
  },
  "metadata": {
    "totalSections": 5,              // Sections in this export
    "originalTotalSections": 100,     // Total sections in document
    "changedOnly": true,              // Whether filtered to changes
    "exportFormat": "json",
    "exportVersion": "1.0"
  },
  "sections": [
    {
      "id": "uuid",
      "number": "3.1.2",
      "title": "Section Title",
      "originalText": "Original content",
      "currentText": "Modified content",  // Different from originalText
      "isLocked": false,
      // ... other fields
    }
  ]
}
```

## Filenames

- **Full Export:** `document_title_2025-10-28.json`
- **Changed Only:** `document_title_changes_2025-10-28.json`

## User Experience

### Before
- Single "Export JSON" button
- Always exports all sections (even unchanged ones)
- Large JSON files for documents with many sections

### After
- **"Export Full"** - Downloads complete document (all sections)
- **"Export Changes"** - Downloads only modified sections
- Smaller, focused JSON files when only some sections changed
- Toast notification shows section count: "Exported 5 changed section(s) successfully!"
- Info message if no changes detected

## Edge Cases Handled

1. **No Changed Sections:**
   - Shows info toast: "No changed sections found. All sections match original text."
   - Does not trigger download

2. **All Sections Changed:**
   - Both buttons download same content
   - User sees different filenames to distinguish export type

3. **Null/Empty Text Fields:**
   - Filter handles null comparisons correctly
   - Original code already handles empty text fields

## Testing Checklist

- [ ] Navigate to document viewer
- [ ] Click "Export Full" - verify all sections included
- [ ] Make changes to SOME sections (not all)
- [ ] Click "Export Changes" - verify only modified sections included
- [ ] Verify `original_text != current_text` for all included sections
- [ ] Check filename suffix (`_changes_`)
- [ ] Test with document where no sections are changed
- [ ] Verify metadata fields are correct

## Swarm Coordination

```bash
# Pre-task
npx claude-flow@alpha hooks pre-task --description "Add changed sections export feature"

# Post-edit (backend)
npx claude-flow@alpha hooks post-edit \
  --file "src/routes/dashboard.js" \
  --memory-key "hive/coder/changed-sections-export-backend"

# Post-edit (frontend)
npx claude-flow@alpha hooks post-edit \
  --file "views/dashboard/document-viewer.ejs" \
  --memory-key "hive/coder/changed-sections-export-frontend"

# Post-task
npx claude-flow@alpha hooks post-task --task-id "changed-export-complete"
```

## Files Modified

1. `/src/routes/dashboard.js` - Backend filtering logic
2. `/views/dashboard/document-viewer.ejs` - UI buttons and JavaScript

## Future Enhancements

This query parameter approach makes it easy to add more filters:

- `?locked=true` - Export only locked sections
- `?depth=2` - Export sections at specific depth
- `?status=approved` - Export by workflow status
- `?search=keyword` - Export matching sections
- Combine filters: `?changed=true&locked=true`

## Benefits

1. **Targeted Exports** - Focus on what changed
2. **Smaller Files** - Easier to share and review
3. **Better UX** - Clear button labels with icons
4. **Extensible** - Easy to add more export filters
5. **Performance** - Filter happens server-side
6. **Backward Compatible** - Existing export still works

## Success Metrics

- ✅ Feature implemented in 1 session
- ✅ Zero breaking changes to existing export
- ✅ Reuses existing code (DRY principle)
- ✅ Smart UX (shows section counts, handles empty results)
- ✅ Proper error handling and user feedback

---

**Priority:** HIGH - User requested immediately
**Complexity:** LOW - Query parameter + filter logic
**Risk:** VERY LOW - No database changes, additive only
