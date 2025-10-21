# Priority 4 Workflow System Audit Report
**Date:** 2025-10-15
**Scope:** Document approval workflow templates, stages, and state tracking
**Status:** ⚠️ CRITICAL ISSUES FOUND

---

## Executive Summary

This audit examined the document approval workflow system introduced in migrations 008 and 012. The system implements a configurable N-stage state machine for tracking section approvals through customizable workflow stages.

**Key Findings:**
- ✅ Schema design is sound and well-structured
- ✅ Migration 012 helper functions are robust
- ⚠️ Schema inconsistencies between migration files
- ⚠️ Missing column issues in section_workflow_states
- ⚠️ Default workflow creation logic needs verification
- ⚠️ RLS policies incomplete for workflow tables

---

## 1. Schema Review

### 1.1 Workflow Templates Table

**Definition (001_generalized_schema.sql lines 250-261):**
```sql
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, name)
);
```

**Assessment:** ✅ GOOD
- Proper multi-tenant isolation with organization_id
- Unique constraint prevents duplicate workflow names per org
- Audit fields (created_at, updated_at) present
- is_default flag allows one default workflow per org

**Recommendation:** Add column for `template_name` alias (migration 011 uses this name but base schema uses `name`).

---

### 1.2 Workflow Stages Table

**Definition (001_generalized_schema.sql lines 269-296):**
```sql
CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER NOT NULL,
  can_lock BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  required_roles JSONB DEFAULT '["admin"]'::jsonb,
  display_color VARCHAR(7),
  icon VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workflow_template_id, stage_order),
  UNIQUE(workflow_template_id, stage_name),
  CHECK(stage_order > 0)
);
```

**Assessment:** ✅ EXCELLENT
- Flexible role-based permissions via JSONB
- Capability flags (can_lock, can_edit, can_approve) enable fine-grained control
- Stage ordering enforced via unique constraint
- Proper foreign key cascade on template deletion

**Strengths:**
1. Support for N-stage workflows (not hardcoded to 2)
2. Required roles stored as JSONB array for flexibility
3. Display metadata (color, icon) for UI rendering
4. Sequential order guarantees via CHECK constraint

---

### 1.3 Section Workflow States Table

**Definition (001_generalized_schema.sql lines 317-337):**
```sql
CREATE TABLE section_workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  workflow_stage_id UUID NOT NULL REFERENCES workflow_stages(id),
  status VARCHAR(50) NOT NULL, -- 'pending', 'approved', 'rejected', 'locked', 'in_progress'
  actioned_by UUID REFERENCES users(id),
  actioned_by_email VARCHAR(255),
  actioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  selected_suggestion_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(section_id, workflow_stage_id)
);
```

**Assessment:** ⚠️ SCHEMA INCONSISTENCY DETECTED

**Issues Found:**

1. **Column Name Mismatch (CRITICAL):**
   - Base schema uses: `actioned_by`, `actioned_at`
   - Migration 012 BACKUP uses: `approved_by`, `approved_at` (lines 80-81)
   - Migration 012 FIXED uses: `actioned_by`, `actioned_at` (lines 81-82)
   - Code in approval.js uses: `actioned_by`, `actioned_at`

   **Impact:** Migration 012_BACKUP would fail if run against base schema.

2. **Missing approval_metadata Column (CRITICAL):**
   - Base schema: NO approval_metadata column
   - Migration 008 adds: `approval_metadata JSONB DEFAULT '{}'::jsonb` (line 85)
   - Migration 012 expects: approval_metadata exists for storing JSON
   - Code extensively uses: `approval_metadata` field

   **Impact:** Migration 012 will fail if 008 hasn't been run first.

3. **Unique Constraint Limitation:**
   ```sql
   UNIQUE(section_id, workflow_stage_id)
   ```
   This means a section can only have ONE state per stage. This prevents:
   - Re-submitting a rejected section at the same stage
   - Tracking approval history at each stage

   **Design Question:** Is this intentional? If sections can be rejected and resubmitted, this constraint blocks that.

---

### 1.4 Document Workflows Table

**Definition (001_generalized_schema.sql lines 304-311):**
```sql
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  activated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id)
);
```

**Assessment:** ⚠️ INCOMPLETE

**Missing Columns (Added in 011_add_document_workflows_columns.sql):**
- `status` VARCHAR(50) - Workflow status (active, paused, completed, cancelled)
- `current_stage_id` UUID - Current workflow stage for the document
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

**Impact:** Migration 012 references these columns in materialized view (line 485-486):
```sql
dw.current_stage_id,
ws.stage_name AS current_stage_name
```

**Recommendation:** Migration 011 must run before 012, or merge these into base schema.

---

## 2. Helper Functions Analysis (Migration 012)

### 2.1 is_global_admin(p_user_id UUID)

**Purpose:** Check if user has global admin privileges
**Security:** SECURITY DEFINER, search_path = public
**Assessment:** ✅ SECURE

**Logic:**
```sql
RETURN EXISTS (
  SELECT 1 FROM user_organizations
  WHERE user_id = p_user_id
    AND is_global_admin = TRUE
    AND is_active = TRUE
);
```

**Strengths:**
- Proper SECURITY DEFINER usage to bypass RLS
- Checks is_active flag to prevent deactivated admins
- Simple boolean return (no data leakage)

**Security Analysis:** Safe - no SQL injection risk, typed parameters, read-only.

---

### 2.2 user_can_approve_stage(p_user_id UUID, p_stage_id UUID)

**Purpose:** Check if user has permission to approve at specific workflow stage
**Security:** SECURITY DEFINER, search_path = public
**Assessment:** ✅ EXCELLENT

**Logic Flow:**
1. Check if user is global admin (bypass all checks)
2. Get required roles for stage from workflow_stages
3. Get user's role in the stage's organization
4. Check if user role is in required roles (JSONB containment)

**Code:**
```sql
-- Global admins can approve anything
IF is_global_admin(p_user_id) THEN
  RETURN TRUE;
END IF;

-- Get required roles for this stage
SELECT ws.required_roles, wt.organization_id
INTO v_required_roles, v_org_id
FROM workflow_stages ws
JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
WHERE ws.id = p_stage_id;

-- Get user's role in this organization
SELECT role INTO v_user_role
FROM user_organizations
WHERE user_id = p_user_id
  AND organization_id = v_org_id
  AND is_active = TRUE;

-- Check if user's role is in required roles
RETURN v_required_roles ? v_user_role;
```

**Strengths:**
- Global admin override at top
- Proper JOIN to get organization context
- JSONB containment operator (?) for role check
- is_active check prevents deactivated users

**Potential Issue:** No caching mechanism. Repeated calls will query database each time.

---

### 2.3 get_section_workflow_stage(p_section_id UUID)

**Purpose:** Get current workflow stage for a section
**Assessment:** ✅ GOOD

**Returns:** TABLE with stage details + state info

**Logic:**
```sql
RETURN QUERY
SELECT ws.id, ws.stage_name, ws.stage_order, ws.can_lock,
       ws.can_approve, sws.status, sws.actioned_by, sws.actioned_at
FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.section_id = p_section_id
ORDER BY sws.created_at DESC
LIMIT 1;
```

**Issue:** Uses `actioned_by` and `actioned_at` which don't exist in base schema but are added in migration 008.

**Recommendation:** Document dependency chain: 001 → 008 → 012

---

### 2.4 calculate_document_progress(p_document_id UUID)

**Purpose:** Calculate workflow progress statistics for a document
**Assessment:** ✅ EXCELLENT

**Returns:**
- total_sections
- approved_sections
- pending_sections
- rejected_sections
- progress_percentage

**Optimization:** Uses DISTINCT ON to get most recent state per section (efficient).

**Strength:** Proper aggregation with conditional counting.

---

### 2.5 advance_section_to_next_stage(p_section_id UUID, p_approved_by UUID, p_notes TEXT)

**Purpose:** Advance section to next workflow stage
**Assessment:** ✅ ROBUST

**Logic:**
1. Get current stage and order
2. Find next stage by stage_order
3. Mark current stage as 'approved'
4. Create new state for next stage or mark as 'completed'

**Strength:** Handles end-of-workflow gracefully (returns NULL when no next stage).

**Code:**
```sql
IF v_next_stage_id IS NULL THEN
  UPDATE section_workflow_states
  SET status = 'completed', updated_at = NOW()
  WHERE section_id = p_section_id AND workflow_stage_id = v_current_stage_id;
  RETURN NULL;
END IF;
```

**Recommendation:** Add transaction handling for atomic updates.

---

### 2.6 get_user_pending_approvals(p_user_id UUID, p_organization_id UUID)

**Purpose:** Get all sections pending approval that user can approve
**Assessment:** ✅ EXCELLENT

**Optimization:** Uses `user_can_approve_stage` function in WHERE clause.

**Performance Concern:** Calls `user_can_approve_stage` for EVERY pending section. With many sections, this could be slow.

**Recommendation:** Consider materialized view or caching for large datasets.

---

### 2.7 get_section_workflow_history(p_section_id UUID)

**Purpose:** Get complete workflow history for a section
**Assessment:** ✅ GOOD

**Returns:** All workflow states ordered by created_at ASC

**Use Case:** Audit trail, approval timeline display

---

### 2.8 bulk_approve_document_sections(p_document_id UUID, p_approved_by UUID, p_notes TEXT)

**Purpose:** Approve all pending sections in a document
**Assessment:** ✅ GOOD with caveat

**Logic:**
```sql
UPDATE section_workflow_states sws
SET status = 'approved', actioned_by = p_approved_by, ...
FROM document_sections ds
WHERE sws.section_id = ds.id
  AND ds.document_id = p_document_id
  AND sws.status = 'pending'
  AND user_can_approve_stage(p_approved_by, sws.workflow_stage_id);
```

**Caveat:** Calls `user_can_approve_stage` for each row. For 100 sections, this is 100 function calls.

**Recommendation:** Optimize with JOIN to pre-filter sections user can approve.

---

### 2.9 reset_section_workflow(p_section_id UUID, p_reset_by UUID, p_reason TEXT)

**Purpose:** Reset workflow state back to first stage
**Assessment:** ✅ GOOD

**Use Cases:** Testing, reprocessing rejected sections

**Logic:**
1. Get first stage of workflow
2. Delete all existing workflow states
3. Create new initial state

**Strength:** Logs reset action in workflow_audit_log.

**Concern:** Deletes audit history. Consider archiving instead.

---

### 2.10 lock_section_atomic(p_section_id, p_stage_id, p_user_id, p_suggestion_id, p_notes)

**Purpose:** Atomically lock a section at workflow stage (race condition prevention)
**Assessment:** ✅ EXCELLENT - PRODUCTION READY

**Race Condition Protection:**
```sql
-- Check for existing lock with row lock
SELECT * INTO existing_lock
FROM section_workflow_states
WHERE section_id = p_section_id AND workflow_stage_id = p_stage_id
  AND status = 'locked'
FOR UPDATE NOWAIT;  -- Fail immediately if locked by another transaction
```

**Upsert Logic:**
```sql
INSERT INTO section_workflow_states (...)
VALUES (...)
ON CONFLICT (section_id, workflow_stage_id) DO UPDATE
SET status = CASE
  WHEN section_workflow_states.status = 'locked' THEN section_workflow_states.status
  ELSE 'locked'
END
WHERE section_workflow_states.status != 'locked'
RETURNING id INTO v_new_state_id;
```

**Error Handling:**
- `lock_not_available` → LOCK_CONTENTION
- `unique_violation` → SECTION_LOCKED

**Strength:** Industry-standard atomic lock pattern with proper error codes.

---

## 3. Default Workflow Creation Logic

### 3.1 Migration 008 Default Workflow

**Location:** 008_enhance_user_roles_and_approval.sql lines 311-374

**Logic:**
```sql
FOR org_record IN SELECT id, name FROM organizations
LOOP
  IF NOT EXISTS (
    SELECT 1 FROM workflow_templates WHERE organization_id = org_record.id
  ) THEN
    -- Create default workflow template
    INSERT INTO workflow_templates (
      organization_id, name, description, is_default, is_active
    ) VALUES (
      org_record.id,
      'Standard Approval Process',
      'Two-stage approval: Committee Review → Board Approval',
      TRUE, TRUE
    ) RETURNING id INTO template_id;

    -- Create Stage 1: Committee Review
    INSERT INTO workflow_stages (...) VALUES (
      template_id, 'Committee Review', 1,
      TRUE, FALSE, TRUE, TRUE,
      '["admin", "owner"]'::jsonb, '#FFA500', 'users',
      'Committee reviews and selects preferred suggestions'
    );

    -- Create Stage 2: Board Approval
    INSERT INTO workflow_stages (...) VALUES (
      template_id, 'Board Approval', 2,
      TRUE, FALSE, TRUE, TRUE,
      '["owner"]'::jsonb, '#28A745', 'check-circle',
      'Final board approval for amendments'
    );
  END IF;
END LOOP;
```

**Assessment:** ✅ SOLID

**Default Workflow:**
1. **Committee Review** (Stage 1)
   - Roles: admin, owner
   - Can lock: YES
   - Can edit: NO
   - Can approve: YES

2. **Board Approval** (Stage 2)
   - Roles: owner only
   - Can lock: YES
   - Can edit: NO
   - Can approve: YES

**Strength:** Only creates workflow if none exists (idempotent).

---

### 3.2 Setup Service Default Workflow

**Location:** src/services/setupService.js lines 107-169

**Logic:**
```javascript
async saveWorkflowConfig(orgId, workflowConfig, supabase) {
  // Create workflow template
  const { data: template } = await supabase
    .from('workflow_templates')
    .insert({
      organization_id: orgId,
      template_name: workflowConfig.name || 'Default Workflow',
      is_default: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  // Create workflow stages
  const stages = workflowConfig.stages || [
    {
      stage_name: 'Committee Review',
      stage_order: 1,
      can_lock: true,
      can_edit: true,
      can_approve: true,
      requires_approval: true,
      display_color: '#FFD700'
    },
    {
      stage_name: 'Board Approval',
      stage_order: 2,
      can_lock: false,
      can_edit: false,
      can_approve: true,
      requires_approval: true,
      display_color: '#90EE90'
    }
  ];
}
```

**Assessment:** ⚠️ SCHEMA MISMATCH

**Issues:**
1. Uses `template_name` but base schema expects `name`
2. Missing `is_active` flag (defaults to TRUE in schema)
3. Missing `description` field

**Recommendation:** Update setupService.js to match base schema:
```javascript
template_name: workflowConfig.name || 'Default Workflow',  // WRONG
name: workflowConfig.name || 'Default Workflow',          // CORRECT
```

---

## 4. Issues Found

### 4.1 CRITICAL: Schema Column Inconsistencies

**Problem:** Multiple column name mismatches between migrations

| Location | Expected Column | Actual Column | Status |
|----------|----------------|---------------|--------|
| Base schema | `actioned_by` | ✅ Present | OK |
| Migration 012_BACKUP | `approved_by` | ❌ Wrong | FAILS |
| Migration 012_FIXED | `actioned_by` | ✅ Correct | OK |
| workflow_templates | `name` | ✅ Present | OK |
| setupService.js | `template_name` | ❌ Wrong | FAILS |

**Impact:** Production failures if wrong migration or code runs.

---

### 4.2 CRITICAL: Missing approval_metadata Column

**Problem:** Base schema doesn't include `approval_metadata` column on `section_workflow_states`.

**Added in:** Migration 008 line 85
```sql
ALTER TABLE section_workflow_states ADD COLUMN approval_metadata JSONB DEFAULT '{}'::jsonb;
```

**Used extensively in:**
- Migration 012 helper functions
- src/routes/approval.js
- src/routes/workflow.js

**Recommendation:** Add to base schema or ensure migration 008 runs first.

---

### 4.3 MEDIUM: Unique Constraint on section_workflow_states

**Problem:** `UNIQUE(section_id, workflow_stage_id)` prevents multiple states per stage.

**Use Case Blocked:** Section rejected at Stage 1 → fixed → resubmitted at Stage 1

**Current Behavior:** INSERT fails with unique violation.

**Options:**
1. Keep constraint, use UPDATE for resubmissions
2. Remove constraint, track state history with timestamps
3. Add status check to constraint: `UNIQUE WHERE status = 'active'`

**Recommendation:** Option 3 - partial unique index allows history while preventing duplicates:
```sql
CREATE UNIQUE INDEX idx_section_stage_active
  ON section_workflow_states(section_id, workflow_stage_id)
  WHERE status IN ('pending', 'in_progress');
```

---

### 4.4 MEDIUM: Missing RLS Policies for Workflow Tables

**Tables with RLS enabled but no policies:**

1. **workflow_stages** - ❌ No SELECT policy
2. **document_workflows** - ❌ No SELECT policy
3. **section_workflow_states** - ❌ No SELECT/INSERT/UPDATE policies

**Impact:** Users with RLS enforcement cannot query these tables.

**Recommended Policies:**

```sql
-- workflow_stages: Users can see stages for workflows in their orgs
CREATE POLICY "Users see stages in their organization workflows"
  ON workflow_stages FOR SELECT
  USING (
    workflow_template_id IN (
      SELECT id FROM workflow_templates wt
      WHERE wt.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

-- document_workflows: Users can see workflows for their documents
CREATE POLICY "Users see workflows for accessible documents"
  ON document_workflows FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

-- section_workflow_states: Users can see states for their documents
CREATE POLICY "Users see workflow states in their organizations"
  ON section_workflow_states FOR SELECT
  USING (
    section_id IN (
      SELECT ds.id FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      WHERE d.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

-- section_workflow_states: Users can create states if they can approve
CREATE POLICY "Users can create workflow states for sections they can approve"
  ON section_workflow_states FOR INSERT
  WITH CHECK (
    user_can_approve_stage(auth.uid(), workflow_stage_id)
  );

-- section_workflow_states: Users can update states they created
CREATE POLICY "Users can update their own workflow state actions"
  ON section_workflow_states FOR UPDATE
  USING (actioned_by = auth.uid())
  WITH CHECK (actioned_by = auth.uid());
```

---

### 4.5 LOW: Performance Concerns in Bulk Operations

**Problem:** `bulk_approve_document_sections` and `get_user_pending_approvals` call `user_can_approve_stage` for each row.

**Impact:** O(n) function calls where n = number of sections.

**Recommendation:** Use JOIN-based filtering instead:
```sql
-- Optimized bulk approve
UPDATE section_workflow_states sws
SET status = 'approved', actioned_by = p_approved_by, ...
FROM document_sections ds
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
JOIN workflow_templates wt ON ws.workflow_template_id = wt.id
JOIN user_organizations uo ON wt.organization_id = uo.organization_id
WHERE sws.section_id = ds.id
  AND ds.document_id = p_document_id
  AND sws.status = 'pending'
  AND uo.user_id = p_approved_by
  AND uo.is_active = TRUE
  AND (ws.required_roles ? uo.role OR is_global_admin(p_approved_by));
```

---

## 5. Recommended Fixes

### 5.1 SQL Patch for Schema Fixes

**File:** `database/migrations/017_workflow_schema_fixes.sql`

```sql
-- Migration 017: Workflow Schema Fixes
-- Date: 2025-10-15
-- Purpose: Fix schema inconsistencies and add missing RLS policies

-- ============================================================================
-- PART 1: FIX MISSING COLUMNS
-- ============================================================================

-- Ensure document_workflows has required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'document_workflows'
                 AND column_name = 'status') THEN
    ALTER TABLE document_workflows ADD COLUMN status VARCHAR(50) DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'document_workflows'
                 AND column_name = 'current_stage_id') THEN
    ALTER TABLE document_workflows
      ADD COLUMN current_stage_id UUID REFERENCES workflow_stages(id);
  END IF;
END $$;

-- Ensure section_workflow_states has approval_metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'section_workflow_states'
                 AND column_name = 'approval_metadata') THEN
    ALTER TABLE section_workflow_states
      ADD COLUMN approval_metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================================
-- PART 2: FIX UNIQUE CONSTRAINT TO ALLOW RESUBMISSIONS
-- ============================================================================

-- Drop old constraint
ALTER TABLE section_workflow_states
  DROP CONSTRAINT IF EXISTS section_workflow_states_section_id_workflow_stage_id_key;

-- Add partial unique index (only for active states)
CREATE UNIQUE INDEX IF NOT EXISTS idx_section_stage_active_unique
  ON section_workflow_states(section_id, workflow_stage_id)
  WHERE status IN ('pending', 'in_progress', 'locked');

COMMENT ON INDEX idx_section_stage_active_unique IS
  'Prevents duplicate active states while allowing historical records for resubmissions';

-- ============================================================================
-- PART 3: ADD MISSING RLS POLICIES
-- ============================================================================

-- Workflow stages
DROP POLICY IF EXISTS "Users see stages in their organization workflows" ON workflow_stages;
CREATE POLICY "Users see stages in their organization workflows"
  ON workflow_stages FOR SELECT
  USING (
    workflow_template_id IN (
      SELECT id FROM workflow_templates wt
      WHERE wt.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

-- Document workflows
DROP POLICY IF EXISTS "Users see workflows for accessible documents" ON document_workflows;
CREATE POLICY "Users see workflows for accessible documents"
  ON document_workflows FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

-- Section workflow states - SELECT
DROP POLICY IF EXISTS "Users see workflow states in their organizations" ON section_workflow_states;
CREATE POLICY "Users see workflow states in their organizations"
  ON section_workflow_states FOR SELECT
  USING (
    section_id IN (
      SELECT ds.id FROM document_sections ds
      JOIN documents d ON ds.document_id = d.id
      WHERE d.organization_id IN (
        SELECT organization_id FROM user_organizations
        WHERE user_id = auth.uid() AND is_active = TRUE
      )
    )
  );

-- Section workflow states - INSERT
DROP POLICY IF EXISTS "Users can create workflow states for sections they can approve" ON section_workflow_states;
CREATE POLICY "Users can create workflow states for sections they can approve"
  ON section_workflow_states FOR INSERT
  WITH CHECK (
    user_can_approve_stage(auth.uid(), workflow_stage_id)
  );

-- Section workflow states - UPDATE
DROP POLICY IF EXISTS "Users can update their own workflow state actions" ON section_workflow_states;
CREATE POLICY "Users can update their own workflow state actions"
  ON section_workflow_states FOR UPDATE
  USING (actioned_by = auth.uid() OR is_global_admin(auth.uid()))
  WITH CHECK (actioned_by = auth.uid() OR is_global_admin(auth.uid()));

-- ============================================================================
-- PART 4: ADD PERFORMANCE INDEXES
-- ============================================================================

-- Index for workflow progress queries
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_status_created
  ON section_workflow_states(status, created_at DESC)
  WHERE status IN ('pending', 'in_progress');

-- Index for user pending approvals
CREATE INDEX IF NOT EXISTS idx_section_workflow_states_stage_status
  ON section_workflow_states(workflow_stage_id, status)
  WHERE status = 'pending';

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 017 Completed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '✅ Added missing columns to document_workflows';
  RAISE NOTICE '✅ Added approval_metadata to section_workflow_states';
  RAISE NOTICE '✅ Fixed unique constraint to allow resubmissions';
  RAISE NOTICE '✅ Added missing RLS policies for workflow tables';
  RAISE NOTICE '✅ Added performance indexes';
  RAISE NOTICE '========================================';
END $$;
```

---

### 5.2 Code Fix for setupService.js

**File:** `src/services/setupService.js` line 114

**Current (WRONG):**
```javascript
template_name: workflowConfig.name || 'Default Workflow',
```

**Fixed (CORRECT):**
```javascript
name: workflowConfig.name || 'Default Workflow',
description: workflowConfig.description || 'Two-stage approval: Committee Review → Board Approval',
is_active: true,
```

---

## 6. Test Scenarios

### 6.1 Template CRUD Operations

```sql
-- Test 1: Create workflow template
INSERT INTO workflow_templates (organization_id, name, description, is_default, is_active)
VALUES ('org-uuid', 'Custom Workflow', 'Three-stage approval', TRUE, TRUE)
RETURNING id;

-- Test 2: Create stages
INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, required_roles)
VALUES
  ('template-id', 'Legal Review', 1, '["owner", "admin"]'::jsonb),
  ('template-id', 'Committee Approval', 2, '["admin"]'::jsonb),
  ('template-id', 'Board Ratification', 3, '["owner"]'::jsonb);

-- Test 3: Verify stage ordering
SELECT stage_name, stage_order FROM workflow_stages
WHERE workflow_template_id = 'template-id'
ORDER BY stage_order;

-- Expected: Legal Review (1), Committee Approval (2), Board Ratification (3)
```

---

### 6.2 Section Progression Through Workflow

```sql
-- Test 1: Initialize section at first stage
INSERT INTO section_workflow_states (section_id, workflow_stage_id, status)
VALUES ('section-uuid', 'stage-1-uuid', 'pending');

-- Test 2: Approve at stage 1
UPDATE section_workflow_states
SET status = 'approved', actioned_by = 'user-uuid', actioned_at = NOW()
WHERE section_id = 'section-uuid' AND workflow_stage_id = 'stage-1-uuid';

-- Test 3: Advance to stage 2
SELECT advance_section_to_next_stage('section-uuid', 'user-uuid', 'Looks good!');

-- Test 4: Verify progression
SELECT stage_name, status FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.section_id = 'section-uuid'
ORDER BY sws.created_at;

-- Expected: Stage 1 (approved), Stage 2 (pending)
```

---

### 6.3 Permission Checking

```sql
-- Test 1: Check user can approve (should return TRUE)
SELECT user_can_approve_stage('admin-user-uuid', 'stage-1-uuid');

-- Test 2: Check user cannot approve (should return FALSE)
SELECT user_can_approve_stage('viewer-user-uuid', 'stage-3-uuid');

-- Test 3: Check global admin (should always return TRUE)
SELECT user_can_approve_stage('global-admin-uuid', 'any-stage-uuid');
```

---

### 6.4 Bulk Approval

```sql
-- Test 1: Approve all pending sections in document
SELECT bulk_approve_document_sections('document-uuid', 'admin-uuid', 'Batch approval');

-- Expected: Returns count of approved sections

-- Test 2: Verify bulk approval results
SELECT section_id, status, actioned_by FROM section_workflow_states
WHERE section_id IN (
  SELECT id FROM document_sections WHERE document_id = 'document-uuid'
);
```

---

### 6.5 Atomic Locking (Race Condition)

```sql
-- Test in two concurrent transactions:

-- Transaction 1:
BEGIN;
SELECT lock_section_atomic('section-uuid', 'stage-uuid', 'user-1-uuid', 'suggestion-uuid', 'Locking');
-- Should return: {"success": true, "state_id": "..."}
COMMIT;

-- Transaction 2 (concurrent):
BEGIN;
SELECT lock_section_atomic('section-uuid', 'stage-uuid', 'user-2-uuid', 'suggestion-uuid', 'Locking');
-- Should return: {"success": false, "error": "Section is already locked", "code": "SECTION_LOCKED"}
ROLLBACK;
```

---

### 6.6 Document Progress Calculation

```sql
-- Test: Calculate progress for document with mixed states
SELECT * FROM calculate_document_progress('document-uuid');

-- Expected output:
-- total_sections     | 10
-- approved_sections  | 6
-- pending_sections   | 3
-- rejected_sections  | 1
-- progress_percentage| 60.00
```

---

### 6.7 Workflow History Audit Trail

```sql
-- Test: Get complete approval history for section
SELECT * FROM get_section_workflow_history('section-uuid');

-- Expected: Chronological list of all stages, approvers, timestamps, notes
```

---

## 7. Deployment Checklist

### Pre-Deployment

- [ ] Review all migration files for consistency
- [ ] Check column names match between migrations
- [ ] Verify setupService.js uses correct column names
- [ ] Run migration 017 (schema fixes) in staging
- [ ] Test default workflow creation on new organization
- [ ] Verify RLS policies work for all user roles

### Deployment Order

1. Run migration 017_workflow_schema_fixes.sql
2. Deploy updated setupService.js code
3. Restart application servers
4. Smoke test workflow creation
5. Monitor logs for schema errors

### Post-Deployment Verification

```sql
-- Verify schema corrections
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'section_workflow_states'
ORDER BY ordinal_position;

-- Check RLS policies exist
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE tablename IN ('workflow_stages', 'document_workflows', 'section_workflow_states');

-- Verify default workflows exist
SELECT o.name AS org_name, wt.name AS workflow_name, COUNT(ws.id) AS stage_count
FROM organizations o
LEFT JOIN workflow_templates wt ON o.id = wt.organization_id AND wt.is_default = TRUE
LEFT JOIN workflow_stages ws ON wt.id = ws.workflow_template_id
GROUP BY o.id, o.name, wt.name;
```

---

## 8. Recommendations Summary

### Immediate (P0 - Critical)
1. ✅ Apply migration 017 to fix schema inconsistencies
2. ✅ Update setupService.js to use `name` instead of `template_name`
3. ✅ Add RLS policies for workflow tables

### Short-term (P1 - High)
4. ⚠️ Fix unique constraint to allow section resubmissions
5. ⚠️ Optimize bulk operations to avoid O(n) function calls
6. ⚠️ Add comprehensive test coverage for all helper functions

### Medium-term (P2 - Medium)
7. 📋 Add caching layer for permission checks
8. 📋 Create materialized view for workflow progress
9. 📋 Implement workflow versioning for template changes

### Long-term (P3 - Nice to have)
10. 🔮 Add workflow analytics dashboard
11. 🔮 Implement workflow templates marketplace
12. 🔮 Add workflow simulation/preview mode

---

## Conclusion

The workflow system has a **solid foundation** with well-designed helper functions and proper atomic locking. However, there are **critical schema inconsistencies** that must be fixed before production deployment.

**Priority Actions:**
1. Run migration 017 immediately
2. Update setupService.js code
3. Add missing RLS policies
4. Deploy and verify

Once these fixes are applied, the workflow system will be **production-ready** and capable of supporting complex N-stage approval processes with proper audit trails and security.

---

**Report prepared by:** Code Analyzer Agent
**Next Review:** After migration 017 deployment
**Contact:** See docs/CODE_REVIEW_WORKFLOW.md for escalation procedure
