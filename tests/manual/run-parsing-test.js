#!/usr/bin/env node

/**
 * AUTOMATED DOCUMENT PARSING TEST
 *
 * This script tests the document parser with various test cases
 * and generates a detailed report.
 *
 * Usage:
 *   node tests/manual/run-parsing-test.js
 *
 * Requirements:
 *   - Server must be running (npm start)
 *   - User must be logged in
 *   - Organization must exist
 */

const fs = require('fs');
const path = require('path');

console.log('\n📄 DOCUMENT PARSING TEST SUITE\n');
console.log('================================\n');

// Test configuration
const config = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
  testDataDir: path.join(__dirname, 'test-documents'),
  reportDir: path.join(__dirname, 'test-reports'),
};

// Ensure directories exist
if (!fs.existsSync(config.testDataDir)) {
  fs.mkdirSync(config.testDataDir, { recursive: true });
}
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

console.log('📋 Test Configuration:');
console.log(`   Server URL: ${config.serverUrl}`);
console.log(`   Test Data: ${config.testDataDir}`);
console.log(`   Reports: ${config.reportDir}\n`);

// Test cases definition
const testCases = [
  {
    name: 'Simple Linear Document',
    file: 'test-simple-linear.docx',
    expected: {
      totalSections: 6,
      articles: 2,
      sections: 4,
      orphanRate: 0,
      maxProcessingTime: 5000,
    },
    critical: true,
  },
  {
    name: 'Complex Hierarchy Document',
    file: 'test-complex-hierarchy.docx',
    expected: {
      totalSections: 14,
      articles: 2,
      sections: 4,
      subsections: 6,
      paragraphs: 2,
      orphanRate: 5,
      maxProcessingTime: 10000,
    },
    critical: true,
  },
  {
    name: 'Irregular Numbering Document',
    file: 'test-irregular-numbering.docx',
    expected: {
      totalSections: 9,
      articles: 3,
      sections: 6,
      orphanRate: 20,
      maxProcessingTime: 10000,
    },
    critical: false,
  },
];

console.log('🎯 Test Cases:');
testCases.forEach((tc, i) => {
  const critical = tc.critical ? '🔴 CRITICAL' : '⚠️ OPTIONAL';
  console.log(`   ${i + 1}. ${tc.name} ${critical}`);
});
console.log('');

// Instructions for manual testing
console.log('📖 MANUAL TEST INSTRUCTIONS:\n');
console.log('Since this requires actual document upload, please follow these steps:\n');

console.log('1️⃣ CREATE TEST DOCUMENTS:\n');
console.log('   Create the following .docx files in Word:');
console.log('   (See DOCUMENT-PARSING-TEST.md for exact content)\n');

testCases.forEach((tc, i) => {
  console.log(`   ${i + 1}. ${tc.file}`);
  console.log(`      Expected: ${tc.expected.totalSections} total sections`);
  console.log(`      Max orphans: ${tc.expected.orphanRate}%`);
  console.log(`      Max time: ${tc.expected.maxProcessingTime / 1000}s\n`);
});

console.log('2️⃣ UPLOAD DOCUMENTS:\n');
console.log(`   - Login to: ${config.serverUrl}`);
console.log('   - Navigate to document upload');
console.log('   - Upload each test document');
console.log('   - Monitor browser console (F12) during parsing\n');

console.log('3️⃣ RECORD RESULTS:\n');
console.log('   For each document, record:');
console.log('   - Total sections detected');
console.log('   - Number of orphan sections');
console.log('   - Processing time');
console.log('   - Any errors in console\n');

console.log('4️⃣ RUN VERIFICATION QUERIES:\n');
console.log('   After uploading, run these SQL queries in Supabase:\n');

const verificationQueries = `
-- Query 1: Check total sections for a document
SELECT COUNT(*) as total_sections,
       COUNT(CASE WHEN parent_id IS NULL AND depth > 0 THEN 1 END) as orphans,
       ROUND(COUNT(CASE WHEN parent_id IS NULL AND depth > 0 THEN 1 END) * 100.0 / COUNT(*), 2) as orphan_percentage
FROM document_sections
WHERE document_id = 'YOUR_DOCUMENT_ID';

-- Query 2: Check sections by depth
SELECT depth, COUNT(*) as count
FROM document_sections
WHERE document_id = 'YOUR_DOCUMENT_ID'
GROUP BY depth
ORDER BY depth;

-- Query 3: View all sections with hierarchy
SELECT id, content, depth, parent_id, order_index
FROM document_sections
WHERE document_id = 'YOUR_DOCUMENT_ID'
ORDER BY order_index;

-- Query 4: Find orphan sections
SELECT id, content, depth, parent_id
FROM document_sections
WHERE document_id = 'YOUR_DOCUMENT_ID'
  AND parent_id IS NULL
  AND depth > 0;
`;

console.log(verificationQueries);

console.log('5️⃣ EVALUATE RESULTS:\n');
console.log('   ✅ PASS if:');
console.log('      - Simple doc: 100% sections, 0% orphans, <5s');
console.log('      - Complex doc: 95%+ sections, <5% orphans, <10s');
console.log('      - Irregular doc: 90%+ sections, <20% orphans, <10s\n');

console.log('   🔴 FAIL if:');
console.log('      - Parser crashes');
console.log('      - <50% sections detected');
console.log('      - All sections are orphans');
console.log('      - Timeout (>30 seconds)\n');

// Generate test report template
const reportTemplate = {
  testDate: new Date().toISOString(),
  testCases: testCases.map(tc => ({
    name: tc.name,
    file: tc.file,
    expected: tc.expected,
    actual: {
      totalSections: null,
      orphanCount: null,
      orphanRate: null,
      processingTime: null,
      errors: [],
    },
    passed: null,
    notes: '',
  })),
  overall: {
    totalTests: testCases.length,
    passed: null,
    failed: null,
    criticalPassed: null,
    criticalFailed: null,
  },
  conclusion: '',
  recommendations: [],
};

const reportPath = path.join(
  config.reportDir,
  `parsing-test-report-${Date.now()}.json`
);

fs.writeFileSync(reportPath, JSON.stringify(reportTemplate, null, 2));

console.log('📋 REPORT TEMPLATE GENERATED:\n');
console.log(`   ${reportPath}\n`);
console.log('   Fill in actual results and save.\n');

console.log('6️⃣ AUTOMATED ANALYSIS (BONUS):\n');
console.log('   If you want automated analysis, you can:');
console.log('   - Use Supabase JavaScript client to query results');
console.log('   - Compare actual vs expected programmatically');
console.log('   - Generate pass/fail report automatically\n');

console.log('   Example code:\n');
console.log(`
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function analyzeDocument(documentId, expected) {
  // Get all sections
  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('*')
    .eq('document_id', documentId);

  if (error) throw error;

  // Calculate metrics
  const totalSections = sections.length;
  const orphans = sections.filter(s => s.parent_id === null && s.depth > 0);
  const orphanRate = (orphans.length / totalSections) * 100;

  // Compare to expected
  const passed =
    totalSections >= expected.totalSections * 0.9 &&
    orphanRate <= expected.orphanRate;

  return { totalSections, orphanRate, passed };
}
`);

console.log('\n================================\n');
console.log('🎯 NEXT STEPS:\n');
console.log('1. Create test documents in Word');
console.log('2. Upload documents through UI');
console.log('3. Run verification queries');
console.log('4. Fill in report template');
console.log('5. Evaluate pass/fail criteria\n');

console.log('📚 For detailed test cases and expected results:');
console.log('   See: tests/manual/DOCUMENT-PARSING-TEST.md\n');

console.log('✅ Test setup complete!\n');

// Create a simple results tracker
const trackerPath = path.join(config.reportDir, 'parsing-test-tracker.md');
const trackerContent = `# Document Parsing Test Results

## Test Run: ${new Date().toLocaleString()}

### Test 1: Simple Linear Document
- [ ] Document created
- [ ] Document uploaded
- [ ] Sections detected: _____ / 6 expected
- [ ] Orphans: _____ (0% expected)
- [ ] Processing time: _____ seconds (<5s expected)
- [ ] Errors: _____
- [ ] **Result**: PASS / FAIL

### Test 2: Complex Hierarchy Document
- [ ] Document created
- [ ] Document uploaded
- [ ] Sections detected: _____ / 14 expected
- [ ] Orphans: _____ (<5% expected)
- [ ] Processing time: _____ seconds (<10s expected)
- [ ] Errors: _____
- [ ] **Result**: PASS / FAIL

### Test 3: Irregular Numbering Document
- [ ] Document created
- [ ] Document uploaded
- [ ] Sections detected: _____ / 9 expected
- [ ] Orphans: _____ (<20% expected)
- [ ] Processing time: _____ seconds (<10s expected)
- [ ] Errors: _____
- [ ] **Result**: PASS / FAIL

---

## Overall Results

- Total Tests: 3
- Passed: _____
- Failed: _____
- Critical Tests Passed: _____ / 2

## MVP Readiness

- [ ] Simple document parsing works (CRITICAL)
- [ ] Complex document parsing works (CRITICAL)
- [ ] No parser crashes
- [ ] Acceptable performance

**Parser Status**: READY / NOT READY for MVP

## Issues Found

1. _______________________________________
2. _______________________________________
3. _______________________________________

## Recommendations

1. _______________________________________
2. _______________________________________
3. _______________________________________

## Next Steps

- [ ] Fix critical issues
- [ ] Re-run failed tests
- [ ] Document workarounds
- [ ] Plan P1 optimizations
`;

fs.writeFileSync(trackerPath, trackerContent);

console.log('📊 TEST TRACKER CREATED:\n');
console.log(`   ${trackerPath}\n`);
console.log('   Use this to track your test results.\n');

console.log('🚀 Happy testing!\n');
