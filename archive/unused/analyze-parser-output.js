#!/usr/bin/env node
/**
 * Analyze Parser Output for Validation
 * Identifies specific issues with word retention and empty sections
 */

const fs = require('fs');
const path = require('path');

// Load parser and test data
const WordParser = require('../src/parsers/wordParser.js');
const rawText = fs.readFileSync(
  path.join(__dirname, '../tests/fixtures/rnc-bylaws.txt'),
  'utf8'
);

// Parse document
console.log('Parsing document...\n');
const result = WordParser.parse(rawText);

// Analysis 1: Empty Sections
console.log('=== EMPTY SECTIONS ANALYSIS ===\n');
const emptySections = result.sections.filter(s => {
  const content = s.content || s.text || s.original_text || '';
  return content.trim().length === 0;
});

console.log(`Empty sections count: ${emptySections.length}`);
if (emptySections.length > 0) {
  console.log('\nEmpty sections:');
  emptySections.forEach(s => {
    console.log(`  - ${s.citation || s.section_citation}: "${s.title || s.section_title}"`);
    console.log(`    Content field: "${s.content}"`);
    console.log(`    Text field: "${s.text}"`);
    console.log(`    Original_text field: "${s.original_text}"`);
  });
}

// Analysis 2: Word Retention
console.log('\n=== WORD RETENTION ANALYSIS ===\n');
const rawWords = rawText.split(/\s+/).filter(w => w.trim().length > 0);
const parsedWords = result.sections.flatMap(s => {
  const content = s.content || s.text || s.original_text || '';
  return content.split(/\s+/).filter(w => w.trim().length > 0);
});

console.log(`Raw text words: ${rawWords.length}`);
console.log(`Parsed words: ${parsedWords.length}`);
console.log(`Retention rate: ${(parsedWords.length / rawWords.length * 100).toFixed(2)}%`);
console.log(`Missing words: ${rawWords.length - parsedWords.length}`);

// Analysis 3: Field Name Check
console.log('\n=== FIELD NAME ANALYSIS ===\n');
const firstSection = result.sections[0];
console.log('First section fields:', Object.keys(firstSection));
console.log('\nField values:');
console.log(`  - content: ${typeof firstSection.content} = "${(firstSection.content || '').substring(0, 100)}..."`);
console.log(`  - text: ${typeof firstSection.text} = "${(firstSection.text || '').substring(0, 100)}..."`);
console.log(`  - original_text: ${typeof firstSection.original_text} = "${(firstSection.original_text || '').substring(0, 100)}..."`);

// Analysis 4: Duplicate Citations
console.log('\n=== DUPLICATE CITATIONS ANALYSIS ===\n');
const citations = result.sections.map(s => s.citation || s.section_citation);
const citationCounts = {};
citations.forEach(c => {
  citationCounts[c] = (citationCounts[c] || 0) + 1;
});
const duplicates = Object.entries(citationCounts).filter(([c, count]) => count > 1);
console.log(`Duplicate citations: ${duplicates.length}`);
if (duplicates.length > 0) {
  console.log('\nDuplicates:');
  duplicates.forEach(([citation, count]) => {
    console.log(`  - ${citation}: ${count} occurrences`);
  });
}

// Analysis 5: Section Structure
console.log('\n=== SECTION STRUCTURE ===\n');
const sampleSections = result.sections.slice(0, 3);
console.log('First 3 sections structure:');
sampleSections.forEach((s, i) => {
  console.log(`\nSection ${i + 1}:`);
  console.log(JSON.stringify(s, null, 2));
});
