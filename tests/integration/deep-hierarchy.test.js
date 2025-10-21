/**
 * Deep Hierarchy Integration Tests
 * Validates 10-level depth support across the stack
 */

const { createClient } = require('@supabase/supabase-js');
const organizationConfig = require('../../src/config/organizationConfig');
const hierarchyDetector = require('../../src/parsers/hierarchyDetector');

describe('10-Level Hierarchy Support', () => {
  let supabase;
  let testOrgId;
  let testDocId;

  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Create test organization with 10-level config
    const { data: org } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Org - Deep Hierarchy',
        slug: 'test-deep-hierarchy',
        hierarchy_config: {
          levels: [
            { name: 'Article', type: 'article', numbering: 'roman', prefix: 'Article ', depth: 0 },
            { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 },
            { name: 'Subsection', type: 'subsection', numbering: 'numeric', prefix: '', depth: 2 },
            { name: 'Paragraph', type: 'paragraph', numbering: 'alphaLower', prefix: '(', depth: 3 },
            { name: 'Subparagraph', type: 'subparagraph', numbering: 'numeric', prefix: '', depth: 4 },
            { name: 'Clause', type: 'clause', numbering: 'alphaLower', prefix: '(', depth: 5 },
            { name: 'Subclause', type: 'subclause', numbering: 'roman', prefix: '', depth: 6 },
            { name: 'Item', type: 'item', numbering: 'numeric', prefix: '•', depth: 7 },
            { name: 'Subitem', type: 'subitem', numbering: 'alpha', prefix: '◦', depth: 8 },
            { name: 'Point', type: 'point', numbering: 'numeric', prefix: '-', depth: 9 }
          ],
          maxDepth: 10,
          allowNesting: true
        }
      })
      .select()
      .single();

    testOrgId = org.id;

    // Create test document
    const { data: doc } = await supabase
      .from('documents')
      .insert({
        organization_id: testOrgId,
        title: 'Deep Hierarchy Test Document',
        status: 'draft'
      })
      .select()
      .single();

    testDocId = doc.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testDocId) {
      await supabase.from('documents').delete().eq('id', testDocId);
    }
    if (testOrgId) {
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
  });

  describe('Configuration Support', () => {
    test('should load 10-level hierarchy config', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);

      expect(config.hierarchy).toBeDefined();
      expect(config.hierarchy.levels).toHaveLength(10);
      expect(config.hierarchy.maxDepth).toBe(10);
    });

    test('should have sequential depths 0-9', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);
      const depths = config.hierarchy.levels.map(l => l.depth).sort((a, b) => a - b);

      expect(depths).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    test('should validate 10-level config as valid', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);
      const validation = organizationConfig.validateConfig(config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Database Constraints', () => {
    test('should allow inserting section at depth 10', async () => {
      // Create a chain of sections from depth 0 to 9
      let parentId = null;
      const sectionIds = [];

      for (let depth = 0; depth <= 9; depth++) {
        const { data, error } = await supabase
          .from('document_sections')
          .insert({
            document_id: testDocId,
            parent_section_id: parentId,
            ordinal: 1,
            depth: depth, // Will be set by trigger
            section_number: `${depth + 1}`,
            section_title: `Level ${depth}`,
            section_type: depth === 0 ? 'article' : 'section',
            original_text: `Content at depth ${depth}`,
            current_text: `Content at depth ${depth}`
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data.depth).toBe(depth);
        expect(data.path_ids.length).toBe(depth + 1);
        expect(data.path_ordinals.length).toBe(depth + 1);

        sectionIds.push(data.id);
        parentId = data.id;
      }

      // Verify final section is at depth 9
      const { data: finalSection } = await supabase
        .from('document_sections')
        .select('*')
        .eq('id', sectionIds[9])
        .single();

      expect(finalSection.depth).toBe(9);
    });

    test('should reject inserting section at depth 11', async () => {
      // Attempt to create depth 11 by manually setting depth (bypassing trigger)
      const { error } = await supabase.rpc('test_depth_constraint', {
        test_depth: 11
      });

      // Should fail CHECK constraint
      expect(error).toBeDefined();
      expect(error.message).toMatch(/depth|constraint|check/i);
    });

    test('should maintain correct path arrays at all depths', async () => {
      const { data: sections } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', testDocId)
        .order('depth');

      sections.forEach(section => {
        // path_ids length should equal depth + 1
        expect(section.path_ids.length).toBe(section.depth + 1);

        // path_ordinals length should equal depth + 1
        expect(section.path_ordinals.length).toBe(section.depth + 1);

        // Last element of path_ids should be self
        expect(section.path_ids[section.path_ids.length - 1]).toBe(section.id);
      });
    });
  });

  describe('Hierarchy Detection', () => {
    test('should detect 10 levels in text', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);

      const testText = `
        Article I - Governance
        Section 1 - Board
        1.1 - Composition
        (a) - Members
        1 - Elected
        (i) - Terms
        I - Limits
        • First
        ◦ Initial
        - Criteria
      `;

      const detected = hierarchyDetector.detectHierarchy(testText, config);

      expect(detected.length).toBeGreaterThan(0);

      // Should detect various depth patterns
      const depthsFound = new Set(detected.map(d => {
        const level = config.hierarchy.levels.find(l => l.type === d.type);
        return level ? level.depth : -1;
      }));

      expect(depthsFound.size).toBeGreaterThanOrEqual(5);
    });

    test('should validate hierarchy structure correctly', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);

      // Valid sections at depths 0-9
      const validSections = Array.from({ length: 10 }, (_, i) => ({
        id: `test-${i}`,
        citation: `${i + 1}`,
        depth: i,
        type: config.hierarchy.levels[i].type,
        number: String(i + 1)
      }));

      const validation = hierarchyDetector.validateHierarchy(validSections, config);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject sections exceeding maxDepth', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);

      const invalidSections = [
        {
          id: 'test-1',
          citation: '1',
          depth: 11, // Exceeds maxDepth of 10
          type: 'invalid',
          number: '1'
        }
      ];

      const validation = hierarchyDetector.validateHierarchy(invalidSections, config);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0].error).toMatch(/exceeds maximum/i);
    });
  });

  describe('Breadcrumb and Path Queries', () => {
    test('should generate correct breadcrumb for depth 9 section', async () => {
      // Get the deepest section
      const { data: deepSection } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', testDocId)
        .eq('depth', 9)
        .single();

      expect(deepSection).toBeDefined();

      // Use helper function to get breadcrumb
      const { data: breadcrumb } = await supabase
        .rpc('get_section_breadcrumb', { section_uuid: deepSection.id });

      expect(breadcrumb).toHaveLength(10); // All 10 levels
      expect(breadcrumb[0].depth).toBe(0); // Root
      expect(breadcrumb[9].depth).toBe(9); // Deepest
    });

    test('should query descendants efficiently with GIN index', async () => {
      const { data: rootSection } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', testDocId)
        .eq('depth', 0)
        .single();

      const startTime = Date.now();

      // Should use GIN index on path_ids
      const { data: descendants } = await supabase
        .from('document_sections')
        .select('*')
        .contains('path_ids', [rootSection.id])
        .order('path_ordinals');

      const queryTime = Date.now() - startTime;

      expect(descendants.length).toBeGreaterThanOrEqual(9); // Root + 9 descendants
      expect(queryTime).toBeLessThan(100); // Should be fast with index
    });
  });

  describe('Numbering Schemes', () => {
    test('should support diverse numbering at each depth', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);

      const schemes = config.hierarchy.levels.map(l => l.numbering);

      expect(schemes).toContain('roman');
      expect(schemes).toContain('numeric');
      expect(schemes).toContain('alpha');
      expect(schemes).toContain('alphaLower');
    });

    test('should format section numbers correctly at all depths', async () => {
      const config = await organizationConfig.loadConfig(testOrgId, supabase);

      const { data: sections } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', testDocId)
        .order('depth');

      sections.forEach(section => {
        const level = config.hierarchy.levels.find(l => l.depth === section.depth);

        expect(level).toBeDefined();
        expect(section.section_number).toBeDefined();
        expect(section.section_number.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Tests', () => {
    test('should handle large document with deep nesting efficiently', async () => {
      // Create a document with 100 sections spread across 10 levels
      const sectionsToCreate = [];

      for (let i = 0; i < 100; i++) {
        const depth = i % 10; // Cycle through depths
        sectionsToCreate.push({
          document_id: testDocId,
          parent_section_id: depth > 0 ? sectionsToCreate[i - 1]?.id : null,
          ordinal: i + 1,
          section_number: `${i + 1}`,
          section_title: `Section ${i + 1}`,
          section_type: 'section',
          original_text: `Content ${i + 1}`,
          current_text: `Content ${i + 1}`
        });
      }

      const startTime = Date.now();

      // Bulk insert
      const { error } = await supabase
        .from('document_sections')
        .insert(sectionsToCreate);

      const insertTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(insertTime).toBeLessThan(5000); // Should complete in < 5 seconds

      // Query performance test
      const queryStart = Date.now();

      const { data: allSections } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', testDocId)
        .order('path_ordinals');

      const queryTime = Date.now() - queryStart;

      expect(allSections.length).toBeGreaterThanOrEqual(100);
      expect(queryTime).toBeLessThan(1000); // Should query in < 1 second
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  });

  test('should handle missing hierarchy config gracefully', async () => {
    const config = organizationConfig.getDefaultConfig();

    expect(config.hierarchy).toBeDefined();
    expect(config.hierarchy.levels.length).toBe(10);
    expect(config.hierarchy.maxDepth).toBe(10);
  });

  test('should fallback to inference when config missing', () => {
    const testText = `
      Article I - Test
      Section 1 - Test
      Subsection A - Test
    `;

    const detected = hierarchyDetector.inferHierarchy(testText);

    expect(detected.length).toBeGreaterThan(0);
    // Note: inference only detects 5 patterns, not 10
  });

  test('should validate sequential depth requirements', async () => {
    const invalidConfig = {
      hierarchy: {
        levels: [
          { name: 'Article', type: 'article', numbering: 'roman', depth: 0 },
          { name: 'Section', type: 'section', numbering: 'numeric', depth: 2 } // Skips depth 1!
        ],
        maxDepth: 10
      }
    };

    const validation = organizationConfig.validateConfig(invalidConfig);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('sequential'))).toBe(true);
  });

  test('should validate maxDepth vs deepest level', () => {
    const invalidConfig = {
      hierarchy: {
        levels: [
          { name: 'Article', type: 'article', numbering: 'roman', depth: 0 },
          { name: 'Section', type: 'section', numbering: 'numeric', depth: 1 }
        ],
        maxDepth: 1 // Too low! Should be at least 2
      }
    };

    const validation = organizationConfig.validateConfig(invalidConfig);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('maxDepth'))).toBe(true);
  });
});
