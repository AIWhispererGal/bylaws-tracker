/**
 * Test Context-Aware Depth Calculation
 * Verifies that the parser correctly calculates depths based on containment rules
 */

const wordParser = require('../../src/parsers/wordParser');

describe('Context-Aware Depth Calculation', () => {
  const mockLevels = [
    { type: 'article', depth: 0, name: 'Article' },
    { type: 'section', depth: 1, name: 'Section' },
    { type: 'subsection', depth: 2, name: 'Subsection' },
    { type: 'paragraph', depth: 3, name: 'Paragraph' },
    { type: 'subparagraph', depth: 4, name: 'Subparagraph' },
    { type: 'clause', depth: 5, name: 'Clause' },
    { type: 'subclause', depth: 6, name: 'Subclause' },
    { type: 'item', depth: 7, name: 'Item' },
    { type: 'subitem', depth: 8, name: 'Subitem' },
    { type: 'point', depth: 9, name: 'Point' }
  ];

  describe('Basic Containment Rules', () => {
    it('should assign depth 0 to articles', () => {
      const sections = [
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'article', citation: 'Article II', title: 'Second' }
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0);
      expect(enriched[1].depth).toBe(0);
    });

    it('should nest sections under articles', () => {
      const sections = [
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'section', citation: 'Section 1', title: 'Sub' },
        { type: 'section', citation: 'Section 2', title: 'Sub2' },
        { type: 'article', citation: 'Article II', title: 'Second' },
        { type: 'section', citation: 'Section 1', title: 'Sub3' }
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0); // Article I
      expect(enriched[1].depth).toBe(1); // Section 1 under Article I
      expect(enriched[2].depth).toBe(1); // Section 2 under Article I
      expect(enriched[3].depth).toBe(0); // Article II
      expect(enriched[4].depth).toBe(1); // Section 1 under Article II
    });

    it('should handle deep nesting correctly', () => {
      const sections = [
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'section', citation: 'Section 1', title: 'S1' },
        { type: 'subsection', citation: '(a)', title: 'SS1' },
        { type: 'paragraph', citation: '(1)', title: 'P1' },
        { type: 'subparagraph', citation: '(i)', title: 'SP1' },
        { type: 'clause', citation: '(A)', title: 'C1' }
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0); // Article
      expect(enriched[1].depth).toBe(1); // Section
      expect(enriched[2].depth).toBe(2); // Subsection
      expect(enriched[3].depth).toBe(3); // Paragraph
      expect(enriched[4].depth).toBe(4); // Subparagraph
      expect(enriched[5].depth).toBe(5); // Clause
    });
  });

  describe('Messy Document Handling', () => {
    it('should handle inconsistent numbering', () => {
      const sections = [
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'section', citation: 'Section 5', title: 'Jump' }, // Jumps from nothing to 5
        { type: 'section', citation: 'Section 2', title: 'Back' }, // Goes backwards
        { type: 'subsection', citation: '(c)', title: 'Skip' }, // Starts at (c)
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0); // Article
      expect(enriched[1].depth).toBe(1); // Section 5
      expect(enriched[2].depth).toBe(1); // Section 2 (same level)
      expect(enriched[3].depth).toBe(2); // Subsection under last section
    });

    it('should handle mixed hierarchy types in wrong order', () => {
      const sections = [
        { type: 'section', citation: 'Section 1', title: 'Orphan' }, // No article parent
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'subsection', citation: '(a)', title: 'Sub' }, // Subsection without section
        { type: 'section', citation: 'Section 2', title: 'Normal' },
        { type: 'paragraph', citation: '(1)', title: 'Para' } // Paragraph without subsection
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0); // Orphan section at root
      expect(enriched[1].depth).toBe(0); // Article
      expect(enriched[2].depth).toBe(1); // Subsection under article
      expect(enriched[3].depth).toBe(1); // Section under article
      expect(enriched[4].depth).toBe(2); // Paragraph under section
    });

    it('should cap depth at maximum level', () => {
      // Create a deeply nested structure that would exceed 10 levels
      const sections = [
        { type: 'article', citation: 'Article I', title: 'A' },
        { type: 'section', citation: 'Section 1', title: 'B' },
        { type: 'subsection', citation: '(a)', title: 'C' },
        { type: 'paragraph', citation: '(1)', title: 'D' },
        { type: 'subparagraph', citation: '(i)', title: 'E' },
        { type: 'clause', citation: '(A)', title: 'F' },
        { type: 'subclause', citation: '(I)', title: 'G' },
        { type: 'item', citation: '•', title: 'H' },
        { type: 'subitem', citation: '◦', title: 'I' },
        { type: 'point', citation: '·', title: 'J' },
        { type: 'subpoint', citation: '-', title: 'K' } // Would be depth 10
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      // All depths should be within 0-9
      for (const section of enriched) {
        expect(section.depth).toBeGreaterThanOrEqual(0);
        expect(section.depth).toBeLessThanOrEqual(9);
      }

      // Last item should be capped at 9
      expect(enriched[enriched.length - 1].depth).toBe(9);
    });
  });

  describe('Parent Path Tracking', () => {
    it('should track parent path correctly', () => {
      const sections = [
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'section', citation: 'Section 1', title: 'S1' },
        { type: 'subsection', citation: '(a)', title: 'SS1' },
        { type: 'paragraph', citation: '(1)', title: 'P1' }
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].parentPath).toBe(''); // Article has no parent
      expect(enriched[1].parentPath).toBe('Article I'); // Section under article
      expect(enriched[2].parentPath).toBe('Article I > Section 1'); // Subsection path
      expect(enriched[3].parentPath).toBe('Article I > Section 1 > (a)'); // Full path
    });
  });

  describe('Real-World Edge Cases', () => {
    it('should handle documents with only subsections', () => {
      const sections = [
        { type: 'subsection', citation: '(a)', title: 'First' },
        { type: 'subsection', citation: '(b)', title: 'Second' },
        { type: 'paragraph', citation: '(1)', title: 'Under B' },
        { type: 'subsection', citation: '(c)', title: 'Third' }
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0); // First subsection at root
      expect(enriched[1].depth).toBe(0); // Second at same level
      expect(enriched[2].depth).toBe(1); // Paragraph nested under (b)
      expect(enriched[3].depth).toBe(0); // (c) back at root level
    });

    it('should handle unnumbered and preamble sections', () => {
      const sections = [
        { type: 'preamble', citation: 'Preamble', title: 'Introduction' },
        { type: 'article', citation: 'Article I', title: 'First' },
        { type: 'section', citation: 'Section 1', title: 'S1' },
        { type: 'unnumbered', citation: 'Unnumbered', title: 'Extra' }
      ];

      const enriched = wordParser.enrichSectionsWithContext(sections, mockLevels);

      expect(enriched[0].depth).toBe(0); // Preamble at root
      expect(enriched[1].depth).toBe(0); // Article at root
      expect(enriched[2].depth).toBe(1); // Section under article
      expect(enriched[3].depth).toBe(2); // Unnumbered under section
    });
  });
});

describe('Depth Distribution Analysis', () => {
  it('should correctly calculate depth distribution', () => {
    const sections = [
      { type: 'article', depth: 0 },
      { type: 'section', depth: 1 },
      { type: 'section', depth: 1 },
      { type: 'subsection', depth: 2 },
      { type: 'subsection', depth: 2 },
      { type: 'subsection', depth: 2 }
    ];

    const distribution = wordParser.getDepthDistribution(sections);

    expect(distribution).toEqual({
      0: 1, // 1 article
      1: 2, // 2 sections
      2: 3  // 3 subsections
    });
  });
});