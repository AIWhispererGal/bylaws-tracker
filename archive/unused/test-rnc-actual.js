/**
 * Test hierarchy detection with ACTUAL RNC bylaws file
 */

const fs = require('fs').promises;
const mammoth = require('mammoth');
const hierarchyDetector = require('../src/parsers/hierarchyDetector');
const path = require('path');

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

(async () => {
  console.log('Loading RNC bylaws...\n');

  const docPath = path.join(__dirname, '../uploads/setup/setup-1759980041923-342199667.docx');
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  console.log('Document loaded:');
  console.log(`  - Total characters: ${text.length}`);
  console.log(`  - Total lines: ${text.split('\n').length}`);
  console.log();

  console.log('Running hierarchyDetector.detectHierarchy()...\n');
  const detected = hierarchyDetector.detectHierarchy(text, config);

  console.log(`Detected ${detected.length} hierarchy items:\n`);

  // Show first 20 detections
  detected.slice(0, 20).forEach((item, i) => {
    console.log(`${i + 1}. "${item.fullMatch.substring(0, 30)}" (${item.type}, depth ${item.depth}, number: ${item.number})`);
  });

  if (detected.length > 20) {
    console.log(`\n... and ${detected.length - 20} more`);
  }

  // Count by type
  const byType = {};
  detected.forEach(item => {
    byType[item.type] = (byType[item.type] || 0) + 1;
  });

  console.log('\nBreakdown by type:');
  Object.keys(byType).forEach(type => {
    console.log(`  ${type}: ${byType[type]}`);
  });

  if (detected.length === 0) {
    console.log('\n❌ NO HIERARCHY DETECTED - Parser will create all orphan sections!');
  } else {
    console.log(`\n✅ Hierarchy detected successfully`);
  }
})();
