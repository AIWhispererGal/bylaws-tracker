#!/usr/bin/env node
/**
 * Debug Parser Output - Check actual field names and structure
 */

const path = require('path');
const fs = require('fs').promises;
const wordParser = require('../src/parsers/wordParser');

async function main() {
  // Find most recent uploaded document
  const uploadsDir = path.join(__dirname, '../uploads/setup');
  const files = await fs.readdir(uploadsDir);
  const docxFiles = files
    .filter(f => f.endsWith('.docx'))
    .map(f => path.join(uploadsDir, f))
    .sort()
    .reverse();

  const BYLAWS_PATH = docxFiles[0];
  console.log('Using document:', BYLAWS_PATH);
  console.log();

  // Load config
  const configPath = path.join(__dirname, '../config/examples/organization.example.json');
  const configContent = await fs.readFile(configPath, 'utf8');
  const organizationConfig = JSON.parse(configContent);

  // Parse document
  const parsedResult = await wordParser.parseDocument(BYLAWS_PATH, organizationConfig);

  if (!parsedResult.success) {
    console.error('Parser failed:', parsedResult.error);
    return;
  }

  const sections = parsedResult.sections;
  console.log(`Total sections: ${sections.length}\n`);

  // Examine first section in detail
  console.log('=== FIRST SECTION STRUCTURE ===');
  const first = sections[0];
  console.log('All fields:', Object.keys(first));
  console.log('\nField values:');
  Object.entries(first).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const preview = value.substring(0, 100);
      console.log(`  ${key}: "${preview}${value.length > 100 ? '...' : ''}"`);
    } else {
      console.log(`  ${key}:`, value);
    }
  });

  // Check for empty sections
  console.log('\n=== EMPTY SECTIONS CHECK ===');
  const fieldNames = ['text', 'content', 'original_text'];
  fieldNames.forEach(field => {
    const emptySections = sections.filter(s => {
      const val = s[field] || '';
      return val.trim().length === 0;
    });
    console.log(`Empty sections (using '${field}'): ${emptySections.length}`);
  });

  // Find the correct content field
  console.log('\n=== CONTENT FIELD DETECTION ===');
  const contentField = fieldNames.find(field => {
    const nonEmptyCount = sections.filter(s => (s[field] || '').trim().length > 0).length;
    return nonEmptyCount > sections.length * 0.8; // >80% have content
  });
  console.log(`Primary content field appears to be: '${contentField}'`);

  // Word count using detected field
  if (contentField) {
    const mammoth = require('mammoth');
    const buffer = await fs.readFile(BYLAWS_PATH);
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value;

    const rawWords = rawText.split(/\s+/).filter(w => w.trim().length > 0);
    const parsedWords = sections.flatMap(s =>
      (s[contentField] || '').split(/\s+/).filter(w => w.trim().length > 0)
    );

    console.log('\n=== WORD RETENTION ===');
    console.log(`Raw words: ${rawWords.length}`);
    console.log(`Parsed words (${contentField}): ${parsedWords.length}`);
    console.log(`Retention: ${(parsedWords.length / rawWords.length * 100).toFixed(2)}%`);
  }
}

main().catch(console.error);
