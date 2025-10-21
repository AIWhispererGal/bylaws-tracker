# Context-Aware Parsing: Detailed Pseudocode

This document provides implementation-ready pseudocode for all components of the context-aware depth calculation system.

---

## Table of Contents
1. [Core Algorithm: Tree Building](#core-algorithm-tree-building)
2. [Depth Calculation](#depth-calculation)
3. [Content Assignment](#content-assignment)
4. [Validation Logic](#validation-logic)
5. [Helper Functions](#helper-functions)
6. [Integration Adapters](#integration-adapters)

---

## Core Algorithm: Tree Building

### Main Entry Point

```javascript
/**
 * Build hierarchical tree from flat list of detected patterns
 *
 * @param {DetectedItem[]} detectedItems - Flat list sorted by text position
 * @param {string} text - Full document text
 * @param {Object} config - Organization hierarchy configuration
 * @returns {HierarchyNode[]} - Array of root-level nodes
 */
function buildHierarchicalTree(detectedItems, text, config) {
  // STEP 1: Initialize data structures
  const root = createVirtualRoot();
  const stack = [root];  // Active ancestor path
  const nodeMap = new Map();  // Quick lookup: id → node
  const hierarchyOrder = buildHierarchyOrder(config);

  // STEP 2: Process each detected item in document order
  for (let i = 0; i < detectedItems.length; i++) {
    const item = detectedItems[i];
    const nextItem = detectedItems[i + 1] || null;

    // STEP 2a: Create node for this item
    const node = createHierarchyNode(item, nextItem, text);

    // STEP 2b: Find correct parent (backtracking may occur)
    backtrackStack(stack, node, hierarchyOrder);

    // STEP 2c: Attach node to parent
    const parent = stack[stack.length - 1];
    attachNodeToParent(node, parent);
    nodeMap.set(node.id, node);

    // STEP 2d: Push node onto stack (becomes potential parent)
    stack.push(node);

    // STEP 2e: Log for debugging
    logTreeBuildingStep(node, stack, i);
  }

  // STEP 3: Extract top-level nodes (children of virtual root)
  const topLevelNodes = root.children;

  // STEP 4: Validate tree structure
  validateTreeStructure(topLevelNodes, config);

  return topLevelNodes;
}
```

### Helper: Create Hierarchy Node

```javascript
/**
 * Create a hierarchy node from detected item
 */
function createHierarchyNode(item, nextItem, text) {
  const node = {
    // Unique identifier
    id: generateUUID(),

    // Original detected item properties
    type: item.type,
    level: item.level,
    number: item.number,
    prefix: item.prefix,
    fullMatch: item.fullMatch,
    numberingScheme: item.numberingScheme,

    // Text range this node covers
    startIndex: item.index,
    endIndex: nextItem ? nextItem.index : text.length,
    textRange: text.substring(
      item.index,
      nextItem ? nextItem.index : text.length
    ),

    // Tree structure (to be populated)
    parentId: null,
    children: [],
    contextualDepth: null,  // Calculated later

    // Metadata
    createdAt: Date.now()
  };

  return node;
}
```

### Helper: Backtrack Stack

```javascript
/**
 * Backtrack stack to find correct insertion point
 * Pops nodes from stack until we find the right parent for current node
 */
function backtrackStack(stack, currentNode, hierarchyOrder) {
  // RULE 1: Never pop the virtual root (stack[0])
  while (stack.length > 1) {
    const stackTop = stack[stack.length - 1];

    // RULE 2: If current node is same or higher level, pop
    if (shouldBacktrack(currentNode, stackTop, hierarchyOrder)) {
      const popped = stack.pop();
      console.log(`[Backtrack] Popped ${popped.type} ${popped.number}`);
    } else {
      // Found correct parent
      break;
    }
  }
}

/**
 * Determine if we should backtrack (pop) the stack
 */
function shouldBacktrack(currentNode, stackTop, hierarchyOrder) {
  // Get hierarchy priority (lower = higher in tree)
  const currentPriority = hierarchyOrder[currentNode.type];
  const stackPriority = hierarchyOrder[stackTop.type];

  // Backtrack if current is same or higher level
  // Example: If stack has "section" (priority 1) and current is "article" (priority 0)
  //          We must backtrack to article level
  // Example: If stack has "section 1" and current is "section 2"
  //          We must backtrack to parent article
  return currentPriority <= stackPriority;
}
```

### Helper: Build Hierarchy Order

```javascript
/**
 * Build hierarchy order map from config
 * Lower index = higher in hierarchy
 */
function buildHierarchyOrder(config) {
  const order = {};
  const levels = config.hierarchy?.levels || [];

  // Sort by depth (ascending)
  const sortedLevels = levels.slice().sort((a, b) => a.depth - b.depth);

  sortedLevels.forEach((level, index) => {
    order[level.type] = index;
  });

  // Add virtual root at -1
  order['__root__'] = -1;

  return order;
}
```

### Helper: Attach Node to Parent

```javascript
/**
 * Attach node to parent in tree
 */
function attachNodeToParent(node, parent) {
  node.parentId = parent.id;
  parent.children.push(node);

  // Build citation including parent context
  if (parent.type !== '__root__') {
    node.citation = `${parent.citation}, ${node.prefix}${node.number}`;
  } else {
    node.citation = `${node.prefix}${node.number}`;
  }
}
```

### Helper: Create Virtual Root

```javascript
/**
 * Create a virtual root node (not part of final output)
 */
function createVirtualRoot() {
  return {
    id: '__root__',
    type: '__root__',
    depth: -1,
    children: [],
    citation: ''
  };
}
```

---

## Depth Calculation

### Recursive Depth Assignment

```javascript
/**
 * Assign depths to all nodes in tree
 * @param {HierarchyNode[]} topLevelNodes - Root level nodes
 */
function assignDepthsRecursively(topLevelNodes) {
  for (const node of topLevelNodes) {
    traverseAndAssignDepth(node, -1);
  }
}

/**
 * Traverse tree and assign depth
 */
function traverseAndAssignDepth(node, parentDepth) {
  // RULE: Depth = parent depth + 1
  node.contextualDepth = parentDepth + 1;

  // Validate depth is within limits
  if (node.contextualDepth > 9) {
    console.warn(`[DepthCalculator] Node ${node.citation} exceeds max depth of 9`);
  }

  // Recursively assign depths to children
  for (const child of node.children) {
    traverseAndAssignDepth(child, node.contextualDepth);
  }
}
```

### Depth Validation

```javascript
/**
 * Validate depth assignments
 */
function validateDepthAssignments(topLevelNodes, config) {
  const errors = [];
  const maxDepth = config.hierarchy?.maxDepth || 10;

  function validateNode(node, path = []) {
    const currentPath = [...path, node.citation];

    // Check 1: Depth within limits
    if (node.contextualDepth >= maxDepth) {
      errors.push({
        node: node.citation,
        error: `Depth ${node.contextualDepth} exceeds maximum ${maxDepth}`,
        path: currentPath.join(' > ')
      });
    }

    // Check 2: Depth matches expected for type
    const levelDef = config.hierarchy.levels.find(l => l.type === node.type);
    if (levelDef && levelDef.depth !== node.contextualDepth) {
      // This is OK in context-aware parsing - depth is dynamic
      console.info(`[DepthValidator] ${node.citation} has contextual depth ${node.contextualDepth}, config suggests ${levelDef.depth}`);
    }

    // Check 3: Children are deeper than parent
    for (const child of node.children) {
      if (child.contextualDepth <= node.contextualDepth) {
        errors.push({
          node: child.citation,
          error: `Child depth (${child.contextualDepth}) not greater than parent depth (${node.contextualDepth})`,
          path: currentPath.join(' > ')
        });
      }

      validateNode(child, currentPath);
    }
  }

  topLevelNodes.forEach(node => validateNode(node));

  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## Content Assignment

### Attach Text to Sections

```javascript
/**
 * Assign text content to each section based on text ranges
 * @param {HierarchyNode[]} tree - Hierarchical tree
 * @param {string} fullText - Complete document text
 * @returns {EnrichedSection[]} - Sections with content
 */
function assignContentToSections(tree, fullText) {
  const sections = [];
  const lines = fullText.split('\n');

  function processNode(node) {
    // Extract content for this node
    const content = extractNodeContent(node, fullText, lines);

    // Build enriched section
    const section = {
      // Identification
      type: node.type,
      level: node.level,
      number: node.number,
      prefix: node.prefix,
      citation: node.citation,

      // Content
      title: extractTitle(node, content),
      text: content.text,
      original_text: content.text,

      // Hierarchy
      depth: node.contextualDepth,
      parent_section_id: node.parentId !== '__root__' ? node.parentId : null,
      ordinal: sections.length + 1,

      // Legacy compatibility
      article_number: findAncestorNumber(node, 'article'),
      section_number: findAncestorNumber(node, 'section'),
      section_citation: node.citation,
      section_title: `${node.citation} - ${extractTitle(node, content)}`
    };

    sections.push(section);

    // Process children
    for (const child of node.children) {
      processNode(child);
    }
  }

  tree.forEach(node => processNode(node));

  return sections;
}
```

### Extract Node Content

```javascript
/**
 * Extract text content for a specific node
 */
function extractNodeContent(node, fullText, lines) {
  // STRATEGY 1: Use text range (startIndex to endIndex)
  let rawContent = fullText.substring(node.startIndex, node.endIndex);

  // STRATEGY 2: Exclude children's text ranges
  // (Only include text that doesn't belong to child sections)
  for (const child of node.children) {
    const childStart = child.startIndex - node.startIndex;
    const childEnd = child.endIndex - node.startIndex;

    // Remove child's range from parent's content
    rawContent = rawContent.substring(0, childStart) +
                 rawContent.substring(childEnd);
  }

  // STRATEGY 3: Clean up content
  const cleanedContent = cleanTextContent(rawContent);

  // STRATEGY 4: Remove the section header itself from content
  const headerPattern = new RegExp(
    `^${escapeRegex(node.fullMatch)}[\\s:\\-–]*`,
    'i'
  );
  const contentWithoutHeader = cleanedContent.replace(headerPattern, '').trim();

  return {
    text: contentWithoutHeader,
    hasContent: contentWithoutHeader.length > 0
  };
}
```

### Handle Orphaned Content

```javascript
/**
 * Detect and handle orphaned content (text not assigned to any section)
 */
function handleOrphanedContent(tree, fullText) {
  const lines = fullText.split('\n');
  const coveredRanges = [];

  // Step 1: Collect all covered ranges
  function collectRanges(node) {
    coveredRanges.push({
      start: node.startIndex,
      end: node.endIndex,
      node
    });
    node.children.forEach(child => collectRanges(child));
  }
  tree.forEach(node => collectRanges(node));

  // Step 2: Sort by start position
  coveredRanges.sort((a, b) => a.start - b.start);

  // Step 3: Find gaps (orphaned content)
  const orphans = [];
  let lastEnd = 0;

  for (const range of coveredRanges) {
    if (range.start > lastEnd) {
      // Found a gap
      const orphanText = fullText.substring(lastEnd, range.start).trim();
      if (orphanText.length > 10) {  // Ignore trivial whitespace
        orphans.push({
          startIndex: lastEnd,
          endIndex: range.start,
          text: orphanText,
          nearestSection: range.node
        });
      }
    }
    lastEnd = Math.max(lastEnd, range.end);
  }

  // Check for content after last section
  if (lastEnd < fullText.length) {
    const finalText = fullText.substring(lastEnd).trim();
    if (finalText.length > 10) {
      orphans.push({
        startIndex: lastEnd,
        endIndex: fullText.length,
        text: finalText,
        nearestSection: null  // No section after this
      });
    }
  }

  // Step 4: Attach orphans to sections
  for (const orphan of orphans) {
    if (orphan.nearestSection) {
      // Prepend to nearest section's text
      orphan.nearestSection.orphanedPrefix = orphan.text;
    } else if (orphan.startIndex === 0) {
      // Content at start of document - create PREAMBLE
      const preamble = createPreambleSection(orphan.text);
      tree.unshift(preamble);
    } else {
      // Content at end of document - create APPENDIX
      const appendix = createAppendixSection(orphan.text);
      tree.push(appendix);
    }
  }

  return {
    orphansFound: orphans.length,
    orphans: orphans.map(o => ({
      preview: o.text.substring(0, 50) + '...',
      location: o.startIndex,
      attached: !!o.nearestSection
    }))
  };
}
```

---

## Validation Logic

### Comprehensive Tree Validation

```javascript
/**
 * Validate entire tree structure
 */
function validateTreeStructure(tree, config) {
  const errors = [];
  const warnings = [];

  // Validation 1: Parent-child depth consistency
  function validateDepthConsistency(node, expectedMinDepth) {
    if (node.contextualDepth < expectedMinDepth) {
      errors.push({
        node: node.citation,
        error: `Depth ${node.contextualDepth} less than parent's depth + 1`
      });
    }

    for (const child of node.children) {
      validateDepthConsistency(child, node.contextualDepth + 1);
    }
  }

  // Validation 2: Numbering sequence
  function validateNumberingSequence(siblings, parentCitation) {
    const numberingScheme = siblings[0]?.numberingScheme;
    const numbers = siblings.map(s => parseNumber(s.number, numberingScheme));

    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] !== numbers[i-1] + 1) {
        warnings.push({
          section: siblings[i].citation,
          warning: `Numbering gap: ${numbers[i-1]} to ${numbers[i]}`,
          parent: parentCitation
        });
      }
    }
  }

  // Validation 3: Type consistency at same depth
  function validateTypeConsistency(siblings) {
    const types = new Set(siblings.map(s => s.type));
    if (types.size > 1) {
      warnings.push({
        warning: `Mixed types at same depth: ${Array.from(types).join(', ')}`,
        siblings: siblings.map(s => s.citation)
      });
    }
  }

  // Run validations
  tree.forEach(node => {
    validateDepthConsistency(node, 0);
  });

  tree.forEach(node => {
    if (node.children.length > 0) {
      validateNumberingSequence(node.children, node.citation);
      validateTypeConsistency(node.children);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

## Helper Functions

### Text Cleaning

```javascript
/**
 * Clean text content
 */
function cleanTextContent(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}
```

### Title Extraction

```javascript
/**
 * Extract title from node's text range
 */
function extractTitle(node, content) {
  // Strategy 1: Look for title on same line as header
  const headerLine = content.text.split('\n')[0];
  if (headerLine && headerLine.length > 0 && headerLine.length < 100) {
    return headerLine;
  }

  // Strategy 2: Use type + number as fallback
  return `${node.level} ${node.number}`;
}
```

### Ancestor Search

```javascript
/**
 * Find ancestor of specific type
 */
function findAncestorNumber(node, ancestorType) {
  let current = node;
  const nodeMap = getAllNodes();  // Get from context

  while (current && current.parentId) {
    const parent = nodeMap.get(current.parentId);
    if (!parent) break;

    if (parent.type === ancestorType) {
      return parseNumber(parent.number, parent.numberingScheme);
    }

    current = parent;
  }

  return null;
}
```

### Number Parsing

```javascript
/**
 * Parse section number to integer
 */
function parseNumber(numberStr, scheme) {
  switch (scheme) {
    case 'roman':
      return romanToInt(numberStr);
    case 'numeric':
      return parseInt(numberStr, 10);
    case 'alpha':
      return alphaToInt(numberStr, false);
    case 'alphaLower':
      return alphaToInt(numberStr, true);
    default:
      return 0;
  }
}

function romanToInt(s) {
  const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  s = s.toUpperCase();
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    if (i + 1 < s.length && romanMap[s[i]] < romanMap[s[i + 1]]) {
      result -= romanMap[s[i]];
    } else {
      result += romanMap[s[i]];
    }
  }
  return result;
}

function alphaToInt(s, isLower) {
  const base = isLower ? 96 : 64;  // 'a' = 97, 'A' = 65
  return s.charCodeAt(0) - base;
}
```

---

## Integration Adapters

### Wrapper for Existing WordParser

```javascript
/**
 * Adapter: Make new system compatible with existing wordParser API
 */
class WordParserAdapter {
  constructor(documentParsingService) {
    this.parsingService = documentParsingService;
  }

  async parseDocument(filePath, organizationConfig, documentId) {
    // Step 1: Extract text (same as before)
    const buffer = await fs.readFile(filePath);
    const textResult = await mammoth.extractRawText({ buffer });

    // Step 2: Delegate to new parsing service
    const parseResult = await this.parsingService.parseDocument(
      textResult.value,
      organizationConfig,
      { sourceFormat: 'docx' }
    );

    // Step 3: Return in old format (backward compatible)
    return {
      success: parseResult.success,
      sections: parseResult.sections,  // Already in correct format
      metadata: parseResult.metadata
    };
  }

  // Existing methods remain unchanged
  generatePreview(sections, maxSections) { /* ... */ }
  validateSections(sections, config) { /* ... */ }
  cleanText(text) { /* ... */ }
}
```

### Wrapper for Setup Service

```javascript
/**
 * Adapter: Make setup service use new parsing
 */
class SetupServiceAdapter {
  async processDocumentImport(orgId, filePath, supabase) {
    // Load config (same as before)
    const config = await organizationConfig.loadConfig(orgId, supabase);

    // NEW: Use context-aware parsing service
    const parseResult = await documentParsingService.parseDocument(
      await fs.readFile(filePath),
      config,
      { sourceFormat: 'docx', validateHierarchy: true }
    );

    // Rest of the flow is unchanged
    const { data: document } = await supabase.from('documents').insert(...);
    const storageResult = await sectionStorage.storeSections(...);

    return {
      success: storageResult.success,
      document,
      sectionsCount: parseResult.sections.length,
      metadata: parseResult.metadata
    };
  }
}
```

---

## Logging and Debugging

### Detailed Logging

```javascript
/**
 * Log tree building progress for debugging
 */
function logTreeBuildingStep(node, stack, index) {
  if (!process.env.DEBUG_PARSING) return;

  console.log(`\n[TreeBuilder] Step ${index + 1}:`);
  console.log(`  Current: ${node.type} ${node.number} (${node.citation})`);
  console.log(`  Stack depth: ${stack.length}`);
  console.log(`  Stack path: ${stack.map(n => n.type === '__root__' ? 'ROOT' : n.citation).join(' > ')}`);
  console.log(`  Assigned depth: ${node.contextualDepth}`);
  console.log(`  Parent: ${stack[stack.length - 1].citation || 'ROOT'}`);
}

/**
 * Log final tree structure
 */
function logTreeStructure(tree, indent = 0) {
  if (!process.env.DEBUG_PARSING) return;

  for (const node of tree) {
    console.log(`${'  '.repeat(indent)}${node.citation} (depth: ${node.contextualDepth}, children: ${node.children.length})`);
    if (node.children.length > 0) {
      logTreeStructure(node.children, indent + 1);
    }
  }
}
```

---

## Performance Optimization

### Lazy Content Loading

```javascript
/**
 * Optimize: Don't load all content upfront
 */
class LazyContentNode {
  constructor(node, fullText) {
    this._node = node;
    this._fullText = fullText;
    this._contentCache = null;
  }

  get content() {
    if (!this._contentCache) {
      this._contentCache = extractNodeContent(this._node, this._fullText);
    }
    return this._contentCache;
  }
}
```

### Parallel Processing (Future)

```javascript
/**
 * Future: Process multiple documents in parallel
 */
async function parseMultipleDocuments(documents, config) {
  const results = await Promise.all(
    documents.map(doc => documentParsingService.parseDocument(doc, config))
  );

  return results;
}
```

---

## Error Handling

### Graceful Degradation

```javascript
/**
 * Handle parsing errors gracefully
 */
function parseDocumentWithFallback(text, config) {
  try {
    // Try context-aware parsing
    return documentParsingService.parseDocument(text, config);
  } catch (error) {
    console.error('[ParsingService] Context-aware parsing failed:', error);

    // Fallback to pattern-only parsing
    console.warn('[ParsingService] Falling back to pattern-only parsing');
    return fallbackPatternOnlyParsing(text, config);
  }
}

function fallbackPatternOnlyParsing(text, config) {
  // Use existing hierarchyDetector without tree building
  const detectedItems = hierarchyDetector.detectHierarchy(text, config);

  // Assign depths from config (old behavior)
  const sections = detectedItems.map(item => {
    const levelDef = config.hierarchy.levels.find(l => l.type === item.type);
    return {
      ...item,
      depth: levelDef?.depth || 0
    };
  });

  return {
    success: true,
    sections,
    metadata: { parsingMode: 'fallback-pattern-only' }
  };
}
```

---

## Testing Utilities

### Test Data Generator

```javascript
/**
 * Generate test hierarchy for validation
 */
function generateTestHierarchy(depth, branchFactor = 2) {
  const types = ['article', 'section', 'subsection', 'paragraph', 'subparagraph'];

  function generateNode(currentDepth, parentNumber = '') {
    if (currentDepth >= depth) return null;

    const type = types[currentDepth];
    const nodes = [];

    for (let i = 1; i <= branchFactor; i++) {
      const number = currentDepth === 0 ? toRoman(i) : String(i);
      const citation = parentNumber ? `${parentNumber}, ${number}` : number;

      const node = {
        type,
        number,
        citation,
        depth: currentDepth,
        children: []
      };

      const children = generateNode(currentDepth + 1, citation);
      if (children) {
        node.children = children;
      }

      nodes.push(node);
    }

    return nodes;
  }

  return generateNode(0);
}
```

---

**END OF PSEUDOCODE REFERENCE**

This pseudocode is ready for direct implementation in JavaScript/TypeScript.
Key features:
- All algorithms fully specified
- Edge cases handled
- Performance optimizations noted
- Backward compatibility maintained
- Extensive validation and error handling
