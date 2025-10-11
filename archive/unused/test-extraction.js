const wordParser = require('../src/parsers/wordParser');

// Test cases from actual document
const testCases = [
  {
    line: "Section 1: Mission. The MISSION of the RNC is to encourage community participation in City Governance and make government more responsive to local needs",
    fullMatch: "Section 1"
  },
  {
    line: "Section 8: Censure – The purpose of the censure process is to place a Board member on notice of misconduct and to assist in remedying the behavior",
    fullMatch: "Section 8"
  },
  {
    line: "Section 9: Removal of Governing Board Members – Any Board member may be removed by the Neighborhood Council for good cause",
    fullMatch: "Section 9"
  },
  {
    line: "Section 1: Officers of the Board – The Officers of the Board shall consist of a President, Vice President, Corresponding Secretary, Recording Secretary and Treasurer",
    fullMatch: "Section 1"
  }
];

console.log('=== TESTING extractTitleAndContent ===\n');

testCases.forEach((test, i) => {
  const detectedItem = { fullMatch: test.fullMatch };
  const result = wordParser.extractTitleAndContent(test.line, detectedItem);
  
  console.log(`Test ${i + 1}:`);
  console.log(`  Input: "${test.line.substring(0, 100)}..."`);
  console.log(`  Title: "${result.title}"`);
  console.log(`  Content: "${result.contentOnSameLine ? result.contentOnSameLine.substring(0, 80) : 'NULL'}..."`);
  
  if (result.contentOnSameLine) {
    const words = result.contentOnSameLine.split(/\s+/).filter(w => w.trim().length > 0).length;
    console.log(`  Content words: ${words}`);
  }
  console.log();
});
