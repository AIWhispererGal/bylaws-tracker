# Phase 2: Document Management Enhancements - Implementation Roadmap

**Date:** October 17, 2025
**Status:** Planning Phase
**Priority:** HIGH
**Estimated Timeline:** 5-7 days

---

## 📋 Executive Summary

This roadmap covers Phase 2 enhancements to the Bylaws Amendment Tracker system based on completed Phase 1 work. Phase 2 adds three major features to improve document management and workflow efficiency.

### Phase 1 Completed Features ✅

1. **10-Level Document Parsing** - System supports depth 0-9 with flexible hierarchy
2. **Workflow Lock System** - SELECT → LOCK → APPROVE flow operational
3. **Global Admin Access** - Cross-organization admin capabilities
4. **Multi-tenant RLS** - Secure organization isolation

### Phase 2 New Features 🎯

1. **Per-Document Numbering Schema Configuration** (NEW)
2. **Suggestion Rejection with Stage Tracking** (NEW)
3. **Client-Side Section Reload After Lock-in** (NEW)
4. **Section Editing Tools for Admins** (P6 - Previously Planned)

---

## 🎯 Feature 1: Per-Document Numbering Schema Configuration

### Business Requirement

Allow Global Admin/Org Admin/Owner to customize the numbering schema for each document after upload. Organization-level schema becomes a default that can be overridden per-document.

### User Story

```
AS an Organization Admin
WHEN I upload a new bylaws document
THEN I want to review and adjust the numbering schema
SO THAT the 10-level hierarchy matches the document's actual structure
```

### Current State

- Organization has default 10-level hierarchy config in `organizations.hierarchy_config`
- Applied to all documents during parsing
- No per-document customization

### Proposed Solution

#### Database Changes

**File:** `database/migrations/018_add_per_document_hierarchy.sql`

```sql
-- Add hierarchy_override column to documents table
ALTER TABLE documents
ADD COLUMN hierarchy_override JSONB DEFAULT NULL;

COMMENT ON COLUMN documents.hierarchy_override IS
  'Per-document hierarchy configuration. If NULL, uses organization default.
   Format: {"levels": [...10 level definitions...], "maxDepth": 10}';

-- Index for documents with custom hierarchies
CREATE INDEX idx_documents_hierarchy_override
  ON documents(organization_id)
  WHERE hierarchy_override IS NOT NULL;
```

#### Backend API Routes

**File:** `src/routes/admin.js` (add new endpoints)

```javascript
/**
 * GET /admin/documents/:docId/hierarchy
 * Fetch current hierarchy config (document override OR org default)
 */
router.get('/documents/:docId/hierarchy', requireAdmin, async (req, res) => {
  // 1. Fetch document with hierarchy_override
  // 2. If hierarchy_override exists, return it
  // 3. Otherwise fetch organization.hierarchy_config
  // 4. Return with metadata indicating source (document vs org default)
});

/**
 * PUT /admin/documents/:docId/hierarchy
 * Update per-document hierarchy configuration
 */
router.put('/documents/:docId/hierarchy', requireAdmin, async (req, res) => {
  // 1. Validate hierarchy config structure
  // 2. Validate 10 levels defined, depths 0-9
  // 3. Update documents.hierarchy_override
  // 4. Return success
  // NOTE: Does NOT re-parse document, only affects future parsing
});

/**
 * DELETE /admin/documents/:docId/hierarchy
 * Reset to organization default
 */
router.delete('/documents/:docId/hierarchy', requireAdmin, async (req, res) => {
  // 1. Set hierarchy_override to NULL
  // 2. Document now uses org default
});

/**
 * GET /admin/hierarchy-templates
 * Get pre-built 10-level schema templates
 */
router.get('/admin/hierarchy-templates', requireAdmin, async (req, res) => {
  // Return pre-built templates:
  // - "Standard Bylaws" (Article, Section, Subsection, Paragraph...)
  // - "Legal Document" (Chapter, Section, Clause, Subclause...)
  // - "Policy Manual" (Part, Section, Paragraph, Subparagraph...)
  // - "Technical Standard" (numeric at all levels)
});
```

#### Frontend UI

**File:** `views/admin/document-hierarchy-editor.ejs` (NEW)

**Features:**
- Visual 10-level hierarchy editor
- Drag-and-drop to reorder levels
- Dropdowns for numbering schemes: roman, numeric, alpha, alphaLower
- Live preview showing example numbering (e.g., "Article I → Section 1 → 1.1 → (a) → i...")
- "Load Template" button with pre-built schemas
- "Reset to Organization Default" button
- "Detect from Document" button (analyzes parsed sections to suggest schema)
- Save/Cancel actions

**Access Point:**
- Add "Configure Hierarchy" button on document detail page
- Only visible to Global Admin, Org Admin, Org Owner
- Opens modal or dedicated page

**File:** `public/js/hierarchy-editor.js` (NEW)

```javascript
class HierarchyEditor {
  constructor(documentId) {
    this.documentId = documentId;
    this.levels = []; // 10 levels
  }

  async loadCurrent() {
    // GET /admin/documents/:docId/hierarchy
    // Populate editor with current config
  }

  async loadTemplate(templateName) {
    // GET /admin/hierarchy-templates
    // Load pre-built template into editor
  }

  async detectFromDocument() {
    // Analyze document_sections to infer numbering patterns
    // Suggest config based on actual parsed structure
  }

  async save() {
    // PUT /admin/documents/:docId/hierarchy
    // Save custom configuration
  }

  async resetToDefault() {
    // DELETE /admin/documents/:docId/hierarchy
    // Revert to org default
  }

  renderPreview() {
    // Show example: "Article I → Section 1 → 1.1 → (a) → ..."
  }
}
```

#### Pre-loaded Templates

**File:** `src/config/hierarchyTemplates.js` (NEW)

```javascript
module.exports = {
  'standard-bylaws': {
    name: 'Standard Bylaws',
    description: 'Traditional bylaws structure with Roman numerals for articles',
    levels: [
      { name: 'Article',      depth: 0, numbering: 'roman',     prefix: 'Article ' },
      { name: 'Section',      depth: 1, numbering: 'numeric',   prefix: 'Section ' },
      { name: 'Subsection',   depth: 2, numbering: 'numeric',   prefix: '' },
      { name: 'Paragraph',    depth: 3, numbering: 'alphaLower', prefix: '(' },
      { name: 'Subparagraph', depth: 4, numbering: 'numeric',   prefix: '' },
      { name: 'Clause',       depth: 5, numbering: 'alphaLower', prefix: '(' },
      { name: 'Subclause',    depth: 6, numbering: 'roman',     prefix: '' },
      { name: 'Item',         depth: 7, numbering: 'numeric',   prefix: '•' },
      { name: 'Subitem',      depth: 8, numbering: 'alpha',     prefix: '◦' },
      { name: 'Point',        depth: 9, numbering: 'numeric',   prefix: '-' }
    ],
    maxDepth: 10
  },

  'legal-document': {
    name: 'Legal Document',
    description: 'Legal document structure with chapters and clauses',
    levels: [
      { name: 'Chapter',    depth: 0, numbering: 'roman',   prefix: 'Chapter ' },
      { name: 'Section',    depth: 1, numbering: 'numeric', prefix: 'Section ' },
      { name: 'Clause',     depth: 2, numbering: 'numeric', prefix: 'Clause ' },
      { name: 'Subclause',  depth: 3, numbering: 'numeric', prefix: '' },
      { name: 'Paragraph',  depth: 4, numbering: 'alphaLower', prefix: '(' },
      { name: 'Subparagraph', depth: 5, numbering: 'numeric', prefix: '' },
      { name: 'Item',       depth: 6, numbering: 'alphaLower', prefix: '(' },
      { name: 'Subitem',    depth: 7, numbering: 'roman',   prefix: '' },
      { name: 'Point',      depth: 8, numbering: 'numeric', prefix: '•' },
      { name: 'Subpoint',   depth: 9, numbering: 'alpha',   prefix: '◦' }
    ],
    maxDepth: 10
  },

  'policy-manual': {
    name: 'Policy Manual',
    description: 'Corporate policy structure',
    levels: [
      { name: 'Part',       depth: 0, numbering: 'roman',   prefix: 'Part ' },
      { name: 'Section',    depth: 1, numbering: 'numeric', prefix: 'Section ' },
      { name: 'Paragraph',  depth: 2, numbering: 'numeric', prefix: '' },
      { name: 'Subparagraph', depth: 3, numbering: 'alphaLower', prefix: '(' },
      { name: 'Item',       depth: 4, numbering: 'numeric', prefix: '' },
      { name: 'Subitem',    depth: 5, numbering: 'alphaLower', prefix: '(' },
      { name: 'Clause',     depth: 6, numbering: 'roman',   prefix: '' },
      { name: 'Subclause',  depth: 7, numbering: 'numeric', prefix: '•' },
      { name: 'Point',      depth: 8, numbering: 'alpha',   prefix: '◦' },
      { name: 'Detail',     depth: 9, numbering: 'numeric', prefix: '-' }
    ],
    maxDepth: 10
  },

  'technical-standard': {
    name: 'Technical Standard',
    description: 'Numeric hierarchy (1.1.1.1.1...)',
    levels: [
      { name: 'Level 1', depth: 0, numbering: 'numeric', prefix: '' },
      { name: 'Level 2', depth: 1, numbering: 'numeric', prefix: '' },
      { name: 'Level 3', depth: 2, numbering: 'numeric', prefix: '' },
      { name: 'Level 4', depth: 3, numbering: 'numeric', prefix: '' },
      { name: 'Level 5', depth: 4, numbering: 'numeric', prefix: '' },
      { name: 'Level 6', depth: 5, numbering: 'numeric', prefix: '' },
      { name: 'Level 7', depth: 6, numbering: 'numeric', prefix: '' },
      { name: 'Level 8', depth: 7, numbering: 'numeric', prefix: '' },
      { name: 'Level 9', depth: 8, numbering: 'numeric', prefix: '' },
      { name: 'Level 10', depth: 9, numbering: 'numeric', prefix: '' }
    ],
    maxDepth: 10
  }
};
```

#### Parser Integration

**File:** `src/parsers/wordParser.js` (modify)

**Update `parseDocument()` function:**

```javascript
async parseDocument(file, organizationId, documentId = null) {
  // 1. Load organization config (as before)
  let orgConfig = await organizationConfig.loadConfig(organizationId);

  // 2. NEW: If documentId provided, check for hierarchy_override
  if (documentId) {
    const { data: doc } = await supabase
      .from('documents')
      .select('hierarchy_override')
      .eq('id', documentId)
      .single();

    if (doc?.hierarchy_override) {
      // Use document-specific hierarchy config
      orgConfig.hierarchy = doc.hierarchy_override;
    }
  }

  // 3. Continue parsing with merged config (existing logic)
  // ...
}
```

### Testing Checklist

- [ ] Create document with org default hierarchy
- [ ] Customize hierarchy for document
- [ ] Verify `documents.hierarchy_override` updated
- [ ] Re-parse document (or upload new document with same org)
- [ ] Verify new document uses custom hierarchy
- [ ] Reset to org default
- [ ] Verify `hierarchy_override` set to NULL
- [ ] Load each pre-built template
- [ ] Verify all 10 levels configured correctly
- [ ] Test "Detect from Document" feature
- [ ] Verify RLS policies (admins only)

### Files to Create/Modify

**NEW:**
- `database/migrations/018_add_per_document_hierarchy.sql`
- `views/admin/document-hierarchy-editor.ejs`
- `public/js/hierarchy-editor.js`
- `public/css/hierarchy-editor.css`
- `src/config/hierarchyTemplates.js`
- `tests/integration/document-hierarchy.test.js`

**MODIFY:**
- `src/routes/admin.js` (add 4 new endpoints)
- `src/parsers/wordParser.js` (check for hierarchy_override)
- `views/admin/organization-detail.ejs` (add "Configure Hierarchy" button)

---

## 🎯 Feature 2: Suggestion Rejection with Workflow Stage Tracking

### Business Requirement

Allow Global Admin/Org Admin/Owner to reject suggestions on a per-suggestion basis. Rejected suggestions are:
- **NOT loaded by default** (to improve performance and reduce clutter)
- **Available via "Show Rejected" toggle button** (on-demand loading)
- Not available as lock/approve options
- Tracked with the workflow stage at which rejection occurred
- Reversible by authorized admins

### User Story

```
AS an Organization Admin
WHEN I review suggestions for a section
THEN I want to reject irrelevant or inappropriate suggestions
SO THAT users don't waste time considering them
AND rejected suggestions don't clutter the active suggestions list
AND I can view rejected suggestions when needed via a toggle
AND I can track when/where suggestions were rejected
```

### Updated Requirements (October 17, 2025)

**CRITICAL CHANGE:**
- ❌ OLD: Rejected suggestions visible in "Rejected Suggestions" tab by default
- ✅ NEW: Rejected suggestions **NOT loaded by default**
- ✅ NEW: Add "Show Rejected" toggle button to load rejected on demand
- ✅ NEW: Query parameter `?includeRejected=true` added to API

### Current State

- Suggestions have `status` column with values: 'open', 'selected', 'rejected', 'merged', 'withdrawn'
- No tracking of WHO rejected or WHEN
- No tracking of workflow stage at rejection
- No UI for filtering rejected suggestions

### Proposed Solution

#### Database Changes

**File:** `database/migrations/019_add_suggestion_rejection_tracking.sql`

```sql
-- Add rejection tracking columns to suggestions table
ALTER TABLE suggestions
ADD COLUMN rejected_at TIMESTAMP DEFAULT NULL,
ADD COLUMN rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN rejected_at_stage_id UUID REFERENCES workflow_stages(id) ON DELETE SET NULL,
ADD COLUMN rejection_notes TEXT DEFAULT NULL;

-- Indexes for filtering
CREATE INDEX idx_suggestions_rejected_at ON suggestions(rejected_at)
  WHERE rejected_at IS NOT NULL;

CREATE INDEX idx_suggestions_rejected_by ON suggestions(rejected_by);

CREATE INDEX idx_suggestions_rejected_stage ON suggestions(rejected_at_stage_id);

-- Index for active (non-rejected) suggestions
CREATE INDEX idx_suggestions_active ON suggestions(document_id, status)
  WHERE status != 'rejected';

COMMENT ON COLUMN suggestions.rejected_at IS
  'Timestamp when suggestion was rejected. NULL if not rejected.';

COMMENT ON COLUMN suggestions.rejected_by IS
  'User who rejected the suggestion. NULL if not rejected.';

COMMENT ON COLUMN suggestions.rejected_at_stage_id IS
  'Workflow stage at which suggestion was rejected.
   Shows context of rejection (e.g., rejected during Committee Review stage).';

COMMENT ON COLUMN suggestions.rejection_notes IS
  'Optional notes about why suggestion was rejected.';
```

#### Backend API Routes

**File:** `src/routes/workflow.js` (add new endpoints)

```javascript
/**
 * POST /api/workflow/suggestions/:suggestionId/reject
 * Reject a suggestion at current workflow stage
 */
router.post('/suggestions/:suggestionId/reject',
  requireAuth,
  requireOrgMember,
  async (req, res) => {
    const { suggestionId } = req.params;
    const { sectionId, notes } = req.body;
    const userId = req.user.id;
    const { supabaseService } = req;

    try {
      // 1. Verify user has admin permissions
      const isAdmin = await checkUserIsAdmin(
        supabaseService,
        userId,
        req.organizationId
      );

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Only admins can reject suggestions'
        });
      }

      // 2. Fetch current workflow stage for the section
      const { data: workflowState } = await supabaseService
        .from('section_workflow_states')
        .select('workflow_stage_id, workflow_stages(stage_name)')
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentStageId = workflowState?.workflow_stage_id;
      const stageName = workflowState?.workflow_stages?.stage_name || 'Unknown';

      // 3. Update suggestion with rejection info
      const { data: suggestion, error } = await supabaseService
        .from('suggestions')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_by: userId,
          rejected_at_stage_id: currentStageId,
          rejection_notes: notes || `Rejected at ${stageName} stage`,
          updated_at: new Date().toISOString()
        })
        .eq('id', suggestionId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        suggestion,
        message: `Suggestion rejected at ${stageName} stage`
      });

    } catch (error) {
      console.error('Reject suggestion error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/workflow/suggestions/:suggestionId/unreject
 * Reverse rejection (admin only)
 */
router.post('/suggestions/:suggestionId/unreject',
  requireAuth,
  requireOrgMember,
  async (req, res) => {
    const { suggestionId } = req.params;
    const userId = req.user.id;
    const { supabaseService } = req;

    try {
      // 1. Verify user has admin permissions
      const isAdmin = await checkUserIsAdmin(
        supabaseService,
        userId,
        req.organizationId
      );

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Only admins can unreject suggestions'
        });
      }

      // 2. Update suggestion to reopen
      const { data: suggestion, error } = await supabaseService
        .from('suggestions')
        .update({
          status: 'open',
          rejected_at: null,
          rejected_by: null,
          rejected_at_stage_id: null,
          rejection_notes: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', suggestionId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        suggestion,
        message: 'Suggestion reopened successfully'
      });

    } catch (error) {
      console.error('Unreject suggestion error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/workflow/documents/:docId/suggestions
 * Fetch suggestions with optional status filter
 */
router.get('/documents/:docId/suggestions',
  requireAuth,
  requireOrgMember,
  async (req, res) => {
    const { docId } = req.params;
    const { status, includeRejected } = req.query;
    const { supabaseService } = req;

    try {
      let query = supabaseService
        .from('suggestions')
        .select(`
          *,
          rejected_by_user:users!rejected_by(id, name, email),
          rejected_at_stage:workflow_stages!rejected_at_stage_id(id, stage_name, stage_order),
          suggestion_sections(section_id, ordinal)
        `)
        .eq('document_id', docId);

      // Filter by status
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Exclude rejected unless explicitly requested
      if (includeRejected !== 'true') {
        query = query.neq('status', 'rejected');
      }

      query = query.order('created_at', { ascending: false });

      const { data: suggestions, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        suggestions,
        count: suggestions.length
      });

    } catch (error) {
      console.error('Fetch suggestions error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
```

#### Frontend UI Updates

**File:** `views/dashboard/document-viewer.ejs` (modify)

**Add "Show Rejected" Toggle Button:**

```html
<!-- Suggestion Controls Header -->
<div class="d-flex justify-content-between align-items-center mb-3">
  <h5 class="mb-0">
    Suggestions
    <span class="badge bg-primary" id="active-count">0</span>
  </h5>

  <!-- Show Rejected Toggle Button -->
  <button
    class="btn btn-sm btn-outline-secondary"
    id="toggle-rejected-btn"
    onclick="toggleRejectedSuggestions()"
    data-showing="false">
    <i class="bi bi-eye"></i> Show Rejected
    <span class="badge bg-danger" id="rejected-count">0</span>
  </button>
</div>

<!-- Suggestions List -->
<div id="suggestions-list">
  <!-- Populated via JavaScript -->
  <!-- Rejected suggestions only loaded when toggle button clicked -->
</div>
```

**Note:** This replaces the tab-based approach with a simpler toggle button. Rejected suggestions are **NOT loaded on initial page load** for better performance.

**Add Reject Button to Each Suggestion:**

```html
<div class="suggestion-card" data-suggestion-id="${suggestion.id}">
  <div class="suggestion-header">
    <span class="suggestion-author">${suggestion.author_name}</span>

    <!-- Status Badge -->
    ${suggestion.status === 'rejected' ? `
      <span class="badge bg-danger">
        Rejected at ${suggestion.rejected_at_stage?.stage_name || 'Unknown'} Stage
      </span>
    ` : ''}
  </div>

  <div class="suggestion-text">${suggestion.suggested_text}</div>

  <div class="suggestion-actions">
    ${!suggestion.rejected_at && permissions.canReject ? `
      <button class="btn btn-sm btn-outline-danger"
              onclick="rejectSuggestion('${suggestion.id}', '${sectionId}')">
        <i class="bi bi-x-circle"></i> Reject
      </button>
    ` : ''}

    ${suggestion.rejected_at && permissions.canUnreject ? `
      <button class="btn btn-sm btn-outline-success"
              onclick="unrejectSuggestion('${suggestion.id}')">
        <i class="bi bi-arrow-counterclockwise"></i> Unreject
      </button>
    ` : ''}

    ${!suggestion.rejected_at ? `
      <input type="radio" name="suggestion-select-${sectionId}"
             value="${suggestion.id}"
             onchange="updateLockButton('${sectionId}', '${suggestion.id}')">
      <label>Select</label>
    ` : ''}
  </div>
</div>
```

**JavaScript Functions:**

```javascript
/**
 * Reject a suggestion
 */
async function rejectSuggestion(suggestionId, sectionId) {
  if (!confirm('Are you sure you want to reject this suggestion?')) {
    return;
  }

  try {
    const response = await fetch(
      `/api/workflow/suggestions/${suggestionId}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId })
      }
    );

    const result = await response.json();

    if (result.success) {
      showToast(`Suggestion rejected at ${result.message}`, 'success');

      // Reload suggestions for this section
      await loadSuggestions(sectionId);

      // Update counts
      updateSuggestionCounts();
    } else {
      showToast(`Error: ${result.error}`, 'danger');
    }
  } catch (error) {
    console.error('Reject suggestion error:', error);
    showToast('Failed to reject suggestion', 'danger');
  }
}

/**
 * Unreject a suggestion (reverse rejection)
 */
async function unrejectSuggestion(suggestionId) {
  if (!confirm('Are you sure you want to unreject this suggestion?')) {
    return;
  }

  try {
    const response = await fetch(
      `/api/workflow/suggestions/${suggestionId}/unreject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const result = await response.json();

    if (result.success) {
      showToast('Suggestion reopened successfully', 'success');

      // Reload suggestions
      await loadSuggestions(sectionId);

      // Update counts
      updateSuggestionCounts();
    } else {
      showToast(`Error: ${result.error}`, 'danger');
    }
  } catch (error) {
    console.error('Unreject suggestion error:', error);
    showToast('Failed to unreject suggestion', 'danger');
  }
}

/**
 * Toggle showing rejected suggestions (on-demand loading)
 */
async function toggleRejectedSuggestions() {
  const button = document.getElementById('toggle-rejected-btn');
  const isShowing = button.dataset.showing === 'true';

  if (isShowing) {
    // Hide rejected suggestions
    document.querySelectorAll('.suggestion-card.rejected').forEach(card => {
      card.remove();
    });

    button.innerHTML = '<i class="bi bi-eye"></i> Show Rejected <span class="badge bg-danger" id="rejected-count-badge"></span>';
    button.dataset.showing = 'false';
    button.classList.remove('btn-secondary');
    button.classList.add('btn-outline-secondary');

  } else {
    // Load and show rejected suggestions
    button.innerHTML = '<i class="bi bi-hourglass-split"></i> Loading...';
    button.disabled = true;

    try {
      // Fetch rejected suggestions for current section/document
      const response = await fetch(
        `/api/workflow/documents/${documentId}/suggestions?includeRejected=true&status=rejected`
      );

      const result = await response.json();

      if (result.success) {
        // Render rejected suggestions in UI
        renderRejectedSuggestions(result.suggestions);

        button.innerHTML = '<i class="bi bi-eye-slash"></i> Hide Rejected <span class="badge bg-danger">' + result.suggestions.length + '</span>';
        button.dataset.showing = 'true';
        button.classList.remove('btn-outline-secondary');
        button.classList.add('btn-secondary');
      } else {
        showToast('Failed to load rejected suggestions', 'danger');
      }

    } catch (error) {
      console.error('Load rejected suggestions error:', error);
      showToast('Error loading rejected suggestions', 'danger');
    } finally {
      button.disabled = false;
    }
  }
}

/**
 * Render rejected suggestions in the UI
 */
function renderRejectedSuggestions(suggestions) {
  const listContainer = document.getElementById('suggestions-list');

  suggestions.forEach(suggestion => {
    const card = createSuggestionCard(suggestion, true); // Pass true for rejected
    card.classList.add('rejected'); // Add class for easy filtering
    listContainer.appendChild(card);
  });
}

/**
 * Update suggestion counts
 */
function updateSuggestionCounts() {
  const activeCount = document.querySelectorAll('.suggestion-card:not(.rejected)').length;

  // Update active count badge
  document.getElementById('active-count').textContent = activeCount;

  // Update rejected count in toggle button (from server, not DOM)
  // This is populated when page loads via API call
}
```

### Testing Checklist

**Initial Page Load:**
- [ ] Open document viewer with suggestions
- [ ] Verify rejected suggestions are NOT loaded by default
- [ ] Verify "Show Rejected" button displays rejected count
- [ ] Verify page loads faster without rejected suggestions

**Reject Suggestion:**
- [ ] Reject a suggestion as admin
- [ ] Verify `rejected_at`, `rejected_by`, `rejected_at_stage_id` populated
- [ ] Verify suggestion disappears from active list (if toggle is off)
- [ ] Verify suggestion does NOT have radio button (can't be selected)
- [ ] Verify rejected count in toggle button increments

**Show Rejected Toggle:**
- [ ] Click "Show Rejected" button
- [ ] Verify button shows loading state
- [ ] Verify rejected suggestions load via AJAX
- [ ] Verify rejected suggestions appear with rejection badge
- [ ] Verify button text changes to "Hide Rejected"
- [ ] Click "Hide Rejected" button
- [ ] Verify rejected suggestions are removed from DOM

**Unreject Suggestion:**
- [ ] Show rejected suggestions
- [ ] Unreject a suggestion as admin
- [ ] Verify fields cleared (NULL)
- [ ] Verify suggestion appears in active list
- [ ] Verify rejected count decrements

**Permissions:**
- [ ] Test as non-admin user (should not see reject button)
- [ ] Verify RLS policies prevent unauthorized rejection
- [ ] Verify only admins can unreject suggestions

**Performance:**
- [ ] Test with 50+ suggestions (10+ rejected)
- [ ] Verify initial page load excludes rejected
- [ ] Verify toggle loads rejected quickly (<2s)

### Updated Implementation Summary

**Key Changes from Original Plan:**
1. ✅ Rejected suggestions **NOT loaded by default** (performance improvement)
2. ✅ Single "Show Rejected" toggle button (simpler than 3-tab approach)
3. ✅ On-demand AJAX loading when toggle clicked
4. ✅ Query parameter `?includeRejected=true` added to API
5. ✅ Default query excludes rejected suggestions

**Benefits:**
- ⚡ Faster initial page load (no rejected suggestions loaded)
- 🎯 Simpler UI (one button vs. three tabs)
- 📊 Better performance with large datasets
- ✅ Still allows viewing rejected when needed
- ♻️ Easy to toggle on/off multiple times

### Files to Create/Modify

**NEW:**
- `database/migrations/019_add_suggestion_rejection_tracking.sql`
- `tests/integration/suggestion-rejection.test.js`

**MODIFY:**
- `src/routes/workflow.js` (add 3 new endpoints, update suggestions query)
- `views/dashboard/document-viewer.ejs` (add toggle button, reject buttons)
- `public/js/workflow-actions.js` (add reject/unreject/toggle functions)

---

## 🎯 Feature 3: Client-Side Section Reload After Lock-in

### Business Requirement

When a user locks a suggestion, the entire section should re-render with refreshed workflow state WITHOUT requiring a manual page reload. This provides immediate visual feedback and ensures the UI accurately reflects the database state.

### Updated Requirements (October 17, 2025)

**CLARIFICATION:**
- ✅ **Client-side only** - No WebSocket implementation needed
- ✅ **Single-user refresh** - Only the user who locked sees immediate update
- ✅ **Other users refresh manually** - Acceptable for Phase 2
- ✅ **Future enhancement** - WebSocket can be added in Phase 3 for real-time multi-user updates

**Rationale:** Simplifies implementation, reduces complexity, meets 90% of use cases. Real-time multi-user coordination is a nice-to-have, not a must-have for Phase 2.

### User Story

```
AS a user locking a suggestion
WHEN I click "Lock Selected Suggestion"
THEN the section should automatically refresh for ME
AND show the locked text, updated badges, and new workflow state
WITHOUT me having to reload the entire page
AND other users will see updates when they refresh (acceptable)
```

### Current State

- Lock action succeeds and updates database
- Toast notification appears
- Section does NOT automatically update
- User must manually refresh page to see changes

### Proposed Solution

#### Backend Changes

**File:** `src/routes/workflow.js` (modify existing lock endpoint)

**Current lock endpoint returns:**
```javascript
res.json({
  success: true,
  section: updatedSection
});
```

**Enhanced response:**
```javascript
res.json({
  success: true,
  section: {
    id: sectionId,
    is_locked: true,
    locked_at: timestamp,
    locked_by: userId,
    locked_text: text,
    current_text: text,
    selected_suggestion_id: suggestionId
  },
  workflow: {
    status: 'locked',
    stage: currentStage,
    canApprove: true,
    canLock: false, // Disabled after locking
    canEdit: false
  },
  suggestions: updatedSuggestionsList // After lock, selected suggestion status changes
});
```

#### Frontend Implementation

**File:** `public/js/workflow-actions.js` (modify existing function)

**Current `lockSelectedSuggestion()` function:**

```javascript
async function lockSelectedSuggestion(sectionId) {
  // ... existing lock logic ...

  if (data.success) {
    showToast('Section locked successfully', 'success');
    // Currently stops here - no refresh
  }
}
```

**Enhanced version:**

```javascript
async function lockSelectedSuggestion(sectionId) {
  const suggestionId = selectedSuggestions.get(sectionId);

  if (!suggestionId) {
    showToast('Please select a suggestion first', 'warning');
    return;
  }

  try {
    const response = await fetch(
      `/api/workflow/sections/${sectionId}/lock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId })
      }
    );

    const data = await response.json();

    if (data.success) {
      showToast('Section locked successfully', 'success');

      // ============================================================
      // NEW: Automatically refresh the entire section
      // ============================================================
      await refreshSectionAfterLock(sectionId, data);

    } else {
      showToast(`Error: ${data.error}`, 'danger');
    }
  } catch (error) {
    console.error('Lock error:', error);
    showToast('Failed to lock section', 'danger');
  }
}

/**
 * NEW: Refresh section UI after lock
 */
async function refreshSectionAfterLock(sectionId, lockData) {
  const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!sectionElement) return;

  // 1. Update section header badges
  updateSectionHeaderBadges(sectionElement, lockData.section);

  // 2. Update section content text
  updateSectionContent(sectionElement, lockData.section);

  // 3. Update workflow action buttons
  updateWorkflowActions(sectionElement, lockData.workflow);

  // 4. Update suggestions list (selected suggestion highlighted)
  updateSuggestionsList(sectionElement, lockData.suggestions);

  // 5. Update workflow progress bar
  updateWorkflowProgressBar(sectionId, lockData.workflow);

  // 6. Show "locked" alert box
  showLockedAlert(sectionElement, lockData.section);

  // 7. Scroll to section to show changes
  sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Update section header badges
 */
function updateSectionHeaderBadges(sectionElement, sectionData) {
  const headerBadges = sectionElement.querySelector('.section-header-badges');
  if (!headerBadges) return;

  // Remove old badges
  headerBadges.innerHTML = '';

  // Add "Locked" badge
  if (sectionData.is_locked) {
    const lockedBadge = document.createElement('span');
    lockedBadge.className = 'badge bg-primary me-1';
    lockedBadge.innerHTML = '<i class="bi bi-lock-fill"></i> Locked';
    headerBadges.appendChild(lockedBadge);
  }

  // Add "Amended" badge if text changed
  if (sectionData.locked_text !== sectionData.original_text) {
    const amendedBadge = document.createElement('span');
    amendedBadge.className = 'badge bg-success me-1';
    amendedBadge.innerHTML = '<i class="bi bi-pencil-square"></i> Amended';
    headerBadges.appendChild(amendedBadge);
  }
}

/**
 * Update section content text
 */
function updateSectionContent(sectionElement, sectionData) {
  const contentDiv = sectionElement.querySelector('.section-content-text');
  if (!contentDiv) return;

  contentDiv.textContent = sectionData.locked_text || sectionData.current_text;
}

/**
 * Update workflow action buttons
 */
function updateWorkflowActions(sectionElement, workflowData) {
  const actionsDiv = sectionElement.querySelector('.workflow-actions');
  if (!actionsDiv) return;

  // Rebuild action buttons based on new permissions
  let actionsHTML = '';

  if (workflowData.canApprove) {
    actionsHTML += `
      <button class="btn btn-success btn-sm"
              onclick="approveSection('${sectionElement.dataset.sectionId}')">
        <i class="bi bi-check-circle me-1"></i>Approve
      </button>
    `;
  }

  if (workflowData.canLock) {
    actionsHTML += `
      <button class="btn btn-primary btn-sm"
              onclick="lockSelectedSuggestion('${sectionElement.dataset.sectionId}')"
              disabled>
        <i class="bi bi-lock me-1"></i>Lock
      </button>
    `;
  }

  actionsDiv.innerHTML = actionsHTML;
}

/**
 * Update suggestions list to show selection
 */
function updateSuggestionsList(sectionElement, suggestions) {
  const suggestionsDiv = sectionElement.querySelector('.suggestions-list');
  if (!suggestionsDiv) return;

  // Re-render suggestions with updated statuses
  // Highlight selected/locked suggestion
  // Disable radio buttons (can't change after lock)

  suggestions.forEach(suggestion => {
    const card = suggestionsDiv.querySelector(`[data-suggestion-id="${suggestion.id}"]`);
    if (!card) return;

    if (suggestion.status === 'selected') {
      card.classList.add('selected-suggestion');
      card.style.backgroundColor = '#e7f5ff';
      card.style.borderLeft = '4px solid #228be6';
    }

    // Disable all radio buttons
    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      radio.disabled = true;
    }
  });
}

/**
 * Show locked alert in section
 */
function showLockedAlert(sectionElement, sectionData) {
  const contentDiv = sectionElement.querySelector('.section-expanded-content');
  if (!contentDiv) return;

  // Remove existing alert if present
  const existingAlert = contentDiv.querySelector('.locked-alert');
  if (existingAlert) existingAlert.remove();

  // Create new alert
  const alert = document.createElement('div');
  alert.className = 'alert alert-info locked-alert mb-3';

  const hasChanges = sectionData.locked_text !== sectionData.original_text;

  alert.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <i class="bi bi-lock-fill me-2"></i>
        <strong>Section Locked</strong>
        ${hasChanges ? `
          <button class="btn btn-sm btn-outline-primary ms-3"
                  onclick="showDiffView('${sectionData.id}')">
            <i class="bi bi-eye"></i> Show Changes
          </button>
        ` : `
          <span class="text-muted ms-2">Original text locked without changes</span>
        `}
      </div>
      <small class="text-muted">
        Locked ${new Date(sectionData.locked_at).toLocaleString()}
      </small>
    </div>
  `;

  contentDiv.insertBefore(alert, contentDiv.firstChild);
}
```

### Implementation Notes

**No WebSocket Required (October 17, 2025 Clarification):**
- ✅ **Client-side only** refresh confirmed by user
- ✅ Only the user who performed the lock sees the immediate update
- ✅ Other users must manually refresh (acceptable for Phase 2)
- ⏳ **WebSocket deferred to Phase 3** for real-time multi-user updates

**Why This Approach:**
1. **Simplicity:** No WebSocket server or infrastructure needed
2. **Performance:** Lightweight client-side updates only
3. **Meets Requirements:** 90% of users work on different sections
4. **Future-Proof:** Easy to add WebSocket layer later without breaking changes

**Performance:**
- Single lock action triggers ONE re-render
- No additional API calls needed (all data returned from lock endpoint)
- Smooth scroll animation provides visual confirmation

### Testing Checklist

- [ ] Lock a suggestion
- [ ] Verify toast notification appears
- [ ] Verify section header badges update (show "Locked")
- [ ] Verify section content shows locked text
- [ ] Verify "Show Changes" button appears (if text changed)
- [ ] Verify workflow action buttons update (lock disabled, approve enabled)
- [ ] Verify suggestions list updates (selected suggestion highlighted)
- [ ] Verify radio buttons disabled
- [ ] Verify locked alert box appears
- [ ] Verify smooth scroll to section
- [ ] Test with "Keep Original Text" option
- [ ] Verify works for sections at different workflow stages

### Files to Modify

**MODIFY:**
- `src/routes/workflow.js` (enhance lock endpoint response)
- `public/js/workflow-actions.js` (add refresh functions)
- `views/dashboard/document-viewer.ejs` (ensure structure supports dynamic updates)

**NO NEW FILES REQUIRED**

---

## 🎯 Feature 4: Section Editing Tools (P6 - Previously Planned)

### Status

**DEFERRED to separate session** - Full implementation roadmap already exists in:
- `docs/reports/P6_IMPLEMENTATION_ROADMAP.md` (detailed guide)
- `docs/reports/P6_SECTION_EDITOR_DESIGN.md` (comprehensive spec)

### Quick Summary

Allows admins to manually edit parsed sections via:
1. **Split** - Divide one section into multiple
2. **Join** - Combine multiple sections into one
3. **Retitle** - Change section title/number
4. **Move** - Relocate section in hierarchy
5. **Delete** - Remove section

### Timeline

**Estimated:** 4-7 days (separate from Phase 2 work above)

**Dependencies:** None (can be done independently)

---

## 📊 Phase 2 Implementation Timeline

### Week 1: Foundation (Days 1-3)

**Day 1: Database & Backend**
- [ ] Create migration 018 (per-document hierarchy)
- [ ] Create migration 019 (suggestion rejection tracking)
- [ ] Run migrations in dev environment
- [ ] Test database constraints

**Day 2: API Routes**
- [ ] Implement hierarchy config endpoints (4 routes)
- [ ] Implement suggestion rejection endpoints (3 routes)
- [ ] Enhance lock endpoint response
- [ ] Write integration tests

**Day 3: Frontend Foundation**
- [ ] Create hierarchy templates config file
- [ ] Create hierarchy editor UI skeleton
- [ ] Add suggestion filter tabs
- [ ] Add reject/unreject buttons

### Week 2: Polish & Test (Days 4-7)

**Day 4: Hierarchy Editor**
- [ ] Implement drag-and-drop level editor
- [ ] Add live preview
- [ ] Add template loading
- [ ] Add "Detect from Document" feature

**Day 5: Client-Side Refresh**
- [ ] Implement `refreshSectionAfterLock()` function
- [ ] Add smooth animations
- [ ] Test badge updates
- [ ] Test suggestions list updates

**Day 6: Testing & Refinement**
- [ ] Run full test suite
- [ ] Fix bugs
- [ ] UI/UX polish
- [ ] Performance testing

**Day 7: Documentation & Deployment**
- [ ] Update API documentation
- [ ] Create user guide
- [ ] Prepare deployment
- [ ] Deploy to staging

---

## 📁 Files Summary

### New Files (10 total)

**Database:**
1. `database/migrations/018_add_per_document_hierarchy.sql`
2. `database/migrations/019_add_suggestion_rejection_tracking.sql`

**Frontend:**
3. `views/admin/document-hierarchy-editor.ejs`
4. `public/js/hierarchy-editor.js`
5. `public/css/hierarchy-editor.css`

**Backend:**
6. `src/config/hierarchyTemplates.js`

**Tests:**
7. `tests/integration/document-hierarchy.test.js`
8. `tests/integration/suggestion-rejection.test.js`

**Documentation:**
9. `docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md` (this file)
10. `docs/HIERARCHY_EDITOR_USER_GUIDE.md`

### Modified Files (5 total)

1. `src/routes/admin.js` (add 4 endpoints)
2. `src/routes/workflow.js` (add 3 endpoints, enhance 1)
3. `src/parsers/wordParser.js` (check hierarchy_override)
4. `views/dashboard/document-viewer.ejs` (add tabs, buttons, badges)
5. `public/js/workflow-actions.js` (add refresh functions)

---

## 🧪 Testing Strategy

### Unit Tests

- Hierarchy config validation
- Suggestion rejection state transitions
- Section refresh rendering

### Integration Tests

- Full hierarchy editor workflow (load → edit → save → parse)
- Suggestion rejection lifecycle (reject → filter → unreject)
- Lock → refresh → approve workflow

### E2E Tests

- Admin uploads document → customizes hierarchy → re-parses
- Admin rejects suggestion → verifies hidden → unrejects
- User locks suggestion → verifies auto-refresh → approves

### Performance Tests

- Load 100+ suggestions with rejection filtering
- Parse document with custom 10-level hierarchy
- Section refresh with large content

---

## 🚀 Deployment Plan

### Pre-Deployment

1. Run all tests in CI/CD
2. Code review
3. QA approval
4. Staging deployment

### Deployment Steps

1. **Database Migrations:**
   ```sql
   -- Run in Supabase SQL Editor (Production)
   -- Migration 018: Add hierarchy_override column
   -- Migration 019: Add rejection tracking columns
   ```

2. **Backend Deployment:**
   ```bash
   git push origin main
   # Render auto-deploys
   ```

3. **Verification:**
   - Check migration applied
   - Test hierarchy editor
   - Test suggestion rejection
   - Test section refresh

### Rollback Plan

- Migration 018: `ALTER TABLE documents DROP COLUMN hierarchy_override;`
- Migration 019: Drop rejection columns from suggestions table
- Revert code deployment via Render dashboard

---

## 📚 Related Documentation

- **Phase 1 Work:** `docs/NEXT_SESSION_WORKFLOW_FIXES.md`
- **10-Level Parsing:** `docs/reports/P5_EXECUTIVE_SUMMARY.md`
- **P6 Section Editor:** `docs/reports/P6_IMPLEMENTATION_ROADMAP.md`
- **Workflow Lock:** `docs/WORKFLOW_LOCK_IMPLEMENTATION_COMPLETE.md`

---

## ✅ Success Criteria

### Feature 1: Per-Document Hierarchy
- [ ] Admins can customize hierarchy for each document
- [ ] Pre-built templates load correctly
- [ ] Detect from document suggests accurate config
- [ ] Custom hierarchies persist across sessions
- [ ] Parser respects document-specific config

### Feature 2: Suggestion Rejection
- [ ] Admins can reject suggestions
- [ ] Rejection tracked with stage and timestamp
- [ ] Rejected suggestions hidden from lock/approve flow
- [ ] "Rejected" tab shows all rejected suggestions
- [ ] Admins can unreject suggestions
- [ ] Regular users see rejection status

### Feature 3: Client-Side Refresh
- [ ] Lock action triggers automatic section refresh
- [ ] All UI elements update (badges, content, buttons)
- [ ] Smooth scroll animation to section
- [ ] No page reload required
- [ ] Works for all lock scenarios

---

**Document Status:** ✅ READY FOR IMPLEMENTATION (Updated with User Requirements)
**Next Step:** Begin Day 1 database migrations
**User Requirements Review:** October 17, 2025 (all clarifications incorporated)

---

## 📝 Change Log

### Version 1.1.0 - October 17, 2025 (Current)

**Updated Requirements - Feature 2:**
- ❗ **BREAKING CHANGE:** Rejected suggestions NOT loaded by default (performance improvement)
- ✅ Added "Show Rejected" toggle button specification
- ✅ Updated API endpoint to support `?includeRejected=true` query parameter
- ✅ Replaced 3-tab UI with simpler toggle button approach
- ✅ Updated testing checklist to reflect on-demand loading

**Clarifications - Feature 3:**
- ✅ Confirmed client-side only refresh (no WebSocket needed for Phase 2)
- ✅ Single-user refresh acceptable (others refresh manually)
- ✅ WebSocket deferred to Phase 3 as future enhancement
- ✅ Added rationale for simpler approach

**New Documentation:**
- ✅ Created Phase 2 Current State Assessment
- ✅ Updated implementation notes throughout
- ✅ Added benefits summary for toggle approach

### Version 1.0.0 - October 17, 2025

**Initial Release:**
- Complete Phase 2 roadmap with 3 features
- Per-Document Numbering Schema Configuration
- Suggestion Rejection with Stage Tracking (original tabs approach)
- Client-Side Section Reload After Lock
- Database schemas, API specs, UI mockups
- Testing strategies, deployment plan
- 7-day implementation timeline

---

**Created:** October 17, 2025
**Last Updated:** October 17, 2025 (Version 1.1.0)
**Next Review:** End of Week 1 Implementation (October 21, 2025)
