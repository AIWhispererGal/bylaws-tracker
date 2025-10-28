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
  BorderStyle,
  Packer
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
        text: 'Proposed Changes - Track Changes Format',
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
    let totalDiffParts = 0;

    sections.forEach(s => {
      const diff = Diff.diffWords(s.original_text || '', s.current_text || '');
      totalDiffParts += diff.filter(d => d.added || d.removed).length;
    });

    const avgChangesPerSection = totalChanges > 0 ? (totalDiffParts / totalChanges).toFixed(1) : 0;

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
          new TextRun({ text: `${avgChangesPerSection}` })
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
            color: '008000'
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

    diff.forEach((part) => {
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
        // ADDED TEXT: Underline + Green
        textRuns.push(
          new TextRun({
            text: part.value,
            underline: { type: UnderlineType.SINGLE },
            color: '008000', // Green (per user request)
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

  /**
   * Convert document to buffer
   * @param {Document} doc - DOCX Document instance
   * @returns {Promise<Buffer>} Document as buffer
   */
  async toBuffer(doc) {
    return await Packer.toBuffer(doc);
  }
}

module.exports = new DocxExporter();
