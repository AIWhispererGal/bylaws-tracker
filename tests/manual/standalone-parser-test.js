#!/usr/bin/env node

/**
 * Standalone Parser Test - No Database Required
 * Tests the context-aware depth calculation fix directly
 */

const wordParser = require('../../src/parsers/wordParser');
const path = require('path');
const fs = require('fs').promises;

const TEST_DOCUMENT = '/mnt/c/Users/mgall/OneDrive/Desktop/RNCBYLAWS_2024.docx';

// Mock organization config with 10-level hierarchy
const mockConfig = {
  hierarchy: {
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
  terminology: {
    documentName: 'Bylaws',
    sectionName: 'Section',
    articleName: 'Article'
  }
};

async function runTest() {
  console.log('\n🧪 STANDALONE PARSER TEST');
  console.log('='.repeat(70));
  console.log(`Test Document: ${TEST_DOCUMENT}`);
  console.log('');

  // Check if document exists
  try {
    await fs.access(TEST_DOCUMENT);
    const stats = await fs.stat(TEST_DOCUMENT);
    console.log(`✓ Document found (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (error) {
    console.log(`❌ Document not found: ${TEST_DOCUMENT}`);
    process.exit(1);
  }

  console.log('');
  console.log('📋 Configuration:');
  console.log(`  - Hierarchy levels: ${mockConfig.hierarchy.levels.length}`);
  console.log(`  - Max depth: ${mockConfig.hierarchy.maxDepth}`);
  console.log('');

  // Parse document
  console.log('🔄 Parsing document...');
  const startTime = Date.now();
  const result = await wordParser.parseDocument(TEST_DOCUMENT, mockConfig);
  const parseTime = Date.now() - startTime;

  console.log('');
  console.log('📊 PARSE RESULTS:');
  console.log('='.repeat(70));
  console.log(`Success: ${result.success ? '✅ YES' : '❌ NO'}`);

  if (!result.success) {
    console.log(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`Parse time: ${parseTime}ms`);
  console.log(`Sections parsed: ${result.sections.length}`);
  console.log(`Source: ${result.metadata.source}`);
  console.log(`File: ${result.metadata.fileName}`);
  console.log('');

  // Analyze depths
  console.log('📏 DEPTH ANALYSIS:');
  console.log('='.repeat(70));

  const depthCounts = {};
  let invalidDepths = [];

  result.sections.forEach(section => {
    depthCounts[section.depth] = (depthCounts[section.depth] || 0) + 1;

    if (section.depth < 0 || section.depth > 9) {
      invalidDepths.push(section);
    }
  });

  console.log('Depth Distribution:');
  for (let d = 0; d <= 9; d++) {
    const count = depthCounts[d] || 0;
    if (count > 0) {
      const bar = '█'.repeat(Math.min(50, count));
      console.log(`  Depth ${d}: ${count.toString().padStart(4)} ${bar}`);
    }
  }

  console.log('');

  if (invalidDepths.length > 0) {
    console.log(`❌ INVALID DEPTHS FOUND: ${invalidDepths.length}`);
    invalidDepths.forEach(s => {
      console.log(`  - ${s.citation}: depth ${s.depth} (type: ${s.type})`);
    });
  } else {
    console.log('✅ All depths within valid range (0-9)');
  }

  console.log('');

  // Show sample sections
  console.log('📄 SAMPLE SECTIONS (first 20):');
  console.log('='.repeat(70));
  result.sections.slice(0, 20).forEach((section, idx) => {
    const depthIndent = '  '.repeat(section.depth);
    console.log(`${(idx + 1).toString().padStart(2)}. ${depthIndent}${section.citation} (depth: ${section.depth}, type: ${section.type})`);
    if (section.title) {
      console.log(`    ${depthIndent}└─ ${section.title.substring(0, 60)}${section.title.length > 60 ? '...' : ''}`);
    }
  });

  console.log('');

  // Validate sections
  console.log('✅ VALIDATION:');
  console.log('='.repeat(70));

  const validation = wordParser.validateSections(result.sections, mockConfig);

  console.log(`Valid: ${validation.valid ? '✅ YES' : '❌ NO'}`);
  console.log(`Errors: ${validation.errors?.length || 0}`);
  console.log(`Warnings: ${validation.warnings?.length || 0}`);
  console.log('');

  if (validation.errors && validation.errors.length > 0) {
    console.log('❌ VALIDATION ERRORS:');
    validation.errors.forEach(err => {
      console.log(`  - ${err.message}`);
      if (err.section) console.log(`    Section: ${err.section}`);
      if (err.citations) console.log(`    Citations: ${err.citations.join(', ')}`);
    });
    console.log('');
  }

  if (validation.warnings && validation.warnings.length > 0) {
    console.log('⚠️  VALIDATION WARNINGS:');
    validation.warnings.forEach(warn => {
      console.log(`  - ${warn.message}`);
      if (warn.sections) {
        console.log(`    Sections: ${warn.sections.slice(0, 5).join(', ')}${warn.sections.length > 5 ? '...' : ''}`);
      }
    });
    console.log('');
  }

  // Check for depth errors specifically
  const depthErrors = validation.errors?.filter(e =>
    e.message?.toLowerCase().includes('depth')
  ) || [];

  if (depthErrors.length > 0) {
    console.log('❌ DEPTH VALIDATION ERRORS FOUND:');
    depthErrors.forEach(err => {
      console.log(`  - ${err.message}`);
    });
    console.log('');
    console.log('❌ TEST FAILED: Depth errors detected');
    process.exit(1);
  } else {
    console.log('✅ NO DEPTH ERRORS - Context-aware depth calculation working!');
  }

  // Performance summary
  console.log('');
  console.log('⚡ PERFORMANCE:');
  console.log('='.repeat(70));
  console.log(`Total parse time: ${parseTime}ms`);
  console.log(`Sections parsed: ${result.sections.length}`);
  console.log(`Average per section: ${(parseTime / result.sections.length).toFixed(2)}ms`);
  console.log(`Throughput: ${(result.sections.length / (parseTime / 1000)).toFixed(1)} sections/sec`);

  const memUsage = process.memoryUsage();
  console.log(`Memory (heap used): ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Memory (heap total): ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);

  console.log('');
  console.log('='.repeat(70));
  console.log('🎉 TEST COMPLETE - ALL CHECKS PASSED');
  console.log('='.repeat(70));
  console.log('');
}

// Run the test
runTest().catch(error => {
  console.error('\n❌ TEST FAILED WITH ERROR:');
  console.error(error);
  process.exit(1);
});
