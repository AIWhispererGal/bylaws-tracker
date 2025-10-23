# 🧪 INDENT/DEDENT TESTING GUIDE

**Quick Reference for Testing Issue #5 Implementation**

---

## 🎯 QUICK TEST CHECKLIST

Use this checklist to verify indent/dedent functionality works correctly:

- [ ] **Test 1**: Indent a section that has an earlier sibling → SUCCESS
- [ ] **Test 2**: Try to indent the first section at a level → ERROR (NO_SIBLING)
- [ ] **Test 3**: Dedent a child section → SUCCESS
- [ ] **Test 4**: Try to dedent a root-level section → ERROR (ALREADY_ROOT)
- [ ] **Test 5**: Verify ordinals are sequential (no gaps) after indent
- [ ] **Test 6**: Verify ordinals are sequential (no gaps) after dedent
- [ ] **Test 7**: Refresh page and confirm changes persist

---

## 📋 TEST SCENARIOS

### ✅ **TEST 1: Valid Indent**

**Setup Required**:
```
Article I (depth 0, ordinal 1)
Article II (depth 0, ordinal 2)
```

**Steps**:
1. Navigate to document viewer
2. Expand "Article II"
3. Click "Indent" button
4. Observe toast notification
5. Wait for page reload

**Expected Result**:
```
Article I (depth 0, ordinal 1)
  Article II (depth 1, ordinal 1) ← Now child of Article I
```

**Success Criteria**:
- ✅ Toast shows: "Section indented successfully (now child of 'Article I')"
- ✅ Page refreshes automatically after 1 second
- ✅ Article II appears indented under Article I
- ✅ Article II depth increased from 0 to 1

**Database Verification**:
```sql
SELECT id, section_title, parent_section_id, ordinal, depth
FROM document_sections
WHERE section_title = 'Article II';

-- Expected:
-- parent_section_id: {Article I's UUID}
-- ordinal: 1 (first child)
-- depth: 1
```

---

### ❌ **TEST 2: Invalid Indent (First Sibling)**

**Setup Required**:
```
Article I (depth 0, ordinal 1) ← First section at root
Article II (depth 0, ordinal 2)
```

**Steps**:
1. Navigate to document viewer
2. Expand "Article I"
3. Click "Indent" button
4. Observe error message

**Expected Result**:
- ❌ Toast shows: "Cannot indent: This is the first section at this level"
- ❌ Page does NOT reload
- ❌ Article I remains at depth 0

**Success Criteria**:
- ✅ Error toast appears with warning level (yellow)
- ✅ Section hierarchy unchanged
- ✅ HTTP 400 response received

**Console Log Check**:
```
[INDENT] User {userId} indenting section {sectionId}
[INDENT] Sibling query error: (or) no previous sibling found
```

---

### ✅ **TEST 3: Valid Dedent**

**Setup Required**:
```
Article I (depth 0)
  Section 1.1 (depth 1, ordinal 1, parent: Article I)
```

**Steps**:
1. Navigate to document viewer
2. Expand "Section 1.1"
3. Click "Dedent" button
4. Observe toast notification
5. Wait for page reload

**Expected Result**:
```
Article I (depth 0, ordinal 1)
Section 1.1 (depth 0, ordinal 2, parent: NULL) ← Now sibling of Article I
```

**Success Criteria**:
- ✅ Toast shows: "Section dedented successfully (promoted from under 'Article I')"
- ✅ Page refreshes automatically after 1 second
- ✅ Section 1.1 appears at same level as Article I
- ✅ Section 1.1 depth decreased from 1 to 0

**Database Verification**:
```sql
SELECT id, section_title, parent_section_id, ordinal, depth
FROM document_sections
WHERE section_title = 'Section 1.1';

-- Expected:
-- parent_section_id: NULL (root level)
-- ordinal: 2 (after Article I)
-- depth: 0
```

---

### ❌ **TEST 4: Invalid Dedent (Root Level)**

**Setup Required**:
```
Article I (depth 0, parent: NULL) ← Already at root
```

**Steps**:
1. Navigate to document viewer
2. Expand "Article I"
3. Click "Dedent" button
4. Observe error message

**Expected Result**:
- ❌ Toast shows: "Cannot dedent: Section is already at root level"
- ❌ Page does NOT reload
- ❌ Article I remains at depth 0

**Success Criteria**:
- ✅ Error toast appears with warning level (yellow)
- ✅ Section hierarchy unchanged
- ✅ HTTP 400 response received

**Console Log Check**:
```
[DEDENT] User {userId} dedenting section {sectionId}
ERROR: Section is already at root level
```

---

## 🔍 ORDINAL CONSISTENCY TESTS

### **TEST 5: Ordinals After Indent**

**Scenario**: Indent "Section C" under "Section B"

**Before**:
```
Section A (parent: NULL, ordinal: 1)
Section B (parent: NULL, ordinal: 2)
Section C (parent: NULL, ordinal: 3) ← INDENT THIS
Section D (parent: NULL, ordinal: 4)
```

**After**:
```
Section A (parent: NULL, ordinal: 1)
Section B (parent: NULL, ordinal: 2)
  Section C (parent: B, ordinal: 1) ← Child of B
Section D (parent: NULL, ordinal: 3) ← Ordinal decremented from 4 to 3
```

**Verification Query**:
```sql
SELECT section_title, parent_section_id, ordinal
FROM document_sections
WHERE parent_section_id IS NULL
ORDER BY ordinal;

-- Expected ordinals: 1, 2, 3 (no gaps)
```

---

### **TEST 6: Ordinals After Dedent**

**Scenario**: Dedent "Subsection B.1" to same level as "Section B"

**Before**:
```
Section A (parent: NULL, ordinal: 1)
Section B (parent: NULL, ordinal: 2)
  Subsection B.1 (parent: B, ordinal: 1) ← DEDENT THIS
  Subsection B.2 (parent: B, ordinal: 2)
Section C (parent: NULL, ordinal: 3)
```

**After**:
```
Section A (parent: NULL, ordinal: 1)
Section B (parent: NULL, ordinal: 2)
Subsection B.1 (parent: NULL, ordinal: 3) ← Promoted to root
  Subsection B.2 (parent: B, ordinal: 1) ← Ordinal decremented from 2 to 1
Section C (parent: NULL, ordinal: 4) ← Ordinal incremented from 3 to 4
```

**Verification Query**:
```sql
-- Check root level ordinals
SELECT section_title, ordinal
FROM document_sections
WHERE parent_section_id IS NULL
ORDER BY ordinal;

-- Expected ordinals: 1, 2, 3, 4 (no gaps)

-- Check Section B's children
SELECT section_title, ordinal
FROM document_sections
WHERE parent_section_id = {Section B UUID}
ORDER BY ordinal;

-- Expected ordinals: 1 (only B.2 remains)
```

---

## 🎯 REAL-WORLD USE CASE TEST

### **Scenario**: Fix Parser Misclassification

**Problem**: Parser incorrectly assigned "Section 1.1" as depth 0 (should be depth 1)

**Test Steps**:

1. **Initial State** (after parsing):
```
Section 1.1 (depth 0, parent: NULL) ← WRONG DEPTH
Section 1.2 (depth 0, parent: NULL) ← WRONG DEPTH
```

2. **Manual Fix**:
   - Create "Section 1" manually (or find existing parent)
   - Click "Indent" on "Section 1.1"
   - Click "Indent" on "Section 1.2"

3. **Expected Final State**:
```
Section 1 (depth 0, parent: NULL)
  Section 1.1 (depth 1, parent: Section 1) ← CORRECT DEPTH
  Section 1.2 (depth 1, parent: Section 1) ← CORRECT DEPTH
```

4. **Verification**:
   - Check hierarchy visually in document viewer
   - Verify section numbers auto-update (if configured)
   - Confirm no ordinal constraint violations

---

## 🚨 ERROR HANDLING TESTS

### **Edge Case 1**: Locked Section

**Setup**: Lock a section via workflow

**Test**:
1. Try to indent/dedent locked section
2. Expected: Middleware blocks with 403 error

**Verification**:
```
validateSectionEditable middleware should prevent operation
```

---

### **Edge Case 2**: Non-existent Section

**Test**:
1. Manually call API with fake UUID
   ```bash
   curl -X POST http://localhost:3000/admin/sections/fake-uuid-here/indent
   ```
2. Expected: 404 error "Section not found"

---

### **Edge Case 3**: Rapid Clicks

**Test**:
1. Click "Indent" button rapidly 5 times
2. Expected: First request processes, subsequent blocked until reload

**Notes**: Page reload after success prevents duplicate operations

---

## 📊 MONITORING & DEBUGGING

### **Console Logs to Watch**

**Successful Indent**:
```
[INDENT] User {userId} indenting section {sectionId}
[INDENT] Previous sibling found: {siblingId} (ordinal {ordinal})
[INDENT] New parent will have {childCount} children, new ordinal: {newOrdinal}
[INDENT] ✅ Section {id} indented successfully
```

**Successful Dedent**:
```
[DEDENT] User {userId} dedenting section {sectionId}
[DEDENT] Current parent: {parentId} ({parentTitle}), grandparent: {grandparentId || 'ROOT'}
[DEDENT] ✅ Section {id} dedented successfully
```

**Errors**:
```
[INDENT] Sibling query error: {error}
[INDENT] Update error: {error}
[DEDENT] Parent query error: {error}
[DEDENT] Update error: {error}
```

---

## 🔧 TROUBLESHOOTING

### **Issue**: Buttons not appearing

**Cause**: User not admin/owner

**Fix**: Login as admin or global admin

---

### **Issue**: "Ordinal constraint violation" after operation

**Cause**: RPC function `decrement_sibling_ordinals` or `increment_sibling_ordinals` failed

**Debug**:
1. Check database logs for RPC errors
2. Verify RPC functions exist:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE '%sibling_ordinals%';
   ```

**Fix**: Re-run migration `020_section_editing_functions.sql`

---

### **Issue**: Page doesn't reload after success

**Cause**: JavaScript error or slow network

**Debug**:
1. Open browser console
2. Look for JavaScript errors
3. Check network tab for API response

---

## ✅ FINAL VERIFICATION CHECKLIST

After all tests complete:

- [ ] All 4 test scenarios pass (2 valid, 2 invalid)
- [ ] Ordinal sequences have no gaps at all hierarchy levels
- [ ] No duplicate ordinals exist
- [ ] Section depths are correct after operations
- [ ] Toast notifications show appropriate messages
- [ ] Console logs show success confirmations
- [ ] Database changes persist after page refresh
- [ ] No JavaScript errors in browser console
- [ ] No 500 errors in server logs

---

## 🏁 PASS/FAIL CRITERIA

**PASS** if:
- All 7 tests in Quick Test Checklist pass
- No ordinal constraint violations
- Hierarchy changes persist correctly
- Error handling works for edge cases

**FAIL** if:
- Any test produces unexpected result
- Ordinal gaps or duplicates appear
- Section depth incorrect after operation
- Server returns 500 error

---

**Testing Time Estimate**: 15-20 minutes for complete suite

**Recommended**: Test in development environment first, then staging before production.
