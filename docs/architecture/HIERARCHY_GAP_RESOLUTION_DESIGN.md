# Hierarchy Gap Resolution - System Architecture Design

**Document Version:** 1.0
**Author:** System Architecture Designer
**Date:** 2025-10-27
**Status:** DESIGN PROPOSAL

---

## Executive Summary

This document presents 4 architectural approaches to solving the hierarchy gap problem in the Bylaws Tool, where documents may have missing intermediate levels (e.g., Article I → Subparagraph (a) without Sections/Subsections in between). Each approach is analyzed for user experience, implementation complexity, backward compatibility, and maintainability.

**Recommended Approach:** **Option 2 (Hierarchy Repair Tool)** with elements of **Option 3 (Smart Indent UI)**

---

## Problem Statement

### Current Behavior

The system currently enforces strict parent-child relationships where:
- `indent` requires a previous sibling to indent under
- `dedent` moves a section to become a sibling of its parent
- Both operations fail when there are hierarchy gaps

### Example Problematic Structure

```
Article I (depth 0)
  └─ Subparagraph (a) (depth 3)  ❌ MISSING: Section 1 (depth 1), Subsection (A) (depth 2)
```

Current operations cannot fix this:
- **Can't indent** Subparagraph (a): No previous sibling exists at its level
- **Can't dedent** Subparagraph (a): Would move to depth 2, still missing depth 1

### Root Causes

1. **Parser Flexibility:** `hierarchyDetector.js` allows depth jumps (lines 354-362) as warnings, not errors
2. **Storage Service:** `sectionStorage.js` builds hierarchy based on document order, allowing gaps (lines 129-185)
3. **Database Triggers:** `update_section_path()` preserves parser-calculated depth (migration 025)
4. **Manual Editing:** Users can create gaps through repeated indent/dedent operations

---

## Architecture Context

### Current System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Document Upload Flow                      │
├─────────────────────────────────────────────────────────────┤
│  wordParser.js / textParser.js                              │
│       ↓                                                      │
│  hierarchyDetector.js (allows depth jumps)                  │
│       ↓                                                      │
│  sectionStorage.js (builds hierarchy with gaps)             │
│       ↓                                                      │
│  PostgreSQL document_sections table                         │
│  - parent_section_id (UUID, nullable)                       │
│  - depth (INTEGER, 0-9)                                     │
│  - ordinal (INTEGER, 1-based sibling position)              │
│  - path_ids (UUID[], ancestry chain)                        │
│  - path_ordinals (INTEGER[], ordinal chain)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 User Editing Operations                      │
├─────────────────────────────────────────────────────────────┤
│  POST /admin/sections/:id/indent                            │
│  POST /admin/sections/:id/dedent                            │
│  POST /admin/sections/:id/move-up                           │
│  POST /admin/sections/:id/move-down                         │
│  PUT  /admin/sections/:id/move (to new parent)              │
└─────────────────────────────────────────────────────────────┘
```

### Hierarchy Configuration (10-Level System)

Organizations define 10 hierarchy levels (depths 0-9):
- Each level has: `name`, `prefix`, `numbering` (roman/numeric/alpha/alphaLower)
- Documents can override with custom `hierarchy_override` config
- Example: Article (0) → Section (1) → Subsection (2) → Paragraph (3) → Subparagraph (4) → Item (5) → Subitem (6) → Clause (7) → Subclause (8) → Point (9)

---

## Option 1: Auto-Create Missing Levels (Automatic Repair)

### Overview

When indent/dedent would create or expose a gap, **automatically insert placeholder sections** for missing intermediate levels.

### Detailed Design

#### 1.1 Detection Logic

```javascript
// New validation function in admin.js
async function detectHierarchyGap(section, targetDepth, targetParentId, supabase) {
  const currentDepth = section.depth;
  const depthChange = Math.abs(targetDepth - currentDepth);

  // Gap exists if depth jumps by more than 1
  if (depthChange > 1) {
    // Calculate missing depths
    const missingDepths = [];
    const [start, end] = targetDepth > currentDepth
      ? [currentDepth + 1, targetDepth - 1]
      : [targetDepth + 1, currentDepth - 1];

    for (let d = start; d <= end; d++) {
      missingDepths.push(d);
    }

    return {
      hasGap: true,
      missingDepths,
      needsAutoCreate: true
    };
  }

  return { hasGap: false };
}
```

#### 1.2 Auto-Creation Process

```javascript
// Enhanced indent operation
router.post('/sections/:id/indent', requireAdmin, validateSectionEditable, async (req, res) => {
  const section = req.section;
  const { supabaseService } = req;

  // Find previous sibling (target parent)
  const previousSibling = await findPreviousSibling(section);
  if (!previousSibling) {
    return res.status(400).json({ error: 'Cannot indent: no earlier sibling' });
  }

  const targetDepth = previousSibling.depth + 1;
  const gap = await detectHierarchyGap(section, targetDepth, previousSibling.id, supabaseService);

  if (gap.hasGap) {
    // AUTO-CREATE missing intermediate levels
    const placeholders = await createPlaceholderSections(
      gap.missingDepths,
      section.document_id,
      previousSibling.id, // Start parent
      section.id, // Final child
      supabaseService
    );

    console.log(`Auto-created ${placeholders.length} placeholder sections:`, placeholders);
  }

  // Proceed with indent operation
  await performIndent(section.id, previousSibling.id, supabaseService);

  res.json({
    success: true,
    autoCreated: gap.hasGap ? gap.missingDepths.length : 0
  });
});
```

#### 1.3 Placeholder Section Generation

```javascript
async function createPlaceholderSections(missingDepths, documentId, parentId, childId, supabase) {
  const placeholders = [];
  const hierarchyConfig = await getDocumentHierarchy(documentId, supabase);

  let currentParentId = parentId;

  for (const depth of missingDepths) {
    const level = hierarchyConfig.levels.find(l => l.depth === depth);
    if (!level) throw new Error(`No hierarchy level defined for depth ${depth}`);

    // Generate placeholder section
    const placeholder = {
      document_id: documentId,
      parent_section_id: currentParentId,
      depth: depth,
      ordinal: 1, // First child of parent
      section_number: `[Auto-${level.name}]`,
      section_title: `(Auto-created ${level.name})`,
      section_type: level.type,
      original_text: `This ${level.name} was automatically created to fix hierarchy gaps.`,
      current_text: `This ${level.name} was automatically created to fix hierarchy gaps.`,
      metadata: {
        auto_created: true,
        created_reason: 'hierarchy_gap_repair',
        created_at: new Date().toISOString()
      }
    };

    const { data, error } = await supabase
      .from('document_sections')
      .insert(placeholder)
      .select()
      .single();

    if (error) throw error;

    placeholders.push(data);
    currentParentId = data.id; // Next placeholder's parent
  }

  // Update final child's parent to last placeholder
  if (placeholders.length > 0) {
    const lastPlaceholder = placeholders[placeholders.length - 1];
    await supabase
      .from('document_sections')
      .update({ parent_section_id: lastPlaceholder.id })
      .eq('id', childId);
  }

  return placeholders;
}
```

#### 1.4 User Interface Indication

```html
<!-- Visual indicator for auto-created sections -->
<div class="section-item auto-created" data-section-id="...">
  <span class="badge badge-warning">
    <i class="bi bi-magic"></i> Auto-created
  </span>
  <span class="section-number">[Auto-Section 1]</span>
  <span class="section-title">(Auto-created Section)</span>
  <button class="btn btn-sm btn-outline-primary" onclick="customizeSection(...)">
    Customize
  </button>
</div>

<style>
.section-item.auto-created {
  background: #fff3cd; /* Light yellow */
  border-left: 3px solid #ffc107; /* Warning color */
}
</style>
```

### Pros

✅ **Zero user intervention required** - Fully automatic
✅ **Maintains hierarchy integrity** - No gaps in structure
✅ **Works for all operations** - indent, dedent, move, reorder
✅ **Backward compatible** - Existing documents unaffected
✅ **Clear audit trail** - Metadata tracks auto-created sections

### Cons

❌ **Unexpected behavior** - Users may be surprised by new sections appearing
❌ **Clutter** - Multiple auto-created sections for large gaps
❌ **Numbering complexity** - How to auto-number placeholders?
❌ **Document semantics** - May not match intended document structure
❌ **Undo complexity** - Difficult to revert auto-created sections

### Implementation Complexity: **MEDIUM-HIGH**

**Files to modify:**
- `/src/routes/admin.js` (indent, dedent, move operations)
- `/src/services/hierarchyRepair.js` (NEW - auto-creation logic)
- `/views/dashboard/document-viewer.ejs` (UI indicators)
- `/database/migrations/027_hierarchy_gap_metadata.sql` (NEW - metadata tracking)

**Estimated effort:** 3-5 days

---

## Option 2: Hierarchy Repair Tool (User-Guided Batch Operation)

### Overview

Provide a **dedicated "Fix Hierarchy" tool** that analyzes the entire document, identifies gaps, and presents a UI for users to review and approve repairs with customizable titles/numbers.

### Detailed Design

#### 2.1 Gap Analysis Endpoint

```javascript
/**
 * GET /admin/documents/:docId/hierarchy/analyze
 * Analyze document for hierarchy gaps
 */
router.get('/documents/:docId/hierarchy/analyze', requireAdmin, async (req, res) => {
  const { docId } = req.params;
  const { supabaseService } = req;

  // Fetch all sections ordered by document_order
  const { data: sections } = await supabaseService
    .from('document_sections')
    .select('id, parent_section_id, depth, section_number, section_title, ordinal')
    .eq('document_id', docId)
    .order('document_order', { ascending: true });

  const gaps = [];
  let prevDepth = -1;

  for (const section of sections) {
    const depthJump = section.depth - prevDepth;

    if (depthJump > 1 && prevDepth >= 0) {
      // Gap detected!
      const missingDepths = [];
      for (let d = prevDepth + 1; d < section.depth; d++) {
        missingDepths.push(d);
      }

      gaps.push({
        section_id: section.id,
        section_number: section.section_number,
        section_title: section.section_title,
        current_depth: section.depth,
        expected_depth: prevDepth + 1,
        missing_depths: missingDepths,
        gap_size: depthJump - 1
      });
    }

    prevDepth = section.depth;
  }

  res.json({
    success: true,
    total_sections: sections.length,
    gaps_found: gaps.length,
    gaps: gaps
  });
});
```

#### 2.2 Repair Preview Generation

```javascript
/**
 * POST /admin/documents/:docId/hierarchy/repair-preview
 * Generate repair plan with placeholder sections
 */
router.post('/documents/:docId/hierarchy/repair-preview', requireAdmin, async (req, res) => {
  const { docId } = req.params;
  const { supabaseService } = req;

  const { gaps } = await analyzeHierarchyGaps(docId, supabaseService);
  const hierarchyConfig = await getDocumentHierarchy(docId, supabaseService);

  const repairPlan = [];

  for (const gap of gaps) {
    const placeholders = [];

    for (const missingDepth of gap.missing_depths) {
      const level = hierarchyConfig.levels.find(l => l.depth === missingDepth);

      placeholders.push({
        depth: missingDepth,
        level_name: level.name,
        level_type: level.type,
        suggested_number: generateSuggestedNumber(level, missingDepth),
        suggested_title: `(Untitled ${level.name})`,
        numbering_scheme: level.numbering
      });
    }

    repairPlan.push({
      after_section: gap.section_number,
      child_section: gap.section_number,
      placeholders: placeholders
    });
  }

  res.json({
    success: true,
    repair_plan: repairPlan,
    total_insertions: repairPlan.reduce((sum, p) => sum + p.placeholders.length, 0)
  });
});
```

#### 2.3 User Interface (Modal)

```html
<!-- Hierarchy Repair Modal -->
<div class="modal fade" id="hierarchyRepairModal" tabindex="-1">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header bg-warning text-dark">
        <h5 class="modal-title">
          <i class="bi bi-exclamation-triangle"></i> Hierarchy Gaps Detected
        </h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>

      <div class="modal-body">
        <div class="alert alert-info">
          <strong>Found {{ gapsFound }} hierarchy gap(s)</strong> in this document.
          Review the proposed repairs below and customize titles/numbers as needed.
        </div>

        <!-- Gap Repair Cards -->
        <div id="repairPlanContainer">
          <!-- For each gap -->
          <div class="card mb-3 border-warning">
            <div class="card-header bg-light">
              <strong>Gap after:</strong> Article I
              <br>
              <strong>Affected section:</strong> (a) First subparagraph
              <br>
              <strong>Missing levels:</strong> Section (depth 1), Subsection (depth 2)
            </div>
            <div class="card-body">
              <!-- For each placeholder to create -->
              <div class="placeholder-row mb-3">
                <div class="row align-items-center">
                  <div class="col-md-3">
                    <span class="badge bg-secondary">Depth 1: Section</span>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small mb-1">Section Number</label>
                    <input type="text"
                           class="form-control form-control-sm"
                           value="Section 1"
                           data-gap-id="gap1"
                           data-depth="1"
                           name="section_number">
                  </div>
                  <div class="col-md-5">
                    <label class="form-label small mb-1">Section Title</label>
                    <input type="text"
                           class="form-control form-control-sm"
                           value="(Untitled Section)"
                           data-gap-id="gap1"
                           data-depth="1"
                           name="section_title">
                  </div>
                </div>
              </div>

              <div class="placeholder-row mb-3">
                <div class="row align-items-center">
                  <div class="col-md-3">
                    <span class="badge bg-secondary">Depth 2: Subsection</span>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small mb-1">Section Number</label>
                    <input type="text"
                           class="form-control form-control-sm"
                           value="(A)"
                           data-gap-id="gap1"
                           data-depth="2"
                           name="section_number">
                  </div>
                  <div class="col-md-5">
                    <label class="form-label small mb-1">Section Title</label>
                    <input type="text"
                           class="form-control form-control-sm"
                           value="(Untitled Subsection)"
                           data-gap-id="gap1"
                           data-depth="2"
                           name="section_title">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-warning" onclick="applyHierarchyRepair()">
          <i class="bi bi-tools"></i> Apply Repairs ({{ totalInsertions }} sections)
        </button>
      </div>
    </div>
  </div>
</div>
```

#### 2.4 Batch Repair Execution

```javascript
/**
 * POST /admin/documents/:docId/hierarchy/repair
 * Execute hierarchy repair with user-customized placeholders
 */
router.post('/documents/:docId/hierarchy/repair', requireAdmin, async (req, res) => {
  const { docId } = req.params;
  const { repairs } = req.body; // Array of gap repairs with user input
  const { supabaseService } = req;

  const insertedSections = [];

  // Process each gap repair
  for (const repair of repairs) {
    const { gap_id, placeholders } = repair;

    let currentParentId = null; // Will be determined from gap context

    // Insert placeholders in order (depth 1, depth 2, etc.)
    for (const placeholder of placeholders) {
      const { data, error } = await supabaseService
        .from('document_sections')
        .insert({
          document_id: docId,
          parent_section_id: currentParentId,
          depth: placeholder.depth,
          ordinal: placeholder.ordinal,
          section_number: placeholder.section_number,
          section_title: placeholder.section_title,
          section_type: placeholder.section_type,
          original_text: placeholder.content || '',
          current_text: placeholder.content || '',
          metadata: {
            created_by_repair_tool: true,
            repair_timestamp: new Date().toISOString(),
            gap_id: gap_id
          }
        })
        .select()
        .single();

      if (error) throw error;

      insertedSections.push(data);
      currentParentId = data.id; // Next placeholder's parent
    }

    // Update original child section to point to last placeholder
    if (insertedSections.length > 0) {
      const lastPlaceholder = insertedSections[insertedSections.length - 1];
      await supabaseService
        .from('document_sections')
        .update({ parent_section_id: lastPlaceholder.id })
        .eq('id', repair.child_section_id);
    }
  }

  res.json({
    success: true,
    sections_created: insertedSections.length,
    inserted_sections: insertedSections
  });
});
```

#### 2.5 UI Button Placement

```html
<!-- In document-viewer.ejs header -->
<div class="document-header">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center">
      <div>
        <h1><%= document.title %></h1>
      </div>
      <div>
        <% if (req.session.isGlobalAdmin || userRole === 'admin') { %>
          <button class="btn btn-warning" onclick="analyzeHierarchy()">
            <i class="bi bi-diagram-3"></i> Fix Hierarchy
          </button>
          <a href="/admin/documents/<%= document.id %>/edit" class="btn btn-primary">
            <i class="bi bi-pencil"></i> Edit
          </a>
        <% } %>
      </div>
    </div>
  </div>
</div>

<script>
async function analyzeHierarchy() {
  const docId = '<%= document.id %>';

  // 1. Analyze for gaps
  const analysis = await fetch(`/admin/documents/${docId}/hierarchy/analyze`);
  const { gaps_found, gaps } = await analysis.json();

  if (gaps_found === 0) {
    alert('No hierarchy gaps found. Document structure is valid.');
    return;
  }

  // 2. Get repair preview
  const preview = await fetch(`/admin/documents/${docId}/hierarchy/repair-preview`, {
    method: 'POST'
  });
  const { repair_plan } = await preview.json();

  // 3. Show modal with repair plan
  renderRepairModal(repair_plan);
  $('#hierarchyRepairModal').modal('show');
}

async function applyHierarchyRepair() {
  const repairs = collectRepairData(); // Gather user inputs from modal

  const response = await fetch(`/admin/documents/<%= document.id %>/hierarchy/repair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repairs })
  });

  if (response.ok) {
    alert('Hierarchy repaired successfully!');
    location.reload(); // Refresh to show updated document
  } else {
    alert('Failed to repair hierarchy. Please try again.');
  }
}
</script>
```

### Pros

✅ **User control** - Users review and approve all changes
✅ **Customization** - Users can name/number new sections appropriately
✅ **Batch operation** - Fix entire document at once
✅ **Clear preview** - Users see exactly what will be created
✅ **Audit trail** - Metadata tracks repair operations
✅ **Optional** - Users can skip repair if gaps are intentional
✅ **Educational** - Users understand document structure better

### Cons

❌ **Requires user action** - Not automatic
❌ **UI complexity** - Modal with many inputs can be overwhelming
❌ **One-time fix** - Doesn't prevent future gaps from manual editing

### Implementation Complexity: **MEDIUM**

**Files to modify:**
- `/src/routes/admin.js` (3 new endpoints: analyze, repair-preview, repair)
- `/src/services/hierarchyAnalyzer.js` (NEW - gap detection logic)
- `/views/dashboard/document-viewer.ejs` (UI button, modal, JavaScript)
- `/public/js/hierarchy-repair.js` (NEW - frontend logic)
- `/database/migrations/027_hierarchy_repair_metadata.sql` (NEW - tracking)

**Estimated effort:** 4-6 days

---

## Option 3: Smart Indent with Level Selection (Enhanced UI)

### Overview

Enhance the **indent/dedent operations** with a modal that lets users choose the target depth level, auto-creating intermediate levels as needed.

### Detailed Design

#### 3.1 Enhanced Indent Endpoint

```javascript
/**
 * POST /admin/sections/:id/indent
 * Enhanced with target depth selection
 */
router.post('/sections/:id/indent', requireAdmin, validateSectionEditable, async (req, res) => {
  const { id } = req.params;
  const { targetDepth, customTitles } = req.body; // NEW: optional parameters
  const section = req.section;
  const { supabaseService } = req;

  // Find previous sibling
  const previousSibling = await findPreviousSibling(section);
  if (!previousSibling) {
    return res.status(400).json({ error: 'Cannot indent: no earlier sibling' });
  }

  // Default behavior: indent by 1 level
  const defaultTargetDepth = previousSibling.depth + 1;
  const finalTargetDepth = targetDepth || defaultTargetDepth;

  // Check if multi-level indent requested
  const depthChange = finalTargetDepth - section.depth;

  if (depthChange > 1) {
    // Create intermediate levels
    const placeholders = await createIntermediateLevels(
      section.id,
      previousSibling.id,
      section.depth,
      finalTargetDepth,
      customTitles,
      supabaseService
    );

    return res.json({
      success: true,
      message: `Indented ${depthChange} levels`,
      placeholders_created: placeholders.length,
      new_depth: finalTargetDepth
    });
  }

  // Standard single-level indent
  await performIndent(section.id, previousSibling.id, supabaseService);
  res.json({ success: true, new_depth: defaultTargetDepth });
});
```

#### 3.2 Level Selection Modal

```html
<!-- Smart Indent Modal -->
<div class="modal fade" id="smartIndentModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Smart Indent</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>

      <div class="modal-body">
        <p>
          <strong>Current section:</strong> <span id="currentSectionTitle"></span><br>
          <strong>Current depth:</strong> <span id="currentDepth"></span><br>
          <strong>Previous sibling:</strong> <span id="prevSiblingTitle"></span><br>
        </p>

        <div class="alert alert-info">
          <i class="bi bi-info-circle"></i>
          Select how deep you want to indent this section.
          If you skip levels, placeholder sections will be created automatically.
        </div>

        <div class="form-group mb-3">
          <label class="form-label">Target depth level</label>
          <select class="form-select" id="targetDepthSelect">
            <!-- Populated dynamically -->
            <option value="1" selected>Depth 1: Section (standard indent)</option>
            <option value="2">Depth 2: Subsection</option>
            <option value="3">Depth 3: Paragraph</option>
            <option value="4">Depth 4: Subparagraph</option>
            <!-- ... up to depth 9 -->
          </select>
        </div>

        <!-- Show placeholder customization if multi-level selected -->
        <div id="placeholderCustomization" style="display: none;">
          <hr>
          <h6>Customize intermediate levels</h6>
          <div id="placeholderInputs">
            <!-- Dynamically generated for each missing level -->
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="applySmartIndent()">
          <i class="bi bi-arrow-right-circle"></i> Indent
        </button>
      </div>
    </div>
  </div>
</div>

<script>
document.getElementById('targetDepthSelect').addEventListener('change', function() {
  const selectedDepth = parseInt(this.value);
  const currentDepth = parseInt(document.getElementById('currentDepth').textContent);
  const gap = selectedDepth - currentDepth;

  if (gap > 1) {
    // Show placeholder customization inputs
    document.getElementById('placeholderCustomization').style.display = 'block';
    renderPlaceholderInputs(currentDepth, selectedDepth);
  } else {
    document.getElementById('placeholderCustomization').style.display = 'none';
  }
});

function renderPlaceholderInputs(currentDepth, targetDepth) {
  const container = document.getElementById('placeholderInputs');
  container.innerHTML = '';

  for (let depth = currentDepth + 1; depth < targetDepth; depth++) {
    const levelConfig = hierarchyLevels.find(l => l.depth === depth);

    const div = document.createElement('div');
    div.className = 'mb-3';
    div.innerHTML = `
      <label class="form-label small"><strong>Depth ${depth}: ${levelConfig.name}</strong></label>
      <div class="row g-2">
        <div class="col-6">
          <input type="text"
                 class="form-control form-control-sm"
                 placeholder="Number"
                 data-depth="${depth}"
                 name="placeholder_number"
                 value="${generateDefaultNumber(levelConfig)}">
        </div>
        <div class="col-6">
          <input type="text"
                 class="form-control form-control-sm"
                 placeholder="Title"
                 data-depth="${depth}"
                 name="placeholder_title"
                 value="(Untitled ${levelConfig.name})">
        </div>
      </div>
    `;
    container.appendChild(div);
  }
}

async function applySmartIndent() {
  const sectionId = currentSectionId;
  const targetDepth = parseInt(document.getElementById('targetDepthSelect').value);
  const customTitles = collectPlaceholderData();

  const response = await fetch(`/admin/sections/${sectionId}/indent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetDepth, customTitles })
  });

  if (response.ok) {
    $('#smartIndentModal').modal('hide');
    location.reload();
  } else {
    alert('Indent failed. Please try again.');
  }
}
</script>
```

#### 3.3 Frontend Integration

```javascript
// Modify existing indent button click handler
function onIndentButtonClick(sectionId) {
  const section = getSectionById(sectionId);
  const previousSibling = findPreviousSibling(sectionId);

  if (!previousSibling) {
    alert('Cannot indent: no earlier sibling');
    return;
  }

  // Check for potential gaps
  const targetDepth = previousSibling.depth + 1;
  const hierarchyConfig = getDocumentHierarchy();

  // Populate modal with section info
  document.getElementById('currentSectionTitle').textContent = section.title;
  document.getElementById('currentDepth').textContent = section.depth;
  document.getElementById('prevSiblingTitle').textContent = previousSibling.title;

  // Populate depth options
  const select = document.getElementById('targetDepthSelect');
  select.innerHTML = '';

  for (let d = targetDepth; d <= 9; d++) {
    const level = hierarchyConfig.levels.find(l => l.depth === d);
    if (!level) continue;

    const option = document.createElement('option');
    option.value = d;
    option.textContent = `Depth ${d}: ${level.name}`;
    if (d === targetDepth) option.selected = true;
    select.appendChild(option);
  }

  // Show modal
  $('#smartIndentModal').modal('show');
}
```

### Pros

✅ **Intuitive UI** - Users see hierarchy levels clearly
✅ **Flexible** - Works for single or multi-level indents
✅ **Customization** - Users control placeholder content
✅ **Prevents gaps** - Automatically fills missing levels
✅ **Educational** - Users learn document structure
✅ **Backward compatible** - Standard indent still works

### Cons

❌ **More clicks** - Every indent requires modal interaction
❌ **UI complexity** - Modal may be overkill for simple indents
❌ **Doesn't fix existing gaps** - Only prevents new ones

### Implementation Complexity: **MEDIUM**

**Files to modify:**
- `/src/routes/admin.js` (enhanced indent/dedent endpoints)
- `/views/dashboard/document-viewer.ejs` (modal UI, JavaScript)
- `/public/js/smart-indent.js` (NEW - frontend logic)

**Estimated effort:** 3-4 days

---

## Option 4: Relaxed Hierarchy (Allow Non-Consecutive Depths)

### Overview

**Change the system philosophy** to allow non-consecutive depths as a valid document structure. Update numbering and path calculations to handle gaps gracefully.

### Detailed Design

#### 4.1 Database Schema Changes

```sql
-- Migration 027: Relax depth constraints
-- Allow non-consecutive depths (gaps are valid)

-- Update CHECK constraint to allow any depth 0-9
ALTER TABLE document_sections
DROP CONSTRAINT IF EXISTS document_sections_depth_check;

ALTER TABLE document_sections
ADD CONSTRAINT document_sections_depth_check
CHECK (depth >= 0 AND depth <= 9);

-- Remove parent depth validation (was: parent_depth + 1)
-- Now: child depth can be ANY value >= parent_depth
```

#### 4.2 Path Calculation Update

```sql
-- Update trigger to handle gaps in path_ordinals
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    IF NEW.depth IS NULL THEN
      NEW.depth := 0;
    END IF;
  ELSE
    -- Child section: inherit parent's path
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      -- ✅ NEW: Allow depth to be explicitly set (not always parent.depth + 1)
      CASE
        WHEN NEW.depth IS NOT NULL THEN NEW.depth  -- Preserve explicit depth
        ELSE p.depth + 1  -- Default to sequential
      END
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent section must exist';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### 4.3 Hierarchy Validator Update

```javascript
// hierarchyDetector.js - Change depth jump validation
validateHierarchy(sections, organizationConfig) {
  const errors = [];
  const warnings = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // ✅ NEW: Depth jumps are ALLOWED (no warning/error)
    // Just validate maximum depth
    if (section.depth > 9) {
      errors.push({
        section: section.citation,
        error: `Depth ${section.depth} exceeds maximum of 9`
      });
    }

    // Validate numbering format (unchanged)
    // ...
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
```

#### 4.4 Citation Generation Update

```javascript
// Generate citation for sections with depth gaps
function generateCitation(section, hierarchyConfig) {
  const pathOrdinals = section.path_ordinals || [];
  const pathDepths = section.path_ids.map((id, idx) => {
    // Look up actual depth for each ancestor
    return getDepthForSection(id);
  });

  const citationParts = [];

  for (let i = 0; i < pathOrdinals.length; i++) {
    const depth = pathDepths[i];
    const ordinal = pathOrdinals[i];
    const level = hierarchyConfig.levels.find(l => l.depth === depth);

    if (level) {
      const number = formatNumberByScheme(ordinal, level.numbering);
      citationParts.push(`${level.prefix}${number}`);
    }
  }

  // Example result: "Article I.(a)" (missing Section/Subsection - that's OK!)
  return citationParts.join('.');
}
```

#### 4.5 UI Updates

```html
<!-- Show depth gaps visually in TOC -->
<div class="toc-item depth-0">
  <a href="#section-1">Article I</a>
</div>

<!-- Visual indicator for depth gap -->
<div class="toc-item depth-3" style="padding-left: 45px;">
  <span class="badge badge-secondary">Gap: depth 0→3</span>
  <a href="#section-2">(a) First subparagraph</a>
</div>

<style>
.toc-item[data-depth-gap="true"]::before {
  content: "⋮";
  color: #6c757d;
  margin-right: 8px;
  font-weight: bold;
}
</style>
```

### Pros

✅ **Simplest implementation** - Remove validation, not add complexity
✅ **Flexible document structure** - Users can organize however they want
✅ **No placeholder clutter** - No auto-created sections
✅ **Fast** - No repair operations needed
✅ **Backward compatible** - Existing gaps become "valid"

### Cons

❌ **Confusing for users** - Non-sequential depths are counterintuitive
❌ **Citation complexity** - "Article I.(a)" looks odd without Section/Subsection
❌ **Numbering issues** - Hard to auto-number when levels are skipped
❌ **Document semantics** - May not reflect intended legal structure
❌ **Violates hierarchy principles** - Most document standards expect sequential depths
❌ **RLS policy complexity** - Policies assume parent at depth-1

### Implementation Complexity: **LOW-MEDIUM**

**Files to modify:**
- `/database/migrations/027_relax_depth_constraint.sql` (NEW)
- `/src/parsers/hierarchyDetector.js` (remove depth jump warnings)
- `/src/services/sectionStorage.js` (update citation generation)
- `/views/dashboard/document-viewer.ejs` (visual indicators for gaps)

**Estimated effort:** 2-3 days

---

## Comparative Analysis Matrix

| Criteria | Option 1: Auto-Create | Option 2: Repair Tool | Option 3: Smart Indent | Option 4: Relaxed Hierarchy |
|----------|----------------------|----------------------|------------------------|----------------------------|
| **User Experience** | 😐 Surprising | 😊 Controlled | 😊 Intuitive | 😕 Confusing |
| **Implementation** | 🔴 Medium-High | 🟡 Medium | 🟡 Medium | 🟢 Low-Medium |
| **Backward Compat** | 🟢 Yes | 🟢 Yes | 🟢 Yes | 🟢 Yes |
| **Prevents Gaps** | 🟢 Yes | 🟡 After repair | 🟢 Yes | 🔴 No (allows gaps) |
| **User Control** | 🔴 Low | 🟢 High | 🟢 High | 🟢 Full freedom |
| **Clutter** | 🔴 High | 🟡 Moderate | 🟡 Moderate | 🟢 None |
| **Maintenance** | 🔴 Complex | 🟡 Moderate | 🟡 Moderate | 🟢 Simple |
| **Audit Trail** | 🟢 Good | 🟢 Excellent | 🟢 Good | 🔴 N/A |
| **Educational** | 🔴 No | 🟢 Yes | 🟢 Yes | 🔴 No |
| **Edge Cases** | 🔴 Many | 🟡 Some | 🟡 Some | 🟢 Few |

---

## Recommended Approach: **Hybrid Solution (Option 2 + Option 3)**

### Rationale

After analyzing all approaches, I recommend a **hybrid solution** that combines:
- **Option 2 (Hierarchy Repair Tool)** - For fixing existing gaps in uploaded documents
- **Option 3 (Smart Indent UI)** - For preventing new gaps during manual editing

### Why This Combination?

1. **Addresses both use cases:**
   - **Uploaded documents** (past): Batch repair tool fixes all gaps at once
   - **Manual editing** (future): Smart indent prevents new gaps proactively

2. **User control:**
   - Users review and approve all changes
   - Customizable titles/numbers for placeholders
   - Optional - users can skip repair if gaps are intentional

3. **Best of both worlds:**
   - **Repair Tool** handles complex batch operations
   - **Smart Indent** makes editing intuitive and gap-free

4. **Maintainable:**
   - Clear separation of concerns
   - No automatic "magic" that surprises users
   - Easy to extend with new features

### Architecture Decision Record (ADR)

```markdown
# ADR-027: Hierarchy Gap Resolution Strategy

**Status:** PROPOSED
**Date:** 2025-10-27
**Deciders:** System Architect, Development Team

## Context

Documents may have hierarchy gaps (missing intermediate levels) from:
- Parser flexibility allowing depth jumps
- Manual editing operations (indent/dedent)
- Data imports from external sources

Current indent/dedent operations cannot fix these gaps.

## Decision

Implement a **hybrid approach**:
1. **Hierarchy Repair Tool** (batch operation for existing gaps)
2. **Smart Indent Modal** (prevention for new gaps)

## Consequences

**Positive:**
- Users have full control over repairs
- Clear audit trail of changes
- Educational - users learn document structure
- Prevents future gaps proactively

**Negative:**
- Requires user action (not fully automatic)
- UI complexity (modal interactions)
- More code to maintain

**Neutral:**
- Existing gaps remain until user runs repair tool
- Users can choose to keep gaps if intentional
```

---

## Implementation Roadmap

### Phase 1: Hierarchy Repair Tool (Week 1-2)

#### Sprint 1: Backend API
**Files:**
- `/src/services/hierarchyAnalyzer.js` (NEW)
- `/src/routes/admin.js` (3 new endpoints)
- `/database/migrations/027_hierarchy_repair_metadata.sql` (NEW)

**Tasks:**
1. ✅ Create `analyzeHierarchyGaps()` function
2. ✅ Create `generateRepairPreview()` function
3. ✅ Create `executeRepair()` function
4. ✅ Add metadata tracking for repaired sections
5. ✅ Write unit tests

**Deliverables:**
- `GET /admin/documents/:docId/hierarchy/analyze`
- `POST /admin/documents/:docId/hierarchy/repair-preview`
- `POST /admin/documents/:docId/hierarchy/repair`

#### Sprint 2: Frontend UI
**Files:**
- `/views/dashboard/document-viewer.ejs`
- `/public/js/hierarchy-repair.js` (NEW)
- `/public/css/hierarchy-repair.css` (NEW)

**Tasks:**
1. ✅ Create "Fix Hierarchy" button in document header
2. ✅ Build hierarchy repair modal
3. ✅ Implement gap visualization
4. ✅ Add placeholder customization inputs
5. ✅ Connect to backend API
6. ✅ Add loading states and error handling

**Deliverables:**
- Working repair modal with preview
- Customizable placeholder inputs
- Visual gap indicators

### Phase 2: Smart Indent Modal (Week 3)

#### Sprint 3: Enhanced Indent Operation
**Files:**
- `/src/routes/admin.js` (modify POST /sections/:id/indent)
- `/src/services/hierarchyOperations.js` (NEW)

**Tasks:**
1. ✅ Extend indent endpoint to accept `targetDepth` parameter
2. ✅ Create `createIntermediateLevels()` function
3. ✅ Update ordinal shifting logic
4. ✅ Add metadata tracking
5. ✅ Write unit tests

#### Sprint 4: Smart Indent UI
**Files:**
- `/views/dashboard/document-viewer.ejs`
- `/public/js/smart-indent.js` (NEW)

**Tasks:**
1. ✅ Create smart indent modal
2. ✅ Add depth level selector
3. ✅ Implement dynamic placeholder inputs
4. ✅ Update indent button click handler
5. ✅ Add keyboard shortcuts (Ctrl+Shift+Right Arrow)

### Phase 3: Testing & Documentation (Week 4)

#### Sprint 5: Integration Testing
**Files:**
- `/tests/integration/hierarchy-repair.test.js` (NEW)
- `/tests/integration/smart-indent.test.js` (NEW)

**Tasks:**
1. ✅ Test repair tool with various gap scenarios
2. ✅ Test smart indent with multi-level gaps
3. ✅ Test edge cases (max depth, root level, etc.)
4. ✅ Performance testing with large documents (1000+ sections)
5. ✅ Browser compatibility testing

#### Sprint 6: Documentation
**Files:**
- `/docs/user-guide/hierarchy-repair.md` (NEW)
- `/docs/developer-guide/hierarchy-operations.md` (NEW)

**Tasks:**
1. ✅ Write user guide for repair tool
2. ✅ Document smart indent workflow
3. ✅ Create troubleshooting guide
4. ✅ Update API documentation
5. ✅ Add inline code comments

---

## User Experience Mockups

### Mockup 1: Hierarchy Repair Tool Workflow

```
Step 1: User clicks "Fix Hierarchy" button
┌────────────────────────────────────────────┐
│ [Fix Hierarchy] [Edit] [Download]         │
└────────────────────────────────────────────┘

Step 2: System analyzes document
┌────────────────────────────────────────────┐
│ Analyzing document structure...            │
│ [=============░░░░░░░░░] 60%               │
└────────────────────────────────────────────┘

Step 3: Modal shows gaps found
┌───────────────────────────────────────────────────┐
│ ⚠️ Hierarchy Gaps Detected                        │
│                                                   │
│ Found 3 hierarchy gap(s) in this document.       │
│ Review proposed repairs below:                   │
│                                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ Gap after: Article I                        │ │
│ │ Affected: (a) First subparagraph            │ │
│ │ Missing: Section (depth 1), Subsection (2)  │ │
│ │                                             │ │
│ │ Depth 1: Section                            │ │
│ │   Number: [Section 1    ] Title: [.......] │ │
│ │ Depth 2: Subsection                         │ │
│ │   Number: [(A)          ] Title: [.......] │ │
│ └─────────────────────────────────────────────┘ │
│                                                   │
│ [Cancel] [Apply Repairs (4 sections)]            │
└───────────────────────────────────────────────────┘

Step 4: Success message
┌────────────────────────────────────────────┐
│ ✅ Hierarchy repaired successfully!        │
│ Created 4 new sections.                    │
└────────────────────────────────────────────┘
```

### Mockup 2: Smart Indent Workflow

```
Step 1: User clicks indent button on a section
┌────────────────────────────────────────────┐
│ Article I                                  │
│   (a) First subparagraph [↑] [↓] [➡️] [⬅️] │
└────────────────────────────────────────────┘
                                    👆 clicked

Step 2: Modal shows depth options
┌───────────────────────────────────────────────────┐
│ Smart Indent                                      │
│                                                   │
│ Current section: (a) First subparagraph          │
│ Current depth: 3                                 │
│ Previous sibling: Article I                      │
│                                                   │
│ Select target depth:                             │
│ ┌───────────────────────────────────────────┐   │
│ │ ▼ Depth 1: Section (standard indent)      │   │
│ │   Depth 2: Subsection                     │   │
│ │   Depth 3: Paragraph                      │   │
│ └───────────────────────────────────────────┘   │
│                                                   │
│ [Cancel] [Indent]                                │
└───────────────────────────────────────────────────┘

Step 3: If multi-level selected, show customization
┌───────────────────────────────────────────────────┐
│ Smart Indent                                      │
│                                                   │
│ Target depth: Depth 2 (Subsection)               │
│                                                   │
│ Customize intermediate levels:                   │
│ ┌───────────────────────────────────────────┐   │
│ │ Depth 1: Section                          │   │
│ │   Number: [Section 1] Title: [(Untitled)] │   │
│ └───────────────────────────────────────────┘   │
│                                                   │
│ [Cancel] [Indent (create 1 section)]             │
└───────────────────────────────────────────────────┘
```

---

## Edge Cases & Handling

### Edge Case 1: Maximum Depth Reached
**Scenario:** User tries to indent at depth 9 (maximum)
**Solution:** Disable indent button, show tooltip "Maximum depth reached"

### Edge Case 2: Circular References
**Scenario:** User tries to make a section its own ancestor
**Solution:** Validate parent chain before insert, reject with error

### Edge Case 3: Very Large Gaps (depth 0 → depth 9)
**Scenario:** Document has section at depth 0, next section at depth 9
**Solution:** Repair tool shows all 8 missing levels, allows bulk customization

### Edge Case 4: Multiple Gaps in Same Location
**Scenario:** Multiple sections have same gap pattern
**Solution:** Repair tool batch-processes, creates one set of placeholders

### Edge Case 5: User Cancels Mid-Repair
**Scenario:** User starts repair, then cancels modal
**Solution:** No changes applied (transaction rollback), document unchanged

---

## Performance Considerations

### Database Optimization

1. **Batch Inserts:**
   ```sql
   -- Use UNNEST for batch inserts
   INSERT INTO document_sections (document_id, parent_section_id, depth, ...)
   SELECT * FROM UNNEST(
     $1::uuid[], $2::uuid[], $3::int[], ...
   );
   ```

2. **Index Usage:**
   ```sql
   -- Ensure indexes exist for fast lookups
   CREATE INDEX IF NOT EXISTS idx_sections_parent_depth
   ON document_sections(parent_section_id, depth);

   CREATE INDEX IF NOT EXISTS idx_sections_document_order
   ON document_sections(document_id, document_order);
   ```

3. **Transaction Batching:**
   - Repair operations wrapped in single transaction
   - Rollback on any error to maintain consistency

### Frontend Optimization

1. **Lazy Loading:**
   - Load repair preview on-demand (not on page load)
   - Cache hierarchy config in localStorage

2. **Debouncing:**
   - Debounce customization inputs (500ms delay)
   - Prevent excessive re-renders

3. **Virtual Scrolling:**
   - For documents with 100+ gaps, use virtual scroll in modal

---

## Backward Compatibility

### Existing Documents
- ✅ No schema changes to existing data
- ✅ Gaps remain valid until user runs repair tool
- ✅ All existing operations (indent/dedent/move) continue to work

### API Compatibility
- ✅ New endpoints are additive (no breaking changes)
- ✅ Existing indent/dedent endpoints unchanged (optional parameters)
- ✅ Client libraries don't need updates

### Database Migrations
- ✅ Migration 027 is additive (new metadata columns only)
- ✅ No data migrations required
- ✅ Rollback safe (drop columns)

---

## Security Considerations

### Authorization
- ✅ Only admins can run repair tool (`requireAdmin` middleware)
- ✅ Section editability checks apply (`validateSectionEditable`)
- ✅ RLS policies enforce organization isolation

### Input Validation
```javascript
// Validate user-provided placeholder data
function validatePlaceholderInput(placeholder) {
  const { depth, section_number, section_title } = placeholder;

  // Depth must be 0-9
  if (depth < 0 || depth > 9) {
    throw new Error('Invalid depth');
  }

  // Section number: max 50 chars, no special chars
  if (section_number.length > 50 || /[<>{}]/.test(section_number)) {
    throw new Error('Invalid section number');
  }

  // Section title: max 200 chars
  if (section_title.length > 200) {
    throw new Error('Section title too long');
  }

  return true;
}
```

### SQL Injection Prevention
- ✅ All queries use parameterized statements
- ✅ Supabase client handles escaping
- ✅ No raw SQL string concatenation

---

## Monitoring & Analytics

### Metrics to Track

1. **Repair Tool Usage:**
   - Number of repairs executed per day
   - Average gaps per document
   - Average placeholders created per repair

2. **Smart Indent Usage:**
   - Frequency of multi-level indents
   - Average depth jumps requested
   - Percentage of users who customize placeholders

3. **Gap Detection:**
   - Total documents with gaps
   - Distribution of gap sizes (1 level, 2 levels, etc.)
   - Most common gap patterns

### Logging

```javascript
// Example logging for repair operations
console.log('[HIERARCHY-REPAIR]', {
  timestamp: new Date().toISOString(),
  user_id: req.session.userId,
  document_id: docId,
  gaps_found: gaps.length,
  sections_created: insertedSections.length,
  operation: 'batch_repair',
  duration_ms: Date.now() - startTime
});
```

---

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/hierarchyAnalyzer.test.js
describe('HierarchyAnalyzer', () => {
  it('should detect gaps correctly', () => {
    const sections = [
      { id: '1', depth: 0, section_number: 'Article I' },
      { id: '2', depth: 3, section_number: '(a)' } // Gap: missing depths 1, 2
    ];

    const gaps = analyzeHierarchyGaps(sections);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].missing_depths).toEqual([1, 2]);
  });

  it('should handle no gaps', () => {
    const sections = [
      { id: '1', depth: 0 },
      { id: '2', depth: 1 },
      { id: '3', depth: 2 }
    ];

    const gaps = analyzeHierarchyGaps(sections);
    expect(gaps).toHaveLength(0);
  });
});
```

### Integration Tests

```javascript
// tests/integration/hierarchyRepair.test.js
describe('Hierarchy Repair API', () => {
  it('should create placeholder sections', async () => {
    // Setup: Create document with gap
    const doc = await createTestDocument();
    await createSection(doc.id, { depth: 0, section_number: 'Article I' });
    await createSection(doc.id, { depth: 3, section_number: '(a)' });

    // Execute repair
    const response = await request(app)
      .post(`/admin/documents/${doc.id}/hierarchy/repair`)
      .send({ repairs: [...] });

    expect(response.status).toBe(200);
    expect(response.body.sections_created).toBe(2); // Depths 1, 2

    // Verify sections exist
    const sections = await getSections(doc.id);
    expect(sections).toHaveLength(4); // Original 2 + 2 placeholders
  });
});
```

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Database migration tested on staging
- [ ] Frontend tested on Chrome, Firefox, Safari, Edge
- [ ] Performance tested with 1000+ section document
- [ ] Documentation reviewed and approved
- [ ] Security review completed

### Deployment Steps

1. **Database Migration:**
   ```bash
   # Apply migration 027
   npm run migrate:up 027
   ```

2. **Backend Deployment:**
   ```bash
   # Deploy new routes and services
   git pull origin main
   npm install
   pm2 restart bylaws-tool
   ```

3. **Frontend Deployment:**
   ```bash
   # Deploy static assets
   npm run build
   # Cache bust: Update version in HTML
   ```

4. **Verification:**
   - Test repair tool on staging document
   - Test smart indent on staging document
   - Monitor error logs for 24 hours

### Rollback Plan

If issues occur:
```bash
# Revert code
git revert HEAD

# Rollback migration
npm run migrate:down 027

# Restart services
pm2 restart bylaws-tool
```

---

## Future Enhancements

### Phase 4: Advanced Features (Optional)

1. **Bulk Repair Across Documents:**
   - Repair all documents in organization at once
   - Admin dashboard showing gap statistics

2. **Intelligent Numbering:**
   - Auto-detect numbering patterns from siblings
   - Suggest appropriate numbers for placeholders

3. **Template Library:**
   - Pre-defined placeholder sets for common structures
   - Save custom placeholder templates

4. **Undo/Redo for Repairs:**
   - Version control for repair operations
   - Rollback individual repairs

5. **Real-Time Collaboration:**
   - Lock sections during repair to prevent conflicts
   - Show other users' active repairs

---

## Conclusion

This architecture design proposes a **hybrid solution (Option 2 + Option 3)** that balances:
- **User control** - Full transparency and customization
- **Flexibility** - Works for existing gaps and prevents new ones
- **Maintainability** - Clear separation of concerns
- **User experience** - Intuitive UI with educational value

The implementation roadmap spreads the work across 4 weeks, with clear milestones and deliverables. The solution is backward compatible, secure, and performant.

**Recommended next steps:**
1. Review this design with development team
2. Prioritize Phase 1 (Repair Tool) for immediate value
3. Plan user acceptance testing with real documents
4. Iterate based on feedback

---

## Appendix: File Reference Map

### Modified Files
- `/src/routes/admin.js` - Enhanced endpoints (3 new, 1 modified)
- `/src/parsers/hierarchyDetector.js` - Validation updates
- `/views/dashboard/document-viewer.ejs` - UI components

### New Files
- `/src/services/hierarchyAnalyzer.js` - Gap detection logic
- `/src/services/hierarchyOperations.js` - Placeholder creation
- `/public/js/hierarchy-repair.js` - Repair tool frontend
- `/public/js/smart-indent.js` - Smart indent frontend
- `/public/css/hierarchy-repair.css` - Styling
- `/database/migrations/027_hierarchy_repair_metadata.sql` - Schema changes
- `/tests/unit/hierarchyAnalyzer.test.js` - Unit tests
- `/tests/integration/hierarchy-repair.test.js` - Integration tests
- `/docs/user-guide/hierarchy-repair.md` - User documentation
- `/docs/developer-guide/hierarchy-operations.md` - Developer guide

---

**Document prepared by:** System Architecture Designer
**Review status:** PENDING APPROVAL
**Implementation priority:** HIGH
