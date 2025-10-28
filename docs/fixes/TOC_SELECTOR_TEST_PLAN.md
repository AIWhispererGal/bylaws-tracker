# TOC Selector Fix - Test Plan

**Date**: 2025-10-28
**Priority**: CRITICAL
**Status**: ✅ FIXED - READY FOR TESTING

## Quick Test Checklist

### 1. Basic Functionality (30 seconds)
- [ ] Open any document in document viewer
- [ ] Press `Ctrl+K` or click TOC toggle button
- [ ] **PASS CRITERIA**: TOC panel opens showing list of sections
- [ ] **FAIL CRITERIA**: TOC shows "0 sections" or empty list

### 2. Section Count Verification (15 seconds)
- [ ] Count visible sections in document viewer
- [ ] Check section count in TOC header
- [ ] **PASS CRITERIA**: Counts match exactly
- [ ] **FAIL CRITERIA**: Mismatch or "0 sections"

### 3. Navigation Test (45 seconds)
- [ ] Click any section in TOC
- [ ] **PASS CRITERIA**: 
  - Page scrolls smoothly to that section
  - Section gets highlighted briefly (yellow flash)
  - TOC item shows as "active"
  - URL updates with anchor (#section-{id})

### 4. Search Test (30 seconds)
- [ ] Type a search term in TOC search box
- [ ] **PASS CRITERIA**: TOC filters to matching sections only
- [ ] Clear search
- [ ] **PASS CRITERIA**: All sections reappear

### 5. Browser Console Check (15 seconds)
- [ ] Open browser DevTools (F12)
- [ ] Check Console tab
- [ ] **PASS CRITERIA**: No errors related to "querySelector" or "sections"
- [ ] **FAIL CRITERIA**: Any JavaScript errors in console

## Detailed Verification Steps

### Setup
1. Ensure server is running: `npm start`
2. Navigate to dashboard: http://localhost:3000/dashboard
3. Click on any document with sections
4. Open browser DevTools (F12) to Console tab

### Test 1: Selector Returns Results

**Run in browser console:**
```javascript
document.querySelectorAll('.section-card[data-section-id]').length
```

**Expected**: Number greater than 0 (e.g., 45, 123, etc.)
**Actual**: _____

### Test 2: Section Index Built Correctly

**Run in browser console:**
```javascript
SectionNavigator.sections.length
```

**Expected**: Same number as Test 1
**Actual**: _____

### Test 3: First Section Data

**Run in browser console:**
```javascript
SectionNavigator.sections[0]
```

**Expected**: Object with properties:
- `id`: UUID string
- `number`: 1
- `citation`: Section title text
- `depth`: Number (0-10)
- `element`: DOM element reference

**Actual**: _____

### Test 4: TOC Items Rendered

**Run in browser console:**
```javascript
document.querySelectorAll('.toc-item').length
```

**Expected**: Same as section count
**Actual**: _____

### Test 5: Click Navigation

**Manual test:**
1. Open TOC (Ctrl+K)
2. Click section #5 in TOC
3. Verify scroll happens
4. Check URL contains `#section-{id}`

**Result**: PASS / FAIL

### Test 6: Active Highlighting

**Manual test:**
1. Scroll through document slowly
2. Watch TOC (keep it open)
3. Verify active section highlights in TOC as you scroll

**Result**: PASS / FAIL

## Regression Tests

### Before Fix (Expected Failures)

With old selector `.card.shadow-sm[id^="section-"]`:
- ❌ Section count: 0
- ❌ TOC empty or shows "No sections"
- ❌ Click navigation doesn't work

### After Fix (Expected Passes)

With new selector `.section-card[data-section-id]`:
- ✅ Section count: Matches actual sections
- ✅ TOC populated with all sections
- ✅ Click navigation works perfectly
- ✅ Search filters correctly
- ✅ Active highlighting works

## Known Edge Cases

### Documents with Special Sections

Test with documents that have:
1. **Nested sections** (depth > 3)
   - Expected: All depths show correctly
2. **Locked sections** 
   - Expected: Lock icon shows in TOC
3. **Sections with suggestions**
   - Expected: Suggestion count badge shows
4. **Very long section titles**
   - Expected: Title truncates gracefully
5. **Empty/untitled sections**
   - Expected: Shows as "Untitled"

## Performance Test

For large documents (100+ sections):

```javascript
console.time('Build Index');
SectionNavigator.buildSectionIndex();
console.timeEnd('Build Index');
```

**Expected**: < 50ms
**Actual**: _____

## Rollback Plan

If fix causes issues:

1. Restore old selector:
```javascript
const sectionCards = document.querySelectorAll('.card.shadow-sm[id^="section-"]');
const sectionId = card.id.replace('section-', '');
```

2. Git revert:
```bash
git checkout HEAD -- public/js/section-numbering-toc.js
```

## Sign-Off

- [ ] All basic tests pass
- [ ] No console errors
- [ ] Navigation works smoothly
- [ ] Search functionality works
- [ ] Performance acceptable
- [ ] No regressions found

**Tested by**: _____________
**Date**: _____________
**Result**: PASS / FAIL
**Notes**: _____________
