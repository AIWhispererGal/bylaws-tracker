# SECTION CARD STRUCTURE - EMERGENCY FIX

## CRITICAL FINDING: The Actual Section Card HTML

**Location**: `/views/dashboard/document-viewer.ejs` lines 482-487

### EXACT Opening Tag:
```html
<div class="section-card"
     id="<%= section.anchorId %>"
     data-section-id="<%= section.id %>"
     data-section-number="<%= section.number %>"
     data-depth="<%= section.depth || 0 %>"
     onclick="toggleSection('<%= section.id %>')">
```

## Key Findings:

### 1. Class Structure
- **Primary class**: `section-card` (NOT `.card.shadow-sm`)
- **No shadow-sm class** on the section card itself
- **Single, simple class name**

### 2. ID Pattern
- **ID attribute**: Uses `section.anchorId` (NOT `section-{id}`)
- Example: `id="article-2-3"` or similar anchor-based IDs
- **data-section-id**: Contains the numeric section ID

### 3. What Makes Section Cards Unique
- Class: `section-card`
- Has `data-section-id` attribute
- Has `data-section-number` attribute
- Has `data-depth` attribute
- Has `onclick="toggleSection(...)"` handler

### 4. Text Areas Inside Section Cards
Section cards contain these child elements:
- `.section-text-full` with `id="section-text-{id}"`
- `.section-comparison-wrapper`
- `.suggestion-list`
- Various badges and buttons

## THE BUG:

**Current selector**: `.card.shadow-sm[id^="section-"]`
- ❌ Looking for `.card.shadow-sm` class (doesn't exist on section cards)
- ❌ Looking for `id` starting with "section-" (wrong ID pattern)

**Correct selector**: `.section-card`
- ✅ Matches all section card divs
- ✅ Simple and accurate
- ✅ Won't match child elements

## Alternative Selectors (all valid):

1. **Most specific**: `.section-card[data-section-id]`
2. **Simple**: `.section-card`
3. **With onclick**: `.section-card[onclick^="toggleSection"]`

## Verification:

Looking at line 482:
```ejs
<div class="section-card"
```

This is the ONLY div with class `section-card` in the section rendering loop.

## Fix Required:

In `public/js/toc.js`:
```javascript
// WRONG:
const sections = document.querySelectorAll('.card.shadow-sm[id^="section-"]');

// CORRECT:
const sections = document.querySelectorAll('.section-card');
```

## Impact:

The TOC is showing 0 sections because the selector matches NOTHING. The actual section cards use a completely different class structure than what the TOC is looking for.
