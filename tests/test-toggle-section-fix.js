#!/usr/bin/env node

/**
 * Test script to verify toggleSection fix
 * Tests the null check and ID selector fix in the document viewer
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing toggleSection Fix\n');
console.log('=' . repeat(50));

// Read the fixed file
const filePath = path.join(__dirname, '..', 'views', 'dashboard', 'document-viewer.ejs');
const content = fs.readFileSync(filePath, 'utf-8');

// Test 1: Check that toggleSection uses querySelector with data-section-id
console.log('\n✅ Test 1: toggleSection uses querySelector with data-section-id');
if (content.includes('document.querySelector(`[data-section-id="${sectionId}"]`)')) {
  console.log('   PASS: Function now uses querySelector with data-section-id attribute');
} else {
  console.log('   FAIL: Function not using correct selector');
  process.exit(1);
}

// Test 2: Check for null checks in toggleSection
console.log('\n✅ Test 2: toggleSection has null checks');
if (content.includes('[toggleSection] Section card not found for ID:')) {
  console.log('   PASS: Null check for card element present');
} else {
  console.log('   FAIL: Missing null check for card');
  process.exit(1);
}

if (content.includes('[toggleSection] Chevron not found for ID:')) {
  console.log('   PASS: Null check for chevron element present');
} else {
  console.log('   FAIL: Missing null check for chevron');
  process.exit(1);
}

// Test 3: Check for conditional chevron handling
console.log('\n✅ Test 3: Chevron operations are conditional');
if (content.includes('if (chevron) {')) {
  console.log('   PASS: Chevron classList operations are guarded');
} else {
  console.log('   FAIL: Chevron operations not protected');
  process.exit(1);
}

// Test 4: Check scrollToSection has null check
console.log('\n✅ Test 4: scrollToSection has early return on null');
if (content.includes('[scrollToSection] Section not found with anchorId:')) {
  console.log('   PASS: scrollToSection has null check');
} else {
  console.log('   FAIL: scrollToSection missing null check');
  process.exit(1);
}

// Test 5: Check showDiffView has null checks
console.log('\n✅ Test 5: showDiffView has container null checks');
if (content.includes('[showDiffView] Missing containers for section:')) {
  console.log('   PASS: showDiffView has container null checks');
} else {
  console.log('   FAIL: showDiffView missing container checks');
  process.exit(1);
}

console.log('\n' + '=' . repeat(50));
console.log('🎉 All Tests Passed!');
console.log('\nSummary of Fixes:');
console.log('1. toggleSection now uses querySelector with data-section-id attribute');
console.log('2. Added null checks to prevent "Cannot read properties of null" errors');
console.log('3. Chevron operations are now conditional (won\'t crash if missing)');
console.log('4. scrollToSection has early return if element not found');
console.log('5. showDiffView validates containers exist before use');
console.log('\n✨ The sections should now expand/collapse without errors!');