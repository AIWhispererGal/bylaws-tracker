# Workflow System Architecture

**Version:** 1.0
**Last Updated:** 2025-10-14
**Status:** Implementation Complete

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Permission Model](#permission-model)
8. [UI Component Hierarchy](#ui-component-hierarchy)
9. [Testing Strategy](#testing-strategy)
10. [Performance Considerations](#performance-considerations)
11. [Security Model](#security-model)
12. [Deployment Checklist](#deployment-checklist)

---

## System Overview

### Purpose

The Workflow System provides multi-stage approval workflows for document amendments in a multi-tenant bylaws management platform. It allows organizations to define custom approval processes with role-based permissions at each stage.

### Key Features

- **Multi-stage workflows**: Define 1-N approval stages per organization
- **Role-based permissions**: Control who can approve at each stage
- **Section-level tracking**: Track approval status for individual document sections
- **Audit trail**: Complete history of all approval actions
- **Version snapshots**: Capture document state at approval milestones
- **Multi-tenant isolation**: Complete data separation between organizations via RLS

### Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (via Supabase)
- **Security**: Row-Level Security (RLS) policies
- **Authentication**: Supabase Auth + Express Sessions
- **Frontend**: EJS templates + Vanilla JavaScript
- **Validation**: Joi schemas

---

## Architecture Diagram

### System Context (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Bylaws Management Platform                   │
│                                                                   │
│  ┌──────────┐     ┌──────────┐     ┌──────────────┐            │
│  │  Users   │────▶│   Web    │────▶│   Workflow   │            │
│  │(Members, │     │  Server  │     │    System    │            │
│  │ Admins,  │     │          │     │              │            │
│  │ Owners)  │     │          │     └──────┬───────┘            │
│  └──────────┘     └────┬─────┘            │                     │
│                        │                  │                     │
│                        ▼                  ▼                     │
│                   ┌─────────────────────────────┐              │
│                   │   PostgreSQL Database       │              │
│                   │   (Supabase with RLS)       │              │
│                   └─────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Container Diagram (C4 Level 2)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────────────────────────────────────┐
│         Express.js Application                │
├──────────────────────────────────────────────┤
│  ┌─────────────┐  ┌────────────────────┐    │
│  │   Routes    │  │    Middleware       │    │
│  │             │  │  - Authentication   │    │
│  │ - Workflow  │  │  - Global Admin     │    │
│  │ - Approval  │  │  - Role Auth        │    │
│  │ - Dashboard │  │  - CSRF Protection  │    │
│  └─────────────┘  └────────────────────┘    │
│                                               │
│  ┌─────────────────────────────────────┐    │
│  │      Supabase Client Layer          │    │
│  │  - Authenticated Client (RLS)       │    │
│  │  - Service Role Client (Bypass RLS) │    │
│  └─────────────────────────────────────┘    │
└───────────────────┬──────────────────────────┘
                    │ PostgreSQL Protocol
                    ▼
┌──────────────────────────────────────────────┐
│        Supabase PostgreSQL Database          │
├──────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │  Workflow Tables │  │  RLS Policies   │  │
│  │  - Templates     │  │  - Org Filter   │  │
│  │  - Stages        │  │  - Role Check   │  │
│  │  - States        │  │  - Global Admin │  │
│  │  - Versions      │  │    Bypass       │  │
│  └──────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────┘
```

### Component Diagram (C4 Level 3)

```
┌────────────────────────────────────────────────────────────────┐
│                  Workflow System Components                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐    │
│  │                   Route Layer                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │    │
│  │  │  /api/       │  │  /api/       │  │  /dashboard │ │    │
│  │  │  approval/*  │  │  workflows/* │  │  /document  │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │    │
│  └───────────────────────────────────────────────────────┘    │
│                           │                                     │
│  ┌───────────────────────▼───────────────────────────────┐    │
│  │               Middleware Chain                         │    │
│  │  requireAuth → globalAdmin → roleAuth → csrfProtect   │    │
│  └───────────────────────┬───────────────────────────────┘    │
│                           │                                     │
│  ┌───────────────────────▼───────────────────────────────┐    │
│  │              Business Logic Layer                      │    │
│  │  ┌─────────────────┐  ┌──────────────────────────┐   │    │
│  │  │ Workflow        │  │  Section State           │   │    │
│  │  │ Management      │  │  Management              │   │    │
│  │  │                 │  │                          │   │    │
│  │  │ - Get workflow  │  │  - Lock section          │   │    │
│  │  │ - Check stage   │  │  - Approve/Reject        │   │    │
│  │  │ - Validate perm │  │  - Progress stage        │   │    │
│  │  └─────────────────┘  └──────────────────────────┘   │    │
│  │                                                        │    │
│  │  ┌─────────────────┐  ┌──────────────────────────┐   │    │
│  │  │ Version         │  │  Activity Logging        │   │    │
│  │  │ Management      │  │                          │   │    │
│  │  │                 │  │  - Log approval actions  │   │    │
│  │  │ - Create snap   │  │  - Track user activity   │   │    │
│  │  │ - List versions │  │  - Audit trail           │   │    │
│  │  └─────────────────┘  └──────────────────────────┘   │    │
│  └────────────────────────────────────────────────────────┘    │
│                           │                                     │
│  ┌───────────────────────▼───────────────────────────────┐    │
│  │                 Data Access Layer                      │    │
│  │  ┌──────────────────────┐  ┌──────────────────────┐  │    │
│  │  │ Supabase Client      │  │ Helper Functions     │  │    │
│  │  │ (Authenticated)      │  │                      │  │    │
│  │  │ - RLS Enforced       │  │ - user_has_role()    │  │    │
│  │  │ - JWT Auth           │  │ - user_can_approve() │  │    │
│  │  └──────────────────────┘  │ - is_global_admin()  │  │    │
│  │                             └──────────────────────┘  │    │
│  │  ┌──────────────────────┐                             │    │
│  │  │ Service Client       │                             │    │
│  │  │ (Service Role)       │                             │    │
│  │  │ - Bypass RLS         │                             │    │
│  │  │ - Admin Operations   │                             │    │
│  │  └──────────────────────┘                             │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Route Layer

#### `/api/approval/*` (approval.js)

**Purpose**: Manage section approval workflow progression

**Endpoints**:
- `GET /workflow/:documentId` - Get workflow configuration and progress
- `GET /section/:sectionId/state` - Get section workflow state
- `POST /lock` - Lock section at workflow stage
- `POST /approve` - Approve/reject section
- `POST /progress` - Move section to next stage
- `POST /version` - Create version snapshot
- `GET /versions/:documentId` - List document versions

**Dependencies**:
- `roleAuth` middleware (requireMember, canApproveStage)
- Supabase clients (authenticated + service)
- Joi validation schemas

#### `/api/workflows/*` (Not yet implemented)

**Purpose**: CRUD operations for workflow templates

**Planned Endpoints**:
- `GET /workflows` - List templates for organization
- `POST /workflows` - Create new template
- `GET /workflows/:id` - Get template details
- `PUT /workflows/:id` - Update template
- `DELETE /workflows/:id` - Delete template
- `POST /workflows/:id/stages` - Add stage
- `PUT /workflows/:id/stages/:stageId` - Update stage
- `DELETE /workflows/:id/stages/:stageId` - Delete stage

#### `/dashboard/document/:documentId` (dashboard.js)

**Purpose**: Render document viewer with workflow UI

**Features**:
- Display document sections
- Show workflow progress
- Approval action buttons
- Suggestion management

### 2. Middleware Layer

#### `requireAuth` (dashboard.js)

**Purpose**: Verify user authentication and organization context

**Checks**:
- Session has organizationId
- Supabase JWT is valid (if present)
- User context is set

**Flow**:
```javascript
1. Check req.session.organizationId exists
2. If no org → redirect to /auth/select
3. Validate Supabase JWT (if present)
4. Set req.organizationId for RLS
5. Call next()
```

#### `attachGlobalAdminStatus` (globalAdmin.js)

**Purpose**: Check if user is a global admin

**Sets**:
- `req.isGlobalAdmin` (boolean)
- `req.accessibleOrganizations` (array)

**Logic**:
```javascript
1. Query user_organizations for is_global_admin = true
2. If found → set req.isGlobalAdmin = true
3. Fetch all organizations user can access
4. Call next()
```

#### `canApproveStage` (roleAuth.js)

**Purpose**: Check if user can approve at specific workflow stage

**Logic**:
```javascript
1. Get stage's required_roles from workflow_stages
2. Get user's role from user_organizations
3. Check if user.role IN required_roles
4. Return boolean
```

### 3. Business Logic Layer

#### Workflow Management

**Functions**:

```javascript
// Get document's workflow template and stages
async function getDocumentWorkflow(supabase, documentId) {
  // Query document_workflows + workflow_templates + workflow_stages
  // Return full workflow configuration
}

// Get current workflow state for section
async function getSectionWorkflowState(supabase, sectionId) {
  // Query section_workflow_states
  // Return latest state with stage info
}
```

#### Section State Management

**Operations**:

1. **Lock Section** (POST /approval/lock)
   - Validate user has permission for stage
   - Check section not already locked
   - Create/update section_workflow_state with status='locked'
   - Log activity

2. **Approve/Reject** (POST /approval/approve)
   - Validate user can approve at stage
   - Update section_workflow_state with status
   - Store approval metadata (who, when, notes)
   - Log activity

3. **Progress to Next Stage** (POST /approval/progress)
   - Get current stage from state
   - Find next stage in workflow
   - Validate user can approve at next stage
   - Create new state record for next stage
   - Log activity

#### Version Management

**Operations**:

1. **Create Version Snapshot** (POST /approval/version)
   - Fetch all document sections
   - Fetch all workflow states
   - Create JSON snapshots
   - Generate version number (auto-increment)
   - Store in document_versions table
   - Update document.version field

2. **List Versions** (GET /approval/versions/:documentId)
   - Query document_versions
   - Include creator info
   - Order by created_at DESC

### 4. Data Access Layer

#### Supabase Authenticated Client

**Usage**: User-initiated operations with RLS enforcement

**Configuration**:
```javascript
createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${sessionJWT}` } }
})
```

**RLS Context**: Uses JWT to set auth.uid() for RLS policies

#### Supabase Service Client

**Usage**: Admin operations that bypass RLS

**Configuration**:
```javascript
createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
```

**Use Cases**:
- Junction table inserts (suggestion_sections)
- Activity logging
- Version snapshots
- Global admin operations

---

## Data Flow

### Approval Workflow Progression

```
User Action: Approve Section
         │
         ▼
┌────────────────────────────┐
│  POST /api/approval/approve │
│  Body: { section_id,        │
│          workflow_stage_id, │
│          status, notes }    │
└───────────┬────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Middleware: requireMember     │
│  - Check session auth          │
│  - Validate organization       │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Validate Request (Joi)        │
│  - Required fields present     │
│  - Valid UUIDs                 │
│  - Status in allowed values    │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Check Permission              │
│  canApproveStage(userId,       │
│                  stageId)      │
│  ┌──────────────────────────┐ │
│  │ 1. Get stage.required_roles│
│  │ 2. Get user.role           │
│  │ 3. Check role in required  │
│  └──────────────────────────┘ │
└───────────┬───────────────────┘
            │
            ├─── NO ──▶ 403 Forbidden
            │
            ▼ YES
┌───────────────────────────────┐
│  Upsert section_workflow_state │
│  SET:                          │
│    status = 'approved'         │
│    actioned_by = userId        │
│    actioned_at = NOW()         │
│    notes = notes               │
│    approval_metadata = {...}   │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Log Activity                  │
│  INSERT user_activity_log      │
│  action_type = 'section.approved'
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Return Success                │
│  { success: true,              │
│    message: "Section approved",│
│    state: {...} }              │
└───────────────────────────────┘
```

### Document Version Creation

```
User Action: Create Version
         │
         ▼
┌────────────────────────────┐
│  POST /api/approval/version │
│  Body: { document_id,       │
│          version_name,      │
│          description }      │
└───────────┬───────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Fetch All Document Sections   │
│  SELECT * FROM document_sections
│  WHERE document_id = ?         │
│  ORDER BY path_ordinals        │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Fetch All Workflow States     │
│  SELECT * FROM                 │
│    section_workflow_states     │
│  WHERE section_id IN (...)     │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Create JSON Snapshots         │
│  sections_snapshot = [...secs] │
│  approval_snapshot = [...states]
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Generate Version Number       │
│  current = "1.0"               │
│  new = "1.1" (increment minor) │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Insert document_versions      │
│  version_number = "1.1"        │
│  sections_snapshot = {...}     │
│  approval_snapshot = {...}     │
│  created_by = userId           │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Update documents.version      │
│  UPDATE documents              │
│  SET version = "1.1"           │
│  WHERE id = ?                  │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Log Activity                  │
│  action_type =                 │
│    'document.version_created'  │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│  Return Version Record         │
│  { success: true,              │
│    version: {...} }            │
└───────────────────────────────┘
```

### Permission Check Flow

```
                Request
                   │
                   ▼
       ┌───────────────────────┐
       │ Is user authenticated? │
       └─────┬───────────┬─────┘
             │ NO        │ YES
             ▼           ▼
          ❌ 401    ┌───────────────────────┐
                    │ Get organizationId    │
                    │ from session          │
                    └─────┬─────────────────┘
                          │
                          ▼
                    ┌───────────────────────┐
                    │ Is user in this org?  │
                    └─────┬───────────┬─────┘
                          │ NO        │ YES
                          ▼           ▼
                       ❌ 403    ┌───────────────────────┐
                                 │ Get user.role from    │
                                 │ user_organizations    │
                                 └─────┬─────────────────┘
                                       │
                                       ▼
                                 ┌───────────────────────┐
                                 │ Get stage.required_   │
                                 │ roles from            │
                                 │ workflow_stages       │
                                 └─────┬─────────────────┘
                                       │
                                       ▼
                                 ┌───────────────────────┐
                                 │ Is user.role IN       │
                                 │ required_roles?       │
                                 └─────┬───────────┬─────┘
                                       │ NO        │ YES
                                       ▼           ▼
                                    ❌ 403      ✅ Allow
                                               │
                                               ▼
                                         Execute Operation
                                               │
                                               ▼
                                         Log Activity
                                               │
                                               ▼
                                         Return Success
```

---

## API Reference

### Complete API Endpoint Reference

See [WORKFLOW_API_REFERENCE.md](./WORKFLOW_API_REFERENCE.md) for detailed API documentation including:
- Request/response schemas
- Authentication requirements
- Example requests
- Error codes
- Rate limiting

### Quick Reference

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/approval/workflow/:documentId` | GET | Get workflow progress | Member |
| `/api/approval/section/:sectionId/state` | GET | Get section state | Member |
| `/api/approval/lock` | POST | Lock section | Approver |
| `/api/approval/approve` | POST | Approve/reject section | Approver |
| `/api/approval/progress` | POST | Move to next stage | Approver |
| `/api/approval/version` | POST | Create version snapshot | Member |
| `/api/approval/versions/:documentId` | GET | List versions | Member |

---

## Database Schema

### Core Workflow Tables

#### workflow_templates

```sql
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Define workflow templates per organization

**Indexes**:
- `idx_workflow_templates_org` on (organization_id)
- `idx_workflow_templates_default` on (organization_id, is_default) WHERE is_default = TRUE

**RLS**: Users see templates for their organizations only

#### workflow_stages

```sql
CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  stage_name VARCHAR(255) NOT NULL,
  stage_order INTEGER NOT NULL,

  -- Stage permissions
  can_lock BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  required_roles JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Display settings
  display_color VARCHAR(50),
  icon VARCHAR(50),
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Define stages within a workflow template

**Indexes**:
- `idx_workflow_stages_template` on (workflow_template_id, stage_order)

**RLS**: Users see stages for accessible workflow templates

**required_roles format**:
```json
["admin", "owner"]  // Array of role names
```

#### document_workflows

```sql
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  current_stage_id UUID REFERENCES workflow_stages(id),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_progress',

  UNIQUE(document_id)
);
```

**Purpose**: Link documents to workflow templates

**Indexes**:
- `idx_document_workflows_doc` on (document_id)
- `idx_document_workflows_template` on (workflow_template_id)

**RLS**: Users see workflows for their documents

#### section_workflow_states

```sql
CREATE TABLE section_workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  workflow_stage_id UUID NOT NULL REFERENCES workflow_stages(id),

  -- State info
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  actioned_by UUID REFERENCES users(id),
  actioned_by_email VARCHAR(255),
  actioned_at TIMESTAMP,
  notes TEXT,
  selected_suggestion_id UUID REFERENCES suggestions(id),

  -- Metadata
  approval_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(section_id, workflow_stage_id)
);
```

**Purpose**: Track approval state for each section at each stage

**Indexes**:
- `idx_section_workflow_states_section` on (section_id)
- `idx_section_workflow_states_stage` on (workflow_stage_id)
- `idx_section_workflow_states_status` on (status)

**RLS**: Users see states for their sections

**Status values**:
- `pending` - Awaiting action
- `in_progress` - Being reviewed
- `approved` - Approved at this stage
- `rejected` - Rejected at this stage
- `locked` - Section locked with selected suggestion

### Support Tables

#### document_versions

```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  version_number VARCHAR(50) NOT NULL,
  version_name VARCHAR(255),
  description TEXT,

  -- Snapshots
  sections_snapshot JSONB NOT NULL,
  approval_snapshot JSONB,

  -- Creator info
  created_by UUID REFERENCES users(id),
  created_by_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),

  -- Approval info
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approval_stage VARCHAR(100),

  -- Status
  is_current BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,

  metadata JSONB DEFAULT '{}'::jsonb,

  UNIQUE(document_id, version_number)
);
```

**Purpose**: Version history snapshots

**Indexes**:
- `idx_doc_versions_doc` on (document_id)
- `idx_doc_versions_current` on (document_id, is_current) WHERE is_current = TRUE
- `idx_doc_versions_created` on (created_at)

#### user_activity_log

```sql
CREATE TABLE user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Activity details
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,

  -- Metadata
  action_data JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: Audit trail of all workflow actions

**Indexes**:
- `idx_activity_user` on (user_id)
- `idx_activity_org` on (organization_id)
- `idx_activity_type` on (action_type)
- `idx_activity_created` on (created_at)

**action_type values**:
- `section.locked`
- `section.approved`
- `section.rejected`
- `section.progressed`
- `document.version_created`

### Helper Functions

#### user_has_role()

```sql
CREATE OR REPLACE FUNCTION user_has_role(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_role VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  role_hierarchy JSONB := '{"owner": 4, "admin": 3, "member": 2, "viewer": 1}'::jsonb;
BEGIN
  SELECT role INTO user_role
  FROM user_organizations
  WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND is_active = TRUE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  RETURN (role_hierarchy->>user_role)::int >= (role_hierarchy->>p_required_role)::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Purpose**: Check if user has sufficient role level

**Usage**:
```sql
SELECT user_has_role('user-uuid', 'org-uuid', 'admin');
-- Returns: true if user is admin or owner
```

#### user_can_approve_stage()

```sql
CREATE OR REPLACE FUNCTION user_can_approve_stage(
  p_user_id UUID,
  p_workflow_stage_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
  required_roles JSONB;
  org_id UUID;
BEGIN
  -- Get required roles and organization
  SELECT ws.required_roles, wt.organization_id
  INTO required_roles, org_id
  FROM workflow_stages ws
  JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
  WHERE ws.id = p_workflow_stage_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Get user's role
  SELECT role INTO user_role
  FROM user_organizations
  WHERE user_id = p_user_id
    AND organization_id = org_id
    AND is_active = TRUE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Check if role is in required_roles
  RETURN required_roles ? user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Purpose**: Check if user can approve at specific stage

**Usage**:
```sql
SELECT user_can_approve_stage('user-uuid', 'stage-uuid');
-- Returns: true if user's role is in stage's required_roles
```

### Entity Relationship Diagram

```
organizations
     │
     │ 1:N
     ▼
workflow_templates
     │
     │ 1:N
     ▼
workflow_stages ◀───────┐
     │                  │
     │ 1:N              │ N:1
     ▼                  │
document_workflows      │
     │                  │
     │ 1:1              │
     ▼                  │
documents               │
     │                  │
     │ 1:N              │
     ▼                  │
document_sections       │
     │                  │
     │ 1:N              │
     ▼                  │
section_workflow_states─┘
     │
     │ N:1
     ▼
users (actioned_by)
```

---

## Permission Model

### Role Hierarchy

```
Owner (Level 4)
  │
  ├─ Full control over organization
  ├─ Can approve at any stage
  ├─ Can manage workflow templates
  └─ Can delete organization

Admin (Level 3)
  │
  ├─ Can approve at stages with "admin" role
  ├─ Can manage users
  ├─ Can lock sections
  └─ Cannot delete organization

Member (Level 2)
  │
  ├─ Can create suggestions
  ├─ Can vote on suggestions
  ├─ Can view all documents
  └─ Cannot approve workflow stages

Viewer (Level 1)
  │
  ├─ Read-only access
  ├─ Can view documents
  └─ Cannot create or modify anything
```

### Global Admin

**Special Role**: Platform-wide administrator

**Permissions**:
- Bypass organization membership checks
- Access all organizations
- View and manage global admin dashboard
- Should be granted VERY sparingly (1-2 users max)

**Implementation**:
```javascript
// Middleware sets:
req.isGlobalAdmin = true;
req.accessibleOrganizations = [all orgs];

// RLS policies check:
IF is_global_admin(auth.uid()) THEN ALLOW
```

### Workflow Stage Permissions

Each workflow stage defines:

```json
{
  "stage_name": "Committee Review",
  "can_lock": true,
  "can_edit": false,
  "can_approve": true,
  "requires_approval": true,
  "required_roles": ["admin", "owner"]
}
```

**Permission Checks**:

1. **Can Lock**: Does stage allow locking sections?
2. **Can Edit**: Does stage allow text editing?
3. **Can Approve**: Does stage require approval?
4. **Required Roles**: Which roles can perform actions?

**Enforcement**:
```javascript
// Backend check before allowing approval
if (!await canApproveStage(req, stageId)) {
  return res.status(403).json({ error: 'Not authorized' });
}
```

### RLS Policy Integration

All workflow tables enforce organization isolation via RLS:

```sql
-- Example: workflow_templates
CREATE POLICY "Users see org templates"
  ON workflow_templates FOR SELECT
  USING (
    is_global_admin(auth.uid()) OR
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Key Points**:
- RLS provides defense in depth
- Even with app bugs, data is isolated
- Global admins bypass RLS with `is_global_admin()` function
- Service role bypasses ALL RLS for admin operations

---

## UI Component Hierarchy

### Dashboard Page Structure

```
dashboard/dashboard.ejs
├── Header (Organization selector)
├── Statistics Cards
│   ├── Total Documents
│   ├── Active Sections
│   ├── Pending Suggestions
│   └── Approval Progress
├── Document List
│   ├── Document Card
│   │   ├── Title
│   │   ├── Section Count
│   │   ├── Pending Suggestions
│   │   └── "View" Button → Document Viewer
│   └── ... more cards
└── Recent Activity Feed
```

### Document Viewer Structure

```
dashboard/document-viewer.ejs
├── Document Header
│   ├── Title
│   ├── Version Info
│   └── Workflow Progress Bar
│       ├── Stage 1 Indicator
│       ├── Stage 2 Indicator
│       └── ... Stage N Indicator
├── Section List (Left Panel)
│   ├── Section Card
│   │   ├── Section Number
│   │   ├── Section Title
│   │   ├── Workflow Status Badge
│   │   └── Click → Load Section Detail
│   └── ... more sections
├── Section Detail (Center Panel)
│   ├── Section Header
│   │   ├── Section Number
│   │   ├── Title
│   │   └── Workflow Stage Badge
│   ├── Original Text
│   ├── Current Text (if modified)
│   ├── Workflow Actions
│   │   ├── "Lock Section" (if can_lock)
│   │   ├── "Approve" (if can_approve)
│   │   ├── "Reject" (if can_approve)
│   │   └── "Progress to Next Stage" (if applicable)
│   └── Suggestions List
│       ├── Suggestion Card
│       │   ├── Suggested Text
│       │   ├── Rationale
│       │   ├── Author
│       │   └── "Select" Button
│       └── ... more suggestions
└── Approval History (Right Panel)
    ├── Timeline Entry
    │   ├── Stage Name
    │   ├── Status
    │   ├── Approved By
    │   ├── Approved At
    │   └── Notes
    └── ... more entries
```

### Component Breakdown

#### Workflow Progress Bar Component

**Location**: `views/dashboard/document-viewer.ejs` (or separate component)

**Purpose**: Visual indicator of document progress through workflow stages

**HTML Structure**:
```html
<div class="workflow-progress">
  <div class="progress-stages">
    <!-- Stage 1 -->
    <div class="stage stage-complete">
      <div class="stage-icon">✓</div>
      <div class="stage-name">Committee Review</div>
      <div class="stage-progress">12/15 sections</div>
    </div>

    <!-- Stage 2 (Current) -->
    <div class="stage stage-current">
      <div class="stage-icon">⏳</div>
      <div class="stage-name">Board Approval</div>
      <div class="stage-progress">0/15 sections</div>
    </div>

    <!-- Stage 3 (Pending) -->
    <div class="stage stage-pending">
      <div class="stage-icon">○</div>
      <div class="stage-name">Final Review</div>
      <div class="stage-progress">0/15 sections</div>
    </div>
  </div>

  <div class="overall-progress">
    <div class="progress-bar">
      <div class="progress-fill" style="width: 40%"></div>
    </div>
    <div class="progress-text">40% Complete</div>
  </div>
</div>
```

**JavaScript API**:
```javascript
// Fetch workflow progress
GET /api/approval/workflow/:documentId

// Response:
{
  "workflow": {
    "template": { "id": "...", "name": "Standard Approval" },
    "stages": [
      {
        "id": "stage-1-uuid",
        "stage_name": "Committee Review",
        "stage_order": 1,
        "display_color": "#FFA500"
      },
      // ... more stages
    ]
  },
  "sections": [
    {
      "id": "section-uuid",
      "current_stage": "Committee Review",
      "current_stage_order": 1,
      "status": "approved"
    },
    // ... more sections
  ],
  "progress": {
    "totalSections": 15,
    "completedSections": 6,
    "progressPercentage": 40,
    "stagesCount": 3
  }
}
```

#### Section Workflow Status Badge

**Purpose**: Show current stage and status for a section

**HTML**:
```html
<div class="workflow-badge" data-stage-order="1" data-status="approved">
  <span class="stage-icon" style="background-color: #FFA500">
    <i class="bi bi-users"></i>
  </span>
  <span class="stage-text">Committee Review</span>
  <span class="status-badge status-approved">✓ Approved</span>
</div>
```

**CSS Classes**:
- `.status-pending` - Gray background
- `.status-in_progress` - Blue background
- `.status-approved` - Green background
- `.status-rejected` - Red background
- `.status-locked` - Orange background

#### Approval Action Panel

**Purpose**: Conditional action buttons based on user permissions

**HTML**:
```html
<div class="approval-actions">
  <% if (canApprove && stage.can_approve) { %>
    <button class="btn btn-success" onclick="approveSection()">
      <i class="bi bi-check-circle"></i> Approve
    </button>
    <button class="btn btn-danger" onclick="rejectSection()">
      <i class="bi bi-x-circle"></i> Reject
    </button>
  <% } %>

  <% if (canApprove && stage.can_lock) { %>
    <button class="btn btn-warning" onclick="lockSection()">
      <i class="bi bi-lock"></i> Lock Section
    </button>
  <% } %>

  <% if (canProgress) { %>
    <button class="btn btn-primary" onclick="progressToNextStage()">
      <i class="bi bi-arrow-right"></i> Progress to Next Stage
    </button>
  <% } %>
</div>
```

**JavaScript Functions**:
```javascript
async function approveSection() {
  const result = await fetch('/api/approval/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section_id: currentSectionId,
      workflow_stage_id: currentStageId,
      status: 'approved',
      notes: prompt('Enter approval notes (optional):')
    })
  });

  if (result.ok) {
    showToast('Section approved successfully');
    refreshSectionState();
  }
}

async function lockSection() {
  const selectedSuggestionId = getSelectedSuggestionId();
  const result = await fetch('/api/approval/lock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section_id: currentSectionId,
      workflow_stage_id: currentStageId,
      selected_suggestion_id: selectedSuggestionId,
      notes: prompt('Enter lock notes (optional):')
    })
  });

  if (result.ok) {
    showToast('Section locked successfully');
    refreshSectionState();
  }
}
```

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Integration Tests**: All API endpoints
- **E2E Tests**: Critical user workflows
- **Security Tests**: Permission checks

### Unit Tests

**Location**: `/tests/unit/`

**Test Files**:
- `approval-workflow.test.js` - Workflow logic tests
- `role-permissions.test.js` - Permission check tests
- `version-management.test.js` - Version snapshot tests

**Sample Test**:
```javascript
describe('Approval Workflow', () => {
  describe('canApproveStage()', () => {
    it('should return true for admin in admin-required stage', async () => {
      const userId = 'admin-user-uuid';
      const stageId = 'admin-stage-uuid';

      const result = await canApproveStage(
        { session: { userId, organizationId: 'org-uuid' } },
        stageId
      );

      expect(result).toBe(true);
    });

    it('should return false for member in admin-required stage', async () => {
      const userId = 'member-user-uuid';
      const stageId = 'admin-stage-uuid';

      const result = await canApproveStage(
        { session: { userId, organizationId: 'org-uuid' } },
        stageId
      );

      expect(result).toBe(false);
    });
  });
});
```

### Integration Tests

**Location**: `/tests/integration/`

**Test Files**:
- `approval-workflow-integration.test.js` - Full workflow tests
- `permission-enforcement.test.js` - RLS policy tests

**Sample Test**:
```javascript
describe('POST /api/approval/approve', () => {
  it('should approve section when user has permission', async () => {
    const response = await request(app)
      .post('/api/approval/approve')
      .set('Cookie', adminSessionCookie)
      .send({
        section_id: testSectionId,
        workflow_stage_id: testStageId,
        status: 'approved',
        notes: 'Looks good!'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify state was updated
    const { data } = await supabase
      .from('section_workflow_states')
      .select('status, actioned_by')
      .eq('section_id', testSectionId)
      .eq('workflow_stage_id', testStageId)
      .single();

    expect(data.status).toBe('approved');
    expect(data.actioned_by).toBe(adminUserId);
  });

  it('should reject when user lacks permission', async () => {
    const response = await request(app)
      .post('/api/approval/approve')
      .set('Cookie', memberSessionCookie)
      .send({
        section_id: testSectionId,
        workflow_stage_id: ownerOnlyStageId,
        status: 'approved',
        notes: 'Trying to approve'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('permission');
  });
});
```

### E2E Tests

**Location**: `/tests/e2e/`

**Test Files**:
- `workflow-progression.test.js` - Complete workflow flow
- `multi-stage-approval.test.js` - Multi-stage scenarios

**Sample Test**:
```javascript
describe('Multi-Stage Approval Workflow', () => {
  it('should progress document through all stages', async () => {
    // 1. Admin locks section at Stage 1
    await adminLockSection(sectionId, stage1Id, suggestionId);

    // 2. Admin approves section at Stage 1
    await adminApproveSection(sectionId, stage1Id);

    // 3. Progress to Stage 2 (Board Approval)
    await adminProgressSection(sectionId);

    // 4. Owner approves at Stage 2
    await ownerApproveSection(sectionId, stage2Id);

    // 5. Verify section is fully approved
    const state = await getSectionState(sectionId);
    expect(state.status).toBe('approved');
    expect(state.workflow_stages.stage_order).toBe(2);

    // 6. Create version snapshot
    const version = await createVersion(documentId);
    expect(version.version_number).toBe('1.1');
  });
});
```

### Security Tests

**Location**: `/tests/security/`

**Test Files**:
- `rls-enforcement.test.js` - RLS policy tests
- `permission-bypass-attempts.test.js` - Attack vectors

**Sample Test**:
```javascript
describe('RLS Security', () => {
  it('should prevent cross-org data access', async () => {
    // User A from Org 1 tries to approve section in Org 2
    const response = await request(app)
      .post('/api/approval/approve')
      .set('Cookie', org1UserCookie)
      .send({
        section_id: org2SectionId, // Section from different org
        workflow_stage_id: org2StageId,
        status: 'approved'
      });

    expect(response.status).toBe(403);
  });

  it('should allow global admin to access any org', async () => {
    const response = await request(app)
      .post('/api/approval/approve')
      .set('Cookie', globalAdminCookie)
      .send({
        section_id: anyOrgSectionId,
        workflow_stage_id: anyStageId,
        status: 'approved'
      });

    expect(response.status).toBe(200);
  });
});
```

---

## Performance Considerations

### Database Optimization

#### Indexes

**Critical indexes for workflow queries**:

```sql
-- Workflow template lookups
CREATE INDEX idx_workflow_templates_org
  ON workflow_templates(organization_id);
CREATE INDEX idx_workflow_templates_default
  ON workflow_templates(organization_id, is_default)
  WHERE is_default = TRUE;

-- Stage queries
CREATE INDEX idx_workflow_stages_template
  ON workflow_stages(workflow_template_id, stage_order);

-- Section state queries (most frequent)
CREATE INDEX idx_section_workflow_states_section
  ON section_workflow_states(section_id);
CREATE INDEX idx_section_workflow_states_stage
  ON section_workflow_states(workflow_stage_id);
CREATE INDEX idx_section_workflow_states_status
  ON section_workflow_states(status);

-- Activity log queries
CREATE INDEX idx_activity_created
  ON user_activity_log(created_at);
CREATE INDEX idx_activity_org
  ON user_activity_log(organization_id);
```

#### Materialized Views

**Workflow progress summary** (for dashboard):

```sql
CREATE MATERIALIZED VIEW workflow_progress_summary AS
SELECT
  d.id AS document_id,
  d.organization_id,
  COUNT(ds.id) AS total_sections,
  COUNT(CASE WHEN sws.status = 'approved' THEN 1 END) AS approved_sections,
  ROUND((COUNT(CASE WHEN sws.status = 'approved' THEN 1 END)::numeric /
         NULLIF(COUNT(ds.id), 0)) * 100, 2) AS progress_percentage
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
GROUP BY d.id, d.organization_id;

-- Refresh periodically
CREATE INDEX idx_workflow_progress_org
  ON workflow_progress_summary(organization_id);

-- Refresh on a schedule (e.g., every 5 minutes)
REFRESH MATERIALIZED VIEW CONCURRENTLY workflow_progress_summary;
```

#### Query Optimization

**Avoid N+1 queries**:

```javascript
// ❌ BAD: N+1 queries
const sections = await getSections(documentId);
for (const section of sections) {
  const state = await getSectionState(section.id); // N queries
}

// ✅ GOOD: Single query with JOIN
const sections = await supabase
  .from('document_sections')
  .select(`
    *,
    workflow_states:section_workflow_states (
      status,
      workflow_stage_id,
      actioned_at
    )
  `)
  .eq('document_id', documentId);
```

**Batch operations**:

```javascript
// ✅ GOOD: Bulk approve sections
const sectionIds = [id1, id2, id3];
await supabase
  .from('section_workflow_states')
  .upsert(
    sectionIds.map(id => ({
      section_id: id,
      workflow_stage_id: stageId,
      status: 'approved',
      actioned_by: userId,
      actioned_at: new Date().toISOString()
    })),
    { onConflict: 'section_id,workflow_stage_id' }
  );
```

### Caching Strategy

#### Application-Level Caching

**Workflow templates** (rarely change):

```javascript
const workflowCache = new Map();

async function getWorkflowTemplate(orgId) {
  const cacheKey = `workflow:${orgId}`;

  if (workflowCache.has(cacheKey)) {
    return workflowCache.get(cacheKey);
  }

  const template = await fetchWorkflowTemplate(orgId);
  workflowCache.set(cacheKey, template);

  // Expire cache after 1 hour
  setTimeout(() => workflowCache.delete(cacheKey), 3600000);

  return template;
}
```

#### Database-Level Caching

**PostgreSQL shared_buffers**: Increase for better performance

```sql
-- postgresql.conf
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
```

### Pagination

**Large result sets**:

```javascript
// GET /api/approval/versions/:documentId?limit=20&offset=0
router.get('/versions/:documentId', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  const { data: versions, count } = await supabase
    .from('document_versions')
    .select('*', { count: 'exact' })
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  res.json({
    success: true,
    versions,
    pagination: {
      total: count,
      limit,
      offset,
      hasMore: offset + limit < count
    }
  });
});
```

### Response Times

**Target SLAs**:

| Endpoint Type | Target Response Time | Notes |
|---------------|---------------------|--------|
| GET workflow config | < 200ms | Cacheable |
| GET section state | < 300ms | Frequent query |
| POST approve | < 500ms | Includes DB write + log |
| POST version | < 1000ms | Large JSON snapshots |
| GET activity feed | < 400ms | Paginated |

---

## Security Model

### Defense in Depth Layers

```
┌─────────────────────────────────────────┐
│   1. Transport Layer (HTTPS/TLS)        │
│   - Encrypted communication             │
│   - Certificate validation              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   2. Application Layer                  │
│   - CSRF Protection                     │
│   - Session Management                  │
│   - Input Validation (Joi)              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   3. Authentication Layer               │
│   - Supabase JWT Validation             │
│   - Session Cookie Validation           │
│   - Token Refresh                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   4. Authorization Layer                │
│   - Role-based Access Control (RBAC)    │
│   - Organization Membership Check       │
│   - Workflow Stage Permission Check     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   5. Database Layer (RLS)               │
│   - Row-Level Security Policies         │
│   - Organization Isolation              │
│   - Global Admin Bypass                 │
└─────────────────────────────────────────┘
```

### Authentication Flow

```
User Login
    │
    ▼
┌─────────────────────────────┐
│ Supabase Auth Login         │
│ POST /auth/login            │
│ - Email + Password          │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ Supabase Returns JWT        │
│ - access_token (1hr TTL)    │
│ - refresh_token             │
│ - user object               │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ Server Creates Session      │
│ req.session.supabaseJWT     │
│ req.session.supabaseRefresh │
│ req.session.userId          │
│ req.session.organizationId  │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│ Middleware Validates        │
│ - Check JWT not expired     │
│ - Refresh if needed         │
│ - Set auth context          │
└─────────────────────────────┘
```

### Authorization Enforcement

**Multi-layer checks**:

```javascript
// Layer 1: Middleware (requireMember)
if (!req.session.userId || !req.session.organizationId) {
  return res.status(401).json({ error: 'Not authenticated' });
}

// Layer 2: Organization membership
const { data: membership } = await supabase
  .from('user_organizations')
  .select('role')
  .eq('user_id', userId)
  .eq('organization_id', organizationId)
  .single();

if (!membership) {
  return res.status(403).json({ error: 'Not member of organization' });
}

// Layer 3: Workflow stage permission
const canApprove = await canApproveStage(req, stageId);
if (!canApprove) {
  return res.status(403).json({ error: 'Cannot approve at this stage' });
}

// Layer 4: RLS policy (automatic)
// Database enforces organization isolation
```

### Input Validation

**Joi schemas**:

```javascript
const approveSectionSchema = Joi.object({
  section_id: Joi.string().uuid().required(),
  workflow_stage_id: Joi.string().uuid().required(),
  status: Joi.string().valid('approved', 'rejected', 'in_progress').required(),
  notes: Joi.string().max(5000).optional().allow('')
});

// Validate before processing
const { error, value } = schema.validate(req.body);
if (error) {
  return res.status(400).json({
    error: error.details[0].message
  });
}
```

### CSRF Protection

**Implementation**:

```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: false });

// Skip CSRF for API routes (use JWT instead)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  csrfProtection(req, res, next);
});
```

### SQL Injection Prevention

**Parameterized queries** (Supabase client handles this):

```javascript
// ✅ SAFE: Supabase client uses parameterized queries
await supabase
  .from('section_workflow_states')
  .select('*')
  .eq('section_id', userInput); // Automatically escaped

// ❌ UNSAFE: Raw SQL (never do this)
await supabase.rpc('raw_query', {
  query: `SELECT * FROM sections WHERE id = '${userInput}'`
});
```

### Audit Logging

**Track all sensitive actions**:

```javascript
async function logActivity(supabase, userId, orgId, actionType, entityType, entityId, data) {
  await supabase
    .from('user_activity_log')
    .insert({
      user_id: userId,
      organization_id: orgId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      action_data: data,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
}

// Usage:
await logActivity(
  supabase,
  userId,
  orgId,
  'section.approved',
  'section',
  sectionId,
  { workflow_stage_id: stageId, notes: 'Approved by admin' }
);
```

### Security Best Practices

1. **Never trust client input**: Always validate and sanitize
2. **Use RLS as defense in depth**: Even if app logic fails, RLS protects
3. **Log security events**: Track failed auth, permission denials
4. **Use HTTPS in production**: Set `cookie.secure = true`
5. **Rotate secrets regularly**: Change SESSION_SECRET periodically
6. **Limit global admins**: Only 1-2 trusted users
7. **Audit global admin actions**: Log all cross-org operations
8. **Use service role sparingly**: Only for trusted operations

---

## Deployment Checklist

See [WORKFLOW_DEPLOYMENT_CHECKLIST.md](./WORKFLOW_DEPLOYMENT_CHECKLIST.md) for complete deployment guide.

### Quick Checklist

#### Pre-Deployment

- [ ] Migration 008 reviewed and tested
- [ ] All unit tests passing (90%+ coverage)
- [ ] Integration tests passing
- [ ] Security tests passing
- [ ] RLS policies validated
- [ ] Documentation complete

#### Deployment Steps

- [ ] Backup production database
- [ ] Run migration 008 in production
- [ ] Verify default workflows created for all orgs
- [ ] Deploy updated server.js with workflow routes
- [ ] Deploy approval.js routes
- [ ] Deploy dashboard updates
- [ ] Verify indexes created
- [ ] Test workflow progression end-to-end

#### Post-Deployment

- [ ] Monitor error logs for 24 hours
- [ ] Check workflow creation for new orgs
- [ ] Verify RLS policies enforcing correctly
- [ ] Test multi-tenant isolation
- [ ] User acceptance testing
- [ ] Train admin users on workflow management

#### Rollback Plan

- [ ] Database backup ready for restore
- [ ] Previous server version tagged in git
- [ ] Rollback scripts prepared
- [ ] Monitoring alerts configured

---

## Appendix

### Related Documentation

- [WORKFLOW_USER_GUIDE.md](./WORKFLOW_USER_GUIDE.md) - End-user documentation
- [WORKFLOW_ADMIN_GUIDE.md](./WORKFLOW_ADMIN_GUIDE.md) - Admin guide
- [WORKFLOW_API_REFERENCE.md](./WORKFLOW_API_REFERENCE.md) - API documentation
- [WORKFLOW_DEPLOYMENT_CHECKLIST.md](./WORKFLOW_DEPLOYMENT_CHECKLIST.md) - Deployment guide
- [USER_ROLES_AND_PERMISSIONS.md](./USER_ROLES_AND_PERMISSIONS.md) - Permission model

### Migration References

- `database/migrations/008_enhance_user_roles_and_approval.sql` - Workflow schema

### Code References

- `server.js:218,222` - Global admin middleware integration
- `server.js:234-235` - Approval routes mounted
- `src/routes/approval.js` - Complete approval workflow implementation
- `src/routes/dashboard.js` - Document viewer with workflow UI
- `src/middleware/globalAdmin.js` - Global admin status middleware
- `src/middleware/roleAuth.js` - Role permission checks

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: System Architecture Team
**Review Cycle**: Quarterly or after major changes
