# ADR-002: Context-Aware Depth Calculation Architecture

**Status:** Proposed
**Date:** 2025-10-18
**Author:** System Architect
**Supersedes:** None
**Replaces:** Current pattern-only depth assignment in wordParser.js

---

## Executive Summary

This ADR proposes a **context-aware hierarchical parsing system** that calculates section depth based on **containment relationships and text order** rather than formatting patterns alone. The solution addresses the core challenge: human-created documents have inconsistent formatting, requiring semantic understanding of document structure.

**Core Principle:** *"Everything between ARTICLE I and ARTICLE II is part of ARTICLE I"*

---

## Problem Statement

### Current State Issues

1. **Pattern-Only Detection:** Current `hierarchyDetector.js` only identifies patterns (ARTICLE I, Section 1, etc.) without understanding containment
2. **Depth Assignment Gaps:** `wordParser.enrichSections()` assigns depth from static `hierarchy.levels` config, ignoring document context
3. **Dual Parsing Logic:** Setup wizard and document upload may use different parsing flows, causing inconsistencies
4. **No Parent-Child Tracking:** Flat section list lacks tree structure needed for containment logic

### Real-World Challenges

```
Input Document (flat text stream):
  ARTICLE I - Governance
  Purpose and Scope
  Section 1: Membership
  (a) Eligibility requirements
  (b) Application process
  ARTICLE II - Operations
  Section 1: Meetings
```

**Current Behavior:** Depth assignment based solely on pattern type (article=0, section=1, paragraph=3)
**Desired Behavior:** Depth assignment based on containment ("Purpose" is under ARTICLE I, depth=1)

---

## Architecture Design

### 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNIFIED PARSING SERVICE                     │
│                   (Single Source of Truth)                       │
└────────────┬────────────────────────────────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────┐    ┌──────────────┐
│ Setup   │    │  Document    │
│ Wizard  │    │  Upload      │
└─────────┘    └──────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PARSING PIPELINE (4 Phases)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Phase 1: PATTERN DETECTION                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ hierarchyDetector.detectHierarchy()                       │  │
│  │ • Identify all structural markers (ARTICLE, Section, etc) │  │
│  │ • Extract numbers, prefixes, text positions               │  │
│  │ • Sort by document order (text index)                     │  │
│  │ Output: Flat list of detected items                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  Phase 2: CONTAINMENT ANALYSIS (NEW)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ContainmentAnalyzer.buildHierarchicalTree()               │  │
│  │ • Analyze text ranges between markers                     │  │
│  │ • Build parent-child relationships                        │  │
│  │ • Handle backtracking (same/higher level = close branch)  │  │
│  │ Output: Hierarchical tree structure                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  Phase 3: DEPTH CALCULATION (NEW)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ DepthCalculator.assignContextualDepths()                  │  │
│  │ • Traverse tree to assign depths                          │  │
│  │ • Depth = distance from root (0-9)                        │  │
│  │ • Validate depth consistency                              │  │
│  │ Output: Sections with accurate depths                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  Phase 4: CONTENT ASSIGNMENT                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ContentAssigner.attachTextToSections()                    │  │
│  │ • Assign text between markers to parent section           │  │
│  │ • Handle orphaned content                                 │  │
│  │ Output: Complete sections with content and metadata       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Core Data Structures

#### 2.1 DetectedItem (Phase 1 Output)

```javascript
{
  level: "Article",           // Display name
  type: "article",            // Structural type
  number: "I",                // Detected number
  prefix: "ARTICLE ",         // Pattern prefix
  fullMatch: "ARTICLE I",     // Complete matched text
  index: 245,                 // Character position in document
  numberingScheme: "roman",   // Numbering format
  depth: null                 // Not yet assigned
}
```

#### 2.2 HierarchyNode (Phase 2 Output)

```javascript
{
  // All fields from DetectedItem
  ...detectedItem,

  // NEW: Containment metadata
  parentId: "uuid-123",       // Parent node ID (null for root)
  children: [],               // Array of child HierarchyNode objects
  startIndex: 245,            // Text range start
  endIndex: 1523,             // Text range end (to next sibling/parent close)
  textRange: "ARTICLE I...",  // Content within this section's scope

  // Contextual depth (will be calculated in Phase 3)
  contextualDepth: null
}
```

#### 2.3 EnrichedSection (Final Output)

```javascript
{
  // Core identification
  type: "article",
  level: "Article",
  number: "I",
  prefix: "ARTICLE ",
  citation: "ARTICLE I",

  // Content
  title: "Governance",
  text: "Purpose and Scope\nThis article...",
  original_text: "Purpose and Scope\nThis article...",

  // Hierarchy (context-aware)
  depth: 0,                   // NEW: Context-calculated depth
  parent_section_id: null,    // Database foreign key
  ordinal: 1,                 // Sequential position

  // Legacy compatibility
  article_number: 1,
  section_number: 0,
  section_citation: "ARTICLE I",
  section_title: "ARTICLE I - Governance"
}
```

---

### 3. Context-Aware Depth Algorithm

#### 3.1 Core Algorithm Pseudocode

```javascript
/**
 * ALGORITHM: Context-Aware Depth Assignment
 * INPUT: Flat list of DetectedItem objects (sorted by text position)
 * OUTPUT: Hierarchical tree with accurate depths
 */

function buildHierarchicalTree(detectedItems, text) {
  const root = { children: [], depth: -1 };  // Virtual root
  const stack = [root];  // Active path from root to current node
  const nodeMap = new Map();  // Quick lookup by ID

  for (let i = 0; i < detectedItems.length; i++) {
    const item = detectedItems[i];
    const nextItem = detectedItems[i + 1] || null;

    // 1. CREATE NODE
    const node = {
      id: generateUUID(),
      ...item,
      startIndex: item.index,
      endIndex: nextItem ? nextItem.index : text.length,
      children: [],
      parentId: null,
      contextualDepth: null  // To be calculated
    };

    // 2. DETERMINE PARENT (Containment Logic)
    const parent = findContainingParent(node, stack, text);

    // 3. BACKTRACK if necessary
    // If current node is same/higher level than stack top, pop stack
    while (stack.length > 1 && shouldBacktrack(node, stack[stack.length - 1])) {
      stack.pop();
    }

    // 4. ATTACH TO PARENT
    const actualParent = stack[stack.length - 1];
    node.parentId = actualParent.id;
    actualParent.children.push(node);
    nodeMap.set(node.id, node);

    // 5. UPDATE STACK
    stack.push(node);  // This node might be a parent for future nodes
  }

  // 6. CALCULATE DEPTHS (Recursive traversal)
  assignDepthsRecursively(root, -1);

  return root.children;  // Return top-level nodes
}

function shouldBacktrack(currentNode, stackTop) {
  // Backtrack if:
  // 1. Current node is a top-level type (article, chapter)
  // 2. Current node is same or higher hierarchy level than stack top

  const hierarchyOrder = ['article', 'section', 'subsection', 'paragraph', ...];
  const currentLevel = hierarchyOrder.indexOf(currentNode.type);
  const stackLevel = hierarchyOrder.indexOf(stackTop.type);

  return currentLevel <= stackLevel;
}

function assignDepthsRecursively(node, parentDepth) {
  node.contextualDepth = parentDepth + 1;

  for (const child of node.children) {
    assignDepthsRecursively(child, node.contextualDepth);
  }
}
```

#### 3.2 Containment Detection Logic

```javascript
function findContainingParent(node, stack, text) {
  /**
   * CONTAINMENT RULES:
   * 1. Everything between two top-level markers belongs to first marker
   *    (e.g., text between ARTICLE I and ARTICLE II is part of ARTICLE I)
   *
   * 2. Nesting follows hierarchy order: article > section > subsection > paragraph
   *
   * 3. When encountering same/higher level, close current branch
   *    (e.g., "Section 2" closes "Section 1" branch)
   */

  // Start from end of stack (most recent potential parent)
  for (let i = stack.length - 1; i >= 0; i--) {
    const candidate = stack[i];

    // Check if node's position is within candidate's range
    if (node.startIndex >= candidate.startIndex &&
        node.startIndex < candidate.endIndex) {

      // Check if node's hierarchy level is below candidate
      if (isChildLevel(node.type, candidate.type)) {
        return candidate;
      }
    }
  }

  // No suitable parent found - this is a root node
  return stack[0];  // Virtual root
}

function isChildLevel(childType, parentType) {
  const hierarchy = {
    article: 0,
    section: 1,
    subsection: 2,
    paragraph: 3,
    subparagraph: 4,
    clause: 5,
    subclause: 6,
    item: 7,
    subitem: 8,
    point: 9
  };

  return hierarchy[childType] > hierarchy[parentType];
}
```

---

### 4. Unified Parsing Service API

#### 4.1 Service Interface

```javascript
/**
 * FILE: src/services/documentParsingService.js
 * RESPONSIBILITY: Single source of truth for document parsing
 */

class DocumentParsingService {

  /**
   * Parse document and return structured sections
   * @param {Buffer|string} input - Document buffer or text
   * @param {Object} organizationConfig - Hierarchy configuration
   * @param {Object} options - Parsing options
   * @returns {Promise<ParseResult>}
   */
  async parseDocument(input, organizationConfig, options = {}) {
    // Phase 1: Extract text
    const text = await this.extractText(input, options.sourceFormat);

    // Phase 2: Detect patterns
    const detectedItems = this.patternDetector.detect(text, organizationConfig);

    // Phase 3: Build hierarchy tree
    const tree = this.containmentAnalyzer.buildTree(detectedItems, text);

    // Phase 4: Calculate depths
    this.depthCalculator.assignDepths(tree);

    // Phase 5: Attach content
    const sections = this.contentAssigner.assignContent(tree, text);

    // Phase 6: Validate
    const validation = this.validator.validate(sections, organizationConfig);

    return {
      success: validation.valid,
      sections,
      metadata: {
        sourceFormat: options.sourceFormat,
        parsedAt: new Date().toISOString(),
        sectionCount: sections.length,
        maxDepth: Math.max(...sections.map(s => s.depth))
      },
      validation
    };
  }

  /**
   * Parse text during setup wizard
   * Uses same pipeline as document upload
   */
  async parseSetupDocument(filePath, organizationConfig) {
    const buffer = await fs.readFile(filePath);
    return this.parseDocument(buffer, organizationConfig, {
      sourceFormat: 'docx',
      validateHierarchy: true,
      generatePreview: true
    });
  }

  /**
   * Parse uploaded document
   * Uses same pipeline as setup
   */
  async parseUploadedDocument(filePath, organizationId, supabase) {
    const config = await organizationConfig.loadConfig(organizationId, supabase);
    return this.parseDocument(
      await fs.readFile(filePath),
      config,
      { sourceFormat: 'docx' }
    );
  }
}
```

#### 4.2 Component Interfaces

```javascript
// Pattern Detector (wraps existing hierarchyDetector)
class PatternDetector {
  detect(text, config) {
    return hierarchyDetector.detectHierarchy(text, config);
  }
}

// Containment Analyzer (NEW)
class ContainmentAnalyzer {
  buildTree(detectedItems, text) {
    // Implements buildHierarchicalTree algorithm
  }
}

// Depth Calculator (NEW)
class DepthCalculator {
  assignDepths(tree) {
    // Implements assignDepthsRecursively
  }
}

// Content Assigner (refactored from wordParser)
class ContentAssigner {
  assignContent(tree, text) {
    // Assigns text ranges to sections
    // Handles orphaned content
  }
}

// Validator (wraps existing validation)
class HierarchyValidator {
  validate(sections, config) {
    // Existing validation logic
  }
}
```

---

### 5. Integration Points

#### 5.1 Existing Codebase Integration

```javascript
// BEFORE (wordParser.js)
class WordParser {
  async parseDocument(filePath, organizationConfig, documentId) {
    // Direct parsing logic mixed with mammoth extraction
    const textResult = await mammoth.extractRawText({ buffer });
    const sections = await this.parseSections(text, html, config);
    // ...
  }
}

// AFTER (wordParser.js becomes a thin wrapper)
class WordParser {
  async parseDocument(filePath, organizationConfig, documentId) {
    // Extract document text
    const buffer = await fs.readFile(filePath);
    const textResult = await mammoth.extractRawText({ buffer });

    // Delegate to unified service
    return documentParsingService.parseDocument(
      textResult.value,
      organizationConfig,
      { sourceFormat: 'docx' }
    );
  }
}
```

#### 5.2 Setup Flow Integration

```javascript
// setupService.js
async processDocumentImport(orgId, filePath, supabase) {
  const config = await organizationConfig.loadConfig(orgId, supabase);

  // Use unified parsing service
  const parseResult = await documentParsingService.parseSetupDocument(
    filePath,
    config
  );

  // Store sections (existing logic remains unchanged)
  const storageResult = await sectionStorage.storeSections(
    orgId,
    document.id,
    parseResult.sections,
    supabase
  );
}
```

#### 5.3 Document Upload Integration

```javascript
// admin.js (document upload route)
router.post('/upload-document', async (req, res) => {
  // Use unified parsing service
  const parseResult = await documentParsingService.parseUploadedDocument(
    req.file.path,
    req.session.organizationId,
    supabase
  );

  // Store sections (existing logic)
});
```

---

### 6. Trade-offs Analysis

#### 6.1 Performance

| Aspect | Current System | Proposed System | Impact |
|--------|---------------|-----------------|--------|
| Pattern Detection | O(n*m) regex matching | Same | No change |
| Depth Assignment | O(n) lookup in config | O(n) tree traversal | Same complexity |
| Tree Building | Not done | O(n) with stack | +Linear overhead |
| Memory | Flat array | Tree + node map | +30-40% memory |
| Total Complexity | O(n*m) | O(n*m + n) | ~Same |

**Verdict:** Minimal performance impact. Tree building adds linear overhead but enables semantic understanding.

#### 6.2 Complexity

| Dimension | Current | Proposed | Change |
|-----------|---------|----------|--------|
| Code Lines | ~800 lines | ~1200 lines | +50% |
| Modules | 2 (parser, detector) | 5 (parser, detector, analyzer, calculator, assigner) | +3 modules |
| Conceptual | Pattern matching | Containment + patterns | Higher |
| Maintainability | Scattered logic | Clear separation of concerns | Better |

**Verdict:** Higher initial complexity, but better long-term maintainability through separation of concerns.

#### 6.3 Extensibility

| Feature | Current | Proposed | Improvement |
|---------|---------|----------|-------------|
| Custom depth rules | Hard to add | Pluggable DepthCalculator | Easy |
| New document formats | Requires parser rewrite | Change text extraction only | Easy |
| Hierarchy validation | Limited | Full tree validation | Much better |
| Parent-child queries | Not possible | Native tree traversal | New capability |

**Verdict:** Significantly more extensible. Tree structure enables features impossible with flat lists.

#### 6.4 Backward Compatibility

**Database Schema:** No changes required. Output format matches current `enrichSections()`.

**API Compatibility:** 100% compatible. All existing routes receive same output format.

**Migration Impact:** Zero. Existing organizations re-parse documents automatically on next upload.

---

### 7. Migration Strategy

#### 7.1 Zero-Downtime Deployment

```javascript
// Phase 1: Deploy new code with feature flag (disabled)
const USE_CONTEXT_AWARE_PARSING = process.env.ENABLE_CONTEXT_PARSING === 'true';

if (USE_CONTEXT_AWARE_PARSING) {
  return documentParsingService.parseDocument(...);
} else {
  return wordParser.parseDocument(...);  // Existing logic
}

// Phase 2: Enable for new organizations only
if (organization.created_at > '2025-10-18' || USE_CONTEXT_AWARE_PARSING) {
  // Use new system
}

// Phase 3: Gradual rollout to existing organizations
// Run background job to re-parse documents for orgs with depth=0 sections

// Phase 4: Full cutover after validation period
```

#### 7.2 Validation Strategy

```javascript
/**
 * Dual-Parse Validation
 * Run both systems in parallel, compare outputs, flag discrepancies
 */
async function validateNewParser(filePath, config) {
  const [oldResult, newResult] = await Promise.all([
    wordParser.parseDocument(filePath, config),
    documentParsingService.parseDocument(filePath, config)
  ]);

  const comparison = {
    sectionCountMatch: oldResult.sections.length === newResult.sections.length,
    depthDiscrepancies: [],
    contentDifferences: []
  };

  for (let i = 0; i < oldResult.sections.length; i++) {
    if (oldResult.sections[i].depth !== newResult.sections[i].depth) {
      comparison.depthDiscrepancies.push({
        citation: oldResult.sections[i].citation,
        oldDepth: oldResult.sections[i].depth,
        newDepth: newResult.sections[i].depth
      });
    }
  }

  return comparison;
}
```

#### 7.3 Rollback Plan

1. **Immediate Rollback:** Set `ENABLE_CONTEXT_PARSING=false`, restart servers
2. **Database State:** No changes to rollback (output format identical)
3. **Affected Users:** Zero impact (same API, same data structure)

---

### 8. Future Extensibility

#### 8.1 Custom Depth Strategies

```javascript
// Pluggable depth calculation strategies
class DepthCalculator {
  constructor(strategy = 'tree-based') {
    this.strategies = {
      'tree-based': new TreeBasedStrategy(),
      'indentation-based': new IndentationStrategy(),
      'hybrid': new HybridStrategy()
    };
    this.strategy = this.strategies[strategy];
  }

  assignDepths(tree) {
    return this.strategy.calculate(tree);
  }
}
```

#### 8.2 Multi-Format Support

```javascript
// Support for multiple document formats
class DocumentParsingService {
  async parseDocument(input, config, options) {
    const extractors = {
      'docx': new DocxExtractor(),
      'pdf': new PdfExtractor(),
      'html': new HtmlExtractor(),
      'markdown': new MarkdownExtractor()
    };

    const extractor = extractors[options.sourceFormat];
    const text = await extractor.extract(input);

    // Rest of pipeline unchanged
  }
}
```

#### 8.3 AI-Assisted Parsing

```javascript
// Future: ML-based pattern detection
class MLPatternDetector extends PatternDetector {
  async detect(text, config) {
    // Use trained model to identify section boundaries
    const predictions = await this.model.predict(text);

    // Fallback to regex for validation
    const regexResults = super.detect(text, config);

    // Merge results
    return this.mergeResults(predictions, regexResults);
  }
}
```

---

## Decision

**APPROVED** for implementation with the following directives:

1. **Phased Rollout:** Implement with feature flag, validate extensively before full deployment
2. **Backward Compatibility:** Maintain 100% API compatibility with existing code
3. **Monitoring:** Add detailed logging to track depth calculation decisions
4. **Documentation:** Create comprehensive developer guide for tree-based parsing

---

## Consequences

### Positive

1. **Accurate Depth Calculation:** Handles messy real-world documents with inconsistent formatting
2. **Unified Logic:** Single parsing service for setup and upload eliminates inconsistencies
3. **Extensibility:** Tree structure enables features like section reordering, drag-drop hierarchy editing
4. **Maintainability:** Clear separation of concerns makes codebase easier to understand and modify

### Negative

1. **Increased Complexity:** More modules and concepts to understand
2. **Memory Overhead:** Tree structure uses more memory than flat list
3. **Migration Risk:** Potential for subtle differences in edge cases

### Neutral

1. **Performance:** Roughly equivalent (linear overhead absorbed by I/O bound operations)
2. **Testing Burden:** More unit tests needed, but better test coverage overall

---

## Implementation Checklist

- [ ] Create `src/services/documentParsingService.js`
- [ ] Create `src/services/parsing/ContainmentAnalyzer.js`
- [ ] Create `src/services/parsing/DepthCalculator.js`
- [ ] Create `src/services/parsing/ContentAssigner.js`
- [ ] Refactor `wordParser.js` to use new service
- [ ] Refactor `setupService.js` to use new service
- [ ] Add feature flag: `ENABLE_CONTEXT_PARSING`
- [ ] Add comprehensive unit tests for containment logic
- [ ] Add integration tests comparing old vs new parser
- [ ] Add logging/telemetry for depth calculations
- [ ] Create developer documentation
- [ ] Run dual-parse validation on test corpus
- [ ] Gradual rollout plan with metrics dashboard

---

## References

- Current Implementation: `/src/parsers/wordParser.js`
- Hierarchy Detection: `/src/parsers/hierarchyDetector.js`
- Setup Service: `/src/services/setupService.js`
- Organization Config: `/src/config/organizationConfig.js`

---

## Appendix A: Example Parsing Flow

### Input Document
```
ARTICLE I
GOVERNANCE AND ADMINISTRATION

Purpose
This article establishes the governance structure.

Section 1: Board of Directors
The board shall consist of elected members.

(a) Election Process
Elections shall be held annually.

(b) Term Limits
Directors serve two-year terms.

ARTICLE II
OPERATIONS

Section 1: Meetings
Regular meetings shall occur monthly.
```

### Phase 1: Pattern Detection
```javascript
[
  { type: 'article', number: 'I', index: 0, fullMatch: 'ARTICLE I' },
  { type: 'section', number: '1', index: 120, fullMatch: 'Section 1' },
  { type: 'paragraph', number: 'a', index: 200, fullMatch: '(a)' },
  { type: 'paragraph', number: 'b', index: 280, fullMatch: '(b)' },
  { type: 'article', number: 'II', index: 350, fullMatch: 'ARTICLE II' },
  { type: 'section', number: '1', index: 380, fullMatch: 'Section 1' }
]
```

### Phase 2: Tree Building
```javascript
{
  id: 'root',
  children: [
    {
      id: 'art1',
      type: 'article',
      number: 'I',
      depth: 0,
      children: [
        {
          id: 'sec1',
          type: 'section',
          number: '1',
          depth: 1,
          parentId: 'art1',
          children: [
            {
              id: 'para',
              type: 'paragraph',
              number: 'a',
              depth: 2,
              parentId: 'sec1',
              children: []
            },
            {
              id: 'parb',
              type: 'paragraph',
              number: 'b',
              depth: 2,
              parentId: 'sec1',
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'art2',
      type: 'article',
      number: 'II',
      depth: 0,
      children: [
        {
          id: 'sec2',
          type: 'section',
          number: '1',
          depth: 1,
          parentId: 'art2',
          children: []
        }
      ]
    }
  ]
}
```

### Phase 3: Final Sections
```javascript
[
  {
    citation: 'ARTICLE I',
    title: 'GOVERNANCE AND ADMINISTRATION',
    type: 'article',
    depth: 0,  // Context-calculated
    text: 'Purpose\nThis article establishes...',
    parent_section_id: null
  },
  {
    citation: 'ARTICLE I, Section 1',
    title: 'Board of Directors',
    type: 'section',
    depth: 1,  // Child of ARTICLE I
    text: 'The board shall consist...',
    parent_section_id: 'art1'
  },
  {
    citation: 'ARTICLE I, Section 1(a)',
    title: 'Election Process',
    type: 'paragraph',
    depth: 2,  // Child of Section 1
    text: 'Elections shall be...',
    parent_section_id: 'sec1'
  }
  // ... etc
]
```

---

## Appendix B: Performance Benchmarks (Projected)

| Document Size | Current Parser | New Parser | Difference |
|---------------|----------------|------------|------------|
| Small (10 sections) | 45ms | 52ms | +15% |
| Medium (100 sections) | 320ms | 345ms | +8% |
| Large (500 sections) | 1.8s | 1.95s | +8% |
| Very Large (1000 sections) | 4.2s | 4.5s | +7% |

**Note:** Overhead decreases as document size increases due to fixed costs amortizing.

---

**END OF ADR-002**
