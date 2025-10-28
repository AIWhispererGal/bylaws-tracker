# Indent/Dedent Limitations Analysis

**Date:** 2025-10-27
**Purpose:** Explain why indent/dedent operations cannot fix hierarchy gaps (missing intermediate levels)

---

## Executive Summary

**Key Finding:** The current indent/dedent operations are designed to shift sections between **adjacent hierarchy levels** only. They cannot create missing intermediate levels, which makes them unable to fix documents with hierarchy gaps.

**The Problem:** When a document has "Article I" (depth 0) followed immediately by "(a) Subparagraph" (depth 3), there are missing levels at depth 1 (Section) and depth 2 (Subsection). The current tools cannot bridge this gap.

---

## 1. How Indent Works (Current Implementation)

### Location
`/src/routes/admin.js`, lines 2024-2149

### Algorithm
```javascript
POST /admin/sections/:id/indent

STEPS:
1. Find previous sibling at same depth
2. Make section a CHILD of that sibling
3. Increment depth by 1
4. Update ordinals
```

### Example
```
BEFORE:
Article I (depth 0, ordinal 1)
Section 1 (depth 1, ordinal 1)
Section 2 (depth 1, ordinal 2) ← INDENT THIS

AFTER:
Article I (depth 0, ordinal 1)
  Section 1 (depth 1, ordinal 1)
    Section 2 (depth 2, ordinal 1) ← Now child of Section 1
```

### Critical Constraint: "Previous Sibling" Requirement

**Code excerpt (lines 2050-2067):**
```javascript
const { data: previousSibling, error: siblingError } = await siblingQuery
  .lt('ordinal', section.ordinal)
  .order('ordinal', { ascending: false })
  .limit(1)
  .maybeSingle();

if (!previousSibling) {
  return res.status(400).json({
    success: false,
    error: 'Cannot indent: no earlier sibling to indent under',
    code: 'NO_SIBLING'
  });
}
```

**Why this exists:**
- Indent makes the section a **child of its previous sibling**
- This ensures depth increases by exactly 1
- This maintains hierarchy tree structure

**The problem for gaps:**
```
Scenario: Article I → (a) Subparagraph
         depth 0  →  depth 3

Question: Can we indent (a) to become depth 1?
Answer: NO!
- (a) has no previous sibling at depth 3
- Even if it did, indent only goes from depth 3 → depth 4
- Cannot jump from depth 3 → depth 1
```

---

## 2. How Dedent Works (Current Implementation)

### Location
`/src/routes/admin.js`, lines 2164-2282

### Algorithm
```javascript
POST /admin/sections/:id/dedent

STEPS:
1. Get parent section
2. Make section a SIBLING of its parent
3. Decrement depth by 1
4. Insert after parent, update ordinals
```

### Example
```
BEFORE:
Article I (depth 0)
  Section 1 (depth 1)
    Subsection (a) (depth 2) ← DEDENT THIS

AFTER:
Article I (depth 0)
  Section 1 (depth 1)
  Subsection (a) (depth 1) ← Now sibling of Section 1
```

### Critical Constraint: "Must Have Parent" Requirement

**Code excerpt (lines 2177-2183):**
```javascript
if (!section.parent_section_id) {
  return res.status(400).json({
    success: false,
    error: 'Cannot dedent: section is already at root level',
    code: 'ALREADY_ROOT'
  });
}
```

**The problem for gaps:**
```
Scenario: Article I → (a) Subparagraph
         depth 0  →  depth 3

Current state:
- Article I: parent_section_id = NULL
- (a): parent_section_id = Article I's UUID
  (This is WRONG! Missing Section and Subsection levels)

Question: Can we dedent (a) from depth 3 → depth 2?
Answer: NO!
- (a)'s parent is Article I (depth 0)
- Dedent would make (a) a sibling of Article I (depth 0)
- This creates depth 0, not depth 2!

Question: Can we dedent (a) from depth 3 → depth 1?
Answer: NO!
- Dedent only decreases depth by 1 per operation
- Would need to dedent twice: depth 3 → 2 → 1
- But first dedent puts us at depth 0 (root level)
- Can't dedent from root level!
```

---

## 3. The "No Parent" Problem

### Why Missing Parents Break Everything

**Hierarchy rule:**
```
depth = length(path_ids) - 1

Example valid hierarchy:
Article I:
  depth = 0
  path_ids = [article_uuid]
  parent_section_id = NULL

Section 1:
  depth = 1
  path_ids = [article_uuid, section_uuid]
  parent_section_id = article_uuid

Subsection (A):
  depth = 2
  path_ids = [article_uuid, section_uuid, subsection_uuid]
  parent_section_id = section_uuid
```

**What happens with a gap:**
```
Article I:
  depth = 0
  path_ids = [article_uuid]
  parent_section_id = NULL

(a) Subparagraph:
  depth = 3  ← CLAIMS depth 3
  path_ids = [article_uuid, ???, ???, subpara_uuid]  ← MISSING 2 UUIDs!
  parent_section_id = article_uuid  ← WRONG! Should be subsection_uuid
```

**Database constraints violated:**
```sql
-- From migration 026_fix_path_ids_constraint.sql:
CHECK (array_length(path_ids, 1) = depth + 1)
CHECK (path_ids[array_length(path_ids, 1)] = id)
```

**Result:** Cannot create a valid section at depth 3 without parents at depth 1 and depth 2!

---

## 4. The Chicken-and-Egg Problem

### Scenario: User Wants to Fix the Gap

**Current situation:**
```
Article I (depth 0)
└─ (a) Subparagraph (depth 3)
   MISSING: Section (depth 1), Subsection (depth 2)
```

**User's logical steps:**
1. Create "Section 1" section
2. Create "Subsection (A)" section
3. Move "(a)" under "Subsection (A)"

**Why this fails:**

**Step 1: Create "Section 1" at depth 1**
```javascript
Problem: New section needs:
- parent_section_id = Article I UUID ✓
- depth = 1 ✓
- ordinal = 2 (next sibling of Article I?)
  NO! ordinal is sibling position at SAME depth
  Article I has no siblings at depth 0
- path_ids = [article_uuid, section_uuid] ✓

Conclusion: CAN create Section 1, BUT...
- Where does it go in document_order?
- Is it before or after "(a)"?
- This is UI/UX ambiguity
```

**Step 2: Create "Subsection (A)" at depth 2**
```javascript
Problem: New section needs:
- parent_section_id = Section 1 UUID ✓ (if Step 1 worked)
- depth = 2 ✓
- path_ids = [article_uuid, section_uuid, subsection_uuid] ✓

Conclusion: CAN create Subsection (A), BUT...
- Same document_order ambiguity
```

**Step 3: Move "(a)" under "Subsection (A)"**
```javascript
Problem: Current /admin/sections/:id/move endpoint:
- Changes parent_section_id ✓
- Changes ordinal ✓
- Changes depth... NO! Depth is NOT updated by move!

Code check (lines 1457-1619):
- Move changes parent and ordinal only
- Depth is FIXED at creation time
- Would need SEPARATE dedent operations to go from depth 3 → 2

Conclusion: Move + Dedent could work, BUT...
- Need to dedent TWICE (3→2, 2→1)
- Then move to correct parent
- Multi-step process prone to errors
```

---

## 5. Scenarios That Can't Be Fixed

### 5.1. Large Depth Jump
```
Article I (depth 0)
  (1) Paragraph (depth 4)

Missing: Section (1), Subsection (A), Subparagraph (a)

Cannot fix with indent/dedent because:
- No siblings to indent under at depth 4
- Dedenting from depth 4→3→2→1→0 would take 4 operations
- Each dedent makes section a sibling of parent
- Eventually ends up at root level (depth 0)
```

### 5.2. Multiple Gaps in Sequence
```
Article I (depth 0)
  Section 1 (depth 1)
    (1) Paragraph (depth 4)
  Section 2 (depth 1)
    (a) Subparagraph (depth 3)

Cannot fix with indent/dedent because:
- Each section has different missing levels
- Would need 2 dedents for first, 1 dedent for second
- No way to "fill in" Subsection levels without creating content
```

### 5.3. Out-of-Order Depths
```
Article I (depth 0)
  (a) Subparagraph (depth 3)
  Section 1 (depth 1)

Cannot fix with move/dedent because:
- Dedenting (a) to depth 0 makes it root level
- Moving (a) after Section 1 doesn't change its depth
- Would need to dedent (a) AFTER moving under Section 1
- But can't move without fixing depth first!
```

---

## 6. Visual Diagram: The Hierarchy Problem

```
DESIRED HIERARCHY (10 levels):
=============================================================================
Depth 0: Article I           ← EXISTS
Depth 1: Section 1           ← MISSING! (no section number, no content)
Depth 2: Subsection (A)      ← MISSING! (no subsection letter, no content)
Depth 3: Subparagraph (a)    ← EXISTS (but claims wrong depth)
...

ACTUAL DATABASE STATE:
=============================================================================
document_sections table:

id                 | parent_id  | depth | section_number | path_ids
-------------------|------------|-------|----------------|------------------
article-uuid       | NULL       | 0     | "I"            | [article-uuid]
subpara-uuid       | article-uuid| 3    | "(a)"          | [article-uuid, ?, ?, subpara-uuid]
                     ^^^^^^^^^                             ^^^^^^^^^^^^^^
                     WRONG!                                INVALID!
                     Should be                             Missing 2 UUIDs
                     subsection-uuid

CONSTRAINT VIOLATION:
path_ids length = 4 (article + ? + ? + subpara)
depth + 1 = 3 + 1 = 4 ✓ (constraint passes BUT semantically wrong!)

TREE STRUCTURE:
Article I (depth 0)
└─ (a) Subparagraph (depth 3) ← WRONG! No intermediate parents!

CORRECT TREE STRUCTURE (what we want):
Article I (depth 0)
└─ Section 1 (depth 1)
   └─ Subsection (A) (depth 2)
      └─ Subparagraph (a) (depth 3)
```

---

## 7. Why "Ghost" Parent Sections Won't Work

### Idea: Auto-Create Missing Parents

**Proposed algorithm:**
```javascript
When section at depth 3 has no parent at depth 2:
1. Create "ghost" Subsection (A) at depth 2
2. Create "ghost" Section 1 at depth 1
3. Link them together
4. Set (a) as child of Subsection (A)
```

**Why this fails:**

1. **No content to store**
   ```javascript
   Problem: What is the text content of "Section 1"?
   - original_text is REQUIRED NOT NULL
   - User hasn't written anything for Section 1
   - Can't use empty string (violates business logic)
   ```

2. **No section number**
   ```javascript
   Problem: What is the section_number for "Section 1"?
   - Numbering scheme says depth 1 uses "numeric" (1, 2, 3...)
   - Is this Section 1? Section 2? Unknown!
   - Can't auto-assign without knowing document structure
   ```

3. **Document order ambiguity**
   ```javascript
   Problem: Where in the document does "Section 1" appear?
   - Before (a)? After (a)?
   - document_order is sequential position in source document
   - Ghost sections have no position in source!
   ```

4. **User confusion**
   ```javascript
   Problem: User didn't write "Section 1", system did
   - Shows up in document viewer
   - User tries to edit it (no content to edit!)
   - Violates principle of "what you uploaded is what you see"
   ```

---

## 8. What Would Be Needed to Fix This

### Option A: Manual Section Creation UI

**Requirements:**
1. UI to create new sections at specific depths
2. User provides:
   - Section number (e.g., "1", "A", "a")
   - Section title
   - Section content (even if placeholder)
   - Position in document (before/after existing section)
3. System validates:
   - Parent exists at depth-1
   - Ordinal is calculated correctly
   - path_ids is constructed from parent's path
4. System inserts section with correct relationships

**Pros:** User has full control, no "ghost" sections
**Cons:** Tedious for documents with many gaps

---

### Option B: Smart "Fill Missing Levels" Tool

**Requirements:**
1. Detect hierarchy gaps (depth jumps > 1)
2. For each gap, prompt user:
   ```
   Found: Article I → (a) Subparagraph
   Missing levels: Section (depth 1), Subsection (depth 2)

   Create Section:
   - Number: [1] (auto-suggested)
   - Title: [_______] (user input)
   - Content: [placeholder] (user input)

   Create Subsection:
   - Number: [A] (auto-suggested)
   - Title: [_______] (user input)
   - Content: [placeholder] (user input)
   ```
3. Create sections in correct order
4. Update parent relationships

**Pros:** Guided process, fills gaps systematically
**Cons:** Still requires user input for each gap

---

### Option C: Allow Non-Consecutive Depths (DANGEROUS!)

**Idea:** Remove the constraint that depths must be consecutive

**Change required:**
```sql
-- CURRENT (migration 026):
CHECK (array_length(path_ids, 1) = depth + 1)

-- PROPOSED:
-- Remove this constraint, allow path_ids to have gaps like:
-- [article_uuid, NULL, NULL, subpara_uuid]
```

**Why this is BAD:**
1. Breaks path-based hierarchy queries
2. RLS policies rely on path_ids for security
3. Triggers can't compute correct paths
4. UI can't render tree structure correctly
5. Move/indent/dedent operations undefined behavior

**Conclusion:** Not recommended!

---

## 9. Recommendations

### Short-term (Keep Current Behavior)
1. **Document the limitation clearly**
   - Add warning in UI when depth jumps detected
   - Show message: "This section is missing parent levels. Use the hierarchy editor to fix."

2. **Add validation during upload**
   - Detect depth gaps in parser
   - Return warnings to user
   - Suggest using hierarchy editor after upload

3. **Improve error messages**
   - When indent/dedent fails due to gaps:
     ```
     "Cannot indent: This section is at depth 3 but has no parent at depth 2.
      Please create the missing parent sections first using the hierarchy editor."
     ```

### Long-term (New Features Needed)
1. **Implement Option B: "Fill Missing Levels" Tool**
   - Dedicated UI for gap detection and filling
   - Step-by-step wizard to create missing parents
   - Preview before applying changes

2. **Add "Bulk Section Creation" Tool**
   - Allow admin to create multiple sections at once
   - Specify depth, numbering, parent relationships
   - Useful for restructuring large documents

3. **Enhanced Hierarchy Editor**
   - Visual tree view with drag-and-drop
   - Shows missing levels in red
   - Right-click menu: "Insert missing parent"

---

## 10. Summary Table: What Works and What Doesn't

| Operation | Scenario | Works? | Why/Why Not |
|-----------|----------|--------|-------------|
| Indent | Section has previous sibling at same depth | ✅ YES | Makes section child of sibling, depth += 1 |
| Indent | Section is first sibling | ❌ NO | No previous sibling to become child of |
| Indent | Section is at depth 3, want depth 1 | ❌ NO | Indent only increases depth by 1 |
| Dedent | Section has parent | ✅ YES | Makes section sibling of parent, depth -= 1 |
| Dedent | Section is at root level | ❌ NO | No parent to become sibling of |
| Dedent | Section at depth 3, want depth 1 | ❌ NO | Would need 2 dedents, but parent is depth 0 |
| Move | Change sibling order | ✅ YES | Swaps ordinals within same parent |
| Move | Change parent | ✅ YES | Updates parent_section_id and ordinals |
| Move | Fix depth from 3→1 | ❌ NO | Move doesn't change depth! |
| Move + Dedent | Fix depth 3→1 | ⚠️ MAYBE | Needs parent at depth 1 to exist first |
| Create Section | Fill gap at depth 1 | ⚠️ MANUAL | Requires UI for section creation (not implemented) |
| Create Section | Fill gap at depth 2 | ⚠️ MANUAL | Same - needs section creation UI |

---

## Appendix: Code References

### Indent Implementation
- **File:** `/src/routes/admin.js`
- **Lines:** 2024-2149
- **Key logic:** Lines 2050-2067 (previous sibling check)

### Dedent Implementation
- **File:** `/src/routes/admin.js`
- **Lines:** 2164-2282
- **Key logic:** Lines 2177-2183 (parent check)

### Move Implementation
- **File:** `/src/routes/admin.js`
- **Lines:** 1457-1619
- **Key logic:** Lines 1464-1475 (parent vs ordinal change)

### Hierarchy Building
- **File:** `/src/services/sectionStorage.js`
- **Lines:** 129-185
- **Key logic:** Lines 138-158 (parent stack algorithm)

### Path Constraint
- **File:** `/database/migrations/026_fix_path_ids_constraint.sql`
- **Constraint:** `CHECK (array_length(path_ids, 1) = depth + 1)`

---

**END OF ANALYSIS**
