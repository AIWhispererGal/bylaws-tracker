/**
 * Integration Test: Context-Aware Parser Fix
 * Tests the fix for "depth jumped" validation errors
 */

const wordParser = require('../../src/parsers/wordParser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Test document path
const TEST_DOCUMENT = '/mnt/c/Users/mgall/OneDrive/Desktop/RNCBYLAWS_2024.docx';

describe('Context-Aware Parser Fix - RNCBYLAWS_2024.docx', () => {
  let supabase;
  let testOrgId;
  let testDocId;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: `Test Org - Context Parser ${Date.now()}`,
        org_type: 'test',
        hierarchy_config: {
          levels: [
            { name: 'Article', type: 'article', numbering: 'roman', prefix: 'Article ', depth: 0 },
            { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 },
            { name: 'Subsection', type: 'subsection', numbering: 'letters', prefix: 'Subsection ', depth: 2 },
            { name: 'Paragraph', type: 'paragraph', numbering: 'numeric', prefix: 'Para. ', depth: 3 },
            { name: 'Subparagraph', type: 'subparagraph', numbering: 'letters', prefix: 'Subpara. ', depth: 4 },
            { name: 'Clause', type: 'clause', numbering: 'roman-lower', prefix: 'Clause ', depth: 5 },
            { name: 'Subclause', type: 'subclause', numbering: 'numeric', prefix: 'Subclause ', depth: 6 },
            { name: 'Item', type: 'item', numbering: 'letters', prefix: 'Item ', depth: 7 },
            { name: 'Subitem', type: 'subitem', numbering: 'numeric', prefix: 'Subitem ', depth: 8 },
            { name: 'Point', type: 'point', numbering: 'letters', prefix: 'Point ', depth: 9 }
          ],
          maxDepth: 10
        },
        is_configured: true
      })
      .select()
      .single();

    if (orgError) throw new Error(`Failed to create test org: ${orgError.message}`);
    testOrgId = org.id;
    console.log(`✓ Created test organization: ${testOrgId}`);
  });

  afterAll(async () => {
    // Cleanup: delete test data
    if (testDocId) {
      await supabase.from('document_sections').delete().eq('document_id', testDocId);
      await supabase.from('documents').delete().eq('id', testDocId);
    }
    if (testOrgId) {
      await supabase.from('organizations').delete().eq('id', testOrgId);
    }
    console.log('✓ Cleanup complete');
  });

  test('should parse RNCBYLAWS_2024.docx without depth errors', async () => {
    // Load organization config
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    const config = {
      hierarchy: org.hierarchy_config
    };

    // Parse document
    const startTime = Date.now();
    const result = await wordParser.parseDocument(TEST_DOCUMENT, config);
    const parseTime = Date.now() - startTime;

    console.log(`\n📊 Parse Results:`);
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Parse time: ${parseTime}ms`);
    console.log(`  - Sections parsed: ${result.sections?.length || 0}`);
    console.log(`  - Metadata:`, result.metadata);

    // Assertions
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.sections).toBeDefined();
    expect(result.sections.length).toBeGreaterThan(0);
  });

  test('should assign contextual depths correctly', async () => {
    // Load organization config
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    const config = {
      hierarchy: org.hierarchy_config
    };

    // Parse document
    const result = await wordParser.parseDocument(TEST_DOCUMENT, config);

    expect(result.success).toBe(true);

    // Check depth distribution
    const depthCounts = {};
    result.sections.forEach(section => {
      depthCounts[section.depth] = (depthCounts[section.depth] || 0) + 1;
    });

    console.log(`\n📏 Depth Distribution:`);
    Object.entries(depthCounts).forEach(([depth, count]) => {
      console.log(`  - Depth ${depth}: ${count} sections`);
    });

    // Validate depths are within bounds (0-9)
    result.sections.forEach(section => {
      expect(section.depth).toBeGreaterThanOrEqual(0);
      expect(section.depth).toBeLessThanOrEqual(9);
    });
  });

  test('should not have "depth jumped" validation errors', async () => {
    // Load organization config
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    const config = {
      hierarchy: org.hierarchy_config
    };

    // Parse document
    const result = await wordParser.parseDocument(TEST_DOCUMENT, config);
    expect(result.success).toBe(true);

    // Validate sections
    const validation = wordParser.validateSections(result.sections, config);

    console.log(`\n✅ Validation Results:`);
    console.log(`  - Valid: ${validation.valid}`);
    console.log(`  - Errors: ${validation.errors?.length || 0}`);
    console.log(`  - Warnings: ${validation.warnings?.length || 0}`);

    if (validation.errors && validation.errors.length > 0) {
      console.log('\n❌ Validation Errors:');
      validation.errors.forEach(err => {
        console.log(`  - ${err.message}`);
        if (err.section) console.log(`    Section: ${err.section}`);
      });
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      validation.warnings.forEach(warn => {
        console.log(`  - ${warn.message}`);
      });
    }

    // Should not have "depth jumped" errors
    const depthErrors = validation.errors?.filter(e =>
      e.message?.includes('depth jumped') ||
      e.message?.includes('Depth jumped')
    ) || [];

    expect(depthErrors.length).toBe(0);
    expect(validation.valid).toBe(true);
  });

  test('should store sections in database successfully', async () => {
    // Load organization config
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    const config = {
      hierarchy: org.hierarchy_config
    };

    // Parse document
    const result = await wordParser.parseDocument(TEST_DOCUMENT, config);
    expect(result.success).toBe(true);

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        organization_id: testOrgId,
        title: 'RNCBYLAWS_2024 Test Upload',
        document_type: 'bylaws',
        status: 'draft',
        metadata: {
          test: true,
          uploaded_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    expect(docError).toBeNull();
    testDocId = doc.id;

    // Store sections
    const sectionStorage = require('../../src/services/sectionStorage');
    const storeResult = await sectionStorage.storeSections(
      testOrgId,
      testDocId,
      result.sections,
      supabase
    );

    console.log(`\n💾 Storage Results:`);
    console.log(`  - Success: ${storeResult.success}`);
    console.log(`  - Sections stored: ${storeResult.sectionsStored}`);
    if (storeResult.error) console.log(`  - Error: ${storeResult.error}`);

    expect(storeResult.success).toBe(true);
    expect(storeResult.sectionsStored).toBeGreaterThan(0);
  });

  test('should verify stored sections have correct depths and parents', async () => {
    expect(testDocId).toBeDefined();

    // Query stored sections
    const { data: sections, error } = await supabase
      .from('document_sections')
      .select('id, citation, depth, parent_id, content')
      .eq('document_id', testDocId)
      .order('depth, citation');

    expect(error).toBeNull();
    expect(sections.length).toBeGreaterThan(0);

    console.log(`\n🗄️  Database Verification (first 20 sections):`);
    sections.slice(0, 20).forEach(section => {
      console.log(`  - ${section.citation} (depth: ${section.depth}, parent: ${section.parent_id || 'null'})`);
    });

    // Check that all depths are valid
    sections.forEach(section => {
      expect(section.depth).toBeGreaterThanOrEqual(0);
      expect(section.depth).toBeLessThanOrEqual(9);
    });

    // Check depth distribution matches what we saw during parsing
    const dbDepthCounts = {};
    sections.forEach(section => {
      dbDepthCounts[section.depth] = (dbDepthCounts[section.depth] || 0) + 1;
    });

    console.log(`\n📊 Database Depth Distribution:`);
    Object.entries(dbDepthCounts).forEach(([depth, count]) => {
      console.log(`  - Depth ${depth}: ${count} sections`);
    });
  });

  test('should measure performance metrics', async () => {
    const { data: org } = await supabase
      .from('organizations')
      .select('hierarchy_config')
      .eq('id', testOrgId)
      .single();

    const config = {
      hierarchy: org.hierarchy_config
    };

    // Measure memory before
    const memBefore = process.memoryUsage();

    // Parse document
    const startTime = Date.now();
    const result = await wordParser.parseDocument(TEST_DOCUMENT, config);
    const parseTime = Date.now() - startTime;

    // Measure memory after
    const memAfter = process.memoryUsage();

    // Calculate memory increase
    const heapUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    const heapTotal = (memAfter.heapTotal - memBefore.heapTotal) / 1024 / 1024;

    console.log(`\n⚡ Performance Metrics:`);
    console.log(`  - Parse time: ${parseTime}ms`);
    console.log(`  - Sections parsed: ${result.sections?.length || 0}`);
    console.log(`  - Avg time per section: ${(parseTime / result.sections.length).toFixed(2)}ms`);
    console.log(`  - Memory (heap used): ${heapUsed.toFixed(2)} MB`);
    console.log(`  - Memory (heap total): ${heapTotal.toFixed(2)} MB`);

    // Performance expectations
    expect(parseTime).toBeLessThan(30000); // Should complete in under 30 seconds
    expect(heapUsed).toBeLessThan(500); // Should use less than 500MB heap
  });
});
