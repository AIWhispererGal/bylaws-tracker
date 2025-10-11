/**
 * Test deduplication logic in word parser
 */

const wordParser = require('../../src/parsers/wordParser');

describe('Section Deduplication', () => {
  test('should remove duplicate sections with same citation and title', () => {
    const sections = [
      {
        citation: 'Article I',
        title: 'NAME',
        text: 'Short version',
        type: 'article'
      },
      {
        citation: 'Section 1',
        title: 'Purpose',
        text: 'Some content here',
        type: 'section'
      },
      {
        citation: 'Article I',
        title: 'NAME',
        text: 'Longer version with more detailed content about the name',
        type: 'article'
      },
      {
        citation: 'Section 2',
        title: 'Scope',
        text: 'Another section',
        type: 'section'
      }
    ];

    const deduplicated = wordParser.deduplicateSections(sections);

    // Should have 3 sections (duplicate Article I removed)
    expect(deduplicated).toHaveLength(3);

    // Should keep the longer version of Article I
    const articleI = deduplicated.find(s => s.citation === 'Article I');
    expect(articleI.text).toContain('Longer version');
    expect(articleI.text.length).toBeGreaterThan(20);

    // Other sections should be unchanged
    expect(deduplicated.find(s => s.citation === 'Section 1')).toBeTruthy();
    expect(deduplicated.find(s => s.citation === 'Section 2')).toBeTruthy();
  });

  test('should keep original when duplicate has less content', () => {
    const sections = [
      {
        citation: 'Section 1',
        title: 'First',
        text: 'Original content with lots of text here',
        type: 'section'
      },
      {
        citation: 'Section 1',
        title: 'First',
        text: 'Short',
        type: 'section'
      }
    ];

    const deduplicated = wordParser.deduplicateSections(sections);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].text).toBe('Original content with lots of text here');
  });

  test('should handle sections with no duplicates', () => {
    const sections = [
      {
        citation: 'Article I',
        title: 'NAME',
        text: 'Content 1',
        type: 'article'
      },
      {
        citation: 'Article II',
        title: 'PURPOSE',
        text: 'Content 2',
        type: 'article'
      },
      {
        citation: 'Article III',
        title: 'BOUNDARIES',
        text: 'Content 3',
        type: 'article'
      }
    ];

    const deduplicated = wordParser.deduplicateSections(sections);

    expect(deduplicated).toHaveLength(3);
    expect(deduplicated).toEqual(sections);
  });

  test('should handle multiple duplicates of same section', () => {
    const sections = [
      {
        citation: 'Section 2',
        title: 'Rules',
        text: 'v1',
        type: 'section'
      },
      {
        citation: 'Section 2',
        title: 'Rules',
        text: 'v2 - longer version here',
        type: 'section'
      },
      {
        citation: 'Section 2',
        title: 'Rules',
        text: 'v3',
        type: 'section'
      },
      {
        citation: 'Section 2',
        title: 'Rules',
        text: 'v4 - this is the longest version of all with most content',
        type: 'section'
      }
    ];

    const deduplicated = wordParser.deduplicateSections(sections);

    // Should have only 1 section
    expect(deduplicated).toHaveLength(1);

    // Should keep the longest version (v4)
    expect(deduplicated[0].text).toContain('longest version');
  });

  test('should handle empty sections in duplicates', () => {
    const sections = [
      {
        citation: 'Article I',
        title: 'NAME',
        text: '',
        type: 'article'
      },
      {
        citation: 'Article I',
        title: 'NAME',
        text: 'Actual content here',
        type: 'article'
      }
    ];

    const deduplicated = wordParser.deduplicateSections(sections);

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].text).toBe('Actual content here');
  });

  test('should log duplicate removal information', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const sections = [
      { citation: 'A1', title: 'T1', text: 'Content', type: 'article' },
      { citation: 'A1', title: 'T1', text: 'More content', type: 'article' }
    ];

    wordParser.deduplicateSections(sections);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Removed 1 duplicate')
    );

    consoleSpy.mockRestore();
  });
});
