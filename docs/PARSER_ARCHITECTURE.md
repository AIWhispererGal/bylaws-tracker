# Document Parser Architecture

**Version:** 2.0
**Status:** Architecture Design
**Date:** 2025-10-08
**Author:** System Architecture Designer

---

## Executive Summary

This document outlines the comprehensive architecture for parsing DOCX and Google Docs documents with support for **10-level hierarchical structures**. The parser intelligently detects document structure, handles various numbering schemes, and stores parsed sections in the `document_sections` database table.

### Key Features

- **Multi-format Support**: DOCX files (upload) and Google Docs (API integration)
- **10-Level Hierarchy**: Deep nesting support (Article → Section → Subsection → Clause → etc.)
- **Smart Detection**: Automatic numbering pattern recognition (Roman, Arabic, Letters)
- **Database Integration**: Stores parsed sections with adjacency list + materialized path
- **Validation**: Comprehensive error checking and hierarchy validation

### Current Implementation Status

✅ **Already Implemented** (as of v1.0):
- Word document parsing with mammoth.js
- Google Docs text extraction
- Hierarchy detection engine (3-4 levels)
- Basic numbering scheme support (Roman, numeric, alpha)
- Database storage to legacy `bylaw_sections` table

🔄 **Needs Enhancement**:
- Extend to 10-level hierarchy support
- Migrate to new `document_sections` table schema
- Enhanced Google Docs API integration
- Advanced numbering pattern detection

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Design](#component-design)
3. [Library Analysis](#library-analysis)
4. [Hierarchy Detection Algorithm](#hierarchy-detection-algorithm)
5. [Database Storage Strategy](#database-storage-strategy)
6. [Implementation Plan](#implementation-plan)
7. [Integration Patterns](#integration-patterns)
8. [Testing Strategy](#testing-strategy)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DOCUMENT INPUT LAYER                    │
│                                                              │
│  ┌──────────────┐              ┌─────────────────────┐     │
│  │  DOCX File   │              │  Google Docs URL    │     │
│  │  Upload      │              │  (API Integration)  │     │
│  └──────┬───────┘              └──────────┬──────────┘     │
│         │                                  │                │
└─────────┼──────────────────────────────────┼────────────────┘
          │                                  │
          ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    PARSER ABSTRACTION LAYER                  │
│                                                              │
│  ┌──────────────────────┐      ┌────────────────────────┐  │
│  │   WordParser         │      │   GoogleDocsParser     │  │
│  │   (mammoth.js)       │      │   (googleapis)         │  │
│  └──────────┬───────────┘      └──────────┬─────────────┘  │
│             │                              │                │
│             └──────────┬───────────────────┘                │
│                        ▼                                     │
│           ┌────────────────────────┐                        │
│           │  HierarchyDetector     │                        │
│           │  (Pattern Recognition) │                        │
│           └────────────┬───────────┘                        │
│                        │                                     │
└────────────────────────┼──────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  PROCESSING & ENRICHMENT LAYER               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Section Builder                                     │   │
│  │  - Extract titles and content                        │   │
│  │  - Build parent-child relationships                  │   │
│  │  - Generate section citations                        │   │
│  │  - Calculate path arrays (path_ids, path_ordinals)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Validation Engine                                   │   │
│  │  - Hierarchy consistency checks                      │   │
│  │  - Numbering sequence validation                     │   │
│  │  - Empty section detection                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└────────────────────────────┬──────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE PERSISTENCE LAYER                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Supabase PostgreSQL                                 │   │
│  │                                                       │   │
│  │  document_sections table:                            │   │
│  │  - id, document_id                                   │   │
│  │  - parent_section_id, ordinal, depth                 │   │
│  │  - path_ids[], path_ordinals[]                       │   │
│  │  - section_number, section_title, section_type       │   │
│  │  - original_text, current_text                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
1. INPUT STAGE
   ├─ DOCX File → multer → File Buffer
   └─ Google Docs URL → googleapis → Document JSON

2. PARSING STAGE
   ├─ Buffer/JSON → Extract Text/HTML
   ├─ Text → Hierarchy Detection
   ├─ Patterns → Section Identification
   └─ Lines → Content Extraction

3. ENRICHMENT STAGE
   ├─ Sections → Build Hierarchy Tree
   ├─ Tree → Calculate Paths
   ├─ Paths → Generate Citations
   └─ Data → Validation

4. STORAGE STAGE
   ├─ Validated Sections → Database Insert
   ├─ Parent IDs → Foreign Key References
   └─ Path Arrays → Materialized for Fast Queries
```

---

## 2. Component Design

### 2.1 WordParser Component

**File**: `/src/parsers/wordParser.js`
**Status**: ✅ Implemented, needs 10-level enhancement

```javascript
class WordParser {
  async parseDocument(filePath, organizationConfig)
  async parseSections(text, html, organizationConfig)
  isHeaderLine(line, detectedItem)
  extractTitle(line, detectedItem)
  buildCitation(item, previousSections)
  cleanText(text)
  enrichSections(sections, organizationConfig)
  generatePreview(sections, maxSections)
  validateSections(sections, organizationConfig)
}
```

**Dependencies**:
- `mammoth` - DOCX to HTML/text conversion
- `fs.promises` - File system operations
- `hierarchyDetector` - Pattern detection

**Current Capabilities**:
- ✅ Parses DOCX files to plain text and HTML
- ✅ Detects 3-4 hierarchy levels
- ✅ Supports Roman numerals, numeric, alpha patterns
- ✅ Extracts section titles and content
- ✅ Basic validation

**Enhancement Needed**:
- 🔄 Extend to 10 levels
- 🔄 Improve parent-child relationship detection
- 🔄 Generate `path_ids` and `path_ordinals` arrays
- 🔄 Map to new `document_sections` schema

### 2.2 GoogleDocsParser Component

**File**: `/src/parsers/googleDocsParser.js`
**Status**: ⚠️ Partial implementation

```javascript
class GoogleDocsParser {
  async parseDocument(docContent, organizationConfig)
  extractTextFromGoogleDoc(docContent)
  extractTextFromContent(content)
  async parseSections(text, organizationConfig)
  isHeaderLine(line, detectedItem)
  extractTitle(line, detectedItem)
  cleanText(text)
  enrichSections(sections, organizationConfig)
  generatePreview(sections, maxSections)
}
```

**Dependencies**:
- `googleapis` - ⚠️ **MISSING** - needs to be added
- `hierarchyDetector` - Pattern detection

**Current Capabilities**:
- ✅ Extracts text from Google Docs JSON structure
- ✅ Basic paragraph parsing
- ⚠️ Limited API integration

**Enhancement Needed**:
- 🔄 Add `googleapis` package
- 🔄 Implement OAuth2 authentication
- 🔄 Fetch document via Google Docs API
- 🔄 Parse structured content (headings, styles)
- 🔄 Preserve formatting metadata

### 2.3 HierarchyDetector Component

**File**: `/src/parsers/hierarchyDetector.js`
**Status**: ✅ Implemented, needs 10-level support

```javascript
class HierarchyDetector {
  detectHierarchy(text, organizationConfig)
  buildDetectionPatterns(level)
  escapeRegex(str)
  parseNumber(numberStr, scheme)
  inferHierarchy(text)
  buildHierarchyTree(sections)
  validateHierarchy(sections, organizationConfig)
  validateNumberFormat(number, scheme)
  suggestHierarchyConfig(detectedItems)
}
```

**Current Numbering Schemes**:
- ✅ Roman numerals: `I, II, III, IV, V`
- ✅ Arabic numerals: `1, 2, 3, 4`
- ✅ Uppercase letters: `A, B, C, D`
- ✅ Lowercase letters: `a, b, c, d`

**Enhancement Needed**:
- 🔄 Support mixed patterns: `1.1, 1.2, 1.2.1`
- 🔄 Hierarchical numbering: `Article I.Section 1.Subsection (a).Clause (i)`
- 🔄 Depth inference from indentation
- 🔄 Smart parent-child detection

### 2.4 NumberingSchemes Module

**File**: `/src/parsers/numberingSchemes.js`
**Status**: ✅ Implemented

```javascript
module.exports = {
  toRoman(num)
  fromRoman(str)
  toAlpha(num, lowercase)
  fromAlpha(str, lowercase)
  parseHierarchicalNumber(str)  // 🔄 NEW - needs implementation
}
```

**Current Support**:
- ✅ Roman numeral conversion (I-MMMM)
- ✅ Alpha conversion (A-Z, AA-ZZ)
- ✅ Numeric parsing

**Enhancement Needed**:
- 🔄 Hierarchical number parsing: `1.2.3.4.5`
- 🔄 Mixed format support: `I.1.a.i`
- 🔄 Validation of number sequences

---

## 3. Library Analysis

### 3.1 DOCX Parsing Libraries

#### Option 1: mammoth.js (Current Choice)

**Package**: `mammoth@1.11.0` (Already installed)

**Pros**:
- ✅ **Already integrated** - No migration needed
- ✅ Excellent DOCX to HTML conversion
- ✅ Preserves basic formatting
- ✅ Handles styles and structure
- ✅ Good error handling
- ✅ Active maintenance (last update: 2024)
- ✅ MIT License

**Cons**:
- ⚠️ Limited style metadata extraction
- ⚠️ No direct access to DOCX XML structure
- ⚠️ Cannot detect heading levels programmatically

**Recommendation**: **KEEP** - Works well for current needs

#### Option 2: docx (Alternative)

**Package**: `docx@8.5.0`

**Pros**:
- ✅ Full DOCX creation and parsing
- ✅ Access to raw XML structure
- ✅ Heading level detection
- ✅ Style extraction

**Cons**:
- ❌ Overkill for parsing-only use case
- ❌ Larger bundle size
- ❌ Steeper learning curve

**Recommendation**: **SKIP** - Unnecessary complexity

#### Option 3: officegen (Legacy)

**Package**: `officegen@0.6.5`

**Pros**:
- ✅ Supports DOCX, PPTX, XLSX

**Cons**:
- ❌ Deprecated (last update: 2020)
- ❌ Limited parsing capabilities
- ❌ Focus on generation, not parsing

**Recommendation**: **SKIP** - Outdated

### 3.2 Google Docs Integration

#### Option 1: googleapis (Recommended)

**Package**: `googleapis@134.0.0` (**NEEDS INSTALLATION**)

**Pros**:
- ✅ Official Google API client
- ✅ Full Google Docs API support
- ✅ OAuth2 authentication
- ✅ Type definitions included
- ✅ Well-documented
- ✅ Active maintenance

**Cons**:
- ⚠️ Requires Google Cloud project setup
- ⚠️ OAuth2 complexity
- ⚠️ API rate limits

**Installation**:
```bash
npm install googleapis
```

**Basic Usage**:
```javascript
const { google } = require('googleapis');

// Initialize OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Set credentials
oauth2Client.setCredentials({
  access_token: userAccessToken
});

// Initialize Docs API
const docs = google.docs({ version: 'v1', auth: oauth2Client });

// Fetch document
const doc = await docs.documents.get({
  documentId: docId
});
```

**Recommendation**: **INSTALL** - Essential for Google Docs integration

#### Option 2: google-docs-parser (Community)

**Package**: `google-docs-parser@1.0.0`

**Pros**:
- ✅ Simplified API
- ✅ Built on googleapis

**Cons**:
- ⚠️ Limited maintenance
- ⚠️ Fewer features than official SDK

**Recommendation**: **SKIP** - Use official googleapis

### 3.3 HTML/Text Processing

#### Current Dependencies (Keep):

1. **Built-in String Methods** - ✅ Sufficient for text processing
2. **Regular Expressions** - ✅ Pattern matching
3. **Array Methods** - ✅ Section manipulation

#### Considered but Rejected:

1. **cheerio** - HTML parsing (unnecessary, mammoth provides clean HTML)
2. **turndown** - HTML to Markdown (not needed)
3. **unified/remark** - Markdown processing (out of scope)

---

## 4. Hierarchy Detection Algorithm

### 4.1 Enhanced 10-Level Detection Algorithm

```javascript
/**
 * Enhanced Hierarchy Detection with 10-Level Support
 */
class EnhancedHierarchyDetector {

  /**
   * Detect up to 10 levels of hierarchy
   */
  detectDeepHierarchy(text, organizationConfig) {
    const maxDepth = organizationConfig.hierarchy?.maxDepth || 10;
    const levels = organizationConfig.hierarchy?.levels || this.getDefaultLevels();

    const detected = [];

    // Phase 1: Pattern Detection
    for (const level of levels) {
      if (level.depth >= maxDepth) continue;

      const patterns = this.buildAdvancedPatterns(level);

      for (const pattern of patterns) {
        const matches = this.findPatternMatches(text, pattern);
        detected.push(...matches.map(m => ({
          ...m,
          level: level.name,
          type: level.type,
          depth: level.depth,
          prefix: level.prefix,
          numberingScheme: level.numbering
        })));
      }
    }

    // Phase 2: Context Analysis
    const contextEnriched = this.analyzeContext(detected, text);

    // Phase 3: Parent-Child Resolution
    const hierarchical = this.resolveParentChild(contextEnriched);

    // Phase 4: Path Calculation
    const withPaths = this.calculatePaths(hierarchical);

    return withPaths;
  }

  /**
   * Build advanced detection patterns
   */
  buildAdvancedPatterns(level) {
    const patterns = [];

    // Hierarchical numbering: 1.1, 1.2.3, etc.
    if (level.numbering === 'hierarchical') {
      patterns.push({
        regex: /(\d+(?:\.\d+)*)/g,
        type: 'hierarchical'
      });
    }

    // Mixed format: I.A.1.a.i
    if (level.numbering === 'mixed') {
      patterns.push({
        regex: /([IVX]+|[A-Z]|\d+|[a-z]+|[ivx]+)(?:\.|\)|\s)/g,
        type: 'mixed'
      });
    }

    // Standard patterns (existing)
    patterns.push(...this.buildStandardPatterns(level));

    return patterns;
  }

  /**
   * Analyze context around detected patterns
   */
  analyzeContext(detected, text) {
    const lines = text.split('\n');

    return detected.map(item => {
      const lineIndex = this.findLineIndex(text, item.index);
      const line = lines[lineIndex];

      // Detect indentation
      const indent = this.measureIndentation(line);

      // Check if it's a header (bold, larger font, etc.)
      const isHeader = this.isLikelyHeader(line, lines, lineIndex);

      // Infer depth from indentation
      const inferredDepth = Math.floor(indent / 2); // 2 spaces per level

      return {
        ...item,
        indent,
        isHeader,
        inferredDepth: Math.min(inferredDepth, item.depth || 0),
        lineIndex
      };
    });
  }

  /**
   * Resolve parent-child relationships
   */
  resolveParentChild(items) {
    const stack = [];
    const result = [];

    for (const item of items) {
      const effectiveDepth = item.inferredDepth || item.depth || 0;

      // Pop stack until we find the parent
      while (stack.length > 0 && stack[stack.length - 1].effectiveDepth >= effectiveDepth) {
        stack.pop();
      }

      const parent = stack.length > 0 ? stack[stack.length - 1] : null;

      const enriched = {
        ...item,
        parent_id: parent ? parent.id : null,
        parent_citation: parent ? parent.citation : null,
        effectiveDepth
      };

      result.push(enriched);
      stack.push(enriched);
    }

    return result;
  }

  /**
   * Calculate path arrays for materialized path
   */
  calculatePaths(items) {
    const pathMap = new Map();

    return items.map(item => {
      const ancestors = this.getAncestors(item, items);
      const path_ids = [...ancestors.map(a => a.id), item.id];
      const path_ordinals = [...ancestors.map(a => a.ordinal || 1), item.ordinal || 1];

      return {
        ...item,
        path_ids,
        path_ordinals,
        path_depth: path_ids.length - 1
      };
    });
  }

  /**
   * Get ancestors of an item
   */
  getAncestors(item, allItems) {
    const ancestors = [];
    let current = item;

    while (current.parent_id) {
      const parent = allItems.find(i => i.id === current.parent_id);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }

    return ancestors;
  }

  /**
   * Measure indentation in spaces
   */
  measureIndentation(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Check if line is likely a header
   */
  isLikelyHeader(line, allLines, index) {
    const trimmed = line.trim();

    // Headers are typically:
    // 1. Short (< 200 chars)
    // 2. Not followed by punctuation at end
    // 3. Followed by content or blank line

    if (trimmed.length > 200) return false;
    if (trimmed.endsWith('.') || trimmed.endsWith(',')) return false;

    const nextLine = allLines[index + 1];
    if (nextLine && nextLine.trim() === '') return true;

    return true;
  }

  /**
   * Default 10-level hierarchy configuration
   */
  getDefaultLevels() {
    return [
      { name: 'Article', type: 'article', depth: 0, numbering: 'roman', prefix: 'ARTICLE ' },
      { name: 'Section', type: 'section', depth: 1, numbering: 'numeric', prefix: 'Section ' },
      { name: 'Subsection', type: 'subsection', depth: 2, numbering: 'alpha', prefix: '' },
      { name: 'Paragraph', type: 'paragraph', depth: 3, numbering: 'numeric', prefix: '' },
      { name: 'Subparagraph', type: 'subparagraph', depth: 4, numbering: 'alphaLower', prefix: '' },
      { name: 'Clause', type: 'clause', depth: 5, numbering: 'roman', prefix: '' },
      { name: 'Subclause', type: 'subclause', depth: 6, numbering: 'numeric', prefix: '' },
      { name: 'Item', type: 'item', depth: 7, numbering: 'alphaLower', prefix: '' },
      { name: 'Subitem', type: 'subitem', depth: 8, numbering: 'roman', prefix: '' },
      { name: 'Point', type: 'point', depth: 9, numbering: 'numeric', prefix: '' }
    ];
  }
}
```

### 4.2 Numbering Pattern Examples

```
Level 0 (Article):     ARTICLE I, ARTICLE II, ARTICLE III
Level 1 (Section):     Section 1, Section 2, Section 3
Level 2 (Subsection):  A, B, C, D
Level 3 (Paragraph):   1, 2, 3, 4
Level 4 (Subparagraph): a, b, c, d
Level 5 (Clause):      (i), (ii), (iii), (iv)
Level 6 (Subclause):   (1), (2), (3)
Level 7 (Item):        (a), (b), (c)
Level 8 (Subitem):     (i), (ii), (iii)
Level 9 (Point):       (1), (2), (3)
```

### 4.3 Complex Example

```
ARTICLE I - BYLAWS
  Section 1 - Purpose
    A. Primary Objectives
      1. Community Engagement
        a. Public Meetings
          (i) Monthly sessions
            (1) First Monday
              (a) 7:00 PM start
                (i) Virtual option
                  (1) Zoom link provided
```

**Detected Structure**:
```javascript
[
  { level: 'Article', depth: 0, number: 'I', citation: 'ARTICLE I' },
  { level: 'Section', depth: 1, number: '1', citation: 'Section 1', parent: 'ARTICLE I' },
  { level: 'Subsection', depth: 2, number: 'A', citation: 'A', parent: 'Section 1' },
  { level: 'Paragraph', depth: 3, number: '1', citation: '1', parent: 'A' },
  { level: 'Subparagraph', depth: 4, number: 'a', citation: 'a', parent: '1' },
  { level: 'Clause', depth: 5, number: 'i', citation: '(i)', parent: 'a' },
  { level: 'Subclause', depth: 6, number: '1', citation: '(1)', parent: '(i)' },
  { level: 'Item', depth: 7, number: 'a', citation: '(a)', parent: '(1)' },
  { level: 'Subitem', depth: 8, number: 'i', citation: '(i)', parent: '(a)' },
  { level: 'Point', depth: 9, number: '1', citation: '(1)', parent: '(i)' }
]
```

---

## 5. Database Storage Strategy

### 5.1 Schema Integration

**Target Table**: `document_sections` (from `/database/migrations/001_generalized_schema.sql`)

```sql
CREATE TABLE document_sections (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Hierarchy (Adjacency List + Materialized Path)
  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,

  -- Path Materialization (for fast queries)
  path_ids UUID[] NOT NULL,
  path_ordinals INTEGER[] NOT NULL,

  -- Display Information
  section_number VARCHAR(50),
  section_title TEXT,
  section_type VARCHAR(50),

  -- Content
  original_text TEXT,
  current_text TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(document_id, parent_section_id, ordinal),
  CHECK(depth >= 0 AND depth <= 10),
  CHECK(array_length(path_ids, 1) = depth + 1),
  CHECK(array_length(path_ordinals, 1) = depth + 1),
  CHECK(path_ids[array_length(path_ids, 1)] = id)
);
```

### 5.2 Storage Algorithm

```javascript
/**
 * Store parsed sections in document_sections table
 */
async function storeParsedSections(documentId, sections, supabase) {
  const sectionMap = new Map(); // Track inserted sections

  // Sort sections by depth (parents before children)
  const sorted = sections.sort((a, b) => a.depth - b.depth);

  for (const section of sorted) {
    // Find parent section ID from map
    const parent_section_id = section.parent_citation
      ? sectionMap.get(section.parent_citation)
      : null;

    // Calculate ordinal among siblings
    const ordinal = await getNextOrdinal(
      documentId,
      parent_section_id,
      supabase
    );

    // Build path arrays
    const { path_ids, path_ordinals } = await buildPaths(
      parent_section_id,
      ordinal,
      supabase
    );

    // Insert section
    const { data, error } = await supabase
      .from('document_sections')
      .insert({
        document_id: documentId,
        parent_section_id,
        ordinal,
        depth: section.depth,
        path_ids,
        path_ordinals,
        section_number: section.number,
        section_title: section.title,
        section_type: section.type,
        original_text: section.text,
        current_text: section.text
      })
      .select()
      .single();

    if (error) throw error;

    // Store in map for child lookups
    sectionMap.set(section.citation, data.id);
  }

  return sectionMap;
}

/**
 * Get next ordinal for sibling sections
 */
async function getNextOrdinal(documentId, parentSectionId, supabase) {
  const { data, error } = await supabase
    .from('document_sections')
    .select('ordinal')
    .eq('document_id', documentId)
    .eq('parent_section_id', parentSectionId)
    .order('ordinal', { ascending: false })
    .limit(1);

  if (error) throw error;

  return data.length > 0 ? data[0].ordinal + 1 : 1;
}

/**
 * Build path arrays from parent
 */
async function buildPaths(parentSectionId, ordinal, supabase) {
  if (!parentSectionId) {
    // Root section
    return {
      path_ids: [], // Will be set by trigger
      path_ordinals: [ordinal]
    };
  }

  // Get parent paths
  const { data, error } = await supabase
    .from('document_sections')
    .select('path_ids, path_ordinals')
    .eq('id', parentSectionId)
    .single();

  if (error) throw error;

  return {
    path_ids: [...data.path_ids], // ID appended by trigger
    path_ordinals: [...data.path_ordinals, ordinal]
  };
}
```

### 5.3 Database Triggers

**Use Existing Trigger** from schema (lines 135-162):

```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;
  ELSE
    -- Child section: inherit parent's path and append self
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();
```

**Benefit**: Automatic path calculation on insert/update

---

## 6. Implementation Plan

### 6.1 Phase 1: Library Setup (2-4 hours)

**Tasks**:
1. Install `googleapis` package
   ```bash
   npm install googleapis
   ```

2. Update environment variables in `.env.example`:
   ```env
   # Google Docs API
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
   ```

3. Create Google Cloud project and enable Docs API

**Complexity**: LOW
**Risk**: LOW
**Estimated Time**: 2-4 hours

### 6.2 Phase 2: Enhanced Hierarchy Detection (8-12 hours)

**Tasks**:
1. Extend `HierarchyDetector` to support 10 levels
2. Implement advanced pattern detection:
   - Hierarchical numbering (1.1, 1.2.3)
   - Mixed formats (I.A.1.a.i)
   - Indentation-based depth inference

3. Add context analysis for better accuracy
4. Implement parent-child resolution algorithm
5. Create path calculation logic

**Complexity**: MEDIUM
**Risk**: MEDIUM
**Estimated Time**: 8-12 hours

**Deliverables**:
- `/src/parsers/hierarchyDetector.js` (enhanced)
- `/src/parsers/numberingSchemes.js` (extended)
- Unit tests for 10-level detection

### 6.3 Phase 3: Google Docs Integration (6-10 hours)

**Tasks**:
1. Implement OAuth2 authentication flow
2. Create Google Docs API client wrapper
3. Fetch document content via API
4. Parse structured content (paragraphs, headings, styles)
5. Extract hierarchy from heading styles
6. Handle formatting metadata

**Complexity**: MEDIUM
**Risk**: MEDIUM
**Estimated Time**: 6-10 hours

**Deliverables**:
- `/src/services/googleDocsService.js` (new)
- `/src/parsers/googleDocsParser.js` (enhanced)
- OAuth2 flow in setup wizard

### 6.4 Phase 4: Database Migration (4-6 hours)

**Tasks**:
1. Update parsers to output new schema format
2. Map parsed sections to `document_sections` table
3. Implement storage algorithm with path calculation
4. Test trigger-based path materialization
5. Validate foreign key relationships

**Complexity**: MEDIUM
**Risk**: MEDIUM
**Estimated Time**: 4-6 hours

**Deliverables**:
- `/src/services/sectionStorage.js` (new)
- Migration utilities
- Database tests

### 6.5 Phase 5: Integration & Testing (6-8 hours)

**Tasks**:
1. Integrate parsers with setup wizard
2. Add preview functionality
3. Implement validation UI
4. Create test documents (DOCX, Google Docs)
5. End-to-end testing
6. Performance optimization

**Complexity**: MEDIUM
**Risk**: LOW
**Estimated Time**: 6-8 hours

**Deliverables**:
- Updated `/src/routes/setup.js`
- Test suite for parsers
- Performance benchmarks

### 6.6 Total Estimates

| Phase | Hours | Complexity | Risk | Priority |
|-------|-------|------------|------|----------|
| Phase 1: Library Setup | 2-4 | LOW | LOW | HIGH |
| Phase 2: Enhanced Hierarchy | 8-12 | MEDIUM | MEDIUM | HIGH |
| Phase 3: Google Docs | 6-10 | MEDIUM | MEDIUM | MEDIUM |
| Phase 4: Database Migration | 4-6 | MEDIUM | MEDIUM | HIGH |
| Phase 5: Integration | 6-8 | MEDIUM | LOW | MEDIUM |
| **TOTAL** | **26-40** | **MEDIUM** | **MEDIUM** | - |

**Recommended Sprint**: 5-8 days with 1 developer

---

## 7. Integration Patterns

### 7.1 Setup Wizard Integration

**Current Flow** (from `/src/routes/setup.js`):

```javascript
// Step 3: Document Import
router.post('/setup/import', upload.single('document'), async (req, res) => {
  if (req.file) {
    // DOCX file uploaded
    importData = {
      source: 'file_upload',
      file_path: req.file.path,
      file_name: req.file.originalname,
      auto_detect_structure: req.body.auto_detect_structure !== 'false'
    };
  } else if (req.body.google_docs_url) {
    // Google Docs URL provided
    importData = {
      source: 'google_docs',
      url: req.body.google_docs_url,
      auto_detect_structure: req.body.auto_detect_structure !== 'false'
    };
  }

  // Store in session for step 4
  req.session.setupData.import = importData;
  res.redirect('/setup/review');
});
```

**Enhanced Flow**:

```javascript
router.post('/setup/import', upload.single('document'), async (req, res) => {
  try {
    const organizationConfig = req.session.setupData.organization;
    let parseResult;

    if (req.file) {
      // Parse DOCX file
      const wordParser = require('../parsers/wordParser');
      parseResult = await wordParser.parseDocument(
        req.file.path,
        organizationConfig
      );
    } else if (req.body.google_docs_url) {
      // Parse Google Docs
      const googleDocsService = require('../services/googleDocsService');
      const googleDocsParser = require('../parsers/googleDocsParser');

      // Fetch document content
      const docContent = await googleDocsService.fetchDocument(
        req.body.google_docs_url,
        req.session.googleAccessToken
      );

      // Parse content
      parseResult = await googleDocsParser.parseDocument(
        docContent,
        organizationConfig
      );
    }

    // Validate parsed sections
    const validation = wordParser.validateSections(
      parseResult.sections,
      organizationConfig
    );

    // Store in session
    req.session.setupData.import = {
      ...parseResult,
      validation
    };

    res.redirect('/setup/review');
  } catch (error) {
    console.error('Parse error:', error);
    req.session.setupData.errors = {
      import: error.message
    };
    res.redirect('/setup/import?error=parse_failed');
  }
});
```

### 7.2 Review & Finalize

**Step 4: Review Parsed Sections**:

```javascript
router.get('/setup/review', (req, res) => {
  const { sections, validation, metadata } = req.session.setupData.import;

  res.render('setup/review', {
    sections: sections.slice(0, 10), // Preview first 10
    totalSections: sections.length,
    validation,
    metadata
  });
});

router.post('/setup/finalize', async (req, res) => {
  const { organization, document, import: importData } = req.session.setupData;

  // Create organization
  const org = await createOrganization(organization);

  // Create document
  const doc = await createDocument({
    organization_id: org.id,
    ...document
  });

  // Store parsed sections
  const sectionStorage = require('../services/sectionStorage');
  await sectionStorage.storeParsedSections(
    doc.id,
    importData.sections,
    supabase
  );

  // Redirect to dashboard
  res.redirect('/dashboard');
});
```

### 7.3 Error Handling

```javascript
class ParserError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ParserError';
    this.details = details;
  }
}

// Usage
try {
  const result = await wordParser.parseDocument(filePath, config);

  if (!result.success) {
    throw new ParserError('Parse failed', {
      source: 'word',
      fileName: filePath,
      error: result.error
    });
  }
} catch (error) {
  if (error instanceof ParserError) {
    // Handle parser-specific errors
    console.error('Parser error:', error.details);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**File**: `/tests/parsers/hierarchyDetector.test.js`

```javascript
const hierarchyDetector = require('../../src/parsers/hierarchyDetector');

describe('HierarchyDetector - 10 Level Support', () => {

  test('detects 10-level hierarchy', () => {
    const text = `
      ARTICLE I
      Section 1
      A. Subsection
      1. Paragraph
      a. Subparagraph
      (i) Clause
      (1) Subclause
      (a) Item
      (i) Subitem
      (1) Point
    `;

    const config = {
      hierarchy: {
        maxDepth: 10,
        levels: hierarchyDetector.getDefaultLevels()
      }
    };

    const detected = hierarchyDetector.detectDeepHierarchy(text, config);

    expect(detected).toHaveLength(10);
    expect(detected[0].depth).toBe(0);
    expect(detected[9].depth).toBe(9);
  });

  test('builds correct parent-child relationships', () => {
    // Test implementation
  });

  test('calculates path arrays correctly', () => {
    // Test implementation
  });
});
```

### 8.2 Integration Tests

**File**: `/tests/parsers/integration.test.js`

```javascript
describe('Parser Integration Tests', () => {

  test('parses DOCX and stores in database', async () => {
    const filePath = './test-fixtures/bylaws-sample.docx';
    const config = getTestConfig();

    // Parse
    const result = await wordParser.parseDocument(filePath, config);

    // Store
    const documentId = 'test-doc-123';
    await sectionStorage.storeParsedSections(
      documentId,
      result.sections,
      supabase
    );

    // Verify
    const { data } = await supabase
      .from('document_sections')
      .select('*')
      .eq('document_id', documentId);

    expect(data).toHaveLength(result.sections.length);
  });

  test('handles Google Docs with complex hierarchy', async () => {
    // Test implementation
  });
});
```

### 8.3 Test Fixtures

**Create Test Documents**:

1. `/test-fixtures/bylaws-simple.docx` - 2-3 levels
2. `/test-fixtures/bylaws-complex.docx` - 10 levels
3. `/test-fixtures/bylaws-mixed-numbering.docx` - Mixed schemes

**Google Docs Test URLs**:
- Simple: `https://docs.google.com/document/d/SIMPLE_TEST_ID`
- Complex: `https://docs.google.com/document/d/COMPLEX_TEST_ID`

### 8.4 Performance Benchmarks

```javascript
describe('Parser Performance', () => {

  test('parses 1000 sections in < 5 seconds', async () => {
    const largeDoc = generateLargeDocument(1000);

    const start = Date.now();
    const result = await wordParser.parseDocument(largeDoc, config);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
    expect(result.sections).toHaveLength(1000);
  });
});
```

---

## 9. Summary & Recommendations

### 9.1 Architecture Highlights

✅ **Strengths**:
- Modular design with clear separation of concerns
- Existing parsers provide solid foundation
- Hierarchy detection is intelligent and extensible
- Database schema supports 10-level nesting
- Materialized paths enable fast queries

⚠️ **Areas for Enhancement**:
- Add `googleapis` package for Google Docs
- Extend hierarchy detection to 10 levels
- Implement advanced numbering pattern recognition
- Migrate to new `document_sections` schema
- Add comprehensive validation

### 9.2 Library Recommendations

| Library | Status | Recommendation |
|---------|--------|----------------|
| `mammoth` | ✅ Installed | **KEEP** - Works well for DOCX |
| `googleapis` | ❌ Missing | **INSTALL** - Essential for Google Docs |
| `multer` | ✅ Installed | **KEEP** - File upload handling |
| Other parsing libs | - | **SKIP** - Current stack is sufficient |

### 9.3 Implementation Priority

**High Priority** (Must Have):
1. ✅ Install `googleapis`
2. ✅ Extend hierarchy detection to 10 levels
3. ✅ Migrate to `document_sections` schema
4. ✅ Implement path calculation

**Medium Priority** (Should Have):
1. Google Docs OAuth2 flow
2. Advanced numbering pattern detection
3. Validation UI in setup wizard
4. Performance optimization

**Low Priority** (Nice to Have):
1. Formatting preservation
2. Custom numbering scheme editor
3. Batch import support
4. Export parsed structure

### 9.4 Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Google API rate limits | MEDIUM | MEDIUM | Cache results, implement retry logic |
| Complex hierarchy detection errors | MEDIUM | HIGH | Comprehensive testing, fallback to manual entry |
| Path calculation bugs | LOW | HIGH | Database triggers, extensive validation |
| OAuth2 complexity | MEDIUM | MEDIUM | Use tested libraries, clear documentation |

### 9.5 Next Steps

1. **Immediate** (Week 1):
   - Install `googleapis`
   - Enhance `HierarchyDetector` for 10 levels
   - Create test fixtures

2. **Short-term** (Week 2):
   - Implement Google Docs integration
   - Migrate storage to new schema
   - Add validation

3. **Long-term** (Week 3+):
   - Performance optimization
   - Advanced features
   - Production deployment

---

## Appendix A: Code Examples

### A.1 Complete Parser Usage

```javascript
// Example: Parse DOCX and store in database
const wordParser = require('./src/parsers/wordParser');
const sectionStorage = require('./src/services/sectionStorage');
const { createClient } = require('@supabase/supabase-js');

async function importBylaws(filePath, organizationConfig) {
  // Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // Parse document
  const parseResult = await wordParser.parseDocument(
    filePath,
    organizationConfig
  );

  if (!parseResult.success) {
    throw new Error(`Parse failed: ${parseResult.error}`);
  }

  // Validate
  const validation = wordParser.validateSections(
    parseResult.sections,
    organizationConfig
  );

  if (!validation.valid) {
    console.warn('Validation errors:', validation.errors);
  }

  // Create document record
  const { data: document } = await supabase
    .from('documents')
    .insert({
      organization_id: organizationConfig.id,
      title: 'Bylaws',
      external_source: 'word'
    })
    .select()
    .single();

  // Store sections
  await sectionStorage.storeParsedSections(
    document.id,
    parseResult.sections,
    supabase
  );

  return {
    documentId: document.id,
    sectionCount: parseResult.sections.length,
    validation
  };
}
```

### A.2 Google Docs Integration

```javascript
// Example: Fetch and parse Google Docs
const { google } = require('googleapis');
const googleDocsParser = require('./src/parsers/googleDocsParser');

async function importFromGoogleDocs(docUrl, accessToken, organizationConfig) {
  // Extract document ID from URL
  const docId = extractDocId(docUrl);

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  // Fetch document
  const docs = google.docs({ version: 'v1', auth: oauth2Client });
  const response = await docs.documents.get({ documentId: docId });

  // Parse
  const parseResult = await googleDocsParser.parseDocument(
    response.data,
    organizationConfig
  );

  return parseResult;
}

function extractDocId(url) {
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
```

---

## Appendix B: Configuration Schema

### B.1 Organization Hierarchy Config

```javascript
{
  "hierarchy": {
    "maxDepth": 10,
    "allowNesting": true,
    "levels": [
      {
        "name": "Article",
        "type": "article",
        "depth": 0,
        "numbering": "roman",
        "prefix": "ARTICLE ",
        "required": true
      },
      {
        "name": "Section",
        "type": "section",
        "depth": 1,
        "numbering": "numeric",
        "prefix": "Section ",
        "required": true
      },
      {
        "name": "Subsection",
        "type": "subsection",
        "depth": 2,
        "numbering": "alpha",
        "prefix": "",
        "required": false
      }
      // ... up to 10 levels
    ]
  }
}
```

### B.2 Parser Configuration

```javascript
{
  "parser": {
    "headerMaxLength": 200,
    "inferDepthFromIndent": true,
    "indentPerLevel": 2,
    "detectMixedNumbering": true,
    "validateSequence": true,
    "allowGaps": false
  }
}
```

---

## Appendix C: Database Queries

### C.1 Retrieve Full Hierarchy

```sql
-- Get all sections in document order
SELECT
  id,
  depth,
  section_number,
  section_title,
  path_ordinals,
  REPEAT('  ', depth) || section_number AS indented_number
FROM document_sections
WHERE document_id = :doc_id
ORDER BY path_ordinals;
```

### C.2 Get Section with Ancestors

```sql
-- Get section with breadcrumb path
WITH RECURSIVE ancestors AS (
  -- Base case: target section
  SELECT * FROM document_sections WHERE id = :section_id

  UNION ALL

  -- Recursive case: parent sections
  SELECT ds.*
  FROM document_sections ds
  JOIN ancestors a ON ds.id = a.parent_section_id
)
SELECT
  id,
  depth,
  section_number,
  section_title
FROM ancestors
ORDER BY depth;
```

### C.3 Get Children

```sql
-- Get immediate children
SELECT *
FROM document_sections
WHERE parent_section_id = :parent_id
ORDER BY ordinal;
```

---

**End of Architecture Document**

---

**References**:
- `/database/ARCHITECTURE_DESIGN.md` - Database schema design
- `/src/parsers/wordParser.js` - Current Word parser
- `/src/parsers/googleDocsParser.js` - Current Google Docs parser
- `/src/parsers/hierarchyDetector.js` - Hierarchy detection
- `/database/migrations/001_generalized_schema.sql` - Target schema

**Next Actions**:
1. Review this architecture with development team
2. Approve library additions (`googleapis`)
3. Begin Phase 1: Library setup
4. Create test fixtures for validation
5. Schedule implementation sprint
