/**
 * Test hierarchy pattern matching
 */

const hierarchyDetector = require('../src/parsers/hierarchyDetector');

const testText = `
ARTICLE I NAME
This is the content of Article I.

ARTICLE II PURPOSE
This is the content of Article II.

Section 1: Boundary Description
Content for section 1.

Section 2: Internal Boundaries
Content for section 2.

ARTICLE III BOUNDARIES
More content here.
`;

const config = {
  hierarchy: {
    levels: [
      {
        name: 'Article',
        type: 'article',
        numbering: 'roman',
        prefix: 'Article ',
        depth: 0
      },
      {
        name: 'Section',
        type: 'section',
        numbering: 'numeric',
        prefix: 'Section ',
        depth: 1
      }
    ]
  }
};

console.log('Testing hierarchy detection...\n');
console.log('Config:', JSON.stringify(config.hierarchy, null, 2));
console.log('\nTest text:');
console.log(testText);
console.log('\n--- Detection Results ---\n');

const detected = hierarchyDetector.detectHierarchy(testText, config);

console.log(`Detected ${detected.length} items:`);
detected.forEach((item, i) => {
  console.log(`${i + 1}. ${item.fullMatch} (${item.type}, depth ${item.depth})`);
  console.log(`   Number: ${item.number}, Index: ${item.index}`);
});

console.log('\n--- Inferred Hierarchy (no config) ---\n');

const inferred = hierarchyDetector.inferHierarchy(testText);
console.log(`Inferred ${inferred.length} items:`);
inferred.forEach((item, i) => {
  console.log(`${i + 1}. ${item.fullMatch} (${item.type}, depth ${item.depth})`);
  console.log(`   Number: ${item.number}, Index: ${item.index}`);
});
