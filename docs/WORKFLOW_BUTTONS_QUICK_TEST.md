# Quick Test Guide - Workflow Buttons Fix

**Time Required**: 5-10 minutes
**What We're Testing**: Workflow button visibility and functionality after fixes

---

## ⚡ Quick Start

### 1. Start the Server
```bash
npm start
```

### 2. Open Browser Developer Console
- Chrome/Edge: Press `F12` or `Ctrl+Shift+I`
- Firefox: Press `F12`
- Safari: `Cmd+Option+I`

---

## 🧪 Test Scenarios

### Test 1: Admin/Owner Can See Buttons (CRITICAL)

**Steps**:
1. Login as **org_owner** or **org_admin**
2. Navigate to any document
3. Expand a section (click the section title)
4. **LOOK FOR**: Workflow action buttons should appear

**Expected Result**:
```
✅ Section expands smoothly
✅ Buttons visible: "Lock Section", "Approve", "Reject"
✅ Buttons may be disabled (gray) - that's CORRECT
✅ Console shows: "🎯 [DOCUMENT VIEWER] Document viewer initialized"
✅ NO errors in console
```

**If buttons DON'T appear**:
- Check console for errors
- Look for red error messages
- Copy error text and report back

---

### Test 2: Buttons Enable When Ready

**Steps**:
1. Find a section with suggestions
2. Expand the section
3. Wait 1-2 seconds for state to load
4. **LOOK FOR**: Buttons should become clickable (blue/colored)

**Expected Result**:
```
✅ "Lock Section" button becomes blue/enabled
✅ If section already locked → "Approve"/"Reject" enabled
✅ If section approved → buttons show correct state
```

**Console Output Should Show**:
```
[WORKFLOW] Loading state for section: xxx
[WORKFLOW] State response: { success: true, ... }
```

---

### Test 3: No Console Errors

**What to Look For**:
```
❌ BAD (should NOT see these):
   - "Cannot set properties of null (setting 'disabled')"
   - "updateWorkflowProgress is not defined"
   - "updateSectionWorkflowBadge is not defined"

✅ GOOD (should see these):
   - "🎯 [DOCUMENT VIEWER] Document viewer initialized"
   - "✅ [DOCUMENT VIEWER] Initialization complete"
   - "[WORKFLOW] Loading state for section: xxx"
```

---

### Test 4: Lazy Loading Still Works

**Steps**:
1. Refresh the page
2. Watch the Network tab in DevTools
3. **TIME IT**: Page should load in < 1 second

**Expected Result**:
```
✅ Page loads quickly (no long wait)
✅ Sections collapsed by default
✅ First section auto-expands
✅ Expanding other sections loads their data
```

---

### Test 5: Workflow Actions Work

**Steps** (if you have test data):
1. Expand a section with suggestions
2. Click "Lock Section"
3. Click "Approve" or "Reject"

**Expected Result**:
```
✅ Action completes successfully
✅ Toast notification appears
✅ Section state updates
✅ Progress bar updates
✅ NO console errors
```

---

## 🚨 Common Issues & Solutions

### Issue: Buttons Still Don't Appear

**Possible Causes**:
1. **Browser cache**: Hard refresh (`Ctrl+Shift+R`)
2. **Wrong role**: Check you're logged in as admin/owner
3. **JavaScript error**: Check console for errors

**Quick Fix**:
```bash
# Clear browser cache OR
# Open in Incognito/Private window
```

---

### Issue: "Cannot set properties of null"

**This means**: The fix didn't apply correctly

**Check**:
1. Verify file saved: `views/dashboard/document-viewer.ejs`
2. Restart server: `Ctrl+C` then `npm start`
3. Hard refresh browser: `Ctrl+Shift+R`

---

### Issue: Functions Not Found

**Error**: `refreshWorkflowProgress is not defined`

**This means**: Script loading order issue

**Check**:
1. View page source (`Ctrl+U`)
2. Search for `refreshWorkflowProgress`
3. Should appear in inline `<script>` tag
4. Should be called from DOMContentLoaded

---

## ✅ Success Criteria

All of these should be TRUE:

- [ ] Workflow buttons appear for admin/owner
- [ ] Buttons do NOT appear for viewer/member
- [ ] No "Cannot set properties of null" error
- [ ] No "function is not defined" errors
- [ ] Clicking buttons works (lock/approve/reject)
- [ ] Progress bar updates after actions
- [ ] Page loads quickly (< 1 second)
- [ ] Lazy loading still works

---

## 📊 Test Results Template

**Copy this and fill in your results:**

```
Date: ___________
Tester: ___________
Browser: ___________

Test 1 - Button Visibility:
  Login Role: ___________
  Buttons Appear: YES / NO
  Console Errors: YES / NO

Test 2 - Button Enable:
  Buttons Enable: YES / NO
  Time to Enable: ___ seconds

Test 3 - No Errors:
  Console Clean: YES / NO
  Errors Found: ___________

Test 4 - Lazy Loading:
  Page Load Time: ___ seconds
  Still Fast: YES / NO

Test 5 - Actions Work:
  Lock Works: YES / NO
  Approve Works: YES / NO
  Progress Updates: YES / NO

Overall Status: PASS / FAIL
Notes: ___________
```

---

## 🔧 If All Tests Pass

**Congratulations!** 🎉

The fixes are working. Next steps:
1. Test with different user roles
2. Test with different documents
3. Consider deploying to production

---

## 🐛 If Tests Fail

**Report Back With**:
1. Which test failed
2. Exact error message from console
3. Screenshot of browser console
4. User role you're testing with
5. Browser and version

---

## 🎓 Understanding the Fix

**What Was Wrong**:
- Old function called, never initialized buttons
- Race conditions between duplicate functions
- Script loading order issues

**What We Fixed**:
1. Removed duplicate `updateWorkflowProgress` function
2. Added safety checks to prevent "undefined" errors
3. Merged competing toggle functions
4. Consolidated 4 DOMContentLoaded listeners into 1

**Why This Works**:
- Single source of truth for initialization
- Parallel loading for better performance
- Proper function references with scope checks
- No more race conditions

---

*Quick test guide created 2025-10-20*
