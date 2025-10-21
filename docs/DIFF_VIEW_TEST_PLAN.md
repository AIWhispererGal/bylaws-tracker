# Diff View Test Plan

## Quick Test Instructions

### 1. Start the Application
```bash
npm start
```

### 2. Access Dashboard
1. Navigate to `http://localhost:3000`
2. Login or select organization
3. Navigate to dashboard at `/dashboard`

### 3. Test Diff View

#### Test Case 1: Basic Diff Display
**Steps:**
1. Click on any document from the dashboard
2. Find a section with suggestions
3. Click to expand the section
4. Click the "Show Changes" button on a suggestion

**Expected Result:**
- Original text should be fetched from API
- Diff view should display with:
  - Red strikethrough for deleted words
  - Green highlight for added words
  - Normal text for unchanged words
- Button should change to "Hide Changes"

**Example:**
```
Original: "The board shall meet quarterly."
Suggested: "The board shall meet monthly."

Diff Display:
"The board shall meet [quarterly with red strikethrough] [monthly with green highlight]."
```

#### Test Case 2: Toggle Changes
**Steps:**
1. With diff view showing (from Test Case 1)
2. Click "Hide Changes" button

**Expected Result:**
- Diff view should hide
- Plain suggested text should show
- Button should change back to "Show Changes"

#### Test Case 3: Multiple Suggestions
**Steps:**
1. Find a section with multiple suggestions
2. Click "Show Changes" on first suggestion
3. Click "Show Changes" on second suggestion

**Expected Result:**
- Each suggestion should independently show/hide changes
- Toggle states should be maintained separately
- No interference between suggestions

#### Test Case 4: Empty or No Changes
**Steps:**
1. Create a suggestion with identical text to original
2. Click "Show Changes"

**Expected Result:**
- No red or green highlighting
- All text appears normal
- System doesn't crash

## Detailed Test Scenarios

### Scenario A: Text Additions Only
**Original:** "Members must attend meetings."
**Suggested:** "Members must attend all meetings regularly."

**Expected Diff:**
```
Members must attend [all] meetings [regularly].
```
(Where [text] is green highlighted)

### Scenario B: Text Deletions Only
**Original:** "The president shall preside over all board meetings and committee sessions."
**Suggested:** "The president shall preside over all board meetings."

**Expected Diff:**
```
The president shall preside over all board meetings [and committee sessions].
```
(Where [text] is red strikethrough)

### Scenario C: Mixed Changes
**Original:** "The treasurer shall maintain accurate financial records and submit quarterly reports to the board of directors."
**Suggested:** "The treasurer shall maintain detailed financial records and submit monthly reports to the executive board."

**Expected Diff:**
```
The treasurer shall maintain [accurate] [detailed] financial records and submit [quarterly] [monthly] reports to the [board of directors] [executive board].
```
(Red = strikethrough, Green = highlighted)

### Scenario D: Punctuation Changes
**Original:** "Section 5: Board Responsibilities"
**Suggested:** "Section 5 - Board Responsibilities"

**Expected Diff:**
```
Section 5[:] [-] Board Responsibilities
```

### Scenario E: Whitespace Handling
**Original:** "Text with  double  spaces"
**Suggested:** "Text with single spaces"

**Expected:** Whitespace differences should be visible in diff

## API Endpoint Tests

### Test API Direct
```bash
# Get section data for diff
curl http://localhost:3000/api/dashboard/sections/SECTION_ID_HERE \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Expected Response:**
```json
{
  "success": true,
  "section": {
    "id": "uuid",
    "current_text": "The section text here...",
    "section_number": "VI.1",
    "section_title": "Section Title"
  }
}
```

### Test Organization Access Control
```bash
# Try to access section from different organization
curl http://localhost:3000/api/dashboard/sections/OTHER_ORG_SECTION_ID \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Access denied"
}
```

## Browser Testing

### Chrome/Edge
- [ ] Diff colors display correctly
- [ ] Red strikethrough visible
- [ ] Green highlight visible
- [ ] Toggle button works
- [ ] No JavaScript errors in console

### Firefox
- [ ] Diff colors display correctly
- [ ] Red strikethrough visible
- [ ] Green highlight visible
- [ ] Toggle button works
- [ ] No JavaScript errors in console

### Safari
- [ ] Diff colors display correctly
- [ ] Red strikethrough visible
- [ ] Green highlight visible
- [ ] Toggle button works
- [ ] No JavaScript errors in console

## Mobile Testing

### Responsive Design
- [ ] Diff view readable on mobile
- [ ] Toggle button accessible
- [ ] Colors visible on smaller screens
- [ ] Text doesn't overflow

## Security Testing

### XSS Protection
**Test:** Create suggestion with HTML/JavaScript
```
<script>alert('XSS')</script>
<img src=x onerror=alert('XSS')>
```

**Expected:** Text should be escaped and displayed as plain text, not executed

### Organization Isolation
**Test:** Try to access sections from another organization
**Expected:** 403 Forbidden or access denied error

## Performance Testing

### Large Text Diff
**Test:** Create suggestion with 2000+ word changes
**Expected:**
- Diff calculation < 100ms
- UI remains responsive
- No browser lag

### Multiple Toggles
**Test:** Rapidly click Show/Hide Changes 20 times
**Expected:**
- No memory leaks
- Smooth transitions
- No JavaScript errors

## Edge Cases

### Edge Case 1: Empty Original Text
**Original:** (empty)
**Suggested:** "New text here"
**Expected:** All text shown in green

### Edge Case 2: Empty Suggested Text
**Original:** "Some text"
**Suggested:** (empty)
**Expected:** All text shown in red with strikethrough

### Edge Case 3: Special Characters
**Original:** "Price: $100.00 (20%)"
**Suggested:** "Price: $150.00 (30%)"
**Expected:** Special characters handled correctly

### Edge Case 4: Unicode Characters
**Original:** "Article § 501(c)(3)"
**Suggested:** "Article § 501(c)(4)"
**Expected:** Unicode symbols preserved

### Edge Case 5: Very Long Words
**Original:** "supercalifragilisticexpialidocious"
**Suggested:** "pneumonoultramicroscopicsilicovolcanoconiosis"
**Expected:** Words don't break layout

## Regression Testing

### Check Old Functionality Still Works
- [ ] Suggestions can be created
- [ ] Suggestions can be viewed without diff
- [ ] Section expansion/collapse works
- [ ] Other dashboard features work
- [ ] Document export still works

## Accessibility Testing

### Color Blind Users
- [ ] Deletions identifiable by strikethrough (not just red)
- [ ] Additions identifiable by position (not just green)
- [ ] Sufficient contrast for readability

### Screen Readers
- [ ] Button announces current state
- [ ] Diff content readable by screen reader
- [ ] No inaccessible elements

## Console Checks

### No Errors
```javascript
// Open browser console (F12)
// Check for:
- No 404 errors for API calls
- No JavaScript errors
- No CORS errors
- No "undefined" warnings
```

### Network Tab
```
- API call to /api/dashboard/sections/:id successful
- Response time < 200ms
- Response contains current_text
```

## Deployment Verification

### After Deploy to Production
1. [ ] Diff view works on production
2. [ ] API endpoint accessible
3. [ ] RLS policies working
4. [ ] No errors in production logs
5. [ ] Performance acceptable
6. [ ] All browsers tested

## Success Criteria

✅ **Must Have:**
- Red strikethrough for deletions visible
- Green highlights for additions visible
- Toggle button functional
- No JavaScript errors
- Organization access control working

✅ **Nice to Have:**
- Smooth transitions
- Fast performance (< 100ms)
- Mobile responsive
- All edge cases handled

## Bug Report Template

If you find issues, report with:

```markdown
**Bug:** Diff view not showing correctly

**Steps to Reproduce:**
1. Open document [ID]
2. Expand section [Number]
3. Click "Show Changes"

**Expected:** Red/green diff display
**Actual:** [What you see]

**Browser:** Chrome 120
**Screenshot:** [Attach if possible]
**Console Errors:** [Copy from console]
```

## Final Checklist

Before marking as complete:

- [ ] All test cases passed
- [ ] No console errors
- [ ] Works in Chrome, Firefox, Safari
- [ ] Mobile responsive
- [ ] Security tests passed
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Deployed to production

## Quick Smoke Test (5 minutes)

1. ✅ Open dashboard
2. ✅ Click any document
3. ✅ Expand a section with suggestions
4. ✅ Click "Show Changes"
5. ✅ Verify red strikethrough visible
6. ✅ Verify green highlights visible
7. ✅ Click "Hide Changes"
8. ✅ Verify plain text shows
9. ✅ Check browser console (no errors)
10. ✅ Test works!

---

**Implementation Date:** 2025-10-13
**Tested By:** [Your Name]
**Status:** Ready for Testing ✅
