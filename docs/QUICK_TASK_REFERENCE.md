# Quick Task Reference Guide

**Version:** 2.0
**Last Updated:** October 21, 2025
**Purpose:** Fast answers to common tasks

---

## 🚀 Installation & Setup (5 Common Tasks)

### 1. Fresh Installation (30-45 minutes)
```bash
# Step 1: Prerequisites
- Node.js 16+
- Supabase account
- Git

# Step 2: Clone and install
git clone <repository>
cd BYLAWSTOOL_Generalized
npm install

# Step 3: Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Step 4: Run setup wizard
npm start
# Navigate to http://localhost:3000/setup
```
**Full Guide:** [Installation Guide](INSTALLATION_GUIDE.md)

---

### 2. Deploy to Production (45 minutes)
```bash
# Pre-deployment checklist:
□ Environment variables configured
□ Database migrations applied
□ Tests passing
□ Security checklist complete

# Deployment steps:
1. Review: MVP_DEPLOYMENT_GUIDE.md
2. Apply migrations: npm run migrate
3. Deploy to Render/Heroku
4. Verify health: /api/health
5. Monitor logs for 24 hours
```
**Full Guide:** [MVP Deployment Guide](MVP_DEPLOYMENT_GUIDE.md)

---

### 3. Configure First Organization (10 minutes)
```bash
# Access setup wizard:
http://localhost:3000/setup

# Steps:
1. Organization Info (name, type, settings)
2. Document Type (hierarchy levels, numbering)
3. Workflow Stages (approval process)
4. Review & Confirm

# Alternative: Manual SQL
# See: database/seeds/example-organization.sql
```
**Full Guide:** [Setup Wizard User Guide](SETUP_WIZARD_USER_GUIDE.md)

---

### 4. Add First User (2 minutes)
```bash
# Option 1: Registration page
http://localhost:3000/register

# Option 2: Admin panel
1. Login as Global Admin
2. Navigate to /admin/users
3. Click "Invite User"
4. Send invitation email

# Option 3: Direct SQL (development only)
# See: database/seeds/create-test-user.sql
```
**Full Guide:** [User Roles & Permissions](USER_ROLES_AND_PERMISSIONS.md)

---

### 5. Import First Document (5 minutes)
```bash
# Upload via UI:
1. Login as Admin
2. Navigate to /dashboard
3. Click "Upload Document"
4. Select Word/PDF file
5. Review parsed sections
6. Confirm import

# Supported formats:
- Microsoft Word (.docx)
- PDF with text (.pdf)
- HTML
- Markdown (.md)
```
**Full Guide:** [Document Upload Guide](DASHBOARD_UPLOAD_INTEGRATION.md)

---

## 🔧 Configuration Tasks (5 Common)

### 6. Set Up Workflow Stages (15 minutes)
```javascript
// Via Setup Wizard or Admin Panel
Workflow Configuration:
  Stage 1: Committee Review
    - Approval type: Simple majority
    - Required approvers: 3
    - Time limit: 14 days

  Stage 2: Board Approval
    - Approval type: 2/3 majority
    - Required approvers: 5
    - Time limit: 30 days

  Stage 3: Final Review
    - Approval type: Unanimous
    - Required approvers: Board President
    - Time limit: 7 days
```
**Full Guide:** [Workflow Admin Guide](WORKFLOW_ADMIN_GUIDE.md)

---

### 7. Configure Document Hierarchy (10 minutes)
```javascript
// Example: Legal Document Structure
Hierarchy Levels (up to 10):
  Level 1: Chapter (I, II, III)
  Level 2: Article (A, B, C)
  Level 3: Section (1, 2, 3)
  Level 4: Subsection (a, b, c)
  Level 5: Clause (i, ii, iii)

// Configuration location:
Admin Panel → Organization Settings → Document Hierarchy
```
**Full Guide:** [ADR-002 Context-Aware Depth](ADR-002-CONTEXT-AWARE-DEPTH-ARCHITECTURE.md)

---

### 8. Set User Permissions (5 minutes)
```javascript
// Role Types:
1. Global Admin (system-wide access)
2. Organization Admin (org management)
3. Regular User (create suggestions)
4. View Only (read-only access)

// Assign role:
Admin Panel → Users → Select User → Change Role

// Bulk assignment:
Admin Panel → Users → Bulk Actions → Assign Role
```
**Full Guide:** [Permissions Quick Start](PERMISSIONS_QUICK_START.md)

---

### 9. Enable/Disable Features (2 minutes)
```bash
# Environment variables (.env):

# Feature flags:
ENABLE_PUBLIC_SUGGESTIONS=true
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_VOTING=true
ENABLE_COMMENTS=true
ENABLE_ANALYTICS=false

# Restart application after changes
npm restart
```
**Full Guide:** [Environment Variables](ENVIRONMENT_VARIABLES.md)

---

### 10. Configure Email Notifications (10 minutes)
```bash
# .env configuration:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Test email:
npm run test:email

# Enable notifications:
Admin Panel → Settings → Email Notifications → Enable
```
**Full Guide:** [Email Service Setup](../src/services/emailService.js)

---

## 🛠️ Maintenance Tasks (5 Common)

### 11. Backup Database (5 minutes)
```bash
# Supabase backup:
1. Login to Supabase dashboard
2. Navigate to Database → Backups
3. Click "Create Backup"
4. Download backup file

# CLI backup:
npm run db:backup

# Automated backups:
# Configure in Supabase: Settings → Backup Schedule
```
**Full Guide:** [Database Fix Guide](DATABASE_FIX_GUIDE.md)

---

### 12. Apply Database Migration (10 minutes)
```bash
# Check current version:
npm run db:version

# Apply specific migration:
npm run migrate:up -- 025

# Rollback migration:
npm run migrate:down -- 025

# Apply all pending:
npm run migrate

# Verify migration:
npm run db:verify
```
**Full Guide:** [Database Migrations](../database/migrations/README.md)

---

### 13. Monitor System Health (5 minutes)
```bash
# Health check endpoint:
curl http://localhost:3000/api/health

# Response:
{
  "status": "healthy",
  "database": "connected",
  "uptime": "24h 15m",
  "memory": "245MB / 512MB"
}

# Dashboard monitoring:
Admin Panel → System → Health Status

# Log monitoring:
tail -f logs/application.log
```
**Full Guide:** [System Health Monitoring](SYSTEM_HEALTH.md)

---

### 14. Clear Cache (2 minutes)
```bash
# Application cache:
npm run cache:clear

# Browser cache:
Ctrl + Shift + R (hard refresh)

# Redis cache (if using):
redis-cli FLUSHALL

# Session cache:
Admin Panel → System → Clear Sessions
```

---

### 15. Update Application (15 minutes)
```bash
# Pre-update checklist:
□ Backup database
□ Note current version
□ Review changelog

# Update steps:
git pull origin main
npm install
npm run migrate
npm test
npm restart

# Verify update:
Check /api/version
```
**Full Guide:** [Migration Guide](MIGRATION_GUIDE.md)

---

## 🔍 Troubleshooting Tasks (5 Common)

### 16. Fix Database Connection Error (5 minutes)
```bash
# Check environment variables:
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection:
npm run db:test

# Common issues:
1. Wrong credentials → Check .env
2. Network blocked → Check firewall
3. RLS blocking → Check policies
4. SSL required → Add ?sslmode=require

# Verify fix:
npm run db:ping
```
**Full Guide:** [Troubleshooting Guide](TROUBLESHOOTING.md)

---

### 17. Debug Parsing Errors (10 minutes)
```bash
# Enable debug mode:
DEBUG=parser:* npm start

# Check logs:
tail -f logs/parser.log

# Common issues:
1. Unsupported format → Convert to .docx
2. Complex numbering → Simplify structure
3. Missing sections → Check hierarchy config
4. Depth exceeded → Max 10 levels

# Test parser:
npm run test:parser -- --file=sample.docx
```
**Full Guide:** [Context-Aware Parsing README](CONTEXT-AWARE-PARSING-README.md)

---

### 18. Fix Permission Errors (5 minutes)
```bash
# Check user role:
Admin Panel → Users → View User Details

# Verify RLS policies:
npm run db:check-rls

# Common fixes:
1. User not in organization → Add to org
2. Wrong role assigned → Update role
3. RLS policy blocking → Check policies
4. Session expired → Re-login

# Grant emergency access (dev only):
npm run db:grant-admin -- user@email.com
```
**Full Guide:** [Permission Quick Reference](PERMISSION_QUICK_REFERENCE.md)

---

### 19. Resolve Workflow Stuck Issues (10 minutes)
```bash
# Check workflow status:
Admin Panel → Workflows → View Status

# Common issues:
1. No approvers assigned → Assign users
2. Deadline passed → Extend deadline
3. Lock conflict → Clear locks
4. Missing permissions → Update roles

# Manual workflow progression:
Admin Panel → Workflows → Manual Progress

# Reset workflow:
npm run workflow:reset -- <workflow-id>
```
**Full Guide:** [Workflow Admin Guide](WORKFLOW_ADMIN_GUIDE.md)

---

### 20. Recover from Errors (15 minutes)
```bash
# Check error logs:
tail -f logs/error.log

# Common recovery steps:
1. Restart application
2. Clear cache
3. Rollback migration (if recent)
4. Restore from backup
5. Contact support

# Emergency rollback:
git checkout <previous-version>
npm install
npm run migrate:rollback
npm restart
```
**Full Guide:** [Emergency Fixes Summary](EMERGENCY_FIXES_SUMMARY.md)

---

## 📊 Reporting Tasks (5 Common)

### 21. Generate User Activity Report (5 minutes)
```bash
# Via Admin Panel:
Reports → User Activity → Select Date Range

# Via API:
curl http://localhost:3000/api/reports/user-activity?start=2025-10-01&end=2025-10-31

# Via Database:
npm run report:users -- --days=30
```

---

### 22. Export Suggestions Report (5 minutes)
```bash
# All suggestions:
Admin Panel → Reports → Suggestions → Export CSV

# By status:
Reports → Filters → Status: Approved
          → Export

# Custom query:
npm run report:suggestions -- --status=pending --org=<org-id>
```

---

### 23. Workflow Performance Metrics (5 minutes)
```bash
# Dashboard view:
Admin Panel → Analytics → Workflow Performance

# Key metrics:
- Average approval time
- Bottleneck stages
- Approval rate
- Active workflows

# Export data:
Analytics → Export → Select Format (CSV/JSON)
```

---

### 24. Security Audit Report (10 minutes)
```bash
# Run security scan:
npm run security:audit

# Check RLS policies:
npm run db:audit-rls

# Review access logs:
Admin Panel → Security → Access Logs

# Generate report:
Security → Generate Audit Report
```
**Full Guide:** [Security Checklist](SECURITY_CHECKLIST.md)

---

### 25. Performance Benchmarks (10 minutes)
```bash
# Run benchmarks:
npm run benchmark

# Key metrics:
- Page load time
- API response time
- Database query time
- Memory usage

# Compare with baseline:
npm run benchmark:compare
```

---

## 🎯 Advanced Tasks (5 Common)

### 26. Custom Workflow Logic (30 minutes)
```javascript
// Location: src/routes/workflow.js

// Add custom approval logic:
router.post('/custom-approve', async (req, res) => {
  const { suggestionId, approverRole } = req.body;

  // Custom logic here
  if (approverRole === 'board-president') {
    // Special handling
  }

  await progressWorkflow(suggestionId);
});
```
**Full Guide:** [Workflow Best Practices](WORKFLOW_BEST_PRACTICES.md)

---

### 27. Integrate External API (45 minutes)
```javascript
// Example: Slack notifications
const notifySlack = async (message) => {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ text: message })
  });
};

// Use in workflow:
await notifySlack(`New suggestion awaiting approval`);
```
**Full Guide:** [API Reference](WORKFLOW_API_REFERENCE.md)

---

### 28. Customize Document Parser (60 minutes)
```javascript
// Location: src/parsers/wordParser.js

// Add custom numbering scheme:
const customNumbering = {
  pattern: /^[A-Z]{2}-\d{3}/,  // e.g., AA-001
  levels: {
    1: /^[A-Z]{2}-\d{3}$/,
    2: /^[A-Z]{2}-\d{3}\.\d$/,
  }
};

// Register custom parser:
registerCustomParser('corporate', customNumbering);
```
**Full Guide:** [Context-Aware Parser Implementation](CONTEXT_AWARE_PARSER_IMPLEMENTATION.md)

---

### 29. Create Custom Reports (45 minutes)
```javascript
// Location: src/routes/reports.js

router.get('/custom-report', async (req, res) => {
  const data = await supabase
    .from('suggestions')
    .select('*')
    .eq('organization_id', req.user.organization_id);

  // Custom aggregation
  const summary = aggregateData(data);

  res.json(summary);
});
```

---

### 30. Setup Multi-Tenant Instance (2 hours)
```bash
# Enable multi-tenant mode:
MULTI_TENANT_ENABLED=true

# Configure organization isolation:
npm run setup:multi-tenant

# Create first organization:
npm run org:create -- --name="Organization 1"

# Verify isolation:
npm run test:multi-tenant
```
**Full Guide:** [Multi-Tenant Architecture](ARCHITECTURE_DESIGN.md)

---

## 📚 Additional Resources

### Learning Paths

**Beginner Path (2-3 hours):**
1. Quick Start Guide (15 min)
2. Setup Wizard (10 min)
3. Basic Workflow (30 min)
4. User Management (30 min)
5. Upload Document (15 min)

**Administrator Path (4-5 hours):**
1. Installation Guide (45 min)
2. Workflow Configuration (60 min)
3. Permission Management (45 min)
4. Reporting & Analytics (60 min)
5. Troubleshooting (60 min)

**Developer Path (8-10 hours):**
1. Architecture Overview (120 min)
2. Database Schema (90 min)
3. API Reference (120 min)
4. Testing Guide (90 min)
5. Advanced Customization (180 min)

---

## 🎓 Training Checklists

### New User Onboarding
- [ ] Account created
- [ ] Role assigned
- [ ] Dashboard tour completed
- [ ] First suggestion submitted
- [ ] Notification preferences set

### New Admin Onboarding
- [ ] Admin access verified
- [ ] Organization configured
- [ ] First workflow created
- [ ] Users invited
- [ ] First document uploaded

### Developer Onboarding
- [ ] Development environment setup
- [ ] Tests passing
- [ ] Database accessible
- [ ] Documentation reviewed
- [ ] First feature deployed

---

## 🔗 Quick Links

**Essential Documentation:**
- [Master Index](MASTER_INDEX.md) - All documentation
- [Installation Guide](INSTALLATION_GUIDE.md) - Setup
- [Troubleshooting](TROUBLESHOOTING.md) - Problems
- [API Reference](WORKFLOW_API_REFERENCE.md) - APIs

**Support:**
- GitHub Issues - Bug reports
- Team Slack - Quick questions
- Documentation - Search first

---

**Last Updated:** October 21, 2025
**Version:** 2.0
**Maintained By:** Documentation Team

---

*For comprehensive information, see the [Master Index](MASTER_INDEX.md)*
