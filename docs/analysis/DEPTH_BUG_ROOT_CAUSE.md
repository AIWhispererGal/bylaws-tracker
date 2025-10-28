# DEPTH BUG ROOT CAUSE ANALYSIS
**Analyst Agent Report**
**Date**: 2025-10-27
**Critical Bug**: All sections have `depth=0` in database

---

## EXECUTIVE SUMMARY

**BUG CONFIRMED**: All 173 sections in `document_sections` table have `depth=0`, even though parsers calculate correct depth values (0, 1, 2, 3, 4).

**ROOT CAUSE**: Database trigger `update_section_path()` is **OVERWRITING** the depth value that parsers provide.

---

## EVIDENCE

### 1. Database Data Confirms Bug
```
"depth":0,"section_type":"preamble"     ✓ CORRECT (preamble is depth 0)
"depth":0,"section_type":"article"      ✓ CORRECT (articles are depth 0)
"depth":0,"section_type":"section"      ✗ WRONG (sections should be depth 1)
"depth":0,"section_type":"subparagraph" ✗ WRONG (subparagraphs should be depth 3+)
```

**All 173 sections have depth=0**, regardless of their type.

### 2. Parser Sends Correct Depth Values

**File**: `/src/services/sectionStorage.js`
**Line**: 33

```javascript
depth: section.depth,  // ✓ Parser provides correct depth (0, 1, 2, 3, 4)
```

The `storeSections()` function at line 26-50 correctly maps `depth` from the parsed sections:

```javascript
const dbSections = hierarchicalSections.map((section, index) => {
  return {
    document_id: documentId,
    parent_section_id: section.parent_id,
    ordinal: section.ordinal,
    document_order: index + 1,
    depth: section.depth,  // ← CORRECT DEPTH FROM PARSER
    section_number: section.section_number,
    // ...
  };
});
```

**Parser depth values are correct** based on:
- `textParser.js` lines 689-726: Context-aware depth calculation
- `hierarchyDetector.js` line 36: Depth from hierarchy config
- `sectionStorage.js` lines 161-166: buildHierarchy assigns depth

### 3. Database Trigger Overwrites Depth

**File**: `/database/migrations/001_generalized_schema.sql`
**Lines**: 207-243

```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;  -- ← BUG: ALWAYS SETS DEPTH TO 0 FOR ROOT
  ELSE
    -- Child section: inherit parent's path and append self
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1  -- ← CALCULATES DEPTH FROM PARENT
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**THE PROBLEM**:
1. **Trigger runs BEFORE INSERT** (line 239: `BEFORE INSERT OR UPDATE`)
2. **Trigger overwrites `NEW.depth`** with its own calculation
3. **BUT parent_section_id is NULL for all sections** (not set until AFTER insert)
4. **Result**: All sections hit the `IF NULL` branch → `depth := 0`

### 4. Why parent_section_id is NULL

**File**: `/src/services/sectionStorage.js`
**Lines**: 214-304

The `updateParentRelationships()` function runs **AFTER** the initial insert:

```javascript
// Line 62-73: INSERT happens FIRST (parent_section_id is null)
const { data, error } = await supabase
  .from('document_sections')
  .insert(batch)
  .select();

// Line 80: Update parents AFTER insert
const parentUpdateResult = await this.updateParentRelationships(documentId, supabase);
```

**The sequence**:
1. **INSERT** with `parent_section_id: section.parent_id` (temp ID, not real UUID)
2. **Trigger sees NULL** parent_section_id → sets `depth := 0`
3. **UPDATE** parent_section_id with real UUIDs (but trigger doesn't recalculate depth)

---

## ROOT CAUSE

**The database trigger `update_section_path()` is incompatible with the two-phase insert strategy.**

**Phase 1**: Insert sections with temporary parent references
**Phase 2**: Update parent_section_id with real UUIDs

**Bug**: Trigger calculates depth in Phase 1 when parents don't exist yet, resulting in all sections being depth=0.

---

## FIX OPTIONS

### Option A: Disable Trigger's Depth Calculation (RECOMMENDED)

**Change trigger to trust the depth value from the application:**

```sql
-- Remove these lines from trigger:
NEW.depth := 0;  -- Line 214
p.depth + 1      -- Line 221

-- Let application-provided depth pass through unchanged
-- Only calculate path_ids and path_ordinals in trigger
```

**Pros**:
- Parsers already calculate correct depth
- No breaking changes to application code
- Trigger still maintains path arrays

**Cons**:
- Database loses automated depth calculation

### Option B: Use Real Parent UUIDs on Insert

**Change application to resolve parent UUIDs before insert:**

```javascript
// Build section-to-UUID map
const sectionMap = new Map();

// First pass: Insert root sections
// Second pass: Insert children with real parent UUIDs
```

**Pros**:
- Trigger works as designed
- Database maintains depth automatically

**Cons**:
- Requires significant refactoring of sectionStorage.js
- Multiple database round-trips

### Option C: Update Depth After Parent Assignment

**Add depth recalculation after updateParentRelationships():**

```javascript
// After line 80-88 in sectionStorage.js
await this.recalculateDepths(documentId, supabase);
```

**Pros**:
- Minimal code changes
- Leverages existing trigger logic

**Cons**:
- Extra database queries
- Redundant with parser logic

---

## RECOMMENDED FIX

**Option A: Trust Application Depth**

**Modify trigger**:
```sql
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section - use application-provided depth
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    -- NEW.depth := 0;  ← REMOVE THIS LINE
  ELSE
    -- Child section - use application-provided depth
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal
      -- p.depth + 1  ← REMOVE THIS, don't override depth
    INTO NEW.path_ids, NEW.path_ordinals
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Result**:
- Parsers continue to calculate correct depth
- Trigger maintains path arrays only
- No application code changes needed

---

## IMPACT ASSESSMENT

**Affected Components**:
1. All document uploads (depth always 0)
2. Hierarchy display (appears flat)
3. Section navigation (broken tree structure)
4. Search/filter by depth (returns wrong results)

**Severity**: **CRITICAL** - Core hierarchy functionality broken

---

## TESTING PLAN

1. Apply trigger fix
2. Re-upload test document
3. Query: `SELECT DISTINCT depth, section_type FROM document_sections`
4. Verify depth distribution: 0 (articles), 1 (sections), 2+ (subsections)

---

## CONCLUSION

**Bug Location**: `/database/migrations/001_generalized_schema.sql` lines 214, 221
**Fix**: Remove depth assignment from trigger, trust application values
**Effort**: 5 minutes (SQL change)
**Risk**: Low (parsers already work correctly)

**READY FOR CODER AGENT TO IMPLEMENT FIX**
