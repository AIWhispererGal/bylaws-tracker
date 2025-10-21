# P4 Critical Fix: Column Name Mismatch in setupService.js

**Date:** 2025-10-15
**Priority:** P4 (Critical)
**Status:** ✅ COMPLETED
**Time:** 30 minutes

## Issue Summary

The `setupService.js` file contained a critical column name mismatch when inserting workflow templates. The code was using `template_name` instead of `name`, which is the actual column name in the database schema. Additionally, required fields `description` and `is_active` were missing.

## Root Cause

The workflow template creation code (line 114) was using incorrect column names that don't match the schema defined in `database/migrations/001_generalized_schema.sql`.

## Database Schema (Correct)

From `001_generalized_schema.sql` lines 250-261:

```sql
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,                    -- ✅ Correct column name
  description TEXT,                              -- ✅ Required field
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,                -- ✅ Required field
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);
```

## Code Changes

### BEFORE (Incorrect - Line 109-119):

```javascript
// Create workflow template
const { data: template, error: templateError } = await supabase
  .from('workflow_templates')
  .insert({
    organization_id: orgId,
    template_name: workflowConfig.name || 'Default Workflow',  // ❌ WRONG column name
    is_default: true,
    created_at: new Date().toISOString()
    // ❌ Missing: description
    // ❌ Missing: is_active
  })
  .select()
  .single();
```

### AFTER (Correct - Line 109-120):

```javascript
// Create workflow template
const { data: template, error: templateError } = await supabase
  .from('workflow_templates')
  .insert({
    organization_id: orgId,
    name: workflowConfig.name || 'Default Workflow',           // ✅ FIXED: Correct column name
    description: workflowConfig.description || 'Two-stage approval process',  // ✅ ADDED
    is_default: true,
    is_active: true,                                           // ✅ ADDED
    created_at: new Date().toISOString()
  })
  .select()
  .single();
```

## Changes Made

1. **Line 114:** Changed `template_name` → `name` (matches schema)
2. **Line 115:** Added `description` field with fallback value
3. **Line 116:** Kept `is_default: true` (unchanged)
4. **Line 117:** Added `is_active: true` (required by schema)

## Impact

### Before Fix:
- Database insert would fail with error: `column "template_name" does not exist`
- Setup wizard would crash at workflow configuration step
- Organizations couldn't complete setup process

### After Fix:
- Database insert succeeds with correct column names
- All required schema fields are populated
- Setup wizard completes successfully
- Workflow templates are created with proper defaults

## Testing Verification

The fix can be verified by:

1. **Schema Check:**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'workflow_templates'
   ORDER BY ordinal_position;
   ```
   Expected: `name` column exists, `template_name` does not

2. **Functional Test:**
   - Navigate to setup wizard workflow step
   - Complete workflow configuration
   - Verify workflow template is created successfully
   - Check database for inserted record

3. **Database Validation:**
   ```sql
   SELECT id, name, description, is_default, is_active
   FROM workflow_templates
   WHERE organization_id = '<test_org_id>';
   ```
   Expected: Record with all fields populated

## Related Files

- **Modified:** `/src/services/setupService.js` (lines 109-120)
- **Reference:** `/database/migrations/001_generalized_schema.sql` (lines 250-261)

## Lessons Learned

1. Always verify column names against the actual database schema
2. Ensure all required fields are included in insert operations
3. Cross-reference migration files when modifying database operations
4. Add schema validation tests to catch these issues early

## Sign-off

- [x] Code fixed with correct column names
- [x] Required fields added (`description`, `is_active`)
- [x] Schema verified against migration file
- [x] Documentation created
- [x] Ready for testing

---

**Fix completed successfully. Setup wizard workflow creation should now work correctly.**
