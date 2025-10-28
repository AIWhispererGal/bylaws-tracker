# Document Hierarchy Gap Research
**Date:** 2025-10-27
**Status:** Complete
**Researcher:** Research Agent

---

## Executive Summary

This document provides comprehensive research into how the system handles section hierarchies, with focus on **hierarchy gaps** (e.g., Article I at depth=0 → Subparagraph at depth=3, skipping Sections/Subsections).

### Key Findings:
1. **System ALLOWS gap levels** - No enforcement of consecutive depths
2. **Real data shows flat hierarchy** - ALL sections have depth=0 and parent_section_id=NULL
3. **Indent/Dedent operations have constraints** preventing auto-fix
4. **Database trigger bug** was causing depth calculation issues (fixed in migrations 025/026)

---

## 1. Database Schema Analysis

### Core Table Structure

**File:** `/database/schema.sql`

```sql
CREATE TABLE public.document_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  parent_section_id uuid,                               -- NULL allowed (root sections)
  ordinal integer NOT NULL CHECK (ordinal > 0),         -- 1-indexed ordinals
  depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 10),  -- Allows 0-10
  path_ids ARRAY NOT NULL,                              -- Ancestry path
  path_ordinals ARRAY NOT NULL,                         -- Ordinal path
  section_number character varying,
  section_title text,
  section_type character varying,
  original_text text,
  current_text text,
  -- ... other fields
  CONSTRAINT document_sections_parent_section_id_fkey
    FOREIGN KEY (parent_section_id) REFERENCES public.document_sections(id)
);
```

### Critical Constraints:

1. **Depth Range:** `CHECK (depth >= 0 AND depth <= 10)` - Allows 11 levels (0-10)
2. **Path Consistency:**
   - `CHECK(array_length(path_ids, 1) = depth + 1)` - Path must match depth
   - `CHECK(array_length(path_ordinals, 1) = depth + 1)` - Ordinals must match depth
3. **Parent Reference:** Self-referencing FK allows hierarchies
4. **NO constraint enforcing consecutive depths** - Gap levels are VALID

---

## 2. Hierarchy Detection Logic

### File: `/src/parsers/hierarchyDetector.js`

#### Validation Logic (Lines 334-396):

```javascript
validateHierarchy(sections, organizationConfig) {
  const errors = [];
  const warnings = [];
  let prevDepth = -1;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // ✅ FIX: Depth jumps are VALID! Changed to WARNING.
    // Example: Article (depth 0) can have deeply nested item (depth 4) - that's OK!
    if (section.depth > prevDepth + 1 && prevDepth >= 0) {
      warnings.push({
        section: section.citation || `Section ${i + 1}`,
        message: `Depth jumped from ${prevDepth} to ${section.depth} (unusual structure but allowed)`,
        type: 'depth_jump'
      });
    }

    prevDepth = section.depth;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings  // Depth jumps are warnings, NOT errors
  };
}
```

**Key Insight:** The system explicitly allows depth gaps. A warning is issued, but it's not an error. This means:
- Article I (depth 0) → Subparagraph (a) (depth 3) is **VALID**
- No intermediate Sections/Subsections required

---

## 3. Parser Depth Assignment

### Word Parser (`/src/parsers/wordParser.js`)

#### Context-Aware Depth Calculation (Lines 683-852):

```javascript
enrichSectionsWithContext(sections, levels) {
  const typePriority = {
    'article': 100,      // Depth 0
    'section': 90,       // Depth 1
    'subsection': 80,    // Depth 2
    'paragraph': 70,     // Depth 3
    'subparagraph': 60,  // Depth 4
    'clause': 50,        // Depth 5
    'subclause': 40,     // Depth 6
    'item': 30,          // Depth 7
    'subitem': 20,       // Depth 8
    'point': 10,         // Depth 9
    // ...
  };

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const levelDef = levels.find(l => l.type === section.type);
    const configuredDepth = levelDef?.depth;

    // ✅ Use configured depth from hierarchy levels
    let contextualDepth;
    if (configuredDepth !== undefined) {
      contextualDepth = configuredDepth;  // From organization config
    } else {
      contextualDepth = hierarchyStack.length;  // Fallback to stack
    }

    // Override for special types
    if (section.type === 'article') contextualDepth = 0;
    if (section.type === 'preamble') contextualDepth = 0;

    enrichedSection.depth = contextualDepth;
  }
}
```

**Key Logic:**
- Parsers assign depth based on **organization hierarchy configuration**
- Each section type has a configured depth (Article=0, Section=1, etc.)
- Parser preserves this depth during initial insert
- No requirement for consecutive depths

### Text Parser (`/src/parsers/textParser.js`)

Identical logic to wordParser (lines 642-782), with additional indentation hints support.

---

## 4. Database Trigger Analysis

### File: `/database/migrations/026_fix_path_ids_constraint.sql`

#### Trigger Function (Lines 22-76):

```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section (or orphaned section with parser-assigned depth)

    -- ✅ Preserve parser's depth value
    IF NEW.depth IS NULL THEN
      NEW.depth := 0;
    END IF;

    -- ✅ Build path_ids with correct length = depth + 1
    -- Fill missing parent slots with section's own ID
    v_path_length := NEW.depth + 1;

    -- Create array filled with NEW.id repeated v_path_length times
    FOR i IN 1..v_path_length LOOP
      v_fill_array := v_fill_array || NEW.id;
    END LOOP;

    NEW.path_ids := v_fill_array;
    -- Same for path_ordinals
  ELSE
    -- Child section: inherit parent's path and append self
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Critical Observations:**

1. **When parent_section_id IS NULL:**
   - Preserves parser-assigned depth
   - Builds path_ids array by repeating section's own ID
   - Example: Section with depth=1 gets path_ids=[id, id]

2. **When parent_section_id IS NOT NULL:**
   - Calculates depth as `parent.depth + 1`
   - **This ENFORCES consecutive depths when parent exists**
   - Cannot skip levels when using parent relationship

3. **Bug History:**
   - Migration 025: Fixed depth preservation (was overwriting parser depth)
   - Migration 026: Fixed path_ids length constraint violation

---

## 5. Real Data Analysis

### File: `/database/document_sections_rows.txt`

**Sample Data (first 14 rows):**

| idx | section_type | depth | parent_section_id | ordinal | section_number |
|-----|--------------|-------|-------------------|---------|----------------|
| 0 | preamble | 0 | NULL | 1 | Preamble |
| 1 | article | 0 | NULL | 2 | Article I |
| 2 | article | 0 | NULL | 3 | Article II |
| 3 | section | 0 | NULL | 1 | 1 (Mission) |
| 4 | section | 0 | NULL | 2 | 2 (Policy) |
| 5 | section | 0 | NULL | 3 | 3 (Execution) |
| 6 | article | 0 | NULL | 4 | Article III |
| 7 | section | 0 | NULL | 1 | 1 (Boundary) |
| 8 | section | 0 | NULL | 2 | 2 (Internal) |
| 9 | article | 0 | NULL | 5 | Article IV |
| 10 | **subparagraph** | 0 | NULL | 1 | 1 (Lives/works) |
| 11 | **subparagraph** | 0 | NULL | 2 | 2 (Community) |
| 12 | article | 0 | NULL | 6 | Article V |
| 13 | section | 0 | NULL | 1 | 1 (Composition) |

### Critical Finding: **FLAT HIERARCHY**

**ALL sections have:**
- `depth = 0`
- `parent_section_id = NULL`
- `ordinal` increases sequentially within same parent

**This means:**
1. Articles, Sections, and Subparagraphs are ALL at root level
2. No parent-child relationships established
3. Hierarchy is **implied** by section type, not database structure
4. **This is the "broken" hierarchy mentioned in the mission**

---

## 6. Indent/Dedent Operations

### File: `/src/routes/admin.js` (Lines 2008-2282)

#### Indent Operation (POST /admin/sections/:id/indent):

**Requirements:**
1. Section must have an earlier sibling at same parent level
2. Section becomes child of that earlier sibling
3. Depth increases by 1

**Constraints:**
```javascript
// Find previous sibling (will become new parent)
const { data: previousSibling } = await supabaseService
  .from('document_sections')
  .select('id, ordinal, depth')
  .eq('document_id', section.document_id)
  .eq('parent_section_id', section.parent_section_id)  // SAME parent
  .lt('ordinal', section.ordinal)
  .order('ordinal', { ascending: false })
  .limit(1);

if (!previousSibling) {
  return error('Cannot indent: no earlier sibling to indent under');
}
```

**Limitation:** Cannot indent if no earlier sibling exists

#### Dedent Operation (POST /admin/sections/:id/dedent):

**Requirements:**
1. Section must have a parent (cannot dedent root level)
2. Section becomes sibling of its current parent
3. Depth decreases by 1

**Constraints:**
```javascript
if (!section.parent_section_id) {
  return error('Cannot dedent: section is already at root level');
}
```

**Limitation:** Cannot dedent if already at root level (depth=0)

### Why Can't Auto-Fix Work?

**Example Scenario:**
- Article I (depth=0, parent=NULL)
- Subparagraph (a) (depth=0, parent=NULL) ← Should be depth=3

**To fix via indent:**
1. Need to create Section (depth=1) as child of Article I
2. Need to create Subsection (depth=2) as child of Section
3. Need to create Paragraph (depth=3) as child of Subsection
4. Make Subparagraph (a) child of Paragraph

**Problem:** Indent operation requires **existing earlier sibling**, can't create intermediate levels

**Alternative:** Manual restructuring
1. Admin must create missing intermediate sections manually
2. Then use indent/dedent to establish parent-child relationships

---

## 7. Gap Level Examples from Database

### Example 1: Article → Subparagraph (Gap of 3 levels)

**Current State:**
```
Article IV (depth=0, parent=NULL)
  ↓ (should be Section but missing)
    ↓ (should be Subsection but missing)
      ↓ (should be Paragraph but missing)
Subparagraph 1 (depth=0, parent=NULL) ← WRONG!
```

**Expected State:**
```
Article IV (depth=0, parent=NULL)
  Section 1 (depth=1, parent=Article IV)
    Subsection a (depth=2, parent=Section 1)
      Paragraph (1) (depth=3, parent=Subsection a)
        Subparagraph 1 (depth=4, parent=Paragraph (1))
```

### Example 2: Article → Section (Correct, no gap)

**Current State:**
```
Article II (depth=0, parent=NULL)
Section 1 (depth=0, parent=NULL) ← Should be depth=1
```

**Expected State:**
```
Article II (depth=0, parent=NULL)
  Section 1 (depth=1, parent=Article II)
```

---

## 8. Technical Limitations

### Database Constraints Preventing Auto-Fix:

1. **Path Consistency Constraints:**
   ```sql
   CHECK(array_length(path_ids, 1) = depth + 1)
   ```
   - Must maintain path integrity during updates
   - Cannot simply change depth without rebuilding paths

2. **Foreign Key Constraints:**
   ```sql
   CONSTRAINT document_sections_parent_section_id_fkey
   ```
   - Parent must exist before assigning parent_section_id
   - Cannot create circular dependencies

3. **Trigger Enforcement:**
   - `update_section_path()` trigger recalculates depth from parent
   - When parent_section_id IS NOT NULL, depth = parent.depth + 1
   - **This enforces consecutive depths for non-root sections**

### Admin Route Constraints:

1. **Indent requires existing earlier sibling**
   - Can't indent first child
   - Can't create intermediate parents automatically

2. **Dedent requires existing parent**
   - Can't dedent root-level sections
   - Can't skip levels during dedent

3. **Move operation** (lines 1456-1618):
   - Can only move within same document
   - Ordinal management prevents gaps in sibling order
   - No auto-creation of intermediate levels

---

## 9. Database Queries for Investigation

### Query 1: Find sections with gap-level depths

```sql
-- Find sections where depth > parent.depth + 1 (if they have parent)
SELECT
  s.id,
  s.section_number,
  s.section_type,
  s.depth as section_depth,
  p.depth as parent_depth,
  s.depth - p.depth as depth_gap
FROM document_sections s
LEFT JOIN document_sections p ON s.parent_section_id = p.id
WHERE
  s.parent_section_id IS NOT NULL
  AND s.depth > p.depth + 1
ORDER BY depth_gap DESC;
```

### Query 2: Find all root-level sections (potential hierarchy issues)

```sql
-- All sections with NULL parent (should only be Articles/Preambles)
SELECT
  section_type,
  depth,
  COUNT(*) as count
FROM document_sections
WHERE parent_section_id IS NULL
GROUP BY section_type, depth
ORDER BY depth, section_type;
```

### Query 3: Sections with incorrect type-depth mapping

```sql
-- Sections whose depth doesn't match expected depth for their type
SELECT
  s.section_number,
  s.section_type,
  s.depth,
  hl.depth as expected_depth,
  s.depth - hl.depth as depth_mismatch
FROM document_sections s
LEFT JOIN (
  SELECT
    jsonb_array_elements(hierarchy_config->'levels')::jsonb->>'type' as type,
    (jsonb_array_elements(hierarchy_config->'levels')::jsonb->>'depth')::int as depth
  FROM organizations
) hl ON s.section_type = hl.type
WHERE s.depth != hl.depth OR hl.depth IS NULL;
```

---

## 10. Summary & Key Questions Answered

### Q1: What happens when a document has Article I (depth 0) → Subparagraph (a) (depth 3) with NO Sections/Subsections in between?

**A:** The system **allows** this structure:
- Database constraint: `CHECK (depth >= 0 AND depth <= 10)` - no consecutive depth enforcement
- Validation: Depth jumps trigger **warnings**, not errors
- Real data shows this exact scenario exists (ALL sections at depth=0)

### Q2: Can a section have depth=3 with a parent at depth=0 (skipping depth 1 and 2)?

**A:** **Theoretically YES, but practically NO**:
- No database constraint prevents it
- **BUT** the trigger `update_section_path()` enforces: `NEW.depth = parent.depth + 1`
- So if parent exists, depth MUST be consecutive
- Only way to have gaps is NULL parent (all sections at root)

### Q3: What constraints prevent fixing this with indent/dedent?

**A:** Multiple constraints:
1. **Indent requires earlier sibling** - can't indent if first child
2. **Dedent requires parent** - can't dedent root-level sections
3. **No auto-creation of intermediate levels** - must manually create Section → Subsection → Paragraph chain
4. **Trigger enforces consecutive depths** when parent relationship exists

### Q4: Does the system allow "gap levels" or enforce consecutive depths?

**A:** **MIXED**:
- Database schema: Allows gap levels (no constraint)
- Trigger logic: Enforces consecutive depths when parent_section_id is set
- Real data: Has gaps because all sections have parent_section_id=NULL
- Validation: Warns about gaps but doesn't block them

---

## 11. Recommended Next Steps

1. **Data Migration Required:**
   - Rebuild parent-child relationships for existing sections
   - Use section_type to determine correct depth and parent
   - Update all parent_section_id values

2. **Auto-Fix Tool Development:**
   - Create migration script to analyze section order
   - Detect logical hierarchy from section types
   - Insert missing intermediate sections where needed
   - Establish parent_section_id relationships

3. **Admin UI Enhancement:**
   - Add "Auto-Fix Hierarchy" button
   - Show visualization of current vs. expected hierarchy
   - Allow bulk operations to create missing levels

4. **Parser Enhancement:**
   - Ensure parsers set parent_section_id during initial import
   - Don't rely solely on depth, establish relationships
   - Validate hierarchy before saving to database

---

## Files Analyzed

1. `/database/schema.sql` - Table structure and constraints
2. `/database/migrations/025_fix_depth_trigger.sql` - Depth preservation fix
3. `/database/migrations/026_fix_path_ids_constraint.sql` - Path array fix
4. `/database/document_sections_rows.txt` - Real data examples
5. `/src/parsers/hierarchyDetector.js` - Hierarchy validation logic
6. `/src/parsers/wordParser.js` - Word document parsing depth assignment
7. `/src/parsers/textParser.js` - Text document parsing depth assignment
8. `/src/routes/admin.js` - Indent/dedent operations and constraints
9. `/src/services/sectionStorage.js` - Section storage validation

---

**End of Research Report**
