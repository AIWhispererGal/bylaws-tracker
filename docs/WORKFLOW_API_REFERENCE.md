# Workflow System API Reference

**Version:** 1.0
**Last Updated:** 2025-10-14
**Base URL:** `/api/approval`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Error Handling](#error-handling)
3. [Workflow Endpoints](#workflow-endpoints)
4. [Section State Endpoints](#section-state-endpoints)
5. [Approval Actions](#approval-actions)
6. [Version Management](#version-management)
7. [Rate Limiting](#rate-limiting)
8. [Webhook Integration](#webhook-integration)

---

## Authentication

### Required Authentication

All API endpoints require:

1. **Express Session Cookie**: Valid logged-in session
2. **Organization Context**: `req.session.organizationId` must be set
3. **Supabase JWT** (optional): Enhanced security for RLS enforcement

### Authentication Headers

```http
Cookie: connect.sid=s%3A<session-id>
Content-Type: application/json
```

### Authentication Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Not authenticated | No valid session found |
| 403 | Not authorized | User lacks required permissions |
| 403 | Not organization member | User not in current organization |

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "details": {
    "field": "section_id",
    "issue": "UUID format invalid"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | OK | Successful request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists or locked |
| 500 | Server Error | Internal server error |

### Validation Errors

Joi validation errors return 400 with detailed field errors:

```json
{
  "success": false,
  "error": "\"section_id\" is required"
}
```

---

## Workflow Endpoints

### GET /workflow/:documentId

Get workflow configuration and progress for a document.

#### Request

```http
GET /api/approval/workflow/550e8400-e29b-41d4-a716-446655440000
```

#### Response (200 OK)

```json
{
  "success": true,
  "workflow": {
    "template": {
      "id": "template-uuid",
      "name": "Standard Approval Process",
      "description": "Two-stage approval: Committee → Board",
      "is_default": true,
      "is_active": true
    },
    "stages": [
      {
        "id": "stage-1-uuid",
        "stage_name": "Committee Review",
        "stage_order": 1,
        "can_lock": true,
        "can_edit": false,
        "can_approve": true,
        "requires_approval": true,
        "required_roles": ["admin", "owner"],
        "display_color": "#FFA500",
        "icon": "users",
        "description": "Committee reviews and selects suggestions"
      },
      {
        "id": "stage-2-uuid",
        "stage_name": "Board Approval",
        "stage_order": 2,
        "can_lock": true,
        "can_edit": false,
        "can_approve": true,
        "requires_approval": true,
        "required_roles": ["owner"],
        "display_color": "#28A745",
        "icon": "check-circle",
        "description": "Final board approval"
      }
    ]
  },
  "sections": [
    {
      "id": "section-1-uuid",
      "section_number": "1.1",
      "section_title": "Purpose",
      "workflow_states": [
        {
          "workflow_stage_id": "stage-1-uuid",
          "status": "approved",
          "actioned_by": "user-uuid",
          "actioned_at": "2025-10-14T10:30:00Z",
          "workflow_stages": {
            "stage_name": "Committee Review",
            "stage_order": 1
          }
        }
      ],
      "current_stage": "Board Approval",
      "current_stage_order": 2,
      "status": "pending"
    }
  ],
  "progress": {
    "totalSections": 20,
    "completedSections": 8,
    "progressPercentage": 40,
    "stagesCount": 2
  }
}
```

#### Error Responses

```json
// 404 Not Found
{
  "success": false,
  "error": "No workflow configured for this document"
}
```

---

### GET /section/:sectionId/state

Get current workflow state and history for a specific section.

#### Request

```http
GET /api/approval/section/650e8400-e29b-41d4-a716-446655440000/state
```

#### Response (200 OK)

```json
{
  "success": true,
  "section": {
    "id": "section-uuid",
    "document_id": "document-uuid",
    "section_number": "2.3",
    "section_title": "Membership Requirements"
  },
  "workflow": {
    "id": "template-uuid",
    "name": "Standard Approval Process",
    "workflow_stages": [
      {
        "id": "stage-1-uuid",
        "stage_name": "Committee Review",
        "stage_order": 1,
        "can_lock": true,
        "can_approve": true,
        "required_roles": ["admin", "owner"]
      },
      {
        "id": "stage-2-uuid",
        "stage_name": "Board Approval",
        "stage_order": 2,
        "can_lock": true,
        "can_approve": true,
        "required_roles": ["owner"]
      }
    ]
  },
  "states": [
    {
      "id": "state-1-uuid",
      "workflow_stage_id": "stage-1-uuid",
      "status": "approved",
      "actioned_by": "user-1-uuid",
      "actioned_by_email": "admin@org.com",
      "actioned_at": "2025-10-14T10:00:00Z",
      "notes": "Approved after committee review",
      "workflow_stages": {
        "stage_name": "Committee Review",
        "stage_order": 1
      },
      "users": {
        "email": "admin@org.com",
        "name": "Admin User"
      }
    },
    {
      "id": "state-2-uuid",
      "workflow_stage_id": "stage-2-uuid",
      "status": "pending",
      "actioned_by": null,
      "workflow_stages": {
        "stage_name": "Board Approval",
        "stage_order": 2
      }
    }
  ],
  "userCanApprove": ["stage-1-uuid"]
}
```

---

## Section State Endpoints

### POST /lock

Lock a section at a specific workflow stage.

#### Request

```http
POST /api/approval/lock
Content-Type: application/json

{
  "section_id": "section-uuid",
  "workflow_stage_id": "stage-uuid",
  "selected_suggestion_id": "suggestion-uuid",
  "notes": "Selected suggestion #2 for clarity"
}
```

#### Request Body Schema

```typescript
{
  section_id: string;           // UUID (required)
  workflow_stage_id: string;    // UUID (required)
  selected_suggestion_id?: string | null;  // UUID (optional)
  notes?: string;               // Max 5000 chars (optional)
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Section locked successfully",
  "state": {
    "id": "state-uuid",
    "section_id": "section-uuid",
    "workflow_stage_id": "stage-uuid",
    "status": "locked",
    "actioned_by": "user-uuid",
    "actioned_by_email": "admin@org.com",
    "actioned_at": "2025-10-14T11:00:00Z",
    "notes": "Selected suggestion #2 for clarity",
    "selected_suggestion_id": "suggestion-uuid",
    "approval_metadata": {
      "locked_at": "2025-10-14T11:00:00Z",
      "locked_by": "user-uuid",
      "selected_suggestion": "suggestion-uuid"
    }
  }
}
```

#### Error Responses

```json
// 400 Bad Request
{
  "success": false,
  "error": "Section is already locked at this stage"
}

// 403 Forbidden
{
  "success": false,
  "error": "You do not have permission to lock sections at this workflow stage"
}
```

---

### POST /approve

Approve or reject a section at a workflow stage.

#### Request

```http
POST /api/approval/approve
Content-Type: application/json

{
  "section_id": "section-uuid",
  "workflow_stage_id": "stage-uuid",
  "status": "approved",
  "notes": "Approved after review"
}
```

#### Request Body Schema

```typescript
{
  section_id: string;        // UUID (required)
  workflow_stage_id: string; // UUID (required)
  status: "approved" | "rejected" | "in_progress";  // (required)
  notes?: string;            // Max 5000 chars (optional)
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Section approved successfully",
  "state": {
    "id": "state-uuid",
    "section_id": "section-uuid",
    "workflow_stage_id": "stage-uuid",
    "status": "approved",
    "actioned_by": "user-uuid",
    "actioned_by_email": "owner@org.com",
    "actioned_at": "2025-10-14T12:00:00Z",
    "notes": "Approved after review",
    "approval_metadata": {
      "approved_at": "2025-10-14T12:00:00Z",
      "approved_by": "user-uuid",
      "approval_status": "approved"
    }
  }
}
```

#### Error Responses

```json
// 403 Forbidden
{
  "success": false,
  "error": "You do not have permission to approve at this workflow stage"
}
```

---

### POST /progress

Progress a section to the next workflow stage.

#### Request

```http
POST /api/approval/progress
Content-Type: application/json

{
  "section_id": "section-uuid",
  "notes": "Ready for board approval"
}
```

#### Request Body Schema

```typescript
{
  section_id: string;  // UUID (required)
  notes?: string;      // Max 5000 chars (optional)
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Section progressed to Board Approval",
  "state": {
    "id": "new-state-uuid",
    "section_id": "section-uuid",
    "workflow_stage_id": "next-stage-uuid",
    "status": "in_progress",
    "actioned_by": "user-uuid",
    "actioned_by_email": "admin@org.com",
    "actioned_at": "2025-10-14T13:00:00Z",
    "notes": "Ready for board approval"
  },
  "nextStage": {
    "id": "next-stage-uuid",
    "stage_name": "Board Approval",
    "stage_order": 2,
    "required_roles": ["owner"]
  }
}
```

#### Error Responses

```json
// 400 Bad Request
{
  "success": false,
  "error": "Section is already at the final workflow stage"
}

// 403 Forbidden
{
  "success": false,
  "error": "You do not have permission to progress to the next workflow stage"
}

// 404 Not Found
{
  "success": false,
  "error": "Section not found"
}

// 404 Not Found
{
  "success": false,
  "error": "No workflow configured for this document"
}
```

---

## Approval Actions

### Approval Workflow Sequence

```
1. Lock section (optional)
   POST /lock
   ↓
2. Approve section
   POST /approve
   ↓
3. Progress to next stage
   POST /progress
   ↓
4. Repeat steps 2-3 for each stage
   ↓
5. Create version snapshot (optional)
   POST /version
```

### Bulk Operations

**Not yet implemented** - planned features:

```http
// Approve multiple sections at once
POST /api/approval/bulk-approve
{
  "section_ids": ["uuid1", "uuid2", "uuid3"],
  "workflow_stage_id": "stage-uuid",
  "status": "approved",
  "notes": "Bulk approval"
}

// Progress all sections in document
POST /api/approval/progress-all
{
  "document_id": "doc-uuid",
  "notes": "Moving all to next stage"
}
```

---

## Version Management

### POST /version

Create a version snapshot of a document at current approval state.

#### Request

```http
POST /api/approval/version
Content-Type: application/json

{
  "document_id": "document-uuid",
  "version_name": "v1.1 - Board Approved",
  "description": "All sections approved by board",
  "approval_stage": "Board Approval"
}
```

#### Request Body Schema

```typescript
{
  document_id: string;    // UUID (required)
  version_name?: string;  // Max 255 chars (optional)
  description?: string;   // Max 5000 chars (optional)
  approval_stage?: string; // Max 100 chars (optional)
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Document version created successfully",
  "version": {
    "id": "version-uuid",
    "document_id": "document-uuid",
    "version_number": "1.1",
    "version_name": "v1.1 - Board Approved",
    "description": "All sections approved by board",
    "sections_snapshot": [...],  // Full JSON snapshot
    "approval_snapshot": [...],  // Full JSON snapshot
    "created_by": "user-uuid",
    "created_by_email": "owner@org.com",
    "created_at": "2025-10-14T14:00:00Z",
    "approval_stage": "Board Approval",
    "metadata": {
      "created_at": "2025-10-14T14:00:00Z",
      "sections_count": 20,
      "approval_states_count": 40
    }
  }
}
```

#### Error Responses

```json
// 404 Not Found
{
  "success": false,
  "error": "Document not found"
}
```

---

### GET /versions/:documentId

List all version snapshots for a document.

#### Request

```http
GET /api/approval/versions/550e8400-e29b-41d4-a716-446655440000
```

#### Response (200 OK)

```json
{
  "success": true,
  "versions": [
    {
      "id": "version-2-uuid",
      "document_id": "document-uuid",
      "version_number": "1.1",
      "version_name": "v1.1 - Board Approved",
      "description": "All sections approved",
      "created_by": "user-uuid",
      "created_by_email": "owner@org.com",
      "created_at": "2025-10-14T14:00:00Z",
      "approval_stage": "Board Approval",
      "is_current": true,
      "is_published": false,
      "users": {
        "email": "owner@org.com",
        "name": "Owner User"
      }
    },
    {
      "id": "version-1-uuid",
      "document_id": "document-uuid",
      "version_number": "1.0",
      "version_name": "v1.0 - Initial",
      "description": "Initial document version",
      "created_by": "user-uuid",
      "created_at": "2025-10-01T10:00:00Z",
      "approval_stage": "Committee Review",
      "is_current": false,
      "is_published": false,
      "users": {
        "email": "admin@org.com",
        "name": "Admin User"
      }
    }
  ]
}
```

---

## Rate Limiting

### Current Limits

**No rate limiting** is currently enforced.

**Recommended Limits** (for future implementation):

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|--------|
| GET /workflow/:documentId | 100 req | 1 min | Read-heavy |
| GET /section/:sectionId/state | 100 req | 1 min | Read-heavy |
| POST /lock | 30 req | 1 min | Write operation |
| POST /approve | 30 req | 1 min | Write operation |
| POST /progress | 30 req | 1 min | Write operation |
| POST /version | 10 req | 1 min | Expensive operation |
| GET /versions/:documentId | 50 req | 1 min | Read-heavy |

### Rate Limit Headers (Future)

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634123456
```

### Rate Limit Exceeded Response (Future)

```json
{
  "success": false,
  "error": "Rate limit exceeded. Try again in 60 seconds.",
  "retry_after": 60
}
```

---

## Webhook Integration

### Future Feature: Workflow Event Webhooks

**Not yet implemented** - planned features:

#### Configuring Webhooks

```http
POST /api/webhooks
{
  "url": "https://your-app.com/webhook",
  "events": ["section.approved", "section.rejected", "document.version_created"],
  "secret": "webhook-signing-secret"
}
```

#### Webhook Payload

```json
{
  "event": "section.approved",
  "timestamp": "2025-10-14T15:00:00Z",
  "organization_id": "org-uuid",
  "data": {
    "section_id": "section-uuid",
    "document_id": "document-uuid",
    "workflow_stage_id": "stage-uuid",
    "actioned_by": "user-uuid",
    "actioned_by_email": "admin@org.com",
    "notes": "Approved after review"
  },
  "signature": "sha256=..."
}
```

#### Webhook Events

- `section.locked` - Section locked with suggestion
- `section.approved` - Section approved at stage
- `section.rejected` - Section rejected
- `section.progressed` - Section moved to next stage
- `document.version_created` - Version snapshot created
- `workflow.completed` - All sections fully approved

---

## Example Use Cases

### Use Case 1: Check Section Status

```javascript
// Get section's current workflow state
const response = await fetch('/api/approval/section/section-uuid/state');
const { section, states, userCanApprove } = await response.json();

// Check if user can approve at current stage
const currentState = states[states.length - 1];
const canApprove = userCanApprove.includes(currentState.workflow_stage_id);

if (canApprove) {
  // Show approve button
} else {
  // Hide approve button
}
```

### Use Case 2: Approve Section

```javascript
// User clicks "Approve" button
async function approveSection(sectionId, stageId) {
  const response = await fetch('/api/approval/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      section_id: sectionId,
      workflow_stage_id: stageId,
      status: 'approved',
      notes: 'Looks good!'
    })
  });

  if (response.ok) {
    const data = await response.json();
    alert(data.message);
    refreshPage();
  } else {
    const error = await response.json();
    alert('Error: ' + error.error);
  }
}
```

### Use Case 3: Create Version Snapshot

```javascript
// After all sections approved, create version
async function createVersion(documentId) {
  const response = await fetch('/api/approval/version', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      version_name: 'v1.1 - Board Approved',
      description: 'All sections approved by board',
      approval_stage: 'Board Approval'
    })
  });

  if (response.ok) {
    const { version } = await response.json();
    console.log('Version created:', version.version_number);
  }
}
```

### Use Case 4: Progress Document Through Workflow

```javascript
// Progress all approved sections to next stage
async function progressDocument(documentId) {
  // 1. Get all sections
  const workflowResponse = await fetch(`/api/approval/workflow/${documentId}`);
  const { sections } = await workflowResponse.json();

  // 2. Filter approved sections
  const approvedSections = sections.filter(s => s.status === 'approved');

  // 3. Progress each section
  for (const section of approvedSections) {
    await fetch('/api/approval/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_id: section.id,
        notes: 'Auto-progress to next stage'
      })
    });
  }

  console.log(`Progressed ${approvedSections.length} sections`);
}
```

---

## Appendix

### HTTP Status Code Reference

| Code | Name | Meaning |
|------|------|---------|
| 200 | OK | Successful GET/PUT/POST |
| 201 | Created | Resource created (POST) |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict (already exists/locked) |
| 422 | Unprocessable Entity | Valid syntax but semantic error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Temporary unavailability |

### Content-Type Headers

**Request**:
```http
Content-Type: application/json
```

**Response**:
```http
Content-Type: application/json; charset=utf-8
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: API Team
**Feedback**: api-docs@your-org.com
