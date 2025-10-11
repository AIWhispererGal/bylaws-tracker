# Table of Contents Detection and Filtering System Design

## Executive Summary

This design addresses the duplicate section problem caused by Table of Contents (TOC) entries being detected as legitimate sections. The RNC bylaws document contains 72 duplicate sections because both TOC entries (lines 1-53) and actual content (lines 54+) match the same hierarchy patterns.

**Problem**: Lines like `ARTICLE I\tNAME\t4` (TOC entry with page number) and `ARTICLE I\tNAME` (actual content) both match pattern `ARTICLE\s+([IVX]+)`, creating duplicates.

**Goal**: Detect and filter TOC sections while preserving 100% content capture.

---

## Architecture Decision Records (ADRs)

### ADR-001: TOC Detection Strategy

**Context**: We need to distinguish TOC entries from actual content sections without losing information.

**Decision**: Implement a **hybrid two-phase detection** approach:
1. **Phase 1: TOC Range Detection** - Identify TOC block(s) by analyzing document structure
2. **Phase 2: Pattern-Based Filtering** - Apply TOC-specific pattern matching within detected ranges

**Rationale**:
- Single-method approaches (pattern-only or position-only) have false positives/negatives
- Hybrid approach maximizes accuracy across different document formats
- Allows graceful degradation if TOC is unusual or missing
- Preserves existing deduplication as fallback safety net

**Consequences**:
- Slightly more complex implementation
- Better accuracy across document variations
- Can adapt to TOC at beginning, middle, or end of document

---

### ADR-002: TOC vs Content Preference

**Context**: When duplicates exist, should we prefer TOC or content sections?

**Decision**: **Always prefer content sections** and discard TOC entries.

**Rationale**:
- Content sections have full text, TOC entries are just headers
- Current deduplication already implements this (keeps section with most content)
- TOC provides no value for the bylaws comparison tool
- Users need the actual legislative text, not the table of contents

**Consequences**:
- Simple, clear rule
- Aligns with existing deduplication logic
- May need to preserve TOC in future if navigation features are added

---

## Approach 1: Pattern-Based TOC Detection (Recommended)

### Overview
Detect TOC entries by identifying characteristic patterns that distinguish them from content sections.

### Detection Heuristics

#### 1.1 Page Number Pattern Detection
```javascript
/**
 * Detect if a line contains a TOC page number suffix
 * Examples:
 *   "ARTICLE I\tNAME\t4"      → true (tab + number)
 *   "ARTICLE I  NAME  4"      → true (multiple spaces + number)
 *   "Section 1\t\t12"         → true (multiple tabs + number)
 *   "ARTICLE I\tNAME"         → false (no page number)
 */
function hasTocPageNumber(line) {
  // Pattern: [content] [whitespace] [digit(s)] [optional whitespace] [end-of-line]
  const pageNumberPattern = /[\s\t]+(\d+)\s*$/;

  return pageNumberPattern.test(line.trim());
}
```

#### 1.2 TOC Clustering Detection
```javascript
/**
 * Detect if we're in a TOC block based on line clustering
 * TOC characteristics:
 * - Multiple consecutive lines with page numbers
 * - Short lines (< 200 chars)
 * - Minimal content between headers
 */
function detectTocClusters(lines) {
  const clusters = [];
  let currentCluster = null;
  let tocLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      if (tocLineCount >= 2 && currentCluster) {
        // End cluster if we have at least 2 TOC lines
        currentCluster.endLine = i - 1;
        clusters.push(currentCluster);
        currentCluster = null;
        tocLineCount = 0;
      }
      continue;
    }

    const isTocLine = hasTocPageNumber(line) && line.length < 200;

    if (isTocLine) {
      if (!currentCluster) {
        currentCluster = {
          startLine: i,
          endLine: i,
          lines: []
        };
      }
      currentCluster.endLine = i;
      currentCluster.lines.push(i);
      tocLineCount++;
    } else {
      // Non-TOC line breaks the cluster
      if (tocLineCount >= 3) {
        // Minimum 3 consecutive TOC lines to be a valid cluster
        clusters.push(currentCluster);
      }
      currentCluster = null;
      tocLineCount = 0;
    }
  }

  // Don't forget the last cluster
  if (tocLineCount >= 3 && currentCluster) {
    clusters.push(currentCluster);
  }

  return clusters;
}
```

#### 1.3 TOC Header Detection
```javascript
/**
 * Detect explicit "Table of Contents" headers
 */
function findTocHeaders(lines) {
  const tocHeaderPatterns = [
    /^TABLE OF CONTENTS$/i,
    /^CONTENTS$/i,
    /^INDEX$/i,
    /^T\.O\.C\.?$/i
  ];

  const headers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    for (const pattern of tocHeaderPatterns) {
      if (pattern.test(line)) {
        headers.push({
          lineNumber: i,
          text: line
        });
        break;
      }
    }
  }

  return headers;
}
```

### Integration Strategy

#### Option A: Filter Before Hierarchy Detection (Recommended)
```javascript
async parseSections(text, html, organizationConfig) {
  const lines = text.split('\n');

  // STEP 1: Detect TOC ranges
  const tocRanges = this.detectTableOfContents(lines);

  // STEP 2: Filter out TOC lines
  const contentLines = lines.filter((line, index) => {
    return !this.isInTocRange(index, tocRanges);
  });

  // STEP 3: Reconstruct text without TOC
  const contentText = contentLines.join('\n');

  // STEP 4: Continue with existing hierarchy detection
  const detectedItems = hierarchyDetector.detectHierarchy(contentText, organizationConfig);

  // ... rest of existing logic
}
```

**Advantages**:
- Prevents TOC entries from ever entering the system
- Cleaner data pipeline
- No need to track TOC vs content in later stages

**Disadvantages**:
- Line numbers become misaligned with original document
- Harder to debug which lines were filtered

#### Option B: Mark and Filter During Section Building
```javascript
async parseSections(text, html, organizationConfig) {
  const lines = text.split('\n');

  // STEP 1: Detect TOC ranges
  const tocRanges = this.detectTableOfContents(lines);

  // STEP 2: Continue with hierarchy detection as normal
  const detectedItems = hierarchyDetector.detectHierarchy(text, organizationConfig);

  // STEP 3: Mark items that are in TOC ranges
  const markedItems = detectedItems.map(item => ({
    ...item,
    isTocEntry: this.isItemInTocRange(item, lines, tocRanges)
  }));

  // STEP 4: Build sections, skipping TOC entries
  const itemsByLine = new Map();
  for (const item of markedItems) {
    if (item.isTocEntry) {
      console.log(`[TOC Filter] Skipping TOC entry: ${item.fullMatch}`);
      continue; // Skip TOC entries
    }

    // ... existing line matching logic
  }

  // ... rest of existing logic
}
```

**Advantages**:
- Preserves original line numbers
- Better logging and debugging
- Can preserve TOC metadata if needed later

**Disadvantages**:
- TOC entries still flow through hierarchy detection
- More complex filtering logic

### Recommended Implementation: Hybrid Approach

```javascript
/**
 * Comprehensive TOC detection combining multiple heuristics
 */
detectTableOfContents(lines) {
  const results = {
    ranges: [],
    confidence: 'none', // 'none', 'low', 'medium', 'high'
    method: []
  };

  // Method 1: Find explicit TOC headers
  const headers = this.findTocHeaders(lines);

  // Method 2: Detect page number clusters
  const clusters = this.detectTocClusters(lines);

  // Method 3: Detect front-matter TOC (first 100 lines with high TOC density)
  const frontMatterToc = this.detectFrontMatterToc(lines);

  // Combine results with confidence scoring
  if (headers.length > 0 && clusters.length > 0) {
    // High confidence: explicit header + clusters
    results.confidence = 'high';
    results.method = ['header', 'clustering'];

    // Find cluster nearest to header
    const nearestCluster = this.findNearestCluster(headers[0].lineNumber, clusters);
    if (nearestCluster) {
      results.ranges.push({
        start: Math.min(headers[0].lineNumber, nearestCluster.startLine),
        end: nearestCluster.endLine,
        confidence: 'high'
      });
    }
  } else if (clusters.length > 0) {
    // Medium confidence: clustering only
    results.confidence = 'medium';
    results.method = ['clustering'];

    // Use largest cluster(s)
    const significantClusters = clusters.filter(c => c.lines.length >= 5);
    results.ranges = significantClusters.map(c => ({
      start: c.startLine,
      end: c.endLine,
      confidence: 'medium'
    }));
  } else if (frontMatterToc) {
    // Low confidence: front matter heuristic
    results.confidence = 'low';
    results.method = ['front-matter'];
    results.ranges.push(frontMatterToc);
  }

  // Log detection results
  if (results.ranges.length > 0) {
    console.log(`[TOC Detection] Found ${results.ranges.length} TOC range(s) with ${results.confidence} confidence`);
    console.log(`[TOC Detection] Methods: ${results.method.join(', ')}`);
    results.ranges.forEach((range, i) => {
      console.log(`[TOC Detection] Range ${i + 1}: lines ${range.start}-${range.end}`);
    });
  } else {
    console.log('[TOC Detection] No TOC detected in document');
  }

  return results;
}

/**
 * Detect TOC in front matter (first ~100 lines)
 */
detectFrontMatterToc(lines) {
  const checkLines = Math.min(100, lines.length);
  let tocLineCount = 0;
  let firstTocLine = -1;
  let lastTocLine = -1;

  for (let i = 0; i < checkLines; i++) {
    if (this.hasTocPageNumber(lines[i])) {
      if (firstTocLine === -1) firstTocLine = i;
      lastTocLine = i;
      tocLineCount++;
    }
  }

  // If >50% of front matter has page numbers, likely a TOC
  const tocDensity = tocLineCount / checkLines;

  if (tocDensity > 0.3 && tocLineCount >= 5) {
    return {
      start: firstTocLine,
      end: lastTocLine,
      confidence: 'low',
      density: tocDensity
    };
  }

  return null;
}
```

---

## Approach 2: Position-Based Detection

### Overview
Assume TOC is in a specific location (beginning or end) and has structural characteristics.

### Algorithm
```javascript
/**
 * Detect TOC by position and structure
 */
function detectTocByPosition(lines) {
  // Check beginning of document
  const beginningToc = checkDocumentStart(lines);
  if (beginningToc) return beginningToc;

  // Check end of document
  const endingToc = checkDocumentEnd(lines);
  if (endingToc) return endingToc;

  return null;
}

function checkDocumentStart(lines, maxLines = 100) {
  const checkRange = Math.min(maxLines, lines.length);

  let consecutiveTocLines = 0;
  let tocStart = -1;

  for (let i = 0; i < checkRange; i++) {
    if (looksLikeTocEntry(lines[i])) {
      if (tocStart === -1) tocStart = i;
      consecutiveTocLines++;
    } else if (consecutiveTocLines > 0) {
      // End of TOC block
      if (consecutiveTocLines >= 5) {
        return { start: tocStart, end: i - 1 };
      }
      consecutiveTocLines = 0;
      tocStart = -1;
    }
  }

  return null;
}

function looksLikeTocEntry(line) {
  const trimmed = line.trim();

  // Characteristics of TOC entry:
  return (
    trimmed.length > 0 &&
    trimmed.length < 200 &&
    hasTocPageNumber(line) &&
    !hasFullSentence(line) // TOC entries rarely have full sentences
  );
}
```

**Advantages**:
- Simple to implement
- Works well for standardized documents

**Disadvantages**:
- Fails if TOC is in middle of document
- Brittle to variations in document structure
- May miss non-standard TOC formats

---

## Approach 3: Semantic Analysis (Future Enhancement)

### Overview
Use NLP/semantic analysis to distinguish TOC entries from content.

### Characteristics Analysis
```javascript
function semanticTocDetection(lines, detectedSections) {
  return detectedSections.map(section => {
    const line = lines[section.lineNumber];

    const features = {
      hasPageNumber: hasTocPageNumber(line),
      hasFullSentence: hasFullSentence(line),
      hasLegalLanguage: hasLegalLanguage(line),
      wordCount: line.trim().split(/\s+/).length,
      followedByContent: hasContentAfter(lines, section.lineNumber),
      density: calculateSurroundingDensity(lines, section.lineNumber)
    };

    const tocScore = calculateTocProbability(features);

    return {
      ...section,
      isTocEntry: tocScore > 0.7
    };
  });
}
```

**Advantages**:
- Most accurate for complex documents
- Can handle unusual TOC formats
- Learns from patterns

**Disadvantages**:
- Requires ML/NLP library
- More complex implementation
- Overkill for current use case

---

## Recommended Approach: Hybrid Pattern + Clustering

### Rationale

After analyzing the trade-offs:

1. **Pattern-Based Detection (Approach 1)** is recommended because:
   - Handles the specific RNC bylaws case perfectly
   - Flexible enough for variations
   - No external dependencies
   - Maintainable and debuggable
   - Graceful degradation if TOC is missing

2. **Integration via Option B** (mark and filter during section building):
   - Preserves line numbers for debugging
   - Better logging visibility
   - Can adapt to future requirements
   - Works with existing deduplication as safety net

3. **Confidence-based filtering**:
   - High confidence: Skip TOC entries completely
   - Medium confidence: Skip + log warning
   - Low confidence: Don't skip, let deduplication handle it

### Implementation Pseudocode

```javascript
// In wordParser.js - parseSections method

async parseSections(text, html, organizationConfig) {
  const lines = text.split('\n');
  const sections = [];

  // PHASE 1: Detect TOC ranges
  const tocDetection = this.detectTableOfContents(lines);

  // PHASE 2: Detect hierarchy (existing)
  const detectedItems = hierarchyDetector.detectHierarchy(text, organizationConfig);

  // PHASE 3: Match items to lines and filter TOC entries
  const headerLines = new Set();
  const itemsByLine = new Map();

  for (const item of detectedItems) {
    const pattern = item.fullMatch.trim();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (headerLines.has(i)) continue;

      if (trimmedLine.toLowerCase().startsWith(pattern.toLowerCase())) {
        // Check if this line is in a TOC range
        const inTocRange = this.isLineInTocRange(i, tocDetection.ranges);

        if (inTocRange && tocDetection.confidence !== 'low') {
          // Skip TOC entry (unless low confidence)
          console.log(`[TOC Filter] Skipping TOC entry at line ${i}: ${trimmedLine.substring(0, 50)}...`);
          break; // Don't add to headerLines
        }

        // This is a legitimate content section
        headerLines.add(i);
        itemsByLine.set(i, item);
        break;
      }
    }
  }

  // PHASE 4: Build sections (existing logic continues)
  // ... rest of existing code
}

// Helper methods

isLineInTocRange(lineNumber, tocRanges) {
  return tocRanges.some(range =>
    lineNumber >= range.start && lineNumber <= range.end
  );
}

detectTableOfContents(lines) {
  // Implementation from Approach 1
}

hasTocPageNumber(line) {
  // Implementation from Approach 1
}

detectTocClusters(lines) {
  // Implementation from Approach 1
}

findTocHeaders(lines) {
  // Implementation from Approach 1
}
```

---

## Test Cases

### Test Case 1: RNC Bylaws (Real Case)
```javascript
describe('TOC Detection - RNC Bylaws', () => {
  it('should detect TOC in lines 1-53', async () => {
    const text = loadRncBylaws();
    const lines = text.split('\n');

    const tocDetection = wordParser.detectTableOfContents(lines);

    expect(tocDetection.ranges).toHaveLength(1);
    expect(tocDetection.ranges[0].start).toBeLessThanOrEqual(1);
    expect(tocDetection.ranges[0].end).toBeGreaterThanOrEqual(53);
    expect(tocDetection.confidence).toBe('high');
  });

  it('should skip TOC entries and keep content sections', async () => {
    const result = await wordParser.parseDocument('rnc-bylaws.docx', rncConfig);

    // Should have ~36 sections (not 72)
    expect(result.sections.length).toBeLessThan(50);

    // Each section should have content
    result.sections.forEach(section => {
      expect(section.text).toBeTruthy();
      expect(section.text.length).toBeGreaterThan(10);
    });
  });
});
```

### Test Case 2: No TOC Document
```javascript
describe('TOC Detection - No TOC', () => {
  it('should handle documents without TOC', async () => {
    const text = 'ARTICLE I\tPurpose\n\nThis is the content...';

    const tocDetection = wordParser.detectTableOfContents(text.split('\n'));

    expect(tocDetection.ranges).toHaveLength(0);
    expect(tocDetection.confidence).toBe('none');
  });

  it('should parse normally when no TOC detected', async () => {
    const result = await wordParser.parseDocument('no-toc.docx', config);

    expect(result.sections.length).toBeGreaterThan(0);
  });
});
```

### Test Case 3: TOC at End
```javascript
describe('TOC Detection - End of Document', () => {
  it('should detect TOC at document end', async () => {
    const text = [
      'ARTICLE I\tPurpose',
      'Content here...',
      '',
      'TABLE OF CONTENTS',
      'ARTICLE I\tPurpose\t1',
      'ARTICLE II\tMembers\t5'
    ].join('\n');

    const tocDetection = wordParser.detectTableOfContents(text.split('\n'));

    expect(tocDetection.ranges).toHaveLength(1);
    expect(tocDetection.ranges[0].start).toBeGreaterThan(2);
  });
});
```

### Test Case 4: Unusual TOC Format
```javascript
describe('TOC Detection - Edge Cases', () => {
  it('should handle TOC without explicit header', async () => {
    const text = [
      'ARTICLE I......................1',
      'ARTICLE II.....................5',
      '',
      'ARTICLE I',
      'Content...'
    ].join('\n');

    const tocDetection = wordParser.detectTableOfContents(text.split('\n'));

    // Should detect by clustering even without header
    expect(tocDetection.confidence).toBeGreaterThanOrEqual('medium');
  });

  it('should handle false positive page numbers', async () => {
    const text = 'Section 1.2.3\tThere are 4 requirements';

    const hasTocPageNum = wordParser.hasTocPageNumber(text);

    // Should NOT detect "4" as page number (not at end)
    expect(hasTocPageNum).toBe(false);
  });
});
```

### Test Case 5: Mixed Content
```javascript
describe('TOC Detection - Deduplication Fallback', () => {
  it('should fall back to deduplication if TOC detection fails', async () => {
    // Simulate failed TOC detection (low confidence)
    const result = await wordParser.parseDocument('ambiguous-toc.docx', config);

    // Deduplication should still prevent duplicates
    const citations = result.sections.map(s => s.citation);
    const uniqueCitations = [...new Set(citations)];

    expect(citations.length).toBe(uniqueCitations.length);
  });
});
```

---

## Migration Strategy

### Phase 1: Add TOC Detection (Non-Breaking)
```javascript
// Add methods but don't enforce filtering yet
// Log TOC detection results
// Monitor in production
```

### Phase 2: Soft Filtering (Warning Mode)
```javascript
// Filter TOC entries but log warnings
// Compare section counts before/after
// Validate no content loss
```

### Phase 3: Hard Filtering (Production)
```javascript
// Enable full TOC filtering
// Remove deduplication if proven redundant
// Update documentation
```

### Rollback Plan
- Keep deduplication as permanent safety net
- Add feature flag to disable TOC filtering
- Maintain line number tracking for debugging

---

## Performance Considerations

### Complexity Analysis
- TOC detection: O(n) where n = number of lines
- Pattern matching: O(m) where m = number of detected items
- Overall: O(n + m) - linear, acceptable performance

### Memory Usage
- TOC ranges: O(k) where k = number of TOC blocks (typically 1-2)
- Minimal overhead: ~100 bytes per TOC range

### Optimization Opportunities
1. **Early termination**: Stop TOC search after first 200 lines if nothing found
2. **Caching**: Cache TOC detection results per document
3. **Parallel processing**: Detect TOC while parsing hierarchy

---

## Future Enhancements

### 1. TOC Preservation (Optional)
```javascript
// Store TOC metadata for navigation
metadata: {
  hasToc: true,
  tocRange: { start: 1, end: 53 },
  tocEntries: [...] // Preserved TOC structure
}
```

### 2. Interactive TOC Validation
```javascript
// UI to review TOC detection
// Allow manual override
// Improve detection from user feedback
```

### 3. Document Type Detection
```javascript
// Auto-detect document type
// Apply type-specific TOC patterns
// Support multiple standards (legal, technical, etc.)
```

### 4. Smart Content Recovery
```javascript
// If TOC has more info than content (e.g., subsection titles)
// Merge TOC metadata with content sections
```

---

## Conclusion

**Recommended Solution**: Implement **Approach 1 (Hybrid Pattern + Clustering)** with **Integration Option B** (mark and filter during section building).

**Key Benefits**:
- Solves the RNC bylaws duplicate problem
- Flexible for various TOC formats
- Preserves debugging capabilities
- Falls back to deduplication for edge cases
- No external dependencies
- Maintainable and testable

**Implementation Priority**:
1. Core TOC detection methods (hasTocPageNumber, detectTocClusters, findTocHeaders)
2. Hybrid detection logic (detectTableOfContents)
3. Integration into parseSections
4. Comprehensive test suite
5. Production monitoring and validation

**Success Criteria**:
- RNC bylaws: ~36 sections (not 72)
- No TOC entries in final sections
- 100% content capture maintained
- All tests passing
- No performance degradation

This design provides a robust, maintainable solution that can evolve with future requirements while immediately solving the duplicate section problem.
