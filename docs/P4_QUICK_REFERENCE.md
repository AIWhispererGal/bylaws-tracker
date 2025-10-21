# P4 Fix Quick Reference - Default Workflow Creation

## What Was Fixed
Setup wizard now automatically creates default workflow template with 2 stages when organization is created.

## Changes Made

### File: `src/routes/setup.js`
**Lines**: 654-719 in `processSetupData()` function, `organization` case

### Code Flow
```
Organization Created
    ↓
User-Organization Link Created
    ↓
✨ NEW: Default Workflow Created ← P4 FIX
    ├─ Workflow Template: "Default Approval Workflow"
    ├─ Stage 1: Committee Review (admin/owner can lock/edit/approve)
    └─ Stage 2: Board Approval (owner can approve)
    ↓
Workflow Template ID Stored in Session
    ↓
Setup Continues...
```

## Default Workflow Structure

```
Default Approval Workflow (is_default: true, is_active: true)
│
├── Stage 1: Committee Review
│   ├── Order: 1
│   ├── Permissions: Lock ✓ | Edit ✓ | Approve ✓
│   ├── Required Roles: admin, owner
│   ├── Color: #FFD700 (Gold)
│   └── Icon: clipboard-check
│
└── Stage 2: Board Approval
    ├── Order: 2
    ├── Permissions: Lock ✗ | Edit ✗ | Approve ✓
    ├── Required Roles: owner
    ├── Color: #90EE90 (Light Green)
    └── Icon: check-circle
```

## Database Changes

### Tables Affected
- `workflow_templates` - 1 new row per organization
- `workflow_stages` - 2 new rows per workflow template

### SQL to Verify
```sql
-- Check workflow created for organization
SELECT
    wt.id,
    wt.name,
    wt.is_default,
    wt.is_active,
    COUNT(ws.id) as stage_count
FROM workflow_templates wt
LEFT JOIN workflow_stages ws ON ws.workflow_template_id = wt.id
WHERE wt.organization_id = '<org_id>'
GROUP BY wt.id, wt.name, wt.is_default, wt.is_active;

-- Check stage details
SELECT
    stage_name,
    stage_order,
    can_lock,
    can_edit,
    can_approve,
    required_roles,
    display_color
FROM workflow_stages
WHERE workflow_template_id = '<template_id>'
ORDER BY stage_order;
```

## Error Handling

### Non-Blocking Design
- Workflow creation failures are logged but don't stop setup
- Setup wizard completes successfully even if workflow fails
- User can create workflow manually via admin UI later

### Logging
All operations logged with `[SETUP-DEBUG]` prefix:
- `🔄 Creating default workflow template...`
- `✅ Default workflow template created: <id>`
- `✅ Workflow stages: Committee Review → Board Approval`
- `❌ Failed to create default workflow: <error>` (if error)

## Testing

### Manual Test
1. Complete setup wizard for new organization
2. Check console logs for workflow creation messages
3. Go to Admin → Workflow Management
4. Verify "Default Approval Workflow" appears with 2 stages

### Automated Test
```javascript
// Test setup creates default workflow
const setupData = { /* ... */ };
await processSetupData(setupData, supabase);

const { data: workflow } = await supabase
  .from('workflow_templates')
  .select('*, workflow_stages(*)')
  .eq('organization_id', setupData.organizationId)
  .eq('is_default', true)
  .single();

expect(workflow).toBeDefined();
expect(workflow.workflow_stages).toHaveLength(2);
expect(workflow.workflow_stages[0].stage_name).toBe('Committee Review');
expect(workflow.workflow_stages[1].stage_name).toBe('Board Approval');
```

## Integration Points

### Session Data
```javascript
setupData.workflowTemplateId // Available after organization step
```

### Future Use
- Document import can automatically assign to default workflow
- Admin can customize stages via workflow editor
- Documents can reference template in `workflow_template_id` column

## Rollback (if needed)

To remove workflow creation:
1. Delete lines 654-719 in `src/routes/setup.js`
2. Organizations created without workflow can manually create via admin UI

## Related Files
- `src/routes/setup.js` - Setup wizard logic
- `src/routes/admin.js` - Workflow management UI
- `database/migrations/012_workflow_enhancements_fixed.sql` - Workflow schema
- `docs/WORKFLOW_IMPLEMENTATION_COMPLETE.md` - Full workflow documentation

---

**Quick Status**: ✅ IMPLEMENTED | NON-BLOCKING | PRODUCTION READY
