# Document Normalization Pipeline Architecture

**Version:** 1.0
**Status:** Architecture Design
**Date:** 2025-10-09
**Author:** System Architecture Designer

---

## Executive Summary

This document defines a **multi-stage normalization pipeline** that processes documents before, during, and after text extraction to ensure consistent, clean, and accurate parsing. The pipeline addresses critical issues including tab/space inconsistencies, TOC detection, duplicate sections, and empty content while maintaining 100% content capture.

### Problem Statement

Current parsing issues stem from **document-level inconsistencies** that pattern matching cannot handle:
- **Whitespace chaos**: Mix of tabs, spaces, and Unicode whitespace in headers
- **TOC pollution**: Table of contents creates duplicate sections
- **Format artifacts**: DOCX extraction produces formatting noise
- **Empty sections**: Missing content due to extraction failures
- **Inconsistent numbering**: Same pattern rendered differently across document

### Solution: 4-Stage Normalization Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: Pre-Extraction (DOCX Binary Level)                    │
│ → Mammoth options tuning, format cleanup                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: Post-Extraction (Text Level)                          │
│ → Whitespace normalization, encoding fixes, TOC detection       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: Pre-Parsing (Line Level)                              │
│ → Line cleaning, smart trimming, header standardization         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: During Parsing (Pattern Level)                        │
│ → Fuzzy matching, pattern normalization, deduplication          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Reversibility**: Preserve original text in metadata for debugging
2. **Configurability**: Each normalization can be enabled/disabled via config
3. **Testability**: Each stage has isolated unit tests with A/B comparison
4. **Observability**: Detailed logging of what changed and why
5. **Safety**: Fallback mechanisms prevent data loss

---

## Table of Contents

1. [Architecture Decision Records](#architecture-decision-records)
2. [Stage 1: Pre-Extraction Normalization](#stage-1-pre-extraction-normalization)
3. [Stage 2: Post-Extraction Normalization](#stage-2-post-extraction-normalization)
4. [Stage 3: Pre-Parsing Normalization](#stage-3-pre-parsing-normalization)
5. [Stage 4: During-Parsing Normalization](#stage-4-during-parsing-normalization)
6. [Configuration Schema](#configuration-schema)
7. [Code Structure](#code-structure)
8. [Migration Plan](#migration-plan)
9. [Testing Strategy](#testing-strategy)
10. [A/B Testing Framework](#ab-testing-framework)
11. [Performance Considerations](#performance-considerations)
12. [Rollback Strategy](#rollback-strategy)

---

## Architecture Decision Records

### ADR-001: Functional Pipeline vs Class-Based

**Context**: Choose between functional pipeline (pipe normalizers) or class-based (Normalizer with strategies).

**Decision**: Use **class-based with strategies** (Strategy Pattern + Chain of Responsibility).

**Rationale**:
- Better testability (can mock individual strategies)
- Clear ownership (each strategy is self-contained)
- Easy to enable/disable specific normalizations
- Type safety and IDE support
- Simpler dependency injection for config

**Consequences**:
- More files (one per strategy)
- Need base class/interface
- Slightly more boilerplate

---

### ADR-002: When to Apply TOC Detection

**Context**: Should TOC detection happen in Stage 2 (text level) or Stage 3 (line level)?

**Decision**: **Stage 2 (Post-Extraction, Text Level)**.

**Rationale**:
- TOC ranges span multiple lines (text-level operation)
- Needs full document view to detect clustering patterns
- Line-by-line processing (Stage 3) is too late
- Allows filtering before expensive operations
- Aligns with existing TOC detection design (see `/docs/TOC_DETECTION_DESIGN.md`)

**Consequences**:
- TOC detection happens early
- Line numbers preserved in filtered text
- Can mark TOC ranges in metadata

---

### ADR-003: Deduplication Strategy

**Context**: Should we deduplicate early (Stage 2) or late (Stage 4)?

**Decision**: **Both - Early filtering (Stage 2) + Late safety net (Stage 4)**.

**Rationale**:
- **Stage 2**: Remove obvious duplicates (TOC + content) early
- **Stage 4**: Catch edge cases missed by TOC detection
- Defense in depth: multiple safety layers
- Existing deduplication already works in Stage 4

**Consequences**:
- Slightly redundant but safer
- Better error messages (can identify where duplicate came from)
- Graceful degradation if one method fails

---

### ADR-004: Original Text Preservation

**Context**: How to preserve original for debugging without bloating memory?

**Decision**: **Store original in metadata with diff tracking**.

**Rationale**:
- Full original: Too much memory for large documents
- Diff-only: Shows exactly what changed
- Metadata field: Doesn't pollute section objects
- Can be stripped in production if needed

**Consequences**:
- ~10-20% memory overhead (acceptable)
- Debugging is much easier
- Can regenerate original if needed

---

## Stage 1: Pre-Extraction Normalization

**Goal**: Configure mammoth.js to extract cleanest possible text from DOCX binary.

### Mammoth Options Tuning

```javascript
/**
 * Stage 1: Pre-Extraction Normalizer
 * Configures mammoth.js extraction options
 */
class PreExtractionNormalizer {
  constructor(config) {
    this.config = config.normalization?.preExtraction || {};
  }

  /**
   * Get optimized mammoth options
   */
  getMammothOptions() {
    return {
      // Preserve structure but normalize whitespace
      convertImage: mammoth.images.inline((element) => {
        // Skip images - they bloat text
        return { src: '' };
      }),

      // Style mapping for headers
      styleMap: [
        // Heading 1 → Keep as-is with newlines
        "p[style-name='Heading 1'] => p.heading1:fresh",
        // Heading 2 → Keep as-is
        "p[style-name='Heading 2'] => p.heading2:fresh",
        // Normal text → Plain paragraph
        "p[style-name='Normal'] => p:fresh",
        // Table cells → Preserve with spaces
        "table => p:separator('\n\n')",
        // List items → Keep structure
        "p[style-name='List Paragraph'] => p.list-item:fresh"
      ],

      // Ignore empty paragraphs
      ignoreEmptyParagraphs: true,

      // Transform whitespace
      transformDocument: this.config.transformDocument ?
        (doc) => this.transformDocumentStructure(doc) :
        undefined
    };
  }

  /**
   * Transform document structure before text extraction
   * This is the earliest point we can normalize
   */
  transformDocumentStructure(document) {
    // Walk the document tree
    return {
      ...document,
      children: document.children.map(element => {
        if (element.type === 'paragraph') {
          return this.normalizeParagraph(element);
        }
        return element;
      })
    };
  }

  normalizeParagraph(paragraph) {
    return {
      ...paragraph,
      children: paragraph.children.map(child => {
        if (child.type === 'text') {
          let text = child.value;

          // Normalize Unicode whitespace to regular spaces
          if (this.config.normalizeUnicode !== false) {
            text = this.normalizeUnicodeWhitespace(text);
          }

          // Normalize tabs to spaces (configurable)
          if (this.config.tabsToSpaces) {
            text = text.replace(/\t/g, ' '.repeat(this.config.tabWidth || 4));
          }

          return { ...child, value: text };
        }
        return child;
      })
    };
  }

  normalizeUnicodeWhitespace(text) {
    return text
      .replace(/\u00A0/g, ' ')    // Non-breaking space
      .replace(/\u2003/g, ' ')    // Em space
      .replace(/\u2002/g, ' ')    // En space
      .replace(/\u2009/g, ' ')    // Thin space
      .replace(/\u200B/g, '')     // Zero-width space
      .replace(/\uFEFF/g, '');    // Zero-width no-break space
  }
}
```

### Input/Output

**Input**: DOCX file buffer
**Output**: Configured mammoth options
**Metadata**: None (configuration stage)

---

## Stage 2: Post-Extraction Normalization

**Goal**: Clean extracted text and detect/remove structural artifacts (TOC, page headers/footers).

### Text-Level Normalizers

```javascript
/**
 * Stage 2: Post-Extraction Normalizer
 * Operates on extracted text as a whole
 */
class PostExtractionNormalizer {
  constructor(config) {
    this.config = config.normalization?.postExtraction || {};
    this.strategies = this.loadStrategies();
  }

  /**
   * Apply all text-level normalization strategies
   */
  normalize(rawText, metadata = {}) {
    let text = rawText;
    const changes = [];
    const originalText = rawText; // Preserve for diff

    // Strategy 1: Whitespace normalization
    if (this.config.normalizeWhitespace !== false) {
      const result = this.normalizeWhitespace(text);
      text = result.text;
      changes.push(...result.changes);
    }

    // Strategy 2: Line ending normalization
    if (this.config.normalizeLineEndings !== false) {
      const result = this.normalizeLineEndings(text);
      text = result.text;
      changes.push(...result.changes);
    }

    // Strategy 3: TOC detection and marking
    if (this.config.detectTOC !== false) {
      const result = this.detectAndMarkTOC(text);
      text = result.text;
      metadata.tocRanges = result.tocRanges;
      metadata.tocConfidence = result.confidence;
      changes.push(...result.changes);
    }

    // Strategy 4: Page header/footer removal
    if (this.config.removePageArtifacts) {
      const result = this.removePageArtifacts(text);
      text = result.text;
      changes.push(...result.changes);
    }

    // Strategy 5: Encoding fixes
    if (this.config.fixEncoding !== false) {
      const result = this.fixEncodingIssues(text);
      text = result.text;
      changes.push(...result.changes);
    }

    return {
      text,
      metadata: {
        ...metadata,
        normalization: {
          stage: 'post-extraction',
          changes,
          diff: this.generateDiff(originalText, text)
        }
      }
    };
  }

  /**
   * Strategy 1: Normalize whitespace
   */
  normalizeWhitespace(text) {
    const changes = [];
    let normalized = text;

    // Collapse multiple spaces (but preserve intentional indentation)
    const beforeSpaces = (text.match(/ {2,}/g) || []).length;
    normalized = normalized.replace(/ {2,}/g, ' ');
    if (beforeSpaces > 0) {
      changes.push({
        type: 'whitespace-collapse',
        count: beforeSpaces,
        description: `Collapsed ${beforeSpaces} instances of multiple spaces`
      });
    }

    // Normalize tabs to single space in middle of text
    const beforeTabs = (text.match(/\t/g) || []).length;
    normalized = normalized.replace(/\t/g, ' ');
    if (beforeTabs > 0) {
      changes.push({
        type: 'tab-normalization',
        count: beforeTabs,
        description: `Converted ${beforeTabs} tabs to spaces`
      });
    }

    // Remove trailing whitespace from lines
    const beforeTrailing = (text.match(/ +$/gm) || []).length;
    normalized = normalized.replace(/ +$/gm, '');
    if (beforeTrailing > 0) {
      changes.push({
        type: 'trailing-whitespace',
        count: beforeTrailing,
        description: `Removed trailing whitespace from ${beforeTrailing} lines`
      });
    }

    return { text: normalized, changes };
  }

  /**
   * Strategy 2: Normalize line endings
   */
  normalizeLineEndings(text) {
    const changes = [];
    let normalized = text;

    // Detect current line ending style
    const crlfCount = (text.match(/\r\n/g) || []).length;
    const lfCount = (text.match(/(?<!\r)\n/g) || []).length;
    const crCount = (text.match(/\r(?!\n)/g) || []).length;

    // Normalize to \n (Unix style)
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (crlfCount > 0 || crCount > 0) {
      changes.push({
        type: 'line-endings',
        description: `Normalized line endings (${crlfCount} CRLF, ${crCount} CR → LF)`,
        before: { crlf: crlfCount, cr: crCount, lf: lfCount },
        after: { lf: (normalized.match(/\n/g) || []).length }
      });
    }

    return { text: normalized, changes };
  }

  /**
   * Strategy 3: Detect and mark TOC (integrates with TOC_DETECTION_DESIGN.md)
   */
  detectAndMarkTOC(text) {
    const lines = text.split('\n');
    const changes = [];

    // Use hybrid TOC detection from TOC_DETECTION_DESIGN.md
    const tocDetection = this.detectTableOfContents(lines);

    if (tocDetection.ranges.length > 0) {
      // Mark TOC lines with special prefix for later filtering
      const markedLines = lines.map((line, index) => {
        const inTocRange = tocDetection.ranges.some(
          range => index >= range.start && index <= range.end
        );

        if (inTocRange) {
          changes.push({
            type: 'toc-mark',
            line: index,
            text: line.substring(0, 50) + '...'
          });
          return `[TOC]${line}`; // Prefix for easy identification
        }

        return line;
      });

      return {
        text: markedLines.join('\n'),
        tocRanges: tocDetection.ranges,
        confidence: tocDetection.confidence,
        changes
      };
    }

    return {
      text,
      tocRanges: [],
      confidence: 'none',
      changes
    };
  }

  /**
   * TOC Detection (from TOC_DETECTION_DESIGN.md)
   */
  detectTableOfContents(lines) {
    // Implementation from /docs/TOC_DETECTION_DESIGN.md
    const results = {
      ranges: [],
      confidence: 'none',
      method: []
    };

    // Method 1: Find explicit TOC headers
    const headers = this.findTocHeaders(lines);

    // Method 2: Detect page number clusters
    const clusters = this.detectTocClusters(lines);

    // Method 3: Front-matter TOC
    const frontMatterToc = this.detectFrontMatterToc(lines);

    // Combine results with confidence scoring
    if (headers.length > 0 && clusters.length > 0) {
      results.confidence = 'high';
      results.method = ['header', 'clustering'];
      const nearestCluster = this.findNearestCluster(headers[0].lineNumber, clusters);
      if (nearestCluster) {
        results.ranges.push({
          start: Math.min(headers[0].lineNumber, nearestCluster.startLine),
          end: nearestCluster.endLine,
          confidence: 'high'
        });
      }
    } else if (clusters.length > 0) {
      results.confidence = 'medium';
      results.method = ['clustering'];
      const significantClusters = clusters.filter(c => c.lines.length >= 5);
      results.ranges = significantClusters.map(c => ({
        start: c.startLine,
        end: c.endLine,
        confidence: 'medium'
      }));
    } else if (frontMatterToc) {
      results.confidence = 'low';
      results.method = ['front-matter'];
      results.ranges.push(frontMatterToc);
    }

    return results;
  }

  /**
   * Strategy 4: Remove page headers/footers
   */
  removePageArtifacts(text) {
    const changes = [];
    const lines = text.split('\n');
    const cleanedLines = [];

    // Patterns that indicate page artifacts
    const pagePatterns = [
      /^Page \d+ of \d+$/i,
      /^\d+ \| .+$/,  // "12 | Document Title"
      /^[-_]{5,}$/,   // Separator lines
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      let isArtifact = false;

      for (const pattern of pagePatterns) {
        if (pattern.test(line)) {
          isArtifact = true;
          changes.push({
            type: 'page-artifact',
            line: i,
            text: line,
            pattern: pattern.toString()
          });
          break;
        }
      }

      if (!isArtifact) {
        cleanedLines.push(lines[i]);
      }
    }

    return {
      text: cleanedLines.join('\n'),
      changes
    };
  }

  /**
   * Strategy 5: Fix encoding issues
   */
  fixEncodingIssues(text) {
    const changes = [];
    let fixed = text;

    // Common encoding issues
    const encodingFixes = [
      { from: /â€™/g, to: "'", name: 'smart-apostrophe' },
      { from: /â€œ/g, to: '"', name: 'smart-quote-open' },
      { from: /â€�/g, to: '"', name: 'smart-quote-close' },
      { from: /â€"/g, to: '—', name: 'em-dash' },
      { from: /â€"/g, to: '–', name: 'en-dash' },
    ];

    for (const fix of encodingFixes) {
      const matches = (text.match(fix.from) || []).length;
      if (matches > 0) {
        fixed = fixed.replace(fix.from, fix.to);
        changes.push({
          type: 'encoding-fix',
          name: fix.name,
          count: matches
        });
      }
    }

    return { text: fixed, changes };
  }

  // Helper methods (TOC detection)
  hasTocPageNumber(line) {
    const pageNumberPattern = /[\s\t]+(\d+)\s*$/;
    return pageNumberPattern.test(line.trim());
  }

  findTocHeaders(lines) {
    const tocHeaderPatterns = [
      /^TABLE OF CONTENTS$/i,
      /^CONTENTS$/i,
      /^INDEX$/i,
    ];

    const headers = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      for (const pattern of tocHeaderPatterns) {
        if (pattern.test(line)) {
          headers.push({ lineNumber: i, text: line });
          break;
        }
      }
    }
    return headers;
  }

  detectTocClusters(lines) {
    const clusters = [];
    let currentCluster = null;
    let tocLineCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        if (tocLineCount >= 2 && currentCluster) {
          currentCluster.endLine = i - 1;
          clusters.push(currentCluster);
          currentCluster = null;
          tocLineCount = 0;
        }
        continue;
      }

      const isTocLine = this.hasTocPageNumber(line) && line.length < 200;

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
        if (tocLineCount >= 3) {
          clusters.push(currentCluster);
        }
        currentCluster = null;
        tocLineCount = 0;
      }
    }

    if (tocLineCount >= 3 && currentCluster) {
      clusters.push(currentCluster);
    }

    return clusters;
  }

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

  findNearestCluster(lineNumber, clusters) {
    let nearest = null;
    let minDistance = Infinity;

    for (const cluster of clusters) {
      const distance = Math.abs(cluster.startLine - lineNumber);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = cluster;
      }
    }

    return nearest;
  }

  generateDiff(original, normalized) {
    if (original === normalized) return null;

    // Simple diff: store character count change
    return {
      originalLength: original.length,
      normalizedLength: normalized.length,
      difference: normalized.length - original.length,
      sampleChanges: this.getSampleDifferences(original, normalized, 3)
    };
  }

  getSampleDifferences(original, normalized, maxSamples) {
    const samples = [];
    const origLines = original.split('\n');
    const normLines = normalized.split('\n');

    for (let i = 0; i < Math.min(origLines.length, normLines.length); i++) {
      if (origLines[i] !== normLines[i] && samples.length < maxSamples) {
        samples.push({
          line: i,
          before: origLines[i].substring(0, 100),
          after: normLines[i].substring(0, 100)
        });
      }
    }

    return samples;
  }
}
```

### Input/Output

**Input**: Raw extracted text from mammoth
**Output**: Normalized text with metadata
**Metadata**:
```javascript
{
  tocRanges: [{ start: 0, end: 53, confidence: 'high' }],
  tocConfidence: 'high',
  normalization: {
    stage: 'post-extraction',
    changes: [
      { type: 'whitespace-collapse', count: 47 },
      { type: 'toc-mark', line: 5, text: 'ARTICLE I...' }
    ],
    diff: {
      originalLength: 15420,
      normalizedLength: 15200,
      difference: -220
    }
  }
}
```

---

## Stage 3: Pre-Parsing Normalization

**Goal**: Clean individual lines for consistent pattern matching.

### Line-Level Normalizers

```javascript
/**
 * Stage 3: Pre-Parsing Normalizer
 * Operates on individual lines
 */
class PreParsingNormalizer {
  constructor(config) {
    this.config = config.normalization?.preParsing || {};
  }

  /**
   * Normalize array of lines
   */
  normalizeLines(lines, metadata = {}) {
    const normalized = [];
    const changes = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip TOC lines if marked in Stage 2
      if (line.startsWith('[TOC]')) {
        if (this.config.filterTOC !== false) {
          changes.push({
            type: 'toc-filter',
            line: i,
            text: line.substring(5, 55) + '...'
          });
          continue; // Skip this line
        } else {
          // Remove marker but keep line
          normalized.push(line.substring(5));
          continue;
        }
      }

      // Apply line normalizations
      let normalizedLine = line;

      // Strategy 1: Smart trim (preserve intentional indentation)
      if (this.config.smartTrim !== false) {
        const result = this.smartTrim(normalizedLine);
        normalizedLine = result.text;
        if (result.changed) {
          changes.push({
            type: 'smart-trim',
            line: i,
            before: line,
            after: normalizedLine
          });
        }
      }

      // Strategy 2: Header standardization
      if (this.config.standardizeHeaders !== false) {
        const result = this.standardizeHeader(normalizedLine);
        normalizedLine = result.text;
        if (result.changed) {
          changes.push({
            type: 'header-standardization',
            line: i,
            pattern: result.pattern
          });
        }
      }

      // Strategy 3: Remove empty lines (optional)
      if (this.config.removeEmptyLines && normalizedLine.trim() === '') {
        changes.push({
          type: 'empty-line-removal',
          line: i
        });
        continue;
      }

      normalized.push(normalizedLine);
    }

    return {
      lines: normalized,
      metadata: {
        ...metadata,
        preParsing: {
          stage: 'pre-parsing',
          changes,
          originalLineCount: lines.length,
          normalizedLineCount: normalized.length
        }
      }
    };
  }

  /**
   * Strategy 1: Smart trim
   * Removes trailing whitespace but preserves intentional indentation
   */
  smartTrim(line) {
    const original = line;

    // Remove trailing whitespace
    let trimmed = line.replace(/\s+$/, '');

    // Normalize leading whitespace (but don't remove it)
    const leadingMatch = trimmed.match(/^(\s+)/);
    if (leadingMatch) {
      const leadingSpaces = leadingMatch[1];
      // Normalize tabs and mixed spaces to consistent spaces
      const normalizedLeading = leadingSpaces
        .replace(/\t/g, '    ') // Tab = 4 spaces
        .replace(/ +/g, match => ' '.repeat(match.length)); // Keep space count

      trimmed = normalizedLeading + trimmed.substring(leadingSpaces.length);
    }

    return {
      text: trimmed,
      changed: original !== trimmed
    };
  }

  /**
   * Strategy 2: Standardize header formatting
   * Example: "ARTICLE  I" → "ARTICLE I"
   *          "Article\tI" → "ARTICLE I"
   */
  standardizeHeader(line) {
    const original = line;
    let standardized = line;
    let pattern = null;

    // Pattern 1: Multiple spaces between prefix and number
    if (/^([A-Z]+)\s{2,}([IVX0-9]+)/i.test(standardized)) {
      standardized = standardized.replace(/^([A-Z]+)\s{2,}([IVX0-9]+)/i, '$1 $2');
      pattern = 'multiple-spaces';
    }

    // Pattern 2: Tab between prefix and number
    if (/^([A-Z]+)\t+([IVX0-9]+)/i.test(standardized)) {
      standardized = standardized.replace(/^([A-Z]+)\t+([IVX0-9]+)/i, '$1 $2');
      pattern = 'tab-separator';
    }

    // Pattern 3: No space between prefix and number (e.g., "SectionA")
    if (/^(Section|Article|Chapter)([A-Z0-9])/i.test(standardized)) {
      standardized = standardized.replace(/^(Section|Article|Chapter)([A-Z0-9])/i, '$1 $2');
      pattern = 'no-space';
    }

    return {
      text: standardized,
      changed: original !== standardized,
      pattern
    };
  }
}
```

### Input/Output

**Input**: Array of lines from Stage 2
**Output**: Normalized lines array with metadata
**Metadata**:
```javascript
{
  preParsing: {
    stage: 'pre-parsing',
    changes: [
      { type: 'toc-filter', line: 5, text: 'ARTICLE I...' },
      { type: 'header-standardization', line: 12, pattern: 'tab-separator' }
    ],
    originalLineCount: 150,
    normalizedLineCount: 140
  }
}
```

---

## Stage 4: During-Parsing Normalization

**Goal**: Apply fuzzy matching and final deduplication during section building.

### Pattern-Level Normalizers

```javascript
/**
 * Stage 4: During-Parsing Normalizer
 * Operates during pattern matching and section building
 */
class DuringParsingNormalizer {
  constructor(config) {
    this.config = config.normalization?.duringParsing || {};
  }

  /**
   * Fuzzy match a line against a pattern
   * Handles variations that might have slipped through earlier stages
   */
  fuzzyMatch(line, pattern, detectedItem) {
    const normalizedLine = this.normalizeForMatching(line);
    const normalizedPattern = this.normalizeForMatching(pattern);

    // Exact match (fastest)
    if (normalizedLine.startsWith(normalizedPattern)) {
      return {
        matched: true,
        confidence: 1.0,
        method: 'exact'
      };
    }

    // Fuzzy match (handles minor variations)
    if (this.config.fuzzyMatching !== false) {
      const similarity = this.calculateSimilarity(
        normalizedLine.substring(0, pattern.length + 10),
        normalizedPattern
      );

      if (similarity >= (this.config.fuzzyThreshold || 0.9)) {
        return {
          matched: true,
          confidence: similarity,
          method: 'fuzzy'
        };
      }
    }

    return {
      matched: false,
      confidence: 0,
      method: 'none'
    };
  }

  /**
   * Normalize text for pattern matching
   */
  normalizeForMatching(text) {
    let normalized = text.toLowerCase().trim();

    // Collapse all whitespace to single space
    normalized = normalized.replace(/\s+/g, ' ');

    // Remove punctuation for matching
    normalized = normalized.replace(/[:\-–—]/g, '');

    return normalized;
  }

  /**
   * Calculate Levenshtein distance-based similarity
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(shorter, longer);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Enhanced deduplication with normalization awareness
   */
  deduplicateSections(sections, metadata = {}) {
    const seen = new Map();
    const unique = [];
    const duplicates = [];
    const changes = [];

    for (const section of sections) {
      // Normalize citation for comparison
      const normalizedCitation = this.normalizeForMatching(section.citation);
      const normalizedTitle = this.normalizeForMatching(section.title);
      const key = `${normalizedCitation}|${normalizedTitle}`;

      if (!seen.has(key)) {
        seen.set(key, section);
        unique.push(section);
      } else {
        const original = seen.get(key);
        const originalLength = (original.text || '').length;
        const currentLength = (section.text || '').length;

        // Keep the one with more content
        if (currentLength > originalLength) {
          const index = unique.indexOf(original);
          unique[index] = section;
          seen.set(key, section);
          duplicates.push(original);

          changes.push({
            type: 'duplicate-replacement',
            citation: section.citation,
            reason: 'More content',
            lengths: { kept: currentLength, discarded: originalLength }
          });
        } else {
          duplicates.push(section);

          changes.push({
            type: 'duplicate-skip',
            citation: section.citation,
            reason: 'Less content',
            lengths: { kept: originalLength, discarded: currentLength }
          });
        }
      }
    }

    return {
      sections: unique,
      metadata: {
        ...metadata,
        duringParsing: {
          stage: 'during-parsing',
          changes,
          duplicatesRemoved: duplicates.length,
          duplicateCitations: [...new Set(duplicates.map(d => d.citation))]
        }
      }
    };
  }
}
```

### Input/Output

**Input**: Sections from hierarchy detection
**Output**: Deduplicated sections with metadata
**Metadata**:
```javascript
{
  duringParsing: {
    stage: 'during-parsing',
    changes: [
      {
        type: 'duplicate-replacement',
        citation: 'ARTICLE I',
        reason: 'More content',
        lengths: { kept: 450, discarded: 25 }
      }
    ],
    duplicatesRemoved: 36,
    duplicateCitations: ['ARTICLE I', 'ARTICLE II', ...]
  }
}
```

---

## Configuration Schema

```javascript
/**
 * Normalization configuration schema
 * Each stage and strategy can be enabled/disabled
 */
const normalizationConfigSchema = {
  normalization: {
    enabled: true, // Master switch

    // Stage 1: Pre-Extraction
    preExtraction: {
      normalizeUnicode: true,
      tabsToSpaces: true,
      tabWidth: 4,
      transformDocument: false // Advanced: modify mammoth document tree
    },

    // Stage 2: Post-Extraction
    postExtraction: {
      normalizeWhitespace: true,
      normalizeLineEndings: true,
      detectTOC: true,
      removePageArtifacts: true,
      fixEncoding: true
    },

    // Stage 3: Pre-Parsing
    preParsing: {
      filterTOC: true,
      smartTrim: true,
      standardizeHeaders: true,
      removeEmptyLines: false // Keep empty lines for context
    },

    // Stage 4: During-Parsing
    duringParsing: {
      fuzzyMatching: true,
      fuzzyThreshold: 0.9, // 90% similarity required
      deduplication: true
    },

    // Debug options
    debug: {
      preserveOriginal: true, // Store original text in metadata
      logChanges: true,       // Log all normalization changes
      generateDiffs: true     // Generate diffs for comparison
    }
  }
};
```

### Loading Configuration

```javascript
/**
 * Load normalization config from organization settings
 */
function loadNormalizationConfig(organizationConfig) {
  const defaults = {
    normalization: {
      enabled: true,
      preExtraction: {
        normalizeUnicode: true,
        tabsToSpaces: true,
        tabWidth: 4,
        transformDocument: false
      },
      postExtraction: {
        normalizeWhitespace: true,
        normalizeLineEndings: true,
        detectTOC: true,
        removePageArtifacts: true,
        fixEncoding: true
      },
      preParsing: {
        filterTOC: true,
        smartTrim: true,
        standardizeHeaders: true,
        removeEmptyLines: false
      },
      duringParsing: {
        fuzzyMatching: true,
        fuzzyThreshold: 0.9,
        deduplication: true
      },
      debug: {
        preserveOriginal: process.env.NODE_ENV !== 'production',
        logChanges: true,
        generateDiffs: process.env.NODE_ENV !== 'production'
      }
    }
  };

  // Merge with organization config
  return {
    ...defaults,
    ...organizationConfig,
    normalization: {
      ...defaults.normalization,
      ...(organizationConfig.normalization || {})
    }
  };
}
```

---

## Code Structure

### File Organization

```
src/
├── parsers/
│   ├── wordParser.js                    # Main parser (calls normalizers)
│   ├── googleDocsParser.js              # Google Docs parser
│   └── hierarchyDetector.js             # Existing hierarchy detection
│
├── normalizers/
│   ├── index.js                         # Export all normalizers
│   ├── NormalizationPipeline.js         # Main pipeline orchestrator
│   │
│   ├── stage1/
│   │   └── PreExtractionNormalizer.js   # Stage 1: DOCX options
│   │
│   ├── stage2/
│   │   ├── PostExtractionNormalizer.js  # Stage 2: Text-level
│   │   ├── TocDetector.js               # TOC detection logic
│   │   └── WhitespaceNormalizer.js      # Whitespace strategies
│   │
│   ├── stage3/
│   │   ├── PreParsingNormalizer.js      # Stage 3: Line-level
│   │   └── HeaderStandardizer.js        # Header normalization
│   │
│   ├── stage4/
│   │   ├── DuringParsingNormalizer.js   # Stage 4: Pattern-level
│   │   ├── FuzzyMatcher.js              # Fuzzy matching logic
│   │   └── Deduplicator.js              # Deduplication logic
│   │
│   └── utils/
│       ├── diffGenerator.js             # Generate diffs
│       ├── metadataBuilder.js           # Build normalization metadata
│       └── logger.js                    # Normalization logging
│
└── config/
    └── normalizationConfig.js           # Default configuration
```

### Main Pipeline Orchestrator

```javascript
/**
 * NormalizationPipeline.js
 * Orchestrates all 4 stages of normalization
 */
class NormalizationPipeline {
  constructor(organizationConfig) {
    this.config = loadNormalizationConfig(organizationConfig);

    // Initialize stage normalizers
    this.stage1 = new PreExtractionNormalizer(this.config);
    this.stage2 = new PostExtractionNormalizer(this.config);
    this.stage3 = new PreParsingNormalizer(this.config);
    this.stage4 = new DuringParsingNormalizer(this.config);
  }

  /**
   * Run the complete normalization pipeline
   */
  async normalize(input) {
    if (!this.config.normalization?.enabled) {
      return {
        data: input,
        metadata: { normalizationSkipped: true }
      };
    }

    let data = input;
    let metadata = {};

    // Stage 1: Pre-Extraction (returns mammoth options)
    const mammothOptions = this.stage1.getMammothOptions();
    metadata.stage1 = { mammothOptionsApplied: true };

    // Stage 2: Post-Extraction (text normalization)
    if (data.text) {
      const stage2Result = this.stage2.normalize(data.text, metadata);
      data.text = stage2Result.text;
      metadata = { ...metadata, ...stage2Result.metadata };
    }

    // Stage 3: Pre-Parsing (line normalization)
    if (data.text) {
      const lines = data.text.split('\n');
      const stage3Result = this.stage3.normalizeLines(lines, metadata);
      data.text = stage3Result.lines.join('\n');
      metadata = { ...metadata, ...stage3Result.metadata };
    }

    // Stage 4: During-Parsing (applied later during section building)
    // This stage is accessed directly by the parser

    return {
      data,
      metadata,
      mammothOptions // Return for mammoth configuration
    };
  }

  /**
   * Get Stage 4 normalizer for use during parsing
   */
  getParsingNormalizer() {
    return this.stage4;
  }
}

module.exports = NormalizationPipeline;
```

### Integration with WordParser

```javascript
/**
 * Updated wordParser.js to use normalization pipeline
 */
const NormalizationPipeline = require('../normalizers/NormalizationPipeline');

class WordParser {
  async parseDocument(filePath, organizationConfig) {
    try {
      // Initialize normalization pipeline
      const pipeline = new NormalizationPipeline(organizationConfig);

      // Stage 1: Get mammoth options
      const mammothOptions = pipeline.stage1.getMammothOptions();

      // Read DOCX with normalized options
      const buffer = await fs.readFile(filePath);
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer }, mammothOptions),
        mammoth.convertToHtml({ buffer }, mammothOptions)
      ]);

      // Stage 2 & 3: Normalize extracted text
      const normalizedResult = await pipeline.normalize({
        text: textResult.value,
        html: htmlResult.value
      });

      // Parse sections with normalized text
      const sections = await this.parseSections(
        normalizedResult.data.text,
        normalizedResult.data.html,
        organizationConfig,
        pipeline.getParsingNormalizer() // Pass Stage 4 normalizer
      );

      return {
        success: true,
        sections,
        metadata: {
          source: 'word',
          fileName: filePath.split('/').pop(),
          parsedAt: new Date().toISOString(),
          sectionCount: sections.length,
          normalization: normalizedResult.metadata
        }
      };
    } catch (error) {
      console.error('Error parsing Word document:', error);
      return {
        success: false,
        error: error.message,
        sections: []
      };
    }
  }

  async parseSections(text, html, organizationConfig, parsingNormalizer) {
    const lines = text.split('\n');
    const sections = [];

    // Detect hierarchy (existing)
    const detectedItems = hierarchyDetector.detectHierarchy(text, organizationConfig);

    // Build sections with fuzzy matching (Stage 4)
    const headerLines = new Set();
    const itemsByLine = new Map();

    for (const item of detectedItems) {
      const pattern = item.fullMatch.trim();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (headerLines.has(i)) continue;

        // Use Stage 4 fuzzy matching
        const matchResult = parsingNormalizer.fuzzyMatch(line, pattern, item);

        if (matchResult.matched) {
          headerLines.add(i);
          itemsByLine.set(i, {
            ...item,
            matchConfidence: matchResult.confidence,
            matchMethod: matchResult.method
          });
          break;
        }
      }
    }

    // Build sections (existing logic)
    // ... (continue with existing section building)

    // Stage 4: Deduplication
    const deduplicatedResult = parsingNormalizer.deduplicateSections(
      sections,
      { /* existing metadata */ }
    );

    return deduplicatedResult.sections;
  }
}
```

---

## Migration Plan

### Phase 1: Add Infrastructure (Non-Breaking) - Week 1

**Goal**: Add normalization code without changing behavior.

**Tasks**:
1. Create `/src/normalizers/` directory structure
2. Implement base normalizer classes
3. Add configuration schema
4. Write unit tests for each normalizer
5. Add feature flag: `ENABLE_NORMALIZATION=false`

**Success Criteria**:
- All tests pass
- No change in parsing output
- Code coverage > 80%

---

### Phase 2: Stage-by-Stage Rollout - Week 2-3

**Goal**: Enable stages incrementally with monitoring.

#### Phase 2.1: Stage 1 (Pre-Extraction)
```javascript
// Enable with flag
ENABLE_NORMALIZATION_STAGE1=true
```

**Monitor**:
- Text extraction quality
- Whitespace consistency
- No content loss

#### Phase 2.2: Stage 2 (Post-Extraction)
```javascript
ENABLE_NORMALIZATION_STAGE2=true
```

**Monitor**:
- TOC detection accuracy
- Section count changes
- Line count differences

#### Phase 2.3: Stage 3 (Pre-Parsing)
```javascript
ENABLE_NORMALIZATION_STAGE3=true
```

**Monitor**:
- Header standardization
- Empty line handling
- Pattern matching improvements

#### Phase 2.4: Stage 4 (During-Parsing)
```javascript
ENABLE_NORMALIZATION_STAGE4=true
```

**Monitor**:
- Fuzzy match accuracy
- Deduplication effectiveness
- False positive rate

---

### Phase 3: Production Deployment - Week 4

**Goal**: Enable all stages in production with rollback capability.

**Tasks**:
1. Enable all stages for new documents
2. Re-process sample of existing documents
3. Compare results (A/B testing)
4. Fix any edge cases
5. Update documentation

**Success Criteria**:
- RNC bylaws: ~36 sections (down from 72)
- No empty sections
- 100% content capture
- Performance within 10% of baseline

---

## Testing Strategy

### Unit Tests (Per-Normalizer)

```javascript
// Example: Stage 2 whitespace normalization test
describe('PostExtractionNormalizer - Whitespace', () => {
  it('should collapse multiple spaces', () => {
    const normalizer = new PostExtractionNormalizer(defaultConfig);
    const input = 'ARTICLE  I    NAME';

    const result = normalizer.normalizeWhitespace(input);

    expect(result.text).toBe('ARTICLE I NAME');
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].type).toBe('whitespace-collapse');
  });

  it('should preserve intentional spacing', () => {
    const normalizer = new PostExtractionNormalizer(defaultConfig);
    const input = 'Section 1.  This is content.';

    const result = normalizer.normalizeWhitespace(input);

    // Two spaces after period are intentional (legal writing style)
    expect(result.text).toBe('Section 1. This is content.');
  });
});
```

### Integration Tests (End-to-End)

```javascript
// Example: Full pipeline test
describe('NormalizationPipeline - Full Flow', () => {
  it('should normalize RNC bylaws correctly', async () => {
    const pipeline = new NormalizationPipeline(rncConfig);
    const rawText = loadTestDocument('rnc-bylaws-raw.txt');

    const result = await pipeline.normalize({ text: rawText });

    // Verify TOC detected
    expect(result.metadata.tocRanges).toHaveLength(1);
    expect(result.metadata.tocRanges[0].start).toBeLessThanOrEqual(10);

    // Verify whitespace normalized
    expect(result.metadata.postExtraction.changes).toContainEqual(
      expect.objectContaining({ type: 'whitespace-collapse' })
    );

    // Verify text is cleaner
    expect(result.data.text).not.toContain('\t');
    expect(result.data.text).not.toMatch(/ {2,}/);
  });

  it('should not break on normal documents', async () => {
    const pipeline = new NormalizationPipeline(defaultConfig);
    const rawText = loadTestDocument('normal-bylaws.txt');

    const result = await pipeline.normalize({ text: rawText });

    // Should pass through with minimal changes
    expect(result.metadata.tocRanges).toHaveLength(0);
    expect(result.data.text.length).toBeCloseTo(rawText.length, -2);
  });
});
```

### Regression Tests (Compare Before/After)

```javascript
describe('NormalizationPipeline - Regression Tests', () => {
  it('should maintain content parity with baseline', async () => {
    const baselineResult = await parseWithoutNormalization('test-doc.docx');
    const normalizedResult = await parseWithNormalization('test-doc.docx');

    // Same number of sections (or fewer due to deduplication)
    expect(normalizedResult.sections.length).toBeLessThanOrEqual(
      baselineResult.sections.length
    );

    // All content preserved
    const baselineText = baselineResult.sections
      .map(s => s.text)
      .join(' ');
    const normalizedText = normalizedResult.sections
      .map(s => s.text)
      .join(' ');

    expect(normalizedText.length).toBeGreaterThanOrEqual(
      baselineText.length * 0.95 // Allow 5% reduction (whitespace cleanup)
    );
  });
});
```

---

## A/B Testing Framework

### Comparison Infrastructure

```javascript
/**
 * A/B testing framework for normalization
 * Compares normalized vs non-normalized results
 */
class NormalizationABTest {
  constructor() {
    this.results = {
      baseline: [],
      normalized: [],
      comparison: []
    };
  }

  /**
   * Run A/B test on a document
   */
  async runTest(documentPath, organizationConfig) {
    // Parse without normalization (baseline)
    const baselineConfig = {
      ...organizationConfig,
      normalization: { enabled: false }
    };
    const baselineResult = await wordParser.parseDocument(
      documentPath,
      baselineConfig
    );

    // Parse with normalization
    const normalizedConfig = {
      ...organizationConfig,
      normalization: { enabled: true }
    };
    const normalizedResult = await wordParser.parseDocument(
      documentPath,
      normalizedConfig
    );

    // Compare results
    const comparison = this.compareResults(baselineResult, normalizedResult);

    // Store results
    this.results.baseline.push(baselineResult);
    this.results.normalized.push(normalizedResult);
    this.results.comparison.push(comparison);

    return comparison;
  }

  /**
   * Compare baseline vs normalized results
   */
  compareResults(baseline, normalized) {
    const comparison = {
      document: baseline.metadata.fileName,
      timestamp: new Date().toISOString(),

      // Section count comparison
      sectionCount: {
        baseline: baseline.sections.length,
        normalized: normalized.sections.length,
        difference: normalized.sections.length - baseline.sections.length,
        percentChange: ((normalized.sections.length - baseline.sections.length) / baseline.sections.length * 100).toFixed(2) + '%'
      },

      // Content length comparison
      contentLength: {
        baseline: this.getTotalContentLength(baseline.sections),
        normalized: this.getTotalContentLength(normalized.sections),
        difference: null, // calculated below
        percentChange: null // calculated below
      },

      // Empty sections
      emptySections: {
        baseline: baseline.sections.filter(s => !s.text || s.text.trim() === '').length,
        normalized: normalized.sections.filter(s => !s.text || s.text.trim() === '').length,
        improvement: null // calculated below
      },

      // Duplicate detection
      duplicates: {
        baseline: this.findDuplicates(baseline.sections).length,
        normalized: this.findDuplicates(normalized.sections).length,
        removed: null // calculated below
      },

      // Quality metrics
      quality: {
        baselineScore: this.calculateQualityScore(baseline),
        normalizedScore: this.calculateQualityScore(normalized),
        improvement: null // calculated below
      },

      // Normalization metadata
      normalization: normalized.metadata.normalization || null,

      // Verdict
      verdict: null // calculated below
    };

    // Calculate differences
    comparison.contentLength.difference =
      comparison.contentLength.normalized - comparison.contentLength.baseline;
    comparison.contentLength.percentChange =
      (comparison.contentLength.difference / comparison.contentLength.baseline * 100).toFixed(2) + '%';

    comparison.emptySections.improvement =
      comparison.emptySections.baseline - comparison.emptySections.normalized;

    comparison.duplicates.removed =
      comparison.duplicates.baseline - comparison.duplicates.normalized;

    comparison.quality.improvement =
      comparison.quality.normalizedScore - comparison.quality.baselineScore;

    // Determine verdict
    comparison.verdict = this.determineVerdict(comparison);

    return comparison;
  }

  getTotalContentLength(sections) {
    return sections.reduce((sum, s) => sum + (s.text || '').length, 0);
  }

  findDuplicates(sections) {
    const citations = sections.map(s => s.citation);
    return citations.filter((c, i) => citations.indexOf(c) !== i);
  }

  calculateQualityScore(result) {
    let score = 100;

    // Deduct for empty sections
    const emptySections = result.sections.filter(s => !s.text || s.text.trim() === '').length;
    score -= emptySections * 5;

    // Deduct for duplicates
    const duplicates = this.findDuplicates(result.sections).length;
    score -= duplicates * 10;

    // Deduct for inconsistent formatting (heuristic)
    const inconsistentFormatting = result.sections.filter(s => {
      const citation = s.citation || '';
      return citation.includes('  ') || citation.includes('\t');
    }).length;
    score -= inconsistentFormatting * 2;

    return Math.max(0, score);
  }

  determineVerdict(comparison) {
    const improvements = [];
    const regressions = [];

    // Check section count
    if (comparison.sectionCount.difference < 0) {
      improvements.push(`Removed ${Math.abs(comparison.sectionCount.difference)} duplicate sections`);
    } else if (comparison.sectionCount.difference > 0) {
      regressions.push(`Section count increased by ${comparison.sectionCount.difference}`);
    }

    // Check empty sections
    if (comparison.emptySections.improvement > 0) {
      improvements.push(`Eliminated ${comparison.emptySections.improvement} empty sections`);
    } else if (comparison.emptySections.improvement < 0) {
      regressions.push(`Created ${Math.abs(comparison.emptySections.improvement)} empty sections`);
    }

    // Check duplicates
    if (comparison.duplicates.removed > 0) {
      improvements.push(`Removed ${comparison.duplicates.removed} duplicate citations`);
    } else if (comparison.duplicates.removed < 0) {
      regressions.push(`Created ${Math.abs(comparison.duplicates.removed)} duplicate citations`);
    }

    // Check quality score
    if (comparison.quality.improvement > 5) {
      improvements.push(`Quality score improved by ${comparison.quality.improvement.toFixed(1)} points`);
    } else if (comparison.quality.improvement < -5) {
      regressions.push(`Quality score decreased by ${Math.abs(comparison.quality.improvement).toFixed(1)} points`);
    }

    // Overall verdict
    let verdict;
    if (regressions.length === 0 && improvements.length > 0) {
      verdict = 'SUCCESS';
    } else if (regressions.length > improvements.length) {
      verdict = 'REGRESSION';
    } else if (improvements.length === 0 && regressions.length === 0) {
      verdict = 'NO_CHANGE';
    } else {
      verdict = 'MIXED';
    }

    return {
      status: verdict,
      improvements,
      regressions,
      recommendation: this.getRecommendation(verdict, improvements, regressions)
    };
  }

  getRecommendation(verdict, improvements, regressions) {
    switch (verdict) {
      case 'SUCCESS':
        return 'Normalization improved parsing. Safe to deploy.';
      case 'REGRESSION':
        return `Normalization caused issues: ${regressions.join(', ')}. Do not deploy.`;
      case 'NO_CHANGE':
        return 'Normalization had no effect on this document. Consider adjusting config.';
      case 'MIXED':
        return `Normalization had mixed results. Review: ${[...improvements, ...regressions].join(', ')}`;
      default:
        return 'Unknown verdict';
    }
  }

  /**
   * Generate A/B test report
   */
  generateReport() {
    const report = {
      summary: {
        totalTests: this.results.comparison.length,
        successes: this.results.comparison.filter(c => c.verdict.status === 'SUCCESS').length,
        regressions: this.results.comparison.filter(c => c.verdict.status === 'REGRESSION').length,
        noChanges: this.results.comparison.filter(c => c.verdict.status === 'NO_CHANGE').length,
        mixed: this.results.comparison.filter(c => c.verdict.status === 'MIXED').length
      },
      details: this.results.comparison,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Overall success rate
    const successRate = this.results.comparison.filter(c => c.verdict.status === 'SUCCESS').length /
                        this.results.comparison.length;

    if (successRate >= 0.9) {
      recommendations.push('✅ Normalization is highly effective. Safe to deploy to production.');
    } else if (successRate >= 0.7) {
      recommendations.push('⚠️ Normalization is mostly effective. Review regressions before deploying.');
    } else {
      recommendations.push('❌ Normalization has too many regressions. Do not deploy. Needs refinement.');
    }

    // Specific issue recommendations
    const commonIssues = this.identifyCommonIssues();
    if (commonIssues.length > 0) {
      recommendations.push('Common issues found:');
      recommendations.push(...commonIssues.map(issue => `  - ${issue}`));
    }

    return recommendations;
  }

  identifyCommonIssues() {
    const issues = [];

    // Check if many documents have section count increases
    const sectionIncreases = this.results.comparison.filter(
      c => c.sectionCount.difference > 0
    ).length;

    if (sectionIncreases > this.results.comparison.length / 3) {
      issues.push('TOC filtering may be too aggressive (section count increasing)');
    }

    // Check if many documents have content loss
    const contentLoss = this.results.comparison.filter(
      c => c.contentLength.difference < -100 // More than 100 chars lost
    ).length;

    if (contentLoss > this.results.comparison.length / 4) {
      issues.push('Content loss detected. Review whitespace/line normalization.');
    }

    return issues;
  }
}
```

### Running A/B Tests

```javascript
// Example: Run A/B test on sample documents
async function runABTests() {
  const abTest = new NormalizationABTest();

  const testDocuments = [
    'test-data/rnc-bylaws.docx',
    'test-data/normal-bylaws.docx',
    'test-data/complex-hierarchy.docx',
    'test-data/minimal-toc.docx'
  ];

  for (const docPath of testDocuments) {
    console.log(`Testing: ${docPath}`);
    const comparison = await abTest.runTest(docPath, rncConfig);

    console.log(`  Status: ${comparison.verdict.status}`);
    console.log(`  Sections: ${comparison.sectionCount.baseline} → ${comparison.sectionCount.normalized}`);
    console.log(`  Quality: ${comparison.quality.baselineScore} → ${comparison.quality.normalizedScore}`);
    console.log(`  Verdict: ${comparison.verdict.recommendation}`);
    console.log('');
  }

  // Generate final report
  const report = abTest.generateReport();

  console.log('=== A/B Test Summary ===');
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Successes: ${report.summary.successes}`);
  console.log(`Regressions: ${report.summary.regressions}`);
  console.log(`No Changes: ${report.summary.noChanges}`);
  console.log(`Mixed: ${report.summary.mixed}`);
  console.log('');
  console.log('=== Recommendations ===');
  report.recommendations.forEach(rec => console.log(rec));

  // Save detailed report
  fs.writeFileSync(
    'ab-test-report.json',
    JSON.stringify(report, null, 2)
  );
}
```

---

## Performance Considerations

### Complexity Analysis

| Stage | Operation | Complexity | Notes |
|-------|-----------|------------|-------|
| Stage 1 | Mammoth config | O(1) | One-time setup |
| Stage 2 | Text normalization | O(n) | n = text length |
| Stage 2 | TOC detection | O(m) | m = line count |
| Stage 3 | Line normalization | O(m) | m = line count |
| Stage 4 | Fuzzy matching | O(k×p) | k = patterns, p = lines |
| Stage 4 | Deduplication | O(s) | s = sections |
| **Total** | **Full pipeline** | **O(n + m + k×p + s)** | Linear overall |

### Memory Usage

- **Baseline (no normalization)**: ~10MB for 500-section document
- **With normalization**:
  - Original text preservation: +20% (~12MB)
  - Metadata storage: +10% (~11MB)
  - Working memory: +5% (~10.5MB during processing)
- **Total overhead**: ~20-35% (acceptable for debugging benefits)

### Optimization Strategies

1. **Lazy Loading**: Only load normalizers when enabled
2. **Streaming**: Process large documents in chunks
3. **Caching**: Cache TOC detection results
4. **Early Termination**: Stop TOC search after 200 lines if nothing found
5. **Parallel Processing**: Run independent normalizations concurrently

```javascript
// Example: Parallel Stage 2 normalizations
async normalizeParallel(text) {
  const [
    whitespaceResult,
    lineEndingResult,
    tocResult,
    encodingResult
  ] = await Promise.all([
    this.normalizeWhitespace(text),
    this.normalizeLineEndings(text),
    this.detectAndMarkTOC(text),
    this.fixEncodingIssues(text)
  ]);

  // Merge results intelligently
  return this.mergeResults([
    whitespaceResult,
    lineEndingResult,
    tocResult,
    encodingResult
  ]);
}
```

---

## Rollback Strategy

### Feature Flags

```javascript
// Environment-based feature flags
const NORMALIZATION_FLAGS = {
  ENABLE_NORMALIZATION: process.env.ENABLE_NORMALIZATION === 'true',
  ENABLE_STAGE_1: process.env.ENABLE_NORMALIZATION_STAGE1 === 'true',
  ENABLE_STAGE_2: process.env.ENABLE_NORMALIZATION_STAGE2 === 'true',
  ENABLE_STAGE_3: process.env.ENABLE_NORMALIZATION_STAGE3 === 'true',
  ENABLE_STAGE_4: process.env.ENABLE_NORMALIZATION_STAGE4 === 'true',
};

// Runtime toggle
class NormalizationPipeline {
  constructor(organizationConfig) {
    this.config = {
      ...organizationConfig,
      normalization: {
        ...organizationConfig.normalization,
        enabled: NORMALIZATION_FLAGS.ENABLE_NORMALIZATION &&
                 (organizationConfig.normalization?.enabled !== false)
      }
    };
  }
}
```

### Graceful Degradation

```javascript
/**
 * Safe normalization with fallback
 */
async normalizeWithFallback(input) {
  try {
    // Attempt normalization
    const result = await this.normalize(input);

    // Validate result
    if (this.validateNormalization(result)) {
      return result;
    } else {
      console.warn('[Normalization] Validation failed, using original');
      return { data: input, metadata: { normalizationFailed: true } };
    }
  } catch (error) {
    console.error('[Normalization] Error, using original:', error);
    return { data: input, metadata: { normalizationError: error.message } };
  }
}

validateNormalization(result) {
  // Basic validation checks
  return (
    result.data &&
    result.data.text &&
    result.data.text.length > 0 &&
    result.data.text.length >= this.originalText.length * 0.8 // No more than 20% loss
  );
}
```

### Emergency Disable

```bash
# Disable all normalization instantly
export ENABLE_NORMALIZATION=false

# Restart service
pm2 restart bylaws-tool
```

### Rollback Checklist

1. **Detect Issue**
   - Monitor logs for normalization errors
   - Check A/B test reports for regressions
   - Review user reports

2. **Disable Feature**
   - Set `ENABLE_NORMALIZATION=false`
   - Or disable specific stage: `ENABLE_NORMALIZATION_STAGE2=false`

3. **Investigate**
   - Check normalization metadata for failing documents
   - Review diff logs
   - Reproduce issue locally

4. **Fix & Re-deploy**
   - Fix normalizer code
   - Re-run A/B tests
   - Re-enable with monitoring

---

## Success Metrics

### Quantitative Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Duplicate sections | 36 (RNC) | 0 | Section count |
| Empty sections | 15% | <5% | Empty text count |
| TOC detection accuracy | N/A | >95% | Manual review |
| Content loss | 0% | 0% | Character count |
| Parsing time | 2.5s | <3s | Performance test |
| Memory usage | 10MB | <15MB | Memory profiler |

### Qualitative Metrics

- ✅ No false positive TOC filtering
- ✅ No false negative section detection
- ✅ Improved header consistency
- ✅ Better debugging with metadata
- ✅ Maintainable code structure

### Monitoring Dashboard

```javascript
// Log normalization metrics
function logNormalizationMetrics(metadata) {
  console.log('[Normalization Metrics]', {
    tocDetected: metadata.tocRanges?.length > 0,
    tocConfidence: metadata.tocConfidence,
    duplicatesRemoved: metadata.duringParsing?.duplicatesRemoved || 0,
    totalChanges: [
      ...(metadata.postExtraction?.changes || []),
      ...(metadata.preParsing?.changes || []),
      ...(metadata.duringParsing?.changes || [])
    ].length,
    contentDiff: metadata.normalization?.diff?.difference || 0
  });
}
```

---

## Conclusion

This normalization pipeline design provides a **systematic, staged approach** to cleaning and standardizing document text before and during parsing. Key benefits:

✅ **Solves Current Issues**:
- Tab/space inconsistency → Stage 1 & 2 normalization
- TOC duplication → Stage 2 detection + Stage 4 deduplication
- Empty sections → Stage 3 filtering + Stage 4 validation
- Inconsistent patterns → Stage 4 fuzzy matching

✅ **Architectural Excellence**:
- Modular design (4 clear stages)
- Configurable (enable/disable any stage/strategy)
- Testable (isolated unit + integration tests)
- Observable (detailed metadata and diffs)
- Reversible (original preserved in metadata)

✅ **Production-Ready**:
- A/B testing framework
- Feature flags for safe rollout
- Rollback strategy
- Performance optimized
- Graceful degradation

### Next Steps

1. **Week 1**: Implement infrastructure and unit tests
2. **Week 2-3**: Stage-by-stage rollout with monitoring
3. **Week 4**: Production deployment with A/B testing
4. **Ongoing**: Monitor metrics and refine based on feedback

This design ensures that normalization **improves parsing quality** without introducing new bugs or breaking existing functionality.
