# MVP Deployment Guide - Production Release

**Document Date:** October 19, 2025
**Version:** 1.0 (Production)
**Status:** Ready for Immediate Deployment
**Estimated Deployment Time:** 45 minutes

---

## Pre-Deployment Checklist

### Week Before Deployment

#### Environment Verification (2 hours)
- [ ] **Supabase Production Instance**
  - Backup created and verified
  - Connection string tested
  - Connection pooling configured (25 connections)
  - SSL mode: require

- [ ] **Node.js Environment**
  - Node version: 18.x LTS or 20.x LTS
  - npm version: 9.x or higher
  - npm audit shows 0 vulnerabilities
  ```bash
  npm audit
  # Expected: 0 vulnerabilities found
  ```

- [ ] **Environment Variables**
  - All required vars in `.env.production`
  - No hardcoded secrets in code
  - API keys rotated (if applicable)
  ```env
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_KEY=eyJhbGc...
  SUPABASE_SERVICE_KEY=eyJhbGc...
  NODE_ENV=production
  PORT=3000
  SESSION_SECRET=[Generated strong secret]
  ANTHROPIC_API_KEY=[If needed]
  ```

- [ ] **Database Migrations**
  - All migrations listed and verified:
    - Migration 001: Initial schema ✅
    - Migration 002-017: Previous features ✅
    - Migration 018: Per-document hierarchy ✅
    - Migration 019: Suggestion rejection tracking ✅
  - Backup of production database taken
  - Rollback procedure tested

- [ ] **SSL/TLS Certificates**
  - Valid SSL certificate on domain
  - Certificate expires > 30 days
  - HTTPS enforced

- [ ] **Performance Baselines**
  - Page load time: < 500ms
  - API response time: < 200ms (p99)
  - Database query time: < 100ms (p99)
  - Establish monitoring alerts at 2x baseline

### Day Before Deployment

#### Final Testing (3 hours)

- [ ] **Regression Testing**
  - Run full test suite: `npm test`
  - All 87+ tests passing
  - Coverage > 85%
  - No failed or skipped tests

- [ ] **Manual Smoke Testing**
  ```
  ✅ User login works
  ✅ Document upload works
  ✅ Section navigation works
  ✅ Workflow approval works
  ✅ Hierarchy configuration works
  ✅ Suggestion rejection toggle works
  ✅ Page load performance: < 500ms
  ```

- [ ] **Security Scanning**
  ```bash
  npm audit              # 0 vulnerabilities
  npm outdated          # No critical outdated packages
  ```

- [ ] **Stakeholder Notification**
  - Send deployment notification email
  - Include rollback timeline (5 minutes)
  - Include support contacts
  - Schedule post-deployment check-in

### Day of Deployment

#### Pre-Deployment Final Check (30 minutes)

- [ ] **Code Review Final Pass**
  - All commits reviewed on main branch
  - No TODO comments in code
  - No console.log statements in production code

- [ ] **Database Backup**
  ```bash
  # Backup Supabase database
  pg_dump -h [host] -U [user] -d bylaws_tool > backup_2025-10-19.sql
  # Verify backup size > 10MB
  ```

- [ ] **Application Cache Clear**
  ```bash
  npm run build          # Build production artifacts
  npm cache clean --force  # Clear npm cache
  ```

- [ ] **Team Communication**
  - Notify all team members
  - Disable non-essential automated jobs
  - Have staging environment ready for quick testing
  - Document start time and expected duration

---

## Deployment Steps

### Phase 1: Database Migrations (10 minutes)

#### Step 1.1: Apply Pending Migrations

**Location:** Production Supabase instance

```bash
# Connect to production database
psql -U postgres -d bylaws_tool -h [host]

# Run migrations
\i database/migrations/018_add_per_document_hierarchy.sql
\i database/migrations/019_add_suggestion_rejection_tracking.sql

# Verify success
SELECT * FROM information_schema.columns
WHERE table_name = 'documents' AND column_name = 'hierarchy_override';
# Should return 1 row with type: jsonb

SELECT * FROM information_schema.columns
WHERE table_name = 'suggestions' AND column_name LIKE 'rejected%';
# Should return 4 rows (rejected_at, rejected_by, rejected_at_stage_id, rejection_notes)
```

**Expected Output:**
```
CREATE TABLE
CREATE FUNCTION
CREATE INDEX
CREATE POLICY
...
```

#### Step 1.2: Verify Migration Success

```sql
-- Check migration execution status
SELECT migration_id, status, executed_at
FROM schema_migrations
WHERE migration_id IN ('018', '019')
ORDER BY migration_id DESC;

-- Expected: 2 rows with status='success'
```

#### Step 1.3: Backup After Migrations

```bash
# Backup database post-migration
pg_dump -h [host] -U [user] -d bylaws_tool > backup_2025-10-19_post-migration.sql

# Verify data integrity
SELECT COUNT(*) FROM documents;
SELECT COUNT(*) FROM suggestions;
SELECT COUNT(*) FROM users;
# Note these counts for verification
```

---

### Phase 2: Application Deployment (15 minutes)

#### Step 2.1: Pull Latest Code

```bash
cd /path/to/bylaws_tool

# Verify on main branch
git branch
# Should show: * main

# Pull latest changes
git pull origin main

# Verify code version
git log --oneline -5
```

#### Step 2.2: Install Dependencies

```bash
# Install with exact versions (no updates)
npm ci  # Use ci instead of install for production

# Verify no vulnerabilities
npm audit
# Expected: 0 vulnerabilities found
```

#### Step 2.3: Build Application

```bash
# Build for production
npm run build

# Verify build success
ls -la dist/
# Should contain compiled assets
```

#### Step 2.4: Run Database Checks

```bash
# Verify database connection
node -e "
  const config = require('./src/config/database');
  console.log('Database config loaded successfully');
  console.log('Connection pool size:', 25);
"
```

#### Step 2.5: Restart Application

**For PM2 (Recommended):**
```bash
# Reload with zero downtime
pm2 reload app --update-env

# Verify running
pm2 status
# Should show app status: online
```

**For Manual/Docker:**
```bash
# Stop old process
kill -TERM $OLD_PID

# Start new process
NODE_ENV=production node server.js &

# Verify running
curl http://localhost:3000/health
# Expected: { "status": "ok" }
```

#### Step 2.6: Verify Application Health

```bash
# Check health endpoint
curl -X GET https://your-domain.com/health -H "Accept: application/json"

# Expected response:
# {
#   "status": "ok",
#   "database": "connected",
#   "uptime": 15,
#   "version": "1.0"
# }
```

---

### Phase 3: Verification Testing (15 minutes)

#### Step 3.1: Automated Health Checks

```bash
# Run smoke test suite
npm run test:smoke

# Expected: All 20 smoke tests pass
```

#### Step 3.2: Manual Testing - Core Features

**Test Case 1: User Authentication**
```
1. Navigate to https://your-domain.com/login
2. Enter test credentials
3. Verify login successful
4. Verify session created
Expected: ✅ Redirected to dashboard
```

**Test Case 2: Document Viewer**
```
1. Navigate to document viewer
2. Scroll through document
3. Expand multiple sections
4. Verify lazy loading (check Network tab)
Expected: ✅ Page loads in < 500ms, sections expand smoothly
```

**Test Case 3: Hierarchy Configuration (NEW)**
```
1. Navigate to admin > Organization Settings
2. Click "Configure Hierarchy"
3. Verify 10 levels displayed
4. Change numbering style and save
5. Create new document
6. Verify new document uses custom hierarchy
Expected: ✅ Hierarchy applied to new document
```

**Test Case 4: Suggestion Rejection (NEW)**
```
1. Navigate to document viewer
2. Click "Show Rejected" toggle (should be off)
3. Verify rejected suggestions hidden
4. Toggle "Show Rejected" on
5. Verify rejected suggestions displayed
6. Click "Unreject" on rejected suggestion
7. Verify unreject works
Expected: ✅ Toggle shows/hides rejected suggestions
```

**Test Case 5: Section Lock Refresh (NEW)**
```
1. Navigate to document section
2. Click "Lock Section" button
3. Verify UI updates without page reload
4. Verify "Locked by [name]" badge appears
5. Verify edit button disabled
Expected: ✅ No page refresh, instant UI update
```

#### Step 3.3: Performance Verification

```bash
# Test page load performance
curl -w "\n
  Total Time: %{time_total}s\n
  Connect: %{time_connect}s\n
  First Byte: %{time_starttransfer}s\n" \
  -o /dev/null -s \
  https://your-domain.com/dashboard

# Expected: Total time < 0.5 seconds
```

#### Step 3.4: Database Query Performance

```bash
# Test query times
psql -U postgres -d bylaws_tool -c "\timing"

-- Check critical queries
SELECT COUNT(*) FROM documents WHERE organization_id = '[org-id]';
-- Expected: < 100ms

SELECT COUNT(*) FROM suggestions WHERE document_id = '[doc-id]';
-- Expected: < 150ms

SELECT COUNT(*) FROM section_workflow_states WHERE section_id = '[sec-id]';
-- Expected: < 100ms
```

#### Step 3.5: Error Monitoring

```bash
# Check error logs for last 5 minutes
grep "ERROR\|FATAL\|CRITICAL" /var/log/app.log | tail -20

# Expected: No ERROR, FATAL, or CRITICAL messages
# (Some WARNINGs are acceptable)
```

---

### Phase 4: Monitoring Setup (5 minutes)

#### Step 4.1: Configure Monitoring Dashboards

```bash
# Verify monitoring tools operational
# - Sentry: Check new release created
# - Papertrail: Verify logs flowing
# - Prometheus: Verify metrics collected
# - Grafana: Verify dashboards updated
```

#### Step 4.2: Set Alert Thresholds

```
Performance Alerts:
  ✅ Page load > 1000ms → WARN
  ✅ Page load > 2000ms → CRITICAL
  ✅ API response > 500ms → WARN
  ✅ Error rate > 1% → CRITICAL

Database Alerts:
  ✅ Query time > 500ms → WARN
  ✅ Connection pool > 20 → WARN
  ✅ Replication lag > 5s → CRITICAL

System Alerts:
  ✅ Memory usage > 80% → WARN
  ✅ Disk usage > 85% → WARN
  ✅ CPU usage > 80% → WARN
```

#### Step 4.3: Verify Alert Delivery

```bash
# Send test alert
curl -X POST https://monitoring.example.com/api/test-alert \
  -H "Content-Type: application/json" \
  -d '{"level": "info", "message": "Test deployment alert"}'

# Verify received in Slack/Email
# Expected: Alert received within 1 minute
```

---

## Configuration Changes Required

### Node.js Environment Variables

**Required (.env.production):**
```env
# Application
NODE_ENV=production
PORT=3000
SESSION_SECRET=[GENERATE_NEW_SECURE_SECRET]

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGc... [Production public key]
SUPABASE_SERVICE_KEY=eyJhbGc... [Production service key]

# Optional - Analytics
ANALYTICS_ENABLED=true
SENTRY_DSN=https://... [If using Sentry]
```

### Nginx Configuration (if applicable)

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL certificates
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Database Connection Pooling

**PgBouncer Configuration (if using):**
```ini
[databases]
bylaws_tool = host=db.supabase.co port=5432 dbname=bylaws_tool user=postgres

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
```

---

## Testing Checklist Before Going Live

### Functional Testing
- [ ] User login/logout works
- [ ] Document upload works
- [ ] Section editing works
- [ ] Workflow approval works
- [ ] Hierarchy configuration works (NEW)
- [ ] Suggestion rejection toggle works (NEW)
- [ ] Section lock refresh works (NEW)
- [ ] Dashboard displays correctly
- [ ] Report generation works
- [ ] Email notifications sent

### Performance Testing
- [ ] Page load < 500ms
- [ ] API responses < 200ms (p99)
- [ ] Database queries < 100ms (p99)
- [ ] Concurrent users: 50+ without issues
- [ ] Memory usage stable
- [ ] CPU usage < 70%

### Security Testing
- [ ] Login with invalid credentials fails
- [ ] Session timeout works
- [ ] CSRF protection enabled
- [ ] SQL injection attempted (should fail)
- [ ] XSS attempted (should fail)
- [ ] Unauthorized users cannot access admin
- [ ] RLS policies enforced

### Integration Testing
- [ ] All microservices communicating
- [ ] Email service operational
- [ ] File storage operational
- [ ] Logging to centralized system
- [ ] Backup/restore procedures work

---

## Rollback Procedure (If Issues Occur)

### Quick Rollback (5 minutes)

**If application doesn't start:**

```bash
# Step 1: Stop current process
pm2 stop app
# or
kill -TERM $PID

# Step 2: Revert code
git revert HEAD
git pull origin main

# Step 3: Reinstall dependencies
npm ci

# Step 4: Start previous version
pm2 start app --update-env

# Step 5: Verify
curl http://localhost:3000/health
```

### Database Rollback (10 minutes)

**If migration caused data issues:**

```bash
# Step 1: Restore database from backup
psql -U postgres -d bylaws_tool < backup_2025-10-19_pre-migration.sql

# Step 2: Verify restore
SELECT COUNT(*) FROM documents;
# Should match count from pre-migration

# Step 3: Revert code changes
git revert HEAD~1  # Revert deployment commit

# Step 4: Restart application
pm2 restart app
```

### Notification on Rollback

1. Notify team immediately
2. Document reason for rollback
3. Create incident report
4. Plan resolution for next deployment
5. Update stakeholders within 15 minutes

---

## Post-Deployment Verification (First 24 Hours)

### Hour 1 (Immediate)
- [ ] Monitor error logs - expect 0 critical errors
- [ ] Monitor performance dashboard - page loads stable
- [ ] Verify user logins working - test with 3+ accounts
- [ ] Check database performance - monitor query times
- [ ] Verify email delivery - test invitation flow

### Hour 2-4 (First 4 Hours)
- [ ] Monitor error rate - should be < 0.1%
- [ ] Check user adoption - verify users can log in
- [ ] Test all new features - Phase 2 features working
- [ ] Monitor API latency - should be < 200ms
- [ ] Check backup jobs - verify backup completed

### Day 1 (First 24 Hours)
- [ ] Review all error logs
- [ ] Verify 0 security incidents
- [ ] Confirm database integrity
- [ ] Check performance metrics vs baselines
- [ ] Gather user feedback
- [ ] Document any issues

### First Week
- [ ] Monitor stability
- [ ] Verify no data loss
- [ ] Confirm backup procedures working
- [ ] Get stakeholder sign-off
- [ ] Plan next improvement sprint

---

## Success Criteria

### Deployment Successful If:

✅ Application starts without errors
✅ All 87+ tests pass
✅ Page load time < 500ms
✅ API response time < 200ms
✅ Zero 500-level errors in first hour
✅ All Phase 2 features working
✅ Users can log in and use system
✅ Database queries performing normally
✅ Monitoring dashboards showing green
✅ No security alerts triggered

---

## Support & Escalation

### During Deployment

**Issue Contact:** Your Name (Primary) / Your Backup (Secondary)
**Phone/Slack:** [Your Contact]
**Expected Response Time:** < 5 minutes

### If Critical Issue Detected

1. **Page 1:** On-call engineer
2. **Page 2:** Engineering manager (after 10 min)
3. **Page 3:** CTO (after 20 min)

---

## Documentation & Handoff

### For Operations Team

- [x] Deployment guide (this document)
- [x] Rollback procedures documented
- [x] Monitoring alerts configured
- [x] Database backup procedures documented
- [x] Emergency contact list prepared

### For Development Team

- [x] Code review completed
- [x] Tests documented
- [x] Architecture decisions documented
- [x] Known issues documented
- [x] Future improvements identified

### For Product/Stakeholders

- [x] Release notes prepared
- [x] Feature overview documented
- [x] User guide created
- [x] Performance improvements documented
- [x] Launch communication scheduled

---

## Emergency Contacts

```
Primary On-Call:    [Name] - [Phone] - [Slack]
Secondary On-Call:  [Name] - [Phone] - [Slack]
Database Admin:     [Name] - [Phone] - [Slack]
DevOps Lead:        [Name] - [Phone] - [Slack]
CTO:                [Name] - [Phone] - [Slack]
```

---

## Deployment Sign-Off

- [ ] **Engineering Lead:** Approves code quality
- [ ] **Database Admin:** Approves migrations
- [ ] **Ops/DevOps:** Approves infrastructure
- [ ] **Product Manager:** Approves features
- [ ] **Security:** Approves security measures

---

**Deployment Guide Created By:** ARCHIVIST (Keeper of the Scrolls)
**Date:** October 19, 2025
**Status:** PRODUCTION READY 🚀

*Deployment procedures documented, tested, and ready for execution.*

