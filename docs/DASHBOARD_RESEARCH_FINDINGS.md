# Dashboard Research Findings - Multi-Tenant Document Management System

**Research Agent**: dashboard-researcher
**Date**: 2025-10-12
**Swarm ID**: swarm-1760306458434-qnrq99xy2
**Status**: Complete

---

## Executive Summary

This document presents comprehensive research findings for implementing a multi-tenant dashboard for the Bylaws Amendment Tracker. The system currently has a functional setup wizard but redirects to `/dashboard` (which doesn't exist) after completion. This research covers existing architecture, security patterns, best practices, and detailed implementation recommendations.

**Key Finding**: The application uses a **hybrid security model** where RLS provides fail-safe protection while application-level logic enforces multi-tenant isolation.

---

## 1. EXISTING CODEBASE ANALYSIS

### 1.1 Current Architecture

#### Multi-Tenant Foundation
- **Organizations Table**: Root of all tenant data with unique slug identifiers
- **Documents Table**: Each organization can have multiple documents (bylaws, policies, procedures)
- **Document Sections**: Flexible hierarchy supporting arbitrary nesting depths
- **RLS Policies**: Multi-layer security model (see section 4)

#### Setup Wizard Flow
**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/setup.js`

1. **Welcome** (`GET /setup`) → Organization info
2. **Organization** (`POST /setup/organization`) → Document structure
3. **Document Type** (`POST /setup/document-type`) → Workflow config
4. **Workflow** (`POST /setup/workflow`) → Import/Skip
5. **Import** (`POST /setup/import`) → Processing screen
6. **Processing** (`GET /setup/processing`) → Success/Dashboard
7. **Success** (`GET /setup/success`) → **Redirects to `/dashboard`**

**Critical Redirect Points**:
```javascript
// Line 52 in setup.js
if (req.app.locals.isConfigured) {
    return res.redirect('/dashboard');  // ❌ Dashboard doesn't exist
}

// Line 414 in setup.js
req.session.isConfigured = true;  // Marks setup complete
```

#### Session Management
```javascript
// Session stores setup data temporarily
req.session.setupData = {
    organization: { ... },
    documentType: { ... },
    workflow: { stages: [ ... ] },
    import: { file_path: ... },
    completedSteps: ['organization', 'document', 'workflow', 'import'],
    status: 'complete',
    organizationId: 'uuid',  // Created during processing
    documentId: 'uuid',      // Created if document imported
    sectionsCount: 42        // Number of sections parsed
}
```

### 1.2 Database Schema (Generalized)

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/database/migrations/001_generalized_schema.sql`

#### Core Tables:
1. **organizations** - Multi-tenant root with slug, settings, hierarchy_config
2. **users** - User accounts (prepared for Supabase Auth)
3. **user_organizations** - Many-to-many with roles and permissions
4. **documents** - Document metadata, versioning, status
5. **document_sections** - Adjacency list + materialized path for hierarchy
6. **suggestions** - Amendment proposals (single or multi-section)
7. **suggestion_sections** - Junction table for multi-section suggestions
8. **workflow_templates** - Configurable N-stage approval workflows
9. **workflow_stages** - Individual stages within workflows
10. **section_workflow_states** - Tracks approval state per section/stage

#### Key Relationships:
```
organizations (1) ←→ (N) documents
documents (1) ←→ (N) document_sections
documents (1) ←→ (N) suggestions
suggestions (N) ←→ (N) document_sections (via suggestion_sections)
organizations (1) ←→ (N) workflow_templates
workflow_templates (1) ←→ (N) workflow_stages
document_sections (N) ←→ (N) workflow_stages (via section_workflow_states)
```

### 1.3 Configuration System

**File**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/config/organizationConfig.js`

#### Hierarchy Configuration:
```javascript
hierarchy: {
    levels: [
        {
            name: 'Article',
            type: 'article',
            numbering: 'roman',  // roman, numeric, alpha
            prefix: 'Article ',
            depth: 0
        },
        {
            name: 'Section',
            type: 'section',
            numbering: 'numeric',
            prefix: 'Section ',
            depth: 1
        }
    ],
    maxDepth: 5,
    allowNesting: true
}
```

#### Workflow Configuration:
```javascript
workflow: {
    enabled: true,
    stages: [
        {
            name: 'Committee Review',
            order: 1,
            color: '#FFD700',
            icon: 'clipboard-check',
            permissions: ['committee_member', 'committee_chair', 'admin'],
            actions: ['approve', 'reject', 'edit', 'comment']
        },
        {
            name: 'Board Approval',
            order: 2,
            color: '#90EE90',
            icon: 'check-circle',
            permissions: ['board_member', 'admin'],
            actions: ['approve', 'reject', 'comment']
        }
    ]
}
```

### 1.4 Existing Views

**Relevant Views**:
- `/views/bylaws-improved.ejs` - Main document viewing interface
- `/views/setup/*.ejs` - Setup wizard screens
- **Missing**: `/views/dashboard.ejs` or equivalent

---

## 2. DASHBOARD BEST PRACTICES

### 2.1 Modern Dashboard UI/UX Patterns

#### Layout Architecture
```
┌─────────────────────────────────────────────────────┐
│ Top Navigation Bar (Org Switcher, User Menu)       │
├─────────────┬───────────────────────────────────────┤
│             │  Main Content Area                    │
│  Sidebar    │  ┌─────────────────────────────────┐  │
│  Navigation │  │ Dashboard Cards / Widgets       │  │
│  (Collapsed │  │                                 │  │
│   on mobile)│  │ - Recent Activity               │  │
│             │  │ - Quick Actions                 │  │
│             │  │ - Statistics                    │  │
│             │  │ - Document List                 │  │
│             │  └─────────────────────────────────┘  │
└─────────────┴───────────────────────────────────────┘
```

#### Key Design Principles:
1. **Progressive Disclosure**: Show overview → drill down into details
2. **Quick Actions**: Common tasks accessible in 1-2 clicks
3. **Status Indicators**: Visual cues for workflow stages and approval states
4. **Responsive Design**: Mobile-first with collapsible navigation
5. **Real-Time Updates**: WebSocket or polling for collaborative editing

### 2.2 Dashboard Components for Document Management

#### 1. Overview Cards (Top Row)
```html
<div class="dashboard-overview">
    <div class="stat-card">
        <i class="bi bi-file-earmark-text"></i>
        <h3>{{ documentCount }}</h3>
        <p>Active Documents</p>
    </div>
    <div class="stat-card">
        <i class="bi bi-lightbulb"></i>
        <h3>{{ openSuggestionsCount }}</h3>
        <p>Open Suggestions</p>
    </div>
    <div class="stat-card">
        <i class="bi bi-hourglass-split"></i>
        <h3>{{ pendingApprovalsCount }}</h3>
        <p>Pending Approvals</p>
    </div>
    <div class="stat-card">
        <i class="bi bi-check-circle"></i>
        <h3>{{ approvedThisWeek }}</h3>
        <p>Approved This Week</p>
    </div>
</div>
```

#### 2. Document List Table
```html
<div class="document-list">
    <table class="table table-hover">
        <thead>
            <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Status</th>
                <th>Sections</th>
                <th>Suggestions</th>
                <th>Last Updated</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <tr data-document-id="{{ doc.id }}">
                <td>
                    <strong>{{ doc.title }}</strong>
                    <small class="text-muted d-block">
                        {{ doc.description }}
                    </small>
                </td>
                <td>
                    <span class="badge bg-primary">
                        {{ doc.document_type }}
                    </span>
                </td>
                <td>
                    <span class="badge bg-{{ doc.status_color }}">
                        {{ doc.status }}
                    </span>
                </td>
                <td>{{ doc.sections_count }}</td>
                <td>
                    <span class="badge bg-warning">
                        {{ doc.open_suggestions_count }} open
                    </span>
                </td>
                <td>{{ doc.updated_at | date }}</td>
                <td>
                    <a href="/documents/{{ doc.id }}"
                       class="btn btn-sm btn-primary">
                        View
                    </a>
                </td>
            </tr>
        </tbody>
    </table>
</div>
```

#### 3. Recent Activity Feed
```html
<div class="activity-feed">
    <h5>Recent Activity</h5>
    <div class="activity-item">
        <i class="bi bi-lightbulb text-warning"></i>
        <div class="activity-content">
            <strong>{{ author }}</strong> submitted a suggestion
            <br>
            <small class="text-muted">
                Article III, Section 2 • {{ timeAgo }}
            </small>
        </div>
    </div>
    <div class="activity-item">
        <i class="bi bi-check-circle text-success"></i>
        <div class="activity-content">
            <strong>{{ approver }}</strong> approved amendment
            <br>
            <small class="text-muted">
                Article V, Section 1 • {{ timeAgo }}
            </small>
        </div>
    </div>
</div>
```

#### 4. Quick Actions Panel
```html
<div class="quick-actions">
    <h5>Quick Actions</h5>
    <a href="/documents/new" class="btn btn-primary btn-block">
        <i class="bi bi-plus-circle"></i> Create Document
    </a>
    <a href="/suggestions/review" class="btn btn-outline-secondary btn-block">
        <i class="bi bi-clipboard-check"></i> Review Suggestions ({{ count }})
    </a>
    <a href="/workflow/pending" class="btn btn-outline-warning btn-block">
        <i class="bi bi-hourglass-split"></i> Pending Approvals ({{ count }})
    </a>
    <a href="/reports" class="btn btn-outline-info btn-block">
        <i class="bi bi-graph-up"></i> View Reports
    </a>
</div>
```

### 2.3 Navigation Structure

#### Sidebar Navigation (Multi-Level)
```
📊 Dashboard (Overview)
├─ 📄 Documents
│  ├─ All Documents
│  ├─ Active
│  ├─ Archived
│  └─ Create New
├─ 💡 Suggestions
│  ├─ Open Suggestions
│  ├─ My Suggestions
│  └─ Review Queue
├─ ✅ Approvals
│  ├─ Pending Review
│  ├─ My Tasks
│  └─ Workflow Status
├─ 📊 Reports
│  ├─ Activity Log
│  ├─ Statistics
│  └─ Export Data
└─ ⚙️ Settings
   ├─ Organization
   ├─ Workflows
   ├─ Users & Roles
   └─ Preferences
```

### 2.4 Approval Workflow UI Patterns

#### Visual Workflow Progress
```html
<div class="workflow-progress">
    <div class="workflow-stage completed">
        <i class="bi bi-check-circle-fill"></i>
        <span>Committee Review</span>
        <small>Approved by John D.</small>
    </div>
    <div class="workflow-arrow"></div>
    <div class="workflow-stage active">
        <i class="bi bi-hourglass-split"></i>
        <span>Board Approval</span>
        <small>Pending (2/3 votes)</small>
    </div>
    <div class="workflow-arrow"></div>
    <div class="workflow-stage pending">
        <i class="bi bi-circle"></i>
        <span>President Signature</span>
        <small>Not started</small>
    </div>
</div>
```

#### Approval Action Interface
```html
<div class="approval-actions">
    <h5>Your Action Required</h5>
    <div class="suggestion-preview">
        <strong>Article III, Section 2</strong>
        <div class="diff-viewer">
            <del>Old text here...</del>
            <ins>New suggested text here...</ins>
        </div>
    </div>
    <div class="action-buttons">
        <button class="btn btn-success" data-action="approve">
            <i class="bi bi-check-circle"></i> Approve
        </button>
        <button class="btn btn-danger" data-action="reject">
            <i class="bi bi-x-circle"></i> Reject
        </button>
        <button class="btn btn-secondary" data-action="comment">
            <i class="bi bi-chat-left-text"></i> Add Comment
        </button>
    </div>
</div>
```

---

## 3. TECHNICAL REQUIREMENTS

### 3.1 Redirect from Setup Wizard

**Current Behavior**:
```javascript
// After setup completion:
req.session.isConfigured = true;
res.redirect('/dashboard');  // ❌ 404 Not Found
```

**Required Implementation**:
```javascript
// In server.js or new dashboard routes file
app.get('/dashboard', requireSetup, async (req, res) => {
    // Get organization from session
    const orgId = req.session.organizationId ||
                  await getFirstOrganization(req.supabase);

    // Load dashboard data
    const dashboardData = await loadDashboardData(orgId, req.supabase);

    res.render('dashboard', {
        title: 'Dashboard',
        organization: dashboardData.organization,
        documents: dashboardData.documents,
        recentActivity: dashboardData.recentActivity,
        statistics: dashboardData.statistics
    });
});
```

### 3.2 Organization-Specific Data Queries

**Critical Pattern**: ALL queries MUST filter by `organization_id`

```javascript
// ✅ CORRECT: Multi-tenant isolated query
async function loadDashboardData(organizationId, supabase) {
    // Get organization info
    const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

    // Get documents for this organization
    const { data: documents } = await supabase
        .from('documents')
        .select(`
            *,
            document_sections!inner (count)
        `)
        .eq('organization_id', organizationId)  // ✅ CRITICAL
        .eq('status', 'active');

    // Get suggestions via document relationship
    const { data: suggestions } = await supabase
        .from('suggestions')
        .select(`
            *,
            documents!inner (organization_id)
        `)
        .eq('documents.organization_id', organizationId)  // ✅ CRITICAL
        .eq('status', 'open');

    return {
        organization: org,
        documents,
        suggestions,
        statistics: calculateStatistics(documents, suggestions)
    };
}
```

**Security Verification**:
```javascript
// Helper function to verify organization access
async function verifyOrgAccess(userId, organizationId, supabase) {
    const { data } = await supabase
        .from('user_organizations')
        .select('role, permissions')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .single();

    if (!data) {
        throw new Error('Unauthorized access to organization');
    }

    return data;
}
```

### 3.3 Performance Optimization

#### Query Optimization
```sql
-- Create indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_documents_org_status
    ON documents(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_suggestions_doc_status
    ON suggestions(document_id, status);

CREATE INDEX IF NOT EXISTS idx_section_states_stage_status
    ON section_workflow_states(workflow_stage_id, status);

-- Materialized view for dashboard statistics
CREATE MATERIALIZED VIEW mv_org_dashboard_stats AS
SELECT
    d.organization_id,
    COUNT(DISTINCT d.id) as document_count,
    COUNT(DISTINCT ds.id) as section_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'open') as open_suggestions,
    COUNT(DISTINCT sws.id) FILTER (WHERE sws.status = 'pending') as pending_approvals
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN suggestions s ON d.id = s.document_id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
GROUP BY d.organization_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_org_dashboard_stats;
```

#### Caching Strategy
```javascript
// Use Redis or in-memory cache for dashboard data
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function getCachedDashboardData(organizationId, supabase) {
    const cacheKey = `dashboard:${organizationId}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const data = await loadDashboardData(organizationId, supabase);
    cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
}
```

---

## 4. SECURITY CONSIDERATIONS

### 4.1 RLS Security Model

**Reference**: `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/docs/ADR-001-RLS-SECURITY-MODEL.md`

#### Hybrid Security Approach:
1. **RLS Layer**: Fail-safe protection with simple policies
2. **Application Layer**: Primary enforcement via `organization_id` filtering
3. **Database Layer**: Foreign key constraints and triggers

**Critical Security Pattern**:
```javascript
// EVERY database query must include organization_id filter
const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', orgId);  // ⚠️ NEVER FORGET THIS
```

### 4.2 Session Management

**After Setup Completion**:
```javascript
// Store organization context in session
req.session.organizationId = createdOrgId;
req.session.isConfigured = true;

// Clear setup data to free memory
delete req.session.setupData;
```

**Dashboard Access Check**:
```javascript
// Middleware to require configuration
function requireSetup(req, res, next) {
    if (!req.session.isConfigured) {
        return res.redirect('/setup');
    }
    next();
}

// Middleware to load organization context
async function loadOrgContext(req, res, next) {
    const orgId = req.session.organizationId;
    if (!orgId) {
        return res.redirect('/setup');
    }

    const { data: org } = await req.supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

    if (!org) {
        return res.status(404).send('Organization not found');
    }

    req.organization = org;
    res.locals.organization = org;
    next();
}
```

### 4.3 Organization Isolation Checklist

**Code Review Requirements**:
- [ ] Every SELECT query includes `.eq('organization_id', ...)`
- [ ] Every INSERT sets `organization_id` field
- [ ] Every UPDATE/DELETE verifies org membership
- [ ] Helper functions used for repeated security checks
- [ ] Permissions validated before write operations
- [ ] No direct UUID exposure in URLs (use slugs)
- [ ] Audit trail for all sensitive operations

---

## 5. RECOMMENDED DASHBOARD COMPONENTS & LIBRARIES

### 5.1 Frontend Libraries

#### CSS Framework
**Bootstrap 5** (already in use)
- Responsive grid system
- Pre-built components (cards, tables, modals)
- Utility classes for rapid development
- Icon library: Bootstrap Icons

#### Charting & Visualization
**Chart.js**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```
- Simple line/bar/pie charts for statistics
- Responsive and customizable
- Lightweight (11KB gzipped)

#### Date Formatting
**Day.js**
```html
<script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/plugin/relativeTime.js"></script>
```
- "2 hours ago" formatting
- Lightweight alternative to Moment.js

#### Real-Time Updates (Optional)
**Socket.IO** or **Supabase Realtime**
```javascript
// Supabase Realtime example
const subscription = supabase
    .channel('dashboard-updates')
    .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suggestions' },
        (payload) => {
            updateDashboardUI(payload);
        }
    )
    .subscribe();
```

### 5.2 UI Component Recommendations

#### Document Card Component
```ejs
<div class="document-card" data-document-id="<%= doc.id %>">
    <div class="card-header">
        <h5><%= doc.title %></h5>
        <span class="badge bg-<%= doc.status_color %>">
            <%= doc.status %>
        </span>
    </div>
    <div class="card-body">
        <div class="card-stats">
            <div class="stat">
                <i class="bi bi-file-earmark-text"></i>
                <span><%= doc.sections_count %> sections</span>
            </div>
            <div class="stat">
                <i class="bi bi-lightbulb"></i>
                <span><%= doc.suggestions_count %> suggestions</span>
            </div>
            <div class="stat">
                <i class="bi bi-clock-history"></i>
                <span><%= formatDate(doc.updated_at) %></span>
            </div>
        </div>
        <p class="card-description"><%= doc.description %></p>
    </div>
    <div class="card-footer">
        <a href="/documents/<%= doc.id %>" class="btn btn-primary">
            View Document
        </a>
        <a href="/documents/<%= doc.id %>/edit" class="btn btn-outline-secondary">
            Edit
        </a>
    </div>
</div>
```

#### Approval Badge Component
```ejs
<span class="approval-badge <%= workflowStatus %>">
    <% if (workflowStatus === 'completed') { %>
        <i class="bi bi-check-circle-fill"></i> Approved
    <% } else if (workflowStatus === 'pending') { %>
        <i class="bi bi-hourglass-split"></i> Pending
    <% } else if (workflowStatus === 'rejected') { %>
        <i class="bi bi-x-circle-fill"></i> Rejected
    <% } %>
</span>
```

---

## 6. IMPLEMENTATION ROADMAP

### Phase 1: Basic Dashboard (MVP)
**Estimated Time**: 1-2 days

#### Tasks:
1. Create `/views/dashboard.ejs` template
2. Add route handler `GET /dashboard` in server.js
3. Implement `loadDashboardData()` function
4. Display:
   - Organization info
   - Document list (table view)
   - Basic statistics (card layout)
   - Quick action buttons
5. Update setup success page to redirect correctly
6. Test multi-tenant isolation

#### Acceptance Criteria:
- [ ] Setup wizard redirects to functional dashboard
- [ ] Dashboard displays organization-specific data only
- [ ] Document list loads correctly
- [ ] Statistics show accurate counts
- [ ] Navigation to document view works
- [ ] Mobile responsive

### Phase 2: Enhanced Features
**Estimated Time**: 2-3 days

#### Tasks:
1. Add sidebar navigation
2. Implement activity feed
3. Add workflow progress visualizations
4. Create approval queue view
5. Add search and filtering
6. Implement pagination
7. Add real-time updates (Supabase Realtime)

#### Acceptance Criteria:
- [ ] Sidebar navigation with collapsible menu
- [ ] Activity feed shows recent actions
- [ ] Workflow status visible per section
- [ ] Approval queue filterable by stage
- [ ] Search works across documents and sections
- [ ] Real-time updates notify users of changes

### Phase 3: Advanced Analytics
**Estimated Time**: 2-3 days

#### Tasks:
1. Add Chart.js for visualizations
2. Create reports page
3. Implement export functionality
4. Add user management interface
5. Create workflow editor
6. Add organization settings page

#### Acceptance Criteria:
- [ ] Charts show trends over time
- [ ] Reports exportable as PDF/JSON
- [ ] User roles manageable via UI
- [ ] Workflow stages editable
- [ ] Organization settings persist correctly

---

## 7. RECOMMENDED FILE STRUCTURE

```
/views/
├── dashboard/
│   ├── index.ejs              # Main dashboard view
│   ├── components/
│   │   ├── stat-card.ejs
│   │   ├── document-card.ejs
│   │   ├── activity-feed.ejs
│   │   ├── quick-actions.ejs
│   │   └── workflow-progress.ejs
│   └── layout.ejs             # Dashboard layout with sidebar
│
├── documents/
│   ├── list.ejs               # Document list page
│   ├── view.ejs               # Document viewing (existing: bylaws-improved.ejs)
│   └── edit.ejs               # Document editing
│
├── approvals/
│   ├── queue.ejs              # Approval queue
│   └── workflow-status.ejs    # Workflow status page
│
└── settings/
    ├── organization.ejs
    ├── workflows.ejs
    └── users.ejs

/src/routes/
├── dashboard.js               # Dashboard routes
├── documents.js               # Document CRUD routes
├── approvals.js               # Approval workflow routes
└── settings.js                # Settings routes

/public/
├── css/
│   ├── dashboard.css
│   └── components.css
└── js/
    ├── dashboard.js
    ├── charts.js
    └── realtime.js
```

---

## 8. WIREFRAME SUGGESTIONS

### Dashboard Landing Page
```
┌───────────────────────────────────────────────────────────────┐
│ [Logo] Bylaws Amendment Tracker    [Org: Reseda NC ▼] [User]│
├─────────┬─────────────────────────────────────────────────────┤
│ 📊 Dash │  OVERVIEW                                           │
│ 📄 Docs │  ┌─────────┬─────────┬─────────┬─────────┐         │
│ 💡 Sugg │  │  📄 3   │ 💡 12  │ ⏳ 5   │ ✅ 8   │         │
│ ✅ Appro│  │ Active  │  Open   │Pending │Approved│         │
│ 📊 Repo │  │  Docs   │  Sugges │Approvals│This Wk │         │
│ ⚙️ Sett │  └─────────┴─────────┴─────────┴─────────┘         │
│         │                                                     │
│         │  RECENT ACTIVITY                                   │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ 💡 John D. submitted suggestion             │  │
│         │  │    Article III, Section 2 • 2 hours ago     │  │
│         │  ├─────────────────────────────────────────────┤  │
│         │  │ ✅ Jane S. approved amendment               │  │
│         │  │    Article V, Section 1 • 3 hours ago       │  │
│         │  └─────────────────────────────────────────────┘  │
│         │                                                     │
│         │  YOUR DOCUMENTS                                    │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ 📄 Bylaws 2024       Active   42 sec  [View]│  │
│         │  │ 📄 Standing Rules     Active   18 sec  [View]│  │
│         │  └─────────────────────────────────────────────┘  │
└─────────┴─────────────────────────────────────────────────────┘
```

### Approval Queue Page
```
┌───────────────────────────────────────────────────────────────┐
│ [Logo] Bylaws Amendment Tracker                        [User]│
├─────────┬─────────────────────────────────────────────────────┤
│ 📊 Dash │  PENDING APPROVALS (5)                             │
│ 📄 Docs │  [All Stages ▼] [Search...            ] [Filter]   │
│ 💡 Sugg │                                                     │
│ ✅ Appro│  ┌─────────────────────────────────────────────┐  │
│ 📊 Repo │  │ Article III, Section 2                      │  │
│ ⚙️ Sett │  │ Committee Review ✅ → Board Approval ⏳     │  │
│         │  │ Old: "Officers shall be elected..."         │  │
│         │  │ New: "Officers shall be appointed..."       │  │
│         │  │ [Approve] [Reject] [Comment]                │  │
│         │  ├─────────────────────────────────────────────┤  │
│         │  │ Article V, Section 1                        │  │
│         │  │ Committee Review ⏳                          │  │
│         │  │ Old: "Quorum is 10 members"                 │  │
│         │  │ New: "Quorum is 15 members"                 │  │
│         │  │ [Approve] [Reject] [Comment]                │  │
│         │  └─────────────────────────────────────────────┘  │
└─────────┴─────────────────────────────────────────────────────┘
```

---

## 9. SECURITY CHECKLIST

### Pre-Launch Security Audit:
- [ ] All queries filter by `organization_id`
- [ ] Session handling secure (httpOnly cookies, HTTPS in prod)
- [ ] CSRF protection enabled on all forms
- [ ] XSS protection (escape all user input)
- [ ] SQL injection prevented (use parameterized queries)
- [ ] Rate limiting on API endpoints
- [ ] Audit logging for sensitive operations
- [ ] Error messages don't leak sensitive info
- [ ] File uploads validated and sanitized
- [ ] No hardcoded credentials or secrets
- [ ] RLS policies tested with multiple orgs
- [ ] Cross-org access attempt tests pass

### Compliance Requirements:
- Data isolation per organization
- Audit trail in `section_workflow_states`
- User activity logging
- GDPR-compliant data export
- Right to be forgotten (soft deletes)

---

## 10. TESTING STRATEGY

### Unit Tests
```javascript
describe('Dashboard Data Loading', () => {
    it('should load only org-specific documents', async () => {
        const data = await loadDashboardData(orgA_id, supabase);
        expect(data.documents).toHaveLength(3);
        expect(data.documents[0].organization_id).toBe(orgA_id);
    });

    it('should not leak data from other orgs', async () => {
        const dataA = await loadDashboardData(orgA_id, supabase);
        const dataB = await loadDashboardData(orgB_id, supabase);

        const docIdsA = dataA.documents.map(d => d.id);
        const docIdsB = dataB.documents.map(d => d.id);

        expect(docIdsA).not.toContainAnyOf(docIdsB);
    });
});
```

### Integration Tests
```javascript
describe('Setup to Dashboard Flow', () => {
    it('should redirect to dashboard after setup', async () => {
        const response = await request(app)
            .post('/setup/clear-session')
            .expect(200);

        expect(response.body.success).toBe(true);

        const dashboardResponse = await request(app)
            .get('/dashboard')
            .expect(200);

        expect(dashboardResponse.text).toContain('Dashboard');
    });
});
```

### Performance Tests
```javascript
describe('Dashboard Performance', () => {
    it('should load dashboard in < 500ms', async () => {
        const start = Date.now();
        await loadDashboardData(orgId, supabase);
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(500);
    });
});
```

---

## 11. DEPLOYMENT CONSIDERATIONS

### Environment Variables
```bash
# Required for dashboard
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_SECRET=random-secret-here
APP_URL=https://yourdomain.com

# Optional for features
ENABLE_REALTIME=true
REDIS_URL=redis://localhost:6379  # For caching
```

### Database Migrations
```bash
# Run before deployment
psql -U postgres -d bylaws_tracker < database/migrations/001_generalized_schema.sql
psql -U postgres -d bylaws_tracker < database/migrations/005_implement_proper_rls_FIXED.sql

# Create dashboard-specific indexes
CREATE INDEX idx_dashboard_stats ON mv_org_dashboard_stats(organization_id);
```

### Monitoring & Alerts
- Log all dashboard page loads
- Alert on slow queries (> 1 second)
- Track error rates (target < 0.1%)
- Monitor cache hit rates
- Alert on cross-org access attempts

---

## 12. CONCLUSION & NEXT STEPS

### Summary
The dashboard implementation requires:
1. **New route**: `GET /dashboard` with organization context
2. **Data loading**: Multi-tenant queries with proper filtering
3. **UI components**: Cards, tables, charts, navigation
4. **Security**: Always filter by `organization_id`
5. **Performance**: Caching and optimized queries

### Immediate Next Steps (For Coder Agent)
1. Create `/views/dashboard/index.ejs` with basic layout
2. Add dashboard route in `server.js` or `/src/routes/dashboard.js`
3. Implement `loadDashboardData()` helper function
4. Update setup success redirect to use new dashboard
5. Test with multiple organizations for isolation

### Future Enhancements
- Real-time collaborative editing
- Mobile app (React Native + Supabase)
- AI-powered suggestion analysis
- Advanced analytics dashboard
- API for third-party integrations
- Webhook system for notifications

---

## APPENDICES

### A. Useful SQL Queries

#### Get Dashboard Statistics
```sql
SELECT
    COUNT(DISTINCT d.id) as document_count,
    COUNT(DISTINCT ds.id) as section_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'open') as open_suggestions,
    COUNT(DISTINCT sws.id) FILTER (WHERE sws.status = 'pending') as pending_approvals
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN suggestions s ON d.id = s.document_id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
WHERE d.organization_id = $1;
```

#### Get Recent Activity
```sql
SELECT
    'suggestion' as activity_type,
    s.id,
    s.author_name as actor,
    s.created_at as timestamp,
    ds.section_number as location,
    s.status
FROM suggestions s
JOIN suggestion_sections ss ON s.id = ss.suggestion_id
JOIN document_sections ds ON ss.section_id = ds.id
JOIN documents d ON ds.document_id = d.id
WHERE d.organization_id = $1
UNION ALL
SELECT
    'approval' as activity_type,
    sws.id,
    sws.actioned_by_email as actor,
    sws.actioned_at as timestamp,
    ds.section_number as location,
    sws.status
FROM section_workflow_states sws
JOIN document_sections ds ON sws.section_id = ds.id
JOIN documents d ON ds.document_id = d.id
WHERE d.organization_id = $1
ORDER BY timestamp DESC
LIMIT 20;
```

### B. Related Documentation
- ADR-001: RLS Security Model
- SECURITY_CHECKLIST.md
- TESTING_MULTI_TENANT.md
- Setup wizard implementation guide

### C. Contact & Support
- Research Agent: dashboard-researcher
- Swarm Coordination: `npx claude-flow@alpha hooks`
- Documentation: `/docs/` directory

---

**END OF RESEARCH FINDINGS**

*This document should be used by the Coder, Tester, and Reviewer agents to implement the multi-tenant dashboard with proper security and performance considerations.*
