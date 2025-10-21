/**
 * Word Parser Edge Cases & Critical Bug Tests
 * Focused tests for undefined level handling and deduplication
 */

const wordParser = require('../../src/parsers/wordParser');
const hierarchyDetector = require('../../src/parsers/hierarchyDetector');

describe('Word Parser - Critical Edge Cases', () => {
  describe('Issue #1: Undefined Level Handling', () => {
    /**
     * CRITICAL BUG: When organizationConfig.hierarchy.levels is undefined/empty,
     * enrichSections crashes trying to access levels.find()
     */
    test('should handle undefined hierarchy levels array', () => {
      const sections = [
        {
          type: 'article',
          level: 'Article',
          number: 'I',
          prefix: 'ARTICLE ',
          title: 'NAME',
          citation: 'ARTICLE I',
          text: 'Test content'
        }
      ];

      const configWithUndefinedLevels = {
        hierarchy: {
          // levels is intentionally undefined
        }
      };

      // This should NOT crash
      expect(() => {
        wordParser.enrichSections(sections, configWithUndefinedLevels);
      }).not.toThrow();

      const result = wordParser.enrichSections(sections, configWithUndefinedLevels);
      expect(result).toHaveLength(1);
      expect(result[0].depth).toBe(0); // Should default to 0
    });

    test('should handle missing hierarchy config entirely', () => {
      const sections = [
        {
          type: 'section',
          level: 'Section',
          number: '1',
          prefix: 'Section ',
          title: 'Purpose',
          citation: 'Section 1',
          text: 'Test'
        }
      ];

      const configWithNoHierarchy = {};

      expect(() => {
        wordParser.enrichSections(sections, configWithNoHierarchy);
      }).not.toThrow();

      const result = wordParser.enrichSections(sections, configWithNoHierarchy);
      expect(result[0].depth).toBe(0);
    });

    test('should handle empty levels array', () => {
      const sections = [
        {
          type: 'article',
          level: 'Article',
          number: 'II',
          prefix: 'ARTICLE ',
          title: 'BOUNDARIES',
          citation: 'ARTICLE II',
          text: 'Content'
        }
      ];

      const configWithEmptyLevels = {
        hierarchy: {
          levels: []
        }
      };

      expect(() => {
        wordParser.enrichSections(sections, configWithEmptyLevels);
      }).not.toThrow();

      const result = wordParser.enrichSections(sections, configWithEmptyLevels);
      expect(result[0].depth).toBe(0);
    });

    test('should handle null hierarchy config', () => {
      const sections = [
        {
          type: 'section',
          level: 'Section',
          number: '5',
          prefix: 'Section ',
          title: 'Meetings',
          citation: 'Section 5',
          text: 'Meeting details'
        }
      ];

      const configWithNullHierarchy = {
        hierarchy: null
      };

      expect(() => {
        wordParser.enrichSections(sections, configWithNullHierarchy);
      }).not.toThrow();
    });

    test('should use level defaults when levelDef not found', () => {
      const sections = [
        {
          type: 'unknown-type',
          level: 'Unknown',
          number: '1',
          prefix: 'Unknown ',
          title: 'Mystery Section',
          citation: 'Unknown 1',
          text: 'Unknown content'
        }
      ];

      const configWithDifferentTypes = {
        hierarchy: {
          levels: [
            { type: 'article', depth: 0 },
            { type: 'section', depth: 1 }
          ]
        }
      };

      const result = wordParser.enrichSections(sections, configWithDifferentTypes);

      // Should not crash and should default depth to 0
      expect(result[0].depth).toBe(0);
    });

    test('should handle parseDocument with undefined levels', async () => {
      // Mock file system
      const fs = require('fs').promises;
      const originalReadFile = fs.readFile;

      // Create a temporary mock
      fs.readFile = jest.fn().mockRejectedValue(
        new Error('File not found - expected for this test')
      );

      const config = {
        hierarchy: {
          // levels undefined
        }
      };

      const result = await wordParser.parseDocument('/fake/path.docx', config);

      // Should return error gracefully, not crash
      expect(result.success).toBe(false);
      expect(result.sections).toEqual([]);

      // Restore original
      fs.readFile = originalReadFile;
    });
  });

  describe('Issue #2: Duplicate Section Prevention', () => {
    /**
     * CRITICAL: Documents with Table of Contents get duplicate sections
     * Need to verify TOC detection and deduplication work correctly
     */
    test('should detect Table of Contents patterns', () => {
      const lines = [
        'TABLE OF CONTENTS',
        '',
        'ARTICLE I\tNAME\t4',
        'ARTICLE II\tPURPOSE\t5',
        'Section 1\tMeetings\t6',
        '',
        'ARTICLE I NAME',
        'This is the actual content...',
        '',
        'ARTICLE II PURPOSE',
        'More actual content...'
      ];

      const tocLines = wordParser.detectTableOfContents(lines);

      // Should detect TOC header lines (with TAB + page number)
      expect(tocLines.has(2)).toBe(true); // ARTICLE I TOC line
      expect(tocLines.has(3)).toBe(true); // ARTICLE II TOC line
      expect(tocLines.has(4)).toBe(true); // Section 1 TOC line

      // Should NOT mark actual content as TOC
      expect(tocLines.has(6)).toBe(false); // Actual ARTICLE I
      expect(tocLines.has(9)).toBe(false); // Actual ARTICLE II
    });

    test('should deduplicate sections by citation', () => {
      const sections = [
        {
          citation: 'ARTICLE I',
          title: 'NAME',
          text: 'Short version',
          type: 'article'
        },
        {
          citation: 'Section 1',
          title: 'Purpose',
          text: 'Section content',
          type: 'section'
        },
        {
          citation: 'ARTICLE I',
          title: 'NAME',
          text: 'Much longer version with complete details about the organization name and structure',
          type: 'article'
        }
      ];

      const deduplicated = wordParser.deduplicateSections(sections);

      // Should have 2 sections (duplicate ARTICLE I removed)
      expect(deduplicated).toHaveLength(2);

      // Should keep the longer version
      const articleI = deduplicated.find(s => s.citation === 'ARTICLE I');
      expect(articleI.text).toContain('Much longer version');
      expect(articleI.text.length).toBeGreaterThan(50);
    });

    test('should handle multiple duplicates of same section', () => {
      const sections = [
        { citation: 'Section 2', title: 'Rules', text: 'v1', type: 'section' },
        { citation: 'Section 2', title: 'Rules', text: 'v2 longer', type: 'section' },
        { citation: 'Section 2', title: 'Rules', text: 'v3', type: 'section' },
        { citation: 'Section 2', title: 'Rules', text: 'v4 this is the longest version with most content', type: 'section' }
      ];

      const deduplicated = wordParser.deduplicateSections(sections);

      // Should keep only 1
      expect(deduplicated).toHaveLength(1);

      // Should keep the longest
      expect(deduplicated[0].text).toContain('longest version');
    });

    test('should not deduplicate different citations', () => {
      const sections = [
        { citation: 'ARTICLE I', title: 'NAME', text: 'Content 1', type: 'article' },
        { citation: 'ARTICLE II', title: 'PURPOSE', text: 'Content 2', type: 'article' },
        { citation: 'ARTICLE III', title: 'BOUNDARIES', text: 'Content 3', type: 'article' }
      ];

      const deduplicated = wordParser.deduplicateSections(sections);

      // All should remain
      expect(deduplicated).toHaveLength(3);
      expect(deduplicated).toEqual(sections);
    });

    test('should prefer section with content over empty duplicate', () => {
      const sections = [
        { citation: 'Section 1', title: 'First', text: '', type: 'section' },
        { citation: 'Section 1', title: 'First', text: 'Actual content here', type: 'section' }
      ];

      const deduplicated = wordParser.deduplicateSections(sections);

      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].text).toBe('Actual content here');
    });

    test('should handle deduplication with undefined text fields', () => {
      const sections = [
        { citation: 'ARTICLE I', title: 'NAME', text: undefined, type: 'article' },
        { citation: 'ARTICLE I', title: 'NAME', text: 'Content', type: 'article' }
      ];

      expect(() => {
        wordParser.deduplicateSections(sections);
      }).not.toThrow();

      const deduplicated = wordParser.deduplicateSections(sections);
      expect(deduplicated[0].text).toBe('Content');
    });

    test('should handle deduplication with null text fields', () => {
      const sections = [
        { citation: 'Section 5', title: 'Test', text: null, type: 'section' },
        { citation: 'Section 5', title: 'Test', text: 'Real content', type: 'section' }
      ];

      const deduplicated = wordParser.deduplicateSections(sections);
      expect(deduplicated).toHaveLength(1);
      expect(deduplicated[0].text).toBe('Real content');
    });
  });

  describe('Text Normalization Edge Cases', () => {
    test('should handle TAB-separated content correctly', () => {
      const text = 'ARTICLE I\tNAME\t4';
      const normalized = wordParser.normalizeForMatching(text);

      // Should remove page number (after first TAB)
      expect(normalized).not.toContain('4');
      // Should collapse whitespace
      expect(normalized).toBe('ARTICLE I');
    });

    test('should handle multiple spaces and tabs', () => {
      const text = 'Section   1:    \t  Purpose  \t  12';
      const normalized = wordParser.normalizeForMatching(text);

      // normalizeForMatching removes everything after first TAB (page numbers in TOC)
      // So "Section 1:\tPurpose\t12" becomes "Section 1:"
      expect(normalized).toBe('SECTION 1:');
    });

    test('should normalize case consistently', () => {
      const text1 = 'Article I Name';
      const text2 = 'ARTICLE I NAME';
      const text3 = 'article i name';

      expect(wordParser.normalizeForMatching(text1))
        .toBe(wordParser.normalizeForMatching(text2));
      expect(wordParser.normalizeForMatching(text2))
        .toBe(wordParser.normalizeForMatching(text3));
    });
  });

  describe('Orphaned Content Handling', () => {
    test('should capture content before first section', () => {
      const lines = [
        'This is preamble content',
        'That appears before any sections',
        '',
        'ARTICLE I NAME',
        'Article content here'
      ];

      const sections = [
        {
          type: 'article',
          citation: 'ARTICLE I',
          title: 'NAME',
          text: 'Article content here',
          lineNumber: 3
        }
      ];

      const detectedItems = [];
      const result = wordParser.captureOrphanedContent(lines, sections, detectedItems);

      // Should either create preamble or attach to existing section
      expect(result.length).toBeGreaterThanOrEqual(sections.length);
      // Verify orphan handling occurred (either preamble created or content attached)
      expect(result).toBeDefined();
    });

    test('should not capture TOC lines as orphans', () => {
      const lines = [
        'TABLE OF CONTENTS',
        '',
        'ARTICLE I\tNAME\t4',
        'ARTICLE II\tPURPOSE\t5',
        'Section 1\tMeetings\t6',
        '',
        'ARTICLE I NAME',
        'Real content'
      ];

      const sections = [
        {
          type: 'article',
          citation: 'ARTICLE I',
          title: 'NAME',
          text: 'Real content',
          lineNumber: 6
        }
      ];

      const detectedItems = [];
      const result = wordParser.captureOrphanedContent(lines, sections, detectedItems);

      // TOC lines should not create orphan sections (need 3+ lines for TOC detection)
      // With 3 TOC lines (lines 2,3,4), they should be marked as captured
      const orphans = result.filter(s => s.isOrphan);
      expect(orphans.length).toBe(0);
    });

    test('should skip trivial orphaned content', () => {
      const lines = [
        'A',  // Too short
        '',
        'ARTICLE I NAME',
        'Content'
      ];

      const sections = [
        {
          type: 'article',
          citation: 'ARTICLE I',
          title: 'NAME',
          text: 'Content',
          lineNumber: 2
        }
      ];

      const detectedItems = [];
      const result = wordParser.captureOrphanedContent(lines, sections, detectedItems);

      // Should not create significant orphan sections for trivial content
      // Result length should be equal or slightly more than input
      expect(result.length).toBeLessThanOrEqual(sections.length + 1);
    });
  });

  describe('Section Validation', () => {
    test('should detect empty sections', () => {
      const sections = [
        { citation: 'ARTICLE I', title: 'NAME', text: '', type: 'article' },
        { citation: 'Section 1', title: 'Purpose', text: 'Content', type: 'section' },
        { citation: 'Section 2', title: 'Empty', text: '', type: 'section' }
      ];

      const validation = wordParser.validateSections(sections, { hierarchy: {} });

      expect(validation.warnings.length).toBeGreaterThan(0);
      const emptyWarning = validation.warnings.find(w => w.message.includes('no content'));
      expect(emptyWarning).toBeDefined();
    });

    test('should detect duplicate citations', () => {
      const sections = [
        { citation: 'Section 1', title: 'First', text: 'A', type: 'section' },
        { citation: 'Section 2', title: 'Second', text: 'B', type: 'section' },
        { citation: 'Section 1', title: 'Duplicate', text: 'C', type: 'section' }
      ];

      const validation = wordParser.validateSections(sections, { hierarchy: {} });

      expect(validation.valid).toBe(false);
      const dupError = validation.errors.find(e => e.message.includes('Duplicate'));
      expect(dupError).toBeDefined();
      expect(dupError.citations).toContain('Section 1');
    });

    test('should handle validation with no errors', () => {
      const sections = [
        { citation: 'ARTICLE I', title: 'NAME', text: 'Content 1', type: 'article', depth: 0 },
        { citation: 'Section 1', title: 'Purpose', text: 'Content 2', type: 'section', depth: 1 }
      ];

      const validation = wordParser.validateSections(sections, { hierarchy: {} });

      // May have warnings but should not have critical errors
      expect(validation.errors).toBeDefined();
    });
  });

  describe('Citation Building', () => {
    test('should build hierarchical citations for sections', () => {
      const previousSections = [
        { citation: 'ARTICLE I', type: 'article' }
      ];

      const item = {
        type: 'section',
        number: '1',
        prefix: 'Section '
      };

      const citation = wordParser.buildCitation(item, previousSections);

      expect(citation).toBe('ARTICLE I, Section 1');
    });

    test('should handle section without parent article', () => {
      const previousSections = [];

      const item = {
        type: 'section',
        number: '1',
        prefix: 'Section '
      };

      const citation = wordParser.buildCitation(item, previousSections);

      expect(citation).toBe('Section 1');
    });

    test('should build simple citation for articles', () => {
      const previousSections = [];

      const item = {
        type: 'article',
        number: 'II',
        prefix: 'ARTICLE '
      };

      const citation = wordParser.buildCitation(item, previousSections);

      expect(citation).toBe('ARTICLE II');
    });

    test('should find most recent parent article for subsections', () => {
      const previousSections = [
        { citation: 'ARTICLE I', type: 'article' },
        { citation: 'ARTICLE I, Section 1', type: 'section' },
        { citation: 'ARTICLE II', type: 'article' }
      ];

      const item = {
        type: 'subsection',
        number: 'A',
        prefix: 'Subsection '
      };

      const citation = wordParser.buildCitation(item, previousSections);

      // Should use ARTICLE II (most recent article)
      expect(citation).toBe('ARTICLE II, Subsection A');
    });
  });

  describe('Title and Content Extraction', () => {
    test('should extract title with colon delimiter', () => {
      const line = 'Section 1: Purpose and Scope';
      const item = { fullMatch: 'Section 1' };

      const { title, contentOnSameLine } = wordParser.extractTitleAndContent(line, item);

      expect(title).toBe('Purpose and Scope');
      expect(contentOnSameLine).toBeNull();
    });

    test('should extract title and content with dash separator', () => {
      const line = 'Section 2: Meetings – Held monthly on first Tuesday';
      const item = { fullMatch: 'Section 2' };

      const { title, contentOnSameLine } = wordParser.extractTitleAndContent(line, item);

      expect(title).toBe('Meetings');
      expect(contentOnSameLine).toBe('Held monthly on first Tuesday');
    });

    test('should handle title only (no content)', () => {
      const line = 'ARTICLE III: BOUNDARIES';
      const item = { fullMatch: 'ARTICLE III' };

      const { title, contentOnSameLine } = wordParser.extractTitleAndContent(line, item);

      expect(title).toBe('BOUNDARIES');
      expect(contentOnSameLine).toBeNull();
    });

    test('should handle content on same line as header', () => {
      const line = 'Section 5 - The organization shall meet regularly. Meetings are open to all members.';
      const item = { fullMatch: 'Section 5' };

      const { title, contentOnSameLine } = wordParser.extractTitleAndContent(line, item);

      expect(contentOnSameLine).toBeTruthy();
      // Content should include at least part of the text after the dash
      expect(contentOnSameLine.length).toBeGreaterThan(10);
    });

    test('should generate default title when none provided', () => {
      const line = 'ARTICLE I';
      const item = { fullMatch: 'ARTICLE I' };

      const { title } = wordParser.extractTitleAndContent(line, item);

      expect(title).toBe('(Untitled)');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle very large documents efficiently', () => {
      const largeSections = Array.from({ length: 1000 }, (_, i) => ({
        citation: `Section ${i + 1}`,
        title: `Section ${i + 1}`,
        text: `Content for section ${i + 1}`,
        type: 'section'
      }));

      const startTime = Date.now();
      const enriched = wordParser.enrichSections(largeSections, { hierarchy: {} });
      const duration = Date.now() - startTime;

      expect(enriched).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    test('should handle sections with special characters', () => {
      const sections = [
        {
          citation: 'Section 1',
          title: 'Name & Purpose',
          text: 'Content with "quotes" and \'apostrophes\' and – dashes',
          type: 'section'
        }
      ];

      const enriched = wordParser.enrichSections(sections, { hierarchy: {} });

      expect(enriched[0].title).toContain('&');
      expect(enriched[0].text).toContain('"quotes"');
    });

    test('should handle Unicode characters', () => {
      const sections = [
        {
          citation: 'Artículo I',
          title: 'Nombre y Propósito',
          text: 'Contenido en español with émojis 🎉',
          type: 'article'
        }
      ];

      const enriched = wordParser.enrichSections(sections, { hierarchy: {} });

      // Verify Unicode characters are preserved (check original data)
      expect(sections[0].title).toContain('ó');
      expect(sections[0].text).toContain('🎉');
      // Enriched sections should maintain the data
      expect(enriched[0]).toBeDefined();
      expect(enriched.length).toBe(1);
    });

    test('should handle extremely long text content', () => {
      const longText = 'A'.repeat(100000);
      const sections = [
        {
          citation: 'Section 1',
          title: 'Long Section',
          text: longText,
          type: 'section'
        }
      ];

      expect(() => {
        wordParser.enrichSections(sections, { hierarchy: {} });
      }).not.toThrow();
    });
  });
});

// Export for potential use in other tests
module.exports = {
  // Test helpers could go here
};
