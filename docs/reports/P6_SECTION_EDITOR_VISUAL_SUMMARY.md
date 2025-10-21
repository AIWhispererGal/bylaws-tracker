# P6: Section Editor - Visual Summary

**Quick Reference Guide for Implementation**

---

## 🎯 Operations Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECTION EDITOR OPERATIONS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1️⃣ SPLIT    - Divide one section into multiple sections       │
│  2️⃣ JOIN     - Merge adjacent sections into one                │
│  3️⃣ RETITLE  - Change title/numbering                          │
│  4️⃣ MOVE     - Change parent or reorder                        │
│  5️⃣ DELETE   - Remove section (with cascade)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         ADMIN UI LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Section Tree │  │ Split Modal  │  │ Join Dialog  │             │
│  │   Editor     │  │   Component  │  │   Component  │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│         └─────────────────┼─────────────────┘                       │
│                           │                                         │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ HTTP POST/PUT/DELETE
┌───────────────────────────┼─────────────────────────────────────────┐
│                    API ROUTES (/admin/sections)                     │
│  ┌──────────────────────┬┴────────────────────────────────────┐    │
│  │ POST   /split        │ PUT    /retitle                     │    │
│  │ POST   /join         │ PUT    /move                        │    │
│  │ DELETE /:id          │ GET    /tree                        │    │
│  └──────────────────────┴─────────────────────────────────────┘    │
│                           │                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │           VALIDATION MIDDLEWARE                          │      │
│  │  • validateSectionEditable() - Check workflow locks      │      │
│  │  • validateAdjacentSiblings() - Verify join candidates   │      │
│  │  • validateNoCircularReference() - Prevent cycles        │      │
│  └──────────────────────┬───────────────────────────────────┘      │
│                         │                                           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ Supabase RPC + Queries
┌─────────────────────────┼───────────────────────────────────────────┐
│                 DATABASE LAYER (PostgreSQL)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              HELPER FUNCTIONS                               │   │
│  │  • increment_sibling_ordinals()                             │   │
│  │  • decrement_sibling_ordinals()                             │   │
│  │  • relocate_suggestions()                                   │   │
│  │  • validate_section_editable()                              │   │
│  │  • recalculate_descendant_paths()                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                         │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    TABLES                                   │   │
│  │  document_sections (with materialized paths)                │   │
│  │  suggestion_sections (many-to-many)                         │   │
│  │  section_workflow_states (approval tracking)                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                         │                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              TRIGGER (Auto-Maintained)                      │   │
│  │  update_section_path() - Recalculates:                      │   │
│  │    • path_ids     [root_id, ..., self_id]                   │   │
│  │    • path_ordinals [1, 2, 3]                                │   │
│  │    • depth        (from parent)                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Operation Flow Diagrams

### 1️⃣ Split Section Flow

```
Before:                       After:
┌───────────────┐             ┌───────────────┐
│ Section 2     │             │ Section 2     │
│ ordinal: 2    │    SPLIT    │ ordinal: 2    │
│ text: "A+B"   │   ───────>  │ text: "A"     │
└───────────────┘             └───────────────┘
                              ┌───────────────┐
                              │ Section 3     │ ← NEW
                              │ ordinal: 3    │
                              │ text: "B"     │
                              └───────────────┘
                              ┌───────────────┐
│ Section 3     │             │ Section 4     │ ← Ordinal++
│ ordinal: 3    │             │ ordinal: 4    │
└───────────────┘             └───────────────┘

Steps:
1. Validate section editable (no workflow locks)
2. Increment ordinals of subsequent siblings
3. Update original section with first text part
4. Insert new section with second text part
5. Relocate suggestions based on strategy
6. Trigger recalculates paths automatically
```

### 2️⃣ Join Sections Flow

```
Before:                       After:
┌───────────────┐
│ Section 2     │             ┌───────────────┐
│ ordinal: 2    │             │ Section 2     │
│ text: "A"     │    JOIN     │ ordinal: 2    │
└───────────────┘   ───────>  │ text: "A\n\nB"│
┌───────────────┐             └───────────────┘
│ Section 3     │
│ ordinal: 3    │    DELETED
│ text: "B"     │
└───────────────┘
┌───────────────┐             ┌───────────────┐
│ Section 4     │             │ Section 3     │ ← Ordinal--
│ ordinal: 4    │             │ ordinal: 3    │
└───────────────┘             └───────────────┘

Steps:
1. Validate all sections editable
2. Verify sections are adjacent siblings
3. Merge text content with separator
4. Update first section with merged content
5. Relocate suggestions to first section
6. Delete other sections
7. Decrement ordinals of subsequent siblings
```

### 3️⃣ Move Section Flow

```
Before:                       After:
Article I                     Article I
├─ Section 1                  ├─ Section 1
├─ Section 2 ◄──┐             └─ (gap closed, ordinal--)
└─ Section 3    │
                │ MOVE
Article II      │             Article II
├─ Section 1    │             ├─ Section 2 ◄── Moved here
└─ Section 2    │             │   parent: Article II
                └─────────────┘   ordinal: 1 (space made)
                                ├─ Section 1 (now ordinal 2)
                                └─ Section 2 (now ordinal 3)

Steps:
1. Validate section editable
2. Validate new parent exists (same document)
3. Check for circular reference (not moving to own descendant)
4. Decrement ordinals in old parent (close gap)
5. Increment ordinals in new parent (make space)
6. Update section's parent_section_id and ordinal
7. Trigger recalculates path_ids, path_ordinals, depth
8. Recursively update all descendant paths
```

---

## 🗄️ Database Schema Visualization

```
document_sections
┌──────────────────┬──────────────────────────────────────────────┐
│ id               │ UUID PRIMARY KEY                             │
│ document_id      │ UUID (FK to documents)                       │
├──────────────────┼──────────────────────────────────────────────┤
│ HIERARCHY        │                                              │
├──────────────────┼──────────────────────────────────────────────┤
│ parent_section_id│ UUID (FK to document_sections, nullable)     │
│ ordinal          │ INTEGER (position among siblings)            │
│ depth            │ INTEGER (0=root, 1=child, ...)               │
├──────────────────┼──────────────────────────────────────────────┤
│ MATERIALIZED PATH│ (Auto-maintained by trigger)                 │
├──────────────────┼──────────────────────────────────────────────┤
│ path_ids         │ UUID[] [root, parent, ..., self]             │
│ path_ordinals    │ INTEGER[] [1, 2, 3] for Section 1.2.3       │
├──────────────────┼──────────────────────────────────────────────┤
│ DISPLAY          │                                              │
├──────────────────┼──────────────────────────────────────────────┤
│ section_number   │ VARCHAR(50) "1", "1.1", "I.A.3"             │
│ section_title    │ TEXT                                         │
│ section_type     │ VARCHAR(50) "article", "section", ...        │
├──────────────────┼──────────────────────────────────────────────┤
│ CONTENT          │                                              │
├──────────────────┼──────────────────────────────────────────────┤
│ original_text    │ TEXT                                         │
│ current_text     │ TEXT                                         │
│ metadata         │ JSONB                                        │
└──────────────────┴──────────────────────────────────────────────┘

CONSTRAINTS:
✓ UNIQUE(document_id, parent_section_id, ordinal)
✓ CHECK(depth >= 0 AND depth <= 10)
✓ CHECK(array_length(path_ids, 1) = depth + 1)
✓ CHECK(path_ids[last] = id)
✓ CHECK(ordinal > 0)

INDEXES:
✓ GIN index on path_ids (fast ancestor/descendant queries)
✓ B-tree on (parent_section_id, ordinal)
✓ B-tree on (document_id, depth)
```

---

## 🔐 Security Model

```
┌────────────────────────────────────────────────────────────────┐
│                    RLS POLICY LAYERS                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Organization Isolation                               │
│  ────────────────────────────────────────────────────────────  │
│  Users can only access sections in their organizations         │
│  ✓ RLS: user_organizations.organization_id = documents.org_id  │
│                                                                 │
│  Layer 2: Role-Based Access                                    │
│  ────────────────────────────────────────────────────────────  │
│  Only admins can edit sections                                 │
│  ✓ RLS: user_organizations.role IN ('admin', 'owner')          │
│                                                                 │
│  Layer 3: Workflow State Lock                                  │
│  ────────────────────────────────────────────────────────────  │
│  Sections with workflow status='locked' cannot be edited       │
│  ✓ Application: validate_section_editable() function           │
│                                                                 │
│  Layer 4: Global Admin Override                                │
│  ────────────────────────────────────────────────────────────  │
│  Global admins can edit any section                            │
│  ✓ RLS: user_organizations.is_global_admin = TRUE              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Suggestion Handling Matrix

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Operation   │   Strategy   │   Behavior   │    Result    │
├──────────────┼──────────────┼──────────────┼──────────────┤
│              │  "first"     │ All to first │ ● ● ●        │
│  SPLIT       │  "distribute"│ By position  │ ● ●   ●      │
│              │  "both"      │ Duplicate    │ ● ● ● ● ● ●  │
├──────────────┼──────────────┼──────────────┼──────────────┤
│              │  "merge"     │ All to merged│ ● ● ● ● ●    │
│  JOIN        │  "first"     │ First only   │ ● ●          │
│              │  "delete"    │ Delete all   │              │
├──────────────┼──────────────┼──────────────┼──────────────┤
│  MOVE        │  (auto)      │ Follow sect. │ ● ● ●  →     │
├──────────────┼──────────────┼──────────────┼──────────────┤
│              │  "delete"    │ Remove all   │              │
│  DELETE      │  "orphan"    │ Keep ref.    │ ● ● ● (!)    │
└──────────────┴──────────────┴──────────────┴──────────────┘

Legend: ● = Suggestion  (!) = Orphaned
```

---

## 🧪 Test Coverage Matrix

```
┌─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│  Operation  │  SPLIT   │   JOIN   │ RETITLE  │   MOVE   │  DELETE  │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Basic Op    │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
│ Suggestions │    ✓     │    ✓     │    -     │    ✓     │    ✓     │
│ Workflow    │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
│ Children    │    ✓     │    ✓     │    -     │    ✓     │    ✓     │
│ Ordinals    │    ✓     │    ✓     │    -     │    ✓     │    ✓     │
│ Paths       │    ✓     │    -     │    -     │    ✓     │    -     │
│ Edge Cases  │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
│ Rollback    │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
│ RLS         │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
│ Audit Log   │    ✓     │    ✓     │    ✓     │    ✓     │    ✓     │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Total Test Cases Required: 47
```

---

## ⚡ Performance Optimization

```
┌────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION STRATEGIES                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Batch Ordinal Updates                                      │
│     ❌ for (i = 0; i < siblings.length; i++)                   │
│           UPDATE SET ordinal = i + 1                           │
│     ✅ increment_sibling_ordinals(parent, start, count)        │
│        Single function call updates all in one query           │
│                                                                 │
│  2. Trigger-Based Path Calculation                             │
│     ✅ Paths auto-calculated on INSERT/UPDATE                  │
│     ❌ No manual recalculation needed for single moves         │
│     ⚠️  Only recalculate descendants on parent change          │
│                                                                 │
│  3. Index Usage                                                │
│     ✅ GIN index on path_ids for ancestor queries              │
│     ✅ B-tree on (parent_id, ordinal) for sibling queries      │
│     ✅ Composite index on (document_id, depth) for tree        │
│                                                                 │
│  4. Transaction Batching                                       │
│     ✅ Wrap multi-step operations in single transaction        │
│     ✅ Use SERIALIZABLE isolation for critical ops             │
│                                                                 │
│  5. Caching                                                    │
│     ✅ Cache section tree per document (TTL: 1 hour)           │
│     ✅ Invalidate cache on any section edit                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI Component Structure

```
┌────────────────────────────────────────────────────────────────┐
│              section-editor.ejs (Main Template)                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Document Header                          │   │
│  │  "Reseda Bylaws v2.0"                   [Edit Mode ▼]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Section Tree (Collapsible)                 │   │
│  │                                                          │   │
│  │  📄 Preamble                          [Edit] [Delete]    │   │
│  │  📑 Article I                         [Edit] [Delete]    │   │
│  │    ├─ 📝 Section 1                    [Split] [Join]     │   │
│  │    └─ 📝 Section 2                    [Edit] [Delete]    │   │
│  │  📑 Article II                        [Edit] [Delete]    │   │
│  │    ├─ 📝 Section 1                    [Edit] [Delete]    │   │
│  │    │   ├─ 📌 (a) Subsection           [Edit] [Delete]    │   │
│  │    │   └─ 📌 (b) Subsection           [Edit] [Delete]    │   │
│  │    └─ 📝 Section 2                    [Edit] [Delete]    │   │
│  │                                                          │   │
│  │  [+ Add Section at Root]                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     Modals (Hidden)                      │   │
│  │  • split-section-modal.ejs                               │   │
│  │  • join-sections-modal.ejs                               │   │
│  │  • retitle-section-modal.ejs                             │   │
│  │  • delete-confirmation-modal.ejs                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            JavaScript (section-editor.js)                │   │
│  │  • Tree rendering & collapsing                           │   │
│  │  • Drag-and-drop handlers                                │   │
│  │  • Modal interactions                                    │   │
│  │  • API calls (fetch)                                     │   │
│  │  • Real-time validation                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               CSS (section-editor.css)                   │   │
│  │  • Tree structure styles                                 │   │
│  │  • Modal overlays                                        │   │
│  │  • Button states                                         │   │
│  │  • Drag-and-drop visual feedback                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 📅 Implementation Timeline

```
Week 1: Backend Foundation
├─ Day 1: Database Functions
│  ├─ ✓ increment_sibling_ordinals()
│  ├─ ✓ decrement_sibling_ordinals()
│  ├─ ✓ relocate_suggestions()
│  ├─ ✓ validate_section_editable()
│  └─ ✓ recalculate_descendant_paths()
│
└─ Day 2: API Routes
   ├─ ✓ POST /admin/sections/:id/split
   ├─ ✓ POST /admin/sections/join
   ├─ ✓ PUT /admin/sections/:id/retitle
   ├─ ✓ PUT /admin/sections/:id/move
   ├─ ✓ DELETE /admin/sections/:id
   └─ ✓ GET /admin/documents/:docId/sections/tree

Week 2: Frontend UI
├─ Day 3: Tree Editor
│  ├─ ✓ Section tree rendering
│  ├─ ✓ Collapsible sections
│  └─ ✓ Context menu
│
├─ Day 4-5: Modal Components
│  ├─ ✓ Split section modal
│  ├─ ✓ Join sections dialog
│  ├─ ✓ Retitle form
│  └─ ✓ Delete confirmation
│
└─ Day 6-7: Drag-and-Drop & Polish
   ├─ ✓ Drag-and-drop reordering
   ├─ ✓ Visual feedback
   ├─ ✓ Loading states
   └─ ✓ Error displays

Week 3: Testing & Docs
├─ Day 8: Backend Tests
│  ├─ ✓ Unit tests for functions
│  └─ ✓ Integration tests for routes
│
├─ Day 9: Frontend Tests
│  ├─ ✓ Component tests
│  └─ ✓ E2E workflow tests
│
└─ Day 10: Documentation
   ├─ ✓ Admin guide
   ├─ ✓ API documentation
   └─ ✓ Migration guide
```

---

## 🚀 Quick Start Checklist

### Phase 1: Database (1 day)
- [ ] Run migration: `013_section_editing_functions.sql`
- [ ] Test functions in isolation
- [ ] Verify RLS policies work

### Phase 2: Backend (1 day)
- [ ] Add routes to `/src/routes/admin.js`
- [ ] Implement validation middleware
- [ ] Write integration tests
- [ ] Test with Postman/curl

### Phase 3: Frontend (3-5 days)
- [ ] Create tree editor component
- [ ] Build modal components
- [ ] Add JavaScript interactions
- [ ] Style with existing theme
- [ ] Write E2E tests

### Phase 4: Deploy (1 day)
- [ ] Code review
- [ ] Deploy to staging
- [ ] Manual QA testing
- [ ] Deploy to production
- [ ] Monitor metrics

---

## 📊 Success Metrics

```
┌────────────────────────────────────────────────────────────────┐
│                      DEFINITION OF DONE                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Functional Requirements                                        │
│  ✓ All 5 operations (split, join, retitle, move, delete) work  │
│  ✓ Suggestions are properly handled in all cases               │
│  ✓ Workflow locks prevent editing locked sections              │
│  ✓ Materialized paths automatically recalculate                │
│  ✓ Ordinals stay sequential after any operation                │
│                                                                 │
│  Quality Requirements                                           │
│  ✓ 90%+ test coverage on backend functions                     │
│  ✓ All edge cases have explicit tests                          │
│  ✓ No SQL injection vulnerabilities                            │
│  ✓ RLS policies enforce org-level isolation                    │
│  ✓ Transactions rollback on error                              │
│                                                                 │
│  Performance Requirements                                       │
│  ✓ Operations complete in <2 seconds for 1000 sections         │
│  ✓ Tree renders in <500ms for 500 sections                     │
│  ✓ No N+1 query problems                                       │
│                                                                 │
│  User Experience                                                │
│  ✓ Clear success/error messages                                │
│  ✓ Confirmation dialogs for destructive ops                    │
│  ✓ Loading indicators during operations                        │
│  ✓ Intuitive drag-and-drop UI                                  │
│                                                                 │
│  Documentation                                                  │
│  ✓ Admin guide with screenshots                                │
│  ✓ API documentation with examples                             │
│  ✓ Database schema documentation                               │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Related Documentation

- **Full Design**: `/docs/reports/P6_SECTION_EDITOR_DESIGN.md`
- **Database Schema**: `/database/migrations/001_generalized_schema.sql`
- **Admin Routes**: `/src/routes/admin.js`
- **P5-P6 Analysis**: `/docs/reports/P5-P6-FINDINGS-SUMMARY.md`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-15
**Quick Reference**: Keep this open during implementation! ✨
