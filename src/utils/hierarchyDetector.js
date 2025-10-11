/**
 * Smart Hierarchy Detection Algorithm
 * Recognizes 10 levels of document structure with various numbering patterns
 */

/**
 * Numbering pattern types and their regex patterns
 */
const NUMBERING_PATTERNS = {
  // Roman numerals (uppercase): I, II, III, IV, V, VI, VII, VIII, IX, X, etc.
  ROMAN_UPPER: {
    regex: /^([IVXLCDM]+)\.\s*/,
    parse: (text) => {
      const match = text.match(/^([IVXLCDM]+)\.\s*/);
      return match ? { type: 'ROMAN_UPPER', value: match[1], rawText: match[0] } : null;
    },
    level: 0 // Base level, can be adjusted based on context
  },

  // Roman numerals (lowercase): i, ii, iii, iv, v, vi, vii, viii, ix, x, etc.
  ROMAN_LOWER: {
    regex: /^([ivxlcdm]+)\.\s*/,
    parse: (text) => {
      const match = text.match(/^([ivxlcdm]+)\.\s*/);
      return match ? { type: 'ROMAN_LOWER', value: match[1], rawText: match[0] } : null;
    },
    level: 5 // Typically deeper level
  },

  // Arabic numbers: 1, 2, 3, etc.
  ARABIC: {
    regex: /^(\d+)\.\s*/,
    parse: (text) => {
      const match = text.match(/^(\d+)\.\s*/);
      return match ? { type: 'ARABIC', value: parseInt(match[1]), rawText: match[0] } : null;
    },
    level: 1
  },

  // Uppercase letters: A, B, C, etc.
  LETTER_UPPER: {
    regex: /^([A-Z])\.\s*/,
    parse: (text) => {
      const match = text.match(/^([A-Z])\.\s*/);
      return match ? { type: 'LETTER_UPPER', value: match[1], rawText: match[0] } : null;
    },
    level: 2
  },

  // Lowercase letters: a, b, c, etc.
  LETTER_LOWER: {
    regex: /^([a-z])\.\s*/,
    parse: (text) => {
      const match = text.match(/^([a-z])\.\s*/);
      return match ? { type: 'LETTER_LOWER', value: match[1], rawText: match[0] } : null;
    },
    level: 4
  },

  // Nested decimal: 1.1, 1.2, 1.1.1, etc.
  DECIMAL_NESTED: {
    regex: /^(\d+(?:\.\d+)+)\.\s*/,
    parse: (text) => {
      const match = text.match(/^(\d+(?:\.\d+)+)\.\s*/);
      if (match) {
        const parts = match[1].split('.');
        return {
          type: 'DECIMAL_NESTED',
          value: match[1],
          depth: parts.length,
          rawText: match[0]
        };
      }
      return null;
    },
    level: (depth) => depth // Dynamic level based on nesting depth
  },

  // Mixed format: A.1, A.1.a, etc.
  MIXED_FORMAT: {
    regex: /^([A-Z]\.\d+(?:\.[a-z])?)\s*/,
    parse: (text) => {
      const match = text.match(/^([A-Z]\.\d+(?:\.[a-z])?)\s*/);
      if (match) {
        const parts = match[1].split('.');
        return {
          type: 'MIXED_FORMAT',
          value: match[1],
          depth: parts.length,
          rawText: match[0]
        };
      }
      return null;
    },
    level: (depth) => depth + 1
  },

  // Parenthesized numbers: (1), (2), (3), etc.
  PAREN_ARABIC: {
    regex: /^\((\d+)\)\s*/,
    parse: (text) => {
      const match = text.match(/^\((\d+)\)\s*/);
      return match ? { type: 'PAREN_ARABIC', value: parseInt(match[1]), rawText: match[0] } : null;
    },
    level: 3
  },

  // Parenthesized letters: (a), (b), (c), etc.
  PAREN_LETTER: {
    regex: /^\(([a-z])\)\s*/,
    parse: (text) => {
      const match = text.match(/^\(([a-z])\)\s*/);
      return match ? { type: 'PAREN_LETTER', value: match[1], rawText: match[0] } : null;
    },
    level: 6
  }
};

/**
 * Style indicators for hierarchy levels
 */
const STYLE_INDICATORS = {
  heading: /^heading\s*(\d+)$/i,
  bold: 'bold',
  fontSize: 'fontSize',
  indentation: 'indentation'
};

/**
 * Roman numeral conversion utilities
 */
const ROMAN_VALUES = {
  'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000,
  'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
};

/**
 * Convert Roman numeral to Arabic number
 * @param {string} roman - Roman numeral string
 * @returns {number} - Arabic number value
 */
function romanToArabic(roman) {
  if (!roman) return 0;

  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = ROMAN_VALUES[roman[i]];
    const next = ROMAN_VALUES[roman[i + 1]];

    if (next && current < next) {
      result -= current;
    } else {
      result += current;
    }
  }
  return result;
}

/**
 * Convert letter to numeric position (A=1, B=2, etc.)
 * @param {string} letter - Single letter
 * @returns {number} - Position value
 */
function letterToNumber(letter) {
  if (!letter) return 0;
  const code = letter.toUpperCase().charCodeAt(0);
  return code - 64; // A=1, B=2, etc.
}

/**
 * Parse numbering style from text
 * @param {string} text - Text to analyze
 * @returns {Object|null} - Parsed numbering information
 */
function parseNumberingStyle(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmedText = text.trim();

  // Try each pattern in order of specificity (most specific first)
  const patterns = [
    NUMBERING_PATTERNS.DECIMAL_NESTED,
    NUMBERING_PATTERNS.MIXED_FORMAT,
    NUMBERING_PATTERNS.PAREN_ARABIC,
    NUMBERING_PATTERNS.PAREN_LETTER,
    NUMBERING_PATTERNS.ROMAN_UPPER,
    NUMBERING_PATTERNS.ROMAN_LOWER,
    NUMBERING_PATTERNS.LETTER_UPPER,
    NUMBERING_PATTERNS.LETTER_LOWER,
    NUMBERING_PATTERNS.ARABIC
  ];

  for (const pattern of patterns) {
    const parsed = pattern.parse(trimmedText);
    if (parsed) {
      // Calculate numeric value for ordering
      let numericValue = 0;
      switch (parsed.type) {
        case 'ROMAN_UPPER':
        case 'ROMAN_LOWER':
          numericValue = romanToArabic(parsed.value);
          break;
        case 'LETTER_UPPER':
        case 'LETTER_LOWER':
        case 'PAREN_LETTER':
          numericValue = letterToNumber(parsed.value);
          break;
        case 'ARABIC':
        case 'PAREN_ARABIC':
          numericValue = parsed.value;
          break;
        case 'DECIMAL_NESTED':
        case 'MIXED_FORMAT':
          // For nested, use the last component
          const parts = parsed.value.split('.');
          const lastPart = parts[parts.length - 1];
          numericValue = parseInt(lastPart) || letterToNumber(lastPart) || 0;
          break;
      }

      return {
        ...parsed,
        numericValue,
        baseLevel: typeof pattern.level === 'function' ?
          pattern.level(parsed.depth) : pattern.level
      };
    }
  }

  return null;
}

/**
 * Analyze style attributes to determine hierarchy level
 * @param {Object} style - Style object with properties like fontSize, bold, etc.
 * @param {number} indentation - Indentation level (pixels, tabs, or spaces)
 * @returns {number} - Style-based hierarchy level (0-9)
 */
function analyzeStyleLevel(style = {}, indentation = 0) {
  let level = 0;

  // Check for heading style (highest priority)
  if (style.heading) {
    const headingMatch = style.heading.match(STYLE_INDICATORS.heading);
    if (headingMatch) {
      const headingLevel = parseInt(headingMatch[1]);
      if (headingLevel >= 1 && headingLevel <= 10) {
        return headingLevel - 1; // Convert to 0-based index
      }
    }
  }

  // Font size based hierarchy
  if (style.fontSize) {
    const fontSize = parseFloat(style.fontSize);
    if (fontSize >= 24) level = 0;
    else if (fontSize >= 20) level = 1;
    else if (fontSize >= 18) level = 2;
    else if (fontSize >= 16) level = 3;
    else if (fontSize >= 14) level = 4;
    else if (fontSize >= 12) level = 5;
    else level = 6;
  }

  // Bold text might indicate higher level
  if (style.bold && level > 0) {
    level = Math.max(0, level - 1);
  }

  // Indentation increases level
  if (indentation > 0) {
    // Assume each 20px or 1 tab = 1 level increase
    const indentLevels = Math.floor(indentation / 20);
    level = Math.min(9, level + indentLevels);
  }

  return Math.min(9, Math.max(0, level));
}

/**
 * Detect hierarchy level from text, style, and indentation
 * @param {string} text - Text content to analyze
 * @param {Object} style - Style attributes
 * @param {number} indentation - Indentation level
 * @returns {number} - Detected hierarchy level (0-9)
 */
function detectHierarchyLevel(text, style = {}, indentation = 0) {
  // First, try to parse numbering
  const numbering = parseNumberingStyle(text);

  // If we have numbering, use its base level
  if (numbering) {
    let level = numbering.baseLevel;

    // Adjust based on indentation if present
    if (indentation > 0) {
      const indentLevels = Math.floor(indentation / 20);
      level = Math.min(9, level + indentLevels);
    }

    return Math.min(9, Math.max(0, level));
  }

  // Fall back to style-based detection
  return analyzeStyleLevel(style, indentation);
}

/**
 * Build a hierarchical tree structure from paragraphs
 * @param {Array} paragraphs - Array of paragraph objects with text, style, and indentation
 * @returns {Object} - Tree structure representing the document hierarchy
 */
function buildSectionTree(paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return { root: [], metadata: { totalLevels: 0, patterns: [] } };
  }

  const root = [];
  const stack = [{ level: -1, children: root }];
  const patterns = new Set();
  let maxLevel = 0;

  paragraphs.forEach((para, index) => {
    const { text, style = {}, indentation = 0 } = para;
    const level = detectHierarchyLevel(text, style, indentation);
    const numbering = parseNumberingStyle(text);

    if (numbering) {
      patterns.add(numbering.type);
    }

    maxLevel = Math.max(maxLevel, level);

    const node = {
      id: index,
      text: text,
      level: level,
      numbering: numbering,
      style: style,
      indentation: indentation,
      children: []
    };

    // Find the appropriate parent
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    // Add to parent's children
    stack[stack.length - 1].children.push(node);

    // Push current node to stack for potential children
    stack.push(node);
  });

  return {
    root: root,
    metadata: {
      totalLevels: maxLevel + 1,
      patterns: Array.from(patterns),
      totalNodes: paragraphs.length
    }
  };
}

/**
 * Validate section numbering sequence
 * @param {Array} nodes - Array of nodes at the same level
 * @returns {Object} - Validation result with errors and warnings
 */
function validateNumberingSequence(nodes) {
  const errors = [];
  const warnings = [];

  if (!nodes || nodes.length === 0) {
    return { valid: true, errors, warnings };
  }

  // Group by numbering type
  const typeGroups = {};
  nodes.forEach((node, index) => {
    if (node.numbering) {
      const type = node.numbering.type;
      if (!typeGroups[type]) {
        typeGroups[type] = [];
      }
      typeGroups[type].push({ node, index });
    }
  });

  // Check each type group for sequence
  Object.entries(typeGroups).forEach(([type, group]) => {
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1].node.numbering;
      const curr = group[i].node.numbering;

      if (curr.numericValue !== prev.numericValue + 1) {
        warnings.push({
          type: 'SEQUENCE_GAP',
          message: `Numbering gap detected: ${prev.value} → ${curr.value}`,
          indices: [group[i - 1].index, group[i].index]
        });
      }
    }
  });

  // Check for mixed numbering styles at same level
  if (Object.keys(typeGroups).length > 1) {
    warnings.push({
      type: 'MIXED_STYLES',
      message: `Multiple numbering styles at same level: ${Object.keys(typeGroups).join(', ')}`,
      styles: Object.keys(typeGroups)
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get section path from root to node
 * @param {Object} tree - Document tree
 * @param {number} nodeId - Node ID to find
 * @returns {Array} - Array of nodes from root to target
 */
function getSectionPath(tree, nodeId) {
  const path = [];

  function traverse(nodes, currentPath) {
    for (const node of nodes) {
      const newPath = [...currentPath, node];

      if (node.id === nodeId) {
        path.push(...newPath);
        return true;
      }

      if (node.children && node.children.length > 0) {
        if (traverse(node.children, newPath)) {
          return true;
        }
      }
    }
    return false;
  }

  traverse(tree.root, []);
  return path;
}

module.exports = {
  detectHierarchyLevel,
  parseNumberingStyle,
  buildSectionTree,
  validateNumberingSequence,
  getSectionPath,
  romanToArabic,
  letterToNumber,
  NUMBERING_PATTERNS
};
