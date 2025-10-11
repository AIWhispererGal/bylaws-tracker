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

  console.log('=== CHECKING PARSED CONTENT ===\n');

  // Check specific sections that should have content on header lines
  const testSections = [
    'Article III, Section 1',  // Mission section
    'Article V, Section 8',    // Censure section
    'Article V, Section 9',    // Removal section
    'Article VI, Section 1',   // Officers section
  ];

  testSections.forEach(citation => {
    const section = sections.find(s => s.citation === citation);
    if (section) {
      const wordCount = (section.text || '').split(/\s+/).filter(w => w.trim().length > 0).length;
      console.log(`${citation}:`);
      console.log(`  Title: "${section.title}"`);
      console.log(`  Word count: ${wordCount}`);
      console.log(`  First 100 chars: "${(section.text || '').substring(0, 100)}..."`);
      console.log();
    } else {
      console.log(`${citation}: NOT FOUND`);
      console.log();
    }
  });

  // Overall stats
  const totalWords = sections
    .map(s => (s.text || '').split(/\s+/).filter(w => w.trim().length > 0).length)
    .reduce((a, b) => a + b, 0);

  console.log(`Total parsed words: ${totalWords}`);
})();
