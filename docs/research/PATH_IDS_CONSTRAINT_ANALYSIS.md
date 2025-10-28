# Path IDs and Depth Constraint Research Analysis

## Research Mission
Understand how `path_ids` and `depth` should work together and solve the two-phase insert constraint violation problem.

---

## Database Constraint Definition

**Location**: `database/migrations/001_generalized_schema.sql:188`

```sql
CHECK(array_length(path_ids, 1) = depth + 1)
```

This constraint enforces that the path_ids array MUST have exactly `depth + 1` elements.

---

## Design Intent: Path IDs by Depth

### Depth 0 (Root Article)
- **depth**: `0`
- **path_ids**: `[article_id]` (1 element)
- **Constraint**: `array_length([article_id], 1) = 0 + 1` ✓ (1 = 1)
- **Example**: Article I has path `[uuid1]`

### Depth 1 (Section under Article)
- **depth**: `1`
- **path_ids**: `[article_id, section_id]` (2 elements)
- **Constraint**: `array_length([article_id, section_id], 1) = 1 + 1` ✓ (2 = 2)
- **Example**: Section 1.1 has path `[uuid1, uuid2]`

### Depth 2 (Subsection)
- **depth**: `2`
- **path_ids**: `[article_id, section_id, subsection_id]` (3 elements)
- **Constraint**: `array_length([article_id, section_id, subsection_id], 1) = 2 + 1` ✓ (3 = 3)
- **Example**: Section 1.1.1 has path `[uuid1, uuid2, uuid3]`

### General Pattern
```
depth=n → path_ids has (n+1) elements
path_ids = [root, parent1, parent2, ..., self]
```

The last element of `path_ids` is ALWAYS the section's own ID.

---

## Current Trigger Implementation

**File**: `database/migrations/025_fix_depth_trigger.sql`

### For Root Sections (parent_section_id IS NULL)
```sql
NEW.path_ids := ARRAY[NEW.id];
NEW.path_ordinals := ARRAY[NEW.ordinal];

IF NEW.depth IS NULL THEN
  NEW.depth := 0;
END IF;
```

**Problem**: If parser sets `depth=1` but `parent_section_id IS NULL`, we get:
- `path_ids = [id]` (1 element)
- `depth = 1`
- Constraint check: `1 ≠ 1 + 1` ✗ **VIOLATION**

### For Child Sections (parent_section_id IS NOT NULL)
```sql
SELECT
  p.path_ids || NEW.id,
  p.path_ordinals || NEW.ordinal,
  p.depth + 1
INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
FROM document_sections p
WHERE p.id = NEW.parent_section_id;
```

**This works correctly** because it builds path from parent.

---

## Two-Phase Insert Problem

### Current Workflow in sectionStorage.js

**Phase 1: Initial Insert (lines 62-73)**
```javascript
const { data, error } = await supabase
  .from('document_sections')
  .insert(batch)
  .select();
```

At this point:
- `parent_section_id` = `null` (no parent UUIDs exist yet)
- `depth` = parser-calculated value (e.g., 1, 2, 3)
- Trigger fires with `parent_section_id IS NULL` branch
- Sets `path_ids = [NEW.id]` (1 element)
- Keeps `depth` = parser value (e.g., 1)
- **CONSTRAINT VIOLATION**: `1 ≠ 1 + 1`

**Phase 2: Parent Relationship Update (lines 214-304)**
```javascript
const { error: updateError } = await supabase
  .from('document_sections')
  .update({ parent_section_id: update.parent_section_id })
  .eq('id', update.id);
```

This SHOULD trigger the update path, but constraint already failed!

---

## Problem Root Cause

**The constraint is enforced at INSERT time, BEFORE we can set parent_section_id.**

The two-phase approach:
1. Insert with `parent_section_id = null` + `depth = 1` → **FAILS constraint**
2. Update with `parent_section_id = actual_uuid` → Never reached

---

## Solution Options Analysis

### Option A: Build Fake Path with Duplicated IDs ❌

**Idea**: During initial insert, create fake path_ids by duplicating the ID:
```javascript
// For depth=1: path_ids = [id, id]
// For depth=2: path_ids = [id, id, id]
```

**Problems**:
- Violates semantic meaning of path_ids
- Breaks queries that rely on path_ids for ancestry
- Still fails constraint: `CHECK(path_ids[array_length(path_ids, 1)] = id)` ✓ but ancestry is wrong
- **Not viable**

---

### Option B: Defer Constraint Check Until After Parent Update ✓

**Idea**: Make constraint DEFERRABLE so it's checked at transaction commit, not immediately.

**Implementation**:
```sql
ALTER TABLE document_sections
  DROP CONSTRAINT IF EXISTS document_sections_path_length_check;

ALTER TABLE document_sections
  ADD CONSTRAINT document_sections_path_length_check
  CHECK(array_length(path_ids, 1) = depth + 1)
  DEFERRABLE INITIALLY DEFERRED;
```

**How it works**:
1. Insert with `parent_section_id = null`, `depth = 1`, `path_ids = [id]` (1 element)
   - Constraint violation detected but NOT enforced (deferred)
2. Update with `parent_section_id = parent_uuid`
   - Trigger re-fires, sets `path_ids = [parent_id, id]` (2 elements)
   - Now constraint satisfied
3. Transaction commits
   - All constraints checked
   - All pass ✓

**Advantages**:
- Maintains constraint integrity
- No code changes needed
- Works with existing two-phase insert
- Semantically correct

**Considerations**:
- Constraint only checked at transaction end
- Must ensure ALL inserts/updates happen in same transaction
- If transaction rolls back, all changes undone

---

### Option C: Insert in Hierarchical Order (Parents First) ✓✓

**Idea**: Insert sections in depth order so parents exist before children.

**Implementation in sectionStorage.js**:
```javascript
// Sort sections by depth before inserting
const sortedSections = dbSections.sort((a, b) => a.depth - b.depth);

// Insert in batches, but maintain depth order
for (let i = 0; i < sortedSections.length; i += batchSize) {
  const batch = sortedSections.slice(i, i + batchSize);
  // ... insert batch
}

// NO NEED for updateParentRelationships() step!
// Parents already exist when children are inserted
```

**Modified buildHierarchy() to track parent UUIDs**:
```javascript
// Keep map of temp_id → real_uuid
const idMap = new Map();

for (const section of sortedByDepth) {
  const inserted = await insert(section);
  idMap.set(section.tempId, inserted.id);

  // Resolve parent_section_id from map
  if (section.parent_temp_id !== null) {
    section.parent_section_id = idMap.get(section.parent_temp_id);
  }
}
```

**Advantages**:
- Trigger works correctly on first insert
- No constraint deferral needed
- Simpler logic (single-phase insert)
- Better performance (no second UPDATE pass)

**Challenges**:
- Requires tracking ID mappings
- Can't batch as aggressively (must wait for parent batches to complete)
- More complex insertion logic

---

## Recommended Solution: Hybrid Approach

**Combine Option B (deferred constraint) + Option C (hierarchical insert)**

### Migration Strategy

**Step 1: Make Constraint Deferrable**
```sql
-- File: database/migrations/026_defer_path_constraint.sql
ALTER TABLE document_sections
  DROP CONSTRAINT IF EXISTS document_sections_check;

ALTER TABLE document_sections
  ADD CONSTRAINT document_sections_path_length_check
  CHECK(array_length(path_ids, 1) = depth + 1)
  DEFERRABLE INITIALLY DEFERRED;
```

**Step 2: Update sectionStorage.js for Hierarchical Insert**
```javascript
async storeSections(organizationId, documentId, sections, supabase) {
  // Build hierarchy first
  const hierarchicalSections = await this.buildHierarchy(sections);

  // Sort by depth to ensure parents inserted first
  const sortedSections = hierarchicalSections.sort((a, b) => a.depth - b.depth);

  // Transform to DB format
  const dbSections = sortedSections.map(...);

  // Track UUID mappings: tempId → real UUID
  const idMap = new Map();

  // Insert in depth order with batching
  for (let depth = 0; depth <= maxDepth; depth++) {
    const depthSections = dbSections.filter(s => s.depth === depth);

    for (let i = 0; i < depthSections.length; i += batchSize) {
      const batch = depthSections.slice(i, i + batchSize);

      // Resolve parent_section_id from idMap
      batch.forEach(section => {
        if (section.parent_temp_id !== null) {
          section.parent_section_id = idMap.get(section.parent_temp_id);
        }
      });

      // Insert batch
      const { data, error } = await supabase
        .from('document_sections')
        .insert(batch)
        .select();

      // Update ID map
      data.forEach((inserted, idx) => {
        idMap.set(batch[idx].tempId, inserted.id);
      });
    }
  }

  // No updateParentRelationships() needed!
}
```

**Step 3: Remove updateParentRelationships() Call**
- Line 80-88 in sectionStorage.js becomes obsolete
- Trigger handles path_ids correctly on first insert

---

## Path IDs Example Walkthrough

### Document Structure
```
Article I (depth=0)
├─ Section 1.1 (depth=1)
│  ├─ Section 1.1.1 (depth=2)
│  └─ Section 1.1.2 (depth=2)
└─ Section 1.2 (depth=1)
```

### Insertion Order (Depth-First)

**Batch 1 (depth=0)**:
```javascript
Insert: Article I
  - parent_section_id: null
  - depth: 0
  - Trigger sets: path_ids = [uuid_art1]
  - Constraint: 1 = 0 + 1 ✓
  - idMap: {tempId:0 → uuid_art1}
```

**Batch 2 (depth=1)**:
```javascript
Insert: Section 1.1
  - parent_section_id: idMap.get(0) = uuid_art1
  - depth: 1
  - Trigger sets: path_ids = [uuid_art1, uuid_sec11]
  - Constraint: 2 = 1 + 1 ✓
  - idMap: {tempId:1 → uuid_sec11}

Insert: Section 1.2
  - parent_section_id: idMap.get(0) = uuid_art1
  - depth: 1
  - Trigger sets: path_ids = [uuid_art1, uuid_sec12]
  - Constraint: 2 = 1 + 1 ✓
  - idMap: {tempId:2 → uuid_sec12}
```

**Batch 3 (depth=2)**:
```javascript
Insert: Section 1.1.1
  - parent_section_id: idMap.get(1) = uuid_sec11
  - depth: 2
  - Trigger sets: path_ids = [uuid_art1, uuid_sec11, uuid_sec111]
  - Constraint: 3 = 2 + 1 ✓

Insert: Section 1.1.2
  - parent_section_id: idMap.get(1) = uuid_sec11
  - depth: 2
  - Trigger sets: path_ids = [uuid_art1, uuid_sec11, uuid_sec112]
  - Constraint: 3 = 2 + 1 ✓
```

All constraints satisfied! ✓

---

## Summary of Research Findings

### Path IDs Design
- **Purpose**: Materialized path for fast ancestor/descendant queries
- **Structure**: Array from root to self: `[root_id, parent_id, ..., self_id]`
- **Length**: Always `depth + 1` elements
- **Last Element**: Always the section's own ID

### Constraint Enforcement
- **Current**: Enforced immediately at INSERT time
- **Problem**: Two-phase insert violates constraint before parent update
- **Solution**: Defer constraint to transaction commit

### Best Implementation Strategy
1. **Make constraint DEFERRABLE** (allows violation during transaction)
2. **Insert in hierarchical order** (depth 0, then 1, then 2, ...)
3. **Track UUID mappings** (temp ID → real UUID)
4. **Resolve parent_section_id BEFORE insert** (not after)
5. **Remove updateParentRelationships()** (no longer needed)

### Migration Path
1. Apply migration 026: Make constraint deferrable
2. Refactor sectionStorage.js: Hierarchical insert with ID tracking
3. Test with sample document upload
4. Verify path_ids correctness in database

---

## Files Modified

### Database Migrations
- **NEW**: `database/migrations/026_defer_path_constraint.sql`

### Application Code
- **MODIFY**: `src/services/sectionStorage.js`
  - Refactor `storeSections()` for hierarchical insert
  - Add UUID tracking with `idMap`
  - Remove `updateParentRelationships()` call
  - Sort by depth before insertion

### Testing
- **VERIFY**: Upload test document
- **CHECK**: `SELECT id, depth, array_length(path_ids, 1) FROM document_sections;`
- **EXPECT**: All rows satisfy `array_length = depth + 1`

---

## Research Complete

**Next Steps**: Hand off to Coder agent for implementation.

**Storage**: Storing research findings in coordination memory.
