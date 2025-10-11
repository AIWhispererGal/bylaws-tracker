const fs = require('fs').promises;
const mammoth = require('mammoth');
const wordParser = require('../src/parsers/wordParser');

(async () => {
  const docPath = './uploads/setup/setup-1759980041923-342199667.docx';
  const buffer = await fs.readFile(docPath);
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  const lines = text.split('\n');

  const config = {
    hierarchy: {
      levels: [
        { name: 'Article', type: 'article', numbering: 'roman', prefix: 'Article ', depth: 0 },
        { name: 'Section', type: 'section', numbering: 'numeric', prefix: 'Section ', depth: 1 }
      ]
    }
  };

  console.log('=== ANALYZING LOST CONTENT ===\n');

  // 1. Filter TOC from baseline (like the test does)
  const tocLines = new Set();
  for (let i = 30; i < Math.min(129, lines.length); i++) {
    if (/\t\d+\s*$/.test(lines[i])) {
      tocLines.add(i);
    }
  }
  const uniqueLines = lines.filter((_, idx) => !tocLines.has(idx));
  const uniqueText = uniqueLines.join('\n');

  const uniqueWords = uniqueText.split(/\s+/).filter(w => w.trim().length > 0).length;

  // 2. Parse the document
  const sections = await wordParser.parseSections(text, '', config);
  const parsedText = sections.map(s => s.text || '').join('\n');
  const parsedWords = parsedText.split(/\s+/).filter(w => w.trim().length > 0).length;

  console.log('Overall:');
  console.log(`  Unique content: ${uniqueWords} words`);
  console.log(`  Parsed: ${parsedWords} words`);
  console.log(`  Lost: ${uniqueWords - parsedWords} words (${((1 - parsedWords/uniqueWords) * 100).toFixed(2)}%)\n`);

  // 3. Find which lines have content that wasn't captured
  const parsedLowercase = parsedText.toLowerCase().replace(/\s+/g, ' ');
  const lostLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (tocLines.has(i)) continue; // Skip TOC
    
    const line = lines[i].trim();
    if (!line || line.length < 10) continue; // Skip empty/very short
    
    // Check if this line's content appears in parsed output
    const lineLower = line.toLowerCase().replace(/\s+/g, ' ');
    const words = line.split(/\s+/).filter(w => w.trim().length > 0);
    
    if (words.length > 3) {
      // Check if at least 70% of words from this line appear in parsed output
      const foundWords = words.filter(w => 
        parsedLowercase.includes(w.toLowerCase())
      ).length;
      
      const retentionRate = foundWords / words.length;
      
      if (retentionRate < 0.7) {
        lostLines.push({
          lineNum: i,
          text: line.substring(0, 100),
          words: words.length,
          retentionRate: (retentionRate * 100).toFixed(0)
        });
      }
    }
  }

  // 4. Categorize lost content
  console.log('Lines with significant content loss:');
  console.log(`  Total lines: ${lostLines.length}\n`);

  if (lostLines.length > 0) {
    console.log('Sample lost lines:');
    lostLines.slice(0, 10).forEach(line => {
      console.log(`  Line ${line.lineNum} (${line.retentionRate}% retained, ${line.words} words):`);
      console.log(`    "${line.text}..."\n`);
    });
  }

  // 5. Check specific content types
  console.log('Content type analysis:');
  
  // Page numbers in headers/footers
  const pageNumberPattern = /^page \d+/i;
  const pageHeaders = lines.filter(l => pageNumberPattern.test(l.trim()));
  console.log(`  Page headers/footers: ${pageHeaders.length} lines`);
  
  // Very short lines (might be spacing/formatting)
  const veryShort = uniqueLines.filter(l => {
    const trimmed = l.trim();
    return trimmed.length > 0 && trimmed.length < 10;
  });
  console.log(`  Very short lines (<10 chars): ${veryShort.length} lines`);
  
  // Lines with only numbers/punctuation
  const numericOnly = uniqueLines.filter(l => 
    l.trim().length > 0 && /^[\d\s\.\,\-\–\—\(\)]+$/.test(l.trim())
  );
  console.log(`  Numeric/punctuation only: ${numericOnly.length} lines`);
  
})();
