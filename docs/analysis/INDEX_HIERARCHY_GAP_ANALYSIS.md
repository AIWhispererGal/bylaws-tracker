# Hierarchy Gap Analysis - Document Index

**Analysis Date:** 2025-10-27
**Topic:** Why indent/dedent operations cannot fix hierarchy gaps

---

## Overview

This analysis explains why the current indent/dedent/move operations in `/src/routes/admin.js` cannot fix documents with missing intermediate hierarchy levels (gaps).

**Example Gap:**
```
Article I (depth 0) → (a) Subparagraph (depth 3)
Missing: Section (depth 1), Subsection (depth 2)
```

---

## Analysis Documents

### 1. **INDENT_DEDENT_LIMITATIONS.md** (16 KB)
**Focus:** Detailed technical analysis of indent/dedent operations

**Contents:**
- How indent works (requires previous sibling)
- How dedent works (makes section sibling of parent)
- Why "previous sibling" requirement prevents fixing gaps
- Why "no parent" problem prevents dedent from working
- The chicken-and-egg problem (can't create intermediate levels without content)
- Scenarios that can't be fixed with current tools
- Code references and implementation details
- Recommendations for new features

**Key Findings:**
- Indent requires previous sibling at SAME depth → can't skip levels
- Dedent makes section sibling of parent → wrong depth calculation with gaps
- Move doesn't change depth → creates invalid tree structure
- "Ghost" parent sections won't work (missing content, numbers, document order)

**Read this if:** You need to understand the technical implementation details and code constraints.

---

### 2. **HIERARCHY_GAP_DIAGRAM.md** (12 KB)
**Focus:** Visual diagrams and examples of the gap problem

**Contents:**
- Visual tree diagrams showing correct vs incorrect hierarchy
- Step-by-step operation flows (what happens when you indent/dedent)
- Comparison matrix (what works vs what doesn't)
- Detailed scenario walkthroughs with before/after states
- The "missing feature" problem (need manual section creation)

**Key Diagrams:**
- Database state comparison (current wrong state vs desired correct state)
- Indent operation flow (why no sibling = failure)
- Dedent operation flow (why parent depth 0 = wrong result)
- Move operation flow (why depth stays unchanged)

**Read this if:** You need visual examples to understand how gaps break operations.

---

### 3. **TECHNICAL_CONSTRAINTS_SUMMARY.md** (14 KB)
**Focus:** Database constraints and fundamental limitations

**Contents:**
- Database constraint: `path_ids` length must equal depth + 1
- Indent constraint: "previous sibling" requirement
- Dedent constraint: "must have parent" requirement
- Move constraint: "depth is not updated" limitation
- Why "ghost sections" can't be auto-created
- Code flow analysis (step-by-step execution traces)
- What operations ARE possible (complete hierarchy scenarios)
- Recommendations for immediate actions and future features

**Key Constraints:**
```sql
-- path_ids length MUST match depth
CHECK (array_length(path_ids, 1) = depth + 1)

-- But with gaps:
path_ids = [article-uuid, ???, ???, subpara-uuid]
                         ↑    ↑
                   Missing parent UUIDs!
```

**Read this if:** You need to understand WHY the constraints exist and what they prevent.

---

## Quick Reference Guide

### Question: "Why can't I indent this section?"

**Answer:** Check `/docs/analysis/INDENT_DEDENT_LIMITATIONS.md`, Section 1: "How Indent Works"

**Key reason:** Indent requires a previous sibling at the same depth. If your section has a gap (e.g., depth 3 with no siblings), indent fails with "NO_SIBLING" error.

---

### Question: "Why does dedent put my section at the wrong depth?"

**Answer:** Check `/docs/analysis/HIERARCHY_GAP_DIAGRAM.md`, Section "Why Dedent Can't Fix It"

**Key reason:** Dedent makes your section a sibling of its parent. If parent is depth 0, dedent makes section depth 0 (not depth 1 as you might expect).

---

### Question: "Why doesn't move update the depth?"

**Answer:** Check `/docs/analysis/TECHNICAL_CONSTRAINTS_SUMMARY.md`, Section 4: "Move Constraint"

**Key reason:** Move operation only changes `parent_section_id` and `ordinal`. It doesn't recalculate depth. This was a design choice to keep the operation simple and fast.

---

### Question: "Why can't the system just create missing parent sections automatically?"

**Answer:** Check `/docs/analysis/TECHNICAL_CONSTRAINTS_SUMMARY.md`, Section "The Fundamental Problem: Ghost Sections"

**Key reasons:**
1. No content to store (`original_text` is REQUIRED NOT NULL)
2. Unknown section numbers (is it Section 1? Section 2?)
3. Unknown document order (where in the source document?)
4. User confusion (sections appear that user didn't write)

---

### Question: "What CAN I do to fix gaps?"

**Answer:** Check `/docs/analysis/INDENT_DEDENT_LIMITATIONS.md`, Section 8: "What Would Be Needed to Fix This"

**Current workaround (manual):**
1. Create missing parent sections manually (requires UI not yet implemented)
2. Move sections to correct parents
3. Dedent sections to correct depths

**Future features recommended:**
- Manual Section Creation UI
- "Fill Missing Levels" Wizard
- Move with Auto-Depth operation

---

## Code Locations

### Indent Implementation
- **File:** `/src/routes/admin.js`
- **Lines:** 2024-2149
- **Endpoint:** `POST /admin/sections/:id/indent`
- **Key Logic:** Lines 2050-2067 (previous sibling check)

### Dedent Implementation
- **File:** `/src/routes/admin.js`
- **Lines:** 2164-2282
- **Endpoint:** `POST /admin/sections/:id/dedent`
- **Key Logic:** Lines 2177-2183 (parent check), 2234-2238 (new parent/depth calculation)

### Move Implementation
- **File:** `/src/routes/admin.js`
- **Lines:** 1457-1619
- **Endpoint:** `PUT /admin/sections/:id/move`
- **Key Logic:** Lines 1507-1514 (update parent/ordinal), **NOTE:** depth NOT updated

### Hierarchy Building
- **File:** `/src/services/sectionStorage.js`
- **Lines:** 129-185
- **Function:** `buildHierarchy(sections)`
- **Key Logic:** Lines 138-158 (parent stack algorithm)

### Database Constraint
- **File:** `/database/migrations/026_fix_path_ids_constraint.sql`
- **Constraint:** `path_ids_length_matches_depth`
- **Definition:** `CHECK (array_length(path_ids, 1) = depth + 1)`

---

## Key Scenarios: Can It Be Fixed?

| Scenario | Gap Type | Indent | Dedent | Move | Manual Create |
|----------|----------|--------|--------|------|---------------|
| Article I → Section 1 | None (depth 0→1) | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Article I → (a) Subpara | Large (0→3, missing 1, 2) | ❌ No | ❌ No | ⚠️ Partial | ✅ Yes |
| Section 1 → (1) Para | Small (1→4, missing 2, 3) | ❌ No | ❌ No | ⚠️ Partial | ✅ Yes |
| Multiple gaps | Various | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Out-of-order depths | Structural | ❌ No | ❌ No | ❌ No | ✅ Yes |

**Legend:**
- ✅ Yes: Operation works correctly
- ❌ No: Operation fails or produces wrong result
- ⚠️ Partial: Operation partially works but doesn't fully solve problem

---

## Recommendations Summary

### Immediate Actions (No Code Changes)

1. **Add Upload Validation**
   - Detect depth gaps during document parsing
   - Warn user about sections with missing parents
   - Return list of sections that can't be indented/dedented

2. **Improve Error Messages**
   - Current: "Cannot indent: no earlier sibling to indent under"
   - Better: "Cannot indent: This section is at depth 3 with no parent at depth 2. Create the missing parent sections first using the hierarchy editor."

3. **Document the Limitation**
   - Add to user documentation
   - Add tooltips in UI explaining when indent/dedent won't work
   - Link to help articles about fixing gaps

### Short-Term Features (1-2 sprints)

1. **Manual Section Creation UI**
   - Add button: "Insert Section" at specific depths
   - Form fields: number, title, content, position (before/after)
   - Validation: ensure parent exists at depth-1
   - Update ordinals and document_order automatically

2. **Hierarchy Gap Detector**
   - Scan document for depth jumps
   - Show visual indicator in document viewer (e.g., "⚠️ Missing parent")
   - Link to hierarchy editor with pre-populated fixes

### Long-Term Features (3+ sprints)

1. **"Fill Missing Levels" Wizard**
   - Automated gap detection
   - Step-by-step prompts for each missing level
   - Preview before applying changes
   - Batch creation of multiple sections

2. **Move with Auto-Depth**
   - Extend move operation to recalculate depth based on new parent
   - Update all descendants recursively
   - Validate no new gaps will be created

3. **Enhanced Hierarchy Editor**
   - Visual tree view with drag-and-drop
   - Color-coded depth levels
   - Right-click menu: "Insert missing parent here"
   - Undo/redo support

---

## Testing Scenarios

### Test Case 1: Indent Section with Gap
```
SETUP:
- Article I (depth 0, ordinal 1)
- (a) Subparagraph (depth 3, ordinal 1)

ACTION: POST /admin/sections/{subpara-uuid}/indent

EXPECTED RESULT:
- HTTP 400 Bad Request
- Error: "Cannot indent: no earlier sibling to indent under"
- Code: "NO_SIBLING"

VERIFICATION:
- Section depth unchanged (still 3)
- Section parent unchanged (still Article I)
```

### Test Case 2: Dedent Section with Gap
```
SETUP:
- Article I (depth 0, ordinal 1, parent: NULL)
- (a) Subparagraph (depth 3, ordinal 1, parent: Article I)

ACTION: POST /admin/sections/{subpara-uuid}/dedent

EXPECTED RESULT:
- HTTP 200 OK
- Section depth = 0 (WARNING: Wrong! Should be 1)
- Section parent = NULL (root level)

VERIFICATION:
- Section is now root level (sibling of Article I)
- This is technically valid but semantically wrong
- User will need to dedent again... but can't (already at root)
```

### Test Case 3: Move Section with Gap
```
SETUP:
- Article I (depth 0)
  - Section 1 (depth 1)
- (a) Subparagraph (depth 3, parent: Article I)

ACTION: PUT /admin/sections/{subpara-uuid}/move
BODY: { "newParentId": "{section1-uuid}" }

EXPECTED RESULT:
- HTTP 200 OK
- Section parent = Section 1
- Section depth = 3 (UNCHANGED! This is the problem)

VERIFICATION:
- Tree structure: Section 1 (depth 1) → (a) (depth 3)
- Missing depth 2 between parent and child
- Tree is technically valid (passes constraints) but semantically wrong
```

---

## Glossary

**Depth:** The level of nesting in the hierarchy (0 = root/top level, 1 = first child level, etc.)

**Ordinal:** The position of a section among its siblings (1 = first sibling, 2 = second, etc.)

**Parent Section ID:** UUID reference to the section's immediate parent in the tree

**Path IDs:** Array of UUIDs representing the full path from root to this section (e.g., `[article-uuid, section-uuid, subsection-uuid, self-uuid]`)

**Document Order:** Sequential position in the original document (independent of hierarchy)

**Hierarchy Gap:** Missing intermediate levels between a section and its parent (e.g., depth 0 → depth 3 with no depth 1 or 2)

**Ghost Section:** A hypothetical auto-created section to fill a gap (not implemented because of content/numbering/order problems)

---

## Related Documents

- `/docs/COMPLETE_HIERARCHY_FIX_SUMMARY.md` - Earlier fix that resolved parent relationships (but didn't address gaps)
- `/docs/DEPTH_BUG_RESOLUTION.md` - Depth calculation bug fix
- `/docs/PATH_IDS_CONSTRAINT_FIX.md` - Database constraint migration
- `/database/migrations/026_fix_path_ids_constraint.sql` - The constraint that enforces path length = depth + 1

---

## Document Summary

| Document | Size | Focus | Best For |
|----------|------|-------|----------|
| **INDENT_DEDENT_LIMITATIONS.md** | 16 KB | Technical implementation | Developers understanding code constraints |
| **HIERARCHY_GAP_DIAGRAM.md** | 12 KB | Visual examples | Product managers, UX designers |
| **TECHNICAL_CONSTRAINTS_SUMMARY.md** | 14 KB | Database constraints | Database admins, architects |

**Total Analysis:** 42 KB of documentation covering:
- 3 main operations (indent, dedent, move)
- 5 key scenarios that can't be fixed
- 4 database constraints
- 3 recommended solutions
- 10+ code references with line numbers

---

**Last Updated:** 2025-10-27
**Prepared By:** Code Analyzer Agent
**Status:** Complete ✓
