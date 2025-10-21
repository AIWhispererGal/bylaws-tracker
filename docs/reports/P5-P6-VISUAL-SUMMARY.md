# P5-P6 VISUAL ANALYSIS SUMMARY

## PRIORITY 5: 10-Level Depth Support - Visual Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    10-LEVEL DEPTH SUPPORT STACK                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│  USER UPLOADS   │  Article I
│   DOCUMENT      │    Section 1
└────────┬────────┘      (a)
         │                 (1)
         ↓                   (i)
┌─────────────────┐             (A)
│   WORD PARSER   │               (1)
│                 │                 (a)
│ ✅ NO LIMITS    │                   (i)
│ Lines 12-40     │                     (1) ← Depth 9
│ Reads config    │
│ dynamically     │
└────────┬────────┘
         │
         ↓
┌──────────────────────────────────────────────┐
│      HIERARCHY DETECTOR                      │
│                                              │
│ ✅ validateHierarchy() - Line 248           │
│    maxDepth = config.hierarchy.maxDepth     │
│    DEFAULT: 10 (can be 1-20)                │
│                                              │
│ ✅ Checks: depth <= maxDepth                │
│ ❌ No hardcoded limits                      │
└─────────────────┬────────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│      NUMBERING SCHEMES                       │
│                                              │
│ ✅ formatHierarchical(numbers, sep)         │
│    [1,2,3,4,5,6,7,8,9,10] → "1.2.3...10"   │
│                                              │
│ ✅ Supports:                                │
│    • Roman (I, II, III, ...)                │
│    • Numeric (1, 2, 3, ...)                 │
│    • Alpha (A, B, C, ..., AA, AB)           │
│    • Hierarchical (1.2.3.4.5.6.7.8.9.10)    │
└─────────────────┬────────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│      SECTION STORAGE                         │
│                                              │
│ ✅ buildHierarchy() - Line 111              │
│    Uses stack-based algorithm               │
│    NO depth restrictions                    │
│                                              │
│    while (parentStack.length > depth) {     │
│      parentStack.pop();  ← Dynamic depth    │
│    }                                         │
└─────────────────┬────────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│      DATABASE SCHEMA                         │
│                                              │
│ ✅ CHECK(depth >= 0 AND depth <= 10)        │
│                                              │
│ ✅ Materialized Path Arrays:               │
│    path_ids: [uuid, uuid, ..., uuid]       │
│    path_ordinals: [1, 2, 3, ..., 10]       │
│                                              │
│ ✅ CHECK(array_length = depth + 1)         │
└─────────────────┬────────────────────────────┘
                  │
                  ↓
┌──────────────────────────────────────────────┐
│      TRIGGER: update_section_path()          │
│                                              │
│ ✅ Automatically calculates:                │
│    • depth (recursive from parent)          │
│    • path_ids (array concat)                │
│    • path_ordinals (array concat)           │
│                                              │
│ ❌ NO depth limits in logic                │
│    Uses || operator (array append)          │
└──────────────────────────────────────────────┘
```

---

## PRIORITY 5: The Configuration Gap

```
┌───────────────────────────────────────────────────────────────┐
│              CONFIGURATION LAYER ANALYSIS                      │
└───────────────────────────────────────────────────────────────┘

DATABASE SCHEMA:          CONFIG SCHEMA:        DEFAULT CONFIG:
depth <= 10              maxDepth: 1-20         maxDepth: 5
                         (default: 10)

┌─────────────┐         ┌─────────────┐        ┌─────────────┐
│  Supports   │         │   Allows    │        │   Defines   │
│  10 levels  │  ✅     │   20 levels │  ⚠️    │  2 levels   │  ❌
│             │         │             │        │             │
│ Depth 0-10  │         │ Depth 1-20  │        │ Depth 0-1   │
└─────────────┘         └─────────────┘        └─────────────┘

                                                      ↓
                                               MISSING LEVELS:
                                               ┌─────────────┐
                                               │  Depth 2-9  │
                                               │             │
                                               │ Subsection  │
                                               │   Clause    │
                                               │  Paragraph  │
                                               │     ...     │
                                               └─────────────┘

SOLUTION: Add level definitions to organizationConfig.js
```

---

## PRIORITY 5: Example 10-Level Hierarchy

```
Depth 0:  Article I                    (roman)
           │
Depth 1:   ├── Section 1               (numeric)
           │    │
Depth 2:   │    ├── (a) Subsection     (alphaLower)
           │    │    │
Depth 3:   │    │    ├── (1) Clause    (numeric)
           │    │    │    │
Depth 4:   │    │    │    ├── (i) Subclause      (roman)
           │    │    │    │    │
Depth 5:   │    │    │    │    ├── (A) Paragraph  (alpha)
           │    │    │    │    │    │
Depth 6:   │    │    │    │    │    ├── (1) Subparagraph  (numeric)
           │    │    │    │    │    │    │
Depth 7:   │    │    │    │    │    │    ├── (a) Item      (alphaLower)
           │    │    │    │    │    │    │    │
Depth 8:   │    │    │    │    │    │    │    ├── (i) Subitem  (roman)
           │    │    │    │    │    │    │    │    │
Depth 9:   │    │    │    │    │    │    │    │    └── (1) Point  (numeric)

DATABASE PATH ARRAYS:
path_ids:      [Art-I, Sec-1, Sub-a, Cl-1, SCl-i, Par-A, SPar-1, Item-a, SItem-i, Point-1]
path_ordinals: [1,     1,     1,     1,    1,     1,     1,       1,      1,       1]
               └─────────────────────── 10 elements (depth + 1) ──────────────────────┘

SECTION NUMBER: "1.1.1.1.1.1.1.1.1.1" or "Article I, Section 1(a)(1)(i)(A)(1)(a)(i)(1)"
```

---

## PRIORITY 6: Section Editing Operations - Visual Guide

### 1. SPLIT SECTION

```
BEFORE:
┌─────────────────────────────────────────┐
│ Section 2 (ID: A)                       │
│ Ordinal: 2                              │
│ ─────────────────────────────────────── │
│ Content Part 1                          │
│ Content Part 2                          │  ← Split at position 100
│ Content Part 3                          │
└─────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐
│ Section 2 (ID: A) ✅ KEPT              │  │ Section 3 (ID: B) ✨ NEW               │
│ Ordinal: 2                              │  │ Ordinal: 3                              │
│ ─────────────────────────────────────── │  │ ─────────────────────────────────────── │
│ Content Part 1                          │  │ Content Part 2                          │
│                                         │  │ Content Part 3                          │
└─────────────────────────────────────────┘  └─────────────────────────────────────────┘

SUBSEQUENT SECTIONS:
Section 3 (old) → Section 4 (ordinal: 3 → 4)  ← Ordinals incremented
Section 4 (old) → Section 5 (ordinal: 4 → 5)
```

### 2. JOIN SECTIONS

```
BEFORE:
┌─────────────────────────────────────────┐  ┌─────────────────────────────────────────┐
│ Section 2 (ID: A)                       │  │ Section 3 (ID: B)                       │
│ Ordinal: 2                              │  │ Ordinal: 3                              │
│ ─────────────────────────────────────── │  │ ─────────────────────────────────────── │
│ Content Part 1                          │  │ Content Part 2                          │
│ Suggestions: [S1, S2]                   │  │ Suggestions: [S3, S4]                   │
└─────────────────────────────────────────┘  └─────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────┐
│ Section 2 (ID: A) ✅ MERGED            │
│ Ordinal: 2                              │
│ ─────────────────────────────────────── │
│ Content Part 1                          │
│                                         │
│ Content Part 2                          │  ← Joined with separator
│ Suggestions: [S1, S2, S3, S4]           │  ← Merged suggestions
└─────────────────────────────────────────┘

Section 3 (ID: B) ❌ DELETED

SUBSEQUENT SECTIONS:
Section 4 (old) → Section 3 (ordinal: 4 → 3)  ← Ordinals decremented
Section 5 (old) → Section 4 (ordinal: 5 → 4)
```

### 3. MOVE SECTION

```
BEFORE:
Article I                          Article II
  ├── Section 1 (Ord: 1)             ├── Section 1 (Ord: 1)
  ├── Section 2 (Ord: 2) 🔄          └── (empty)
  └── Section 3 (Ord: 3)

       Move Section 2 to Article II as first child
                      ↓

AFTER:
Article I                          Article II
  ├── Section 1 (Ord: 1)             ├── Section 2 (Ord: 1) ✅ MOVED
  └── Section 2 (Ord: 2)             │   • parent_section_id: Article I → Article II
      (was Section 3)                │   • ordinal: 2 → 1
                                     │   • depth: 1 (unchanged)
                                     │   • path_ids: [Art-I, Sec-2] → [Art-II, Sec-2]
                                     │   • path_ordinals: [1, 2] → [2, 1]
                                     │
                                     └── Section 1 (Ord: 2)
                                         (was Section 1, ordinal incremented)

TRIGGER AUTOMATICALLY RECALCULATES:
✅ path_ids
✅ path_ordinals
✅ depth (if moving to different level)
```

### 4. RETITLE SECTION

```
BEFORE:
┌─────────────────────────────────────────┐
│ Article I - Membership                  │
│ Section Number: "Article I"             │
│ Title: "Membership"                     │
└─────────────────────────────────────────┘

UPDATE:
PUT /admin/sections/{id}/retitle
{
  "newTitle": "Members and Eligibility",
  "updateCitation": true,
  "newSectionNumber": "Article I"
}

AFTER:
┌─────────────────────────────────────────┐
│ Article I - Members and Eligibility     │  ← Title changed
│ Section Number: "Article I"             │
│ Title: "Members and Eligibility"        │
└─────────────────────────────────────────┘
```

### 5. DELETE SECTION

```
BEFORE:
Article I
  ├── Section 1 (Ord: 1)
  ├── Section 2 (Ord: 2) ❌ DELETE THIS
  │    ├── (a) Subsection (Ord: 1)  ← Cascade delete children
  │    └── (b) Subsection (Ord: 2)
  └── Section 3 (Ord: 3)

AFTER:
Article I
  ├── Section 1 (Ord: 1)
  └── Section 2 (Ord: 2)  ← Was Section 3, ordinal decremented
      (was Section 3)

DELETED:
• Section 2 (ID: B)
• Subsection (a) (ID: C) ← CASCADE
• Subsection (b) (ID: D) ← CASCADE
• Workflow states for all 3 sections
• Suggestions (if preserveSuggestions: false)
```

---

## PRIORITY 6: Workflow State Protection

```
┌─────────────────────────────────────────────────────────────────┐
│              SECTION EDITING WORKFLOW SAFETY                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ User Request │
│ Edit Section │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────┐
│ Check Workflow State         │
│                              │
│ SELECT status                │
│ FROM section_workflow_states │
│ WHERE section_id = ?         │
└──────┬───────────────────────┘
       │
       ↓
   ┌───────┐
   │ Locked?│
   └───┬───┴──┐
       │ YES  │ NO
       ↓      ↓
┌───────────┐ ┌───────────────────┐
│ ❌ REJECT │ │ ✅ ALLOW EDIT    │
│           │ │                   │
│ 403 Error │ │ • Split           │
│ "Section  │ │ • Join            │
│  is locked│ │ • Move            │
│  by       │ │ • Retitle         │
│  workflow"│ │ • Delete          │
└───────────┘ └───────────────────┘

WORKFLOW STATES:
• pending     → ✅ Can edit
• in_progress → ✅ Can edit
• approved    → ⚠️  Can edit (but warn)
• locked      → ❌ Cannot edit
• rejected    → ✅ Can edit
```

---

## PRIORITY 6: Database Helper Functions Needed

```sql
-- Function 1: Increment sibling ordinals after insert
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_document_id UUID,
  p_parent_id UUID,
  p_start_ordinal INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal + 1
  WHERE document_id = p_document_id
    AND parent_section_id = p_parent_id
    AND ordinal >= p_start_ordinal;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Decrement sibling ordinals after delete
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_document_id UUID,
  p_parent_id UUID,
  p_start_ordinal INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_sections
  SET ordinal = ordinal - 1
  WHERE document_id = p_document_id
    AND parent_section_id = p_parent_id
    AND ordinal >= p_start_ordinal;
END;
$$ LANGUAGE plpgsql;

-- Function 3: Renumber all sections in document
CREATE OR REPLACE FUNCTION renumber_document_sections(
  p_document_id UUID
)
RETURNS VOID AS $$
DECLARE
  section RECORD;
  new_number TEXT;
BEGIN
  FOR section IN
    SELECT id, path_ordinals
    FROM document_sections
    WHERE document_id = p_document_id
    ORDER BY path_ordinals
  LOOP
    new_number := array_to_string(section.path_ordinals, '.');
    UPDATE document_sections
    SET section_number = new_number
    WHERE id = section.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## IMPLEMENTATION EFFORT ESTIMATES

```
┌─────────────────────────────────────────────────────────────────┐
│                   EFFORT ESTIMATION MATRIX                       │
└─────────────────────────────────────────────────────────────────┘

PRIORITY 5: Configuration Update
┌──────────────────┬──────────┬──────────┬───────────┐
│ Task             │ Effort   │ Impact   │ Priority  │
├──────────────────┼──────────┼──────────┼───────────┤
│ Add 8 levels     │ 1 hour   │ HIGH     │ ⭐⭐⭐⭐⭐ │
│ Test parsing     │ 1 hour   │ MEDIUM   │ ⭐⭐⭐⭐   │
│ Document config  │ 30 min   │ LOW      │ ⭐⭐⭐    │
├──────────────────┼──────────┼──────────┼───────────┤
│ TOTAL P5         │ 2.5 hrs  │ HIGH     │ IMMEDIATE │
└──────────────────┴──────────┴──────────┴───────────┘

PRIORITY 6: Section CRUD Operations
┌─────────────────────┬──────────┬──────────┬───────────┐
│ Task                │ Effort   │ Impact   │ Priority  │
├─────────────────────┼──────────┼──────────┼───────────┤
│ DB helper functions │ 2 hours  │ HIGH     │ ⭐⭐⭐⭐⭐ │
│ Split API route     │ 3 hours  │ HIGH     │ ⭐⭐⭐⭐⭐ │
│ Join API route      │ 3 hours  │ HIGH     │ ⭐⭐⭐⭐⭐ │
│ Move API route      │ 4 hours  │ MEDIUM   │ ⭐⭐⭐⭐   │
│ Retitle API route   │ 1 hour   │ LOW      │ ⭐⭐⭐    │
│ Delete API route    │ 2 hours  │ MEDIUM   │ ⭐⭐⭐⭐   │
│ Integration tests   │ 4 hours  │ HIGH     │ ⭐⭐⭐⭐   │
│ Admin UI (tree)     │ 8 hours  │ HIGH     │ ⭐⭐⭐⭐⭐ │
│ Inline editing      │ 6 hours  │ MEDIUM   │ ⭐⭐⭐⭐   │
│ Drag-and-drop       │ 8 hours  │ MEDIUM   │ ⭐⭐⭐    │
│ Confirm dialogs     │ 2 hours  │ LOW      │ ⭐⭐⭐    │
├─────────────────────┼──────────┼──────────┼───────────┤
│ TOTAL P6            │ 43 hrs   │ HIGH     │ 1-2 weeks │
│                     │ (5.4 days)│          │           │
└─────────────────────┴──────────┴──────────┴───────────┘

RECOMMENDED PHASING:
┌─────────┬──────────────────────────────┬──────────┐
│ Phase   │ Deliverables                 │ Duration │
├─────────┼──────────────────────────────┼──────────┤
│ Phase 1 │ P5: Config update + tests    │ 3 hours  │
│ Phase 2 │ P6: DB helpers + API routes  │ 2 days   │
│ Phase 3 │ P6: Admin UI basic           │ 3 days   │
│ Phase 4 │ P6: Advanced UI features     │ 2 days   │
└─────────┴──────────────────────────────┴──────────┘
```

---

## FILES TO CREATE/MODIFY

```
PRIORITY 5: ✅ Configuration (2 files)
├── src/config/organizationConfig.js     [MODIFY] Add depth 2-9 levels
└── docs/HIERARCHY_CONFIGURATION.md      [CREATE] Document config options

PRIORITY 6: ⚠️ Section CRUD (8 files)
├── database/migrations/
│   └── 013_section_admin_helpers.sql    [CREATE] Helper functions
├── src/routes/
│   └── admin.js                         [MODIFY] Add CRUD routes
├── views/admin/
│   └── section-editor.ejs               [CREATE] Admin UI template
├── public/js/
│   └── section-editor.js                [CREATE] Frontend logic
├── tests/integration/
│   └── admin-section-crud.test.js       [CREATE] API tests
├── tests/unit/
│   └── section-operations.test.js       [CREATE] Unit tests
└── docs/
    ├── SECTION_EDITING_GUIDE.md         [CREATE] User documentation
    └── SECTION_CRUD_API.md              [CREATE] API reference
```

---

## SUCCESS METRICS

```
PRIORITY 5: Configuration Success Criteria
┌─────────────────────────────────────────────┐
│ ✅ Parser detects 10-level hierarchies      │
│ ✅ Database accepts depth 10 sections       │
│ ✅ Numbering formats 1.2.3.4.5.6.7.8.9.10   │
│ ✅ UI renders 10-level tree correctly       │
│ ✅ Materialized paths calculate for depth 10│
└─────────────────────────────────────────────┘

PRIORITY 6: CRUD Operations Success Criteria
┌─────────────────────────────────────────────┐
│ ✅ Split preserves workflow states          │
│ ✅ Join merges suggestions correctly        │
│ ✅ Move recalculates paths automatically    │
│ ✅ Delete prevents locked sections          │
│ ✅ Retitle updates citations                │
│ ✅ Ordinals maintain sequential order       │
│ ✅ UI provides clear feedback               │
│ ✅ Undo/redo for destructive operations     │
└─────────────────────────────────────────────┘
```

---

## ANALYST CONCLUSION

**P5**: ✅ System architecture FULLY SUPPORTS 10-level depth. Only configuration update needed.

**P6**: ⚠️ Admin infrastructure EXISTS. CRUD operations need 5-7 days implementation.

**Recommendation**: Implement P5 immediately (half-day), schedule P6 for next sprint (1 week).

**Report Files**:
- Full Analysis: `/docs/reports/P5-P6-ANALYSIS.md`
- Summary: `/docs/reports/P5-P6-FINDINGS-SUMMARY.md`
- Visual Guide: `/docs/reports/P5-P6-VISUAL-SUMMARY.md` (this file)
