# P4 Fix - Code Implementation Snippet

## Location
**File**: `/src/routes/setup.js`
**Function**: `processSetupData()`
**Case**: `'organization'`
**Lines**: 654-719

## Complete Code Added

```javascript
// Create default workflow template for new organization
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
        // Non-fatal: Continue setup even if workflow creation fails
    } else {
        console.log('[SETUP-DEBUG] ✅ Default workflow template created:', workflowTemplate.id);

        // Create workflow stages
        const { error: stagesError } = await supabase
            .from('workflow_stages')
            .insert([
                {
                    workflow_template_id: workflowTemplate.id,
                    stage_name: 'Committee Review',
                    stage_order: 1,
                    can_lock: true,
                    can_edit: true,
                    can_approve: true,
                    requires_approval: true,
                    required_roles: ['admin', 'owner'],
                    display_color: '#FFD700',
                    icon: 'clipboard-check',
                    description: 'Initial review by committee members'
                },
                {
                    workflow_template_id: workflowTemplate.id,
                    stage_name: 'Board Approval',
                    stage_order: 2,
                    can_lock: false,
                    can_edit: false,
                    can_approve: true,
                    requires_approval: true,
                    required_roles: ['owner'],
                    display_color: '#90EE90',
                    icon: 'check-circle',
                    description: 'Final approval by board members'
                }
            ]);

        if (stagesError) {
            console.error('[SETUP-DEBUG] ❌ Failed to create workflow stages:', stagesError);
            // Non-fatal: Continue setup even if stage creation fails
        } else {
            setupData.workflowTemplateId = workflowTemplate.id;
            console.log('[SETUP-DEBUG] ✅ Created default workflow for organization', data.id);
            console.log('[SETUP-DEBUG] ✅ Workflow stages: Committee Review → Board Approval');
        }
    }
} catch (workflowErr) {
    console.error('[SETUP-DEBUG] ❌ Error creating default workflow:', workflowErr);
    // Non-fatal: Continue setup even if workflow creation fails
}
```

## Context

**Before** (lines 646-653):
```javascript
if (linkError) {
    console.log('[SETUP-DEBUG] ❌ Error linking user to organization:', linkError);
    console.error('[SETUP-DEBUG] ⚠️  User-organization link failed but continuing setup');
} else {
    console.log('[SETUP-DEBUG] ✅ User linked to organization with role:', userRole);
}
```

**INSERTED CODE HERE** ← Lines 654-719

**After** (lines 720-722):
```javascript
} else {
    console.log('[SETUP-DEBUG] ⚠️  Missing orgData or adminUser');
}
break;
```

## Key Design Decisions

### 1. Non-Blocking Error Handling
```javascript
if (workflowError) {
    console.error('[SETUP-DEBUG] ❌ Failed to create default workflow:', workflowError);
    // Non-fatal: Continue setup even if workflow creation fails
}
```
**Why**: Setup wizard should complete successfully even if workflow creation fails. User can create workflow manually via admin UI.

### 2. Nested Try-Catch
```javascript
try {
    // Create workflow template
    if (!workflowError) {
        // Create workflow stages (nested operation)
    }
} catch (workflowErr) {
    // Catch any unexpected errors
}
```
**Why**: Protect against both expected Supabase errors and unexpected runtime errors.

### 3. Session Storage
```javascript
setupData.workflowTemplateId = workflowTemplate.id;
```
**Why**: Makes template ID available for future steps (document import, admin dashboard).

### 4. Stage Configuration
```javascript
// Stage 1: Committee Review - Full permissions for initial review
can_lock: true,
can_edit: true,
can_approve: true,
required_roles: ['admin', 'owner'],

// Stage 2: Board Approval - Approve only for final decision
can_lock: false,
can_edit: false,
can_approve: true,
required_roles: ['owner'],
```
**Why**: Matches typical governance workflow where committee drafts/locks, board approves.

## Database Schema Required

### workflow_templates table
```sql
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### workflow_stages table
```sql
CREATE TABLE workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
    stage_name TEXT NOT NULL,
    stage_order INTEGER NOT NULL,
    can_lock BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    requires_approval BOOLEAN DEFAULT true,
    required_roles JSONB,
    display_color TEXT,
    icon TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Testing Snippet

### Test Workflow Creation
```javascript
const { data: templates } = await supabase
    .from('workflow_templates')
    .select(`
        *,
        workflow_stages(*)
    `)
    .eq('organization_id', organizationId)
    .eq('is_default', true);

console.log('Default workflow:', templates[0].name);
console.log('Stage count:', templates[0].workflow_stages.length);
console.log('Stages:', templates[0].workflow_stages.map(s => s.stage_name));
```

### Expected Output
```
Default workflow: Default Approval Workflow
Stage count: 2
Stages: [ 'Committee Review', 'Board Approval' ]
```

---

**Lines of Code**: 66
**Complexity**: Medium (database operations with error handling)
**Risk Level**: Low (non-blocking, comprehensive error handling)
**Status**: ✅ PRODUCTION READY
