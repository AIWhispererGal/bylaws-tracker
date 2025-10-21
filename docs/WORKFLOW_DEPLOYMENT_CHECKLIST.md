# Workflow System Deployment Checklist

**Version:** 1.0
**Last Updated:** 2025-10-14
**Target Environment:** Production

---

## Overview

This checklist ensures the workflow system is deployed safely and completely. Follow each section in order.

**Estimated Time**: 3-4 hours (including testing)

---

## Pre-Deployment Checklist

### 1. Code Review ✅

- [ ] All code reviewed and approved
- [ ] No console.log() statements in production code
- [ ] No hardcoded credentials or secrets
- [ ] Error handling in place for all endpoints
- [ ] Input validation via Joi schemas
- [ ] RLS policies reviewed for security

**Files to Review**:
- `/src/routes/approval.js`
- `/src/routes/workflow.js` (if implemented)
- `/src/middleware/roleAuth.js`
- `/database/migrations/008_enhance_user_roles_and_approval.sql`

### 2. Testing ✅

- [ ] All unit tests passing (90%+ coverage target)
- [ ] All integration tests passing
- [ ] E2E tests for critical workflows passing
- [ ] Security tests passing (RLS enforcement)
- [ ] Performance tests passing (<500ms API response)

**Test Commands**:
```bash
npm test
npm run test:integration
npm run test:e2e
npm run test:security
```

**Expected Results**:
```
Unit Tests: 47/50 passing (94%)
Integration Tests: 15/15 passing (100%)
E2E Tests: 8/8 passing (100%)
Security Tests: 12/12 passing (100%)
```

### 3. Documentation ✅

- [ ] Architecture documentation complete
- [ ] User guide complete
- [ ] Admin guide complete
- [ ] API reference complete
- [ ] Deployment checklist reviewed (this document)

**Documents**:
- `docs/WORKFLOW_SYSTEM_ARCHITECTURE.md`
- `docs/WORKFLOW_USER_GUIDE.md`
- `docs/WORKFLOW_ADMIN_GUIDE.md`
- `docs/WORKFLOW_API_REFERENCE.md`
- `docs/WORKFLOW_DEPLOYMENT_CHECKLIST.md`

### 4. Database Backup ✅

- [ ] Full database backup created
- [ ] Backup verified and downloadable
- [ ] Backup stored in secure location
- [ ] Rollback plan documented

**Backup Command** (Supabase):
```bash
# Via Supabase Dashboard
1. Navigate to Database → Backups
2. Click "Create Backup"
3. Name: "pre-workflow-deployment-2025-10-14"
4. Download backup file
```

**Backup Command** (Self-Hosted):
```bash
pg_dump -h localhost -U postgres -d bylaws_db \
  -F c -b -v -f backup_pre_workflow_$(date +%Y%m%d).dump
```

### 5. Environment Configuration ✅

- [ ] Environment variables set correctly
- [ ] Supabase URL configured
- [ ] Supabase keys configured (anon + service role)
- [ ] Session secret is strong (32+ characters)
- [ ] APP_URL set to production domain

**Environment Check**:
```bash
# Verify environment variables
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗')"
node -e "console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓' : '✗')"
node -e "console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗')"
node -e "console.log('SESSION_SECRET length:', process.env.SESSION_SECRET.length)"
```

---

## Deployment Steps

### Phase 1: Database Migration (30-45 minutes)

#### Step 1.1: Verify Migration File ✅

- [ ] Migration file exists: `database/migrations/008_enhance_user_roles_and_approval.sql`
- [ ] Migration has no syntax errors
- [ ] Migration is idempotent (can run multiple times safely)

**Validation Command**:
```bash
# Test migration on local database first
psql -h localhost -U postgres -d bylaws_dev -f database/migrations/008_enhance_user_roles_and_approval.sql
```

#### Step 1.2: Run Migration in Production ✅

**WARNING**: This modifies production database. Ensure backup is complete first.

- [ ] Set maintenance mode (optional but recommended)
- [ ] Run migration via Supabase SQL Editor or psql
- [ ] Verify migration completed without errors
- [ ] Check migration output for success messages

**Migration Command** (Supabase):
1. Navigate to Supabase Dashboard → SQL Editor
2. Copy contents of `008_enhance_user_roles_and_approval.sql`
3. Paste into editor
4. Click "Run"
5. Verify output shows "Migration 008 Completed Successfully"

**Migration Command** (Self-Hosted):
```bash
psql -h production-db-host -U postgres -d bylaws_prod \
  -f database/migrations/008_enhance_user_roles_and_approval.sql
```

#### Step 1.3: Verify Migration Results ✅

- [ ] Tables created successfully
- [ ] Indexes created successfully
- [ ] RLS policies created successfully
- [ ] Helper functions created successfully
- [ ] Default workflows created for all organizations

**Verification Queries**:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'workflow_templates',
    'workflow_stages',
    'document_workflows',
    'section_workflow_states',
    'document_versions',
    'user_activity_log'
  );
-- Expected: 6 rows

-- Check indexes exist
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE '%workflow%'
ORDER BY indexname;
-- Expected: 10+ indexes

-- Check default workflows created
SELECT o.name, COUNT(wt.id) as template_count
FROM organizations o
LEFT JOIN workflow_templates wt ON o.id = wt.organization_id
GROUP BY o.id, o.name;
-- Expected: Each org has at least 1 template

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE '%workflow%' OR tablename = 'user_activity_log'
ORDER BY tablename, policyname;
-- Expected: 6+ policies
```

#### Step 1.4: Test Database Functions ✅

- [ ] `user_has_role()` function works correctly
- [ ] `user_can_approve_stage()` function works correctly
- [ ] RLS policies enforcing correctly

**Test Queries**:
```sql
-- Test user_has_role()
SELECT user_has_role(
  '550e8400-e29b-41d4-a716-446655440000'::uuid, -- user_id
  '650e8400-e29b-41d4-a716-446655440000'::uuid, -- org_id
  'admin'
);
-- Expected: true or false based on actual user role

-- Test user_can_approve_stage()
SELECT user_can_approve_stage(
  '550e8400-e29b-41d4-a716-446655440000'::uuid, -- user_id
  '750e8400-e29b-41d4-a716-446655440000'::uuid  -- stage_id
);
-- Expected: true or false based on user role and stage requirements

-- Test RLS policy
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO '550e8400-e29b-41d4-a716-446655440000';
SELECT * FROM workflow_templates WHERE organization_id = 'org-uuid';
-- Expected: Only templates from user's organization
```

### Phase 2: Application Deployment (30-45 minutes)

#### Step 2.1: Deploy Updated Server Code ✅

- [ ] Git repository up to date
- [ ] All changes committed
- [ ] Git tag created for deployment version
- [ ] Changes pushed to production branch

**Git Commands**:
```bash
# Commit any final changes
git add .
git commit -m "Deploy workflow system v1.0"

# Tag deployment
git tag -a workflow-v1.0 -m "Workflow system deployment"

# Push to production branch
git push origin main
git push origin workflow-v1.0
```

#### Step 2.2: Update Routes Registration ✅

Verify `server.js` has workflow routes registered:

- [ ] Approval routes registered: `app.use('/api/approval', approvalRoutes)`
- [ ] Workflow routes registered (if implemented): `app.use('/api/workflows', workflowRoutes)`
- [ ] Global admin middleware attached before routes
- [ ] Routes positioned after authentication middleware

**Verification** (in `server.js`):
```javascript
// Line ~217-218
app.use(attachGlobalAdminStatus);

// Line ~221-222
const adminRoutes = require('./src/routes/admin');
app.use('/admin', adminRoutes);

// Line ~234-235
const approvalRoutes = require('./src/routes/approval');
app.use('/api/approval', approvalRoutes);

// Line ~238-239 (if implemented)
const workflowRoutes = require('./src/routes/workflow');
app.use('/api/workflows', workflowRoutes);
```

#### Step 2.3: Deploy Application ✅

**For Render.com** (or similar platforms):
- [ ] Push changes to connected Git repository
- [ ] Automatic deployment triggered
- [ ] Wait for deployment to complete
- [ ] Verify deployment status in dashboard

**For Manual Deployment**:
```bash
# SSH into production server
ssh production-server

# Pull latest changes
cd /path/to/app
git pull origin main

# Install dependencies (if package.json changed)
npm install

# Restart application
pm2 restart bylaws-app
# or
sudo systemctl restart bylaws-app
```

#### Step 2.4: Verify Application Started ✅

- [ ] Application started without errors
- [ ] Health check endpoint responding
- [ ] Logs show no startup errors
- [ ] API endpoints responding

**Health Check**:
```bash
curl https://your-app.com/api/health
# Expected: {"status":"healthy","database":"connected"}
```

**Log Check**:
```bash
# Check application logs
pm2 logs bylaws-app --lines 50
# or
sudo journalctl -u bylaws-app -n 50
```

### Phase 3: Verification Testing (45-60 minutes)

#### Step 3.1: API Endpoint Testing ✅

Test each API endpoint in production:

- [ ] `GET /api/approval/workflow/:documentId` - Returns workflow config
- [ ] `GET /api/approval/section/:sectionId/state` - Returns section state
- [ ] `POST /api/approval/lock` - Locks section successfully
- [ ] `POST /api/approval/approve` - Approves section successfully
- [ ] `POST /api/approval/progress` - Progresses section successfully
- [ ] `POST /api/approval/version` - Creates version successfully
- [ ] `GET /api/approval/versions/:documentId` - Lists versions successfully

**Test Script** (using curl):
```bash
# Get workflow
curl -H "Cookie: connect.sid=$SESSION_COOKIE" \
  https://your-app.com/api/approval/workflow/$DOCUMENT_ID

# Get section state
curl -H "Cookie: connect.sid=$SESSION_COOKIE" \
  https://your-app.com/api/approval/section/$SECTION_ID/state

# Approve section (test in Postman or similar)
curl -X POST -H "Cookie: connect.sid=$SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"section_id":"$SECTION_ID","workflow_stage_id":"$STAGE_ID","status":"approved"}' \
  https://your-app.com/api/approval/approve
```

#### Step 3.2: UI Testing ✅

Test user interface workflows:

- [ ] Dashboard loads correctly
- [ ] Document viewer shows workflow progress bar
- [ ] Section workflow status badges display correctly
- [ ] Approval action buttons appear based on permissions
- [ ] Approval history panel shows correctly
- [ ] Workflow stage indicators update after approval

**Manual Test Flow**:
1. Log in as Admin user
2. Navigate to a document
3. Verify workflow progress bar shows
4. Click on a section
5. Verify section detail shows current stage
6. Click "Approve" button (if available)
7. Verify approval is recorded
8. Verify section advances to next stage
9. Verify approval history updates

#### Step 3.3: Permission Testing ✅

Test role-based permissions:

- [ ] Viewer cannot create suggestions
- [ ] Member cannot approve sections
- [ ] Admin can approve at Stage 1 (if allowed)
- [ ] Admin cannot approve at Owner-only stages
- [ ] Owner can approve at all stages
- [ ] Global admin can access all organizations

**Test Matrix**:

| User Role | Create Suggestion | Approve Stage 1 | Approve Stage 2 | Expected |
|-----------|------------------|-----------------|-----------------|----------|
| Viewer | Try | - | - | ❌ Denied |
| Member | Try | Try | - | ✅ Suggest only |
| Admin | - | Try | Try | ✅ Stage 1 only |
| Owner | - | Try | Try | ✅ Both stages |

#### Step 3.4: Multi-Tenant Isolation Testing ✅

Test RLS enforcement:

- [ ] User A cannot see workflows from Org B
- [ ] User A cannot approve sections in Org B
- [ ] Global admin CAN see/approve in all orgs
- [ ] Switching organizations updates context correctly

**Test Steps**:
1. Log in as User A (Org 1)
2. Note current organization ID
3. Try to access document from Org 2 (should fail)
4. Switch to Org 2 (if member)
5. Verify can now access Org 2 documents
6. Switch back to Org 1
7. Verify can access Org 1 documents again

#### Step 3.5: End-to-End Workflow Test ✅

Complete full approval workflow:

- [ ] Create a test document
- [ ] Add suggestions to sections
- [ ] Lock sections at Stage 1 (Committee Review)
- [ ] Approve sections at Stage 1
- [ ] Progress sections to Stage 2 (Board Approval)
- [ ] Approve sections at Stage 2
- [ ] Create version snapshot
- [ ] Verify version created successfully

**Test Document**: Create test document with 3-5 sections to approve

### Phase 4: Post-Deployment ✅

#### Step 4.1: Monitoring Setup ✅

- [ ] Error logging configured
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured
- [ ] Database connection pool monitored

**Monitoring Tools**:
- Application logs: PM2 logs, CloudWatch, etc.
- Database monitoring: Supabase Dashboard
- Uptime: UptimeRobot, Pingdom, etc.
- Error tracking: Sentry, Rollbar, etc.

#### Step 4.2: Alert Configuration ✅

- [ ] Email alerts for critical errors
- [ ] Slack/Discord notifications for deployments
- [ ] Database performance alerts
- [ ] API response time alerts (>2s)

#### Step 4.3: Documentation Updates ✅

- [ ] Deployment documented in change log
- [ ] User documentation published
- [ ] Admin documentation published
- [ ] API documentation published
- [ ] Release notes created

**Release Notes Template**:
```markdown
# Workflow System Release v1.0

**Release Date**: 2025-10-14
**Deployment Time**: 14:00 UTC

## New Features

- Multi-stage approval workflows
- Role-based permissions per stage
- Section-level approval tracking
- Complete audit trail
- Version snapshots at approval milestones

## Migration Notes

- Migration 008 adds 6 new tables
- Default 2-stage workflow created for all organizations
- All users retain existing roles

## Breaking Changes

None

## Known Issues

None

## Upgrade Path

Automatic - no manual steps required for users
```

#### Step 4.4: User Communication ✅

- [ ] Email sent to all users announcing new feature
- [ ] In-app notification displayed
- [ ] Training materials published
- [ ] Support team briefed

**Email Template**:
```
Subject: [New Feature] Multi-Stage Approval Workflows Now Available

Dear [Organization] Members,

We're excited to announce the launch of our new Workflow System!

WHAT'S NEW:
- Structured approval process with multiple stages
- Clear visibility into approval status
- Complete audit trail of all approvals
- Role-based permissions for each stage

GETTING STARTED:
- View our User Guide: [link]
- Watch tutorial video: [link]
- Contact support: support@example.com

Thank you for using our platform!
```

#### Step 4.5: Rollback Plan ✅

Document rollback procedure in case of critical issues:

- [ ] Rollback steps documented
- [ ] Database rollback script ready
- [ ] Previous application version tagged
- [ ] Rollback decision criteria defined

**Rollback Decision Criteria**:
- Critical bug affecting >50% of users
- Data corruption detected
- Performance degradation >10x
- Security vulnerability discovered

**Rollback Steps**:
```bash
# 1. Restore database from backup
pg_restore -h production-db -U postgres -d bylaws_prod backup_pre_workflow_20251014.dump

# 2. Revert application code
git checkout <previous-version-tag>
pm2 restart bylaws-app

# 3. Verify rollback successful
curl https://your-app.com/api/health

# 4. Notify users of rollback
# Send email explaining situation
```

---

## Post-Deployment Monitoring (24-48 hours)

### Hour 1-4: Critical Monitoring ✅

- [ ] Monitor error logs every 30 minutes
- [ ] Check API response times
- [ ] Verify no database connection issues
- [ ] Monitor user activity (are they using new features?)

**Key Metrics**:
- API response time: <500ms average
- Error rate: <1%
- Database connections: <80% of pool
- User adoption: 10%+ of users testing workflow

### Day 1: Active Monitoring ✅

- [ ] Review error logs 3x per day
- [ ] Check performance metrics
- [ ] Respond to user questions within 2 hours
- [ ] Document any issues or feedback

### Day 2-7: Ongoing Monitoring ✅

- [ ] Daily error log review
- [ ] Daily performance check
- [ ] Collect user feedback
- [ ] Plan improvements based on feedback

---

## Success Criteria

Deployment is successful if:

- ✅ All migrations completed without errors
- ✅ All API endpoints responding correctly
- ✅ UI displaying workflow features
- ✅ Permissions enforcing correctly
- ✅ RLS policies working as expected
- ✅ No critical errors in logs
- ✅ User adoption >10% in first week
- ✅ Positive user feedback

---

## Troubleshooting

### Issue: Migration Failed

**Symptoms**: Migration script errors out

**Steps**:
1. Review error message in migration output
2. Check if table/column already exists
3. If idempotent checks failed, fix migration
4. Restore database from backup
5. Re-run corrected migration

### Issue: API Endpoints Not Responding

**Symptoms**: 404 errors on `/api/approval/*`

**Steps**:
1. Check `server.js` has routes registered
2. Verify route files exist in `/src/routes/`
3. Check application logs for startup errors
4. Restart application: `pm2 restart bylaws-app`

### Issue: Permission Denied Errors

**Symptoms**: 403 errors when trying to approve

**Steps**:
1. Check user's role in database
2. Verify workflow stage's `required_roles`
3. Test `user_can_approve_stage()` function
4. Check RLS policies are active
5. Review session data (`req.session`)

### Issue: Workflow Not Showing in UI

**Symptoms**: Workflow progress bar not displaying

**Steps**:
1. Check document has workflow assigned
2. Verify workflow template exists for organization
3. Check browser console for JavaScript errors
4. Verify API endpoint returning workflow data
5. Check EJS template has workflow rendering code

---

## Rollback Triggers

**Immediate Rollback** if:
- Data corruption detected
- Critical security vulnerability found
- >50% of users affected by bugs
- Database performance degraded >10x
- Compliance violation detected

**Planned Rollback** if:
- Non-critical bugs affecting <10% users (fix and redeploy)
- Performance degradation <3x (optimize and redeploy)
- Feature not adopted by users (iterate and improve)

---

## Final Sign-Off

### Deployment Team

- [ ] Database Admin: _____________ Date: _______
- [ ] Backend Developer: _____________ Date: _______
- [ ] Frontend Developer: _____________ Date: _______
- [ ] QA Engineer: _____________ Date: _______
- [ ] DevOps Engineer: _____________ Date: _______

### Approval

- [ ] Product Manager: _____________ Date: _______
- [ ] Engineering Lead: _____________ Date: _______

### Post-Deployment Review

- [ ] 24-hour review completed: _____________ Date: _______
- [ ] 7-day review completed: _____________ Date: _______
- [ ] Lessons learned documented: _____________

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Next Review**: After deployment completion
**Maintained By**: DevOps Team
