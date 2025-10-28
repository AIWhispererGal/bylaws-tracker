# TOC Positioning Bug Analysis

**STATUS: ROOT CAUSE IDENTIFIED**
**DATE:** 2025-10-28
**AGENT:** Analyst
**SEVERITY:** High - TOC is visible but in wrong position

## 🚨 CRITICAL FINDINGS

### The Problem
The TOC is appearing at the **top of the page** (inline with content) instead of as a **fixed left sidebar**.

### Root Cause: CLASS NAME MISMATCH

**CSS expects:** `.document-toc` (with fixed positioning)
**HTML uses:** `.document-toc-container` (no positioning)

## HTML Structure (Lines 464-498 in document-viewer.ejs)

```html
<!-- Line 464: WRONG CLASS NAME -->
<div class="document-toc-container">
  <div class="toc-header" onclick="toggleTOC()">
    <h3>
      <i class="bi bi-list me-2"></i>
      Table of Contents
    </h3>
    <div class="toc-controls">
      <span class="section-count"><%= sections.length %> sections</span>
      <button class="toc-toggle-btn"
              onclick="event.stopPropagation(); toggleTOC()"
              aria-label="Toggle table of contents">
        <i class="bi bi-chevron-up"></i>
      </button>
    </div>
  </div>

  <div class="toc-content" id="tocContent">
    <nav aria-label="Document table of contents">
      <% flatTOC.forEach(function(item) { %>
        <div class="toc-item depth-<%= item.depth || 0 %>"
             data-section-number="<%= item.number %>">
          <a href="#<%= item.anchorId %>"
             class="toc-link"
             onclick="scrollToSection(<%= item.number %>); return false;">
            <span class="toc-number">#<%= item.number %></span>
            <span class="toc-citation"><%= item.citation %></span>
            <% if (item.isLocked) { %>
              <span class="toc-meta"><i class="bi bi-lock-fill"></i></span>
            <% } %>
          </a>
        </div>
      <% }); %>
    </nav>
  </div>
</div>
```

## CSS Expected (Lines 143-162 in section-numbering-toc.css)

```css
.document-toc {
  position: fixed;      /* ← Fixed positioning for sidebar */
  top: 0;
  left: 0;
  width: 340px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  z-index: 999;
  transform: translateX(-100%);  /* ← Hidden by default */
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.document-toc.open {
  transform: translateX(0);  /* ← Slides in when open */
}
```

## CSS Actually Applied (Lines 182-188)

```css
/* This is what's currently applying */
.document-toc-container {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  margin-bottom: 24px;   /* ← Creates inline block layout */
  overflow: hidden;
}
/* NO position: fixed, NO left: 0, NO transform */
```

## Additional Missing Elements

### 1. Toggle Button (Lines 86-119 in CSS)
**Expected:** Fixed toggle button at top-left
```css
.toc-toggle-button {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1000;
  width: 48px;
  height: 48px;
  /* ... */
}
```
**Currently:** Button is inline inside the container

### 2. Backdrop Overlay (Lines 165-182 in CSS)
**Expected:** Backdrop overlay when TOC is open
```css
.toc-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.3);
  z-index: 998;
  /* ... */
}
```
**Currently:** No backdrop element exists in HTML

### 3. TOC Header (Lines 188-194 in CSS)
**Expected:** Gradient header with purple styling
```css
.toc-header {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  /* ... */
}
```
**Currently:** Different inline styles being used

## The Mismatch Explained

### CSS File Expectations
The `/public/css/section-numbering-toc.css` file is designed for a **modern slide-out sidebar** with:
- Fixed positioning (always on left edge)
- Hidden by default (`transform: translateX(-100%)`)
- Slides in/out when toggled
- Separate toggle button floating in corner
- Backdrop overlay for mobile

### HTML Reality
The document-viewer.ejs file implements an **old inline accordion** with:
- Normal block-level element (flows with content)
- Always visible (at top of page)
- Collapsible content (expand/collapse)
- Toggle button inside header
- No backdrop needed

## Why It's at the Top

**The HTML is positioned in the DOM flow:**
```
Line 454-460: Document info section
Line 462-463: Comment "Table of Contents"
Line 464-498: TOC container (← HERE, flows inline)
Line 501+: Document sections
```

Because `.document-toc-container` has **no `position: fixed`**, it renders as a normal block element in the page flow, which places it at the top after the document info.

## The Fix Required

**Option 1: Match HTML to CSS (Recommended)**
1. Change class name from `.document-toc-container` to `.document-toc`
2. Move toggle button outside the container
3. Add backdrop element
4. Update JavaScript to handle `.open` class
5. Ensure HTML structure matches CSS expectations

**Option 2: Match CSS to HTML**
1. Remove the fixed positioning CSS
2. Keep inline accordion behavior
3. Accept top-of-page position

## Detailed Fix Plan (Option 1)

### Changes to document-viewer.ejs (Line 462-498)

**BEFORE:**
```html
<div class="document-toc-container">
  <div class="toc-header" onclick="toggleTOC()">
    <!-- header content -->
  </div>
  <div class="toc-content" id="tocContent">
    <!-- items -->
  </div>
</div>
```

**AFTER:**
```html
<!-- Toggle button (fixed position, outside content flow) -->
<button class="toc-toggle-button" onclick="toggleTOC()" aria-label="Toggle table of contents">
  <i class="bi bi-list"></i>
  <span class="toc-toggle-badge"><%= sections.length %></span>
</button>

<!-- Backdrop overlay -->
<div class="toc-backdrop" onclick="closeTOC()"></div>

<!-- Sidebar (fixed position, initially hidden) -->
<div class="document-toc">
  <div class="toc-header">
    <h3>
      <i class="bi bi-list-ul me-2"></i>
      Table of Contents
    </h3>
    <div class="toc-meta">
      <div class="toc-section-count">
        <i class="bi bi-file-text"></i>
        <span><%= sections.length %> sections</span>
      </div>
      <button class="toc-collapse-all" onclick="collapseAll()">
        Collapse All
      </button>
    </div>
  </div>

  <div class="toc-search">
    <input type="text" class="toc-search-input" placeholder="Search sections..." oninput="filterTOC(this.value)">
    <i class="bi bi-search toc-search-icon"></i>
  </div>

  <div class="toc-content">
    <!-- TOC items same as before -->
  </div>
</div>
```

### JavaScript Changes Required

**Current function (Line 841-848):**
```javascript
function toggleTOC() {
  const content = document.getElementById('tocContent');
  const button = document.querySelector('.toc-toggle-btn');

  if (content && button) {
    content.classList.toggle('collapsed');
    button.classList.toggle('collapsed');
  }
}
```

**New function:**
```javascript
function toggleTOC() {
  const toc = document.querySelector('.document-toc');
  const backdrop = document.querySelector('.toc-backdrop');
  const button = document.querySelector('.toc-toggle-button');

  if (toc) {
    toc.classList.toggle('open');
  }
  if (backdrop) {
    backdrop.classList.toggle('visible');
  }
  if (button) {
    button.classList.toggle('active');
  }
}

function closeTOC() {
  const toc = document.querySelector('.document-toc');
  const backdrop = document.querySelector('.toc-backdrop');
  const button = document.querySelector('.toc-toggle-button');

  if (toc) toc.classList.remove('open');
  if (backdrop) backdrop.classList.remove('visible');
  if (button) button.classList.remove('active');
}
```

## Summary

**The TOC appears at top because:**
1. Class name is `.document-toc-container` not `.document-toc`
2. This class has no `position: fixed` CSS
3. Element renders inline in normal page flow
4. Positioned in HTML after document info, before sections

**To fix:**
- Change class name to `.document-toc`
- Move toggle button outside container
- Add backdrop element
- Update JavaScript to handle `.open` class
- Remove old `.document-toc-container` styles

**Impact:**
- TOC will become a fixed left sidebar
- Slides in/out on toggle
- Floats over content (not in flow)
- Modern UX as CSS was designed for

## Coordination Notes

**Report to Coder:**
- Primary fix: Lines 464-498 in document-viewer.ejs
- JavaScript update: Lines 841-848
- Remove old inline styles: Lines 182-188
- Test with real document to verify positioning
