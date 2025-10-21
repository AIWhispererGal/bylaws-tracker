# Organization Admin UX Audit Report

**Date**: October 14, 2025
**Persona**: Marcus - Legal Department Administrator
**Scope**: Complete user journey for organization-level administrators

---

## Executive Summary

This audit traces the complete experience for an organization-level administrator (org admin) who manages a single organization's team, documents, and approval workflows. The system shows strong foundations but has critical gaps in onboarding, bulk operations, and mobile experience.

**Overall UX Score**: 6.5/10

**Key Findings**:
- ✅ Clear role-based permissions system
- ✅ Comprehensive workflow management capabilities
- ⚠️ Confusing invitation/onboarding flow
- ⚠️ No bulk operations for common admin tasks
- ❌ Missing notification system entirely
- ❌ Poor mobile/responsive experience

---

## 1. INVITATION / ONBOARDING JOURNEY

### 1.1 How Org Admin Gets Invited

**Current Flow** (Based on code analysis):

```
SCENARIO 1: First User (Owner)
└─ Via Setup Wizard → Becomes organization owner automatically
   ├─ /setup routes handle organization creation
   └─ First user auto-assigned 'owner' role

SCENARIO 2: Invited Admin
└─ Existing admin invites via /users/invite
   ├─ POST /api/users/invite (requires admin role)
   ├─ Supabase sends invitation email
   └─ Email contains link to /auth/accept-invite
```

**Code Evidence** (`src/routes/users.js:211-384`):
```javascript
router.post('/invite', requireAdmin, async (req, res) => {
  // Validates email, checks user limits (max 10 default)
  // Calls supabase.auth.admin.inviteUserByEmail()
  // Creates user_organization record
})
```

**PAIN POINTS** 🔴:

1. **No visual feedback on invitation status**
   - Admin invites user but cannot see "invitation pending" anywhere
   - No way to resend invitations
   - No tracking of who invited whom

2. **User limit confusion**
   - Default 10 users per org, but this isn't shown during invitation
   - Error only appears when limit is reached (reactive, not proactive)

3. **Email dependency**
   - Entirely reliant on email delivery (no alternative invite methods)
   - No invitation link sharing option
   - Cannot set temporary passwords

### 1.2 Registration & Email Verification

**Current Flow** (`src/routes/auth.js:164-264`):

```
User clicks email invite link
└─ Lands on /auth/accept-invite (not implemented!)
   ├─ Should show: Set password + confirm email
   └─ ISSUE: This route doesn't exist in auth.js
```

**CRITICAL GAP** 🚨:
- `/auth/accept-invite` route referenced in code but **NOT IMPLEMENTED**
- Invited users likely get a broken link or generic login page

**Expected Flow**:
```
/auth/accept-invite?token=xyz
├─ Validate invitation token
├─ Show "Welcome to [Org Name]" screen
├─ Set password form
├─ Confirm email (or auto-verify from invite)
└─ Redirect to /auth/select → /dashboard
```

**RECOMMENDATION**: Implement this route immediately as P0 bug fix.

### 1.3 First Login Experience

**Current Flow**:
```
POST /auth/login
├─ Authenticate with Supabase
├─ Get user's organizations
├─ Set first org as default in session
└─ Redirect to /dashboard OR /auth/select
```

**PAIN POINTS** 🔴:

1. **No onboarding tour**
   - First-time admin lands on dashboard with no guidance
   - No "Getting Started" checklist
   - No interactive tutorial

2. **Unclear role/permissions**
   - User doesn't immediately see what they can do
   - No "You are an Admin for XYZ Corp" message
   - Permission boundaries not explained

**Good Elements** ✅:
- Session properly stores organizationId, role, isAdmin flags
- JWT refresh tokens implemented correctly

---

## 2. DASHBOARD EXPERIENCE

### 2.1 Initial Dashboard View

**What Org Admin Sees** (`views/dashboard/dashboard.ejs:415-453`):

```
┌─────────────────────────────────────────┐
│ Dashboard                    [Export] [+]│
├─────────────────────────────────────────┤
│  📄 Total Docs    ✓ Sections            │
│      -                -                 │
│                                         │
│  💡 Pending       📈 Progress           │
│      -                -%                │
└─────────────────────────────────────────┘
```

**Loading Issues** 🔴:
- Stats show "-" until AJAX loads (bad perceived performance)
- No skeleton loaders
- No graceful fallback if API fails

**JavaScript Behavior** (`public/js/dashboard.js:10-39`):
```javascript
async loadOverview() {
  const response = await fetch('/api/dashboard/overview');
  // Updates: totalDocuments, activeSections,
  //          pendingSuggestions, approvalProgress
}
```

**PAIN POINTS**:

1. **Information hierarchy unclear**
   - All 4 metrics given equal weight
   - Admin likely cares most about pending approvals (should be prominent)

2. **No actionable insights**
   - Stats are passive (just numbers)
   - Should have: "12 suggestions need your review" (actionable)

3. **Missing quick actions**
   - No "Invite User" button on dashboard
   - No "Create Document" shortcut
   - Admin has to navigate sidebar for common tasks

### 2.2 Document Access

**Current View** (`views/dashboard/dashboard.ejs:458-488`):

```
Recent Documents Table:
┌─────────┬──────┬──────────┬────────┬──────────┬─────────┐
│ Title   │ Type │ Sections │ Status │ Modified │ Actions │
├─────────┼──────┼──────────┼────────┼──────────┼─────────┤
│ Bylaws  │ ...  │ 45       │ Draft  │ 2 days   │ 👁 ⬇   │
└─────────┴──────┴──────────┴────────┴──────────┴─────────┘
```

**PAIN POINTS** 🔴:

1. **No document filtering**
   - Cannot filter by status, type, or date
   - Cannot search documents from dashboard
   - Must view "all" or nothing

2. **Limited document metadata**
   - Doesn't show who created/owns document
   - No indication of workflow stage
   - Can't see approval bottlenecks at a glance

3. **Table not responsive**
   - On mobile, table becomes unusable
   - No card view alternative

### 2.3 Section Navigation

**Current Implementation** (`src/routes/dashboard.js:661-787`):

```javascript
// Document viewer loads ALL sections in one request
router.get('/document/:documentId', requireAuth, async (req, res) => {
  const sections = await supabase
    .from('document_sections')
    .select('...')
    .eq('document_id', documentId)
    .order('path_ordinals', { ascending: true });
  // No pagination!
})
```

**PAIN POINTS** 🔴:

1. **Performance with deep hierarchies**
   - System supports 10 hierarchy levels
   - Large documents (500+ sections) will load slowly
   - No lazy loading or virtualization

2. **Difficult navigation in deep trees**
   - No breadcrumb trail
   - No "jump to section" search
   - Can't bookmark specific sections

3. **No hierarchy visualization**
   - Sections shown as flat list (sorted by path_ordinals)
   - Doesn't visually show parent/child relationships
   - Hard to understand document structure at a glance

**RECOMMENDATION**: Implement tree view with expand/collapse.

---

## 3. DOCUMENT MANAGEMENT

### 3.1 Uploading New Documents

**Current Flow**:
```
Dashboard → [+ New Document] button → ???
```

**CRITICAL ISSUE** 🚨:
- Button exists in UI (`views/dashboard/dashboard.ejs:385`)
- But **NO ROUTE IMPLEMENTED** for document upload
- Clicking likely results in 404 or nothing

**Expected Flow**:
```
POST /api/documents/upload
├─ Upload .docx file
├─ Parse with wordParser.js
├─ Extract sections using hierarchy_config
├─ Create document + sections in DB
├─ Assign default workflow template
└─ Redirect to document viewer
```

**PAIN POINTS**:
1. No multi-document upload
2. No drag-and-drop interface
3. No progress indicator during parsing

### 3.2 Viewing Document Sections

**Code Analysis** (`views/dashboard/document-viewer.ejs`):

**Not Implemented Yet** - Referenced but file doesn't exist in views/dashboard/

**Likely Needs**:
- Section list with hierarchy indentation
- Current text vs. locked text diff view
- Suggestions panel for each section
- Workflow status badges
- Approval action buttons (approve/reject/lock)

### 3.3 Hierarchy Navigation

**Database Schema** (`database/migrations/011_add_document_workflows_columns.sql`):

```sql
-- Hierarchy stored in organization config
hierarchy_config JSONB {
  "levels": [
    {"level": 1, "name": "Article", "numbering": "roman"},
    {"level": 2, "name": "Section", "numbering": "decimal"},
    ...
  ]
}

-- Sections reference path_ordinals for sorting
path_ordinals INTEGER[]
```

**PAIN POINTS** 🔴:

1. **No visual hierarchy in UI**
   - Config exists, but not rendered as tree
   - Users can't expand/collapse articles

2. **Numbering not displayed consistently**
   - Some views show section_number, others show ID
   - Numbering style (roman/decimal/alpha) not respected in display

### 3.4 Searching Within Documents

**Currently**: NO SEARCH IMPLEMENTED

**Expected Behavior**:
```
Search bar on document viewer
├─ Search section titles
├─ Search section text content
├─ Search suggestions
├─ Filter by workflow stage
└─ Results highlight + jump to section
```

---

## 4. SUGGESTION WORKFLOW

### 4.1 Viewing Pending Suggestions

**Current API** (`src/routes/dashboard.js:312-410`):

```javascript
GET /api/dashboard/suggestions?section_id=xyz
├─ For specific section: returns suggestions for that section
└─ No section_id: returns all pending for org
```

**UI Implementation** (`views/dashboard/dashboard.ejs:492-504`):

```html
<div id="activityFeed">
  <!-- Shows recent activity, not pending suggestions -->
</div>
```

**PAIN POINTS** 🔴:

1. **No dedicated suggestions view**
   - Dashboard shows activity feed, not suggestion queue
   - Admin must navigate to each document to see suggestions
   - Cannot see all pending suggestions across all documents

2. **No filtering/sorting**
   - Cannot filter by priority, author, date
   - Cannot sort by number of votes (voting not implemented)
   - Cannot group by document or section

3. **No bulk actions**
   - Cannot approve multiple suggestions at once
   - Cannot batch-reject with same reason
   - No "approve all from trusted user" option

### 4.2 Filtering by Status/Stage

**Workflow Stages** (`src/routes/approval.js:69-98`):

```javascript
async function getDocumentWorkflow(supabase, documentId) {
  // Returns workflow_template with stages:
  // - stage_name (e.g., "Legal Review", "Board Approval")
  // - stage_order (1, 2, 3...)
  // - required_roles (e.g., ["admin", "owner"])
  // - can_lock, can_edit, can_approve flags
}
```

**PAIN POINTS** 🔴:

1. **No stage-based filtering in UI**
   - API supports workflow stages
   - But dashboard doesn't show "View all in Legal Review stage"

2. **Status terminology inconsistent**
   - Database uses: pending, approved, rejected, in_progress, locked
   - UI might show different labels
   - No status legend/help text

### 4.3 Reviewing Suggestion Details

**Expected Flow**:
```
Click suggestion → Modal/panel shows:
├─ Original section text
├─ Suggested text (with diff highlighting)
├─ Rationale from suggester
├─ Author info
├─ Comments/discussion
├─ Approval history
└─ [Approve] [Reject] [Comment] buttons
```

**Current Implementation**: Partial

**Code** (`public/js/workflow-actions.js:39-62`):
```javascript
async function approveSection(sectionId) {
  const notes = prompt('Optional approval notes:');
  // ⚠️ Using browser prompt() - not professional
}
```

**PAIN POINTS** 🔴:

1. **No diff view**
   - Admin cannot easily see what changed
   - Must manually compare text blocks

2. **No approval workflow context**
   - Doesn't show "You are approving at: Legal Review stage"
   - Doesn't show next stage in workflow
   - No indication of who else needs to approve

3. **Comment system missing**
   - Can only add notes during approve/reject
   - No threaded discussions
   - Cannot ask suggester for clarification

### 4.4 Approving/Rejecting Suggestions

**API Implementation** (`src/routes/approval.js:386-466`):

```javascript
POST /approval/approve
├─ Validates user has permission for workflow stage
├─ Creates/updates section_workflow_states record
├─ Logs activity
└─ Returns updated state
```

**PAIN POINTS** 🔴:

1. **Approval UX is bare-bones**
   - Uses `prompt()` for notes (not accessible)
   - No rich text editing for feedback
   - No suggestion templates for common rejections

2. **No approval delegation**
   - Admin cannot assign approval to another admin
   - Cannot set "auto-approve" rules

3. **Missing approval analytics**
   - No "average time to approve"
   - No "rejection rate by stage"
   - Cannot identify bottleneck stages

### 4.5 Adding Comments/Feedback

**Current**: NOT IMPLEMENTED

**Expected Tables**:
```sql
CREATE TABLE suggestion_comments (
  id UUID PRIMARY KEY,
  suggestion_id UUID REFERENCES suggestions(id),
  user_id UUID REFERENCES users(id),
  comment_text TEXT,
  created_at TIMESTAMPTZ,
  parent_comment_id UUID -- for threading
);
```

**RECOMMENDATION**: Add commenting system as P1 feature.

---

## 5. TEAM MANAGEMENT

### 5.1 Inviting New Users

**UI** (`views/admin/user-management.ejs:142-189`):

```html
<button data-bs-toggle="modal" data-bs-target="#inviteUserModal">
  Invite User
</button>

<form id="inviteUserForm">
  <input type="email" id="inviteEmail" required>
  <input type="text" id="inviteName">
  <select id="inviteRole">
    <option value="member">Member</option>
    <option value="admin">Admin</option>
    <option value="viewer">Viewer</option>
    <option value="owner">Owner</option>
  </select>
</form>
```

**PAIN POINTS** 🔴:

1. **Role descriptions inadequate**
   - Shows "Full access" / "Can manage users" (too brief)
   - Doesn't explain workflow approval permissions
   - New admins won't understand member vs. admin

2. **No bulk invite**
   - Cannot paste CSV of emails
   - Must invite users one at a time
   - No "Copy invite link" option

3. **No invite templates**
   - Cannot save "Invite as Legal Team Member with Review permissions"
   - Must configure permissions manually each time

### 5.2 Setting User Roles/Permissions

**API** (`src/routes/users.js:394-473`):

```javascript
PUT /api/users/:userId/role
├─ Validates requester is admin
├─ Prevents self-role-change
├─ Only owners can assign owner role
└─ Updates user_organizations.role
```

**PAIN POINTS** 🔴:

1. **No granular permissions UI**
   - API supports custom permissions object
   - But UI only shows role dropdown
   - Cannot set "Can approve at Stage 2 only"

2. **No role change history**
   - Cannot see "Marcus was promoted from Member to Admin on Oct 1"
   - No audit trail for permission changes

3. **No permission preview**
   - Changing role doesn't show "This will allow user to..."
   - Risk of accidental over-permissioning

### 5.3 Managing User Access

**User List** (`views/admin/user-management.ejs:110-137`):

```html
<table id="usersTable">
  <thead>
    <tr>
      <th>User</th>
      <th>Role</th>
      <th>Status</th>
      <th>Joined</th>
      <th>Last Active</th>
      <th>Actions</th>
    </tr>
  </thead>
</table>
```

**GOOD** ✅:
- Shows last active timestamp
- Active/Inactive status badges
- Role badges with color coding

**PAIN POINTS** 🔴:

1. **No user activity details**
   - "Last Active" is just a date
   - Cannot see "Last active: Approved 3 suggestions in Bylaws v2.1"

2. **No user search/filter**
   - Large orgs (50 users) have unwieldy list
   - Cannot filter by role or status

3. **Deactivation is confusing**
   - "Remove" button deactivates, doesn't delete
   - No warning that user data is retained
   - No "Reactivate" button visible for inactive users

### 5.4 Viewing Team Activity

**Activity Log API** (`src/routes/users.js:599-641`):

```javascript
GET /api/users/activity/log
├─ Returns user_activity_log entries
├─ Includes: action_type, entity_type, entity_id, action_data
└─ Pagination: limit/offset
```

**PAIN POINTS** 🔴:

1. **Activity log not prominent**
   - Exists as API endpoint
   - But no clear "Activity Feed" in admin UI

2. **Activity types not user-friendly**
   - Shows: "user.role_changed" (technical)
   - Should show: "Marcus promoted Jane to Admin"

3. **No activity filtering**
   - Cannot filter by user, action type, or date range
   - Cannot export activity log for audit

### 5.5 Removing Users

**API** (`src/routes/users.js:544-593`):

```javascript
DELETE /api/users/:userId
├─ Prevents self-removal
├─ Deactivates (sets is_active = false)
├─ Logs activity
└─ Returns success
```

**GOOD** ✅:
- Deactivates instead of deleting (data retention)
- Prevents self-removal (safety check)

**PAIN POINTS** 🔴:

1. **No removal warning**
   - Doesn't warn "User has 12 pending suggestions"
   - Doesn't show impact of removal

2. **No bulk deactivation**
   - Cannot select multiple users and deactivate
   - Tedious for offboarding contractors

3. **No user data transfer**
   - Cannot reassign user's suggestions to another admin
   - Orphaned data problem

---

## 6. ORGANIZATION SETTINGS

### 6.1 Editing Org Profile

**Current Routes**:
```
GET  /admin/organization       → View settings
POST /admin/organization       → Update settings (NOT FOUND)
```

**UI** (`views/admin/organization-settings.ejs:108-233`):

Shows:
- Organization list (read-only cards)
- "Global Settings" placeholder (disabled buttons)

**CRITICAL GAP** 🚨:
- No edit form for organization name, description, logo
- API route for updating org doesn't exist

**Expected**:
```
PUT /api/organizations/:id
├─ name (string)
├─ description (text)
├─ logo_url (string)
├─ organization_type (string)
├─ contact_email (string)
└─ max_users (integer)
```

### 6.2 Configuring Hierarchy

**Database Storage** (`src/config/organizationConfig.js:41-60`):

```javascript
// Default hierarchy config
const defaultHierarchy = {
  levels: [
    { level: 1, name: "Article", numbering: "roman", prefix: "Article" },
    { level: 2, name: "Section", numbering: "decimal", prefix: "Section" },
    { level: 3, name: "Subsection", numbering: "alpha_lower", prefix: "" },
    // ... up to level 10
  ]
};
```

**PAIN POINTS** 🔴:

1. **No hierarchy editor UI**
   - Config exists in database
   - But no admin panel to customize it
   - Must manually edit JSON in database

2. **Cannot preview hierarchy changes**
   - If admin changes numbering scheme, how does it affect existing docs?
   - No migration tool for re-numbering sections

3. **Numbering scheme not flexible**
   - Predefined schemes (roman, decimal, alpha)
   - Cannot define custom like "A1.1" or "§123"

### 6.3 Workflow Template Management

**UI** (`views/admin/workflow-templates.ejs:117-203`):

```html
<div class="template-row">
  <div class="template-name">
    Standard Approval Workflow
    <span class="badge default-badge">Default</span>
  </div>
  <div>Stages: Legal Review → Board Approval → Final Lock</div>
  <div>12 documents using this template</div>
  <div class="btn-group">
    <button>Set Default</button>
    <button>Activate</button>
    <button>Edit</button>
    <button>Delete</button>
  </div>
</div>
```

**GOOD** ✅:
- Shows usage count (prevents accidental deletion of active templates)
- Default badge clearly marked
- Activate/Deactivate toggle

**PAIN POINTS** 🔴:

1. **No workflow editor UI**
   - "Edit" button exists
   - But `/admin/workflows/:id/edit` route **NOT IMPLEMENTED**

2. **Cannot clone templates**
   - If admin wants to create "Board Approval (Expedited)", must recreate from scratch
   - No "Duplicate" button

3. **Stage configuration unclear**
   - Shows stage names as badges
   - But doesn't show stage order, required roles, permissions
   - Must click Edit to see full config (which doesn't exist yet)

### 6.4 Customizing Numbering Schemes

**Currently**: NOT IMPLEMENTED

**Expected**:
```
/admin/organization/numbering
├─ Level 1: Prefix "Article" | Numbering: Roman | Separator: "."
├─ Level 2: Prefix "Section" | Numbering: Decimal | Separator: "."
└─ [+ Add Level] (up to 10)
```

**RECOMMENDATION**: Build visual numbering editor with live preview.

### 6.5 Setting Approval Policies

**Currently**: Defined in workflow stages

**Code** (`database/migrations/012_workflow_enhancements.sql`):

```sql
CREATE TABLE workflow_stages (
  required_roles TEXT[] DEFAULT ARRAY['admin'],
  requires_approval BOOLEAN DEFAULT true,
  can_lock BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false
);
```

**PAIN POINTS** 🔴:

1. **No global approval policies**
   - Each workflow template defines its own rules
   - Cannot set "All suggestions must have 2 admin approvals" org-wide

2. **No time-based policies**
   - Cannot enforce "Must approve within 5 business days"
   - No escalation if approval stalled

---

## 7. WORKFLOW ADMINISTRATION

### 7.1 Creating Custom Workflows

**API** (`src/routes/workflow.js:315-370`):

```javascript
POST /api/workflow/templates
├─ Validates admin role
├─ Checks if setting as default
├─ Creates workflow_templates record
└─ Returns template ID
```

**PAIN POINTS** 🔴:

1. **No workflow builder UI**
   - API exists, but no visual workflow editor
   - Admin must use Postman or SQL to create workflows

2. **No workflow templates library**
   - Should have: "Legal Review Only", "Board + Legal", "Expedited", etc.
   - Admin starts from blank slate every time

### 7.2 Defining Workflow Stages

**API** (`src/routes/workflow.js:662-751`):

```javascript
POST /api/workflow/templates/:id/stages
├─ stageName, stageOrder, canLock, canEdit, canApprove
├─ requiresApproval, requiredRoles
├─ displayColor, icon, description
└─ Creates workflow_stages record
```

**PAIN POINTS** 🔴:

1. **Too many stage configuration options**
   - 9 different fields to configure per stage
   - Easy to misconfigure (e.g., set canApprove=false but requiresApproval=true)

2. **No stage reordering UI**
   - API has reorder endpoint (`/stages/reorder`)
   - But no drag-and-drop interface

3. **Icon/color pickers missing**
   - Expects hex colors (`#667eea`) and Bootstrap icon names
   - No visual picker

### 7.3 Setting Stage Permissions

**Role-Based Access** (`src/middleware/roleAuth.js:135-180`):

```javascript
async function canApproveStage(req, stageId) {
  // 1. Get stage.required_roles
  // 2. Get user's role in organization
  // 3. Check if user.role in required_roles
}
```

**GOOD** ✅:
- Permissions checked server-side
- Role hierarchy enforced (owner > admin > member > viewer)

**PAIN POINTS** 🔴:

1. **Permissions test tool missing**
   - Admin cannot preview "What can Jane approve?"
   - No permission matrix view

2. **Cannot set user-specific overrides**
   - Workflow stage requires "admin" role
   - But cannot add exception "Also allow Marcus"

### 7.4 Assigning Workflows to Documents

**Database** (`database/migrations/011_add_document_workflows_columns.sql`):

```sql
CREATE TABLE document_workflows (
  document_id UUID REFERENCES documents(id),
  workflow_template_id UUID REFERENCES workflow_templates(id),
  assigned_at TIMESTAMPTZ,
  assigned_by UUID
);
```

**PAIN POINTS** 🔴:

1. **No workflow assignment UI**
   - Table exists, but no admin panel to assign
   - Documents likely get default template on creation
   - Cannot change workflow mid-process

2. **No workflow versioning**
   - If admin updates workflow template, does it affect in-progress documents?
   - No migration strategy

### 7.5 Monitoring Workflow Progress

**API** (`src/routes/approval.js:130-221`):

```javascript
GET /api/approval/workflow/:documentId
├─ Returns workflow template + stages
├─ Returns section progress per stage
└─ Returns overall progress percentage
```

**PAIN POINTS** 🔴:

1. **No visual workflow progress**
   - API returns data
   - But no Gantt chart, kanban board, or progress bar UI

2. **No bottleneck alerts**
   - Cannot see "8 sections stuck at Legal Review for 14 days"
   - No workflow health metrics

3. **No workflow reports**
   - Cannot export "Approval velocity by stage"
   - No analytics dashboard

---

## 8. REPORTING & ANALYTICS

### 8.1 Progress Tracking

**Current Dashboard Stats** (`src/routes/dashboard.js:86-178`):

```javascript
GET /api/dashboard/overview
Returns:
├─ totalDocuments: 12
├─ activeSections: 145
├─ pendingSuggestions: 23
└─ approvalProgress: 67%  // (approved sections / total sections) * 100
```

**PAIN POINTS** 🔴:

1. **Progress metric too simple**
   - 67% approved doesn't tell whole story
   - Doesn't show workflow stage distribution
   - Example: Maybe 90% at "Legal Review" stage, but 0% at "Board Approval"

2. **No trend analysis**
   - Cannot see "Approval rate increased 15% this month"
   - No historical graphs

3. **Not goal-oriented**
   - Admin doesn't know "We need to approve 30 more sections to hit Q4 target"

### 8.2 Approval Metrics

**Currently**: NOT IMPLEMENTED

**Expected Metrics**:
```
Approval Dashboard
├─ Average time to approve (by stage)
├─ Approval rate (approved / total suggestions)
├─ Rejection reasons (word cloud or categorized)
├─ Approver leaderboard (who approves most)
├─ Approval velocity chart (approvals per week)
└─ Bottleneck identification (stages with longest wait)
```

### 8.3 User Activity Reports

**Activity Log** (`src/routes/users.js:599-641`):

```javascript
GET /api/users/activity/log?limit=50&offset=0
Returns:
[
  {
    action_type: "user.role_changed",
    entity_type: "user",
    entity_id: "uuid",
    action_data: { new_role: "admin" },
    created_at: "2025-10-14T10:30:00Z",
    users: { email: "jane@corp.com", name: "Jane Doe" }
  }
]
```

**PAIN POINTS** 🔴:

1. **No report generation**
   - Cannot export as PDF or CSV
   - No email digest (e.g., "Weekly Activity Report")

2. **No activity analytics**
   - Cannot see "Most active users this month"
   - No engagement metrics

3. **Action types not user-friendly**
   - Shows raw database values: "user.role_changed", "section.progressed"
   - Should translate to "Marcus promoted Jane to Admin", "Section 3.2 moved to Board Approval"

### 8.4 Document Status

**Currently**: Shown in dashboard table

**PAIN POINTS** 🔴:

1. **Status values inconsistent**
   - Documents have: draft, active, published, archived
   - Sections have: pending, approved, rejected, in_progress, locked
   - Suggestions have: open, closed
   - No unified status model

2. **No document health score**
   - Cannot see "Document 85% complete, 3 sections blocked"

### 8.5 Bottleneck Identification

**Currently**: NOT IMPLEMENTED

**Recommended Features**:
```
Bottleneck Report
├─ Sections stuck >7 days at same stage
├─ Workflow stages with >50% of sections queued
├─ Approvers with >20 pending in queue
├─ Documents with 0% progress in last 30 days
└─ Alerts: "Legal Review stage has 45 pending (avg 3 day wait)"
```

---

## 9. PAIN POINTS BY SEVERITY

### 🚨 CRITICAL (Blocks Core Workflow)

1. **Broken invitation acceptance flow**
   - `/auth/accept-invite` referenced but not implemented
   - Invited users cannot complete registration

2. **No document upload route**
   - Button exists, route doesn't
   - Cannot add documents to system

3. **No workflow editor UI**
   - Workflows must be created via API/SQL
   - Non-technical admins blocked

4. **No diff view for suggestions**
   - Cannot see what changed
   - Core approval workflow unusable

### 🔴 HIGH (Major UX Issues)

5. **No bulk operations**
   - Cannot invite multiple users
   - Cannot approve multiple suggestions
   - Inefficient for large teams

6. **No notification system**
   - Admin doesn't know when suggestions arrive
   - No email alerts for pending approvals

7. **No search functionality**
   - Cannot search documents, sections, or suggestions
   - Navigation breaks down at scale

8. **Mobile experience poor**
   - Tables don't reflow
   - No touch-optimized UI
   - Unusable on tablet/phone

9. **No commenting/discussion system**
   - Cannot ask suggester for clarification
   - No threaded conversations

10. **Activity feed too generic**
    - Shows recent activity, not actionable items
    - Admin wants "Suggestions pending YOUR approval"

### ⚠️ MEDIUM (Usability Friction)

11. **No onboarding tour**
    - First-time admins confused about capabilities

12. **Hierarchy navigation poor**
    - 10-level hierarchy shown as flat list
    - No tree view or expand/collapse

13. **Role descriptions inadequate**
    - Tooltips too brief
    - Permission matrix not visible

14. **No workflow templates library**
    - Admin recreates common workflows from scratch

15. **Status terminology inconsistent**
    - Different words for same concept across tables

16. **No approval analytics**
    - Cannot track approval velocity
    - No bottleneck detection

17. **User limit not proactive**
    - Shows error after hitting limit
    - Should warn at 8/10 users

18. **No keyboard shortcuts**
    - Power users can't navigate efficiently
    - No Vim-style bindings or hotkeys

19. **Loading states poor**
    - Stats show "-" instead of skeleton
    - No perceived performance optimization

20. **No data export**
    - Cannot export user list, activity log, or reports
    - No CSV/PDF generation

### 💡 LOW (Polish & Enhancement)

21. **No dark mode**
22. **No customizable dashboard widgets**
23. **No saved filters**
24. **No email templates for invitations**
25. **No approval delegation**
26. **No auto-approve rules**
27. **No workflow versioning**
28. **No permission testing tool**
29. **No user import from CSV**
30. **No API documentation for integrations**

---

## 10. UX IMPROVEMENT RECOMMENDATIONS

### Phase 1: Fix Broken Flows (Sprint 1)

**Priority: P0 - Immediate**

1. **Implement `/auth/accept-invite` route**
   ```javascript
   router.get('/accept-invite', async (req, res) => {
     const { token } = req.query;
     // Validate token
     // Show set-password form
     // Auto-verify email
     // Create session
     // Redirect to dashboard
   });
   ```

2. **Implement document upload**
   ```javascript
   router.post('/api/documents/upload', upload.single('file'), async (req, res) => {
     // Parse .docx using wordParser
     // Extract sections using hierarchy_config
     // Create document + sections
     // Assign default workflow
   });
   ```

3. **Create basic workflow editor**
   - Drag-and-drop stages
   - Visual stage configuration
   - Permission picker (checkbox list of roles)

4. **Build suggestion diff view**
   - Side-by-side comparison
   - Highlighted changes (added/removed/modified)
   - Accept/reject with inline comments

### Phase 2: Core Admin Features (Sprint 2-3)

**Priority: P1 - High**

5. **Add notification system**
   - In-app notification bell icon
   - Email alerts (configurable)
   - Notification types:
     - New suggestion submitted
     - Approval needed (you're assigned)
     - Suggestion approved/rejected (you're author)
     - Workflow stage completed
     - User invited/joined

6. **Build bulk operations**
   - Multi-select checkboxes on user list
   - Bulk invite (paste CSV)
   - Bulk approve suggestions (with same workflow stage)
   - Bulk change user roles

7. **Implement search**
   - Global search bar in header
   - Search scopes: All, Documents, Sections, Suggestions, Users
   - Filters: Date range, status, author
   - Keyboard shortcut: `/` or `Ctrl+K`

8. **Add commenting system**
   ```sql
   CREATE TABLE suggestion_comments (
     id UUID PRIMARY KEY,
     suggestion_id UUID REFERENCES suggestions(id),
     user_id UUID REFERENCES users(id),
     comment_text TEXT,
     parent_comment_id UUID, -- for threading
     created_at TIMESTAMPTZ,
     updated_at TIMESTAMPTZ
   );
   ```

9. **Create activity feed for admins**
   - "Items Needing Your Attention" section
   - Group by: Pending approvals, Stalled workflows, New suggestions
   - Actionable items with quick-approve buttons

### Phase 3: Navigation & Hierarchy (Sprint 4)

**Priority: P1 - High**

10. **Build tree view for sections**
    - Collapsible hierarchy (like VS Code file explorer)
    - Breadcrumb trail at top
    - Jump-to-section search
    - Keyboard navigation (arrow keys)

11. **Implement hierarchy editor**
    - Visual level configuration
    - Live preview of numbering
    - Migration tool for re-numbering

12. **Add mobile-responsive layout**
    - Card view for documents (not table)
    - Hamburger menu for sidebar
    - Touch-optimized buttons (larger tap targets)
    - Bottom navigation bar

### Phase 4: Analytics & Reporting (Sprint 5)

**Priority: P2 - Medium**

13. **Build approval analytics dashboard**
    - Chart: Approvals per week (line chart)
    - Chart: Average approval time by stage (bar chart)
    - Chart: Rejection reasons (pie chart)
    - Table: Approver leaderboard (name, count, avg time)

14. **Create bottleneck detection**
    - Alert: "12 sections stuck at Legal Review for >7 days"
    - Notification to stage approvers
    - Escalation rules (auto-assign to backup approver)

15. **Add report export**
    - User list → CSV
    - Activity log → CSV
    - Approval metrics → PDF report
    - Email weekly digest to admin

### Phase 5: Polish & Enhancements (Sprint 6)

**Priority: P3 - Low**

16. **Onboarding tour**
    - Intro.js or Shepherd.js library
    - Steps: "This is your dashboard", "Here are pending suggestions", "Invite users here"
    - Dismissable, can replay

17. **Keyboard shortcuts**
    - `?` - Show keyboard shortcut help
    - `/` - Focus search
    - `n` - New document
    - `i` - Invite user
    - `a` - Approve selected
    - `r` - Reject selected

18. **Dark mode**
    - Toggle in user menu
    - Persist preference in localStorage
    - Use CSS variables for theming

19. **Saved filters**
    - Save "My Team's Suggestions"
    - Save "Expedited Approvals"
    - Quick-access in sidebar

20. **API documentation**
    - Swagger/OpenAPI spec
    - Interactive API explorer (Swagger UI)
    - Webhook integration docs

---

## 11. FEATURE ACCESSIBILITY MATRIX

| Feature | Owner | Admin | Member | Viewer | Global Admin |
|---------|-------|-------|--------|--------|--------------|
| **Dashboard** | | | | | |
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| View org stats | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all org documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Documents** | | | | | |
| Upload document | ✅ | ✅ | ✅ | ❌ | ✅ |
| Edit document | ✅ | ✅ | ✅ | ❌ | ✅ |
| Delete document | ✅ | ✅ | ❌ | ❌ | ✅ |
| Assign workflow | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Suggestions** | | | | | |
| Create suggestion | ✅ | ✅ | ✅ | ❌ | ✅ |
| View suggestions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comment on suggestion | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve suggestion* | ✅ | ✅ | ❓ | ❌ | ✅ |
| Reject suggestion* | ✅ | ✅ | ❓ | ❌ | ✅ |
| Lock section* | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Users** | | | | | |
| Invite user | ✅ | ✅ | ❌ | ❌ | ✅ |
| View user list | ✅ | ✅ | ❌ | ❌ | ✅ |
| Change user role | ✅ | ✅ | ❌ | ❌ | ✅ |
| Remove user | ✅ | ✅ | ❌ | ❌ | ✅ |
| View activity log | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Workflows** | | | | | |
| Create workflow template | ✅ | ✅ | ❌ | ❌ | ✅ |
| Edit workflow template | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delete workflow template | ✅ | ✅ | ❌ | ❌ | ✅ |
| Assign workflow to doc | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Organization** | | | | | |
| Edit org settings | ✅ | ❌ | ❌ | ❌ | ✅ |
| Configure hierarchy | ✅ | ❌ | ❌ | ❌ | ✅ |
| Set default workflow | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Admin Functions** | | | | | |
| Access /admin routes | ✅ | ✅ | ❌ | ❌ | ✅ |
| View workflow progress | ✅ | ✅ | ❌ | ❌ | ✅ |
| Generate reports | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Global Admin Only** | | | | | |
| Access all organizations | ❌ | ❌ | ❌ | ❌ | ✅ |
| Create organization | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delete organization | ❌ | ❌ | ❌ | ❌ | ✅ |

*Depends on workflow stage `required_roles` configuration

**Legend**:
- ✅ Yes
- ❌ No
- ❓ Conditional (depends on workflow stage)

---

## 12. PERMISSION BOUNDARY ANALYSIS

### What Org Admins CAN Do

✅ **User Management (Within Their Org)**
- Invite new users to their organization
- Change user roles (member → admin, etc.)
- Deactivate users
- View user activity
- **Limit**: Cannot see users from other organizations

✅ **Workflow Configuration (Org-Specific)**
- Create workflow templates
- Define workflow stages
- Set stage permissions (which roles can approve)
- Assign workflows to documents
- **Limit**: Cannot see or modify other orgs' workflows

✅ **Document Management**
- Upload documents
- Edit document metadata
- Assign workflows
- Delete documents
- **Limit**: Can only access documents in their org (enforced by RLS)

✅ **Approval Actions (Role-Dependent)**
- Approve sections at stages where their role is allowed
- Reject sections with reason
- Lock sections at lockable stages
- **Limit**: Cannot approve at stages requiring higher roles

### What Org Admins CANNOT Do

❌ **Cross-Organization Access**
- Cannot view other organizations' data
- Cannot switch to other orgs (unless explicitly added)
- Cannot see global user list

❌ **System-Wide Settings**
- Cannot modify platform settings
- Cannot access database directly
- Cannot create new organizations

❌ **Global Admin Functions**
- Cannot access `/admin/dashboard` (global admin view)
- Cannot delete organizations
- Cannot modify RLS policies

### Comparison: Org Admin vs. Global Admin

| Capability | Org Admin | Global Admin |
|------------|-----------|--------------|
| Scope | Single organization | All organizations |
| User management | Within org only | All users |
| Workflow templates | Org-specific | All templates |
| Organization creation | ❌ No | ✅ Yes |
| Organization deletion | ❌ No | ✅ Yes |
| RLS bypass | ❌ No | ⚠️ Via service client |
| Access admin routes | `/admin/users`, `/admin/workflows` | All `/admin/*` routes |

### Permission Boundary Issues

🔴 **Issue 1: Admin vs. Owner Confusion**

```javascript
// Both 'admin' and 'owner' can access /admin routes
router.get('/admin/users', requireAdmin, ...);

// But only 'owner' can assign owner role
if (newRole === 'owner' && currentUserRole !== 'owner') {
  return res.status(403).json({ error: 'Only owners can assign owner role' });
}
```

**Problem**: UI doesn't clearly show owner-only capabilities.

**Solution**: Add role badges in UI:
```
[Invite User]
  Role: Owner (You cannot assign this role) ⓘ
       Admin ✓
       Member ✓
       Viewer ✓
```

🔴 **Issue 2: Workflow Stage Permissions Are Opaque**

Admins can approve at stages where `required_roles` includes their role, but this isn't visible in the UI.

**Solution**: Show permission matrix on workflow editor:
```
Legal Review Stage
  Required Roles: Admin, Owner
  Your Role: Admin → ✅ You can approve at this stage
```

🔴 **Issue 3: No Permission Testing**

Admin cannot preview "If I change Jane to Member, what will she lose access to?"

**Solution**: Add "Preview Permissions" button that shows:
```
As Member, Jane will:
  ✅ Keep: Creating suggestions, viewing documents
  ❌ Lose: Approving at Legal Review stage, inviting users
```

---

## 13. MOBILE EXPERIENCE AUDIT

### Current State: 📱 POOR (3/10)

**Issues Identified**:

1. **Sidebar Navigation**
   - Fixed 260px sidebar always visible
   - On mobile, sidebar covers 50% of screen
   - No hamburger menu toggle

   **Code** (`views/dashboard/dashboard.ejs:318-326`):
   ```css
   @media (max-width: 768px) {
     .sidebar {
       transform: translateX(-100%); /* Hidden but not toggleable */
     }
     .main-content {
       margin-left: 0;
     }
   }
   ```

   **Issue**: Sidebar hidden but no way to show it again!

2. **Data Tables**
   - Documents table has 6 columns
   - On 375px screen, table requires horizontal scroll
   - No card view alternative

   **Code** (`views/dashboard/dashboard.ejs:465-486`):
   ```html
   <table class="table data-table">
     <!-- 6 columns: Title, Type, Sections, Status, Modified, Actions -->
   </table>
   ```

   **Solution Needed**: Card view for mobile
   ```html
   <div class="document-card">
     <h5>Bylaws Amendment v2.1</h5>
     <div>Type: Bylaws | 45 sections</div>
     <div>Status: <span class="badge">Draft</span></div>
     <div>Modified: 2 days ago</div>
     <div>[View] [Export]</div>
   </div>
   ```

3. **Forms & Modals**
   - Invite user modal uses Bootstrap default sizing
   - On mobile, modal too wide, buttons hard to tap

   **Issue**: Bootstrap modals not optimized for mobile touch

4. **Touch Targets Too Small**
   - Action buttons are btn-sm (small)
   - Minimum touch target should be 44x44px (Apple HIG)
   - Current buttons likely 32x32px

   **Code** (`views/dashboard/dashboard.ejs:87-94`):
   ```html
   <div class="btn-group btn-group-sm">
     <a href="#" class="btn btn-outline-primary btn-sm">
       <i class="bi bi-eye"></i>
     </a>
   </div>
   ```

5. **No Bottom Navigation**
   - Top navigation bar + sidebar not mobile-friendly
   - iOS users expect bottom navigation

6. **Dropdown Menus**
   - User dropdown in top-right corner hard to reach with thumb
   - No swipe gestures

7. **Typography Not Responsive**
   - Font sizes fixed in px, not rem or em
   - Small text unreadable on phone

8. **No Mobile-Specific Features**
   - No pull-to-refresh
   - No swipe actions (swipe to approve/reject)
   - No native sharing (Share API)

### Mobile Recommendations

**Phase 1: Make Usable**
1. Add hamburger menu for sidebar
2. Convert tables to cards on mobile
3. Increase touch target sizes to 44x44px minimum
4. Make modals full-screen on mobile

**Phase 2: Optimize**
5. Add bottom navigation bar (Dashboard, Suggestions, Users, Profile)
6. Implement swipe gestures (swipe suggestion card left to approve, right to reject)
7. Use responsive typography (rem units)

**Phase 3: Native Feel**
8. Add pull-to-refresh on dashboard
9. Implement Web Share API for exporting
10. Add haptic feedback (vibration) on approve/reject

---

## 14. ACCESSIBILITY AUDIT

### Current State: ♿ FAIR (5/10)

**Issues Identified**:

1. **Keyboard Navigation**
   ❌ Sidebar links have no visible focus indicators
   ❌ Modals don't trap focus
   ❌ No skip-to-content link

2. **Screen Reader Support**
   ⚠️ Icons without labels (`<i class="bi bi-eye"></i>`)
   ⚠️ Status badges not announced ("Draft" has no context)
   ✅ Table headers properly marked

3. **Color Contrast**
   ⚠️ Light text on light backgrounds (6c757d on white = 4.6:1, should be 4.5:1)
   ✅ Primary buttons have good contrast

4. **Forms**
   ✅ Labels associated with inputs (`<label for="inviteEmail">`)
   ❌ Error messages not linked to fields (no `aria-describedby`)

5. **ARIA Landmarks**
   ❌ No `<main>`, `<nav>`, `<aside>` tags
   ❌ Modals don't have `role="dialog"` or `aria-labelledby`

6. **Focus Management**
   ❌ Opening modal doesn't focus first input
   ❌ Closing modal doesn't return focus to trigger button

### Accessibility Recommendations

**Quick Wins**:
1. Add `aria-label` to icon-only buttons
   ```html
   <button class="btn btn-sm" aria-label="View document">
     <i class="bi bi-eye"></i>
   </button>
   ```

2. Add visible focus indicators
   ```css
   .btn:focus {
     outline: 2px solid #3498db;
     outline-offset: 2px;
   }
   ```

3. Add skip-to-content link
   ```html
   <a href="#main-content" class="skip-link">Skip to main content</a>
   ```

4. Use semantic HTML
   ```html
   <main id="main-content">
     <nav aria-label="Primary navigation">...</nav>
     <section aria-labelledby="documents-heading">...</section>
   </main>
   ```

5. Link error messages to form fields
   ```html
   <input id="email" aria-describedby="email-error">
   <div id="email-error" role="alert">Invalid email format</div>
   ```

---

## 15. CONCLUSION & NEXT STEPS

### Summary

The Bylaws Amendment Tracker has a **solid technical foundation** for organization administration but **critical UX gaps** that block real-world usage:

**Strengths**:
- ✅ Robust role-based permissions system
- ✅ Multi-tenant architecture with RLS security
- ✅ Comprehensive workflow approval system (database layer)
- ✅ User invitation/management API

**Critical Gaps**:
- ❌ Broken invitation acceptance flow (P0)
- ❌ No document upload implementation (P0)
- ❌ No workflow editor UI (P0)
- ❌ No suggestion diff view (P0)
- ❌ No notification system (P1)
- ❌ No bulk operations (P1)
- ❌ Poor mobile experience (P1)

### Recommended Roadmap

**Sprint 1 (Week 1-2): Fix Blockers**
- Implement `/auth/accept-invite` route
- Build document upload flow
- Create basic diff view component
- Add basic workflow editor

**Sprint 2 (Week 3-4): Core Admin Features**
- Notification system (in-app + email)
- Bulk invite users
- Search functionality
- Commenting system

**Sprint 3 (Week 5-6): Navigation & Hierarchy**
- Tree view for sections
- Hierarchy editor
- Mobile-responsive layout

**Sprint 4 (Week 7-8): Analytics & Polish**
- Approval analytics dashboard
- Bottleneck detection
- Report export
- Onboarding tour

### Success Metrics

Track these KPIs to measure UX improvements:

1. **Time to First Invite** (after org creation)
   - Target: <2 minutes
2. **Suggestion Approval Rate**
   - Target: >80% within 48 hours
3. **Admin Task Completion Rate**
   - Target: >90% (no abandoned workflows)
4. **Mobile Usage**
   - Target: 30% of sessions on mobile
5. **User Satisfaction (NPS)**
   - Target: >50 (promoter score)

---

## Appendix A: User Journey Map

```
┌─────────────────────────────────────────────────────┐
│ MARCUS - ORG ADMIN USER JOURNEY                     │
└─────────────────────────────────────────────────────┘

DAY 1: ONBOARDING
─────────────────
🔹 Receives invitation email from existing admin
   ├─ Email: "You've been invited to [Org Name]"
   └─ Click: "Accept Invitation"

🔹 BROKEN: Lands on error page (/auth/accept-invite not found)
   ├─ Expected: Set password form
   └─ Reality: 404 or generic login

🔹 Manually navigates to /auth/register
   ├─ Confusion: "Am I creating a new org or joining existing?"
   └─ Creates account, but not linked to org invitation

🔹 First login → Dashboard
   ├─ Sees empty stats: "- documents, - suggestions"
   ├─ No onboarding tour
   └─ Unsure what to do next

FRUSTRATION: 😡😡😡 (3/5)

DAY 2: ADDING TEAM MEMBERS
──────────────────────────
🔹 Wants to invite 5 legal team members
   ├─ Navigates to /admin/users
   └─ Clicks "Invite User"

🔹 Invites users one-by-one (no bulk)
   ├─ 5 minutes per invite
   └─ Total: 25 minutes

🔹 Doesn't know if invitations sent successfully
   ├─ No "Invitation pending" status
   └─ Has to ask users if they received email

FRUSTRATION: 😡😡 (2/5)

DAY 3: UPLOADING FIRST DOCUMENT
───────────────────────────────
🔹 Clicks "+ New Document" button
   └─ BROKEN: Nothing happens (route not implemented)

🔹 Tries different approach: Navigates to /bylaws
   └─ Still can't find upload

🔹 Gives up, asks for help
   ├─ Developer manually uploads via API
   └─ Document appears in dashboard

FRUSTRATION: 😡😡😡😡 (4/5)

DAY 4: REVIEWING SUGGESTIONS
────────────────────────────
🔹 Team submits 12 suggestions
   ├─ Dashboard shows "12 pending"
   └─ But doesn't link to suggestion list

🔹 Clicks on document → Scrolls to find sections with suggestions
   ├─ No visual indicator which sections have suggestions
   └─ Manual hunting through 50 sections

🔹 Finds suggestion, clicks "Approve"
   ├─ Browser prompt() appears (not professional)
   ├─ Cannot see diff (what changed?)
   └─ Approves blindly

🔹 Repeats 11 more times
   ├─ No bulk approve
   └─ Total time: 45 minutes

FRUSTRATION: 😡😡😡 (3/5)

WEEK 2: CONFIGURING WORKFLOWS
─────────────────────────────
🔹 Wants to create "Expedited Approval" workflow
   ├─ Navigates to /admin/workflows
   └─ Clicks "Create New Template"

🔹 BROKEN: Edit button doesn't work
   └─ No workflow editor UI

🔹 Asks developer to create via SQL
   ├─ Developer writes migration
   └─ Workflow appears 2 days later

FRUSTRATION: 😡😡😡😡😡 (5/5)

MONTH 1: DAILY USAGE
────────────────────
🔹 Logs in daily to check pending approvals
   ├─ No email notifications
   └─ Must proactively check

🔹 Navigates through clunky hierarchy
   ├─ Nested sections hard to find
   └─ No search functionality

🔹 Approves suggestions manually one-by-one
   └─ Wishes for "Approve all from Jane" button

🔹 Occasionally checks user activity log
   ├─ Cannot export for audit
   └─ Technical action names confusing

FRUSTRATION: 😡😡 (2/5 - getting used to it)

OVERALL EXPERIENCE: 6/10
────────────────────────
Pros:
✅ Role-based permissions work correctly
✅ Workflow system is powerful (when configured)
✅ Multi-tenant isolation secure

Cons:
❌ Too many broken/missing features
❌ No notification system
❌ Poor bulk operations
❌ Requires developer help frequently
```

---

**END OF REPORT**

Generated by: Code Analyzer Agent
Date: October 14, 2025
Version: 1.0
