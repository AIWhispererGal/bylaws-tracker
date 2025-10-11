const fs = require('fs').promises;
const mammoth = require('mammoth');

(async () => {
  const docPath = './uploads/setup/setup-1759980041923-342199667.docx';
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const lines = result.value.split('\n');

  console.log('\n=== ARTICLE VI (around line 502) ===');
  for (let i = Math.max(0, 502-5); i < Math.min(lines.length, 502+15); i++) {
    const marker = i === 502 ? '>>> ' : '    ';
    console.log(`${marker}${i}: "${lines[i].substring(0, 80)}"`);
  }

  console.log('\n=== ARTICLE X (around line 812) ===');
  for (let i = Math.max(0, 812-5); i < Math.min(lines.length, 812+15); i++) {
    const marker = i === 812 ? '>>> ' : '    ';
    console.log(`${marker}${i}: "${lines[i].substring(0, 80)}"`);
  }
})();
