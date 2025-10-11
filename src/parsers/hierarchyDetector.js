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
          detected.push({
            level: level.name,
            type: level.type,
            number: match[1],
            prefix: level.prefix,
            fullMatch: match[0],
            index: match.index,
            numberingScheme: level.numbering,
            depth: level.depth
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

      // Check for skipped levels (depth jumps by more than 1)
      if (section.depth > prevDepth + 1 && prevDepth >= 0) {
        errors.push({
          section: section.citation || `Section ${i + 1}`,
          error: `Depth jumped from ${prevDepth} to ${section.depth}, skipping level(s)`
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
      errors
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
}

module.exports = new HierarchyDetector();
