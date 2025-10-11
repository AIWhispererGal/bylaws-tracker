# Document-Type Bug Fix - Testing Guide

## ✅ Fix Applied

**Date:** 2025-10-07
**Issue:** Document-type selection screen not clickable
**Root Cause:** Duplicate JavaScript initialization
**Fix:** Removed redundant inline `<script>` block from `document-type.ejs`

---

## 🧪 How to Test the Fix

### Step 1: Restart the Server

```bash
# Stop the current server (Ctrl+C if running)
# Then restart:
npm start
```

### Step 2: Navigate to Document-Type Screen

1. Open browser to `http://localhost:3000/setup/organization`
2. Fill out organization form (or skip if already done)
3. Click "Continue" to reach document-type screen
4. **OR** directly navigate to `http://localhost:3000/setup/document-type`

### Step 3: Test Card Clicking

**Test A: Click Article-Section Card**
- ✅ Card should highlight with purple border
- ✅ Checkmark icon appears in top-right
- ✅ Customization section appears below
- ✅ Preview section appears

**Test B: Switch Card Selection**
- ✅ Click "Chapter-Section" card
- ✅ Previous card unhighlights
- ✅ New card highlights
- ✅ Customization labels update (Chapter/Section)

**Test C: Custom Structure**
- ✅ Click "Custom Structure" card
- ✅ Customization inputs are empty
- ✅ Can type custom names

**Test D: Numbering Options**
- ✅ Click on numbering radio buttons (Roman/Numeric/Letters)
- ✅ Preview updates with new numbering style

### Step 4: Verify Browser Console

1. Open DevTools (F12)
2. Go to Console tab
3. **Expected:** No errors
4. **Expected:** No duplicate initialization messages

**Run this in console to verify:**
```javascript
// Should return true
!!document.getElementById('documentTypeForm')

// Should return 4 cards
document.querySelectorAll('.structure-card.selectable').length

// Should return the SetupWizard object
typeof SetupWizard
```

### Step 5: Test Form Submission

1. Select any structure card
2. Optionally customize labels
3. Click "Continue" button
4. **Expected:**
   - Loading overlay appears
   - Form submits via AJAX
   - Redirects to `/setup/workflow`

---

## 🐛 If Issues Persist

### Check 1: Clear Browser Cache
```
Ctrl+Shift+Delete → Clear cache and reload
```

### Check 2: Verify File Changes
```bash
# Check that the duplicate script is gone:
tail -15 views/setup/document-type.ejs
# Should NOT see <script> tag at the end
```

### Check 3: Check Server Restart
```bash
# Make sure server restarted properly
# Stop: Ctrl+C
# Start: npm start
# Look for "Server running on port 3000" message
```

### Check 4: Browser DevTools Debugging

**In Console, run:**
```javascript
// 1. Check SetupWizard loaded
console.log('SetupWizard:', SetupWizard);

// 2. Check form exists
console.log('Form:', document.getElementById('documentTypeForm'));

// 3. Check cards exist
const cards = document.querySelectorAll('.structure-card.selectable');
console.log('Cards found:', cards.length);

// 4. Try manual click
cards[0].click();
console.log('Selected value:', document.getElementById('selectedStructure').value);
```

**In Elements tab:**
1. Select a `.structure-card` element
2. Right panel → Event Listeners
3. Expand "click" events
4. **Should see ONE listener** (not multiple)

---

## ✅ Success Criteria

The fix is successful if:

1. ✅ Cards are clickable
2. ✅ Only one card selected at a time
3. ✅ Customization section appears on selection
4. ✅ Preview updates correctly
5. ✅ Form submits successfully
6. ✅ No JavaScript console errors
7. ✅ No duplicate event listeners

---

## 📞 What Was Changed

### Modified File: `/views/setup/document-type.ejs`

**Removed this code block:**
```javascript
<script>
// Initialize document type selection
document.addEventListener('DOMContentLoaded', function() {
    if (typeof SetupWizard !== 'undefined') {
        SetupWizard.initDocumentTypeForm();
    }
});
</script>
```

**Why:** This caused duplicate initialization because `setup-wizard.js` already has auto-initialization logic that runs on DOMContentLoaded.

**Kept unchanged:** `/public/js/setup-wizard.js`
- Lines 707-721: Auto-initialization (handles all forms)
- Lines 162-200: `initDocumentTypeForm()` function

---

## 🎯 Expected Behavior

### Before Fix:
- ❌ Screen displays but nothing clickable
- ❌ JavaScript runs twice, causing event handler conflicts
- ❌ Cards don't respond to clicks

### After Fix:
- ✅ Screen displays correctly
- ✅ JavaScript runs once, event handlers work
- ✅ Cards respond to clicks immediately
- ✅ Smooth user experience

---

## 📊 Technical Details

**Problem:** Race condition from duplicate `DOMContentLoaded` listeners
**Solution:** Use single initialization point in `setup-wizard.js`
**Pattern:** Auto-initialization based on presence of form ID

**This follows best practices:**
- Single source of truth for initialization
- No inline scripts in templates
- Centralized JavaScript in `/public/js/`
- Clean separation of concerns

---

**Testing completed by:** _____________
**Date:** _____________
**Result:** ☐ Pass ☐ Fail
**Notes:** ___________________________________
