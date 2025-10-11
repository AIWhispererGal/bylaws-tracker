const mammoth = require('mammoth');
const fs = require('fs');
const parser = require('../src/parsers/wordParser');
const config = JSON.parse(fs.readFileSync('./config/examples/organization.example.json'));

(async () => {
  const result = await parser.parseDocument('uploads/setup/setup-1759980041923-342199667.docx', config);
  const empty = result.sections.filter(s => !s.text || !s.text.trim());
  console.log('Empty sections:', empty.length);
  empty.forEach(s => console.log('  ', s.citation, '-', s.title));
  console.log('\nTotal sections:', result.sections.length);

  // Show retention
  const buffer = await fs.promises.readFile('uploads/setup/setup-1759980041923-342199667.docx');
  const textResult = await mammoth.extractRawText({ buffer });
  const totalWords = textResult.value.split(/\s+/).filter(w => w.trim()).length;
  const parsedWords = result.sections.map(s => s.text || '').join(' ').split(/\s+/).filter(w => w.trim()).length;
  console.log('\nWord retention:', ((parsedWords / totalWords) * 100).toFixed(2) + '%');
})();
