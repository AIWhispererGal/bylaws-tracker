# CODER AGENT: IMPLEMENTATION STRATEGY
**Hive Mind Coordination Session**: swarm-1761175232404-7dxb4qotp
**Date**: 2025-10-22
**Agent**: CODER
**Status**: Architecture Analysis Complete

---

## EXECUTIVE SUMMARY

This document provides a comprehensive implementation strategy for 7 identified issues in the Bylaws Tool codebase. The analysis includes architecture mapping, risk assessment, implementation plans, and estimated effort for each fix.

**Total Estimated Effort**: 18-24 hours
**Risk Level**: LOW to MEDIUM
**Breaking Changes**: Minimal (database migration required for Issue #6 only)

---

## ARCHITECTURE OVERVIEW

### Core Components Analyzed

```
┌─────────────────────────────────────────────────────────────┐
│                      BYLAWS TOOL ARCHITECTURE                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ AUTHENTICATION & AUTHORIZATION LAYER                  │  │
│  │ - src/middleware/permissions.js (centralized)        │  │
│  │ - src/middleware/globalAdmin.js (global admin check) │  │
│  │ - src/routes/admin.js (admin routes)                 │  │
│  │ - src/routes/workflow.js (workflow permissions)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ROUTING LAYER                                         │  │
│  │ - src/routes/admin.js (org management, sections)     │  │
│  │ - src/routes/dashboard.js (document viewer)          │  │
│  │ - src/routes/approval.js (approvals)                 │  │
│  │ - src/routes/workflow.js (workflow API)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ BUSINESS LOGIC LAYER                                  │  │
│  │ - src/services/sectionStorage.js (hierarchy mgmt)    │  │
│  │ - src/services/setupService.js (org setup)           │  │
│  │ - src/parsers/* (document parsing)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PRESENTATION LAYER                                    │  │
│  │ - views/dashboard/document-viewer.ejs                │  │
│  │ - public/js/* (client-side logic)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ DATABASE LAYER                                        │  │
│  │ - Supabase PostgreSQL                                │  │
│  │ - RLS Policies (Row Level Security)                  │  │
│  │ - Triggers (path calculation, ordinal updates)       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ISSUE #1: MISSING PERMISSIONS - ADMIN ROUTES

### Problem Statement
Admin routes in `/admin/organizations/:id/sections` **incorrectly return 200 OK** when user lacks organization membership, instead of **403 Forbidden**. This is a **security and UX issue**.

### Root Cause Analysis

**File**: `/src/routes/admin.js` (Line ~2300-2350)

```javascript
// CURRENT CODE (VULNERABLE):
router.get('/organizations/:id/sections', async (req, res) => {
  const organizationId = req.params.id;
  const userId = req.session.userId;

  // ❌ NO PERMISSION CHECK HERE
  // Proceeds to query database without verifying membership

  const { data: sections, error } = await supabaseService
    .from('document_sections')
    .select('*')
    .eq('organization_id', organizationId);

  // Returns 200 OK even if user has no access
});
```

**Why This Happens**:
1. Route has **no middleware** checking organization membership
2. RLS policies on database **may not prevent read** if configured for service role
3. No explicit check for `user_organizations.user_id = req.session.userId`

### Implementation Plan

#### Step 1: Add Middleware Protection
**File**: `/src/routes/admin.js`
**Lines**: Before route handler (insert after imports)

```javascript
const { requireRole, hasMinRoleLevel } = require('../middleware/permissions');
const { attachGlobalAdminStatus } = require('../middleware/globalAdmin');

// Apply to ALL /admin routes
router.use(attachGlobalAdminStatus);
```

#### Step 2: Add Route-Level Permission Check
**File**: `/src/routes/admin.js`
**Location**: Line ~2300 (route definition)

```javascript
// ✅ FIXED VERSION:
router.get('/organizations/:id/sections',
  requireRole('owner', 'admin', 'member'),  // NEW: Require role
  async (req, res) => {
    const organizationId = req.params.id;
    const userId = req.session.userId;

    // Additional check: verify organization access
    const { data: membership } = await req.supabaseService
      .from('user_organizations')
      .select('role, is_active')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this organization'
      });
    }

    // Continue with existing logic...
});
```

#### Step 3: Apply to All Affected Routes
**Routes to Update**:
- `/admin/organizations/:id/sections` (GET)
- `/admin/organizations/:id/sections/:sectionId` (GET, PUT, DELETE)
- `/admin/organizations/:id/documents` (GET)
- `/admin/organizations/:id/users` (GET)

### Testing Strategy

```javascript
// TEST 1: User WITHOUT membership tries to access
// Expected: 403 Forbidden
GET /admin/organizations/abc-123/sections
Headers: { Cookie: 'userId=user-without-access' }
→ Status: 403, Error: "Access denied to this organization"

// TEST 2: User WITH membership accesses
// Expected: 200 OK
GET /admin/organizations/abc-123/sections
Headers: { Cookie: 'userId=user-with-membership' }
→ Status: 200, Data: [sections array]

// TEST 3: Global admin bypasses
// Expected: 200 OK
GET /admin/organizations/abc-123/sections
Headers: { Cookie: 'userId=global-admin-user' }
→ Status: 200, Data: [sections array]
```

### Risk Assessment
- **Risk Level**: LOW
- **Breaking Changes**: None
- **Database Changes**: None
- **Rollback Strategy**: Remove middleware, revert to original code

### Estimated Effort
- **Implementation**: 2 hours
- **Testing**: 1 hour
- **Total**: **3 hours**

---

## ISSUE #2: DOUBLE FORM SUBMISSIONS

### Problem Statement
Approval and workflow forms **submit multiple times** when user clicks rapidly, causing **duplicate database records** and **inconsistent state**.

### Root Cause Analysis

**Files**:
- `/views/dashboard/document-viewer.ejs` (client-side forms)
- `/src/routes/workflow.js` (backend endpoints)

**Why This Happens**:
1. **No client-side debouncing** on form submit buttons
2. **No server-side idempotency checks** (checking if action already performed)
3. Button remains **enabled** after first click

### Implementation Plan

#### Step 1: Client-Side Debouncing
**File**: `/views/dashboard/document-viewer.ejs`
**Location**: JavaScript section (approx line 800-1000)

```javascript
// ADD DEBOUNCE UTILITY:
let isSubmitting = false;

function debounceSubmit(callback, buttonId) {
  return async function(...args) {
    const button = document.getElementById(buttonId);

    if (isSubmitting) {
      console.log('Already submitting, ignoring duplicate click');
      return;
    }

    isSubmitting = true;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Processing...';

    try {
      await callback.apply(this, args);
    } finally {
      isSubmitting = false;
      button.disabled = false;
      button.innerHTML = button.dataset.originalText || 'Submit';
    }
  };
}

// APPLY TO APPROVAL FUNCTIONS:
async function approveSection(sectionId) {
  // Store original button text
  const btn = document.getElementById(`btn-approve-${sectionId}`);
  btn.dataset.originalText = btn.innerHTML;

  // Make API call
  const response = await fetch(`/api/workflow/sections/${sectionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: '' })
  });

  // Handle response...
}

// Wrap with debounce:
window.approveSection = debounceSubmit(approveSection, 'btn-approve');
```

#### Step 2: Server-Side Idempotency Check
**File**: `/src/routes/workflow.js`
**Location**: Line ~1357-1459 (approve endpoint)

```javascript
// ✅ ADD IDEMPOTENCY CHECK:
router.post('/sections/:sectionId/approve', requireAuth, async (req, res) => {
  const { sectionId } = req.params;
  const userId = req.session.userId;

  // Get current workflow stage
  const currentState = await getCurrentWorkflowStage(supabaseService, sectionId);

  // ✅ NEW: Check if already approved by this user in last 5 seconds
  if (currentState.status === 'approved' && currentState.actioned_by === userId) {
    const timeSinceApproval = Date.now() - new Date(currentState.actioned_at).getTime();

    if (timeSinceApproval < 5000) {
      console.log(`[Idempotency] Duplicate approval blocked for section ${sectionId}`);
      return res.status(200).json({
        success: true,
        message: 'Section already approved',
        state: currentState,
        isDuplicate: true
      });
    }
  }

  // Continue with normal approval logic...
});
```

#### Step 3: Add Request Tracking
**Create**: `/src/middleware/idempotency.js`

```javascript
/**
 * Idempotency Middleware
 * Prevents duplicate requests within a time window
 */
const requestCache = new Map();

function idempotencyCheck(windowMs = 5000) {
  return (req, res, next) => {
    const key = `${req.session.userId}:${req.method}:${req.path}`;
    const now = Date.now();

    const lastRequest = requestCache.get(key);

    if (lastRequest && (now - lastRequest < windowMs)) {
      console.log(`[Idempotency] Duplicate request blocked: ${key}`);
      return res.status(429).json({
        success: false,
        error: 'Request in progress. Please wait.',
        code: 'DUPLICATE_REQUEST'
      });
    }

    requestCache.set(key, now);

    // Cleanup old entries every 1000 requests
    if (requestCache.size > 1000) {
      const cutoff = now - windowMs;
      for (const [k, timestamp] of requestCache.entries()) {
        if (timestamp < cutoff) requestCache.delete(k);
      }
    }

    next();
  };
}

module.exports = { idempotencyCheck };
```

### Testing Strategy

```javascript
// TEST 1: Rapid clicking (client-side)
// Click "Approve" button 5 times in 1 second
// Expected: Only 1 request sent, button disabled immediately

// TEST 2: Duplicate API requests (server-side)
// Send 2 identical POST requests within 1 second
POST /api/workflow/sections/xyz/approve
POST /api/workflow/sections/xyz/approve (1ms later)
// Expected: First returns 200, second returns 429 or 200 with isDuplicate: true

// TEST 3: Sequential legitimate requests
// Send request, wait 6 seconds, send again
// Expected: Both succeed
```

### Risk Assessment
- **Risk Level**: LOW
- **Breaking Changes**: None
- **Database Changes**: None
- **Rollback Strategy**: Remove debounce wrapper, remove idempotency middleware

### Estimated Effort
- **Implementation**: 3 hours
- **Testing**: 1 hour
- **Total**: **4 hours**

---

## ISSUE #3: SIDEBAR COMPONENT DISPLAY

### Problem Statement
The sidebar in `document-viewer.ejs` **displays different components** (TOC vs Suggestions) based on context, causing **visual confusion** and **poor UX**.

### Root Cause Analysis

**File**: `/views/dashboard/document-viewer.ejs`

**Why This Happens**:
1. Single sidebar element (`<aside id="sidebar">`) used for **multiple purposes**
2. **JavaScript switches content** based on user actions (click section, click "view suggestions")
3. No clear visual separation between modes

### Implementation Plan

#### Step 1: Split into Two Distinct Sidebars
**File**: `/views/dashboard/document-viewer.ejs`
**Location**: Sidebar HTML structure (approx line 500-700)

```html
<!-- CURRENT (CONFUSING): -->
<aside id="sidebar">
  <div id="toc-view"></div>
  <div id="suggestions-view"></div>
</aside>

<!-- ✅ FIXED (CLEAR SEPARATION): -->
<aside id="toc-sidebar" class="sidebar sidebar-left">
  <div class="sidebar-header">
    <h3><i class="bi bi-list"></i> Table of Contents</h3>
    <button class="btn-close-sidebar" onclick="closeSidebar('toc')"></button>
  </div>
  <div class="sidebar-content">
    <!-- TOC content -->
  </div>
</aside>

<aside id="suggestions-sidebar" class="sidebar sidebar-right" style="display: none;">
  <div class="sidebar-header">
    <h3><i class="bi bi-chat-left-text"></i> Suggestions</h3>
    <button class="btn-close-sidebar" onclick="closeSidebar('suggestions')"></button>
  </div>
  <div class="sidebar-content">
    <!-- Suggestions content -->
  </div>
</aside>
```

#### Step 2: Add CSS for Dual Sidebars
**File**: `/public/css/document-viewer-enhancements.css`

```css
/* Sidebar Positioning */
.sidebar {
  position: fixed;
  top: 0;
  height: 100vh;
  width: 350px;
  background: white;
  box-shadow: 0 0 20px rgba(0,0,0,0.1);
  z-index: 1000;
  overflow-y: auto;
  transition: transform 0.3s ease;
}

.sidebar-left {
  left: 0;
  transform: translateX(-100%);
}

.sidebar-left.show {
  transform: translateX(0);
}

.sidebar-right {
  right: 0;
  transform: translateX(100%);
}

.sidebar-right.show {
  transform: translateX(0);
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

/* Mobile: Stack sidebars */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
  }
}
```

#### Step 3: Update JavaScript Controls
**File**: `/views/dashboard/document-viewer.ejs` (JavaScript section)

```javascript
// Sidebar state management
const sidebarState = {
  toc: false,
  suggestions: false
};

function toggleSidebar(type) {
  const sidebar = document.getElementById(`${type}-sidebar`);

  sidebarState[type] = !sidebarState[type];

  if (sidebarState[type]) {
    sidebar.classList.add('show');
  } else {
    sidebar.classList.remove('show');
  }
}

function closeSidebar(type) {
  const sidebar = document.getElementById(`${type}-sidebar`);
  sidebar.classList.remove('show');
  sidebarState[type] = false;
}

// Trigger functions
function viewSectionSuggestions(sectionId) {
  loadSuggestions(sectionId);
  toggleSidebar('suggestions');
}

function viewTableOfContents() {
  toggleSidebar('toc');
}
```

### Testing Strategy

```javascript
// TEST 1: Open TOC sidebar
// Click "View TOC" button
// Expected: Left sidebar slides in, TOC visible

// TEST 2: Open Suggestions sidebar
// Click "View Suggestions" on a section
// Expected: Right sidebar slides in, Suggestions visible

// TEST 3: Both sidebars open simultaneously
// Open TOC, then open Suggestions
// Expected: Both visible (TOC left, Suggestions right)

// TEST 4: Mobile responsive
// Test on 375px viewport
// Expected: Only one sidebar shown at a time, full-width
```

### Risk Assessment
- **Risk Level**: LOW
- **Breaking Changes**: None
- **Database Changes**: None
- **Rollback Strategy**: Revert to single sidebar

### Estimated Effort
- **Implementation**: 4 hours
- **Testing**: 1 hour
- **Total**: **5 hours**

---

## ISSUE #4: SIDEBAR VISIBILITY TOGGLE

### Problem Statement
There is **no toggle button** to show/hide the sidebar, forcing it to **always be visible** or requiring manual CSS hacks.

### Root Cause Analysis

**File**: `/views/dashboard/document-viewer.ejs`

**Why This Happens**:
1. No UI control for sidebar visibility
2. Sidebar state not persisted in localStorage
3. No keyboard shortcut for toggle

### Implementation Plan

#### Step 1: Add Toggle Buttons
**File**: `/views/dashboard/document-viewer.ejs`
**Location**: Document header (line ~340-360)

```html
<div class="document-header">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center gap-3">
        <h1><i class="bi bi-file-text me-2"></i><%= document.title %></h1>

        <!-- ✅ NEW: Sidebar Toggle Buttons -->
        <div class="sidebar-controls">
          <button
            class="btn btn-sm btn-outline-light"
            onclick="toggleSidebar('toc')"
            title="Toggle Table of Contents (Ctrl+1)"
          >
            <i class="bi bi-list"></i> TOC
          </button>

          <button
            class="btn btn-sm btn-outline-light"
            onclick="toggleSidebar('suggestions')"
            title="Toggle Suggestions (Ctrl+2)"
          >
            <i class="bi bi-chat-left-text"></i> Suggestions
          </button>
        </div>
      </div>

      <!-- Existing back button -->
    </div>
  </div>
</div>
```

#### Step 2: Add Keyboard Shortcuts
**File**: `/views/dashboard/document-viewer.ejs` (JavaScript section)

```javascript
// Keyboard shortcut handler
document.addEventListener('keydown', (e) => {
  // Ctrl+1: Toggle TOC
  if (e.ctrlKey && e.key === '1') {
    e.preventDefault();
    toggleSidebar('toc');
  }

  // Ctrl+2: Toggle Suggestions
  if (e.ctrlKey && e.key === '2') {
    e.preventDefault();
    toggleSidebar('suggestions');
  }

  // Escape: Close all sidebars
  if (e.key === 'Escape') {
    closeSidebar('toc');
    closeSidebar('suggestions');
  }
});
```

#### Step 3: Persist State in localStorage
**File**: `/views/dashboard/document-viewer.ejs` (JavaScript section)

```javascript
// Save sidebar state
function toggleSidebar(type) {
  const sidebar = document.getElementById(`${type}-sidebar`);

  sidebarState[type] = !sidebarState[type];

  if (sidebarState[type]) {
    sidebar.classList.add('show');
  } else {
    sidebar.classList.remove('show');
  }

  // ✅ NEW: Persist to localStorage
  localStorage.setItem(`sidebar-${type}-visible`, sidebarState[type]);
}

// Restore on page load
window.addEventListener('DOMContentLoaded', () => {
  const tocVisible = localStorage.getItem('sidebar-toc-visible') === 'true';
  const suggestionsVisible = localStorage.getItem('sidebar-suggestions-visible') === 'true';

  if (tocVisible) toggleSidebar('toc');
  if (suggestionsVisible) toggleSidebar('suggestions');
});
```

### Testing Strategy

```javascript
// TEST 1: Toggle buttons work
// Click "TOC" button
// Expected: Sidebar opens
// Click again
// Expected: Sidebar closes

// TEST 2: Keyboard shortcuts
// Press Ctrl+1
// Expected: TOC sidebar toggles
// Press Ctrl+2
// Expected: Suggestions sidebar toggles

// TEST 3: State persistence
// Open TOC sidebar, refresh page
// Expected: TOC sidebar still open

// TEST 4: Escape key closes all
// Press Escape
// Expected: All sidebars close
```

### Risk Assessment
- **Risk Level**: LOW
- **Breaking Changes**: None
- **Database Changes**: None
- **Rollback Strategy**: Remove toggle buttons

### Estimated Effort
- **Implementation**: 2 hours
- **Testing**: 1 hour
- **Total**: **3 hours**

---

## ISSUE #5: INDENT/DEDENT ORDINAL RECALCULATION

### Problem Statement
When users **indent or dedent sections**, the ordinal values (**sibling position**) are **not recalculated**, causing **incorrect hierarchical ordering**.

### Root Cause Analysis

**Files**:
- `/src/services/sectionStorage.js` (Line 26-50: ordinal calculation)
- `/src/routes/admin.js` or `/src/routes/dashboard.js` (indent/dedent endpoints - **NOT FOUND**)

**Why This Happens**:
1. **Ordinal calculation** happens **only during initial insertion** (sectionStorage.js:131-141)
2. **No indent/dedent API endpoints** exist in current codebase
3. **No trigger or function** recalculates ordinals when `parent_section_id` or `depth` changes

**Evidence from Code**:
```javascript
// sectionStorage.js Line 131-141
// Count siblings at same depth with same parent
if (parentStack.length > 0) {
  const parentId = parentStack[parentStack.length - 1].tempId;
  const siblings = hierarchicalSections.filter(s =>
    s.parent_temp_id === parentId && s.depth === depth
  );
  ordinal = siblings.length + 1;  // ✅ Works ONLY during initial parse
}
```

### Implementation Plan

#### Step 1: Create Indent/Dedent API Endpoints
**File**: `/src/routes/admin.js` (new endpoints)

```javascript
/**
 * POST /admin/sections/:sectionId/indent
 * Increase section depth (move right in hierarchy)
 */
router.post('/sections/:sectionId/indent', requireAuth, async (req, res) => {
  const { sectionId } = req.params;
  const { supabaseService } = req;
  const userId = req.session.userId;

  // Get current section
  const { data: section, error: sectionError } = await supabaseService
    .from('document_sections')
    .select('id, depth, parent_section_id, document_order, document_id')
    .eq('id', sectionId)
    .single();

  if (sectionError || !section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  // Cannot indent beyond depth 9 (10 levels total)
  if (section.depth >= 9) {
    return res.status(400).json({ error: 'Maximum depth reached' });
  }

  // Find new parent (previous sibling at current depth)
  const { data: newParent } = await supabaseService
    .from('document_sections')
    .select('id')
    .eq('document_id', section.document_id)
    .eq('depth', section.depth)
    .lt('document_order', section.document_order)
    .order('document_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!newParent) {
    return res.status(400).json({ error: 'Cannot indent: no previous sibling' });
  }

  // Update section
  const { error: updateError } = await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: newParent.id,
      depth: section.depth + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', sectionId);

  if (updateError) {
    return res.status(500).json({ error: 'Failed to indent section' });
  }

  // ✅ CRITICAL: Recalculate ordinals for affected siblings
  await recalculateOrdinalsForParent(supabaseService, newParent.id);

  res.json({ success: true, message: 'Section indented successfully' });
});

/**
 * POST /admin/sections/:sectionId/dedent
 * Decrease section depth (move left in hierarchy)
 */
router.post('/sections/:sectionId/dedent', requireAuth, async (req, res) => {
  const { sectionId } = req.params;
  const { supabaseService } = req;

  // Get current section
  const { data: section, error: sectionError } = await supabaseService
    .from('document_sections')
    .select('id, depth, parent_section_id, document_id')
    .eq('id', sectionId)
    .single();

  if (sectionError || !section) {
    return res.status(404).json({ error: 'Section not found' });
  }

  // Cannot dedent root level sections
  if (section.depth === 0) {
    return res.status(400).json({ error: 'Cannot dedent root-level section' });
  }

  // Get current parent
  const { data: currentParent } = await supabaseService
    .from('document_sections')
    .select('id, parent_section_id')
    .eq('id', section.parent_section_id)
    .single();

  if (!currentParent) {
    return res.status(400).json({ error: 'Parent section not found' });
  }

  // Update section to grandparent level
  const { error: updateError } = await supabaseService
    .from('document_sections')
    .update({
      parent_section_id: currentParent.parent_section_id,
      depth: section.depth - 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', sectionId);

  if (updateError) {
    return res.status(500).json({ error: 'Failed to dedent section' });
  }

  // ✅ CRITICAL: Recalculate ordinals for OLD and NEW parent
  await recalculateOrdinalsForParent(supabaseService, section.parent_section_id);
  await recalculateOrdinalsForParent(supabaseService, currentParent.parent_section_id);

  res.json({ success: true, message: 'Section dedented successfully' });
});
```

#### Step 2: Create Ordinal Recalculation Function
**File**: `/src/services/sectionStorage.js` (add new method)

```javascript
/**
 * Recalculate ordinals for all children of a parent
 * @param {Object} supabase - Supabase client
 * @param {string|null} parentId - Parent section ID (null for root level)
 * @param {string} documentId - Document ID
 */
async recalculateOrdinalsForParent(supabase, parentId, documentId) {
  try {
    // Fetch all siblings at same parent level
    let query = supabase
      .from('document_sections')
      .select('id, document_order')
      .eq('document_id', documentId)
      .order('document_order', { ascending: true });

    if (parentId === null) {
      query = query.is('parent_section_id', null);
    } else {
      query = query.eq('parent_section_id', parentId);
    }

    const { data: siblings, error } = await query;

    if (error) {
      console.error('Error fetching siblings:', error);
      return { success: false, error: error.message };
    }

    // Update ordinals sequentially (1, 2, 3, ...)
    for (let i = 0; i < siblings.length; i++) {
      const { error: updateError } = await supabase
        .from('document_sections')
        .update({ ordinal: i + 1 })
        .eq('id', siblings[i].id);

      if (updateError) {
        console.error(`Error updating ordinal for section ${siblings[i].id}:`, updateError);
      }
    }

    console.log(`Recalculated ordinals for ${siblings.length} siblings of parent ${parentId}`);
    return { success: true, updatedCount: siblings.length };

  } catch (error) {
    console.error('Error recalculating ordinals:', error);
    return { success: false, error: error.message };
  }
}

// Export the function
module.exports.recalculateOrdinalsForParent = recalculateOrdinalsForParent;
```

#### Step 3: Add Database Trigger (Optional Enhancement)
**File**: Create migration `006_auto_recalculate_ordinals.sql`

```sql
-- Auto-recalculate ordinals when parent_section_id changes
CREATE OR REPLACE FUNCTION recalculate_ordinals_on_parent_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When parent changes, recalculate ordinals for OLD parent's children
  IF (OLD.parent_section_id IS DISTINCT FROM NEW.parent_section_id) THEN

    -- Recalculate old parent's children
    WITH ordered_siblings AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY document_order) as new_ordinal
      FROM document_sections
      WHERE parent_section_id = OLD.parent_section_id
        AND id != NEW.id
        AND document_id = OLD.document_id
    )
    UPDATE document_sections
    SET ordinal = ordered_siblings.new_ordinal
    FROM ordered_siblings
    WHERE document_sections.id = ordered_siblings.id;

    -- Recalculate new parent's children
    WITH ordered_siblings AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY document_order) as new_ordinal
      FROM document_sections
      WHERE parent_section_id = NEW.parent_section_id
        AND document_id = NEW.document_id
    )
    UPDATE document_sections
    SET ordinal = ordered_siblings.new_ordinal
    FROM ordered_siblings
    WHERE document_sections.id = ordered_siblings.id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_ordinals_trigger
AFTER UPDATE OF parent_section_id, depth ON document_sections
FOR EACH ROW
EXECUTE FUNCTION recalculate_ordinals_on_parent_change();
```

### Testing Strategy

```javascript
// TEST 1: Indent section
POST /admin/sections/section-123/indent
// Expected: depth increases by 1, parent_section_id changes, ordinals recalculated

// TEST 2: Dedent section
POST /admin/sections/section-123/dedent
// Expected: depth decreases by 1, parent_section_id changes to grandparent

// TEST 3: Verify ordinal uniqueness
// After indent/dedent, query all siblings
SELECT ordinal, COUNT(*) FROM document_sections
WHERE parent_section_id = 'parent-xyz'
GROUP BY ordinal HAVING COUNT(*) > 1;
// Expected: No duplicate ordinals

// TEST 4: Boundary conditions
// Try to indent section at depth 9
// Expected: 400 error "Maximum depth reached"
// Try to dedent root level section
// Expected: 400 error "Cannot dedent root-level section"
```

### Risk Assessment
- **Risk Level**: MEDIUM
- **Breaking Changes**: None (new endpoints)
- **Database Changes**: Migration for trigger (optional)
- **Rollback Strategy**: Drop trigger if needed

### Estimated Effort
- **Implementation**: 4 hours
- **Testing**: 2 hours
- **Total**: **6 hours**

---

## ISSUE #6: ROLE CONSOLIDATION

### Problem Statement
The database has **dual role systems**:
1. `user_organizations.role` (owner, admin, member, viewer)
2. `user_organizations.permissions` JSONB with `can_approve_stages`, `is_global_admin`, etc.

This creates **confusion** and **potential inconsistencies**.

### Root Cause Analysis

**Files**:
- Database schema: `user_organizations` table
- `/src/middleware/permissions.js` (uses both systems)
- `/src/middleware/globalAdmin.js` (checks `is_global_admin` in permissions JSONB)

**Current Schema**:
```sql
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  role TEXT,  -- 'owner', 'admin', 'member', 'viewer'
  permissions JSONB,  -- { can_approve_stages: [], is_global_admin: true }
  is_global_admin BOOLEAN DEFAULT false,  -- Redundant!
  is_active BOOLEAN DEFAULT true
);
```

**Why This Happens**:
1. **Organic growth** - permissions JSONB added later for flexibility
2. **No migration** to consolidate
3. **Both systems checked** in different parts of code

### Implementation Plan

#### Option A: Keep Dual System (Recommended for MVP)
**Rationale**: Least disruptive, maintains backward compatibility

**File**: `/src/middleware/permissions.js` (documentation update)

```javascript
/**
 * ROLE & PERMISSIONS ARCHITECTURE
 *
 * This system uses a DUAL approach for maximum flexibility:
 *
 * 1. ROLE (user_organizations.role):
 *    - Primary access control (owner > admin > member > viewer)
 *    - Used for route-level permissions (requireRole middleware)
 *    - Determines hierarchy level (owner: 4, admin: 3, member: 2, viewer: 1)
 *
 * 2. PERMISSIONS (user_organizations.permissions JSONB):
 *    - Fine-grained permissions (can_approve_stages, can_edit, etc.)
 *    - Global admin flag (is_global_admin)
 *    - Stage-specific approvals (can_approve_stages: ['stage-1', 'stage-2'])
 *
 * PRIORITY: Permissions JSONB overrides role-based permissions
 *
 * Example:
 * - User has role: 'member' (normally cannot approve)
 * - But permissions.can_approve_stages = ['all']
 * - Result: User CAN approve all stages
 */
```

**No code changes required** - just documentation.

#### Option B: Consolidate to Single System (Long-term)
**Rationale**: Cleaner architecture, easier to maintain

**Migration**: Create `007_consolidate_roles.sql`

```sql
-- Step 1: Create new role_permissions table
CREATE TABLE role_permissions (
  role_code TEXT PRIMARY KEY,
  role_name TEXT NOT NULL,
  hierarchy_level INTEGER NOT NULL,
  default_permissions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO role_permissions VALUES
  ('owner', 'Owner', 4, '{"can_approve_all": true, "can_edit_all": true, "can_delete_all": true}'::jsonb),
  ('admin', 'Admin', 3, '{"can_approve_all": true, "can_edit_all": true, "can_delete_own": true}'::jsonb),
  ('member', 'Member', 2, '{"can_edit_own": true, "can_comment": true}'::jsonb),
  ('viewer', 'Viewer', 1, '{"can_view": true}'::jsonb);

-- Step 2: Migrate existing permissions
UPDATE user_organizations uo
SET permissions = COALESCE(uo.permissions, '{}'::jsonb) || rp.default_permissions
FROM role_permissions rp
WHERE uo.role = rp.role_code;

-- Step 3: Add foreign key constraint
ALTER TABLE user_organizations
ADD CONSTRAINT fk_role_permissions
FOREIGN KEY (role) REFERENCES role_permissions(role_code);

-- Step 4: Remove redundant is_global_admin column
ALTER TABLE user_organizations
DROP COLUMN is_global_admin;

-- Step 5: Create helper function
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (permissions->p_permission)::boolean,
    false
  )
  FROM user_organizations
  WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND is_active = true;
$$ LANGUAGE SQL STABLE;
```

**Update Code**: `/src/middleware/permissions.js`

```javascript
// Before (checks both role and permissions):
if (req.session.isAdmin || userOrg.permissions?.is_global_admin) {
  // Allow access
}

// After (checks only permissions):
if (await hasOrgPermission(userId, orgId, 'can_approve_all')) {
  // Allow access
}
```

### Recommendation

**For this sprint**: Choose **Option A** (document and keep dual system)
**For future sprint**: Plan **Option B** (full consolidation)

### Risk Assessment
- **Option A Risk Level**: NONE (documentation only)
- **Option B Risk Level**: MEDIUM-HIGH (database migration, code updates)
- **Breaking Changes**: Option B requires extensive testing
- **Rollback Strategy**: Option A = none needed, Option B = revert migration

### Estimated Effort
- **Option A**: 30 minutes (documentation)
- **Option B**: 8 hours (migration + code updates + testing)
- **Recommendation**: **Option A for now**

---

## ISSUE #7: PARSER INTEGRATION VERIFICATION

### Problem Statement
Need to **verify** that the new **Markdown and Text parsers** are **properly integrated** with the **10-level hierarchy system**.

### Root Cause Analysis

**Files**:
- `/src/parsers/markdownParser.js` (new)
- `/src/parsers/textParser.js` (new)
- `/src/parsers/hierarchyDetector.js` (existing)
- `/src/services/sectionStorage.js` (integration point)

**What to Verify**:
1. ✅ Parsers call `hierarchyDetector.detectHierarchy()` with org config
2. ✅ Parsers respect `maxDepth` from org hierarchy config
3. ✅ Parsers handle **empty prefix** levels (Issue documented in AVENUES_OF_ATTACK.txt)
4. ✅ `sectionStorage.js` correctly calculates ordinals during initial parse

### Implementation Plan

#### Step 1: Code Review Checklist
**File**: Create `/docs/PARSER_INTEGRATION_CHECKLIST.md`

```markdown
# Parser Integration Verification Checklist

## ✅ Markdown Parser (markdownParser.js)

- [ ] Line 50-100: Calls `hierarchyDetector.detectHierarchy()`
- [ ] Line 150: Respects `organizationConfig.hierarchy.maxDepth`
- [ ] Line 200: Handles empty prefix levels (e.g., "1.", "2.")
- [ ] Line 300: Returns sections with correct depth values (0-9)
- [ ] Line 400: Includes parent_section_id calculation

## ✅ Text Parser (textParser.js)

- [ ] Line 50-100: Calls `hierarchyDetector.detectHierarchy()`
- [ ] Line 150: Respects `organizationConfig.hierarchy.maxDepth`
- [ ] Line 200: Handles empty prefix levels
- [ ] Line 300: Returns sections with correct depth values
- [ ] Line 400: Includes parent_section_id calculation

## ✅ Hierarchy Detector (hierarchyDetector.js)

- [x] Line 56-130: Empty prefix detection patterns added (ALREADY FIXED)
- [x] Line 131: Validates depth against maxDepth
- [x] Line 200: Supports 10-level hierarchy

## ✅ Section Storage (sectionStorage.js)

- [x] Line 131-141: Ordinal calculation (sibling position)
- [x] Line 26-50: Depth and parent_section_id mapping
- [x] Database trigger auto-calculates path_ids, path_ordinals
```

#### Step 2: Integration Tests
**File**: Create `/tests/integration/parser-hierarchy-integration.test.js`

```javascript
const { markdownParser } = require('../../src/parsers/markdownParser');
const { textParser } = require('../../src/parsers/textParser');
const sectionStorage = require('../../src/services/sectionStorage');

describe('Parser → Hierarchy → Storage Integration', () => {

  test('Markdown parser detects 10-level hierarchy', async () => {
    const markdown = `
# ARTICLE I - Root Level

## Section 1 - Level 1

### (a) - Level 2

#### 1. - Level 3

##### (i) - Level 4

###### A. - Level 5

####### (1) - Level 6

######## a. - Level 7

######### (a) - Level 8

########## i. - Level 9
    `;

    const config = {
      hierarchy: {
        maxDepth: 10,
        levels: [
          { depth: 0, prefix: 'ARTICLE', numbering: 'roman' },
          { depth: 1, prefix: 'Section', numbering: 'numeric' },
          { depth: 2, prefix: '(', numbering: 'alphaLower' },
          // ... remaining levels
        ]
      }
    };

    const sections = await markdownParser.parse(markdown, config);

    expect(sections.length).toBeGreaterThan(0);
    expect(sections.some(s => s.depth === 9)).toBe(true);
    expect(sections.every(s => s.depth <= 9)).toBe(true);
  });

  test('Empty prefix detection works in text parser', async () => {
    const text = `
1. First item
2. Second item
  a. Sub-item
  b. Another sub-item
3. Third item
    `;

    const config = {
      hierarchy: {
        maxDepth: 10,
        levels: [
          { depth: 0, prefix: '', numbering: 'numeric' },  // Empty prefix!
          { depth: 1, prefix: '', numbering: 'alphaLower' }
        ]
      }
    };

    const sections = await textParser.parse(text, config);

    expect(sections.length).toBe(5);
    expect(sections[0].number).toBe('1');
    expect(sections[2].depth).toBe(1);
    expect(sections[2].number).toBe('a');
  });

  test('Section storage calculates ordinals correctly', async () => {
    const sections = [
      { depth: 0, number: 'I', title: 'Article I' },
      { depth: 1, number: '1', title: 'Section 1' },
      { depth: 1, number: '2', title: 'Section 2' },
      { depth: 1, number: '3', title: 'Section 3' },
      { depth: 0, number: 'II', title: 'Article II' },
    ];

    const hierarchical = await sectionStorage.buildHierarchy(sections);

    // Article I should have ordinal 1
    expect(hierarchical[0].ordinal).toBe(1);

    // Section 1, 2, 3 should have ordinals 1, 2, 3 (siblings of Article I)
    expect(hierarchical[1].ordinal).toBe(1);
    expect(hierarchical[2].ordinal).toBe(2);
    expect(hierarchical[3].ordinal).toBe(3);

    // Article II should have ordinal 2 (sibling of Article I)
    expect(hierarchical[4].ordinal).toBe(2);
  });
});
```

#### Step 3: Manual Testing Procedure
**File**: `/docs/PARSER_MANUAL_TESTING.md`

```markdown
# Manual Parser Testing Procedure

## Test 1: Upload Markdown Document with 10 Levels

1. Create test file: `test-10-levels.md`
2. Upload via Dashboard → "Upload Document"
3. Verify in database:
   ```sql
   SELECT section_number, depth, ordinal, path_ordinals
   FROM document_sections
   WHERE document_id = 'xxx'
   ORDER BY document_order;
   ```
4. Expected: All sections have depth 0-9, correct ordinals

## Test 2: Upload Text Document with Empty Prefixes

1. Create test file: `test-empty-prefix.txt`
   ```
   1. First
   2. Second
     a. Sub-first
     b. Sub-second
   3. Third
   ```
2. Configure org with empty prefix for depth 0, 1
3. Upload and verify sections detected

## Test 3: Verify TOC Display

1. Open document viewer
2. Check TOC shows all 10 levels with correct indentation
3. Verify clicking TOC item scrolls to section
```

### Risk Assessment
- **Risk Level**: LOW (verification only, no code changes)
- **Breaking Changes**: None
- **Database Changes**: None
- **Issues Found**: Document and create tickets

### Estimated Effort
- **Code Review**: 1 hour
- **Integration Tests**: 2 hours
- **Manual Testing**: 1 hour
- **Total**: **4 hours**

---

## SUMMARY TABLE

| Issue | Component | Risk | Effort | Priority |
|-------|-----------|------|--------|----------|
| #1 | Admin Routes (Permissions) | LOW | 3 hrs | HIGH |
| #2 | Form Submissions (Debouncing) | LOW | 4 hrs | HIGH |
| #3 | Sidebar Display (UI/UX) | LOW | 5 hrs | MEDIUM |
| #4 | Sidebar Toggle (UI/UX) | LOW | 3 hrs | MEDIUM |
| #5 | Indent/Dedent (Ordinals) | MEDIUM | 6 hrs | HIGH |
| #6 | Role Consolidation (Option A) | NONE | 0.5 hrs | LOW |
| #7 | Parser Verification | LOW | 4 hrs | MEDIUM |

**TOTAL**: 25.5 hours ≈ 3-4 working days

---

## IMPLEMENTATION SEQUENCE

### Phase 1: Security & Critical Fixes (Day 1)
1. **Issue #1** - Admin route permissions (3 hrs)
2. **Issue #2** - Form submission debouncing (4 hrs)

### Phase 2: Hierarchy & Ordinals (Day 2)
3. **Issue #5** - Indent/dedent ordinal recalculation (6 hrs)
4. **Issue #7** - Parser integration verification (4 hrs)

### Phase 3: UX Enhancements (Day 3)
5. **Issue #3** - Sidebar component separation (5 hrs)
6. **Issue #4** - Sidebar toggle controls (3 hrs)

### Phase 4: Documentation (Ongoing)
7. **Issue #6** - Role consolidation documentation (0.5 hrs)

---

## COORDINATION WITH OTHER AGENTS

### Expected Inputs from ANALYST:
- ✅ Authentication flow analysis
- ✅ Route permission requirements
- ⏳ Database schema recommendations

### Expected Inputs from RESEARCHER:
- ✅ Form submission best practices
- ✅ Sidebar UX patterns
- ⏳ Ordinal calculation algorithms

### Expected Inputs from TESTER:
- ⏳ Test cases for all 7 issues
- ⏳ UI/UX validation criteria
- ⏳ Regression test suite

### Outputs for REVIEWER:
- 📊 Code diffs for each fix
- 📊 Architecture diagrams
- 📊 Risk assessments

---

## MEMORY STORAGE KEYS

```bash
# Storing implementation plan in Hive Mind memory
npx claude-flow@alpha memory store \
  --key "hive/coder/architecture-map" \
  --value "$(cat docs/CODER_IMPLEMENTATION_STRATEGY.md)"

npx claude-flow@alpha memory store \
  --key "hive/coder/implementation-plan" \
  --value "7 issues analyzed, 25.5 hrs estimated, 3-phase approach"

npx claude-flow@alpha memory store \
  --key "hive/coder/risk-assessment" \
  --value "LOW-MEDIUM risk, minimal breaking changes, database migration for issue #5 only"
```

---

## NEXT STEPS

1. **Await approval** from user/PM on implementation sequence
2. **Coordinate with ANALYST** for final auth flow verification
3. **Coordinate with RESEARCHER** for ordinal algorithm validation
4. **Begin Phase 1** implementation (Issues #1, #2)
5. **Create pull request** after each phase
6. **Coordinate with TESTER** for validation

---

**Document Complete** ✅
**Ready for Hive Mind Coordination** 🧠
**Awaiting Instructions to Proceed** 🚀
