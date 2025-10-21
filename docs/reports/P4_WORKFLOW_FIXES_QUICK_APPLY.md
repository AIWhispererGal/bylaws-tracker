# P4 Workflow Fixes - Quick Apply Guide

**Status:** Ready to deploy
**Estimated Time:** 5 minutes
**Risk Level:** LOW (Additive changes only, no data loss)

---

## What This Fixes

1. ✅ Missing columns in `document_workflows` table
2. ✅ Missing `approval_metadata` column in `section_workflow_states`
3. ✅ Unique constraint preventing section resubmissions
4. ✅ Missing RLS policies for workflow tables
5. ✅ Performance indexes for bulk operations

---

## Quick Deploy (3 Steps)

### Step 1: Run Database Migration (2 minutes)

```bash
# Connect to your database
psql -U your_user -d your_database

# Run migration 017
\i database/migrations/017_workflow_schema_fixes.sql

# Verify success (should see all green checkmarks)
```

**Expected Output:**
```
✅ Added status column to document_workflows
✅ Added current_stage_id column to document_workflows
✅ Added approval_metadata column to section_workflow_states
✅ Created partial unique index for active workflow states
✅ Added RLS policy for workflow_stages
✅ Added RLS policy for document_workflows
✅ Added RLS SELECT policy for section_workflow_states
✅ Added RLS INSERT policy for section_workflow_states
✅ Added RLS UPDATE policy for section_workflow_states
✅ Added index for pending workflow queries
✅ Added index for stage status queries
✅ Added index for approval history queries
✅ All workflow templates have stages
✅ All document workflows reference valid templates
========================================
Migration 017 Completed Successfully
========================================
```

---

### Step 2: Update Code (1 minute)

**File:** `src/services/setupService.js`

**Line 114 - Change:**
```javascript
// BEFORE (WRONG):
template_name: workflowConfig.name || 'Default Workflow',

// AFTER (CORRECT):
name: workflowConfig.name || 'Default Workflow',
description: workflowConfig.description || 'Two-stage approval: Committee Review → Board Approval',
is_active: true,
```

**File:** `src/services/setupService.js`

**Line 148-150 - Ensure stages match schema:**
```javascript
const stageInserts = stages.map(stage => ({
  workflow_template_id: template.id,
  stage_name: stage.stage_name,
  stage_order: stage.stage_order,
  can_lock: stage.can_lock,
  can_edit: stage.can_edit,
  can_approve: stage.can_approve,
  requires_approval: stage.requires_approval,
  required_roles: stage.required_roles || ['admin'],
  display_color: stage.display_color || '#6C757D',
  icon: stage.icon || 'circle',
  description: stage.description || ''
}));
```

---

### Step 3: Restart & Verify (2 minutes)

```bash
# Restart your application
npm restart  # or pm2 restart app

# Test workflow creation
curl -X POST http://localhost:3000/api/workflow/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workflow",
    "description": "Testing migration 017",
    "isDefault": true
  }'

# Should return: {"success": true, "template": {...}}
```

---

## Verification Queries

### Check Schema Corrections

```sql
-- Verify document_workflows columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'document_workflows'
ORDER BY ordinal_position;

-- Expected: status, current_stage_id, created_at, updated_at present

-- Verify section_workflow_states columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'section_workflow_states'
  AND column_name IN ('approval_metadata', 'actioned_by', 'actioned_at');

-- Expected: All 3 columns present
```

---

### Check RLS Policies

```sql
-- Verify RLS policies exist
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('workflow_stages', 'document_workflows', 'section_workflow_states')
ORDER BY tablename, policyname;

-- Expected: At least 5 policies total
```

---

### Check Indexes

```sql
-- Verify performance indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'section_workflow_states'
  AND indexname LIKE 'idx_%'
ORDER BY indexname;

-- Expected: Multiple indexes including idx_section_stage_active_unique
```

---

### Test Workflow Operations

```sql
-- Test 1: Create test workflow
INSERT INTO workflow_templates (organization_id, name, description, is_default, is_active)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  'Test Workflow',
  'Testing migration 017',
  FALSE,
  TRUE
) RETURNING id;

-- Test 2: Create stages
INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, required_roles)
VALUES
  ((SELECT id FROM workflow_templates WHERE name = 'Test Workflow'), 'Review', 1, '["admin"]'::jsonb),
  ((SELECT id FROM workflow_templates WHERE name = 'Test Workflow'), 'Approve', 2, '["owner"]'::jsonb);

-- Test 3: Verify stage creation
SELECT wt.name AS workflow, ws.stage_name, ws.stage_order
FROM workflow_templates wt
JOIN workflow_stages ws ON wt.id = ws.workflow_template_id
WHERE wt.name = 'Test Workflow'
ORDER BY ws.stage_order;

-- Expected: 2 stages in correct order

-- Test 4: Clean up
DELETE FROM workflow_templates WHERE name = 'Test Workflow';
```

---

## Rollback Plan (If Needed)

If you need to undo these changes:

```sql
-- Rollback RLS policies
DROP POLICY IF EXISTS "Users see stages in their organization workflows" ON workflow_stages;
DROP POLICY IF EXISTS "Users see workflows for accessible documents" ON document_workflows;
DROP POLICY IF EXISTS "Users see workflow states in their organizations" ON section_workflow_states;
DROP POLICY IF EXISTS "Users can create workflow states for sections they can approve" ON section_workflow_states;
DROP POLICY IF EXISTS "Users can update their own workflow state actions" ON section_workflow_states;

-- Rollback indexes (optional - no harm in keeping them)
DROP INDEX IF EXISTS idx_section_stage_active_unique;
DROP INDEX IF EXISTS idx_section_workflow_states_status_created;
DROP INDEX IF EXISTS idx_section_workflow_states_stage_status;
DROP INDEX IF EXISTS idx_section_workflow_states_actioned_by;

-- Note: Don't drop columns that have data!
-- Only remove if table is empty or in testing environment
```

---

## Common Issues & Solutions

### Issue 1: "Function user_can_approve_stage does not exist"

**Cause:** Migration 012 hasn't been run yet.

**Solution:**
```bash
# Run migration 012 first
psql -U your_user -d your_database -f database/migrations/012_workflow_enhancements.sql
# Then run 017
psql -U your_user -d your_database -f database/migrations/017_workflow_schema_fixes.sql
```

---

### Issue 2: "Column approval_metadata already exists"

**Cause:** Migration 008 already added this column.

**Solution:** This is fine! The migration checks for column existence before adding. You'll see "✅ approval_metadata column already exists" in output.

---

### Issue 3: "RLS policy prevents access"

**Cause:** User not properly linked to organization.

**Solution:**
```sql
-- Check user's organization memberships
SELECT u.email, uo.organization_id, uo.role, uo.is_active
FROM users u
JOIN user_organizations uo ON u.id = uo.user_id
WHERE u.email = 'your.email@example.com';

-- If not active, activate membership
UPDATE user_organizations
SET is_active = TRUE
WHERE user_id = (SELECT id FROM users WHERE email = 'your.email@example.com');
```

---

### Issue 4: "Unique constraint violation on section_workflow_states"

**Cause:** Old unique constraint still exists and conflicts with resubmission.

**Solution:**
```sql
-- Manually drop old constraint
ALTER TABLE section_workflow_states
DROP CONSTRAINT IF EXISTS section_workflow_states_section_id_workflow_stage_id_key;

-- Verify partial index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'section_workflow_states'
  AND indexname = 'idx_section_stage_active_unique';
```

---

## Post-Deployment Monitoring

### Monitor for 24 hours:

1. **Check application logs** for schema-related errors:
```bash
tail -f logs/application.log | grep -i "workflow\|schema\|column"
```

2. **Monitor database query performance**:
```sql
-- Check slow queries on workflow tables
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query ILIKE '%workflow%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

3. **Verify workflow operations are working**:
   - Create a new organization → Default workflow should be created
   - Upload a document → Workflow should be assigned
   - Lock a section → Should create workflow state
   - Approve a section → Should advance to next stage

---

## Success Criteria

✅ All these should be TRUE:

- [ ] Migration 017 runs without errors
- [ ] setupService.js code updated
- [ ] Application starts without schema errors
- [ ] New workflows can be created via UI
- [ ] Sections can be locked and approved
- [ ] Workflow progress displays correctly
- [ ] RLS policies allow appropriate access
- [ ] No performance degradation

---

## Need Help?

**If deployment fails:**

1. Check migration output for specific errors
2. Review database logs: `tail -f /var/log/postgresql/postgresql.log`
3. Verify prerequisites: migrations 008 and 012 must be run first
4. See full audit report: `docs/reports/P4_WORKFLOW_AUDIT.md`
5. Contact: See escalation procedure in `docs/CODE_REVIEW_WORKFLOW.md`

---

**Last Updated:** 2025-10-15
**Migration File:** `database/migrations/017_workflow_schema_fixes.sql`
**Related Docs:** `docs/reports/P4_WORKFLOW_AUDIT.md`
