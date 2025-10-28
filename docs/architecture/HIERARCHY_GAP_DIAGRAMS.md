# Hierarchy Gap Resolution - Visual Architecture Diagrams

**Companion Document to:** HIERARCHY_GAP_RESOLUTION_DESIGN.md
**Date:** 2025-10-27

---

## System Component Interaction Diagrams

### Current State: Hierarchy Gap Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT UPLOAD FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

User uploads DOCX/PDF
        │
        ▼
┌──────────────────┐
│ wordParser.js    │  Extracts text and basic structure
│ textParser.js    │  Detects numbering patterns
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ hierarchyDetector.js                         │
│ - detectHierarchy()                          │
│ - validateHierarchy()                        │
│   ⚠️ Allows depth jumps (line 354-362)      │
│   Result: WARNING, not ERROR                 │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ sectionStorage.js                            │
│ - buildHierarchy()                           │
│   Uses document_order to build parent chain  │
│   ✅ Preserves depth from parser             │
│ - storeSections()                            │
│   Inserts sections with gaps intact          │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ PostgreSQL: document_sections                │
│ ┌────────────────────────────────────────┐  │
│ │ id  | parent_id | depth | section_#   │  │
│ ├────────────────────────────────────────┤  │
│ │ 1   | NULL      |   0   | Article I   │  │
│ │ 2   | 1         |   3   | (a)         │  │ ⚠️ GAP: missing depths 1, 2
│ │ 3   | 2         |   4   | (i)         │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ Trigger: update_section_path()               │
│ - Preserves parser depth (migration 025)    │
│ - Calculates path_ids, path_ordinals        │
└──────────────────────────────────────────────┘

Result: Database contains sections with depth gaps
User editing operations (indent/dedent) fail on these sections
```

---

## Option 1: Auto-Create Missing Levels - Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                   USER ACTION: Indent Section                       │
└─────────────────────────────────────────────────────────────────────┘

User clicks [→] on section
        │
        ▼
┌──────────────────────────────────────────────┐
│ POST /admin/sections/:id/indent              │
│ - validateSectionEditable (middleware)       │
│ - findPreviousSibling()                      │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ detectHierarchyGap()                         │
│                                              │
│ Current depth: 3                             │
│ Target depth: 1 (previous sibling depth + 1) │
│ Gap size: |3 - 1| = 2                        │
│                                              │
│ Missing depths: [2]                          │
└────────┬─────────────────────────────────────┘
         │
         ├─ NO GAP ─────────────┐
         │                      ▼
         │              Standard indent operation
         │              (update parent_section_id, depth)
         │
         └─ HAS GAP ───────────┐
                                ▼
                ┌───────────────────────────────────────┐
                │ createPlaceholderSections()           │
                │                                       │
                │ For each missing depth:               │
                │   1. Get hierarchy level config       │
                │   2. Generate placeholder:            │
                │      - section_number: [Auto-Level]   │
                │      - section_title: (Auto-created)  │
                │      - metadata: {auto_created: true} │
                │   3. Insert into database             │
                │   4. Link parent → placeholder        │
                │                                       │
                │ Result: Chain of placeholders         │
                │   Article I (depth 0)                 │
                │     └─ [Auto-Section] (depth 1) ✨    │
                │         └─ [Auto-Subsection] (depth 2)│
                │             └─ (a) Original (depth 3) │
                └───────────────────────────────────────┘
                                │
                                ▼
                ┌───────────────────────────────────────┐
                │ Response to User:                     │
                │ {                                     │
                │   success: true,                      │
                │   autoCreated: 2,                     │
                │   message: "2 sections auto-created"  │
                │ }                                     │
                └───────────────────────────────────────┘
                                │
                                ▼
                ┌───────────────────────────────────────┐
                │ UI: Highlight auto-created sections   │
                │                                       │
                │ [Auto-Section 1] ⚡ Auto-created      │
                │   [Customize]                         │
                └───────────────────────────────────────┘
```

---

## Option 2: Hierarchy Repair Tool - Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                  HIERARCHY REPAIR TOOL WORKFLOW                     │
└─────────────────────────────────────────────────────────────────────┘

Step 1: USER INITIATES REPAIR
│
├─ User clicks "Fix Hierarchy" button in document header
│
▼
┌──────────────────────────────────────────────┐
│ GET /admin/documents/:docId/hierarchy/analyze│
│                                              │
│ 1. Fetch all sections (ordered by doc_order)│
│ 2. Iterate through sections                 │
│ 3. Track depth progression                  │
│ 4. Detect jumps:                             │
│    IF depth - prev_depth > 1 THEN gap found  │
│                                              │
│ Result:                                      │
│ {                                            │
│   gaps_found: 3,                             │
│   gaps: [                                    │
│     {                                        │
│       section_id: "uuid-2",                  │
│       section_number: "(a)",                 │
│       current_depth: 3,                      │
│       expected_depth: 1,                     │
│       missing_depths: [1, 2]                 │
│     },                                       │
│     ...                                      │
│   ]                                          │
│ }                                            │
└────────┬─────────────────────────────────────┘
         │
         ▼
Step 2: GENERATE REPAIR PREVIEW
│
▼
┌──────────────────────────────────────────────┐
│ POST /hierarchy/repair-preview               │
│                                              │
│ For each gap:                                │
│   - Get document hierarchy config            │
│   - For each missing depth:                  │
│     * Find level definition (depth → level)  │
│     * Generate suggested number & title      │
│     * Build placeholder spec                 │
│                                              │
│ Result:                                      │
│ {                                            │
│   repair_plan: [                             │
│     {                                        │
│       after_section: "Article I",            │
│       child_section: "(a)",                  │
│       placeholders: [                        │
│         {                                    │
│           depth: 1,                          │
│           level_name: "Section",             │
│           suggested_number: "Section 1",     │
│           suggested_title: "(Untitled)"      │
│         },                                   │
│         {                                    │
│           depth: 2,                          │
│           level_name: "Subsection",          │
│           suggested_number: "(A)",           │
│           suggested_title: "(Untitled)"      │
│         }                                    │
│       ]                                      │
│     }                                        │
│   ]                                          │
│ }                                            │
└────────┬─────────────────────────────────────┘
         │
         ▼
Step 3: USER REVIEWS & CUSTOMIZES
│
▼
┌────────────────────────────────────────────────────────────┐
│ MODAL: Hierarchy Repair                                   │
│ ┌────────────────────────────────────────────────────────┐│
│ │ ⚠️ Found 3 hierarchy gap(s)                            ││
│ │                                                        ││
│ │ Gap 1: After "Article I" → Before "(a)"               ││
│ │ ┌──────────────────────────────────────────────────┐  ││
│ │ │ Missing: Section (depth 1)                       │  ││
│ │ │ Number: [Section 1     ] ← user edits            │  ││
│ │ │ Title:  [First Section ] ← user edits            │  ││
│ │ │                                                  │  ││
│ │ │ Missing: Subsection (depth 2)                    │  ││
│ │ │ Number: [(A)           ] ← user edits            │  ││
│ │ │ Title:  [General       ] ← user edits            │  ││
│ │ └──────────────────────────────────────────────────┘  ││
│ │                                                        ││
│ │ [Cancel] [Apply Repairs (create 6 sections)]          ││
│ └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
         │
         │ User customizes numbers/titles
         │ User clicks "Apply Repairs"
         │
         ▼
Step 4: EXECUTE REPAIR
│
▼
┌──────────────────────────────────────────────┐
│ POST /hierarchy/repair                       │
│                                              │
│ Request body:                                │
│ {                                            │
│   repairs: [                                 │
│     {                                        │
│       gap_id: "gap-1",                       │
│       child_section_id: "uuid-2",            │
│       placeholders: [                        │
│         {                                    │
│           depth: 1,                          │
│           section_number: "Section 1",       │
│           section_title: "First Section",    │
│           section_type: "section"            │
│         },                                   │
│         { depth: 2, ... }                    │
│       ]                                      │
│     }                                        │
│   ]                                          │
│ }                                            │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ Database Transaction (atomic)                │
│                                              │
│ BEGIN;                                       │
│                                              │
│ For each gap repair:                         │
│   parent_id = NULL                           │
│   For each placeholder in order:             │
│     INSERT INTO document_sections (          │
│       parent_section_id = parent_id,         │
│       depth = placeholder.depth,             │
│       section_number = user_input,           │
│       section_title = user_input,            │
│       metadata = {created_by_repair: true}   │
│     )                                        │
│     parent_id = new_section.id               │
│                                              │
│   UPDATE document_sections                   │
│   SET parent_section_id = parent_id          │
│   WHERE id = child_section_id                │
│                                              │
│ COMMIT;                                      │
│                                              │
│ Result: Hierarchy gaps filled                │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ UI: Success & Reload                         │
│                                              │
│ ✅ Hierarchy repaired successfully!          │
│ Created 6 new sections.                      │
│                                              │
│ [Reload Document]                            │
└──────────────────────────────────────────────┘
```

---

## Option 3: Smart Indent - Interaction Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SMART INDENT WORKFLOW                           │
└─────────────────────────────────────────────────────────────────────┘

User selects section: (a) First subparagraph (depth 3)
User clicks [→] indent button
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│ Frontend: onIndentButtonClick()                            │
│                                                            │
│ 1. Get current section data                               │
│ 2. Find previous sibling                                  │
│ 3. Calculate target depth = prev_sibling.depth + 1        │
│ 4. Fetch document hierarchy config                        │
│ 5. Build depth level options (target_depth to 9)          │
│ 6. Show modal                                             │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│ MODAL: Smart Indent                                       │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Current section: (a) First subparagraph                ││
│ │ Current depth: 3                                       ││
│ │ Previous sibling: Article I                           ││
│ │                                                        ││
│ │ Select target depth:                                  ││
│ │ ┌────────────────────────────────────────────────┐   ││
│ │ │ ▼ Depth 1: Section (standard indent)           │   ││
│ │ │   Depth 2: Subsection                          │   ││
│ │ │   Depth 3: Paragraph                           │   ││
│ │ │   Depth 4: Subparagraph                        │   ││
│ │ └────────────────────────────────────────────────┘   ││
│ │                                                        ││
│ │ [Cancel] [Indent]                                     ││
│ └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
         │
         │ User selects "Depth 2: Subsection"
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│ Event: targetDepthSelect.onChange()                       │
│                                                            │
│ Current depth: 3                                           │
│ Selected depth: 2                                          │
│ Gap size: |3 - 2| = 1 ✅ No gap                           │
│                                                            │
│ → Keep modal simple, no placeholder inputs                │
└────────────────────────────────────────────────────────────┘
         │
         │ Now user changes to "Depth 4: Subparagraph"
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│ Event: targetDepthSelect.onChange()                       │
│                                                            │
│ Current depth: 3                                           │
│ Selected depth: 5                                          │
│ Gap size: 5 - 3 = 2 ⚠️ GAP DETECTED                       │
│ Missing depths: [4]                                        │
│                                                            │
│ → Show placeholder customization section                  │
└────────┬───────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│ MODAL UPDATES: Show placeholder inputs                    │
│ ┌────────────────────────────────────────────────────────┐│
│ │ Select target depth:                                  ││
│ │ ┌────────────────────────────────────────────────┐   ││
│ │ │ Depth 5: Item                               ▼  │   ││
│ │ └────────────────────────────────────────────────┘   ││
│ │                                                        ││
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ││
│ │                                                        ││
│ │ Customize intermediate levels:                        ││
│ │                                                        ││
│ │ Depth 4: Subparagraph                                 ││
│ │ ┌────────────────┬───────────────────────────────┐   ││
│ │ │ Number:        │ Title:                        │   ││
│ │ │ [(1)        ]  │ [(Untitled Subparagraph)   ]  │   ││
│ │ └────────────────┴───────────────────────────────┘   ││
│ │                                                        ││
│ │ [Cancel] [Indent (create 1 section)]                  ││
│ └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
         │
         │ User customizes placeholder, clicks "Indent"
         │
         ▼
┌────────────────────────────────────────────────┐
│ POST /admin/sections/:id/indent                │
│                                                │
│ Request body:                                  │
│ {                                              │
│   targetDepth: 5,                              │
│   customTitles: [                              │
│     {                                          │
│       depth: 4,                                │
│       section_number: "(1)",                   │
│       section_title: "General Provisions"      │
│     }                                          │
│   ]                                            │
│ }                                              │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ Backend: createIntermediateLevels()            │
│                                                │
│ 1. Validate targetDepth                        │
│ 2. Calculate missing depths [4]                │
│ 3. For each missing depth:                     │
│    - Get custom title or use default           │
│    - Insert placeholder section                │
│    - Link parent chain                         │
│ 4. Update original section                     │
│    - parent_section_id = last_placeholder.id   │
│    - depth = 5                                 │
│                                                │
│ Result:                                        │
│   Article I (depth 0)                          │
│     └─ (1) General Provisions (depth 4) ✨     │
│         └─ (a) First subparagraph (depth 5)    │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ Response:                                      │
│ {                                              │
│   success: true,                               │
│   message: "Indented 2 levels",                │
│   placeholders_created: 1,                     │
│   new_depth: 5                                 │
│ }                                              │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ UI: Reload & Highlight                         │
│                                                │
│ ✅ Section indented successfully!              │
│ Created 1 intermediate section.                │
│                                                │
│ Document tree updates:                         │
│ Article I                                      │
│   (1) General Provisions [NEW] 🟡             │
│     (a) First subparagraph                     │
└────────────────────────────────────────────────┘
```

---

## Option 4: Relaxed Hierarchy - Schema Changes

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RELAXED HIERARCHY APPROACH                       │
└─────────────────────────────────────────────────────────────────────┘

PHILOSOPHY: Gaps are valid, not errors

┌──────────────────────────────────────────────┐
│ Database Schema (BEFORE)                     │
├──────────────────────────────────────────────┤
│ CREATE TABLE document_sections (             │
│   id UUID PRIMARY KEY,                       │
│   parent_section_id UUID REFERENCES ...,     │
│   depth INTEGER CHECK (depth >= 0 AND        │
│                        depth <= 9),          │
│   ordinal INTEGER CHECK (ordinal >= 1),      │
│   ...                                        │
│ );                                           │
│                                              │
│ Constraint: implicit expectation that        │
│   child.depth = parent.depth + 1             │
│   (enforced by trigger)                      │
└──────────────────────────────────────────────┘
                    │
                    │ Migration 027
                    ▼
┌──────────────────────────────────────────────┐
│ Database Schema (AFTER)                      │
├──────────────────────────────────────────────┤
│ -- No changes to table structure             │
│ -- Only trigger logic changes                │
│                                              │
│ CREATE OR REPLACE FUNCTION                   │
│ update_section_path()                        │
│ RETURNS TRIGGER AS $$                        │
│ BEGIN                                        │
│   IF NEW.parent_section_id IS NULL THEN      │
│     NEW.depth := 0;                          │
│   ELSE                                       │
│     SELECT p.depth                           │
│     INTO parent_depth                        │
│     FROM document_sections p                 │
│     WHERE p.id = NEW.parent_section_id;      │
│                                              │
│     -- ✅ CHANGE: Allow ANY depth >= parent  │
│     IF NEW.depth IS NOT NULL THEN            │
│       -- Preserve explicit depth             │
│       -- No validation!                      │
│     ELSE                                     │
│       NEW.depth := parent_depth + 1;         │
│     END IF;                                  │
│   END IF;                                    │
│   RETURN NEW;                                │
│ END;                                         │
│ $$ LANGUAGE plpgsql;                         │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│ VALID DOCUMENT STRUCTURE (AFTER)             │
├──────────────────────────────────────────────┤
│ id | parent_id | depth | section_number      │
│────┼───────────┼───────┼────────────────────│
│ 1  | NULL      |   0   | Article I           │
│ 2  | 1         |   3   | (a)                 │ ✅ Gap allowed
│ 3  | 1         |   7   | (i)                 │ ✅ Gap allowed
│ 4  | 2         |   9   | Point 1             │ ✅ Gap allowed
│                                              │
│ Tree representation:                         │
│ Article I (depth 0)                          │
│   ├─ (a) (depth 3)       ⋮ gap              │
│   │   └─ Point 1 (depth 9)  ⋮ gap           │
│   └─ (i) (depth 7)           ⋮ gap          │
│                                              │
│ Citation format:                             │
│   Article I.(a).Point 1                      │
│   (skips missing level names)                │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│ UI Visualization                             │
├──────────────────────────────────────────────┤
│ Table of Contents:                           │
│                                              │
│ Article I                                    │
│   ⋮ (gap indicator)                          │
│   ⋮                                          │
│   (a) First item [depth 0→3]                 │
│     ⋮                                        │
│     ⋮                                        │
│     ⋮                                        │
│     Point 1 [depth 3→9]                      │
│                                              │
│ CSS styling:                                 │
│ .toc-item[data-depth-gap="true"]::before {   │
│   content: "⋮";                              │
│   color: #6c757d;                            │
│ }                                            │
└──────────────────────────────────────────────┘
```

---

## Comparative Decision Tree

```
                         Hierarchy Gap Detected
                                 │
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Auto-Create   │    │ User-Guided  │    │ Allow Gaps   │
    │ (Option 1)    │    │ Repair       │    │ (Option 4)   │
    └───────┬───────┘    │ (Option 2+3) │    └──────┬───────┘
            │            └──────┬───────┘           │
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Automatic     │    │ Manual       │    │ No action    │
    │ placeholder   │    │ review &     │    │ needed       │
    │ insertion     │    │ customize    │    │              │
    └───────┬───────┘    └──────┬───────┘    └──────┬───────┘
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Pros:         │    │ Pros:        │    │ Pros:        │
    │ • Automatic   │    │ • User ctrl  │    │ • Simple     │
    │ • Fast        │    │ • Accurate   │    │ • Flexible   │
    │               │    │ • Educational│    │              │
    │ Cons:         │    │              │    │ Cons:        │
    │ • Surprising  │    │ Cons:        │    │ • Confusing  │
    │ • Clutter     │    │ • Manual     │    │ • Odd cites  │
    └───────┬───────┘    │ • UI complex │    └──────┬───────┘
            │            └──────┬───────┘           │
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐    ┌──────────────┐    ┌──────────────┐
    │ Use Case:     │    │ Use Case:    │    │ Use Case:    │
    │ • Live edit   │    │ • Upload fix │    │ • Intentional│
    │ • Quick fix   │    │ • Batch ops  │    │   gaps       │
    │               │    │ • Manual edit│    │ • Custom docs│
    └───────────────┘    └──────────────┘    └──────────────┘

    RECOMMENDATION: Option 2 + 3 (User-Guided)
                    ─────────────────────────
                    Best balance of control,
                    accuracy, and user experience
```

---

## Data Structure Evolution

### Before Repair (Gaps Present)

```
document_sections table:

┌──────┬───────────────┬───────┬───────────┬──────────────────────┐
│ id   │ parent_id     │ depth │ ordinal   │ section_number       │
├──────┼───────────────┼───────┼───────────┼──────────────────────┤
│ uuid1│ NULL          │   0   │    1      │ Article I            │
│ uuid2│ uuid1         │   3   │    1      │ (a)                  │ ⚠️ Gap
│ uuid3│ uuid2         │   4   │    1      │ (i)                  │
│ uuid4│ NULL          │   0   │    2      │ Article II           │
│ uuid5│ uuid4         │   2   │    1      │ (A)                  │ ⚠️ Gap
└──────┴───────────────┴───────┴───────────┴──────────────────────┘

Hierarchy Tree:

Article I (depth 0)
  └─ (a) (depth 3)               ← Missing depths 1, 2
      └─ (i) (depth 4)

Article II (depth 0)
  └─ (A) (depth 2)               ← Missing depth 1

Total gaps: 2
Total missing sections: 3 (depth 1 for Art I, depths 1&2 for Art I.a, depth 1 for Art II)
```

### After Repair (Gaps Filled)

```
document_sections table:

┌──────┬───────────────┬───────┬───────────┬──────────────────────┬────────────────┐
│ id   │ parent_id     │ depth │ ordinal   │ section_number       │ metadata       │
├──────┼───────────────┼───────┼───────────┼──────────────────────┼────────────────┤
│ uuid1│ NULL          │   0   │    1      │ Article I            │ {}             │
│ uuid6│ uuid1         │   1   │    1      │ Section 1            │ {repaired}     │ ✨ NEW
│ uuid7│ uuid6         │   2   │    1      │ (A)                  │ {repaired}     │ ✨ NEW
│ uuid2│ uuid7         │   3   │    1      │ (a)                  │ {}             │
│ uuid3│ uuid2         │   4   │    1      │ (i)                  │ {}             │
│ uuid4│ NULL          │   0   │    2      │ Article II           │ {}             │
│ uuid8│ uuid4         │   1   │    1      │ Section 1            │ {repaired}     │ ✨ NEW
│ uuid5│ uuid8         │   2   │    1      │ (A)                  │ {}             │
└──────┴───────────────┴───────┴───────────┴──────────────────────┴────────────────┘

Hierarchy Tree:

Article I (depth 0)
  └─ Section 1 (depth 1) ✨
      └─ (A) (depth 2) ✨
          └─ (a) (depth 3)
              └─ (i) (depth 4)

Article II (depth 0)
  └─ Section 1 (depth 1) ✨
      └─ (A) (depth 2)

Total gaps: 0 ✅
Total new sections: 3
All gaps filled!
```

---

## Component Architecture (Recommended Solution)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐       ┌──────────────────────┐          │
│  │ document-viewer.ejs  │       │ hierarchy-repair.js  │          │
│  │                      │       │                      │          │
│  │ • Fix Hierarchy btn  │◄──────┤ • analyzeHierarchy() │          │
│  │ • Smart Indent btn   │       │ • renderRepairModal()│          │
│  │ • Section tree UI    │       │ • applyRepair()      │          │
│  └──────────┬───────────┘       └──────────┬───────────┘          │
│             │                               │                       │
│             └───────────────┬───────────────┘                       │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              │ HTTP REST API
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                         BACKEND LAYER                               │
├─────────────────────────────┼───────────────────────────────────────┤
│                             ▼                                       │
│  ┌────────────────────────────────────────────────────────┐        │
│  │ /src/routes/admin.js                                   │        │
│  │                                                        │        │
│  │ GET  /documents/:id/hierarchy/analyze                  │        │
│  │ POST /documents/:id/hierarchy/repair-preview           │        │
│  │ POST /documents/:id/hierarchy/repair                   │        │
│  │ POST /sections/:id/indent (enhanced)                   │        │
│  └────────────┬───────────────────────────┬───────────────┘        │
│               │                           │                         │
│               ▼                           ▼                         │
│  ┌────────────────────────┐  ┌──────────────────────────┐         │
│  │ hierarchyAnalyzer.js   │  │ hierarchyOperations.js   │         │
│  │                        │  │                          │         │
│  │ • analyzeGaps()        │  │ • createPlaceholders()   │         │
│  │ • generatePreview()    │  │ • updateParentChain()    │         │
│  │ • validateRepair()     │  │ • shiftOrdinals()        │         │
│  └────────┬───────────────┘  └──────────┬───────────────┘         │
│           │                              │                          │
│           └──────────────┬───────────────┘                          │
│                          │                                          │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           │ Supabase Client
                           │
┌──────────────────────────┼──────────────────────────────────────────┐
│                      DATABASE LAYER                                 │
├──────────────────────────┼──────────────────────────────────────────┤
│                          ▼                                          │
│  ┌────────────────────────────────────────────────────────┐        │
│  │ PostgreSQL: document_sections                          │        │
│  │                                                        │        │
│  │ Triggers:                                              │        │
│  │ • update_section_path() - maintains path_ids           │        │
│  │ • validate_parent_document() - integrity check         │        │
│  │                                                        │        │
│  │ RPC Functions:                                         │        │
│  │ • increment_sibling_ordinals()                         │        │
│  │ • decrement_sibling_ordinals()                         │        │
│  │ • get_descendants()                                    │        │
│  └────────────────────────────────────────────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       DEPLOYMENT PIPELINE                           │
└─────────────────────────────────────────────────────────────────────┘

Development → Staging → Production

Step 1: Database Migration
│
├─ STAGING:
│   └─ Apply migration 027
│       • Add metadata columns
│       • Update triggers
│       • Test with sample data
│
└─ PRODUCTION:
    └─ Apply migration 027
        • Scheduled maintenance window
        • Zero downtime (additive changes only)

Step 2: Backend Deployment
│
├─ STAGING:
│   ├─ Deploy new services
│   │   • hierarchyAnalyzer.js
│   │   • hierarchyOperations.js
│   │
│   ├─ Deploy enhanced routes
│   │   • 3 new endpoints
│   │   • 1 modified endpoint
│   │
│   └─ Smoke tests
│       • Test repair on sample doc
│       • Test smart indent
│
└─ PRODUCTION:
    ├─ Blue/Green Deployment
    │   • Deploy to blue environment
    │   • Switch traffic gradually
    │
    └─ Monitoring
        • Error rate dashboards
        • Performance metrics

Step 3: Frontend Deployment
│
├─ STAGING:
│   ├─ Build static assets
│   │   npm run build
│   │
│   ├─ Deploy HTML/CSS/JS
│   │   • document-viewer.ejs
│   │   • hierarchy-repair.js
│   │   • smart-indent.js
│   │
│   └─ Browser testing
│       • Chrome, Firefox, Safari, Edge
│
└─ PRODUCTION:
    ├─ CDN deployment
    │   • Upload to S3/CloudFront
    │   • Cache invalidation
    │
    └─ Feature flag
        • Gradual rollout (10% → 50% → 100%)

Step 4: Verification
│
└─ Production health checks
    ├─ API endpoints responding
    ├─ No error spikes in logs
    ├─ Database performance stable
    └─ User acceptance testing
```

---

**End of Visual Architecture Diagrams**
**Total diagrams:** 8
**Companion to:** HIERARCHY_GAP_RESOLUTION_DESIGN.md
