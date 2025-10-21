# Workflow System Best Practices Guide

**Version:** 1.0
**Last Updated:** 2025-10-14
**Audience:** Development team

---

## Table of Contents

1. [Code Style Guidelines](#code-style-guidelines)
2. [API Design Patterns](#api-design-patterns)
3. [Database Query Optimization](#database-query-optimization)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Testing Strategies](#testing-strategies)
6. [Security Considerations](#security-considerations)
7. [Performance Optimization](#performance-optimization)

---

## Code Style Guidelines

### File Organization

```
src/
├── routes/          # API endpoints
│   ├── approval.js  # Workflow-related endpoints
│   └── ...
├── services/        # Business logic
│   ├── workflowService.js
│   └── ...
├── middleware/      # Request processors
│   ├── roleAuth.js
│   └── ...
├── config/          # Configuration
│   ├── workflowConfig.js
│   └── ...
└── utils/           # Helper functions
    └── ...
```

### Naming Conventions

#### Variables and Functions
```javascript
// ✅ GOOD: Descriptive, camelCase
const sectionWorkflowState = await getSectionWorkflowState(supabase, sectionId);
const canUserApprove = await canApproveStage(req, stageId);

// ❌ BAD: Abbreviated, unclear
const sws = await getState(db, id);
const can = await check(r, s);
```

#### Constants
```javascript
// ✅ GOOD: SCREAMING_SNAKE_CASE for constants
const MAX_WORKFLOW_STAGES = 5;
const DEFAULT_CACHE_TTL = 300000;

// ❌ BAD: Regular camelCase
const maxStages = 5;
const cacheTtl = 300000;
```

#### Database Columns
```javascript
// ✅ GOOD: snake_case matching database
const { workflow_stage_id, actioned_by } = data;

// ❌ BAD: camelCase (doesn't match DB)
const { workflowStageId, actionedBy } = data;
```

### Function Structure

```javascript
/**
 * Lock section at specific workflow stage
 *
 * @param {string} sectionId - UUID of section to lock
 * @param {string} stageId - UUID of workflow stage
 * @param {string} userId - User performing the lock
 * @param {Object} metadata - Additional lock metadata
 * @returns {Promise<Object>} Lock result with success status
 * @throws {Error} If section already locked or user lacks permission
 */
async function lockSection(sectionId, stageId, userId, metadata = {}) {
  // 1. Validate inputs
  if (!sectionId || !stageId || !userId) {
    throw new Error('Missing required parameters');
  }

  // 2. Check permissions
  const hasPermission = await checkLockPermission(userId, stageId);
  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }

  // 3. Verify not already locked
  const isLocked = await isSectionLocked(sectionId, stageId);
  if (isLocked) {
    throw new Error('Section already locked');
  }

  // 4. Perform operation
  const result = await createLock(sectionId, stageId, userId, metadata);

  // 5. Log activity
  await logActivity('section.locked', { sectionId, stageId, userId });

  // 6. Return result
  return result;
}
```

### Comments

```javascript
// ✅ GOOD: Explain WHY, not WHAT
// Check sequential workflow enforcement to prevent stage skipping
if (workflow.require_sequential) {
  const nextStage = this.getNextStage(currentState.stage, workflow);
  // ...
}

// ❌ BAD: Obvious comment
// Get the next stage
const nextStage = this.getNextStage(currentState.stage, workflow);
```

---

## API Design Patterns

### RESTful Endpoint Structure

```javascript
// ✅ GOOD: RESTful, resource-oriented
GET    /approval/workflow/:documentId        # Get workflow progress
GET    /approval/section/:sectionId/state    # Get section state
POST   /approval/lock                        # Lock section
POST   /approval/approve                     # Approve section
POST   /approval/progress                    # Progress to next stage
POST   /approval/version                     # Create version snapshot
GET    /approval/versions/:documentId        # List versions

// ❌ BAD: Action-oriented, inconsistent
POST   /lockSection
POST   /approveSection
GET    /getWorkflow
```

### Request/Response Format

#### Standard Success Response
```javascript
// ✅ CONSISTENT FORMAT
res.json({
  success: true,
  message: 'Section locked successfully',
  data: {
    state: lockState,
    section: sectionInfo
  }
});
```

#### Standard Error Response
```javascript
// ✅ CONSISTENT FORMAT
res.status(400).json({
  success: false,
  error: 'Section is already locked at this stage',
  code: 'SECTION_ALREADY_LOCKED'
});
```

### Input Validation

```javascript
// ✅ BEST PRACTICE: Use Joi schemas
const lockSectionSchema = Joi.object({
  section_id: Joi.string().uuid().required(),
  workflow_stage_id: Joi.string().uuid().required(),
  selected_suggestion_id: Joi.string().uuid().optional().allow(null),
  notes: Joi.string().max(5000).optional().allow('')
});

// Validate in route handler
router.post('/lock', requireMember, async (req, res) => {
  const { error, value } = lockSectionSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  // Use validated data
  const { section_id, workflow_stage_id } = value;
  // ...
});
```

### Middleware Chaining

```javascript
// ✅ GOOD: Clear permission chain
router.post('/lock',
  requireMember,              // Must be organization member
  requireStageApproval(),     // Must have approval rights for stage
  async (req, res) => {
    // ... handler
  }
);

// ✅ GOOD: Reusable middleware
router.post('/approve', requireMember, async (req, res) => {
  // Check specific permissions in handler
  if (!await canApproveStage(req, req.body.workflow_stage_id)) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions'
    });
  }
  // ...
});
```

---

## Database Query Optimization

### Avoid N+1 Queries

```javascript
// ❌ BAD: N+1 query pattern
const sections = await supabase
  .from('document_sections')
  .select('*')
  .eq('document_id', documentId);

for (const section of sections) {
  // Separate query for each section!
  const { data: states } = await supabase
    .from('section_workflow_states')
    .select('*')
    .eq('section_id', section.id);
  section.states = states;
}

// ✅ GOOD: Single query with join
const { data: sections } = await supabase
  .from('document_sections')
  .select(`
    *,
    workflow_states:section_workflow_states (
      *,
      workflow_stages:workflow_stage_id (
        stage_name,
        stage_order
      )
    )
  `)
  .eq('document_id', documentId);
```

### Use Appropriate Indexes

```sql
-- ✅ GOOD: Index on frequently queried columns
CREATE INDEX idx_section_workflow_section_status
  ON section_workflow_states(section_id, status);

-- ✅ GOOD: Partial index for common filters
CREATE INDEX idx_user_orgs_active
  ON user_organizations(organization_id, is_active)
  WHERE is_active = TRUE;

-- ✅ GOOD: Composite index for multi-column queries
CREATE INDEX idx_workflow_states_lookup
  ON section_workflow_states(section_id, workflow_stage_id, status);
```

### Query Only What You Need

```javascript
// ❌ BAD: Select everything
const { data: section } = await supabase
  .from('document_sections')
  .select('*')
  .eq('id', sectionId)
  .single();

// ✅ GOOD: Select specific fields
const { data: section } = await supabase
  .from('document_sections')
  .select('id, section_number, section_title, status')
  .eq('id', sectionId)
  .single();
```

### Use Transactions for Atomic Operations

```javascript
// ✅ BEST PRACTICE: Atomic multi-step operation
async function progressWithLock(sectionId, stageId, userId) {
  const { data, error } = await supabase.rpc('progress_and_lock', {
    p_section_id: sectionId,
    p_stage_id: stageId,
    p_user_id: userId
  });

  if (error) throw error;
  return data;
}

// Database function (atomic in PostgreSQL)
CREATE OR REPLACE FUNCTION progress_and_lock(
  p_section_id UUID,
  p_stage_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Both operations in same transaction
  UPDATE section_workflow_states
    SET status = 'approved'
    WHERE section_id = p_section_id;

  INSERT INTO section_workflow_states (...)
    VALUES (...);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
```

### Caching Strategy

```javascript
class WorkflowConfig {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.cacheTimestamps = new Map();
  }

  async loadWorkflow(organizationId, supabase) {
    const cacheKey = `workflow_${organizationId}`;

    // Check cache validity
    if (this.isValidCache(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Load from database
    const workflow = await this.fetchWorkflow(organizationId, supabase);

    // Update cache
    this.cache.set(cacheKey, workflow);
    this.cacheTimestamps.set(cacheKey, Date.now());

    return workflow;
  }

  isValidCache(key) {
    const timestamp = this.cacheTimestamps.get(key);
    return timestamp && (Date.now() - timestamp < this.cacheTTL);
  }

  invalidateCache(organizationId) {
    const cacheKey = `workflow_${organizationId}`;
    this.cache.delete(cacheKey);
    this.cacheTimestamps.delete(cacheKey);
  }
}
```

---

## Error Handling Patterns

### Consistent Error Structure

```javascript
class WorkflowError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Usage
throw new WorkflowError(
  'Section is already locked',
  'SECTION_LOCKED',
  400
);
```

### Error Middleware

```javascript
// Global error handler
function errorHandler(err, req, res, next) {
  // Log full error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    userId: req.session?.userId,
    path: req.path
  });

  // Send user-friendly response
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: isProduction ? 'An error occurred' : err.message,
    code: err.code || 'INTERNAL_ERROR'
  });
}
```

### Try-Catch Best Practices

```javascript
// ✅ GOOD: Specific error handling
router.post('/approve', requireMember, async (req, res) => {
  try {
    const result = await approveSection(req.body);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    // Handle specific errors
    if (error.code === 'SECTION_LOCKED') {
      return res.status(400).json({
        success: false,
        error: 'This section is already locked'
      });
    }

    if (error.code === 'PERMISSION_DENIED') {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to approve this section'
      });
    }

    // Generic error fallback
    console.error('Unexpected error approving section:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve section'
    });
  }
});
```

### Input Validation Errors

```javascript
// ✅ GOOD: Clear validation messages
const { error, value } = schema.validate(req.body, {
  abortEarly: false  // Return all validation errors
});

if (error) {
  const errors = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message
  }));

  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors
  });
}
```

---

## Testing Strategies

### Unit Test Structure

```javascript
describe('Workflow State Machine', () => {
  // Setup
  let workflow;

  beforeEach(() => {
    workflow = new ApprovalWorkflow();
  });

  // Test groups
  describe('State Transitions', () => {
    test('should allow valid transition', () => {
      expect(() => {
        workflow.transitionTo('committee_review');
      }).not.toThrow();
    });

    test('should reject invalid transition', () => {
      expect(() => {
        workflow.transitionTo('board_approved');
      }).toThrow('Invalid transition');
    });
  });

  describe('Permission Checks', () => {
    test('should require committee role for approval', async () => {
      const user = { role: 'member' };
      expect(workflow.canApprove(user)).toBe(false);
    });
  });
});
```

### Integration Test Pattern

```javascript
describe('Approval Workflow Integration', () => {
  let supabase;
  let testUser;
  let testSection;

  beforeAll(async () => {
    // Setup test database
    supabase = createTestSupabase();
    testUser = await createTestUser();
    testSection = await createTestSection();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData();
  });

  test('complete approval workflow', async () => {
    // 1. Submit for review
    const submitResult = await submitForReview(testSection.id);
    expect(submitResult.success).toBe(true);

    // 2. Committee approves
    const approveResult = await approveAtStage(
      testSection.id,
      'committee',
      testUser.id
    );
    expect(approveResult.success).toBe(true);

    // 3. Verify locked
    const state = await getSectionState(testSection.id);
    expect(state.status).toBe('locked');
  });
});
```

### Mock Supabase Calls

```javascript
const createMockSupabase = () => ({
  from: (table) => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: 'test-123' },
      error: null
    })
  }),

  rpc: jest.fn().mockResolvedValue({
    data: { success: true },
    error: null
  })
});
```

### Test Coverage Goals

```javascript
// ✅ Aim for:
// - 80%+ line coverage
// - 90%+ branch coverage
// - 100% critical path coverage

// Critical paths to test:
// 1. Permission checks
// 2. State transitions
// 3. Data validation
// 4. Error handling
// 5. Security boundaries
```

---

## Security Considerations

### Authentication & Authorization

```javascript
// ✅ ALWAYS check authentication first
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
}

// ✅ THEN check authorization
function requireMember(req, res, next) {
  if (!req.session.organizationId) {
    return res.status(403).json({
      success: false,
      error: 'Organization access required'
    });
  }
  next();
}

// ✅ FINALLY check specific permissions
router.post('/approve', requireAuth, requireMember, async (req, res) => {
  const canApprove = await checkApprovalPermission(req);
  if (!canApprove) {
    return res.status(403).json({
      success: false,
      error: 'Approval permission required'
    });
  }
  // ... proceed
});
```

### SQL Injection Prevention

```javascript
// ✅ GOOD: Parameterized query via Supabase
const { data } = await supabase
  .from('section_workflow_states')
  .select('*')
  .eq('section_id', sectionId)  // Automatically escaped
  .eq('status', 'approved');

// ❌ BAD: String concatenation
const query = `
  SELECT * FROM section_workflow_states
  WHERE section_id = '${sectionId}'
`;  // Vulnerable to SQL injection!
```

### XSS Prevention

```javascript
// ✅ GOOD: JSON responses (auto-escaped by Express)
res.json({
  success: true,
  section: {
    title: userInput  // Automatically JSON-escaped
  }
});

// ❌ BAD: HTML rendering without escaping
res.send(`<h1>${userInput}</h1>`);  // XSS vulnerability!
```

### CSRF Protection

```javascript
// ✅ Enable CSRF protection
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Apply to state-changing routes
router.post('/lock', csrfProtection, async (req, res) => {
  // CSRF token validated before handler runs
});

// In frontend, include token
<form action="/approval/lock" method="POST">
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
</form>
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const approvalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many approval requests, please try again later'
});

router.post('/approve', approvalLimiter, requireMember, async (req, res) => {
  // ... handler
});
```

### Sensitive Data Handling

```javascript
// ✅ GOOD: Never log sensitive data
console.log('User approved section:', {
  sectionId: section.id,
  userId: user.id,
  // ❌ DON'T LOG: passwords, tokens, API keys
});

// ✅ GOOD: Sanitize error messages
catch (error) {
  console.error('Internal error:', error);  // Full details in logs
  res.status(500).json({
    success: false,
    error: 'An error occurred'  // Generic message to user
  });
}
```

---

## Performance Optimization

### Database Connection Pooling

```javascript
// ✅ GOOD: Reuse connection pool
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    db: {
      poolSize: 10  // Maintain connection pool
    }
  }
);
```

### Batch Operations

```javascript
// ❌ BAD: Individual inserts
for (const section of sections) {
  await supabase
    .from('section_workflow_states')
    .insert({ section_id: section.id, status: 'draft' });
}

// ✅ GOOD: Batch insert
const states = sections.map(section => ({
  section_id: section.id,
  status: 'draft'
}));

await supabase
  .from('section_workflow_states')
  .insert(states);
```

### Pagination

```javascript
// ✅ GOOD: Paginate large result sets
async function getWorkflowHistory(sectionId, page = 1, pageSize = 50) {
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from('section_workflow_states')
    .select('*', { count: 'exact' })
    .eq('section_id', sectionId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize)
    }
  };
}
```

### Lazy Loading

```javascript
// ✅ GOOD: Load related data only when needed
async function getSectionSummary(sectionId) {
  // Light query for summary
  const { data: section } = await supabase
    .from('document_sections')
    .select('id, section_number, section_title')
    .eq('id', sectionId)
    .single();

  return section;
}

async function getSectionDetails(sectionId) {
  // Full query with all relations
  const { data: section } = await supabase
    .from('document_sections')
    .select(`
      *,
      workflow_states:section_workflow_states (*),
      suggestions:suggestions (*),
      versions:document_versions (*)
    `)
    .eq('id', sectionId)
    .single();

  return section;
}
```

### Response Compression

```javascript
// ✅ Enable compression
const compression = require('compression');

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6  // Balance between speed and compression ratio
}));
```

---

## Monitoring & Observability

### Structured Logging

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'workflow-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Usage
logger.info('Section locked', {
  sectionId: section.id,
  stageId: stage.id,
  userId: user.id,
  duration: Date.now() - startTime
});
```

### Performance Metrics

```javascript
const startTime = Date.now();

try {
  const result = await approveSection(sectionId);

  // Track success metrics
  metrics.increment('approval.success');
  metrics.timing('approval.duration', Date.now() - startTime);

  return result;
} catch (error) {
  // Track failure metrics
  metrics.increment('approval.failure', {
    errorType: error.code
  });
  throw error;
}
```

---

## Quick Reference Checklist

### Before Committing Code

- [ ] All tests passing
- [ ] Code follows style guide
- [ ] No console.log statements (use logger)
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Comments explain why, not what
- [ ] No hardcoded values (use config)
- [ ] SQL queries optimized
- [ ] Security checks in place

### Before Deploying

- [ ] Database migrations tested
- [ ] RLS policies verified
- [ ] Performance tested with realistic data
- [ ] Error monitoring configured
- [ ] Rollback plan documented
- [ ] Dependencies updated
- [ ] Security audit completed
- [ ] Documentation updated

---

**End of Best Practices Guide**
