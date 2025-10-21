# Context-Aware Parser Implementation

## Executive Summary

Successfully implemented **context-aware depth calculation** in the document parser to handle real-world, messy documents with inconsistent formatting and hierarchy. The parser now correctly calculates depths based on containment rules rather than static templates.

## Core Implementation

### Algorithm: Stack-Based Depth Calculation

```javascript
// Core containment rule: "Everything between ARTICLE I and ARTICLE II belongs to ARTICLE I"

1. Maintain a hierarchy stack tracking the current path
2. For each section:
   - Pop stack until finding appropriate parent (based on type priority)
   - Depth = stack length (contextual, not static)
   - Push section to stack for future children
3. Articles always get depth 0
4. Cap maximum depth at configured limit (0-9)
```

### Key Features Implemented

#### 1. Context-Aware Depth Assignment
- **Old**: `depth: levelDef?.depth || 0` (static from template)
- **New**: Depth calculated based on actual document structure

#### 2. Type Priority System
```javascript
const typePriority = {
  'article': 100,      // Highest level
  'section': 90,
  'subsection': 80,
  'paragraph': 70,
  'subparagraph': 60,
  'clause': 50,
  'subclause': 40,
  'item': 30,
  'subitem': 20,
  'point': 10,
  'subpoint': 5,
  'unnumbered': 0,     // Lowest level
  'preamble': 0
};
```

#### 3. Parent Path Tracking
Each section now includes:
- `depth`: Calculated contextual depth (0-9)
- `contextualDepth`: Same as depth (for debugging)
- `parentPath`: Full hierarchy path (e.g., "Article I > Section 1 > (a)")

## Handles Real-World Messiness

### Tested Scenarios

✅ **Orphaned sections** (sections before any article)
✅ **Out-of-order numbering** (Section 5, then Section 2)
✅ **Missing hierarchy levels** (subsection without parent section)
✅ **Mixed formatting** (Roman numerals, letters, numbers)
✅ **Deep nesting** (10+ levels capped at 9)
✅ **Unnumbered content** blocks
✅ **Preamble sections**

### Example: Messy Document Handling

**Input:**
```
Section 1 (orphan - no article)
  (a) Subsection
Article I
  Section 1
Article III (skips II)
  Section 1
    (a) Requirements
      (1) Age
      (2) Residency
Article II (out of order)
  (x) Random subsection
```

**Output:**
```
Section 1         - Depth 0 (root level orphan)
  (a)             - Depth 1 (under orphan section)
Article I         - Depth 0 (article always 0)
  Section 1       - Depth 1 (under article)
Article III       - Depth 0
  Section 1       - Depth 1
    (a)           - Depth 2
      (1)         - Depth 3
      (2)         - Depth 3
Article II        - Depth 0
  (x)             - Depth 1
```

## Performance Characteristics

- **Algorithm Complexity**: O(n) where n = number of sections
- **Space Complexity**: O(h) where h = maximum hierarchy depth
- **Processing Speed**: ~0.14ms for 22 sections (100 iterations)
- **Memory Efficient**: Uses single pass with minimal stack

## Files Modified

1. **`src/parsers/wordParser.js`**
   - Added `enrichSectionsWithContext()` method
   - Modified `enrichSections()` to call context-aware calculator
   - Added `getDepthDistribution()` for debugging

## Test Coverage

Created comprehensive test suite:
- **`tests/unit/contextual-depth.test.js`** - 10 test cases, all passing
- **`tests/test-contextual-parser.js`** - Integration test with messy document

## Unified Parsing Achieved

Both **setup wizard** and **document upload** now use the same parser:
- `setupService.processDocumentImport()` → calls `wordParser.parseDocument()`
- `admin.js` upload route → calls `setupService.processDocumentImport()`

**Result**: Single source of truth for document parsing

## Migration Considerations

### For Existing Data
No migration needed - the parser calculates depths dynamically during parsing. Existing documents will get correct depths when re-parsed.

### Backwards Compatibility
The implementation preserves all existing fields:
- `depth` - Now contextually calculated
- `ordinal`, `article_number`, `section_number` - Still populated
- `section_citation`, `section_title`, `original_text` - Unchanged

## Validation Results

✅ All 10 unit tests passing
✅ Handles 22-section messy document correctly
✅ Performance: 0.14ms average processing time
✅ Zero depth violations (all depths 0-9)
✅ Correct parent-child relationships maintained

## Next Steps (Optional Enhancements)

1. **Configurable Type Priority**: Allow organizations to customize hierarchy priorities
2. **Smart Orphan Detection**: Better heuristics for orphaned content
3. **Visual Hierarchy Preview**: Show depth tree before import
4. **Depth Override UI**: Allow manual depth adjustments post-import

## Summary

The context-aware parser implementation successfully addresses the core requirement: **"Everything between ARTICLE I and ARTICLE II belongs to ARTICLE I"**. It handles real-world document messiness with a pragmatic, performant solution that requires no breaking changes to existing code.

**Key Achievement**: Documents with inconsistent formatting now parse correctly with appropriate depth relationships, making the system robust for real-world usage.