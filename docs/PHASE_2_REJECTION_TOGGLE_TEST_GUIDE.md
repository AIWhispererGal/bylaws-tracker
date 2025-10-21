# Phase 2: Rejection Toggle - Quick Test Guide

## Test Scenarios

### 1. Basic Toggle Functionality

**Test Steps**:
1. Navigate to document viewer with sections
2. Expand a section with suggestions
3. Click "Show Rejected (0)" button
4. Verify:
   - Button changes to "Hide Rejected (X)"
   - Loading spinner appears briefly
   - Rejected suggestions (if any) appear below active suggestions

**Expected Result**:
- Toggle works smoothly
- Count badge updates correctly
- No errors in console

---

### 2. Reject Suggestion

**Test Steps**:
1. Expand section with active suggestions
2. Click "Reject" button on a suggestion
3. Confirm the dialog
4. Verify:
   - Suggestion disappears from active list
   - Toast notification appears
   - "Show Rejected" count increases by 1

**Expected Result**:
- Suggestion hidden immediately
- Count badge updates: active -1, rejected +1

---

### 3. View Rejected Suggestions

**Test Steps**:
1. After rejecting suggestions, click "Show Rejected (X)"
2. Verify rejected suggestions appear with:
   - Red "Rejected" badge
   - Stage information (e.g., "Rejected at Review stage")
   - Rejection metadata (who rejected, when)
   - "Unreject" button (green)
   - No radio button for locking

**Expected Result**:
- All rejected suggestions visible
- Metadata displays correctly
- Clear visual distinction from active suggestions

---

### 4. Unreject Suggestion

**Test Steps**:
1. With rejected suggestions visible, click "Unreject" on one
2. Confirm the dialog
3. Verify:
   - Toast notification appears
   - Suggestions list refreshes
   - Suggestion returns to active list with radio button
   - Rejected count decreases by 1

**Expected Result**:
- Suggestion restored to active status
- Can now be selected for locking
- Rejection metadata removed

---

### 5. Multiple Sections Independence

**Test Steps**:
1. Open document with multiple sections
2. Expand Section A, click "Show Rejected"
3. Expand Section B, verify its toggle is still "Show Rejected"
4. Toggle Section A to hide, verify Section B unchanged

**Expected Result**:
- Each section toggle operates independently
- Showing rejected in one section doesn't affect others

---

### 6. Performance Test

**Test Steps**:
1. Create section with 20+ suggestions
2. Reject 10 suggestions
3. Collapse and re-expand section
4. Measure:
   - Initial load time (should only load 10 active)
   - Click "Show Rejected" (AJAX loads 10 rejected)

**Expected Result**:
- Initial load faster (only active suggestions)
- Rejected load on-demand in <1 second
- Network tab shows separate API calls

---

### 7. Error Handling

**Test Scenarios**:

**A. Network Error**:
1. Disconnect network
2. Try to reject/unreject a suggestion
3. Verify error toast appears

**B. Permission Denied**:
1. Login as user without reject permissions
2. Verify reject/unreject buttons don't appear
3. Or show disabled state

**C. Invalid Suggestion ID**:
1. Manual API test with invalid ID
2. Verify appropriate error message

**Expected Result**:
- User-friendly error messages
- No console errors
- System remains stable

---

## API Testing

### Manual cURL Tests

**1. Reject Suggestion**:
```bash
curl -X POST http://localhost:3000/api/workflow/suggestions/{suggestionId}/reject \
  -H "Content-Type: application/json" \
  -d '{"sectionId": "{sectionId}"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Suggestion rejected successfully",
  "suggestion": {
    "id": "...",
    "rejected_at": "2025-10-17T...",
    "rejected_by": "...",
    "rejected_at_stage_id": "..."
  }
}
```

**2. Unreject Suggestion**:
```bash
curl -X POST http://localhost:3000/api/workflow/suggestions/{suggestionId}/unreject \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Suggestion restored successfully",
  "suggestion": {
    "id": "...",
    "rejected_at": null,
    "rejected_by": null,
    "rejected_at_stage_id": null
  }
}
```

**3. List Rejected Suggestions**:
```bash
curl -X GET "http://localhost:3000/api/workflow/sections/{sectionId}/suggestions?includeRejected=true&status=rejected"
```

**Expected Response**:
```json
{
  "success": true,
  "suggestions": [
    {
      "id": "...",
      "suggested_text": "...",
      "rejected_at": "2025-10-17T...",
      "rejected_by_user": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "rejected_at_stage": {
        "stage_name": "Review"
      }
    }
  ]
}
```

---

## Browser Testing

### Browsers to Test
- ✅ Chrome/Edge (primary)
- ✅ Firefox
- ✅ Safari (if available)
- ✅ Mobile browsers (responsive check)

### Console Checks
- No JavaScript errors
- Network requests succeed (200/201 status)
- Toast notifications work
- Modals display correctly

---

## Database Verification

**After rejecting a suggestion, check database**:

```sql
-- Verify rejection columns populated
SELECT
  id,
  suggested_text,
  rejected_at,
  rejected_by,
  rejected_at_stage_id,
  created_at
FROM document_suggestions
WHERE rejected_at IS NOT NULL
ORDER BY rejected_at DESC
LIMIT 10;
```

**Expected**:
- `rejected_at`: timestamp
- `rejected_by`: user UUID
- `rejected_at_stage_id`: stage UUID

**After unrejecting**:
```sql
-- Verify rejection columns cleared
SELECT
  id,
  rejected_at,
  rejected_by,
  rejected_at_stage_id
FROM document_suggestions
WHERE id = '{suggestionId}';
```

**Expected**:
- All rejection columns: `NULL`

---

## Edge Cases

### 1. Section with 0 Suggestions
- Toggle button shows "(0)"
- Clicking shows empty state
- No errors

### 2. Section with Only Rejected Suggestions
- Initial load shows empty state
- Toggle loads all suggestions
- Count reflects correct number

### 3. Rapid Toggle Clicks
- Button disables during AJAX
- No duplicate requests
- State remains consistent

### 4. Reject While Toggle is Open
- Suggestion hides immediately
- Count updates correctly
- No need to re-toggle

---

## Success Criteria

✅ **UI/UX**:
- Toggle button visible and functional
- Rejected suggestions hidden by default
- On-demand loading works smoothly
- Visual distinction between active/rejected

✅ **Functionality**:
- Reject/unreject operations succeed
- Counts update accurately
- Per-section independence maintained

✅ **Performance**:
- Initial load faster (no rejected suggestions)
- AJAX loads rejected in <1 second
- No unnecessary API calls

✅ **Error Handling**:
- Graceful error messages
- No console errors
- System stability maintained

---

## Rollback Plan

If issues arise:

1. **Frontend Only**: Revert document-viewer.ejs changes
2. **Backend Issues**: Migrations 018/019 already applied (safe)
3. **API Errors**: Check workflow.js endpoint implementation

**Files to Revert** (if needed):
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs`

**Safe to Keep**:
- Database migrations (backward compatible)
- Backend API endpoints (optional feature)

---

## Deployment Checklist

Before production:

- [ ] All test scenarios pass
- [ ] Browser testing complete
- [ ] Database verification successful
- [ ] Performance benchmarks met
- [ ] Error handling validated
- [ ] User documentation updated
- [ ] Stakeholder demo complete

---

**Status**: Ready for Testing
**Estimated Test Time**: 30-45 minutes
**Blocker Issues**: None
