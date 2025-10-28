# TOC Not Visible - Complete Root Cause Analysis

**Date:** 2025-10-28
**Agent:** Analyst (Hive Mind Swarm)
**Priority:** CRITICAL
**Status:** ROOT CAUSE IDENTIFIED

---

## Executive Summary

The user reports "I do not see the document TOC on the left sidebar still" despite Researcher finding sophisticated TOC code. **ROOT CAUSE IDENTIFIED**: The TOC HTML exists in the template but is **NOT STYLED OR FUNCTIONAL** because required CSS and JavaScript files are not linked.

---

## Investigation Findings

### 1. Which Page is the User Viewing?

**CONFIRMED:** User is viewing `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/views/dashboard/document-viewer.ejs`

**Route:** `/src/routes/dashboard.js` line 1099
```javascript
res.render('dashboard/document-viewer', {
  tableOfContents: tocData.hierarchicalTOC,
  flatTOC: tocData.flatTOC,
  // ... other data
});
```

**Evidence:** Grep search found this is the ONLY document viewing template.

---

### 2. Is the TOC Code in the Rendered Template?

**YES - TOC HTML EXISTS** at lines 461-498 of document-viewer.ejs:

```html
<!-- Table of Contents -->
<% if (flatTOC && flatTOC.length > 0) { %>
<div class="document-toc-container">
  <div class="toc-header" onclick="toggleTOC()">
    <h3>
      <i class="bi bi-list me-2"></i>
      Table of Contents
    </h3>
    <div class="toc-controls">
      <span class="section-count"><%= sections.length %> sections</span>
      <button class="toc-toggle-btn">...</button>
    </div>
  </div>

  <div class="toc-content" id="tocContent">
    <nav>
      <% flatTOC.forEach(function(item) { %>
        <div class="toc-item depth-<%= item.depth || 0 %>">
          <a href="#<%= item.anchorId %>" class="toc-link">
            <span class="toc-number">#<%= item.number %></span>
            <span class="toc-citation"><%= item.citation %></span>
          </a>
        </div>
      <% }); %>
    </nav>
  </div>
</div>
<% } %>
```

**TOC JavaScript Functions** also exist inline at lines 836-894:
- `toggleTOC()` - Collapse/expand functionality
- `scrollToSection()` - Smooth scroll navigation

---

### 3. What Does the User Actually See?

**CURRENT STATE:** User sees TOC HTML rendered as a **plain collapsible block** above the document sections, NOT as a left sidebar.

**Current Navigation Elements:**
- Document header (title, status, dates)
- TOC container (lines 461-498) - **IMPROPERLY STYLED**
- Document sections list

**The TOC is rendering as a regular `<div>` block, not as a fixed left sidebar!**

---

### 4. Critical Discrepancies Found

### **PROBLEM 1: Missing CSS File Link**

**Expected:** External TOC CSS should be linked in `<head>` section:
```html
<link rel="stylesheet" href="/css/section-numbering-toc.css">
```

**Actual:** Only these CSS files are linked (lines 7-9):
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css">
<link rel="stylesheet" href="/css/document-viewer-enhancements.css">
```

**Result:** The TOC CSS file `/public/css/section-numbering-toc.css` is **NEVER LOADED**.

---

### **PROBLEM 2: Wrong CSS Class Name**

**External CSS defines:** `.document-toc` (line 143 of section-numbering-toc.css)
```css
.document-toc {
  position: fixed;
  top: 0;
  left: 0;
  width: 340px;
  height: 100vh;
  transform: translateX(-100%); /* Hidden by default, slides in */
  z-index: 999;
}
```

**HTML uses:** `.document-toc-container` (line 463 of document-viewer.ejs)
```html
<div class="document-toc-container">
```

**Result:** Even if CSS file was linked, the styles wouldn't apply because of **CLASS NAME MISMATCH**.

---

### **PROBLEM 3: Missing Toggle Button**

**External CSS defines:** `.toc-toggle-button` (line 86 of section-numbering-toc.css)
```css
.toc-toggle-button {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1000;
  /* Floating button to open/close sidebar */
}
```

**HTML doesn't have:** No toggle button element exists in document-viewer.ejs to trigger the sidebar.

**Result:** Even with correct CSS, there's no button to open the sidebar.

---

### **PROBLEM 4: Incomplete Inline CSS**

The template has **basic inline CSS** for TOC (lines 181-221+):
```css
.document-toc-container {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 24px;
  /* Regular block styling, NOT fixed sidebar */
}
```

**This inline CSS creates a simple collapsible block, NOT a left sidebar.**

---

### **PROBLEM 5: Missing External JavaScript**

**Expected:** External TOC JS should be included:
```html
<script src="/js/section-numbering-toc.js"></script>
```

**Actual:** Only these scripts are included (lines 824-827):
```html
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/diff@5.1.0/dist/diff.min.js"></script>
<script src="/js/workflow-actions.js"></script>
<script src="/js/document-viewer-enhancements.js"></script>
```

**The external JS file `/public/js/section-numbering-toc.js` contains:**
- `SectionNavigator` object
- `buildSectionIndex()` - Index all sections with numbering
- `createTOCStructure()` - Build hierarchical TOC
- `setupIntersectionObserver()` - Track active section
- `setupKeyboardNavigation()` - Keyboard shortcuts
- Search and filter functionality

**Result:** Advanced TOC features are not available.

---

## 5. Root Cause Summary

The TOC is not visible as a left sidebar because:

1. ❌ **CSS file not linked** - `/css/section-numbering-toc.css` is missing from `<head>`
2. ❌ **Wrong CSS class** - HTML uses `.document-toc-container`, CSS expects `.document-toc`
3. ❌ **Missing toggle button** - No floating button to open the sidebar
4. ❌ **Incomplete inline CSS** - Current styles create a block, not a sidebar
5. ❌ **JS file not linked** - `/js/section-numbering-toc.js` is missing from scripts
6. ❌ **Inline JS incomplete** - Only has basic toggle/scroll, missing advanced features

---

## 6. Files That Need Modification

### **File 1: `/views/dashboard/document-viewer.ejs`**

**Required Changes:**

1. **Add CSS link in `<head>` section** (after line 9):
```html
<link rel="stylesheet" href="/css/section-numbering-toc.css">
```

2. **Change class name** (line 463):
```html
<!-- BEFORE -->
<div class="document-toc-container">

<!-- AFTER -->
<div class="document-toc">
```

3. **Add toggle button** (before line 461):
```html
<!-- Toggle Button (floating) -->
<button class="toc-toggle-button" onclick="toggleDocumentTOC()" aria-label="Toggle table of contents">
  <i class="bi bi-list"></i>
  <span class="toc-toggle-badge"><%= sections.length %></span>
</button>
```

4. **Add external JS file** (after line 827):
```html
<script src="/js/section-numbering-toc.js"></script>
```

5. **Remove or update inline TOC CSS** (lines 181-221+):
   - Option A: Remove inline CSS completely, rely on external file
   - Option B: Keep as fallback but ensure class names match

6. **Update inline JS** (around line 839):
```javascript
// Add function to work with external JS
function toggleDocumentTOC() {
  const toc = document.querySelector('.document-toc');
  const backdrop = document.querySelector('.toc-backdrop');

  if (toc) {
    toc.classList.toggle('open');
  }
  if (backdrop) {
    backdrop.classList.toggle('visible');
  }
}
```

7. **Add backdrop element** (after TOC div, around line 498):
```html
</div> <!-- End .document-toc -->
<% } %>

<!-- Backdrop overlay for TOC -->
<div class="toc-backdrop" onclick="toggleDocumentTOC()"></div>
```

---

## 7. Design Intent vs. Current Implementation

### **Design Intent (from external CSS/JS):**
- **Left sidebar:** Fixed position, slides in from left
- **Toggle button:** Floating button in top-left corner
- **Backdrop:** Dark overlay when TOC is open
- **Advanced features:** Search, keyboard navigation, active section tracking
- **Visual hierarchy:** Color-coded depth indicators, hover effects

### **Current Implementation:**
- **Inline block:** Regular div that appears above document sections
- **Simple toggle:** Collapse/expand button in header
- **No backdrop:** No overlay effect
- **Basic features:** Only toggle and scroll functionality
- **Minimal styling:** Basic borders and backgrounds

---

## 8. Verification Steps

To verify TOC is visible after fixes:

1. ✅ Check Network tab - CSS file loads: `/css/section-numbering-toc.css`
2. ✅ Check Network tab - JS file loads: `/js/section-numbering-toc.js`
3. ✅ Check Elements tab - `<div class="document-toc">` has correct styles applied
4. ✅ Check Elements tab - Toggle button exists with class `.toc-toggle-button`
5. ✅ Click toggle button - Sidebar should slide in from left
6. ✅ Click backdrop - Sidebar should slide out
7. ✅ Click TOC item - Should scroll to section smoothly
8. ✅ Inspect computed styles - Should see `position: fixed`, `left: 0`, etc.

---

## 9. Additional Observations

### **Data Flow is Correct:**
- Route passes `flatTOC` and `tableOfContents` to template ✅
- Template receives section data with numbers, citations, depths ✅
- TOC renders all items in a loop ✅

### **What's Working:**
- Backend TOC service (`tocService.processSectionsForTOC()`) ✅
- Data structure (hierarchical + flat TOC) ✅
- Inline toggle/scroll JavaScript (basic functionality) ✅

### **What's Broken:**
- CSS styling for fixed left sidebar ❌
- Advanced JavaScript features ❌
- Toggle button to open/close sidebar ❌
- Visual design and animations ❌

---

## 10. Recommended Fix Priority

**CRITICAL (Do First):**
1. Add CSS file link to `<head>`
2. Change class from `.document-toc-container` to `.document-toc`
3. Add toggle button HTML

**HIGH (Do Second):**
4. Add external JS file link
5. Add backdrop element
6. Update inline JS to work with external JS

**MEDIUM (Do Third):**
7. Remove/update redundant inline CSS
8. Test all TOC features
9. Verify mobile responsiveness

**LOW (Optional):**
10. Add additional features from external JS
11. Enhance styling
12. Add animations

---

## Conclusion

**The user cannot see the TOC as a left sidebar because the sophisticated TOC system designed in external CSS/JS files is completely disconnected from the template.** The template has its own incomplete inline implementation that creates a simple collapsible block instead of a fixed sidebar.

**Fix:** Link the external CSS/JS files and update HTML to use the correct class names and structure.

**Estimated Time:** 15-30 minutes to implement all critical fixes.

---

**Investigation Complete**
**Next Step:** Pass findings to Coder agent for implementation.
