# Hierarchy Validation Error - Visual Summary

**Error Pattern:** "0 to 6" → "4 to 6" (x5)
**Root Cause:** Incomplete hierarchy configuration saved during setup
**Impact:** Blocks document upload for organizations with default setup

---

## The Problem (Visual)

```
┌─────────────────────────────────────────────────────────────┐
│                    SETUP WIZARD FLOW                        │
└─────────────────────────────────────────────────────────────┘

Step 1: Organization Setup
    ↓
Step 2: Document Type Config
    ↓
    📝 setupService.saveDocumentConfig() called
    ❌ Saves INCOMPLETE hierarchy:
       {
         levels: [
           { name: 'Article', depth: 0 },      ← Only 2 levels!
           { name: 'Section', depth: 1 }
         ],
         maxDepth: 5                            ← Should be 10!
       }
    ↓
Step 3: Upload Document
    ↓
    📄 Document has sections at depths 0, 1, 2, 3, 4, 5, 6
    ↓
    🔍 Validator checks hierarchy_config:
       ✅ Depth 0: Article → FOUND
       ✅ Depth 1: Section → FOUND
       ❌ Depth 2: ??? → NOT FOUND (error!)
       ❌ Depth 3: ??? → NOT FOUND (error!)
       ❌ Depth 4: ??? → NOT FOUND (error!)
       ❌ Depth 5: ??? → NOT FOUND (error!)
       ❌ Depth 6: ??? → NOT FOUND (error!)
    ↓
    ❌ "No level definition found for depth 4 to 6"
```

---

## Current vs. Expected Hierarchy Configuration

### CURRENT (BROKEN) 💔

```
Database: organizations.hierarchy_config
{
  "levels": [
    { "name": "Article",  "depth": 0, "type": "article",  "numbering": "roman" },
    { "name": "Section",  "depth": 1, "type": "section",  "numbering": "numeric" }
  ],
  "maxDepth": 5
}

Document Structure:
Article I               (depth 0) ✅ Matches "Article" definition
  Section 1             (depth 1) ✅ Matches "Section" definition
    1.1                 (depth 2) ❌ NO DEFINITION
      1.1.1             (depth 3) ❌ NO DEFINITION
        (a)             (depth 4) ❌ NO DEFINITION ← Error!
        (b)             (depth 4) ❌ NO DEFINITION ← Error!
        (c)             (depth 5) ❌ NO DEFINITION ← Error!
          (i)           (depth 6) ❌ NO DEFINITION ← Error!
          (ii)          (depth 6) ❌ NO DEFINITION ← Error!
```

### EXPECTED (FIXED) ✅

```
Database: organizations.hierarchy_config
{
  "levels": [
    { "name": "Article",      "depth": 0, "type": "article",      "numbering": "roman" },
    { "name": "Section",      "depth": 1, "type": "section",      "numbering": "numeric" },
    { "name": "Subsection",   "depth": 2, "type": "subsection",   "numbering": "numeric" },
    { "name": "Paragraph",    "depth": 3, "type": "paragraph",    "numbering": "alpha" },
    { "name": "Subparagraph", "depth": 4, "type": "subparagraph", "numbering": "numeric" },
    { "name": "Clause",       "depth": 5, "type": "clause",       "numbering": "alphaLower" },
    { "name": "Subclause",    "depth": 6, "type": "subclause",    "numbering": "roman" },
    { "name": "Item",         "depth": 7, "type": "item",         "numbering": "numeric" },
    { "name": "Subitem",      "depth": 8, "type": "subitem",      "numbering": "alpha" },
    { "name": "Point",        "depth": 9, "type": "point",        "numbering": "numeric" }
  ],
  "maxDepth": 10
}

Document Structure:
Article I               (depth 0) ✅ Matches "Article"
  Section 1             (depth 1) ✅ Matches "Section"
    1.1                 (depth 2) ✅ Matches "Subsection"
      1.1.1             (depth 3) ✅ Matches "Paragraph"
        (a)             (depth 4) ✅ Matches "Subparagraph"
        (b)             (depth 4) ✅ Matches "Subparagraph"
        (c)             (depth 5) ✅ Matches "Clause"
          (i)           (depth 6) ✅ Matches "Subclause"
          (ii)          (depth 6) ✅ Matches "Subclause"

✅ All depths have definitions → Validation passes!
```

---

## Error Message Breakdown

### "No level definition found for depth 0 to 6" (appears ONCE)

```
┌─────────────────────────────────────────────────┐
│  Section with Ambiguous or Variable Depth      │
└─────────────────────────────────────────────────┘

Possible Interpretations:
1. Preamble or Title Section (depth uncertain)
2. Multi-column layout (confuses parser)
3. Complex numbering scheme
4. Mixed formatting (tabs + spaces)

Visual Example:
┌──────────────────────────────────────┐
│  PREAMBLE                            │  ← Could be depth 0, 1, 2, 3, 4, 5, or 6
│                                      │     depending on interpretation
│  WHEREAS this organization...       │
└──────────────────────────────────────┘

Parser says: "I detected a section here, but I'm not sure
             if it's depth 0, 1, 2, 3, 4, 5, or 6"

Validator checks depths 0-6:
  ✅ Depth 0: Article → FOUND
  ✅ Depth 1: Section → FOUND
  ❌ Depths 2-6: NOT FOUND → ERROR!
```

### "No level definition found for depth 4 to 6" (appears 5 TIMES)

```
┌─────────────────────────────────────────────────┐
│  Five Sections at Similar Nesting Levels       │
└─────────────────────────────────────────────────┘

Document Structure:
Section 1.2.3
  ├─ (a) Some text here        ← Error 1 (depth 4-6 uncertain)
  ├─ (b) More text here         ← Error 2 (depth 4-6 uncertain)
  ├─ (c) Even more text         ← Error 3 (depth 4-6 uncertain)
  ├─ (d) Additional text        ← Error 4 (depth 4-6 uncertain)
  └─ (e) Final text             ← Error 5 (depth 4-6 uncertain)

Parser says: "I found 5 sections here, each could be
             depth 4, 5, or 6 based on indentation"

Validator checks depths 4-6 for each:
  ❌ Depth 4: Subparagraph → NOT FOUND
  ❌ Depth 5: Clause → NOT FOUND
  ❌ Depth 6: Subclause → NOT FOUND
  → ERROR for all 5 sections!
```

---

## File Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FILE INTERACTION MAP                         │
└─────────────────────────────────────────────────────────────────┘

📝 User Action: Complete Setup Wizard
    ↓
📂 /src/services/setupService.js
    ├─ Line 50: saveDocumentConfig()
    ├─ Line 54: ❌ hierarchyConfig.levels = [Article, Section]  ← PROBLEM!
    ├─ Line 70: ❌ hierarchyConfig.maxDepth = 5                 ← PROBLEM!
    └─ Line 75: Saves to database
         ↓
🗄️  Database: organizations.hierarchy_config
    └─ { levels: [2 items], maxDepth: 5 }  ← INCOMPLETE!
         ↓
📄 User Action: Upload Document
    ↓
📂 /src/services/setupService.js
    ├─ Line 176: processDocumentImport()
    ├─ Line 179: Load config from database
    │     ↓
    │  📂 /src/config/organizationConfig.js
    │     ├─ Line 309: loadFromDatabase()
    │     ├─ Line 342: Validate hierarchy completeness
    │     ├─ Line 354: ⚠️  Check passes (has type, depth, numbering)
    │     └─ Returns incomplete config (only 2 levels)
    │
    ├─ Line 192: Parse document with config
    │     ↓
    │  📂 /src/parsers/wordParser.js
    │     ├─ Detects sections at depths 0-6
    │     ├─ Line 720: Validate hierarchy
    │     │     ↓
    │     │  📂 /src/parsers/hierarchyDetector.js
    │     │     ├─ Line 248: validateHierarchy()
    │     │     ├─ Line 276: Check each section depth
    │     │     ├─ levelDef = levels.find(l => l.depth === section.depth)
    │     │     │   ↓
    │     │     │   Config has only depths 0-1
    │     │     │   Section has depths 0-6
    │     │     │   ❌ levelDef is undefined for depths 2-6
    │     │     │
    │     │     └─ Line 278-282: Push error:
    │     │         "No level definition found for depth X"
    │     │
    │     └─ Line 726: Return validation errors
    │
    └─ Line 194: ❌ Validation fails, document import rejected
```

---

## Configuration Comparison Matrix

| Aspect | Current (Broken) | Fixed | Complete (Phase 2) |
|--------|------------------|-------|-------------------|
| **Levels Defined** | 2 | 10 | 10 + custom |
| **Max Depth** | 5 | 10 | 10 |
| **Depth Coverage** | 0-1 only | 0-9 complete | 0-9 customizable |
| **Source** | Hardcoded minimal | Default config | User-selected template |
| **Customization** | None | None | Per-document override |
| **Templates** | N/A | N/A | 4 pre-built + custom |
| **UI Editor** | None | None | Visual 10-level editor |
| **Validation** | ❌ Fails depth 2+ | ✅ Passes all depths | ✅ + Custom validation |

---

## Depth Numbering Cheat Sheet

```
┌──────────────────────────────────────────────────────────────────┐
│              10-LEVEL HIERARCHY STRUCTURE                        │
└──────────────────────────────────────────────────────────────────┘

Depth 0:  Article I, II, III...        (Roman numerals)
  │
  └─ Depth 1:  Section 1, 2, 3...      (Arabic numerals)
       │
       └─ Depth 2:  Subsection 1.1, 1.2...  (Decimal notation)
            │
            └─ Depth 3:  Paragraph (a), (b), (c)...  (Lowercase letters)
                 │
                 └─ Depth 4:  Subparagraph 1, 2, 3...  (Arabic numerals)
                      │
                      └─ Depth 5:  Clause (a), (b), (c)...  (Lowercase letters)
                           │
                           └─ Depth 6:  Subclause i, ii, iii...  (Roman numerals)
                                │
                                └─ Depth 7:  • Item 1, 2, 3...  (Bullet + number)
                                     │
                                     └─ Depth 8:  ◦ Subitem A, B, C...  (Sub-bullet + letter)
                                          │
                                          └─ Depth 9:  - Point 1, 2, 3...  (Dash + number)

Example Full Path:
Article I → Section 2 → 2.3 → (c) → 4 → (b) → ii → • 1 → ◦ A → - 3

Citation: "Article I, Section 2, Subsection 2.3, Paragraph (c),
          Subparagraph 4, Clause (b), Subclause ii, Item 1, Subitem A, Point 3"
```

---

## Templates Visualization

### Standard Bylaws Template
```
Article I (roman, depth 0)
├─ Section 1 (numeric, depth 1)
│  ├─ 1.1 (numeric, depth 2)
│  │  ├─ (a) (alphaLower, depth 3)
│  │  │  ├─ 1 (numeric, depth 4)
│  │  │  │  ├─ (a) (alphaLower, depth 5)
│  │  │  │  │  ├─ i (roman, depth 6)
│  │  │  │  │  │  ├─ • 1 (numeric, depth 7)
│  │  │  │  │  │  │  ├─ ◦ A (alpha, depth 8)
│  │  │  │  │  │  │  │  └─ - 1 (numeric, depth 9)
```

### Legal Document Template
```
Chapter I (roman, depth 0)
├─ Section 1 (numeric, depth 1)
│  ├─ Clause 1 (numeric, depth 2)
│  │  ├─ 1.1 (numeric, depth 3)
│  │  │  ├─ (a) (alphaLower, depth 4)
│  │  │  │  ├─ 1 (numeric, depth 5)
│  │  │  │  │  ├─ (a) (alphaLower, depth 6)
│  │  │  │  │  │  ├─ i (roman, depth 7)
│  │  │  │  │  │  │  ├─ • 1 (numeric, depth 8)
│  │  │  │  │  │  │  │  └─ ◦ A (alpha, depth 9)
```

### Technical Standard Template
```
1 (numeric, depth 0)
├─ 1.1 (numeric, depth 1)
│  ├─ 1.1.1 (numeric, depth 2)
│  │  ├─ 1.1.1.1 (numeric, depth 3)
│  │  │  ├─ 1.1.1.1.1 (numeric, depth 4)
│  │  │  │  ├─ 1.1.1.1.1.1 (numeric, depth 5)
│  │  │  │  │  ├─ 1.1.1.1.1.1.1 (numeric, depth 6)
│  │  │  │  │  │  ├─ 1.1.1.1.1.1.1.1 (numeric, depth 7)
│  │  │  │  │  │  │  ├─ 1.1.1.1.1.1.1.1.1 (numeric, depth 8)
│  │  │  │  │  │  │  │  └─ 1.1.1.1.1.1.1.1.1.1 (numeric, depth 9)
```

---

## Code Fix Visualization

### BEFORE (setupService.js lines 54-71)
```javascript
const hierarchyConfig = {
    levels: documentConfig.hierarchyLevels || [
        ┌──────────────────────────────────────────────┐
        │  ❌ ONLY 2 LEVELS!                           │
        │  { name: 'Article', depth: 0, ... },         │
        │  { name: 'Section', depth: 1, ... }          │
        └──────────────────────────────────────────────┘
    ],
    maxDepth: documentConfig.maxDepth || 5,  ← ❌ Should be 10!
    allowNesting: documentConfig.allowNesting !== false
};
```

### AFTER (one-line fix)
```javascript
const defaultHierarchy = require('../config/organizationConfig')
    .getDefaultConfig().hierarchy;

const hierarchyConfig = documentConfig.hierarchyLevels
    ? { /* User custom */ }
    : {
        ┌──────────────────────────────────────────────┐
        │  ✅ ALL 10 LEVELS from default config!       │
        │  Article, Section, Subsection, Paragraph,    │
        │  Subparagraph, Clause, Subclause, Item,      │
        │  Subitem, Point                              │
        └──────────────────────────────────────────────┘
        levels: defaultHierarchy.levels,
        maxDepth: defaultHierarchy.maxDepth,  ← ✅ Now 10!
        allowNesting: defaultHierarchy.allowNesting
      };
```

---

## Testing Checklist (Visual)

### ✅ Success Indicators

```
┌────────────────────────────────────────────────┐
│  Database Check                                │
└────────────────────────────────────────────────┘
SELECT
    jsonb_array_length(hierarchy_config->'levels') as level_count
FROM organizations;

Expected: level_count = 10  ✅

┌────────────────────────────────────────────────┐
│  Setup Wizard Test                             │
└────────────────────────────────────────────────┘
1. Create new organization     ✅
2. Upload test document        ✅
3. No validation errors        ✅

┌────────────────────────────────────────────────┐
│  Debug Log Check                               │
└────────────────────────────────────────────────┘
[SETUP-DEBUG] Hierarchy levels: 10  ✅
[SETUP-DEBUG]   * Article (depth: 0)  ✅
[SETUP-DEBUG]   * Section (depth: 1)  ✅
[SETUP-DEBUG]   * ...
[SETUP-DEBUG]   * Point (depth: 9)  ✅
```

### ❌ Failure Indicators (Before Fix)

```
┌────────────────────────────────────────────────┐
│  Database Check                                │
└────────────────────────────────────────────────┘
SELECT
    jsonb_array_length(hierarchy_config->'levels') as level_count
FROM organizations;

Actual: level_count = 2  ❌

┌────────────────────────────────────────────────┐
│  Setup Wizard Test                             │
└────────────────────────────────────────────────┘
1. Create new organization     ✅
2. Upload test document        ✅
3. Validation errors appear    ❌
   "No level definition found for depth 4 to 6"

┌────────────────────────────────────────────────┐
│  Debug Log Check                               │
└────────────────────────────────────────────────┘
[SETUP-DEBUG] Hierarchy levels: 2  ❌
[SETUP-DEBUG]   * Article (depth: 0)  ✅
[SETUP-DEBUG]   * Section (depth: 1)  ✅
[SETUP-DEBUG]   ⚠️  Missing depths 2-9  ❌
```

---

## Priority & Impact

```
┌─────────────────────────────────────────────────────────────────┐
│                      IMPACT MATRIX                              │
└─────────────────────────────────────────────────────────────────┘

Severity:      HIGH  🔴
Frequency:     Every new organization with default setup
User Impact:   Cannot upload documents, setup appears broken
Data Loss:     None (fix is backward compatible)
Workaround:    Manual SQL update per organization
Fix Time:      15 minutes (code change + deploy)
Risk Level:    LOW (isolated change, well-tested defaults)

┌─────────────────────────────────────────────────────────────────┐
│                    AFFECTED USERS                               │
└─────────────────────────────────────────────────────────────────┘

✅ Unaffected:
  - Organizations created before this issue
  - Organizations with manually updated configs
  - Organizations using custom hierarchies

❌ Affected:
  - New organizations created via setup wizard
  - Organizations with default 2-level config
  - Any upload of documents with depth > 1

┌─────────────────────────────────────────────────────────────────┐
│                    FIX DEPLOYMENT                               │
└─────────────────────────────────────────────────────────────────┘

1. Update setupService.js (1 line change)           ← 5 min
2. Restart application server                       ← 2 min
3. Test with new organization                       ← 5 min
4. (Optional) Migrate existing orgs via SQL         ← 3 min
                                             ──────────────
                                        TOTAL: 15 minutes
```

---

**Visual Summary Prepared By:** Research Agent
**Date:** 2025-10-18
**Status:** READY FOR PRESENTATION TO USER
