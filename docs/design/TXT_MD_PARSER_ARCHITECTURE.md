# Text and Markdown Parser Architecture

**Version:** 1.0
**Date:** 2025-10-22
**Status:** Design Phase
**Author:** CODER Agent

---

## Executive Summary

This document defines the architecture for two new parsers (`textParser.js` and `markdownParser.js`) that extend the existing parsing framework to support `.txt` and `.md` file formats. These parsers follow the established patterns in `wordParser.js` while addressing format-specific challenges.

**Key Design Principles:**
1. **Pattern Consistency**: Follow `wordParser.js` architecture exactly
2. **10-Level Hierarchy**: Support depth 0-9 for all formats
3. **Line-Start Detection**: Handle numbering patterns at line beginnings
4. **Integration**: Seamless connection with `hierarchyDetector.js`
5. **Content Preservation**: 100% content capture with orphan detection

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Text Parser Design (textParser.js)](#text-parser-design)
3. [Markdown Parser Design (markdownParser.js)](#markdown-parser-design)
4. [Pattern Detection Strategies](#pattern-detection-strategies)
5. [Integration Points](#integration-points)
6. [Pseudocode Implementation](#pseudocode-implementation)
7. [Testing Strategy](#testing-strategy)
8. [Migration Path](#migration-path)

---

## High-Level Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Parser Layer                              │
├─────────────────────────────────────────────────────────────┤
│  wordParser.js  │  textParser.js  │  markdownParser.js      │
│  (.docx)        │  (.txt)         │  (.md)                   │
└─────────┬───────┴────────┬────────┴──────────┬──────────────┘
          │                │                   │
          └────────────────┼───────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  hierarchyDetector.js  │
              │  (Pattern Recognition) │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Section Objects      │
              │   (Unified Schema)     │
              └────────────────────────┘
```

### Common Section Schema

All parsers produce the same output schema:

```javascript
{
  type: string,           // 'article', 'section', 'subsection', etc.
  level: string,          // Original level name
  number: string,         // Section number (1, 2, A, i, etc.)
  prefix: string,         // "Article ", "Section ", etc.
  title: string,          // Section title
  citation: string,       // "Article I, Section 2"
  text: string,           // Content body
  depth: number,          // 0-9 hierarchical depth
  ordinal: number,        // Sequential position
  lineNumber: number,     // Source line reference
  parentPath: string,     // "Article I > Section 2"
  original_text: string   // Copy of text for comparison
}
```

---

## Text Parser Design (textParser.js)

### Overview

Plain text files have **no formatting metadata** (no bold, no font sizes), so all hierarchy detection must rely on:
1. **Line-start numbering patterns** (1., a., i., A., I.)
2. **Indentation** (spaces/tabs)
3. **Prefix keywords** ("Article", "Section", etc.)

### Architecture

```javascript
class TextParser {
  // MAIN ENTRY POINT
  async parseDocument(filePath, organizationConfig, documentId = null) {
    // 1. Check for document-specific hierarchy override (Supabase)
    // 2. Read file as UTF-8 text
    // 3. Parse sections from text
    // 4. Return standardized result
  }

  // CORE PARSING PIPELINE
  async parseSections(text, organizationConfig) {
    // 1. Split into lines
    // 2. Detect hierarchy patterns (via hierarchyDetector)
    // 3. Filter out false positives (TOC, page numbers)
    // 4. Build sections with content
    // 5. Capture orphaned content
    // 6. Enrich with hierarchy metadata
    // 7. Deduplicate
  }

  // PATTERN DETECTION
  detectLineStartPatterns(lines, organizationConfig) {
    // Detect: "1. Text", "a. Text", "i. Text", "A. Text", "I. Text"
    // Use hierarchyDetector for pattern matching
    // Handle indentation-based depth hints
  }

  // TEXT PROCESSING
  normalizeForMatching(text) {
    // Remove extra whitespace
    // Handle tabs and special characters
    // Case normalization
  }

  // CONTENT CAPTURE
  captureOrphanedContent(lines, sections, detectedItems) {
    // Identify content not assigned to any section
    // Attach to nearest section or create preamble/unnumbered sections
  }

  // HIERARCHY ENRICHMENT
  enrichSections(sections, organizationConfig) {
    // Add depth, ordinal, parentPath
    // Calculate contextual depth using stack-based algorithm
  }

  // UTILITY METHODS
  cleanText(text)
  buildCitation(item, previousSections)
  deduplicateSections(sections)
  extractTitleAndContent(line, detectedItem)
}
```

### Key Challenges for Plain Text

**Challenge 1: No Visual Hierarchy**
- **Solution**: Rely on indentation + numbering patterns
- **Example**:
  ```
  Article I. NAME
    Section 1. Title
      a. Subsection
  ```

**Challenge 2: Ambiguous Line-Start Numbers**
- **Problem**: `1. Text` could be a section or a reference
- **Solution**: Context-aware detection with minimum length, surrounding patterns, and indentation validation

**Challenge 3: Inconsistent Indentation**
- **Problem**: Mixed tabs and spaces
- **Solution**: Normalize all whitespace to standard units (4 spaces = 1 tab)

---

## Markdown Parser Design (markdownParser.js)

### Overview

Markdown files have **structural syntax** that provides explicit hierarchy:
1. **Header levels** (`#`, `##`, `###`, etc.) - up to 6 levels
2. **Numbered lists** (`1.`, `2.`, etc.)
3. **Lettered lists** (`a.`, `b.`, etc.)
4. **Nested indentation** (list item depth)

### Architecture

```javascript
class MarkdownParser {
  // MAIN ENTRY POINT
  async parseDocument(filePath, organizationConfig, documentId = null) {
    // 1. Check for document-specific hierarchy override
    // 2. Read file and parse with markdown library (marked/remark)
    // 3. Extract AST (Abstract Syntax Tree)
    // 4. Convert AST to section hierarchy
    // 5. Return standardized result
  }

  // AST PROCESSING
  parseMarkdownAST(markdown) {
    // Use markdown parser to get structured AST
    // Extract headers, lists, paragraphs
  }

  convertASTToSections(ast, organizationConfig) {
    // Walk AST nodes
    // Map headers to section types based on depth
    // Extract numbered/lettered lists as subsections
    // Build flat section array with depth metadata
  }

  // HEADER-BASED HIERARCHY
  parseHeaderHierarchy(nodes, organizationConfig) {
    // # = depth 0 (Article)
    // ## = depth 1 (Section)
    // ### = depth 2 (Subsection)
    // #### = depth 3+ (deeper levels)
  }

  // LIST-BASED HIERARCHY
  parseListHierarchy(nodes, organizationConfig, parentDepth) {
    // 1., 2., 3. = numeric lists
    // a., b., c. = alpha lists
    // Nested lists increase depth
  }

  // HYBRID DETECTION
  detectHybridPatterns(text, organizationConfig) {
    // Some MD files use headers for top levels
    // but numbered lists for subsections
    // Example:
    //   # Article I
    //   ## Section 1
    //   1. First point
    //   2. Second point
  }

  // CONTENT PROCESSING
  extractMarkdownContent(node) {
    // Convert markdown nodes back to plain text
    // Preserve formatting where needed
  }

  // UTILITY METHODS
  normalizeHeaderLevel(level)
  buildCitation(item, previousSections)
  enrichSections(sections, organizationConfig)
  captureOrphanedContent(lines, sections, detectedItems)
}
```

### Key Challenges for Markdown

**Challenge 1: Headers vs. Numbered Lists**
- **Problem**: Headers provide structure, but subsections use numbered lists
- **Solution**: Hybrid detection - use headers for depth 0-2, lists for depth 3+

**Challenge 2: Markdown List Indentation**
- **Problem**: Nested lists use 2-4 spaces per level
- **Solution**: Parse AST depth, map to 10-level hierarchy

**Challenge 3: Mixed Content**
- **Problem**: Headers might have bold text, links, code blocks
- **Solution**: Strip markdown syntax for titles, preserve in content

---

## Pattern Detection Strategies

### 1. Line-Start Numbering Patterns

Both parsers need to detect these patterns at line beginnings:

| Pattern | Regex | Example | Depth Hint |
|---------|-------|---------|------------|
| Roman Upper | `^\s*([IVXLCDM]+)\.\s+` | `I. NAME` | 0 |
| Arabic | `^\s*(\d+)\.\s+` | `1. Title` | 1-3 |
| Alpha Upper | `^\s*([A-Z])\.\s+` | `A. Title` | 2-3 |
| Alpha Lower | `^\s*([a-z])\.\s+` | `a. Text` | 4-5 |
| Roman Lower | `^\s*([ivxlcdm]+)\.\s+` | `i. Point` | 5-6 |
| Nested Decimal | `^\s*(\d+\.\d+)\.\s+` | `1.1. Sub` | Dynamic |
| Parenthesized | `^\s*\((\d+)\)\s+` | `(1) Item` | 3-4 |

### 2. Context-Aware Detection

To avoid false positives (page numbers, references, TOC entries), apply these validation rules:

```javascript
function isValidSection(line, lineIndex, allLines) {
  // Rule 1: Minimum content length
  if (line.length < 10) return false;

  // Rule 2: Not a TOC entry (no trailing page numbers)
  if (/\t\d+\s*$/.test(line)) return false;

  // Rule 3: Not a reference in parentheses mid-sentence
  if (/\([0-9]+\)/.test(line) && line.length > 100) return false;

  // Rule 4: Consistent with surrounding patterns
  const prevLine = allLines[lineIndex - 1];
  const nextLine = allLines[lineIndex + 1];
  // Check if neighboring lines have similar patterns

  // Rule 5: Not a page number footer
  if (lineIndex > allLines.length - 5 && /^Page \d+/.test(line)) return false;

  return true;
}
```

### 3. Indentation-Based Depth

```javascript
function calculateIndentationDepth(line) {
  const leadingWhitespace = line.match(/^(\s*)/)[1];
  const spaces = leadingWhitespace.replace(/\t/g, '    ').length;
  const indentLevel = Math.floor(spaces / 4); // 4 spaces = 1 level
  return Math.min(indentLevel, 9); // Cap at depth 9
}
```

### 4. Prefix-Based Detection

```javascript
function detectPrefixPattern(line, organizationConfig) {
  const levels = organizationConfig.hierarchy?.levels || [];

  for (const level of levels) {
    const prefix = level.prefix || '';
    const numbering = level.numbering || 'numeric';

    // Build pattern: "Article " + roman numeral
    const pattern = buildDetectionPattern(prefix, numbering);
    const match = line.match(pattern);

    if (match) {
      return {
        type: level.type,
        prefix: prefix,
        number: match[1],
        fullMatch: match[0],
        depth: level.depth
      };
    }
  }

  return null;
}
```

---

## Integration Points

### 1. hierarchyDetector.js Interface

Both new parsers call these existing functions:

```javascript
// Detect all hierarchy patterns in document
const detectedItems = hierarchyDetector.detectHierarchy(
  text,
  organizationConfig
);

// Parse number from pattern
const numericValue = hierarchyDetector.parseNumber(
  numberString,
  numberingScheme
);

// Validate hierarchy consistency
const validation = hierarchyDetector.validateHierarchy(
  sections,
  organizationConfig
);
```

### 2. Parser Factory Pattern

Create a unified entry point for all parsers:

```javascript
// parserFactory.js
class ParserFactory {
  static getParser(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.docx':
        return require('./wordParser');
      case '.txt':
        return require('./textParser');
      case '.md':
      case '.markdown':
        return require('./markdownParser');
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  static async parseDocument(filePath, organizationConfig, documentId) {
    const parser = this.getParser(filePath);
    return parser.parseDocument(filePath, organizationConfig, documentId);
  }
}
```

### 3. Database Schema Compatibility

All parsers produce sections that match the existing database schema:

```sql
-- sections table (existing)
CREATE TABLE sections (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  number TEXT,
  prefix TEXT,
  title TEXT NOT NULL,
  citation TEXT NOT NULL,
  text TEXT,
  depth INTEGER NOT NULL CHECK (depth >= 0 AND depth <= 9),
  ordinal INTEGER NOT NULL,
  article_number INTEGER,
  section_number INTEGER,
  section_citation TEXT,
  section_title TEXT,
  original_text TEXT,
  parent_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Supabase Integration

Both parsers support document-specific hierarchy overrides:

```javascript
// Check for document-specific config
const { data: doc } = await supabase
  .from('documents')
  .select('hierarchy_override')
  .eq('id', documentId)
  .single();

if (doc?.hierarchy_override) {
  // Use document-specific hierarchy instead of organization default
  organizationConfig = {
    ...organizationConfig,
    hierarchy: doc.hierarchy_override
  };
}
```

---

## Pseudocode Implementation

### Text Parser Pseudocode

```javascript
// textParser.js - Complete Implementation Flow

class TextParser {
  async parseDocument(filePath, organizationConfig, documentId) {
    try {
      // 1. HIERARCHY OVERRIDE CHECK
      if (documentId) {
        const override = await fetchHierarchyOverride(documentId);
        if (override) {
          organizationConfig = mergeOverride(organizationConfig, override);
        }
      }

      // 2. FILE READING
      const text = await fs.readFile(filePath, 'utf-8');

      // 3. PARSE SECTIONS
      const sections = await this.parseSections(text, organizationConfig);

      // 4. RETURN RESULT
      return {
        success: true,
        sections: sections,
        metadata: {
          source: 'text',
          fileName: path.basename(filePath),
          parsedAt: new Date().toISOString(),
          sectionCount: sections.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sections: []
      };
    }
  }

  async parseSections(text, organizationConfig) {
    // STEP 1: Split into lines
    const lines = text.split('\n');

    // STEP 2: Detect all hierarchy patterns using hierarchyDetector
    const allDetectedItems = hierarchyDetector.detectHierarchy(
      text,
      organizationConfig
    );

    // STEP 3: Filter out false positives
    const detectedItems = this.filterFalsePositives(
      allDetectedItems,
      lines
    );

    // STEP 4: Build header line map
    const headerLines = new Set();
    const itemsByLine = new Map();

    for (const item of detectedItems) {
      const lineIndex = this.findItemLine(item, lines);
      if (lineIndex !== -1) {
        headerLines.add(lineIndex);
        itemsByLine.set(lineIndex, item);
      }
    }

    // STEP 5: Parse sections with content
    const sections = [];
    let currentSection = null;
    let currentText = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (headerLines.has(i)) {
        // HEADER LINE - save previous section
        if (currentSection) {
          currentSection.text = this.cleanText(currentText.join('\n'));
          sections.push(currentSection);
        }

        // Start new section
        const item = itemsByLine.get(i);
        const { title, contentOnSameLine } = this.extractTitleAndContent(
          line,
          item
        );

        currentSection = {
          type: item.type,
          level: item.level,
          number: item.number,
          prefix: item.prefix,
          title: title,
          citation: this.buildCitation(item, sections),
          lineNumber: i
        };

        currentText = contentOnSameLine ? [contentOnSameLine] : [];
      } else if (currentSection && trimmed) {
        // CONTENT LINE
        currentText.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.text = this.cleanText(currentText.join('\n'));
      sections.push(currentSection);
    }

    // STEP 6: Capture orphaned content
    const sectionsWithOrphans = this.captureOrphanedContent(
      lines,
      sections,
      detectedItems
    );

    // STEP 7: Enrich with hierarchy metadata
    const enrichedSections = this.enrichSections(
      sectionsWithOrphans,
      organizationConfig
    );

    // STEP 8: Deduplicate
    const uniqueSections = this.deduplicateSections(enrichedSections);

    return uniqueSections;
  }

  filterFalsePositives(detectedItems, lines) {
    return detectedItems.filter(item => {
      const lineIndex = this.findItemLine(item, lines);
      if (lineIndex === -1) return false;

      const line = lines[lineIndex];

      // Filter 1: TOC entries (have trailing page numbers)
      if (/\t\d+\s*$/.test(line)) return false;

      // Filter 2: Too short (likely page number)
      if (line.trim().length < 10) return false;

      // Filter 3: In footer area (last 5 lines)
      if (lineIndex > lines.length - 5) return false;

      return true;
    });
  }

  findItemLine(item, lines) {
    const pattern = this.normalizeForMatching(item.fullMatch);

    for (let i = 0; i < lines.length; i++) {
      const normalized = this.normalizeForMatching(lines[i]);
      if (normalized.startsWith(pattern)) {
        return i;
      }
    }

    return -1;
  }

  normalizeForMatching(text) {
    return text
      .replace(/\t/g, ' ')      // Tabs to spaces
      .replace(/\s+/g, ' ')      // Collapse whitespace
      .trim()
      .toUpperCase();
  }

  extractTitleAndContent(line, detectedItem) {
    const trimmed = line.trim();
    let remainder = trimmed.substring(detectedItem.fullMatch.length).trim();
    remainder = remainder.replace(/^[:\-–—]\s*/, '').trim();

    // Check for title/content separator (dash)
    const match = remainder.match(/^([^–\-]+?)\s*[–\-]\s*(.+)$/);

    if (match) {
      return {
        title: match[1].trim() || '(Untitled)',
        contentOnSameLine: match[2].trim()
      };
    }

    // Short text = title, long text = content
    if (remainder.length < 50 && !/[.!?]$/.test(remainder)) {
      return {
        title: remainder || '(Untitled)',
        contentOnSameLine: null
      };
    }

    // Fallback
    return {
      title: remainder.length < 100 ? remainder : '(Content on header line)',
      contentOnSameLine: remainder.length >= 100 ? remainder : null
    };
  }

  buildCitation(item, previousSections) {
    // Find parent article for sections/subsections
    if (item.type === 'section' || item.type === 'subsection') {
      const parentArticle = previousSections
        .slice()
        .reverse()
        .find(s => s.type === 'article');

      if (parentArticle) {
        return `${parentArticle.citation}, ${item.prefix}${item.number}`;
      }
    }

    return `${item.prefix}${item.number}`;
  }

  captureOrphanedContent(lines, sections, detectedItems) {
    // Build set of captured line numbers
    const capturedLines = new Set();

    sections.forEach(section => {
      if (section.lineNumber !== undefined) {
        capturedLines.add(section.lineNumber);
      }

      // Mark content lines as captured
      if (section.text) {
        const contentLines = section.text.split('\n');
        // Match content lines back to source (approximate)
        // This is simplified - actual implementation needs careful matching
      }
    });

    // Find orphaned blocks
    const orphans = [];
    let currentOrphan = { startLine: -1, endLine: -1, lines: [] };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!capturedLines.has(i) && trimmed) {
        if (currentOrphan.startLine === -1) {
          currentOrphan.startLine = i;
        }
        currentOrphan.endLine = i;
        currentOrphan.lines.push(line);
      } else if (currentOrphan.lines.length > 0) {
        orphans.push({ ...currentOrphan });
        currentOrphan = { startLine: -1, endLine: -1, lines: [] };
      }
    }

    if (currentOrphan.lines.length > 0) {
      orphans.push(currentOrphan);
    }

    // Attach orphans to sections
    return this.attachOrphansToSections(orphans, sections);
  }

  attachOrphansToSections(orphans, sections) {
    const enhancedSections = [...sections];

    for (const orphan of orphans) {
      const content = this.cleanText(orphan.lines.join('\n'));

      // Skip trivial content
      if (content.length < 10) continue;

      // Find nearest section before orphan
      const nearestIndex = enhancedSections.findIndex(
        s => s.lineNumber > orphan.startLine
      );

      if (nearestIndex > 0) {
        // Attach to previous section
        const target = enhancedSections[nearestIndex - 1];
        target.text = target.text ? `${target.text}\n\n${content}` : content;
      } else if (nearestIndex === 0) {
        // Create preamble
        enhancedSections.unshift({
          type: 'preamble',
          level: 'Preamble',
          number: '0',
          prefix: 'Preamble ',
          title: 'Document Preamble',
          citation: 'Preamble',
          text: content,
          lineNumber: orphan.startLine,
          isOrphan: true
        });
      } else {
        // Create unnumbered section
        enhancedSections.push({
          type: 'unnumbered',
          level: 'Unnumbered',
          number: String(enhancedSections.length + 1),
          prefix: 'Unnumbered ',
          title: 'Additional Content',
          citation: `Unnumbered ${enhancedSections.length + 1}`,
          text: content,
          lineNumber: orphan.startLine,
          isOrphan: true
        });
      }
    }

    return enhancedSections;
  }

  enrichSections(sections, organizationConfig) {
    const hierarchy = organizationConfig?.hierarchy || {};
    const levels = hierarchy.levels || [];

    // First pass: basic enrichment
    const basicEnriched = sections.map((section, index) => {
      const levelDef = levels.find(l => l.type === section.type);

      return {
        ...section,
        depth: levelDef?.depth || 0,
        ordinal: index + 1,
        section_citation: section.citation,
        section_title: `${section.citation} - ${section.title}`,
        original_text: section.text || '(No content)'
      };
    });

    // Second pass: context-aware depth calculation
    return this.enrichSectionsWithContext(basicEnriched, levels);
  }

  enrichSectionsWithContext(sections, levels) {
    const hierarchyStack = [];
    const enrichedSections = [];

    const typePriority = {
      'article': 100,
      'section': 90,
      'subsection': 80,
      'paragraph': 70,
      'subparagraph': 60,
      'clause': 50,
      'subclause': 40,
      'item': 30,
      'subitem': 20,
      'point': 10
    };

    for (const section of sections) {
      const currentPriority = typePriority[section.type] || 0;

      // Pop stack until we find a parent
      while (hierarchyStack.length > 0) {
        const stackTop = hierarchyStack[hierarchyStack.length - 1];
        const stackPriority = typePriority[stackTop.type] || 0;

        if (currentPriority >= stackPriority) {
          hierarchyStack.pop();
        } else {
          break;
        }
      }

      // Calculate contextual depth
      let contextualDepth = hierarchyStack.length;
      if (section.type === 'article') {
        contextualDepth = 0;
      }

      const enrichedSection = {
        ...section,
        depth: contextualDepth,
        contextualDepth: contextualDepth,
        parentPath: hierarchyStack.map(s => s.citation).join(' > ')
      };

      enrichedSections.push(enrichedSection);
      hierarchyStack.push(enrichedSection);
    }

    return enrichedSections;
  }

  deduplicateSections(sections) {
    const seen = new Map();
    const unique = [];

    for (const section of sections) {
      const key = section.citation;

      if (!seen.has(key)) {
        seen.set(key, section);
        unique.push(section);
      } else {
        // Merge duplicate content
        const original = seen.get(key);
        const originalLength = (original.text || '').length;
        const currentLength = (section.text || '').length;

        if (currentLength > 0 && originalLength > 0) {
          if (original.text !== section.text) {
            original.text = original.text + '\n\n' + section.text;
          }
        } else if (currentLength > originalLength) {
          original.text = section.text;
        }
      }
    }

    return unique;
  }

  cleanText(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }
}

module.exports = new TextParser();
```

### Markdown Parser Pseudocode

```javascript
// markdownParser.js - Complete Implementation Flow

const marked = require('marked');  // or 'remark' for AST parsing

class MarkdownParser {
  async parseDocument(filePath, organizationConfig, documentId) {
    try {
      // 1. HIERARCHY OVERRIDE CHECK
      if (documentId) {
        const override = await fetchHierarchyOverride(documentId);
        if (override) {
          organizationConfig = mergeOverride(organizationConfig, override);
        }
      }

      // 2. FILE READING
      const markdown = await fs.readFile(filePath, 'utf-8');

      // 3. PARSE AST
      const ast = this.parseMarkdownAST(markdown);

      // 4. CONVERT TO SECTIONS
      const sections = await this.convertASTToSections(
        ast,
        organizationConfig
      );

      // 5. RETURN RESULT
      return {
        success: true,
        sections: sections,
        metadata: {
          source: 'markdown',
          fileName: path.basename(filePath),
          parsedAt: new Date().toISOString(),
          sectionCount: sections.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sections: []
      };
    }
  }

  parseMarkdownAST(markdown) {
    // Use marked with walkTokens to get structured AST
    const tokens = marked.lexer(markdown);

    // Walk tokens to extract headers and lists
    const nodes = [];

    this.walkTokens(tokens, (token) => {
      if (token.type === 'heading') {
        nodes.push({
          type: 'header',
          depth: token.depth,  // 1-6
          text: token.text,
          raw: token.raw
        });
      } else if (token.type === 'list') {
        nodes.push({
          type: 'list',
          ordered: token.ordered,
          start: token.start,
          items: token.items,
          raw: token.raw
        });
      } else if (token.type === 'paragraph') {
        nodes.push({
          type: 'paragraph',
          text: token.text,
          raw: token.raw
        });
      }
    });

    return nodes;
  }

  walkTokens(tokens, callback) {
    for (const token of tokens) {
      callback(token);

      if (token.tokens) {
        this.walkTokens(token.tokens, callback);
      }

      if (token.items) {
        for (const item of token.items) {
          if (item.tokens) {
            this.walkTokens(item.tokens, callback);
          }
        }
      }
    }
  }

  async convertASTToSections(ast, organizationConfig) {
    const sections = [];
    let currentHeader = null;
    let contentBuffer = [];

    for (const node of ast) {
      if (node.type === 'header') {
        // Save previous section
        if (currentHeader) {
          currentHeader.text = this.cleanText(contentBuffer.join('\n'));
          sections.push(currentHeader);
        }

        // Start new section from header
        const sectionData = this.headerToSection(
          node,
          organizationConfig,
          sections
        );

        currentHeader = sectionData;
        contentBuffer = [];
      } else if (node.type === 'list' && node.ordered) {
        // Parse numbered list as subsections
        const listSections = this.listToSections(
          node,
          organizationConfig,
          currentHeader,
          sections
        );

        // If we have a current header, these are its subsections
        if (currentHeader) {
          sections.push(currentHeader);
          currentHeader = null;
          contentBuffer = [];
        }

        sections.push(...listSections);
      } else if (node.type === 'paragraph') {
        // Add to current section content
        contentBuffer.push(node.text);
      }
    }

    // Save last section
    if (currentHeader) {
      currentHeader.text = this.cleanText(contentBuffer.join('\n'));
      sections.push(currentHeader);
    }

    // Enrich sections
    const enrichedSections = this.enrichSections(sections, organizationConfig);

    return enrichedSections;
  }

  headerToSection(node, organizationConfig, previousSections) {
    // Map markdown header depth to section type
    const depthMap = {
      1: { type: 'article', prefix: 'Article ' },
      2: { type: 'section', prefix: 'Section ' },
      3: { type: 'subsection', prefix: 'Subsection ' },
      4: { type: 'paragraph', prefix: 'Paragraph ' },
      5: { type: 'clause', prefix: 'Clause ' },
      6: { type: 'subclause', prefix: 'Subclause ' }
    };

    const mapping = depthMap[node.depth] || {
      type: 'subsection',
      prefix: ''
    };

    // Try to parse numbering from header text
    const numbering = this.parseHeaderNumbering(node.text);

    return {
      type: mapping.type,
      level: mapping.type,
      number: numbering.number || String(previousSections.length + 1),
      prefix: numbering.prefix || mapping.prefix,
      title: numbering.title || node.text,
      citation: this.buildCitation(
        {
          type: mapping.type,
          prefix: numbering.prefix || mapping.prefix,
          number: numbering.number || String(previousSections.length + 1)
        },
        previousSections
      ),
      depth: node.depth - 1  // Markdown depth 1-6 → our depth 0-5
    };
  }

  parseHeaderNumbering(text) {
    // Check for patterns like "I. NAME" or "Section 1: Title"
    const patterns = [
      { regex: /^([IVXLCDM]+)\.\s*(.+)$/, prefix: 'Article ', type: 'roman' },
      { regex: /^Section\s+(\d+)[:\-–]\s*(.+)$/i, prefix: 'Section ', type: 'numeric' },
      { regex: /^(\d+)\.\s*(.+)$/, prefix: '', type: 'numeric' },
      { regex: /^([A-Z])\.\s*(.+)$/, prefix: '', type: 'alpha' }
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return {
          number: match[1],
          title: match[2],
          prefix: pattern.prefix,
          type: pattern.type
        };
      }
    }

    return { number: null, title: text, prefix: '' };
  }

  listToSections(node, organizationConfig, parentHeader, previousSections) {
    const sections = [];
    const parentDepth = parentHeader ? parentHeader.depth : 0;

    node.items.forEach((item, index) => {
      const itemText = this.extractListItemText(item);
      const itemNumber = node.start ? node.start + index : index + 1;

      const section = {
        type: 'subsection',
        level: 'subsection',
        number: String(itemNumber),
        prefix: '',
        title: this.extractTitle(itemText),
        text: itemText,
        citation: this.buildCitation(
          {
            type: 'subsection',
            prefix: '',
            number: String(itemNumber)
          },
          previousSections
        ),
        depth: parentDepth + 1
      };

      sections.push(section);
    });

    return sections;
  }

  extractListItemText(item) {
    if (typeof item === 'string') return item;
    if (item.text) return item.text;
    if (item.tokens) {
      return item.tokens.map(t => t.text || '').join(' ');
    }
    return '';
  }

  extractTitle(text) {
    // First sentence or first 100 chars
    const firstSentence = text.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      return firstSentence[0];
    }
    return text.substring(0, 100);
  }

  buildCitation(item, previousSections) {
    if (item.type === 'section' || item.type === 'subsection') {
      const parentArticle = previousSections
        .slice()
        .reverse()
        .find(s => s.type === 'article');

      if (parentArticle) {
        return `${parentArticle.citation}, ${item.prefix}${item.number}`;
      }
    }

    return `${item.prefix}${item.number}`;
  }

  enrichSections(sections, organizationConfig) {
    // Same enrichment logic as textParser
    const hierarchy = organizationConfig?.hierarchy || {};
    const levels = hierarchy.levels || [];

    const basicEnriched = sections.map((section, index) => {
      const levelDef = levels.find(l => l.type === section.type);

      return {
        ...section,
        depth: section.depth !== undefined ? section.depth : (levelDef?.depth || 0),
        ordinal: index + 1,
        section_citation: section.citation,
        section_title: `${section.citation} - ${section.title}`,
        original_text: section.text || '(No content)'
      };
    });

    return this.enrichSectionsWithContext(basicEnriched, levels);
  }

  enrichSectionsWithContext(sections, levels) {
    // Same context-aware depth logic as textParser
    const hierarchyStack = [];
    const enrichedSections = [];

    const typePriority = {
      'article': 100,
      'section': 90,
      'subsection': 80,
      'paragraph': 70,
      'subparagraph': 60,
      'clause': 50,
      'subclause': 40,
      'item': 30,
      'subitem': 20,
      'point': 10
    };

    for (const section of sections) {
      const currentPriority = typePriority[section.type] || 0;

      while (hierarchyStack.length > 0) {
        const stackTop = hierarchyStack[hierarchyStack.length - 1];
        const stackPriority = typePriority[stackTop.type] || 0;

        if (currentPriority >= stackPriority) {
          hierarchyStack.pop();
        } else {
          break;
        }
      }

      let contextualDepth = hierarchyStack.length;
      if (section.type === 'article') {
        contextualDepth = 0;
      }

      const enrichedSection = {
        ...section,
        depth: contextualDepth,
        contextualDepth: contextualDepth,
        parentPath: hierarchyStack.map(s => s.citation).join(' > ')
      };

      enrichedSections.push(enrichedSection);
      hierarchyStack.push(enrichedSection);
    }

    return enrichedSections;
  }

  cleanText(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }
}

module.exports = new MarkdownParser();
```

---

## Testing Strategy

### 1. Unit Tests

```javascript
// tests/parsers/textParser.test.js
describe('TextParser', () => {
  describe('parseDocument', () => {
    it('should parse simple numbered list', async () => {
      const text = `
Article I. NAME
Section 1. Title
1. First point
2. Second point
      `;

      const result = await textParser.parseDocument(
        '/test/simple.txt',
        mockOrganizationConfig
      );

      expect(result.sections).toHaveLength(4);
      expect(result.sections[0].type).toBe('article');
      expect(result.sections[1].type).toBe('section');
      expect(result.sections[2].type).toBe('subsection');
    });

    it('should handle indentation-based hierarchy', async () => {
      const text = `
Article I. NAME
    Section 1. Title
        a. Subsection
            i. Clause
      `;

      const result = await textParser.parseDocument(
        '/test/indented.txt',
        mockOrganizationConfig
      );

      expect(result.sections[0].depth).toBe(0);
      expect(result.sections[1].depth).toBe(1);
      expect(result.sections[2].depth).toBe(2);
      expect(result.sections[3].depth).toBe(3);
    });

    it('should filter out table of contents', async () => {
      const text = `
TABLE OF CONTENTS
Article I\tNAME\t4
Section 1\tTitle\t5

Article I. NAME
Section 1. Title
      `;

      const result = await textParser.parseDocument(
        '/test/with-toc.txt',
        mockOrganizationConfig
      );

      // Should only have 2 sections (Article and Section), not TOC duplicates
      expect(result.sections).toHaveLength(2);
    });
  });

  describe('captureOrphanedContent', () => {
    it('should capture content before first section as preamble', async () => {
      const text = `
This is a preamble paragraph.

Article I. NAME
      `;

      const result = await textParser.parseDocument(
        '/test/preamble.txt',
        mockOrganizationConfig
      );

      expect(result.sections[0].type).toBe('preamble');
      expect(result.sections[0].text).toContain('preamble paragraph');
    });
  });
});

// tests/parsers/markdownParser.test.js
describe('MarkdownParser', () => {
  describe('parseDocument', () => {
    it('should parse markdown headers', async () => {
      const markdown = `
# Article I: NAME
## Section 1: Title
### Subsection A
      `;

      const result = await markdownParser.parseDocument(
        '/test/simple.md',
        mockOrganizationConfig
      );

      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].depth).toBe(0);
      expect(result.sections[1].depth).toBe(1);
      expect(result.sections[2].depth).toBe(2);
    });

    it('should parse numbered lists as subsections', async () => {
      const markdown = `
## Section 1: Duties

1. To provide leadership
2. To advise members
3. To coordinate activities
      `;

      const result = await markdownParser.parseDocument(
        '/test/list.md',
        mockOrganizationConfig
      );

      expect(result.sections[0].type).toBe('section');
      expect(result.sections[1].type).toBe('subsection');
      expect(result.sections[2].type).toBe('subsection');
      expect(result.sections[3].type).toBe('subsection');
    });
  });
});
```

### 2. Integration Tests

```javascript
// tests/integration/parsers.test.js
describe('Parser Integration', () => {
  it('should produce identical schemas across all formats', async () => {
    // Same bylaws content in different formats
    const wordResult = await wordParser.parseDocument(
      '/test/bylaws.docx',
      orgConfig
    );

    const textResult = await textParser.parseDocument(
      '/test/bylaws.txt',
      orgConfig
    );

    const mdResult = await markdownParser.parseDocument(
      '/test/bylaws.md',
      orgConfig
    );

    // All should have same section count
    expect(wordResult.sections.length).toBe(textResult.sections.length);
    expect(textResult.sections.length).toBe(mdResult.sections.length);

    // All should have same citations
    const wordCitations = wordResult.sections.map(s => s.citation);
    const textCitations = textResult.sections.map(s => s.citation);
    const mdCitations = mdResult.sections.map(s => s.citation);

    expect(wordCitations).toEqual(textCitations);
    expect(textCitations).toEqual(mdCitations);
  });
});
```

### 3. Test Files

Create test fixtures:

```
tests/fixtures/
  ├── simple.txt           # Basic numbered sections
  ├── simple.md            # Same content in markdown
  ├── complex.txt          # 10-level hierarchy
  ├── complex.md           # 10-level hierarchy markdown
  ├── with-toc.txt         # Document with table of contents
  ├── indented.txt         # Indentation-based hierarchy
  ├── mixed-patterns.txt   # Multiple numbering styles
  └── edge-cases.txt       # Orphaned content, duplicates
```

---

## Migration Path

### Phase 1: Implementation (Week 1)

1. **Day 1-2**: Implement `textParser.js`
   - Core parsing logic
   - Pattern detection
   - Unit tests

2. **Day 3-4**: Implement `markdownParser.js`
   - AST parsing with marked/remark
   - Header and list handling
   - Unit tests

3. **Day 5**: Integration
   - Create `parserFactory.js`
   - Integration tests
   - Documentation

### Phase 2: Testing & Validation (Week 2)

1. **Day 1-2**: Test with real documents
   - Test with existing bylaws in .txt format
   - Test with markdown documentation
   - Compare output with word parser

2. **Day 3-4**: Edge case handling
   - Orphaned content
   - Malformed documents
   - Very deep hierarchies (8-10 levels)

3. **Day 5**: Performance optimization
   - Benchmark parsing speed
   - Memory usage profiling

### Phase 3: Deployment (Week 3)

1. **Day 1**: API integration
   - Update document upload endpoint
   - Add format detection
   - Update Supabase functions

2. **Day 2**: Frontend updates
   - Support .txt and .md uploads
   - Update file type validation
   - Update UI messages

3. **Day 3**: Database migration
   - No schema changes needed
   - Test with production data

4. **Day 4-5**: Monitoring & rollout
   - Deploy to staging
   - Monitor parsing success rates
   - Deploy to production

---

## Appendices

### A. Dependencies

```json
{
  "dependencies": {
    "fs": "^0.0.1-security",
    "path": "^0.12.7",
    "@supabase/supabase-js": "^2.45.4",
    "marked": "^12.0.0",  // For markdown parsing
    "remark": "^15.0.1",   // Alternative: more powerful AST
    "remark-parse": "^11.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/marked": "^6.0.0"
  }
}
```

### B. Configuration Examples

```javascript
// Example organization config for 10-level hierarchy
const organizationConfig = {
  hierarchy: {
    levels: [
      { type: 'article', depth: 0, numbering: 'roman', prefix: 'Article ' },
      { type: 'section', depth: 1, numbering: 'numeric', prefix: 'Section ' },
      { type: 'subsection', depth: 2, numbering: 'alpha', prefix: '' },
      { type: 'paragraph', depth: 3, numbering: 'numeric', prefix: '' },
      { type: 'subparagraph', depth: 4, numbering: 'alphaLower', prefix: '' },
      { type: 'clause', depth: 5, numbering: 'romanLower', prefix: '' },
      { type: 'subclause', depth: 6, numbering: 'numeric', prefix: '' },
      { type: 'item', depth: 7, numbering: 'alphaLower', prefix: '' },
      { type: 'subitem', depth: 8, numbering: 'romanLower', prefix: '' },
      { type: 'point', depth: 9, numbering: 'numeric', prefix: '' }
    ]
  }
};
```

### C. Error Handling Checklist

- [ ] File not found
- [ ] Invalid UTF-8 encoding
- [ ] Empty file
- [ ] Malformed markdown
- [ ] No hierarchy patterns detected
- [ ] Database connection failure (hierarchy override)
- [ ] Memory limits (very large files)
- [ ] Circular references (malformed structure)

### D. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Parse Time | < 500ms | For 100-page document |
| Memory Usage | < 50MB | Peak during parsing |
| Accuracy | > 95% | Section detection rate |
| Coverage | 100% | Content capture |

---

## Conclusion

This architecture provides a robust, extensible framework for parsing `.txt` and `.md` files while maintaining consistency with the existing `wordParser.js` implementation. The key innovations are:

1. **Universal Pattern Detection**: Works across all formats via `hierarchyDetector.js`
2. **Context-Aware Depth**: Stack-based hierarchy tracking ensures accurate relationships
3. **100% Content Capture**: Orphan detection guarantees no data loss
4. **Format-Specific Optimization**: Leverages markdown AST and text indentation where appropriate

**Next Steps:**
1. Review and approve this architecture
2. Begin Phase 1 implementation (textParser.js)
3. Create test fixtures
4. Schedule integration testing

---

**Document Status:** ✅ DESIGN COMPLETE
**Approval Required:** Architecture Review
**Implementation Start:** Pending Approval
