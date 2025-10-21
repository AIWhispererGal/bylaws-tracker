/**
 * Integration Test: Setup Wizard Schema Fix
 * Tests that custom hierarchy names are properly stored in 10-level schema
 */

const setupService = require('../../src/services/setupService');
const { createClient } = require('@supabase/supabase-js');

describe('Setup Wizard Schema Fix', () => {
  let supabase;
  let testOrgId;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  });

  afterAll(async () => {
    // Cleanup: delete test organization
    if (testOrgId) {
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
    console.log('✓ Cleanup complete');
  });

  test('should create organization with default hierarchy (10 levels)', async () => {
    const orgData = {
      name: `Test Org - Default Hierarchy ${Date.now()}`,
      type: 'neighborhood-council'
    };

    const result = await setupService.createOrganization(orgData, supabase);

    expect(result.success).toBe(true);
    expect(result.organization).toBeDefined();
    testOrgId = result.organization.id;

    console.log(`\n✓ Created organization: ${testOrgId}`);
  });

  test('should save custom hierarchy config with 10 levels', async () => {
    expect(testOrgId).toBeDefined();

    const documentConfig = {
      hierarchyLevels: [
        {
          name: 'Chapter',
          type: 'article',
          numbering: 'roman',
          prefix: 'Chapter ',
          depth: 0
        },
        {
          name: 'Clause',
          type: 'section',
          numbering: 'letters',
          prefix: 'Clause ',
          depth: 1
        }
        // Should auto-fill remaining 8 levels with defaults
      ],
      maxDepth: 10,
      allowNesting: true
    };

    const result = await setupService.saveDocumentConfig(
      testOrgId,
      documentConfig,
      supabase
    );

    expect(result.success).toBe(true);
    expect(result.organization).toBeDefined();

    console.log(`\n📋 Saved hierarchy config`);
  });

  test('should verify hierarchy_config has exactly 10 levels', async () => {
    expect(testOrgId).toBeDefined();

    const { data: org, error } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    expect(error).toBeNull();
    expect(org.hierarchy_config).toBeDefined();
    expect(org.hierarchy_config.levels).toBeDefined();
    expect(Array.isArray(org.hierarchy_config.levels)).toBe(true);

    console.log(`\n🗄️  Database Verification:`);
    console.log(`  - Total levels: ${org.hierarchy_config.levels.length}`);
    console.log(`  - Max depth: ${org.hierarchy_config.maxDepth}`);

    // Should have exactly 10 levels (0-9)
    expect(org.hierarchy_config.levels.length).toBe(10);
    expect(org.hierarchy_config.maxDepth).toBe(10);

    // Verify custom names in first 2 levels
    expect(org.hierarchy_config.levels[0].name).toBe('Chapter');
    expect(org.hierarchy_config.levels[0].prefix).toBe('Chapter ');
    expect(org.hierarchy_config.levels[1].name).toBe('Clause');
    expect(org.hierarchy_config.levels[1].prefix).toBe('Clause ');

    // Display all levels
    console.log(`\n📚 Hierarchy Levels:`);
    org.hierarchy_config.levels.forEach((level, idx) => {
      console.log(`  ${idx}. ${level.name} (${level.type}, ${level.numbering}) - prefix: "${level.prefix}"`);
    });
  });

  test('should use custom names in document sections', async () => {
    expect(testOrgId).toBeDefined();

    // Load the saved config
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    const config = {
      hierarchy: org.hierarchy_config
    };

    // Simulate parsing a simple document
    const wordParser = require('../../src/parsers/wordParser');

    // Create a mock document structure
    const mockSections = [
      {
        type: 'article',
        level: 0,
        number: 'I',
        prefix: 'Chapter ',
        title: 'Test Chapter',
        text: 'Chapter content'
      },
      {
        type: 'section',
        level: 1,
        number: 'A',
        prefix: 'Clause ',
        title: 'Test Clause',
        text: 'Clause content'
      }
    ];

    // Enrich sections with hierarchy info
    const enriched = wordParser.enrichSections(mockSections, config);

    console.log(`\n🔍 Enriched Sections:`);
    enriched.forEach(section => {
      console.log(`  - ${section.prefix}${section.number}: ${section.title}`);
      console.log(`    Type: ${section.type}, Depth: ${section.depth}`);
    });

    // Verify custom prefixes are used
    expect(enriched[0].prefix).toBe('Chapter ');
    expect(enriched[1].prefix).toBe('Clause ');
  });

  test('should handle partial custom hierarchy (fill remaining with defaults)', async () => {
    // Create new test org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: `Test Org - Partial Hierarchy ${Date.now()}`,
        org_type: 'test'
      })
      .select()
      .single();

    expect(orgError).toBeNull();
    const partialOrgId = org.id;

    try {
      // Save config with only 3 custom levels
      const documentConfig = {
        hierarchyLevels: [
          { name: 'Part', type: 'article', numbering: 'roman', prefix: 'Part ', depth: 0 },
          { name: 'Division', type: 'section', numbering: 'numeric', prefix: 'Div. ', depth: 1 },
          { name: 'Subdivision', type: 'subsection', numbering: 'letters', prefix: 'Subdiv. ', depth: 2 }
        ],
        maxDepth: 10
      };

      const result = await setupService.saveDocumentConfig(
        partialOrgId,
        documentConfig,
        supabase
      );

      expect(result.success).toBe(true);

      // Verify saved config
      const { data: savedOrg } = await supabase
        .from('organizations')
        .select('hierarchy_config')
        .eq('id', partialOrgId)
        .single();

      console.log(`\n🔧 Partial Hierarchy Test:`);
      console.log(`  - Custom levels provided: 3`);
      console.log(`  - Total levels in DB: ${savedOrg.hierarchy_config.levels.length}`);

      // Should still have 10 levels total (3 custom + 7 defaults)
      expect(savedOrg.hierarchy_config.levels.length).toBe(10);

      // Verify custom levels
      expect(savedOrg.hierarchy_config.levels[0].name).toBe('Part');
      expect(savedOrg.hierarchy_config.levels[1].name).toBe('Division');
      expect(savedOrg.hierarchy_config.levels[2].name).toBe('Subdivision');

      console.log(`\n📚 Full Hierarchy (partial custom):`);
      savedOrg.hierarchy_config.levels.forEach((level, idx) => {
        const isCustom = idx < 3 ? '✓' : '•';
        console.log(`  ${isCustom} ${idx}. ${level.name} (${level.type})`);
      });

    } finally {
      // Cleanup
      await supabase.from('organizations').delete().eq('id', partialOrgId);
    }
  });
});
