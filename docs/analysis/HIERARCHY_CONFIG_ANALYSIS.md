# Hierarchy Configuration Analysis
**ANALYST Agent Report**
**Date:** 2025-10-22
**Mission:** Analyze organization hierarchy configuration and determine pattern detection requirements for full 10-level support

---

## Executive Summary

**KEY FINDINGS:**
- ✅ **10-Level Configuration Exists:** Default config defines all 10 levels (depth 0-9)
- ✅ **Pattern Detection Working:** Current hierarchyDetector correctly builds patterns for all levels
- ⚠️ **Line-Start Numbering Missing:** No support for bare numbers at line start (e.g., "1.", "a)", "i.")
- ⚠️ **Prefix-Only Detection:** Current system ONLY matches when prefix is present
- 🎯 **Enhancement Needed:** Add line-start pattern detection for deeper hierarchy levels

**Current Capability:** Detects prefixed patterns only (e.g., "Article I", "Section 1")
**Missing Capability:** Line-start bare numbering (e.g., "1.", "a)", "i.", common in sub-levels)

---

## 1. Organization Hierarchy Configuration

### 1.1 Configuration Location

**Primary Source:** `/src/config/organizationConfig.js`

**Configuration Hierarchy:**
1. **Database** (highest priority) - `organizations.hierarchy_config` JSONB column
2. **File System** - `config/{organizationId}.json` or `config/organization.json`
3. **Environment Variables** - Limited hierarchy override support
4. **Defaults** - Built-in 10-level configuration (see below)

### 1.2 Default 10-Level Hierarchy

**Complete Configuration (Lines 70-141 of organizationConfig.js):**

```javascript
hierarchy: {
  levels: [
    // DEPTH 0 - Root level
    {
      name: 'Article',
      type: 'article',
      numbering: 'roman',      // I, II, III, IV, V...
      prefix: 'Article ',
      depth: 0
    },

    // DEPTH 1 - Primary subdivision
    {
      name: 'Section',
      type: 'section',
      numbering: 'numeric',    // 1, 2, 3, 4, 5...
      prefix: 'Section ',
      depth: 1
    },

    // DEPTH 2 - Secondary subdivision
    {
      name: 'Subsection',
      type: 'subsection',
      numbering: 'numeric',    // 1, 2, 3, 4, 5...
      prefix: 'Subsection ',
      depth: 2
    },

    // DEPTH 3 - Tertiary subdivision
    {
      name: 'Paragraph',
      type: 'paragraph',
      numbering: 'alpha',      // A, B, C, D, E...
      prefix: '(',             // Format: (A), (B), (C)
      depth: 3
    },

    // DEPTH 4 - Quaternary subdivision
    {
      name: 'Subparagraph',
      type: 'subparagraph',
      numbering: 'numeric',    // 1, 2, 3, 4, 5...
      prefix: '',              // ⚠️ NO PREFIX - line-start only
      depth: 4
    },

    // DEPTH 5 - Quinary subdivision
    {
      name: 'Clause',
      type: 'clause',
      numbering: 'alphaLower', // a, b, c, d, e...
      prefix: '(',             // Format: (a), (b), (c)
      depth: 5
    },

    // DEPTH 6 - Senary subdivision
    {
      name: 'Subclause',
      type: 'subclause',
      numbering: 'roman',      // i, ii, iii, iv, v...
      prefix: '',              // ⚠️ NO PREFIX - line-start only
      depth: 6
    },

    // DEPTH 7 - Septenary subdivision
    {
      name: 'Item',
      type: 'item',
      numbering: 'numeric',    // 1, 2, 3, 4, 5...
      prefix: '•',             // Bullet point
      depth: 7
    },

    // DEPTH 8 - Octenary subdivision
    {
      name: 'Subitem',
      type: 'subitem',
      numbering: 'alpha',      // A, B, C, D, E...
      prefix: '◦',             // Hollow bullet
      depth: 8
    },

    // DEPTH 9 - Maximum depth
    {
      name: 'Point',
      type: 'point',
      numbering: 'numeric',    // 1, 2, 3, 4, 5...
      prefix: '-',             // Dash
      depth: 9
    }
  ],
  maxDepth: 10,
  allowNesting: true
}
```

### 1.3 Numbering Schemes Supported

**From `numberingSchemes.js` (Lines 6-295):**

| Scheme | Format | Example | Conversion Methods |
|--------|--------|---------|-------------------|
| `roman` | Roman numerals | I, II, III, IV, V, X, L, C, D, M | `toRoman()`, `fromRoman()` |
| `numeric` | Arabic numbers | 1, 2, 3, 4, 5... | Built-in `parseInt()` |
| `alpha` | Uppercase letters | A, B, C, D, E... Z, AA, AB... | `toAlpha(false)`, `fromAlpha(false)` |
| `alphaLower` | Lowercase letters | a, b, c, d, e... z, aa, ab... | `toAlpha(true)`, `fromAlpha(true)` |
| `ordinal` | Ordinal numbers | 1st, 2nd, 3rd, 4th... | `toOrdinal()` |
| `words` | Written numbers | one, two, three, four... | `toWords()` |

---

## 2. Current Pattern Detection Analysis

### 2.1 HierarchyDetector Architecture

**Primary Logic:** `/src/parsers/hierarchyDetector.js` (Lines 12-40)

**Detection Flow:**
```javascript
detectHierarchy(text, organizationConfig) {
  const levels = organizationConfig.hierarchy?.levels || [];
  const detected = [];

  for (const level of levels) {
    // BUILD patterns for this level
    const patterns = this.buildDetectionPatterns(level);

    for (const pattern of patterns) {
      // MATCH all occurrences
      const matches = text.matchAll(pattern.regex);

      for (const match of matches) {
        detected.push({
          level: level.name,
          type: level.type,
          number: match[1],
          prefix: level.prefix,
          fullMatch: match[0],
          index: match.index,
          numberingScheme: level.numbering,
          depth: level.depth
        });
      }
    }
  }

  return detected.sort((a, b) => a.index - b.index);
}
```

### 2.2 Current Pattern Building Logic

**From `buildDetectionPatterns()` (Lines 45-119):**

**Roman Numerals Pattern:**
```javascript
case 'roman':
  patterns.push({
    regex: new RegExp(
      `${escapedPrefix}${whitespacePattern}([IVXLCDMivxlcdm]+)(?:\\s|\\.|:|$)`,
      'gi'
    ),
    scheme: 'roman'
  });
```
**Example Matches:** `Article I`, `ARTICLE\tIV`, `Section III.`

**Numeric Pattern:**
```javascript
case 'numeric':
  patterns.push({
    regex: new RegExp(
      `${escapedPrefix}${whitespacePattern}(\\d+)(?:\\s|\\.|:|$)`,
      'gi'
    ),
    scheme: 'numeric'
  });
```
**Example Matches:** `Section 1`, `Subsection 12`, `SECTION\t5`

**Uppercase Alpha Pattern:**
```javascript
case 'alpha':
  patterns.push({
    regex: new RegExp(
      `${escapedPrefix}${whitespacePattern}([A-Z]+)(?:\\s|\\.|:|$)`,
      'g'
    ),
    scheme: 'alpha'
  });
```
**Example Matches:** `(A)`, `(AB)`, `Paragraph A`

**Lowercase Alpha Pattern:**
```javascript
case 'alphaLower':
  patterns.push({
    regex: new RegExp(
      `${escapedPrefix}${whitespacePattern}([a-z]+)(?:\\s|\\.|:|$)`,
      'g'
    ),
    scheme: 'alphaLower'
  });
```
**Example Matches:** `(a)`, `(xyz)`, `clause a`

### 2.3 Critical Gap: Empty Prefix Levels

**Problematic Configuration (Depth 4 and 6):**
```javascript
// DEPTH 4
{
  name: 'Subparagraph',
  numbering: 'numeric',
  prefix: '',              // ⚠️ EMPTY PREFIX
  depth: 4
}

// DEPTH 6
{
  name: 'Subclause',
  numbering: 'roman',
  prefix: '',              // ⚠️ EMPTY PREFIX
  depth: 6
}
```

**Current Behavior (Line 49-52):**
```javascript
if (!level.prefix) {
  console.warn(`[HierarchyDetector] Level ${level.type} has no prefix defined, skipping...`);
  return patterns;  // ❌ RETURNS EMPTY ARRAY - NO DETECTION
}
```

**Result:** Depth 4 and 6 are **NOT DETECTED** at all!

---

## 3. Missing Capability: Line-Start Numbering Detection

### 3.1 Real-World Example

**Typical Legal Document Structure:**
```
Article I - NAME
Section 1. Membership
  (a) Any person residing within the boundaries...
  (b) Stakeholders who own property...
    1. Property must be within boundaries
    2. Proof of ownership required
      a. Title deed
      b. Property tax records
        i. Current year tax bill
        ii. Previous two years
          • Supporting documentation
          • Notarized affidavit
            ◦ Must be dated within 30 days
            ◦ Original signature required
              - Blue or black ink
              - Legible signature
```

**What's Currently Detected:**
- ✅ `Article I` (depth 0, prefix "Article ")
- ✅ `Section 1` (depth 1, prefix "Section ")
- ✅ `(a)` (depth 3, prefix "(")
- ✅ `(b)` (depth 3, prefix "(")
- ❌ `1.` (depth 4, NO prefix configured)
- ❌ `2.` (depth 4, NO prefix configured)
- ✅ `(a)` (depth 5, prefix "(")
- ✅ `(b)` (depth 5, prefix "(")
- ❌ `i.` (depth 6, NO prefix configured)
- ❌ `ii.` (depth 6, NO prefix configured)
- ✅ `•` (depth 7, prefix "•")
- ✅ `◦` (depth 8, prefix "◦")
- ✅ `-` (depth 9, prefix "-")

**Missing 4 out of 10 levels!** (Depths 4 and 6 completely skipped)

### 3.2 Line-Start Pattern Requirements

**Pattern Definition:**
- **Location:** Start of line (optionally after whitespace/indentation)
- **Format:** `{number}{delimiter}` where delimiter is `.`, `)`, or `:`
- **Examples:**
  - `1.` → depth 4 (numeric)
  - `2.` → depth 4 (numeric)
  - `a.` → depth 5 (alpha lower)
  - `b)` → depth 5 (alpha lower)
  - `i.` → depth 6 (roman lower)
  - `ii)` → depth 6 (roman lower)

**Regex Pattern Examples:**

**Numeric line-start:**
```javascript
/^[\s]*(\d+)[.):]\s+/gm
```
Matches: `1. `, `  2. `, `    3) `

**Lowercase alpha line-start:**
```javascript
/^[\s]*([a-z])[.):]\s+/gm
```
Matches: `a. `, `  b) `, `    c: `

**Lowercase roman line-start:**
```javascript
/^[\s]*([ivxlcdm]+)[.):]\s+/gm
```
Matches: `i. `, `  ii) `, `    iii. `

---

## 4. Recommended Pattern Detection Enhancement

### 4.1 Enhanced Detection Logic

**Add to `buildDetectionPatterns()` method:**

```javascript
buildDetectionPatterns(level) {
  const patterns = [];

  // EXISTING: Handle missing prefix gracefully
  if (!level.prefix) {
    // ✨ NEW: Instead of skipping, build LINE-START pattern
    return this.buildLineStartPattern(level);
  }

  // ... existing prefix-based pattern building ...
}

/**
 * Build line-start patterns for levels without prefixes
 * Detects bare numbering at start of lines: "1.", "a)", "i."
 */
buildLineStartPattern(level) {
  const patterns = [];

  switch (level.numbering) {
    case 'roman':
      // Match: "i. ", "ii. ", "iii) " at line start
      patterns.push({
        regex: /^[\s]*([ivxlcdm]+)[.):]\s+/gim,
        scheme: 'roman',
        requiresLineStart: true
      });
      break;

    case 'numeric':
      // Match: "1. ", "2) ", "3: " at line start
      patterns.push({
        regex: /^[\s]*(\d+)[.):]\s+/gm,
        scheme: 'numeric',
        requiresLineStart: true
      });
      break;

    case 'alpha':
      // Match: "A. ", "B) ", "C: " at line start
      patterns.push({
        regex: /^[\s]*([A-Z])[.):]\s+/gm,
        scheme: 'alpha',
        requiresLineStart: true
      });
      break;

    case 'alphaLower':
      // Match: "a. ", "b) ", "c: " at line start
      patterns.push({
        regex: /^[\s]*([a-z])[.):]\s+/gm,
        scheme: 'alphaLower',
        requiresLineStart: true
      });
      break;

    default:
      console.warn(`[HierarchyDetector] Unknown numbering scheme for line-start: ${level.numbering}`);
  }

  return patterns;
}
```

### 4.2 Context-Aware Disambiguation

**Problem:** Line-start patterns are AMBIGUOUS without context.

Example:
```
Section 1. Membership
  a. Individual members
    1. Must be residents       ← Is this depth 2 or depth 4?
    2. Must pay dues
```

**Solution: Context-Aware Stack Tracking**

```javascript
// Track parent context during parsing
const contextStack = [];

for (const detectedItem of detected) {
  // Pop stack until we find valid parent
  while (contextStack.length > 0 &&
         contextStack[contextStack.length - 1].depth >= detectedItem.depth) {
    contextStack.pop();
  }

  // Determine actual depth based on parent
  if (contextStack.length === 0) {
    detectedItem.depth = 0;  // Root level
  } else {
    const parent = contextStack[contextStack.length - 1];
    detectedItem.depth = parent.depth + 1;
  }

  contextStack.push(detectedItem);
}
```

### 4.3 Validation Rules

**Numbering Sequence Validation:**
```javascript
validateSequence(sections) {
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1];
    const curr = sections[i];

    // Same parent + same depth = must be sequential
    if (curr.parent_section_id === prev.parent_section_id &&
        curr.depth === prev.depth) {

      const expectedNumber = this.increment(prev.number, prev.numberingScheme);
      if (curr.number !== expectedNumber) {
        console.warn(`Numbering skip: Expected ${expectedNumber}, got ${curr.number}`);
      }
    }
  }
}
```

---

## 5. Implementation Recommendations

### 5.1 Priority Enhancements

**HIGH PRIORITY:**
1. ✅ Add `buildLineStartPattern()` method to hierarchyDetector.js
2. ✅ Modify `buildDetectionPatterns()` to call it for empty prefixes
3. ✅ Add context-aware depth calculation to wordParser.js
4. ✅ Implement sequence validation for sibling sections

**MEDIUM PRIORITY:**
5. ⚠️ Add configuration option for line-start pattern strictness
6. ⚠️ Implement auto-detection of line-start vs prefix formats
7. ⚠️ Add unit tests for all 10 depth levels

**LOW PRIORITY:**
8. 📋 Add visual diagram of detected hierarchy to parse output
9. 📋 Create hierarchy validation report endpoint
10. 📋 Add support for mixed formats within same document

### 5.2 Testing Requirements

**Test Coverage Needed:**

```javascript
describe('HierarchyDetector - 10 Level Support', () => {
  test('Detects all 10 configured levels', () => {
    const text = `
      Article I - NAME
      Section 1. Membership
        (A) Individual Members
          1. Residency requirement
            a. Within boundaries
              i. Physical address
                • Supporting documents
                  ◦ Utility bill
                    - Gas or electric
    `;

    const detected = hierarchyDetector.detectHierarchy(text, config);

    expect(detected).toHaveLength(10);
    expect(detected.map(d => d.depth)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });

  test('Line-start numeric pattern (depth 4)', () => {
    const text = `Section 1.\n  1. First item\n  2. Second item`;
    const detected = hierarchyDetector.detectHierarchy(text, config);

    const depth4Items = detected.filter(d => d.depth === 4);
    expect(depth4Items).toHaveLength(2);
    expect(depth4Items[0].number).toBe('1');
    expect(depth4Items[1].number).toBe('2');
  });

  test('Line-start roman pattern (depth 6)', () => {
    const text = `Section 1.\n  (a) Paragraph\n    i. First\n    ii. Second`;
    const detected = hierarchyDetector.detectHierarchy(text, config);

    const depth6Items = detected.filter(d => d.depth === 6);
    expect(depth6Items).toHaveLength(2);
    expect(depth6Items[0].number).toBe('i');
    expect(depth6Items[1].number).toBe('ii');
  });
});
```

### 5.3 Database Schema Validation

**Current Schema Already Supports 10 Levels:**

From `/database/migrations/001_generalized_schema.sql` (Line 187):
```sql
CHECK(depth >= 0 AND depth <= 10), -- Max 10 levels
```

**✅ No database changes required!**

---

## 6. Configuration Validation

### 6.1 Validate Organization Hierarchy Config

**Check for Complete Configuration:**

```javascript
async function validateHierarchyConfig(supabase, organizationId) {
  const { data: org } = await supabase
    .from('organizations')
    .select('hierarchy_config')
    .eq('id', organizationId)
    .single();

  const config = org?.hierarchy_config || getDefaultConfig().hierarchy;
  const levels = config.levels || [];

  // Verify all 10 depths are defined
  const depthsCovered = new Set(levels.map(l => l.depth));
  const missingDepths = [];

  for (let depth = 0; depth < 10; depth++) {
    if (!depthsCovered.has(depth)) {
      missingDepths.push(depth);
    }
  }

  if (missingDepths.length > 0) {
    console.warn(`Missing hierarchy levels for depths: ${missingDepths.join(', ')}`);
  }

  return {
    complete: missingDepths.length === 0,
    levelsConfigured: levels.length,
    missingDepths
  };
}
```

### 6.2 Empty Prefix Audit

**Find Levels Without Prefixes:**

```javascript
function auditEmptyPrefixes(organizationConfig) {
  const levels = organizationConfig.hierarchy?.levels || [];
  const emptyPrefixLevels = levels.filter(l => !l.prefix || l.prefix.trim() === '');

  console.log('Levels requiring line-start detection:');
  emptyPrefixLevels.forEach(level => {
    console.log(`  - Depth ${level.depth}: ${level.name} (${level.numbering})`);
  });

  return emptyPrefixLevels;
}
```

**Expected Output for Default Config:**
```
Levels requiring line-start detection:
  - Depth 4: Subparagraph (numeric)
  - Depth 6: Subclause (roman)
```

---

## 7. Conclusion

### Summary of Findings

**✅ Configuration Status:**
- All 10 hierarchy levels ARE configured in default settings
- Database schema supports 10-level depth
- Numbering conversion methods exist for all schemes

**❌ Detection Gap:**
- Empty prefix levels (depth 4, 6) are SKIPPED by current detector
- Line-start numbering patterns are NOT SUPPORTED
- 20% of hierarchy levels are currently undetectable

**🎯 Required Enhancement:**
- Add `buildLineStartPattern()` method for empty-prefix levels
- Implement context-aware depth calculation
- Add sequence validation for sibling sections

**⏱️ Implementation Estimate:** 4-6 hours

**Impact:** Enables full 10-level hierarchy parsing for complex legal documents

---

## Appendix A: Pattern Detection Examples

### Current Detection (With Prefix)

**Input Text:**
```
Article I - NAME
Section 1. Membership Requirements
Section 2. Voting Rights
```

**Detected Patterns:**
```javascript
[
  { type: 'article', depth: 0, number: 'I', prefix: 'Article ', fullMatch: 'Article I' },
  { type: 'section', depth: 1, number: '1', prefix: 'Section ', fullMatch: 'Section 1' },
  { type: 'section', depth: 1, number: '2', prefix: 'Section ', fullMatch: 'Section 2' }
]
```

### Enhanced Detection (With Line-Start)

**Input Text:**
```
Section 1. Membership
  (a) Individual members
    1. Must reside within boundaries
    2. Must pay annual dues
      a. Residential rate
      b. Business rate
        i. Standard business
        ii. Large business
```

**Detected Patterns:**
```javascript
[
  { type: 'section', depth: 1, number: '1', prefix: 'Section ', fullMatch: 'Section 1' },
  { type: 'paragraph', depth: 3, number: 'a', prefix: '(', fullMatch: '(a)' },
  { type: 'subparagraph', depth: 4, number: '1', prefix: '', fullMatch: '1.' },    // ✨ NEW
  { type: 'subparagraph', depth: 4, number: '2', prefix: '', fullMatch: '2.' },    // ✨ NEW
  { type: 'clause', depth: 5, number: 'a', prefix: '(', fullMatch: '(a)' },
  { type: 'clause', depth: 5, number: 'b', prefix: '(', fullMatch: '(b)' },
  { type: 'subclause', depth: 6, number: 'i', prefix: '', fullMatch: 'i.' },       // ✨ NEW
  { type: 'subclause', depth: 6, number: 'ii', prefix: '', fullMatch: 'ii.' }      // ✨ NEW
]
```

---

**End of Analysis Report**

*Generated by ANALYST agent - 2025-10-22*
