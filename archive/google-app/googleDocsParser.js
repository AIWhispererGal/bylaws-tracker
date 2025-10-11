/**
 * Google Docs Parser
 * Refactored integration with Google Docs API
 */

const hierarchyDetector = require('./hierarchyDetector');

class GoogleDocsParser {
  /**
   * Parse Google Docs content
   * Note: This assumes you have Google Docs content already fetched via API
   */
  async parseDocument(docContent, organizationConfig) {
    try {
      // Extract text from Google Docs structure
      const text = this.extractTextFromGoogleDoc(docContent);

      // Parse sections
      const sections = await this.parseSections(text, organizationConfig);

      return {
        success: true,
        sections,
        metadata: {
          source: 'google_docs',
          documentId: docContent.documentId,
          parsedAt: new Date().toISOString(),
          sectionCount: sections.length
        }
      };
    } catch (error) {
      console.error('Error parsing Google Docs:', error);
      return {
        success: false,
        error: error.message,
        sections: []
      };
    }
  }

  /**
   * Extract plain text from Google Docs structure
   */
  extractTextFromGoogleDoc(docContent) {
    if (typeof docContent === 'string') {
      return docContent;
    }

    // If it's a Google Docs API response structure
    if (docContent.body && docContent.body.content) {
      return this.extractTextFromContent(docContent.body.content);
    }

    return '';
  }

  /**
   * Extract text from Google Docs content array
   */
  extractTextFromContent(content) {
    const textParts = [];

    for (const element of content) {
      if (element.paragraph) {
        const paragraph = element.paragraph;
        if (paragraph.elements) {
          for (const elem of paragraph.elements) {
            if (elem.textRun && elem.textRun.content) {
              textParts.push(elem.textRun.content);
            }
          }
        }
      } else if (element.table) {
        // Handle tables if needed
        textParts.push('[Table content]');
      }
    }

    return textParts.join('');
  }

  /**
   * Parse sections from text
   */
  async parseSections(text, organizationConfig) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentText = [];

    // Detect hierarchy patterns
    const detectedItems = hierarchyDetector.detectHierarchy(text, organizationConfig);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this line is a header
      const matchingItem = detectedItems.find(
        item => line.includes(item.fullMatch)
      );

      if (matchingItem && this.isHeaderLine(line, matchingItem)) {
        // Save previous section
        if (currentSection) {
          currentSection.text = this.cleanText(currentText.join('\n'));
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          type: matchingItem.type,
          level: matchingItem.level,
          number: matchingItem.number,
          prefix: matchingItem.prefix,
          title: this.extractTitle(line, matchingItem),
          citation: `${matchingItem.prefix}${matchingItem.number}`
        };

        currentText = [];
      } else if (currentSection) {
        // Accumulate text
        if (trimmed) {
          currentText.push(line);
        }
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.text = this.cleanText(currentText.join('\n'));
      sections.push(currentSection);
    }

    return this.enrichSections(sections, organizationConfig);
  }

  /**
   * Check if line is a header
   */
  isHeaderLine(line, detectedItem) {
    const trimmed = line.trim();
    return trimmed.length < 200 && trimmed.startsWith(detectedItem.fullMatch);
  }

  /**
   * Extract title from header line
   */
  extractTitle(line, detectedItem) {
    const trimmed = line.trim();
    let title = trimmed.substring(detectedItem.fullMatch.length).trim();
    title = title.replace(/^[:\-–—]/, '').trim();
    return title || '(Untitled)';
  }

  /**
   * Clean text content
   */
  cleanText(text) {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }

  /**
   * Enrich sections with metadata
   */
  enrichSections(sections, organizationConfig) {
    const levels = organizationConfig.hierarchy?.levels || [];
    let articleNumber = null;
    let sectionNumber = 0;

    return sections.map((section, index) => {
      const levelDef = levels.find(l => l.type === section.type);

      if (section.type === 'article') {
        articleNumber = hierarchyDetector.parseNumber(section.number, levelDef?.numbering);
        sectionNumber = 0;
      } else if (section.type === 'section') {
        sectionNumber = hierarchyDetector.parseNumber(section.number, levelDef?.numbering);
      }

      return {
        ...section,
        depth: levelDef?.depth || 0,
        ordinal: index + 1,
        article_number: articleNumber,
        section_number: sectionNumber,
        section_citation: section.citation,
        section_title: `${section.citation} - ${section.title}`,
        original_text: section.text || '(No content)'
      };
    });
  }

  /**
   * Generate preview
   */
  generatePreview(sections, maxSections = 5) {
    return {
      totalSections: sections.length,
      preview: sections.slice(0, maxSections).map(section => ({
        citation: section.citation,
        title: section.title,
        type: section.type,
        textPreview: section.text
          ? section.text.substring(0, 100) + (section.text.length > 100 ? '...' : '')
          : '(Empty)'
      }))
    };
  }
}

module.exports = new GoogleDocsParser();
