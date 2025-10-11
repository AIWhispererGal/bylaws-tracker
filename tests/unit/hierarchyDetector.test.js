/**
 * Tests for Smart Hierarchy Detection Algorithm
 */

const {
  detectHierarchyLevel,
  parseNumberingStyle,
  buildSectionTree,
  validateNumberingSequence,
  getSectionPath,
  romanToArabic,
  letterToNumber,
  NUMBERING_PATTERNS
} = require('../../src/utils/hierarchyDetector');

describe('Smart Hierarchy Detection Algorithm', () => {

  describe('romanToArabic', () => {
    test('should convert basic Roman numerals', () => {
      expect(romanToArabic('I')).toBe(1);
      expect(romanToArabic('II')).toBe(2);
      expect(romanToArabic('III')).toBe(3);
      expect(romanToArabic('IV')).toBe(4);
      expect(romanToArabic('V')).toBe(5);
      expect(romanToArabic('IX')).toBe(9);
      expect(romanToArabic('X')).toBe(10);
    });

    test('should convert complex Roman numerals', () => {
      expect(romanToArabic('XIV')).toBe(14);
      expect(romanToArabic('XIX')).toBe(19);
      expect(romanToArabic('XXIV')).toBe(24);
      expect(romanToArabic('XL')).toBe(40);
      expect(romanToArabic('L')).toBe(50);
      expect(romanToArabic('XC')).toBe(90);
      expect(romanToArabic('C')).toBe(100);
    });

    test('should handle lowercase Roman numerals', () => {
      expect(romanToArabic('i')).toBe(1);
      expect(romanToArabic('iv')).toBe(4);
      expect(romanToArabic('x')).toBe(10);
    });

    test('should handle empty or null input', () => {
      expect(romanToArabic('')).toBe(0);
      expect(romanToArabic(null)).toBe(0);
    });
  });

  describe('letterToNumber', () => {
    test('should convert uppercase letters to numbers', () => {
      expect(letterToNumber('A')).toBe(1);
      expect(letterToNumber('B')).toBe(2);
      expect(letterToNumber('C')).toBe(3);
      expect(letterToNumber('Z')).toBe(26);
    });

    test('should convert lowercase letters to numbers', () => {
      expect(letterToNumber('a')).toBe(1);
      expect(letterToNumber('b')).toBe(2);
      expect(letterToNumber('c')).toBe(3);
      expect(letterToNumber('z')).toBe(26);
    });

    test('should handle empty or null input', () => {
      expect(letterToNumber('')).toBe(0);
      expect(letterToNumber(null)).toBe(0);
    });
  });

  describe('parseNumberingStyle', () => {
    test('should parse Roman numeral uppercase', () => {
      const result = parseNumberingStyle('I. Introduction');
      expect(result.type).toBe('ROMAN_UPPER');
      expect(result.value).toBe('I');
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(0);
    });

    test('should parse Roman numeral lowercase', () => {
      const result = parseNumberingStyle('i. subsection');
      expect(result.type).toBe('ROMAN_LOWER');
      expect(result.value).toBe('i');
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(5);
    });

    test('should parse Arabic numbers', () => {
      const result = parseNumberingStyle('1. First Section');
      expect(result.type).toBe('ARABIC');
      expect(result.value).toBe(1);
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(1);
    });

    test('should parse uppercase letters', () => {
      const result = parseNumberingStyle('A. Subsection');
      expect(result.type).toBe('LETTER_UPPER');
      expect(result.value).toBe('A');
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(2);
    });

    test('should parse lowercase letters', () => {
      const result = parseNumberingStyle('a. clause');
      expect(result.type).toBe('LETTER_LOWER');
      expect(result.value).toBe('a');
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(4);
    });

    test('should parse decimal nested format', () => {
      const result = parseNumberingStyle('1.1. Nested section');
      expect(result.type).toBe('DECIMAL_NESTED');
      expect(result.value).toBe('1.1');
      expect(result.depth).toBe(2);
      expect(result.baseLevel).toBe(2);
    });

    test('should parse deeply nested decimal format', () => {
      const result = parseNumberingStyle('1.2.3. Deep section');
      expect(result.type).toBe('DECIMAL_NESTED');
      expect(result.value).toBe('1.2.3');
      expect(result.depth).toBe(3);
      expect(result.baseLevel).toBe(3);
    });

    test('should parse mixed format', () => {
      const result = parseNumberingStyle('A.1 Mixed section');
      expect(result.type).toBe('MIXED_FORMAT');
      expect(result.value).toBe('A.1');
      expect(result.depth).toBe(2);
    });

    test('should parse parenthesized numbers', () => {
      const result = parseNumberingStyle('(1) Item');
      expect(result.type).toBe('PAREN_ARABIC');
      expect(result.value).toBe(1);
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(3);
    });

    test('should parse parenthesized letters', () => {
      const result = parseNumberingStyle('(a) subitem');
      expect(result.type).toBe('PAREN_LETTER');
      expect(result.value).toBe('a');
      expect(result.numericValue).toBe(1);
      expect(result.baseLevel).toBe(6);
    });

    test('should handle text without numbering', () => {
      const result = parseNumberingStyle('Plain text without numbering');
      expect(result).toBeNull();
    });

    test('should handle empty or null input', () => {
      expect(parseNumberingStyle('')).toBeNull();
      expect(parseNumberingStyle(null)).toBeNull();
    });
  });

  describe('detectHierarchyLevel', () => {
    test('should detect level from Roman numerals', () => {
      expect(detectHierarchyLevel('I. Article')).toBe(0);
      expect(detectHierarchyLevel('II. Article')).toBe(0);
    });

    test('should detect level from Arabic numbers', () => {
      expect(detectHierarchyLevel('1. Section')).toBe(1);
      expect(detectHierarchyLevel('2. Section')).toBe(1);
    });

    test('should detect level from letters', () => {
      expect(detectHierarchyLevel('A. Subsection')).toBe(2);
      expect(detectHierarchyLevel('a. clause')).toBe(4);
    });

    test('should detect level from decimal nested format', () => {
      expect(detectHierarchyLevel('1.1. Nested')).toBe(2);
      expect(detectHierarchyLevel('1.1.1. Deep nested')).toBe(3);
      expect(detectHierarchyLevel('1.1.1.1. Very deep')).toBe(4);
    });

    test('should adjust level based on indentation', () => {
      expect(detectHierarchyLevel('1. Section', {}, 0)).toBe(1);
      expect(detectHierarchyLevel('1. Section', {}, 20)).toBe(2);
      expect(detectHierarchyLevel('1. Section', {}, 40)).toBe(3);
    });

    test('should detect level from heading style', () => {
      expect(detectHierarchyLevel('Heading', { heading: 'Heading 1' })).toBe(0);
      expect(detectHierarchyLevel('Heading', { heading: 'Heading 2' })).toBe(1);
      expect(detectHierarchyLevel('Heading', { heading: 'Heading 3' })).toBe(2);
    });

    test('should detect level from font size', () => {
      expect(detectHierarchyLevel('Text', { fontSize: '24px' })).toBe(0);
      expect(detectHierarchyLevel('Text', { fontSize: '20px' })).toBe(1);
      expect(detectHierarchyLevel('Text', { fontSize: '16px' })).toBe(3);
      expect(detectHierarchyLevel('Text', { fontSize: '12px' })).toBe(5);
    });

    test('should reduce level for bold text', () => {
      expect(detectHierarchyLevel('Text', { fontSize: '16px', bold: true })).toBe(2);
      expect(detectHierarchyLevel('Text', { fontSize: '14px', bold: true })).toBe(3);
    });

    test('should cap level at 9', () => {
      expect(detectHierarchyLevel('Text', {}, 200)).toBe(9);
      expect(detectHierarchyLevel('Text', { heading: 'Heading 10' })).toBe(9);
    });
  });

  describe('buildSectionTree', () => {
    test('should build tree from simple hierarchy', () => {
      const paragraphs = [
        { text: 'I. Article One', style: {}, indentation: 0 },
        { text: '1. Section One', style: {}, indentation: 20 },
        { text: 'A. Subsection A', style: {}, indentation: 40 },
        { text: 'II. Article Two', style: {}, indentation: 0 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.root).toHaveLength(2);
      expect(tree.root[0].level).toBe(0);
      expect(tree.root[0].children).toHaveLength(1);
      expect(tree.root[0].children[0].level).toBe(2);
      expect(tree.metadata.totalLevels).toBeGreaterThan(0);
    });

    test('should build complex nested tree', () => {
      const paragraphs = [
        { text: 'Article I - Name', style: {}, indentation: 0 },
        { text: '  Section 1 - Purpose', style: {}, indentation: 20 },
        { text: '    A. Subsection detail', style: {}, indentation: 40 },
        { text: '      1. Clause item', style: {}, indentation: 60 },
        { text: '        a. Subclause detail', style: {}, indentation: 80 },
        { text: '          i. Further detail', style: {}, indentation: 100 },
        { text: '  Section 2 - Another section', style: {}, indentation: 20 },
        { text: 'Article II - Another article', style: {}, indentation: 0 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.root).toHaveLength(2); // Two articles
      expect(tree.root[0].children).toHaveLength(2); // Two sections under Article I
      expect(tree.metadata.totalNodes).toBe(8);
    });

    test('should handle empty input', () => {
      const tree = buildSectionTree([]);
      expect(tree.root).toHaveLength(0);
      expect(tree.metadata.totalLevels).toBe(0);
    });

    test('should track numbering patterns used', () => {
      const paragraphs = [
        { text: 'I. Article', style: {}, indentation: 0 },
        { text: '1. Section', style: {}, indentation: 20 },
        { text: 'A. Subsection', style: {}, indentation: 40 },
        { text: 'a. clause', style: {}, indentation: 60 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.metadata.patterns).toContain('ROMAN_UPPER');
      expect(tree.metadata.patterns).toContain('ARABIC');
      expect(tree.metadata.patterns).toContain('LETTER_UPPER');
      expect(tree.metadata.patterns).toContain('LETTER_LOWER');
    });

    test('should preserve node metadata', () => {
      const paragraphs = [
        { text: 'I. Article', style: { bold: true }, indentation: 0 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.root[0].style.bold).toBe(true);
      expect(tree.root[0].numbering.type).toBe('ROMAN_UPPER');
      expect(tree.root[0].numbering.value).toBe('I');
    });
  });

  describe('validateNumberingSequence', () => {
    test('should validate correct sequence', () => {
      const nodes = [
        { numbering: { type: 'ARABIC', value: 1, numericValue: 1 } },
        { numbering: { type: 'ARABIC', value: 2, numericValue: 2 } },
        { numbering: { type: 'ARABIC', value: 3, numericValue: 3 } }
      ];

      const result = validateNumberingSequence(nodes);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect sequence gaps', () => {
      const nodes = [
        { numbering: { type: 'ARABIC', value: 1, numericValue: 1 } },
        { numbering: { type: 'ARABIC', value: 2, numericValue: 2 } },
        { numbering: { type: 'ARABIC', value: 4, numericValue: 4 } } // Missing 3
      ];

      const result = validateNumberingSequence(nodes);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('SEQUENCE_GAP');
    });

    test('should detect mixed numbering styles', () => {
      const nodes = [
        { numbering: { type: 'ARABIC', value: 1, numericValue: 1 } },
        { numbering: { type: 'LETTER_UPPER', value: 'A', numericValue: 1 } },
        { numbering: { type: 'ARABIC', value: 2, numericValue: 2 } }
      ];

      const result = validateNumberingSequence(nodes);
      expect(result.warnings.some(w => w.type === 'MIXED_STYLES')).toBe(true);
    });

    test('should handle empty input', () => {
      const result = validateNumberingSequence([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle nodes without numbering', () => {
      const nodes = [
        { text: 'Plain text' },
        { text: 'Another plain text' }
      ];

      const result = validateNumberingSequence(nodes);
      expect(result.valid).toBe(true);
    });
  });

  describe('getSectionPath', () => {
    test('should find path to nested node', () => {
      const tree = {
        root: [
          {
            id: 0,
            text: 'Article I',
            children: [
              {
                id: 1,
                text: 'Section 1',
                children: [
                  { id: 2, text: 'Subsection A', children: [] }
                ]
              }
            ]
          }
        ]
      };

      const path = getSectionPath(tree, 2);

      expect(path).toHaveLength(3);
      expect(path[0].id).toBe(0);
      expect(path[1].id).toBe(1);
      expect(path[2].id).toBe(2);
    });

    test('should return empty path if node not found', () => {
      const tree = {
        root: [
          { id: 0, text: 'Article I', children: [] }
        ]
      };

      const path = getSectionPath(tree, 999);
      expect(path).toHaveLength(0);
    });

    test('should find root level node', () => {
      const tree = {
        root: [
          { id: 0, text: 'Article I', children: [] },
          { id: 1, text: 'Article II', children: [] }
        ]
      };

      const path = getSectionPath(tree, 1);

      expect(path).toHaveLength(1);
      expect(path[0].id).toBe(1);
    });
  });

  describe('Edge Cases and Complex Patterns', () => {
    test('should handle skipped numbering (I, II, IV)', () => {
      const paragraphs = [
        { text: 'I. First', style: {}, indentation: 0 },
        { text: 'II. Second', style: {}, indentation: 0 },
        { text: 'IV. Fourth (skipped III)', style: {}, indentation: 0 }
      ];

      const tree = buildSectionTree(paragraphs);
      const validation = validateNumberingSequence(tree.root);

      expect(validation.warnings).toHaveLength(1);
      expect(validation.warnings[0].type).toBe('SEQUENCE_GAP');
    });

    test('should handle multiple formats in same document', () => {
      const paragraphs = [
        { text: 'I. Article I - Top', style: {}, indentation: 0 },
        { text: '1.1. Decimal nested', style: {}, indentation: 20 },
        { text: '(a) Parenthesized', style: {}, indentation: 40 },
        { text: 'A. Letter', style: {}, indentation: 40 },
        { text: 'i. Roman lower', style: {}, indentation: 60 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.metadata.patterns.length).toBeGreaterThanOrEqual(4);
      expect(tree.metadata.patterns).toContain('ROMAN_UPPER');
      expect(tree.metadata.patterns).toContain('DECIMAL_NESTED');
      expect(tree.metadata.patterns).toContain('PAREN_LETTER');
      expect(tree.metadata.patterns).toContain('LETTER_UPPER');
      expect(tree.metadata.patterns).toContain('ROMAN_LOWER');
    });

    test('should handle unnumbered sections with style', () => {
      const paragraphs = [
        { text: 'Title', style: { heading: 'Heading 1' }, indentation: 0 },
        { text: 'Subtitle', style: { heading: 'Heading 2' }, indentation: 0 },
        { text: 'Content', style: { fontSize: '12px' }, indentation: 20 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.root[0].level).toBe(0);
      // Subtitle may be nested under title if hierarchy detection groups them
      expect(tree.metadata.totalLevels).toBeGreaterThan(0);
      expect(tree.root.length).toBeGreaterThan(0);
    });

    test('should distinguish section titles from content', () => {
      const title = 'I. Introduction';
      const content = 'This is the introduction content without numbering';

      const titleParsed = parseNumberingStyle(title);
      const contentParsed = parseNumberingStyle(content);

      expect(titleParsed).not.toBeNull();
      expect(titleParsed.type).toBe('ROMAN_UPPER');
      expect(contentParsed).toBeNull();
    });

    test('should handle 10-level deep hierarchy', () => {
      const paragraphs = [
        { text: 'I. Level 0', style: {}, indentation: 0 },
        { text: '1. Level 1', style: {}, indentation: 20 },
        { text: 'A. Level 2', style: {}, indentation: 40 },
        { text: '(1) Level 3', style: {}, indentation: 60 },
        { text: 'a. Level 4', style: {}, indentation: 80 },
        { text: 'i. Level 5', style: {}, indentation: 100 },
        { text: '(a) Level 6', style: {}, indentation: 120 },
        { text: '1.1. Level 7', style: {}, indentation: 140 },
        { text: '1.1.1. Level 8', style: {}, indentation: 160 },
        { text: '1.1.1.1. Level 9', style: {}, indentation: 180 }
      ];

      const tree = buildSectionTree(paragraphs);

      expect(tree.metadata.totalLevels).toBeGreaterThanOrEqual(9);
      expect(tree.root[0].children.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Bylaw Pattern', () => {
    test('should handle typical bylaw structure', () => {
      const bylawParagraphs = [
        { text: 'I. Article I - Name', style: { bold: true, fontSize: '20px' }, indentation: 0 },
        { text: '1. Section 1 - Purpose', style: { fontSize: '16px' }, indentation: 20 },
        { text: 'A. Subsection detail', style: { fontSize: '14px' }, indentation: 40 },
        { text: '1. Clause item', style: { fontSize: '12px' }, indentation: 60 },
        { text: 'a. Subclause detail', style: { fontSize: '12px' }, indentation: 80 },
        { text: 'i. Further detail', style: { fontSize: '12px' }, indentation: 100 }
      ];

      const tree = buildSectionTree(bylawParagraphs);

      // Verify structure exists and has proper levels
      expect(tree.root.length).toBeGreaterThan(0);
      expect(tree.root[0].text).toContain('Article I');

      // Check that tree has proper nesting (at least some children)
      expect(tree.metadata.totalNodes).toBe(6);
      expect(tree.metadata.totalLevels).toBeGreaterThan(3);

      // Verify all different numbering patterns were recognized
      expect(tree.metadata.patterns).toContain('ROMAN_UPPER');
      expect(tree.metadata.patterns).toContain('ARABIC');
      expect(tree.metadata.patterns).toContain('LETTER_UPPER');
      expect(tree.metadata.patterns).toContain('LETTER_LOWER');
      expect(tree.metadata.patterns).toContain('ROMAN_LOWER');
    });
  });
});
