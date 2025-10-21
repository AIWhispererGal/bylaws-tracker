# Quick Test Guide - MVP Workflow Features

## 🚀 Quick Start Testing

### Prerequisites
1. ✅ Server running on http://localhost:3000
2. ✅ Database migration 021 applied
3. ✅ User logged in with admin/owner role
4. ✅ At least one document with workflow assigned

---

## Test 1: Multi-Org Session Storage (2 minutes)

### Steps:
1. **Navigate to**: http://localhost:3000/auth/select
2. **Select**: Any organization from the list
3. **Navigate away**: Go to /dashboard
4. **Return**: http://localhost:3000/auth/select
5. **Verify**: "Last Used" badge appears on previously selected org
6. **Verify**: Organization scrolls into view automatically

### Expected Result:
```
✅ Badge with text "Last Used" appears
✅ Badge has blue background (bg-info)
✅ Previously selected org is highlighted
✅ Page scrolls to that organization
```

### Browser Console Check:
```javascript
// Open DevTools (F12), check localStorage:
localStorage.getItem('lastOrgId')     // Should show UUID
localStorage.getItem('lastOrgName')   // Should show org name
localStorage.getItem('lastOrgTimestamp') // Should show ISO timestamp
```

---

## Test 2: Workflow Progress Indicator (3 minutes)

### Steps:
1. **Navigate to**: Document viewer for any document
2. **Observe**: Workflow progress bar at top
3. **Verify**: Shows "X / Y sections approved (Z%)"
4. **Verify**: Shows "N unmodified sections" below progress bar
5. **Click**: "Refresh Progress" button
6. **Verify**: Progress updates immediately

### Expected Result:
```
✅ Progress bar displays with color:
   - Red (0-49%)
   - Yellow (50-74%)
   - Blue (75-99%)
   - Green (100%)
✅ Text shows correct counts
✅ Unmodified count is accurate
✅ Refresh button works without error
```

---

## Test 3: Approve All Unmodified (5 minutes)

### Setup:
- Use a document with some sections that have suggestions and some that don't

### Steps:
1. **Navigate to**: Document viewer
2. **Check**: "Approve All Unmodified" button
3. **Verify**: Button shows count (e.g., "Approve All Unmodified (7 sections)")
4. **Click**: The button
5. **Confirm**: Dialog asking for confirmation
6. **Wait**: Loading spinner appears
7. **Verify**: Success toast notification
8. **Verify**: Progress bar updates
9. **Verify**: Page reloads with updated states

### Expected Result:
```
✅ Button disabled if 0 unmodified sections
✅ Button enabled if >0 unmodified sections
✅ Count shown in button text
✅ Confirmation dialog appears
✅ Loading state with spinner
✅ Success notification
✅ Progress bar increases
✅ Sections marked as approved
✅ Page reloads automatically
```

### API Response (check Network tab):
```json
{
  "success": true,
  "message": "Approved 7 unmodified section(s)",
  "approvedCount": 7,
  "totalSections": 15
}
```

---

## Test 4: Progress to Next Stage (7 minutes)

### Setup:
- Document must have ALL sections approved (100%)

### Steps to Get 100%:
1. **Navigate to**: Document viewer
2. **Click**: "Approve All Unmodified" first
3. **Manually approve**: Remaining sections with suggestions
4. **Click**: "Refresh Progress" until 100%

### Steps to Progress:
1. **Verify**: Progress bar shows green (100%)
2. **Verify**: "Progress to Next Stage" button is **enabled**
3. **Verify**: Button text says "Ready!"
4. **Click**: The button
5. **Enter**: Optional notes in prompt (or leave blank)
6. **Wait**: Loading spinner with "Creating Version..."
7. **Verify**: Success toast with details:
   - New version number
   - Sections processed
   - Suggestions applied
8. **Verify**: Redirect to /dashboard after 2 seconds

### Expected Result:
```
✅ Button only enabled at 100% approved
✅ Prompt appears for optional notes
✅ Loading state during creation
✅ Success notification with version details
✅ Auto-redirect to dashboard
✅ New version visible in document history
```

### API Response (check Network tab):
```json
{
  "success": true,
  "message": "Document progressed successfully to version 1.2",
  "version": {
    "id": "uuid-here",
    "version_number": "1.2"
  },
  "stats": {
    "sectionsProcessed": 15,
    "suggestionsApplied": 8,
    "fromStage": "Initial Review"
  }
}
```

### Verify in Database:
```sql
-- Check new version was created
SELECT version_number, created_at, applied_suggestions
FROM document_versions
WHERE document_id = 'your-doc-id'
ORDER BY created_at DESC
LIMIT 1;

-- Check suggestions marked as implemented
SELECT id, status, implemented_at, implemented_in_version
FROM suggestions
WHERE document_id = 'your-doc-id'
  AND status = 'implemented';
```

---

## Test 5: Edge Cases (5 minutes)

### Test A: Progress with Unapproved Sections
1. **Setup**: Document with some unapproved sections
2. **Click**: "Progress to Next Stage"
3. **Expected**: Button is disabled
4. **Verify**: Tooltip says "X section(s) pending approval"

### Test B: Approve Unmodified with Zero
1. **Setup**: Document where all sections have suggestions
2. **Verify**: "Approve All Unmodified" button disabled
3. **Verify**: Button shows "(0 sections)"

### Test C: Document with No Workflow
1. **Navigate to**: Document without workflow assigned
2. **Expected**: Graceful error or no workflow UI
3. **Verify**: No crashes

### Test D: Refresh After Changes
1. **Approve**: Some sections
2. **Click**: "Refresh Progress"
3. **Verify**: UI updates without page reload
4. **Verify**: Counts are accurate

### Test E: localStorage Across Sessions
1. **Select**: Organization A
2. **Close**: Browser completely
3. **Reopen**: Browser and navigate to /auth/select
4. **Verify**: Organization A still shows "Last Used"

---

## Quick Validation Commands

### Check localStorage (Browser Console):
```javascript
// View all stored values
Object.keys(localStorage).filter(k => k.startsWith('last')).forEach(k => {
  console.log(k, ':', localStorage.getItem(k));
});
```

### Check API Endpoints (Curl):
```bash
# Get progress status
curl http://localhost:3000/api/workflow/documents/{DOC_ID}/progress-status \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Approve unmodified
curl -X POST http://localhost:3000/api/workflow/documents/{DOC_ID}/approve-unmodified \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"

# Progress workflow
curl -X POST http://localhost:3000/api/workflow/documents/{DOC_ID}/progress \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Test progression"}'
```

### Check Browser Network Tab:
1. Open DevTools (F12)
2. Go to Network tab
3. Perform actions
4. Look for these requests:
   - `GET /api/workflow/documents/{id}/progress-status`
   - `POST /api/workflow/documents/{id}/approve-unmodified`
   - `POST /api/workflow/documents/{id}/progress`

---

## Common Issues & Fixes

### Issue 1: "Progress button stays disabled"
**Cause**: Not all sections approved
**Fix**:
1. Click "Refresh Progress"
2. Check progress percentage
3. Approve remaining sections manually or use "Approve All Unmodified"

### Issue 2: "localStorage not working"
**Cause**: Browser privacy settings or incognito mode
**Fix**:
1. Check browser console for errors
2. Disable private browsing
3. Clear site data and retry

### Issue 3: "Approve unmodified shows 0 but sections exist"
**Cause**: All sections have suggestions
**Fix**:
1. Check if sections actually have suggestions in database
2. Verify suggestion_sections junction table
3. This is expected behavior

### Issue 4: "Version creation fails"
**Cause**: Database migration not applied or RLS issue
**Fix**:
1. Verify migration 021 is applied
2. Check server logs for detailed error
3. Verify user has admin/owner role
4. Check `create_document_version` function exists

### Issue 5: "Progress bar not updating"
**Cause**: JavaScript error or API failure
**Fix**:
1. Open browser console
2. Look for JavaScript errors
3. Check Network tab for failed API calls
4. Click "Refresh Progress" manually

---

## Success Criteria

### ✅ All Features Working:
- [ ] localStorage remembers last organization
- [ ] "Last Used" badge appears and scrolls into view
- [ ] Progress bar shows correct percentage and color
- [ ] Unmodified count is accurate
- [ ] "Approve All Unmodified" button works
- [ ] "Progress to Next Stage" button enables at 100%
- [ ] Version creation succeeds
- [ ] Suggestions marked as implemented
- [ ] Redirect to dashboard after progression
- [ ] No JavaScript console errors
- [ ] No server errors in logs

### ✅ UI/UX Polish:
- [ ] Loading states with spinners
- [ ] Confirmation dialogs
- [ ] Success/error toast notifications
- [ ] Disabled states with helpful tooltips
- [ ] Smooth animations and transitions
- [ ] Responsive layout on mobile
- [ ] Accessible keyboard navigation

---

## Performance Benchmarks

### Expected Response Times:
- **localStorage operations**: < 10ms
- **Progress status API**: < 500ms
- **Approve unmodified API**: < 2s (depends on section count)
- **Progress workflow API**: < 3s (depends on complexity)
- **Page reload**: < 1s

### Test with Large Documents:
1. **50+ sections**: Should still complete in <5s
2. **100+ suggestions**: Pagination should work smoothly
3. **Multiple versions**: History should load quickly

---

## Video Test Scenarios

### Scenario 1: Happy Path (5 min)
1. Login → Select Org → Return → See badge
2. Open document → See progress
3. Click "Approve All Unmodified"
4. Click "Progress to Next Stage"
5. See new version created

### Scenario 2: Edge Cases (3 min)
1. Try to progress without 100%
2. Try to approve when 0 unmodified
3. Refresh progress multiple times
4. Test localStorage persistence

### Scenario 3: Error Handling (2 min)
1. Disconnect network during approval
2. Invalid document ID in URL
3. Try as non-admin user
4. Document without workflow

---

## Final Checklist

Before marking as "TESTED AND READY":

- [ ] All 5 main tests passed
- [ ] All 5 edge cases passed
- [ ] No console errors
- [ ] No server errors
- [ ] API responses are correct
- [ ] Database updates verified
- [ ] localStorage persists correctly
- [ ] UI is responsive
- [ ] Tooltips are helpful
- [ ] Loading states are smooth
- [ ] Success messages are clear
- [ ] Error messages are helpful
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on mobile viewport

---

## Report Issues

If you find any issues:

1. **Screenshot**: Capture the issue
2. **Console Log**: Copy any JavaScript errors
3. **Network Tab**: Export failed request as HAR
4. **Steps to Reproduce**: Write detailed steps
5. **Expected vs Actual**: Describe the difference

Report to: Development team with all above information

---

**Total Testing Time**: ~25 minutes
**Status**: Ready for User Acceptance Testing
