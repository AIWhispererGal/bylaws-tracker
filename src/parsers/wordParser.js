/**
 * Word Document Parser
 * Parses .docx files using mammoth library
 */

const mammoth = require('mammoth');
const fs = require('fs').promises;
const hierarchyDetector = require('./hierarchyDetector');
const { createClient } = require('@supabase/supabase-js');

class WordParser {
  /**
   * Parse a Word document
   * @param {string} filePath - Path to the .docx file
   * @param {Object} organizationConfig - Organization configuration object
   * @param {string} documentId - Optional document ID for hierarchy override lookup
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
            console.warn('[WordParser] Error fetching document hierarchy override:', docError.message);
          } else if (doc?.hierarchy_override) {
            // Use document-specific hierarchy config
            console.log('[WordParser] Using document-specific hierarchy override for document:', documentId);
            organizationConfig = {
              ...organizationConfig,
              hierarchy: doc.hierarchy_override
            };
          }
        } catch (error) {
          console.warn('[WordParser] Failed to check for hierarchy override:', error.message);
          // Continue with organization default config
        }
      }

      // Read the .docx file
      const buffer = await fs.readFile(filePath);

      // Extract raw text and HTML
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer }),
        mammoth.convertToHtml({ buffer })
      ]);

      if (textResult.messages.length > 0) {
        console.warn('Word parser warnings:', textResult.messages);
      }

      // Parse sections from text
      const sections = await this.parseSections(
        textResult.value,
        htmlResult.value,
        organizationConfig
      );

      return {
        success: true,
        sections,
        metadata: {
          source: 'word',
          fileName: filePath.split('/').pop(),
          parsedAt: new Date().toISOString(),
          sectionCount: sections.length
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

  /**
   * Normalize text for pattern matching
   * Handles TAB characters, multiple spaces, case variations
   */
  normalizeForMatching(text) {
    return text
      .split('\t')[0]           // Remove page numbers (content after first TAB)
      .replace(/\s+/g, ' ')     // Collapse all whitespace to single space
      .trim()                    // Remove leading/trailing whitespace
      .toUpperCase();            // Normalize case
  }

  /**
   * Detect Table of Contents lines
   * TOC lines have pattern: "ARTICLE I\tNAME\t4" (header + TAB + text + TAB + page number)
   */
  detectTableOfContents(lines) {
    const tocLines = new Set();

    // Look for TOC header
    const tocHeaderIndex = lines.findIndex(line =>
      /^table\s+of\s+contents$/i.test(line.trim())
    );

    // Scan more lines for TOC pattern: text ending with TAB + digits
    // Extend scan limit to catch full TOC
    const scanLimit = Math.min(200, lines.length);
    let firstTocLine = -1;
    let lastTocLine = -1;

    for (let i = 0; i < scanLimit; i++) {
      // TOC pattern: ends with TAB followed by digits (page number)
      const hasTocPattern = /\t\d+\s*$/.test(lines[i]);

      if (hasTocPattern) {
        tocLines.add(i);
        if (firstTocLine === -1) firstTocLine = i;
        lastTocLine = i;
      }
    }

    // Only consider it a TOC if we found 3+ matching lines
    if (tocLines.size >= 3) {
      // Also mark the TOC header line if found
      if (tocHeaderIndex !== -1) {
        tocLines.add(tocHeaderIndex);
      }
      console.log(`[WordParser] Detected TOC: lines ${firstTocLine}-${lastTocLine} (${tocLines.size} lines matched pattern)`);
    } else {
      // Not enough matches - clear the set
      tocLines.clear();
    }

    return tocLines;
  }

  /**
   * Convert character index to line number
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

    return lines.length - 1; // Return last line if not found
  }

  /**
   * Parse sections from extracted text
   */
  async parseSections(text, html, organizationConfig) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = null;
    let currentText = [];

    // Detect and mark Table of Contents lines
    const tocLines = this.detectTableOfContents(lines);

    // Detect hierarchy patterns
    const allDetectedItems = hierarchyDetector.detectHierarchy(text, organizationConfig);

    // Filter out items that are in the TOC range
    const detectedItems = allDetectedItems.filter(item => {
      const lineNum = this.charIndexToLineNumber(text, item.index);
      return !tocLines.has(lineNum);
    });

    console.log(`[WordParser] Filtered ${allDetectedItems.length - detectedItems.length} TOC items, kept ${detectedItems.length} real headers`);

    // Build a map of which lines are headers by searching for detected patterns
    const headerLines = new Set();
    const itemsByLine = new Map();

    // Match detected items to lines by searching for the pattern in each line
    // IMPORTANT: Skip TOC range entirely to avoid false matches
    for (const item of detectedItems) {
      // Normalize the pattern for reliable matching
      const pattern = this.normalizeForMatching(item.fullMatch);

      // Search through all lines to find this pattern
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const normalizedLine = this.normalizeForMatching(line);

        // Skip lines already marked as headers
        if (headerLines.has(i)) continue;

        // Skip TOC lines - they're duplicates, not real headers
        if (tocLines.has(i)) continue;

        // Check if normalized line starts with normalized pattern
        if (normalizedLine.startsWith(pattern)) {
          headerLines.add(i);
          itemsByLine.set(i, item);
          break; // Found this item, move to next
        }
      }
    }

    // Now parse sections with clear header vs content distinction
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmed = line.trim();

      // Skip TOC lines entirely - they're duplicates, not real content
      if (tocLines.has(lineIndex)) {
        continue;
      }

      if (headerLines.has(lineIndex)) {
        // This is a header line - save previous section and start new one
        if (currentSection) {
          currentSection.text = this.cleanText(currentText.join('\n'));
          sections.push(currentSection);
        }

        const item = itemsByLine.get(lineIndex);
        if (item) {
          // Extract title and any content on the same line
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
          currentText = [];

          // If there's content on the same line as the header, add it
          if (contentOnSameLine) {
            currentText.push(contentOnSameLine);
          }
        }
      } else if (currentSection && trimmed) {
        // This is content for the current section - add it
        currentText.push(line);
      } else if (!currentSection && trimmed) {
        // Content before first section - will be captured as orphan
        // No action needed here, orphan capture will handle it
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.text = this.cleanText(currentText.join('\n'));
      sections.push(currentSection);
    }

    // Capture any orphaned content that wasn't assigned to sections
    const sectionsWithOrphans = this.captureOrphanedContent(lines, sections, detectedItems);

    // Enrich sections FIRST (adds metadata and copies text to original_text)
    const enrichedSections = this.enrichSections(sectionsWithOrphans, organizationConfig);

    // Deduplicate AFTER content is assigned (now can compare actual content)
    const uniqueSections = this.deduplicateSections(enrichedSections);

    return uniqueSections;
  }

  /**
   * Check if line is a header line
   */
  isHeaderLine(line, detectedItem) {
    const trimmed = line.trim();

    // Header lines are typically:
    // - Short (< 200 chars)
    // - Match detected pattern at start
    // - Not followed immediately by another detected pattern
    return (
      trimmed.length < 200 &&
      trimmed.startsWith(detectedItem.fullMatch)
    );
  }

  /**
   * Extract title and content from header line
   * Some bylaws have format: "Section 2: Title – content on same line"
   */
  extractTitleAndContent(line, detectedItem) {
    const trimmed = line.trim();

    // Remove the detected pattern from the start
    let remainder = trimmed.substring(detectedItem.fullMatch.length).trim();

    // Remove common delimiters at start
    remainder = remainder.replace(/^[:\-–—]\s*/, '').trim();

    // Check if there's a dash/em-dash separator indicating content on same line
    // Patterns: "Title – content" or "Title - content"
    const contentSeparatorMatch = remainder.match(/^([^–\-]+?)\s*[–\-]\s*(.+)$/);

    if (contentSeparatorMatch) {
      // Title and content separated by dash
      return {
        title: contentSeparatorMatch[1].trim() || '(Untitled)',
        contentOnSameLine: contentSeparatorMatch[2].trim()
      };
    }

    // No separator - check if the remainder looks like a short title or long content
    // If it's short (< 50 chars) and doesn't end with punctuation, treat as title only
    // If it's long or ends with period, it might be content
    if (remainder.length < 50 && !/[.!?]$/.test(remainder)) {
      return {
        title: remainder || '(Untitled)',
        contentOnSameLine: null
      };
    }

    // Long text or ends with punctuation - might be all content, no separate title
    // For safety, if there's a capital letter at start, treat first phrase as title
    const firstSentenceMatch = remainder.match(/^([A-Z][^.!?]*[.!?])\s*(.*)$/);
    if (firstSentenceMatch) {
      return {
        title: firstSentenceMatch[1].trim(),
        contentOnSameLine: firstSentenceMatch[2].trim() || null
      };
    }

    // Fallback: treat it all as title if short, or all as content if long
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
   */
  buildCitation(item, previousSections) {
    // Build hierarchical citation based on parent context
    // For sections/subsections, include the parent article
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
   * Remove duplicate sections that appear multiple times in the document
   * Common when documents contain table of contents + body or multiple copies
   * Merges duplicate content to preserve all occurrences
   */
  deduplicateSections(sections) {
    const seen = new Map(); // citation -> best occurrence
    const unique = [];
    const duplicates = [];

    console.log('[WordParser] Checking for duplicate sections...');

    for (const section of sections) {
      // Use citation as the primary key for deduplication
      const key = section.citation;

      if (!seen.has(key)) {
        // First time seeing this section
        seen.set(key, section);
        unique.push(section);
      } else {
        // Found duplicate - merge content instead of replacing
        const original = seen.get(key);
        const originalLength = (original.text || '').length;
        const currentLength = (section.text || '').length;

        // Merge texts if both have content
        if (currentLength > 0 && originalLength > 0) {
          // Merge: append new content if it's different
          const originalText = original.text || '';
          const currentText = section.text || '';

          // Only merge if content is actually different
          if (originalText !== currentText) {
            original.text = originalText + '\n\n' + currentText;
            console.log(`[WordParser] Merged duplicate ${section.citation} (${originalLength} + ${currentLength} = ${original.text.length} chars)`);
          } else {
            console.log(`[WordParser] Skipping identical duplicate ${section.citation}`);
          }
        } else if (currentLength > originalLength) {
          // Current has content but original doesn't - replace
          original.text = section.text;
          console.log(`[WordParser] Replacing empty duplicate ${section.citation} with content (${currentLength} chars)`);
        }

        duplicates.push(section);
      }
    }

    if (duplicates.length > 0) {
      console.log(`[WordParser] ⚠️  Removed ${duplicates.length} duplicate sections`);
      console.log('[WordParser] Note: Source document contains duplicate content (e.g., table of contents + body)');

      // Show which citations were duplicated
      const duplicateCitations = new Set(duplicates.map(d => d.citation));
      console.log(`[WordParser] Deduplicated citations: ${Array.from(duplicateCitations).join(', ')}`);
    } else {
      console.log('[WordParser] ✓ No duplicate sections found');
    }

    return unique;
  }

  /**
   * Capture orphaned content that wasn't assigned to any section
   * This fallback ensures 100% content capture
   */
  captureOrphanedContent(lines, sections, detectedItems) {
    console.log('[WordParser] Scanning for orphaned content...');

    // Build a set of line numbers that are already captured
    const capturedLines = new Set();

    // Detect TOC lines and mark them as captured (they're duplicates, not content)
    const tocLines = this.detectTableOfContents(lines);
    tocLines.forEach(lineNum => capturedLines.add(lineNum));

    // Mark section header lines as captured
    sections.forEach(section => {
      if (section.lineNumber !== undefined) {
        capturedLines.add(section.lineNumber);
      }
    });

    // Mark content lines that belong to sections
    // We need to reconstruct which lines belong to which section
    const sectionContentMap = new Map();
    let currentSectionIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is a header line for a section
      const isHeaderLine = sections.some(s => s.lineNumber === i);

      if (isHeaderLine) {
        currentSectionIndex = sections.findIndex(s => s.lineNumber === i);
        capturedLines.add(i);
      } else if (currentSectionIndex >= 0 && sections[currentSectionIndex]) {
        // This line might be part of the current section's content
        // Check if the section's text includes this line
        const section = sections[currentSectionIndex];
        if (section.text && trimmed && section.text.includes(trimmed)) {
          capturedLines.add(i);
        }
      }
    }

    // Find orphaned content blocks
    const orphans = [];
    let currentOrphan = {
      startLine: -1,
      endLine: -1,
      lines: []
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!capturedLines.has(i) && trimmed) {
        // This line is orphaned
        if (currentOrphan.startLine === -1) {
          currentOrphan.startLine = i;
        }
        currentOrphan.endLine = i;
        currentOrphan.lines.push(line);
      } else if (currentOrphan.lines.length > 0) {
        // End of orphan block
        orphans.push({ ...currentOrphan });
        currentOrphan = { startLine: -1, endLine: -1, lines: [] };
      }
    }

    // Don't forget the last orphan block
    if (currentOrphan.lines.length > 0) {
      orphans.push(currentOrphan);
    }

    if (orphans.length > 0) {
      console.log(`[WordParser] Found ${orphans.length} orphaned content block(s)`);
      console.log('[WordParser] Orphan details:', orphans.map(o => ({
        lines: `${o.startLine}-${o.endLine}`,
        preview: o.lines[0]?.substring(0, 50) + '...'
      })));
    } else {
      console.log('[WordParser] No orphaned content found - all content captured!');
    }

    // Attach orphans to sections or create new sections
    return this.attachOrphansToSections(orphans, sections);
  }

  /**
   * Attach orphaned content to nearest section or create new sections
   */
  attachOrphansToSections(orphans, sections) {
    if (orphans.length === 0) {
      return sections;
    }

    const enhancedSections = [...sections];
    let orphanSectionCounter = 1;

    for (const orphan of orphans) {
      const content = this.cleanText(orphan.lines.join('\n'));

      // Skip if content is too short (likely just whitespace artifacts)
      if (content.length < 10) {
        console.log(`[WordParser] Skipping trivial orphan at lines ${orphan.startLine}-${orphan.endLine}`);
        continue;
      }

      // Find the nearest section before this orphan
      const nearestSectionIndex = enhancedSections.findIndex(
        s => s.lineNumber !== undefined && s.lineNumber > orphan.startLine
      );

      if (nearestSectionIndex > 0) {
        // Attach to previous section
        const targetSection = enhancedSections[nearestSectionIndex - 1];
        const existingText = targetSection.text || '';

        // Only append if not already included
        if (!existingText.includes(content.substring(0, 50))) {
          targetSection.text = existingText
            ? `${existingText}\n\n${content}`
            : content;

          console.log(`[WordParser] Attached orphan (lines ${orphan.startLine}-${orphan.endLine}) to section: ${targetSection.citation}`);
        }
      } else if (nearestSectionIndex === 0) {
        // Orphan appears before the first section - create preamble section
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
        console.log(`[WordParser] Created preamble section for orphan at lines ${orphan.startLine}-${orphan.endLine}`);
      } else {
        // No sections at all, or orphan after last section - create unnumbered section
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
        console.log(`[WordParser] Created unnumbered section for orphan at lines ${orphan.startLine}-${orphan.endLine}`);
      }
    }

    return enhancedSections;
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
   * Enrich sections with hierarchy information
   */
  enrichSections(sections, organizationConfig) {
    console.log('\n[WordParser] Starting section enrichment...');
    console.log('[WordParser] Total sections to enrich:', sections.length);

    // ✅ FIX: Add defensive validation for hierarchy config with fallback
    const hierarchy = organizationConfig?.hierarchy || {};
    let levels = hierarchy.levels;

    // Handle undefined, null, or non-array levels gracefully
    if (!levels || !Array.isArray(levels)) {
      console.warn('[WordParser] Missing or invalid hierarchy.levels, using empty array as fallback');
      levels = [];
    } else {
      console.log('[WordParser] Configured hierarchy levels:', levels.map(l => `${l.type}(depth=${l.depth})`).join(', '));
    }

    // First pass: basic enrichment with initial properties
    const basicEnriched = sections.map((section, index) => {
      // Find matching level definition
      const levelDef = levels.find(l => l.type === section.type);

      // Track article and section numbers for the old schema compatibility
      let articleNumber = null;
      let sectionNumber = 0;

      if (section.type === 'article') {
        articleNumber = hierarchyDetector.parseNumber(section.number, levelDef?.numbering);
      } else if (section.type === 'section') {
        sectionNumber = hierarchyDetector.parseNumber(section.number, levelDef?.numbering);
      }

      // Log what we're processing
      if (index < 5 || index % 10 === 0) {
        console.log(`[WordParser]   [${index}] ${section.citation} (${section.type}) - levelDef depth: ${levelDef?.depth || 'undefined'}`);
      }

      return {
        ...section,
        depth: levelDef?.depth || 0, // Will be recalculated contextually
        ordinal: index + 1,
        article_number: articleNumber,
        section_number: sectionNumber,
        section_citation: section.citation,
        section_title: `${section.citation} - ${section.title}`,
        original_text: section.text || '(No content)'
      };
    });

    console.log('[WordParser] Basic enrichment complete, proceeding to context-aware depth calculation...');

    // Second pass: context-aware depth calculation
    return this.enrichSectionsWithContext(basicEnriched, levels);
  }

  /**
   * Calculate contextual depth based on document structure
   * "Everything between ARTICLE I and ARTICLE II belongs to ARTICLE I"
   * FIX-4: Enhanced to support full 10-level depth hierarchy
   */
  enrichSectionsWithContext(sections, levels) {
    if (sections.length === 0) return sections;

    console.log('\n[CONTEXT-DEPTH] ============ Starting Context-Aware Depth Calculation ============');
    console.log('[CONTEXT-DEPTH] Total sections to process:', sections.length);
    console.log('[CONTEXT-DEPTH] Configured hierarchy levels:', levels?.length || 0);

    // Build hierarchy stack to track parent-child relationships
    const hierarchyStack = [];
    const enrichedSections = [];

    // FIX-4: Expanded type priority map to support 10 levels (depth 0-9)
    // Higher priority = higher in hierarchy
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
      'unnumbered': 0,     // Special
      'preamble': 0        // Special
    };

    console.log('[CONTEXT-DEPTH] Type priority map:', typePriority);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const currentPriority = typePriority[section.type] || 0;

      console.log(`\n[CONTEXT-DEPTH] Processing [${i}]: ${section.citation} (${section.type}, priority=${currentPriority})`);
      console.log(`[CONTEXT-DEPTH]   Title: "${section.title}"`);
      console.log(`[CONTEXT-DEPTH]   Current stack depth: ${hierarchyStack.length}`);
      if (hierarchyStack.length > 0) {
        console.log(`[CONTEXT-DEPTH]   Stack top: ${hierarchyStack[hierarchyStack.length - 1].citation} (${hierarchyStack[hierarchyStack.length - 1].type})`);
      }

      // Pop from stack until we find an appropriate parent
      let popsCount = 0;
      while (hierarchyStack.length > 0) {
        const stackTop = hierarchyStack[hierarchyStack.length - 1];
        const stackPriority = typePriority[stackTop.type] || 0;

        // If current section has higher or equal priority than stack top,
        // pop the stack (we're at same level or moving up the hierarchy)
        if (currentPriority >= stackPriority) {
          hierarchyStack.pop();
          popsCount++;
          console.log(`[CONTEXT-DEPTH]   Popped: ${stackTop.citation} (priority ${stackPriority} <= ${currentPriority})`);
        } else {
          // Found our parent
          console.log(`[CONTEXT-DEPTH]   Found parent: ${stackTop.citation} (priority ${stackPriority} > ${currentPriority})`);
          break;
        }
      }

      if (popsCount > 0) {
        console.log(`[CONTEXT-DEPTH]   Total pops: ${popsCount}, new stack depth: ${hierarchyStack.length}`);
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
        console.log('[CONTEXT-DEPTH]   Article detected - forcing depth to 0');
      } else if (section.type === 'preamble') {
        contextualDepth = 0;
        depthReason = 'preamble-override';
        console.log('[CONTEXT-DEPTH]   Preamble detected - forcing depth to 0');
      }

      // Log the parent relationship
      const parent = hierarchyStack.length > 0 ? hierarchyStack[hierarchyStack.length - 1] : null;
      if (parent) {
        console.log(`[CONTEXT-DEPTH]   Parent: ${parent.citation} at depth ${parent.depth}`);
        console.log(`[CONTEXT-DEPTH]   This section will be child at depth ${contextualDepth}`);
      } else {
        console.log('[CONTEXT-DEPTH]   No parent - this is a root-level section');
      }

      // Create enriched section with contextual depth
      const enrichedSection = {
        ...section,
        depth: contextualDepth,
        contextualDepth: contextualDepth,
        parentPath: hierarchyStack.map(s => s.citation).join(' > '),
        depthCalculationMethod: depthReason
      };

      console.log(`[CONTEXT-DEPTH]   ✓ Assigned depth: ${contextualDepth} (${depthReason})`);
      console.log(`[CONTEXT-DEPTH]   Parent path: "${enrichedSection.parentPath || '(root)'}"}`);

      enrichedSections.push(enrichedSection);

      // Push current section to stack for future children
      hierarchyStack.push(enrichedSection);
      console.log(`[CONTEXT-DEPTH]   Pushed to stack for future children`);
    }

    // FIX-4: Validate depths are within bounds (0-9 for 10 levels)
    // Ensure we support the full 10-level hierarchy as configured
    const maxDepth = Math.max(
      (levels.length > 0) ? levels.length - 1 : 9,
      9 // Always support at least 10 levels (0-9)
    );

    let depthWarnings = 0;
    for (const section of enrichedSections) {
      if (section.depth > maxDepth) {
        console.warn(`[CONTEXT-DEPTH] ⚠️ Section ${section.citation} has depth ${section.depth} exceeding max ${maxDepth}, capping to ${maxDepth}`);
        section.depth = maxDepth;
        section.contextualDepth = maxDepth;
        depthWarnings++;
      }
    }

    // FIX-4: Log warning if no deep hierarchy was found but config supports it
    const actualMaxDepth = Math.max(...enrichedSections.map(s => s.depth || 0));
    if (actualMaxDepth < 3 && levels.length > 4) {
      console.log(`[CONTEXT-DEPTH] ℹ️ Document only uses ${actualMaxDepth + 1} levels, but config supports ${levels.length} levels`);
      console.log('[CONTEXT-DEPTH] This is normal for simple documents. Deeper levels are available if needed.');
    }

    // Generate comprehensive summary
    const depthDistribution = this.getDepthDistribution(enrichedSections);
    console.log('\n[CONTEXT-DEPTH] ============ Depth Calculation Complete ============');
    console.log('[CONTEXT-DEPTH] Summary:');
    console.log('  - Total sections processed:', enrichedSections.length);
    console.log('  - Depth warnings:', depthWarnings);
    console.log('  - Depth distribution:', depthDistribution);
    console.log('  - Max depth used:', Math.max(...Object.keys(depthDistribution).map(Number)));
    console.log('  - Articles (depth 0):', enrichedSections.filter(s => s.type === 'article').length);
    console.log('  - Sections (depth 1+):', enrichedSections.filter(s => s.depth > 0).length);

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
   * Generate preview of parsed sections
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

  /**
   * Validate parsed sections
   */
  validateSections(sections, organizationConfig) {
    const errors = [];

    // Check for empty sections (excluding organizational article containers)
    const emptySections = sections.filter(s => !s.text || s.text.trim() === '');
    const emptyNonContainers = emptySections.filter(s => s.type !== 'article');

    if (emptyNonContainers.length > 0) {
      errors.push({
        type: 'warning',
        message: `${emptyNonContainers.length} sections have no content`,
        sections: emptyNonContainers.map(s => s.citation)
      });
    }

    // Note organizational containers separately (info only, not an error)
    const emptyContainers = emptySections.filter(s => s.type === 'article');
    if (emptyContainers.length > 0) {
      errors.push({
        type: 'info',
        message: `${emptyContainers.length} organizational article containers (contain only sections)`,
        sections: emptyContainers.map(s => s.citation)
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
}

module.exports = new WordParser();
