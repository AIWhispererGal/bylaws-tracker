# Phase 2: Section Refresh Testing Guide

**Quick reference for testing the auto-refresh feature**

---

## Quick Test Steps

### Test 1: Basic Lock and Refresh
1. Navigate to a document with sections
2. Click a section to expand it
3. Select a suggestion (radio button)
4. Click "Lock Selected Suggestion"
5. **Expected:**
   - Yellow flash animation on section
   - Section auto-scrolls into view
   - "Locked" badge appears in header
   - Lock button becomes disabled
   - Approve button appears (if you have permission)
   - Selected suggestion is highlighted with blue border
   - All radio buttons are disabled
   - Alert box appears with lock timestamp

### Test 2: Lock "Keep Original Text"
1. Expand a section
2. Select the "Keep Original Text" radio button (first option)
3. Click "Lock Selected Suggestion"
4. **Expected:**
   - Same refresh behavior as Test 1
   - "Keep Original Text" option is highlighted
   - Alert shows "Original text locked without changes"
   - NO "Amended" badge appears

### Test 3: Lock with Text Changes
1. Expand a section
2. Select a suggestion that differs from original text
3. Click "Lock Selected Suggestion"
4. **Expected:**
   - "Locked" badge appears
   - "Amended" badge appears (green)
   - Section text updates to show locked version
   - Alert shows "Show Changes" button
   - Clicking "Show Changes" displays diff view

### Test 4: Visual Feedback
Watch for these animations:
- Brief yellow highlight on section (2 seconds)
- Smooth scroll to section
- Smooth transitions on all updates
- No flickering or jumps

### Test 5: Error Handling
1. Expand a section
2. Don't select any suggestion
3. Click "Lock Selected Suggestion"
4. **Expected:** Warning toast: "Please select a suggestion to lock"
5. Section should NOT update

---

## Browser Testing

Test in these browsers:
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browser

---

## Console Checks

Open browser DevTools console and verify:
- No JavaScript errors
- Log message: `[LOCK] Error:` should NOT appear on success
- Functions are exported to window object

```javascript
// Test in console:
typeof window.refreshSectionAfterLock === 'function'  // Should be true
```

---

## Visual Inspection

After locking, verify these UI elements updated:

**Section Header:**
- [ ] "Locked" badge (blue)
- [ ] "Amended" badge (green, if text changed)

**Section Content:**
- [ ] Text shows locked version
- [ ] Alert box appears with timestamp

**Suggestions List:**
- [ ] All radio buttons disabled
- [ ] Selected suggestion highlighted
- [ ] Info alert at top of list

**Workflow Actions:**
- [ ] Lock button disabled (grey)
- [ ] Approve button enabled (green, if permitted)
- [ ] Help text shows "Section is locked and ready for approval"

**Workflow Status:**
- [ ] Progress bar updates
- [ ] Status badge shows locked state

---

## Performance Check

- [ ] Updates happen instantly (<100ms)
- [ ] No page reload required
- [ ] No additional API calls after lock
- [ ] Smooth animations (60 FPS)

---

## Accessibility Check

- [ ] Badges have icons AND text
- [ ] Buttons have clear labels
- [ ] Disabled elements are visually distinct
- [ ] Focus order remains logical
- [ ] Screen reader announces changes (if testing with screen reader)

---

## Edge Cases

### Already Locked Section
1. Try to lock an already-locked section
2. **Expected:** Lock button should already be disabled

### Permission Denied
1. Log in as view-only user
2. Try to lock a section
3. **Expected:** Lock button shouldn't appear

### Network Error
1. Disconnect network
2. Try to lock a section
3. **Expected:** Error toast appears, section doesn't update

---

## Regression Testing

Ensure existing features still work:

- [ ] Approve section still works
- [ ] Reject section still works
- [ ] Unlock section still works (admins)
- [ ] View approval history still works
- [ ] Add suggestion still works
- [ ] Show/hide changes still works

---

## Known Limitations

✅ **Acceptable (per user requirements):**
- Only user who locked sees the refresh
- Other users need to reload page
- No WebSocket/real-time updates

❌ **Not acceptable (report as bug):**
- Page reloads after lock
- JavaScript errors in console
- UI elements don't update
- Animations cause flickering
- Performance issues

---

## Reporting Issues

If you find a bug, report:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (screenshot)
5. Network tab (API response)

---

## Success Criteria

✅ All tests pass
✅ No console errors
✅ Smooth animations
✅ Works in all browsers
✅ No performance issues
✅ Accessible to all users

---

**Testing completed by:** _________________
**Date:** _________________
**Issues found:** _________________
