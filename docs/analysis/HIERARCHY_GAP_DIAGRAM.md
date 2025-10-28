# Visual Hierarchy Gap Problem

## The Problem: Missing Intermediate Levels

### What User Uploaded
```
Article I
  NAME OF THE ORGANIZATION
  The name of the organization shall be...

(a) The organization was formed in...
```

### What Parser Detected
```
Level         | Depth | Section Number | Content
--------------|-------|----------------|------------------
Article       | 0     | I              | NAME OF THE...
Subparagraph  | 3     | (a)            | The organization...
```

### What Database Stored (WRONG!)
```
                    Article I
                    depth: 0
                    parent: NULL
                    path: [article-uuid]
                       |
                       └─────┐
                             |
                             ↓
                         (a) Subparagraph
                         depth: 3 ← WRONG!
                         parent: article-uuid ← WRONG!
                         path: [article-uuid, ?, ?, subpara-uuid]
                                              ↑  ↑
                                              MISSING PARENTS!
```

### What SHOULD Be in Database (CORRECT!)
```
                    Article I
                    depth: 0
                    parent: NULL
                    path: [article-uuid]
                       |
                       └─────┐
                             ↓
                         Section 1
                         depth: 1
                         parent: article-uuid
                         path: [article-uuid, section-uuid]
                             |
                             └─────┐
                                   ↓
                               Subsection (A)
                               depth: 2
                               parent: section-uuid
                               path: [article-uuid, section-uuid, subsection-uuid]
                                   |
                                   └─────┐
                                         ↓
                                     Subparagraph (a)
                                     depth: 3
                                     parent: subsection-uuid
                                     path: [article-uuid, section-uuid, subsection-uuid, subpara-uuid]
```

---

## Why Indent Can't Fix It

### Current State
```
Article I (depth 0, ordinal 1)
(a) Subparagraph (depth 3, ordinal 1)  ← Want to make this depth 1
```

### What Indent Does
```
ERROR: Cannot indent
Reason: No previous sibling at depth 3

Even if we had:
Article I (depth 0)
(b) First subpara (depth 3)
(a) Second subpara (depth 3)  ← Try to indent this

Result of indent:
Article I (depth 0)
(b) First subpara (depth 3)
  (a) Second subpara (depth 4)  ← Now depth 4, not depth 1!
```

### What We'd Need
```
To make (a) depth 1, we'd need to DEDENT it from 3→2→1
But:
- First dedent: 3→2 (makes (a) sibling of... who? No parent at depth 2!)
- Even if we dedent to 2, parent is Article (depth 0)
  So (a) becomes sibling of Article (depth 0)
- Can't dedent from depth 0!
```

---

## Why Dedent Can't Fix It

### Current State
```
Article I (depth 0)
└─ (a) Subparagraph (depth 3)  ← Want to make this depth 1
   parent: Article I
```

### First Dedent Attempt
```
Dedent makes section a SIBLING of its parent:

Parent = Article I (depth 0)
New position = Sibling of Article I (depth 0)

Result:
(a) Subparagraph (depth 0)  ← Now root level, not depth 1!
Article I (depth 0)
```

### Why This Is Wrong
```
(a) is now a TOP-LEVEL section (like an Article)
- depth = 0 (not 1 as we wanted)
- parent = NULL
- path = [subpara-uuid]

Can't dedent again because already at root level!
```

---

## Why "Just Add Parents" Doesn't Work

### Attempt: Create Section 1
```javascript
Problem 1: What is the content?
- User didn't write "Section 1: Something"
- Can we use empty string?
  → NO! original_text is REQUIRED NOT NULL
- Can we use placeholder "Section 1"?
  → Maybe, but user will see this "fake" section in viewer

Problem 2: What is the section number?
- Numbering scheme says depth 1 = numeric
- Is this "1"? "2"? Unknown!
- Next section might be depth 1 and numbered "1"
  → Conflict!

Problem 3: Where does it go?
- document_order is position in source document
- Section 1 doesn't exist in source!
- Put before (a)? After (a)?
  → User expects sections in source order
  → Creating sections out of order breaks this
```

---

## The Constraint Violation

### Database Rule (migration 026)
```sql
CHECK (array_length(path_ids, 1) = depth + 1)
```

### Current Invalid State
```
(a) Subparagraph:
  depth = 3
  path_ids = [article-uuid, NULL, NULL, subpara-uuid]
  array_length(path_ids, 1) = 4
  depth + 1 = 3 + 1 = 4
  Constraint: 4 = 4 ✓ PASSES (but semantically wrong!)
```

### Why It Passes But Is Wrong
```
The constraint checks LENGTH but not CONTENT:
- path_ids has 4 elements ✓
- But 2 of them are NULL or invalid UUIDs
- UUIDs don't reference real sections

Can't query:
SELECT * FROM document_sections WHERE id = path_ids[2]
→ Returns nothing (no section exists)

Can't traverse tree:
parent_section_id = article-uuid (depth 0)
But section claims depth 3!
→ Skipped depths 1 and 2
```

---

## Operations Comparison Matrix

### ✅ What Works

#### Scenario 1: Normal Indent
```
BEFORE:
Article I (depth 0)
  Section 1 (depth 1, ordinal 1)
  Section 2 (depth 1, ordinal 2)  ← INDENT THIS

OPERATION: POST /admin/sections/section2-uuid/indent

AFTER:
Article I (depth 0)
  Section 1 (depth 1, ordinal 1)
    Section 2 (depth 2, ordinal 1)  ← Now child of Section 1

RESULT: ✅ Depth 1 → 2 (correct!)
```

#### Scenario 2: Normal Dedent
```
BEFORE:
Article I (depth 0)
  Section 1 (depth 1)
    Subsection A (depth 2)  ← DEDENT THIS

OPERATION: POST /admin/sections/subsection-uuid/dedent

AFTER:
Article I (depth 0)
  Section 1 (depth 1)
  Subsection A (depth 1)  ← Now sibling of Section 1

RESULT: ✅ Depth 2 → 1 (correct!)
```

---

### ❌ What Doesn't Work

#### Scenario 3: Indent with Gap
```
BEFORE:
Article I (depth 0, ordinal 1)
(a) Subparagraph (depth 3, ordinal 1)  ← INDENT THIS (no previous sibling!)

OPERATION: POST /admin/sections/subpara-uuid/indent

RESPONSE:
{
  "success": false,
  "error": "Cannot indent: no earlier sibling to indent under",
  "code": "NO_SIBLING"
}

REASON: No previous sibling at depth 3
RESULT: ❌ Operation fails
```

#### Scenario 4: Dedent with Gap
```
BEFORE:
Article I (depth 0)
└─ (a) Subparagraph (depth 3)  ← DEDENT THIS
   parent: Article I (depth 0)

OPERATION: POST /admin/sections/subpara-uuid/dedent

AFTER:
Article I (depth 0)
(a) Subparagraph (depth 0)  ← Now root level (WRONG!)

REASON: Parent is depth 0, so sibling of parent is depth 0
RESULT: ❌ Wrong depth! Wanted 1, got 0
```

#### Scenario 5: Move Doesn't Change Depth
```
BEFORE:
Article I (depth 0)
  Section 1 (depth 1)
(a) Subparagraph (depth 3)  ← MOVE under Section 1

OPERATION:
PUT /admin/sections/subpara-uuid/move
{
  "newParentId": "section1-uuid"
}

AFTER:
Article I (depth 0)
  Section 1 (depth 1)
    (a) Subparagraph (depth 3)  ← Still depth 3! (WRONG!)
    parent: section1-uuid

REASON: Move changes parent but NOT depth
RESULT: ❌ Invalid tree (parent depth 1, child depth 3, missing depth 2)
```

---

## The Real Solution: Manual Section Creation

### Step-by-Step Fix Process

```
STEP 1: Create "Section 1" at depth 1
=============================================================================
User Action:
  Click "Add Section" → Select "After Article I"
  Choose depth: 1
  Enter number: "1"
  Enter title: "General Provisions"
  Enter content: "(Placeholder for section content)"

System Action:
  INSERT INTO document_sections (
    parent_section_id = article-uuid,
    depth = 1,
    ordinal = 1,
    section_number = "1",
    section_title = "General Provisions",
    original_text = "(Placeholder for section content)",
    path_ids = [article-uuid, section1-uuid]
  )

Result:
  Article I (depth 0)
  └─ Section 1 (depth 1) ✓ CREATED


STEP 2: Create "Subsection (A)" at depth 2
=============================================================================
User Action:
  Click "Add Section" → Select "Under Section 1"
  Choose depth: 2
  Enter number: "A"
  Enter title: "Definitions"
  Enter content: "(Placeholder for subsection content)"

System Action:
  INSERT INTO document_sections (
    parent_section_id = section1-uuid,
    depth = 2,
    ordinal = 1,
    section_number = "A",
    section_title = "Definitions",
    original_text = "(Placeholder for subsection content)",
    path_ids = [article-uuid, section1-uuid, subsectionA-uuid]
  )

Result:
  Article I (depth 0)
  └─ Section 1 (depth 1)
     └─ Subsection (A) (depth 2) ✓ CREATED


STEP 3: Move (a) under Subsection (A)
=============================================================================
User Action:
  Drag (a) Subparagraph → Drop under Subsection (A)

System Action:
  PUT /admin/sections/subpara-uuid/move
  {
    "newParentId": "subsectionA-uuid"
  }

  UPDATE document_sections
  SET parent_section_id = subsectionA-uuid,
      ordinal = 1
  WHERE id = subpara-uuid

Result (STILL WRONG):
  Article I (depth 0)
  └─ Section 1 (depth 1)
     └─ Subsection (A) (depth 2)
        └─ (a) Subparagraph (depth 3) ✓ MOVED but depth unchanged!


STEP 4: Fix depth with dedent (WAIT, THIS WON'T WORK!)
=============================================================================
Current state:
  (a) has parent = subsectionA-uuid (depth 2)
  (a) has depth = 3

If we dedent:
  (a) becomes sibling of Subsection (A) (depth 2)
  (a) depth = 2 (WRONG! Still not depth 1)

Need to fix depth DURING move operation, not after!
```

### The Missing Feature: "Move with Depth Update"

What we ACTUALLY need:
```javascript
PUT /admin/sections/:id/move
{
  "newParentId": "subsectionA-uuid",
  "updateDepth": true  // ← NEW FEATURE NEEDED!
}

Algorithm:
1. Get new parent's depth (subsectionA-uuid → depth 2)
2. Calculate new depth = parent.depth + 1 = 2 + 1 = 3 ✓
3. Update section with:
   - parent_section_id = new parent
   - depth = calculated depth
   - path_ids = [...parent.path_ids, section.id]
4. Recursively update ALL descendants' depths too!

Example:
If (a) has children (i), (ii), (iii)...
- (a) depth 3 → depth 3 (no change, already correct)
- (i) depth 4 → depth 4 (no change, already correct)
```

---

## Summary: Why Current Tools Can't Fix Gaps

| Tool | Action | Result on Gap | Why It Fails |
|------|--------|---------------|--------------|
| **Indent** | Make child of previous sibling | ❌ Fails | No siblings at gapped depth |
| **Dedent** | Make sibling of parent | ❌ Wrong depth | Parent is at depth 0, dedent makes section depth 0 |
| **Move** | Change parent | ⚠️ Moves but keeps wrong depth | Doesn't update depth field |
| **Create Section** | Add new section | ⚠️ Not implemented | No UI for manual section creation |

**Conclusion:** Need new feature: "Manual Section Creation UI" or "Fill Missing Levels Wizard"

---

## What's Needed: Feature Comparison

| Feature | Complexity | User Effort | Solves Problem? |
|---------|-----------|-------------|-----------------|
| **Manual Section Creation** | Medium | High (create each missing section) | ✅ Yes |
| **Fill Missing Levels Wizard** | High | Medium (guided prompts) | ✅ Yes |
| **Move with Auto-Depth** | Medium | Low (move section, depth auto-calculated) | ⚠️ Partial (still need to create missing sections first) |
| **Allow Non-Consecutive Depths** | High | None | ❌ No (breaks too many things) |

**Recommendation:** Implement "Manual Section Creation" first (MVP), then "Fill Missing Levels Wizard" (enhanced UX).
