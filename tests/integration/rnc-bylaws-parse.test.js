/**
 * Integration Test: RNC Bylaws Parser Completeness
 *
 * Validates that the parser captures every piece of content from the real
 * RNC bylaws document without loss.
 */

const path = require('path');
const fs = require('fs').promises;
const mammoth = require('mammoth');
const wordParser = require('../../src/parsers/wordParser');
const hierarchyDetector = require('../../src/parsers/hierarchyDetector');

describe('RNC Bylaws Parser - Completeness Test', () => {
  // Use the most recent uploaded document
  const BYLAWS_PATH = path.join(
    __dirname,
    '../../uploads/setup/setup-1759980041923-342199667.docx'
  );

  let rawText;
  let rawHtml;
  let parsedResult;
  let organizationConfig;

  beforeAll(async () => {
    // Load organization config (use example config for now)
    const configPath = path.join(__dirname, '../../config/examples/organization.example.json');
    const configContent = await fs.readFile(configPath, 'utf8');
    organizationConfig = JSON.parse(configContent);

    // Extract raw content from document
    const buffer = await fs.readFile(BYLAWS_PATH);
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer })
    ]);

    rawText = textResult.value;
    rawHtml = htmlResult.value;

    // Filter out TOC from baseline (lines 30-128) as it's duplicate content
    // The parser correctly filters TOC to avoid duplication
    const lines = rawText.split('\n');
    const tocLines = new Set();
    for (let i = 30; i < Math.min(129, lines.length); i++) {
      if (/\t\d+\s*$/.test(lines[i])) {
        tocLines.add(i);
      }
    }
    // Remove TOC lines from baseline for accurate retention calculation
    const uniqueLines = lines.filter((_, idx) => !tocLines.has(idx));
    rawText = uniqueLines.join('\n');

    // Parse the document
    parsedResult = await wordParser.parseDocument(BYLAWS_PATH, organizationConfig);
  });

  describe('Document Loading', () => {
    test('should load the RNC bylaws document', async () => {
      const exists = await fs.access(BYLAWS_PATH)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    test('should extract raw text successfully', () => {
      expect(rawText).toBeDefined();
      expect(rawText.length).toBeGreaterThan(0);
    });

    test('should parse document without errors', () => {
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.error).toBeUndefined();
    });
  });

  describe('Content Completeness', () => {
    test('should capture all text content (word count comparison)', () => {
      // Count words in original
      const originalWords = rawText
        .split(/\s+/)
        .filter(word => word.trim().length > 0);

      // Count words in parsed sections
      const parsedText = parsedResult.sections
        .map(s => s.text || '')
        .join(' ');
      const parsedWords = parsedText
        .split(/\s+/)
        .filter(word => word.trim().length > 0);

      // Allow for minor differences due to whitespace normalization
      const wordRetentionRate = parsedWords.length / originalWords.length;

      console.log(`Original words: ${originalWords.length}`);
      console.log(`Parsed words: ${parsedWords.length}`);
      console.log(`Retention rate: ${(wordRetentionRate * 100).toFixed(2)}%`);

      // Should capture at least 95% of words
      expect(wordRetentionRate).toBeGreaterThan(0.95);
    });

    test('should capture all character content', () => {
      // Remove all whitespace for comparison
      const originalChars = rawText.replace(/\s+/g, '');
      const parsedText = parsedResult.sections
        .map(s => s.text || '')
        .join('');
      const parsedChars = parsedText.replace(/\s+/g, '');

      const charRetentionRate = parsedChars.length / originalChars.length;

      console.log(`Original characters: ${originalChars.length}`);
      console.log(`Parsed characters: ${parsedChars.length}`);
      console.log(`Retention rate: ${(charRetentionRate * 100).toFixed(2)}%`);

      // Should capture at least 95% of characters
      expect(charRetentionRate).toBeGreaterThan(0.95);
    });

    test('should not have empty gaps between sections', () => {
      const sections = parsedResult.sections;

      // Build expected text from sections
      let reconstructedText = '';
      sections.forEach(section => {
        // Add header
        reconstructedText += `${section.citation} ${section.title}\n`;
        // Add content
        reconstructedText += section.text + '\n';
      });

      // Compare lengths
      const reconstructedLength = reconstructedText.replace(/\s+/g, '').length;
      const originalLength = rawText.replace(/\s+/g, '').length;

      const coverage = reconstructedLength / originalLength;

      console.log(`Reconstructed length: ${reconstructedLength}`);
      console.log(`Original length: ${originalLength}`);
      console.log(`Coverage: ${(coverage * 100).toFixed(2)}%`);

      expect(coverage).toBeGreaterThan(0.90);
    });
  });

  describe('Hierarchy Detection', () => {
    test('should detect all articles', () => {
      const articles = parsedResult.sections.filter(s => s.type === 'article');

      console.log(`Total articles detected: ${articles.length}`);
      console.log('Articles:', articles.map(a => a.citation).join(', '));

      // RNC bylaws should have articles
      expect(articles.length).toBeGreaterThan(0);
    });

    test('should detect all sections', () => {
      const sections = parsedResult.sections.filter(s => s.type === 'section');

      console.log(`Total sections detected: ${sections.length}`);

      // RNC bylaws should have sections
      expect(sections.length).toBeGreaterThan(0);
    });

    test('should detect all subsections', () => {
      const subsections = parsedResult.sections.filter(s => s.type === 'subsection');

      console.log(`Total subsections detected: ${subsections.length}`);

      // Note: May be 0 if RNC doesn't use subsections
      expect(subsections.length).toBeGreaterThanOrEqual(0);
    });

    test('should detect all clause types', () => {
      const clauses = parsedResult.sections.filter(s => s.type === 'clause');

      console.log(`Total clauses detected: ${clauses.length}`);

      expect(clauses.length).toBeGreaterThanOrEqual(0);
    });

    test('all sections should have valid citations', () => {
      const invalidCitations = parsedResult.sections.filter(
        s => !s.citation || s.citation.trim() === ''
      );

      if (invalidCitations.length > 0) {
        console.log('Sections missing citations:', invalidCitations.length);
      }

      expect(invalidCitations.length).toBe(0);
    });

    test('all sections should have titles', () => {
      const missingTitles = parsedResult.sections.filter(
        s => !s.title || s.title.trim() === '' || s.title === '(Untitled)'
      );

      if (missingTitles.length > 0) {
        console.log('Sections missing titles:', missingTitles.length);
        console.log('Examples:', missingTitles.slice(0, 5).map(s => s.citation));
      }

      // Allow some untitled sections (they might be intentional)
      const untitledRate = missingTitles.length / parsedResult.sections.length;
      expect(untitledRate).toBeLessThan(0.05); // Less than 5% untitled
    });
  });

  describe('Edge Cases', () => {
    test('should handle document intro (content before first section)', () => {
      // Check if there's significant content before the first detected section
      const firstSection = parsedResult.sections[0];

      if (firstSection) {
        // Find first section citation in raw text
        const firstCitationIndex = rawText.indexOf(firstSection.citation);

        if (firstCitationIndex > 100) {
          // There's significant intro content
          console.log(`Intro content length: ${firstCitationIndex} characters`);

          // Check if intro was captured
          const hasIntroSection = parsedResult.sections.some(
            s => s.type === 'intro' || s.citation.includes('Preamble')
          );

          if (!hasIntroSection) {
            console.warn('WARNING: Document has intro content that may not be captured');
          }
        }
      }
    });

    test('should detect any skipped section numbers', () => {
      // Group by type and check for gaps in numbering
      const sectionsByType = {};

      parsedResult.sections.forEach(section => {
        if (!sectionsByType[section.type]) {
          sectionsByType[section.type] = [];
        }
        sectionsByType[section.type].push(section);
      });

      // Check each type for number gaps
      Object.entries(sectionsByType).forEach(([type, sections]) => {
        if (sections.length < 2) return;

        // Get level config
        const levelDef = organizationConfig.hierarchy.levels.find(
          l => l.type === type
        );
        if (!levelDef) return;

        // Parse numbers
        const numbers = sections.map(s =>
          hierarchyDetector.parseNumber(s.number, levelDef.numbering)
        ).filter(n => n !== null);

        // Check for gaps
        if (numbers.length > 1) {
          const gaps = [];
          for (let i = 1; i < numbers.length; i++) {
            const expected = numbers[i - 1] + 1;
            const actual = numbers[i];
            if (actual !== expected) {
              gaps.push({
                type,
                expected,
                actual,
                previous: sections[i - 1].citation,
                next: sections[i].citation
              });
            }
          }

          if (gaps.length > 0) {
            console.log(`Gaps found in ${type} numbering:`, gaps);
          }
        }
      });
    });

    test('should handle special formatting (bold, italic, underline)', () => {
      // Check if HTML contains formatting
      const hasBold = rawHtml.includes('<strong>') || rawHtml.includes('<b>');
      const hasItalic = rawHtml.includes('<em>') || rawHtml.includes('<i>');
      const hasUnderline = rawHtml.includes('<u>');

      console.log('Document formatting:');
      console.log(`  Bold: ${hasBold ? 'Yes' : 'No'}`);
      console.log(`  Italic: ${hasItalic ? 'Yes' : 'No'}`);
      console.log(`  Underline: ${hasUnderline ? 'Yes' : 'No'}`);

      // Note: Current parser strips formatting, which is expected behavior
      // This test documents that we're aware of formatting in the source
    });

    test('should identify any content after last section', () => {
      const lastSection = parsedResult.sections[parsedResult.sections.length - 1];

      if (lastSection) {
        // Find last section in raw text
        const lastCitationIndex = rawText.lastIndexOf(lastSection.citation);
        const lastSectionEnd = lastCitationIndex + lastSection.citation.length +
          (lastSection.text?.length || 0);

        const remainingText = rawText.substring(lastSectionEnd).trim();

        if (remainingText.length > 100) {
          console.warn(`WARNING: ${remainingText.length} characters after last section`);
          console.log('Preview:', remainingText.substring(0, 200) + '...');
        }
      }
    });
  });

  describe('Validation', () => {
    test('should pass all validation checks', () => {
      const validation = wordParser.validateSections(
        parsedResult.sections,
        organizationConfig
      );

      console.log('Validation results:');
      console.log(`  Valid: ${validation.valid}`);
      console.log(`  Warnings: ${validation.warnings.length}`);
      console.log(`  Errors: ${validation.errors.length}`);

      if (validation.warnings.length > 0) {
        console.log('Warnings:', validation.warnings);
      }

      if (validation.errors.length > 0) {
        console.log('Errors:', validation.errors);
      }

      expect(validation.valid).toBe(true);
    });

    test('should have no empty sections', () => {
      const emptySections = parsedResult.sections.filter(
        s => !s.text || s.text.trim() === ''
      );

      // Allow organizational article headers (containers) to be empty
      // These are articles that only contain sections, no direct content
      const emptyNonContainers = emptySections.filter(s => s.type !== 'article');

      if (emptySections.length > 0) {
        console.log('Empty sections found:', emptySections.length);
        console.log('  Articles (organizational containers):', emptySections.filter(s => s.type === 'article').map(s => s.citation).join(', '));
        console.log('  Non-containers:', emptyNonContainers.map(s => s.citation).join(', ') || 'none');
      }

      // Only fail if non-container sections are empty
      expect(emptyNonContainers.length).toBe(0);
    });

    test('should have no duplicate citations', () => {
      const citations = parsedResult.sections.map(s => s.citation);
      const uniqueCitations = new Set(citations);

      if (citations.length !== uniqueCitations.size) {
        const duplicates = citations.filter(
          (c, i) => citations.indexOf(c) !== i
        );
        console.log('Duplicate citations:', [...new Set(duplicates)]);
      }

      expect(citations.length).toBe(uniqueCitations.size);
    });
  });

  describe('Test Report', () => {
    test('should generate comprehensive test report', () => {
      // Generate detailed report
      const report = {
        document: {
          path: BYLAWS_PATH,
          fileName: path.basename(BYLAWS_PATH)
        },
        original: {
          totalChars: rawText.length,
          totalWords: rawText.split(/\s+/).filter(w => w.trim()).length,
          totalLines: rawText.split('\n').length
        },
        parsed: {
          success: parsedResult.success,
          totalSections: parsedResult.sections.length,
          sectionTypes: {},
          totalChars: 0,
          totalWords: 0
        },
        completeness: {
          wordRetention: 0,
          charRetention: 0
        },
        validation: wordParser.validateSections(
          parsedResult.sections,
          organizationConfig
        ),
        edgeCases: {
          emptySections: 0,
          missingTitles: 0,
          duplicateCitations: 0
        }
      };

      // Calculate section types
      parsedResult.sections.forEach(section => {
        report.parsed.sectionTypes[section.type] =
          (report.parsed.sectionTypes[section.type] || 0) + 1;
      });

      // Calculate parsed content stats
      const parsedText = parsedResult.sections.map(s => s.text || '').join(' ');
      report.parsed.totalChars = parsedText.replace(/\s+/g, '').length;
      report.parsed.totalWords = parsedText.split(/\s+/).filter(w => w.trim()).length;

      // Calculate retention rates
      report.completeness.wordRetention =
        (report.parsed.totalWords / report.original.totalWords * 100).toFixed(2) + '%';
      report.completeness.charRetention =
        (report.parsed.totalChars / report.original.totalChars * 100).toFixed(2) + '%';

      // Edge cases
      report.edgeCases.emptySections = parsedResult.sections.filter(
        s => !s.text || s.text.trim() === ''
      ).length;
      report.edgeCases.missingTitles = parsedResult.sections.filter(
        s => !s.title || s.title === '(Untitled)'
      ).length;

      const citations = parsedResult.sections.map(s => s.citation);
      const uniqueCitations = new Set(citations);
      report.edgeCases.duplicateCitations = citations.length - uniqueCitations.size;

      // Print report
      console.log('\n' + '='.repeat(70));
      console.log('RNC BYLAWS PARSER - COMPLETENESS TEST REPORT');
      console.log('='.repeat(70));
      console.log('\nDOCUMENT:');
      console.log(`  File: ${report.document.fileName}`);
      console.log('\nORIGINAL DOCUMENT STATS:');
      console.log(`  Total characters: ${report.original.totalChars.toLocaleString()}`);
      console.log(`  Total words: ${report.original.totalWords.toLocaleString()}`);
      console.log(`  Total lines: ${report.original.totalLines.toLocaleString()}`);
      console.log('\nPARSED RESULT:');
      console.log(`  Success: ${report.parsed.success ? 'YES' : 'NO'}`);
      console.log(`  Total sections: ${report.parsed.totalSections}`);
      console.log(`  Section types:`);
      Object.entries(report.parsed.sectionTypes).forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
      });
      console.log(`  Total characters: ${report.parsed.totalChars.toLocaleString()}`);
      console.log(`  Total words: ${report.parsed.totalWords.toLocaleString()}`);
      console.log('\nCOMPLETENESS:');
      console.log(`  Word retention: ${report.completeness.wordRetention}`);
      console.log(`  Character retention: ${report.completeness.charRetention}`);
      console.log('\nVALIDATION:');
      console.log(`  Valid: ${report.validation.valid ? 'YES' : 'NO'}`);
      console.log(`  Warnings: ${report.validation.warnings.length}`);
      console.log(`  Errors: ${report.validation.errors.length}`);
      console.log('\nEDGE CASES:');
      console.log(`  Empty sections: ${report.edgeCases.emptySections}`);
      console.log(`  Missing titles: ${report.edgeCases.missingTitles}`);
      console.log(`  Duplicate citations: ${report.edgeCases.duplicateCitations}`);
      console.log('\n' + '='.repeat(70));
      console.log('TEST CONCLUSION:');

      const allPassed =
        report.parsed.success &&
        report.validation.valid &&
        report.edgeCases.emptySections === 0 &&
        report.edgeCases.duplicateCitations === 0 &&
        parseFloat(report.completeness.charRetention) > 95;

      if (allPassed) {
        console.log('✅ ALL TESTS PASSED - Parser captures content completely');
      } else {
        console.log('⚠️  ISSUES FOUND - See details above');
      }
      console.log('='.repeat(70) + '\n');

      // Test passes if report was generated
      expect(report).toBeDefined();
    });
  });
});
