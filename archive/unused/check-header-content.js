const fs = require('fs').promises;
const mammoth = require('mammoth');

(async () => {
  const docPath = './uploads/setup/setup-1759980041923-342199667.docx';
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const lines = result.value.split('\n');

  console.log('=== CHECKING FOR CONTENT ON HEADER LINES ===\n');

  // Look for lines that match Article/Section pattern
  let contentOnHeaders = 0;
  let totalHeaderWords = 0;

  for (let i = 129; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this looks like a header
    const isArticle = /^ARTICLE\s+[IVXLCDM]+/i.test(trimmed);
    const isSection = /^Section\s+\d+/i.test(trimmed);

    if (isArticle || isSection) {
      // Count words on this line
      const words = trimmed.split(/\s+/).filter(w => w.trim().length > 0);
      const wordCount = words.length;

      // Check if there's content beyond just the header
      const headerMatch = trimmed.match(/^(ARTICLE\s+[IVXLCDM]+|Section\s+\d+)[:\s]*(.*)/i);
      if (headerMatch && headerMatch[2]) {
        const contentPart = headerMatch[2].trim();
        if (contentPart.length > 0 && !contentPart.match(/^\d+$/)) {
          const contentWords = contentPart.split(/\s+/).filter(w => w.trim().length > 0).length;
          if (contentWords > 5) {
            console.log(`Line ${i}: "${trimmed.substring(0, 100)}..."`);
            console.log(`   Content words: ${contentWords}\n`);
            contentOnHeaders += contentWords;
          }
        }
      }

      totalHeaderWords += wordCount;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Total words on header lines: ${totalHeaderWords}`);
  console.log(`  Content words on header lines (beyond header text): ${contentOnHeaders}`);
})();
