# Dashboard Audit - Quick Reference

**Date:** 2025-10-19 | **For:** Implementation Team

---

## 🎯 Key Findings Summary

### Navigation Structure ✅
- **"Documents" link → `/bylaws`** - WORKING AS INTENDED
- **"Manage members"** - NOT in sidebar (only in user dropdown for admin/owner)
- **Workflow tabs** - Links present but NOT IMPLEMENTED

### Performance Issues 🔴
- **3N API calls** on document viewer load (N = sections)
- **Sequential data loading** causes 10-15 second delays for 50+ section documents
- **N+1 query pattern** in multiple places

### Missing Features ⚠️
- Dashboard tab routing (`?tab=suggestions`, `?tab=approvals`) not implemented
- Document-level versioning/snapshots not available
- Bulk API endpoints missing

---

## 📋 File Locations Cheat Sheet

### Frontend Views
```
/views/dashboard/dashboard.ejs           (910 lines)  - Main dashboard
/views/dashboard/document-viewer.ejs     (2,135 lines) - Document viewer
```

### JavaScript
```
/public/js/dashboard.js                  (272 lines)  - Data loading
/public/js/workflow-actions.js           (?)          - Workflow functions
```

### Backend Routes
```
/src/routes/dashboard.js                 (933 lines)  - Dashboard API
/src/routes/workflow.js                  (?)          - Workflow API
/src/routes/admin.js                     (?)          - Admin operations
```

---

## 🔍 Line Numbers for Quick Navigation

### Dashboard Sidebar (`dashboard.ejs`)
```
Lines 438-479  → Sidebar navigation structure
Line 449       → "Documents" link (/bylaws)
Lines 457-464  → Workflow tabs (NOT IMPLEMENTED)
Lines 473-478  → Admin "Users" link
Lines 556-565  → User dropdown menu
```

### Document Viewer Admin Controls (`document-viewer.ejs`)
```
Lines 389-424  → Section editing buttons (delete, split, join, etc.)
Lines 1481-1945 → Admin function implementations
  1481: retitleSection()
  1541: deleteSection()
  1596: moveSection()
  1640: indentSection()
  1690: dedentSection()
  1741: splitSection()
  1839: showJoinModal()
```

### Performance Bottlenecks (`document-viewer.ejs`)
```
Lines 1265-1268 → Sequential API calls on DOMContentLoaded
Lines 832-862   → N API calls for suggestion counts
Lines 1272-1298 → N API calls for workflow states
Lines 1422-1472 → N API calls for progress calculation
```

---

## 🚀 Quick Fixes (Copy-Paste Ready)

### 1. Remove Non-Implemented Workflow Tabs
**File:** `/views/dashboard/dashboard.ejs`
**Lines:** 456-465
```diff
-    <div class="nav-section">
-      <div class="nav-section-title">Workflow</div>
-      <a href="/dashboard?tab=suggestions" class="nav-link">
-        <i class="bi bi-lightbulb"></i>
-        <span>Suggestions</span>
-      </a>
-      <a href="/dashboard?tab=approvals" class="nav-link">
-        <i class="bi bi-clipboard-check"></i>
-        <span>Approvals</span>
-      </a>
-    </div>
```

### 2. Add Bulk API Endpoint (Backend)
**File:** `/src/routes/dashboard.js`
**Add after line 797:**
```javascript
/**
 * GET /bulk-section-data - Get all section data in one call
 */
router.get('/bulk-section-data', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const { document_id } = req.query;

    // Get all sections for document
    const { data: sections } = await supabase
      .from('document_sections')
      .select('id')
      .eq('document_id', document_id);

    const sectionIds = sections.map(s => s.id);

    // Get suggestion counts in bulk
    const { data: suggestionCounts } = await supabase
      .from('suggestions')
      .select('section_id, count')
      .in('section_id', sectionIds);

    // Get workflow states in bulk
    const { data: workflowStates } = await supabase
      .from('section_workflow_states')
      .select('section_id, status, workflow_stage_id')
      .in('section_id', sectionIds);

    res.json({
      success: true,
      suggestionCounts: suggestionCounts,
      workflowStates: workflowStates
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 3. Update Frontend to Use Bulk Endpoint
**File:** `/views/dashboard/document-viewer.ejs`
**Replace lines 1265-1268:**
```diff
document.addEventListener('DOMContentLoaded', () => {
-  loadAllSuggestionCounts();
-  loadAllWorkflowStates();
-  updateWorkflowProgress();
+  loadBulkSectionData(); // One API call instead of 3N
});

+// New bulk loading function
+async function loadBulkSectionData() {
+  const response = await fetch(`/api/dashboard/bulk-section-data?document_id=${documentId}`);
+  const data = await response.json();
+
+  if (data.success) {
+    updateSuggestionCountsFromBulk(data.suggestionCounts);
+    updateWorkflowStatesFromBulk(data.workflowStates);
+    updateWorkflowProgressFromBulk(data.workflowStates);
+  }
+}
```

---

## 📊 API Endpoint Reference

### Dashboard API (`/api/dashboard/*`)
```
GET  /overview                          - Stats (docs, sections, suggestions, progress)
GET  /documents                         - List documents for org
GET  /sections?documentId={id}          - List sections with workflow status
GET  /suggestions?section_id={id}       - Get suggestions for section
GET  /suggestions                       - Get all pending suggestions for org
POST /suggestions                       - Create new suggestion
GET  /activity?limit=10                 - Recent activity feed
GET  /sections/:sectionId               - Get section details (for diff)
GET  /document/:documentId              - Document viewer page
```

### Workflow API (`/api/workflow/*`)
```
GET  /sections/:sectionId/state         - Get workflow state and permissions
POST /sections/:sectionId/lock          - Lock section with selected suggestion
POST /sections/:sectionId/unlock        - Unlock section (admin only)
POST /suggestions/:suggestionId/reject  - Reject suggestion
POST /suggestions/:suggestionId/unreject - Unreject suggestion
```

### Admin API (`/admin/*`)
```
PUT    /sections/:id/retitle            - Edit title/number
DELETE /sections/:id                    - Delete section
PUT    /sections/:id/move               - Move/reorder section
POST   /sections/:id/split              - Split section into 2
POST   /sections/join                   - Join multiple sections
```

---

## 🔧 Database Schema Reference

### Key Tables
```sql
documents
  - id, organization_id, title, document_type, created_at, updated_at

document_sections
  - id, document_id, section_number, section_title
  - original_text, current_text
  - is_locked, locked_at, locked_by, locked_text, selected_suggestion_id
  - path_ordinals (for sorting)

suggestions
  - id, document_id, suggested_text, rationale
  - author_name, author_email, status
  - rejected_at, rejected_by, rejected_at_stage

suggestion_sections (junction table)
  - suggestion_id, section_id, ordinal

section_workflow_states
  - section_id, workflow_stage_id, status
  - actioned_by, actioned_at, approval_metadata
```

---

## 🎯 Priority Fixes

### P0 (Immediate)
- ✅ **Remove workflow tab links** (5 minutes)

### P1 (This Week)
- 🔧 **Add bulk API endpoint** (2 hours)
- 🔧 **Update frontend to use bulk endpoint** (2 hours)
- **Expected Impact:** 99% reduction in API calls, 10x faster page load

### P2 (Next Sprint)
- 📝 **Implement dashboard tab routing** (1 day)
- 📝 **Add document versioning** (2 days)

### P3 (Future)
- 🎨 **Refactor document viewer** (1 week)
- 🚀 **Add virtual scrolling** (3 days)

---

## 🐛 Known Issues

### Issue 1: Workflow Tabs Don't Work
**Location:** Dashboard sidebar
**Fix:** Remove the links (they're not implemented)

### Issue 2: Slow Document Viewer Load
**Cause:** 3N API calls for N sections
**Fix:** Use bulk endpoint (P1 priority)

### Issue 3: "Documents" vs "Bylaws" Confusion
**Cause:** Route is `/bylaws` but link says "Documents"
**Fix:** Either rename route or update link text

---

**End of Quick Reference**
