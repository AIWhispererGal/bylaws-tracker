/**
 * Unit Tests for TOC Service
 * Tests section numbering, TOC generation, and navigation
 */

const tocService = require('../../src/services/tocService');

describe('TOC Service', () => {
  describe('assignSectionNumbers', () => {
    it('should assign sequential numbers to sections', () => {
      const sections = [
        { id: '1', section_number: 'Article I' },
        { id: '2', section_number: 'Article II' },
        { id: '3', section_number: 'Article III' }
      ];

      const result = tocService.assignSectionNumbers(sections);

      expect(result).toHaveLength(3);
      expect(result[0].number).toBe(1);
      expect(result[0].anchorId).toBe('section-1');
      expect(result[1].number).toBe(2);
      expect(result[1].anchorId).toBe('section-2');
      expect(result[2].number).toBe(3);
      expect(result[2].anchorId).toBe('section-3');
    });

    it('should handle empty array', () => {
      const result = tocService.assignSectionNumbers([]);
      expect(result).toEqual([]);
    });

    it('should handle null input', () => {
      const result = tocService.assignSectionNumbers(null);
      expect(result).toEqual([]);
    });
  });

  describe('generateTableOfContents', () => {
    it('should generate flat TOC for root-level sections', () => {
      const sections = [
        { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', depth: 0 },
        { id: '2', number: 2, anchorId: 'section-2', section_number: 'Article II', depth: 0 },
        { id: '3', number: 3, anchorId: 'section-3', section_number: 'Article III', depth: 0 }
      ];

      const result = tocService.generateTableOfContents(sections);

      expect(result).toHaveLength(3);
      expect(result[0].number).toBe(1);
      expect(result[0].citation).toBe('Article I');
      expect(result[0].children).toHaveLength(0);
      expect(result[0].subsectionCount).toBe(0);
    });

    it('should generate hierarchical TOC with parent-child relationships', () => {
      const sections = [
        { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', depth: 0, parent_section_id: null, current_text: 'Content 1' },
        { id: '2', number: 2, anchorId: 'section-2', section_number: 'Section 1.1', depth: 1, parent_section_id: '1', current_text: 'Content 2' },
        { id: '3', number: 3, anchorId: 'section-3', section_number: 'Section 1.2', depth: 1, parent_section_id: '1', current_text: 'Content 3' },
        { id: '4', number: 4, anchorId: 'section-4', section_number: 'Article II', depth: 0, parent_section_id: null, current_text: 'Content 4' }
      ];

      const result = tocService.generateTableOfContents(sections);

      // Should have 2 root sections
      expect(result).toHaveLength(2);

      // First root section should have 2 children
      expect(result[0].number).toBe(1);
      expect(result[0].children).toHaveLength(2);
      expect(result[0].subsectionCount).toBe(2);

      // Check child sections
      expect(result[0].children[0].number).toBe(2);
      expect(result[0].children[0].citation).toBe('Section 1.1');
      expect(result[0].children[1].number).toBe(3);
      expect(result[0].children[1].citation).toBe('Section 1.2');

      // Second root section should have no children
      expect(result[1].number).toBe(4);
      expect(result[1].children).toHaveLength(0);
      expect(result[1].subsectionCount).toBe(0);
    });

    it('should handle deep hierarchy (3+ levels)', () => {
      const sections = [
        { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', depth: 0, parent_section_id: null },
        { id: '2', number: 2, anchorId: 'section-2', section_number: 'Section 1.1', depth: 1, parent_section_id: '1' },
        { id: '3', number: 3, anchorId: 'section-3', section_number: 'Section 1.1.1', depth: 2, parent_section_id: '2' },
        { id: '4', number: 4, anchorId: 'section-4', section_number: 'Section 1.1.1.1', depth: 3, parent_section_id: '3' }
      ];

      const result = tocService.generateTableOfContents(sections);

      // Should have 1 root section
      expect(result).toHaveLength(1);

      // Navigate through hierarchy
      const root = result[0];
      expect(root.subsectionCount).toBe(1);
      expect(root.children).toHaveLength(1);

      const level1 = root.children[0];
      expect(level1.subsectionCount).toBe(1);
      expect(level1.children).toHaveLength(1);

      const level2 = level1.children[0];
      expect(level2.subsectionCount).toBe(1);
      expect(level2.children).toHaveLength(1);

      const level3 = level2.children[0];
      expect(level3.subsectionCount).toBe(0);
      expect(level3.children).toHaveLength(0);
    });

    it('should handle orphaned sections (missing parent)', () => {
      const sections = [
        { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', depth: 0, parent_section_id: null },
        { id: '2', number: 2, anchorId: 'section-2', section_number: 'Orphan', depth: 1, parent_section_id: 'nonexistent' }
      ];

      const result = tocService.generateTableOfContents(sections);

      // Orphaned section should be placed at root level
      expect(result).toHaveLength(2);
      expect(result[1].number).toBe(2);
      expect(result[1].citation).toBe('Orphan');
    });

    it('should detect sections with content', () => {
      const sections = [
        { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', depth: 0, current_text: 'Some content' },
        { id: '2', number: 2, anchorId: 'section-2', section_number: 'Article II', depth: 0, current_text: '' },
        { id: '3', number: 3, anchorId: 'section-3', section_number: 'Article III', depth: 0, original_text: 'Original content' }
      ];

      const result = tocService.generateTableOfContents(sections);

      expect(result[0].hasContent).toBe(true);
      expect(result[0].contentLength).toBeGreaterThan(0);
      expect(result[1].hasContent).toBe(false);
      expect(result[2].hasContent).toBe(true);
    });
  });

  describe('generateFlatTOC', () => {
    it('should generate flat list with indentation levels', () => {
      const sections = [
        { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', depth: 0, current_text: 'Content' },
        { id: '2', number: 2, anchorId: 'section-2', section_number: 'Section 1.1', depth: 1 },
        { id: '3', number: 3, anchorId: 'section-3', section_number: 'Section 1.2', depth: 1 },
        { id: '4', number: 4, anchorId: 'section-4', section_number: 'Article II', depth: 0 }
      ];

      const result = tocService.generateFlatTOC(sections);

      expect(result).toHaveLength(4);
      expect(result[0].indentLevel).toBe(0);
      expect(result[1].indentLevel).toBe(1);
      expect(result[2].indentLevel).toBe(1);
      expect(result[3].indentLevel).toBe(0);
    });
  });

  describe('findSectionByAnchor', () => {
    const sections = [
      { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I' },
      { id: '2', number: 2, anchorId: 'section-2', section_number: 'Article II' }
    ];

    it('should find section by anchor ID', () => {
      const result = tocService.findSectionByAnchor(sections, 'section-2');
      expect(result).toBeDefined();
      expect(result.number).toBe(2);
      expect(result.section_number).toBe('Article II');
    });

    it('should return null for non-existent anchor', () => {
      const result = tocService.findSectionByAnchor(sections, 'section-999');
      expect(result).toBeNull();
    });

    it('should handle null inputs', () => {
      expect(tocService.findSectionByAnchor(null, 'section-1')).toBeNull();
      expect(tocService.findSectionByAnchor(sections, null)).toBeNull();
    });
  });

  describe('getSectionNavigation', () => {
    const sections = [
      { id: '1', number: 1, anchorId: 'section-1', section_number: 'Article I', parent_section_id: null },
      { id: '2', number: 2, anchorId: 'section-2', section_number: 'Section 1.1', parent_section_id: '1' },
      { id: '3', number: 3, anchorId: 'section-3', section_number: 'Section 1.2', parent_section_id: '1' },
      { id: '4', number: 4, anchorId: 'section-4', section_number: 'Article II', parent_section_id: null }
    ];

    it('should return prev, next, and parent for middle section', () => {
      const result = tocService.getSectionNavigation(sections, 2);

      expect(result.prev).toBeDefined();
      expect(result.prev.number).toBe(1);

      expect(result.next).toBeDefined();
      expect(result.next.number).toBe(3);

      expect(result.parent).toBeDefined();
      expect(result.parent.number).toBe(1);
    });

    it('should return null prev for first section', () => {
      const result = tocService.getSectionNavigation(sections, 1);

      expect(result.prev).toBeNull();
      expect(result.next).toBeDefined();
      expect(result.parent).toBeNull();
    });

    it('should return null next for last section', () => {
      const result = tocService.getSectionNavigation(sections, 4);

      expect(result.prev).toBeDefined();
      expect(result.next).toBeNull();
      expect(result.parent).toBeNull();
    });

    it('should return null for invalid section number', () => {
      const result = tocService.getSectionNavigation(sections, 999);
      expect(result.prev).toBeNull();
      expect(result.next).toBeNull();
      expect(result.parent).toBeNull();
    });
  });

  describe('generateTOCMetadata', () => {
    it('should generate accurate metadata', () => {
      const sections = [
        { id: '1', number: 1, depth: 0, parent_section_id: null, current_text: 'Content 1', is_locked: false },
        { id: '2', number: 2, depth: 1, parent_section_id: '1', current_text: 'Content 2', is_locked: true },
        { id: '3', number: 3, depth: 2, parent_section_id: '2', current_text: '', is_locked: false },
        { id: '4', number: 4, depth: 0, parent_section_id: null, original_text: 'Content 4', is_locked: false }
      ];

      const result = tocService.generateTOCMetadata(sections);

      expect(result.totalSections).toBe(4);
      expect(result.maxDepth).toBe(2);
      expect(result.rootSections).toBe(2);
      expect(result.sectionsWithContent).toBe(3);
      expect(result.lockedSections).toBe(1);
    });

    it('should handle empty sections', () => {
      const result = tocService.generateTOCMetadata([]);

      expect(result.totalSections).toBe(0);
      expect(result.maxDepth).toBe(0);
      expect(result.rootSections).toBe(0);
      expect(result.sectionsWithContent).toBe(0);
      expect(result.lockedSections).toBe(0);
    });
  });

  describe('processSectionsForTOC', () => {
    it('should process complete TOC pipeline', () => {
      const rawSections = [
        { id: '1', section_number: 'Article I', depth: 0, parent_section_id: null, current_text: 'Content' },
        { id: '2', section_number: 'Section 1.1', depth: 1, parent_section_id: '1', current_text: 'Content' },
        { id: '3', section_number: 'Article II', depth: 0, parent_section_id: null, current_text: 'Content' }
      ];

      const result = tocService.processSectionsForTOC(rawSections);

      // Check all components are generated
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].number).toBe(1);
      expect(result.sections[0].anchorId).toBe('section-1');

      expect(result.hierarchicalTOC).toHaveLength(2);
      expect(result.hierarchicalTOC[0].children).toHaveLength(1);

      expect(result.flatTOC).toHaveLength(3);

      expect(result.metadata.totalSections).toBe(3);
      expect(result.metadata.maxDepth).toBe(1);
      expect(result.metadata.rootSections).toBe(2);
    });

    it('should handle empty input', () => {
      const result = tocService.processSectionsForTOC([]);

      expect(result.sections).toEqual([]);
      expect(result.hierarchicalTOC).toEqual([]);
      expect(result.flatTOC).toEqual([]);
      expect(result.metadata.totalSections).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('should process 100 sections in < 50ms', () => {
      // Generate 100 test sections
      const sections = [];
      for (let i = 1; i <= 100; i++) {
        sections.push({
          id: `${i}`,
          section_number: `Section ${i}`,
          depth: i % 3, // Vary depth
          parent_section_id: i > 1 ? `${i - 1}` : null,
          current_text: `Content for section ${i}`
        });
      }

      const startTime = performance.now();
      const result = tocService.processSectionsForTOC(sections);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.sections).toHaveLength(100);
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
      console.log(`Processed 100 sections in ${duration.toFixed(2)}ms`);
    });

    it('should handle large documents (500 sections) efficiently', () => {
      // Generate 500 test sections
      const sections = [];
      for (let i = 1; i <= 500; i++) {
        sections.push({
          id: `${i}`,
          section_number: `Section ${i}`,
          depth: i % 5,
          parent_section_id: i > 1 && i % 10 !== 0 ? `${Math.floor(i / 10) * 10}` : null,
          current_text: `Content for section ${i}`
        });
      }

      const startTime = performance.now();
      const result = tocService.processSectionsForTOC(sections);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.sections).toHaveLength(500);
      expect(duration).toBeLessThan(200); // Should complete in < 200ms
      console.log(`Processed 500 sections in ${duration.toFixed(2)}ms`);
    });
  });
});
