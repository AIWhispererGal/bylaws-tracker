# Text Parser Integration Checklist

This checklist guides you through integrating .txt and .md file support into the Bylaws Tool.

---

## Phase 1: Core Parser Implementation ⏱️ 2-3 hours

### 1.1 Create TextParser File

- [ ] Copy `/docs/design/TEXT_PARSER_PSEUDOCODE.js` to `/src/parsers/textParser.js`
- [ ] Add file header comment with description
- [ ] Verify all dependencies are available (`fs.promises`, `path`, `hierarchyDetector`, `@supabase/supabase-js`)

### 1.2 Implement Main Entry Point

- [ ] **Method: `parseDocument(filePath, organizationConfig, documentId)`**
  - [ ] Add hierarchy override check (copy from wordParser lines 22-48)
  - [ ] Detect file type from extension (`.md`, `.markdown` → Markdown, else Text)
  - [ ] Read file as UTF-8 text with error handling
  - [ ] Normalize line endings (`\r\n` → `\n`, `\r` → `\n`)
  - [ ] Call `preprocessMarkdown()` if Markdown file
  - [ ] Call `parseSections()` with processed text
  - [ ] Return standardized result object with metadata
  - [ ] Add try/catch with proper error handling

**Test:** Parse a simple .txt file and verify it returns `{ success: true, sections: [...] }`

### 1.3 Implement Markdown Preprocessing (Optional)

- [ ] **Method: `preprocessMarkdown(text, organizationConfig)`**
  - [ ] Split text into lines
  - [ ] For each line, detect Markdown headers (`/^(#{1,6})\s+(.+)$/`)
  - [ ] Check if header content has organization prefix
  - [ ] Remove `#` symbols if prefix found
  - [ ] Join lines back together
  - [ ] Return processed text

**Test:** Parse a Markdown file with `# Article I` and verify it's detected as an article

### 1.4 Implement Main Parsing Logic

- [ ] **Method: `parseSections(text, organizationConfig)`**
  - [ ] Split text into lines array
  - [ ] Initialize state variables (sections, currentSection, currentText)
  - [ ] Call `detectTableOfContents(lines)`
  - [ ] Call `hierarchyDetector.detectHierarchy(text, organizationConfig)`
  - [ ] Filter out TOC items from detected items
  - [ ] Build headerLines Set and itemsByLine Map
  - [ ] State machine: loop through lines
    - [ ] Skip TOC lines
    - [ ] If header line: save previous section, start new section
    - [ ] If content line: append to currentText
  - [ ] Save final section
  - [ ] Call `captureOrphanedContent(lines, sections, detectedItems)`
  - [ ] Call `enrichSections(sectionsWithOrphans, organizationConfig)`
  - [ ] Call `deduplicateSections(enrichedSections)`
  - [ ] Return final sections array

**Test:** Parse a multi-section document and verify all sections are captured

### 1.5 Copy Shared Methods from WordParser

Copy the following methods **exactly** from `wordParser.js` (no modifications needed):

- [ ] **`extractTitleAndContent(line, detectedItem)`** (lines 302-355)
  - Handles title extraction from header lines
  - Test: `extractTitleAndContent("Section 1: Purpose", {...})` → `{ title: "Purpose", contentOnSameLine: null }`

- [ ] **`buildCitation(item, previousSections)`** (lines 360-377)
  - Builds hierarchical citations
  - Test: Build citation for section under Article I → `"Article I, Section 1"`

- [ ] **`enrichSections(sections, organizationConfig)`** (lines 624-676)
  - Adds metadata to sections
  - Test: Verify depth, ordinal, citations are added

- [ ] **`enrichSectionsWithContext(sections, levels)`** (lines 683-831)
  - Context-aware depth calculation
  - Test: Verify depth progression (0, 1, 2, etc.)

- [ ] **`deduplicateSections(sections)`** (lines 384-440)
  - Removes duplicate citations
  - Test: Feed duplicate sections, verify one copy remains

- [ ] **`cleanText(text)`** (lines 612-619)
  - Removes excessive whitespace
  - Test: `cleanText("  text  \n\n  more  ")` → `"text\nmore"`

- [ ] **`normalizeForMatching(text)`** (lines 94-100)
  - Normalizes text for pattern matching
  - Test: `normalizeForMatching("ARTICLE\tI  NAME")` → `"ARTICLE I NAME"`

- [ ] **`charIndexToLineNumber(text, charIndex)`** (lines 149-162)
  - Converts character index to line number
  - Test: For text "line1\nline2", charIndex 6 → lineNumber 1

- [ ] **`captureOrphanedContent(lines, sections, detectedItems)`** (lines 446-531)
  - Finds orphaned text
  - Test: Content before first section → creates preamble

- [ ] **`attachOrphansToSections(orphans, sections)`** (lines 536-607)
  - Attaches orphans to sections
  - Test: Orphan content → attached to nearest section

- [ ] **`validateSections(sections, organizationConfig)`** (lines 865-922)
  - Validates section structure
  - Test: Empty sections → warning in result

- [ ] **`generatePreview(sections, maxSections)`** (lines 848-860)
  - Creates preview summary
  - Test: 10 sections, maxSections=5 → preview has 5

- [ ] **`getDepthDistribution(sections)`** (lines 836-843)
  - Returns depth statistics
  - Test: Sections at depths 0,1,1,2 → `{0:1, 1:2, 2:1}`

### 1.6 Implement Simplified TOC Detection

- [ ] **Method: `detectTableOfContents(lines)`**
  - [ ] **MVP Approach:** Return empty `Set()` (text files rarely have formal TOC)
  - [ ] **OR Advanced:** Copy from wordParser and modify for text files

**Test:** Call with text file lines, verify it doesn't crash

### 1.7 Add Module Export

- [ ] Add `module.exports = new TextParser();` at end of file
- [ ] Verify all methods are part of the class

**Test:** `const textParser = require('./textParser'); console.log(typeof textParser.parseDocument);` → `"function"`

---

## Phase 2: Router Integration ⏱️ 1 hour

### 2.1 Update MIME Type Validation

**File:** `/src/routes/admin.js` (around line 650)

- [ ] Find `const allowedMimes = [...]` array
- [ ] Add `'text/plain'` to array (for .txt files)
- [ ] Add `'text/markdown'` to array (for .md files)
- [ ] Update error message: `'Only .doc, .docx, .txt, and .md files are allowed'`

**Before:**
```javascript
const allowedMimes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];
```

**After:**
```javascript
const allowedMimes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                      // .doc
  'text/plain',                                                              // .txt
  'text/markdown'                                                            // .md
];
```

**Test:** Upload .txt file → should be accepted, not rejected

### 2.2 Create File Type Detection Helper

**File:** `/src/routes/admin.js` (add near top of file, after requires)

- [ ] Add `const path = require('path');` if not already present
- [ ] Create `detectFileType(filePath)` function

**Implementation:**
```javascript
/**
 * Detect file type from extension
 * @param {string} filePath - Path to file
 * @returns {string|null} 'word', 'text', 'markdown', or null
 */
function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const typeMap = {
    '.docx': 'word',
    '.doc': 'word',
    '.txt': 'text',
    '.md': 'markdown',
    '.markdown': 'markdown'
  };

  return typeMap[ext] || null;
}
```

**Test:**
- `detectFileType('/path/file.txt')` → `'text'`
- `detectFileType('/path/file.md')` → `'markdown'`
- `detectFileType('/path/file.docx')` → `'word'`

### 2.3 Update Upload Handler

**File:** `/src/routes/admin.js` (find `POST /documents/upload` route)

- [ ] Require textParser: `const textParser = require('../parsers/textParser');`
- [ ] Detect file type: `const fileType = detectFileType(req.file.path);`
- [ ] Add switch/case to choose parser
- [ ] Handle unsupported file types

**Find this code (around line 700):**
```javascript
const wordParser = require('../parsers/wordParser');

// Parse the document
const parseResult = await wordParser.parseDocument(
  filePath,
  organizationConfig,
  documentId
);
```

**Replace with:**
```javascript
const wordParser = require('../parsers/wordParser');
const textParser = require('../parsers/textParser');

// Detect file type
const fileType = detectFileType(filePath);

// Choose parser based on file type
let parseResult;

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
```

**Test:**
- Upload .docx → uses wordParser
- Upload .txt → uses textParser
- Upload .md → uses textParser
- Upload .pdf → returns 400 error

### 2.4 Verify Database Insertion

- [ ] Confirm parseResult structure is identical for all parsers
- [ ] No changes needed to database insertion logic
- [ ] Sections should insert normally regardless of source

**Test:** Upload .txt file, check database for sections with correct data

---

## Phase 3: Testing ⏱️ 1-2 hours

### 3.1 Create Test Fixtures

**Directory:** `/tests/fixtures/`

- [ ] Create `simple-bylaws.txt`:
```text
ARTICLE I NAME

This organization shall be called the Test Organization.

Section 1: Purpose

The purpose of this organization is testing.

Section 2: Membership

Membership is open to all.
```

- [ ] Create `complex-bylaws.txt`:
```text
ARTICLE I GOVERNANCE

Section 1: Board Structure

Subsection A: Composition

The board shall consist of elected members.

Subsection B: Terms

(a) Officers serve 2 years
(b) Directors serve 3 years

Section 2: Meetings

The board shall meet quarterly.
```

- [ ] Create `bylaws.md`:
```markdown
# ARTICLE I - NAME

This organization shall be called the Test Organization.

## Section 1: Purpose

The purpose of this organization is testing.

### Subsection A: Details

Additional information about purpose.
```

### 3.2 Unit Tests

**File:** `/tests/unit/textParser.test.js`

- [ ] Create test file
- [ ] Test `parseDocument()` with .txt file
- [ ] Test `parseDocument()` with .md file
- [ ] Test `parseSections()` directly
- [ ] Test `preprocessMarkdown()` with Markdown headers
- [ ] Test error handling (file not found, empty file, etc.)
- [ ] Test hierarchy detection
- [ ] Test depth calculation
- [ ] Test citation building

**Example Test:**
```javascript
const textParser = require('../../src/parsers/textParser');
const orgConfig = require('../../src/config/organizationConfig');

describe('TextParser', () => {
  test('should parse simple text file', async () => {
    const config = orgConfig.getDefaultConfig();
    const result = await textParser.parseDocument(
      'tests/fixtures/simple-bylaws.txt',
      config
    );

    expect(result.success).toBe(true);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].type).toBe('article');
    expect(result.sections[0].citation).toBe('Article I');
    expect(result.sections[1].type).toBe('section');
    expect(result.sections[1].citation).toContain('Section 1');
  });

  test('should calculate correct depth', async () => {
    const config = orgConfig.getDefaultConfig();
    const result = await textParser.parseDocument(
      'tests/fixtures/complex-bylaws.txt',
      config
    );

    const article = result.sections.find(s => s.type === 'article');
    const section = result.sections.find(s => s.type === 'section');
    const subsection = result.sections.find(s => s.type === 'subsection');

    expect(article.depth).toBe(0);
    expect(section.depth).toBe(1);
    expect(subsection.depth).toBe(2);
  });
});
```

### 3.3 Integration Tests

**File:** `/tests/integration/document-upload.test.js`

- [ ] Test .txt file upload via API
- [ ] Test .md file upload via API
- [ ] Test file type rejection (e.g., .pdf)
- [ ] Verify sections are saved to database
- [ ] Verify metadata is correct

**Example Test:**
```javascript
describe('Document Upload with Multiple Formats', () => {
  test('should accept .txt file', async () => {
    const response = await request(app)
      .post('/admin/documents/upload')
      .attach('document', 'tests/fixtures/simple-bylaws.txt')
      .field('title', 'Test Bylaws');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.document).toHaveProperty('id');
  });

  test('should reject unsupported format', async () => {
    const response = await request(app)
      .post('/admin/documents/upload')
      .attach('document', 'tests/fixtures/test.pdf')
      .field('title', 'Test PDF');

    expect(response.status).toBe(400);
  });
});
```

### 3.4 Manual Testing

- [ ] Start local server: `npm start`
- [ ] Navigate to Admin → Documents
- [ ] Upload simple-bylaws.txt
- [ ] Verify sections appear in document viewer
- [ ] Verify depth/hierarchy is correct
- [ ] Upload complex-bylaws.txt
- [ ] Verify nested sections work
- [ ] Upload bylaws.md
- [ ] Verify Markdown is parsed correctly
- [ ] Check database for correct data:
  ```sql
  SELECT type, number, title, citation, depth
  FROM document_sections
  WHERE document_id = 'uploaded-doc-id'
  ORDER BY ordinal;
  ```

### 3.5 Performance Testing

- [ ] Benchmark textParser vs wordParser
- [ ] Create large .txt file (500+ sections)
- [ ] Measure parse time
- [ ] Verify memory usage
- [ ] Expected: 5-10x faster than Word parsing

**Example Benchmark:**
```javascript
const wordParser = require('../parsers/wordParser');
const textParser = require('../parsers/textParser');

async function benchmark() {
  console.time('Word Parser');
  await wordParser.parseDocument('large-bylaws.docx', config);
  console.timeEnd('Word Parser');

  console.time('Text Parser');
  await textParser.parseDocument('large-bylaws.txt', config);
  console.timeEnd('Text Parser');
}

benchmark();
// Expected output:
// Word Parser: 850ms
// Text Parser: 120ms
```

---

## Phase 4: Documentation ⏱️ 30 minutes

### 4.1 Code Documentation

- [ ] Add JSDoc comments to all public methods in textParser.js
- [ ] Document parameters and return types
- [ ] Add usage examples

**Example:**
```javascript
/**
 * Parse a text or markdown document
 *
 * @param {string} filePath - Absolute path to the .txt or .md file
 * @param {Object} organizationConfig - Organization configuration object
 * @param {string} [documentId=null] - Optional document ID for hierarchy override
 * @returns {Promise<Object>} Parse result with sections and metadata
 *
 * @example
 * const result = await textParser.parseDocument(
 *   '/uploads/bylaws.txt',
 *   organizationConfig,
 *   'doc-123'
 * );
 * console.log(`Parsed ${result.sections.length} sections`);
 */
```

### 4.2 User Documentation

**File:** `/docs/USER_GUIDE.md` (create or update)

- [ ] Add section on supported file formats
- [ ] Explain .txt file format requirements
- [ ] Explain .md file format requirements
- [ ] Provide example templates
- [ ] Document best practices

**Example Content:**
```markdown
## Supported File Formats

The Bylaws Tool supports the following document formats:

### Word Documents (.docx, .doc)
- Microsoft Word 2007+ format
- Full styling and formatting support
- Automatic Table of Contents detection

### Plain Text (.txt)
- UTF-8 encoded text files
- Simple, universal format
- Easy to create and edit in any text editor

### Markdown (.md)
- Standard Markdown format
- Use `#` for headers (optional)
- Supports same hierarchy as Word documents

## Creating a Text Bylaws Document

1. Use any text editor (Notepad, VS Code, etc.)
2. Start each article with "ARTICLE [number]"
3. Start each section with "Section [number]:"
4. Example:

```
ARTICLE I NAME

This is the preamble to Article I.

Section 1: Purpose

The purpose is...

Section 2: Membership

Membership rules...
```

## Creating a Markdown Bylaws Document

1. Use Markdown headers for organization
2. Example:

```markdown
# ARTICLE I - NAME

This is the preamble.

## Section 1: Purpose

The purpose is...

### Subsection A: Details

Additional details...
```
```

### 4.3 README Updates

**File:** `/README.md`

- [ ] Update "Features" section to mention .txt and .md support
- [ ] Update "Quick Start" with text file example
- [ ] Add to changelog

**Example Addition:**
```markdown
## Features

- 📄 **Multi-Format Support**: Upload Word (.docx, .doc), Plain Text (.txt), or Markdown (.md) documents
- ...
```

---

## Phase 5: Deployment ⏱️ 15 minutes

### 5.1 Pre-Deployment Checks

- [ ] All tests passing: `npm test`
- [ ] Linter passing: `npm run lint`
- [ ] No console errors in browser
- [ ] Database migrations applied (if any)
- [ ] Environment variables set correctly

### 5.2 Deploy to Production

- [ ] Commit all changes with descriptive message
- [ ] Push to repository
- [ ] Deploy to production environment
- [ ] Verify production deployment works

**Example Commit:**
```bash
git add src/parsers/textParser.js
git add src/routes/admin.js
git add tests/
git add docs/

git commit -m "feat: Add .txt and .md file parsing support

- Implement TextParser class for plain text and Markdown files
- Reuse hierarchyDetector for consistent pattern matching
- Update file upload validation to accept text/plain and text/markdown
- Add router logic to choose parser based on file type
- Create comprehensive tests for text parsing
- Document text parser architecture and usage

Performance: Text parsing is 5-10x faster than Word parsing
Compatibility: Uses same database schema, no migrations needed"

git push origin main
```

### 5.3 Post-Deployment Verification

- [ ] Upload test .txt file in production
- [ ] Upload test .md file in production
- [ ] Verify sections parse correctly
- [ ] Check database for correct data
- [ ] Monitor logs for errors
- [ ] Test on mobile devices

---

## Rollback Plan (If Issues Arise)

### If Critical Bug Found:

1. **Immediate Rollback:**
   - [ ] Revert MIME type changes in admin.js
   - [ ] Remove textParser require from admin.js
   - [ ] Redeploy previous version

2. **File to Revert:**
   ```javascript
   // In admin.js, change back to:
   const allowedMimes = [
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/msword'
   ];

   // And remove:
   const textParser = require('../parsers/textParser');
   ```

3. **No Database Changes Needed:**
   - Text parser uses same schema
   - Existing data is unaffected
   - No migrations to roll back

---

## Success Criteria

### Definition of Done:

- [x] TextParser class implemented
- [x] All unit tests passing
- [x] All integration tests passing
- [x] .txt files upload and parse correctly
- [x] .md files upload and parse correctly
- [x] Sections save to database with correct structure
- [x] Depth calculation works correctly
- [x] Documentation complete
- [x] Code reviewed and approved
- [x] Deployed to production
- [x] Production verification complete

### Performance Targets:

- [x] Text parsing < 200ms for typical document (50 sections)
- [x] Memory usage < 5MB for text parsing
- [x] Parse accuracy ≥ 95% (matches Word parser)
- [x] Zero regressions to existing Word parsing

---

## Troubleshooting

### Common Issues:

**Issue 1: File encoding errors**
```
Error: Invalid UTF-8 sequence
```
**Solution:** Add encoding detection:
```javascript
try {
  text = await fs.readFile(filePath, 'utf-8');
} catch (error) {
  if (error.code === 'ERR_INVALID_UTF8') {
    text = await fs.readFile(filePath, 'latin1');
  }
}
```

**Issue 2: Sections not detected**
```
Parsed 0 sections from document
```
**Solution:** Check hierarchy config, verify patterns match document format

**Issue 3: Duplicate sections**
```
Warning: 10 duplicate sections found
```
**Solution:** Improve TOC detection or rely on deduplication

**Issue 4: Wrong depth calculation**
```
All sections have depth 0
```
**Solution:** Verify hierarchy levels in organizationConfig, check contextual depth logic

---

## Next Steps After Completion

### Future Enhancements:

1. **PDF Support**
   - Use `pdf-parse` library
   - Extract text and pass to textParser
   - Handle multi-column layouts

2. **Auto-Detection**
   - Guess hierarchy from document structure
   - Suggest organizationConfig to user
   - Allow user approval/editing

3. **Batch Upload**
   - Upload multiple files at once
   - Combine into single document
   - Or create multiple documents

4. **Template Library**
   - Provide sample .txt templates
   - Provide sample .md templates
   - User can download and customize

---

**Checklist Version:** 1.0
**Last Updated:** 2025-10-21
**Estimated Total Time:** 4-6 hours
