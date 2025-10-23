# Text Parser Architecture Design
**Design Document for .txt and .md File Support**

## Executive Summary

This document outlines the architecture for adding plain text (.txt) and Markdown (.md) file parsing capabilities to the Bylaws Tool, complementing the existing Word (.docx) parser.

**Key Benefits:**
- ✅ Simpler document format support
- ✅ Reuse existing hierarchy detection logic
- ✅ Minimal database schema changes (zero required)
- ✅ Consistent data structure across all parsers
- ✅ Faster parsing (no complex binary format)

**Implementation Time Estimate:** 4-6 hours

---

## 1. Current Architecture Analysis

### 1.1 WordParser.js Architecture

**Current Flow:**
```
.docx file → mammoth library → raw text + HTML → hierarchyDetector
  → section parsing → enrichment → validation → database
```

**Key Components:**
- `mammoth.extractRawText()` - Extracts plain text
- `mammoth.convertToHtml()` - Extracts HTML (for styling hints)
- `hierarchyDetector.detectHierarchy()` - Pattern matching for sections
- `parseSections()` - Line-by-line parsing with TOC filtering
- `enrichSections()` - Adds depth, citations, metadata
- `deduplicateSections()` - Removes TOC duplicates

**Data Structure Output:**
```javascript
{
  success: true,
  sections: [
    {
      type: 'article',           // From hierarchy config
      level: 'Article',
      number: 'I',
      prefix: 'Article ',
      title: 'NAME',
      citation: 'Article I',
      text: 'Article content...',
      depth: 0,                  // Context-aware depth
      ordinal: 1,
      article_number: 1,
      section_number: 0,
      section_citation: 'Article I',
      section_title: 'Article I - NAME',
      original_text: 'Article content...',
      parentPath: '(root)',
      depthCalculationMethod: 'article-override'
    }
    // ... more sections
  ],
  metadata: {
    source: 'word',
    fileName: 'bylaws.docx',
    parsedAt: '2025-10-21T...',
    sectionCount: 42
  }
}
```

### 1.2 Legacy parse_bylaws.js Approach

**Simple line-by-line approach:**
```javascript
// Read file as lines
const lines = fileContent.split('\n');

// Pattern matching
function isArticleHeader(line) {
  return /^ARTICLE\s+[IVX]+(\s+|$)/.test(line.trim());
}

function isSectionHeader(line) {
  return /^Section\s+\d+:/i.test(line.trim());
}

// State machine parsing
for (const line of lines) {
  if (isArticleHeader(line)) {
    // Start new article
  } else if (isSectionHeader(line)) {
    // Start new section
  } else {
    // Accumulate content
  }
}
```

**Advantages:**
- Simple and direct
- No external dependencies
- Fast execution
- Easy to debug

### 1.3 HierarchyDetector.js

**Reusable Components:**
- `detectHierarchy(text, organizationConfig)` - Pattern detection
- `buildDetectionPatterns(level)` - Regex generation
- `parseNumber(numberStr, scheme)` - Number conversion
- `validateHierarchy(sections, organizationConfig)` - Structure validation

**Numbering Schemes Supported:**
- `roman` - I, II, III, IV, etc.
- `numeric` - 1, 2, 3, etc.
- `alpha` - A, B, C, etc.
- `alphaLower` - a, b, c, etc.

---

## 2. TextParser Architecture Design

### 2.1 Class Structure

```javascript
/**
 * Text Parser
 * Parses plain text (.txt) and Markdown (.md) files
 * Reuses hierarchyDetector for consistent pattern matching
 */

const fs = require('fs').promises;
const hierarchyDetector = require('./hierarchyDetector');
const { createClient } = require('@supabase/supabase-js');

class TextParser {
  /**
   * Parse a text or markdown document
   * @param {string} filePath - Path to the .txt or .md file
   * @param {Object} organizationConfig - Organization configuration
   * @param {string} documentId - Optional document ID for hierarchy override
   * @returns {Promise<Object>} Parse result with sections and metadata
   */
  async parseDocument(filePath, organizationConfig, documentId = null) {
    // Entry point - delegates to specific parser
  }

  /**
   * Parse plain text file
   * @param {string} filePath - Path to .txt file
   * @param {Object} organizationConfig - Organization configuration
   * @param {string} documentId - Optional document ID
   * @returns {Promise<Object>} Parse result
   */
  async parseTxtFile(filePath, organizationConfig, documentId = null) {
    // Read file as UTF-8 text
    // Call parseSections with text
    // Return standardized result
  }

  /**
   * Parse Markdown file
   * @param {string} filePath - Path to .md file
   * @param {Object} organizationConfig - Organization configuration
   * @param {string} documentId - Optional document ID
   * @returns {Promise<Object>} Parse result
   */
  async parseMarkdownFile(filePath, organizationConfig, documentId = null) {
    // Read file as UTF-8 text
    // Optionally: convert Markdown headers to hierarchy
    // Call parseSections with text
    // Return standardized result
  }

  /**
   * Parse sections from text (main logic)
   * REUSED FROM WORDPARSER with minimal modifications
   */
  async parseSections(text, organizationConfig) {
    // 1. Split into lines
    // 2. Detect TOC (optional for text files)
    // 3. Use hierarchyDetector to find patterns
    // 4. Parse sections with state machine
    // 5. Enrich sections with metadata
    // 6. Deduplicate if needed
    // 7. Return sections array
  }

  /**
   * Extract title and content from header line
   * REUSED FROM WORDPARSER
   */
  extractTitleAndContent(line, detectedItem) {
    // Identical to WordParser implementation
  }

  /**
   * Build citation for a section
   * REUSED FROM WORDPARSER
   */
  buildCitation(item, previousSections) {
    // Identical to WordParser implementation
  }

  /**
   * Enrich sections with hierarchy information
   * REUSED FROM WORDPARSER
   */
  enrichSections(sections, organizationConfig) {
    // Identical to WordParser implementation
  }

  /**
   * Context-aware depth calculation
   * REUSED FROM WORDPARSER
   */
  enrichSectionsWithContext(sections, levels) {
    // Identical to WordParser implementation
  }

  /**
   * Deduplicate sections
   * REUSED FROM WORDPARSER
   */
  deduplicateSections(sections) {
    // Identical to WordParser implementation
  }

  /**
   * Clean text content
   * REUSED FROM WORDPARSER
   */
  cleanText(text) {
    // Identical to WordParser implementation
  }

  /**
   * Normalize text for pattern matching
   * REUSED FROM WORDPARSER
   */
  normalizeForMatching(text) {
    // Identical to WordParser implementation
  }

  /**
   * Detect Table of Contents lines (optional for text)
   */
  detectTableOfContents(lines) {
    // Simplified version - text files may not have TOC
    // Return empty set for most text files
  }

  /**
   * Markdown-specific: Convert # headers to hierarchy hints
   * Optional feature for better Markdown support
   */
  detectMarkdownHeaders(text) {
    // # Header 1 → potential article
    // ## Header 2 → potential section
    // ### Header 3 → potential subsection
    // Return hints for hierarchyDetector
  }

  /**
   * Validate parsed sections
   * REUSED FROM WORDPARSER
   */
  validateSections(sections, organizationConfig) {
    // Identical to WordParser implementation
  }

  /**
   * Generate preview
   * REUSED FROM WORDPARSER
   */
  generatePreview(sections, maxSections = 5) {
    // Identical to WordParser implementation
  }
}

module.exports = new TextParser();
```

### 2.2 Markdown Enhancement (Optional Feature)

**Markdown Header Mapping:**
```javascript
// Map Markdown headers to hierarchy levels
const markdownHierarchyMap = {
  '#': 'article',       // # Article I - NAME
  '##': 'section',      // ## Section 1: Purpose
  '###': 'subsection',  // ### Subsection A
  '####': 'paragraph',  // #### (a) Details
  '#####': 'subparagraph',
  '######': 'clause'
};

// Enhanced detection for Markdown
function detectMarkdownHeaders(text) {
  const lines = text.split('\n');
  const headers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const content = match[2].trim();

      headers.push({
        lineNumber: i,
        level,
        type: markdownHierarchyMap['#'.repeat(level)],
        content,
        rawLine: line
      });
    }
  }

  return headers;
}
```

---

## 3. Integration Points

### 3.1 File Upload Validation

**Current (admin.js):**
```javascript
const allowedMimes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];
```

**Updated:**
```javascript
const allowedMimes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                      // .doc
  'text/plain',                                                              // .txt
  'text/markdown'                                                            // .md
];

// Enhanced error message
cb(new Error('Only .doc, .docx, .txt, and .md files are allowed'));
```

**File Extension Detection:**
```javascript
const path = require('path');

function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  return {
    '.docx': 'word',
    '.doc': 'word',
    '.txt': 'text',
    '.md': 'markdown',
    '.markdown': 'markdown'
  }[ext] || null;
}
```

### 3.2 Router Logic

**Current Upload Handler:**
```javascript
// POST /admin/documents/upload
router.post('/documents/upload', upload, async (req, res) => {
  const filePath = req.file.path;

  // Currently: always uses wordParser
  const wordParser = require('../parsers/wordParser');
  const parseResult = await wordParser.parseDocument(
    filePath,
    organizationConfig,
    documentId
  );

  // Import to database
});
```

**Enhanced Upload Handler:**
```javascript
const wordParser = require('../parsers/wordParser');
const textParser = require('../parsers/textParser');

router.post('/documents/upload', upload, async (req, res) => {
  const filePath = req.file.path;
  const fileType = detectFileType(filePath);

  let parseResult;

  // Choose parser based on file type
  switch (fileType) {
    case 'word':
      parseResult = await wordParser.parseDocument(
        filePath,
        organizationConfig,
        documentId
      );
      break;

    case 'text':
    case 'markdown':
      parseResult = await textParser.parseDocument(
        filePath,
        organizationConfig,
        documentId
      );
      break;

    default:
      return res.status(400).json({
        success: false,
        error: 'Unsupported file type'
      });
  }

  // Import to database (same for all parsers)
  if (parseResult.success) {
    // Insert sections into database
  }
});
```

### 3.3 Database Schema

**No Changes Required!**

The database schema already supports the output from all parsers:

```sql
-- document_sections table (existing)
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  type VARCHAR(50),              -- 'article', 'section', etc.
  number VARCHAR(20),             -- 'I', '1', 'A', etc.
  title TEXT,
  citation VARCHAR(255),          -- 'Article I, Section 1'
  text TEXT,                      -- Section content
  original_text TEXT,             -- Original content
  depth INTEGER,                  -- 0, 1, 2, etc.
  ordinal INTEGER,                -- 1, 2, 3, etc.
  parent_section_id UUID,         -- For hierarchy tree
  -- ... other fields
);
```

**All parsers output the same structure**, so no schema changes needed.

---

## 4. Code Reuse Strategy

### 4.1 Shared Methods (Extract to Utils)

**Option A: Extract common code to shared utility**

```javascript
// src/parsers/parserUtils.js

class ParserUtils {
  cleanText(text) { /* ... */ }
  normalizeForMatching(text) { /* ... */ }
  extractTitleAndContent(line, detectedItem) { /* ... */ }
  buildCitation(item, previousSections) { /* ... */ }
  deduplicateSections(sections) { /* ... */ }
  enrichSections(sections, organizationConfig) { /* ... */ }
  enrichSectionsWithContext(sections, levels) { /* ... */ }
  validateSections(sections, organizationConfig) { /* ... */ }
  generatePreview(sections, maxSections) { /* ... */ }
  getDepthDistribution(sections) { /* ... */ }
  charIndexToLineNumber(text, charIndex) { /* ... */ }
  captureOrphanedContent(lines, sections, detectedItems) { /* ... */ }
  attachOrphansToSections(orphans, sections) { /* ... */ }
}

module.exports = new ParserUtils();
```

**Then update all parsers:**
```javascript
// wordParser.js
const parserUtils = require('./parserUtils');

class WordParser {
  async parseSections(text, html, organizationConfig) {
    // ... parsing logic ...

    const enriched = parserUtils.enrichSections(sections, organizationConfig);
    const unique = parserUtils.deduplicateSections(enriched);

    return unique;
  }
}

// textParser.js
const parserUtils = require('./parserUtils');

class TextParser {
  async parseSections(text, organizationConfig) {
    // ... parsing logic ...

    const enriched = parserUtils.enrichSections(sections, organizationConfig);
    const unique = parserUtils.deduplicateSections(enriched);

    return unique;
  }
}
```

**Option B: Simple code duplication (faster implementation)**

For MVP, duplicate the methods in TextParser. Refactor to shared utilities later.

**Recommendation:** Use Option B for initial implementation, then refactor to Option A in Phase 2.

---

## 5. Implementation Pseudocode

### 5.1 Main Parser Entry Point

```javascript
async parseDocument(filePath, organizationConfig, documentId = null) {
  try {
    // Step 1: Check for document-specific hierarchy override
    if (documentId) {
      const hierarchyOverride = await this.fetchHierarchyOverride(documentId);
      if (hierarchyOverride) {
        organizationConfig = {
          ...organizationConfig,
          hierarchy: hierarchyOverride
        };
      }
    }

    // Step 2: Detect file type
    const ext = path.extname(filePath).toLowerCase();
    const isMarkdown = ['.md', '.markdown'].includes(ext);

    // Step 3: Read file
    const text = await fs.readFile(filePath, 'utf-8');

    // Step 4: Optional Markdown preprocessing
    let processedText = text;
    if (isMarkdown) {
      processedText = this.preprocessMarkdown(text, organizationConfig);
    }

    // Step 5: Parse sections
    const sections = await this.parseSections(
      processedText,
      organizationConfig
    );

    // Step 6: Return standardized result
    return {
      success: true,
      sections,
      metadata: {
        source: isMarkdown ? 'markdown' : 'text',
        fileName: path.basename(filePath),
        parsedAt: new Date().toISOString(),
        sectionCount: sections.length
      }
    };
  } catch (error) {
    console.error('Error parsing text document:', error);
    return {
      success: false,
      error: error.message,
      sections: []
    };
  }
}
```

### 5.2 Section Parsing Logic

```javascript
async parseSections(text, organizationConfig) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let currentText = [];

  // Step 1: Detect Table of Contents (optional for text files)
  const tocLines = this.detectTableOfContents(lines);

  // Step 2: Use hierarchyDetector to find all patterns
  const allDetectedItems = hierarchyDetector.detectHierarchy(
    text,
    organizationConfig
  );

  // Step 3: Filter out TOC items
  const detectedItems = allDetectedItems.filter(item => {
    const lineNum = this.charIndexToLineNumber(text, item.index);
    return !tocLines.has(lineNum);
  });

  // Step 4: Build header lines map
  const headerLines = new Set();
  const itemsByLine = new Map();

  for (const item of detectedItems) {
    const pattern = this.normalizeForMatching(item.fullMatch);

    for (let i = 0; i < lines.length; i++) {
      if (headerLines.has(i) || tocLines.has(i)) continue;

      const normalizedLine = this.normalizeForMatching(lines[i]);

      if (normalizedLine.startsWith(pattern)) {
        headerLines.add(i);
        itemsByLine.set(i, item);
        break;
      }
    }
  }

  // Step 5: Parse sections line by line
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    // Skip TOC lines
    if (tocLines.has(lineIndex)) continue;

    if (headerLines.has(lineIndex)) {
      // Save previous section
      if (currentSection) {
        currentSection.text = this.cleanText(currentText.join('\n'));
        sections.push(currentSection);
      }

      // Start new section
      const item = itemsByLine.get(lineIndex);
      const { title, contentOnSameLine } = this.extractTitleAndContent(
        line,
        item
      );

      currentSection = {
        type: item.type,
        level: item.level,
        number: item.number,
        prefix: item.prefix,
        title,
        citation: this.buildCitation(item, sections),
        lineNumber: lineIndex
      };

      currentText = contentOnSameLine ? [contentOnSameLine] : [];
    } else if (currentSection && trimmed) {
      // Accumulate content
      currentText.push(line);
    }
  }

  // Step 6: Save last section
  if (currentSection) {
    currentSection.text = this.cleanText(currentText.join('\n'));
    sections.push(currentSection);
  }

  // Step 7: Capture orphaned content
  const sectionsWithOrphans = this.captureOrphanedContent(
    lines,
    sections,
    detectedItems
  );

  // Step 8: Enrich sections
  const enrichedSections = this.enrichSections(
    sectionsWithOrphans,
    organizationConfig
  );

  // Step 9: Deduplicate
  const uniqueSections = this.deduplicateSections(enrichedSections);

  return uniqueSections;
}
```

### 5.3 Markdown Preprocessing (Optional)

```javascript
preprocessMarkdown(text, organizationConfig) {
  const lines = text.split('\n');
  const processedLines = [];

  for (const line of lines) {
    let processedLine = line;

    // Convert Markdown headers to organization prefix format
    // Example: "# Article I - NAME" → "Article I - NAME"
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      const headerLevel = headerMatch[1].length;
      const content = headerMatch[2].trim();

      // Only remove # if content already has organization prefix
      const hasPrefix = organizationConfig.hierarchy?.levels?.some(level =>
        content.startsWith(level.prefix)
      );

      if (hasPrefix) {
        processedLine = content;
      }
      // Otherwise leave as-is for manual review
    }

    processedLines.push(processedLine);
  }

  return processedLines.join('\n');
}
```

---

## 6. Implementation Checklist

### Phase 1: Core Implementation (2-3 hours)

- [ ] Create `/src/parsers/textParser.js`
- [ ] Implement `parseDocument()` entry point
- [ ] Implement `parseTxtFile()` for plain text
- [ ] Implement `parseMarkdownFile()` for Markdown
- [ ] Copy core parsing methods from WordParser:
  - [ ] `parseSections()`
  - [ ] `extractTitleAndContent()`
  - [ ] `buildCitation()`
  - [ ] `enrichSections()`
  - [ ] `enrichSectionsWithContext()`
  - [ ] `deduplicateSections()`
  - [ ] `cleanText()`
  - [ ] `normalizeForMatching()`
  - [ ] `validateSections()`
  - [ ] `generatePreview()`
- [ ] Implement simplified `detectTableOfContents()` for text

### Phase 2: Integration (1-2 hours)

- [ ] Update `/src/routes/admin.js`:
  - [ ] Add `.txt` and `.md` to allowed MIME types
  - [ ] Implement `detectFileType()` helper
  - [ ] Add router logic to choose parser
- [ ] Update error messages for file type validation
- [ ] Test file upload with all formats

### Phase 3: Markdown Enhancement (Optional, 1 hour)

- [ ] Implement `detectMarkdownHeaders()`
- [ ] Implement `preprocessMarkdown()`
- [ ] Add Markdown-specific hints to hierarchy detection
- [ ] Test with real Markdown documents

### Phase 4: Testing (1-2 hours)

- [ ] Unit tests for TextParser
- [ ] Integration tests for file upload
- [ ] Test with sample .txt files
- [ ] Test with sample .md files
- [ ] Test hierarchy detection accuracy
- [ ] Test depth calculation
- [ ] Validate database insertion

### Phase 5: Documentation (30 minutes)

- [ ] Add JSDoc comments
- [ ] Update README with supported formats
- [ ] Create example .txt and .md templates
- [ ] Document any limitations

---

## 7. Testing Strategy

### 7.1 Test Files

**Create test documents in `/tests/fixtures/`:**

1. **simple-bylaws.txt** - Basic Article/Section structure
```text
ARTICLE I NAME

This is the article content.

Section 1: Purpose

This organization shall be called...

Section 2: Membership

Membership is open to...
```

2. **complex-bylaws.txt** - Multi-level hierarchy
```text
ARTICLE I GOVERNANCE

Section 1: Board Structure

Subsection A: Composition

The board shall consist of...

Subsection B: Terms

(a) Officers serve 2 years
(b) Directors serve 3 years
```

3. **bylaws.md** - Markdown format
```markdown
# ARTICLE I - NAME

This is the article content.

## Section 1: Purpose

This organization shall be called...

### Subsection A: Details

Additional information...
```

### 7.2 Test Cases

```javascript
// tests/unit/textParser.test.js

describe('TextParser', () => {
  describe('parseTxtFile', () => {
    test('should parse simple article structure', async () => {
      const result = await textParser.parseDocument(
        'tests/fixtures/simple-bylaws.txt',
        defaultConfig
      );

      expect(result.success).toBe(true);
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].type).toBe('article');
      expect(result.sections[1].type).toBe('section');
    });

    test('should handle multi-level hierarchy', async () => {
      const result = await textParser.parseDocument(
        'tests/fixtures/complex-bylaws.txt',
        complexConfig
      );

      expect(result.success).toBe(true);
      expect(result.sections.some(s => s.type === 'subsection')).toBe(true);
      expect(result.sections.some(s => s.type === 'paragraph')).toBe(true);
    });
  });

  describe('parseMarkdownFile', () => {
    test('should parse Markdown headers', async () => {
      const result = await textParser.parseDocument(
        'tests/fixtures/bylaws.md',
        defaultConfig
      );

      expect(result.success).toBe(true);
      expect(result.metadata.source).toBe('markdown');
    });
  });

  describe('enrichSections', () => {
    test('should calculate correct depth', () => {
      const sections = [
        { type: 'article', number: 'I', title: 'NAME' },
        { type: 'section', number: '1', title: 'Purpose' },
        { type: 'subsection', number: 'A', title: 'Details' }
      ];

      const enriched = textParser.enrichSections(sections, defaultConfig);

      expect(enriched[0].depth).toBe(0);  // Article
      expect(enriched[1].depth).toBe(1);  // Section
      expect(enriched[2].depth).toBe(2);  // Subsection
    });
  });
});
```

### 7.3 Integration Tests

```javascript
// tests/integration/document-upload.test.js

describe('Document Upload with Multiple Formats', () => {
  test('should accept .txt file', async () => {
    const response = await uploadFile('test.txt', 'text/plain');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should accept .md file', async () => {
    const response = await uploadFile('test.md', 'text/markdown');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should reject unsupported format', async () => {
    const response = await uploadFile('test.pdf', 'application/pdf');
    expect(response.status).toBe(400);
  });

  test('should parse and store sections correctly', async () => {
    const response = await uploadFile('simple-bylaws.txt', 'text/plain');

    const sections = await db
      .from('document_sections')
      .select('*')
      .eq('document_id', response.body.document.id);

    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0]).toHaveProperty('type');
    expect(sections[0]).toHaveProperty('citation');
    expect(sections[0]).toHaveProperty('depth');
  });
});
```

---

## 8. Performance Considerations

### 8.1 Benchmarks

**Expected Performance:**
```
.docx (Word):     ~500-1000ms  (binary parsing + text extraction)
.txt (Text):      ~50-100ms    (direct text reading)
.md (Markdown):   ~75-150ms    (text reading + optional preprocessing)
```

**Text parsing should be 5-10x faster than Word parsing.**

### 8.2 Memory Usage

```
.docx: ~10-20MB  (mammoth library + document object model)
.txt:  ~1-2MB    (simple string buffers)
.md:   ~2-4MB    (string buffers + optional parsing)
```

**Text parsing uses 80-90% less memory.**

### 8.3 Optimization Opportunities

1. **Stream Processing** (for very large files)
```javascript
const readline = require('readline');

async parseStreamingText(filePath, organizationConfig) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    // Process line by line
  }
}
```

2. **Parallel Section Processing** (for very large documents)
```javascript
const chunks = this.chunkSections(sections, 100);
const enrichedChunks = await Promise.all(
  chunks.map(chunk => this.enrichSections(chunk, organizationConfig))
);
const enriched = enrichedChunks.flat();
```

---

## 9. Limitations and Edge Cases

### 9.1 Known Limitations

1. **No Style Information**
   - Text files have no bold/italic/underline
   - Cannot detect emphasis in original document
   - **Mitigation**: Rely on pattern matching only

2. **Ambiguous Numbering**
   - "(1)" could be paragraph or list item
   - "I." could be Roman numeral or letter I
   - **Mitigation**: Use organizationConfig to disambiguate

3. **No Page Numbers**
   - Cannot detect page breaks
   - Cannot filter page numbers from content
   - **Mitigation**: Clean content during preprocessing

4. **Markdown Variations**
   - Many Markdown flavors exist
   - Not all use # for headers
   - **Mitigation**: Support standard Markdown, document others

### 9.2 Edge Cases to Handle

```javascript
// Edge Case 1: Empty file
if (text.trim().length === 0) {
  return {
    success: false,
    error: 'File is empty',
    sections: []
  };
}

// Edge Case 2: No hierarchy patterns found
if (detectedItems.length === 0) {
  console.warn('No hierarchy patterns detected');
  // Create single unnumbered section with all content
  return {
    success: true,
    sections: [{
      type: 'unnumbered',
      title: 'Document Content',
      text: text,
      citation: 'Full Document'
    }]
  };
}

// Edge Case 3: Malformed UTF-8
try {
  const text = await fs.readFile(filePath, 'utf-8');
} catch (error) {
  if (error.code === 'ERR_INVALID_UTF8') {
    // Try alternative encoding
    const text = await fs.readFile(filePath, 'latin1');
  }
}

// Edge Case 4: Mixed line endings
const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
```

---

## 10. Migration Path

### 10.1 Backward Compatibility

**Existing Word documents are NOT affected.**

All changes are additive:
- New parsers added (textParser.js)
- Router enhanced to choose parser
- Database unchanged
- API unchanged

### 10.2 Rollback Plan

If issues arise:

1. **Revert MIME type changes** in admin.js
2. **Remove textParser require** from router
3. **Keep textParser.js** for future use

No database migrations needed, so rollback is instant.

---

## 11. Future Enhancements

### Phase 2 Features (Post-MVP)

1. **PDF Support**
   - Use `pdf-parse` library
   - Extract text and pass to textParser
   - Handle multi-column layouts

2. **Google Docs Integration**
   - Export as plain text
   - Parse with textParser
   - Enable live sync

3. **Rich Text Editor Upload**
   - Parse HTML content
   - Convert to plain text
   - Preserve some formatting hints

4. **Auto-Detection**
   - Guess hierarchy from document structure
   - Suggest organizationConfig
   - Allow user to approve/edit

5. **Collaborative Editing**
   - Real-time text parsing
   - Incremental section updates
   - Conflict resolution

---

## 12. Implementation Time Estimate

**Total: 4-6 hours**

| Phase | Task | Time |
|-------|------|------|
| 1 | Core TextParser Implementation | 2-3 hours |
| 2 | Router Integration | 1 hour |
| 3 | Testing | 1-2 hours |
| 4 | Documentation | 30 min |

**Fast-track option (3 hours):**
- Skip Markdown preprocessing
- Skip unit tests (integration tests only)
- Minimal documentation

---

## Appendix A: File Structure

```
BYLAWSTOOL_Generalized/
├── src/
│   ├── parsers/
│   │   ├── wordParser.js          (existing)
│   │   ├── textParser.js          (NEW)
│   │   ├── hierarchyDetector.js   (existing, reused)
│   │   ├── numberingSchemes.js    (existing, reused)
│   │   └── parserUtils.js         (FUTURE: shared utilities)
│   ├── routes/
│   │   └── admin.js               (MODIFY: add MIME types, router logic)
│   └── config/
│       └── organizationConfig.js  (existing, no changes)
├── tests/
│   ├── fixtures/
│   │   ├── simple-bylaws.txt      (NEW)
│   │   ├── complex-bylaws.txt     (NEW)
│   │   └── bylaws.md              (NEW)
│   ├── unit/
│   │   └── textParser.test.js     (NEW)
│   └── integration/
│       └── document-upload.test.js (MODIFY: add text formats)
└── docs/
    └── design/
        └── TEXT_PARSER_ARCHITECTURE.md (THIS DOCUMENT)
```

---

## Appendix B: Example Usage

### As a Developer

```javascript
const textParser = require('./src/parsers/textParser');
const orgConfig = require('./src/config/organizationConfig');

// Parse a plain text file
const config = await orgConfig.loadConfig('org-123');
const result = await textParser.parseDocument(
  '/uploads/bylaws.txt',
  config,
  'doc-456'
);

console.log(`Parsed ${result.sections.length} sections`);
console.log('Metadata:', result.metadata);

// Save to database
for (const section of result.sections) {
  await db.from('document_sections').insert(section);
}
```

### As an End User

1. Navigate to **Admin → Upload Document**
2. Click **Choose File**
3. Select `.txt`, `.md`, `.docx`, or `.doc` file
4. Click **Upload**
5. System automatically:
   - Detects file type
   - Chooses appropriate parser
   - Extracts sections
   - Saves to database
6. Review parsed sections in document viewer

---

## Appendix C: Comparison Table

| Feature | Word Parser | Text Parser |
|---------|-------------|-------------|
| **File Formats** | .doc, .docx | .txt, .md |
| **Dependencies** | mammoth | (none) |
| **Parse Speed** | ~500-1000ms | ~50-100ms |
| **Memory Usage** | ~10-20MB | ~1-2MB |
| **Style Detection** | ✅ Yes | ❌ No |
| **Hierarchy Detection** | ✅ Via hierarchyDetector | ✅ Via hierarchyDetector |
| **TOC Filtering** | ✅ Yes | ⚠️ Optional |
| **Depth Calculation** | ✅ Context-aware | ✅ Context-aware |
| **Database Schema** | Standard | Standard (same) |
| **Output Format** | Standardized | Standardized (same) |
| **Ease of Implementation** | Complex | Simple |
| **User Editing** | Requires Word | Any text editor |

---

## Conclusion

The TextParser architecture leverages the robust hierarchyDetector system while providing simpler, faster parsing for plain text and Markdown documents. By reusing 90% of WordParser's logic, we minimize code duplication and ensure consistency across all document formats.

**Key advantages:**
- ✅ Simple implementation (4-6 hours)
- ✅ No database changes required
- ✅ 5-10x faster parsing
- ✅ Lower memory footprint
- ✅ Easier user document creation
- ✅ Future-proof for PDF and other formats

**Next Steps:**
1. Review and approve this design
2. Create textParser.js following pseudocode
3. Integrate with router and file upload
4. Test with real documents
5. Deploy and monitor performance

---

**Document Version:** 1.0
**Author:** Coder Agent
**Date:** 2025-10-21
**Status:** Ready for Review
