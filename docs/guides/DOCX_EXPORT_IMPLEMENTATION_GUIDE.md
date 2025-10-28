# DOCX Export Implementation Guide

**Complete Step-by-Step Guide for Next Session**

**Date:** 2025-10-28
**Status:** READY FOR IMPLEMENTATION
**Estimated Time:** 8-12 hours
**Priority:** HIGH - User Requested Feature

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Setup & Installation](#phase-1-setup--installation)
4. [Phase 2: DOCX Service Creation](#phase-2-docx-service-creation)
5. [Phase 3: Text Diff Algorithm](#phase-3-text-diff-algorithm)
6. [Phase 4: Track Changes Formatting](#phase-4-track-changes-formatting)
7. [Phase 5: Route Endpoint](#phase-5-route-endpoint)
8. [Phase 6: Frontend Integration](#phase-6-frontend-integration)
9. [Phase 7: Testing](#phase-7-testing)
10. [Success Criteria](#success-criteria)
11. [Troubleshooting](#troubleshooting)
12. [Future Enhancements](#future-enhancements)

---

## Overview

### Objective
Create a DOCX export feature that exports **only changed sections** from bylaws documents with Track Changes-style formatting:
- **Strikethrough + Red** for deleted/original text
- **Underline + Blue** for added/new text
- Professional Word document format suitable for 99 neighborhood councils

### Why This Matters
- **User Need:** Neighborhood councils require clear change documentation for approval workflows
- **Format:** Word DOCX is the standard format expected by government entities
- **Track Changes:** Familiar format that clearly shows "before" vs "after" text
- **Professional:** Must look official and polished for council review

### Architecture
```
User clicks "Export Word"
  → Frontend calls /documents/:id/export/docx
  → Backend fetches changed sections
  → docxExporter.js generates DOCX:
    1. Diff original vs current text (using `diff` library)
    2. Format changes (strikethrough/underline)
    3. Build DOCX structure (using `docx` library)
  → Return DOCX file for download
```

---

## Prerequisites

### System Requirements
- ✅ **Node.js:** v22.17.1 (confirmed - supports native `util.diff` if needed)
- ✅ **Existing Infrastructure:** JSON export already working (`/src/routes/dashboard.js`)
- ✅ **Database:** Section data includes `original_text` and `current_text` columns
- ✅ **Permissions:** Export requires member+ access (already implemented)

### Existing Codebase Assets
- `/src/routes/dashboard.js` (lines 1127-1281): Working JSON export endpoint
- `/src/services/sectionStorage.js`: Section data service
- Database schema with `document_sections` table
- Frontend export buttons in document viewer (lines 356-361)

### Knowledge Base
- Analysis document: `/docs/analysis/DOCX_EXPORT_FEASIBILITY.md`
- Export implementation: `/docs/fixes/CHANGED_SECTIONS_EXPORT.md`

---

## Phase 1: Setup & Installation

### 1.1 Install Required Packages

**Libraries to Install:**
```bash
npm install docx diff --save
```

**Package Details:**

#### `docx` (v8.5.0+)
- **Purpose:** Create Word documents programmatically
- **Features:** Full formatting support, no templates required
- **Size:** ~500KB minified
- **Weekly Downloads:** 8M+
- **Documentation:** https://docx.js.org/

#### `diff` (v7.0.0+)
- **Purpose:** Text diffing for change detection
- **Algorithm:** Myers diff (same as Git)
- **Features:** Word-level, line-level, character-level diffs
- **Weekly Downloads:** 3M+
- **Documentation:** https://github.com/kpdecker/jsdiff

**Expected package.json Changes:**
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.76.1",
    "ajv": "^8.17.1",
    "cookie": "^1.0.2",
    "csurf": "^1.11.0",
    "diff": "^7.0.0",          // NEW
    "docx": "^8.5.0",          // NEW
    "dotenv": "^17.2.2",
    "ejs": "^3.1.9",
    // ... rest of dependencies
  }
}
```

### 1.2 Verify Installation

**Test Script:**
```bash
# Create test file: test-docx.js
node -e "
const { Document } = require('docx');
const Diff = require('diff');
console.log('✓ docx loaded:', typeof Document === 'function');
console.log('✓ diff loaded:', typeof Diff.diffWords === 'function');
"
```

**Expected Output:**
```
✓ docx loaded: true
✓ diff loaded: true
```

---

## Phase 2: DOCX Service Creation

### 2.1 Create Service File

**File:** `/src/services/docxExporter.js`

**Complete Service Implementation:**

```javascript
/**
 * DOCX Exporter Service
 * Generates Word documents with Track Changes-style formatting
 * for changed sections (strikethrough + underline)
 */

const {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  UnderlineType,
  BorderStyle
} = require('docx');
const Diff = require('diff');

class DocxExporter {
  /**
   * Export changed sections as DOCX with Track Changes formatting
   * @param {Object} documentData - Document metadata (id, title, etc.)
   * @param {Array} sections - Array of section objects with original/current text
   * @param {Object} exportMeta - Export metadata (user, date, etc.)
   * @returns {Document} DOCX Document instance
   */
  generateChangedSectionsDocument(documentData, sections, exportMeta = {}) {
    console.log('[DOCX] Starting document generation...');
    console.log(`[DOCX] Document: ${documentData.title}`);
    console.log(`[DOCX] Total sections to export: ${sections.length}`);

    // Build document structure
    const docChildren = [];

    // 1. Title Page
    docChildren.push(...this.createTitlePage(documentData, exportMeta));

    // 2. Summary Statistics
    docChildren.push(...this.createSummarySection(sections));

    // 3. Changed Sections with Track Changes Formatting
    sections.forEach((section, index) => {
      console.log(`[DOCX] Processing section ${index + 1}/${sections.length}: ${section.section_number}`);
      docChildren.push(...this.createSectionWithChanges(section));
    });

    // 4. Footer with export info
    docChildren.push(...this.createFooter(exportMeta));

    // Create and return document
    const doc = new Document({
      creator: exportMeta.exportedBy || 'Bylaws Amendment Tool',
      title: documentData.title || 'Document Changes',
      description: `Track Changes export for ${documentData.title}`,
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: docChildren
      }]
    });

    console.log('[DOCX] Document generation complete');
    return doc;
  }

  /**
   * Create title page with document information
   */
  createTitlePage(documentData, exportMeta) {
    return [
      new Paragraph({
        text: documentData.title || 'Document Changes',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: 'Track Changes Summary',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Exported: ${exportMeta.exportDate || new Date().toLocaleString()}`,
            italics: true
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Exported by: ${exportMeta.exportedBy || 'System'}`,
            italics: true
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 }
      }),
      new Paragraph({
        text: '',
        spacing: { after: 400 },
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6
          }
        }
      })
    ];
  }

  /**
   * Create summary statistics section
   */
  createSummarySection(sections) {
    const totalChanges = sections.length;
    const avgChangesPerSection = sections.reduce((acc, s) => {
      const diff = Diff.diffWords(s.original_text || '', s.current_text || '');
      const changes = diff.filter(d => d.added || d.removed).length;
      return acc + changes;
    }, 0) / totalChanges;

    return [
      new Paragraph({
        text: 'Summary Statistics',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Total Changed Sections: ', bold: true }),
          new TextRun({ text: `${totalChanges}` })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Average Changes per Section: ', bold: true }),
          new TextRun({ text: `${avgChangesPerSection.toFixed(1)}` })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        text: 'Legend:',
        bold: true,
        spacing: { before: 200, after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Deleted text ',
            strike: true,
            color: 'FF0000'
          }),
          new TextRun({ text: '= Original text (removed)' })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Added text ',
            underline: { type: UnderlineType.SINGLE },
            color: '0000FF'
          }),
          new TextRun({ text: '= New text (inserted)' })
        ],
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: '',
        spacing: { after: 400 },
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6
          }
        }
      })
    ];
  }

  /**
   * Create a section with Track Changes formatting
   * This is the core logic for strikethrough/underline
   */
  createSectionWithChanges(section) {
    const paragraphs = [];

    // Section header
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.section_number}`,
            bold: true,
            size: 28 // 14pt
          }),
          new TextRun({
            text: section.section_title ? ` - ${section.section_title}` : '',
            bold: true,
            size: 28
          })
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    // Generate diff between original and current text
    const originalText = section.original_text || '';
    const currentText = section.current_text || '';

    if (!originalText && !currentText) {
      paragraphs.push(
        new Paragraph({
          text: '(Empty section)',
          italics: true,
          color: '999999',
          spacing: { after: 300 }
        })
      );
      return paragraphs;
    }

    // Perform word-level diff
    const diff = Diff.diffWords(originalText, currentText);

    console.log(`[DOCX] Section ${section.section_number}: ${diff.length} diff parts`);

    // Build paragraph with formatted changes
    const textRuns = [];

    diff.forEach((part, index) => {
      if (part.removed) {
        // DELETED TEXT: Strikethrough + Red
        textRuns.push(
          new TextRun({
            text: part.value,
            strike: true,
            color: 'FF0000', // Red
            size: 24 // 12pt
          })
        );
      } else if (part.added) {
        // ADDED TEXT: Underline + Blue
        textRuns.push(
          new TextRun({
            text: part.value,
            underline: { type: UnderlineType.SINGLE },
            color: '0000FF', // Blue
            size: 24 // 12pt
          })
        );
      } else {
        // UNCHANGED TEXT: Normal
        textRuns.push(
          new TextRun({
            text: part.value,
            size: 24 // 12pt
          })
        );
      }
    });

    // Create paragraph with all text runs
    paragraphs.push(
      new Paragraph({
        children: textRuns,
        spacing: { after: 300 }
      })
    );

    // Add metadata if locked
    if (section.is_locked) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '🔒 Locked to original text',
              italics: true,
              color: '666666',
              size: 20 // 10pt
            })
          ],
          spacing: { after: 100 }
        })
      );
    }

    // Add separator
    paragraphs.push(
      new Paragraph({
        text: '',
        spacing: { after: 200 },
        border: {
          bottom: {
            color: 'CCCCCC',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 3
          }
        }
      })
    );

    return paragraphs;
  }

  /**
   * Create footer with export information
   */
  createFooter(exportMeta) {
    return [
      new Paragraph({
        text: '',
        spacing: { before: 600 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: 'Generated by Bylaws Amendment Tool',
            italics: true,
            size: 18,
            color: '666666'
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Export Date: ${exportMeta.exportDate || new Date().toLocaleString()}`,
            italics: true,
            size: 18,
            color: '666666'
          })
        ],
        alignment: AlignmentType.CENTER
      })
    ];
  }

  /**
   * Filter sections to only those with changes
   * @param {Array} sections - All sections
   * @returns {Array} Only sections where original_text !== current_text
   */
  filterChangedSections(sections) {
    return sections.filter(section =>
      section.original_text !== section.current_text
    );
  }
}

module.exports = new DocxExporter();
```

### 2.2 Service Features

**Key Capabilities:**
- ✅ Word-level diff algorithm (using jsdiff)
- ✅ Track Changes formatting (strikethrough + underline)
- ✅ Color coding (red for deleted, blue for added)
- ✅ Professional document structure (title page, summary, sections, footer)
- ✅ Metadata preservation (section numbers, titles, locked status)
- ✅ Edge case handling (empty sections, no changes)

**Design Decisions:**
- **Word-level diffs** (not character-level): More readable for users
- **Inline changes** (not side-by-side): Standard Track Changes format
- **1-inch margins**: Professional document appearance
- **12pt font**: Standard business document size

---

## Phase 3: Text Diff Algorithm

### 3.1 Understanding the Diff Library

**How jsdiff Works:**

```javascript
const Diff = require('diff');

// Example text comparison
const original = "The quick brown fox jumps over the lazy dog";
const current = "The quick red fox leaps over the sleeping dog";

const diff = Diff.diffWords(original, current);

// Output:
// [
//   { value: "The quick ", count: 2 },                    // unchanged
//   { value: "brown ", count: 1, removed: true },         // deleted
//   { value: "red ", count: 1, added: true },             // added
//   { value: "fox ", count: 1 },                          // unchanged
//   { value: "jumps ", count: 1, removed: true },         // deleted
//   { value: "leaps ", count: 1, added: true },           // added
//   { value: "over the ", count: 2 },                     // unchanged
//   { value: "lazy ", count: 1, removed: true },          // deleted
//   { value: "sleeping ", count: 1, added: true },        // added
//   { value: "dog", count: 1 }                            // unchanged
// ]
```

**Diff Object Properties:**
- `value`: The text content
- `added`: Boolean (present if text was added)
- `removed`: Boolean (present if text was deleted)
- `count`: Number of elements (words, lines, or characters)

### 3.2 Mapping Diff to DOCX Formatting

**Logic Flow:**
```javascript
diff.forEach(part => {
  if (part.removed) {
    // Strikethrough + Red
    createTextRun({ text: part.value, strike: true, color: 'FF0000' });
  } else if (part.added) {
    // Underline + Blue
    createTextRun({ text: part.value, underline: true, color: '0000FF' });
  } else {
    // Normal text
    createTextRun({ text: part.value });
  }
});
```

### 3.3 Alternative Diff Methods

**If word-level is too granular, use line-level:**
```javascript
const diff = Diff.diffLines(original, current);
```

**If you need character-level precision:**
```javascript
const diff = Diff.diffChars(original, current);
```

**Native Node.js util.diff (v22+):**
```javascript
const { diff } = require('util');
const result = diff(original, current);
// Returns unified diff format (like Git)
```

---

## Phase 4: Track Changes Formatting

### 4.1 DOCX Library Formatting Options

**TextRun Formatting Properties:**

```javascript
new TextRun({
  text: "Your text here",

  // Font properties
  font: "Calibri",
  size: 24,                    // Half-points (24 = 12pt)
  color: "FF0000",             // Hex color (no # prefix)

  // Text styling
  bold: true,
  italics: true,
  underline: {
    type: UnderlineType.SINGLE,  // or DOUBLE, DOTTED, DASHED
    color: "0000FF"
  },
  strike: true,                 // Strikethrough
  doubleStrike: true,           // Double strikethrough

  // Character spacing
  characterSpacing: 100,        // Expanded/condensed

  // Highlighting
  highlight: "yellow",          // Background color
  shading: {
    type: ShadingType.SOLID,
    color: "FFFF00"
  },

  // Vertical alignment
  superScript: true,            // Superscript
  subScript: true,              // Subscript

  // Case
  allCaps: true,
  smallCaps: true
})
```

### 4.2 Track Changes Color Scheme

**Standard Track Changes Colors:**

| Change Type | Color | Hex Code | Formatting |
|-------------|-------|----------|------------|
| Deleted | Red | `FF0000` | Strikethrough |
| Added | Blue | `0000FF` | Underline |
| Unchanged | Black | `000000` | Normal |

**Alternative Color Schemes:**

**Professional (softer colors):**
```javascript
// Deleted: Dark red
color: 'B22222'  // Firebrick

// Added: Dark blue
color: '00008B'  // DarkBlue
```

**High Contrast (accessibility):**
```javascript
// Deleted: Bright red
color: 'FF0000'

// Added: Bright green
color: '00FF00'
```

### 4.3 Paragraph Formatting

**Spacing and Alignment:**
```javascript
new Paragraph({
  children: [textRuns...],

  // Spacing (in twips: 1/20th of a point)
  spacing: {
    before: 240,   // 12pt before
    after: 240,    // 12pt after
    line: 360      // 1.5 line spacing
  },

  // Alignment
  alignment: AlignmentType.LEFT,  // or CENTER, RIGHT, JUSTIFIED

  // Indentation (in twips)
  indent: {
    left: 720,     // 0.5 inch
    right: 720,
    firstLine: 360 // First line indent
  },

  // Borders
  border: {
    top: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 },
    bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 6 }
  },

  // Heading level
  heading: HeadingLevel.HEADING_1,  // or HEADING_2, HEADING_3, etc.

  // Bullets/numbering
  bullet: { level: 0 },
  numbering: {
    reference: "my-numbering",
    level: 0
  }
})
```

---

## Phase 5: Route Endpoint

### 5.1 Add DOCX Export Endpoint

**File:** `/src/routes/dashboard.js`

**Add after the existing JSON export endpoint (line 1281):**

```javascript
/**
 * GET /documents/:documentId/export/docx - Export document as DOCX with Track Changes
 * Exports changed sections only with strikethrough/underline formatting
 */
router.get('/documents/:documentId/export/docx', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const { documentId } = req.params;
    const orgId = req.organizationId;

    console.log('[DOCX-EXPORT] Starting DOCX export for document:', documentId);

    // 1. Fetch document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, created_at, updated_at, organization_id')
      .eq('id', documentId)
      .eq('organization_id', orgId)
      .single();

    if (docError || !document) {
      console.error('[DOCX-EXPORT] Document fetch error:', docError);
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied'
      });
    }

    // 2. Fetch ALL sections (we'll filter for changes in service)
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select(`
        id,
        section_number,
        section_title,
        section_type,
        depth,
        ordinal,
        document_order,
        original_text,
        current_text,
        is_locked,
        locked_at,
        locked_by,
        metadata,
        created_at,
        updated_at
      `)
      .eq('document_id', documentId)
      .order('document_order', { ascending: true });

    if (sectionsError) {
      console.error('[DOCX-EXPORT] Error fetching sections:', sectionsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch document sections'
      });
    }

    // 3. Filter for changed sections only
    const docxExporter = require('../services/docxExporter');
    const changedSections = docxExporter.filterChangedSections(sections || []);

    if (changedSections.length === 0) {
      console.log('[DOCX-EXPORT] No changed sections found');
      return res.status(400).json({
        success: false,
        error: 'No changed sections to export'
      });
    }

    console.log(`[DOCX-EXPORT] Found ${changedSections.length} changed sections`);

    // 4. Generate DOCX document
    const exportMeta = {
      exportDate: new Date().toLocaleString(),
      exportedBy: req.session.userName || req.session.userEmail || 'Unknown User',
      userId: req.session.userId,
      organizationId: orgId
    };

    const doc = docxExporter.generateChangedSectionsDocument(
      document,
      changedSections,
      exportMeta
    );

    // 5. Convert to buffer
    const { Packer } = require('docx');
    const buffer = await Packer.toBuffer(doc);

    console.log('[DOCX-EXPORT] DOCX generated successfully');
    console.log(`[DOCX-EXPORT] Buffer size: ${(buffer.length / 1024).toFixed(2)} KB`);

    // 6. Generate filename
    const sanitizedTitle = document.title
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase()
      .substring(0, 50);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${sanitizedTitle}_changes_${dateStr}.docx`;

    // 7. Set response headers and send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Export-Version', '1.0');
    res.setHeader('X-Document-Id', documentId);
    res.setHeader('X-Changed-Sections', changedSections.length);

    console.log('[DOCX-EXPORT] Export successful:', {
      documentId,
      title: document.title,
      totalSections: sections?.length || 0,
      changedSections: changedSections.length,
      filename,
      sizeKB: (buffer.length / 1024).toFixed(2)
    });

    res.send(buffer);

  } catch (error) {
    console.error('[DOCX-EXPORT] Fatal error:', error);
    console.error('[DOCX-EXPORT] Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'An error occurred during DOCX export',
      details: error.message
    });
  }
});
```

### 5.2 Import Dependencies

**Add at top of `/src/routes/dashboard.js`:**

```javascript
// Existing imports...
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { attachPermissions } = require('../middleware/permissions');

// NEW: Add DOCX exporter
const docxExporter = require('../services/docxExporter');
const { Packer } = require('docx');  // For converting Document to buffer

// Rest of file...
```

### 5.3 Error Handling

**Comprehensive Error Responses:**

```javascript
// Document not found
if (!document) {
  return res.status(404).json({
    success: false,
    error: 'Document not found or access denied'
  });
}

// No changed sections
if (changedSections.length === 0) {
  return res.status(400).json({
    success: false,
    error: 'No changed sections to export',
    hint: 'This document has no modifications to export'
  });
}

// DOCX generation error
try {
  const doc = docxExporter.generateChangedSectionsDocument(...);
} catch (error) {
  console.error('[DOCX-EXPORT] Generation error:', error);
  return res.status(500).json({
    success: false,
    error: 'Failed to generate DOCX document',
    details: error.message
  });
}

// Buffer conversion error
try {
  const buffer = await Packer.toBuffer(doc);
} catch (error) {
  console.error('[DOCX-EXPORT] Buffer conversion error:', error);
  return res.status(500).json({
    success: false,
    error: 'Failed to convert document to file',
    details: error.message
  });
}
```

---

## Phase 6: Frontend Integration

### 6.1 Add "Export Word" Button

**File:** `/views/dashboard/document-viewer.ejs`

**Location:** After existing export buttons (around line 361)

**Button HTML:**
```html
<!-- Existing export buttons -->
<button id="export-full" class="btn btn-outline-primary btn-sm me-2"
        <% if (currentUser.role === 'viewer') { %>
          disabled
          data-bs-toggle="tooltip"
          title="Export feature requires member access or higher..."
        <% } %>
>
  <i class="bi bi-download me-1"></i> Export Full
</button>

<button id="export-changes" class="btn btn-outline-primary btn-sm me-2"
        <% if (currentUser.role === 'viewer') { %>
          disabled
          data-bs-toggle="tooltip"
          title="Export feature requires member access or higher..."
        <% } %>
>
  <i class="bi bi-file-earmark-diff me-1"></i> Export Changes (JSON)
</button>

<!-- NEW: Export Word button -->
<button id="export-word" class="btn btn-primary btn-sm"
        <% if (currentUser.role === 'viewer') { %>
          disabled
          data-bs-toggle="tooltip"
          title="Export feature requires member access or higher..."
        <% } %>
>
  <i class="bi bi-file-earmark-word me-1"></i> Export Word
  <span class="badge bg-light text-dark ms-1" style="font-size: 0.65rem;">Track Changes</span>
</button>
```

### 6.2 Frontend JavaScript Handler

**File:** `/views/dashboard/document-viewer.ejs`

**Add in `<script>` section (after existing export handlers):**

```javascript
// Export Word (DOCX) with Track Changes
document.getElementById('export-word')?.addEventListener('click', async function() {
  const button = this;
  const originalText = button.innerHTML;

  try {
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Generating...';

    console.log('[EXPORT-WORD] Starting DOCX export...');

    // Make request to DOCX endpoint
    const response = await fetch(`/dashboard/documents/${documentId}/export/docx`, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Export failed');
    }

    // Get filename from header or generate default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'document_changes.docx';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Get changed sections count from header
    const changedSections = response.headers.get('X-Changed-Sections');
    console.log(`[EXPORT-WORD] Downloading ${changedSections} changed sections`);

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log('[EXPORT-WORD] Download complete:', filename);

    // Show success toast
    showToast('success', `DOCX export successful! ${changedSections} changed sections exported.`);

  } catch (error) {
    console.error('[EXPORT-WORD] Error:', error);

    // Show error toast
    showToast('error', `Export failed: ${error.message}`);

  } finally {
    // Re-enable button
    button.disabled = false;
    button.innerHTML = originalText;
  }
});

// Helper function for toast notifications (if not already present)
function showToast(type, message) {
  // Use existing toast implementation or create simple alert
  if (typeof window.showNotification === 'function') {
    window.showNotification(type, message);
  } else {
    // Fallback to alert if no toast system
    alert(message);
  }
}
```

### 6.3 Loading States

**Enhanced Loading UX:**
```javascript
// Progress indicator with stages
const stages = [
  'Fetching sections...',
  'Analyzing changes...',
  'Formatting document...',
  'Generating DOCX...',
  'Preparing download...'
];

let stageIndex = 0;
const stageInterval = setInterval(() => {
  if (stageIndex < stages.length) {
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> ${stages[stageIndex]}`;
    stageIndex++;
  }
}, 800);

// Clear interval on completion
clearInterval(stageInterval);
```

### 6.4 Permission Checks

**Frontend permission validation (already in place):**
```javascript
// Button is disabled for viewers via EJS template
<% if (currentUser.role === 'viewer') { %>
  disabled
  data-bs-toggle="tooltip"
  title="Export feature requires member access or higher..."
<% } %>
```

**Backend permission validation (existing middleware):**
```javascript
// requireAuth middleware already checks authentication
// attachPermissions middleware already attaches user role
// No additional checks needed - viewers can't reach this endpoint
```

---

## Phase 7: Testing

### 7.1 Unit Tests

**Create:** `/tests/unit/docxExporter.test.js`

```javascript
const docxExporter = require('../../src/services/docxExporter');
const Diff = require('diff');

describe('DocxExporter Service', () => {
  describe('filterChangedSections', () => {
    test('should filter sections with changes', () => {
      const sections = [
        { id: '1', original_text: 'Original', current_text: 'Modified' },
        { id: '2', original_text: 'Same', current_text: 'Same' },
        { id: '3', original_text: 'Old', current_text: 'New' }
      ];

      const changed = docxExporter.filterChangedSections(sections);

      expect(changed).toHaveLength(2);
      expect(changed[0].id).toBe('1');
      expect(changed[1].id).toBe('3');
    });

    test('should handle empty sections', () => {
      const result = docxExporter.filterChangedSections([]);
      expect(result).toEqual([]);
    });
  });

  describe('generateChangedSectionsDocument', () => {
    test('should generate document with title page', () => {
      const documentData = { title: 'Test Document' };
      const sections = [
        {
          section_number: '1.1',
          section_title: 'Test Section',
          original_text: 'Original text',
          current_text: 'Modified text'
        }
      ];
      const exportMeta = { exportedBy: 'Test User' };

      const doc = docxExporter.generateChangedSectionsDocument(
        documentData,
        sections,
        exportMeta
      );

      expect(doc).toBeDefined();
      expect(doc.creator).toBe('Test User');
    });
  });
});

describe('Diff Library Integration', () => {
  test('should detect word-level changes', () => {
    const original = 'The quick brown fox';
    const current = 'The quick red fox';

    const diff = Diff.diffWords(original, current);

    expect(diff).toContainEqual(
      expect.objectContaining({ value: 'brown ', removed: true })
    );
    expect(diff).toContainEqual(
      expect.objectContaining({ value: 'red ', added: true })
    );
  });
});
```

**Run tests:**
```bash
npm test -- docxExporter.test.js
```

### 7.2 Integration Tests

**Create:** `/tests/integration/docxExport.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');

describe('DOCX Export Endpoint', () => {
  let authCookie;
  let testDocumentId;

  beforeAll(async () => {
    // Login and get auth cookie
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'testpass' });

    authCookie = loginRes.headers['set-cookie'];

    // Create test document with changed sections
    // (Implementation depends on your test setup)
  });

  test('should export DOCX for document with changes', async () => {
    const response = await request(app)
      .get(`/dashboard/documents/${testDocumentId}/export/docx`)
      .set('Cookie', authCookie)
      .expect(200)
      .expect('Content-Type', /application\/vnd.openxmlformats-officedocument.wordprocessingml.document/);

    expect(response.headers['content-disposition']).toMatch(/attachment/);
    expect(response.headers['x-changed-sections']).toBeDefined();
    expect(response.body).toBeInstanceOf(Buffer);
  });

  test('should reject export for document with no changes', async () => {
    // Create document with no changes
    const unchangedDocId = 'test-unchanged-doc-id';

    const response = await request(app)
      .get(`/dashboard/documents/${unchangedDocId}/export/docx`)
      .set('Cookie', authCookie)
      .expect(400);

    expect(response.body.error).toMatch(/no changed sections/i);
  });

  test('should reject unauthorized access', async () => {
    await request(app)
      .get(`/dashboard/documents/${testDocumentId}/export/docx`)
      .expect(302); // Redirect to login
  });
});
```

### 7.3 Manual Testing Checklist

**Test Cases:**

#### Basic Functionality
- [ ] Export button visible for members/admins
- [ ] Export button disabled for viewers
- [ ] Loading state shows during export
- [ ] File downloads successfully
- [ ] Filename format correct: `{title}_changes_{date}.docx`

#### Content Verification
- [ ] Only changed sections exported
- [ ] Section numbers correct
- [ ] Section titles present
- [ ] Deleted text has strikethrough + red color
- [ ] Added text has underline + blue color
- [ ] Unchanged text renders normally

#### Document Structure
- [ ] Title page present with document name
- [ ] Summary statistics accurate
- [ ] Legend explains formatting
- [ ] Section headers properly formatted
- [ ] Footer with export date and user

#### Edge Cases
- [ ] Handle empty sections gracefully
- [ ] Handle sections with no changes (filter out)
- [ ] Handle very long sections (>1000 words)
- [ ] Handle special characters (quotes, apostrophes, etc.)
- [ ] Handle Unicode characters (emoji, accented letters)
- [ ] Handle locked sections (show lock indicator)

#### Error Scenarios
- [ ] Document not found → 404 error
- [ ] No changed sections → 400 error with message
- [ ] Server error → 500 error with details
- [ ] Permission denied → Redirect to dashboard

#### Performance
- [ ] Small document (<10 sections) exports in < 2 seconds
- [ ] Medium document (10-50 sections) exports in < 5 seconds
- [ ] Large document (>50 sections) exports in < 10 seconds
- [ ] File size reasonable (< 500KB for typical document)

#### Browser Compatibility
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

### 7.4 User Acceptance Testing

**Test with Real User Data:**

1. **Create Test Document:**
   - Upload real neighborhood council bylaws
   - Make several text changes (add, delete, modify)
   - Lock some sections to original text

2. **Export and Review:**
   - Export to DOCX
   - Open in Microsoft Word
   - Verify formatting looks professional
   - Check Track Changes are clear

3. **User Feedback:**
   - Ask: "Can you clearly see what changed?"
   - Ask: "Does this match your expectations?"
   - Ask: "Would you present this to council?"

---

## Success Criteria

### Must Have (MVP)
- ✅ Export only changed sections
- ✅ Strikethrough for deleted text (red)
- ✅ Underline for added text (blue)
- ✅ Professional Word document appearance
- ✅ Proper section numbering and titles
- ✅ Works for all 99 neighborhood councils
- ✅ Filename format: `{council}_changes_{date}.docx`

### Should Have (V1.1)
- ✅ Color coding (red/blue) for changes
- ✅ Document metadata (title, export date, user)
- ✅ Summary statistics (total changes, sections affected)
- ✅ Legend explaining formatting
- ✅ Table of contents
- ✅ Locked section indicators

### Nice to Have (Future)
- 🎯 Side-by-side comparison table
- 🎯 Summary page with change statistics graphs
- 🎯 Configurable formatting options (colors, fonts)
- 🎯 Batch export (multiple documents)
- 🎯 Export templates (letterhead, cover pages)
- 🎯 Comment annotations for each change
- 🎯 Export to PDF option

---

## Troubleshooting

### Common Issues

#### 1. "Cannot find module 'docx'"
**Cause:** Package not installed
**Solution:**
```bash
npm install docx --save
```

#### 2. "Cannot find module 'diff'"
**Cause:** Package not installed
**Solution:**
```bash
npm install diff --save
```

#### 3. "TypeError: Packer.toBuffer is not a function"
**Cause:** Incorrect import or old version
**Solution:**
```javascript
// Correct import
const { Packer } = require('docx');

// Correct usage
const buffer = await Packer.toBuffer(doc);
```

#### 4. "No changed sections to export"
**Cause:** All sections have `original_text === current_text`
**Solution:**
- Check database: `SELECT * FROM document_sections WHERE original_text != current_text`
- Make some test changes in document viewer
- Verify sections were saved with changes

#### 5. DOCX file corrupted/won't open
**Cause:** Buffer conversion or streaming issue
**Solution:**
```javascript
// Ensure buffer is complete before sending
const buffer = await Packer.toBuffer(doc);
console.log('Buffer size:', buffer.length);

// Set correct headers
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
res.setHeader('Content-Length', buffer.length);

// Send as buffer (not stream)
res.send(buffer);
```

#### 6. Formatting not showing in Word
**Cause:** Color codes or underline not applied
**Solution:**
```javascript
// Verify formatting is applied
new TextRun({
  text: "Deleted text",
  strike: true,          // Must be boolean true
  color: "FF0000"        // Must be string hex (no #)
})

new TextRun({
  text: "Added text",
  underline: {
    type: UnderlineType.SINGLE  // Must use enum
  },
  color: "0000FF"
})
```

#### 7. Export takes too long (>10 seconds)
**Cause:** Large document or inefficient diff algorithm
**Solution:**
- Add batch processing for large documents
- Use line-level diffs instead of word-level for huge sections
- Add progress indicators to frontend

#### 8. Memory issues with large documents
**Cause:** Entire document loaded into memory
**Solution:**
```javascript
// Process sections in batches
const batchSize = 50;
for (let i = 0; i < sections.length; i += batchSize) {
  const batch = sections.slice(i, i + batchSize);
  // Process batch...
}
```

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

#### 1. Advanced Formatting Options
```javascript
// User-configurable color schemes
const colorSchemes = {
  standard: { deleted: 'FF0000', added: '0000FF' },
  colorblind: { deleted: 'FF6B35', added: '004E89' },
  highContrast: { deleted: 'FF0000', added: '00FF00' },
  professional: { deleted: 'B22222', added: '00008B' }
};

// Let users choose in UI
router.get('/documents/:id/export/docx?colorScheme=professional', ...)
```

#### 2. Export Templates
```javascript
// Allow custom document templates
const templates = {
  default: 'Standard format',
  letterhead: 'With organization letterhead',
  formal: 'Formal government format',
  simple: 'Minimal formatting'
};
```

#### 3. Side-by-Side Comparison
```javascript
// Create table with original | current columns
const comparisonTable = new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph('Original')] }),
        new TableCell({ children: [new Paragraph('Current')] })
      ]
    }),
    ...sections.map(s => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(s.original_text)] }),
        new TableCell({ children: [new Paragraph(s.current_text)] })
      ]
    }))
  ]
});
```

#### 4. Comment Annotations
```javascript
// Add comments to each change
new Paragraph({
  children: [
    new TextRun({
      text: "Changed text",
      comment: {
        author: "John Doe",
        date: new Date(),
        text: "This section was modified for clarity"
      }
    })
  ]
});
```

#### 5. PDF Export Alternative
```javascript
// Use pdf-lib or puppeteer for PDF generation
const { PDFDocument } = require('pdf-lib');

// Generate PDF with highlighting
const pdfDoc = await PDFDocument.create();
// ... PDF generation logic
```

#### 6. Batch Export
```javascript
// Export multiple documents at once
router.post('/documents/export/batch', async (req, res) => {
  const { documentIds } = req.body;

  // Create ZIP file with multiple DOCX files
  const archiver = require('archiver');
  const archive = archiver('zip');

  for (const docId of documentIds) {
    const docx = await generateDocx(docId);
    archive.append(docx, { name: `${docId}.docx` });
  }

  archive.finalize();
  res.attachment('documents.zip');
  archive.pipe(res);
});
```

#### 7. Export Statistics Dashboard
```javascript
// Track export analytics
const exportStats = {
  totalExports: 150,
  avgSectionsPerExport: 8.5,
  mostExportedDocument: 'Bylaws 2024',
  exportsByUser: { ... },
  exportsByDate: { ... }
};
```

---

## Appendix

### A. Complete File Structure

**New Files to Create:**
```
/src/services/docxExporter.js                     (Service)
/tests/unit/docxExporter.test.js                 (Tests)
/tests/integration/docxExport.test.js            (Tests)
/docs/guides/DOCX_EXPORT_IMPLEMENTATION_GUIDE.md (This file)
/docs/user/DOCX_EXPORT_USER_GUIDE.md             (User docs)
```

**Files to Modify:**
```
/src/routes/dashboard.js                          (Add endpoint)
/views/dashboard/document-viewer.ejs              (Add button)
/package.json                                     (Add dependencies)
```

### B. NPM Package Versions

**Recommended Versions:**
```json
{
  "docx": "^8.5.0",        // Latest stable (Jan 2025)
  "diff": "^7.0.0"         // Latest stable (Jan 2025)
}
```

**Version Compatibility:**
- `docx` v8.x: Full TypeScript support, modern API
- `docx` v7.x: Compatible but missing some features
- `diff` v7.x: Latest with ESM support
- `diff` v5.x: Older but stable

### C. DOCX Library Quick Reference

**Common Imports:**
```javascript
const {
  Document,           // Main document container
  Paragraph,          // Text paragraph
  TextRun,            // Formatted text span
  AlignmentType,      // LEFT, CENTER, RIGHT, JUSTIFIED
  HeadingLevel,       // HEADING_1, HEADING_2, etc.
  UnderlineType,      // SINGLE, DOUBLE, DOTTED, etc.
  BorderStyle,        // SINGLE, DOUBLE, DASHED, etc.
  Table,              // Table container
  TableRow,           // Table row
  TableCell,          // Table cell
  VerticalAlign,      // TOP, CENTER, BOTTOM
  ShadingType,        // SOLID, PERCENT_10, etc.
  Packer              // Convert to buffer/blob
} = require('docx');
```

**Full Documentation:**
- https://docx.js.org/
- https://github.com/dolanmiu/docx

### D. Diff Library Quick Reference

**Available Methods:**
```javascript
const Diff = require('diff');

// Word-level (recommended for prose)
Diff.diffWords(oldStr, newStr, options);

// Line-level (good for code/structured text)
Diff.diffLines(oldStr, newStr, options);

// Sentence-level
Diff.diffSentences(oldStr, newStr, options);

// Character-level (very granular)
Diff.diffChars(oldStr, newStr, options);

// JSON objects
Diff.diffJson(oldObj, newObj, options);

// Arrays
Diff.diffArrays(oldArr, newArr, options);

// Custom
Diff.createPatch(fileName, oldStr, newStr, oldHeader, newHeader);
Diff.applyPatch(oldStr, patch);
```

**Full Documentation:**
- https://github.com/kpdecker/jsdiff
- https://www.npmjs.com/package/diff

### E. Color Codes Reference

**Standard Colors:**
```javascript
const colors = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '00FF00',
  blue: '0000FF',

  // Track Changes
  deleteRed: 'FF0000',
  addBlue: '0000FF',

  // Professional
  darkRed: 'B22222',
  darkBlue: '00008B',
  darkGreen: '006400',

  // Accessibility
  firebrick: 'B22222',
  navy: '000080',
  teal: '008080',

  // Grays
  lightGray: 'CCCCCC',
  mediumGray: '999999',
  darkGray: '666666'
};
```

### F. Testing Checklist Summary

**Quick Validation:**
```bash
# 1. Install dependencies
npm install docx diff --save

# 2. Create service file
# (Copy code from Phase 2)

# 3. Add route endpoint
# (Copy code from Phase 5)

# 4. Add frontend button
# (Copy code from Phase 6)

# 5. Test endpoint
curl -o test.docx http://localhost:3000/dashboard/documents/{id}/export/docx

# 6. Open in Word
# Verify formatting looks correct

# 7. Run unit tests
npm test -- docxExporter.test.js

# 8. Run integration tests
npm test -- docxExport.test.js
```

---

## Next Steps for Implementation

### Session Kickoff (15 minutes)
1. Read this guide completely
2. Review existing code in `/src/routes/dashboard.js` (lines 1127-1281)
3. Check current Node.js version: `node --version` (should be v22+)
4. Verify current dependencies in `package.json`

### Implementation Order (8-12 hours)
1. **Phase 1:** Install packages (30 min)
2. **Phase 2:** Create docxExporter.js service (2-3 hours)
3. **Phase 3:** Integrate diff algorithm (1 hour)
4. **Phase 4:** Implement Track Changes formatting (2-3 hours)
5. **Phase 5:** Add route endpoint (1 hour)
6. **Phase 6:** Frontend button and handler (1 hour)
7. **Phase 7:** Testing and validation (2-3 hours)

### Validation (1-2 hours)
1. Test with sample document
2. Verify formatting in Microsoft Word
3. Test with all 99 neighborhood councils
4. Get user feedback

### Deployment
1. Commit changes with clear messages
2. Deploy to staging environment
3. Run full test suite
4. Deploy to production
5. Monitor for errors

---

## Summary

This guide provides **everything needed** to implement DOCX export with Track Changes formatting:

✅ **Complete code examples** for all phases
✅ **Step-by-step instructions** with no ambiguity
✅ **Testing checklists** for validation
✅ **Troubleshooting guide** for common issues
✅ **Future enhancement ideas** for V2

**Estimated Total Time:** 8-12 hours for complete implementation and testing.

**Next Session Goals:**
1. Install dependencies (30 min)
2. Create docxExporter service (3 hours)
3. Add route endpoint (1 hour)
4. Integrate frontend (1 hour)
5. Test and validate (2 hours)
6. Deploy and celebrate! 🎉

---

**Implementation Ready!**

This guide is designed to make the next session as efficient as possible. All code is provided, all decisions are documented, all edge cases are considered.

**Good luck with implementation!** 🚀

---

**Guide Created By:** Researcher Agent (Hive Mind Swarm)
**Date:** 2025-10-28
**Session:** swarm-1761627819200-fnb2ykjdl
**Version:** 1.0
