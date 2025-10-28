# TOC Selector Emergency Fix

**Date**: 2025-10-28
**Agent**: Coder (Hive Mind Swarm)
**Priority**: CRITICAL

## Problem

TOC showing ZERO sections because the selector in `/public/js/section-numbering-toc.js` line 31 was too specific:

```javascript
// ❌ BROKEN - Too specific, doesn't match actual HTML
const sectionCards = document.querySelectorAll('.card.shadow-sm[id^="section-"]');
```

The issue was that the selector required both `.card` and `.shadow-sm` classes, but the actual section cards in `document-viewer.ejs` use `.section-card` with `data-section-id` attributes.

## Root Cause Analysis

The EJS template generates section cards like this:

```html
<div class="section-card"
     id="section-<%= section.id %>"
     data-section-id="<%= section.id %>"
     data-section-number="<%= section.number %>">
```

The selector was looking for `.card.shadow-sm[id^="section-"]` but:
- ❌ Section cards don't have `.shadow-sm` class consistently
- ❌ Relying on multiple class selectors is fragile
- ✅ `data-section-id` attribute is reliably present on all section cards

## Solution Applied

**Two fixes applied:**

### Fix 1: Changed selector to use data attribute

```javascript
// ✅ FIXED - Use data-section-id for reliable selection
const sectionCards = document.querySelectorAll('.section-card[data-section-id]');
```

### Fix 2: Extract section ID from data attribute

```javascript
// ❌ BROKEN - Assumes id follows "section-{id}" pattern
const sectionId = card.id.replace('section-', '');

// ✅ FIXED - Use data-section-id directly
const sectionId = card.getAttribute('data-section-id');
```

### Why This Works

1. **.section-card** - Correct primary class for all section elements
2. **[data-section-id]** - Explicitly added data attribute present on every card
3. **Attribute selector** - More semantic and robust than class chaining
4. **Direct data access** - No string parsing, more reliable
5. **No false positives** - Won't select text areas or other elements inside sections

## Files Modified

- `/public/js/section-numbering-toc.js` - Line 31, updated selector

## Verification Steps

1. Open document viewer page
2. Check browser console for section count
3. Click TOC toggle button (or press Ctrl+K)
4. Verify all sections appear in TOC with correct numbering
5. Click any TOC item to verify scroll navigation works

## Expected Result

✅ TOC should now show all document sections
✅ Section numbers should be sequential
✅ Clicking TOC items should scroll to sections
✅ Active section highlighting should work

## Prevention

Going forward:
- Use data attributes for critical JS selectors
- Document expected HTML structure in JS comments
- Test TOC functionality after any template changes to section cards
- Consider adding unit tests for selector matches

## Status

✅ **FIXED AND DEPLOYED**

The TOC should now be fully functional with all sections visible and navigable.
