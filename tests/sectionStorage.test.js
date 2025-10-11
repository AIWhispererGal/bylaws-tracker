/**
 * Section Storage Service Tests
 * Tests for storing parsed sections with hierarchy
 */

const sectionStorage = require('../src/services/sectionStorage');

describe('SectionStorage', () => {
  describe('buildHierarchy', () => {
    it('should build flat hierarchy for depth 0 sections', async () => {
      const sections = [
        { type: 'article', number: 'I', prefix: 'Article ', title: 'First Article', text: 'Content 1', depth: 0 },
        { type: 'article', number: 'II', prefix: 'Article ', title: 'Second Article', text: 'Content 2', depth: 0 },
        { type: 'article', number: 'III', prefix: 'Article ', title: 'Third Article', text: 'Content 3', depth: 0 }
      ];

      const result = await sectionStorage.buildHierarchy(sections);

      expect(result).toHaveLength(3);
      expect(result[0].depth).toBe(0);
      expect(result[0].ordinal).toBe(1);
      expect(result[0].parent_id).toBeNull();
      expect(result[1].ordinal).toBe(2);
      expect(result[2].ordinal).toBe(3);
    });

    it('should build parent-child relationships for nested sections', async () => {
      const sections = [
        { type: 'article', number: 'I', prefix: 'Article ', title: 'First Article', text: 'Content', depth: 0 },
        { type: 'section', number: '1', prefix: 'Section ', title: 'First Section', text: 'Content', depth: 1 },
        { type: 'section', number: '2', prefix: 'Section ', title: 'Second Section', text: 'Content', depth: 1 },
        { type: 'article', number: 'II', prefix: 'Article ', title: 'Second Article', text: 'Content', depth: 0 },
        { type: 'section', number: '1', prefix: 'Section ', title: 'First Section', text: 'Content', depth: 1 }
      ];

      const result = await sectionStorage.buildHierarchy(sections);

      expect(result).toHaveLength(5);

      // Article I (root, ordinal 1)
      expect(result[0].depth).toBe(0);
      expect(result[0].ordinal).toBe(1);
      expect(result[0].parent_temp_id).toBeNull();

      // Section 1 under Article I (child, ordinal 1)
      expect(result[1].depth).toBe(1);
      expect(result[1].ordinal).toBe(1);
      expect(result[1].parent_temp_id).toBe(0);

      // Section 2 under Article I (child, ordinal 2)
      expect(result[2].depth).toBe(1);
      expect(result[2].ordinal).toBe(2);
      expect(result[2].parent_temp_id).toBe(0);

      // Article II (root, ordinal 2)
      expect(result[3].depth).toBe(0);
      expect(result[3].ordinal).toBe(2);
      expect(result[3].parent_temp_id).toBeNull();

      // Section 1 under Article II (child, ordinal 1)
      expect(result[4].depth).toBe(1);
      expect(result[4].ordinal).toBe(1);
      expect(result[4].parent_temp_id).toBe(3);
    });

    it('should handle multi-level nesting', async () => {
      const sections = [
        { type: 'article', number: 'I', title: 'Article', text: 'Content', depth: 0 },
        { type: 'section', number: '1', title: 'Section', text: 'Content', depth: 1 },
        { type: 'subsection', number: 'A', title: 'Subsection', text: 'Content', depth: 2 },
        { type: 'clause', number: 'i', title: 'Clause', text: 'Content', depth: 3 },
        { type: 'subsection', number: 'B', title: 'Subsection', text: 'Content', depth: 2 },
        { type: 'section', number: '2', title: 'Section', text: 'Content', depth: 1 }
      ];

      const result = await sectionStorage.buildHierarchy(sections);

      expect(result).toHaveLength(6);

      // Verify depth progression
      expect(result[0].depth).toBe(0); // Article
      expect(result[1].depth).toBe(1); // Section 1
      expect(result[2].depth).toBe(2); // Subsection A
      expect(result[3].depth).toBe(3); // Clause i
      expect(result[4].depth).toBe(2); // Subsection B
      expect(result[5].depth).toBe(1); // Section 2

      // Verify parent relationships
      expect(result[1].parent_temp_id).toBe(0); // Section -> Article
      expect(result[2].parent_temp_id).toBe(1); // Subsection A -> Section
      expect(result[3].parent_temp_id).toBe(2); // Clause -> Subsection A
      expect(result[4].parent_temp_id).toBe(1); // Subsection B -> Section
      expect(result[5].parent_temp_id).toBe(0); // Section 2 -> Article

      // Verify ordinals at each level
      expect(result[0].ordinal).toBe(1); // Article (1st root)
      expect(result[1].ordinal).toBe(1); // Section 1 (1st child of Article)
      expect(result[2].ordinal).toBe(1); // Subsection A (1st child of Section 1)
      expect(result[3].ordinal).toBe(1); // Clause i (1st child of Subsection A)
      expect(result[4].ordinal).toBe(2); // Subsection B (2nd child of Section 1)
      expect(result[5].ordinal).toBe(2); // Section 2 (2nd child of Article)
    });
  });

  describe('formatSectionNumber', () => {
    it('should use section_number if available', () => {
      const section = { section_number: 'Article I' };
      const result = sectionStorage.formatSectionNumber(section);
      expect(result).toBe('Article I');
    });

    it('should use citation if section_number not available', () => {
      const section = { citation: 'Section 1.2' };
      const result = sectionStorage.formatSectionNumber(section);
      expect(result).toBe('Section 1.2');
    });

    it('should build from prefix and number', () => {
      const section = { prefix: 'Article ', number: 'III' };
      const result = sectionStorage.formatSectionNumber(section);
      expect(result).toBe('Article III');
    });

    it('should return "Unnumbered" for empty section', () => {
      const section = {};
      const result = sectionStorage.formatSectionNumber(section);
      expect(result).toBe('Unnumbered');
    });
  });

  describe('storeSections', () => {
    // Note: These tests require a real database connection
    // They are commented out as integration tests

    it.skip('should store sections with hierarchy to database', async () => {
      // Mock or real Supabase client needed
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [
            { id: 'uuid-1', section_number: 'Article I' }
          ],
          error: null
        })
      };

      const sections = [
        { type: 'article', number: 'I', title: 'Test', text: 'Content', depth: 0 }
      ];

      const result = await sectionStorage.storeSections(
        'org-uuid',
        'doc-uuid',
        sections,
        mockSupabase
      );

      expect(result.success).toBe(true);
      expect(result.sectionsStored).toBe(1);
    });
  });

  describe('validateStoredSections', () => {
    it.skip('should validate section hierarchy integrity', async () => {
      // Integration test with real database
      // Would check path_ids, path_ordinals, parent relationships
    });
  });
});

describe('Integration: Complete workflow', () => {
  it.skip('should store and validate a complete document', async () => {
    // Full integration test:
    // 1. Parse document
    // 2. Build hierarchy
    // 3. Store to database
    // 4. Validate stored sections
    // 5. Query back and verify structure
  });
});
