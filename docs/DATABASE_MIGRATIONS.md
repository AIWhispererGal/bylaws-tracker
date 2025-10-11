# Database Migration Guide for Render Deployment

## Overview

This guide covers database migration strategy for deploying the Bylaws Amendment Tracker to production using Supabase PostgreSQL.

---

## Migration Files

All migration files are located in `database/migrations/`:

```
database/migrations/
├── 001_generalized_schema.sql          # Core multi-tenant schema
├── 002_migrate_existing_data.sql       # Data migration (optional)
├── SIMPLE_SETUP.sql                    # Simplified setup
├── FIX_ORGANIZATIONS_SCHEMA.sql        # Schema fixes
├── COMPLETE_FIX_ORGANIZATIONS.sql      # Complete fix
├── CLEAR_ORGANIZATIONS.sql             # Reset organizations
└── NUKE_TEST_DATA.sql                  # Clear all test data
```

---

## Production Migration Strategy

### Option 1: Clean Installation (Recommended for New Deployments)

**Use this if**:
- First-time deployment
- No existing data to preserve
- Starting fresh

**Steps**:

1. **Create Supabase Project**:
   ```bash
   # Go to https://supabase.com
   # Create new project
   # Note down: Project URL and Anon Key
   ```

2. **Run Core Schema Migration**:
   ```sql
   -- In Supabase SQL Editor, run:
   -- database/migrations/001_generalized_schema.sql

   -- This creates:
   -- ✅ Organizations table
   -- ✅ Users and user_organizations
   -- ✅ Documents and document_sections
   -- ✅ Amendments and amendment_sections
   -- ✅ Comments
   -- ✅ Workflows and stages
   -- ✅ All indexes and constraints
   ```

3. **Verify Tables Created**:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;

   -- Expected output:
   -- amendments
   -- amendment_sections
   -- comments
   -- document_sections
   -- documents
   -- organizations
   -- stage_transitions
   -- user_organizations
   -- users
   -- workflow_stages
   -- workflows
   ```

4. **Enable Row Level Security**:
   ```sql
   -- Run for each table
   ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
   ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
   ALTER TABLE amendments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE amendment_sections ENABLE ROW LEVEL SECURITY;
   ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
   ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
   ALTER TABLE stage_transitions ENABLE ROW LEVEL SECURITY;
   ```

5. **Create Basic RLS Policies**:
   ```sql
   -- Example: Users can view their organization data
   CREATE POLICY "org_select_policy" ON organizations
     FOR SELECT
     USING (
       id IN (
         SELECT organization_id
         FROM user_organizations
         WHERE user_id = auth.uid()
       )
     );

   -- Add more policies as needed
   ```

### Option 2: Migration from Existing Data

**Use this if**:
- Migrating from old schema
- Have existing bylaws data
- Need to preserve history

**Steps**:

1. **Backup Existing Data**:
   ```sql
   -- Export current data
   COPY (SELECT * FROM bylaw_sections) TO '/tmp/sections_backup.csv' CSV HEADER;
   COPY (SELECT * FROM bylaw_suggestions) TO '/tmp/suggestions_backup.csv' CSV HEADER;
   ```

2. **Run Core Schema**:
   ```sql
   -- Run: database/migrations/001_generalized_schema.sql
   ```

3. **Run Data Migration**:
   ```sql
   -- Run: database/migrations/002_migrate_existing_data.sql

   -- This script:
   -- ✅ Creates default organization
   -- ✅ Migrates bylaw_sections → document_sections
   -- ✅ Migrates bylaw_suggestions → amendments
   -- ✅ Preserves relationships
   -- ✅ Maintains history
   ```

4. **Verify Data Migration**:
   ```sql
   -- Check organization created
   SELECT * FROM organizations;

   -- Check sections migrated
   SELECT COUNT(*) FROM document_sections;

   -- Check amendments migrated
   SELECT COUNT(*) FROM amendments;

   -- Verify relationships
   SELECT ds.section_citation, COUNT(a.id) as amendment_count
   FROM document_sections ds
   LEFT JOIN amendment_sections ams ON ds.id = ams.section_id
   LEFT JOIN amendments a ON ams.amendment_id = a.id
   GROUP BY ds.id, ds.section_citation;
   ```

---

## Migration Execution Methods

### Method A: Supabase SQL Editor (Recommended)

**Pros**:
- ✅ Visual interface
- ✅ Query history
- ✅ Error highlighting
- ✅ No local tools needed

**Steps**:
1. Login to Supabase Dashboard
2. Go to SQL Editor
3. Click "New Query"
4. Copy-paste migration SQL
5. Click "Run"
6. Review results

**Tips**:
- Run one migration at a time
- Check for errors before next migration
- Save successful queries for reference

### Method B: psql CLI

**Pros**:
- ✅ Scriptable
- ✅ Good for large migrations
- ✅ Can run multiple files

**Steps**:
1. Get connection string from Supabase:
   ```
   Settings → Database → Connection String → URI
   ```

2. Run migration:
   ```bash
   psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
     -f database/migrations/001_generalized_schema.sql
   ```

3. Run all migrations:
   ```bash
   for file in database/migrations/*.sql; do
     echo "Running $file..."
     psql "postgresql://..." -f "$file"
   done
   ```

### Method C: Node.js Script (Future Enhancement)

Create automated migration runner:

```javascript
// scripts/run-migrations.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service key for admin
);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../database/migrations');
  const files = await fs.readdir(migrationsDir);

  // Sort files to run in order
  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of sqlFiles) {
    console.log(`Running migration: ${file}`);
    const sql = await fs.readFile(
      path.join(migrationsDir, file),
      'utf-8'
    );

    // Execute SQL
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(`Error in ${file}:`, error);
      process.exit(1);
    }

    console.log(`✅ ${file} completed`);
  }

  console.log('All migrations completed!');
}

runMigrations();
```

---

## Migration Validation

### Post-Migration Checks

Run these queries after migration to verify success:

#### 1. Table Structure
```sql
-- List all tables
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;
```

#### 2. Row Counts
```sql
-- Check data migrated
SELECT
  'organizations' as table_name, COUNT(*) as row_count FROM organizations
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'document_sections', COUNT(*) FROM document_sections
UNION ALL
SELECT 'amendments', COUNT(*) FROM amendments
UNION ALL
SELECT 'users', COUNT(*) FROM users;
```

#### 3. Constraints & Indexes
```sql
-- Verify foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Verify indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

#### 4. RLS Policies
```sql
-- Check RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Validation Checklist

- [ ] All tables created (11 expected)
- [ ] Row counts match expectations
- [ ] All foreign keys created
- [ ] All indexes created
- [ ] RLS enabled on all tables
- [ ] Basic RLS policies created
- [ ] No orphaned records
- [ ] Data integrity maintained

---

## Rollback Strategy

### Before Migration

1. **Take Snapshot** (Supabase Pro only):
   - Database → Backups → Create Backup
   - Label: "Pre-migration backup"

2. **Export Data** (Free tier):
   ```bash
   # Export all tables
   pg_dump "postgresql://..." > backup.sql

   # Or per-table CSV exports
   psql "postgresql://..." -c "\COPY organizations TO 'orgs.csv' CSV HEADER"
   ```

### Rollback Procedures

#### Rollback Option 1: Restore from Backup
```sql
-- Supabase: Database → Backups → Restore Point

-- Or via psql:
psql "postgresql://..." < backup.sql
```

#### Rollback Option 2: Drop New Schema
```sql
-- WARNING: This deletes all data!
DROP TABLE IF EXISTS stage_transitions CASCADE;
DROP TABLE IF EXISTS workflow_stages CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS amendment_sections CASCADE;
DROP TABLE IF EXISTS amendments CASCADE;
DROP TABLE IF EXISTS document_sections CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS user_organizations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Then restore from backup
```

#### Rollback Option 3: Keep Both Schemas
```sql
-- Rename new tables with prefix
ALTER TABLE organizations RENAME TO new_organizations;
ALTER TABLE documents RENAME TO new_documents;
-- ... etc

-- Restore old schema
-- Run old schema SQL

-- Compare data
SELECT * FROM new_organizations;
SELECT * FROM organizations; -- old
```

---

## Database Migration on Render Deploy

### Current Approach: Manual Migration

**Process**:
1. ✅ Developer runs migrations in Supabase SQL Editor
2. ✅ Migrations applied before app deploy
3. ✅ App expects schema already exists
4. ✅ Health check validates database connection

**Pros**:
- Simple and reliable
- Full control over timing
- Can verify before deploy
- No risk of failed deploy due to migration

**Cons**:
- Manual process
- Requires documentation
- Risk of forgetting step

### Future Enhancement: Automated Migrations

**Option 1: Migration Runner in App**

```javascript
// Add to server.js startup
const { runPendingMigrations } = require('./migrations/runner');

app.listen(PORT, async () => {
  // Check and run migrations on startup
  if (process.env.AUTO_MIGRATE === 'true') {
    await runPendingMigrations(supabase);
  }
  console.log('Server ready');
});
```

**Option 2: Separate Deploy Step**

Update `render.yaml`:
```yaml
services:
  - type: web
    buildCommand: |
      npm install
      npm run migrate  # Run migrations during build
    startCommand: npm start
```

Add to `package.json`:
```json
{
  "scripts": {
    "migrate": "node scripts/run-migrations.js"
  }
}
```

**Option 3: Render Blueprint Jobs**

```yaml
# In render.yaml
services:
  - type: web
    # ... existing config

  - type: cron
    name: migration-runner
    env: node
    schedule: "@daily"
    buildCommand: npm install
    startCommand: node scripts/check-and-migrate.js
```

---

## Migration Best Practices

### Development Workflow

1. **Create Migration File**:
   ```bash
   # Naming convention: XXX_description.sql
   # Example: 003_add_notifications.sql
   ```

2. **Test Locally**:
   ```bash
   # Test on local Supabase instance
   psql "postgresql://localhost:54322/postgres" \
     -f database/migrations/003_add_notifications.sql
   ```

3. **Version Control**:
   ```bash
   git add database/migrations/003_add_notifications.sql
   git commit -m "Add notifications table migration"
   ```

4. **Deploy to Staging**:
   ```bash
   # Run in staging Supabase
   # Verify app works
   ```

5. **Deploy to Production**:
   ```bash
   # Run in production Supabase
   # Monitor for errors
   # Deploy app code
   ```

### Migration File Structure

```sql
-- Migration: 003_add_notifications.sql
-- Description: Add user notifications system
-- Author: Developer Name
-- Date: 2025-10-09

-- ==================================================
-- PART 1: CREATE TABLES
-- ==================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================================================
-- PART 2: INDEXES
-- ==================================================

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- ==================================================
-- PART 3: CONSTRAINTS
-- ==================================================

ALTER TABLE notifications
  ADD CONSTRAINT valid_notification_type
  CHECK (type IN ('amendment', 'comment', 'approval', 'system'));

-- ==================================================
-- PART 4: RLS
-- ==================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

-- ==================================================
-- PART 5: ROLLBACK (commented)
-- ==================================================

-- To rollback this migration:
-- DROP TABLE IF EXISTS notifications CASCADE;
```

### Migration Checklist

Before creating migration:
- [ ] Migration solves specific problem
- [ ] Backward compatible if possible
- [ ] Includes rollback instructions
- [ ] Tested on local database
- [ ] Documented in migration file
- [ ] Follows naming convention

After creating migration:
- [ ] Committed to version control
- [ ] Tested in staging
- [ ] Reviewed by team
- [ ] Deployed to production
- [ ] Verified with validation queries
- [ ] Documented in changelog

---

## Common Migration Scenarios

### Scenario 1: Add New Table

```sql
-- Add audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### Scenario 2: Add Column

```sql
-- Add 'archived' flag to documents
ALTER TABLE documents
  ADD COLUMN archived BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_documents_archived
  ON documents(organization_id, archived)
  WHERE archived = FALSE;
```

### Scenario 3: Modify Column

```sql
-- Increase max length of organization name
ALTER TABLE organizations
  ALTER COLUMN name TYPE VARCHAR(500);

-- Add NOT NULL constraint
ALTER TABLE documents
  ALTER COLUMN title SET NOT NULL;
```

### Scenario 4: Data Transformation

```sql
-- Migrate status values
UPDATE amendments
SET status = 'approved'
WHERE status = 'board_approved';

UPDATE amendments
SET status = 'pending'
WHERE status = 'open';

-- Add constraint after data fix
ALTER TABLE amendments
  DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE amendments
  ADD CONSTRAINT valid_status
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));
```

---

## Troubleshooting Migrations

### Common Issues

#### Issue: Foreign Key Violation
```
ERROR: insert or update on table "documents" violates foreign key constraint
```

**Solution**:
```sql
-- Check for orphaned records
SELECT * FROM documents
WHERE organization_id NOT IN (SELECT id FROM organizations);

-- Fix: Update or delete orphaned records
DELETE FROM documents
WHERE organization_id NOT IN (SELECT id FROM organizations);
```

#### Issue: Duplicate Key
```
ERROR: duplicate key value violates unique constraint
```

**Solution**:
```sql
-- Find duplicates
SELECT email, COUNT(*)
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- Remove duplicates (keep first)
DELETE FROM users a USING users b
WHERE a.id > b.id
  AND a.email = b.email;
```

#### Issue: Column Already Exists
```
ERROR: column "archived" of relation "documents" already exists
```

**Solution**:
```sql
-- Check before adding
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
```

#### Issue: RLS Blocks Migration
```
ERROR: new row violates row-level security policy
```

**Solution**:
```sql
-- Temporarily disable RLS for migration
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;

-- Run migration
-- ...

-- Re-enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
```

---

## Quick Reference

### Essential Commands

```sql
-- List tables
\dt

-- Describe table
\d+ organizations

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Count rows
SELECT COUNT(*) FROM organizations;

-- Check constraints
\d organizations
```

### Migration Workflow

```bash
# 1. Create migration file
touch database/migrations/XXX_description.sql

# 2. Test locally
psql "postgresql://localhost..." -f database/migrations/XXX_description.sql

# 3. Commit
git add database/migrations/XXX_description.sql
git commit -m "Add migration: description"

# 4. Run in staging
psql "postgresql://staging..." -f database/migrations/XXX_description.sql

# 5. Run in production
# Use Supabase SQL Editor
```

---

**Last Updated**: October 9, 2025
**Migration Version**: 2.0.0
