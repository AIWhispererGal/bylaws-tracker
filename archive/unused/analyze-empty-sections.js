#!/usr/bin/env node
/**
 * Analyze Empty Sections in RNC Bylaws
 *
 * This script identifies why sections are empty and provides detailed analysis.
 */

const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const wordParser = require('../src/parsers/wordParser');

async function analyzeEmptySections() {
  console.log('='.repeat(80));
  console.log('EMPTY SECTIONS ANALYSIS - RNC BYLAWS');
  console.log('='.repeat(80));
  console.log('');

  // Load config and document
  const configPath = path.join(__dirname, '../config/examples/organization.example.json');
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

  const bylawsPath = path.join(__dirname, '../uploads/setup/setup-1759980041923-342199667.docx');
  const buffer = await fs.readFile(bylawsPath);

  // Get raw text
  const textResult = await mammoth.extractRawText({ buffer });
  const lines = textResult.value.split('\n');

  // Parse document
  const result = await wordParser.parseDocument(bylawsPath, config);

  // Find empty sections
  const emptySections = result.sections.filter(s => !s.text || s.text.trim() === '');

  console.log('SUMMARY:');
  console.log(`  Total sections: ${result.sections.length}`);
  console.log(`  Empty sections: ${emptySections.length}`);
  console.log(`  Empty rate: ${(emptySections.length / result.sections.length * 100).toFixed(1)}%`);
  console.log('');

  // Analyze patterns
  console.log('PATTERN ANALYSIS:');
  console.log('');

  // Group by type
  const byType = {};
  emptySections.forEach(s => {
    if (!byType[s.type]) byType[s.type] = [];
    byType[s.type].push(s);
  });

  console.log('By Type:');
  Object.entries(byType).forEach(([type, sections]) => {
    console.log(`  ${type}: ${sections.length} empty`);
  });
  console.log('');

  // Check line numbers
  console.log('By Line Number:');
  const lineNumbers = emptySections.map(s => s.lineNumber).filter(n => n !== undefined).sort((a, b) => a - b);
  console.log(`  Line numbers: ${lineNumbers.join(', ')}`);
  console.log('');

  // Check if consecutive
  let consecutiveGroups = [];
  let currentGroup = [];
  for (let i = 0; i < lineNumbers.length; i++) {
    if (currentGroup.length === 0) {
      currentGroup.push(lineNumbers[i]);
    } else if (lineNumbers[i] - currentGroup[currentGroup.length - 1] <= 5) {
      currentGroup.push(lineNumbers[i]);
    } else {
      if (currentGroup.length > 1) consecutiveGroups.push([...currentGroup]);
      currentGroup = [lineNumbers[i]];
    }
  }
  if (currentGroup.length > 1) consecutiveGroups.push(currentGroup);

  if (consecutiveGroups.length > 0) {
    console.log('Consecutive Groups (within 5 lines):');
    consecutiveGroups.forEach((group, i) => {
      console.log(`  Group ${i + 1}: lines ${group[0]}-${group[group.length - 1]} (${group.length} sections)`);
    });
  }
  console.log('');

  // ROOT CAUSE ANALYSIS
  console.log('ROOT CAUSE ANALYSIS:');
  console.log('');

  // Check what's around the empty sections
  console.log('Sample Empty Sections (first 5):');
  emptySections.slice(0, 5).forEach((section, i) => {
    console.log(`\n${i + 1}. ${section.citation} - ${section.title}`);
    console.log(`   Type: ${section.type}`);
    console.log(`   Line: ${section.lineNumber}`);

    if (section.lineNumber !== undefined) {
      const lineNum = section.lineNumber;
      console.log(`   Header line: "${lines[lineNum]}"`);
      console.log(`   Next line: "${lines[lineNum + 1]}"`);
      console.log(`   Line after: "${lines[lineNum + 2]}"`);

      // Check if next line is also a header
      const nextLineIsHeader = result.sections.some(s => s.lineNumber === lineNum + 1);
      const nextLineIsHeader2 = result.sections.some(s => s.lineNumber === lineNum + 2);

      if (nextLineIsHeader) {
        console.log(`   ⚠️  NEXT LINE IS HEADER - Content skipped!`);
      } else if (nextLineIsHeader2) {
        console.log(`   ⚠️  LINE AFTER IS HEADER - Blank line between headers`);
      }
    }
  });

  console.log('');
  console.log('='.repeat(80));
  console.log('FINDINGS:');
  console.log('='.repeat(80));

  // Determine root cause
  const backToBackHeaders = emptySections.filter(s => {
    if (s.lineNumber === undefined) return false;
    const nextLineIsHeader = result.sections.some(sec => sec.lineNumber === s.lineNumber + 1 || sec.lineNumber === s.lineNumber + 2);
    return nextLineIsHeader;
  });

  console.log(`\n1. Back-to-back headers (no content between): ${backToBackHeaders.length} sections`);
  console.log(`   These sections have another header immediately after them, so no content is captured.`);

  // Check duplicate citations
  const citations = result.sections.map(s => s.citation);
  const duplicateCitations = citations.filter((c, i) => citations.indexOf(c) !== i);
  const uniqueDuplicates = [...new Set(duplicateCitations)];

  console.log(`\n2. Duplicate citations: ${uniqueDuplicates.length} different citations have duplicates`);
  console.log(`   Duplicates: ${uniqueDuplicates.join(', ')}`);
  console.log(`   This suggests the document contains the same structure multiple times (e.g., TOC + body)`);

  console.log('');
  console.log('ROOT CAUSE:');
  console.log('  The empty sections are from DUPLICATE CITATIONS where:');
  console.log('  - One instance (likely from TOC) has content attached');
  console.log('  - Other instances (likely from body headers) are left empty');
  console.log('  - Back-to-back headers in the body prevent content capture');
  console.log('');
  console.log('SOLUTION:');
  console.log('  The deduplicateSections() function should be KEEPING sections with content');
  console.log('  and REMOVING empty duplicates. This appears to be working backwards.');
  console.log('');
}

analyzeEmptySections().catch(console.error);
