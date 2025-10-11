# Supabase Database Setup Guide

Complete guide to setting up your Supabase database for the Bylaws Amendment Tracker.

---

## Table of Contents

1. [Create Supabase Project](#create-supabase-project)
2. [Run Database Schema](#run-database-schema)
3. [Verify Installation](#verify-installation)
4. [Configure Row-Level Security](#configure-row-level-security)
5. [Create Sample Data](#create-sample-data)
6. [Backup and Restore](#backup-and-restore)
7. [Troubleshooting](#troubleshooting)

---

## Create Supabase Project

### Step 1: Sign Up for Supabase

1. Visit https://supabase.com/dashboard/sign-up
2. Choose sign-in method:
   - **GitHub** (recommended - faster)
   - Email and password
3. Complete account creation

### Step 2: Create New Project

1. Click "New Project"
2. Fill in details:

| Field | Value | Notes |
|-------|-------|-------|
| **Organization** | Create new or select existing | Your workspace |
| **Name** | `bylaws-tracker` | Or any name you prefer |
| **Database Password** | Generate or create strong password | **SAVE THIS!** |
| **Region** | Choose closest to users | e.g., "US West (Oregon)" |
| **Pricing Plan** | Free | Upgrade later if needed |

3. Click "Create new project"
4. Wait 2-3 minutes for provisioning

### Step 3: Collect Credentials

Once project is ready:

**Get Project URL:**
1. Go to: Settings → API
2. Find "Project URL"
3. Copy: `https://[project-ref].supabase.co`
4. Save as: `SUPABASE_URL`

**Get API Keys:**
1. Same page (Settings → API)
2. Under "Project API keys":
   - Copy `anon` `public` key
   - Save as: `SUPABASE_ANON_KEY`
   - ⚠️ **Do NOT use `service_role` key in frontend!**

**Get Database Password:**
- You set this during project creation
- If forgotten: Settings → Database → "Reset database password"
- Save as: `SUPABASE_DB_PASSWORD`

**Example credentials:**
```env
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTAwMDAwMDAsImV4cCI6MjAwNTU3NjAwMH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
SUPABASE_DB_PASSWORD=YourStrongPassword123!
```

---

## Run Database Schema

### Option 1: SQL Editor (Recommended)

**Step 1: Open SQL Editor**
1. In Supabase dashboard, click "SQL Editor" (left sidebar)
2. Click "+ New query"

**Step 2: Copy Schema**
1. Open file: `/database/migrations/001_generalized_schema.sql`
2. Copy **ALL** the SQL code (700+ lines)

**Step 3: Paste and Run**
1. Paste into SQL Editor
2. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
3. Wait 15-30 seconds

**Step 4: Verify Success**
- You should see: "Success. No rows returned"
- If errors appear, see [Troubleshooting](#troubleshooting)

### Option 2: Command Line (Advanced)

**Prerequisites:**
- PostgreSQL client installed (`psql`)
- Direct database access enabled

**Commands:**
```bash
# Get connection string from Supabase
# Settings → Database → Connection string → URI

# Run schema
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  < database/migrations/001_generalized_schema.sql
```

---

## Verify Installation

### Step 1: Check Tables Created

1. Click "Table Editor" (left sidebar)
2. Verify these tables exist:

**Core Tables:**
- ✅ `organizations`
- ✅ `users`
- ✅ `user_organizations`
- ✅ `documents`
- ✅ `document_sections`

**Workflow Tables:**
- ✅ `workflow_templates`
- ✅ `workflow_stages`
- ✅ `document_workflows`
- ✅ `section_workflow_states`

**Suggestions Tables:**
- ✅ `suggestions`
- ✅ `suggestion_sections`
- ✅ `suggestion_votes`

**Total: 11 tables**

### Step 2: Verify Table Structure

**Check `organizations` table:**
1. Click on `organizations` table
2. Verify columns:
   - `id` (uuid, primary key)
   - `name` (text)
   - `slug` (text, unique)
   - `organization_type` (text)
   - `hierarchy_config` (jsonb)
   - `settings` (jsonb)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

### Step 3: Check Views

1. SQL Editor → New query
2. Run:
```sql
SELECT * FROM information_schema.views
WHERE table_schema = 'public';
```

3. Verify these views exist:
   - `v_suggestions_with_sections`
   - `v_section_workflow_progress`

### Step 4: Check Functions

Run:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public';
```

Verify these functions exist:
- `update_section_path()` (trigger function)
- `get_section_breadcrumb(uuid)` (helper)
- `get_section_descendants(uuid)` (helper)

### Step 5: Verify Row-Level Security (RLS)

Run:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**All tables should show `rowsecurity = true`**

---

## Configure Row-Level Security

RLS is already configured by the schema, but here's how to customize:

### Current RLS Policies

**Organizations:**
```sql
-- Users see only their organizations
CREATE POLICY "Users see own organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Documents:**
```sql
-- Users see documents in their organizations
CREATE POLICY "Users see own organization documents"
  ON documents FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Suggestions:**
```sql
-- Public can create suggestions (if org allows)
CREATE POLICY "Public can create suggestions"
  ON suggestions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = suggestions.document_id
      AND (o.settings->>'allow_public_suggestions')::boolean = true
    )
    OR EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = suggestions.document_id
      AND uo.user_id = auth.uid()
    )
  );
```

### Add Custom Policy (Example)

**Allow admins to manage all data:**
```sql
CREATE POLICY "Admins manage all"
  ON documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE organization_id = documents.organization_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

---

## Create Sample Data

### Minimal Setup (Setup Wizard Does This)

The setup wizard automatically creates:
1. Organization record
2. Basic workflow template
3. Workflow stages

**Manual creation (if needed):**

```sql
-- Create organization
INSERT INTO organizations (name, slug, organization_type, is_configured)
VALUES (
  'Sample Organization',
  'sample-org-' || floor(random() * 1000000),
  'neighborhood_council',
  TRUE
)
RETURNING id;

-- Copy the returned ID, then create default workflow
INSERT INTO workflow_templates (organization_id, name, is_default, is_active)
VALUES (
  '[ORG_ID_FROM_ABOVE]',
  'Default Workflow',
  TRUE,
  TRUE
)
RETURNING id;

-- Create workflow stages (use workflow ID from above)
INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, can_lock, can_approve)
VALUES
  ('[WORKFLOW_ID]', 'Committee Review', 1, TRUE, TRUE),
  ('[WORKFLOW_ID]', 'Board Approval', 2, TRUE, TRUE);
```

### Full Test Dataset

**Create complete test environment:**

```sql
-- 1. Create test organization
WITH org AS (
  INSERT INTO organizations (name, slug, organization_type, is_configured)
  VALUES ('Test Council', 'test-council-' || floor(random() * 1000000), 'neighborhood_council', TRUE)
  RETURNING id
),

-- 2. Create test document
doc AS (
  INSERT INTO documents (organization_id, title, document_type, status)
  SELECT id, 'Test Bylaws', 'bylaws', 'active' FROM org
  RETURNING id, organization_id
),

-- 3. Create workflow template
workflow AS (
  INSERT INTO workflow_templates (organization_id, name, is_default, is_active)
  SELECT organization_id, 'Test Workflow', TRUE, TRUE FROM doc
  RETURNING id, organization_id
),

-- 4. Create workflow stages
stages AS (
  INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, can_lock, can_approve)
  SELECT id, 'Committee Review', 1, TRUE, TRUE FROM workflow
  UNION ALL
  SELECT id, 'Board Approval', 2, TRUE, TRUE FROM workflow
  RETURNING workflow_template_id, id as stage_id
),

-- 5. Link document to workflow
doc_workflow AS (
  INSERT INTO document_workflows (document_id, workflow_template_id)
  SELECT d.id, w.id FROM doc d, workflow w
  RETURNING document_id
)

-- 6. Create sample sections
INSERT INTO document_sections (
  document_id,
  parent_section_id,
  ordinal,
  section_number,
  section_title,
  section_type,
  original_text,
  current_text
)
SELECT
  d.id,
  NULL,
  1,
  'Article I',
  'Name and Purpose',
  'article',
  'This article establishes the name and purpose of the organization.',
  'This article establishes the name and purpose of the organization.'
FROM doc d
UNION ALL
SELECT
  d.id,
  (SELECT id FROM document_sections WHERE section_number = 'Article I' LIMIT 1),
  1,
  'Section 1',
  'Official Name',
  'section',
  'The name of this organization shall be Test Council.',
  'The name of this organization shall be Test Council.'
FROM doc d;

-- Verify
SELECT 'Organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'Documents', COUNT(*) FROM documents
UNION ALL
SELECT 'Document Sections', COUNT(*) FROM document_sections
UNION ALL
SELECT 'Workflow Templates', COUNT(*) FROM workflow_templates
UNION ALL
SELECT 'Workflow Stages', COUNT(*) FROM workflow_stages;
```

**Expected output:**
```
table_name         | count
-------------------+-------
Organizations      |     1
Documents          |     1
Document Sections  |     2
Workflow Templates |     1
Workflow Stages    |     2
```

---

## Backup and Restore

### Automatic Backups (Supabase)

**Free Tier:**
- 7 days point-in-time recovery
- Automatic daily backups

**Pro Tier ($25/month):**
- 30 days point-in-time recovery
- Custom backup schedules

**Access backups:**
1. Dashboard → Database → Backups
2. Click "Restore" to rollback

### Manual Backup

**Export entire database:**
```bash
# Using pg_dump
pg_dump -h db.[PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_$(date +%Y%m%d).dump

# Password: [your database password]
```

**Export specific tables:**
```sql
-- Organizations only
COPY (SELECT * FROM organizations) TO STDOUT WITH CSV HEADER;

-- All data (via SQL Editor)
SELECT * FROM organizations;
-- Download as CSV
```

### Restore from Backup

**From Supabase backup:**
1. Dashboard → Database → Backups
2. Select restore point
3. Click "Restore"
4. Confirm restoration

**From manual backup:**
```bash
# Using pg_restore
pg_restore -h db.[PROJECT-REF].supabase.co \
  -U postgres \
  -d postgres \
  -c \
  backup_20251009.dump
```

---

## Troubleshooting

### Issue: Schema Fails to Run

**Error: "relation already exists"**

**Solution:**
Tables already exist. To recreate:

```sql
-- ⚠️ WARNING: This deletes all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then re-run schema
```

**Error: "permission denied"**

**Solution:**
You may not have sufficient permissions. Contact Supabase support or:
```sql
-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
```

### Issue: RLS Blocking Queries

**Symptoms:**
- Queries return empty results
- "permission denied for table"

**Debug:**
```sql
-- Disable RLS temporarily (development only!)
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Check if RLS is the issue
SELECT * FROM organizations;

-- Re-enable
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
```

**Solution:**
- Ensure user is authenticated: `auth.uid()` returns valid UUID
- Check RLS policies match your auth setup
- Verify user has role in `user_organizations`

### Issue: Triggers Not Firing

**Check trigger exists:**
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_update_section_path';
```

**Re-create trigger:**
```sql
DROP TRIGGER IF EXISTS trg_update_section_path ON document_sections;

CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();
```

### Issue: Functions Missing

**List functions:**
```sql
\df public.*
-- or
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';
```

**Re-create function (example):**
```sql
CREATE OR REPLACE FUNCTION get_section_breadcrumb(section_uuid UUID)
RETURNS TABLE (
  section_id UUID,
  section_number VARCHAR,
  section_title TEXT,
  depth INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.section_number,
    ds.section_title,
    ds.depth
  FROM document_sections ds
  WHERE ds.id = ANY((
    SELECT path_ids FROM document_sections WHERE id = section_uuid
  ))
  ORDER BY array_position((
    SELECT path_ids FROM document_sections WHERE id = section_uuid
  ), ds.id);
END;
$$ LANGUAGE plpgsql;
```

### Issue: Connection Timeout

**Symptoms:**
- "Connection timeout"
- "ETIMEDOUT"

**Solutions:**
1. **Check Supabase status:** https://status.supabase.com
2. **Verify project is active:** Dashboard → ensure project isn't paused
3. **Check firewall:** Ensure port 5432 isn't blocked
4. **Test connection:**
```bash
nc -zv db.[PROJECT-REF].supabase.co 5432
```

---

## Database Maintenance

### Monitor Database Size

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres')) as db_size;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Optimize Performance

**Create indexes for common queries:**
```sql
-- Index on section lookups by document
CREATE INDEX idx_sections_doc_number
ON document_sections(document_id, section_number);

-- Index on suggestions by status
CREATE INDEX idx_suggestions_status_doc
ON suggestions(document_id, status)
WHERE status = 'open';
```

**Vacuum and analyze:**
```sql
-- Reclaim storage and update stats
VACUUM ANALYZE;
```

### Clean Up Old Data

**Delete old suggestions (example):**
```sql
-- Delete suggestions older than 1 year
DELETE FROM suggestions
WHERE created_at < NOW() - INTERVAL '1 year'
AND status IN ('rejected', 'withdrawn');
```

**Archive old workflows:**
```sql
-- Archive completed workflows
UPDATE section_workflow_states
SET archived = TRUE
WHERE status = 'approved'
AND actioned_at < NOW() - INTERVAL '6 months';
```

---

## Advanced Configuration

### Enable Realtime

For live updates in the UI:

1. Dashboard → Database → Replication
2. Enable replication for tables:
   - `suggestions`
   - `suggestion_votes`
   - `section_workflow_states`
3. Use Supabase Realtime in frontend:

```javascript
const { data, error } = await supabase
  .from('suggestions')
  .on('INSERT', payload => {
    console.log('New suggestion!', payload.new);
  })
  .subscribe();
```

### Configure Storage (for file uploads)

1. Dashboard → Storage
2. Create bucket: `bylaws-documents`
3. Set policies:
   - Public read for logos
   - Authenticated write for documents
4. Update environment:
```env
SUPABASE_STORAGE_BUCKET=bylaws-documents
```

### Set Up Auth (optional)

For user authentication:

1. Dashboard → Authentication → Providers
2. Enable Email provider
3. Configure email templates
4. Add auth to app (see `AUTH_SETUP.md`)

---

## Quick Reference

### Connection Info

**Get from:** Settings → Database

| Field | Example |
|-------|---------|
| Host | `db.abcdefgh.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| User | `postgres` |
| Password | `[your password]` |

### Essential SQL Queries

**Check setup status:**
```sql
SELECT COUNT(*) as orgs FROM organizations WHERE is_configured = TRUE;
```

**List all organizations:**
```sql
SELECT id, name, organization_type, created_at FROM organizations;
```

**Count sections per document:**
```sql
SELECT
  d.title,
  COUNT(ds.id) as section_count
FROM documents d
LEFT JOIN document_sections ds ON d.id = ds.document_id
GROUP BY d.id, d.title;
```

**Check workflow stages:**
```sql
SELECT
  wt.name as workflow,
  ws.stage_name,
  ws.stage_order
FROM workflow_templates wt
JOIN workflow_stages ws ON wt.id = ws.workflow_template_id
ORDER BY wt.name, ws.stage_order;
```

---

**Last Updated**: 2025-10-09
**Version**: 1.0.0
**Database Schema Version**: 2.0.0
