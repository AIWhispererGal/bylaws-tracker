# Rollback Procedures
## Emergency Recovery Guide

**Purpose:** Restore application to working state if testing reveals critical issues

**When to Use:**
- Critical bugs found during testing
- Data corruption detected
- Application crashes or becomes unstable
- Google integration needs to be temporarily restored

---

## 🚨 Emergency Stop

If the application is running and causing issues:

```bash
# Stop the Node.js server immediately
Ctrl+C

# Or find and kill the process
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac:
lsof -ti:3000 | xargs kill -9
```

---

## 📊 Assess Current State

### Step 1: Check What Changed

```bash
# View uncommitted changes
git status

# See detailed diff of changes
git diff

# Check recent commits
git log --oneline -10

# Check current branch
git branch
```

### Step 2: Document the Issue

Create a file: `tests/ISSUE_REPORT_$(date +%Y%m%d).md`

```markdown
# Issue Report - [Date]

## Problem Description
[Describe what went wrong]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Error occurred here]

## Error Messages
```
[Paste error logs]
```

## Impact
- [ ] Critical - Application unusable
- [ ] High - Core features broken
- [ ] Medium - Some features affected
- [ ] Low - Minor issues only

## Attempted Solutions
[What you tried to fix it]
```

---

## 🔄 Rollback Options

Choose the appropriate rollback level based on severity:

### Level 1: Discard Uncommitted Changes (Safest)

If you haven't committed changes yet and want to undo recent edits:

```bash
# Preview what will be discarded
git diff HEAD

# Restore all files to last commit
git checkout .

# Remove untracked files (be careful!)
git clean -fd -n  # Preview what will be deleted
git clean -fd     # Actually delete

# Verify clean state
git status
```

**When to use:** Testing revealed issues before committing changes.

---

### Level 2: Revert Last Commit

If you committed changes but they caused problems:

```bash
# See recent commits
git log --oneline -5

# Soft reset - keeps changes as uncommitted
git reset --soft HEAD~1

# Or hard reset - discards changes completely
git reset --hard HEAD~1

# Verify
git log --oneline -5
```

**When to use:** Last commit introduced a bug.

---

### Level 3: Revert to Specific Commit

If you need to go back further:

```bash
# Find the good commit hash
git log --oneline --all

# Option A: Soft reset (keeps changes)
git reset --soft <commit-hash>

# Option B: Hard reset (discards changes)
git reset --hard <commit-hash>

# Force push if already pushed to remote (DANGEROUS)
git push --force origin main
```

**When to use:** Multiple commits need to be undone.

⚠️ **WARNING:** Only use `--force` push if you're the only developer or have coordinated with the team!

---

### Level 4: Create Revert Commit

If changes were pushed and others might have pulled them:

```bash
# Revert a specific commit (creates new commit)
git revert <commit-hash>

# Revert multiple commits
git revert <oldest-commit>..<newest-commit>

# Push the revert
git push origin main
```

**When to use:** Changes were pushed to remote repository.

---

## 💾 Database Rollback

### Backup Current State First

```bash
# Export current database state
npx supabase db dump --db-url $SUPABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Clean Test Data

Run in Supabase SQL Editor:

```sql
-- Identify test data (created today)
SELECT 'organizations' as table_name, COUNT(*) as count
FROM organizations
WHERE created_at > CURRENT_DATE
UNION ALL
SELECT 'bylaw_sections', COUNT(*)
FROM bylaw_sections
WHERE created_at > CURRENT_DATE
UNION ALL
SELECT 'bylaw_suggestions', COUNT(*)
FROM bylaw_suggestions
WHERE created_at > CURRENT_DATE;

-- Delete test data (cascade will handle related records)
-- ⚠️ VERIFY THESE ARE TEST RECORDS BEFORE RUNNING!

-- Delete test suggestions first (respects foreign keys)
DELETE FROM suggestion_sections
WHERE suggestion_id IN (
  SELECT id FROM bylaw_suggestions
  WHERE created_at > CURRENT_DATE
);

DELETE FROM bylaw_suggestions
WHERE created_at > CURRENT_DATE;

-- Delete test sections
DELETE FROM bylaw_sections
WHERE created_at > CURRENT_DATE;

-- Delete test organizations
DELETE FROM organizations
WHERE created_at > CURRENT_DATE;

-- Verify cleanup
SELECT 'organizations' as table_name, COUNT(*) as remaining
FROM organizations
WHERE created_at > CURRENT_DATE
UNION ALL
SELECT 'bylaw_sections', COUNT(*)
FROM bylaw_sections
WHERE created_at > CURRENT_DATE;
-- Should return 0 for all tables
```

### Restore from Backup

If you have a SQL backup file:

```bash
# Restore from backup file
psql $DATABASE_URL < backup_file.sql

# Or using Supabase CLI
npx supabase db push --db-url $SUPABASE_URL --file backup_file.sql
```

---

## 🔧 Restore Google Apps Script (If Needed)

If custom parser fails and you need to temporarily restore Google integration:

### Step 1: Reinstall Google Dependencies

```bash
# Install clasp CLI
npm install -g @google/clasp

# Add googleapis to project
npm install googleapis @google/clasp
```

### Step 2: Restore Google Code

```bash
# Copy archived Google scripts back
cp google-apps-script/Code.gs.active google-apps-script/Code.gs

# Or use version control
git checkout <commit-before-removal> -- google-apps-script/

# Push to Google Apps Script
cd google-apps-script
clasp login
clasp push
```

### Step 3: Re-enable Google in server.js

Edit server.js and uncomment/restore:

```javascript
// Restore Google Doc endpoint
app.post('/api/google-docs/fetch', async (req, res) => {
  // [Previous Google Docs fetching code]
});
```

### Step 4: Update Environment

Add back to .env:
```
GOOGLE_DOC_ID=your-document-id
GOOGLE_CLIENT_EMAIL=your-service-account-email
GOOGLE_PRIVATE_KEY=your-private-key
```

---

## 🔍 Verify Rollback Success

### Application Health Check

```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Start application
npm start

# Check for errors in console
# Should see: "Bylaws Amendment Tracker running on http://localhost:3000"
```

### UI Health Check

1. Open: http://localhost:3000
2. Check: No JavaScript errors in console (F12)
3. Verify: Pages load correctly
4. Test: Basic functionality works

### Database Health Check

```sql
-- Verify table structure intact
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should see:
-- bylaw_sections
-- bylaw_suggestions
-- organizations
-- suggestion_sections

-- Check data integrity
SELECT
  (SELECT COUNT(*) FROM organizations) as org_count,
  (SELECT COUNT(*) FROM bylaw_sections) as section_count,
  (SELECT COUNT(*) FROM bylaw_suggestions) as suggestion_count;
```

---

## 📝 Post-Rollback Actions

### 1. Document What Happened

Update `tests/ISSUE_REPORT_[DATE].md` with:
- Rollback steps taken
- Current state after rollback
- Data lost (if any)
- Lessons learned

### 2. Notify Team

If working with others:
```bash
# Add rollback note to git
git add tests/ISSUE_REPORT_*.md
git commit -m "Document rollback due to [issue]"
git push
```

### 3. Plan Fix

Before attempting migration again:
- [ ] Identify root cause
- [ ] Plan fix strategy
- [ ] Update migration plan
- [ ] Create better tests
- [ ] Test fix in isolated environment first

### 4. Update Testing Plan

Add new test cases to prevent the same issue:
- What wasn't tested that should have been?
- What assumptions were wrong?
- What edge case was missed?

---

## 🛡️ Prevention for Next Time

### Before Making Changes

```bash
# Create a safety branch
git checkout -b migration-google-removal-v2
git push -u origin migration-google-removal-v2

# Or create a full backup
tar -czf backup_$(date +%Y%m%d).tar.gz . --exclude=node_modules
```

### During Changes

```bash
# Commit frequently with clear messages
git add -A
git commit -m "feat: add mammoth parser"
git commit -m "refactor: remove Google API calls"
git commit -m "test: add parser unit tests"

# Push to backup branch
git push origin migration-google-removal-v2
```

### Database Safety

```bash
# Always export before major changes
pg_dump $DATABASE_URL > pre_migration_backup.sql

# Or use Supabase snapshots
# Navigate to: Supabase Dashboard → Database → Backups
# Click "Create Backup" before migration
```

---

## 🆘 Emergency Contacts

### If Rollback Fails

1. **Database Emergency:** Contact Supabase support with project ref
2. **Git Issues:** Seek help on GitHub discussions
3. **Code Issues:** Review previous working commit in git history

### Getting Help

```bash
# Find last known good commit
git log --all --oneline --graph

# Download last known good version
git archive --format=zip <commit-hash> -o last_good_version.zip

# Start fresh from that point
unzip last_good_version.zip -d ../bylaws-recovery/
cd ../bylaws-recovery/
npm install
npm start
```

---

## ✅ Rollback Checklist

Use this checklist when performing rollback:

- [ ] Application stopped (Ctrl+C)
- [ ] Current state documented
- [ ] Issue report created
- [ ] Git status checked
- [ ] Database backed up
- [ ] Appropriate rollback level chosen
- [ ] Rollback executed
- [ ] Application restarted successfully
- [ ] UI verified working
- [ ] Database integrity checked
- [ ] Team notified (if applicable)
- [ ] Lessons learned documented
- [ ] Prevention measures planned

---

## 📞 Support Resources

- **Git Documentation:** https://git-scm.com/docs
- **Supabase Status:** https://status.supabase.com
- **Node.js Debugging:** https://nodejs.org/en/docs/guides/debugging-getting-started/
- **Project Repository:** [Your repo URL]

---

**Remember:** It's better to rollback and try again than to push broken code to production!

**Last Updated:** 2025-10-11
**Document Version:** 1.0
