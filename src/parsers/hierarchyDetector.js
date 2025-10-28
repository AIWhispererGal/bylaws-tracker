/**
 * Hierarchy Detector
 * Intelligently detects document structure and numbering patterns
 */

const numberingSchemes = require('./numberingSchemes');

class HierarchyDetector {
  /**
   * Detect hierarchy from text
   */
  detectHierarchy(text, organizationConfig) {
    const levels = organizationConfig.hierarchy?.levels || [];
    const detected = [];

    for (const level of levels) {
      // Build detection pattern for this level
      const patterns = this.buildDetectionPatterns(level);

      for (const pattern of patterns) {
        const matches = text.matchAll(pattern.regex);

        for (const match of matches) {
          // Calculate line number and context for filtering
          const lineNumber = this.getLineNumber(text, match.index);
          const lineText = this.getLineText(text, match.index);

          detected.push({
            level: level.name,
            type: level.type,
            number: match[1],
            prefix: level.prefix,
            fullMatch: match[0],
            index: match.index,
            numberingScheme: level.numbering,
            depth: level.depth,
            // Context metadata for false positive filtering
            lineNumber: lineNumber,
            lineText: lineText.trim(),
            patternVariant: pattern.variant || 'prefixed'
          });
        }
      }
    }

    // Sort by position in text
    return detected.sort((a, b) => a.index - b.index);
  }

  /**
   * Build detection patterns for a hierarchy level
   */
  buildDetectionPatterns(level) {
    const patterns = [];

    // Handle missing/empty prefix - generate line-start patterns
    if (!level.prefix || level.prefix.trim() === '') {
      console.log(`[HierarchyDetector] Level ${level.type} has empty prefix, using line-start patterns`);

      // Generate line-start patterns based on numbering scheme
      switch (level.numbering) {
        case 'numeric':
          // Line-start: "1. " (requires text after to avoid false positives from tables)
          patterns.push({
            regex: new RegExp(`^\\s*(\\d+)\\.\\s+(?=\\w)`, 'gm'),
            scheme: 'numeric',
            variant: 'line-start'
          });
          // Parenthetical: "(1)"
          patterns.push({
            regex: new RegExp(`\\(\\s*(\\d+)\\s*\\)`, 'g'),
            scheme: 'numeric',
            variant: 'parenthetical'
          });
          break;

        case 'alpha':
          // Line-start: "A. " (requires text after to avoid false positives)
          patterns.push({
            regex: new RegExp(`^\\s*([A-Z])\\.\\s+(?=\\w)`, 'gm'),
            scheme: 'alpha',
            variant: 'line-start'
          });
          // Parenthetical: "(A)"
          patterns.push({
            regex: new RegExp(`\\(\\s*([A-Z])\\s*\\)`, 'g'),
            scheme: 'alpha',
            variant: 'parenthetical'
          });
          break;

        case 'alphaLower':
          // Line-start: "a. " (requires text after to avoid false positives)
          patterns.push({
            regex: new RegExp(`^\\s*([a-z])\\.\\s+(?=\\w)`, 'g'),
            scheme: 'alphaLower',
            variant: 'line-start'
          });
          // Parenthetical: "(a)"
          patterns.push({
            regex: new RegExp(`\\(\\s*([a-z])\\s*\\)`, 'g'),
            scheme: 'alphaLower',
            variant: 'parenthetical'
          });
          break;

        case 'roman':
          // Line-start: "i. ", "I. " (requires text after to avoid false positives)
          patterns.push({
            regex: new RegExp(`^\\s*([IVXivx]+)\\.\\s+(?=\\w)`, 'gmi'),
            scheme: 'roman',
            variant: 'line-start'
          });
          // Parenthetical: "(i)", "(I)"
          patterns.push({
            regex: new RegExp(`\\(\\s*([IVXivx]+)\\s*\\)`, 'gi'),
            scheme: 'roman',
            variant: 'parenthetical'
          });
          break;

        default:
          // Generic pattern for unknown schemes
          patterns.push({
            regex: new RegExp(`^\\s*([\\w]+)\\.\\s+`, 'gmi'),
            scheme: 'generic',
            variant: 'line-start'
          });
      }

      return patterns;
    }

    // Remove trailing whitespace from prefix and escape
    const trimmedPrefix = level.prefix.trimEnd();
    const escapedPrefix = this.escapeRegex(trimmedPrefix);

    // Allow flexible whitespace after prefix (space, tab, or none)
    // This handles variations like "Article I", "ARTICLE\tI", "Section 1:", etc.
    const whitespacePattern = '\\s*';

    switch (level.numbering) {
      case 'roman':
        // Match Roman numerals: I, II, III, IV, V, etc.
        patterns.push({
          regex: new RegExp(
            `${escapedPrefix}${whitespacePattern}([IVXLCDMivxlcdm]+)(?:\\s|\\.|:|$)`,
            'gi'
          ),
          scheme: 'roman'
        });
        break;

      case 'numeric':
        // Match numbers: 1, 2, 3, etc.
        patterns.push({
          regex: new RegExp(
            `${escapedPrefix}${whitespacePattern}(\\d+)(?:\\s|\\.|:|$)`,
            'gi'
          ),
          scheme: 'numeric'
        });
        break;

      case 'alpha':
        // Match uppercase letters: A, B, C, etc.
        patterns.push({
          regex: new RegExp(
            `${escapedPrefix}${whitespacePattern}([A-Z]+)(?:\\s|\\.|:|$)`,
            'g'
          ),
          scheme: 'alpha'
        });
        break;

      case 'alphaLower':
        // Match lowercase letters: a, b, c, etc.
        patterns.push({
          regex: new RegExp(
            `${escapedPrefix}${whitespacePattern}([a-z]+)(?:\\s|\\.|:|$)`,
            'g'
          ),
          scheme: 'alphaLower'
        });
        break;

      default:
        // Generic pattern - match any word characters
        patterns.push({
          regex: new RegExp(
            `${escapedPrefix}${whitespacePattern}([\\w]+)(?:\\s|\\.|:|$)`,
            'gi'
          ),
          scheme: 'generic'
        });
    }

    return patterns;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Parse number from string based on scheme
   */
  parseNumber(numberStr, scheme) {
    switch (scheme) {
      case 'roman':
        return numberingSchemes.fromRoman(numberStr.toUpperCase());

      case 'alpha':
        return numberingSchemes.fromAlpha(numberStr, false);

      case 'alphaLower':
        return numberingSchemes.fromAlpha(numberStr, true);

      case 'numeric':
      default:
        return parseInt(numberStr, 10) || 0;
    }
  }

  /**
   * Infer hierarchy from section patterns
   * Used when no configuration is provided
   */
  inferHierarchy(text) {
    const patterns = [
      {
        name: 'Article',
        type: 'article',
        regex: /ARTICLE\s+([IVX]+)/gi,
        numbering: 'roman',
        prefix: 'ARTICLE ',
        depth: 0
      },
      {
        name: 'Chapter',
        type: 'chapter',
        regex: /CHAPTER\s+(\d+)/gi,
        numbering: 'numeric',
        prefix: 'CHAPTER ',
        depth: 0
      },
      {
        name: 'Section',
        type: 'section',
        regex: /Section\s+(\d+)/gi,
        numbering: 'numeric',
        prefix: 'Section ',
        depth: 1
      },
      {
        name: 'Subsection',
        type: 'subsection',
        regex: /\(([a-z])\)/gi,
        numbering: 'alphaLower',
        prefix: '(',
        depth: 2
      },
      {
        name: 'Paragraph',
        type: 'paragraph',
        regex: /\((\d+)\)/gi,
        numbering: 'numeric',
        prefix: '(',
        depth: 3
      }
    ];

    const detected = [];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern.regex);

      for (const match of matches) {
        detected.push({
          level: pattern.name,
          type: pattern.type,
          number: match[1],
          prefix: pattern.prefix,
          fullMatch: match[0],
          index: match.index,
          numberingScheme: pattern.numbering,
          depth: pattern.depth
        });
      }
    }

    return detected.sort((a, b) => a.index - b.index);
  }

  /**
   * Build hierarchy tree from flat list
   */
  buildHierarchyTree(sections) {
    const tree = [];
    const stack = [];

    for (const section of sections) {
      // Find parent based on depth
      while (stack.length > 0 && stack[stack.length - 1].depth >= section.depth) {
        stack.pop();
      }

      const parent = stack.length > 0 ? stack[stack.length - 1] : null;

      const node = {
        ...section,
        parent_section_id: parent ? parent.id : null,
        children: []
      };

      if (parent) {
        parent.children.push(node);
      } else {
        tree.push(node);
      }

      stack.push(node);
    }

    return tree;
  }

  /**
   * Validate hierarchy structure
   */
  validateHierarchy(sections, organizationConfig) {
    const errors = [];
    const warnings = [];
    const levels = organizationConfig.hierarchy?.levels || [];
    const maxDepth = organizationConfig.hierarchy?.maxDepth || 10;

    // Track depth progression
    let prevDepth = -1;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      // Check maximum depth
      if (section.depth > maxDepth) {
        errors.push({
          section: section.citation || `Section ${i + 1}`,
          error: `Depth ${section.depth} exceeds maximum of ${maxDepth}`
        });
      }

      // ✅ FIX: Depth jumps are VALID in real documents! Changed to WARNING.
      // Example: Article (depth 0) can have deeply nested item (depth 4) - that's OK!
      if (section.depth > prevDepth + 1 && prevDepth >= 0) {
        warnings.push({
          section: section.citation || `Section ${i + 1}`,
          message: `Depth jumped from ${prevDepth} to ${section.depth} (unusual structure but allowed)`,
          type: 'depth_jump'
        });
      }

      // Check if depth has a corresponding level definition
      const levelDef = levels.find(l => l.depth === section.depth);
      if (!levelDef) {
        errors.push({
          section: section.citation || `Section ${i + 1}`,
          error: `No level definition found for depth ${section.depth}`
        });
      }

      // Validate numbering format (skip special sections like preambles)
      if (levelDef && section.number && section.type !== 'preamble') {
        const isValid = this.validateNumberFormat(
          section.number,
          levelDef.numbering
        );

        if (!isValid) {
          errors.push({
            section: section.citation || `Section ${i + 1}`,
            error: `Number '${section.number}' doesn't match expected format '${levelDef.numbering}'`
          });
        }
      }

      prevDepth = section.depth;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate number format against scheme
   */
  validateNumberFormat(number, scheme) {
    const cleanNumber = String(number).trim();

    switch (scheme) {
      case 'roman':
        return /^[IVXLCDMivxlcdm]+$/.test(cleanNumber);

      case 'numeric':
        return /^\d+$/.test(cleanNumber);

      case 'alpha':
        return /^[A-Z]+$/.test(cleanNumber);

      case 'alphaLower':
        return /^[a-z]+$/.test(cleanNumber);

      default:
        return true; // Unknown scheme, skip validation
    }
  }

  /**
   * Suggest hierarchy configuration from detected patterns
   */
  suggestHierarchyConfig(detectedItems) {
    const levelMap = new Map();

    // Group by level type and determine depth
    for (const item of detectedItems) {
      if (!levelMap.has(item.type)) {
        levelMap.set(item.type, {
          name: item.level,
          type: item.type,
          numbering: item.numberingScheme,
          prefix: item.prefix,
          examples: []
        });
      }

      const level = levelMap.get(item.type);
      if (level.examples.length < 3) {
        level.examples.push(item.number);
      }
    }

    // Assign depths based on order of appearance
    const levels = Array.from(levelMap.values());
    levels.forEach((level, index) => {
      level.depth = index;
    });

    return {
      levels,
      maxDepth: levels.length,
      allowNesting: true,
      detectedPatterns: detectedItems.length
    };
  }

  /**
   * Get line number from character index
   * @param {string} text - Full document text
   * @param {number} charIndex - Character position in text
   * @returns {number} Line number (1-indexed)
   */
  getLineNumber(text, charIndex) {
    return text.substring(0, charIndex).split('\n').length;
  }

  /**
   * Get full line text containing character index
   * @param {string} text - Full document text
   * @param {number} charIndex - Character position in text
   * @returns {string} The complete line containing the character
   */
  getLineText(text, charIndex) {
    const lines = text.split('\n');
    let currentPos = 0;

    for (const line of lines) {
      if (charIndex >= currentPos && charIndex < currentPos + line.length) {
        return line;
      }
      currentPos += line.length + 1; // +1 for newline
    }

    return '';
  }
}

module.exports = new HierarchyDetector();
