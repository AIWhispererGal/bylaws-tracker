# TOC Selector Fix - Section Cards Only

**Date**: 2025-10-28
**Swarm**: Hive Mind (swarm-1761627819200-fnb2ykjdl)
**Agent**: Coder
**Priority**: HIGH

## Problem

The Table of Contents (TOC) was showing duplicate "Untitled" entries because the selector was picking up text elements (`data-section-id="text-..."`) in addition to actual section cards.

**Symptoms:**
- TOC showed 120 items instead of expected 60
- Many "Untitled" duplicate entries
- Text areas inside section cards were being indexed as separate sections

## Root Cause

**File**: `/public/js/section-numbering-toc.js`
**Line**: 29

**Original Selector** (Too Broad):
```javascript
const sectionCards = document.querySelectorAll('[id^="section-"]');
```

This selector matched ANY element with an `id` starting with "section-", which included:
- ✅ Actual section cards: `<div id="section-123" class="card shadow-sm">`
- ❌ Text areas inside cards: `<div id="section-text-123">` (if they existed)
- ❌ Any other element with `id^="section-"`

## Solution Applied

**Fixed Selector** (Specific to Section Cards):
```javascript
const sectionCards = document.querySelectorAll('.card.shadow-sm[id^="section-"]');
```

This selector NOW requires:
1. ✅ Element must have class `card`
2. ✅ Element must have class `shadow-sm`
3. ✅ Element must have `id` starting with "section-"

**Why This Works:**
- Section cards use: `<div class="card shadow-sm" id="section-{id}">`
- Text elements DON'T have both `card` and `shadow-sm` classes
- Filters out all non-card elements

## Changes Made

**File Modified**: `/public/js/section-numbering-toc.js`

**Line 25-30** (buildSectionIndex method):
```javascript
// BEFORE:
const sectionCards = document.querySelectorAll('[id^="section-"]');

// AFTER:
const sectionCards = document.querySelectorAll('.card.shadow-sm[id^="section-"]');
```

**Comment Added** (line 27-28):
```javascript
// Only select elements with id starting with "section-" AND having the section card class
```

## Expected Outcome

After this fix:
1. ✅ TOC shows exactly 60 sections (matching actual section cards)
2. ✅ NO "Untitled" duplicate entries
3. ✅ Each TOC item corresponds to a real section card
4. ✅ Text elements inside cards are ignored
5. ✅ Section numbering is sequential 1-60

## Testing Checklist

- [ ] Refresh page (`Ctrl+Shift+R` to clear cache)
- [ ] Open TOC (click TOC button or press `Ctrl+K`)
- [ ] Count total sections in TOC (should be 60, not 120)
- [ ] Verify NO "Untitled" entries
- [ ] Click each TOC item to verify it scrolls to a real section
- [ ] Verify section numbering badges show 1-60
- [ ] Test search functionality (should search only 60 items)
- [ ] Test "Collapse All" button

## Alternative Approaches Considered

### Option 1: Filter by ID prefix (Not Chosen)
```javascript
const sections = document.querySelectorAll('[data-section-id^="section-"]');
```
**Why Not**: Relies on `data-section-id`, not the actual element `id`

### Option 2: Exclude text elements (Not Chosen)
```javascript
const sections = document.querySelectorAll('[id^="section-"]:not([id*="text-"])');
```
**Why Not**: Assumes text elements have "text-" in ID, which may not always be true

### Option 3: Use specific class (CHOSEN) ✅
```javascript
const sections = document.querySelectorAll('.card.shadow-sm[id^="section-"]');
```
**Why Chosen**:
- Most reliable (targets exact card structure)
- Future-proof (won't break if text elements change)
- Explicit about what we're selecting

## Coordination

**Hooks Used:**
```bash
npx claude-flow@alpha hooks pre-task --description "Fix TOC selector for section cards only"
npx claude-flow@alpha hooks session-restore --session-id "swarm-1761627819200-fnb2ykjdl"
npx claude-flow@alpha hooks post-edit --file "public/js/section-numbering-toc.js" --memory-key "hive/coder/toc-selector-fix"
```

**Memory Key**: `hive/coder/toc-selector-fix`

## Related Files

- **Modified**: `/public/js/section-numbering-toc.js` (line 29)
- **Created**: `/docs/fixes/TOC_SELECTOR_FIX.md` (this file)

## Status

✅ **FIX APPLIED**
⏳ **AWAITING TESTING**

---

**Next Steps:**
1. Refresh page to load updated JavaScript
2. Open TOC and verify 60 sections (not 120)
3. Confirm no "Untitled" duplicates
4. Test all TOC functionality (search, collapse, navigation)
