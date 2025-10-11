# Smart Hierarchy Detection Algorithm - Usage Guide

## Overview

The Smart Hierarchy Detection Algorithm recognizes up to 10 levels of document structure using various numbering patterns and style indicators.

## Features

- **10-Level Hierarchy Detection**: Recognizes Roman numerals, Arabic numbers, letters, and nested formats
- **Style-Based Detection**: Analyzes headings, font sizes, bold text, and indentation
- **Tree Building**: Constructs hierarchical tree structures from flat paragraph lists
- **Validation**: Detects numbering gaps and mixed styles
- **Pattern Recognition**: Identifies multiple numbering formats in the same document

## Supported Numbering Patterns

### 1. Roman Numerals
- **Uppercase**: I, II, III, IV, V, VI, etc. (Level 0)
- **Lowercase**: i, ii, iii, iv, v, vi, etc. (Level 5)

### 2. Arabic Numbers
- **Simple**: 1, 2, 3, etc. (Level 1)
- **Parenthesized**: (1), (2), (3), etc. (Level 3)

### 3. Letters
- **Uppercase**: A, B, C, etc. (Level 2)
- **Lowercase**: a, b, c, etc. (Level 4)
- **Parenthesized**: (a), (b), (c), etc. (Level 6)

### 4. Nested Formats
- **Decimal**: 1.1, 1.2, 1.1.1, etc. (Dynamic level based on depth)
- **Mixed**: A.1, A.1.a, etc. (Dynamic level)

## API Reference

### Core Functions

#### `detectHierarchyLevel(text, style, indentation)`
Detect hierarchy level from text, style, and indentation.

**Parameters:**
- `text` (string): Text content to analyze
- `style` (object): Style attributes (heading, fontSize, bold)
- `indentation` (number): Indentation level in pixels

**Returns:** (number) Hierarchy level 0-9

**Example:**
```javascript
const level = detectHierarchyLevel(
  'I. Introduction',
  { bold: true, fontSize: '20px' },
  0
);
// Returns: 0
```

#### `parseNumberingStyle(text)`
Parse numbering style from text.

**Parameters:**
- `text` (string): Text to analyze

**Returns:** (object|null) Parsed numbering information or null

**Example:**
```javascript
const numbering = parseNumberingStyle('1.1. Nested Section');
// Returns: {
//   type: 'DECIMAL_NESTED',
//   value: '1.1',
//   depth: 2,
//   numericValue: 1,
//   baseLevel: 2,
//   rawText: '1.1. '
// }
```

#### `buildSectionTree(paragraphs)`
Build hierarchical tree structure from paragraphs.

**Parameters:**
- `paragraphs` (array): Array of paragraph objects with text, style, and indentation

**Returns:** (object) Tree structure with root and metadata

**Example:**
```javascript
const paragraphs = [
  { text: 'I. Article One', style: {}, indentation: 0 },
  { text: '1. Section One', style: {}, indentation: 20 },
  { text: 'A. Subsection A', style: {}, indentation: 40 }
];

const tree = buildSectionTree(paragraphs);
// Returns: {
//   root: [ /* hierarchical nodes */ ],
//   metadata: {
//     totalLevels: 3,
//     patterns: ['ROMAN_UPPER', 'ARABIC', 'LETTER_UPPER'],
//     totalNodes: 3
//   }
// }
```

#### `validateNumberingSequence(nodes)`
Validate section numbering sequence.

**Parameters:**
- `nodes` (array): Array of nodes at the same level

**Returns:** (object) Validation result with errors and warnings

**Example:**
```javascript
const nodes = [
  { numbering: { type: 'ARABIC', value: 1, numericValue: 1 } },
  { numbering: { type: 'ARABIC', value: 2, numericValue: 2 } },
  { numbering: { type: 'ARABIC', value: 4, numericValue: 4 } } // Missing 3
];

const validation = validateNumberingSequence(nodes);
// Returns: {
//   valid: true,
//   errors: [],
//   warnings: [{
//     type: 'SEQUENCE_GAP',
//     message: 'Numbering gap detected: 2 → 4',
//     indices: [1, 2]
//   }]
// }
```

#### `getSectionPath(tree, nodeId)`
Get section path from root to node.

**Parameters:**
- `tree` (object): Document tree
- `nodeId` (number): Node ID to find

**Returns:** (array) Array of nodes from root to target

**Example:**
```javascript
const path = getSectionPath(tree, 5);
// Returns: [article, section, subsection, clause, subclause, detail]
```

### Utility Functions

#### `romanToArabic(roman)`
Convert Roman numeral to Arabic number.

**Example:**
```javascript
romanToArabic('XIV');  // Returns: 14
romanToArabic('xiv');  // Returns: 14
```

#### `letterToNumber(letter)`
Convert letter to numeric position (A=1, B=2, etc.).

**Example:**
```javascript
letterToNumber('A');  // Returns: 1
letterToNumber('Z');  // Returns: 26
```

## Usage Examples

### Example 1: Bylaw Document Structure

```javascript
const { buildSectionTree, validateNumberingSequence } = require('./src/utils/hierarchyDetector');

const bylawParagraphs = [
  { text: 'I. Article I - Name', style: { bold: true, fontSize: '20px' }, indentation: 0 },
  { text: '1. Section 1 - Purpose', style: { fontSize: '16px' }, indentation: 20 },
  { text: 'A. Subsection detail', style: { fontSize: '14px' }, indentation: 40 },
  { text: '1. Clause item', style: { fontSize: '12px' }, indentation: 60 },
  { text: 'a. Subclause detail', style: { fontSize: '12px' }, indentation: 80 },
  { text: 'i. Further detail', style: { fontSize: '12px' }, indentation: 100 }
];

const tree = buildSectionTree(bylawParagraphs);

console.log('Total levels:', tree.metadata.totalLevels);
console.log('Patterns used:', tree.metadata.patterns);
console.log('Root nodes:', tree.root.length);

// Validate numbering
const validation = validateNumberingSequence(tree.root);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.log('Validation warnings:', validation.warnings);
}
```

### Example 2: Detecting Missing Sections

```javascript
const { parseNumberingStyle, validateNumberingSequence } = require('./src/utils/hierarchyDetector');

const sections = [
  'I. Introduction',
  'II. Background',
  'IV. Methodology',  // Missing III
  'V. Results'
].map(text => ({
  numbering: parseNumberingStyle(text)
}));

const validation = validateNumberingSequence(sections);
validation.warnings.forEach(warning => {
  if (warning.type === 'SEQUENCE_GAP') {
    console.log(`Warning: ${warning.message}`);
  }
});
```

### Example 3: Finding Section Path

```javascript
const { buildSectionTree, getSectionPath } = require('./src/utils/hierarchyDetector');

const paragraphs = [
  { text: 'I. Article', style: {}, indentation: 0 },
  { text: '1. Section', style: {}, indentation: 20 },
  { text: 'A. Subsection', style: {}, indentation: 40 },
  { text: '1. Item', style: {}, indentation: 60 }
];

const tree = buildSectionTree(paragraphs);

// Find path to the deepest item (id: 3)
const path = getSectionPath(tree, 3);

console.log('Section path:');
path.forEach((node, index) => {
  console.log(`  ${'  '.repeat(index)}${node.text}`);
});
```

### Example 4: Style-Based Hierarchy

```javascript
const { detectHierarchyLevel } = require('./src/utils/hierarchyDetector');

const headings = [
  { text: 'Main Title', style: { heading: 'Heading 1' }, indentation: 0 },
  { text: 'Chapter Title', style: { heading: 'Heading 2' }, indentation: 0 },
  { text: 'Section Title', style: { heading: 'Heading 3' }, indentation: 0 },
  { text: 'Subsection', style: { fontSize: '14px', bold: true }, indentation: 20 },
  { text: 'Content', style: { fontSize: '12px' }, indentation: 40 }
];

headings.forEach(heading => {
  const level = detectHierarchyLevel(heading.text, heading.style, heading.indentation);
  console.log(`"${heading.text}" → Level ${level}`);
});
```

## Integration with Bylaws Amendment Tool

To integrate with the main application:

```javascript
// In your document parser
const { buildSectionTree, validateNumberingSequence } = require('./src/utils/hierarchyDetector');

function parseDocumentStructure(docxParagraphs) {
  // Convert docx paragraphs to hierarchy format
  const paragraphs = docxParagraphs.map(para => ({
    text: para.text,
    style: {
      heading: para.heading,
      fontSize: para.style?.fontSize,
      bold: para.style?.bold
    },
    indentation: para.indent || 0
  }));

  // Build hierarchy tree
  const tree = buildSectionTree(paragraphs);

  // Validate numbering
  const validation = validateNumberingSequence(tree.root);

  return {
    tree,
    validation,
    metadata: tree.metadata
  };
}
```

## Performance Characteristics

- **Time Complexity**: O(n) for building tree from n paragraphs
- **Space Complexity**: O(n) for storing tree structure
- **Pattern Matching**: Uses efficient regex-based parsing
- **Validation**: Linear scan for sequence checking

## Edge Cases Handled

1. **Skipped Numbering**: I, II, IV (missing III)
2. **Multiple Formats**: Different numbering styles in same document
3. **Unnumbered Sections**: Sections identified by style only
4. **Deep Nesting**: Up to 10 levels of hierarchy
5. **Mixed Styles**: Combination of numbering and heading styles

## Testing

Run the test suite:

```bash
npm test tests/unit/hierarchyDetector.test.js
```

Test coverage:
- 47 comprehensive tests
- All numbering patterns
- Edge cases and complex scenarios
- Real-world bylaw structures

## License

MIT License - Part of Bylaws Amendment Tracker
