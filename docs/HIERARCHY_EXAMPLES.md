# Hierarchy Detection Examples

## Example 1: Complete Bylaw Structure (10 Levels)

This example demonstrates the algorithm's ability to detect and organize all 10 hierarchy levels.

```javascript
const { buildSectionTree, getSectionPath } = require('../src/utils/hierarchyDetector');

const complexBylawStructure = [
  // Level 0: Roman numerals (uppercase)
  { text: 'Article I - Name', style: { bold: true, fontSize: '24px' }, indentation: 0 },

  // Level 1: Arabic numbers
  { text: '  Section 1 - Purpose', style: { fontSize: '20px' }, indentation: 20 },

  // Level 2: Uppercase letters
  { text: '    A. Subsection detail', style: { fontSize: '18px' }, indentation: 40 },

  // Level 3: Parenthesized numbers
  { text: '      (1) Clause item', style: { fontSize: '16px' }, indentation: 60 },

  // Level 4: Lowercase letters
  { text: '        a. Subclause detail', style: { fontSize: '14px' }, indentation: 80 },

  // Level 5: Lowercase Roman numerals
  { text: '          i. Further detail', style: { fontSize: '12px' }, indentation: 100 },

  // Level 6: Parenthesized lowercase letters
  { text: '            (a) Sub-detail', style: { fontSize: '12px' }, indentation: 120 },

  // Level 7: Decimal nested 1.1
  { text: '              1.1. Nested section', style: { fontSize: '12px' }, indentation: 140 },

  // Level 8: Decimal nested 1.1.1
  { text: '                1.1.1. Deep nested', style: { fontSize: '11px' }, indentation: 160 },

  // Level 9: Decimal nested 1.1.1.1
  { text: '                  1.1.1.1. Deepest level', style: { fontSize: '11px' }, indentation: 180 }
];

const tree = buildSectionTree(complexBylawStructure);

console.log('=== Document Structure Analysis ===');
console.log(`Total Levels: ${tree.metadata.totalLevels}`);
console.log(`Total Nodes: ${tree.metadata.totalNodes}`);
console.log(`Numbering Patterns Used: ${tree.metadata.patterns.join(', ')}`);
console.log('\n=== Tree Structure ===');
printTree(tree.root, 0);

function printTree(nodes, indent) {
  nodes.forEach(node => {
    const prefix = '  '.repeat(indent);
    const numbering = node.numbering ? `[${node.numbering.type}] ` : '';
    console.log(`${prefix}${numbering}${node.text} (Level ${node.level})`);
    if (node.children.length > 0) {
      printTree(node.children, indent + 1);
    }
  });
}

// Find path to deepest node
const deepestNode = tree.metadata.totalNodes - 1;
const path = getSectionPath(tree, deepestNode);
console.log('\n=== Path to Deepest Node ===');
path.forEach((node, index) => {
  console.log(`Level ${index}: ${node.text}`);
});
```

### Expected Output:
```
=== Document Structure Analysis ===
Total Levels: 10
Total Nodes: 10
Numbering Patterns Used: ROMAN_UPPER, ARABIC, LETTER_UPPER, PAREN_ARABIC, LETTER_LOWER, ROMAN_LOWER, PAREN_LETTER, DECIMAL_NESTED

=== Tree Structure ===
[ROMAN_UPPER] Article I - Name (Level 0)
  [ARABIC] Section 1 - Purpose (Level 1)
    [LETTER_UPPER] A. Subsection detail (Level 2)
      [PAREN_ARABIC] (1) Clause item (Level 3)
        [LETTER_LOWER] a. Subclause detail (Level 4)
          [ROMAN_LOWER] i. Further detail (Level 5)
            [PAREN_LETTER] (a) Sub-detail (Level 6)
              [DECIMAL_NESTED] 1.1. Nested section (Level 7)
                [DECIMAL_NESTED] 1.1.1. Deep nested (Level 8)
                  [DECIMAL_NESTED] 1.1.1.1. Deepest level (Level 9)

=== Path to Deepest Node ===
Level 0: Article I - Name
Level 1: Section 1 - Purpose
Level 2: A. Subsection detail
Level 3: (1) Clause item
Level 4: a. Subclause detail
Level 5: i. Further detail
Level 6: (a) Sub-detail
Level 7: 1.1. Nested section
Level 8: 1.1.1. Deep nested
Level 9: 1.1.1.1. Deepest level
```

## Example 2: Requested Test Pattern

The exact pattern from your requirements:

```javascript
const { buildSectionTree, validateNumberingSequence, parseNumberingStyle } = require('../src/utils/hierarchyDetector');

const requestedPattern = [
  { text: 'Article I - Name', style: { bold: true, fontSize: '20px' }, indentation: 0 },
  { text: '  Section 1 - Purpose', style: { fontSize: '16px' }, indentation: 20 },
  { text: '    A. Subsection detail', style: { fontSize: '14px' }, indentation: 40 },
  { text: '      1. Clause item', style: { fontSize: '12px' }, indentation: 60 },
  { text: '        a. Subclause detail', style: { fontSize: '12px' }, indentation: 80 },
  { text: '          i. Further detail', style: { fontSize: '11px' }, indentation: 100 }
];

const tree = buildSectionTree(requestedPattern);

console.log('=== Pattern Recognition Results ===\n');

requestedPattern.forEach((para, index) => {
  const numbering = parseNumberingStyle(para.text);
  const level = tree.root.length > 0 ? findNodeLevel(tree.root, index) : 0;

  console.log(`Text: "${para.text.trim()}"`);
  if (numbering) {
    console.log(`  Type: ${numbering.type}`);
    console.log(`  Value: ${numbering.value}`);
    console.log(`  Numeric: ${numbering.numericValue}`);
    console.log(`  Base Level: ${numbering.baseLevel}`);
  }
  console.log(`  Detected Level: ${level}`);
  console.log(`  Indentation: ${para.indentation}px`);
  console.log('');
});

function findNodeLevel(nodes, targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return node.level;
    if (node.children.length > 0) {
      const found = findNodeLevel(node.children, targetId);
      if (found !== null) return found;
    }
  }
  return null;
}

// Validate the structure
const validation = validateNumberingSequence(tree.root);
console.log('=== Validation Results ===');
console.log(`Valid: ${validation.valid}`);
console.log(`Errors: ${validation.errors.length}`);
console.log(`Warnings: ${validation.warnings.length}`);

if (validation.warnings.length > 0) {
  console.log('\nWarnings:');
  validation.warnings.forEach(warning => {
    console.log(`  - ${warning.type}: ${warning.message}`);
  });
}
```

### Expected Output:
```
=== Pattern Recognition Results ===

Text: "Article I - Name"
  Type: ROMAN_UPPER
  Value: I
  Numeric: 1
  Base Level: 0
  Detected Level: 0
  Indentation: 0px

Text: "Section 1 - Purpose"
  Type: ARABIC
  Value: 1
  Numeric: 1
  Base Level: 1
  Detected Level: 2
  Indentation: 20px

Text: "A. Subsection detail"
  Type: LETTER_UPPER
  Value: A
  Numeric: 1
  Base Level: 2
  Detected Level: 4
  Indentation: 40px

Text: "1. Clause item"
  Type: ARABIC
  Value: 1
  Numeric: 1
  Base Level: 1
  Detected Level: 4
  Indentation: 60px

Text: "a. Subclause detail"
  Type: LETTER_LOWER
  Value: a
  Numeric: 1
  Base Level: 4
  Detected Level: 8
  Indentation: 80px

Text: "i. Further detail"
  Type: ROMAN_LOWER
  Value: i
  Numeric: 1
  Base Level: 5
  Detected Level: 9
  Indentation: 100px

=== Validation Results ===
Valid: true
Errors: 0
Warnings: 0
```

## Example 3: Detecting and Fixing Issues

```javascript
const { buildSectionTree, validateNumberingSequence } = require('../src/utils/hierarchyDetector');

// Document with numbering issues
const problematicDocument = [
  { text: 'I. Introduction', style: {}, indentation: 0 },
  { text: '1. Background', style: {}, indentation: 20 },
  { text: '3. Methodology', style: {}, indentation: 20 }, // Missing 2!
  { text: 'A. Data Collection', style: {}, indentation: 40 },
  { text: '1. Primary Sources', style: {}, indentation: 60 },
  { text: 'a. Archives', style: {}, indentation: 80 },
  { text: 'II. Literature Review', style: {}, indentation: 0 },
  { text: 'IV. Analysis', style: {}, indentation: 0 } // Missing III!
];

const tree = buildSectionTree(problematicDocument);

// Check each level for issues
function validateLevel(nodes, levelName) {
  const validation = validateNumberingSequence(nodes);

  if (validation.warnings.length > 0) {
    console.log(`\n⚠️  Issues found in ${levelName}:`);
    validation.warnings.forEach(warning => {
      console.log(`   ${warning.type}: ${warning.message}`);
      if (warning.indices) {
        console.log(`   At positions: ${warning.indices.join(', ')}`);
      }
    });
  } else {
    console.log(`\n✅ ${levelName}: No issues`);
  }
}

console.log('=== Document Numbering Validation ===');
validateLevel(tree.root, 'Top Level (Articles)');

// Validate children at each level
tree.root.forEach((article, index) => {
  if (article.children.length > 0) {
    validateLevel(article.children, `Article ${index + 1} Sections`);

    article.children.forEach((section, sIndex) => {
      if (section.children.length > 0) {
        validateLevel(section.children, `Section ${sIndex + 1} Subsections`);
      }
    });
  }
});
```

### Expected Output:
```
=== Document Numbering Validation ===

⚠️  Issues found in Top Level (Articles):
   SEQUENCE_GAP: Numbering gap detected: II → IV
   At positions: 6, 7

⚠️  Issues found in Article 1 Sections:
   SEQUENCE_GAP: Numbering gap detected: 1 → 3
   At positions: 0, 1

✅ Section 2 Subsections: No issues
```

## Example 4: Real-Time Document Analysis

```javascript
const { detectHierarchyLevel, parseNumberingStyle } = require('../src/utils/hierarchyDetector');

// Simulate real-time paragraph analysis as user types
function analyzeNewParagraph(text, style, indentation) {
  const numbering = parseNumberingStyle(text);
  const level = detectHierarchyLevel(text, style, indentation);

  console.log('\n--- New Paragraph Analysis ---');
  console.log(`Input: "${text}"`);

  if (numbering) {
    console.log(`✓ Numbering Detected: ${numbering.type}`);
    console.log(`  Value: ${numbering.value}`);
    console.log(`  Position in sequence: ${numbering.numericValue}`);
  } else {
    console.log(`✗ No numbering detected`);
  }

  console.log(`Hierarchy Level: ${level}`);
  console.log(`Style: ${JSON.stringify(style)}`);
  console.log(`Indentation: ${indentation}px`);

  // Provide suggestions
  if (level > 7) {
    console.log(`⚠️  Warning: Deep nesting (Level ${level}). Consider restructuring.`);
  }

  return { numbering, level };
}

// Test with various inputs
analyzeNewParagraph('Article I - Name', { bold: true, fontSize: '20px' }, 0);
analyzeNewParagraph('Section 1 - Details', { fontSize: '16px' }, 20);
analyzeNewParagraph('A. Subsection', { fontSize: '14px' }, 40);
analyzeNewParagraph('(1) Item', { fontSize: '12px' }, 60);
analyzeNewParagraph('a. Detail', { fontSize: '12px' }, 80);
analyzeNewParagraph('i. Sub-detail', { fontSize: '11px' }, 100);
analyzeNewParagraph('(a) Further detail', { fontSize: '11px' }, 120);
analyzeNewParagraph('1.1.1.1. Very deep', { fontSize: '10px' }, 180);
```

## Integration with Document Editor

```javascript
// Example integration with document editor
class DocumentHierarchyManager {
  constructor() {
    this.hierarchyDetector = require('../src/utils/hierarchyDetector');
    this.currentTree = null;
  }

  onDocumentLoad(paragraphs) {
    this.currentTree = this.hierarchyDetector.buildSectionTree(paragraphs);
    this.displayHierarchyTree();
    this.validateDocument();
  }

  onParagraphEdit(paragraphId, newText, style, indentation) {
    const level = this.hierarchyDetector.detectHierarchyLevel(
      newText,
      style,
      indentation
    );

    const numbering = this.hierarchyDetector.parseNumberingStyle(newText);

    // Update UI with detected level
    this.updateParagraphUI(paragraphId, level, numbering);

    // Rebuild tree
    this.rebuildTree();
  }

  rebuildTree() {
    // Get all paragraphs from editor
    const paragraphs = this.getAllParagraphs();
    this.currentTree = this.hierarchyDetector.buildSectionTree(paragraphs);
    this.displayHierarchyTree();
  }

  validateDocument() {
    if (!this.currentTree) return;

    const validation = this.hierarchyDetector.validateNumberingSequence(
      this.currentTree.root
    );

    if (validation.warnings.length > 0) {
      this.displayWarnings(validation.warnings);
    }
  }

  displayHierarchyTree() {
    // Display tree structure in sidebar
    console.log('Document Outline:');
    this.printNode(this.currentTree.root, 0);
  }

  printNode(nodes, indent) {
    nodes.forEach(node => {
      console.log('  '.repeat(indent) + node.text);
      if (node.children.length > 0) {
        this.printNode(node.children, indent + 1);
      }
    });
  }

  displayWarnings(warnings) {
    console.log('\n⚠️  Document Issues:');
    warnings.forEach(warning => {
      console.log(`  ${warning.type}: ${warning.message}`);
    });
  }

  getAllParagraphs() {
    // Stub - would get from actual editor
    return [];
  }

  updateParagraphUI(paragraphId, level, numbering) {
    // Stub - would update actual UI
    console.log(`Update paragraph ${paragraphId}: Level ${level}`);
  }
}

// Usage
const manager = new DocumentHierarchyManager();
// manager.onDocumentLoad(paragraphs);
```

## Performance Testing

```javascript
const { buildSectionTree } = require('../src/utils/hierarchyDetector');

// Generate large document for performance testing
function generateLargeDocument(numSections) {
  const paragraphs = [];

  for (let i = 1; i <= numSections; i++) {
    paragraphs.push({
      text: `${i}. Section ${i}`,
      style: { fontSize: '16px' },
      indentation: 20
    });

    // Add subsections
    for (let j = 1; j <= 5; j++) {
      paragraphs.push({
        text: `${String.fromCharCode(64 + j)}. Subsection ${j}`,
        style: { fontSize: '14px' },
        indentation: 40
      });
    }
  }

  return paragraphs;
}

// Test performance
const sizes = [10, 50, 100, 500, 1000];

console.log('=== Performance Benchmarks ===\n');
sizes.forEach(size => {
  const paragraphs = generateLargeDocument(size);
  const start = Date.now();
  const tree = buildSectionTree(paragraphs);
  const end = Date.now();

  console.log(`Document size: ${paragraphs.length} paragraphs`);
  console.log(`Processing time: ${end - start}ms`);
  console.log(`Sections detected: ${tree.root.length}`);
  console.log(`Total nodes: ${tree.metadata.totalNodes}`);
  console.log('');
});
```

---

These examples demonstrate the full capabilities of the hierarchy detection algorithm. Use them as templates for integration into your bylaws amendment tracking system.
