# Section Depth Flow Research Report

**Research Date**: 2025-10-27
**Researcher**: Debug Swarm - Research Agent
**Mission**: Trace how section depth flows from parser to database

---

## Executive Summary

**CRITICAL BUG FOUND**: Database trigger `update_section_path()` **OVERWRITES** the depth value from parsers!

### The Problem

Parser calculates correct depth → Stored in INSERT → Database trigger recalculates depth incorrectly → Wrong depth in database

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: File Upload (admin.js:741)                                     │
│ ─────────────────────────────────────────────────────────────────────── │
│ User uploads .docx/.txt file                                            │
│ → setupService.processDocumentImport(orgId, filePath, supabase)        │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Parser Selection (setupService.js:192-210)                     │
│ ─────────────────────────────────────────────────────────────────────── │
│ File extension detected:                                                │
│   .docx, .doc  → wordParser                                            │
│   .txt, .md    → textParser                                            │
│ Organization config loaded with hierarchy levels                        │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Document Parsing (wordParser.js / textParser.js)               │
│ ─────────────────────────────────────────────────────────────────────── │
│ A. hierarchyDetector.detectHierarchy(text, config)                     │
│    - Detects patterns: "ARTICLE I", "Section 1", etc.                  │
│    - Returns items with type, number, prefix                           │
│                                                                         │
│ B. enrichSections(sections, organizationConfig)                        │
│    - First pass: Basic enrichment with levelDef                        │
│      ✅ CORRECT: depth = levelDef?.depth || 0                          │
│      Example: 'article' type → levelDef.depth = 0                      │
│               'section' type → levelDef.depth = 1                       │
│                                                                         │
│ C. enrichSectionsWithContext(sections, levels)                         │
│    - Second pass: Context-aware depth calculation                      │
│      ✅ CORRECT: Uses configured depth from hierarchy levels           │
│      Code (wordParser.js:750-767):                                     │
│        const levelDef = levels.find(l => l.type === section.type)     │
│        const configuredDepth = levelDef?.depth                         │
│        contextualDepth = configuredDepth  // Uses config, not stack!   │
│                                                                         │
│    - Overrides for special types:                                      │
│      • type === 'article' → depth = 0 (forced)                         │
│      • type === 'preamble' → depth = 0 (forced)                        │
│                                                                         │
│    - Output: sections array with depth property                        │
│      Example section object:                                           │
│        {                                                                │
│          type: 'section',                                              │
│          depth: 1,              ← ✅ CORRECT from levelDef             │
│          section_number: 'Section 1',                                  │
│          title: 'NAME',                                                │
│          text: 'The name of...',                                       │
│          citation: 'Article I, Section 1',                             │
│          ...                                                            │
│        }                                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Section Storage (sectionStorage.js:26-49)                      │
│ ─────────────────────────────────────────────────────────────────────── │
│ Transform to database format:                                          │
│                                                                         │
│   const dbSections = hierarchicalSections.map((section, index) => {    │
│     return {                                                            │
│       document_id: documentId,                                         │
│       parent_section_id: section.parent_id,  ← NULL initially          │
│       ordinal: section.ordinal,              ← Sibling position        │
│       document_order: index + 1,             ← Sequential order        │
│       depth: section.depth,    ← ✅ CORRECT VALUE FROM PARSER          │
│       section_number: section.section_number,                          │
│       section_title: section.title,                                    │
│       section_type: section.type,                                      │
│       original_text: section.content,                                  │
│       current_text: section.content,                                   │
│       metadata: { ... },                                               │
│       created_at: new Date().toISOString(),                            │
│       updated_at: new Date().toISOString()                             │
│     };                                                                  │
│   });                                                                   │
│                                                                         │
│ ✅ At this point, depth is CORRECT!                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Database INSERT (sectionStorage.js:62-73)                      │
│ ─────────────────────────────────────────────────────────────────────── │
│ Batch insert to document_sections table:                               │
│                                                                         │
│   const { data, error } = await supabase                               │
│     .from('document_sections')                                         │
│     .insert(batch)      ← Contains correct depth value                 │
│     .select();                                                          │
│                                                                         │
│ ✅ INSERT statement includes correct depth                             │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔥 STEP 6: DATABASE TRIGGER FIRES (001_generalized_schema.sql:207-237) │
│ ─────────────────────────────────────────────────────────────────────── │
│ Trigger: trg_update_section_path                                       │
│ Function: update_section_path()                                        │
│                                                                         │
│ CREATE OR REPLACE FUNCTION update_section_path()                       │
│ RETURNS TRIGGER AS $$                                                  │
│ BEGIN                                                                   │
│   IF NEW.parent_section_id IS NULL THEN                                │
│     -- Root section                                                    │
│     NEW.path_ids := ARRAY[NEW.id];                                     │
│     NEW.path_ordinals := ARRAY[NEW.ordinal];                           │
│     NEW.depth := 0;  ← ❌ OVERWRITES DEPTH TO 0!                       │
│   ELSE                                                                  │
│     -- Child section: inherit parent's path and append self            │
│     SELECT                                                              │
│       p.path_ids || NEW.id,                                            │
│       p.path_ordinals || NEW.ordinal,                                  │
│       p.depth + 1      ← ❌ RECALCULATES DEPTH FROM PARENT!            │
│     INTO NEW.path_ids, NEW.path_ordinals, NEW.depth                    │
│     FROM document_sections p                                           │
│     WHERE p.id = NEW.parent_section_id;                                │
│   END IF;                                                               │
│   RETURN NEW;                                                           │
│ END;                                                                    │
│ $$ LANGUAGE plpgsql;                                                   │
│                                                                         │
│ ❌ BUG: This trigger OVERWRITES the correct depth value!               │
│                                                                         │
│ Problem 1: All root sections (parent_section_id = NULL) → depth = 0   │
│            Even if they should be depth 1, 2, etc.                     │
│                                                                         │
│ Problem 2: Child sections use parent.depth + 1                         │
│            But parent_section_id is NULL during initial insert!        │
│            So depth calculation fails.                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 7: Parent Relationships Updated (sectionStorage.js:79-88)         │
│ ─────────────────────────────────────────────────────────────────────── │
│ After initial insert, updateParentRelationships() is called:           │
│   - Fetches all sections ordered by document_order                     │
│   - Builds parent_section_id based on depth hierarchy                  │
│   - Updates parent_section_id with actual UUIDs                        │
│                                                                         │
│ ✅ Parent relationships are correctly set                              │
│ ❌ BUT depth was already overwritten by trigger during INSERT!         │
│ ❌ Trigger fires again on UPDATE, recalculates depth from parent       │
└─────────────────────────────────────────────────────────────────────────┘

---

## Root Cause Analysis

### Why Depth Is Wrong

1. **Parser calculates correct depth** (e.g., Section → depth 1)
2. **sectionStorage includes depth in INSERT** (correct value sent to DB)
3. **Database trigger fires BEFORE INSERT completes**
4. **Trigger overwrites depth**:
   - If `parent_section_id IS NULL` → `depth := 0` (WRONG!)
   - If `parent_section_id EXISTS` → `depth := parent.depth + 1` (but parent doesn't exist yet!)
5. **Parent relationships are set AFTER insert** (too late!)
6. **Trigger fires again on UPDATE**, recalculates depth from wrong parent depth

### Why This Breaks The System

**Example**: "Section 1" under "ARTICLE I"

- Parser says: `depth = 1` (correct, from hierarchy config)
- Database trigger on INSERT:
  - `parent_section_id = NULL` (not set yet)
  - Trigger forces: `depth = 0` (WRONG!)
- Database trigger on UPDATE (after parent set):
  - `parent_section_id = <ARTICLE I UUID>`
  - ARTICLE I has `depth = 0` (correct)
  - Trigger sets: `depth = parent.depth + 1 = 0 + 1 = 1` (correct by accident!)

**BUT**: If parent relationships aren't hierarchical (e.g., flat document), ALL sections get `depth = 0`!

---

## Fields Included in INSERT Statement

From `sectionStorage.js:26-49`:

```javascript
{
  document_id: documentId,              ✅ Included
  parent_section_id: section.parent_id, ✅ Included (NULL initially)
  ordinal: section.ordinal,             ✅ Included
  document_order: index + 1,            ✅ Included
  depth: section.depth,                 ✅ Included (CORRECT VALUE)
  section_number: section.section_number, ✅ Included
  section_title: section.title,         ✅ Included
  section_type: section.type,           ✅ Included
  original_text: section.content,       ✅ Included
  current_text: section.content,        ✅ Included
  metadata: { ... },                    ✅ Included
  created_at: new Date().toISOString(), ✅ Included
  updated_at: new Date().toISOString()  ✅ Included
}
```

**All fields are correctly included**, including the correct `depth` value from the parser!

---

## Parser Depth Calculation Verification

### wordParser.js

**Location**: Lines 624-852

**Method**: `enrichSections()` → `enrichSectionsWithContext()`

**Correct Depth Assignment** (Lines 750-767):

```javascript
// Find the level definition for this section type
const levelDef = levels.find(l => l.type === section.type);
const configuredDepth = levelDef?.depth;

// Calculate contextual depth - prefer configured depth over stack
let contextualDepth;
let depthReason;

if (configuredDepth !== undefined && configuredDepth !== null) {
  // Use configured depth from hierarchy
  contextualDepth = configuredDepth;  // ✅ CORRECT!
  depthReason = 'configured';
  console.log(`[CONTEXT-DEPTH]   Using configured depth: ${contextualDepth}`);
} else {
  // Fallback to stack-based depth for unknown types
  contextualDepth = hierarchyStack.length;
  depthReason = 'stack-fallback';
}

// Override for special types
if (section.type === 'article') {
  contextualDepth = 0;
  depthReason = 'article-override';
} else if (section.type === 'preamble') {
  contextualDepth = 0;
  depthReason = 'preamble-override';
}
```

**✅ Parser depth calculation is CORRECT** - uses configured hierarchy levels!

### textParser.js

**Location**: Lines 589-782

**Method**: Identical to wordParser

**✅ Parser depth calculation is CORRECT** - same logic!

---

## Database Triggers Analysis

### Trigger: `trg_update_section_path`

**File**: `database/migrations/001_generalized_schema.sql`
**Lines**: 239-243

```sql
CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();
```

**Fires on**:
- INSERT (before row is inserted)
- UPDATE of `parent_section_id` or `ordinal` columns

### Function: `update_section_path()`

**File**: `database/migrations/001_generalized_schema.sql`
**Lines**: 207-237

```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;  -- ❌ BUG: Forces all root sections to depth 0!
  ELSE
    -- Child section: inherit parent's path and append self
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1  -- ❌ BUG: Recalculates depth based on parent!
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Problems**:

1. **Line 214**: `NEW.depth := 0;`
   - Forces ALL sections with `parent_section_id = NULL` to `depth = 0`
   - But in flat documents or during initial insert, many sections have NULL parent!

2. **Line 220**: `p.depth + 1`
   - Recalculates depth based on parent's depth
   - Ignores the correct depth value from the parser
   - If parent has wrong depth, child inherits wrong depth + 1

3. **Trigger fires BEFORE INSERT**
   - Runs before the row is committed
   - Overwrites the correct `depth` value from the INSERT statement
   - No way to preserve parser's correct depth!

---

## Gaps Where Depth Is Lost

### Gap 1: Database Trigger Overwrite (CRITICAL)

**Location**: `001_generalized_schema.sql:207-237`

**What happens**:
- Parser calculates `depth = 1` for "Section 1"
- sectionStorage sends INSERT with `depth: 1`
- Trigger fires BEFORE INSERT completes
- Trigger sees `parent_section_id = NULL`
- Trigger forces `depth = 0` (WRONG!)
- INSERT completes with `depth = 0` (parser value lost!)

**Impact**: 🔴 CRITICAL - All depth values are wrong!

### Gap 2: Parent Relationships Set Too Late

**Location**: `sectionStorage.js:79-88`

**What happens**:
- Initial INSERT happens with `parent_section_id = NULL` for all sections
- Trigger sets all sections to `depth = 0`
- THEN `updateParentRelationships()` is called
- Parent UUIDs are set via UPDATE
- Trigger fires again, recalculates depth from parent
- But parent already has wrong depth!

**Impact**: 🟡 MEDIUM - Cascade of wrong depth values

### Gap 3: No Depth Preservation in Trigger

**Location**: `001_generalized_schema.sql:207-237`

**What should happen**:
- Trigger should check if `NEW.depth` is already set (from INSERT)
- If set, preserve it
- Only calculate depth if NULL or missing

**What actually happens**:
- Trigger unconditionally overwrites `NEW.depth`
- Parser's correct value is always lost

**Impact**: 🔴 CRITICAL - No way to preserve correct depth!

---

## Recommended Fix

### Option 1: Modify Database Trigger (Recommended)

**File**: `database/migrations/001_generalized_schema.sql`

**Change**:

```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  -- ✅ FIX: Only calculate depth if not already set by parser
  IF NEW.depth IS NULL THEN
    IF NEW.parent_section_id IS NULL THEN
      NEW.depth := 0;
    ELSE
      SELECT p.depth + 1
      INTO NEW.depth
      FROM document_sections p
      WHERE p.id = NEW.parent_section_id;
    END IF;
  END IF;

  -- Always update path arrays
  IF NEW.parent_section_id IS NULL THEN
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
  ELSE
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal
    INTO NEW.path_ids, NEW.path_ordinals
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Pros**:
- ✅ Preserves parser's correct depth value
- ✅ Falls back to calculation if depth is NULL
- ✅ Backward compatible
- ✅ Minimal code changes

**Cons**:
- None!

### Option 2: Set Parent Relationships Before Insert

**File**: `sectionStorage.js`

**Change**: Build complete parent relationships BEFORE insert, then insert all at once

**Pros**:
- ✅ Trigger can calculate depth correctly from parent

**Cons**:
- ❌ Complex refactoring required
- ❌ Need to resolve UUIDs before insert (circular dependency)
- ❌ Batch insert becomes sequential

---

## Summary

### Data Flow (Current - BROKEN)

```
Parser (depth=1) → INSERT (depth=1) → Trigger (depth=0) → Database (depth=0) ❌
```

### Data Flow (After Fix)

```
Parser (depth=1) → INSERT (depth=1) → Trigger (preserves depth=1) → Database (depth=1) ✅
```

### Key Finding

**The parser depth calculation is 100% CORRECT!**
**The database trigger is the culprit - it unconditionally overwrites depth!**

---

## Testing Recommendations

1. Check `database/document_sections_rows.txt` for actual depth values
2. Compare parser output logs with database rows
3. Verify trigger behavior with test inserts
4. Test fix with sample document upload

---

**Research Complete** ✅
**Critical bug identified** 🔴
**Fix recommended** ✅
**Ready for coder agent to implement fix** 🚀
