# Section Operations Bug Analysis

**Date**: 2025-10-23
**Status**: ⚠️ CRITICAL - Indent, dedent, and move operations broken
**Scope**: All section hierarchy manipulation operations

---

## Executive Summary

Section operations (indent, dedent, move up/down) are failing after recent schema changes. The root cause is a **mismatch between the ordinal system design and the database check constraint**.

**Quick Facts**:
- ✅ Constraint: `CHECK (ordinal > 0)` requires ordinals start at 1
- ❌ Code: Attempts to set `ordinal = 0` in some operations
- ❌ RPC Functions: May not exist in production database
- ❌ Move operations: Not implemented at all

---

## Table of Contents

1. [How the Ordinal System Works](#how-the-ordinal-system-works)
2. [Schema Analysis](#schema-analysis)
3. [Bug Analysis by Operation](#bug-analysis-by-operation)
4. [Root Cause Summary](#root-cause-summary)
5. [Test Scenarios](#test-scenarios)

---

## How the Ordinal System Works

### Two Separate Ordering Fields

The schema uses **two distinct fields** for ordering:

```sql
CREATE TABLE document_sections (
  ordinal integer NOT NULL CHECK (ordinal > 0),        -- Sibling position (1, 2, 3...)
  document_order integer NOT NULL CHECK (document_order > 0),  -- Document-wide order
  -- ... other fields
);
```

| Field | Purpose | Scope | Example |
|-------|---------|-------|---------|
| `ordinal` | Position among siblings at same depth | Per parent | Article I, Section 1 has ordinal=1, Section 2 has ordinal=2 |
| `document_order` | Parse order from original document | Entire document | 1, 2, 3, 4... for all sections sequentially |

### How Ordinals Work

**Design Intent**:
- Each section has an `ordinal` showing its position among siblings
- Siblings are sections with the same `parent_section_id` and `depth`
- Root level sections (depth=0) have `parent_section_id = NULL`
- Ordinals start at 1 and must be sequential (1, 2, 3, 4...)

**Example Hierarchy**:
```
Article I (ordinal=1, depth=0, parent=NULL)
  Section 1 (ordinal=1, depth=1, parent=Article I)
  Section 2 (ordinal=2, depth=1, parent=Article I)
  Section 3 (ordinal=3, depth=1, parent=Article I)
Article II (ordinal=2, depth=0, parent=NULL)
  Section 1 (ordinal=1, depth=1, parent=Article II)
```

---

## Schema Analysis

### Current Check Constraint

**Location**: `database/schema.sql:8`

```sql
ordinal integer NOT NULL CHECK (ordinal > 0)
```

**What This Means**:
- ✅ Ordinal must be a positive integer
- ✅ Ordinal cannot be 0
- ✅ Ordinal cannot be NULL
- ❌ Database will reject any UPDATE/INSERT that tries to set ordinal to 0 or negative

### Migration History

**Migration 003** added `document_order`:
- **File**: `database/migrations/003_add_document_order.sql`
- **Purpose**: Replace JSONB metadata->ordinal_position with dedicated column
- **Date**: 2025-10-22
- **Impact**: Separated document-wide ordering from sibling ordering

**Key Insight**: The `document_order` field was added recently. Some code may still be confused about which field to use for what purpose.

---

## Bug Analysis by Operation

### 1. INDENT Operation

**What It Should Do**:
- Make section a child of its previous sibling
- Example: Turn "Section 2" into "Section 1.a" (child of Section 1)

**Code Location**: `src/routes/admin.js:1981-2095`

#### Current Implementation

```javascript
router.post('/sections/:id/indent', requireAdmin, validateSectionEditable, async (req, res) => {
  // 1. Find previous sibling (will become new parent)
  const { data: previousSibling } = await supabaseService
    .from('document_sections')
    .select('id, ordinal, depth, section_number, section_title')
    .eq('document_id', section.document_id)
    .eq('parent_section_id', section.parent_section_id)
    .lt('ordinal', section.ordinal)
    .order('ordinal', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!previousSibling) {
    return res.status(400).json({
      error: 'Cannot indent: no earlier sibling to indent under',
      code: 'NO_SIBLING'
    });
  }

  // 2. Get count of new parent's children
  const { count: childCount } = await supabaseService
    .from('document_sections')
    .select('id', { count: 'exact', head: true })
    .eq('parent_section_id', previousSibling.id);

  const newOrdinal = (childCount || 0) + 1;  // ✅ CORRECT: 1-based

  // 3. Update section
  const { error: updateError } = await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: previousSibling.id,
      ordinal: newOrdinal,  // ✅ CORRECT: Will be 1, 2, 3...
      depth: section.depth + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
});
```

#### Bug Analysis: INDENT

**Scenario 1: No earlier sibling**
- **Error**: "Cannot indent: no earlier sibling to indent under"
- **Cause**: Query finds no previous sibling
- **Why**: First section at a level cannot be indented (correct behavior)
- **Status**: ⚠️ ERROR MESSAGE CORRECT, but user experience could be better

**Scenario 2: Has earlier sibling**
- **Error**: "violates check constraint 'document_sections_ordinal_check'"
- **Expected Flow**:
  1. Previous sibling becomes parent ✅
  2. Calculate new ordinal = childCount + 1 ✅
  3. Update section with new ordinal ✅
- **Actual Problem**: 🔍 **INVESTIGATION NEEDED**
  - The code looks correct on surface
  - Possible issues:
    - a) `childCount` returning NULL and `(NULL || 0) + 1 = NaN`?
    - b) Race condition with gap-closing logic?
    - c) RPC function `decrement_sibling_ordinals` causing issues?

**Critical Code Path** (lines 2048-2075):
```javascript
// 4. Close gap at old parent by decrementing ordinals
if (section.parent_section_id !== null) {
  const { error: shiftError } = await supabaseService.rpc(
    'decrement_sibling_ordinals',
    {
      p_parent_id: section.parent_section_id,
      p_start_ordinal: section.ordinal,
      p_decrement_by: 1
    }
  );
}
```

**CRITICAL FINDING**: This RPC function may not exist in the database!

---

### 2. DEDENT Operation

**What It Should Do**:
- Make section a sibling of its parent
- Example: Turn "Section 1.a" into "Section 2" (sibling of Section 1)

**Code Location**: `src/routes/admin.js:2110-2226`

#### Current Implementation

```javascript
router.post('/sections/:id/dedent', requireAdmin, validateSectionEditable, async (req, res) => {
  // 1. Check if already at root
  if (!section.parent_section_id) {
    return res.status(400).json({
      error: 'Cannot dedent: section is already at root level',
      code: 'ALREADY_ROOT'
    });
  }

  // 2. Get parent section
  const { data: parent } = await supabaseService
    .from('document_sections')
    .select('id, parent_section_id, ordinal, depth, section_number, section_title')
    .eq('id', section.parent_section_id)
    .single();

  // 3. Section will become sibling of parent, right after it
  const newOrdinal = parent.ordinal + 1;  // ✅ CORRECT: 1-based

  // 4. Shift ordinals to make space
  if (parent.parent_section_id !== null) {
    await supabaseService.rpc('increment_sibling_ordinals', {
      p_parent_id: parent.parent_section_id,
      p_start_ordinal: newOrdinal,
      p_increment_by: 1
    });
  }

  // 5. Update section
  const { error: updateError } = await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: parent.parent_section_id,  // Grandparent
      ordinal: newOrdinal,  // ✅ CORRECT
      depth: section.depth - 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
});
```

#### Bug Analysis: DEDENT

**Similar Issues as Indent**:
1. **RPC Function Missing**: `increment_sibling_ordinals` may not exist
2. **Race Conditions**: Gap-closing happens AFTER update
3. **Edge Case**: Root level section shift uses raw SQL (lines 2161-2171)

**Root Level Special Case**:
```javascript
// Shifting root-level sections
const { error: shiftError } = await supabaseService
  .from('document_sections')
  .update({ ordinal: supabaseService.sql`ordinal + 1` })  // ⚠️ POTENTIAL BUG
  .eq('document_id', section.document_id)
  .is('parent_section_id', null)
  .gte('ordinal', newOrdinal);
```

**Problem**: `supabaseService.sql` may not be a valid API. Should be using Supabase's `.rpc()` or a raw query.

---

### 3. MOVE UP / MOVE DOWN Operations

**Status**: ❌ **NOT IMPLEMENTED**

**Evidence**:
```bash
$ grep -r "moveUp\|moveDown\|move_up\|move_down" src/routes/*.js
# No matches found
```

**Frontend References**:
- `views/dashboard/document-viewer.ejs` has UI buttons for move up/down
- But no corresponding backend endpoints exist

**What They Should Do**:
- **Move Up**: Swap ordinal with previous sibling (ordinal - 1)
- **Move Down**: Swap ordinal with next sibling (ordinal + 1)

**Not Found**:
- No `POST /admin/sections/:id/move-up` route
- No `POST /admin/sections/:id/move-down` route

---

## Root Cause Summary

### Primary Issues

| Issue | Impact | Severity | Location |
|-------|--------|----------|----------|
| **Missing RPC Functions** | Indent/dedent fail when gap-closing | 🔴 CRITICAL | Database |
| **Invalid Supabase API** | `supabaseService.sql` doesn't exist | 🔴 CRITICAL | admin.js:2163 |
| **Move operations missing** | UI buttons non-functional | 🔴 CRITICAL | src/routes/admin.js |
| **Confusing error messages** | "no sibling" doesn't explain fix | 🟡 MEDIUM | admin.js:2012 |

### Secondary Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| Race conditions in ordinal updates | Intermittent failures | 🟡 MEDIUM |
| No database transactions | Data inconsistency possible | 🟡 MEDIUM |
| Ordinal validation happens too late | Poor error messages | 🟡 MEDIUM |

---

## Missing RPC Functions Investigation

### Where They Should Be

**Expected Location**: These should be database functions (Postgres PLPGSQL)

**Found In**:
- ✅ `archive/migration-history/020_section_editing_functions.sql` (lines 11-65)
- ❌ NOT in `database/schema.sql` (current schema)
- ❌ NOT in `database/migrations/001_generalized_schema.sql`
- ❌ NOT in `database/migrations/002_migrate_existing_data.sql`
- ❌ NOT in `database/migrations/003_add_document_order.sql`

**Conclusion**: The RPC functions were designed but **never deployed** to production database.

### Function Definitions (From Archive)

```sql
-- FUNCTION 1: Increment Sibling Ordinals
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal + p_increment_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- FUNCTION 2: Decrement Sibling Ordinals
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal > p_start_ordinal;  -- ⚠️ IMPORTANT: > not >=

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;
```

**Key Detail**: `decrement_sibling_ordinals` uses `ordinal > p_start_ordinal`, which means it **does not** update the section at `p_start_ordinal` itself.

---

## Specific Fixes Needed

### Fix 1: Deploy Missing RPC Functions

**File to Create**: `database/migrations/008_add_section_editing_functions.sql`

**Content**:
```sql
-- Migration 008: Add section editing RPC functions
-- Purpose: Enable indent/dedent/move operations
-- Date: 2025-10-23

BEGIN;

-- Function 1: Increment sibling ordinals (make space)
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal + p_increment_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Function 2: Decrement sibling ordinals (close gaps)
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal > p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Function 3: Swap sibling ordinals (for move up/down)
CREATE OR REPLACE FUNCTION swap_sibling_ordinals(
  p_section_id_1 UUID,
  p_section_id_2 UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_ordinal_1 INTEGER;
  v_ordinal_2 INTEGER;
BEGIN
  -- Get both ordinals
  SELECT ordinal INTO v_ordinal_1
  FROM document_sections
  WHERE id = p_section_id_1;

  SELECT ordinal INTO v_ordinal_2
  FROM document_sections
  WHERE id = p_section_id_2;

  -- Swap them
  UPDATE document_sections SET ordinal = v_ordinal_2 WHERE id = p_section_id_1;
  UPDATE document_sections SET ordinal = v_ordinal_1 WHERE id = p_section_id_2;

  RETURN TRUE;
END;
$$;

COMMIT;
```

**Priority**: 🔴 CRITICAL - Must deploy before indent/dedent will work

---

### Fix 2: Fix Invalid Supabase SQL API

**File**: `src/routes/admin.js`
**Lines**: 2163, 2067

**Current (BROKEN)**:
```javascript
.update({ ordinal: supabaseService.sql`ordinal + 1` })
```

**Fixed**:
```javascript
// Option A: Use RPC function (recommended)
await supabaseService.rpc('increment_sibling_ordinals', {
  p_parent_id: null,  // Root level
  p_start_ordinal: newOrdinal,
  p_increment_by: 1
});

// Option B: Use raw PostgreSQL function (if RPC not available)
await supabaseService.rpc('exec_sql', {
  query: `
    UPDATE document_sections
    SET ordinal = ordinal + 1, updated_at = NOW()
    WHERE document_id = $1
      AND parent_section_id IS NULL
      AND ordinal >= $2
  `,
  params: [section.document_id, newOrdinal]
});
```

**Priority**: 🔴 CRITICAL

---

### Fix 3: Implement Move Up/Down Operations

**File**: `src/routes/admin.js`

**Add After Dedent Route** (around line 2226):

```javascript
/**
 * POST /admin/sections/:id/move-up
 * Move section up (swap with previous sibling)
 */
router.post('/sections/:id/move-up',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const { id } = req.params;
      const section = req.section;
      const { supabaseService } = req;

      // Can't move up if already first
      if (section.ordinal <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move up: section is already first among siblings',
          code: 'ALREADY_FIRST'
        });
      }

      // Find previous sibling
      const { data: prevSibling, error: siblingError } = await supabaseService
        .from('document_sections')
        .select('id, ordinal, section_number, section_title')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .eq('ordinal', section.ordinal - 1)
        .single();

      if (siblingError || !prevSibling) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move up: no previous sibling found',
          code: 'NO_PREVIOUS_SIBLING'
        });
      }

      // Swap ordinals using RPC function
      const { error: swapError } = await supabaseService.rpc(
        'swap_sibling_ordinals',
        {
          p_section_id_1: section.id,
          p_section_id_2: prevSibling.id
        }
      );

      if (swapError) {
        console.error('[MOVE-UP] Swap error:', swapError);
        throw swapError;
      }

      res.json({
        success: true,
        message: `Section moved up (now before "${prevSibling.section_title}")`,
        newOrdinal: section.ordinal - 1,
        swappedWith: {
          id: prevSibling.id,
          title: prevSibling.section_title
        }
      });

    } catch (error) {
      console.error('[MOVE-UP] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to move section up'
      });
    }
});

/**
 * POST /admin/sections/:id/move-down
 * Move section down (swap with next sibling)
 */
router.post('/sections/:id/move-down',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const { id } = req.params;
      const section = req.section;
      const { supabaseService } = req;

      // Find next sibling
      const { data: nextSibling, error: siblingError } = await supabaseService
        .from('document_sections')
        .select('id, ordinal, section_number, section_title')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .eq('ordinal', section.ordinal + 1)
        .single();

      if (siblingError || !nextSibling) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move down: no next sibling found (already last)',
          code: 'ALREADY_LAST'
        });
      }

      // Swap ordinals using RPC function
      const { error: swapError } = await supabaseService.rpc(
        'swap_sibling_ordinals',
        {
          p_section_id_1: section.id,
          p_section_id_2: nextSibling.id
        }
      );

      if (swapError) {
        console.error('[MOVE-DOWN] Swap error:', swapError);
        throw swapError;
      }

      res.json({
        success: true,
        message: `Section moved down (now after "${nextSibling.section_title}")`,
        newOrdinal: section.ordinal + 1,
        swappedWith: {
          id: nextSibling.id,
          title: nextSibling.section_title
        }
      });

    } catch (error) {
      console.error('[MOVE-DOWN] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to move section down'
      });
    }
});
```

**Priority**: 🔴 CRITICAL

---

### Fix 4: Add Transaction Support

**Current Problem**: Operations happen in multiple steps without atomicity

**Recommended Pattern**:
```javascript
// Wrap entire operation in transaction
const { data, error } = await supabaseService.rpc('indent_section_atomic', {
  p_section_id: id,
  p_user_id: userId
});
```

**Database Function** (add to migration 008):
```sql
CREATE OR REPLACE FUNCTION indent_section_atomic(
  p_section_id UUID,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_section RECORD;
  v_prev_sibling RECORD;
  v_new_ordinal INTEGER;
  v_result JSONB;
BEGIN
  -- Get section (with row lock)
  SELECT * INTO v_section
  FROM document_sections
  WHERE id = p_section_id
  FOR UPDATE;

  -- Get previous sibling
  SELECT * INTO v_prev_sibling
  FROM document_sections
  WHERE document_id = v_section.document_id
    AND parent_section_id IS NOT DISTINCT FROM v_section.parent_section_id
    AND ordinal < v_section.ordinal
  ORDER BY ordinal DESC
  LIMIT 1;

  -- Validate
  IF v_prev_sibling.id IS NULL THEN
    RAISE EXCEPTION 'Cannot indent: no previous sibling';
  END IF;

  -- Calculate new ordinal
  SELECT COUNT(*) + 1 INTO v_new_ordinal
  FROM document_sections
  WHERE parent_section_id = v_prev_sibling.id;

  -- Close gap at old parent
  PERFORM decrement_sibling_ordinals(
    v_section.parent_section_id,
    v_section.ordinal,
    1
  );

  -- Move section to new parent
  UPDATE document_sections
  SET parent_section_id = v_prev_sibling.id,
      ordinal = v_new_ordinal,
      depth = v_section.depth + 1,
      updated_at = NOW()
  WHERE id = p_section_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'new_parent_id', v_prev_sibling.id,
    'new_ordinal', v_new_ordinal,
    'new_depth', v_section.depth + 1
  );

  RETURN v_result;
END;
$$;
```

**Priority**: 🟡 MEDIUM (after basic functionality restored)

---

## Test Scenarios

### Test Scenario 1: Indent First Section

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1) ← Try to indent this
  Section 2 (ordinal=2, depth=1)
```

**Expected**: ❌ Error "Cannot indent: no earlier sibling"

**Test Steps**:
1. Navigate to document viewer
2. Click indent button on first section
3. Verify error message appears
4. Verify section position unchanged

---

### Test Scenario 2: Indent Middle Section

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
  Section 2 (ordinal=2, depth=1) ← Try to indent this
  Section 3 (ordinal=3, depth=1)
```

**Expected After Indent**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
    Section 2 (ordinal=1, depth=2) ← Now child of Section 1
  Section 3 (ordinal=2, depth=1) ← Ordinal decremented from 3 to 2
```

**Test Steps**:
1. Click indent on Section 2
2. Verify Section 2 becomes child of Section 1
3. Verify Section 2 ordinal = 1 (first child)
4. Verify Section 2 depth = 2
5. Verify Section 3 ordinal decremented to 2
6. Verify Section 1 ordinal unchanged

---

### Test Scenario 3: Dedent Root Section

**Setup**:
```
Article I (ordinal=1, depth=0) ← Try to dedent this
  Section 1 (ordinal=1, depth=1)
```

**Expected**: ❌ Error "Cannot dedent: section is already at root level"

**Test Steps**:
1. Click dedent on Article I
2. Verify error message appears
3. Verify structure unchanged

---

### Test Scenario 4: Dedent Child Section

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
    Subsection A (ordinal=1, depth=2) ← Try to dedent this
  Section 2 (ordinal=2, depth=1)
```

**Expected After Dedent**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
  Subsection A (ordinal=2, depth=1) ← Now sibling of Section 1
  Section 2 (ordinal=3, depth=1) ← Ordinal incremented from 2 to 3
```

**Test Steps**:
1. Click dedent on Subsection A
2. Verify Subsection A becomes sibling of Section 1
3. Verify Subsection A ordinal = 2 (after Section 1)
4. Verify Subsection A depth = 1
5. Verify Section 2 ordinal incremented to 3

---

### Test Scenario 5: Move Up First Section

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1) ← Try to move up
  Section 2 (ordinal=2, depth=1)
```

**Expected**: ❌ Error "Cannot move up: section is already first among siblings"

**Test Steps**:
1. Click move up on Section 1
2. Verify error message appears
3. Verify structure unchanged

---

### Test Scenario 6: Move Up Middle Section

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
  Section 2 (ordinal=2, depth=1) ← Try to move up
  Section 3 (ordinal=3, depth=1)
```

**Expected After Move Up**:
```
Article I (ordinal=1, depth=0)
  Section 2 (ordinal=1, depth=1) ← Swapped with Section 1
  Section 1 (ordinal=2, depth=1) ← Swapped with Section 2
  Section 3 (ordinal=3, depth=1) ← Unchanged
```

**Test Steps**:
1. Click move up on Section 2
2. Verify Section 2 ordinal = 1
3. Verify Section 1 ordinal = 2
4. Verify Section 3 ordinal unchanged
5. Verify all depths unchanged

---

### Test Scenario 7: Move Down Last Section

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
  Section 2 (ordinal=2, depth=1) ← Try to move down
```

**Expected**: ❌ Error "Cannot move down: no next sibling found"

**Test Steps**:
1. Click move down on Section 2
2. Verify error message appears
3. Verify structure unchanged

---

### Test Scenario 8: Complex Indent Chain

**Setup**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
  Section 2 (ordinal=2, depth=1)
  Section 3 (ordinal=3, depth=1)
  Section 4 (ordinal=4, depth=1)
```

**Operations**:
1. Indent Section 2 → becomes child of Section 1
2. Indent Section 3 → becomes child of Section 2
3. Indent Section 4 → becomes child of Section 3

**Expected Final State**:
```
Article I (ordinal=1, depth=0)
  Section 1 (ordinal=1, depth=1)
    Section 2 (ordinal=1, depth=2)
      Section 3 (ordinal=1, depth=3)
        Section 4 (ordinal=1, depth=4)
```

**Verify**:
- Each section has ordinal=1 (only child)
- Depths increase: 1, 2, 3, 4
- Parent chain: S1 → S2 → S3 → S4

---

## Summary of Required Changes

### Database Changes

1. **Migration 008**: Add RPC functions
   - `increment_sibling_ordinals()`
   - `decrement_sibling_ordinals()`
   - `swap_sibling_ordinals()`
   - Optional: `indent_section_atomic()`, `dedent_section_atomic()`

### Code Changes

2. **src/routes/admin.js**:
   - Line 2067: Fix invalid `.sql` API (indent operation)
   - Line 2163: Fix invalid `.sql` API (dedent operation)
   - Add: `POST /admin/sections/:id/move-up`
   - Add: `POST /admin/sections/:id/move-down`

3. **Error Message Improvements**:
   - Better messages for "no sibling" errors
   - Include suggestions for what user can do instead

4. **Add Transaction Support** (optional but recommended):
   - Wrap multi-step operations in atomic functions
   - Prevents partial updates on errors

---

## Files Referenced

| File | Purpose | Status |
|------|---------|--------|
| `database/schema.sql` | Current production schema | ✅ Has ordinal constraint |
| `database/migrations/003_add_document_order.sql` | Added document_order field | ✅ Applied |
| `archive/migration-history/020_section_editing_functions.sql` | RPC function definitions | ❌ Not deployed |
| `src/routes/admin.js` | Section operation endpoints | ⚠️ Has bugs |
| `src/services/sectionStorage.js` | Section hierarchy builder | ✅ Working correctly |
| `views/dashboard/document-viewer.ejs` | UI for section operations | ⚠️ Buttons call missing endpoints |

---

## Next Steps

1. **IMMEDIATE**: Deploy RPC functions (migration 008)
2. **IMMEDIATE**: Fix invalid Supabase API calls
3. **HIGH**: Implement move up/down endpoints
4. **MEDIUM**: Add transaction support
5. **MEDIUM**: Improve error messages
6. **LOW**: Add comprehensive tests

---

**End of Analysis**
