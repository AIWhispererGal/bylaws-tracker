#!/usr/bin/env node
/**
 * Analyze Parser Issues
 *
 * Deep analysis of what content is being lost and why duplicate citations exist
 */

const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const wordParser = require('../src/parsers/wordParser');

const BYLAWS_PATH = path.join(
  __dirname,
  '../uploads/setup/setup-1759980041923-342199667.docx'
);

async function analyzeParserIssues() {
  console.log('='.repeat(70));
  console.log('PARSER ISSUE ANALYSIS');
  console.log('='.repeat(70));
  console.log();

  // Load config
  const configPath = path.join(__dirname, '../config/examples/organization.example.json');
  const configContent = await fs.readFile(configPath, 'utf8');
  const organizationConfig = JSON.parse(configContent);

  // Extract raw content
  const buffer = await fs.readFile(BYLAWS_PATH);
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer })
  ]);

  const rawText = textResult.value;
  const rawLines = rawText.split('\n');

  // Parse document
  const parsedResult = await wordParser.parseDocument(BYLAWS_PATH, organizationConfig);

  console.log('ISSUE #1: CONTENT LOSS (~6.5% missing)');
  console.log('-'.repeat(70));

  // Find what's missing
  const parsedText = parsedResult.sections.map(s => s.text || '').join(' ');
  const originalWords = rawText.split(/\s+/).filter(w => w.trim());
  const parsedWords = parsedText.split(/\s+/).filter(w => w.trim());

  console.log(`Original words: ${originalWords.length}`);
  console.log(`Parsed words: ${parsedWords.length}`);
  console.log(`Lost words: ${originalWords.length - parsedWords.length}`);
  console.log();

  // Sample some missing content
  console.log('Likely causes:');
  console.log('  1. Section headers counted in original but not in section.text');
  console.log('  2. Table of contents not captured as section');
  console.log('  3. Document title/header stripped');
  console.log('  4. Whitespace normalization differences');
  console.log();

  // Check preamble section
  const preamble = parsedResult.sections.find(s => s.type === 'preamble');
  if (preamble) {
    console.log('Preamble section captured:', preamble.text.substring(0, 100) + '...');
    console.log(`Preamble words: ${preamble.text.split(/\s+/).length}`);
  } else {
    console.log('⚠️  No preamble section found');
  }
  console.log();

  console.log('ISSUE #2: DUPLICATE CITATIONS (55 duplicates!)');
  console.log('-'.repeat(70));

  // Analyze duplicates
  const citationCounts = {};
  parsedResult.sections.forEach(section => {
    citationCounts[section.citation] = (citationCounts[section.citation] || 0) + 1;
  });

  const duplicates = Object.entries(citationCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  console.log(`Total unique citations: ${Object.keys(citationCounts).length}`);
  console.log(`Duplicate citation patterns: ${duplicates.length}`);
  console.log();

  console.log('Top duplicates:');
  duplicates.slice(0, 10).forEach(([citation, count]) => {
    console.log(`  ${citation}: ${count} occurrences`);

    // Show where these duplicates appear
    const sections = parsedResult.sections
      .map((s, i) => ({ ...s, index: i }))
      .filter(s => s.citation === citation);

    console.log(`    Indices: ${sections.map(s => s.index).join(', ')}`);
    console.log(`    Titles: ${sections.map(s => s.title).slice(0, 2).join(' | ')}`);
  });
  console.log();

  console.log('Root cause analysis:');

  // Check if it's a numbering reset issue
  const articles = parsedResult.sections.filter(s => s.type === 'article');
  const articleNumbers = articles.map(a => a.number);
  const uniqueArticleNumbers = new Set(articleNumbers);

  if (articleNumbers.length !== uniqueArticleNumbers.size) {
    console.log('  ✅ FOUND: Article numbering resets (e.g., Article I appears twice)');
    console.log(`     This happens because the document has multiple parts with same numbering`);
    console.log();

    // Find where the reset happens
    const resetPoints = [];
    for (let i = 1; i < articles.length; i++) {
      const prev = parseInt(articles[i-1].number.replace(/[IVX]/g, m =>
        ({'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8,'IX':9,'X':10,'XI':11,'XII':12,'XIII':13,'XIV':14}[m] || 0)
      ));
      const curr = parseInt(articles[i].number.replace(/[IVX]/g, m =>
        ({'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6,'VII':7,'VIII':8,'IX':9,'X':10,'XI':11,'XII':12,'XIII':13,'XIV':14}[m] || 0)
      ));

      if (curr <= prev) {
        resetPoints.push({
          index: i,
          prevCitation: articles[i-1].citation,
          currCitation: articles[i].citation,
          prevTitle: articles[i-1].title,
          currTitle: articles[i].title
        });
      }
    }

    console.log(`  Found ${resetPoints.length} numbering reset point(s):`);
    resetPoints.forEach(point => {
      console.log(`    At index ${point.index}:`);
      console.log(`      Before: ${point.prevCitation} - ${point.prevTitle}`);
      console.log(`      After:  ${point.currCitation} - ${point.currTitle}`);
    });
  }
  console.log();

  console.log('ISSUE #3: EMPTY SECTIONS (52 empty!)');
  console.log('-'.repeat(70));

  const emptySections = parsedResult.sections.filter(s => !s.text || s.text.trim() === '');
  console.log(`Total sections: ${parsedResult.sections.length}`);
  console.log(`Empty sections: ${emptySections.length}`);
  console.log(`Percentage: ${(emptySections.length / parsedResult.sections.length * 100).toFixed(1)}%`);
  console.log();

  console.log('Sample empty sections:');
  emptySections.slice(0, 10).forEach(section => {
    console.log(`  ${section.citation} - ${section.title}`);
    console.log(`    Type: ${section.type}, Level: ${section.level}`);
  });
  console.log();

  console.log('Root cause analysis:');
  console.log('  - Parser may be treating section headers as separate sections');
  console.log('  - Content may be getting attached to wrong sections');
  console.log('  - Line matching logic may be flawed');
  console.log();

  console.log('RECOMMENDATIONS');
  console.log('='.repeat(70));
  console.log();
  console.log('1. FIX DUPLICATE CITATIONS:');
  console.log('   - Detect document parts/chapters and use them in citations');
  console.log('   - Add context to citations: "Part I, Article I" vs "Part II, Article I"');
  console.log('   - Or use sequential numbering across the entire document');
  console.log();
  console.log('2. FIX CONTENT LOSS:');
  console.log('   - Ensure section headers are included in section text or metadata');
  console.log('   - Capture table of contents as structured metadata');
  console.log('   - Keep document title/header in metadata');
  console.log();
  console.log('3. FIX EMPTY SECTIONS:');
  console.log('   - Debug line matching logic in parseSections()');
  console.log('   - Ensure text accumulation works correctly');
  console.log('   - Consider merging consecutive header sections');
  console.log();
  console.log('4. TEST WITH MANUAL VERIFICATION:');
  console.log('   - Pick specific Article/Section from PDF');
  console.log('   - Verify it appears correctly in parsed output');
  console.log('   - Check that all its content is captured');
  console.log();

  console.log('='.repeat(70));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(70));
}

// Run analysis
analyzeParserIssues().catch(console.error);
