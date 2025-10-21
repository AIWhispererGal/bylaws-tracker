/**
 * Full Integration Test: Both Fixes Together
 * Tests custom hierarchy + context-aware parser working together
 */

const setupService = require('../../src/services/setupService');
const wordParser = require('../../src/parsers/wordParser');
const sectionStorage = require('../../src/services/sectionStorage');
const { createClient } = require('@supabase/supabase-js');

const TEST_DOCUMENT = '/mnt/c/Users/mgall/OneDrive/Desktop/RNCBYLAWS_2024.docx';

describe('Full Integration: Custom Hierarchy + Context-Aware Parser', () => {
  let supabase;
  let testOrgId;
  let testDocId;

  beforeAll(async () => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  });

  afterAll(async () => {
    // Cleanup
    if (testDocId) {
      await supabase.from('document_sections').delete().eq('document_id', testDocId);
      await supabase.from('documents').delete().eq('id', testDocId);
    }
    if (testOrgId) {
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
    console.log('✓ Cleanup complete');
  });

  test('INTEGRATION: Setup org with custom hierarchy and upload RNCBYLAWS', async () => {
    console.log('\n🚀 Starting Full Integration Test');
    console.log('=' .repeat(60));

    // Step 1: Create organization
    console.log('\n📝 Step 1: Create Organization');
    const orgResult = await setupService.createOrganization({
      name: `Integration Test Org ${Date.now()}`,
      type: 'neighborhood-council'
    }, supabase);

    expect(orgResult.success).toBe(true);
    testOrgId = orgResult.organization.id;
    console.log(`  ✓ Created org: ${testOrgId}`);

    // Step 2: Configure custom hierarchy
    console.log('\n🏗️  Step 2: Configure Custom Hierarchy');
    const hierarchyResult = await setupService.saveDocumentConfig(
      testOrgId,
      {
        hierarchyLevels: [
          { name: 'Chapter', type: 'article', numbering: 'roman', prefix: 'Chapter ', depth: 0 },
          { name: 'Clause', type: 'section', numbering: 'letters', prefix: 'Clause ', depth: 1 },
          { name: 'Provision', type: 'subsection', numbering: 'numeric', prefix: 'Provision ', depth: 2 }
        ],
        maxDepth: 10
      },
      supabase
    );

    expect(hierarchyResult.success).toBe(true);
    console.log('  ✓ Saved custom hierarchy');

    // Verify hierarchy was saved correctly
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    expect(org.hierarchy_config.levels.length).toBe(10);
    console.log(`  ✓ Verified 10 levels in database`);

    // Step 3: Parse document with custom hierarchy
    console.log('\n📄 Step 3: Parse Document with Custom Hierarchy');
    const config = {
      hierarchy: org.hierarchy_config,
      terminology: {
        documentName: 'Bylaws',
        sectionName: 'Clause',
        articleName: 'Chapter'
      }
    };

    const startTime = Date.now();
    const parseResult = await wordParser.parseDocument(TEST_DOCUMENT, config);
    const parseTime = Date.now() - startTime;

    expect(parseResult.success).toBe(true);
    console.log(`  ✓ Parsed in ${parseTime}ms`);
    console.log(`  ✓ Found ${parseResult.sections.length} sections`);

    // Step 4: Validate - NO depth errors
    console.log('\n✅ Step 4: Validate Sections');
    const validation = wordParser.validateSections(parseResult.sections, config);

    console.log(`  - Valid: ${validation.valid}`);
    console.log(`  - Errors: ${validation.errors?.length || 0}`);
    console.log(`  - Warnings: ${validation.warnings?.length || 0}`);

    if (validation.errors && validation.errors.length > 0) {
      console.log('\n  ❌ Validation Errors Found:');
      validation.errors.forEach(err => {
        console.log(`     - ${err.message}`);
      });
    }

    // Check for depth errors specifically
    const depthErrors = validation.errors?.filter(e =>
      e.message?.toLowerCase().includes('depth')
    ) || [];

    expect(depthErrors.length).toBe(0);
    expect(validation.valid).toBe(true);
    console.log('  ✓ No depth validation errors!');

    // Step 5: Store in database
    console.log('\n💾 Step 5: Store Sections in Database');
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        organization_id: testOrgId,
        title: 'RNCBYLAWS_2024 Integration Test',
        document_type: 'bylaws',
        status: 'draft',
        metadata: { test: 'integration' }
      })
      .select()
      .single();

    expect(docError).toBeNull();
    testDocId = doc.id;

    const storeResult = await sectionStorage.storeSections(
      testOrgId,
      testDocId,
      parseResult.sections,
      supabase
    );

    expect(storeResult.success).toBe(true);
    console.log(`  ✓ Stored ${storeResult.sectionsStored} sections`);

    // Step 6: Verify in database
    console.log('\n🔍 Step 6: Verify Database State');
    const { data: sections, error: queryError } = await supabase
      .from('document_sections')
      .select('id, citation, depth, parent_id')
      .eq('document_id', testDocId)
      .order('depth, citation');

    expect(queryError).toBeNull();
    expect(sections.length).toBeGreaterThan(0);

    // Check depth distribution
    const depthDist = {};
    sections.forEach(s => {
      depthDist[s.depth] = (depthDist[s.depth] || 0) + 1;
    });

    console.log('\n  📊 Depth Distribution in Database:');
    Object.entries(depthDist).forEach(([depth, count]) => {
      console.log(`     Depth ${depth}: ${count} sections`);
    });

    // All depths should be 0-9
    sections.forEach(section => {
      expect(section.depth).toBeGreaterThanOrEqual(0);
      expect(section.depth).toBeLessThanOrEqual(9);
    });

    console.log('  ✓ All depths within valid range (0-9)');

    // Show sample sections
    console.log('\n  📋 Sample Sections (first 10):');
    sections.slice(0, 10).forEach(s => {
      console.log(`     ${s.citation} (depth: ${s.depth})`);
    });

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 INTEGRATION TEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`✅ Organization created with custom hierarchy`);
    console.log(`✅ Document parsed successfully (${parseResult.sections.length} sections)`);
    console.log(`✅ No depth validation errors`);
    console.log(`✅ All sections stored in database`);
    console.log(`✅ All depths within valid range`);
    console.log('='.repeat(60));
  });
});
