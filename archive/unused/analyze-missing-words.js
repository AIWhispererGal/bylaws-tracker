const fs = require('fs').promises;
const mammoth = require('mammoth');
const wordParser = require('../src/parsers/wordParser');

(async () => {
  const docPath = './uploads/setup/setup-1759980041923-342199667.docx';
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const lines = text.split('\n');

  console.log('=== ANALYZING MISSING CONTENT ===\n');

  // 1. Check TOC content
  console.log('1. TOC Analysis (lines 30-128):');
  const tocLines = lines.slice(30, 129);
  const tocWords = tocLines.join(' ').split(/\s+/).filter(w => w.trim().length > 0).length;
  const tocUniqueContent = tocLines.filter(l => !/\t\d+\s*$/.test(l)).join(' ');
  const tocUniqueWords = tocUniqueContent.split(/\s+/).filter(w => w.trim().length > 0).length;
  console.log(`   Total TOC words: ${tocWords}`);
  console.log(`   TOC unique words (excluding page #s): ${tocUniqueWords}`);

  // 2. Check first 30 lines (before TOC)
  console.log('\n2. Document Header (lines 0-29):');
  const headerLines = lines.slice(0, 30);
  const headerWords = headerLines.join(' ').split(/\s+/).filter(w => w.trim().length > 0).length;
  console.log(`   Header words: ${headerWords}`);
  console.log(`   Sample: "${headerLines.filter(l => l.trim()).slice(0, 3).join(' | ')}"`);

  // 3. Check after TOC
  console.log('\n3. Content After TOC (lines 129+):');
  const bodyLines = lines.slice(129);
  const bodyWords = bodyLines.join(' ').split(/\s+/).filter(w => w.trim().length > 0).length;
  console.log(`   Body words: ${bodyWords}`);

  // 4. Total
  const totalWords = text.split(/\s+/).filter(w => w.trim().length > 0).length;
  console.log(`\n4. Total Document:`);
  console.log(`   Total words: ${totalWords}`);
  console.log(`   Breakdown: ${headerWords} (header) + ${tocWords} (TOC) + ${bodyWords} (body) = ${headerWords + tocWords + bodyWords}`);

  // 5. Parse and compare
  const config = {
    hierarchy: {
      levels: [
        { name: 'Article', type: 'article', numbering: 'roman', prefix: 'Article ', depth: 0 },
        { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 }
      ]
    }
  };

  const sections = await wordParser.parseSections(text, '', config);
  const parsedWords = sections
    .map(s => (s.text || '').split(/\s+/).filter(w => w.trim().length > 0).length)
    .reduce((a, b) => a + b, 0);

  console.log(`\n5. Parser Results:`);
  console.log(`   Parsed words: ${parsedWords}`);
  console.log(`   Missing: ${totalWords - parsedWords} words`);
  console.log(`   Retention: ${((parsedWords / totalWords) * 100).toFixed(2)}%`);

  // 6. Gap analysis
  console.log(`\n6. Gap to 95% Target:`);
  const target95 = Math.ceil(totalWords * 0.95);
  const gap = target95 - parsedWords;
  console.log(`   Need: ${target95} words (95% of ${totalWords})`);
  console.log(`   Have: ${parsedWords} words`);
  console.log(`   Gap: ${gap} words (${((gap / totalWords) * 100).toFixed(2)}%)`);
})();
