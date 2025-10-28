# Path IDs Constraint Quick Reference

## The Constraint

```sql
CHECK(array_length(path_ids, 1) = depth + 1)
```

## How It Should Work

| Depth | Path IDs Example | Array Length | Constraint Check |
|-------|------------------|--------------|------------------|
| 0 | `[uuid1]` | 1 | `1 = 0 + 1` ✓ |
| 1 | `[uuid1, uuid2]` | 2 | `2 = 1 + 1` ✓ |
| 2 | `[uuid1, uuid2, uuid3]` | 3 | `3 = 2 + 1` ✓ |
| 3 | `[uuid1, uuid2, uuid3, uuid4]` | 4 | `4 = 3 + 1` ✓ |

**Pattern**: `path_ids = [root_id, parent_id, grandparent_id, ..., self_id]`

## Current Problem

**Two-Phase Insert Fails**:

```javascript
// Phase 1: Insert with null parent
INSERT INTO document_sections (
  depth = 1,              // Parser says depth 1
  parent_section_id = null,  // No parent yet!
  ...
)
// Trigger sets: path_ids = [id] (1 element)
// Constraint check: 1 ≠ 1 + 1  ❌ VIOLATION
```

**Why**: Constraint enforced IMMEDIATELY at INSERT, before we can set parent_section_id.

## Solution: Hybrid Approach

### 1. Make Constraint Deferrable

```sql
-- Migration 026
ALTER TABLE document_sections
  ADD CONSTRAINT document_sections_path_length_check
  CHECK(array_length(path_ids, 1) = depth + 1)
  DEFERRABLE INITIALLY DEFERRED;
```

**Effect**: Constraint checked at transaction commit, not immediately.

### 2. Hierarchical Insert with ID Tracking

```javascript
// Sort by depth
const sorted = sections.sort((a, b) => a.depth - b.depth);

// Track UUID mappings
const idMap = new Map(); // tempId → realUUID

// Insert depth by depth
for (let depth = 0; depth <= maxDepth; depth++) {
  const depthSections = sorted.filter(s => s.depth === depth);

  // Resolve parent_section_id BEFORE insert
  depthSections.forEach(s => {
    if (s.parent_temp_id !== null) {
      s.parent_section_id = idMap.get(s.parent_temp_id);
    }
  });

  // Insert batch
  const { data } = await supabase.from('document_sections').insert(depthSections);

  // Update ID map
  data.forEach((inserted, idx) => {
    idMap.set(depthSections[idx].tempId, inserted.id);
  });
}
```

**Effect**: Parents exist before children inserted, trigger works correctly.

## Implementation Checklist

- [ ] Apply migration 026 (defer constraint)
- [ ] Refactor `sectionStorage.js` storeSections()
  - [ ] Sort sections by depth
  - [ ] Add UUID tracking with idMap
  - [ ] Resolve parent_section_id BEFORE insert
  - [ ] Insert depth-by-depth
- [ ] Remove `updateParentRelationships()` call (obsolete)
- [ ] Test upload
- [ ] Verify: `SELECT id, depth, array_length(path_ids, 1) FROM document_sections;`

## Expected Result

All sections should have:
```sql
array_length(path_ids, 1) = depth + 1
```

No constraint violations during insert!

---

**Full Analysis**: See `docs/research/PATH_IDS_CONSTRAINT_ANALYSIS.md`
