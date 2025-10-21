# P6: Section Editor - Implementation Roadmap

**Quick Implementation Guide for Developers**

---

## 📋 Executive Summary

**Objective**: Enable organization admins to manually edit document sections after parsing.

**Operations**: Split, Join, Retitle, Move, Delete

**Timeline**: 4-7 days (Backend: 1-2 days, Frontend: 3-5 days)

**Complexity**: Medium (Database functions + API routes + Admin UI)

---

## 🎯 What You're Building

### The Big Picture

Organization admins need to fix parsing errors and reorganize content manually. This feature provides:

1. **Split Section** - "This section should be two separate sections"
2. **Join Sections** - "These two sections should be combined"
3. **Retitle Section** - "This section has the wrong title/number"
4. **Move Section** - "This section belongs under a different article"
5. **Delete Section** - "This section shouldn't exist"

### What Already Works ✅

- ✅ Database schema supports 10-level hierarchy with materialized paths
- ✅ Automatic path recalculation via `update_section_path()` trigger
- ✅ Admin route infrastructure in `/src/routes/admin.js`
- ✅ RLS policies for organization-level access control
- ✅ Workflow state tracking in `section_workflow_states` table
- ✅ Suggestion attachments via `suggestion_sections` junction table

### What You Need to Build ❌

- ❌ 5 database helper functions (ordinal management, validation)
- ❌ 6 API routes in `/src/routes/admin.js`
- ❌ Admin UI components (tree editor, modals)
- ❌ JavaScript handlers for drag-and-drop and API calls
- ❌ Integration tests for backend routes
- ❌ E2E tests for UI workflows

---

## 🗂️ File Organization

```
/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/

database/
  migrations/
    013_section_editing_functions.sql  ← NEW: Helper functions

src/
  routes/
    admin.js                           ← MODIFY: Add section editing routes
  middleware/
    sectionValidation.js               ← NEW: Validation middleware

views/
  admin/
    section-editor.ejs                 ← NEW: Main editor page
    partials/
      split-modal.ejs                  ← NEW: Split section modal
      join-modal.ejs                   ← NEW: Join sections modal
      retitle-modal.ejs                ← NEW: Retitle modal
      delete-modal.ejs                 ← NEW: Delete confirmation

public/
  js/
    section-editor.js                  ← NEW: Tree editor JavaScript
  css/
    section-editor.css                 ← NEW: Styles

tests/
  integration/
    section-editing.test.js            ← NEW: API route tests
  e2e/
    admin-section-editor.test.js       ← NEW: UI workflow tests

docs/
  reports/
    P6_SECTION_EDITOR_DESIGN.md        ← Design specification
    P6_SECTION_EDITOR_VISUAL_SUMMARY.md ← Visual guide
    P6_IMPLEMENTATION_ROADMAP.md        ← This file
```

---

## 🔧 Implementation Steps

### Step 1: Database Functions (Day 1, Morning)

**File**: `/database/migrations/013_section_editing_functions.sql`

**Functions to Create**:

```sql
-- 1. Shift ordinals up to make space
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
) RETURNS INTEGER;

-- 2. Shift ordinals down to close gaps
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
) RETURNS INTEGER;

-- 3. Move suggestions between sections
CREATE OR REPLACE FUNCTION relocate_suggestions(
  p_old_section_id UUID,
  p_new_section_id UUID
) RETURNS INTEGER;

-- 4. Check if section can be edited
CREATE OR REPLACE FUNCTION validate_section_editable(
  p_section_id UUID
) RETURNS BOOLEAN;

-- 5. Get all descendant sections
CREATE OR REPLACE FUNCTION get_descendants(
  p_section_id UUID
) RETURNS TABLE (id UUID, depth INTEGER, section_number VARCHAR);
```

**Test SQL**:
```sql
-- Test increment
SELECT increment_sibling_ordinals(
  'parent-uuid'::UUID,
  2,  -- Start at ordinal 2
  1   -- Increment by 1
);

-- Verify ordinals
SELECT id, ordinal FROM document_sections
WHERE parent_section_id = 'parent-uuid'::UUID
ORDER BY ordinal;
```

**Run Migration**:
```bash
# Via Supabase dashboard SQL editor
# OR via migration script
psql -h $SUPABASE_HOST -U postgres -d postgres -f database/migrations/013_section_editing_functions.sql
```

---

### Step 2: RLS Policies (Day 1, Morning)

**Add to**: `/database/migrations/013_section_editing_functions.sql`

```sql
-- Allow admins to UPDATE sections
CREATE POLICY "Admins can edit sections in own organization"
  ON document_sections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
    )
  );

-- Allow admins to INSERT sections
CREATE POLICY "Admins can create sections in own organization"
  ON document_sections FOR INSERT WITH CHECK (...);

-- Allow admins to DELETE sections
CREATE POLICY "Admins can delete sections in own organization"
  ON document_sections FOR DELETE USING (...);

-- Global admins can edit any section
CREATE POLICY "Global admins can edit any section"
  ON document_sections FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_global_admin = TRUE
    )
  );
```

---

### Step 3: Validation Middleware (Day 1, Afternoon)

**File**: `/src/middleware/sectionValidation.js` (NEW)

```javascript
/**
 * Validation middleware for section editing operations
 */

/**
 * Validate section exists and is editable
 */
async function validateSectionEditable(req, res, next) {
  const { id: sectionId } = req.params;
  const { supabaseService } = req;

  try {
    // 1. Fetch section
    const { data: section, error } = await supabaseService
      .from('document_sections')
      .select('*, documents(organization_id)')
      .eq('id', sectionId)
      .single();

    if (error || !section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    // 2. Check workflow states
    const { data: states } = await supabaseService
      .from('section_workflow_states')
      .select('status, workflow_stages(stage_name)')
      .eq('section_id', sectionId);

    const lockedState = states?.find(s => s.status === 'locked');

    if (lockedState) {
      return res.status(403).json({
        success: false,
        error: `Section is locked at workflow stage: ${lockedState.workflow_stages.stage_name}`
      });
    }

    // 3. Attach section to request
    req.section = section;
    next();

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Validate sections are adjacent siblings
 */
async function validateAdjacentSiblings(req, res, next) {
  const { sectionIds } = req.body;
  const { supabaseService } = req;

  try {
    const { data: sections } = await supabaseService
      .from('document_sections')
      .select('parent_section_id, ordinal')
      .in('id', sectionIds)
      .order('ordinal');

    // Check same parent
    const parents = [...new Set(sections.map(s => s.parent_section_id))];
    if (parents.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'Sections must have the same parent'
      });
    }

    // Check adjacent ordinals
    const ordinals = sections.map(s => s.ordinal);
    for (let i = 1; i < ordinals.length; i++) {
      if (ordinals[i] !== ordinals[i-1] + 1) {
        return res.status(400).json({
          success: false,
          error: 'Sections must be adjacent (consecutive ordinals)'
        });
      }
    }

    req.sections = sections;
    next();

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  validateSectionEditable,
  validateAdjacentSiblings
};
```

---

### Step 4: API Routes (Day 1, Afternoon)

**File**: `/src/routes/admin.js` (MODIFY - add to existing file)

Add imports:
```javascript
const { validateSectionEditable, validateAdjacentSiblings } = require('../middleware/sectionValidation');
```

Add routes:

```javascript
/**
 * POST /admin/sections/:id/split - Split section into multiple
 */
router.post('/sections/:id/split', requireAdmin, validateSectionEditable, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { splitPoints, suggestionHandling } = req.body;
    const { supabaseService } = req;

    // Begin transaction
    // ... implementation from design doc ...

    res.json({
      success: true,
      original: originalSection,
      newSections: newSections
    });

  } catch (error) {
    console.error('Split section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /admin/sections/join - Join multiple sections
 */
router.post('/sections/join', requireAdmin, validateAdjacentSiblings, async (req, res) => {
  try {
    const { sectionIds, joinedTitle, separator, suggestionHandling } = req.body;
    const { supabaseService } = req;

    // Begin transaction
    // ... implementation from design doc ...

    res.json({
      success: true,
      merged: mergedSection,
      deleted: deletedIds
    });

  } catch (error) {
    console.error('Join sections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /admin/sections/:id/retitle - Change title/number
 */
router.put('/sections/:id/retitle', requireAdmin, validateSectionEditable, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { title, sectionNumber } = req.body;
    const { supabaseService } = req;

    const { data, error } = await supabaseService
      .from('document_sections')
      .update({
        section_title: title,
        section_number: sectionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      section: data
    });

  } catch (error) {
    console.error('Retitle section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /admin/sections/:id/move - Move to different parent or reorder
 */
router.put('/sections/:id/move', requireAdmin, validateSectionEditable, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { newParentId, newOrdinal } = req.body;
    const { supabaseService } = req;

    // Begin transaction
    // ... implementation from design doc ...

    res.json({
      success: true,
      section: movedSection
    });

  } catch (error) {
    console.error('Move section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /admin/sections/:id - Delete section
 */
router.delete('/sections/:id', requireAdmin, validateSectionEditable, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { cascade, suggestions } = req.query;
    const { supabaseService } = req;

    // Begin transaction
    // ... implementation from design doc ...

    res.json({
      success: true,
      deleted: { sections: deletedIds }
    });

  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/documents/:docId/sections/tree - Get section tree for editing
 */
router.get('/documents/:docId/sections/tree', requireAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { supabaseService } = req;

    const { data: sections, error } = await supabaseService
      .from('document_sections')
      .select(`
        *,
        suggestions:suggestion_sections(count),
        workflow_states:section_workflow_states(status, workflow_stages(stage_name))
      `)
      .eq('document_id', docId)
      .order('path_ordinals');

    if (error) throw error;

    // Build tree structure
    const tree = buildTree(sections);

    res.json({
      success: true,
      tree: tree
    });

  } catch (error) {
    console.error('Get section tree error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

### Step 5: Frontend - Tree Editor (Day 2-3)

**File**: `/views/admin/section-editor.ejs` (NEW)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Section Editor - <%= document.title %></title>
  <link rel="stylesheet" href="/css/section-editor.css">
</head>
<body>
  <div class="section-editor-container">
    <header class="editor-header">
      <h1>Edit Sections: <%= document.title %></h1>
      <div class="editor-actions">
        <button id="save-changes" class="btn btn-primary">Save Changes</button>
        <a href="/admin/organization/<%= document.organization_id %>" class="btn btn-secondary">Back</a>
      </div>
    </header>

    <div class="section-tree" id="section-tree">
      <!-- Tree rendered by JavaScript -->
    </div>
  </div>

  <!-- Modals -->
  <%- include('partials/split-modal') %>
  <%- include('partials/join-modal') %>
  <%- include('partials/retitle-modal') %>
  <%- include('partials/delete-modal') %>

  <script src="/js/section-editor.js"></script>
  <script>
    const documentId = '<%= document.id %>';
    const sectionEditor = new SectionEditor(documentId);
    sectionEditor.init();
  </script>
</body>
</html>
```

**File**: `/public/js/section-editor.js` (NEW)

```javascript
/**
 * Section Editor - Tree editor with drag-and-drop
 */
class SectionEditor {
  constructor(documentId) {
    this.documentId = documentId;
    this.sections = [];
    this.selectedSections = [];
  }

  async init() {
    await this.loadSections();
    this.renderTree();
    this.attachEventListeners();
  }

  async loadSections() {
    const response = await fetch(`/admin/documents/${this.documentId}/sections/tree`);
    const result = await response.json();
    this.sections = result.tree;
  }

  renderTree() {
    const container = document.getElementById('section-tree');
    container.innerHTML = this.buildTreeHTML(this.sections);
  }

  buildTreeHTML(sections, depth = 0) {
    return sections.map(section => `
      <div class="section-node" data-id="${section.id}" style="padding-left: ${depth * 20}px">
        <div class="section-header">
          <span class="section-icon">${this.getIcon(section.type)}</span>
          <span class="section-number">${section.section_number}</span>
          <span class="section-title">${section.section_title}</span>
          <div class="section-actions">
            <button class="btn-split" data-id="${section.id}">Split</button>
            <button class="btn-edit" data-id="${section.id}">Edit</button>
            <button class="btn-delete" data-id="${section.id}">Delete</button>
          </div>
        </div>
        ${section.children ? this.buildTreeHTML(section.children, depth + 1) : ''}
      </div>
    `).join('');
  }

  attachEventListeners() {
    // Split button
    document.querySelectorAll('.btn-split').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sectionId = e.target.dataset.id;
        this.openSplitModal(sectionId);
      });
    });

    // Edit button
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sectionId = e.target.dataset.id;
        this.openRetitleModal(sectionId);
      });
    });

    // Delete button
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sectionId = e.target.dataset.id;
        this.openDeleteModal(sectionId);
      });
    });

    // Drag-and-drop
    this.enableDragAndDrop();
  }

  enableDragAndDrop() {
    const nodes = document.querySelectorAll('.section-node');
    nodes.forEach(node => {
      node.draggable = true;

      node.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('sectionId', node.dataset.id);
        node.classList.add('dragging');
      });

      node.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        node.classList.add('drag-over');
      });

      node.addEventListener('dragleave', () => {
        node.classList.remove('drag-over');
      });

      node.addEventListener('drop', async (e) => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('sectionId');
        const targetId = node.dataset.id;

        await this.moveSection(draggedId, targetId);
        node.classList.remove('drag-over');
      });

      node.addEventListener('dragend', () => {
        node.classList.remove('dragging');
      });
    });
  }

  async splitSection(sectionId, splitPoints, suggestionHandling) {
    const response = await fetch(`/admin/sections/${sectionId}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splitPoints, suggestionHandling })
    });

    const result = await response.json();

    if (result.success) {
      this.showSuccess('Section split successfully');
      await this.loadSections();
      this.renderTree();
    } else {
      this.showError(result.error);
    }
  }

  async moveSection(sectionId, targetId) {
    // Determine new parent and ordinal based on drop target
    const newParentId = this.getParentId(targetId);
    const newOrdinal = this.getInsertOrdinal(targetId);

    const response = await fetch(`/admin/sections/${sectionId}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newParentId, newOrdinal })
    });

    const result = await response.json();

    if (result.success) {
      this.showSuccess('Section moved successfully');
      await this.loadSections();
      this.renderTree();
    } else {
      this.showError(result.error);
    }
  }

  // ... more methods for modals, etc.
}
```

---

### Step 6: Testing (Day 4)

**File**: `/tests/integration/section-editing.test.js` (NEW)

```javascript
const request = require('supertest');
const app = require('../../server');

describe('Section Editing API', () => {
  let sectionId, documentId;

  beforeEach(async () => {
    // Setup test data
    documentId = await createTestDocument();
    sectionId = await createTestSection(documentId);
  });

  describe('POST /admin/sections/:id/split', () => {
    it('should split section into two parts', async () => {
      const response = await request(app)
        .post(`/admin/sections/${sectionId}/split`)
        .send({
          splitPoints: [{ position: 100, title: 'Part B' }],
          suggestionHandling: 'first'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.newSections).toHaveLength(1);
    });

    it('should reject split on locked section', async () => {
      await lockSection(sectionId);

      await request(app)
        .post(`/admin/sections/${sectionId}/split`)
        .send({ splitPoints: [] })
        .expect(403);
    });
  });

  // ... more tests
});
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Code review with team
- [ ] All tests passing (unit, integration, E2E)
- [ ] Database migration tested on staging
- [ ] RLS policies verified
- [ ] Performance tested with 1000 sections

### Deployment
- [ ] Run migration on production database
- [ ] Deploy backend code
- [ ] Deploy frontend assets
- [ ] Clear any caches
- [ ] Monitor error rates

### Post-Deployment
- [ ] Smoke test each operation
- [ ] Monitor metrics (response times, error rates)
- [ ] Check audit logs
- [ ] Update documentation

---

## 📚 Reference Documentation

- **Full Design**: `/docs/reports/P6_SECTION_EDITOR_DESIGN.md` (30 pages, comprehensive)
- **Visual Guide**: `/docs/reports/P6_SECTION_EDITOR_VISUAL_SUMMARY.md` (diagrams & examples)
- **This Roadmap**: `/docs/reports/P6_IMPLEMENTATION_ROADMAP.md` (you are here)

---

## 🆘 Troubleshooting

### Common Issues

**Issue**: Ordinals become non-sequential
**Solution**: Run `SELECT * FROM document_sections WHERE parent_section_id = X ORDER BY ordinal` to verify. Use helper functions to fix.

**Issue**: Materialized paths not updating
**Solution**: Verify `trg_update_section_path` trigger exists and is enabled. Manually run `UPDATE document_sections SET updated_at = NOW() WHERE id = X` to force recalculation.

**Issue**: RLS policy blocking operation
**Solution**: Check user's role with `SELECT role FROM user_organizations WHERE user_id = auth.uid()`. Verify organization context.

**Issue**: Circular reference detected
**Solution**: Query `path_ids` array: `SELECT path_ids FROM document_sections WHERE id = X`. Ensure new parent is not in this array.

---

## 🎓 Learning Resources

### Database Concepts
- **Adjacency List**: Parent-child relationship via `parent_section_id`
- **Materialized Path**: Pre-computed ancestor chain in `path_ids` array
- **Trigger Functions**: Automatic recalculation on INSERT/UPDATE

### Design Patterns
- **Transaction Management**: ACID compliance for multi-step operations
- **Optimistic Concurrency**: Use ordinals + transactions to prevent conflicts
- **Command Pattern**: Each operation encapsulated in route handler

---

**Last Updated**: 2025-10-15
**Ready to Code?** Start with Step 1 (Database Functions) and work through sequentially! 🚀
