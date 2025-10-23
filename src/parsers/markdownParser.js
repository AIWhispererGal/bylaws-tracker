/**
 * Markdown Parser
 * Parses Markdown (.md) files with enhanced Markdown-specific features
 * Extends textParser.js functionality with:
 * - Markdown header detection (# to ######)
 * - Markdown list handling (numbered, lettered, bulleted)
 * - Markdown formatting preservation (bold, italic, links, code)
 * - 10-level hierarchy support (depths 0-9)
 *
 * Architecture: Option A (Extend textParser)
 * - Reuses textParser.parseSections() for proven performance
 * - Adds Markdown-specific preprocessing
 * - Maintains consistent API with wordParser and textParser
 */

const fs = require('fs').promises;
const path = require('path');
const textParser = require('./textParser');
const hierarchyDetector = require('./hierarchyDetector');
const { createClient } = require('@supabase/supabase-js');

class MarkdownParser {
  /**
   * Parse a Markdown document
   * @param {string} filePath - Path to the .md file
   * @param {Object} organizationConfig - Organization configuration
   * @param {string} documentId - Optional document ID for hierarchy override
   * @returns {Promise<Object>} Parse result with sections and metadata
   */
  async parseDocument(filePath, organizationConfig, documentId = null) {
    try {
      console.log('[MarkdownParser] Starting Markdown document parsing...');
      console.log('[MarkdownParser] File:', filePath);

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
            console.warn('[MarkdownParser] Error fetching document hierarchy override:', docError.message);
          } else if (doc?.hierarchy_override) {
            console.log('[MarkdownParser] Using document-specific hierarchy override for document:', documentId);
            organizationConfig = {
              ...organizationConfig,
              hierarchy: doc.hierarchy_override
            };
          }
        } catch (error) {
          console.warn('[MarkdownParser] Failed to check for hierarchy override:', error.message);
        }
      }

      // Read Markdown file as UTF-8 text
      const rawText = await fs.readFile(filePath, 'utf-8');
      console.log('[MarkdownParser] File size:', rawText.length, 'characters');

      // Normalize line endings
      const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Preprocess Markdown: convert headers and lists to hierarchy-friendly format
      const processedText = this.preprocessMarkdown(normalizedText, organizationConfig);

      // Delegate to textParser for section parsing (proven algorithm)
      console.log('[MarkdownParser] Delegating to textParser.parseSections()...');
      const sections = await textParser.parseSections(processedText, organizationConfig);

      // Post-process to restore Markdown formatting in content
      const enhancedSections = this.preserveMarkdownFormatting(sections, normalizedText);

      // Validate Markdown-specific features
      const validation = this.validateMarkdownStructure(enhancedSections, normalizedText);
      if (validation.warnings.length > 0) {
        console.warn('[MarkdownParser] Warnings:', validation.warnings);
      }

      console.log('[MarkdownParser] ✓ Parsing complete');
      console.log('[MarkdownParser] Total sections:', enhancedSections.length);
      console.log('[MarkdownParser] Depth range:', this.getDepthRange(enhancedSections));

      return {
        success: true,
        sections: enhancedSections,
        metadata: {
          source: 'markdown',
          fileName: path.basename(filePath),
          parsedAt: new Date().toISOString(),
          sectionCount: enhancedSections.length,
          markdownFeatures: {
            headers: this.countMarkdownHeaders(normalizedText),
            lists: this.countMarkdownLists(normalizedText),
            links: this.countMarkdownLinks(normalizedText),
            codeBlocks: this.countCodeBlocks(normalizedText)
          }
        }
      };
    } catch (error) {
      console.error('[MarkdownParser] Error parsing Markdown document:', error);
      return {
        success: false,
        error: error.message,
        sections: []
      };
    }
  }

  /**
   * Preprocess Markdown: Convert Markdown syntax to hierarchy-friendly format
   * Key transformations:
   * - # Header → ARTICLE (if matches prefix)
   * - ## Header → Section (if matches prefix)
   * - ### Header → Subsection (if matches prefix)
   * - Numbered lists: 1., 2., 3. → preserved
   * - Lettered lists: a., b., c. → preserved
   * - Bullet lists: -, *, + → converted to numbered if nested
   * - Parenthetical lists: (a), (1) → preserved
   */
  preprocessMarkdown(text, organizationConfig) {
    console.log('\n[MarkdownParser] Starting Markdown preprocessing...');

    const lines = text.split('\n');
    const processedLines = [];
    const levels = organizationConfig?.hierarchy?.levels || [];

    console.log('[MarkdownParser] Configured hierarchy levels:', levels.length);

    // Build prefix lookup for fast matching
    const prefixMap = new Map();
    for (const level of levels) {
      const normalizedPrefix = level.prefix.trim().toLowerCase();
      prefixMap.set(normalizedPrefix, level);
    }

    let inCodeBlock = false;
    let listDepth = 0;
    let listCounters = new Map(); // Track list numbering by depth

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let processedLine = line;

      // Skip code blocks (preserve verbatim)
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        processedLines.push(line);
        continue;
      }
      if (inCodeBlock) {
        processedLines.push(line);
        continue;
      }

      // Process Markdown headers (# to ######)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const headerLevel = headerMatch[1].length;
        const content = headerMatch[2].trim();

        console.log(`[MarkdownParser] Found ${headerLevel}-level header: "${content.substring(0, 50)}..."`);

        // Check if content starts with any configured prefix
        let matched = false;
        for (const [normalizedPrefix, level] of prefixMap.entries()) {
          if (content.toLowerCase().startsWith(normalizedPrefix)) {
            // Remove # prefix, keep content
            processedLine = content;
            matched = true;
            console.log(`[MarkdownParser]   → Matched prefix "${level.prefix}", removed # markers`);
            break;
          }
        }

        if (!matched) {
          // Header doesn't match organization prefix - keep as-is for now
          // hierarchyDetector might still find patterns in it
          console.log(`[MarkdownParser]   → No prefix match, keeping header for pattern detection`);
        }
      }

      // Process Markdown lists
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.|[a-z]\.|[A-Z]\.|\([a-z]\)|\(\d+\))\s+(.+)$/);
      if (listMatch) {
        const indent = listMatch[1];
        const marker = listMatch[2];
        const content = listMatch[3];

        // Calculate list depth from indentation
        const currentDepth = Math.floor(indent.length / 2);

        // Reset list counters when depth changes
        if (currentDepth !== listDepth) {
          if (currentDepth > listDepth) {
            // Going deeper
            listCounters.set(currentDepth, 1);
          } else {
            // Going shallower - clear deeper levels
            for (let d = currentDepth + 1; d <= 10; d++) {
              listCounters.delete(d);
            }
          }
          listDepth = currentDepth;
        }

        // Handle different list markers
        if (marker.match(/^\d+\.$/)) {
          // Numbered list: 1., 2., 3. → keep as-is
          processedLine = line;
        } else if (marker.match(/^[a-z]\.$/)) {
          // Lettered list (lowercase): a., b., c. → keep as-is
          processedLine = line;
        } else if (marker.match(/^[A-Z]\.$/)) {
          // Lettered list (uppercase): A., B., C. → keep as-is
          processedLine = line;
        } else if (marker.match(/^\([a-z]\)$/) || marker.match(/^\(\d+\)$/)) {
          // Parenthetical: (a), (1) → keep as-is
          processedLine = line;
        } else if (marker.match(/^[-*+]$/)) {
          // Bullet point: convert to numbered based on depth
          const counter = listCounters.get(currentDepth) || 1;
          processedLine = `${indent}${counter}. ${content}`;
          listCounters.set(currentDepth, counter + 1);
          console.log(`[MarkdownParser] Converted bullet to numbered: "${marker}" → "${counter}."`);
        }
      } else {
        // Reset list tracking when not in list
        listDepth = 0;
        listCounters.clear();
      }

      processedLines.push(processedLine);
    }

    const result = processedLines.join('\n');
    console.log('[MarkdownParser] Preprocessing complete');
    console.log('[MarkdownParser] Processed', lines.length, 'lines');
    console.log('[MarkdownParser] ==========================================\n');

    return result;
  }

  /**
   * Preserve Markdown formatting in section content
   * Maintains: **bold**, *italic*, `code`, [links](url), etc.
   * Note: This is already preserved by textParser, but we add extra validation
   */
  preserveMarkdownFormatting(sections, originalText) {
    console.log('[MarkdownParser] Validating Markdown formatting preservation...');

    for (const section of sections) {
      if (!section.text) continue;

      // Verify formatting is preserved (textParser already does this)
      const hasBold = section.text.includes('**');
      const hasItalic = section.text.includes('*') || section.text.includes('_');
      const hasCode = section.text.includes('`');
      const hasLink = section.text.includes('[') && section.text.includes('](');

      if (hasBold || hasItalic || hasCode || hasLink) {
        section.markdownFormatting = {
          bold: hasBold,
          italic: hasItalic,
          code: hasCode,
          links: hasLink
        };
      }
    }

    console.log('[MarkdownParser] Formatting validation complete');
    return sections;
  }

  /**
   * Validate Markdown-specific structure
   */
  validateMarkdownStructure(sections, originalText) {
    const warnings = [];
    const errors = [];

    // Check for common Markdown issues
    const lines = originalText.split('\n');

    // Detect unprocessed headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^#{1,6}\s+/)) {
        const headerText = line.replace(/^#{1,6}\s+/, '').trim();
        // Check if this header was captured as a section
        const captured = sections.some(s =>
          s.title && s.title.toLowerCase().includes(headerText.toLowerCase().substring(0, 20))
        );
        if (!captured) {
          warnings.push({
            type: 'uncaptured_header',
            line: i + 1,
            content: headerText.substring(0, 50)
          });
        }
      }
    }

    // Check for very deep list nesting (>10 levels)
    let maxListDepth = 0;
    for (const line of lines) {
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.|[a-z]\.)/);
      if (listMatch) {
        const depth = Math.floor(listMatch[1].length / 2);
        maxListDepth = Math.max(maxListDepth, depth);
      }
    }

    if (maxListDepth > 9) {
      warnings.push({
        type: 'deep_nesting',
        message: `List nesting depth ${maxListDepth} exceeds recommended maximum of 10`,
        maxDepth: maxListDepth
      });
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Count Markdown headers in text
   */
  countMarkdownHeaders(text) {
    const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
    const lines = text.split('\n');
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      const match = line.match(/^(#{1,6})\s/);
      if (match) {
        const level = match[1].length;
        counts[`h${level}`]++;
      }
    }

    return counts;
  }

  /**
   * Count Markdown lists in text
   */
  countMarkdownLists(text) {
    const counts = { ordered: 0, unordered: 0, lettered: 0, parenthetical: 0 };
    const lines = text.split('\n');
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      if (line.match(/^\s*\d+\.\s/)) counts.ordered++;
      else if (line.match(/^\s*[-*+]\s/)) counts.unordered++;
      else if (line.match(/^\s*[a-zA-Z]\.\s/)) counts.lettered++;
      else if (line.match(/^\s*\([a-z0-9]+\)\s/)) counts.parenthetical++;
    }

    return counts;
  }

  /**
   * Count Markdown links in text
   */
  countMarkdownLinks(text) {
    const inlineLinks = (text.match(/\[.+?\]\(.+?\)/g) || []).length;
    const referenceLinks = (text.match(/\[.+?\]\[.+?\]/g) || []).length;
    return { inline: inlineLinks, reference: referenceLinks, total: inlineLinks + referenceLinks };
  }

  /**
   * Count code blocks in text
   */
  countCodeBlocks(text) {
    const fenced = (text.match(/```/g) || []).length / 2;
    const inline = (text.match(/`[^`]+`/g) || []).length;
    return { fenced, inline, total: fenced + inline };
  }

  /**
   * Get depth range from sections
   */
  getDepthRange(sections) {
    if (sections.length === 0) return { min: 0, max: 0 };
    const depths = sections.map(s => s.depth || 0);
    return {
      min: Math.min(...depths),
      max: Math.max(...depths),
      unique: [...new Set(depths)].sort((a, b) => a - b)
    };
  }

  /**
   * Generate preview of parsed sections
   * Identical to wordParser/textParser implementation
   */
  generatePreview(sections, maxSections = 5) {
    return {
      totalSections: sections.length,
      preview: sections.slice(0, maxSections).map(section => ({
        citation: section.citation,
        title: section.title,
        type: section.type,
        depth: section.depth,
        markdownFormatting: section.markdownFormatting || null,
        textPreview: section.text
          ? section.text.substring(0, 100) + (section.text.length > 100 ? '...' : '')
          : '(Empty)'
      }))
    };
  }

  /**
   * Validate parsed sections
   * Reuses textParser validation with Markdown enhancements
   */
  validateSections(sections, organizationConfig) {
    // Use textParser validation as base
    const baseValidation = textParser.validateSections(sections, organizationConfig);

    // Add Markdown-specific validation
    const markdownWarnings = [];

    // Check for sections with Markdown formatting
    const formattedSections = sections.filter(s => s.markdownFormatting);
    if (formattedSections.length > 0) {
      markdownWarnings.push({
        type: 'info',
        message: `${formattedSections.length} sections contain Markdown formatting (preserved)`
      });
    }

    return {
      valid: baseValidation.valid,
      warnings: [...baseValidation.warnings, ...markdownWarnings],
      errors: baseValidation.errors
    };
  }
}

module.exports = new MarkdownParser();
