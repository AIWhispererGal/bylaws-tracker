# Duplicate Citations Root Cause Analysis

## Executive Summary

**Problem**: 37 duplicate citations remain after TOC filtering (started with 72, now at 37)
**Root Cause**: `buildCitation()` function creates incomplete citations when parent article not found
**Target**: <5 duplicates (ideally 0)

## Investigation Findings

### 1. Test Results
- Total sections: 51 (1 preamble + 14 articles + 36 sections)
- Total citations: 63
- Unique citations: 26
- **Duplicates: 37** ❌

### 2. Duplicate Citations Found
From test output:
```
'Section 2', 'Section 3', 'Section 1', 'Section 4',
'Section 5', 'Section 6', 'Article X', 'Article XI',
'Article XII', 'Article XIV'
```

### 3. Root Cause Analysis

#### The buildCitation Function (wordParser.js:267-284)

```javascript
buildCitation(item, previousSections) {
  // Build hierarchical citation based on parent context
  if (item.type === 'section' || item.type === 'subsection' || item.type === 'clause') {
    // Find the most recent article
    const parentArticle = previousSections
      .slice()
      .reverse()
      .find(s => s.type === 'article');

    if (parentArticle) {
      return `${parentArticle.citation}, ${item.prefix}${item.number}`;  // ✓ "Article V, Section 1"
    }
  }

  // For articles or when no parent found, use simple format
  return `${item.prefix}${item.number}`;  // ❌ "Section 1" (causes duplicates!)
}
```

**The Problem**:
- Line 278: Creates proper hierarchical citation: `"Article V, Section 1"` ✓
- Line 283: Falls back to incomplete citation: `"Section 1"` ❌
- **This fallback creates duplicate citations across different articles!**

#### Why This Happens

1. When parsing "Section 1" from Article V, it looks for parent article in `previousSections`
2. If Article V is already in `previousSections`, citation = "Article V, Section 1" ✓
3. If Article V is NOT yet in `previousSections`, citation = "Section 1" ❌
4. Later, "Section 1" from Article VI also gets citation = "Article VI, Section 1" ✓
5. **Result**: We have BOTH "Section 1" AND "Article VI, Section 1" in the array
6. Deduplication sees these as different (one has article, one doesn't)

### 4. Why TOC Filtering Didn't Fix This

- TOC filtering IS working: "Detected TOC: lines 30-128", "Filtered 47 TOC items, kept 60 real headers"
- TOC lines are correctly skipped (line 154-156 in parseSections)
- **BUT** the problem is in the buildCitation logic, not TOC detection

### 5. Deduplication Status

From test output:
```
[WordParser] Checking for duplicate sections...
```
No "Removed X duplicate sections" message means deduplication found 0 duplicates.

**Why?** Because deduplication uses `section.citation` as the key (line 256):
```javascript
const key = section.citation;  // "Section 1" vs "Article V, Section 1" are DIFFERENT keys!
```

### 6. The Real Issue

The incomplete citations happen when:
- Sections are parsed BEFORE their parent article is added to `previousSections`
- This can occur due to:
  - Document structure (sections before articles)
  - Orphan attachment creating sections out of order
  - TOC entries being processed (though they should be filtered)

## Proposed Solutions

### Solution 1: Make buildCitation More Robust (RECOMMENDED)
Fix the buildCitation function to NEVER create incomplete citations:

```javascript
buildCitation(item, previousSections) {
  if (item.type === 'section' || item.type === 'subsection' || item.type === 'clause') {
    const parentArticle = previousSections
      .slice()
      .reverse()
      .find(s => s.type === 'article');

    if (parentArticle) {
      return `${parentArticle.citation}, ${item.prefix}${item.number}`;
    } else {
      // FIX: Instead of incomplete citation, use a placeholder or skip
      console.warn(`[WordParser] Section without parent article: ${item.prefix}${item.number} at line ${item.index}`);
      return `Unattached ${item.prefix}${item.number}`;  // Makes it obvious there's an issue
    }
  }

  return `${item.prefix}${item.number}`;
}
```

### Solution 2: Post-Process Citations
After all sections are parsed, fix incomplete citations:

```javascript
fixIncompleteCitations(sections) {
  let currentArticle = null;

  return sections.map(section => {
    if (section.type === 'article') {
      currentArticle = section;
      return section;
    }

    if (section.type === 'section' && currentArticle) {
      // Fix citation if it's incomplete
      if (!section.citation.includes(currentArticle.citation)) {
        section.citation = `${currentArticle.citation}, ${section.prefix}${section.number}`;
      }
    }

    return section;
  });
}
```

### Solution 3: Improve Deduplication
Change deduplication to catch these cases:

```javascript
deduplicateSections(sections) {
  const seen = new Map();
  const unique = [];

  for (const section of sections) {
    // Normalize citations: "Section 1" should match "Article X, Section 1"
    const normalizedCitation = section.citation.includes(',')
      ? section.citation.split(', ').pop()  // Get just "Section 1"
      : section.citation;

    const existing = seen.get(normalizedCitation);

    if (!existing) {
      seen.set(normalizedCitation, section);
      unique.push(section);
    } else {
      // Keep the one with full hierarchical citation
      if (section.citation.includes(',') && !existing.citation.includes(',')) {
        const index = unique.indexOf(existing);
        unique[index] = section;
        seen.set(normalizedCitation, section);
      }
    }
  }

  return unique;
}
```

## Recommended Fix

**Use Solution 1 + Solution 2**:
1. Fix buildCitation to never create incomplete citations (Solution 1)
2. Add post-processing to fix any that slip through (Solution 2)
3. This ensures robust citation building with a safety net

## Files to Modify

1. `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/wordParser.js`
   - buildCitation() method (lines 267-284)
   - Add fixIncompleteCitations() method
   - Call fixIncompleteCitations in parseSections after line 221

## Expected Outcome

- Duplicate citations: 37 → 0
- All sections have complete hierarchical citations
- No "Section 1" without article prefix
- Test passes with <5 duplicates
