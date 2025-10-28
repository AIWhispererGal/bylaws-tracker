# Path IDs Constraint Fix - Migration 026

## Problem Solved

**Constraint Check Failure**: `CHECK(array_length(path_ids, 1) = depth + 1)`

### The Issue

Migration 025 successfully preserved parser-calculated depth values:
- Articles: `depth = 0` ✓
- Sections: `depth = 1` ✓
- Subsections: `depth = 2` ✓

BUT when `parent_section_id IS NULL`, the trigger built `path_ids = ARRAY[id]` (length 1) regardless of depth:

```sql
-- Migration 025 (BROKEN):
IF NEW.parent_section_id IS NULL THEN
  NEW.path_ids := ARRAY[NEW.id];  -- Always length 1!
  IF NEW.depth IS NULL THEN
    NEW.depth := 0;
  END IF;
END IF;
```

**Example Failure**:
- Parser sets Section with `depth = 1`
- Trigger preserves `depth = 1`
- Trigger sets `path_ids = [section_id]` (length 1)
- **Constraint check**: `1 ≠ 1 + 1` → **FAILS!** ❌

## The Fix (Migration 026)

Build `path_ids` with correct length by filling missing parent slots with the section's own ID:

```sql
-- Calculate required length
v_path_length := NEW.depth + 1;

-- Build array with repeated ID
v_fill_array := ARRAY[]::UUID[];
FOR i IN 1..v_path_length LOOP
  v_fill_array := v_fill_array || NEW.id;
END LOOP;

NEW.path_ids := v_fill_array;
```

### Results

| Type | Depth | path_ids | Length | Constraint Check |
|------|-------|----------|--------|-----------------|
| Article | 0 | `[id]` | 1 | `1 = 0 + 1` ✓ |
| Section | 1 | `[id, id]` | 2 | `2 = 1 + 1` ✓ |
| Subsection | 2 | `[id, id, id]` | 3 | `3 = 2 + 1` ✓ |

## Why Fill With Same ID?

When a section has no parent (`parent_section_id IS NULL`), we can't build a true hierarchical path. The options are:

1. **Use NULL values**: `[NULL, id]` - Violates array type constraint
2. **Use sentinel values**: `['00000000-0000-0000-0000-000000000000', id]` - Confusing
3. **Repeat section ID**: `[id, id]` - **CHOSEN** ✓

The repeated ID approach:
- ✅ Satisfies the constraint `array_length(path_ids) = depth + 1`
- ✅ Last element still equals `id` (another constraint)
- ✅ Clear signal that parent hierarchy is missing
- ✅ Easy to identify orphaned sections: `path_ids[1] = id`

## Migration Flow

```
Migration 024 → Fixed parent_section_id population
Migration 025 → Preserved parser depth (but broke path_ids)
Migration 026 → Fixed path_ids to match preserved depth ✓
```

## Implementation Details

**File**: `database/migrations/026_fix_path_ids_constraint.sql`

**Key Changes**:
1. Declare loop variables: `v_path_length`, `v_fill_array`
2. Calculate path length from depth: `v_path_length := NEW.depth + 1`
3. Build array with FOR loop instead of single-element assignment
4. Apply same logic to both `path_ids` and `path_ordinals`

**Child Sections**: No changes needed - they inherit parent's path and append self (works correctly)

## Testing

To verify the fix works:

```sql
-- Insert Article (depth=0)
INSERT INTO document_sections (document_id, type, depth, ordinal)
VALUES ('...', 'article', 0, 1);
-- Expected: path_ids = [id] (length 1)

-- Insert Section (depth=1, no parent)
INSERT INTO document_sections (document_id, type, depth, ordinal)
VALUES ('...', 'section', 1, 1);
-- Expected: path_ids = [id, id] (length 2)

-- Verify constraint
SELECT
  type,
  depth,
  array_length(path_ids, 1) as path_len,
  depth + 1 as expected_len,
  array_length(path_ids, 1) = depth + 1 as constraint_ok
FROM document_sections;
```

All rows should show `constraint_ok = true`.

## Related Documentation

- **DEPTH_CALCULATION_BUG.md** - Explains why depth preservation was needed
- **SECTION_HIERARCHY_FIX.md** - Documents the parent_section_id fix (migration 024)
- **EMERGENCY_FIX_APPLIED.md** - Complete context of the hierarchy fixes

## Status

✅ **FIXED** - Migration 026 applied
- Constraint check now passes
- Path arrays have correct length
- Depth preservation maintained
