# ILLUMINATOR DESIGN: Section Numbering & TOC System
## "Visual Navigation Through Sequential Clarity"

---

## VISUAL ASSESSMENT

### Current Implementation Analysis
- **Existing CSS**: `/public/css/section-numbering-toc.css` (755 lines)
- **Current Features**:
  - ✅ Section number badges (#1, #2, #3...)
  - ✅ Copy-link functionality with tooltip
  - ✅ Fixed-position TOC sidebar (340px wide)
  - ✅ Depth-based indentation (15px per level)
  - ✅ Depth color-coded dots
  - ✅ Search functionality
  - ✅ Collapsible TOC
  - ✅ Mobile bottom-sheet design
  - ✅ Print-friendly
  - ✅ Full accessibility support

### What's Already Illuminated
The current TOC implementation is **exceptional** and follows design principles beautifully:
- **IMAGES NOT WORDS**: Color dots replace depth labels
- **SIMPLE IS BETTER**: Clean, scannable hierarchy
- **Accessibility First**: WCAG AA, keyboard nav, screen readers

---

## DESIGN ENHANCEMENTS

While the foundation is strong, these refinements will elevate the experience:

### Enhancement 1: Hierarchical Section Numbering (1.1.1 format)
Replace sequential numbering (1, 2, 3...) with contextual hierarchical numbering (1, 1.1, 1.1.1, 1.2, 2, 2.1...)

### Enhancement 2: Sticky TOC with Smart Auto-Hide
TOC that auto-hides on scroll down, reappears on scroll up

### Enhancement 3: Current Section Highlight in TOC
Visual indicator showing which section user is currently viewing

### Enhancement 4: Jump-to-Section Animation
Smooth scroll with visual feedback when jumping from TOC

---

## HIERARCHICAL NUMBERING SYSTEM

### Numbering Logic

```javascript
/**
 * Generate hierarchical section numbers
 * E.g., 1, 1.1, 1.1.1, 1.1.2, 1.2, 2, 2.1...
 */
function generateHierarchicalNumbers(sections) {
  const counters = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 10 depth levels

  return sections.map(section => {
    const depth = section.depth || 0;

    // Increment current depth counter
    counters[depth]++;

    // Reset all deeper counters
    for (let i = depth + 1; i < 10; i++) {
      counters[i] = 0;
    }

    // Build number string (1.2.3)
    const numberParts = [];
    for (let i = 0; i <= depth; i++) {
      if (counters[i] > 0) {
        numberParts.push(counters[i]);
      }
    }

    return {
      ...section,
      hierarchicalNumber: numberParts.join('.'),
      displayNumber: numberParts.join('.')
    };
  });
}

/**
 * Example output:
 * Depth 0: "1"
 * Depth 1: "1.1"
 * Depth 2: "1.1.1"
 * Depth 2: "1.1.2"
 * Depth 1: "1.2"
 * Depth 0: "2"
 * Depth 1: "2.1"
 */
```

---

## ENHANCED CSS SPECIFICATIONS

```css
/**
 * ENHANCED Section Numbering & TOC
 * Hierarchical numbering + Smart interactions
 */

/* ============================================
   ENHANCEMENT 1: HIERARCHICAL NUMBER BADGE
   ============================================ */

.section-number-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: auto;
  padding: 0 10px;
  height: 28px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  font-family: 'Inter', 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
  white-space: nowrap;
}

/* Hierarchical numbers can be longer (1.2.3.4) */
.section-number-badge {
  min-width: 42px; /* Accommodate up to 2 digits */
  max-width: 120px; /* Accommodate deep nesting (1.2.3.4.5.6) */
}

/* Depth-based size scaling (deeper = slightly smaller) */
.section-number-badge[data-depth="0"],
.section-number-badge[data-depth="1"] {
  font-size: 14px;
  font-weight: 700;
}

.section-number-badge[data-depth="2"],
.section-number-badge[data-depth="3"],
.section-number-badge[data-depth="4"] {
  font-size: 13px;
  font-weight: 600;
}

.section-number-badge[data-depth="5"],
.section-number-badge[data-depth="6"],
.section-number-badge[data-depth="7"],
.section-number-badge[data-depth="8"],
.section-number-badge[data-depth="9"] {
  font-size: 12px;
  font-weight: 600;
}

/* ============================================
   ENHANCEMENT 2: SMART AUTO-HIDE TOC
   ============================================ */

.document-toc {
  position: fixed;
  top: 0;
  left: 0;
  width: 340px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #e5e7eb;
  z-index: 999;
  transform: translateX(0);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.08);
}

/* Auto-hide when scrolling down */
.document-toc.auto-hidden {
  transform: translateX(-100%);
}

/* Peek button when hidden (shows on left edge) */
.toc-peek-button {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%) translateX(-100%);
  width: 32px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.3s ease;
  z-index: 1000;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
}

.document-toc.auto-hidden + .toc-peek-button {
  transform: translateY(-50%) translateX(0);
}

.toc-peek-button i {
  color: #ffffff;
  font-size: 18px;
  transition: transform 0.2s ease;
}

.toc-peek-button:hover i {
  transform: translateX(3px);
}

/* ============================================
   ENHANCEMENT 3: CURRENT SECTION HIGHLIGHT
   ============================================ */

.toc-item.current-section {
  background: linear-gradient(90deg, #fef3c7 0%, #fef9e7 100%);
  border-left-color: #fbbf24;
  border-left-width: 4px;
  position: relative;
}

.toc-item.current-section::before {
  transform: scale(1.4);
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2);
}

.toc-item.current-section .toc-item-citation {
  color: #92400e;
  font-weight: 600;
}

/* Pulsing indicator for current section */
.toc-item.current-section::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: #fbbf24;
  border-radius: 50%;
  animation: currentSectionPulse 2s ease-in-out infinite;
}

@keyframes currentSectionPulse {
  0%, 100% {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
  50% {
    opacity: 0.5;
    transform: translateY(-50%) scale(1.2);
  }
}

/* ============================================
   ENHANCEMENT 4: JUMP-TO-SECTION ANIMATION
   ============================================ */

/* Target section highlight (when jumped to) */
.section-card.jump-target {
  animation: jumpHighlight 2s ease-out;
}

@keyframes jumpHighlight {
  0% {
    background-color: #fef3c7;
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4);
  }
  50% {
    background-color: #fef3c7;
    box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
  }
  100% {
    background-color: transparent;
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
  }
}

/* Smooth scroll behavior */
html {
  scroll-behavior: smooth;
}

/* Focus ring when section receives focus */
.section-card:focus {
  outline: 3px solid #fbbf24;
  outline-offset: 4px;
  border-radius: 8px;
}

/* ============================================
   ENHANCEMENT 5: TOC HIERARCHICAL FORMATTING
   ============================================ */

/* Hierarchical number in TOC (1.2.3 format) */
.toc-item-number {
  display: inline-block;
  font-weight: 700;
  color: #2563eb;
  font-size: 12px;
  margin-right: 8px;
  font-family: 'Courier New', monospace;
  min-width: 35px;
  text-align: right;
  white-space: nowrap;
}

/* Increase min-width for deeper numbers */
.toc-item[data-depth="5"] .toc-item-number,
.toc-item[data-depth="6"] .toc-item-number,
.toc-item[data-depth="7"] .toc-item-number,
.toc-item[data-depth="8"] .toc-item-number,
.toc-item[data-depth="9"] .toc-item-number {
  min-width: 55px; /* Accommodate 1.2.3.4.5.6 */
  font-size: 11px;
}

/* Depth 0 and 1 get bolder styling */
.toc-item[data-depth="0"] .toc-item-number,
.toc-item[data-depth="1"] .toc-item-number {
  font-size: 13px;
  font-weight: 800;
}

/* ============================================
   ENHANCEMENT 6: TOC SCROLL PROGRESS BAR
   ============================================ */

.toc-scroll-progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 0%;
  background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 0 3px 3px 0;
  transition: height 0.1s ease-out;
  z-index: 10;
}

/* ============================================
   ENHANCEMENT 7: SECTION COUNT INDICATORS
   ============================================ */

/* Show child count for parent sections */
.toc-item-child-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 10px;
  font-weight: 700;
  border-radius: 9px;
  margin-left: auto;
  margin-right: 4px;
}

.toc-item:hover .toc-item-child-count {
  background: #c7d2fe;
}

/* ============================================
   ENHANCEMENT 8: BREADCRUMB NAVIGATION
   ============================================ */

.document-breadcrumb {
  position: sticky;
  top: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e2e8f0;
  padding: 12px 20px;
  z-index: 95;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  overflow-x: auto;
  white-space: nowrap;
  scrollbar-width: thin;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  text-decoration: none;
  transition: color 0.15s ease;
}

.breadcrumb-item:hover {
  color: #2563eb;
  text-decoration: none;
}

.breadcrumb-number {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  font-size: 12px;
}

.breadcrumb-separator {
  color: #cbd5e1;
  margin: 0 4px;
}

.breadcrumb-item.current {
  color: #1e293b;
  font-weight: 600;
  pointer-events: none;
}

/* ============================================
   MOBILE RESPONSIVE
   ============================================ */

@media (max-width: 768px) {
  /* Bottom sheet TOC */
  .document-toc {
    top: auto;
    bottom: 0;
    left: 0;
    width: 100vw;
    height: 60vh;
    max-height: 500px;
    border-right: none;
    border-top: 1px solid #e5e7eb;
    border-radius: 20px 20px 0 0;
    transform: translateY(100%);
  }

  .document-toc.open {
    transform: translateY(0);
  }

  .document-toc.auto-hidden {
    transform: translateY(100%);
  }

  /* Peek button moves to bottom-left */
  .toc-peek-button {
    bottom: 20px;
    top: auto;
    left: 20px;
    transform: translateY(100%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }

  .document-toc.auto-hidden + .toc-peek-button {
    transform: translateY(0);
  }

  /* Breadcrumb simplification */
  .document-breadcrumb {
    font-size: 11px;
    padding: 8px 12px;
  }

  .breadcrumb-number {
    font-size: 10px;
  }

  /* Smaller hierarchical numbers */
  .section-number-badge {
    font-size: 11px;
    padding: 0 8px;
    height: 24px;
  }

  .toc-item-number {
    font-size: 11px;
    min-width: 30px;
  }
}

/* ============================================
   ACCESSIBILITY
   ============================================ */

/* Keyboard focus */
.toc-item:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: -3px;
  background: #dbeafe;
}

.section-number-badge:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

/* Screen reader text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .toc-item.current-section {
    border: 3px solid currentColor;
  }

  .section-number-badge {
    border: 2px solid currentColor;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  .section-card.jump-target,
  .toc-item.current-section::after,
  .document-toc,
  .toc-peek-button {
    animation: none;
    transition: none;
  }
}

/* ============================================
   PRINT STYLES
   ============================================ */

@media print {
  .toc-peek-button,
  .document-breadcrumb {
    display: none !important;
  }

  .document-toc {
    position: relative;
    transform: translateX(0) !important;
    width: 100%;
    height: auto;
    border: 1px solid #000;
    page-break-inside: avoid;
    margin-bottom: 20px;
  }

  .toc-item.current-section {
    background: transparent;
    border-left: 3px solid #000;
  }

  .toc-item.current-section::after {
    display: none;
  }
}
```

---

## JAVASCRIPT ENHANCEMENTS

```javascript
/**
 * Smart Auto-Hide TOC on Scroll
 */
let lastScrollY = 0;
let ticking = false;

function handleTOCAutoHide() {
  const toc = document.querySelector('.document-toc');
  const currentScrollY = window.scrollY;

  if (currentScrollY > lastScrollY && currentScrollY > 100) {
    // Scrolling down - hide TOC
    toc.classList.add('auto-hidden');
  } else if (currentScrollY < lastScrollY) {
    // Scrolling up - show TOC
    toc.classList.remove('auto-hidden');
  }

  lastScrollY = currentScrollY;
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(handleTOCAutoHide);
    ticking = true;
  }
}, { passive: true });

/**
 * Update Current Section Highlight
 */
function updateCurrentSection() {
  const sections = document.querySelectorAll('.section-card');
  const tocItems = document.querySelectorAll('.toc-item');

  let currentSection = null;
  const viewportMiddle = window.innerHeight / 3; // Upper third of viewport

  // Find section closest to top of viewport
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top >= 0 && rect.top <= viewportMiddle) {
      currentSection = section;
    }
  });

  // Update TOC highlighting
  if (currentSection) {
    const sectionNumber = currentSection.dataset.sectionNumber;

    tocItems.forEach(item => {
      if (item.dataset.sectionNumber === sectionNumber) {
        item.classList.add('current-section');
        // Scroll TOC to show current item
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('current-section');
      }
    });
  }
}

// Update on scroll (throttled)
let scrollTimeout;
window.addEventListener('scroll', () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(updateCurrentSection, 100);
}, { passive: true });

/**
 * Jump to Section with Animation
 */
function jumpToSection(sectionNumber) {
  const targetSection = document.querySelector(`[data-section-number="${sectionNumber}"]`);

  if (targetSection) {
    // Smooth scroll to section
    targetSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    // Add jump highlight animation
    targetSection.classList.add('jump-target');

    // Focus section for accessibility
    targetSection.setAttribute('tabindex', '-1');
    targetSection.focus();

    // Remove animation class after completion
    setTimeout(() => {
      targetSection.classList.remove('jump-target');
    }, 2000);
  }
}

/**
 * Update TOC Scroll Progress Bar
 */
function updateTOCScrollProgress() {
  const progressBar = document.querySelector('.toc-scroll-progress');
  const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = (window.scrollY / documentHeight) * 100;

  if (progressBar) {
    progressBar.style.height = `${scrollPercent}%`;
  }
}

window.addEventListener('scroll', updateTOCScrollProgress, { passive: true });

/**
 * Toggle TOC Peek Button
 */
function toggleTOCPeek() {
  const toc = document.querySelector('.document-toc');
  toc.classList.toggle('auto-hidden');
}
```

---

## HTML STRUCTURE UPDATES

### Add Peek Button

```html
<!-- Add to document-viewer.ejs body -->
<button class="toc-peek-button"
        onclick="toggleTOCPeek()"
        aria-label="Toggle table of contents">
  <i class="bi bi-list"></i>
</button>
```

### Add Scroll Progress Bar

```html
<!-- Add inside .document-toc container -->
<div class="toc-scroll-progress"></div>
```

### Add Breadcrumb Navigation

```html
<!-- Add after document header -->
<div class="document-breadcrumb" aria-label="Document breadcrumb">
  <a href="#" class="breadcrumb-item" onclick="jumpToSection('1'); return false;">
    <span class="breadcrumb-number">1</span>
    <span>Article I</span>
  </a>
  <span class="breadcrumb-separator">/</span>
  <a href="#" class="breadcrumb-item" onclick="jumpToSection('1.2'); return false;">
    <span class="breadcrumb-number">1.2</span>
    <span>Section B</span>
  </a>
  <span class="breadcrumb-separator">/</span>
  <span class="breadcrumb-item current">
    <span class="breadcrumb-number">1.2.3</span>
    <span>Current Location</span>
  </span>
</div>
```

---

## IMPLEMENTATION CHECKLIST

### Backend Changes
- [ ] Modify section numbering logic to generate hierarchical numbers (1.1.1)
- [ ] Update database queries to include hierarchical numbering
- [ ] Ensure numbering persists across page reloads

### Frontend Changes
- [ ] Update section number badges to display hierarchical format
- [ ] Add TOC auto-hide functionality
- [ ] Implement current section detection and highlighting
- [ ] Add jump-to-section animation
- [ ] Create breadcrumb navigation component

### CSS Updates
- [ ] Add enhanced styles to `/public/css/section-numbering-toc.css`
- [ ] Test responsive behavior on mobile/tablet
- [ ] Verify accessibility (keyboard navigation, screen readers)

### JavaScript Updates
- [ ] Implement scroll detection for auto-hide
- [ ] Add current section tracking
- [ ] Create jump animation handlers
- [ ] Update TOC progress bar

---

## SUCCESS METRICS

- **Hierarchical clarity**: 100% users understand document structure
- **Navigation speed**: <2 seconds to jump to any section
- **Current position awareness**: Users always know where they are
- **Mobile usability**: TOC accessible with single tap
- **Accessibility**: WCAG AA compliance maintained

---

*Sequential numbers become hierarchical wisdom. The table of contents transforms into a visual map of knowledge.*

**- ILLUMINATOR "Master of Visual Clarity"**
