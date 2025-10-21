# Workflow Assignment Guide - Quick Start

**Status:** ✅ READY TO USE (Server restarted with new features)
**Date:** October 15, 2025

---

## 🎯 What Was Just Implemented

### Three-Part Implementation (All Complete)

**1. Permission Fix** ✅
- Fixed `userCanApproveStage()` function in `src/routes/workflow.js:134-176`
- Global Admins now bypass role restrictions
- Can approve/reject/lock sections at any stage

**2. Assignment API** ✅
- New endpoint: `POST /api/workflow/documents/:documentId/assign`
- Creates `document_workflows` record
- Initializes all `section_workflow_states` at Stage 1
- Location: `src/routes/workflow.js:734-876`

**3. Assignment UI** ✅
- New page: `/admin/documents/:documentId/assign-workflow`
- Template selection with live stage preview
- AJAX submission with success feedback
- Files: `views/admin/workflow-assign.ejs`, `src/routes/admin.js:376-455`

---

## 🚀 How to Test Workflow Assignment

### Step 1: Access the Assignment Page

**Method A - Direct URL:**
```
http://localhost:3000/admin/documents/{YOUR_DOCUMENT_ID}/assign-workflow
```

**Method B - From Dashboard:**
*(Coming soon - "Manage Workflow" button will be added to document list)*

### Step 2: Assign a Workflow Template

1. **Select a Template** from the dropdown
   - Shows template name and number of stages
   - Default templates marked with ⭐

2. **Preview Stages**
   - Stages list appears automatically
   - Shows stage order, name, and permissions
   - Color-coded badges

3. **Click "Assign Workflow"**
   - AJAX submission
   - Success message shows:
     - Template name
     - Initial stage name
     - Number of sections initialized

4. **Automatic Redirect**
   - Redirects to document viewer: `/dashboard/documents/{id}`

### Step 3: Verify Workflow Actions

1. **Open Document Viewer**
   ```
   http://localhost:3000/dashboard/documents/{YOUR_DOCUMENT_ID}
   ```

2. **Expand a Section**
   - Click section to expand
   - **Should now see workflow action buttons:**
     - 🟢 **Approve** button (green) - For pending sections
     - 🔴 **Reject** button (red) - For any non-rejected section
     - 🔵 **Lock Section** button (blue) - For approved sections (if stage allows locking)

3. **Test Approve Action**
   - Click "Approve" button
   - Enter optional notes
   - Click "Approve"
   - Section advances to next stage or marks as approved

4. **Test Reject Action**
   - Click "Reject" button
   - Enter rejection reason (required)
   - Click "Reject"
   - Section status changes to "rejected"

5. **Test Lock Action**
   - First approve a section
   - Select a suggestion to lock
   - Click "Lock Section"
   - Section becomes locked and no longer editable

---

## 📊 Database Changes

### What Gets Created on Assignment

**1. document_workflows table:**
```sql
document_id: {uuid}
workflow_template_id: {uuid}
current_stage_order: 1
status: 'in_progress'
created_at: {timestamp}
```

**2. section_workflow_states table:**
*(One record per section)*
```sql
section_id: {uuid}
workflow_stage_id: {first_stage_uuid}
status: 'pending'
created_at: {timestamp}
```

### Check Assignment Status

```sql
-- Check if document has workflow assigned
SELECT * FROM document_workflows WHERE document_id = '{YOUR_DOC_ID}';

-- Check section states
SELECT
  ds.section_number,
  ds.heading,
  sws.status,
  ws.stage_name
FROM document_sections ds
JOIN section_workflow_states sws ON ds.id = sws.section_id
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE ds.document_id = '{YOUR_DOC_ID}'
ORDER BY ds.section_number;
```

---

## 🔐 Permission Logic

### Global Admin
```javascript
if (user.is_global_admin) {
  return true; // Can approve, reject, lock any section at any stage
}
```

### Role-Based Permissions
```javascript
// Check if user's role is in stage's required_roles array
if (stage.can_approve && stage.required_roles.includes(user.role)) {
  return true;
}
```

### Button Visibility Logic
```javascript
// Approve button
if (permissions.canApprove && state.status === 'pending') { show() }

// Reject button
if (permissions.canReject && state.status !== 'rejected') { show() }

// Lock button
if (permissions.canLock && state.status === 'approved' && stage.can_lock) { show() }
```

---

## 🐛 Troubleshooting

### Buttons Not Showing?

**Check 1: Is workflow assigned?**
```bash
curl http://localhost:3000/api/workflow/documents/{DOC_ID}/state
```
Should return workflow info, not 404.

**Check 2: Are you logged in as Global Admin?**
- Check session: `req.user.is_global_admin === true`
- Check database: `SELECT is_global_admin FROM users WHERE id = '{USER_ID}'`

**Check 3: Are sections expanded?**
- Buttons only show when section is expanded
- Click section header to expand

### Assignment Fails?

**Error: "Document already has a workflow assigned"**
- Each document can only have one workflow
- Remove existing workflow first (not yet implemented)

**Error: "Template has no stages defined"**
- Go to `/admin/workflows`
- Edit template and add stages
- Must have at least 1 stage

**Error: "Document has no sections"**
- Upload document first
- Parser must extract sections
- Check: `SELECT * FROM document_sections WHERE document_id = '{DOC_ID}'`

---

## 📝 API Reference

### Assign Workflow
```bash
POST /api/workflow/documents/:documentId/assign
Content-Type: application/json

{
  "templateId": "uuid-of-workflow-template"
}

# Response
{
  "success": true,
  "message": "Workflow \"Review Process\" assigned successfully to document",
  "data": {
    "templateName": "Review Process",
    "initialStage": "Initial Review",
    "sectionsInitialized": 15
  }
}
```

### Get Section State
```bash
GET /api/workflow/sections/:sectionId/state

# Response
{
  "success": true,
  "state": {
    "status": "pending",
    "workflow_stage": {
      "stage_name": "Initial Review",
      "display_color": "#007bff",
      "icon": "eye"
    }
  },
  "permissions": {
    "canApprove": true,
    "canReject": true,
    "canLock": false,
    "canEdit": true
  }
}
```

### Approve Section
```bash
POST /api/workflow/sections/:sectionId/approve
Content-Type: application/json

{
  "notes": "Looks good, approved"
}

# Response
{
  "success": true,
  "message": "Section approved and advanced to next stage",
  "nextStage": "Final Review"
}
```

---

## 🎉 Success Checklist

- [ ] Navigate to workflow assignment page
- [ ] See list of available templates
- [ ] Select a template and see stage preview
- [ ] Click "Assign Workflow" successfully
- [ ] Redirect to document viewer
- [ ] Expand a section
- [ ] **See green "Approve" button**
- [ ] **See red "Reject" button**
- [ ] Click "Approve" and see success message
- [ ] Section status updates to next stage
- [ ] Workflow progress bar shows percentage

**If all checked:** ✅ Workflow system is fully operational!

---

## 📖 Related Documentation

- `docs/WORKFLOW_NEXT_STEPS.md` - Implementation roadmap
- `docs/WORKFLOW_BUGS_FIXED.md` - Bug fix history
- `docs/WORKFLOW_UI_IMPLEMENTATION.md` - UI component guide
- `docs/WORKFLOW_SYSTEM_COMPLETE.md` - System architecture

---

**Generated:** October 15, 2025
**Server Status:** Running on http://localhost:3000
**Features:** All workflow assignment features active
