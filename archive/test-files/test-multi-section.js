// Test script for multi-section API implementation
// Run with: node test-multi-section.js

const testData = {
  // Test validation helper
  testValidation: {
    validSections: [
      { id: 'uuid1', article_number: 'III', section_number: 2, section_citation: 'Article III, Section 2' },
      { id: 'uuid2', article_number: 'III', section_number: 3, section_citation: 'Article III, Section 3' },
      { id: 'uuid3', article_number: 'III', section_number: 4, section_citation: 'Article III, Section 4' }
    ],
    invalidSections: [
      { id: 'uuid1', article_number: 'III', section_number: 2, section_citation: 'Article III, Section 2' },
      { id: 'uuid2', article_number: 'IV', section_number: 1, section_citation: 'Article IV, Section 1' }  // Different article
    ],
    nonContiguous: [
      { id: 'uuid1', article_number: 'III', section_number: 2, section_citation: 'Article III, Section 2' },
      { id: 'uuid3', article_number: 'III', section_number: 5, section_citation: 'Article III, Section 5' }  // Gap
    ]
  },

  // Test suggestion creation
  testSuggestion: {
    singleSection: {
      sectionId: 'uuid1',
      suggestedText: 'Single section amendment text',
      rationale: 'Testing single section',
      authorName: 'Test User'
    },
    multiSection: {
      sectionIds: ['uuid1', 'uuid2', 'uuid3'],
      suggestedText: 'Multi-section amendment text spanning sections 2-4',
      rationale: 'Testing multi-section',
      authorName: 'Test User'
    }
  },

  // Test locking
  testLocking: {
    singleLock: {
      sectionId: 'uuid1',
      suggestionId: 'suggestion1',
      notes: 'Locking single section',
      lockedBy: 'Committee Member'
    },
    multiLock: {
      sectionIds: ['uuid1', 'uuid2', 'uuid3'],
      suggestionId: 'suggestion2',
      notes: 'Locking multiple sections together',
      lockedBy: 'Committee Chair'
    }
  }
};

console.log('Multi-Section API Test Data');
console.log('===========================\n');

console.log('1. Validation Test Cases:');
console.log('   - Valid same-article sections:', testData.testValidation.validSections.length, 'sections');
console.log('   - Invalid cross-article:', testData.testValidation.invalidSections.map(s => s.article_number).join(', '));
console.log('   - Non-contiguous warning:', 'Sections', testData.testValidation.nonContiguous.map(s => s.section_number).join(', '));

console.log('\n2. Suggestion Creation:');
console.log('   - Single section:', testData.testSuggestion.singleSection.sectionId);
console.log('   - Multi-section:', testData.testSuggestion.multiSection.sectionIds.join(', '));

console.log('\n3. Section Locking:');
console.log('   - Single lock:', testData.testLocking.singleLock.sectionId);
console.log('   - Multi lock:', testData.testLocking.multiLock.sectionIds.join(', '));

console.log('\n4. New Endpoints:');
console.log('   POST /bylaws/api/suggestions - Now accepts sectionIds[]');
console.log('   POST /bylaws/api/sections/:id/lock - Now accepts sectionIds[]');
console.log('   GET /bylaws/api/sections/multiple/suggestions?sectionIds=id1,id2,id3');
console.log('   GET /bylaws/api/sections/:docId - Now includes article_number, section_number, total_suggestion_count');

console.log('\n5. Expected Behaviors:');
console.log('   ✓ Suggestions can span multiple sections in same article');
console.log('   ✓ Locking validates all sections are unlocked before proceeding');
console.log('   ✓ Junction table maintains ordinal for section order');
console.log('   ✓ Backward compatible with single section operations');
console.log('   ✓ Rollback on failure during multi-section operations');

console.log('\n6. Testing Scenarios:');
const scenarios = [
  '   - Create suggestion for sections 2-5 of Article III',
  '   - Lock sections 2-5 together with one committee decision',
  '   - Query suggestions that overlap with sections 3-4',
  '   - Fail to lock if any section in range already locked',
  '   - Fail to create suggestion across different articles',
  '   - Warning for non-contiguous sections (2, 4, 6)',
  '   - Count all suggestions (single + multi) per section'
];
scenarios.forEach(s => console.log(s));

console.log('\nTest data ready for API testing!');