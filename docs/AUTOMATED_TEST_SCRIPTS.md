# Automated Test Scripts - User Facing Validation

**Purpose:** Copy-paste JavaScript snippets to validate user-facing features instantly.

**Usage:** Run these in the browser console while on the appropriate page.

---

## Pre-requisites

1. Server running at http://localhost:3000
2. Browser DevTools open (F12)
3. Console tab selected

---

## Test Suite 1: Suggestion Filtering Validation

**Page:** http://localhost:3000/bylaws

**Run this in console:**

```javascript
/**
 * COMPREHENSIVE SUGGESTION FILTERING TEST
 * Validates that each section ONLY shows its own suggestions
 */

async function testSuggestionFiltering() {
  console.log('🔍 Starting Suggestion Filtering Test...\n');

  try {
    // Fetch all sections
    const response = await fetch('/bylaws/api/sections/default');
    const data = await response.json();

    if (!data.success || !data.sections) {
      console.error('❌ Failed to fetch sections');
      return;
    }

    const sections = data.sections;
    console.log(`📊 Testing ${sections.length} sections\n`);

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const failures = [];

    // Test each section
    for (const section of sections) {
      totalTests++;

      // Fetch suggestions for this section
      const sugResponse = await fetch(`/bylaws/api/sections/${section.id}/suggestions`);
      const sugData = await sugResponse.json();

      if (!sugData.success) {
        console.error(`❌ Failed to fetch suggestions for ${section.section_citation}`);
        failedTests++;
        continue;
      }

      const suggestions = sugData.suggestions || [];

      // Verify all suggestions belong to this section
      const wrongSection = suggestions.filter(s => s.section_id !== section.id);

      if (wrongSection.length > 0) {
        console.error(`❌ FAIL: ${section.section_citation} has ${wrongSection.length} suggestions from other sections!`);
        failedTests++;
        failures.push({
          section: section.section_citation,
          wrongCount: wrongSection.length,
          wrongSuggestions: wrongSection.map(s => ({
            id: s.id,
            wrongSectionId: s.section_id,
            author: s.author_name
          }))
        });
      } else {
        console.log(`✅ PASS: ${section.section_citation} - ${suggestions.length} suggestions (all correct)`);
        passedTests++;
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failures.length > 0) {
      console.log('\n❌ FAILURES DETAIL:');
      console.table(failures);
    } else {
      console.log('\n✅ ALL TESTS PASSED! Suggestion filtering is working correctly.');
    }

  } catch (error) {
    console.error('❌ Test suite error:', error);
  }
}

// Run the test
testSuggestionFiltering();
```

---

## Test Suite 2: Suggestion Count Accuracy

**Page:** http://localhost:3000/bylaws

**Run this in console:**

```javascript
/**
 * SUGGESTION COUNT ACCURACY TEST
 * Validates that badge counts match actual suggestion counts
 */

async function testSuggestionCounts() {
  console.log('🔍 Starting Suggestion Count Accuracy Test...\n');

  const sectionCards = document.querySelectorAll('.section-card');

  if (sectionCards.length === 0) {
    console.error('❌ No sections found on page');
    return;
  }

  console.log(`📊 Testing ${sectionCards.length} sections\n`);

  const results = [];
  let allCorrect = true;

  // Process each section
  for (let i = 0; i < sectionCards.length; i++) {
    const card = sectionCards[i];
    const sectionId = card.getAttribute('data-section-id');
    const citation = card.querySelector('h6')?.textContent || 'Unknown';
    const badge = card.querySelector('.badge.bg-info');

    if (!badge) {
      console.warn(`⚠️  No badge found for ${citation}`);
      continue;
    }

    const badgeCount = parseInt(badge.textContent.split(' ')[0]);

    // Expand section if not already expanded
    if (!card.classList.contains('expanded')) {
      card.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Count actual suggestions
    const suggestionsDiv = document.getElementById(`suggestions-${sectionId}`);
    const suggestionItems = suggestionsDiv?.querySelectorAll('.suggestion-item') || [];
    const actualCount = suggestionItems.length - 1; // Subtract "Keep Original" option

    const match = badgeCount === actualCount;

    results.push({
      section: citation,
      badge: badgeCount,
      actual: actualCount,
      match: match ? '✅' : '❌'
    });

    if (!match) {
      console.error(`❌ ${citation}: Badge=${badgeCount}, Actual=${actualCount}`);
      allCorrect = false;
    } else {
      console.log(`✅ ${citation}: ${actualCount} suggestions (count accurate)`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUGGESTION COUNT RESULTS');
  console.log('='.repeat(60));
  console.table(results);

  const passedCount = results.filter(r => r.match === '✅').length;
  const failedCount = results.filter(r => r.match === '❌').length;

  console.log(`\nTotal: ${results.length}`);
  console.log(`Passed: ${passedCount} ✅`);
  console.log(`Failed: ${failedCount} ❌`);

  if (allCorrect) {
    console.log('\n✅ ALL COUNTS ACCURATE!');
  } else {
    console.error('\n❌ SOME COUNTS ARE WRONG!');
  }
}

// Run the test
testSuggestionCounts();
```

---

## Test Suite 3: Diff View Validation

**Page:** http://localhost:3000/bylaws

**Run this in console:**

```javascript
/**
 * DIFF VIEW VALIDATION TEST
 * Validates that change tracking displays correctly
 */

async function testDiffView() {
  console.log('🔍 Starting Diff View Validation Test...\n');

  // Test data
  const testCases = [
    {
      name: 'Word Change',
      original: 'The board shall meet monthly.',
      suggested: 'The board shall meet weekly.',
      expectedDeletions: ['monthly'],
      expectedAdditions: ['weekly']
    },
    {
      name: 'Word Addition',
      original: 'The committee will review proposals.',
      suggested: 'The committee will carefully review proposals.',
      expectedDeletions: [],
      expectedAdditions: ['carefully']
    },
    {
      name: 'Word Deletion',
      original: 'The meeting will be held virtually online.',
      suggested: 'The meeting will be held online.',
      expectedDeletions: ['virtually'],
      expectedAdditions: []
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of testCases) {
    console.log(`\n📝 Testing: ${test.name}`);
    console.log(`   Original: "${test.original}"`);
    console.log(`   Suggested: "${test.suggested}"`);

    try {
      // Generate diff HTML using the page's function
      const diffHTML = generateDiffHTML(test.original, test.suggested);

      // Check for deletions
      let deletionsCorrect = true;
      for (const deletion of test.expectedDeletions) {
        if (!diffHTML.includes(`<span class="diff-deleted">${deletion}</span>`)) {
          console.error(`   ❌ Missing deletion: "${deletion}"`);
          deletionsCorrect = false;
        }
      }

      // Check for additions
      let additionsCorrect = true;
      for (const addition of test.expectedAdditions) {
        if (!diffHTML.includes(`<span class="diff-added">${addition}</span>`)) {
          console.error(`   ❌ Missing addition: "${addition}"`);
          additionsCorrect = false;
        }
      }

      if (deletionsCorrect && additionsCorrect) {
        console.log(`   ✅ PASS: Diff rendered correctly`);
        passedTests++;
      } else {
        console.error(`   ❌ FAIL: Diff rendering incorrect`);
        console.log(`   Generated HTML: ${diffHTML}`);
        failedTests++;
      }

    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      failedTests++;
    }
  }

  // Check CSS styling
  console.log('\n🎨 Checking CSS Styling...');

  const styles = {
    deleted: {
      class: 'diff-deleted',
      expectedBg: 'rgb(255, 235, 238)', // #ffebee
      expectedColor: 'rgb(198, 40, 40)', // #c62828
      expectedDecoration: 'line-through'
    },
    added: {
      class: 'diff-added',
      expectedBg: 'rgb(232, 245, 233)', // #e8f5e9
      expectedColor: 'rgb(46, 125, 50)' // #2e7d32
    }
  };

  // Create test elements to check computed styles
  const testContainer = document.createElement('div');
  testContainer.style.display = 'none';
  document.body.appendChild(testContainer);

  let stylesCorrect = true;

  // Test deleted styling
  const deletedSpan = document.createElement('span');
  deletedSpan.className = 'diff-deleted';
  deletedSpan.textContent = 'test';
  testContainer.appendChild(deletedSpan);

  const deletedStyles = window.getComputedStyle(deletedSpan);
  if (deletedStyles.backgroundColor !== styles.deleted.expectedBg) {
    console.error(`   ❌ Deleted background: got ${deletedStyles.backgroundColor}, expected ${styles.deleted.expectedBg}`);
    stylesCorrect = false;
  }
  if (deletedStyles.textDecorationLine !== styles.deleted.expectedDecoration) {
    console.error(`   ❌ Deleted text-decoration: got ${deletedStyles.textDecorationLine}, expected ${styles.deleted.expectedDecoration}`);
    stylesCorrect = false;
  }

  // Test added styling
  const addedSpan = document.createElement('span');
  addedSpan.className = 'diff-added';
  addedSpan.textContent = 'test';
  testContainer.appendChild(addedSpan);

  const addedStyles = window.getComputedStyle(addedSpan);
  if (addedStyles.backgroundColor !== styles.added.expectedBg) {
    console.error(`   ❌ Added background: got ${addedStyles.backgroundColor}, expected ${styles.added.expectedBg}`);
    stylesCorrect = false;
  }

  // Cleanup
  document.body.removeChild(testContainer);

  if (stylesCorrect) {
    console.log('   ✅ CSS styling correct');
    passedTests++;
  } else {
    console.error('   ❌ CSS styling incorrect');
    failedTests++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIFF VIEW TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCases.length + 1}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);

  if (failedTests === 0) {
    console.log('\n✅ ALL DIFF VIEW TESTS PASSED!');
  } else {
    console.error('\n❌ SOME DIFF VIEW TESTS FAILED!');
  }
}

// Run the test
testDiffView();
```

---

## Test Suite 4: API Endpoint Validation

**Page:** Any page (or run in terminal with curl)

**Run this in console:**

```javascript
/**
 * API ENDPOINT VALIDATION TEST
 * Tests all critical API endpoints for correct responses
 */

async function testAPIEndpoints() {
  console.log('🔍 Starting API Endpoint Validation Test...\n');

  const endpoints = [
    {
      name: 'Get Sections',
      url: '/bylaws/api/sections/default',
      method: 'GET',
      expectedFields: ['success', 'sections'],
      validate: (data) => {
        if (!Array.isArray(data.sections)) return 'sections should be an array';
        if (data.sections.length === 0) return 'warning: no sections found';
        const firstSection = data.sections[0];
        if (!firstSection.id) return 'section missing id field';
        if (!firstSection.section_citation) return 'section missing section_citation field';
        return null;
      }
    },
    {
      name: 'Health Check',
      url: '/api/health',
      method: 'GET',
      expectedFields: ['status', 'database'],
      validate: (data) => {
        if (data.status !== 'healthy') return 'status is not healthy';
        if (data.database !== 'connected') return 'database is not connected';
        return null;
      }
    },
    {
      name: 'Config',
      url: '/api/config',
      method: 'GET',
      expectedFields: ['APP_URL', 'status'],
      validate: (data) => {
        if (data.status !== 'connected') return 'status is not connected';
        if (!data.APP_URL) return 'APP_URL is missing';
        return null;
      }
    }
  ];

  let passedTests = 0;
  let failedTests = 0;
  const results = [];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);

    try {
      const startTime = performance.now();
      const response = await fetch(endpoint.url, { method: endpoint.method });
      const endTime = performance.now();
      const responseTime = (endTime - startTime).toFixed(2);

      console.log(`   Status: ${response.status}`);
      console.log(`   Response Time: ${responseTime}ms`);

      if (!response.ok) {
        console.error(`   ❌ FAIL: HTTP ${response.status}`);
        failedTests++;
        results.push({
          endpoint: endpoint.name,
          status: response.status,
          result: '❌ FAIL',
          error: `HTTP ${response.status}`
        });
        continue;
      }

      const data = await response.json();

      // Check expected fields
      let missingFields = [];
      for (const field of endpoint.expectedFields) {
        if (!(field in data)) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        console.error(`   ❌ FAIL: Missing fields: ${missingFields.join(', ')}`);
        failedTests++;
        results.push({
          endpoint: endpoint.name,
          status: response.status,
          result: '❌ FAIL',
          error: `Missing: ${missingFields.join(', ')}`
        });
        continue;
      }

      // Custom validation
      if (endpoint.validate) {
        const validationError = endpoint.validate(data);
        if (validationError) {
          if (validationError.startsWith('warning:')) {
            console.warn(`   ⚠️  ${validationError}`);
          } else {
            console.error(`   ❌ FAIL: ${validationError}`);
            failedTests++;
            results.push({
              endpoint: endpoint.name,
              status: response.status,
              result: '❌ FAIL',
              error: validationError
            });
            continue;
          }
        }
      }

      console.log(`   ✅ PASS: All checks passed`);
      passedTests++;
      results.push({
        endpoint: endpoint.name,
        status: response.status,
        responseTime: `${responseTime}ms`,
        result: '✅ PASS'
      });

    } catch (error) {
      console.error(`   ❌ ERROR: ${error.message}`);
      failedTests++;
      results.push({
        endpoint: endpoint.name,
        result: '❌ ERROR',
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 API ENDPOINT TEST SUMMARY');
  console.log('='.repeat(60));
  console.table(results);

  console.log(`\nTotal Tests: ${endpoints.length}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);

  if (failedTests === 0) {
    console.log('\n✅ ALL API ENDPOINTS WORKING CORRECTLY!');
  } else {
    console.error('\n❌ SOME API ENDPOINTS FAILED!');
  }
}

// Run the test
testAPIEndpoints();
```

---

## Test Suite 5: Section Locking Flow

**Page:** http://localhost:3000/bylaws

**Run this in console:**

```javascript
/**
 * SECTION LOCKING FLOW TEST
 * Validates the complete lock/unlock workflow
 */

async function testSectionLocking() {
  console.log('🔍 Starting Section Locking Flow Test...\n');

  // Find an unlocked section to test with
  const unlockedCard = Array.from(document.querySelectorAll('.section-card'))
    .find(card => !card.classList.contains('locked'));

  if (!unlockedCard) {
    console.error('❌ No unlocked sections found for testing');
    return;
  }

  const sectionId = unlockedCard.getAttribute('data-section-id');
  const citation = unlockedCard.querySelector('h6')?.textContent || 'Unknown';

  console.log(`📝 Testing section: ${citation}`);
  console.log(`   Section ID: ${sectionId}\n`);

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Check initial state
  console.log('1️⃣  Checking initial state...');
  if (unlockedCard.classList.contains('locked')) {
    console.error('   ❌ Section is already locked');
    testsFailed++;
  } else {
    console.log('   ✅ Section is unlocked');
    testsPassed++;
  }

  // Test 2: Expand section
  console.log('\n2️⃣  Expanding section...');
  if (!unlockedCard.classList.contains('expanded')) {
    unlockedCard.click();
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (unlockedCard.classList.contains('expanded')) {
    console.log('   ✅ Section expanded');
    testsPassed++;
  } else {
    console.error('   ❌ Section did not expand');
    testsFailed++;
    return; // Can't continue without expanded section
  }

  // Test 3: Check lock button exists
  console.log('\n3️⃣  Checking lock button...');
  const lockButton = unlockedCard.querySelector('button.btn-warning');
  if (lockButton && lockButton.textContent.includes('Lock')) {
    console.log('   ✅ Lock button found');
    testsPassed++;
  } else {
    console.error('   ❌ Lock button not found');
    testsFailed++;
  }

  // Test 4: Check suggestions area
  console.log('\n4️⃣  Checking suggestions area...');
  const suggestionsDiv = document.getElementById(`suggestions-${sectionId}`);
  if (suggestionsDiv) {
    const suggestionItems = suggestionsDiv.querySelectorAll('.suggestion-item');
    console.log(`   ✅ Found ${suggestionItems.length} suggestion options`);
    testsPassed++;
  } else {
    console.error('   ❌ Suggestions area not found');
    testsFailed++;
  }

  // Test 5: Check radio buttons
  console.log('\n5️⃣  Checking radio buttons...');
  const radioButtons = unlockedCard.querySelectorAll(`input[name="suggestion-${sectionId}"]`);
  if (radioButtons.length > 0) {
    console.log(`   ✅ Found ${radioButtons.length} radio button options`);
    testsPassed++;

    // Verify "Keep Original" option exists
    const keepOriginal = Array.from(radioButtons).find(r => r.value === 'original');
    if (keepOriginal) {
      console.log('   ✅ "Keep Original" option exists');
      testsPassed++;
    } else {
      console.error('   ❌ "Keep Original" option not found');
      testsFailed++;
    }
  } else {
    console.error('   ❌ No radio buttons found');
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SECTION LOCKING TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`Passed: ${testsPassed} ✅`);
  console.log(`Failed: ${testsFailed} ❌`);

  if (testsFailed === 0) {
    console.log('\n✅ SECTION LOCKING UI READY!');
    console.log('\n💡 To complete locking test:');
    console.log('   1. Select a suggestion (click radio button)');
    console.log('   2. Click "Lock Section with Selection"');
    console.log('   3. Verify section background turns yellow');
    console.log('   4. Verify lock badge shows "🔒 Locked"');
  } else {
    console.error('\n❌ SECTION LOCKING UI HAS ISSUES!');
  }
}

// Run the test
testSectionLocking();
```

---

## Run All Tests at Once

**Page:** http://localhost:3000/bylaws

**Run this in console:**

```javascript
/**
 * MASTER TEST SUITE
 * Runs all validation tests sequentially
 */

async function runAllTests() {
  console.log('🚀 STARTING COMPLETE TEST SUITE\n');
  console.log('='.repeat(60));
  console.log('This will take approximately 2-3 minutes');
  console.log('='.repeat(60) + '\n');

  const startTime = performance.now();

  // Test 1: API Endpoints
  console.log('\n' + '█'.repeat(60));
  console.log('█ TEST SUITE 1: API ENDPOINT VALIDATION');
  console.log('█'.repeat(60) + '\n');
  await testAPIEndpoints();

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Suggestion Filtering
  console.log('\n' + '█'.repeat(60));
  console.log('█ TEST SUITE 2: SUGGESTION FILTERING VALIDATION');
  console.log('█'.repeat(60) + '\n');
  await testSuggestionFiltering();

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Suggestion Counts
  console.log('\n' + '█'.repeat(60));
  console.log('█ TEST SUITE 3: SUGGESTION COUNT ACCURACY');
  console.log('█'.repeat(60) + '\n');
  await testSuggestionCounts();

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Diff View
  console.log('\n' + '█'.repeat(60));
  console.log('█ TEST SUITE 4: DIFF VIEW VALIDATION');
  console.log('█'.repeat(60) + '\n');
  await testDiffView();

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Section Locking
  console.log('\n' + '█'.repeat(60));
  console.log('█ TEST SUITE 5: SECTION LOCKING FLOW');
  console.log('█'.repeat(60) + '\n');
  await testSectionLocking();

  const endTime = performance.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // Final Summary
  console.log('\n\n' + '🎯'.repeat(30));
  console.log('🎉 COMPLETE TEST SUITE FINISHED!');
  console.log('🎯'.repeat(30));
  console.log(`\n⏱️  Total Time: ${totalTime} seconds`);
  console.log('\n✅ Review results above for any failures');
  console.log('📝 Document findings in USER_FACING_VALIDATION.md');
}

// Run all tests
runAllTests();
```

---

## Terminal-Based Tests (curl)

### Test API Endpoints from Terminal:

```bash
# Test health check
curl -s http://localhost:3000/api/health | jq

# Test config endpoint
curl -s http://localhost:3000/api/config | jq

# Get all sections (first 3)
curl -s http://localhost:3000/bylaws/api/sections/default | jq '.sections[0:3] | .[] | {citation, id, suggestions: (.bylaw_suggestions | length)}'

# Get suggestions for specific section (replace {section_id})
SECTION_ID="your-section-id-here"
curl -s "http://localhost:3000/bylaws/api/sections/${SECTION_ID}/suggestions" | jq '.suggestions | length'

# Verify suggestion filtering (should return only suggestions for this section)
curl -s "http://localhost:3000/bylaws/api/sections/${SECTION_ID}/suggestions" | jq '.suggestions[] | {id, section_id, author: .author_name}'
```

---

## Next Steps

1. ✅ Copy test suite to browser console
2. ⏳ Run tests and observe results
3. ⏳ Screenshot any failures
4. ⏳ Document results in USER_FACING_VALIDATION.md
5. ⏳ Report findings to development team

---

**Generated by:** Testing & Quality Assurance Agent
**Purpose:** Automated user-facing validation
**Date:** 2025-10-13
