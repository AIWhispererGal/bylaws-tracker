/**
 * Word Parser - Orphaned Content Tests
 * Tests the fallback mechanism for capturing ALL content
 */

const wordParser = require('../../src/parsers/wordParser');

// Mock configuration
const mockConfig = {
  hierarchy: {
    levels: [
      {
        name: 'Article',
        type: 'article',
        numbering: 'roman',
        prefix: 'ARTICLE ',
        depth: 0
      },
      {
        name: 'Section',
        type: 'section',
        numbering: 'numeric',
        prefix: 'Section ',
        depth: 1
      }
    ],
    maxDepth: 5,
    allowNesting: true
  }
};

describe('Word Parser - Orphaned Content Capture', () => {
  describe('Unnumbered Content', () => {
    test('should capture preamble before first section', async () => {
      const text = `This is a preamble paragraph.
It provides important context.

ARTICLE I - Governance

Section 1 - Purpose
The organization shall govern itself.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should have preamble + article section
      expect(sections.length).toBeGreaterThanOrEqual(1);

      // Check if preamble was captured
      const hasPreamble = sections.some(s =>
        s.type === 'preamble' ||
        s.text?.includes('preamble paragraph')
      );

      expect(hasPreamble).toBe(true);
    });

    test('should capture trailing content after last section', async () => {
      const text = `ARTICLE I - Governance

Section 1 - Purpose
The organization shall govern itself.

This is additional content at the end.
It has no section header.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture the trailing content
      const hasTrailing = sections.some(s =>
        s.text?.includes('additional content') ||
        s.type === 'unnumbered'
      );

      expect(hasTrailing).toBe(true);
    });

    test('should create unnumbered sections for standalone blocks', async () => {
      const text = `ARTICLE I - Governance

Section 1 - Purpose
The organization shall govern itself.

This is orphaned content between sections.
It has multiple lines.

Section 2 - Scope
The organization covers the local area.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should have at least the two sections
      expect(sections.length).toBeGreaterThanOrEqual(2);

      // Check if orphaned content was captured
      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('orphaned content');
    });
  });

  describe('Missing Section Numbers', () => {
    test('should handle documents with skipped numbers', async () => {
      const text = `ARTICLE I - Governance

Section 1 - Purpose
First section content.

Section 3 - Scope
Third section (section 2 is missing).`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture both sections despite missing Section 2
      expect(sections.length).toBeGreaterThanOrEqual(2);

      const section3 = sections.find(s => s.number === '3');
      expect(section3).toBeDefined();
      expect(section3?.text).toContain('Third section');
    });

    test('should handle documents with duplicate numbers', async () => {
      const text = `ARTICLE I - Governance

Section 1 - Purpose
First occurrence.

Section 1 - Another Purpose
Second occurrence of Section 1.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture both sections
      expect(sections.length).toBeGreaterThanOrEqual(2);

      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('First occurrence');
      expect(totalText).toContain('Second occurrence');
    });

    test('should handle out-of-order section numbers', async () => {
      const text = `ARTICLE I - Governance

Section 3 - Third
This comes first.

Section 1 - First
This comes second.

Section 2 - Second
This comes third.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture all sections regardless of order
      expect(sections.length).toBeGreaterThanOrEqual(3);

      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('comes first');
      expect(totalText).toContain('comes second');
      expect(totalText).toContain('comes third');
    });
  });

  describe('Content Between Articles', () => {
    test('should capture transitional content between articles', async () => {
      const text = `ARTICLE I - Governance

Section 1 - Purpose
First article content.

This is transitional content between articles.
It provides important context.

ARTICLE II - Operations

Section 1 - Procedures
Second article content.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture the transitional content
      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('transitional content');
    });

    test('should handle article-level notes', async () => {
      const text = `ARTICLE I - Governance

Note: This article was amended in 2024.

Section 1 - Purpose
First section content.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture the note
      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('amended in 2024');
    });
  });

  describe('Mixed Format Documents', () => {
    test('should handle documents with multiple formatting styles', async () => {
      const text = `Introduction

This document uses mixed formatting.

ARTICLE I - Traditional Format

Section 1 - Purpose
Traditional section content.

Some unnumbered commentary here.

1. Numbered list item
2. Another list item

ARTICLE II - Continuation

Section 1 - Next Section
More traditional content.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture everything
      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('mixed formatting');
      expect(totalText).toContain('unnumbered commentary');
      expect(totalText).toContain('Numbered list item');
    });

    test('should handle documents with only unnumbered content', async () => {
      const text = `This is a simple document.

It has no traditional section numbers.

Just plain paragraphs of content.

Multiple lines describing something.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should create at least one section to capture all content
      expect(sections.length).toBeGreaterThanOrEqual(1);

      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('simple document');
      expect(totalText).toContain('plain paragraphs');
    });

    test('should preserve all content even with weird numbering', async () => {
      const text = `ARTICLE I - Start

Section 1 - First
Content 1

Random text here without a header.

Section 2.5 - Weird Number
Content 2.5

Section ABC - Non-numeric
Content ABC

More random text.

ARTICLE II - End

Section 1 - Last
Content last.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Verify ALL content is captured
      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('Content 1');
      expect(totalText).toContain('Random text here');
      expect(totalText).toContain('Content 2.5');
      expect(totalText).toContain('Content ABC');
      expect(totalText).toContain('More random text');
      expect(totalText).toContain('Content last');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty document gracefully', async () => {
      const text = '';
      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should return empty array without errors
      expect(sections).toBeDefined();
      expect(Array.isArray(sections)).toBe(true);
    });

    test('should handle document with only whitespace', async () => {
      const text = '\n\n   \n\t\n\n';
      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should return empty array or sections with no meaningful content
      expect(sections).toBeDefined();
      expect(Array.isArray(sections)).toBe(true);
    });

    test('should not duplicate content during capture', async () => {
      const text = `ARTICLE I - Test

Section 1 - Content
This line should only appear once.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Check that content isn't duplicated
      const totalText = sections.map(s => s.text || '').join(' ');
      const occurrences = (totalText.match(/should only appear once/g) || []).length;
      expect(occurrences).toBe(1);
    });

    test('should handle very long orphaned content', async () => {
      const longText = 'A'.repeat(10000);
      const text = `ARTICLE I - Test

Section 1 - Before
Before content.

${longText}

Section 2 - After
After content.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      // Should capture the long orphaned content
      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText.length).toBeGreaterThan(9000);
    });
  });

  describe('Content Integrity', () => {
    test('should maintain exact content without modifications', async () => {
      const text = `ARTICLE I - Test

Section 1 - Content
  Preserve indentation
    and formatting
  exactly as written.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      const section = sections.find(s => s.number === '1');
      expect(section).toBeDefined();

      // Note: cleanText may modify whitespace, so check key content
      expect(section?.text).toContain('Preserve indentation');
      expect(section?.text).toContain('and formatting');
      expect(section?.text).toContain('exactly as written');
    });

    test('should capture special characters correctly', async () => {
      const text = `ARTICLE I - Test

Section 1 - Special
Content with special chars: @#$%^&*()_+-=[]{}|;:'"<>,.?/~

More content here.`;

      const sections = await wordParser.parseSections(text, '', mockConfig);

      const totalText = sections.map(s => s.text || '').join(' ');
      expect(totalText).toContain('@#$%^&*()');
    });
  });
});

// Export for use in other tests
module.exports = { mockConfig };
