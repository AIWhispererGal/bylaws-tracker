# Enhanced Deduplication Algorithm Design

**Version:** 1.0
**Date:** 2025-10-09
**Status:** Design Phase
**Target:** /src/parsers/wordParser.js

---

## Executive Summary

**Current State:**
- Basic deduplication exists: citation + title matching (line 239-290)
- 37 duplicates remain after TOC filtering
- Simple length-based selection (keeps section with more content)

**Problem:**
- TOC filtering catches only exact pattern duplicates (TAB + digits)
- Doesn't compare actual content similarity
- Misses edge cases: document parts, summaries, appendices

**Goal:**
- Reduce duplicates from 37 to <5 (>85% improvement)
- Handle all edge cases robustly
- Preserve 100% of unique content
- Maintain backward compatibility

---

## Algorithm Design: Multi-Stage Deduplication

### Stage 1: Exact Match (Existing - Enhanced)
**What:** Citation + title exact match
**Keep:** Section with MORE content (longer text)
**Location Preference:** Keep LATER occurrence (skip TOC)

```javascript
// Enhanced Stage 1
for (const section of sections) {
  const key = `${section.citation}|${section.title}`;

  if (!seen.has(key)) {
    seen.set(key, section);
    unique.push(section);
  } else {
    const original = seen.get(key);
    const originalLength = (original.text || '').length;
    const currentLength = (section.text || '').length;

    // NEW: If lengths equal, prefer LATER occurrence (higher line number)
    if (currentLength > originalLength ||
        (currentLength === originalLength && section.lineNumber > original.lineNumber)) {
      const index = unique.indexOf(original);
      unique[index] = section;
      seen.set(key, section);
      duplicates.push(original);
    } else {
      duplicates.push(section);
    }
  }
}
```

### Stage 2: Content Similarity Detection (NEW)
**What:** Compare sections with same citation but different titles
**Method:** Normalized content comparison + Levenshtein distance
**Threshold:** 85% similarity = duplicate

#### 2.1 Normalization Function
```javascript
/**
 * Normalize content for comparison
 * Removes whitespace, punctuation, case differences
 */
normalizeContent(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();
}
```

#### 2.2 Similarity Calculation
```javascript
/**
 * Calculate similarity between two texts
 * Returns 0.0 (no match) to 1.0 (identical)
 */
calculateSimilarity(text1, text2) {
  const norm1 = this.normalizeContent(text1);
  const norm2 = this.normalizeContent(text2);

  // Quick checks
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // For short texts, use simple character overlap
  if (norm1.length < 100 || norm2.length < 100) {
    return this.characterOverlap(norm1, norm2);
  }

  // For longer texts, use Levenshtein ratio
  return this.levenshteinRatio(norm1, norm2);
}

/**
 * Character overlap similarity (fast, good for short texts)
 */
characterOverlap(str1, str2) {
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

/**
 * Levenshtein distance ratio (accurate for longer texts)
 */
levenshteinRatio(str1, str2) {
  const distance = this.levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return maxLen === 0 ? 1.0 : 1 - (distance / maxLen);
}

/**
 * Levenshtein distance implementation
 * Optimized with single-array dynamic programming
 */
levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Optimize for very similar strings
  if (str1 === str2) return 0;
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Use single array DP (space optimization)
  let prev = Array.from({ length: len2 + 1 }, (_, i) => i);

  for (let i = 1; i <= len1; i++) {
    let curr = [i];
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    prev = curr;
  }

  return prev[len2];
}
```

#### 2.3 Stage 2 Deduplication Logic
```javascript
/**
 * Stage 2: Content similarity deduplication
 * Handles same citation, different titles
 */
deduplicateBySimilarity(sections, similarityThreshold = 0.85) {
  const byCitation = new Map();

  // Group by citation
  for (const section of sections) {
    if (!byCitation.has(section.citation)) {
      byCitation.set(section.citation, []);
    }
    byCitation.get(section.citation).push(section);
  }

  const unique = [];
  const duplicates = [];

  // Check each citation group for similarity
  for (const [citation, group] of byCitation) {
    if (group.length === 1) {
      unique.push(group[0]);
      continue;
    }

    // Multiple sections with same citation - check similarity
    const kept = [];

    for (const section of group) {
      let isDuplicate = false;

      for (const existing of kept) {
        const similarity = this.calculateSimilarity(
          section.text || '',
          existing.text || ''
        );

        if (similarity >= similarityThreshold) {
          // Duplicate found - keep the better one
          isDuplicate = true;

          const currentLength = (section.text || '').length;
          const existingLength = (existing.text || '').length;

          if (currentLength > existingLength ||
              (currentLength === existingLength && section.lineNumber > existing.lineNumber)) {
            // Replace existing with current
            const idx = kept.indexOf(existing);
            kept[idx] = section;
            duplicates.push(existing);

            console.log(`[Dedup Stage 2] Replaced ${citation} (similarity: ${(similarity * 100).toFixed(1)}%)`);
          } else {
            duplicates.push(section);
            console.log(`[Dedup Stage 2] Skipped duplicate ${citation} (similarity: ${(similarity * 100).toFixed(1)}%)`);
          }
          break;
        }
      }

      if (!isDuplicate) {
        kept.push(section);
      }
    }

    unique.push(...kept);
  }

  return { unique, duplicates };
}
```

### Stage 3: Position-Based Intelligence (NEW)
**What:** Use document position to identify TOC vs content
**Heuristics:**
- First 20% of document = likely TOC/preamble
- Sections in TOC region with minimal content = skip
- Later sections with same citation = prefer

```javascript
/**
 * Stage 3: Position-based deduplication
 * Identifies TOC sections by document position
 */
detectTOCRegion(sections) {
  const totalLines = Math.max(...sections.map(s => s.lineNumber || 0));
  const tocThreshold = totalLines * 0.2; // First 20% of document

  return {
    isTOCRegion: (lineNumber) => lineNumber < tocThreshold,
    tocThreshold
  };
}

deduplicateByPosition(sections) {
  const { isTOCRegion, tocThreshold } = this.detectTOCRegion(sections);
  const byCitation = new Map();

  for (const section of sections) {
    if (!byCitation.has(section.citation)) {
      byCitation.set(section.citation, []);
    }
    byCitation.get(section.citation).push(section);
  }

  const unique = [];
  const duplicates = [];

  for (const [citation, group] of byCitation) {
    if (group.length === 1) {
      unique.push(group[0]);
      continue;
    }

    // Sort by line number
    group.sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0));

    // Find first section NOT in TOC region with substantial content
    let bestSection = null;

    for (const section of group) {
      const inTOC = isTOCRegion(section.lineNumber || 0);
      const hasContent = (section.text || '').length > 50;

      if (!inTOC && hasContent) {
        bestSection = section;
        break;
      }
    }

    // If no section outside TOC, keep the one with most content
    if (!bestSection) {
      bestSection = group.reduce((best, curr) =>
        (curr.text || '').length > (best.text || '').length ? curr : best
      );
    }

    // Mark others as duplicates
    for (const section of group) {
      if (section === bestSection) {
        unique.push(section);
      } else {
        duplicates.push(section);
        const reason = isTOCRegion(section.lineNumber || 0) ? 'TOC region' : 'less content';
        console.log(`[Dedup Stage 3] Skipped ${citation} at line ${section.lineNumber} (${reason})`);
      }
    }
  }

  return { unique, duplicates };
}
```

### Stage 4: Edge Case Handling (NEW)
**What:** Handle special cases that slip through stages 1-3

#### 4.1 Document Part Duplicates
Sections like "Section 1" in "Part I" vs "Part II"

```javascript
/**
 * Detect if sections are from different document parts
 */
areDifferentParts(section1, section2) {
  // Check for part indicators in title or nearby content
  const partPattern = /part\s+[IVX\d]+|division\s+[IVX\d]+|chapter\s+[IVX\d]+/i;

  const part1 = (section1.title + (section1.text || '').substring(0, 200)).match(partPattern);
  const part2 = (section2.title + (section2.text || '').substring(0, 200)).match(partPattern);

  return part1 && part2 && part1[0] !== part2[0];
}
```

#### 4.2 Summary vs Main Content
Summary sections often reference main content

```javascript
/**
 * Detect if section is a summary/reference section
 */
isSummarySection(section) {
  const summaryKeywords = [
    'summary', 'overview', 'index', 'table of contents',
    'appendix', 'reference', 'see section'
  ];

  const text = (section.title + ' ' + (section.text || '')).toLowerCase();
  return summaryKeywords.some(keyword => text.includes(keyword));
}
```

#### 4.3 Appendix Numbering
Appendices may reuse section numbers

```javascript
/**
 * Detect appendix sections
 */
isAppendixSection(section) {
  const appendixPattern = /appendix\s+[A-Z\d]+/i;
  return appendixPattern.test(section.title) ||
         appendixPattern.test((section.text || '').substring(0, 100));
}
```

---

## Complete Algorithm Implementation

### Main Deduplication Function (Enhanced)
```javascript
/**
 * Enhanced deduplication with multi-stage processing
 */
deduplicateSections(sections) {
  console.log('[WordParser] Starting enhanced deduplication...');
  console.log(`[WordParser] Input: ${sections.length} sections`);

  // Stage 1: Exact match (citation + title)
  const stage1 = this.deduplicateExact(sections);
  console.log(`[WordParser] Stage 1 (exact): ${stage1.unique.length} unique, ${stage1.duplicates.length} duplicates`);

  // Stage 2: Content similarity
  const stage2 = this.deduplicateBySimilarity(stage1.unique, 0.85);
  console.log(`[WordParser] Stage 2 (similarity): ${stage2.unique.length} unique, ${stage2.duplicates.length} duplicates`);

  // Stage 3: Position-based (TOC detection)
  const stage3 = this.deduplicateByPosition(stage2.unique);
  console.log(`[WordParser] Stage 3 (position): ${stage3.unique.length} unique, ${stage3.duplicates.length} duplicates`);

  // Stage 4: Edge cases
  const stage4 = this.handleEdgeCases(stage3.unique);
  console.log(`[WordParser] Stage 4 (edge cases): ${stage4.unique.length} unique, ${stage4.duplicates.length} duplicates`);

  // Aggregate all duplicates
  const allDuplicates = [
    ...stage1.duplicates,
    ...stage2.duplicates,
    ...stage3.duplicates,
    ...stage4.duplicates
  ];

  // Final summary
  console.log(`[WordParser] ✅ Deduplication complete:`);
  console.log(`[WordParser]    Input: ${sections.length} sections`);
  console.log(`[WordParser]    Output: ${stage4.unique.length} unique sections`);
  console.log(`[WordParser]    Removed: ${allDuplicates.length} duplicates`);

  if (allDuplicates.length > 0) {
    const duplicateCitations = [...new Set(allDuplicates.map(d => d.citation))];
    console.log(`[WordParser]    Citations: ${duplicateCitations.join(', ')}`);
  }

  return stage4.unique;
}

/**
 * Stage 4: Handle edge cases
 */
handleEdgeCases(sections) {
  const byCitation = new Map();

  for (const section of sections) {
    if (!byCitation.has(section.citation)) {
      byCitation.set(section.citation, []);
    }
    byCitation.get(section.citation).push(section);
  }

  const unique = [];
  const duplicates = [];

  for (const [citation, group] of byCitation) {
    if (group.length === 1) {
      unique.push(group[0]);
      continue;
    }

    // Check for different parts
    const differentParts = [];
    for (let i = 0; i < group.length; i++) {
      let isDifferentPart = false;
      for (let j = i + 1; j < group.length; j++) {
        if (this.areDifferentParts(group[i], group[j])) {
          isDifferentPart = true;
          break;
        }
      }
      if (isDifferentPart) {
        differentParts.push(group[i]);
      }
    }

    if (differentParts.length > 0) {
      // Keep all sections from different parts
      unique.push(...group);
      console.log(`[Dedup Stage 4] Kept all ${citation} sections (different document parts)`);
      continue;
    }

    // Check for summary vs main content
    const summaries = group.filter(s => this.isSummarySection(s));
    const mainContent = group.filter(s => !this.isSummarySection(s));

    if (summaries.length > 0 && mainContent.length > 0) {
      // Keep main content, discard summaries
      unique.push(...mainContent);
      duplicates.push(...summaries);
      console.log(`[Dedup Stage 4] Kept ${mainContent.length} main content, removed ${summaries.length} summaries for ${citation}`);
      continue;
    }

    // Check for appendix sections
    const appendices = group.filter(s => this.isAppendixSection(s));
    const nonAppendices = group.filter(s => !this.isAppendixSection(s));

    if (appendices.length > 0 && nonAppendices.length > 0) {
      // Keep all - appendix numbering is separate
      unique.push(...group);
      console.log(`[Dedup Stage 4] Kept all ${citation} sections (appendix + main content)`);
      continue;
    }

    // Default: keep longest
    const best = group.reduce((best, curr) =>
      (curr.text || '').length > (best.text || '').length ? curr : best
    );
    unique.push(best);
    duplicates.push(...group.filter(s => s !== best));
    console.log(`[Dedup Stage 4] Kept longest section for ${citation}`);
  }

  return { unique, duplicates };
}
```

---

## Metrics & Success Criteria

### Performance Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Duplicate Count** | 37 | <5 | Count duplicates after dedup |
| **Accuracy** | ~50% | >95% | Manual review of results |
| **False Positives** | Unknown | <2% | Unique content incorrectly removed |
| **Processing Time** | <1s | <2s | Time for dedup step |
| **Memory Usage** | Low | Low | No significant increase |

### Test Cases
1. **Basic Duplicates**: Same citation + title → Keep longer
2. **TOC Duplicates**: TOC entry + full section → Keep full section
3. **Similar Content**: 85%+ similarity → Deduplicate
4. **Different Parts**: Part I Section 1 vs Part II Section 1 → Keep both
5. **Summary Sections**: Summary + main → Keep main
6. **Appendix**: Appendix A Section 1 vs Section 1 → Keep both
7. **Position Preference**: Equal length → Keep later occurrence

### Validation
```javascript
/**
 * Validate deduplication results
 */
validateDeduplication(original, deduplicated, duplicates) {
  const validation = {
    success: true,
    errors: [],
    warnings: [],
    stats: {
      original: original.length,
      deduplicated: deduplicated.length,
      removed: duplicates.length,
      reduction: ((duplicates.length / original.length) * 100).toFixed(1) + '%'
    }
  };

  // Check for lost content
  const originalCitations = new Set(original.map(s => s.citation));
  const finalCitations = new Set(deduplicated.map(s => s.citation));
  const lostCitations = [...originalCitations].filter(c => !finalCitations.has(c));

  if (lostCitations.length > 0) {
    validation.errors.push({
      type: 'lost_content',
      message: `Lost ${lostCitations.length} unique citations`,
      citations: lostCitations
    });
    validation.success = false;
  }

  // Check for suspicious patterns
  const citationCounts = new Map();
  for (const section of deduplicated) {
    citationCounts.set(section.citation, (citationCounts.get(section.citation) || 0) + 1);
  }

  const stillDuplicated = [...citationCounts].filter(([_, count]) => count > 1);
  if (stillDuplicated.length > 0) {
    validation.warnings.push({
      type: 'remaining_duplicates',
      message: `${stillDuplicated.length} citations still appear multiple times`,
      citations: stillDuplicated.map(([citation, count]) => `${citation} (${count}x)`)
    });
  }

  return validation;
}
```

---

## Implementation Plan

### Phase 1: Core Implementation (2-3 hours)
1. Add similarity calculation functions
2. Implement Stage 2 (content similarity)
3. Implement Stage 3 (position-based)
4. Update main deduplication function
5. Add validation logic

### Phase 2: Edge Cases (1-2 hours)
1. Implement Stage 4 (edge case handling)
2. Add document part detection
3. Add summary section detection
4. Add appendix detection
5. Test with real documents

### Phase 3: Testing & Validation (1 hour)
1. Unit tests for each stage
2. Integration tests with sample documents
3. Manual review of results
4. Performance benchmarking
5. Documentation update

### Phase 4: Deployment (30 min)
1. Code review
2. Deploy to staging
3. Test with production documents
4. Monitor duplicate counts
5. Deploy to production

---

## Backward Compatibility

### Ensure No Breaking Changes
- Preserve function signature: `deduplicateSections(sections)`
- Maintain return format: array of sections
- Keep existing validation checks
- Log all decisions for debugging

### Configuration Options
Add optional configuration for fine-tuning:
```javascript
const DEDUP_CONFIG = {
  similarityThreshold: 0.85,    // 85% similarity = duplicate
  tocRegionPercent: 0.2,         // First 20% = TOC region
  minContentLength: 50,          // Minimum chars for valid section
  enablePositionBased: true,     // Stage 3 on/off
  enableEdgeCases: true,         // Stage 4 on/off
  preferLaterOccurrence: true    // Prefer later sections
};
```

---

## Monitoring & Logging

### Enhanced Logging
```javascript
console.log('[WordParser] 📊 Deduplication Stats:');
console.log(`  Stage 1 (Exact):      ${stage1.duplicates.length} removed`);
console.log(`  Stage 2 (Similarity): ${stage2.duplicates.length} removed`);
console.log(`  Stage 3 (Position):   ${stage3.duplicates.length} removed`);
console.log(`  Stage 4 (Edge Cases): ${stage4.duplicates.length} removed`);
console.log(`  Total Removed:        ${allDuplicates.length}`);
console.log(`  Final Count:          ${finalSections.length}`);
console.log(`  Reduction:            ${reductionPercent}%`);
```

### Metrics to Track
1. Duplicate count per document
2. Similarity scores distribution
3. TOC region detection accuracy
4. Processing time per stage
5. False positive rate (manual review)

---

## Risk Assessment

### Low Risk
- ✅ Uses existing framework (enhances, doesn't replace)
- ✅ Each stage is independent (can disable if issues)
- ✅ Extensive logging for debugging
- ✅ Validation checks catch errors

### Medium Risk
- ⚠️ Similarity threshold may need tuning per document type
- ⚠️ TOC region detection assumes standard document structure
- ⚠️ Performance impact of Levenshtein (mitigated with optimization)

### Mitigation
1. Make stages configurable (can disable problematic stages)
2. Add per-organization config overrides
3. Implement performance monitoring
4. Keep fallback to Stage 1 only if needed

---

## Success Metrics

### Quantitative Goals
- **Duplicate Reduction**: 37 → <5 (86%+ improvement)
- **Accuracy**: >95% correct deduplication
- **Performance**: <2s for dedup step
- **Zero Data Loss**: All unique content preserved

### Qualitative Goals
- Clean, maintainable code
- Clear logging and debugging
- Configurable and extensible
- Well-tested and documented

---

## Next Steps

1. **Review & Approve** this design document
2. **Implement** stages sequentially (1 → 2 → 3 → 4)
3. **Test** each stage independently
4. **Integrate** into wordParser.js
5. **Validate** with real documents
6. **Deploy** and monitor

---

## References

### Current Implementation
- File: `/src/parsers/wordParser.js`
- Function: `deduplicateSections()` (lines 239-290)
- Related: `detectTableOfContents()` (lines 72-105)

### Related Documents
- `/docs/INVESTIGATION_SUMMARY.md` - Previous investigation
- Swarm memory: Investigation findings (to be retrieved)

### Algorithms Used
- **Levenshtein Distance**: Edit distance for string similarity
- **Character Overlap**: Jaccard similarity for short texts
- **Position-Based Heuristics**: TOC detection by document position

---

**Document Status:** ✅ Ready for Implementation
**Estimated Implementation Time:** 4-6 hours
**Risk Level:** Low
**Expected Impact:** High (86%+ duplicate reduction)
