# Section Operations - Quick Fix Guide

**Status**: 🔴 BROKEN - Indent, dedent, move operations not working
**Estimated Fix Time**: 2-3 hours
**Priority**: CRITICAL

---

## The Problem (In 30 Seconds)

1. ❌ Database missing 3 RPC functions
2. ❌ Code uses invalid Supabase API (`supabaseService.sql`)
3. ❌ Move up/down endpoints don't exist

**Result**: All section operations fail with constraint violations or "function not found" errors.

---

## Quick Fix Checklist

### Step 1: Deploy RPC Functions (15 min)

**Create**: `database/migrations/008_add_section_editing_functions.sql`

```sql
BEGIN;

-- Function 1: Make space for new sections
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_updated_count INTEGER;
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal + p_increment_by, updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Function 2: Close gaps after deletion
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_updated_count INTEGER;
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by, updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal > p_start_ordinal;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- Function 3: Swap ordinals for move up/down
CREATE OR REPLACE FUNCTION swap_sibling_ordinals(
  p_section_id_1 UUID,
  p_section_id_2 UUID
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_ordinal_1 INTEGER;
  v_ordinal_2 INTEGER;
BEGIN
  SELECT ordinal INTO v_ordinal_1 FROM document_sections WHERE id = p_section_id_1;
  SELECT ordinal INTO v_ordinal_2 FROM document_sections WHERE id = p_section_id_2;
  UPDATE document_sections SET ordinal = v_ordinal_2 WHERE id = p_section_id_1;
  UPDATE document_sections SET ordinal = v_ordinal_1 WHERE id = p_section_id_2;
  RETURN TRUE;
END;
$$;

COMMIT;
```

**Deploy**:
```bash
psql $DATABASE_URL -f database/migrations/008_add_section_editing_functions.sql
```

---

### Step 2: Fix Invalid API Calls (5 min)

**File**: `src/routes/admin.js`

**Line 2067** (indent operation):
```javascript
// ❌ BROKEN
.update({ ordinal: supabaseService.sql`ordinal - 1` })

// ✅ FIXED
// Delete this entire block (lines 2064-2075) - RPC function handles it
```

**Line 2163** (dedent operation):
```javascript
// ❌ BROKEN
.update({ ordinal: supabaseService.sql`ordinal + 1` })

// ✅ FIXED
// Delete this entire block (lines 2160-2172) - RPC function handles it
```

---

### Step 3: Add Move Up/Down Endpoints (30 min)

**File**: `src/routes/admin.js`

**Add after line 2226** (after dedent route):

```javascript
/**
 * POST /admin/sections/:id/move-up
 */
router.post('/sections/:id/move-up',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const section = req.section;
      const { supabaseService } = req;

      if (section.ordinal <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move up: section is already first',
          code: 'ALREADY_FIRST'
        });
      }

      const { data: prevSibling } = await supabaseService
        .from('document_sections')
        .select('id, section_title')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .eq('ordinal', section.ordinal - 1)
        .single();

      if (!prevSibling) {
        return res.status(400).json({
          success: false,
          error: 'No previous sibling found'
        });
      }

      await supabaseService.rpc('swap_sibling_ordinals', {
        p_section_id_1: section.id,
        p_section_id_2: prevSibling.id
      });

      res.json({
        success: true,
        message: `Moved up (now before "${prevSibling.section_title}")`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
});

/**
 * POST /admin/sections/:id/move-down
 */
router.post('/sections/:id/move-down',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const section = req.section;
      const { supabaseService } = req;

      const { data: nextSibling } = await supabaseService
        .from('document_sections')
        .select('id, section_title')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .eq('ordinal', section.ordinal + 1)
        .single();

      if (!nextSibling) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move down: section is already last',
          code: 'ALREADY_LAST'
        });
      }

      await supabaseService.rpc('swap_sibling_ordinals', {
        p_section_id_1: section.id,
        p_section_id_2: nextSibling.id
      });

      res.json({
        success: true,
        message: `Moved down (now after "${nextSibling.section_title}")`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
});
```

---

### Step 4: Verify UI Connections (5 min)

**File**: `views/dashboard/document-viewer.ejs`

Check that these functions exist (around lines 2104-2160):
- ✅ `indentSection(sectionId, event)`
- ✅ `dedentSection(sectionId, event)`
- ❓ Check if move up/down buttons call endpoints

If move buttons don't exist, add them to the section action buttons.

---

## Testing the Fix

### Test 1: Indent Operation
```bash
# Setup: Create document with 3 sections at same level
# Test: Indent middle section
# Expected: Section becomes child of previous sibling
```

### Test 2: Dedent Operation
```bash
# Setup: Create nested structure (parent with child)
# Test: Dedent child section
# Expected: Child becomes sibling of parent
```

### Test 3: Move Up/Down
```bash
# Setup: Create 3 sections at same level
# Test: Move middle section up
# Expected: Middle and first swap positions
```

---

## Rollback Plan

If fixes cause issues:

```sql
-- Rollback Step 1: Remove functions
BEGIN;
DROP FUNCTION IF EXISTS increment_sibling_ordinals;
DROP FUNCTION IF EXISTS decrement_sibling_ordinals;
DROP FUNCTION IF EXISTS swap_sibling_ordinals;
COMMIT;
```

```bash
# Rollback Step 2: Git revert code changes
git checkout src/routes/admin.js
```

---

## Root Cause

**What Happened**:
1. RPC functions designed in `archive/migration-history/020_section_editing_functions.sql`
2. Never deployed to production database
3. Code written expecting these functions to exist
4. Schema changed (added `document_order`), causing confusion

**Why It Matters**:
- Ordinals must be 1-based (constraint: `CHECK (ordinal > 0)`)
- Gap-closing requires atomic updates (RPC functions)
- Without functions, operations leave gaps or create duplicates

---

## Full Documentation

See `docs/analysis/SECTION_OPERATIONS_BUG_ANALYSIS.md` for:
- Complete technical analysis
- All test scenarios
- Detailed code explanations
- Transaction support recommendations

---

**Need Help?**

1. Check migration 008 deployed: `psql -c "\df increment_sibling_ordinals"`
2. Check routes exist: `grep -n "move-up\|move-down" src/routes/admin.js`
3. Check for errors: `tail -f logs/server.log`
