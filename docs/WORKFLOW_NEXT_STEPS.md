# Workflow System - Next Implementation Steps

**Status:** Templates ✅ | Backend APIs ✅ | UI Controls ✅ | **Workflow Assignment ❌**

---

## 🎯 What's Already Built

### ✅ Templates & Configuration
- Create/edit workflow templates
- Define stages with permissions
- Set voting requirements (unanimous/majority/supermajority)
- Drag-and-drop stage reordering

### ✅ Backend APIs (Ready to Use)
```javascript
POST   /api/workflow/sections/:id/approve      // Approve section
POST   /api/workflow/sections/:id/reject       // Reject with reason
POST   /api/workflow/sections/:id/lock         // Lock section with suggestion
POST   /api/workflow/sections/:id/advance      // Move to next stage
GET    /api/workflow/sections/:id/state        // Get current workflow state
GET    /api/workflow/sections/:id/history      // View approval history
```

### ✅ UI Components (Already in Document Viewer)
- **Approve** button (green) - Shows when `canApprove && status === 'pending'`
- **Reject** button (red) - Shows when `canReject && status !== 'rejected'`
- **Lock Section** button (blue) - Shows when `canLock && status === 'approved'`
- **View History** button (clock icon) - Always visible
- **Workflow progress bar** - Shows % of sections approved
- **Stage badges** - Shows current stage and status for each section

**Location:** `views/dashboard/document-viewer.ejs:776-811`

---

## ❌ What's NOT Built Yet

### Missing Step 1: Workflow Template Assignment

**Problem:** No way to assign a workflow template to a document

**Solution Needed:**

#### A. Admin UI to Assign Workflow
Create `/admin/documents/:documentId/workflow` page:

```html
<h3>Assign Workflow Template</h3>
<form action="/api/workflow/documents/:id/assign" method="POST">
  <label>Select Workflow Template:</label>
  <select name="templateId">
    <option value="...">Review Process (3 stages)</option>
    <option value="...">Simple Approval (2 stages)</option>
  </select>
  <button>Assign Workflow</button>
</form>
```

#### B. Backend Assignment API
**New Route:** `POST /api/workflow/documents/:id/assign`

```javascript
router.post('/documents/:documentId/assign', requireAuth, requireAdmin, async (req, res) => {
  const { documentId } = req.params;
  const { templateId } = req.body;

  // 1. Create document_workflows record
  await supabase
    .from('document_workflows')
    .insert({
      document_id: documentId,
      workflow_template_id: templateId,
      current_stage_order: 1,
      status: 'in_progress'
    });

  // 2. Get all sections for this document
  const { data: sections } = await supabase
    .from('document_sections')
    .select('id')
    .eq('document_id', documentId);

  // 3. Get first stage from template
  const { data: firstStage } = await supabase
    .from('workflow_stages')
    .select('id')
    .eq('workflow_template_id', templateId)
    .eq('stage_order', 1)
    .single();

  // 4. Initialize workflow state for each section
  const stateInserts = sections.map(section => ({
    section_id: section.id,
    workflow_stage_id: firstStage.id,
    status: 'pending',
    created_at: new Date().toISOString()
  }));

  await supabase
    .from('section_workflow_states')
    .insert(stateInserts);

  res.json({ success: true, message: 'Workflow assigned successfully' });
});
```

---

### Missing Step 2: Permission Calculation Fix

**Problem:** `userCanApproveStage()` function doesn't grant permissions to users properly

**Current Behavior:** Returns `false` for everyone (function exists but may not work correctly)

**Solution:** Fix permission checking in `src/routes/workflow.js`:

```javascript
async function userCanApproveStage(supabase, userId, stageId) {
  try {
    // 1. Get user's role and check if global admin
    const { data: user } = await supabase
      .from('users')
      .select('role, is_global_admin')
      .eq('id', userId)
      .single();

    // 2. Global admin can approve any stage
    if (user.is_global_admin) {
      return true;
    }

    // 3. Get stage's required roles
    const { data: stage } = await supabase
      .from('workflow_stages')
      .select('required_roles, can_approve')
      .eq('id', stageId)
      .single();

    // 4. Check if user's role is in required roles
    if (!stage.can_approve) {
      return false;
    }

    return stage.required_roles.includes(user.role);
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}
```

**Alternative:** Use database RPC function (already exists):

```sql
-- database/functions/user_can_approve_stage.sql
CREATE OR REPLACE FUNCTION user_can_approve_stage(
  p_user_id UUID,
  p_workflow_stage_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role VARCHAR;
  v_is_global_admin BOOLEAN;
  v_required_roles VARCHAR[];
  v_can_approve BOOLEAN;
BEGIN
  -- Get user info
  SELECT role, is_global_admin INTO v_user_role, v_is_global_admin
  FROM users WHERE id = p_user_id;

  -- Global admin can approve everything
  IF v_is_global_admin THEN
    RETURN TRUE;
  END IF;

  -- Get stage requirements
  SELECT required_roles, can_approve INTO v_required_roles, v_can_approve
  FROM workflow_stages WHERE id = p_workflow_stage_id;

  -- Check if user's role is in required roles
  RETURN v_can_approve AND v_user_role = ANY(v_required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Missing Step 3: Dashboard Link

**Add button to document list:**

```html
<!-- In dashboard document list -->
<td>
  <a href="/admin/documents/<%= doc.id %>/workflow" class="btn btn-sm btn-outline-primary">
    <i class="bi bi-diagram-3"></i> Manage Workflow
  </a>
</td>
```

---

## 🧪 Testing Workflow System

### Once Implemented:

**1. Assign Workflow Template**
1. Go to `/admin/documents/:id/workflow`
2. Select a template
3. Click "Assign Workflow"
4. ✅ All sections should get workflow state at Stage 1

**2. Test Approve Action**
1. Open document viewer
2. Expand a section
3. ✅ Should see green "Approve" button (if you're Global Admin or have permission)
4. Click "Approve"
5. Add optional notes
6. ✅ Section should move to Stage 2 or mark as approved

**3. Test Reject Action**
1. Expand a section
2. ✅ Should see red "Reject" button
3. Click "Reject"
4. Enter rejection reason (required)
5. ✅ Section status changes to "rejected"

**4. Test Lock Action**
1. First approve a section
2. ✅ Should now see blue "Lock Section" button
3. Select a suggestion
4. Click "Lock Section"
5. ✅ Section becomes locked and no longer editable

**5. Test History**
1. Click clock icon on any section
2. ✅ Modal shows approval history with timestamps and notes

---

## 📊 Database Schema Check

**Required Tables (should already exist):**
- ✅ `workflow_templates` - Template definitions
- ✅ `workflow_stages` - Stages within templates
- ✅ `document_workflows` - Workflow assignment to documents
- ✅ `section_workflow_states` - Current state of each section

**Optional Enhancement:**
Add columns to `workflow_stages`:
```sql
ALTER TABLE workflow_stages
ADD COLUMN IF NOT EXISTS approval_type VARCHAR(20) DEFAULT 'single',
ADD COLUMN IF NOT EXISTS vote_threshold INTEGER;
```

This enables supermajority/unanimous voting (UI already collects this).

---

## 🎯 Implementation Priority

**P0 (Must Have):**
1. ✅ Fix permission calculation (`userCanApproveStage` function)
2. Create workflow assignment API endpoint
3. Create workflow assignment UI page
4. Add "Manage Workflow" link to dashboard

**P1 (Should Have):**
5. Add workflow status column to document list
6. Show "Workflow: Not Assigned" warning on documents without workflows
7. Email notifications for stage changes

**P2 (Nice to Have):**
8. Bulk workflow assignment (assign to multiple documents)
9. Workflow template duplication
10. Multi-approver voting logic (supermajority/unanimous)
11. Workflow analytics dashboard

---

## 🚀 Quick Start Guide

To get workflows working TODAY:

### Step 1: Fix Permissions (10 minutes)

Edit `src/routes/workflow.js:117-134`:

```javascript
async function userCanApproveStage(supabase, userId, stageId) {
  try {
    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('role, is_global_admin')
      .eq('id', userId)
      .single();

    // Global admin can do everything
    if (user?.is_global_admin) {
      return true;
    }

    // Get stage requirements
    const { data: stage } = await supabase
      .from('workflow_stages')
      .select('required_roles, can_approve')
      .eq('id', stageId)
      .single();

    // Check role match
    return stage?.can_approve && stage?.required_roles?.includes(user?.role);
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}
```

### Step 2: Create Workflow Assignment Route (30 minutes)

Add to `src/routes/workflow.js` (after line 588):

```javascript
/**
 * POST /api/workflow/documents/:documentId/assign
 * Assign workflow template to document and initialize states
 */
router.post('/documents/:documentId/assign', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { templateId } = req.body;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Validate inputs
    if (!templateId) {
      return res.status(400).json({ success: false, error: 'Template ID required' });
    }

    // Check if workflow already assigned
    const { data: existing } = await supabaseService
      .from('document_workflows')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Document already has a workflow assigned'
      });
    }

    // Get template and verify it belongs to organization
    const { data: template, error: templateError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id, name')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get first stage from template
    const { data: firstStage, error: stageError } = await supabaseService
      .from('workflow_stages')
      .select('id')
      .eq('workflow_template_id', templateId)
      .eq('stage_order', 1)
      .single();

    if (stageError || !firstStage) {
      return res.status(400).json({
        success: false,
        error: 'Template has no stages defined'
      });
    }

    // Create document_workflows record
    const { error: workflowError } = await supabaseService
      .from('document_workflows')
      .insert({
        document_id: documentId,
        workflow_template_id: templateId,
        current_stage_order: 1,
        status: 'in_progress'
      });

    if (workflowError) {
      console.error('Error creating document workflow:', workflowError);
      return res.status(500).json({
        success: false,
        error: 'Failed to assign workflow'
      });
    }

    // Get all sections for document
    const { data: sections, error: sectionsError } = await supabaseService
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    if (sectionsError || !sections || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document has no sections'
      });
    }

    // Initialize workflow states for all sections
    const stateInserts = sections.map(section => ({
      section_id: section.id,
      workflow_stage_id: firstStage.id,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { error: statesError } = await supabaseService
      .from('section_workflow_states')
      .insert(stateInserts);

    if (statesError) {
      console.error('Error initializing section states:', statesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize workflow states'
      });
    }

    res.json({
      success: true,
      message: `Workflow "${template.name}" assigned successfully`,
      sectionsInitialized: sections.length
    });
  } catch (error) {
    console.error('Assign workflow error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Step 3: Test Manually (5 minutes)

Use `curl` or Postman to assign workflow:

```bash
# Get your document ID and template ID
curl http://localhost:3000/api/workflow/templates

# Assign workflow to document
curl -X POST http://localhost:3000/api/workflow/documents/{documentId}/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -d '{"templateId": "YOUR_TEMPLATE_ID"}'
```

### Step 4: Reload Document Viewer

1. Go to document viewer
2. Expand a section
3. ✅ **Should now see Approve/Reject buttons!**

---

## 📝 Summary

**What you need to do:**
1. Fix `userCanApproveStage()` function (10 min)
2. Add workflow assignment API endpoint (30 min)
3. Test with curl/Postman (5 min)
4. Create admin UI for workflow assignment (optional, can do later)

**Total time:** ~45 minutes to get it working, then you can approve/reject/lock sections!

Once workflows are assigned to documents, ALL the UI controls will automatically work because they're already built and wired up. The buttons are just hidden because permissions are `false` without initialized workflow states.
