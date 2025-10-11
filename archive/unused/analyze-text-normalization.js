#!/usr/bin/env node

/**
 * Text Normalization Analysis Script
 *
 * Analyzes how mammoth.js extracts text from Word documents
 * and demonstrates various normalization strategies
 */

const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

class TextNormalizationAnalyzer {
  constructor(docxPath) {
    this.docxPath = docxPath;
    this.rawText = null;
    this.htmlText = null;
  }

  async analyze() {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  TEXT NORMALIZATION ANALYSIS FOR WORD DOCUMENTS');
    console.log('════════════════════════════════════════════════════════════════\n');

    // Step 1: Extract with mammoth
    await this.extractWithMammoth();

    // Step 2: Character-by-character analysis
    this.analyzeCharacters();

    // Step 3: Identify issues
    this.identifyIssues();

    // Step 4: Test normalization strategies
    this.testNormalizationStrategies();

    // Step 5: Measure impact on pattern matching
    this.measurePatternMatchingImpact();
  }

  async extractWithMammoth() {
    console.log('📄 STEP 1: EXTRACTING TEXT WITH MAMMOTH.JS\n');

    const buffer = fs.readFileSync(this.docxPath);

    const [rawResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer })
    ]);

    this.rawText = rawResult.value;
    this.htmlText = htmlResult.value;

    console.log(`✓ Raw text extracted: ${this.rawText.length} characters`);
    console.log(`✓ HTML extracted: ${this.htmlText.length} characters`);

    if (rawResult.messages.length > 0) {
      console.log('\n⚠️  Mammoth warnings:');
      rawResult.messages.forEach(msg => console.log(`   - ${msg.message}`));
    }
    console.log('');
  }

  analyzeCharacters() {
    console.log('🔍 STEP 2: CHARACTER-BY-CHARACTER ANALYSIS (First 20 lines)\n');

    const lines = this.rawText.split('\n').slice(0, 20);

    lines.forEach((line, i) => {
      if (line.trim()) {
        console.log(`─── Line ${i} (${line.length} chars) ───`);
        console.log(`Text: ${JSON.stringify(line)}`);

        // Character breakdown
        const chars = [...line.slice(0, 60)];
        const charInfo = chars.map((c, idx) => {
          const code = c.charCodeAt(0);
          let label;

          if (c === '\t') label = 'TAB';
          else if (c === ' ') label = 'SPC';
          else if (c === '\r') label = 'CR';
          else if (c === '\n') label = 'LF';
          else if (code === 160) label = 'NBSP'; // Non-breaking space
          else if (code > 127) label = `U+${code.toString(16).toUpperCase()}`;
          else label = c;

          return `[${idx}:${label}]`;
        }).join(' ');

        console.log(`Chars: ${charInfo}`);

        // Special character detection
        const specialChars = {
          tabs: (line.match(/\t/g) || []).length,
          spaces: (line.match(/ /g) || []).length,
          nbsp: (line.match(/\u00A0/g) || []).length,
          unicode: [...line].filter(c => c.charCodeAt(0) > 127).length
        };

        if (Object.values(specialChars).some(v => v > 0)) {
          console.log(`Special: ${JSON.stringify(specialChars)}`);
        }
        console.log('');
      }
    });
  }

  identifyIssues() {
    console.log('⚠️  STEP 3: IDENTIFIED NORMALIZATION ISSUES\n');

    const issues = [];
    const lines = this.rawText.split('\n');

    // Issue 1: TAB characters used for formatting (TOC-style)
    const tabLines = lines.filter(l => l.includes('\t'));
    if (tabLines.length > 0) {
      issues.push({
        type: 'TAB_FORMATTING',
        count: tabLines.length,
        description: 'TAB characters used for table-of-contents formatting',
        examples: tabLines.slice(0, 3).map(l => JSON.stringify(l)),
        impact: 'Breaks pattern matching when expecting "ARTICLE I NAME" but getting "ARTICLE I\\tNAME\\t4"'
      });
    }

    // Issue 2: Case inconsistencies
    const articleLines = lines.filter(l => /article/i.test(l));
    const caseVariations = new Set(
      articleLines
        .map(l => l.match(/article/i)?.[0])
        .filter(Boolean)
    );
    if (caseVariations.size > 1) {
      issues.push({
        type: 'CASE_INCONSISTENCY',
        variations: Array.from(caseVariations),
        description: 'Mixed case in section identifiers',
        impact: 'Case-sensitive patterns may miss matches'
      });
    }

    // Issue 3: Whitespace variations
    const spacingPatterns = new Set();
    lines.forEach(l => {
      const match = l.match(/ARTICLE\s+[IVX]+/i);
      if (match) {
        spacingPatterns.add(match[0]);
      }
    });
    if (spacingPatterns.size > 1) {
      issues.push({
        type: 'WHITESPACE_VARIATION',
        patterns: Array.from(spacingPatterns),
        description: 'Inconsistent whitespace between ARTICLE and number',
        impact: 'Exact string matching will fail'
      });
    }

    // Issue 4: Duplicate content (TOC + body)
    const tocArticles = lines
      .slice(0, 100)
      .filter(l => /^ARTICLE\s+[IVX]+\t/i.test(l));
    const bodyArticles = lines
      .slice(100)
      .filter(l => /^ARTICLE\s+[IVX]+/i.test(l));

    if (tocArticles.length > 0 && bodyArticles.length > 0) {
      issues.push({
        type: 'DUPLICATE_CONTENT',
        tocCount: tocArticles.length,
        bodyCount: bodyArticles.length,
        description: 'Document contains both TOC and body with similar patterns',
        impact: 'May create duplicate sections unless properly filtered'
      });
    }

    // Display issues
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.type}`);
      console.log(`   Description: ${issue.description}`);
      if (issue.examples) {
        console.log(`   Examples:`);
        issue.examples.forEach(ex => console.log(`     ${ex}`));
      }
      if (issue.variations) {
        console.log(`   Variations: ${issue.variations.join(', ')}`);
      }
      if (issue.patterns) {
        console.log(`   Patterns: ${issue.patterns.join(', ')}`);
      }
      if (issue.tocCount !== undefined) {
        console.log(`   TOC entries: ${issue.tocCount}, Body entries: ${issue.bodyCount}`);
      }
      console.log(`   ⚠️  Impact: ${issue.impact}`);
      console.log('');
    });
  }

  testNormalizationStrategies() {
    console.log('🔧 STEP 4: NORMALIZATION STRATEGIES\n');

    const sampleLine = 'ARTICLE I\tNAME\t4';
    const testLines = [
      'ARTICLE I\tNAME\t4',
      'Section 1: Boundary Description\t5',
      'ARTICLE VI OFFICERS\t12',
      '  Section  3:  Selection   of   Officers  '
    ];

    // Strategy 1: Remove trailing tabs and page numbers
    console.log('━━━ Strategy 1: Remove TOC Artifacts ━━━');
    console.log('Use Case: Clean table of contents formatting\n');

    const strategy1 = (text) => {
      return text
        .split('\n')
        .map(line => {
          // Remove everything after the first TAB (removes page numbers)
          const beforeTab = line.split('\t')[0];
          return beforeTab.trim();
        })
        .join('\n');
    };

    console.log('Implementation:');
    console.log('  line.split("\\t")[0].trim()  // Take content before first TAB\n');

    console.log('Results:');
    testLines.forEach(line => {
      const normalized = line.split('\t')[0].trim();
      console.log(`  "${line}"`);
      console.log(`  → "${normalized}"\n`);
    });

    // Strategy 2: Normalize whitespace
    console.log('\n━━━ Strategy 2: Normalize Whitespace ━━━');
    console.log('Use Case: Consistent spacing for pattern matching\n');

    const strategy2 = (text) => {
      return text
        .split('\n')
        .map(line => {
          // Replace all whitespace sequences with single space
          return line.replace(/\s+/g, ' ').trim();
        })
        .join('\n');
    };

    console.log('Implementation:');
    console.log('  line.replace(/\\s+/g, " ").trim()  // Collapse all whitespace\n');

    console.log('Results:');
    testLines.forEach(line => {
      const normalized = line.replace(/\s+/g, ' ').trim();
      console.log(`  "${line}"`);
      console.log(`  → "${normalized}"\n`);
    });

    // Strategy 3: Case normalization for matching
    console.log('\n━━━ Strategy 3: Case-Insensitive Matching ━━━');
    console.log('Use Case: Match patterns regardless of case\n');

    console.log('Implementation:');
    console.log('  line.toLowerCase()  // For comparison only, preserve original\n');

    const testPatterns = [
      { pattern: /^article\s+[ivx]+/i, description: 'Article pattern (case-insensitive)' },
      { pattern: /^section\s+\d+:/i, description: 'Section pattern (case-insensitive)' }
    ];

    testLines.forEach(line => {
      console.log(`  "${line}"`);
      testPatterns.forEach(({ pattern, description }) => {
        if (pattern.test(line)) {
          console.log(`    ✓ Matches: ${description}`);
        }
      });
      console.log('');
    });

    // Strategy 4: Combined normalization pipeline
    console.log('\n━━━ Strategy 4: Combined Pipeline ━━━');
    console.log('Use Case: Comprehensive normalization for reliable parsing\n');

    const strategy4 = (line) => {
      // Step 1: Remove TOC artifacts (tabs and page numbers)
      let normalized = line.split('\t')[0];

      // Step 2: Normalize whitespace
      normalized = normalized.replace(/\s+/g, ' ');

      // Step 3: Trim
      normalized = normalized.trim();

      // Step 4: Store both original and normalized for matching
      return {
        original: line,
        normalized: normalized,
        lower: normalized.toLowerCase()
      };
    };

    console.log('Implementation:');
    console.log('  1. Split by TAB, take first part');
    console.log('  2. Collapse whitespace to single space');
    console.log('  3. Trim leading/trailing space');
    console.log('  4. Store original + normalized + lowercase versions\n');

    console.log('Results:');
    testLines.forEach(line => {
      const result = strategy4(line);
      console.log(`  Original:   "${result.original}"`);
      console.log(`  Normalized: "${result.normalized}"`);
      console.log(`  For match:  "${result.lower}"\n`);
    });
  }

  measurePatternMatchingImpact() {
    console.log('📊 STEP 5: PATTERN MATCHING IMPACT MEASUREMENT\n');

    const lines = this.rawText.split('\n');

    // Pattern matching WITHOUT normalization
    console.log('━━━ Without Normalization ━━━\n');

    const patterns = [
      { name: 'ARTICLE + Roman + Title (exact)', regex: /^ARTICLE\s+[IVX]+\s+[A-Z]+$/ },
      { name: 'Section + number + colon + title', regex: /^Section\s+\d+:\s*[A-Z]/ }
    ];

    patterns.forEach(({ name, regex }) => {
      const matches = lines.filter(l => regex.test(l));
      console.log(`${name}:`);
      console.log(`  Matches: ${matches.length}`);
      if (matches.length > 0) {
        console.log(`  Example: ${JSON.stringify(matches[0])}`);
      }
      console.log('');
    });

    // Pattern matching WITH normalization
    console.log('━━━ With Normalization (Strategy 4) ━━━\n');

    const normalized = lines.map(l => ({
      original: l,
      normalized: l.split('\t')[0].replace(/\s+/g, ' ').trim()
    }));

    const normalizedPatterns = [
      { name: 'ARTICLE + Roman (case-insensitive)', regex: /^article\s+[ivx]+/i },
      { name: 'Section + number + colon', regex: /^section\s+\d+:/i },
      { name: 'ARTICLE + Roman + any title', regex: /^article\s+[ivx]+\s+\w+/i }
    ];

    normalizedPatterns.forEach(({ name, regex }) => {
      const matches = normalized.filter(l => regex.test(l.normalized));
      console.log(`${name}:`);
      console.log(`  Matches: ${matches.length}`);
      if (matches.length > 0) {
        console.log(`  Example (original): ${JSON.stringify(matches[0].original)}`);
        console.log(`  Example (normalized): ${JSON.stringify(matches[0].normalized)}`);
      }
      console.log('');
    });

    // Summary and recommendations
    console.log('━━━ RECOMMENDATIONS ━━━\n');

    console.log('1. NORMALIZE BEFORE PATTERN MATCHING');
    console.log('   • Remove TAB characters and page numbers from TOC');
    console.log('   • Collapse multiple spaces to single space');
    console.log('   • Use case-insensitive regex patterns');
    console.log('');

    console.log('2. WHERE TO NORMALIZE');
    console.log('   ✓ AFTER mammoth extraction (in parseSections method)');
    console.log('   ✓ BEFORE hierarchyDetector.detectHierarchy()');
    console.log('   ✗ NOT in mammoth itself (library handles that)');
    console.log('');

    console.log('3. WHAT TO PRESERVE');
    console.log('   • Original text for section content');
    console.log('   • Line structure for context');
    console.log('   • Only normalize for pattern matching, not content');
    console.log('');

    console.log('4. IMPLEMENTATION PATTERN');
    console.log('   const normalized = line.split("\\t")[0].replace(/\\s+/g, " ").trim();');
    console.log('   const pattern = /^article\\s+[ivx]+/i;');
    console.log('   if (pattern.test(normalized)) { /* use original line for content */ }');
    console.log('');
  }
}

// Main execution
async function main() {
  const docxPath = process.argv[2] || 'uploads/setup/setup-1759980041923-342199667.docx';

  if (!fs.existsSync(docxPath)) {
    console.error(`Error: File not found: ${docxPath}`);
    console.error('Usage: node analyze-text-normalization.js [path/to/document.docx]');
    process.exit(1);
  }

  const analyzer = new TextNormalizationAnalyzer(docxPath);
  await analyzer.analyze();

  console.log('════════════════════════════════════════════════════════════════');
  console.log('  Analysis complete!');
  console.log('════════════════════════════════════════════════════════════════\n');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = TextNormalizationAnalyzer;
