# Admin Section Restrictions - Quick Reference

**Quick lookup for Tasks 3.1 and 3.2**

## 🚫 Task 3.1: No Delete for Admins

### What Changed
- **Delete button**: REMOVED from UI for all admins
- **Backend**: Returns 403 if admin tries to delete via API

### Code Locations
```javascript
// Frontend: /views/dashboard/document-viewer.ejs (line 397)
<!-- Delete removed for admins -->

// Backend: /src/routes/admin.js (lines 1122-1130)
if (req.session.isGlobalAdmin || req.session.isAdmin) {
  return res.status(403).json({
    error: 'Administrators cannot delete sections...'
  });
}
```

### Error Response
```json
{
  "success": false,
  "error": "Administrators cannot delete sections. Use editing tools to modify content.",
  "code": "ADMIN_DELETE_FORBIDDEN"
}
```

---

## 🔒 Task 3.2: No Split/Join with Suggestions

### What Changed
- **Split/Join buttons**: Disabled when section has active suggestions
- **Backend**: Validates suggestion count before operation
- **UI**: Shows warning message with suggestion count

### Code Locations

#### Frontend Validation
```javascript
// /views/dashboard/document-viewer.ejs (lines 414-445)
<%
  const activeSuggestions = suggestions.filter(s =>
    s.section_id === section.id && !s.rejected_at
  );
  const hasSuggestions = activeSuggestions.length > 0;
%>
<button ... <%= hasSuggestions ? 'disabled' : '' %>>
  Split
</button>
```

#### Client-side JavaScript Check
```javascript
// splitSection() - lines 1786-1806
const button = event.target.closest('button');
if (button && button.disabled) {
  showToast('Cannot split section with active suggestions...', 'warning');
  return;
}

// Double-check via API
const response = await fetch(`/api/dashboard/suggestions?section_id=${sectionId}`);
```

#### Backend Validation (Split)
```javascript
// /src/routes/admin.js (lines 1457-1483)
const { data: activeSuggestions } = await supabaseService
  .from('suggestions')
  .select('id, author_name')
  .eq('section_id', sectionId)
  .is('rejected_at', null);

if (activeSuggestions && activeSuggestions.length > 0) {
  return res.status(400).json({
    error: 'Cannot split this section...',
    code: 'HAS_ACTIVE_SUGGESTIONS'
  });
}
```

#### Backend Validation (Join)
```javascript
// /src/routes/admin.js (lines 1604-1647)
const { data: activeSuggestions } = await supabaseService
  .from('suggestions')
  .select('id, section_id, author_name')
  .in('section_id', sectionIds)
  .is('rejected_at', null);

if (activeSuggestions && activeSuggestions.length > 0) {
  return res.status(400).json({
    error: 'Cannot join sections...',
    code: 'HAS_ACTIVE_SUGGESTIONS',
    affectedSections: [...]
  });
}
```

### Error Responses

**Split**:
```json
{
  "success": false,
  "error": "Cannot split this section because it has 3 active suggestion(s). Resolve suggestions first.",
  "code": "HAS_ACTIVE_SUGGESTIONS",
  "suggestionCount": 3,
  "suggestions": [
    { "id": "...", "author": "John Doe" }
  ]
}
```

**Join**:
```json
{
  "success": false,
  "error": "Cannot join sections: 5 active suggestion(s) exist across 2 section(s). Resolve all suggestions before joining.",
  "code": "HAS_ACTIVE_SUGGESTIONS",
  "totalSuggestions": 5,
  "affectedSections": [
    { "id": "...", "number": "1", "title": "Section 1", "suggestionCount": 3 },
    { "id": "...", "number": "2", "title": "Section 2", "suggestionCount": 2 }
  ]
}
```

---

## 📋 Testing Checklist

### Task 3.1
- [ ] Global admin sees no delete button
- [ ] Org admin sees no delete button
- [ ] Direct API call returns 403
- [ ] Section remains in database after delete attempt

### Task 3.2
- [ ] Split button disabled when suggestions exist
- [ ] Join button disabled when suggestions exist
- [ ] Warning message shows suggestion count
- [ ] Buttons enabled after suggestions resolved
- [ ] API rejects split with suggestions (400)
- [ ] API rejects join with suggestions (400)

---

## 🎨 UI States

### Split/Join Buttons

**Enabled** (no suggestions):
```html
<button class="btn btn-sm btn-outline-info"
        onclick="splitSection('...')"
        title="Split section into two">
  <i class="bi bi-scissors"></i> Split
</button>
```

**Disabled** (has suggestions):
```html
<button class="btn btn-sm btn-outline-info"
        onclick="splitSection('...')"
        title="Cannot split section with active suggestions"
        disabled
        data-has-suggestions="true">
  <i class="bi bi-scissors"></i> Split
</button>

<small class="text-warning d-block mt-2">
  <i class="bi bi-exclamation-triangle"></i>
  Split/Join disabled: This section has 3 active suggestions.
  Resolve suggestions before splitting or joining.
</small>
```

---

## 🔍 Debugging

### Check Suggestion Count
```sql
SELECT COUNT(*)
FROM suggestions
WHERE section_id = '<section-id>'
  AND rejected_at IS NULL;
```

### Verify Admin Session
```javascript
console.log('isGlobalAdmin:', req.session.isGlobalAdmin);
console.log('isAdmin:', req.session.isAdmin);
```

### Test Button State
```javascript
const button = document.querySelector('[data-section-id="..."]');
console.log('Disabled:', button.disabled);
console.log('Has suggestions:', button.dataset.hasSuggestions);
```

---

## 🚀 Quick Deploy

1. Verify changes:
```bash
git diff views/dashboard/document-viewer.ejs
git diff src/routes/admin.js
```

2. Run tests:
```bash
npm test tests/integration/admin-restrictions.test.js
```

3. Deploy:
```bash
git add -A
git commit -m "feat: Add admin section restrictions (Tasks 3.1, 3.2)"
git push origin main
```

---

## 📞 Quick Help

**Problem**: Delete button still showing
**Fix**: Clear browser cache, check if session has `isGlobalAdmin` or `isAdmin` flags

**Problem**: Split/join buttons remain disabled
**Fix**: Refresh page, verify all suggestions are rejected (check `rejected_at` column)

**Problem**: Backend allows operation but UI prevents it
**Fix**: Check console for errors, verify suggestion count matches between client and server
