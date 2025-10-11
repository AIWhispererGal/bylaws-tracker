# Setup Wizard API Reference

## Quick Start

```javascript
// Check if setup is needed
GET /setup/status
Response: { step: "welcome", completed: false, progress: 0 }

// If not configured, redirect to:
GET /setup
// Auto-redirects to current step
```

## API Endpoints

### 1. Get Setup Status
```http
GET /setup/status
```

**Response:**
```json
{
  "success": true,
  "status": {
    "step": "organization",
    "completed": false,
    "progress": 10,
    "organizationId": null,
    "hasOrganization": false,
    "hasHierarchy": false,
    "hasWorkflow": false,
    "hasDocument": false
  }
}
```

### 2. Create Organization
```http
POST /setup/organization
Content-Type: application/json

{
  "name": "Reseda Neighborhood Council",
  "type": "neighborhood-council",
  "terminology": {
    "documentName": "Bylaws",
    "sectionName": "Section",
    "articleName": "Article"
  }
}
```

**Response:**
```json
{
  "success": true,
  "organization": {
    "id": "uuid-here",
    "name": "Reseda Neighborhood Council",
    "is_configured": false
  },
  "nextStep": "/setup/document-type"
}
```

### 3. Save Document Configuration
```http
POST /setup/document-type
Content-Type: application/json

{
  "documentName": "Bylaws",
  "hierarchyLevels": [
    {
      "name": "Article",
      "type": "article",
      "numbering": "roman",
      "prefix": "Article ",
      "depth": 0
    },
    {
      "name": "Section",
      "type": "section",
      "numbering": "numeric",
      "prefix": "Section ",
      "depth": 1
    }
  ],
  "maxDepth": 5,
  "allowNesting": true
}
```

**Response:**
```json
{
  "success": true,
  "nextStep": "/setup/workflow"
}
```

### 4. Save Workflow Configuration
```http
POST /setup/workflow
Content-Type: application/json

{
  "name": "Default Workflow",
  "stages": [
    {
      "stage_name": "Committee Review",
      "stage_order": 1,
      "can_lock": true,
      "can_edit": true,
      "can_approve": true,
      "requires_approval": true,
      "display_color": "#FFD700"
    },
    {
      "stage_name": "Board Approval",
      "stage_order": 2,
      "can_lock": false,
      "can_edit": false,
      "can_approve": true,
      "requires_approval": true,
      "display_color": "#90EE90"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "template": {
    "id": "uuid-here",
    "template_name": "Default Workflow",
    "is_default": true
  },
  "nextStep": "/setup/import"
}
```

### 5. Upload and Process Document
```http
POST /setup/import
Content-Type: multipart/form-data

document: [File: bylaws.docx]
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid-here",
    "document_name": "Bylaws",
    "source_file": "setup-1234567890.docx"
  },
  "sectionsCount": 45,
  "metadata": {
    "source": "word",
    "fileName": "bylaws.docx",
    "parsedAt": "2025-10-07T22:00:00.000Z",
    "sectionCount": 45
  },
  "warnings": [],
  "nextStep": "/setup/complete"
}
```

### 6. Complete Setup
```http
POST /setup/complete
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "redirectUrl": "/bylaws"
}
```

## Error Responses

### Validation Error (400)
```json
{
  "success": false,
  "error": "Organization name is required"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Failed to create organization"
}
```

### Not Configured Error (503)
```json
{
  "success": false,
  "error": "Application not configured",
  "redirectUrl": "/setup"
}
```

## Page Routes

### GET Routes (HTML Pages)
- `GET /setup` - Auto-redirect to current step
- `GET /setup/welcome` - Welcome screen
- `GET /setup/organization` - Organization form
- `GET /setup/document-type` - Document structure form
- `GET /setup/workflow` - Workflow configuration
- `GET /setup/import` - Document upload
- `GET /setup/complete` - Success screen

## Session Data Structure

```javascript
req.session.setupData = {
  organizationId: "uuid-here",
  organizationData: {
    name: "Reseda NC",
    type: "neighborhood-council",
    terminology: {...}
  },
  documentConfig: {
    hierarchyLevels: [...],
    maxDepth: 5
  },
  workflowConfig: {
    name: "Default Workflow",
    stages: [...]
  },
  uploadedFile: {
    filename: "setup-123.docx",
    path: "/uploads/setup/setup-123.docx",
    uploadedAt: "2025-10-07T22:00:00.000Z"
  },
  importResult: {
    documentId: "uuid-here",
    sectionsCount: 45
  }
}
```

## File Upload Constraints

- **Max Size:** 10MB
- **Allowed Types:** `.docx` only
- **Upload Path:** `/uploads/setup/`
- **Naming:** `setup-{timestamp}-{random}.docx`
- **Auto-cleanup:** Files deleted after processing

## Navigation Flow

```
Welcome (0%)
    ↓
Organization (20%)
    ↓
Document Type (40%)
    ↓
Workflow (60%)
    ↓
Import Document (80%)
    ↓
Complete (100%)
    ↓
Redirect to /bylaws
```

## Example JavaScript Client

```javascript
// Step 1: Create organization
async function createOrganization() {
  const response = await fetch('/setup/organization', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Reseda Neighborhood Council',
      type: 'neighborhood-council'
    })
  });
  
  const result = await response.json();
  if (result.success) {
    window.location.href = result.nextStep;
  }
}

// Step 2: Upload document
async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('document', file);
  
  const response = await fetch('/setup/import', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  if (result.success) {
    console.log(`Imported ${result.sectionsCount} sections`);
    window.location.href = result.nextStep;
  }
}

// Step 3: Check status
async function checkStatus() {
  const response = await fetch('/setup/status');
  const data = await response.json();
  
  if (data.status.completed) {
    window.location.href = '/bylaws';
  } else {
    console.log(`Progress: ${data.status.progress}%`);
  }
}
```

## Testing with cURL

```bash
# Check status
curl http://localhost:3000/setup/status

# Create organization
curl -X POST http://localhost:3000/setup/organization \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","type":"neighborhood-council"}'

# Upload document
curl -X POST http://localhost:3000/setup/import \
  -F "document=@bylaws.docx"

# Complete setup
curl -X POST http://localhost:3000/setup/complete
```
