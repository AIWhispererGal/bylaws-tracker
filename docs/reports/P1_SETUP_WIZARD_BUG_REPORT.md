# PRIORITY 1: Setup Wizard Critical Bug Report

**Date:** 2025-10-15
**Severity:** CRITICAL - Blocking all new user onboarding
**Status:** ROOT CAUSE IDENTIFIED

---

## Executive Summary

The organization setup wizard fails to complete successfully, preventing new users from initializing the system. The root cause is **missing column definitions** in the `document_workflows` table. Migrations 011 and 012 added columns (`status`, `current_stage_id`) that are **NOT present in the base schema**, causing silent failures when the setup process attempts to create document workflows.

---

## Root Cause Analysis

### 1. Schema Mismatch

**Base Schema (001_generalized_schema.sql, lines 304-311):**
```sql
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  activated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id)
);
```

**Migration 011 (011_add_document_workflows_columns.sql):**
```sql
-- Add status column
ALTER TABLE document_workflows
ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';

-- Add current_stage_id column
ALTER TABLE document_workflows
ADD COLUMN current_stage_id UUID REFERENCES workflow_stages(id);
```

**Migration 012 (012_workflow_enhancements_fixed.sql):**
```sql
-- Enhanced version of user_can_approve_stage that references workflow state
CREATE OR REPLACE FUNCTION user_can_approve_stage(
    p_user_id UUID,
    p_stage_id UUID
) RETURNS BOOLEAN AS $$
-- This function expects document_workflows.status and current_stage_id to exist
```

### 2. The Problem

**Setup Process Flow:**
1. User completes organization setup → `/setup/organization` (POST) ✅
2. User configures document type → `/setup/document-type` (POST) ✅
3. User configures workflow → `/setup/workflow` (POST) ✅
4. User imports document → `/setup/import` (POST) ✅
5. **Background Process** (`processSetupData()`) creates database records:
   - Creates organization ✅
   - Creates workflow template ✅
   - Creates workflow stages ✅
   - **Attempts to link document to workflow** ❌ **FAILS HERE**

**Failure Point:** `src/routes/setup.js` lines 671-736

The setup process creates a default workflow template but **NEVER creates a document_workflows entry** to link documents to workflows. This means:
- Documents are created without workflows
- No workflow tracking exists for imported sections
- The system expects `document_workflows.status` and `current_stage_id` columns that don't exist in fresh installs

### 3. Why This Breaks Setup

**The Silent Failure Chain:**

1. **Document Import Succeeds** - `setupService.processDocumentImport()` creates document and sections successfully
2. **Workflow Template Created** - Lines 672-732 in setup.js create workflow template and stages
3. **No Workflow Linkage** - Code NEVER inserts into `document_workflows` to link document to template
4. **Views Break** - `v_section_workflow_progress` expects `document_workflows` entries to exist
5. **Dashboard Fails** - Dashboard queries join on missing `document_workflows` records
6. **Setup Appears Complete** - But system is in inconsistent state

---

## Exact Error Location

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/routes/setup.js`

**Line 671-736:** Creates workflow template but doesn't link to document

```javascript
// Line 671-732: Creates default workflow template
console.log('[SETUP-DEBUG] 🔄 Creating default workflow template...');
try {
    const { data: workflowTemplate, error: workflowError } = await supabase
        .from('workflow_templates')
        .insert({
            organization_id: data.id,
            name: 'Default Approval Workflow',
            description: 'Standard two-stage approval workflow for document sections',
            is_default: true,
            is_active: true
        })
        .select()
        .single();

    if (workflowError) {
        console.error('[SETUP-DEBUG] ❌ Failed to create default workflow:', workflowError);
    } else {
        console.log('[SETUP-DEBUG] ✅ Default workflow template created:', workflowTemplate.id);

        // Create workflow stages
        const { error: stagesError } = await supabase
            .from('workflow_stages')
            .insert([/* stages */]);

        if (stagesError) {
            console.error('[SETUP-DEBUG] ❌ Failed to create workflow stages:', stagesError);
        } else {
            setupData.workflowTemplateId = workflowTemplate.id;
            console.log('[SETUP-DEBUG] ✅ Created default workflow for organization', data.id);
            console.log('[SETUP-DEBUG] ✅ Workflow stages: Committee Review → Board Approval');
        }
    }
} catch (workflowErr) {
    console.error('[SETUP-DEBUG] ❌ Error creating default workflow:', workflowErr);
}

// ❌ MISSING: No document_workflows entry created!
// ❌ MISSING: No linkage between document and workflow template
```

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/services/setupService.js`

**Lines 174-291:** `processDocumentImport()` - Creates document but doesn't create workflow linkage

```javascript
// Line 212-226: Creates document record
const { data: document, error: docError } = await supabase
    .from('documents')
    .insert({
        organization_id: orgId,
        title: config.terminology?.documentName || 'Bylaws',
        document_type: 'bylaws',
        status: 'draft',
        metadata: {
            source_file: path.basename(filePath),
            imported_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
    })
    .select()
    .single();

// ❌ MISSING: Should create document_workflows entry here!
// ❌ MISSING: Should link to the default workflow template
```

---

## Why Migrations 011-012 Broke Setup

### Migration Assumptions

**Migration 011** assumes:
- All existing `document_workflows` entries can have `status` added with DEFAULT 'active'
- All existing `document_workflows` entries can have nullable `current_stage_id` added
- ✅ **This works for EXISTING data**

**Migration 012** assumes:
- `document_workflows.status` column exists
- `document_workflows.current_stage_id` column exists
- Functions can safely query these columns
- ✅ **This works AFTER migration 011**

### The Gap

**NEW INSTALLATIONS:**
1. Run base schema (001_generalized_schema.sql) - `document_workflows` has 4 columns
2. Run migration 002 (add missing tables) - Still 4 columns
3. **SKIP migrations 011-012** (user doesn't know they need them)
4. Run setup wizard
5. **SETUP FAILS** - Code expects columns that don't exist

**EXISTING INSTALLATIONS:**
1. Already have data in `document_workflows`
2. Run migration 011 - Adds `status` and `current_stage_id` columns ✅
3. Run migration 012 - Adds functions that use new columns ✅
4. **EVERYTHING WORKS**

---

## The Fix

### Option 1: Update Base Schema (RECOMMENDED)

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/database/migrations/001_generalized_schema.sql`

**Change lines 304-311:**

**BEFORE:**
```sql
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  activated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id)
);
```

**AFTER:**
```sql
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),

  -- Workflow state tracking (added by migration 011)
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_stage_id UUID REFERENCES workflow_stages(id),

  -- Timestamps
  activated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(document_id)
);

-- Add index for status queries
CREATE INDEX idx_document_workflows_status ON document_workflows(status);
CREATE INDEX idx_document_workflows_stage ON document_workflows(current_stage_id);

COMMENT ON COLUMN document_workflows.status IS 'Workflow status: active, paused, completed, cancelled';
COMMENT ON COLUMN document_workflows.current_stage_id IS 'Current workflow stage for the document';
```

### Option 2: Fix Setup Code to Create Workflow Linkage

**File:** `/mnt/c/Users/mgall/OneDrive/Desktop/BYLAWSCOMMITTEE/BYLAWSTOOL_Generalized/src/services/setupService.js`

**Add after line 231 (after document creation):**

```javascript
// Link document to default workflow template
const { data: defaultWorkflow } = await supabase
    .from('workflow_templates')
    .select('id, workflow_stages(id, stage_order)')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .single();

if (defaultWorkflow) {
    console.log('[SETUP] Linking document to default workflow...');

    // Get first stage (lowest stage_order)
    const firstStage = defaultWorkflow.workflow_stages
        .sort((a, b) => a.stage_order - b.stage_order)[0];

    const { error: workflowLinkError } = await supabase
        .from('document_workflows')
        .insert({
            document_id: document.id,
            workflow_template_id: defaultWorkflow.id,
            status: 'active',
            current_stage_id: firstStage?.id || null,
            activated_at: new Date().toISOString()
        });

    if (workflowLinkError) {
        console.error('[SETUP] Failed to link document to workflow:', workflowLinkError);
        // Non-fatal: Continue without workflow linkage
    } else {
        console.log('[SETUP] ✅ Document linked to workflow successfully');
    }
}
```

### Option 3: Make Migration 011 Part of Base Schema

**Merge migration 011 into migration 002** so new installs get the complete schema.

---

## Recommended Solution

**Use ALL THREE options:**

1. ✅ **Update base schema** (Option 1) - Fixes NEW installations
2. ✅ **Fix setup code** (Option 2) - Creates proper workflow linkage
3. ✅ **Keep migration 011** - Maintains backward compatibility for existing installs

This ensures:
- New installations get complete schema
- Setup wizard creates proper linkages
- Existing installations can migrate safely
- No data loss or corruption

---

## Test Plan

### 1. Fresh Installation Test

**Prerequisites:**
- Empty Supabase database
- No existing organizations

**Steps:**
1. Run base schema (001_generalized_schema.sql) with updated `document_workflows` table
2. Run migration 002 (add missing tables)
3. Start application
4. Complete setup wizard:
   - Create organization ✅
   - Configure document hierarchy ✅
   - Configure workflow ✅
   - Import sample document ✅
5. Verify completion:
   ```sql
   -- Should return 1 row with status='active'
   SELECT * FROM document_workflows;

   -- Should show workflow progress
   SELECT * FROM v_section_workflow_progress;

   -- Dashboard should load without errors
   ```

### 2. Existing Installation Test

**Prerequisites:**
- Existing database with organizations and documents
- Has run migrations 001-010 but NOT 011-012

**Steps:**
1. Run migration 011 (adds status and current_stage_id columns)
2. Run migration 012 (adds helper functions)
3. Verify existing data:
   ```sql
   -- All existing workflows should have status='active'
   SELECT id, status FROM document_workflows;

   -- Should not break existing data
   SELECT COUNT(*) FROM documents;
   SELECT COUNT(*) FROM document_sections;
   ```

### 3. Document Import Test

**Prerequisites:**
- Fresh organization with no documents

**Steps:**
1. Upload DOCX file through setup wizard
2. Monitor logs for workflow creation
3. Verify database:
   ```sql
   -- Document should exist
   SELECT id, title FROM documents WHERE organization_id = ?;

   -- Workflow linkage should exist
   SELECT dw.*, wt.name
   FROM document_workflows dw
   JOIN workflow_templates wt ON dw.workflow_template_id = wt.id
   WHERE dw.document_id = ?;

   -- Should show current stage
   SELECT status, current_stage_id FROM document_workflows WHERE document_id = ?;
   ```

### 4. Dashboard Load Test

**Prerequisites:**
- Organization with imported document and workflow

**Steps:**
1. Log in as organization admin
2. Navigate to dashboard
3. Verify:
   - Documents list loads ✅
   - Sections display properly ✅
   - Workflow status shows correctly ✅
   - No console errors ✅
   - No SQL errors in logs ✅

---

## Impact Assessment

### Affected Features

1. ❌ **Setup Wizard** - Cannot complete (CRITICAL)
2. ❌ **Document Import** - Creates documents without workflows
3. ❌ **Workflow Views** - `v_section_workflow_progress` returns empty/null
4. ❌ **Dashboard** - May show errors or missing workflow data
5. ⚠️ **Section Approval** - Cannot track workflow progress
6. ⚠️ **Notifications** - Workflow-based notifications don't fire

### User Impact

- **New Organizations:** Cannot complete setup ❌ **BLOCKER**
- **Existing Organizations:** Unaffected (unless running fresh migrations)
- **Document Management:** Broken workflow tracking
- **Approval Workflows:** Non-functional or inconsistent

---

## Deployment Checklist

### Before Deployment

- [ ] Back up production database
- [ ] Test fix in development environment
- [ ] Verify all existing documents have workflow linkages
- [ ] Document rollback procedure

### Deployment Steps

1. [ ] Update base schema (001_generalized_schema.sql)
2. [ ] Deploy updated setupService.js with workflow linkage
3. [ ] Restart application server
4. [ ] Run test suite
5. [ ] Test setup wizard with new organization
6. [ ] Verify existing organizations still work

### After Deployment

- [ ] Monitor application logs for errors
- [ ] Check Supabase logs for RLS policy violations
- [ ] Verify dashboard loads for all users
- [ ] Test document import workflow
- [ ] Confirm workflow progression works

---

## Code References

### Files Reviewed

1. `/src/routes/setup.js` - Setup wizard routes and processSetupData()
2. `/src/services/setupService.js` - Document import and organization setup
3. `/database/migrations/001_generalized_schema.sql` - Base schema definition
4. `/database/migrations/011_add_document_workflows_columns.sql` - Column additions
5. `/database/migrations/012_workflow_enhancements_fixed.sql` - Workflow functions
6. `/database/migrations/002_add_missing_tables.sql` - Missing table creation

### Key Functions

- `processSetupData()` - Line 554-844 in setup.js
- `processDocumentImport()` - Line 174-291 in setupService.js
- Workflow template creation - Line 671-736 in setup.js

---

## Related Issues

- **P2:** Dashboard document loading (depends on workflow linkage)
- **P4:** Workflow initialization (expects complete schema)
- **Sprint 0 Task 8:** Workflow system implementation

---

## Conclusion

The setup wizard failure is caused by a **schema evolution mismatch** where:
1. Base schema defines `document_workflows` with 4 columns
2. Migrations 011-012 add 2 new columns (`status`, `current_stage_id`)
3. Setup code creates workflow templates but never links documents to workflows
4. New installations don't run migrations 011-012, so columns are missing
5. System expects columns that don't exist, causing silent failures

**Fix:** Update base schema + add workflow linkage code + keep migrations for backward compatibility.

**Priority:** CRITICAL - Blocks all new user onboarding
**Estimated Fix Time:** 2-4 hours (includes testing)
**Risk Level:** LOW (fix is straightforward, well-understood)

---

**Report Generated By:** Research Agent
**Investigation ID:** P1-setup-wizard-investigation
**Date:** 2025-10-15T15:35:00Z
