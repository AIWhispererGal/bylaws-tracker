/**
 * TextParser Depth Detection Test
 * Validates 10-level hierarchy parsing for .txt files
 *
 * Tests:
 * - Article level (depth 0)
 * - Section level (depth 1)
 * - Numbered subsections 1., 2. (depth 2)
 * - Letter subsections A., B. (depth 3)
 * - Numbered paragraphs 1., 2. (depth 4)
 * - Parenthetical paragraphs (a), (b) (depth 5)
 * - Roman numerals i., ii. (depth 6)
 * - Capital letters A., B. (depth 7)
 * - Lowercase letters a., b. (depth 8)
 * - Final level i., α (depth 9)
 */

const path = require('path');
const textParser = require('../src/parsers/textParser');

// Mock organization config with 10-level hierarchy
const mockOrgConfig = {
  id: 'test-org',
  name: 'Test Organization',
  hierarchy: {
    levels: [
      { type: 'article', depth: 0, prefix: 'ARTICLE ', numbering: 'roman' },
      { type: 'section', depth: 1, prefix: 'Section ', numbering: 'numeric' },
      { type: 'subsection', depth: 2, prefix: '', numbering: 'numeric' },
      { type: 'paragraph', depth: 3, prefix: '', numbering: 'alphaUpper' },
      { type: 'subparagraph', depth: 4, prefix: '', numbering: 'numeric' },
      { type: 'clause', depth: 5, prefix: '', numbering: 'alphaLower' },
      { type: 'subclause', depth: 6, prefix: '', numbering: 'romanLower' },
      { type: 'item', depth: 7, prefix: '', numbering: 'alphaUpper' },
      { type: 'subitem', depth: 8, prefix: '', numbering: 'alphaLower' },
      { type: 'point', depth: 9, prefix: '', numbering: 'romanLower' }
    ]
  }
};

async function runTests() {
  console.log('\n========================================');
  console.log('TextParser 10-Level Depth Detection Test');
  console.log('========================================\n');

  const testFilePath = path.join(__dirname, 'fixtures', 'test-10-level-hierarchy.txt');

  try {
    console.log('📄 Parsing test file:', testFilePath);
    console.log('');

    const result = await textParser.parseDocument(
      testFilePath,
      mockOrgConfig,
      null
    );

    if (!result.success) {
      console.error('❌ FAILED: Parsing error:', result.error);
      process.exit(1);
    }

    console.log('✅ Parse successful!');
    console.log('   Sections found:', result.sections.length);
    console.log('   Source type:', result.metadata.source);
    console.log('');

    // Analyze depth distribution
    const depthDistribution = {};
    const sectionsByDepth = {};

    for (const section of result.sections) {
      const depth = section.depth;
      depthDistribution[depth] = (depthDistribution[depth] || 0) + 1;

      if (!sectionsByDepth[depth]) {
        sectionsByDepth[depth] = [];
      }
      sectionsByDepth[depth].push(section);
    }

    console.log('📊 Depth Distribution:');
    console.log('======================');
    for (let depth = 0; depth <= 9; depth++) {
      const count = depthDistribution[depth] || 0;
      const status = count > 0 ? '✓' : '✗';
      console.log(`   Depth ${depth}: ${status} ${count} section(s)`);
    }
    console.log('');

    // Display sample sections at each depth
    console.log('📋 Sample Sections by Depth:');
    console.log('=============================');
    for (let depth = 0; depth <= 9; depth++) {
      const sections = sectionsByDepth[depth] || [];
      if (sections.length > 0) {
        console.log(`\n   Depth ${depth} (${sections.length} section(s)):`);
        const sample = sections[0];
        const indent = '  '.repeat(depth + 2);
        console.log(`${indent}Citation: ${sample.citation}`);
        console.log(`${indent}Type: ${sample.type}`);
        console.log(`${indent}Title: ${sample.title}`);
        console.log(`${indent}Number: ${sample.number}`);
        if (sample.text) {
          console.log(`${indent}Content: ${sample.text.substring(0, 50)}...`);
        }
        if (sample.indentation !== undefined) {
          console.log(`${indent}Indentation: ${sample.indentation}`);
        }
      }
    }
    console.log('');

    // Validation checks
    console.log('🔍 Validation Checks:');
    console.log('=====================');

    const checks = {
      'All 10 depths present (0-9)': Object.keys(depthDistribution).length === 10,
      'Article at depth 0': sectionsByDepth[0]?.some(s => s.type === 'article'),
      'Section at depth 1': sectionsByDepth[1]?.some(s => s.type === 'section'),
      'Depth 2+ sections exist': Object.keys(depthDistribution).some(d => parseInt(d) >= 2),
      'All sections have content': result.sections.every(s => s.text && s.text.length > 0),
      'All sections have citations': result.sections.every(s => s.citation),
      'All sections have types': result.sections.every(s => s.type),
      'Max depth is 9 or less': Math.max(...result.sections.map(s => s.depth)) <= 9,
      'Min depth is 0': Math.min(...result.sections.map(s => s.depth)) === 0
    };

    let passCount = 0;
    let failCount = 0;

    for (const [check, passed] of Object.entries(checks)) {
      if (passed) {
        console.log(`   ✅ ${check}`);
        passCount++;
      } else {
        console.log(`   ❌ ${check}`);
        failCount++;
      }
    }

    console.log('');
    console.log('📈 Test Summary:');
    console.log('================');
    console.log(`   Total checks: ${passCount + failCount}`);
    console.log(`   Passed: ${passCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log(`   Success rate: ${Math.round((passCount / (passCount + failCount)) * 100)}%`);
    console.log('');

    // Display full hierarchy tree
    console.log('🌳 Full Hierarchy Tree:');
    console.log('=======================');
    for (const section of result.sections.slice(0, 20)) { // First 20 sections
      const indent = '  '.repeat(section.depth);
      console.log(`${indent}[${section.depth}] ${section.citation} - ${section.title}`);
    }
    if (result.sections.length > 20) {
      console.log(`   ... and ${result.sections.length - 20} more sections`);
    }
    console.log('');

    // Final verdict
    if (failCount === 0) {
      console.log('🎉 ALL TESTS PASSED! TextParser successfully handles 10-level hierarchy!');
      console.log('');
      return 0;
    } else {
      console.log(`⚠️  ${failCount} test(s) failed. Review output above.`);
      console.log('');
      return 1;
    }

  } catch (error) {
    console.error('❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    return 1;
  }
}

// Run tests
if (require.main === module) {
  runTests().then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
