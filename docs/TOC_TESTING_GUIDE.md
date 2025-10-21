# Table of Contents Testing Guide

## Quick Test Scenarios

### 1. **Visual Verification**

**Navigate to a document:**
```
http://localhost:3000/dashboard/documents/{document-id}/view
```

**Check:**
- [ ] TOC panel appears at top of page
- [ ] TOC header shows "Table of Contents" with section count
- [ ] Each section has a `#1`, `#2`, `#3` number in header
- [ ] Numbers are monospace and styled
- [ ] Indentation increases with depth

---

### 2. **TOC Collapse/Expand**

**Steps:**
1. Click TOC header or chevron button
2. TOC content should collapse smoothly
3. Chevron icon rotates 180°
4. Click again to expand

**Expected:**
- Smooth CSS transition
- No page jump
- Icon animation

---

### 3. **Navigation from TOC**

**Steps:**
1. Click any TOC item
2. Page scrolls smoothly to section
3. Section highlights with yellow background (2s fade)
4. Section auto-expands if collapsed
5. URL hash updates (e.g., `#section-42`)

**Expected:**
- No page jump
- Smooth scroll animation
- Section becomes visible
- Hash in address bar

---

### 4. **Deep Linking**

**Steps:**
1. Copy URL with hash (e.g., `http://localhost:3000/.../view#section-15`)
2. Open in new tab/window
3. Page loads and scrolls to section
4. Section highlights briefly

**Expected:**
- Automatic scroll on load
- Section expanded
- URL hash preserved

---

### 5. **Copy Link to Clipboard**

**Steps:**
1. Click section number (e.g., `#42`)
2. Toast notification appears: "Link copied to clipboard!"
3. Paste clipboard content

**Expected:**
- Full URL with hash copied
- Toast shows success
- No page navigation

**Example copied link:**
```
http://localhost:3000/dashboard/documents/abc-123/view#section-42
```

---

### 6. **Mobile Responsive**

**Test on mobile (< 768px):**
- [ ] TOC height limited to 300px
- [ ] Indentation reduced (10px, 20px, 30px)
- [ ] Section numbers still visible
- [ ] Touch targets large enough (44px minimum)
- [ ] Smooth scroll works on mobile

**Resize browser to test:**
```
Desktop (1920px) → Tablet (768px) → Mobile (375px)
```

---

### 7. **Keyboard Navigation**

**Steps:**
1. Press `Tab` to focus TOC items
2. Press `Enter` on focused item
3. Section scrolls into view

**Expected:**
- Focus indicators visible
- Enter key triggers navigation
- Accessible for keyboard-only users

---

### 8. **Screen Reader Test**

**Using NVDA/JAWS:**
- [ ] TOC announced as "navigation"
- [ ] Section count read correctly
- [ ] Each item announced with number and title
- [ ] Lock icons announced

---

### 9. **Performance Test**

**Large documents (50+ sections):**
1. Open document with many sections
2. Check TOC load time (< 100ms)
3. Navigate between sections
4. No lag or stuttering

**Console check:**
```javascript
console.log('[DOCUMENT VIEWER] TOC generated:', {
  totalSections: 150,
  rootSections: 10,
  maxDepth: 5,
  sectionsWithContent: 145
});
```

---

### 10. **Edge Cases**

**Test scenarios:**

#### Empty Document
- [ ] No TOC shows if no sections
- [ ] No JavaScript errors

#### Single Section
- [ ] TOC shows single item
- [ ] Navigation still works

#### Deep Nesting (9+ levels)
- [ ] All levels show with proper indentation
- [ ] No overflow issues
- [ ] Mobile view handles deep nesting

#### Long Section Titles
- [ ] Text wraps properly
- [ ] No horizontal scroll
- [ ] Title truncated if needed

---

## Browser Compatibility

**Test in:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Console Checks

**No errors expected:**
```javascript
// Good
[DOCUMENT VIEWER] TOC generated: { totalSections: 42, ... }

// Bad (should not appear)
TypeError: Cannot read property 'number' of undefined
ReferenceError: scrollToSection is not defined
```

---

## Visual Regression Test

**Before/After:**
1. Take screenshot of document viewer before changes
2. Take screenshot after TOC implementation
3. Compare side-by-side

**Expected changes:**
- TOC panel added at top
- Section numbers added to headers
- Everything else unchanged

---

## Automated Test (Optional)

```javascript
// Jest/Playwright test example
test('TOC navigation works', async () => {
  await page.goto('/dashboard/documents/123/view');

  // Check TOC exists
  const toc = await page.$('.document-toc-container');
  expect(toc).toBeTruthy();

  // Click first TOC item
  await page.click('.toc-item:first-child .toc-link');

  // Check URL hash updated
  const url = await page.url();
  expect(url).toContain('#section-1');

  // Check section highlighted
  const section = await page.$('#section-1.section-highlight');
  expect(section).toBeTruthy();
});
```

---

## Bug Report Template

If you find issues, use this template:

```markdown
### Bug: [Short description]

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. See error

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Screen Size: 1920x1080

**Screenshots:**
[Attach images]

**Console Errors:**
[Copy any errors from console]
```

---

## Success Criteria

All items checked ✅:

- [ ] TOC displays correctly
- [ ] Section numbers visible
- [ ] Navigation works
- [ ] Deep linking works
- [ ] Clipboard copy works
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] No console errors
- [ ] No visual regressions
- [ ] Performance acceptable

---

## Quick Validation

**Run these checks in 5 minutes:**

1. **Visual:** TOC shows, sections numbered ✅
2. **Click TOC item:** Scrolls to section ✅
3. **Click section #:** Link copied ✅
4. **Reload with hash:** Auto-scrolls ✅
5. **Mobile view:** Responsive layout ✅

If all 5 pass → **Feature is working!** 🎉

---

**Last Updated:** October 19, 2025
