# Workflow System - Issues to Fix

**Date:** 2025-10-14
**Priority Order:** Critical → High → Medium → Low

---

## 🔴 CRITICAL ISSUES (Must Fix Immediately)

**None found - excellent work!**

---

## 🟡 HIGH PRIORITY (Fix Before Production)

Estimated time: **4-5 hours total**

### 1. Fix Race Condition in Section Locking
**File:** `/src/routes/approval.js:322-334`
**Time:** 1 hour
**Severity:** Medium

**Problem:**
```javascript
// Check if already locked
const { data: existingState } = await supabase
  .from('section_workflow_states')
  .select('status')
  .eq('section_id', section_id)
  .eq('workflow_stage_id', workflow_stage_id)
  .single();

if (existingState && existingState.status === 'locked') {
  return res.status(400).json({ ... });
}

// Later: Another request could lock between check and upsert
await supabaseService
  .from('section_workflow_states')
  .upsert({ ... });
```

**Fix Option 1 - Database Constraint:**
```sql
-- Add to migration file
ALTER TABLE section_workflow_states
  ADD CONSTRAINT unique_section_stage_lock
  UNIQUE (section_id, workflow_stage_id)
  WHERE status = 'locked';
```

**Fix Option 2 - Database Function:**
```sql
CREATE OR REPLACE FUNCTION lock_section_atomic(
  p_section_id UUID,
  p_stage_id UUID,
  p_user_id UUID,
  p_suggestion_id UUID,
  p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  existing_lock RECORD;
BEGIN
  -- Check for existing lock in same transaction
  SELECT * INTO existing_lock
  FROM section_workflow_states
  WHERE section_id = p_section_id
    AND workflow_stage_id = p_stage_id
    AND status = 'locked'
  FOR UPDATE;  -- Lock the row

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Section already locked'
    );
  END IF;

  -- Insert lock
  INSERT INTO section_workflow_states (...)
  VALUES (...);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
```

Then update route:
```javascript
const { data, error } = await supabaseService.rpc('lock_section_atomic', {
  p_section_id: section_id,
  p_stage_id: workflow_stage_id,
  p_user_id: userId,
  p_suggestion_id: selected_suggestion_id,
  p_notes: notes
});
```

---

### 2. Add Input Validation to `/progress` Endpoint
**File:** `/src/routes/approval.js:475-488`
**Time:** 15 minutes
**Severity:** Medium

**Current Code:**
```javascript
router.post('/progress', requireMember, async (req, res) => {
  const { section_id, notes } = req.body;

  if (!section_id) {
    return res.status(400).json({
      success: false,
      error: 'section_id is required'
    });
  }
  // ...
});
```

**Fix:**
```javascript
// Add validation schema at top of file with other schemas
const progressSectionSchema = Joi.object({
  section_id: Joi.string().uuid().required(),
  notes: Joi.string().max(5000).optional().allow('')
});

// Update route handler
router.post('/progress', requireMember, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = progressSectionSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { section_id, notes } = value;
    // ... rest of existing code
  } catch (error) {
    // ... existing error handling
  }
});
```

---

### 3. Update NPM Dependencies (Security)
**File:** `package.json`
**Time:** 30 minutes
**Severity:** Low

**Current Issue:**
```
cookie  <0.7.0 (2 low severity vulnerabilities)
Affects: csurf
```

**Fix:**
```bash
# Option 1: Try non-breaking fix first
npm audit fix

# Option 2: If that doesn't work, update csurf
npm update csurf

# Option 3: If breaking, manually update
npm install csurf@latest --save

# Then test CSRF protection still works
npm test
```

**Verify Fix:**
```bash
npm audit
# Should show 0 vulnerabilities
```

---

### 4. Standardize Error Messages
**Files:** Multiple (`/src/routes/approval.js`, `/src/config/workflowConfig.js`)
**Time:** 2 hours
**Severity:** Low

**Current Problem:**
```javascript
// Inconsistent - some expose internal details
catch (error) {
  res.status(500).json({
    success: false,
    error: error.message  // ⚠️ Could expose stack traces
  });
}
```

**Fix - Create error utility:**

**File:** `/src/utils/errors.js` (new file)
```javascript
class WorkflowError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function handleError(error, req, res) {
  // Log full error details
  console.error('Error occurred:', {
    message: error.message,
    code: error.code,
    stack: error.stack,
    userId: req.session?.userId,
    path: req.path,
    method: req.method
  });

  // Send sanitized response
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: isProduction && statusCode === 500
      ? 'An error occurred. Please try again.'
      : error.message,
    code: error.code || 'INTERNAL_ERROR'
  });
}

module.exports = { WorkflowError, handleError };
```

**Update routes:**
```javascript
const { WorkflowError, handleError } = require('../utils/errors');

router.post('/lock', requireMember, async (req, res) => {
  try {
    // ... existing code

    if (existingState && existingState.status === 'locked') {
      throw new WorkflowError(
        'Section is already locked at this stage',
        'SECTION_LOCKED',
        400
      );
    }

    // ... rest of code

  } catch (error) {
    handleError(error, req, res);
  }
});
```

---

### 5. Add Security Documentation to Database Functions
**File:** `/database/migrations/008_enhance_user_roles_and_approval.sql`
**Time:** 30 minutes
**Severity:** Low

**Fix:**
```sql
-- Function to check if user has specific role in organization
-- SECURITY: Uses SECURITY DEFINER to bypass RLS for permission checks
-- This is safe because:
--   1. Parameters are properly typed (UUID, VARCHAR)
--   2. Query uses parameterized WHERE clause
--   3. Function only reads data, doesn't modify
--   4. Returns boolean, not sensitive data
CREATE OR REPLACE FUNCTION user_has_role(
    p_user_id UUID,
    p_organization_id UUID,
    p_required_role VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
    role_hierarchy JSONB := '{"owner": 4, "admin": 3, "member": 2, "viewer": 1}'::jsonb;
BEGIN
    -- Get user's role in organization (parameterized query)
    SELECT role INTO user_role
    FROM user_organizations
    WHERE user_id = p_user_id
    AND organization_id = p_organization_id
    AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if user's role level >= required role level
    RETURN (role_hierarchy->>user_role)::int >= (role_hierarchy->>p_required_role)::int;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;  -- Prevent schema injection

COMMENT ON FUNCTION user_has_role IS 'Check if user has sufficient role level in organization. Uses SECURITY DEFINER to bypass RLS for permission checking.';
```

---

## 📋 MEDIUM PRIORITY (Complete in Next Sprint)

Estimated time: **8-10 hours total**

### 6. Optimize Database Queries
**File:** `/src/routes/approval.js:148-158`
**Time:** 2 hours

**Current:**
```javascript
const { data: sections } = await supabase
  .from('document_sections')
  .select('id, section_number, section_title')
  .eq('document_id', documentId);

const sectionIds = sections.map(s => s.id);
const { data: states } = await supabase
  .from('section_workflow_states')
  .select(`...`)
  .in('section_id', sectionIds);
```

**Optimized:**
```javascript
const { data: sections } = await supabase
  .from('document_sections')
  .select(`
    id,
    section_number,
    section_title,
    workflow_states:section_workflow_states!inner (
      *,
      workflow_stages:workflow_stage_id (
        stage_name,
        stage_order
      )
    )
  `)
  .eq('document_id', documentId)
  .order('path_ordinals', { ascending: true });
```

---

### 7. Add Missing Test Cases
**File:** New tests in `/tests/integration/`
**Time:** 3 hours

**Missing Tests:**
1. Concurrent lock attempts
2. Orphaned workflow states
3. Workflow stage order validation
4. Missing workflow template handling
5. Large dataset performance

**Example:**
```javascript
describe('Concurrent Operations', () => {
  test('should handle concurrent lock attempts gracefully', async () => {
    const promises = [
      lockSection(sectionId, stageId, user1),
      lockSection(sectionId, stageId, user2)
    ];

    const results = await Promise.allSettled(promises);

    // One should succeed, one should fail
    const succeeded = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason.code).toBe('SECTION_LOCKED');
  });
});
```

---

### 8. Implement Structured Logging
**File:** New `/src/utils/logger.js`
**Time:** 3 hours

**Create logger:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'workflow-service' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
```

**Replace console.log:**
```javascript
const logger = require('../utils/logger');

// Before
console.error('Error locking section:', error);

// After
logger.error('Section lock failed', {
  sectionId: section_id,
  stageId: workflow_stage_id,
  userId: req.session.userId,
  error: error.message,
  stack: error.stack
});
```

---

### 9. Add Composite Database Indexes
**File:** New migration file
**Time:** 1 hour

**Create `/database/migrations/012_add_workflow_indexes.sql`:**
```sql
-- Improve query performance for workflow operations

-- Composite index for section workflow state lookups
CREATE INDEX IF NOT EXISTS idx_section_workflow_section_status
  ON section_workflow_states(section_id, status)
  WHERE status IN ('approved', 'locked', 'in_progress');

-- Index for workflow state ordering
CREATE INDEX IF NOT EXISTS idx_workflow_states_actioned_at
  ON section_workflow_states(actioned_at DESC);

-- Index for document version approval stages
CREATE INDEX IF NOT EXISTS idx_doc_versions_approval_stage
  ON document_versions(approval_stage)
  WHERE approval_stage IS NOT NULL;

-- Composite index for user organization permissions
CREATE INDEX IF NOT EXISTS idx_user_org_role_active
  ON user_organizations(user_id, organization_id, role)
  WHERE is_active = TRUE;

-- Index for workflow template lookups
CREATE INDEX IF NOT EXISTS idx_workflow_template_org_default
  ON workflow_templates(organization_id, is_default)
  WHERE is_default = TRUE AND is_active = TRUE;

COMMENT ON INDEX idx_section_workflow_section_status IS 'Improves performance of section state queries';
COMMENT ON INDEX idx_workflow_states_actioned_at IS 'Speeds up workflow history queries';
COMMENT ON INDEX idx_doc_versions_approval_stage IS 'Optimizes version lookup by approval stage';
```

---

## 🔵 LOW PRIORITY (Future Enhancements)

Estimated time: **20+ hours total**

### 10. Create API Documentation
**Time:** 4 hours

Create `/docs/api/workflow-api.yaml` with OpenAPI 3.0 spec.

---

### 11. Add Cache TTL
**Time:** 1 hour

Update `/src/config/workflowConfig.js` with time-based cache invalidation.

---

### 12. Extract Helper Functions
**Time:** 3 hours

Create `/src/services/workflowService.js` for reusable workflow logic.

---

### 13-17. Additional Enhancements
See full list in `/docs/CODE_REVIEW_WORKFLOW.md`.

---

## Testing Checklist

After each fix:

```bash
# 1. Run tests
npm test

# 2. Check for regressions
npm run test:coverage

# 3. Manual testing
# - Lock a section
# - Approve a section
# - Progress through workflow
# - Create version

# 4. Performance check
# - Test with 100+ sections
# - Monitor query times
# - Check memory usage
```

---

## Deployment Checklist

Before deploying fixes:

- [ ] All tests passing
- [ ] No new lint errors
- [ ] Security audit clean
- [ ] Database migrations tested
- [ ] Backup production database
- [ ] Rollback plan ready
- [ ] Monitoring in place

---

## Notes

- Address HIGH priority items before production
- MEDIUM priority items can be in next sprint
- LOW priority items are nice-to-have
- Test thoroughly after each fix
- Monitor production after deployment

