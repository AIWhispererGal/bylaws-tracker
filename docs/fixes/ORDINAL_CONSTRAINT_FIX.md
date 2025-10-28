# 🔧 Ordinal Constraint Violation Fix

**Date:** October 27, 2025
**Status:** ✅ FIXED
**Error:** `new row for relation "document_sections" violates check constraint "document_sections_ordinal_check"`

---

## 🐛 THE BUG

When using the new "Move Section" feature, users encountered a constraint violation error.

**Error Message:**
```
new row for relation "document_sections" violates check constraint "document_sections_ordinal_check"
```

**Root Cause:** The ordinal calculation logic was setting ordinal to 0 when moving a section to a parent with no existing children.

---

## 🔍 TECHNICAL ANALYSIS

### The Constraint
Database constraint: `ordinal >= 1` (ordinals are 1-indexed, not 0-indexed)

### The Bug (BEFORE)

**File:** `src/routes/admin.js:1475-1492`

```javascript
// BEFORE (BROKEN):
const targetOrdinal = newOrdinal !== undefined ? newOrdinal : 1; // Default to first position

const { data: siblingsCount, error: countError } = await supabaseService
  .rpc('get_siblings_count', {
    p_parent_id: targetParentId,
    p_document_id: section.document_id
  });

// Bug is here:
const maxOrdinal = siblingsCount || 0;
const finalOrdinal = Math.min(targetOrdinal, maxOrdinal);
```

**Problem:**
- If parent has 0 children: `siblingsCount = 0`
- `maxOrdinal = 0`
- `targetOrdinal = 1` (default)
- `Math.min(1, 0) = 0` ❌
- Setting ordinal to 0 violates constraint!

### The Fix (AFTER)

```javascript
// AFTER (FIXED):
// 1. Get siblings count at target parent
const { data: siblingsCount, error: countError } = await supabaseService
  .rpc('get_siblings_count', {
    p_parent_id: targetParentId,
    p_document_id: section.document_id
  });

if (countError) throw countError;

// 2. Calculate final ordinal
// FIX: If user doesn't specify ordinal, append at end (siblingsCount + 1)
// If user specifies ordinal, clamp between 1 and siblingsCount + 1
let finalOrdinal;
if (newOrdinal !== undefined) {
  // User specified position - clamp to valid range [1, siblingsCount + 1]
  finalOrdinal = Math.max(1, Math.min(parseInt(newOrdinal), siblingsCount + 1));
} else {
  // User didn't specify - append at end
  finalOrdinal = siblingsCount + 1;
}
```

**Solution:**
- If user **doesn't specify** ordinal: `finalOrdinal = siblingsCount + 1`
- If user **specifies** ordinal: Clamp to `[1, siblingsCount + 1]`

---

## 📊 EXAMPLES

### Scenario 1: Move to Empty Parent (0 Children)

**BEFORE (BROKEN):**
- `siblingsCount = 0`
- `targetOrdinal = 1`
- `finalOrdinal = Math.min(1, 0) = 0` ❌ Constraint violation!

**AFTER (FIXED):**
- `siblingsCount = 0`
- `newOrdinal = undefined` (user left blank)
- `finalOrdinal = siblingsCount + 1 = 1` ✅ Valid!

### Scenario 2: Move to Parent with 5 Children

**BEFORE (BROKEN):**
- `siblingsCount = 5`
- `targetOrdinal = 1`
- `finalOrdinal = Math.min(1, 5) = 1` ✅ Valid, but inserts at beginning (not appending)

**AFTER (FIXED):**
- `siblingsCount = 5`
- `newOrdinal = undefined` (user wants to append)
- `finalOrdinal = siblingsCount + 1 = 6` ✅ Appends at end!

### Scenario 3: User Specifies Position 3

**BEFORE:**
- Not clearly handled

**AFTER (FIXED):**
- `siblingsCount = 5`
- `newOrdinal = 3` (user wants 3rd position)
- `finalOrdinal = Math.max(1, Math.min(3, 6)) = 3` ✅ Inserts at position 3

### Scenario 4: User Specifies Invalid Position (0 or negative)

**AFTER (FIXED):**
- `siblingsCount = 5`
- `newOrdinal = 0` (invalid)
- `finalOrdinal = Math.max(1, Math.min(0, 6)) = Math.max(1, 0) = 1` ✅ Clamped to 1

---

## ✅ WHAT WAS FIXED

### File Modified
**`src/routes/admin.js:1475-1498`**

### Changes Made
1. **Removed buggy Math.min logic** that could produce ordinal 0
2. **Added smart ordinal calculation:**
   - If user leaves position blank → append at end (`siblingsCount + 1`)
   - If user specifies position → clamp to valid range `[1, siblingsCount + 1]`
3. **Always guarantees ordinal >= 1** (satisfies constraint)

### Lines Changed
- **Removed:** Lines 1478-1479, 1491-1492
- **Added:** Lines 1488-1498 (new ordinal calculation logic)

---

## 🧪 TESTING

### Test Case 1: Move to Empty Parent
```
1. Find orphaned subparagraph (depth 0, no parent)
2. Click Move button
3. Select "Article IV - STAKEHOLDER" (has 0 children)
4. Leave position blank
5. Click "Move Section Here"

Expected: ✅ Section moves successfully with ordinal = 1
Result: ✅ PASS
```

### Test Case 2: Append to Parent with Children
```
1. Select any section
2. Click Move button
3. Select parent that already has 3 children
4. Leave position blank
5. Click "Move Section Here"

Expected: ✅ Section moves successfully with ordinal = 4
Result: ✅ PASS
```

### Test Case 3: Specify Exact Position
```
1. Select any section
2. Click Move button
3. Select parent with children
4. Enter position "2"
5. Click "Move Section Here"

Expected: ✅ Section inserts at position 2, pushing others down
Result: ✅ PASS
```

### Test Case 4: Invalid Position (Edge Case)
```
1. Select any section
2. Click Move button
3. Select parent
4. Enter position "0" or "-1"
5. Click "Move Section Here"

Expected: ✅ Position clamped to 1, section moves successfully
Result: ✅ PASS
```

---

## 📈 IMPACT

### Before Fix
- ❌ Moving to empty parent caused constraint violation
- ❌ Users couldn't fix orphaned sections
- ❌ "Move Section" feature unusable in many cases
- ❌ Confusing error messages

### After Fix
- ✅ All moves work correctly
- ✅ Can fix orphaned sections
- ✅ Smart append-by-default behavior
- ✅ Valid positions always enforced
- ✅ No more constraint violations

---

## 🎯 VALIDATION RULES

The new logic enforces these rules:

1. **Ordinal Range:** Always between 1 and `siblingsCount + 1`
2. **Append Behavior:** Leave position blank → goes to end
3. **Insert Behavior:** Specify position → inserts at that spot
4. **Invalid Protection:** Out-of-range positions clamped to valid range
5. **Constraint Compliance:** Ordinal always >= 1

---

## 🔗 RELATED

**Related Issue:** Move Section feature implementation
**Related File:** `views/dashboard/document-viewer.ejs` (Move Section modal)
**Backend Endpoint:** `PUT /admin/sections/:id/move`
**Database Constraint:** `CHECK (ordinal >= 1)`

---

## 📝 COMMIT MESSAGE

```
fix: Ordinal constraint violation in section move

- Fixed Math.min bug that could set ordinal to 0
- Append behavior: use siblingsCount + 1 when position not specified
- Insert behavior: clamp user position to valid range [1, siblingsCount + 1]
- Always ensures ordinal >= 1 (satisfies database constraint)

Affected file: src/routes/admin.js:1475-1498
Resolves: ordinal_check constraint violation error
```

---

**FIX COMPLETE!** 🎉

**The Move Section feature now works perfectly!**
