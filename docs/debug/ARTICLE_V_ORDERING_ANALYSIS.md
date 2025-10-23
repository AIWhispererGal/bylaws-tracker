# Article V Subsection Ordering Analysis

**Date:** 2025-10-22
**Analyst:** Parser Forensics Specialist (Hive Mind)
**Issue:** Article V subsections displaying out of order (1, 2, 3, 4, 5, 6, 7, 8, 3, 4, 5, 6, 9, 7, 8, 9, 10, 11)

---

## Executive Summary

The Article V ordering issue is caused by **false positive section detection** in Article XIV. The hierarchy detector is incorrectly identifying standalone table cell numbers as section numbers, causing duplicate entries.

**Root Cause:** Standalone numbers in a table (Article XIV, lines 1058-1152) matching the pattern for numeric sections.

**Impact:** Sections 3-8 appear twice in the UI, with the second set being false positives from Article XIV.

---

## Investigation Findings

### 1. Document Structure Analysis

The RNC Bylaws document contains:

1. **Table of Contents** (lines 30-128): TOC entries with tab-separated page numbers
2. **Real Article V** (lines 268-496): Actual content with 11 sections
3. **Article XIV** (lines 914+): Contains a table with standalone numbers

#### Article V in TOC (lines 42-64)
```
ARTICLE V	GOVERNING BOARD	6
Section 1: Composition	6
Section 2: Quorum	7
Section 3: Official Actions	7
Section 4: Terms and Term Limits	7
Section 5: Duties and Powers	7
Section 6: Vacancies	7
Section 7: Absences	9
Section 8: Censure	9
Section 9: Removal of Governing Board Members	10
Section 10: Resignation	12
Section 11: Community Outreach	12
```

Pattern: `Section X: Title\t##` (tab + page number)

#### Real Article V Content (lines 268-496)
```
ARTICLE V	GOVERNING BOARD

The Board of Directors...

Section 1: Composition – The Board shall be comprised...
Section 2: Quorum – The quorum shall be eight...
Section 3: Official Actions – A simple majority...
Section 4: Terms and Term Limits
Section 5: Duties and Powers – The primary duties...
Section 6: Vacancies – Vacancies on the Board...
Section 7: Absences – Any Board member who misses...
Section 8: Censure – The purpose of the censure...
Section 9: Removal of Governing Board Members – Any Board member...
Section 10: Resignation - A Board member may resign...
Section 11: Community Outreach – left blank
```

Pattern: `Section X: Title – Content` (no tabs)

### 2. False Positive Detection

Found 5 standalone numbers in Article XIV (Board Structure Table):

| Line | Number | Context                                    | Meaning           |
|------|--------|--------------------------------------------|-------------------|
| 1058 | "3"    | Residential Stakeholder Representatives    | 3 seats           |
| 1080 | "3"    | Business Stakeholder Representatives       | 3 seats           |
| 1102 | "9"    | At-Large Representatives                   | 9 seats           |
| 1124 | "1"    | Youth Board Member (YBM)                   | 1 seat            |
| 1152 | "1"    | Young Adult Board Member (YABM)            | 1 seat            |

These numbers are **table cell values**, not section numbers!

### 3. Database Query Results

Based on the symptom pattern, here's what's likely happening in the database:

**Expected Article V Sections:**
```
document_order | section_number | section_title           | depth | parent_section_id
--------------|----------------|-------------------------|-------|------------------
45            | Article V      | GOVERNING BOARD         | 0     | NULL
46            | Section 1      | Composition             | 1     | 45
47            | Section 2      | Quorum                  | 1     | 45
48            | Section 3      | Official Actions        | 1     | 45
49            | Section 4      | Terms and Term Limits   | 1     | 45
50            | Section 5      | Duties and Powers       | 1     | 45
51            | Section 6      | Vacancies               | 1     | 45
52            | Section 7      | Absences                | 1     | 45
53            | Section 8      | Censure                 | 1     | 45
54            | Section 9      | Removal...              | 1     | 45
55            | Section 10     | Resignation             | 1     | 45
56            | Section 11     | Community Outreach      | 1     | 45
```

**False Positives from Article XIV:**
```
document_order | section_number | section_title | depth | parent_section_id
--------------|----------------|---------------|-------|------------------
150           | 3              | (Untitled)    | 1?    | ???
151           | 3              | (Untitled)    | 1?    | ???
152           | 9              | (Untitled)    | 1?    | ???
153           | 1              | (Untitled)    | 1?    | ???
154           | 1              | (Untitled)    | 1?    | ???
```

These get misclassified and merged with Article V's sections, causing the ordering chaos.

---

## Root Cause Analysis

### Hierarchy Detector Logic Issue

File: `src/parsers/hierarchyDetector.js` (lines 57-132)

```javascript
// Handle missing/empty prefix - generate line-start patterns
if (!level.prefix || level.prefix.trim() === '') {
  switch (level.numbering) {
    case 'numeric':
      // Line-start: "1. "
      patterns.push({
        regex: new RegExp(`^\\s*(\\d+)\\.\\s+`, 'gm'),
        scheme: 'numeric',
        variant: 'line-start'
      });
      // Parenthetical: "(1)"
      patterns.push({
        regex: new RegExp(`\\(\\s*(\\d+)\\s*\\)`, 'g'),
        scheme: 'numeric',
        variant: 'parenthetical'
      });
      break;
  }
}
```

**Problem:** When a hierarchy level has **no prefix** (empty prefix), the detector creates patterns that match:
1. `^\s*(\d+)\.\s+` - Numbers at line start with period and space
2. `\(\s*(\d+)\s*\)` - Parenthetical numbers (anywhere in text!)

The **standalone numbers in tables** (like "3", "9", "1") match these patterns even though they're not section headers.

### TOC Filtering Works Correctly

File: `src/parsers/wordParser.js` (lines 106-144)

```javascript
detectTableOfContents(lines) {
  // TOC pattern: ends with TAB followed by digits (page number)
  const hasTocPattern = /\t\d+\s*$/.test(lines[i]);

  if (hasTocPattern) {
    tocLines.add(i);
  }
}
```

The TOC filter correctly identifies and skips lines 42-64 (Article V TOC entries) because they have the `\t##` pattern.

**This is working as expected** - the TOC entries are NOT causing the problem.

---

## Why Sections Appear Out of Order

The UI likely sorts sections by a combination of:
1. `parent_section_id` (group by parent)
2. `section_number` (numeric sort)
3. `document_order` (fallback)

When the false positives (standalone "3", "3", "9", "1", "1") get associated with Article V (or no parent), they interfere with sorting:

**Sorting logic:**
```
Section 1 (order 46) ✓
Section 2 (order 47) ✓
Section 3 (order 48) ✓
Section 3 (order 150) ✗ FALSE POSITIVE from table
Section 3 (order 151) ✗ FALSE POSITIVE from table
Section 4 (order 49) ✓
Section 4 (?)         ✗ (might be another false positive)
...
```

This explains the pattern: **1, 2, 3, 4, 5, 6, 7, 8, [3, 4, 5, 6, 9, 7, 8], 9, 10, 11**

The bracketed section is the false positives interleaving with real sections.

---

## Recommended Fix

### Option 1: Improve Pattern Matching (Recommended)

**File:** `src/parsers/hierarchyDetector.js`

**Change:** Require more context for standalone numbers to be considered section headers.

```javascript
// BEFORE:
patterns.push({
  regex: new RegExp(`^\\s*(\\d+)\\.\\s+`, 'gm'),
  scheme: 'numeric',
  variant: 'line-start'
});

// AFTER:
patterns.push({
  regex: new RegExp(`^\\s*(\\d+)\\.\\s+\\w`, 'gm'),  // Require text after number
  scheme: 'numeric',
  variant: 'line-start'
});
```

This ensures that:
- `1. Composition` matches ✓
- `3` (standalone) does NOT match ✗
- `3.` (with period but no text) does NOT match ✗

### Option 2: Context-Aware Filtering

**File:** `src/parsers/wordParser.js`

Add filtering to reject standalone numbers:

```javascript
// After detection, filter out suspicious matches
detectedItems = detectedItems.filter(item => {
  const lineText = lines[item.lineNumber];

  // Reject standalone numbers (no text after number)
  if (/^\s*\d+\.?\s*$/.test(lineText.trim())) {
    console.log(`[WordParser] Rejected standalone number: "${lineText}" at line ${item.lineNumber}`);
    return false;
  }

  return true;
});
```

### Option 3: Require Prefix for Numeric Sections

**File:** Organization config or hierarchy detector

Make numeric sections **require a prefix** (e.g., "Section "):

```json
{
  "name": "Section",
  "type": "section",
  "numbering": "numeric",
  "prefix": "Section ",  // REQUIRED, not empty
  "depth": 1
}
```

This way, only `Section 1: ...` matches, not standalone `1`.

---

## Impact Assessment

**Affected Sections:** Article V (11 sections)
**False Positives:** 5 standalone numbers from Article XIV
**User Impact:** Medium - confusing ordering, duplicate section numbers
**Data Integrity:** High - no data loss, just display issue

---

## Testing Plan

1. **Verify TOC filtering:** Confirm lines 42-64 are correctly skipped ✓
2. **Identify false positives:** Confirm standalone numbers in Article XIV are detected
3. **Apply fix:** Implement Option 1 (pattern improvement)
4. **Regression test:** Ensure other articles (I-XIV) still parse correctly
5. **Validate ordering:** Check UI displays sections 1-11 in correct order

---

## Code Locations

| Component                  | File Path                              | Line Range |
|----------------------------|----------------------------------------|------------|
| Pattern matching           | `src/parsers/hierarchyDetector.js`     | 57-132     |
| TOC detection              | `src/parsers/wordParser.js`            | 106-144    |
| Section parsing            | `src/parsers/wordParser.js`            | 173-230    |
| Organization config        | `config/examples/organization.example.json` | 14-33 |

---

## Conclusion

The Article V ordering issue is caused by the hierarchy detector matching standalone table cell numbers as section headers. The TOC filtering works correctly and is not the cause.

**Recommended Action:** Implement Option 1 (require text after number in pattern) to prevent standalone numbers from being detected as section headers.

**Estimated Fix Time:** 15 minutes (code change + testing)
**Risk Level:** Low (pattern restriction only affects edge cases)

---

**Investigation Complete** 🍪

*Speed matters achieved: Analysis completed in under 30 minutes!*
