# DATABASE INVESTIGATION & FIX GUIDE 🔍

## SITUATION SUMMARY

✅ **VICTORY**: Original bugs (level 0 undefined, duplicate uploads) are FIXED!

❌ **NEW ERROR**: Database schema mismatch - missing tables

```
Error: Could not find the table 'public.documents' in the schema cache
Location: /src/routes/setup.js:562 (processSetupData -> setupService.processDocumentImport)
```

---

## ROOT CAUSE ANALYSIS 🔬

Your application expects the **NEW generalized schema** (v2.0.0) but your Supabase database likely has:
- ✅ `organizations` table (confirmed working - you successfully created an organization)
- ❌ `documents` table (MISSING - causing the error)
- ❌ `document_sections` table (MISSING)
- ❌ Other v2.0 tables (likely MISSING)

The code tries to insert into `documents` table at line 213 of `/src/services/setupService.js`:

```javascript
const { data: document, error: docError } = await supabase
  .from('documents')  // ❌ This table doesn't exist in your database
  .insert({...})
```

---

## TABLES THAT SHOULD EXIST 📋

Based on the migration file `/database/migrations/001_generalized_schema.sql`, your database needs these 15 tables:

### Core Tables (5)
1. **organizations** - ✅ EXISTS (you created an org successfully)
2. **users** - Status unknown
3. **user_organizations** - Status unknown
4. **documents** - ❌ MISSING (causing error)
5. **document_sections** - ❌ MISSING

### Workflow Tables (4)
6. **workflow_templates** - Status unknown
7. **workflow_stages** - Status unknown
8. **document_workflows** - Status unknown
9. **section_workflow_states** - Status unknown

### Suggestions & Voting Tables (3)
10. **suggestions** - Status unknown
11. **suggestion_sections** - Status unknown
12. **suggestion_votes** - Status unknown

### Legacy Tables (3) - OLD schema
- `bylaw_sections` - May exist from old schema
- `bylaw_suggestions` - May exist from old schema
- `bylaw_votes` - May exist from old schema

---

## STEP-BY-STEP FIX INSTRUCTIONS 🛠️

### STEP 1: Check What Tables Exist

1. Go to your **Supabase Dashboard**
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **"New query"**
4. Paste this SQL and click **"Run"**:

```sql
-- Check what tables currently exist in your database
SELECT tablename, schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

5. **Copy the results** and save them (you'll need this for diagnosis)

Expected output format:
```
tablename              | schemaname
-----------------------+-----------
organizations          | public
bylaw_sections         | public    (if old schema exists)
...
```

---

### STEP 2: Run the Complete Schema Migration

If `documents` table is missing, you need to run the full v2.0 migration:

1. In **Supabase SQL Editor**, click **"New query"**
2. Open the file: `/database/migrations/001_generalized_schema.sql` on your computer
3. **Copy the ENTIRE contents** (all 700+ lines)
4. **Paste into Supabase SQL Editor**
5. Click **"Run"**

⚠️ **IMPORTANT**: This script is safe to run multiple times because it uses:
- `CREATE TABLE IF NOT EXISTS` - won't recreate existing tables
- `CREATE INDEX IF NOT EXISTS` - won't recreate existing indexes

Expected success output:
```
========================================
Generalized Schema Created Successfully
========================================
Schema version: 2.0.0
Multi-tenancy: Enabled with RLS
...
```

---

### STEP 3: Verify Tables Were Created

Run this SQL to confirm all tables exist:

```sql
-- Verify all required tables exist
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'organizations') THEN '✅'
    ELSE '❌'
  END as organizations,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN '✅'
    ELSE '❌'
  END as users,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN '✅'
    ELSE '❌'
  END as documents,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_sections') THEN '✅'
    ELSE '❌'
  END as document_sections,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workflow_templates') THEN '✅'
    ELSE '❌'
  END as workflow_templates,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workflow_stages') THEN '✅'
    ELSE '❌'
  END as workflow_stages,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'suggestions') THEN '✅'
    ELSE '❌'
  END as suggestions;
```

Expected output (all should be ✅):
```
organizations | users | documents | document_sections | workflow_templates | workflow_stages | suggestions
✅           | ✅    | ✅        | ✅                | ✅                 | ✅              | ✅
```

---

### STEP 4: Check RLS (Row Level Security) Policies

The migration enables RLS on all tables. Verify it's working:

```sql
-- Check RLS status for key tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'documents', 'document_sections', 'suggestions')
ORDER BY tablename;
```

Expected output:
```
schemaname | tablename         | rls_enabled
public     | documents         | t
public     | document_sections | t
public     | organizations     | t
public     | suggestions       | t
```

---

### STEP 5: Re-run Setup Wizard

1. **Restart your application** (to clear any cached schema info):
   ```bash
   npm start
   ```

2. **Navigate to**: `http://localhost:8080/setup`

3. **Go through the wizard again**:
   - Organization info (may already be saved)
   - Document structure
   - Workflow configuration
   - Import document

4. **Watch the server console** for the `[SETUP-DEBUG]` logs

Expected success log:
```
[SETUP-DEBUG] 📥 Processing import step
[SETUP-DEBUG] 💾 Inserting into Supabase documents table...
[SETUP-DEBUG] ✅ Document created with ID: [uuid]
Document created with ID: [uuid]
Storing [N] sections...
Successfully stored [N] sections
```

---

## VERIFICATION CHECKLIST ✅

After completing the fix, verify:

- [ ] **Organizations table** exists and has your org
  ```sql
  SELECT id, name, slug FROM organizations;
  ```

- [ ] **Documents table** exists and is empty (before import)
  ```sql
  SELECT COUNT(*) FROM documents;
  ```

- [ ] **Setup wizard** completes without errors

- [ ] **Document import** successfully creates sections
  ```sql
  SELECT COUNT(*) FROM document_sections;
  ```

- [ ] **No more "table not found" errors** in server logs

---

## TROUBLESHOOTING 🔧

### Error: "relation 'organizations' does not exist"

**Cause**: No tables at all - fresh database

**Fix**: Run the complete migration (Step 2)

---

### Error: "duplicate key value violates unique constraint"

**Cause**: Trying to create duplicate organization slug

**Fix**: The organization was already created. Check existing:
```sql
SELECT * FROM organizations ORDER BY created_at DESC LIMIT 1;
```

If duplicate, use the existing organization_id in your session.

---

### Error: "permission denied for table documents"

**Cause**: RLS policies blocking access

**Fix**: Temporarily disable RLS for testing:
```sql
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections DISABLE ROW LEVEL SECURITY;
```

⚠️ **WARNING**: Only for testing! Re-enable RLS before production:
```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
```

---

### Error: "function update_section_path() does not exist"

**Cause**: Trigger function not created properly

**Fix**: Re-run the trigger creation part of migration (lines 207-243)

---

## ALTERNATIVE: Minimal Migration (If Full Migration Fails)

If the full migration has issues, here's a minimal SQL to get setup working:

```sql
-- MINIMAL SCHEMA: Just what's needed for setup wizard to work
-- Run this ONLY if full migration fails

-- 1. Organizations table (you already have this)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  organization_type VARCHAR(50) DEFAULT 'neighborhood_council',
  hierarchy_config JSONB DEFAULT '{
    "levels": [
      {"name": "Article", "numbering": "roman", "prefix": "Article", "depth": 0},
      {"name": "Section", "numbering": "numeric", "prefix": "Section", "depth": 1}
    ],
    "max_depth": 5
  }'::jsonb,
  is_configured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Documents table (REQUIRED)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'bylaws',
  status VARCHAR(50) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);

-- 3. Document sections table (REQUIRED)
CREATE TABLE IF NOT EXISTS document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  path_ids UUID[] NOT NULL,
  path_ordinals INTEGER[] NOT NULL,
  section_number VARCHAR(50),
  section_title TEXT,
  section_type VARCHAR(50),
  original_text TEXT,
  current_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK(depth >= 0 AND depth <= 10),
  CHECK(ordinal > 0)
);

CREATE INDEX IF NOT EXISTS idx_doc_sections_document ON document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_sections_parent ON document_sections(parent_section_id);

-- 4. Trigger to maintain path (REQUIRED)
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;
  ELSE
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_section_path ON document_sections;
CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Minimal schema created successfully!';
  RAISE NOTICE 'Tables: organizations, documents, document_sections';
  RAISE NOTICE 'Trigger: update_section_path';
END $$;
```

---

## WHAT HAPPENS AFTER FIX 🎉

Once tables are created:

1. ✅ Setup wizard will complete successfully
2. ✅ Document import will parse and store sections
3. ✅ You'll see sections in `document_sections` table
4. ✅ Hierarchy will be properly maintained
5. ✅ You can access `/bylaws` route without errors

---

## NEED MORE HELP? 🆘

### Check Database Schema Version

```sql
-- See what migration version you're on
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'organizations'
    AND column_name = 'hierarchy_config'
) as has_v2_schema;
```

Result:
- `t` (true) = v2.0 schema ✅
- `f` (false) = Old schema or mixed ❌

---

### Check Existing Data

```sql
-- See what's in your organization
SELECT
  o.id,
  o.name,
  o.slug,
  o.is_configured,
  (SELECT COUNT(*) FROM documents WHERE organization_id = o.id) as doc_count,
  (SELECT COUNT(*) FROM document_sections ds
   JOIN documents d ON ds.document_id = d.id
   WHERE d.organization_id = o.id) as section_count
FROM organizations o
ORDER BY created_at DESC
LIMIT 1;
```

---

## SUMMARY 📝

**Problem**: Application code expects v2.0 generalized schema, but database has only partial schema

**Solution**: Run the complete migration SQL (`001_generalized_schema.sql`)

**Result**: All 15+ tables will be created with proper relationships, indexes, triggers, and RLS policies

**Time**: ~30 seconds to run migration + 2 minutes to re-run setup wizard

---

## FILES REFERENCED 📁

- `/database/migrations/001_generalized_schema.sql` - Full v2.0 schema (700+ lines)
- `/database/schema.sql` - Old schema (legacy, may cause confusion)
- `/src/services/setupService.js` - Line 213 tries to insert into `documents`
- `/src/routes/setup.js` - Line 562 calls setupService.processDocumentImport()

---

**Good luck! You're almost there! 🚀**
