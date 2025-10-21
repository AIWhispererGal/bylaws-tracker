# Database Workflow Schema Documentation

**Migration:** 012_workflow_enhancements.sql
**Date:** 2025-10-14
**Author:** Database Architect Agent

## Overview

This document describes the enhanced workflow database schema, including helper functions, performance indexes, audit logging, and best practices for working with the workflow system.

---

## Table of Contents

1. [Database Tables](#database-tables)
2. [Helper Functions](#helper-functions)
3. [Performance Indexes](#performance-indexes)
4. [Audit Logging](#audit-logging)
5. [Materialized Views](#materialized-views)
6. [Usage Examples](#usage-examples)
7. [Performance Considerations](#performance-considerations)
8. [Security & RLS Policies](#security--rls-policies)

---

## Database Tables

### Core Workflow Tables

#### `workflow_templates`
Defines approval workflows for organizations.

```sql
- id (uuid) - Primary key
- organization_id (uuid) - Organization this template belongs to
- name (text) - Template name (e.g., "Standard Approval Process")
- description (text) - Description of the workflow
- is_default (boolean) - Whether this is the default template
- is_active (boolean) - Whether template is currently active
- created_at, updated_at (timestamp)
```

**Key Features:**
- Each organization can have multiple templates
- Only one template can be marked as default per organization
- Templates can be deactivated without deletion

#### `workflow_stages`
Defines individual stages within a workflow.

```sql
- id (uuid) - Primary key
- workflow_template_id (uuid) - Parent template
- stage_name (text) - Stage name (e.g., "Committee Review")
- stage_order (integer) - Order in workflow (1, 2, 3...)
- can_lock (boolean) - Can lock sections at this stage
- can_edit (boolean) - Can edit text at this stage
- can_approve (boolean) - Can approve/reject at this stage
- requires_approval (boolean) - Must be approved to proceed
- required_roles (jsonb) - Roles that can approve (e.g., ["admin", "owner"])
- display_color (text) - UI color code (e.g., "#FFA500")
- icon (text) - UI icon name
- description (text) - Stage description
```

**Key Features:**
- Stages are ordered sequentially
- Permissions are granular (lock, edit, approve)
- Role-based access control via `required_roles`
- Visual customization for UI

#### `document_workflows`
Links documents to workflow templates and tracks overall progress.

```sql
- id (uuid) - Primary key
- document_id (uuid) - Document being processed
- workflow_template_id (uuid) - Template being used
- current_stage_id (uuid) - Current stage in workflow
- started_at (timestamp) - When workflow started
- completed_at (timestamp) - When workflow completed
- status (text) - 'in_progress', 'completed', 'paused'
```

**Key Features:**
- Tracks document-level workflow state
- Links to current stage for quick lookup
- Timestamps for workflow lifecycle

#### `section_workflow_states`
Tracks workflow state for each document section.

```sql
- id (uuid) - Primary key
- section_id (uuid) - Section being tracked
- workflow_stage_id (uuid) - Current stage
- status (text) - 'pending', 'approved', 'rejected', 'completed'
- approved_by (uuid) - User who approved
- approved_at (timestamp) - When approved
- approval_metadata (jsonb) - Additional data (notes, etc.)
- created_at, updated_at (timestamp)
```

**Key Features:**
- One row per section per stage
- History is preserved (multiple rows per section over time)
- Metadata stores approval notes and context

#### `document_versions`
Snapshots of document state at approval milestones.

```sql
- id (uuid) - Primary key
- document_id (uuid) - Document being versioned
- version_number (text) - Version identifier (e.g., "1.0", "2.0")
- version_name (text) - Human-readable name
- description (text) - Version description
- sections_snapshot (jsonb) - Complete section data
- approval_snapshot (jsonb) - Workflow states at version time
- created_by (uuid) - User who created version
- approved_by (uuid) - User who approved version
- created_at, approved_at, published_at (timestamp)
- is_current, is_published (boolean)
- metadata (jsonb)
```

**Key Features:**
- Immutable version history
- Full document snapshots in JSONB
- Tracks approval lineage

#### `workflow_audit_log`
Complete audit trail of all workflow actions.

```sql
- id (uuid) - Primary key
- section_id (uuid) - Section affected
- document_id (uuid) - Document affected
- user_id (uuid) - User who performed action
- organization_id (uuid) - Organization context
- action (text) - Action type ('approve', 'reject', 'reset', etc.)
- previous_status (text) - Status before action
- new_status (text) - Status after action
- stage_id (uuid) - Stage where action occurred
- stage_name (text) - Stage name (denormalized)
- notes (text) - Action notes
- metadata (jsonb) - Additional context
- ip_address (varchar) - Request IP
- user_agent (text) - Request user agent
- created_at (timestamp)
```

**Key Features:**
- Automatic logging via trigger
- Compliance and audit trail
- IP and user agent tracking
- Denormalized stage name for historical accuracy

---

## Helper Functions

### Permission Checking

#### `is_global_admin(user_id UUID) → BOOLEAN`
Check if user has global admin privileges.

```sql
SELECT is_global_admin('user-uuid-here');
-- Returns: true or false
```

**Use Case:** Bypass organization-level permissions for platform admins.

#### `user_can_approve_stage(user_id UUID, stage_id UUID) → BOOLEAN`
Check if user has permission to approve at a specific workflow stage.

```sql
SELECT user_can_approve_stage(
    'user-uuid',
    'stage-uuid'
);
-- Returns: true if user has required role or is global admin
```

**Use Case:** Validate permissions before showing approve button.

**Implementation:**
- Checks if user is global admin (always returns true)
- Gets required roles from stage configuration
- Checks if user has matching role in organization
- Returns true only if user has permission

### Workflow State Queries

#### `get_section_workflow_stage(section_id UUID) → TABLE`
Get current workflow stage and state for a section.

```sql
SELECT * FROM get_section_workflow_stage('section-uuid');
```

**Returns:**
```sql
stage_id       | uuid
stage_name     | text (e.g., "Committee Review")
stage_order    | int (e.g., 1)
can_lock       | boolean
can_approve    | boolean
status         | text (e.g., "pending")
approved_by    | uuid (nullable)
approved_at    | timestamptz (nullable)
```

**Use Case:** Display current workflow status in UI.

#### `get_section_workflow_history(section_id UUID) → TABLE`
Get complete workflow history for a section.

```sql
SELECT * FROM get_section_workflow_history('section-uuid');
```

**Returns:**
```sql
stage_name         | text
stage_order        | int
status             | text
approved_by_email  | text
approved_by_name   | text
approved_at        | timestamptz
notes              | text
created_at         | timestamptz
```

**Use Case:** Show timeline of approvals in UI.

### Progress Calculation

#### `calculate_document_progress(document_id UUID) → TABLE`
Calculate workflow progress statistics for a document.

```sql
SELECT * FROM calculate_document_progress('document-uuid');
```

**Returns:**
```sql
total_sections       | int
approved_sections    | int
pending_sections     | int
rejected_sections    | int
progress_percentage  | decimal (0-100)
```

**Use Case:** Display progress bar on document dashboard.

### Workflow Actions

#### `advance_section_to_next_stage(section_id UUID, approved_by UUID, notes TEXT) → UUID`
Advance a section to the next workflow stage.

```sql
SELECT advance_section_to_next_stage(
    'section-uuid',
    'user-uuid',
    'Looks good, advancing to board approval'
);
-- Returns: UUID of new workflow state, or NULL if completed
```

**Behavior:**
1. Marks current stage as 'approved'
2. Records approver and timestamp
3. Stores notes in metadata
4. Creates new state for next stage
5. Returns NULL if no next stage (workflow complete)

**Use Case:** "Approve & Advance" button action.

#### `get_user_pending_approvals(user_id UUID, organization_id UUID) → TABLE`
Get all sections pending approval that user can approve.

```sql
SELECT * FROM get_user_pending_approvals('user-uuid', 'org-uuid');
-- organization_id is optional (NULL = all organizations)
```

**Returns:**
```sql
section_id        | uuid
section_number    | text
section_title     | text
document_id       | uuid
document_title    | text
stage_name        | text
stage_order       | int
pending_since     | timestamptz
organization_id   | uuid
```

**Use Case:** "Pending Approvals" dashboard widget.

### Bulk Operations

#### `bulk_approve_document_sections(document_id UUID, approved_by UUID, notes TEXT) → INT`
Approve all pending sections in a document that user has permission to approve.

```sql
SELECT bulk_approve_document_sections(
    'document-uuid',
    'user-uuid',
    'Bulk approval of all sections'
);
-- Returns: Count of sections approved
```

**Use Case:** "Approve All" button for batch processing.

**Safety:**
- Only approves sections where user has permission
- Only affects sections in 'pending' status
- All approvals logged to audit trail

#### `reset_section_workflow(section_id UUID, reset_by UUID, reason TEXT) → UUID`
Reset workflow state for a section back to first stage.

```sql
SELECT reset_section_workflow(
    'section-uuid',
    'user-uuid',
    'Resetting due to content changes'
);
-- Returns: UUID of new workflow state
```

**Use Case:** Reprocess sections after major edits.

**Behavior:**
1. Logs reset action to audit trail
2. Deletes all existing workflow states
3. Creates new state at first stage
4. Preserves reset reason in metadata

### View Refresh

#### `refresh_workflow_progress() → void`
Refresh the materialized view for workflow progress.

```sql
SELECT refresh_workflow_progress();
```

**When to Call:**
- After batch workflow operations
- After document upload
- Scheduled nightly refresh
- On-demand for real-time dashboards

**Performance:** Uses `CONCURRENTLY` to avoid locking.

---

## Performance Indexes

### Section Workflow States

```sql
-- Fast lookup by section
idx_section_workflow_states_section_id ON (section_id)

-- Fast lookup by stage
idx_section_workflow_states_stage_id ON (workflow_stage_id)

-- Filter by status
idx_section_workflow_states_status ON (status)

-- Recent states first
idx_section_workflow_states_created ON (created_at DESC)

-- Most recent state per section (composite)
idx_section_workflow_states_section_created ON (section_id, created_at DESC)

-- Pending approvals (partial index)
idx_pending_approvals_lookup ON (workflow_stage_id, status) WHERE status = 'pending'
```

### Workflow Stages

```sql
-- Stages by template and order
idx_workflow_stages_template_order ON (workflow_template_id, stage_order)

-- Stages by template
idx_workflow_stages_template_id ON (workflow_template_id)
```

### Document Workflows

```sql
-- Workflows by document
idx_document_workflows_document_id ON (document_id)

-- Workflows by template
idx_document_workflows_template_id ON (workflow_template_id)

-- Workflows by status
idx_document_workflows_status ON (status)
```

### Workflow Templates

```sql
-- Default template per org (partial index)
idx_workflow_templates_org_default ON (organization_id, is_default)
  WHERE is_default = TRUE AND is_active = TRUE
```

### Audit Log

```sql
-- Audit by section
idx_workflow_audit_section ON (section_id, created_at DESC)

-- Audit by document
idx_workflow_audit_document ON (document_id, created_at DESC)

-- Audit by user
idx_workflow_audit_user ON (user_id, created_at DESC)

-- Audit by organization
idx_workflow_audit_org ON (organization_id, created_at DESC)

-- Audit by action type
idx_workflow_audit_action ON (action, created_at DESC)

-- Recent audit entries
idx_workflow_audit_created ON (created_at DESC)
```

### Index Usage Guidelines

**When to Use Specific Indexes:**

1. **Section Lookup:** `idx_section_workflow_states_section_id`
   - Query: Get workflow state for a section
   - Pattern: `WHERE section_id = ?`

2. **Pending Approvals:** `idx_pending_approvals_lookup`
   - Query: Find sections pending approval at stage
   - Pattern: `WHERE workflow_stage_id = ? AND status = 'pending'`

3. **Recent History:** `idx_section_workflow_states_section_created`
   - Query: Get latest state per section
   - Pattern: `WHERE section_id = ? ORDER BY created_at DESC LIMIT 1`

4. **Audit Trail:** `idx_workflow_audit_section`
   - Query: Section approval history
   - Pattern: `WHERE section_id = ? ORDER BY created_at DESC`

---

## Audit Logging

### Automatic Logging

All workflow state changes are automatically logged via trigger:

```sql
CREATE TRIGGER workflow_action_audit_trigger
    AFTER INSERT OR UPDATE ON section_workflow_states
    FOR EACH ROW
    EXECUTE FUNCTION log_workflow_action();
```

### Logged Actions

- `initialize` - Section enters workflow
- `approve` - Section approved at stage
- `reject` - Section rejected
- `complete` - Section completes workflow
- `reset` - Workflow reset to first stage
- `update` - Other state changes

### Query Audit Trail

**Get all approvals for a document:**
```sql
SELECT
    stage_name,
    section_number,
    action,
    u.email AS approved_by,
    created_at
FROM workflow_audit_log wal
JOIN document_sections ds ON wal.section_id = ds.id
JOIN users u ON wal.user_id = u.id
WHERE wal.document_id = 'document-uuid'
    AND action IN ('approve', 'reject')
ORDER BY created_at DESC;
```

**Get user's approval activity:**
```sql
SELECT
    action,
    COUNT(*) AS action_count,
    MIN(created_at) AS first_action,
    MAX(created_at) AS last_action
FROM workflow_audit_log
WHERE user_id = 'user-uuid'
    AND organization_id = 'org-uuid'
GROUP BY action
ORDER BY action_count DESC;
```

**Find sections approved by multiple users:**
```sql
SELECT
    section_id,
    COUNT(DISTINCT user_id) AS approver_count,
    array_agg(DISTINCT u.email) AS approvers
FROM workflow_audit_log wal
JOIN users u ON wal.user_id = u.id
WHERE action = 'approve'
GROUP BY section_id
HAVING COUNT(DISTINCT user_id) > 1;
```

---

## Materialized Views

### `mv_document_workflow_progress`

Pre-calculated workflow progress for fast dashboard queries.

**Columns:**
```sql
document_id              | uuid
organization_id          | uuid
document_title           | text
total_sections           | int
approved_sections        | int
pending_sections         | int
rejected_sections        | int
completed_sections       | int
progress_percentage      | decimal (0-100)
last_updated             | timestamptz
workflow_template_id     | uuid
workflow_name            | text
current_stage_id         | uuid
current_stage_name       | text
```

**Usage:**
```sql
-- Fast dashboard query
SELECT
    document_title,
    progress_percentage,
    pending_sections,
    current_stage_name
FROM mv_document_workflow_progress
WHERE organization_id = 'org-uuid'
ORDER BY progress_percentage DESC;
```

**Refresh Strategy:**

1. **Manual Refresh:**
   ```sql
   SELECT refresh_workflow_progress();
   ```

2. **Scheduled Refresh (Recommended):**
   ```sql
   -- Add to cron job or scheduled task
   SELECT refresh_workflow_progress();
   -- Run nightly at 2 AM
   ```

3. **Event-Driven Refresh:**
   ```sql
   -- After bulk operations
   SELECT bulk_approve_document_sections(...);
   SELECT refresh_workflow_progress();
   ```

**Performance:**
- Uses `CONCURRENTLY` to avoid table locks
- Indexed for fast lookups
- Updated incrementally (only changed rows)

---

## Usage Examples

### Example 1: Display Section Workflow Status

```javascript
// Backend API endpoint
app.get('/api/sections/:sectionId/workflow', async (req, res) => {
    const { sectionId } = req.params;

    const result = await db.query(`
        SELECT * FROM get_section_workflow_stage($1)
    `, [sectionId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Section not found' });
    }

    res.json(result.rows[0]);
});
```

**Frontend Display:**
```javascript
// Fetch and display workflow status
const workflow = await fetch(`/api/sections/${sectionId}/workflow`)
    .then(r => r.json());

document.getElementById('workflow-status').innerHTML = `
    <div class="workflow-badge" style="background-color: ${workflow.stage_color}">
        ${workflow.stage_name} - ${workflow.status}
    </div>
    ${workflow.approved_by ? `
        <div class="approval-info">
            Approved by ${workflow.approved_by} on ${workflow.approved_at}
        </div>
    ` : ''}
`;
```

### Example 2: Approve Section and Advance

```javascript
// Backend API endpoint
app.post('/api/sections/:sectionId/approve', async (req, res) => {
    const { sectionId } = req.params;
    const { userId, notes } = req.body;

    // Check permission
    const canApprove = await db.query(`
        SELECT user_can_approve_stage($1, (
            SELECT workflow_stage_id
            FROM section_workflow_states
            WHERE section_id = $2
            ORDER BY created_at DESC
            LIMIT 1
        ))
    `, [userId, sectionId]);

    if (!canApprove.rows[0].user_can_approve_stage) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    // Approve and advance
    const result = await db.query(`
        SELECT advance_section_to_next_stage($1, $2, $3)
    `, [sectionId, userId, notes]);

    // Refresh progress view
    await db.query('SELECT refresh_workflow_progress()');

    res.json({
        success: true,
        newStateId: result.rows[0].advance_section_to_next_stage,
        completed: result.rows[0].advance_section_to_next_stage === null
    });
});
```

### Example 3: Pending Approvals Dashboard

```javascript
// Backend API endpoint
app.get('/api/users/:userId/pending-approvals', async (req, res) => {
    const { userId } = req.params;
    const { organizationId } = req.query;

    const result = await db.query(`
        SELECT * FROM get_user_pending_approvals($1, $2)
        ORDER BY pending_since ASC
        LIMIT 50
    `, [userId, organizationId || null]);

    res.json(result.rows);
});
```

**Frontend Display:**
```javascript
// Render pending approvals
const approvals = await fetch(`/api/users/${userId}/pending-approvals`)
    .then(r => r.json());

const list = approvals.map(approval => `
    <div class="approval-item">
        <h4>${approval.document_title}</h4>
        <p>Section ${approval.section_number}: ${approval.section_title}</p>
        <span class="badge">${approval.stage_name}</span>
        <span class="time">Pending for ${timeSince(approval.pending_since)}</span>
        <button onclick="approveSection('${approval.section_id}')">
            Approve
        </button>
    </div>
`).join('');

document.getElementById('pending-list').innerHTML = list;
```

### Example 4: Document Progress Bar

```javascript
// Backend API endpoint
app.get('/api/documents/:documentId/progress', async (req, res) => {
    const { documentId } = req.params;

    // Use materialized view for fast lookup
    const result = await db.query(`
        SELECT * FROM mv_document_workflow_progress
        WHERE document_id = $1
    `, [documentId]);

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
});
```

**Frontend Display:**
```javascript
// Render progress bar
const progress = await fetch(`/api/documents/${documentId}/progress`)
    .then(r => r.json());

document.getElementById('progress-bar').innerHTML = `
    <div class="progress-container">
        <div class="progress-bar" style="width: ${progress.progress_percentage}%">
            ${progress.progress_percentage.toFixed(1)}%
        </div>
    </div>
    <div class="progress-stats">
        <span>✓ ${progress.approved_sections} Approved</span>
        <span>⏳ ${progress.pending_sections} Pending</span>
        <span>✗ ${progress.rejected_sections} Rejected</span>
    </div>
`;
```

### Example 5: Bulk Approve Document

```javascript
// Backend API endpoint
app.post('/api/documents/:documentId/bulk-approve', async (req, res) => {
    const { documentId } = req.params;
    const { userId, notes } = req.body;

    // Approve all sections user has permission for
    const result = await db.query(`
        SELECT bulk_approve_document_sections($1, $2, $3)
    `, [documentId, userId, notes]);

    const approvedCount = result.rows[0].bulk_approve_document_sections;

    // Refresh progress view
    await db.query('SELECT refresh_workflow_progress()');

    res.json({
        success: true,
        approvedCount: approvedCount
    });
});
```

### Example 6: Workflow History Timeline

```javascript
// Backend API endpoint
app.get('/api/sections/:sectionId/history', async (req, res) => {
    const { sectionId } = req.params;

    const result = await db.query(`
        SELECT * FROM get_section_workflow_history($1)
    `, [sectionId]);

    res.json(result.rows);
});
```

**Frontend Display:**
```javascript
// Render timeline
const history = await fetch(`/api/sections/${sectionId}/history`)
    .then(r => r.json());

const timeline = history.map((entry, index) => `
    <div class="timeline-item ${entry.status}">
        <div class="timeline-marker">${index + 1}</div>
        <div class="timeline-content">
            <h5>${entry.stage_name}</h5>
            <p class="status-badge">${entry.status}</p>
            ${entry.approved_by_name ? `
                <p>By ${entry.approved_by_name}</p>
                <p>${new Date(entry.approved_at).toLocaleString()}</p>
            ` : `
                <p>Pending since ${new Date(entry.created_at).toLocaleString()}</p>
            `}
            ${entry.notes ? `<p class="notes">${entry.notes}</p>` : ''}
        </div>
    </div>
`).join('');

document.getElementById('timeline').innerHTML = timeline;
```

---

## Performance Considerations

### Query Optimization

**1. Use Materialized View for Dashboards:**
```sql
-- ✅ GOOD: Fast query using materialized view
SELECT * FROM mv_document_workflow_progress
WHERE organization_id = 'org-uuid';

-- ❌ BAD: Slow query with multiple joins
SELECT d.id, COUNT(ds.id), ...
FROM documents d
JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
GROUP BY d.id;
```

**2. Leverage Partial Indexes:**
```sql
-- ✅ GOOD: Uses partial index for pending approvals
SELECT * FROM section_workflow_states
WHERE workflow_stage_id = 'stage-uuid'
    AND status = 'pending';

-- ❌ BAD: Full table scan
SELECT * FROM section_workflow_states
WHERE section_id IN (SELECT id FROM document_sections);
```

**3. Use Helper Functions:**
```sql
-- ✅ GOOD: Single function call
SELECT * FROM get_section_workflow_stage('section-uuid');

-- ❌ BAD: Complex query with multiple joins
SELECT ws.*, sws.*
FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.section_id = 'section-uuid'
ORDER BY sws.created_at DESC
LIMIT 1;
```

### Caching Strategy

**1. Cache workflow templates per organization:**
```javascript
// Cache for 1 hour
const template = await cache.get(`workflow_template:${orgId}:default`, async () => {
    return db.query(`
        SELECT * FROM workflow_templates
        WHERE organization_id = $1 AND is_default = TRUE
    `, [orgId]);
}, 3600);
```

**2. Cache user permissions:**
```javascript
// Cache for 15 minutes
const canApprove = await cache.get(`user_permission:${userId}:${stageId}`, async () => {
    return db.query('SELECT user_can_approve_stage($1, $2)', [userId, stageId]);
}, 900);
```

**3. Invalidate cache on workflow changes:**
```javascript
// After approval action
await db.query('SELECT advance_section_to_next_stage($1, $2, $3)', [sectionId, userId, notes]);
await cache.delete(`section_workflow:${sectionId}`);
await cache.delete(`document_progress:${documentId}`);
```

### Refresh Strategy for Materialized View

**Option 1: Scheduled Refresh (Recommended)**
```bash
# Cron job: Every night at 2 AM
0 2 * * * psql -U user -d database -c "SELECT refresh_workflow_progress();"
```

**Option 2: Event-Driven Refresh**
```javascript
// After significant workflow changes
async function afterWorkflowUpdate() {
    // Update workflow state
    await db.query('SELECT advance_section_to_next_stage(...)');

    // Refresh materialized view
    await db.query('SELECT refresh_workflow_progress()');
}
```

**Option 3: Hybrid Approach**
```javascript
// Track if refresh needed
let needsRefresh = false;

// Set flag after workflow changes
async function afterWorkflowUpdate() {
    await db.query('SELECT advance_section_to_next_stage(...)');
    needsRefresh = true;
}

// Refresh periodically if needed
setInterval(async () => {
    if (needsRefresh) {
        await db.query('SELECT refresh_workflow_progress()');
        needsRefresh = false;
    }
}, 60000); // Every minute
```

---

## Security & RLS Policies

### Row-Level Security

All workflow tables have RLS policies based on organization membership.

**Users can only see workflow data for their organizations:**
```sql
-- Example RLS policy (already implemented)
CREATE POLICY "Users see workflow states in their organizations"
    ON section_workflow_states
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM document_sections ds
            JOIN documents d ON ds.document_id = d.id
            JOIN user_organizations uo ON d.organization_id = uo.organization_id
            WHERE ds.id = section_workflow_states.section_id
                AND uo.user_id = auth.uid()
                AND uo.is_active = TRUE
        )
    );
```

### Permission Validation

**Always validate permissions before workflow actions:**

```javascript
// ✅ GOOD: Validate permission first
const canApprove = await db.query(`
    SELECT user_can_approve_stage($1, $2)
`, [userId, stageId]);

if (!canApprove.rows[0].user_can_approve_stage) {
    return res.status(403).json({ error: 'Permission denied' });
}

// Proceed with approval
await db.query('SELECT advance_section_to_next_stage(...)');
```

```javascript
// ❌ BAD: No permission check
await db.query('SELECT advance_section_to_next_stage(...)');
// Relies only on RLS policies (not explicit enough)
```

### Global Admin Bypass

Global admins can approve at any stage:

```javascript
// Check if user is global admin
const isGlobalAdmin = await db.query(`
    SELECT is_global_admin($1)
`, [userId]);

if (isGlobalAdmin.rows[0].is_global_admin) {
    // Allow action regardless of required_roles
    await db.query('SELECT advance_section_to_next_stage(...)');
} else {
    // Check stage-specific permissions
    const canApprove = await db.query('SELECT user_can_approve_stage($1, $2)', [userId, stageId]);
    if (!canApprove.rows[0].user_can_approve_stage) {
        return res.status(403).json({ error: 'Permission denied' });
    }
}
```

### Audit Trail Security

**Audit log is read-only for users:**
```sql
-- Users can only view audit logs, not modify
CREATE POLICY "Users see audit logs in their organizations"
    ON workflow_audit_log
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id
            FROM user_organizations
            WHERE user_id = auth.uid()
            AND is_active = TRUE
        )
    );

-- Only service role can insert
CREATE POLICY "Service can insert audit logs"
    ON workflow_audit_log
    FOR INSERT
    WITH CHECK (TRUE);
```

---

## Best Practices

### 1. Always Use Helper Functions

```sql
-- ✅ GOOD
SELECT * FROM get_section_workflow_stage('section-uuid');

-- ❌ BAD
SELECT ws.*, sws.*
FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.section_id = 'section-uuid'
ORDER BY sws.created_at DESC
LIMIT 1;
```

### 2. Validate Permissions Explicitly

```javascript
// ✅ GOOD
if (!await userCanApproveStage(userId, stageId)) {
    return res.status(403).json({ error: 'Permission denied' });
}

// ❌ BAD
// Relying only on RLS to fail the query
```

### 3. Refresh Materialized View Strategically

```javascript
// ✅ GOOD: Refresh after batch operations
await bulkApproveDocumentSections(documentId, userId);
await refreshWorkflowProgress();

// ❌ BAD: Refresh on every single approval
await approveSingleSection(sectionId, userId);
await refreshWorkflowProgress(); // Too frequent!
```

### 4. Use Audit Log for Compliance

```sql
-- ✅ GOOD: Query audit log for compliance reports
SELECT
    action,
    u.email,
    created_at,
    notes
FROM workflow_audit_log wal
JOIN users u ON wal.user_id = u.id
WHERE document_id = 'document-uuid'
ORDER BY created_at;

-- ❌ BAD: Trying to reconstruct history from workflow states
-- (Missing deleted/reset states)
```

### 5. Handle Workflow Completion Gracefully

```javascript
// ✅ GOOD: Check for NULL return (workflow complete)
const newStateId = await advanceSectionToNextStage(sectionId, userId);
if (newStateId === null) {
    // Workflow is complete
    await markDocumentComplete(documentId);
}

// ❌ BAD: Assuming there's always a next stage
const newStateId = await advanceSectionToNextStage(sectionId, userId);
await notifyNextApprover(newStateId); // Fails if NULL!
```

---

## Troubleshooting

### Slow Queries

**Problem:** Queries are slow even with indexes.

**Solution:**
1. Check if indexes are being used:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM section_workflow_states WHERE section_id = 'uuid';
   ```

2. Refresh materialized view if stale:
   ```sql
   SELECT refresh_workflow_progress();
   ```

3. Check for missing indexes:
   ```sql
   SELECT schemaname, tablename, indexname, indexdef
   FROM pg_indexes
   WHERE tablename LIKE '%workflow%';
   ```

### Permission Denied Errors

**Problem:** Users can't approve even with correct role.

**Solution:**
1. Check user's role in organization:
   ```sql
   SELECT role, is_active
   FROM user_organizations
   WHERE user_id = 'user-uuid' AND organization_id = 'org-uuid';
   ```

2. Check stage's required roles:
   ```sql
   SELECT required_roles
   FROM workflow_stages
   WHERE id = 'stage-uuid';
   ```

3. Verify permission function:
   ```sql
   SELECT user_can_approve_stage('user-uuid', 'stage-uuid');
   ```

### Audit Log Not Recording

**Problem:** Workflow actions not appearing in audit log.

**Solution:**
1. Check trigger exists:
   ```sql
   SELECT * FROM pg_trigger
   WHERE tgname = 'workflow_action_audit_trigger';
   ```

2. Verify trigger is enabled:
   ```sql
   SELECT tgenabled FROM pg_trigger
   WHERE tgname = 'workflow_action_audit_trigger';
   -- Should return 'O' (origin) or 'A' (always)
   ```

3. Check for errors in log:
   ```sql
   SELECT * FROM pg_stat_user_tables WHERE relname = 'workflow_audit_log';
   ```

---

## Migration Guide

### Running the Migration

```bash
# Connect to database
psql -U postgres -d bylaws_tool

# Run migration
\i database/migrations/012_workflow_enhancements.sql

# Verify migration
SELECT * FROM pg_proc WHERE proname LIKE '%workflow%';
SELECT * FROM pg_indexes WHERE tablename LIKE '%workflow%';
```

### Rollback (if needed)

```sql
-- Drop functions
DROP FUNCTION IF EXISTS is_global_admin(UUID);
DROP FUNCTION IF EXISTS user_can_approve_stage(UUID, UUID);
DROP FUNCTION IF EXISTS get_section_workflow_stage(UUID);
DROP FUNCTION IF EXISTS calculate_document_progress(UUID);
DROP FUNCTION IF EXISTS advance_section_to_next_stage(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS get_user_pending_approvals(UUID, UUID);
DROP FUNCTION IF EXISTS get_section_workflow_history(UUID);
DROP FUNCTION IF EXISTS bulk_approve_document_sections(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS reset_section_workflow(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS refresh_workflow_progress();
DROP FUNCTION IF EXISTS log_workflow_action();

-- Drop trigger
DROP TRIGGER IF EXISTS workflow_action_audit_trigger ON section_workflow_states;

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_document_workflow_progress;

-- Drop views
DROP VIEW IF EXISTS v_pending_approvals;
DROP VIEW IF EXISTS v_organization_workflow_stats;

-- Drop audit log table
DROP TABLE IF EXISTS workflow_audit_log;

-- Drop indexes (if not automatically dropped with tables)
-- Note: Most indexes will cascade with table drops
```

---

## References

- **Migration 008:** `database/migrations/008_enhance_user_roles_and_approval.sql`
- **Migration 012:** `database/migrations/012_workflow_enhancements.sql`
- **Related Docs:**
  - `docs/NEXT_SESSION_TODO.md` - Workflow implementation plan
  - `docs/ROLE_MANAGEMENT_AND_APPROVAL_WORKFLOW.md` - Workflow design
  - `docs/AUTH_ARCHITECTURE.md` - Authentication context

---

**Last Updated:** 2025-10-14
**Maintainer:** Database Architect Agent
**Version:** 1.0
