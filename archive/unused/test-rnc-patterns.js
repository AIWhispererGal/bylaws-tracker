/**
 * Test hierarchy pattern matching with actual RNC bylaws format
 */

const hierarchyDetector = require('../src/parsers/hierarchyDetector');

// Exact format from RNC bylaws (using tabs)
const testText = `ARTICLE I	NAME
The name of this officially recognized organization that is a part of the Los Angeles Citywide System

ARTICLE II	PURPOSE
The purpose of the RNC is to participate as a body on issues concerning our neighborhood and regarding

Section 1: Mission. The MISSION of the RNC is to encourage community participation in City Governance

Section 2: Policy. The POLICY of the RNC is:

ARTICLE III	BOUNDARIES
The RNC covers a geographic area described below.`;

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

console.log('Testing with RNC bylaws format (tabs)...\n');

const detected = hierarchyDetector.detectHierarchy(testText, config);

console.log(`Detected ${detected.length} items:\n`);
detected.forEach((item, i) => {
  console.log(`${i + 1}. "${item.fullMatch}" (${item.type}, depth ${item.depth})`);
  console.log(`   Number: ${item.number}, Prefix: "${item.prefix}"`);
});

if (detected.length > 0) {
  console.log('\n✅ SUCCESS: Patterns now match RNC bylaws format!');
} else {
  console.log('\n❌ FAILURE: Still not detecting patterns');
}
