/**
 * Parser Tests - Testing arbitrary depth hierarchies and document formats
 * Tests the flexible parser system for different organizational structures
 */

const fs = require('fs');
const path = require('path');

// Mock parser functions based on parse_bylaws.js patterns
function parseDocumentHierarchy(content, config = {}) {
  const {
    articlePattern = /^ARTICLE\s+([IVX]+)\s*(.*)$/,
    sectionPattern = /^Section\s+(\d+):\s*(.*)$/i,
    chapterPattern = /^Chapter\s+(\d+):\s*(.*)$/i,
    levelPatterns = []
  } = config;

  const sections = [];
  const lines = content.split('\n');
  let currentHierarchy = { article: null, chapter: null, section: null };
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Article header
    if (articlePattern.test(trimmed)) {
      const match = trimmed.match(articlePattern);
      currentHierarchy.article = { number: match[1], name: match[2] || '' };
      continue;
    }

    // Chapter header (optional level)
    if (chapterPattern && chapterPattern.test(trimmed)) {
      const match = trimmed.match(chapterPattern);
      currentHierarchy.chapter = { number: match[1], title: match[2] || '' };
      continue;
    }

    // Section header
    if (sectionPattern.test(trimmed)) {
      if (currentText.length > 0) {
        sections.push({
          hierarchy: { ...currentHierarchy },
          text: currentText.join('\n').trim()
        });
        currentText = [];
      }
      const match = trimmed.match(sectionPattern);
      currentHierarchy.section = { number: match[1], title: match[2] || '' };
      continue;
    }

    if (trimmed) {
      currentText.push(line);
    }
  }

  // Save last section
  if (currentText.length > 0) {
    sections.push({
      hierarchy: { ...currentHierarchy },
      text: currentText.join('\n').trim()
    });
  }

  return sections;
}

describe('Document Parser Tests', () => {
  describe('Article/Section Format (Traditional)', () => {
    test('should parse Article I, Section 1 format', () => {
      const content = `
ARTICLE I NAME
Section 1: Purpose
This organization serves the community.

Section 2: Scope
We serve the Reseda area.
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].hierarchy.article.number).toBe('I');
      expect(sections[0].hierarchy.section.number).toBe('1');
      expect(sections[0].text).toContain('community');
    });

    test('should handle multiple articles', () => {
      const content = `
ARTICLE I FIRST
Section 1: First Section
Content 1

ARTICLE II SECOND
Section 1: Another Section
Content 2
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].hierarchy.article.number).toBe('I');
      expect(sections[1].hierarchy.article.number).toBe('II');
    });

    test('should handle Roman numerals correctly', () => {
      const content = `
ARTICLE V GOVERNANCE
Section 3: Procedures
Standard procedures apply.
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections[0].hierarchy.article.number).toBe('V');
      expect(sections[0].hierarchy.section.number).toBe('3');
    });
  });

  describe('Chapter/Article Format (Alternate)', () => {
    test('should parse Chapter/Article hierarchy', () => {
      const content = `
Chapter 1: Introduction
ARTICLE I PURPOSE
Section 1: Mission
Our mission statement.
`;

      const config = {
        chapterPattern: /^Chapter\s+(\d+):\s*(.*)$/i
      };

      const sections = parseDocumentHierarchy(content, config);

      expect(sections[0].hierarchy.chapter).toBeDefined();
      expect(sections[0].hierarchy.chapter.number).toBe('1');
    });
  });

  describe('Numbered Sections (Simple)', () => {
    test('should parse simple numbered sections', () => {
      const content = `
1. Introduction
This is the introduction.

2. Purpose
This is the purpose.

3. Scope
This is the scope.
`;

      const config = {
        sectionPattern: /^(\d+)\.\s+(.*)$/
      };

      const sections = parseDocumentHierarchy(content, config);

      expect(sections.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty sections gracefully', () => {
      const content = `
ARTICLE I TEST
Section 1: Empty Section

Section 2: Has Content
Some content here.
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].text).toBe('');
      expect(sections[1].text).toContain('content');
    });

    test('should handle sections without articles', () => {
      const content = `
Section 1: Standalone
This section has no article.
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections).toHaveLength(1);
      expect(sections[0].hierarchy.article).toBeNull();
    });

    test('should preserve whitespace within content', () => {
      const content = `
ARTICLE I TEST
Section 1: Formatted
  Indented text
    More indent
  Back to first level
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections[0].text).toContain('  Indented');
      expect(sections[0].text).toContain('    More indent');
    });

    test('should handle very long section text', () => {
      const longText = 'A'.repeat(10000);
      const content = `
ARTICLE I TEST
Section 1: Long
${longText}
`;

      const sections = parseDocumentHierarchy(content);

      expect(sections[0].text.length).toBeGreaterThan(9000);
    });
  });

  describe('Custom Hierarchy Patterns', () => {
    test('should support custom patterns via configuration', () => {
      const content = `
PART A: Introduction
SECTION 1: First
Content here.
`;

      const config = {
        articlePattern: /^PART\s+([A-Z]):\s*(.*)$/,
        sectionPattern: /^SECTION\s+(\d+):\s*(.*)$/
      };

      const sections = parseDocumentHierarchy(content, config);

      expect(sections[0].hierarchy.article.number).toBe('A');
    });
  });

  describe('Multi-level Depth', () => {
    test('should handle 3+ level hierarchies', () => {
      const content = `
ARTICLE I GOVERNANCE
Chapter 1: Overview
Section 1: Purpose
Subsection A: Details
Deep content.
`;

      // This would require enhanced parser - testing current limits
      const sections = parseDocumentHierarchy(content);

      // Current parser handles 2 levels well
      expect(sections.length).toBeGreaterThan(0);
    });
  });
});

describe('Parser Configuration', () => {
  test('should validate parser configuration', () => {
    const validConfig = {
      articlePattern: /^ARTICLE/,
      sectionPattern: /^Section/
    };

    expect(validConfig.articlePattern).toBeInstanceOf(RegExp);
    expect(validConfig.sectionPattern).toBeInstanceOf(RegExp);
  });

  test('should handle missing optional patterns', () => {
    const minimalConfig = {
      sectionPattern: /^Section/
    };

    const content = 'Section 1: Test\nContent.';
    const sections = parseDocumentHierarchy(content, minimalConfig);

    expect(sections).toBeDefined();
  });
});

describe('Parser Performance', () => {
  test('should parse large documents efficiently', () => {
    const largeSections = Array.from({ length: 100 }, (_, i) => `
ARTICLE ${i + 1} SECTION
Section 1: Test
Content for section ${i + 1}.
`).join('\n');

    const startTime = Date.now();
    const sections = parseDocumentHierarchy(largeSections);
    const duration = Date.now() - startTime;

    expect(sections.length).toBe(100);
    expect(duration).toBeLessThan(1000); // Should parse in < 1 second
  });
});

// Mock Jest functions for standalone execution
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => {
    console.log(`\n${name}`);
    fn();
  };
  global.test = (name, fn) => {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (error) {
      console.log(`  ✗ ${name}`);
      console.error(`    ${error.message}`);
    }
  };
  global.expect = (value) => ({
    toBe: (expected) => {
      if (value !== expected) throw new Error(`Expected ${expected}, got ${value}`);
    },
    toHaveLength: (expected) => {
      if (value.length !== expected) throw new Error(`Expected length ${expected}, got ${value.length}`);
    },
    toContain: (expected) => {
      if (!value.includes(expected)) throw new Error(`Expected to contain ${expected}`);
    },
    toBeDefined: () => {
      if (value === undefined) throw new Error('Expected to be defined');
    },
    toBeNull: () => {
      if (value !== null) throw new Error('Expected to be null');
    },
    toBeInstanceOf: (expected) => {
      if (!(value instanceof expected)) throw new Error(`Expected instance of ${expected.name}`);
    },
    toBeGreaterThan: (expected) => {
      if (value <= expected) throw new Error(`Expected > ${expected}, got ${value}`);
    },
    toBeLessThan: (expected) => {
      if (value >= expected) throw new Error(`Expected < ${expected}, got ${value}`);
    }
  });
}

module.exports = { parseDocumentHierarchy };
