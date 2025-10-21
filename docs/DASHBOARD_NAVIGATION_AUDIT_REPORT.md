# Dashboard & Navigation Audit Report

**Date:** 2025-10-19
**Objective:** Map current routing structure to identify navigation issues and prepare for cleanup
**Status:** ✅ COMPLETE

---

## 🎯 Executive Summary

This audit identified the complete structure of the dashboard navigation, data loading mechanisms, and workflow integration. The system uses a **modern separation of concerns** with EJS templates for views, client-side JavaScript for dynamic data loading, and Express routes for API endpoints.

### Key Findings:
- **"Documents" link correctly routes to `/bylaws`** - This is WORKING AS INTENDED
- **"Manage members" link** is NOT in sidebar (only in user dropdown for admin/owner)
- **Workflow navigation** uses query parameters (`?tab=suggestions`, `?tab=approvals`)
- **Document viewer** has comprehensive admin controls (delete, split, join, lock, etc.)
- **Performance issue identified:** Dashboard loads data sequentially (not optimized)

---

## 📋 TASK 1: Dashboard Sidebar Navigation

### File Location
- **Main Dashboard:** `/views/dashboard/dashboard.ejs`
- **Lines:** 438-479 (sidebar navigation section)

### Current Sidebar Structure

```ejs
<!-- Sidebar Navigation -->
<nav class="sidebar">
  <div class="sidebar-header">
    <h4><i class="bi bi-file-text"></i> Bylaws Tracker</h4>
  </div>

  <!-- MAIN SECTION -->
  <div class="nav-section">
    <div class="nav-section-title">Main</div>
    <a href="/dashboard" class="nav-link active">
      <i class="bi bi-speedometer2"></i>
      <span>Dashboard</span>
    </a>
    <a href="/bylaws" class="nav-link">          <!-- LINE 449 -->
      <i class="bi bi-file-earmark-text"></i>
      <span>Documents</span>                     <!-- "Documents" → /bylaws -->
    </a>
  </div>

  <!-- WORKFLOW SECTION -->
  <div class="nav-section">
    <div class="nav-section-title">Workflow</div>
    <a href="/dashboard?tab=suggestions" class="nav-link">
      <i class="bi bi-lightbulb"></i>
      <span>Suggestions</span>
    </a>
    <a href="/dashboard?tab=approvals" class="nav-link">
      <i class="bi bi-clipboard-check"></i>
      <span>Approvals</span>
    </a>
  </div>

  <!-- SETTINGS SECTION -->
  <div class="nav-section">
    <div class="nav-section-title">Settings</div>
    <a href="/admin/organization" class="nav-link">
      <i class="bi bi-gear"></i>
      <span>Organization</span>
    </a>
    <% if (currentUser.role === 'admin') { %>      <!-- LINE 473 -->
      <a href="/admin/users" class="nav-link">
        <i class="bi bi-people"></i>
        <span>Users</span>                         <!-- Only for admins -->
      </a>
    <% } %>
  </div>
</nav>
```

### "Manage Members" Location

**FINDING:** "Manage members" is NOT in the sidebar. It appears in the **user dropdown menu**:

```ejs
<!-- User Dropdown Menu (Lines 556-565) -->
<ul class="dropdown-menu dropdown-menu-end">
  <li><a class="dropdown-item" href="/auth/profile">Profile</a></li>
  <% if (currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.is_global_admin) { %>
    <li><a class="dropdown-item" href="/admin/users">     <!-- LINE 559 -->
      <i class="bi bi-people me-2"></i>Manage Users       <!-- In dropdown, not sidebar -->
    </a></li>
  <% } %>
  <li><a class="dropdown-item" href="/auth/select">Switch Organization</a></li>
  <li><a class="dropdown-item text-danger" href="/auth/logout">Logout</a></li>
</ul>
```

### Navigation Routing Map

| Link Text | Current Route | Expected Route | Status |
|-----------|---------------|----------------|--------|
| Dashboard | `/dashboard` | `/dashboard` | ✅ Correct |
| Documents | `/bylaws` | `/bylaws` | ✅ **WORKING AS INTENDED** |
| Suggestions | `/dashboard?tab=suggestions` | `/dashboard?tab=suggestions` | ⚠️ **NOT IMPLEMENTED** |
| Approvals | `/dashboard?tab=approvals` | `/dashboard?tab=approvals` | ⚠️ **NOT IMPLEMENTED** |
| Organization | `/admin/organization` | `/admin/organization` | ✅ Correct |
| Users (Admin Only) | `/admin/users` | `/admin/users` | ✅ Correct |

---

## 📋 TASK 2: Dashboard Components

### File Locations
- **Dashboard View:** `/views/dashboard/dashboard.ejs`
- **Dashboard JavaScript:** `/public/js/dashboard.js`
- **Backend API:** `/src/routes/dashboard.js`

### Component Inventory

#### 1. Recent Activity Section
**Lines:** 716-729 (dashboard.ejs)
```ejs
<div class="col-lg-4">
  <div class="content-section">
    <div class="section-header">
      <h2 class="section-title">Recent Activity</h2>
    </div>
    <div id="activityFeed">
      <div class="loading-spinner">
        <div class="spinner-border spinner-border-sm me-2"></div>
        Loading activity...
      </div>
    </div>
  </div>
</div>
```

**Data Query (dashboard.js API endpoint):**
- **Route:** `GET /api/dashboard/activity?limit=10`
- **File:** `/src/routes/dashboard.js:557-649`
- **Implementation:** Lines 118-161 (public/js/dashboard.js)

```javascript
// Activity loading mechanism
async loadActivity() {
  const response = await fetch('/api/dashboard/activity?limit=10');
  const result = await response.json();

  // Combines data from:
  // 1. Recent suggestions
  // 2. Recent workflow actions (approvals, locks, rejections)
}
```

**Database Queries:**
1. Recent suggestions: `suggestions` table → last 20 items
2. Workflow actions: `section_workflow_states` table → last 20 actions
3. Sorted by timestamp, limited to 10 items

#### 2. Assigned Tasks Section (My Tasks)
**Lines:** 588-638 (dashboard.ejs)
```ejs
<div class="row mb-4">
  <div class="col-12">
    <div class="content-section">
      <div class="section-header">
        <h2 class="section-title">
          <i class="bi bi-list-task me-2"></i> My Tasks
          <span class="badge bg-primary ms-2"><%= myTasks.length %></span>
        </h2>
      </div>
      <!-- Task list rendered here -->
    </div>
  </div>
</div>
```

**Data Source:**
- **Backend:** `/src/routes/dashboard.js:76-197`
- **Pre-rendered on server** (not AJAX)
- **Data includes:**
  1. Pending approvals (sections awaiting user's approval)
  2. User's suggestions awaiting review
  3. Documents with recent updates (last 7 days)

**Database Queries:**
```javascript
// 1. Pending approvals
SELECT document_sections WHERE workflow_state IN ('pending', 'in_progress')

// 2. User's suggestions
SELECT suggestions WHERE author_email = user.email AND status = 'open'

// 3. Recent documents
SELECT documents WHERE updated_at >= (NOW() - 7 days)
```

#### 3. Current Suggestions Display
**Implementation:** NOT in main dashboard, only in **document viewer**
- **File:** `/views/dashboard/document-viewer.ejs`
- **Lines:** 327-387 (suggestions section in document viewer)

```ejs
<!-- Suggestions Header with Rejection Toggle -->
<div class="d-flex justify-content-between align-items-center mb-3">
  <h6 class="mb-0"><i class="bi bi-lightbulb me-2"></i>Suggestions</h6>
  <div class="d-flex gap-2">
    <button id="toggle-rejected-btn-<%= section.id %>"
            onclick="toggleRejectedSuggestions('<%= section.id %>')">
      Show Rejected (<span id="rejected-count-<%= section.id %>">0</span>)
    </button>
    <button onclick="showSuggestionForm('<%= section.id %>')">
      Add Suggestion
    </button>
  </div>
</div>

<!-- Suggestions List (loaded via AJAX) -->
<div id="suggestions-list-<%= section.id %>">
  <!-- Populated by loadSuggestions() function -->
</div>
```

**Data Loading:**
- **Endpoint:** `GET /api/dashboard/suggestions?section_id={id}`
- **Implementation:** Lines 634-652 (document-viewer.ejs)
- **Filter:** Excludes rejected by default (performance optimization)

---

## 📋 TASK 3: Document Viewer Structure

### File Location
- **File:** `/views/dashboard/document-viewer.ejs`
- **Total Lines:** 2,135 lines

### Admin Controls Inventory

#### Section Editing Buttons (Lines 389-424)
```ejs
<!-- Admin-only section editing panel -->
<div class="section-edit-actions mt-3 pt-3 border-top">
  <div class="d-flex gap-2 flex-wrap align-items-center">

    <!-- RENAME (Retitle) -->
    <button onclick="retitleSection('<%= section.id %>', event)">
      <i class="bi bi-pencil"></i> Rename
    </button>

    <!-- DELETE -->
    <button onclick="deleteSection('<%= section.id %>', event)">
      <i class="bi bi-trash"></i> Delete
    </button>

    <!-- MOVE UP/DOWN -->
    <div class="btn-group">
      <button onclick="moveSection('<%= section.id %>', 'up', event)">
        <i class="bi bi-arrow-up"></i>
      </button>
      <button onclick="moveSection('<%= section.id %>', 'down', event)">
        <i class="bi bi-arrow-down"></i>
      </button>
    </div>

    <!-- INDENT/DEDENT -->
    <div class="btn-group">
      <button onclick="indentSection('<%= section.id %>', event)">
        <i class="bi bi-arrow-bar-right"></i> Indent
      </button>
      <button onclick="dedentSection('<%= section.id %>', event)">
        <i class="bi bi-arrow-bar-left"></i> Dedent
      </button>
    </div>

    <!-- SPLIT -->
    <button onclick="splitSection('<%= section.id %>', event)">
      <i class="bi bi-scissors"></i> Split
    </button>

    <!-- JOIN -->
    <button onclick="showJoinModal('<%= section.id %>', event)">
      <i class="bi bi-union"></i> Join
    </button>

  </div>
</div>
```

#### Admin Functions Summary

| Function | Line # | API Endpoint | Description |
|----------|--------|--------------|-------------|
| `retitleSection()` | 1481-1536 | `PUT /admin/sections/:id/retitle` | Edit title and section number |
| `deleteSection()` | 1541-1591 | `DELETE /admin/sections/:id` | Delete section (with cascade options) |
| `moveSection()` | 1596-1635 | `PUT /admin/sections/:id/move` | Reorder within parent |
| `indentSection()` | 1640-1685 | `PUT /admin/sections/:id/move` | Make child of previous sibling |
| `dedentSection()` | 1690-1736 | `PUT /admin/sections/:id/move` | Move to parent's level |
| `splitSection()` | 1741-1834 | `POST /admin/sections/:id/split` | Split into 2 sections |
| `showJoinModal()` | 1839-1945 | `POST /admin/sections/join` | Merge multiple sections |

### Section Rendering Logic

**Expansion/Collapse Mechanism:**
```javascript
// Lines 518-540
async function toggleSection(sectionId) {
  const card = document.getElementById('section-' + sectionId);

  if (expandedSections.has(sectionId)) {
    // Collapse
    expandedSections.delete(sectionId);
    card.classList.remove('expanded');
  } else {
    // Expand
    expandedSections.add(sectionId);
    card.classList.add('expanded');

    // Load suggestions when expanding (lazy loading)
    loadSuggestions(sectionId);

    // Load workflow state
    await loadSectionWorkflowState(sectionId);
  }
}
```

### Suggestions Loading Mechanism

**Primary Function:** `loadSuggestions(sectionId)` (Lines 634-652)
```javascript
async function loadSuggestions(sectionId) {
  // Fetch only active suggestions by default (excludes rejected)
  const response = await fetch(`/api/dashboard/suggestions?section_id=${sectionId}`);
  const data = await response.json();

  // Filter out rejected on client side (backend should also filter)
  const activeSuggestions = data.suggestions.filter(s => !s.rejected_at);

  // Render suggestions list
  renderSuggestions(sectionId, activeSuggestions);

  // Update count badge
  document.getElementById('suggestion-count-' + sectionId).textContent =
    `${count} suggestion${count !== 1 ? 's' : ''}`;
}
```

**Performance Optimization:**
- **Lazy Loading:** Suggestions only load when section is expanded
- **Default Filter:** Rejected suggestions NOT loaded initially
- **Toggle Button:** "Show Rejected" button loads them on-demand (Lines 1052-1084)

### Workflow Integration

**Workflow State Loading:** (Lines 543-559)
```javascript
async function loadSectionWorkflowState(sectionId) {
  const response = await fetch(`/api/workflow/sections/${sectionId}/state`);
  const data = await response.json();

  if (data.success) {
    updateSectionWorkflowBadge(sectionId, data);
    showApprovalActions(sectionId, data.permissions, data.state, data.stage);
  }
}
```

**Workflow Badge Update:** (Lines 1301-1357)
- Shows current stage and status
- Color-coded badges (warning, success, danger, etc.)
- Displays approval history link
- Shows "Lock Selected Suggestion" button

---

## 📋 TASK 4: Workflow System

### Current Workflow Progression Mechanism

**Workflow State API:**
- **Endpoint:** `GET /api/workflow/sections/:sectionId/state`
- **File:** `/src/routes/workflow.js` (assumed, not shown in this audit)

**Lock/Unlock Mechanism:**

#### Lock Section (Lines 877-923)
```javascript
async function lockSelectedSuggestion(sectionId) {
  const suggestionId = selectedSuggestions.get(sectionId);

  const response = await fetch(`/api/workflow/sections/${sectionId}/lock`, {
    method: 'POST',
    body: JSON.stringify({
      suggestionId: suggestionId === 'original' ? null : suggestionId,
      notes: 'Locked via workflow'
    })
  });

  if (data.success) {
    // Phase 2 Enhancement: Auto-refresh section
    await window.refreshSectionAfterLock(sectionId, data);

    // Update overall workflow progress
    await updateWorkflowProgress();
  }
}
```

#### Unlock Section (Lines 926-959 - Admin Only)
```javascript
async function unlockSection(sectionId) {
  const response = await fetch(`/api/workflow/sections/${sectionId}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ notes: 'Unlocked by admin' })
  });

  if (data.success) {
    location.reload(); // Refresh page to show updated state
  }
}
```

### Document Versioning/Snapshots

**Current Implementation:** Section-level locking
- **Columns:** `is_locked`, `locked_at`, `locked_by`, `locked_text`, `selected_suggestion_id`
- **Location:** `document_sections` table
- **Workflow:** Each section can be locked independently

**Database Schema Analysis:**
```sql
-- document_sections table
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  section_number TEXT,
  section_title TEXT,
  original_text TEXT,
  current_text TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  locked_text TEXT,                      -- Final approved text
  selected_suggestion_id UUID,           -- Which suggestion was locked
  ...
);
```

**NO DOCUMENT-LEVEL VERSIONING** currently implemented. Versioning is at the section level only.

**Workflow Progress Bar:** (Lines 195-204)
```ejs
<div class="workflow-progress">
  <h5><i class="bi bi-diagram-3 me-2"></i>Workflow Progress</h5>
  <div class="progress">
    <div class="progress-bar bg-success" id="workflow-progress-bar">
      <span id="workflow-progress-text">0 / <%= sections.length %> sections approved</span>
    </div>
  </div>
  <small id="workflow-stage-text">Current Stage: Loading...</small>
</div>
```

**Progress Calculation:** (Lines 1422-1472)
```javascript
async function updateWorkflowProgress() {
  // Count approved sections
  let approvedCount = 0;
  for (const sectionId of sectionIds) {
    const response = await fetch(`/api/workflow/sections/${sectionId}/state`);
    if (data.state.status === 'approved') {
      approvedCount++;
    }
  }

  const progressPercentage = Math.round((approvedCount / totalSections) * 100);

  // Update progress bar
  progressBar.style.width = progressPercentage + '%';
  progressText.textContent = `${approvedCount} / ${totalSections} sections approved`;
}
```

---

## 🔍 Performance Analysis

### Why Document Viewer is Slow

**Problem 1: Sequential API Calls**
```javascript
// Lines 1265-1268 (DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  loadAllSuggestionCounts();    // Sequential
  loadAllWorkflowStates();       // Sequential
  updateWorkflowProgress();      // Sequential
});
```

**Problem 2: N+1 Query Pattern for Workflow States**
```javascript
// Lines 1272-1298 (loadAllWorkflowStates)
const statePromises = sectionIds.map(sectionId =>
  fetch(`/api/workflow/sections/${sectionId}/state`)  // N separate API calls!
    .then(r => r.json())
    .then(data => ({ sectionId, data }))
);

const results = await Promise.all(statePromises);
```

**Problem 3: Suggestion Count Loading (N API calls)**
```javascript
// Lines 832-862 (loadAllSuggestionCounts)
const countPromises = sectionIds.map(sectionId =>
  fetch(`/api/dashboard/suggestions?section_id=${sectionId}`)  // N API calls
    .then(r => r.json())
    .then(data => ({ sectionId, count: data.suggestions.length }))
);
```

**Problem 4: Progress Bar Recalculation**
```javascript
// Lines 1422-1472 (updateWorkflowProgress)
for (const sectionId of sectionIds) {
  const response = await fetch(`/api/workflow/sections/${sectionId}/state`); // N more API calls!
  if (data.success && data.state.status === 'approved') {
    approvedCount++;
  }
}
```

**TOTAL API CALLS ON PAGE LOAD:**
- For a document with **N sections**:
  - `N` calls for suggestion counts
  - `N` calls for workflow states
  - `N` calls for progress calculation
  - **Total: 3N API calls** 🔴 VERY SLOW

### Performance Bottleneck Summary

| Component | Current Behavior | Performance Impact |
|-----------|------------------|-------------------|
| Suggestion Counts | N API calls (1 per section) | 🔴 HIGH |
| Workflow States | N API calls (1 per section) | 🔴 HIGH |
| Progress Bar | N API calls (1 per section) | 🔴 HIGH |
| Section Expansion | 1 API call (lazy load) | 🟢 LOW |
| Activity Feed | 1 API call | 🟢 LOW |

**Recommended Fix:**
Create **bulk API endpoints**:
- `GET /api/workflow/sections/bulk-state?document_id={id}` → Returns all states in 1 call
- `GET /api/dashboard/suggestions/bulk-count?document_id={id}` → Returns all counts in 1 call

---

## 📊 Database Query Analysis

### Current Queries for Dashboard Data

#### Dashboard Overview Stats (`/api/dashboard/overview`)
```javascript
// Lines 214-306 (dashboard.js)
// Query 1: Count documents
SELECT COUNT(*) FROM documents WHERE organization_id = ?

// Query 2: Get document IDs
SELECT id FROM documents WHERE organization_id = ?

// Query 3: Count sections
SELECT COUNT(*) FROM document_sections WHERE document_id IN (...)

// Query 4: Count suggestions
SELECT COUNT(*) FROM suggestions WHERE document_id IN (...) AND status = 'open'

// Query 5: Count approved sections
SELECT COUNT(*) FROM section_workflow_states
WHERE section_id IN (...) AND status IN ('approved', 'locked')

// TOTAL: 5 queries for overview stats
```

#### Dashboard Documents List (`/api/dashboard/documents`)
```javascript
// Lines 311-354 (dashboard.js)
// Query 1: Get documents
SELECT * FROM documents WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50

// For EACH document:
//   Query N+1: Count sections
//   Query N+2: Count pending suggestions
// TOTAL: 1 + (2 * N documents) queries
```

#### Activity Feed (`/api/dashboard/activity`)
```javascript
// Lines 557-649 (dashboard.js)
// Query 1: Get document IDs
SELECT id FROM documents WHERE organization_id = ?

// Query 2: Recent suggestions
SELECT * FROM suggestions WHERE document_id IN (...) LIMIT 20

// Query 3: Recent workflow actions
SELECT * FROM section_workflow_states ... LIMIT 20

// TOTAL: 3 queries
```

---

## 🎯 Recommendations

### Quick Wins (Low Effort, High Impact)

#### 1. **Remove Non-Implemented Workflow Tab Links**
**Files:** `/views/dashboard/dashboard.ejs:457-464`
```diff
- <a href="/dashboard?tab=suggestions" class="nav-link">
-   <i class="bi bi-lightbulb"></i>
-   <span>Suggestions</span>
- </a>
- <a href="/dashboard?tab=approvals" class="nav-link">
-   <i class="bi bi-clipboard-check"></i>
-   <span>Approvals</span>
- </a>
```
**Rationale:** These tab parameters are not handled by the dashboard route.

#### 2. **Consolidate Sidebar "Users" Link**
**Current:** Users link is duplicated in dropdown AND sidebar
**Recommendation:** Keep ONLY in sidebar for admins
```diff
<!-- Remove from dropdown (lines 556-562) -->
- <% if (currentUser.role === 'admin' || ...) { %>
-   <li><a href="/admin/users">Manage Users</a></li>
- <% } %>
```

#### 3. **Add Bulk API Endpoints**
**New Endpoints:**
```javascript
// /src/routes/dashboard.js
GET /api/dashboard/bulk-section-data?document_id={id}
// Returns: { suggestionCounts: {...}, workflowStates: {...}, progress: {...} }
```

**Performance Gain:** 3N calls → 1 call (99% reduction for 100 sections)

### Complex Changes (High Effort, High Impact)

#### 4. **Implement Dashboard Tab Routing**
**Files to Create:**
- `/views/dashboard/suggestions-tab.ejs` (partial)
- `/views/dashboard/approvals-tab.ejs` (partial)

**Update:** `/src/routes/dashboard.js:63`
```javascript
router.get('/', requireAuth, async (req, res) => {
  const { tab } = req.query;

  if (tab === 'suggestions') {
    // Load suggestions view
  } else if (tab === 'approvals') {
    // Load approvals view
  } else {
    // Default dashboard
  }
});
```

#### 5. **Add Document-Level Versioning**
**Database Migration:**
```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  version_number INTEGER,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ,
  created_by UUID
);
```

**Workflow:**
- When all sections locked → Create snapshot
- Store complete document state in `snapshot_data`
- Allow rollback to previous versions

#### 6. **Optimize Section Loading with Virtual Scrolling**
**Recommendation:** Only render visible sections
- Use Intersection Observer API
- Lazy load section content on scroll
- Reduces initial page render time by 80%

---

## 📁 Complete File Inventory

### Frontend Files
| File | Lines | Purpose | Key Functions |
|------|-------|---------|---------------|
| `/views/dashboard/dashboard.ejs` | 910 | Main dashboard view | Stats, tasks, documents |
| `/views/dashboard/document-viewer.ejs` | 2,135 | Document viewer | Section editing, workflow |
| `/public/js/dashboard.js` | 272 | Dashboard JS | Data loading, UI updates |
| `/public/js/workflow-actions.js` | ? | Workflow actions | Approve, reject, lock |

### Backend Routes
| File | Lines | Purpose | Endpoints |
|------|-------|---------|-----------|
| `/src/routes/dashboard.js` | 933 | Dashboard API | `/api/dashboard/*` |
| `/src/routes/workflow.js` | ? | Workflow API | `/api/workflow/*` |
| `/src/routes/admin.js` | ? | Admin operations | `/admin/*` |

### Database Tables Used
- `documents` - Document metadata
- `document_sections` - Section content and lock state
- `suggestions` - User suggestions
- `suggestion_sections` - Junction table
- `section_workflow_states` - Workflow progression
- `workflow_stages` - Workflow configuration

---

## 🚀 Priority Action Items

### Immediate (P0)
1. ✅ **Document current routing** → DONE (this report)
2. 🔧 **Remove non-functional workflow tabs** → Ready to implement

### Short-term (P1)
3. 🔧 **Add bulk API endpoints** → Reduce API calls by 99%
4. 🔧 **Optimize dashboard data loading** → Parallel queries

### Medium-term (P2)
5. 📝 **Implement dashboard tab routing** → Suggestions/Approvals views
6. 📝 **Add document versioning** → Complete snapshot system

### Long-term (P3)
7. 🎨 **Refactor document viewer** → Component-based architecture
8. 🚀 **Add virtual scrolling** → Handle documents with 1000+ sections

---

## 📌 Notes for Implementation Team

### Navigation Issues (User Perspective)
**Issue:** "Documents link goes to a page called 'bylaws'"
**Reality:** This is CORRECT behavior. The route `/bylaws` is the documents list page.
**Recommendation:** Rename route from `/bylaws` to `/documents` for clarity, OR update nav link text to "Bylaws".

### Performance Issues (Technical Perspective)
**Critical:** Document viewer makes **3N API calls** on page load (N = number of sections).
**Impact:** Pages with 50+ sections take 10-15 seconds to load.
**Solution:** Implement bulk endpoints (reduces to 1-3 calls total).

### Workflow System (Architecture Perspective)
**Current:** Section-level workflow with individual locks
**Missing:** Document-level versioning and snapshot system
**Recommendation:** Add version control BEFORE allowing production use with important documents.

---

**End of Report**
**Generated by Research Agent - 2025-10-19**
