# Section Depth Analysis Report

**Date**: 2025-10-09
**Issue**: Sections only parse to 2 levels deep instead of supporting 5+ levels
**Status**: Root cause identified

---

## Executive Summary

The system **is designed** to support arbitrary depth (up to 10 levels in database, configurable maxDepth), but the **default configuration only defines 2 hierarchy levels** (Article and Section). This causes parsers and UI components to only recognize and display these 2 levels.

### Root Cause
**Configuration limitation, not code limitation**. The default hierarchy configuration only defines 2 levels:
- Level 0 (depth 0): Article
- Level 1 (depth 1): Section

### Impact
- Documents with deeper structure (subsections, clauses, subclauses) are not properly parsed
- Google Apps Script parser only creates sections for Article and Section levels
- Setup wizard only shows 2 level inputs
- Display components only render 2 levels

---

## Technical Analysis

### 1. Database Schema ✅ SUPPORTS 5+ LEVELS

**File**: `/database/migrations/001_generalized_schema.sql`

```sql
-- Line 163: depth field supports up to 10 levels
depth INTEGER NOT NULL DEFAULT 0,

-- Line 187: Database constraint allows max 10 levels
CHECK(depth >= 0 AND depth <= 10)

-- Line 36: Default config shows only 2 levels but can be extended
hierarchy_config JSONB DEFAULT '{
  "levels": [
    {"name": "Article", "numbering": "roman", "prefix": "Article"},
    {"name": "Section", "numbering": "numeric", "prefix": "Section"}
  ],
  "max_depth": 5
}'::jsonb
```

**Verdict**: Database fully supports 10 levels. Default config shows `max_depth: 5` but only defines 2 level definitions.

---

### 2. Organization Configuration ⚠️ ONLY DEFINES 2 LEVELS

**File**: `/src/config/organizationConfig.js` (Lines 69-88)

```javascript
hierarchy: {
  levels: [
    {
      name: 'Article',
      type: 'article',
      numbering: 'roman',
      prefix: 'Article ',
      depth: 0
    },
    {
      name: 'Section',
      type: 'section',
      numbering: 'numeric',
      prefix: 'Section ',
      depth: 1
    }
  ],
  maxDepth: 5,  // ← Says max 5, but only defines 2 levels!
  allowNesting: true
}
```

**Problem**: Configuration says `maxDepth: 5` but only defines levels 0 and 1. Missing levels 2-4.

---

### 3. Configuration Schema ✅ SUPPORTS UP TO 20 LEVELS

**File**: `/src/config/configSchema.js` (Line 53)

```javascript
maxDepth: Joi.number().integer().min(1).max(20).default(10)
```

**Verdict**: Validation schema supports up to 20 levels.

---

### 4. Google Apps Script Parser ⚠️ LIMITED TO 2 LEVELS

**File**: `/google-apps-script/SmartSemanticParser.gs`

The parser **hardcodes** only Article and Section detection:

```javascript
// Lines 119-134: Only matches ARTICLE
const articleMatch = text.match(/^ARTICLE\s+([IVX]+)(?:\s+(.+))?$/i);

// Lines 137-156: Only matches Section
const sectionMatch = text.match(/^Section\s+(\d+)(?::\s*(.+))?$/i);

// Lines 159-180: Matches lettered items (A, B, C) but doesn't create hierarchy
const letterMatch = text.match(/^([A-Z])\.\s+(.+)$/);

// Lines 184-201: Matches numbered items (1, 2, 3) but doesn't create hierarchy
const numberMatch = text.match(/^(\d+)\.\s+(.+)$/);

// Lines 204-220: Matches sub-letters (a, b, c) but doesn't create hierarchy
const subLetterMatch = text.match(/^([a-z])\.\s+(.+)$/);
```

**Problem**: Parser detects lettered/numbered items but doesn't assign them proper depth levels or create hierarchy. They're treated as text content, not structural elements.

---

### 5. Hierarchy Detector ✅ FLEXIBLE BUT RELIES ON CONFIG

**File**: `/src/parsers/hierarchyDetector.js`

```javascript
// Lines 12-40: Dynamically detects based on config
detectHierarchy(text, organizationConfig) {
  const levels = organizationConfig.hierarchy?.levels || [];  // ← Only gets 2 levels from config
  const detected = [];

  for (const level of levels) {
    // Build detection patterns for this level
    const patterns = this.buildDetectionPatterns(level);
    // ... pattern matching
  }
}
```

**Verdict**: Code is flexible and can handle any number of levels, but it only processes levels defined in the config (currently 2).

---

### 6. Setup Wizard UI ⚠️ ONLY SHOWS 2 INPUTS

**File**: `/public/js/setup-wizard.js` (Lines 219-231)

```javascript
updateStructureLabels(structure) {
  const level1Input = document.getElementById('level1Name');
  const level2Input = document.getElementById('level2Name');
  // ← No level3, level4, level5 inputs!

  const labels = {
    'article-section': { level1: 'Article', level2: 'Section' },
    'chapter-section': { level1: 'Chapter', level2: 'Section' },
    'part-section': { level1: 'Part', level2: 'Section' }
  };
}
```

**Problem**: UI only has input fields for 2 levels.

---

### 7. Test Coverage Shows Intent for 3+ Levels

**File**: `/tests/unit/parsers.test.js` (Lines 242-258)

```javascript
describe('Multi-level Depth', () => {
  test('should handle 3+ level hierarchies', () => {
    const content = `
ARTICLE I GOVERNANCE
Chapter 1: Overview
Section 1: Purpose
Subsection A: Details
`;

    const sections = parseDocumentHierarchy(content);

    // Current parser handles 2 levels well
    expect(sections.length).toBeGreaterThan(0);
  });
});
```

**Note**: Test acknowledges current limitation ("Current parser handles 2 levels well") but shows intent to support more.

---

## Solution: Required Changes

### Change 1: Update Default Hierarchy Configuration

**File**: `/src/config/organizationConfig.js`

Add levels 2-4 to the default configuration:

```javascript
hierarchy: {
  levels: [
    {
      name: 'Article',
      type: 'article',
      numbering: 'roman',
      prefix: 'Article ',
      depth: 0
    },
    {
      name: 'Section',
      type: 'section',
      numbering: 'numeric',
      prefix: 'Section ',
      depth: 1
    },
    // NEW: Add these levels
    {
      name: 'Subsection',
      type: 'subsection',
      numbering: 'alpha',
      prefix: '',
      depth: 2
    },
    {
      name: 'Clause',
      type: 'clause',
      numbering: 'numeric',
      prefix: '',
      depth: 3
    },
    {
      name: 'Subclause',
      type: 'subclause',
      numbering: 'alphaLower',
      prefix: '',
      depth: 4
    }
  ],
  maxDepth: 5,
  allowNesting: true
}
```

### Change 2: Update Google Apps Script Parser

**File**: `/google-apps-script/SmartSemanticParser.gs`

Enhance parsing to create proper depth hierarchy:

```javascript
// After line 180, add depth tracking:
function parseWithGranularity(body, granularity) {
  // ... existing code ...

  let currentDepth = 0;
  let parentStack = []; // Track parent sections

  // When detecting lettered items (currently line 159)
  if (letterMatch || letterParenMatch) {
    const letter = letterMatch ? letterMatch[1] : letterParenMatch[1].toUpperCase();
    const content = letterMatch ? letterMatch[2] : letterParenMatch[2];

    // NEW: Set proper depth
    currentDepth = 2; // Subsection level
    currentLetterItem = letter;

    // NEW: Track parent relationship
    if (parentStack.length < 2) {
      parentStack[1] = { type: 'subsection', number: letter };
    }

    // Create section with depth metadata
    if (granularity === 'SUBSECTION' || granularity === 'ALL_ITEMS') {
      sections.push(createSectionWithDepth(
        currentArticle, currentSection, letter, null, null,
        content, currentDepth
      ));
    }
  }

  // Similar updates for numbered items (depth 3) and sub-letters (depth 4)
}

// NEW: Enhanced section creation
function createSectionWithDepth(article, section, letterItem, numberItem, subLetterItem, text, depth) {
  return {
    citation: buildCitation(article, section, letterItem, numberItem, subLetterItem),
    title: buildTitle(article, section, letterItem, numberItem, subLetterItem),
    text: text.trim(),
    depth: depth,  // NEW
    parent_id: getParentId(depth)  // NEW
  };
}
```

### Change 3: Update Setup Wizard UI

**File**: `/views/setup/*.ejs` and `/public/js/setup-wizard.js`

Add input fields for levels 3-5:

```html
<!-- Add to setup form -->
<div class="form-group">
  <label>Level 3 Name (Subsection)</label>
  <input type="text" id="level3Name" placeholder="e.g., Subsection, Paragraph">
</div>

<div class="form-group">
  <label>Level 4 Name (Clause)</label>
  <input type="text" id="level4Name" placeholder="e.g., Clause, Item">
</div>

<div class="form-group">
  <label>Level 5 Name (Subclause)</label>
  <input type="text" id="level5Name" placeholder="e.g., Subclause, Sub-item">
</div>
```

Update JavaScript to handle 5 levels:

```javascript
updateStructureLabels(structure) {
  const inputs = [
    document.getElementById('level1Name'),
    document.getElementById('level2Name'),
    document.getElementById('level3Name'),
    document.getElementById('level4Name'),
    document.getElementById('level5Name')
  ];

  const labels = {
    'article-section': [
      'Article', 'Section', 'Subsection', 'Clause', 'Subclause'
    ],
    'chapter-section': [
      'Chapter', 'Section', 'Subsection', 'Paragraph', 'Item'
    ]
  };

  const labelSet = labels[structure] || labels['article-section'];
  inputs.forEach((input, i) => {
    if (input) input.value = labelSet[i] || '';
  });
}
```

### Change 4: Update Database Default Config

**File**: `/database/migrations/001_generalized_schema.sql` (Line 30-36)

```sql
hierarchy_config JSONB DEFAULT '{
  "levels": [
    {"name": "Article", "numbering": "roman", "prefix": "Article", "depth": 0},
    {"name": "Section", "numbering": "numeric", "prefix": "Section", "depth": 1},
    {"name": "Subsection", "numbering": "alpha", "prefix": "", "depth": 2},
    {"name": "Clause", "numbering": "numeric", "prefix": "", "depth": 3},
    {"name": "Subclause", "numbering": "alphaLower", "prefix": "", "depth": 4}
  ],
  "max_depth": 5
}'::jsonb
```

---

## Verification Steps

1. **Config Check**: Verify default config has 5 levels defined
2. **Database Check**: Confirm hierarchy_config in organizations table supports 5 levels
3. **Parser Test**: Test Google Apps Script with document containing:
   - Article I
   - Section 1
   - Subsection A
   - Clause 1
   - Subclause a
4. **UI Test**: Verify setup wizard shows 5 level inputs
5. **Display Test**: Confirm section display shows all 5 levels properly indented

---

## File Modifications Summary

| File | Lines | Change Type | Priority |
|------|-------|-------------|----------|
| `/src/config/organizationConfig.js` | 69-88 | Add 3 new hierarchy levels | **HIGH** |
| `/google-apps-script/SmartSemanticParser.gs` | 98-267 | Enhance depth detection | **HIGH** |
| `/public/js/setup-wizard.js` | 219-260 | Add level 3-5 UI controls | **MEDIUM** |
| `/views/setup/step2.ejs` | N/A | Add level 3-5 input fields | **MEDIUM** |
| `/database/migrations/001_generalized_schema.sql` | 30-36 | Update default hierarchy | **LOW** |
| `/src/parsers/googleDocsParser.js` | 85-197 | Verify depth handling | **LOW** |

---

## Architecture Strengths ✅

1. **Database**: Fully supports 10 levels with materialized path
2. **Hierarchy Detector**: Flexible, config-driven design
3. **Schema Validation**: Supports up to 20 levels
4. **Path Materialization**: Efficient ancestor/descendant queries

## Current Limitations ❌

1. **Default Config**: Only 2 levels defined (Article, Section)
2. **Google Apps Script**: Hardcoded to detect only Article/Section
3. **UI**: Only 2 level input fields in setup wizard
4. **Documentation**: No examples of 5+ level structures

---

## Next Steps

1. Update `organizationConfig.js` with 5 default levels
2. Enhance Google Apps Script parser for depth detection
3. Add UI controls for levels 3-5 in setup wizard
4. Update documentation with multi-level examples
5. Add integration tests for 5-level hierarchies
6. Update existing organizations to use new config

---

## Conclusion

**The system architecture fully supports 5+ levels**, but the default configuration and parsing logic need to be extended to utilize this capability. This is a **configuration and implementation gap**, not a fundamental architectural limitation.

**Estimated effort**: 4-6 hours
- Config updates: 1 hour
- Parser enhancement: 2-3 hours
- UI updates: 1-2 hours
- Testing: 1 hour
