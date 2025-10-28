# Technical Constraints Summary: Why Gaps Can't Be Fixed

**Date:** 2025-10-27
**Scope:** Indent/Dedent/Move operations on sections with hierarchy gaps

---

## Quick Reference: The Core Constraints

### 1. Database Constraint: `path_ids` Length
```sql
-- From migration 026_fix_path_ids_constraint.sql
ALTER TABLE document_sections
ADD CONSTRAINT path_ids_length_matches_depth
CHECK (array_length(path_ids, 1) = depth + 1);
```

**What this means:**
- Section at depth 0 must have path_ids with 1 element: `[self_uuid]`
- Section at depth 1 must have path_ids with 2 elements: `[parent_uuid, self_uuid]`
- Section at depth 3 must have path_ids with 4 elements: `[grandparent, parent, greatparent, self]`

**Why gaps break this:**
```javascript
// Section at depth 3 with missing intermediate parents:
{
  depth: 3,
  parent_section_id: 'article-uuid',  // Article is depth 0
  path_ids: ['article-uuid', ???, ???, 'self-uuid']
              //              ↑    ↑
              //              Missing UUIDs for depth 1 and 2 sections
}

// Constraint violation:
// path_ids needs 4 elements (depth + 1)
// But we can only provide 2 valid UUIDs (article and self)
// The other 2 would need to be UUIDs of sections that don't exist!
```

---

### 2. Indent Constraint: "Previous Sibling" Requirement

**Code location:** `/src/routes/admin.js`, lines 2050-2067

**Algorithm:**
```javascript
POST /admin/sections/:id/indent

STEPS:
1. Find previous sibling at SAME depth
   (Not at any depth - specifically at the section's current depth)
2. Make section a CHILD of that sibling
3. New depth = sibling.depth + 1
4. New parent = sibling.id
```

**Why this exists:**
- Ensures depth increases by exactly 1 (not arbitrary jumps)
- Maintains parent-child relationship integrity
- Prevents orphaned sections

**Why gaps break indent:**
```javascript
Scenario: Article I (depth 0) → (a) Subparagraph (depth 3)

User wants to indent (a) to make it depth 1.

Problem:
- Query looks for previous sibling at depth 3
- No other sections exist at depth 3
- Query returns NULL
- Operation fails with "NO_SIBLING" error

Even if another section existed at depth 3:
- Indenting would make (a) a child of that section
- New depth = 3 + 1 = 4 (not 1 as user wanted!)
```

---

### 3. Dedent Constraint: "Must Have Parent" Requirement

**Code location:** `/src/routes/admin.js`, lines 2177-2183

**Algorithm:**
```javascript
POST /admin/sections/:id/dedent

STEPS:
1. Get section's parent
2. Make section a SIBLING of its parent
3. New depth = parent.depth (same as parent)
4. New parent = parent.parent_section_id (grandparent)
```

**Why this exists:**
- Ensures depth decreases by exactly 1
- Prevents creating invalid tree structure
- Root sections (depth 0) cannot dedent (no grandparent)

**Why gaps break dedent:**
```javascript
Scenario: Article I (depth 0) → (a) Subparagraph (depth 3)

Current state:
- (a).parent_section_id = article-uuid
- (a).depth = 3

User wants to dedent (a) to make it depth 1.

Attempt 1: Dedent from depth 3 → 2
Problem:
- Parent = Article (depth 0)
- Sibling of Article = depth 0 (not 2!)
- Result: (a) becomes depth 0 (root level)

Attempt 2: Dedent from depth 0 → ??? (can't!)
Problem:
- Section is now at root level
- Has no parent
- Cannot dedent further
- Stuck at depth 0 forever
```

---

### 4. Move Constraint: "Depth Is Not Updated"

**Code location:** `/src/routes/admin.js`, lines 1457-1619

**Algorithm:**
```javascript
PUT /admin/sections/:id/move
{
  "newParentId": "uuid",
  "newOrdinal": 2
}

STEPS:
1. Update parent_section_id = newParentId
2. Update ordinal = newOrdinal
3. DEPTH STAYS THE SAME! (not recalculated)
```

**Why depth isn't updated:**
- Move operation is designed for reordering siblings or changing parent at same depth
- Depth change requires recursive updates to all descendants
- Move doesn't have this logic (would need separate operation)

**Why gaps break move:**
```javascript
Scenario:
Article I (depth 0)
  Section 1 (depth 1)
(a) Subparagraph (depth 3) ← Move under Section 1

After move:
Article I (depth 0)
  Section 1 (depth 1)
    (a) Subparagraph (depth 3) ← Still depth 3!
    parent_section_id: section1-uuid

Result: INVALID TREE
- Parent is depth 1
- Child is depth 3
- Missing depth 2 between them!
- Violates tree structure integrity
```

---

## The Fundamental Problem: "Ghost Sections"

### Why We Can't Auto-Create Missing Parents

**Technical reasons:**

1. **Required NOT NULL columns:**
   ```sql
   CREATE TABLE document_sections (
     id UUID PRIMARY KEY,
     document_id UUID NOT NULL,
     organization_id UUID NOT NULL,
     section_number TEXT NOT NULL,
     original_text TEXT NOT NULL,  ← Can't be empty!
     current_text TEXT NOT NULL,   ← Can't be empty!
     depth INTEGER NOT NULL,
     document_order INTEGER NOT NULL,
     ...
   );
   ```

2. **Unknown section numbers:**
   ```javascript
   // What number should "Section 1" have?
   // Numbering scheme says depth 1 = numeric (1, 2, 3...)
   // Is this Section 1? Section 2? Unknown!

   // User's document might later have:
   // "Section 1: Definitions" at depth 1
   // Our ghost "Section 1" would conflict!
   ```

3. **Unknown document order:**
   ```javascript
   // document_order is sequential position in source document
   // Ghost sections don't exist in source!
   // Where do they go in the order?

   // Example:
   // Line 10: "Article I"
   // Line 50: "(a) Subparagraph"
   // Where is "Section 1"? Line 25? Line 30? Unknown!
   ```

4. **User confusion:**
   ```javascript
   // User uploads document with:
   //   Article I
   //   (a) Subparagraph

   // System shows:
   //   Article I
   //   Section 1 (auto-created)  ← User didn't write this!
   //     Subsection (A) (auto-created)  ← Or this!
   //       (a) Subparagraph

   // User: "Where did Section 1 come from? I didn't write that!"
   // User tries to edit Section 1: no content to edit!
   // Violates principle: "what you uploaded is what you see"
   ```

---

## Code Flow Analysis: Why Operations Fail

### Indent Operation Flow

```javascript
// File: /src/routes/admin.js, lines 2024-2149

router.post('/sections/:id/indent', async (req, res) => {
  const section = req.section; // depth: 3, parent: article-uuid

  // STEP 1: Find previous sibling at SAME depth
  const { data: previousSibling } = await supabaseService
    .from('document_sections')
    .select('id')
    .eq('document_id', section.document_id)
    .eq('parent_section_id', section.parent_section_id)
    .eq('depth', section.depth)  // ← Looking for depth 3 siblings
    .lt('ordinal', section.ordinal)
    .limit(1)
    .maybeSingle();

  // RESULT: previousSibling = NULL (no siblings at depth 3)

  // STEP 2: Check if sibling exists
  if (!previousSibling) {
    return res.status(400).json({
      error: 'Cannot indent: no earlier sibling to indent under'
      // ↑ Operation stops here - gap prevents indent!
    });
  }

  // STEP 3: Never reached because no sibling found
  // (Would make section child of previousSibling)
});
```

### Dedent Operation Flow

```javascript
// File: /src/routes/admin.js, lines 2164-2282

router.post('/sections/:id/dedent', async (req, res) => {
  const section = req.section; // depth: 3, parent: article-uuid

  // STEP 1: Check if at root level
  if (!section.parent_section_id) {
    return res.status(400).json({
      error: 'Cannot dedent: section is already at root level'
    });
  }

  // STEP 2: Get parent
  const { data: parent } = await supabaseService
    .from('document_sections')
    .select('id, parent_section_id, ordinal, depth')
    .eq('id', section.parent_section_id)
    .single();

  // RESULT: parent = Article I (depth 0)

  // STEP 3: Make section a sibling of parent
  await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: parent.parent_section_id, // NULL (grandparent)
      depth: parent.depth,  // 0 (same as parent!)
      ordinal: parent.ordinal + 1
    })
    .eq('id', section.id);

  // RESULT: Section is now depth 0 (not depth 1 as user wanted!)
  // Gap caused wrong depth calculation!
});
```

### Move Operation Flow

```javascript
// File: /src/routes/admin.js, lines 1457-1619

router.put('/sections/:id/move', async (req, res) => {
  const section = req.section; // depth: 3, parent: article-uuid
  const { newParentId } = req.body; // section1-uuid (depth 1)

  // STEP 1: Update parent and ordinal
  const { data: updatedSection } = await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: newParentId,
      ordinal: newOrdinal,
      // NOTE: depth is NOT updated!
    })
    .eq('id', section.id)
    .select()
    .single();

  // RESULT: Section moved but depth unchanged!
  // New state:
  //   parent: section1-uuid (depth 1)
  //   depth: 3 (still!)
  //   Missing: depth 2 between parent and child
  //   Tree structure INVALID!

  res.json({ success: true, section: updatedSection });
  // Gap still exists, just in different location now!
});
```

---

## Constraint Validation Summary

### What Database Allows (But Shouldn't)

```sql
-- This PASSES constraints but is semantically wrong:

INSERT INTO document_sections (
  id = 'subpara-uuid',
  parent_section_id = 'article-uuid',  -- Article is depth 0
  depth = 3,
  path_ids = ARRAY[
    'article-uuid',   -- depth 0 (exists)
    'fake-uuid-1',    -- depth 1 (DOESN'T EXIST!)
    'fake-uuid-2',    -- depth 2 (DOESN'T EXIST!)
    'subpara-uuid'    -- depth 3 (self)
  ]
);

-- CHECK (array_length(path_ids, 1) = depth + 1)
-- 4 = 3 + 1 ✓ PASSES

-- But when you try to query those UUIDs:
SELECT * FROM document_sections WHERE id = 'fake-uuid-1';
-- Returns: 0 rows (section doesn't exist!)

-- Tree traversal breaks:
-- Can't go from Article (depth 0) → fake-uuid-1 (depth 1, doesn't exist)
```

### What RLS Policies Expect

```sql
-- From migration 008c:
CREATE POLICY "Users can view sections in their org documents"
ON document_sections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_sections.document_id
    AND d.organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  )
);

-- This works fine with gaps (doesn't traverse tree)

-- BUT hierarchy-based policies WOULD break:
-- (Not implemented yet, but planned feature)
CREATE POLICY "Users can edit sections they have permission for"
ON document_sections FOR UPDATE
USING (
  has_section_permission(auth.uid(), id, 'edit')
);

-- Where has_section_permission() uses path_ids to check:
-- - If any ancestor has permission denial
-- - If section is in locked subtree
-- - Requires valid UUIDs in path_ids array!
```

---

## What Operations ARE Possible

### ✅ Scenario 1: Complete Hierarchy (No Gaps)

```
Article I (depth 0)
  Section 1 (depth 1)
    Subsection A (depth 2)
      Subparagraph (a) (depth 3)

OPERATIONS THAT WORK:
- Indent Section 1 → becomes child of previous sibling (if exists)
- Dedent Subsection A → becomes sibling of Section 1
- Move Subparagraph (a) to different parent
- Move-up, Move-down within siblings
```

### ✅ Scenario 2: Add New Sections (Manual Creation)

```
Current:
Article I (depth 0)
  Section 1 (depth 1)

Add Section 2 as sibling of Section 1:
- parent_section_id = Article I UUID
- depth = 1 (same as Section 1)
- ordinal = 2 (next sibling)
- path_ids = [article-uuid, section2-uuid]

RESULT: ✅ Valid hierarchy, no gaps
```

### ❌ Scenario 3: Fix Existing Gaps

```
Current:
Article I (depth 0)
  (a) Subparagraph (depth 3)

Cannot fix with:
- Indent (no siblings)
- Dedent (would make depth 0)
- Move (doesn't change depth)

CAN ONLY FIX BY:
1. Create Section 1 at depth 1 (manual)
2. Create Subsection (A) at depth 2 (manual)
3. Move + Dedent (a) to correct parent and depth
   OR delete (a) and recreate at correct depth
```

---

## Recommendations

### Immediate Action
1. **Add validation during upload**
   - Detect depth gaps in parser
   - Warn user: "Hierarchy gaps detected. Some sections may not be editable."
   - Return list of sections with missing parents

2. **Improve error messages**
   - Current: "Cannot indent: no earlier sibling to indent under"
   - Better: "Cannot indent: This section is at depth 3 with no parent at depth 2. Create the missing parent sections first."

3. **Document the limitation**
   - Add to user documentation
   - Add tooltip in UI: "Indent/dedent operations require complete hierarchy"

### Future Features
1. **Manual Section Creation Tool**
   - UI to create new sections at specific depths
   - User provides number, title, content, position
   - System validates parent exists at depth-1

2. **"Fill Missing Levels" Wizard**
   - Detects gaps automatically
   - Prompts user for each missing level
   - Creates sections in correct order

3. **"Move with Auto-Depth" Operation**
   - Move operation that recalculates depth based on new parent
   - Updates all descendants recursively
   - Validates no gaps will be created

---

## Key Takeaways

1. **Indent requires previous sibling** at the SAME depth (can't skip levels)
2. **Dedent makes section sibling of parent** (parent depth = new depth)
3. **Move doesn't change depth** (creates invalid tree if parent depth wrong)
4. **Gaps can't be fixed without creating missing sections** (requires manual content)
5. **Auto-creating "ghost" sections is not viable** (missing content, numbers, position)

**Bottom line:** Current tools are designed for **adjusting existing complete hierarchies**, not for **fixing incomplete hierarchies**. Fixing gaps requires **new section creation features**.

---

**END OF SUMMARY**
