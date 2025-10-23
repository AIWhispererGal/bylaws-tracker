/**
 * Markdown Parser Depth Test
 * Validates 10-level hierarchy support (depths 0-9)
 *
 * Tests:
 * - Depth 0: ARTICLE
 * - Depth 1: Section
 * - Depth 2: Subsection
 * - Depth 3: Paragraph
 * - Depth 4: Subparagraph
 * - Depth 5: Clause
 * - Depth 6: Subclause
 * - Depth 7: Item
 * - Depth 8: Subitem
 * - Depth 9: Point
 */

const markdownParser = require('../src/parsers/markdownParser');
const path = require('path');

// Organization config with 10-level hierarchy
const testConfig = {
  id: 'test-org',
  name: 'Test Organization',
  hierarchy: {
    levels: [
      { type: 'article', prefix: 'ARTICLE ', numbering: 'roman', depth: 0 },
      { type: 'section', prefix: 'Section ', numbering: 'numeric', depth: 1 },
      { type: 'subsection', prefix: 'Subsection ', numbering: 'alpha', depth: 2 },
      { type: 'paragraph', prefix: 'Paragraph ', numbering: 'numeric', depth: 3 },
      { type: 'subparagraph', prefix: 'Subparagraph ', numbering: 'parenthetical', depth: 4 },
      { type: 'clause', prefix: 'Clause ', numbering: 'romanLower', depth: 5 },
      { type: 'subclause', prefix: 'Subclause ', numbering: 'parenthetical', depth: 6 },
      { type: 'item', prefix: 'Item ', numbering: 'numeric', depth: 7 },
      { type: 'subitem', prefix: 'Subitem ', numbering: 'parenthetical', depth: 8 },
      { type: 'point', prefix: 'Point ', numbering: 'alpha', depth: 9 }
    ]
  }
};

async function runDepthTest() {
  console.log('==========================================');
  console.log('MARKDOWN PARSER DEPTH TEST');
  console.log('==========================================\n');

  const testFile = path.join(__dirname, 'fixtures', 'test-bylaws.md');
  console.log('Test file:', testFile);
  console.log('Organization config:', testConfig.name);
  console.log('Expected hierarchy levels:', testConfig.hierarchy.levels.length);
  console.log('');

  try {
    // Parse the test document
    console.log('Parsing document...');
    const result = await markdownParser.parseDocument(testFile, testConfig, null);

    if (!result.success) {
      console.error('❌ PARSE FAILED:', result.error);
      process.exit(1);
    }

    console.log('✓ Parse successful');
    console.log('Total sections:', result.sections.length);
    console.log('');

    // Analyze depth distribution
    const depthDistribution = {};
    const depthExamples = {};

    for (const section of result.sections) {
      const depth = section.depth || 0;
      depthDistribution[depth] = (depthDistribution[depth] || 0) + 1;

      // Store first example of each depth
      if (!depthExamples[depth]) {
        depthExamples[depth] = {
          citation: section.citation,
          type: section.type,
          title: section.title.substring(0, 40)
        };
      }
    }

    // Print depth distribution
    console.log('==========================================');
    console.log('DEPTH DISTRIBUTION');
    console.log('==========================================');
    const detectedDepths = Object.keys(depthDistribution).map(Number).sort((a, b) => a - b);

    for (const depth of detectedDepths) {
      const count = depthDistribution[depth];
      const example = depthExamples[depth];
      const levelDef = testConfig.hierarchy.levels.find(l => l.depth === depth);
      const expectedType = levelDef?.type || 'unknown';

      console.log(`Depth ${depth} (${expectedType}):`.padEnd(30),
        `${count} sections`.padEnd(15),
        `Example: ${example.citation} - ${example.title}...`);
    }
    console.log('');

    // Validate all 10 depths are present
    console.log('==========================================');
    console.log('DEPTH VALIDATION (0-9)');
    console.log('==========================================');

    let allDepthsPresent = true;
    const missingDepths = [];

    for (let depth = 0; depth <= 9; depth++) {
      const hasDepth = depthDistribution[depth] > 0;
      const levelDef = testConfig.hierarchy.levels.find(l => l.depth === depth);
      const status = hasDepth ? '✓' : '✗';
      const statusText = hasDepth ? 'PRESENT' : 'MISSING';

      console.log(`${status} Depth ${depth} (${levelDef?.type || 'unknown'}): ${statusText}`);

      if (!hasDepth) {
        allDepthsPresent = false;
        missingDepths.push(depth);
      }
    }
    console.log('');

    // Print metadata
    console.log('==========================================');
    console.log('MARKDOWN FEATURES DETECTED');
    console.log('==========================================');
    const features = result.metadata.markdownFeatures;
    console.log('Headers:', JSON.stringify(features.headers, null, 2));
    console.log('Lists:', JSON.stringify(features.lists, null, 2));
    console.log('Links:', JSON.stringify(features.links, null, 2));
    console.log('Code blocks:', JSON.stringify(features.codeBlocks, null, 2));
    console.log('');

    // Print sample hierarchy
    console.log('==========================================');
    console.log('SAMPLE HIERARCHY (First 15 sections)');
    console.log('==========================================');
    result.sections.slice(0, 15).forEach(section => {
      const indent = '  '.repeat(section.depth);
      console.log(`${indent}[${section.depth}] ${section.citation}: ${section.title.substring(0, 50)}...`);
    });
    console.log('');

    // Final result
    console.log('==========================================');
    console.log('TEST RESULT');
    console.log('==========================================');

    if (allDepthsPresent) {
      console.log('✅ SUCCESS: All 10 depth levels (0-9) detected!');
      console.log('');
      console.log('Summary:');
      console.log('- Total sections:', result.sections.length);
      console.log('- Depth range:', `${detectedDepths[0]} to ${detectedDepths[detectedDepths.length - 1]}`);
      console.log('- Unique depths:', detectedDepths.length);
      console.log('- Markdown parser: FULLY OPERATIONAL ✓');
      process.exit(0);
    } else {
      console.log(`❌ INCOMPLETE: Missing depths: ${missingDepths.join(', ')}`);
      console.log('');
      console.log('Detected depths:', detectedDepths.join(', '));
      console.log('Missing depths:', missingDepths.join(', '));
      console.log('');
      console.log('This may indicate:');
      console.log('1. Test document needs more hierarchy examples');
      console.log('2. Markdown preprocessing needs adjustment');
      console.log('3. Hierarchy detection patterns need refinement');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ TEST FAILED WITH ERROR:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runDepthTest();
