/**
 * Quick validation test for 10-level depth detection
 * Tests Priority 1A and 1B fixes
 */

const hierarchyDetector = require('../src/parsers/hierarchyDetector');
const fs = require('fs');
const path = require('path');

// Test configuration matching default organization config
const testConfig = {
  hierarchy: {
    levels: [
      { name: 'Article', type: 'article', numbering: 'roman', prefix: 'ARTICLE ', depth: 0 },
      { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 },
      { name: 'Subsection', type: 'subsection', numbering: 'numeric', prefix: '', depth: 2 },
      { name: 'Paragraph', type: 'paragraph', numbering: 'alpha', prefix: '', depth: 3 },
      { name: 'Subparagraph', type: 'subparagraph', numbering: 'numeric', prefix: '', depth: 4 },
      { name: 'Clause', type: 'clause', numbering: 'alphaLower', prefix: '(', depth: 5 },
      { name: 'Subclause', type: 'subclause', numbering: 'roman', prefix: '', depth: 6 },
      { name: 'Item', type: 'item', numbering: 'alpha', prefix: '', depth: 7 },
      { name: 'Subitem', type: 'subitem', numbering: 'alphaLower', prefix: '', depth: 8 },
      { name: 'Point', type: 'point', numbering: 'alpha', prefix: '', depth: 9 }
    ],
    maxDepth: 10
  }
};

console.log('🧪 Testing 10-Level Hierarchy Detection\n');
console.log('=' .repeat(60));

// Read test document
const testFile = path.join(__dirname, 'fixtures', 'test-10-level-hierarchy.txt');
const text = fs.readFileSync(testFile, 'utf8');

console.log('📄 Test document loaded:', testFile);
console.log('📏 Document length:', text.length, 'characters\n');

// Run detection
console.log('🔍 Running hierarchy detection...\n');
const detected = hierarchyDetector.detectHierarchy(text, testConfig);

console.log(`✅ Detected ${detected.length} hierarchy items\n`);

// Analyze by depth
const depthDistribution = {};
detected.forEach(item => {
  const depth = item.depth;
  if (!depthDistribution[depth]) {
    depthDistribution[depth] = [];
  }
  depthDistribution[depth].push(item);
});

// Report results
console.log('📊 DEPTH DISTRIBUTION:');
console.log('=' .repeat(60));

for (let depth = 0; depth <= 9; depth++) {
  const items = depthDistribution[depth] || [];
  const status = items.length > 0 ? '✅' : '❌';
  console.log(`${status} Depth ${depth}: ${items.length} items detected`);

  if (items.length > 0) {
    items.forEach(item => {
      console.log(`   - ${item.type}: "${item.fullMatch}" (${item.numberingScheme})`);
    });
  }
}

console.log('\n' + '=' .repeat(60));

// Summary
const maxDepthDetected = Math.max(...Object.keys(depthDistribution).map(Number));
const totalDepthsCovered = Object.keys(depthDistribution).length;

console.log('\n📈 SUMMARY:');
console.log(`   Maximum depth detected: ${maxDepthDetected}`);
console.log(`   Total depth levels covered: ${totalDepthsCovered}/10`);
console.log(`   Total items detected: ${detected.length}`);

// Success criteria
const SUCCESS_THRESHOLD = 6; // Should detect at least 6 levels after fixes
if (maxDepthDetected >= SUCCESS_THRESHOLD) {
  console.log(`\n✅ SUCCESS: Detected depth ${maxDepthDetected} >= threshold ${SUCCESS_THRESHOLD}`);
  console.log('   Priority 1A and 1B fixes are working!');
} else {
  console.log(`\n❌ NEEDS WORK: Only detected depth ${maxDepthDetected}, expected ${SUCCESS_THRESHOLD}+`);
}

console.log('\n' + '=' .repeat(60));

// Detailed items list
console.log('\n📋 DETAILED DETECTION LIST:');
console.log('=' .repeat(60));
detected.forEach((item, index) => {
  console.log(`${index + 1}. [Depth ${item.depth}] ${item.type}: ${item.fullMatch}`);
  console.log(`   Number: ${item.number}, Scheme: ${item.numberingScheme}`);
  if (item.lineNumber) {
    console.log(`   Line: ${item.lineNumber}, Text: "${item.lineText?.substring(0, 50)}..."`);
  }
  console.log();
});
