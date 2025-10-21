# 🗄️ SUPABASE DATABASE SETUP GUIDE

**Date**: 2025-10-12
**Status**: 🎉 VICTORY ON CODE BUGS - NOW FIX DATABASE
**Situation**: Your setup wizard fixes are working! Now need to create missing database tables.

---

## 🎯 SITUATION RECAP

### ✅ VICTORIES ACHIEVED:
1. **"Level 0 undefined" bug** → FIXED ✅
2. **Duplicate upload dialogs** → FIXED ✅
3. **Parser defensive validation** → FIXED ✅

### ❌ NEW CHALLENGE:
```
Error: Could not find the table 'public.documents' in the schema cache
```

**Translation**: The code is working, but your Supabase database is incomplete!

**Good News**: You're literally ONE SQL script execution away from a working system! 🚀

---

## 🔍 STEP 1: DIAGNOSE WHAT'S MISSING

### Run This Query in Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Click **"SQL Editor"** in the left sidebar
3. Create a new query
4. Paste this diagnostic SQL:

```sql
-- Check what tables currently exist
SELECT
  tablename,
  CASE
    WHEN tablename = 'organizations' THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

5. Click **"Run"** (or press `Ctrl+Enter`)

### Expected Output:

If only partial schema exists, you'll see:
```
tablename              | status
-----------------------|----------
organizations          | ✅ EXISTS
(other tables missing)
```

**What You SHOULD See** (after running migration):
```
tablename                  | status
---------------------------|----------
document_sections          | ✅ EXISTS
document_workflows         | ✅ EXISTS
documents                  | ✅ EXISTS  ← THIS IS MISSING NOW
organizations              | ✅ EXISTS
section_workflow_states    | ✅ EXISTS
suggestion_sections        | ✅ EXISTS
suggestion_votes           | ✅ EXISTS
suggestions                | ✅ EXISTS
user_organizations         | ✅ EXISTS
users                      | ✅ EXISTS
workflow_stages            | ✅ EXISTS
workflow_templates         | ✅ EXISTS
```

**Plus 2 views**:
- `v_suggestions_with_sections`
- `v_section_workflow_progress`

---

## 🛠️ STEP 2: RUN THE COMPLETE SCHEMA MIGRATION

### Option A: Run Complete Schema (RECOMMENDED)

**This is the safest and fastest approach.**

1. **Navigate to SQL Editor** in Supabase Dashboard
2. **Click "New Query"**
3. **Copy the ENTIRE contents** of this file:
   ```
   /database/migrations/001_generalized_schema.sql
   ```
4. **Paste into SQL Editor**
5. **Click "Run"** (may take 10-15 seconds)

**The script is IDEMPOTENT and SAFE**:
- ✅ Won't fail if organizations table already exists (will skip)
- ✅ Creates missing tables automatically
- ✅ Sets up all indexes and constraints
- ✅ Enables Row Level Security (RLS)
- ✅ Creates helper functions and views
- ✅ Includes comprehensive comments

**Expected Success Output**:
```
NOTICE:  ========================================
NOTICE:  Generalized Schema Created Successfully
NOTICE:  ========================================
NOTICE:  Schema version: 2.0.0
NOTICE:  Multi-tenancy: Enabled with RLS
NOTICE:  Hierarchy: Flexible adjacency list + materialized path
NOTICE:  Workflows: Configurable N-stage state machine
```

### Option B: Manual Step-by-Step (If You Want Control)

If the complete script fails for any reason, here are the tables in dependency order:

#### 1️⃣ Core Tables (Create First):
```sql
-- Already exists, skip:
-- CREATE TABLE organizations (...);

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(50) DEFAULT 'supabase',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Create user-organization membership
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{
    "can_edit_sections": true,
    "can_create_suggestions": true,
    "can_vote": true,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false
  }'::jsonb,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);
```

#### 2️⃣ Documents Table (THIS IS THE MISSING ONE):
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'bylaws',
  google_doc_id VARCHAR(255),
  external_source VARCHAR(50),
  version VARCHAR(50) DEFAULT '1.0',
  version_history JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMP,
  archived_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, google_doc_id)
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
```

#### 3️⃣ Continue with rest of schema...
(See the full schema file for remaining tables)

---

## ✅ STEP 3: VERIFY MIGRATION SUCCESS

After running the migration, verify everything is set up:

### Verification Query:
```sql
-- Count rows in key tables
SELECT
  'organizations' as table_name, COUNT(*) as row_count FROM organizations
UNION ALL
SELECT 'documents', COUNT(*) FROM documents
UNION ALL
SELECT 'document_sections', COUNT(*) FROM document_sections
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'workflow_templates', COUNT(*) FROM workflow_templates
ORDER BY table_name;
```

**Expected Output** (for new setup):
```
table_name          | row_count
--------------------|----------
documents           | 0
document_sections   | 0
organizations       | 1  ← Your test org
users               | 0
workflow_templates  | 0
```

**This is PERFECT!** Empty tables mean the schema is ready for data.

---

## 🚀 STEP 4: TEST THE SETUP WIZARD AGAIN

Now that the database is complete:

1. **Restart your server** (if it's running):
   ```bash
   # Stop with Ctrl+C
   npm start
   ```

2. **Navigate to setup wizard**:
   ```
   https://3eed1324c595.ngrok-free.app/setup
   ```

3. **Go through the setup**:
   - ✅ Organization details → Should work
   - ✅ Logo upload → Should work (single dialog!)
   - ✅ Document upload → Should work (single dialog!)
   - ✅ **Document parsing** → Should work (no "level 0 undefined")
   - ✅ **Document saving** → Should work (no "table documents not found")
   - ✅ Sections display → Should work
   - ✅ Setup complete → SUCCESS! 🎉

---

## 🔧 TROUBLESHOOTING

### Error: "relation already exists"
**Solution**: This is FINE! It means that table was already created. The migration will continue with the next table.

### Error: "column does not exist"
**Solution**: You may have an old version of a table. Run this to check:
```sql
-- Check structure of organizations table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
ORDER BY ordinal_position;
```

If `hierarchy_config` column is missing, you'll need to add it:
```sql
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS hierarchy_config JSONB DEFAULT '{
  "levels": [
    {"name": "Article", "numbering": "roman", "prefix": "Article", "type": "article", "depth": 0},
    {"name": "Section", "numbering": "numeric", "prefix": "Section", "type": "section", "depth": 1}
  ],
  "max_depth": 5
}'::jsonb;
```

### Error: "permission denied"
**Solution**: Make sure you're using the Supabase SQL Editor with your admin account, not a service role key.

### Error: "function auth.uid() does not exist"
**Solution**: This is OK during migration. RLS policies require Supabase Auth to be enabled, but they won't block table creation.

---

## 📋 COMPLETE CHECKLIST

Use this to track your progress:

### Database Setup:
- [ ] Logged into Supabase Dashboard
- [ ] Opened SQL Editor
- [ ] Ran diagnostic query to see missing tables
- [ ] Copied `/database/migrations/001_generalized_schema.sql`
- [ ] Pasted into SQL Editor
- [ ] Clicked "Run" and waited for completion
- [ ] Saw success message with "Schema version: 2.0.0"
- [ ] Ran verification query
- [ ] Confirmed all 12 tables exist

### Application Testing:
- [ ] Restarted Node.js server (`npm start`)
- [ ] Opened setup wizard in incognito window
- [ ] Filled out organization form
- [ ] Clicked logo upload area → single file dialog
- [ ] Uploaded logo successfully
- [ ] Advanced to document import
- [ ] Clicked document upload area → single file dialog
- [ ] Uploaded .docx file
- [ ] **No "level 0 undefined" error**
- [ ] **No "table documents not found" error**
- [ ] Sections appeared in preview
- [ ] Completed setup successfully
- [ ] Redirected to dashboard
- [ ] Saw your document with sections! 🎉

---

## 🎓 WHAT THIS SCHEMA PROVIDES

Your new database schema includes:

### Multi-Tenancy:
- **Organizations**: Multiple orgs on one database
- **Users**: Proper user management
- **Roles**: Flexible permission system
- **RLS**: Automatic data isolation

### Flexible Hierarchy:
- **Arbitrary Depth**: Not limited to Article/Section
- **Materialized Paths**: Fast tree queries
- **Custom Numbering**: Roman, numeric, alpha per level

### Configurable Workflows:
- **N-Stage Approval**: Not limited to 2 stages
- **Stage Capabilities**: Lock, edit, approve per stage
- **Audit Trail**: Track all approvals

### Multi-Section Suggestions:
- **Range Amendments**: Suggest changes to multiple sections
- **Voting System**: Support/oppose/preferred
- **Public Submissions**: Optional anonymous suggestions

### Performance:
- **Indexes**: Optimized for common queries
- **Views**: Pre-joined data for dashboards
- **Functions**: Helper functions for hierarchy navigation

---

## 🎯 EXPECTED TIMELINE

- **Step 1 (Diagnosis)**: 2 minutes
- **Step 2 (Migration)**: 1 minute (script runs in 10-15 seconds)
- **Step 3 (Verification)**: 1 minute
- **Step 4 (Testing)**: 5 minutes

**Total**: ~10 minutes to complete database setup! 🚀

---

## 📞 IF YOU GET STUCK

### Common Issues and Solutions:

**"I don't see the SQL Editor in Supabase"**
- Make sure you're logged into the correct project
- SQL Editor is in the left sidebar (database icon)

**"The migration script is too long for the editor"**
- Supabase SQL Editor handles large scripts fine
- If it times out, break into sections (use Option B above)

**"I see 'permission denied for schema public'"**
- Use your Supabase dashboard login (not service role key)
- Make sure you have admin access to the project

**"After migration, setup wizard still fails"**
- Restart your Node.js server
- Clear browser cache and use incognito mode
- Check server console for different error message
- Run verification query to confirm tables exist

---

## 🎉 SUCCESS INDICATORS

You'll know it's working when:

1. ✅ Diagnostic query shows 12+ tables
2. ✅ Verification query returns row counts
3. ✅ Setup wizard advances past organization step
4. ✅ Document upload doesn't crash
5. ✅ Console shows: `[CONFIG-DEBUG] ⚠️ Using default hierarchy`
6. ✅ Sections appear in preview
7. ✅ Setup completes and redirects to dashboard

---

## 🚀 YOU'RE ALMOST THERE!

You've already conquered the hard bugs:
- ✅ Configuration merge logic
- ✅ Upload event handlers
- ✅ Parser validation

This final step (database setup) is straightforward:
1. Copy schema file
2. Paste in SQL Editor
3. Click Run
4. Wait 15 seconds
5. Test setup wizard
6. **CELEBRATE!** 🎉

**Estimated time to working system**: 10 minutes

---

**Report back with**:
1. How many tables the diagnostic query shows
2. What success/error message you get from migration
3. What happens when you try setup wizard again

You've got this! The finish line is RIGHT THERE! 🏁
