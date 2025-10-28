# Document Sections Constraint Violation Analysis

## Date: 2025-10-27
## Status: CRITICAL BUG IDENTIFIED

## The Constraint

```sql
constraint document_sections_check check ((array_length(path_ids, 1) = (depth + 1)))
```

## The Violation

**What happens during upload:**

1. Parser identifies "Section 1. General Provisions" as `depth = 1`
2. Initial insert has `parent_section_id = NULL` (no parent yet)
3. Trigger builds `path_ids = [section_id]` (1 element array)
4. Constraint check: `array_length([section_id], 1) = 1`
5. Check fails: `1 ≠ (1 + 1)` → **VIOLATION**

## Root Cause

**Semantic Mismatch Between Parser and Database:**

| Component | Root Section Depth | Logic |
|-----------|-------------------|-------|
| Parser (hierarchyDetector.js) | `depth = 1` | First level of document hierarchy |
| Database Trigger | `depth = 0` | No parent = root = depth 0 |

**Migration 025 exposed this:**
- Before: Trigger calculated depth from parent chain (always 0 for NULL parent)
- After: Trigger uses parser's depth value (1 for root sections)
- Trigger still builds `path_ids = [id]` for NULL parent
- **Mismatch: depth=1 but path_ids.length=1**

## Example Violation

```sql
INSERT INTO document_sections (
    document_id, title, section_number, depth, parent_section_id
) VALUES (
    123, 'General Provisions', '1', 1, NULL
);

-- Trigger executes:
NEW.path_ids := ARRAY[NEW.id];  -- [42]
NEW.depth := 1;  -- From parser

-- Constraint checks:
array_length(ARRAY[42], 1) = (1 + 1)
1 = 2  -- FALSE! ❌
```

## Solution Options

### ✅ RECOMMENDED: Option A - Parser Adjustment

**Change:** Modify hierarchyDetector.js to use database depth convention

```javascript
// Current (WRONG):
depth: 1  // Root sections

// Correct:
depth: 0  // Root sections (matches database NULL parent logic)
```

**Impact:**
- Single line change in parser
- Aligns with database convention
- Sections with NULL parent have depth=0
- Their children have depth=1
- Constraint: `[id].length = 1 = (0 + 1)` ✅

**Files to modify:**
- `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/parsers/hierarchyDetector.js`

### Option B - Trigger Adjustment (Complex)

Build `path_ids` to match parser's depth expectation:

```sql
-- If depth=1 but no parent, create 2-element path
IF NEW.parent_section_id IS NULL AND NEW.depth > 0 THEN
    -- Build synthetic path or use special logic
    NEW.path_ids := /* complex handling */;
END IF;
```

**Issues:**
- Requires synthetic root IDs
- More complex trigger logic
- Path hierarchy becomes unclear

### ❌ NOT RECOMMENDED: Option C - Remove Constraint

Removing the constraint loses data integrity validation.

## Implementation Plan

1. **Modify hierarchyDetector.js:**
   - Change root section depth from 1 to 0
   - Adjust child depth calculations accordingly

2. **Verify trigger logic:**
   - Confirm depth=0 produces path_ids=[id]
   - Confirm constraint check passes

3. **Test upload:**
   - Upload sample document
   - Verify no constraint violations
   - Check depth values in database

4. **Update migration if needed:**
   - May need to adjust depth values in existing data
   - Or keep migration 025 as-is (it's correct for trigger)

## Next Steps

**IMMEDIATE:**
1. Analyst stores this analysis in memory ✅
2. Coder spawned to fix hierarchyDetector.js
3. Tester spawned to verify fix

**VERIFICATION:**
1. Upload test document
2. Check document_sections table
3. Verify depth and path_ids align
4. Confirm constraint satisfaction

---

**Analysis stored:** `hive/analyst/constraint-violation`
**Status:** Ready for coder implementation
