const fs = require('fs').promises;
const mammoth = require('mammoth');
const wordParser = require('../src/parsers/wordParser');

(async () => {
  const docPath = './uploads/setup/setup-1759980041923-342199667.docx';
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  const config = {
    hierarchy: {
      levels: [
        { name: 'Article', type: 'article', numbering: 'roman', prefix: 'Article ', depth: 0 },
        { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 }
      ]
    }
  };

  const sections = await wordParser.parseSections(text, '', config);

  console.log('\n=== EMPTY SECTIONS ANALYSIS ===\n');

  const emptySections = sections.filter(s => !s.text || s.text.trim().length === 0);

  console.log(`Total sections: ${sections.length}`);
  console.log(`Empty sections: ${emptySections.length}\n`);

  if (emptySections.length > 0) {
    emptySections.forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.citation || 'NO CITATION'}`);
      console.log(`   Type: ${s.type}`);
      console.log(`   Title: ${s.title}`);
      console.log(`   Line: ${s.lineNumber}`);
      console.log(`   Text length: ${s.text ? s.text.length : 0}`);
      console.log(`   Original_text length: ${s.original_text ? s.original_text.length : 0}`);
      console.log();
    });
  }

  // Also check what content we're missing
  const rawWords = text.split(/\s+/).filter(w => w.trim().length > 0).length;
  const parsedWords = sections
    .map(s => (s.text || '').split(/\s+/).filter(w => w.trim().length > 0).length)
    .reduce((a, b) => a + b, 0);

  console.log('\n=== WORD RETENTION ===');
  console.log(`Raw words: ${rawWords}`);
  console.log(`Parsed words: ${parsedWords}`);
  console.log(`Missing: ${rawWords - parsedWords} (${((1 - parsedWords/rawWords) * 100).toFixed(2)}%)`);
  console.log(`Retention: ${((parsedWords/rawWords) * 100).toFixed(2)}%`);
})();
