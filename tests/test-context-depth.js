#!/usr/bin/env node

/**
 * Test Context-Aware Depth Calculation
 * This script tests the enhanced wordParser with context-aware depth calculation
 */

const wordParser = require('../src/parsers/wordParser');
const path = require('path');
const fs = require('fs').promises;

// Test document path (WSL format)
const TEST_DOC = '/mnt/c/Users/mgall/OneDrive/Desktop/RNCBYLAWS_2024.docx';

// Organization config with hierarchy (includes prefixes)
const orgConfig = {
  id: 'test-org',
  name: 'Test Organization',
  hierarchy: {
    levels: [
      { type: 'article', depth: 0, numbering: 'roman', prefix: 'ARTICLE' },
      { type: 'section', depth: 1, numbering: 'numeric', prefix: 'Section' },
      { type: 'subsection', depth: 2, numbering: 'alphaLower', prefix: '' },
      { type: 'paragraph', depth: 3, numbering: 'numeric', prefix: '' },
      { type: 'subparagraph', depth: 4, numbering: 'alphaLower', prefix: '' },
      { type: 'clause', depth: 5, numbering: 'alpha', prefix: '' },
      { type: 'subclause', depth: 6, numbering: 'numeric', prefix: '' },
      { type: 'item', depth: 7, numbering: 'alphaLower', prefix: '' },
      { type: 'subitem', depth: 8, numbering: 'numeric', prefix: '' },
      { type: 'point', depth: 9, numbering: 'numeric', prefix: '' }
    ]
  }
};

async function testContextDepth() {
  console.log('=' .repeat(80));
  console.log('CONTEXT-AWARE DEPTH CALCULATION TEST');
  console.log('=' .repeat(80));
  console.log('\nTest document:', TEST_DOC);

  try {
    // Check if test document exists
    await fs.access(TEST_DOC);
    console.log('✓ Test document found\n');

    // Parse the document
    console.log('Parsing document with context-aware depth calculation...\n');
    const result = await wordParser.parseDocument(TEST_DOC, orgConfig);

    if (!result.success) {
      console.error('❌ Parsing failed:', result.error);
      return;
    }

    console.log('\n' + '=' .repeat(80));
    console.log('PARSING RESULTS');
    console.log('=' .repeat(80));
    console.log('Total sections parsed:', result.sections.length);
    console.log('Metadata:', result.metadata);

    // Analyze depth distribution
    const depthStats = {};
    const typeStats = {};

    result.sections.forEach(section => {
      // Count by depth
      depthStats[section.depth] = (depthStats[section.depth] || 0) + 1;
      // Count by type
      typeStats[section.type] = (typeStats[section.type] || 0) + 1;
    });

    console.log('\n📊 DEPTH DISTRIBUTION:');
    Object.keys(depthStats).sort((a, b) => Number(a) - Number(b)).forEach(depth => {
      const bar = '█'.repeat(Math.min(50, depthStats[depth]));
      console.log(`  Depth ${depth}: ${bar} (${depthStats[depth]} sections)`);
    });

    console.log('\n📝 TYPE DISTRIBUTION:');
    Object.keys(typeStats).sort().forEach(type => {
      console.log(`  ${type}: ${typeStats[type]} sections`);
    });

    // Show hierarchy sample
    console.log('\n🌲 HIERARCHY SAMPLE (first 20 sections):');
    result.sections.slice(0, 20).forEach(section => {
      const indent = '  '.repeat(section.depth);
      const depthIndicator = `[${section.depth}]`;
      console.log(`${indent}${depthIndicator} ${section.citation}: ${section.title.substring(0, 50)}...`);
    });

    // Check for depth issues
    console.log('\n🔍 DEPTH VALIDATION:');
    let depthIssues = 0;
    let lastDepth = 0;

    result.sections.forEach((section, index) => {
      if (section.depth > lastDepth + 1 && index > 0) {
        console.log(`  ⚠️ Depth jump at index ${index}: ${result.sections[index-1].citation} (${lastDepth}) → ${section.citation} (${section.depth})`);
        depthIssues++;
      }
      lastDepth = section.depth;
    });

    if (depthIssues === 0) {
      console.log('  ✅ No depth jumps detected - hierarchy is properly nested!');
    } else {
      console.log(`  ⚠️ Found ${depthIssues} depth jumps (may be intentional based on document structure)`);
    }

    // Show sections with contextual depth info
    console.log('\n📋 CONTEXTUAL DEPTH DETAILS (sample):');
    const sampleSections = result.sections.slice(0, 10);
    sampleSections.forEach(section => {
      console.log(`\n  ${section.citation} (${section.type})`);
      console.log(`    Depth: ${section.depth}`);
      console.log(`    Parent Path: ${section.parentPath || '(root)'}`);
      console.log(`    Title: ${section.title}`);
      if (section.depthCalculationMethod) {
        console.log(`    Method: ${section.depthCalculationMethod}`);
      }
    });

    // Save results for inspection
    const outputFile = path.join(__dirname, 'context-depth-results.json');
    await fs.writeFile(
      outputFile,
      JSON.stringify(result, null, 2),
      'utf8'
    );
    console.log(`\n✅ Full results saved to: ${outputFile}`);

    console.log('\n' + '=' .repeat(80));
    console.log('TEST COMPLETE');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testContextDepth().catch(console.error);