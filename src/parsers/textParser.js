/**
 * Text Parser
 * Parses plain text (.txt) and Markdown (.md) files
 * Reuses hierarchyDetector for consistent pattern matching
 *
 * Implements 10-level hierarchy support with indentation-based depth hints
 * Line-start patterns: 1., a., i., A., I.
 * Parenthetical patterns: (a), (1), (i)
 */

const fs = require('fs').promises;
const path = require('path');
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
    try {
      // Check for document-specific hierarchy override
      if (documentId) {
        try {
          const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
          );

          const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('hierarchy_override')
            .eq('id', documentId)
            .single();

          if (docError && docError.code !== 'PGRST116') { // PGRST116 = not found
            console.warn('[TextParser] Error fetching document hierarchy override:', docError.message);
          } else if (doc?.hierarchy_override) {
            // Use document-specific hierarchy config
            console.log('[TextParser] Using document-specific hierarchy override for document:', documentId);
            organizationConfig = {
              ...organizationConfig,
              hierarchy: doc.hierarchy_override
            };
          }
        } catch (error) {
          console.warn('[TextParser] Failed to check for hierarchy override:', error.message);
          // Continue with organization default config
        }
      }

      // Detect file type
      const ext = path.extname(filePath).toLowerCase();
      const isMarkdown = ['.md', '.markdown'].includes(ext);

      // Read file as UTF-8 text
      const text = await fs.readFile(filePath, 'utf-8');

      // Normalize line endings
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Optional: Preprocess Markdown headers
      let processedText = normalizedText;
      if (isMarkdown) {
        processedText = this.preprocessMarkdown(normalizedText, organizationConfig);
      }

      // Parse sections from text
      const sections = await this.parseSections(processedText, organizationConfig);

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
  }

  /**
   * Preprocess Markdown by removing # headers if content has organization prefix
   * This makes Markdown headers work seamlessly with hierarchy detection
   */
  preprocessMarkdown(text, organizationConfig) {
    const lines = text.split('\n');
    const processedLines = [];
    const levels = organizationConfig?.hierarchy?.levels || [];

    for (const line of lines) {
      let processedLine = line;

      // Convert Markdown headers to plain text if they have organization prefix
      // Example: "# Article I - NAME" → "Article I - NAME"
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        const content = headerMatch[2].trim();

        // Check if content starts with any configured prefix
        const hasPrefix = levels.some(level =>
          content.toLowerCase().startsWith(level.prefix.toLowerCase())
        );

        if (hasPrefix) {
          processedLine = content; // Remove # prefix
          console.log(`[TextParser] Preprocessed Markdown header: "${line}" → "${processedLine}"`);
        }
        // Otherwise leave as-is (may be actual heading text)
      }

      processedLines.push(processedLine);
    }

    return processedLines.join('\n');
  }

  /**
   * Parse sections from text (main logic)
   * Follows wordParser pattern with text-specific adaptations
   */
  async parseSections(text, organizationConfig) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentText = [];

    console.log('[TextParser] Starting section parsing...');
    console.log(`[TextParser] Total lines: ${lines.length}`);

    // Detect Table of Contents (simplified for text files)
    const tocLines = this.detectTableOfContents(lines);

    // Detect hierarchy patterns using hierarchyDetector
    const allDetectedItems = hierarchyDetector.detectHierarchy(text, organizationConfig);

    // Filter out TOC items
    const detectedItems = allDetectedItems.filter(item => {
      const lineNum = this.charIndexToLineNumber(text, item.index);
      return !tocLines.has(lineNum);
    });

    console.log(`[TextParser] Detected ${allDetectedItems.length} patterns, kept ${detectedItems.length} after TOC filter`);

    // Calculate indentation levels for all lines (depth hints)
    const indentationLevels = this.calculateIndentation(lines);

    // Build header lines map by matching detected items to lines
    const headerLines = new Set();
    const itemsByLine = new Map();

    for (const item of detectedItems) {
      const pattern = this.normalizeForMatching(item.fullMatch);

      // Search through lines to find this pattern
      for (let i = 0; i < lines.length; i++) {
        if (headerLines.has(i) || tocLines.has(i)) continue;

        const normalizedLine = this.normalizeForMatching(lines[i]);

        if (normalizedLine.startsWith(pattern)) {
          headerLines.add(i);
          itemsByLine.set(i, {
            ...item,
            indentation: indentationLevels[i] // Add indentation hint
          });
          break;
        }
      }
    }

    console.log(`[TextParser] Mapped ${headerLines.size} header lines`);

    // Parse sections line by line
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
        const { title, contentOnSameLine } = this.extractTitleAndContent(line, item);

        currentSection = {
          type: item.type,
          level: item.level,
          number: item.number,
          prefix: item.prefix,
          title,
          citation: this.buildCitation(item, sections),
          lineNumber: lineIndex,
          indentation: item.indentation // Store indentation hint
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

    console.log(`[TextParser] Parsed ${sections.length} sections`);

    // Capture orphaned content
    const sectionsWithOrphans = this.captureOrphanedContent(lines, sections, detectedItems);

    // Enrich sections with metadata
    const enrichedSections = this.enrichSections(sectionsWithOrphans, organizationConfig);

    // Deduplicate sections
    const uniqueSections = this.deduplicateSections(enrichedSections);

    console.log(`[TextParser] Final section count: ${uniqueSections.length}`);

    return uniqueSections;
  }

  /**
   * Calculate indentation levels for all lines
   * Returns array of indentation levels (number of leading spaces/tabs)
   */
  calculateIndentation(lines) {
    const indentationLevels = [];

    for (const line of lines) {
      // Count leading whitespace
      const match = line.match(/^(\s*)/);
      if (match) {
        const whitespace = match[1];
        // Convert tabs to 4 spaces
        const normalized = whitespace.replace(/\t/g, '    ');
        const indentLevel = Math.floor(normalized.length / 2); // 2 spaces = 1 level
        indentationLevels.push(indentLevel);
      } else {
        indentationLevels.push(0);
      }
    }

    return indentationLevels;
  }

  /**
   * Normalize text for pattern matching
   * Identical to wordParser implementation
   */
  normalizeForMatching(text) {
    return text
      .split('\t')[0]           // Remove content after first TAB
      .replace(/\s+/g, ' ')     // Collapse whitespace
      .trim()                    // Remove leading/trailing whitespace
      .toUpperCase();            // Normalize case
  }

  /**
   * Detect Table of Contents lines (simplified for text files)
   * Text files may have simpler TOC patterns or none at all
   */
  detectTableOfContents(lines) {
    const tocLines = new Set();

    // Look for TOC header
    const tocHeaderIndex = lines.findIndex(line =>
      /^table\s+of\s+contents$/i.test(line.trim())
    );

    // Only look for TOC if header is found
    if (tocHeaderIndex === -1) {
      return tocLines; // No TOC header, return empty
    }

    // Scan next 100 lines for TOC patterns
    const scanStart = tocHeaderIndex + 1;
    const scanEnd = Math.min(scanStart + 100, lines.length);

    for (let i = scanStart; i < scanEnd; i++) {
      const line = lines[i];

      // TOC pattern: line with dots leading to page number
      // Example: "ARTICLE I............5" or "Section 1.....12"
      if (/\.{3,}\s*\d+\s*$/.test(line)) {
        tocLines.add(i);
      }
    }

    if (tocLines.size >= 3) {
      tocLines.add(tocHeaderIndex); // Include header
      console.log(`[TextParser] Detected TOC: ${tocLines.size} lines`);
    } else {
      tocLines.clear(); // Not enough matches
    }

    return tocLines;
  }

  /**
   * Convert character index to line number
   * Identical to wordParser implementation
   */
  charIndexToLineNumber(text, charIndex) {
    let currentIndex = 0;
    const lines = text.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const lineLength = lines[lineNum].length + 1; // +1 for newline
      if (charIndex < currentIndex + lineLength) {
        return lineNum;
      }
      currentIndex += lineLength;
    }

    return lines.length - 1;
  }

  /**
   * Extract title and content from header line
   * Identical to wordParser implementation
   */
  extractTitleAndContent(line, detectedItem) {
    const trimmed = line.trim();

    // Remove the detected pattern from the start
    let remainder = trimmed.substring(detectedItem.fullMatch.length).trim();

    // Remove common delimiters at start
    remainder = remainder.replace(/^[:\-–—]\s*/, '').trim();

    // Check for dash separator indicating content on same line
    // Patterns: "Title – content" or "Title - content"
    const contentSeparatorMatch = remainder.match(/^([^–\-]+?)\s*[–\-]\s*(.+)$/);

    if (contentSeparatorMatch) {
      return {
        title: contentSeparatorMatch[1].trim() || '(Untitled)',
        contentOnSameLine: contentSeparatorMatch[2].trim()
      };
    }

    // Short remainder is likely title only
    if (remainder.length < 50 && !/[.!?]$/.test(remainder)) {
      return {
        title: remainder || '(Untitled)',
        contentOnSameLine: null
      };
    }

    // Try to extract first sentence as title
    const firstSentenceMatch = remainder.match(/^([A-Z][^.!?]*[.!?])\s*(.*)$/);
    if (firstSentenceMatch) {
      return {
        title: firstSentenceMatch[1].trim(),
        contentOnSameLine: firstSentenceMatch[2].trim() || null
      };
    }

    // Fallback based on length
    if (remainder.length < 100) {
      return {
        title: remainder || '(Untitled)',
        contentOnSameLine: null
      };
    }

    return {
      title: '(Content on header line)',
      contentOnSameLine: remainder
    };
  }

  /**
   * Build citation for a section
   * Identical to wordParser implementation
   */
  buildCitation(item, previousSections) {
    // Build hierarchical citation based on parent context
    if (item.type === 'section' || item.type === 'subsection' || item.type === 'clause') {
      // Find the most recent article
      const parentArticle = previousSections
        .slice()
        .reverse()
        .find(s => s.type === 'article');

      if (parentArticle) {
        return `${parentArticle.citation}, ${item.prefix}${item.number}`;
      }
    }

    // For articles or when no parent found, use simple format
    return `${item.prefix}${item.number}`;
  }

  /**
   * Capture orphaned content that wasn't assigned to any section
   * Identical to wordParser implementation
   */
  captureOrphanedContent(lines, sections, detectedItems) {
    console.log('[TextParser] Scanning for orphaned content...');

    // Build set of captured line numbers
    const capturedLines = new Set();

    // Mark TOC lines as captured
    const tocLines = this.detectTableOfContents(lines);
    tocLines.forEach(lineNum => capturedLines.add(lineNum));

    // Mark section header lines
    sections.forEach(section => {
      if (section.lineNumber !== undefined) {
        capturedLines.add(section.lineNumber);
      }
    });

    // Mark content lines that belong to sections
    let currentSectionIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is a header line
      const isHeaderLine = sections.some(s => s.lineNumber === i);

      if (isHeaderLine) {
        currentSectionIndex = sections.findIndex(s => s.lineNumber === i);
        capturedLines.add(i);
      } else if (currentSectionIndex >= 0 && sections[currentSectionIndex]) {
        // Check if section text includes this line
        const section = sections[currentSectionIndex];
        if (section.text && trimmed && section.text.includes(trimmed)) {
          capturedLines.add(i);
        }
      }
    }

    // Find orphaned content blocks
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

    // Save last orphan block
    if (currentOrphan.lines.length > 0) {
      orphans.push(currentOrphan);
    }

    if (orphans.length > 0) {
      console.log(`[TextParser] Found ${orphans.length} orphaned content block(s)`);
    } else {
      console.log('[TextParser] No orphaned content found');
    }

    return this.attachOrphansToSections(orphans, sections);
  }

  /**
   * Attach orphaned content to nearest section or create new sections
   * Identical to wordParser implementation
   */
  attachOrphansToSections(orphans, sections) {
    if (orphans.length === 0) {
      return sections;
    }

    const enhancedSections = [...sections];
    let orphanSectionCounter = 1;

    for (const orphan of orphans) {
      const content = this.cleanText(orphan.lines.join('\n'));

      // Skip trivial orphans
      if (content.length < 10) {
        console.log(`[TextParser] Skipping trivial orphan at lines ${orphan.startLine}-${orphan.endLine}`);
        continue;
      }

      // Find nearest section before this orphan
      const nearestSectionIndex = enhancedSections.findIndex(
        s => s.lineNumber !== undefined && s.lineNumber > orphan.startLine
      );

      if (nearestSectionIndex > 0) {
        // Attach to previous section
        const targetSection = enhancedSections[nearestSectionIndex - 1];
        const existingText = targetSection.text || '';

        if (!existingText.includes(content.substring(0, 50))) {
          targetSection.text = existingText
            ? `${existingText}\n\n${content}`
            : content;

          console.log(`[TextParser] Attached orphan to section: ${targetSection.citation}`);
        }
      } else if (nearestSectionIndex === 0) {
        // Create preamble section
        const preambleSection = {
          type: 'preamble',
          level: 'Preamble',
          number: '0',
          prefix: 'Preamble ',
          title: 'Document Preamble',
          citation: 'Preamble',
          text: content,
          lineNumber: orphan.startLine,
          isOrphan: true
        };

        enhancedSections.unshift(preambleSection);
        console.log('[TextParser] Created preamble section for orphan');
      } else {
        // Create unnumbered section
        const unnumberedSection = {
          type: 'unnumbered',
          level: 'Unnumbered',
          number: String(orphanSectionCounter++),
          prefix: 'Unnumbered Section ',
          title: 'Additional Content',
          citation: `Unnumbered Section ${orphanSectionCounter - 1}`,
          text: content,
          lineNumber: orphan.startLine,
          isOrphan: true
        };

        enhancedSections.push(unnumberedSection);
        console.log('[TextParser] Created unnumbered section for orphan');
      }
    }

    return enhancedSections;
  }

  /**
   * Clean text content
   * Identical to wordParser implementation
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
   * Enrich sections with hierarchy information
   * Identical to wordParser implementation with indentation hints
   */
  enrichSections(sections, organizationConfig) {
    console.log('\n[TextParser] Starting section enrichment...');
    console.log('[TextParser] Total sections to enrich:', sections.length);

    const hierarchy = organizationConfig?.hierarchy || {};
    let levels = hierarchy.levels;

    if (!levels || !Array.isArray(levels)) {
      console.warn('[TextParser] Missing hierarchy.levels, using empty array as fallback');
      levels = [];
    } else {
      console.log('[TextParser] Configured hierarchy levels:', levels.map(l => `${l.type}(depth=${l.depth})`).join(', '));
    }

    // First pass: basic enrichment
    const basicEnriched = sections.map((section, index) => {
      const levelDef = levels.find(l => l.type === section.type);

      let articleNumber = null;
      let sectionNumber = 0;

      if (section.type === 'article') {
        articleNumber = hierarchyDetector.parseNumber(section.number, levelDef?.numbering);
      } else if (section.type === 'section') {
        sectionNumber = hierarchyDetector.parseNumber(section.number, levelDef?.numbering);
      }

      if (index < 5 || index % 10 === 0) {
        console.log(`[TextParser]   [${index}] ${section.citation} (${section.type}) - depth: ${levelDef?.depth || 'undefined'}, indent: ${section.indentation || 0}`);
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

    console.log('[TextParser] Basic enrichment complete, proceeding to context-aware depth calculation...');

    // Second pass: context-aware depth calculation with indentation hints
    return this.enrichSectionsWithContext(basicEnriched, levels);
  }

  /**
   * Calculate contextual depth based on document structure
   * Enhanced with indentation-based depth hints
   */
  enrichSectionsWithContext(sections, levels) {
    if (sections.length === 0) return sections;

    console.log('\n[CONTEXT-DEPTH] ============ Starting Context-Aware Depth Calculation ============');
    console.log('[CONTEXT-DEPTH] Total sections:', sections.length);
    console.log('[CONTEXT-DEPTH] Configured levels:', levels?.length || 0);

    const hierarchyStack = [];
    const enrichedSections = [];

    // Type priority map (supports 10 levels)
    const typePriority = {
      'article': 100,      // Depth 0
      'section': 90,       // Depth 1
      'subsection': 80,    // Depth 2
      'paragraph': 70,     // Depth 3
      'subparagraph': 60,  // Depth 4
      'clause': 50,        // Depth 5
      'subclause': 40,     // Depth 6
      'item': 30,          // Depth 7
      'subitem': 20,       // Depth 8
      'point': 10,         // Depth 9
      'subpoint': 5,       // Depth 9+ (overflow)
      'unnumbered': 0,
      'preamble': 0
    };

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const currentPriority = typePriority[section.type] || 0;

      console.log(`\n[CONTEXT-DEPTH] Processing [${i}]: ${section.citation} (${section.type}, priority=${currentPriority}, indent=${section.indentation || 0})`);

      // Pop from stack until we find appropriate parent
      let popsCount = 0;
      while (hierarchyStack.length > 0) {
        const stackTop = hierarchyStack[hierarchyStack.length - 1];
        const stackPriority = typePriority[stackTop.type] || 0;

        if (currentPriority >= stackPriority) {
          hierarchyStack.pop();
          popsCount++;
          console.log(`[CONTEXT-DEPTH]   Popped: ${stackTop.citation}`);
        } else {
          console.log(`[CONTEXT-DEPTH]   Found parent: ${stackTop.citation}`);
          break;
        }
      }

      // ✅ FIX: Use configured depth from hierarchy levels, NOT stack length!
      // Find the level definition for this section type
      const levelDef = levels.find(l => l.type === section.type);
      const configuredDepth = levelDef?.depth;

      // Calculate contextual depth - prefer configured depth over stack
      let contextualDepth;
      let depthReason;

      if (configuredDepth !== undefined && configuredDepth !== null) {
        // Use configured depth from hierarchy
        contextualDepth = configuredDepth;
        depthReason = 'configured';
        console.log(`[CONTEXT-DEPTH]   Using configured depth: ${contextualDepth} (from levelDef for type ${section.type})`);
      } else {
        // Fallback to stack-based depth for unknown types
        contextualDepth = hierarchyStack.length;
        depthReason = 'stack-fallback';
        console.log(`[CONTEXT-DEPTH]   No configured depth, using stack: ${contextualDepth}`);
      }

      // Override for special types
      if (section.type === 'article') {
        contextualDepth = 0;
        depthReason = 'article-override';
      } else if (section.type === 'preamble') {
        contextualDepth = 0;
        depthReason = 'preamble-override';
      } else if (section.indentation && section.indentation > 0) {
        // Use indentation as depth hint (validate against hierarchy)
        const indentBasedDepth = Math.min(section.indentation, 9);
        if (indentBasedDepth > contextualDepth && indentBasedDepth <= 9) {
          contextualDepth = indentBasedDepth;
          depthReason = 'indentation-hint';
          console.log(`[CONTEXT-DEPTH]   Using indentation hint: depth ${contextualDepth}`);
        }
      }

      const parent = hierarchyStack.length > 0 ? hierarchyStack[hierarchyStack.length - 1] : null;
      if (parent) {
        console.log(`[CONTEXT-DEPTH]   Parent: ${parent.citation} at depth ${parent.depth}`);
      }

      const enrichedSection = {
        ...section,
        depth: contextualDepth,
        contextualDepth: contextualDepth,
        parentPath: hierarchyStack.map(s => s.citation).join(' > '),
        depthCalculationMethod: depthReason
      };

      console.log(`[CONTEXT-DEPTH]   ✓ Assigned depth: ${contextualDepth} (${depthReason})`);

      enrichedSections.push(enrichedSection);
      hierarchyStack.push(enrichedSection);
    }

    // Validate depths are within bounds (0-9)
    const maxDepth = Math.max(
      (levels.length > 0) ? levels.length - 1 : 9,
      9
    );

    let depthWarnings = 0;
    for (const section of enrichedSections) {
      if (section.depth > maxDepth) {
        console.warn(`[CONTEXT-DEPTH] ⚠️ Section ${section.citation} depth ${section.depth} exceeds max ${maxDepth}, capping`);
        section.depth = maxDepth;
        section.contextualDepth = maxDepth;
        depthWarnings++;
      }
    }

    // Generate summary
    const depthDistribution = this.getDepthDistribution(enrichedSections);
    console.log('\n[CONTEXT-DEPTH] ============ Depth Calculation Complete ============');
    console.log('[CONTEXT-DEPTH] Summary:');
    console.log('  - Total sections:', enrichedSections.length);
    console.log('  - Depth warnings:', depthWarnings);
    console.log('  - Depth distribution:', depthDistribution);
    console.log('  - Max depth used:', Math.max(...Object.keys(depthDistribution).map(Number)));

    // Show sample hierarchy
    console.log('\n[CONTEXT-DEPTH] Sample hierarchy (first 10 sections):');
    enrichedSections.slice(0, 10).forEach(section => {
      const indent = '  '.repeat(section.depth);
      console.log(`  ${indent}[${section.depth}] ${section.citation}: ${section.title.substring(0, 40)}...`);
    });
    console.log('[CONTEXT-DEPTH] ============================================\n');

    return enrichedSections;
  }

  /**
   * Get distribution of sections by depth for debugging
   * Identical to wordParser implementation
   */
  getDepthDistribution(sections) {
    const distribution = {};
    for (const section of sections) {
      const depth = section.depth;
      distribution[depth] = (distribution[depth] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Deduplicate sections
   * Identical to wordParser implementation
   */
  deduplicateSections(sections) {
    const seen = new Map();
    const unique = [];
    const duplicates = [];

    console.log('[TextParser] Checking for duplicate sections...');

    for (const section of sections) {
      const key = section.citation;

      if (!seen.has(key)) {
        seen.set(key, section);
        unique.push(section);
      } else {
        const original = seen.get(key);
        const originalLength = (original.text || '').length;
        const currentLength = (section.text || '').length;

        if (currentLength > 0 && originalLength > 0) {
          const originalText = original.text || '';
          const currentText = section.text || '';

          if (originalText !== currentText) {
            original.text = originalText + '\n\n' + currentText;
            console.log(`[TextParser] Merged duplicate ${section.citation}`);
          }
        } else if (currentLength > originalLength) {
          original.text = section.text;
          console.log(`[TextParser] Replacing empty duplicate ${section.citation}`);
        }

        duplicates.push(section);
      }
    }

    if (duplicates.length > 0) {
      console.log(`[TextParser] ⚠️  Removed ${duplicates.length} duplicate sections`);
    } else {
      console.log('[TextParser] ✓ No duplicate sections found');
    }

    return unique;
  }

  /**
   * Validate parsed sections
   * Identical to wordParser implementation
   */
  validateSections(sections, organizationConfig) {
    const errors = [];

    // Check for empty sections
    const emptySections = sections.filter(s => !s.text || s.text.trim() === '');
    const emptyNonContainers = emptySections.filter(s => s.type !== 'article');

    if (emptyNonContainers.length > 0) {
      errors.push({
        type: 'warning',
        message: `${emptyNonContainers.length} sections have no content`,
        sections: emptyNonContainers.map(s => s.citation)
      });
    }

    // Check for duplicate citations
    const citations = sections.map(s => s.citation);
    const duplicates = citations.filter((c, i) => citations.indexOf(c) !== i);
    if (duplicates.length > 0) {
      errors.push({
        type: 'error',
        message: 'Duplicate section citations found',
        citations: [...new Set(duplicates)]
      });
    }

    // Validate hierarchy if configured
    if (organizationConfig.hierarchy) {
      const hierarchyValidation = hierarchyDetector.validateHierarchy(
        sections,
        organizationConfig
      );

      if (!hierarchyValidation.valid) {
        errors.push(...hierarchyValidation.errors.map(e => ({
          type: 'error',
          message: e.error || e.message,
          section: e.section
        })));
      }
    }

    return {
      valid: !errors.some(e => e.type === 'error'),
      warnings: errors.filter(e => e.type === 'warning'),
      errors: errors.filter(e => e.type === 'error')
    };
  }

  /**
   * Generate preview of parsed sections
   * Identical to wordParser implementation
   */
  generatePreview(sections, maxSections = 5) {
    return {
      totalSections: sections.length,
      preview: sections.slice(0, maxSections).map(section => ({
        citation: section.citation,
        title: section.title,
        type: section.type,
        depth: section.depth,
        textPreview: section.text
          ? section.text.substring(0, 100) + (section.text.length > 100 ? '...' : '')
          : '(Empty)'
      }))
    };
  }
}

module.exports = new TextParser();
