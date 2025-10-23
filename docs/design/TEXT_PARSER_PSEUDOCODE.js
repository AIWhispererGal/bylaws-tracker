/**
 * TextParser Pseudocode Implementation
 *
 * This file contains the complete pseudocode structure for the TextParser class.
 * Use this as a reference when implementing the actual textParser.js file.
 *
 * IMPLEMENTATION NOTES:
 * - Copy structure to src/parsers/textParser.js
 * - Replace pseudocode comments with actual implementation
 * - Reuse methods from wordParser.js where marked
 * - Test each method as you implement it
 */

const fs = require('fs').promises;
const path = require('path');
const hierarchyDetector = require('./hierarchyDetector');
const { createClient } = require('@supabase/supabase-js');

class TextParser {
  /**
   * Main entry point: Parse a text or markdown document
   *
   * @param {string} filePath - Path to the .txt or .md file
   * @param {Object} organizationConfig - Organization configuration object
   * @param {string} documentId - Optional document ID for hierarchy override lookup
   * @returns {Promise<Object>} Parse result with sections and metadata
   */
  async parseDocument(filePath, organizationConfig, documentId = null) {
    // PSEUDOCODE:
    // try {
    //   1. Check for document-specific hierarchy override from database
    //      - If documentId provided, query documents table
    //      - If hierarchy_override exists, merge with organizationConfig
    //      - This allows per-document customization
    //
    //   2. Detect file type from extension
    //      - Get extension: path.extname(filePath).toLowerCase()
    //      - Check if ['.md', '.markdown'].includes(ext)
    //      - Set isMarkdown flag
    //
    //   3. Read file content as UTF-8 text
    //      - Use fs.readFile(filePath, 'utf-8')
    //      - Handle encoding errors (try latin1 if utf-8 fails)
    //      - Normalize line endings: \r\n → \n, \r → \n
    //
    //   4. Optional: Preprocess Markdown
    //      - If isMarkdown, call preprocessMarkdown(text, organizationConfig)
    //      - Convert # headers to plain text if they match hierarchy prefixes
    //      - This makes Markdown work with existing hierarchy detector
    //
    //   5. Parse sections from text
    //      - Call parseSections(processedText, organizationConfig)
    //      - This is the main parsing logic (detailed below)
    //
    //   6. Return standardized result object
    //      - Format: { success, sections, metadata }
    //      - Metadata includes: source ('text' or 'markdown'), fileName, timestamp
    //      - Same structure as wordParser for consistency
    //
    // } catch (error) {
    //   7. Handle errors gracefully
    //      - Log error with context
    //      - Return { success: false, error: message, sections: [] }
    //      - Don't throw - let caller decide how to handle
    // }

    // IMPLEMENTATION TEMPLATE:
    /*
    try {
      // Step 1: Hierarchy override check
      if (documentId) {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: doc } = await supabase
          .from('documents')
          .select('hierarchy_override')
          .eq('id', documentId)
          .single();

        if (doc?.hierarchy_override) {
          organizationConfig = {
            ...organizationConfig,
            hierarchy: doc.hierarchy_override
          };
        }
      }

      // Step 2: Detect file type
      const ext = path.extname(filePath).toLowerCase();
      const isMarkdown = ['.md', '.markdown'].includes(ext);

      // Step 3: Read file
      let text = await fs.readFile(filePath, 'utf-8');

      // Normalize line endings
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Step 4: Markdown preprocessing
      let processedText = text;
      if (isMarkdown) {
        processedText = this.preprocessMarkdown(text, organizationConfig);
      }

      // Step 5: Parse sections
      const sections = await this.parseSections(processedText, organizationConfig);

      // Step 6: Return result
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
      console.error('[TextParser] Error parsing document:', error);
      return {
        success: false,
        error: error.message,
        sections: []
      };
    }
    */
  }

  /**
   * Main parsing logic: Extract sections from text
   *
   * @param {string} text - Full document text
   * @param {Object} organizationConfig - Organization configuration
   * @returns {Promise<Array>} Array of parsed sections
   */
  async parseSections(text, organizationConfig) {
    // PSEUDOCODE:
    // 1. Split text into lines array
    //    - const lines = text.split('\n');
    //    - Each line will be processed individually
    //
    // 2. Initialize state variables
    //    - sections = [] (accumulates final sections)
    //    - currentSection = null (tracks section being built)
    //    - currentText = [] (accumulates lines for current section)
    //
    // 3. Detect Table of Contents lines (optional for text files)
    //    - Call detectTableOfContents(lines)
    //    - Returns Set of line numbers to skip
    //    - Text files may not have TOC, so this might return empty set
    //
    // 4. Use hierarchyDetector to find all hierarchy patterns
    //    - Call hierarchyDetector.detectHierarchy(text, organizationConfig)
    //    - Returns array of detected items with {type, number, prefix, index, ...}
    //    - These are potential section headers
    //
    // 5. Filter out items that appear in TOC
    //    - Convert character index to line number for each item
    //    - Remove items whose line number is in tocLines set
    //    - Prevents duplicate sections from TOC and body
    //
    // 6. Build map of header lines
    //    - For each detected item, find which line it appears on
    //    - Create Set of line numbers that are headers
    //    - Create Map of lineNumber → detectedItem
    //    - Skip lines already marked as headers or TOC
    //
    // 7. State machine: Parse sections line by line
    //    - Loop through all lines with index
    //    - If line is in TOC, skip it
    //    - If line is a header:
    //        * Save previous section (if exists)
    //        * Extract title from header line
    //        * Create new currentSection object
    //        * Initialize currentText array
    //    - If line is content (and we're in a section):
    //        * Append line to currentText
    //    - Otherwise, skip empty lines or preamble
    //
    // 8. Save final section (after loop ends)
    //    - currentSection.text = cleanText(currentText.join('\n'))
    //    - sections.push(currentSection)
    //
    // 9. Capture orphaned content
    //    - Find text that wasn't assigned to any section
    //    - Call captureOrphanedContent(lines, sections, detectedItems)
    //    - Returns sections with orphans attached or new preamble/unnumbered sections
    //
    // 10. Enrich sections with metadata
    //     - Call enrichSections(sectionsWithOrphans, organizationConfig)
    //     - Adds depth, ordinal, citations, parent paths
    //     - Uses context-aware depth calculation
    //
    // 11. Deduplicate sections
    //     - Call deduplicateSections(enrichedSections)
    //     - Removes duplicate citations (from TOC duplicates that slipped through)
    //     - Merges content from duplicates
    //
    // 12. Return final sections array

    // IMPLEMENTATION TEMPLATE:
    /*
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentText = [];

    // Detect TOC (may be empty for simple text files)
    const tocLines = this.detectTableOfContents(lines);

    // Use hierarchyDetector to find patterns
    const allDetectedItems = hierarchyDetector.detectHierarchy(
      text,
      organizationConfig
    );

    // Filter out TOC items
    const detectedItems = allDetectedItems.filter(item => {
      const lineNum = this.charIndexToLineNumber(text, item.index);
      return !tocLines.has(lineNum);
    });

    // Build header lines map
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

    // Parse sections line by line
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      // Skip TOC
      if (tocLines.has(lineIndex)) continue;

      if (headerLines.has(lineIndex)) {
        // Save previous section
        if (currentSection) {
          currentSection.text = this.cleanText(currentText.join('\n'));
          sections.push(currentSection);
        }

        // Start new section
        const item = itemsByLine.get(lineIndex);
        const { title, contentOnSameLine } = this.extractTitleAndContent(line, item);

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

    // Save last section
    if (currentSection) {
      currentSection.text = this.cleanText(currentText.join('\n'));
      sections.push(currentSection);
    }

    // Capture orphaned content
    const sectionsWithOrphans = this.captureOrphanedContent(
      lines,
      sections,
      detectedItems
    );

    // Enrich and deduplicate
    const enrichedSections = this.enrichSections(
      sectionsWithOrphans,
      organizationConfig
    );
    const uniqueSections = this.deduplicateSections(enrichedSections);

    return uniqueSections;
    */
  }

  /**
   * Markdown preprocessing: Convert Markdown headers to plain text
   *
   * @param {string} text - Raw Markdown text
   * @param {Object} organizationConfig - Organization configuration
   * @returns {string} Processed text
   */
  preprocessMarkdown(text, organizationConfig) {
    // PSEUDOCODE:
    // 1. Split text into lines
    //
    // 2. For each line:
    //    - Check if it's a Markdown header: /^(#{1,6})\s+(.+)$/
    //    - If yes, extract header level (number of #) and content
    //    - Check if content already has organization prefix (e.g., "Article I")
    //    - If yes, remove the # symbols to make it plain text
    //    - If no, leave as-is (manual review needed)
    //
    // 3. Join lines back together
    //
    // 4. Return processed text

    // IMPLEMENTATION TEMPLATE:
    /*
    const lines = text.split('\n');
    const processedLines = [];

    for (const line of lines) {
      let processedLine = line;

      // Check for Markdown header
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        const content = headerMatch[2].trim();

        // Check if content has organization prefix
        const hasPrefix = organizationConfig.hierarchy?.levels?.some(level =>
          content.startsWith(level.prefix)
        );

        if (hasPrefix) {
          // Remove # symbols - hierarchyDetector will find the pattern
          processedLine = content;
        }
        // Otherwise leave as-is
      }

      processedLines.push(processedLine);
    }

    return processedLines.join('\n');
    */
  }

  /**
   * REUSED FROM WORDPARSER: Extract title and content from header line
   */
  extractTitleAndContent(line, detectedItem) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 302-355
    // This method handles patterns like:
    // - "Section 2: Title"
    // - "Section 2 - Title"
    // - "Section 2: Title – content on same line"
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Build citation for a section
   */
  buildCitation(item, previousSections) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 360-377
    // Builds hierarchical citations like "Article I, Section 1"
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Enrich sections with hierarchy information
   */
  enrichSections(sections, organizationConfig) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 624-676
    // Adds depth, ordinal, article_number, section_number, etc.
    // Calls enrichSectionsWithContext for contextual depth
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Context-aware depth calculation
   */
  enrichSectionsWithContext(sections, levels) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 683-831
    // Uses stack-based algorithm to calculate parent-child relationships
    // Assigns contextual depth based on document structure
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Deduplicate sections
   */
  deduplicateSections(sections) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 384-440
    // Removes duplicate citations
    // Merges content from duplicates
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Clean text content
   */
  cleanText(text) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 612-619
    // Removes excessive whitespace
    // Trims empty lines
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Normalize text for pattern matching
   */
  normalizeForMatching(text) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 94-100
    // Handles TAB characters, spaces, case
    // No changes needed for text parsing
  }

  /**
   * MODIFIED FROM WORDPARSER: Detect Table of Contents
   * Simplified version for text files
   */
  detectTableOfContents(lines) {
    // PSEUDOCODE:
    // Text files may not have formal TOC with tabs and page numbers
    // Two approaches:
    //
    // OPTION 1: Simple approach (recommended for MVP)
    // - Return empty Set()
    // - Rely on deduplication to handle any duplicates
    //
    // OPTION 2: Pattern-based detection
    // - Look for "Table of Contents" header
    // - Scan next 50-100 lines for lines ending with numbers
    // - Mark those as TOC if 3+ matches found
    //
    // For text files, Option 1 is usually sufficient

    // IMPLEMENTATION TEMPLATE:
    /*
    // Simple approach: no TOC detection for text files
    return new Set();

    // OR advanced approach (copy from wordParser.js lines 106-144)
    // Then modify the TAB detection since text files won't have TABs
    */
  }

  /**
   * REUSED FROM WORDPARSER: Convert character index to line number
   */
  charIndexToLineNumber(text, charIndex) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 149-162
    // Used to map hierarchyDetector results (char indices) to line numbers
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Capture orphaned content
   */
  captureOrphanedContent(lines, sections, detectedItems) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 446-531
    // Finds text not assigned to any section
    // Creates preamble or unnumbered sections as needed
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Attach orphans to sections
   */
  attachOrphansToSections(orphans, sections) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 536-607
    // Attaches orphaned content to nearest section
    // Or creates new preamble/unnumbered sections
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Validate sections
   */
  validateSections(sections, organizationConfig) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 865-922
    // Checks for empty sections, duplicate citations, hierarchy errors
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Generate preview
   */
  generatePreview(sections, maxSections = 5) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 848-860
    // Creates summary of first N sections
    // No changes needed for text parsing
  }

  /**
   * REUSED FROM WORDPARSER: Get depth distribution
   */
  getDepthDistribution(sections) {
    // COPY IMPLEMENTATION FROM wordParser.js lines 836-843
    // Returns count of sections at each depth level
    // No changes needed for text parsing
  }
}

module.exports = new TextParser();

/**
 * IMPLEMENTATION CHECKLIST:
 *
 * [ ] Copy this file to src/parsers/textParser.js
 * [ ] Implement parseDocument() using template above
 * [ ] Implement parseSections() using template above
 * [ ] Implement preprocessMarkdown() using template above
 * [ ] Copy extractTitleAndContent() from wordParser.js
 * [ ] Copy buildCitation() from wordParser.js
 * [ ] Copy enrichSections() from wordParser.js
 * [ ] Copy enrichSectionsWithContext() from wordParser.js
 * [ ] Copy deduplicateSections() from wordParser.js
 * [ ] Copy cleanText() from wordParser.js
 * [ ] Copy normalizeForMatching() from wordParser.js
 * [ ] Implement detectTableOfContents() (simple version)
 * [ ] Copy charIndexToLineNumber() from wordParser.js
 * [ ] Copy captureOrphanedContent() from wordParser.js
 * [ ] Copy attachOrphansToSections() from wordParser.js
 * [ ] Copy validateSections() from wordParser.js
 * [ ] Copy generatePreview() from wordParser.js
 * [ ] Copy getDepthDistribution() from wordParser.js
 * [ ] Add JSDoc comments to all methods
 * [ ] Test with simple .txt file
 * [ ] Test with complex .txt file
 * [ ] Test with .md file
 * [ ] Verify depth calculation
 * [ ] Verify database insertion
 *
 * TESTING:
 * [ ] Unit tests for each method
 * [ ] Integration test for file upload
 * [ ] Test error handling
 * [ ] Test edge cases (empty file, no patterns, etc.)
 * [ ] Performance benchmark vs wordParser
 */
