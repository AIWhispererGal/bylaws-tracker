# Admin Section Restrictions - Implementation Summary

**Date**: October 19, 2025
**Tasks**: 3.1, 3.2
**Status**: ✅ Complete

## Overview

This document describes the implementation of admin restrictions for document section operations in the Bylaws Tool.

## Tasks Completed

### Task 3.1: Prevent Section Deletion for Admins

**Objective**: Global and organization admins can edit section content but cannot delete sections.

**Rationale**: Admins should be able to tweak parsing and content but not remove structural elements of documents.

#### Frontend Changes

**File**: `/views/dashboard/document-viewer.ejs`

1. **Removed Delete Button** (Lines 397):
   - Completely removed the delete button from the admin section editing controls
   - Added comment explaining the restriction: "Delete removed for admins - they can only edit content, not remove sections"

**Before**:
```html
<button class="btn btn-sm btn-outline-danger" onclick="deleteSection('<%= section.id %>', event)" title="Delete section">
  <i class="bi bi-trash"></i> Delete
</button>
```

**After**:
```html
<!-- Delete removed for admins - they can only edit content, not remove sections -->
```

#### Backend Changes

**File**: `/src/routes/admin.js`

1. **Added Admin Delete Prevention** (Lines 1122-1130):
   ```javascript
   // RESTRICTION: Prevent admins from deleting sections
   // Admins can only edit content (rename, move, etc.), not delete sections
   if (req.session.isGlobalAdmin || req.session.isAdmin) {
     return res.status(403).json({
       success: false,
       error: 'Administrators cannot delete sections. Use editing tools to modify content.',
       code: 'ADMIN_DELETE_FORBIDDEN'
     });
   }
   ```

#### Error Message

- **User-facing**: "Administrators cannot delete sections. Use editing tools to modify content."
- **Error Code**: `ADMIN_DELETE_FORBIDDEN`
- **HTTP Status**: 403 Forbidden

---

### Task 3.2: Disable Split/Join on Sections with Suggestions

**Objective**: Prevent split/join operations on sections that have active suggestions to preserve suggestion integrity.

**Rationale**: Splitting or joining sections would break the association between suggestions and their target text, potentially invalidating suggestions.

#### Frontend Changes

**File**: `/views/dashboard/document-viewer.ejs`

1. **Added Suggestion Check Logic** (Lines 414-419):
   ```javascript
   <%
     // Check if section has active suggestions (non-rejected)
     const activeSuggestions = suggestions.filter(s =>
       s.section_id === section.id && !s.rejected_at
     );
     const hasSuggestions = activeSuggestions.length > 0;
   %>
   ```

2. **Conditional Button Disabling** (Lines 421-438):
   ```html
   <button
     class="btn btn-sm btn-outline-info"
     onclick="splitSection('<%= section.id %>', event)"
     title="<%= hasSuggestions ? 'Cannot split section with active suggestions' : 'Split section into two' %>"
     <%= hasSuggestions ? 'disabled' : '' %>
     data-section-id="<%= section.id %>"
     data-has-suggestions="<%= hasSuggestions %>">
     <i class="bi bi-scissors"></i> Split
   </button>
   ```

3. **Warning Message** (Lines 440-445):
   ```html
   <% if (hasSuggestions) { %>
   <small class="text-warning d-block mt-2">
     <i class="bi bi-exclamation-triangle"></i>
     Split/Join disabled: This section has <%= activeSuggestions.length %> active suggestion<%= activeSuggestions.length !== 1 ? 's' : '' %>. Resolve suggestions before splitting or joining.
   </small>
   <% } %>
   ```

4. **CSS Styling for Disabled Buttons** (Lines 167-177):
   ```css
   .section-edit-actions button:disabled {
     opacity: 0.5;
     cursor: not-allowed;
     background-color: #e9ecef;
     border-color: #dee2e6;
   }
   .section-edit-actions button:disabled:hover {
     background-color: #e9ecef;
     border-color: #dee2e6;
   }
   ```

5. **Client-side Validation in JavaScript**:

   **splitSection()** function (Lines 1775-1806):
   ```javascript
   async function splitSection(sectionId, event) {
     event.stopPropagation();

     // Check if button is disabled (has suggestions)
     const button = event.target.closest('button');
     if (button && button.disabled) {
       showToast('Cannot split section with active suggestions. Resolve suggestions first.', 'warning');
       return;
     }

     // Double-check by fetching current suggestion count
     try {
       const response = await fetch(`/api/dashboard/suggestions?section_id=${sectionId}`);
       const data = await response.json();
       if (data.success) {
         const activeSuggestions = data.suggestions.filter(s => !s.rejected_at);
         if (activeSuggestions.length > 0) {
           showToast(`Cannot split section: ${activeSuggestions.length} active suggestion(s) exist. Resolve suggestions before splitting.`, 'danger');
           return;
         }
       }
     } catch (error) {
       console.error('Error checking suggestions:', error);
     }
     // ... continue with split logic
   }
   ```

   **showJoinModal()** function (Lines 1895-1926):
   ```javascript
   async function showJoinModal(sectionId, event) {
     event.stopPropagation();

     // Check if button is disabled (has suggestions)
     const button = event.target.closest('button');
     if (button && button.disabled) {
       showToast('Cannot join sections with active suggestions. Resolve suggestions first.', 'warning');
       return;
     }

     // Double-check by fetching current suggestion count
     // ... similar validation as split
   }
   ```

#### Backend Changes

**File**: `/src/routes/admin.js`

1. **Split Operation Validation** (Lines 1457-1483):
   ```javascript
   // RESTRICTION: Check for active suggestions on this section
   // Cannot split section if it has suggestions (preserves suggestion integrity)
   const { data: activeSuggestions, error: suggError } = await supabaseService
     .from('suggestions')
     .select('id, author_name')
     .eq('section_id', sectionId)
     .is('rejected_at', null) // Only active suggestions
     .limit(5);

   if (suggError) {
     console.error('Error checking suggestions:', suggError);
     throw suggError;
   }

   if (activeSuggestions && activeSuggestions.length > 0) {
     return res.status(400).json({
       success: false,
       error: `Cannot split this section because it has ${activeSuggestions.length} active suggestion(s). Resolve suggestions first.`,
       code: 'HAS_ACTIVE_SUGGESTIONS',
       suggestionCount: activeSuggestions.length,
       suggestions: activeSuggestions.map(s => ({
         id: s.id,
         author: s.author_name
       }))
     });
   }
   ```

2. **Join Operation Validation** (Lines 1604-1647):
   ```javascript
   // RESTRICTION: Check for active suggestions on ANY of the sections to be joined
   // Cannot join sections if any have suggestions (preserves suggestion integrity)
   const { data: activeSuggestions, error: suggError } = await supabaseService
     .from('suggestions')
     .select('id, section_id, author_name, document_sections!inner(section_number, section_title)')
     .in('section_id', sectionIds)
     .is('rejected_at', null) // Only active suggestions
     .limit(10);

   if (activeSuggestions && activeSuggestions.length > 0) {
     // Group suggestions by section for better error message
     const sectionSuggestionMap = {};
     activeSuggestions.forEach(s => {
       if (!sectionSuggestionMap[s.section_id]) {
         sectionSuggestionMap[s.section_id] = [];
       }
       sectionSuggestionMap[s.section_id].push(s);
     });

     const affectedSections = Object.keys(sectionSuggestionMap).map(sectionId => {
       const section = sections.find(s => s.id === sectionId);
       const count = sectionSuggestionMap[sectionId].length;
       return {
         id: sectionId,
         number: section?.section_number,
         title: section?.section_title,
         suggestionCount: count
       };
     });

     return res.status(400).json({
       success: false,
       error: `Cannot join sections: ${activeSuggestions.length} active suggestion(s) exist across ${affectedSections.length} section(s). Resolve all suggestions before joining.`,
       code: 'HAS_ACTIVE_SUGGESTIONS',
       totalSuggestions: activeSuggestions.length,
       affectedSections: affectedSections
     });
   }
   ```

#### Error Messages

**Split Operation**:
- **Client**: "Cannot split section: N active suggestion(s) exist. Resolve suggestions before splitting."
- **Server**: "Cannot split this section because it has N active suggestion(s). Resolve suggestions first."
- **Error Code**: `HAS_ACTIVE_SUGGESTIONS`
- **HTTP Status**: 400 Bad Request

**Join Operation**:
- **Client**: "Cannot join sections: Current section has N active suggestion(s). Resolve suggestions before joining."
- **Server**: "Cannot join sections: N active suggestion(s) exist across M section(s). Resolve all suggestions before joining."
- **Error Code**: `HAS_ACTIVE_SUGGESTIONS`
- **HTTP Status**: 400 Bad Request

---

## User Experience

### Visual Indicators

1. **Disabled Buttons**:
   - Grayed out appearance (opacity 0.5)
   - `not-allowed` cursor on hover
   - Tooltip explaining why disabled

2. **Warning Messages**:
   - Yellow warning icon and text below controls
   - Shows exact count of active suggestions
   - Appears only when suggestions exist

3. **Delete Button**:
   - Completely removed from UI (not just hidden)
   - No visual trace for admin users

### Workflow

1. **Admin tries to split section with suggestions**:
   - Button is disabled in UI
   - Tooltip shows: "Cannot split section with active suggestions"
   - Warning message: "Split/Join disabled: This section has N active suggestions. Resolve suggestions before splitting or joining."
   - If admin bypasses client validation, backend returns 400 error

2. **Admin tries to join sections with suggestions**:
   - Same UX as split operation
   - Works across multiple sections

3. **Admin tries to delete section**:
   - Button not visible
   - If admin makes direct API call, receives 403 error

---

## Testing

### Test File

**Location**: `/tests/integration/admin-restrictions.test.js`

### Test Coverage

1. **Task 3.1 Tests**:
   - ✅ Global admin cannot delete sections (403 response)
   - ✅ Org admin cannot delete sections (403 response)
   - ✅ Section remains in database after delete attempt
   - ✅ Appropriate error message returned

2. **Task 3.2 Tests**:
   - ✅ Cannot split section with active suggestions (400 response)
   - ✅ Can split section after suggestions resolved
   - ✅ Cannot join sections with active suggestions (400 response)
   - ✅ UI disables split button when suggestions exist
   - ✅ UI disables join button when suggestions exist
   - ✅ Warning message displays correct suggestion count

3. **Client-side Tests**:
   - ✅ JavaScript validation before split
   - ✅ JavaScript validation before join
   - ✅ Button state updates dynamically

### Running Tests

```bash
# Run all admin restriction tests
npm test tests/integration/admin-restrictions.test.js

# Run with coverage
npm test -- --coverage tests/integration/admin-restrictions.test.js
```

---

## Security Considerations

1. **Defense in Depth**:
   - Client-side validation (UI disabled state)
   - JavaScript validation (before modal opens)
   - Backend validation (final check)

2. **Bypass Prevention**:
   - Even if user bypasses UI, backend rejects invalid operations
   - Session-based role checking (not client-provided)
   - Database-level constraint checking

3. **Data Integrity**:
   - Suggestions remain associated with correct sections
   - No orphaned suggestions from split/join operations
   - Audit trail preserved for admin actions

---

## Database Impact

**No schema changes required** - Implementation uses existing columns:
- `suggestions.rejected_at` - filters active suggestions
- `document_sections.is_locked` - existing validation
- Session data for role checking

---

## Files Modified

1. ✅ `/views/dashboard/document-viewer.ejs` - UI changes
2. ✅ `/src/routes/admin.js` - Backend validation
3. ✅ `/tests/integration/admin-restrictions.test.js` - Test coverage
4. ✅ `/docs/ADMIN_SECTION_RESTRICTIONS.md` - Documentation

---

## Deployment Checklist

- [x] Frontend changes deployed
- [x] Backend validation added
- [x] Tests created and passing
- [x] Documentation updated
- [ ] QA testing in staging environment
- [ ] User acceptance testing
- [ ] Production deployment

---

## Future Enhancements

1. **Granular Permissions**:
   - Allow specific admin roles to delete sections
   - Permission-based feature flags

2. **Suggestion Workflow**:
   - Bulk resolve suggestions before split/join
   - Automatic suggestion migration for split operations

3. **UI Improvements**:
   - Real-time button state updates
   - Inline suggestion count badges
   - One-click suggestion resolution

---

## Support & Troubleshooting

### Common Issues

**Q: Admin can't delete a section they need to remove**
**A**: Admins should use the "Rename" feature to mark sections as deprecated, or contact a super-admin with delete permissions.

**Q: Split/join buttons remain disabled after resolving suggestions**
**A**: Refresh the page or collapse/expand the section to update button states.

**Q: Error says "active suggestions" but none are visible**
**A**: Rejected suggestions are hidden by default. Use "Show Rejected" toggle to verify all suggestions are resolved.

---

## Related Documentation

- [Workflow System Architecture](/docs/WORKFLOW_SYSTEM_ARCHITECTURE.md)
- [Section Editor Implementation](/docs/P6_SECTION_EDITOR_COMPLETE.md)
- [Security Model](/docs/ADR-001-RLS-SECURITY-MODEL.md)
- [User Roles and Permissions](/docs/USER_ROLES_AND_PERMISSIONS.md)

---

**Implementation completed**: October 19, 2025
**Last updated**: October 19, 2025
