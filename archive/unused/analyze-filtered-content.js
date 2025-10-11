const fs = require('fs').promises;
const mammoth = require('mammoth');

(async () => {
  const docPath = './uploads/setup/setup-1759980041923-342199667.docx';
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const lines = text.split('\n');

  console.log('=== ANALYZING FILTERED/LOST CONTENT ===\n');

  // 1. Document header (lines 0-29)
  const headerLines = lines.slice(0, 30);
  const headerText = headerLines.join(' ').trim();
  const headerWords = headerText.split(/\s+/).filter(w => w.trim().length > 0).length;
  console.log('1. Document Header (lines 0-29):');
  console.log(`   Words: ${headerWords}`);
  console.log(`   Content: "${headerText}"`);

  // 2. TOC (lines 30-128)
  const tocLines = lines.slice(30, 129);
  const tocText = tocLines.join(' ');
  const tocWords = tocText.split(/\s+/).filter(w => w.trim().length > 0).length;
  // Remove page numbers (digits at end)
  const tocClean = tocText.replace(/\t\d+/g, '');
  const tocCleanWords = tocClean.split(/\s+/).filter(w => w.trim().length > 0 && !/^\d+$/.test(w)).length;
  console.log('\n2. Table of Contents (lines 30-128):');
  console.log(`   Total words: ${tocWords}`);
  console.log(`   Without page numbers: ${tocCleanWords}`);

  // 3. Check Article VI and Article X
  const articleVILine = lines[502];
  const articleXLine = lines[812];
  console.log('\n3. Empty Article Headers:');
  console.log(`   Article VI (line 502): "${articleVILine}"`);
  console.log(`   Article X (line 812): "${articleXLine}"`);
  const articleHeaderWords = (articleVILine + ' ' + articleXLine).split(/\s+/).filter(w => w.trim().length > 0).length;
  console.log(`   Total words: ${articleHeaderWords}`);

  // 4. Summary
  console.log('\n4. Summary of Filtered Content:');
  console.log(`   Header: ${headerWords} words`);
  console.log(`   TOC: ${tocCleanWords} words (excluding duplicates)`);
  console.log(`   Empty articles: ${articleHeaderWords} words`);
  console.log(`   Total filtered: ${headerWords + tocCleanWords + articleHeaderWords} words`);
  console.log(`\n   Missing from parse: 564 words`);
  console.log(`   Accounted for: ${headerWords + tocCleanWords + articleHeaderWords} words`);
  console.log(`   Unaccounted: ${564 - (headerWords + tocCleanWords + articleHeaderWords)} words`);
})();
