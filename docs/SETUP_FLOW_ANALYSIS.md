# Setup Flow Document Storage Analysis

**Date:** 2025-10-13
**Analyst:** Setup Flow Specialist
**Status:** Complete

## Executive Summary

Analysis of document upload and storage during the setup wizard reveals that documents are stored correctly with proper organization associations. The issue causing the "No documents found" error on the dashboard is likely related to **query filtering or RLS policies**, not document storage.

---

## Document Storage Flow

### 1. Organization Creation (`/src/routes/setup.js` lines 463-511)

**Location:** `setup.js` - `processSetupData()` function, `organization` step

**What Happens:**
```javascript
const { data, error } = await supabase
  .from('organizations')
  .insert({
    name: orgData.organization_name,
    slug: slug,
    organization_type: orgData.organization_type,
    state: orgData.state,
    country: orgData.country,
    contact_email: orgData.contact_email,
    logo_url: orgData.logo_path,
    is_configured: true
  })
  .select()
  .single();

setupData.organizationId = data.id;  // Store for subsequent steps
```

**Key Points:**
- Organization is created FIRST with a unique slug
- `organization_id` is stored in session as `setupData.organizationId`
- This ID is used for all subsequent database inserts

---

### 2. Document Import (`/src/routes/setup.js` lines 526-586)

**Location:** `setup.js` - `processSetupData()` function, `import` step

**What Happens:**
```javascript
const importResult = await setupService.processDocumentImport(
  organizationId,    // ← Uses setupData.organizationId from step 1
  importData.file_path,
  supabase
);
```

**Calls:** `/src/services/setupService.js` - `processDocumentImport()`

---

### 3. Document Record Creation (`/src/services/setupService.js` lines 212-226)

**Critical Code:**
```javascript
const { data: document, error: docError } = await supabase
  .from('documents')
  .insert({
    organization_id: orgId,           // ← ORGANIZATION_ID IS SET HERE
    title: config.terminology?.documentName || 'Bylaws',
    document_type: 'bylaws',
    status: 'draft',
    metadata: {
      source_file: path.basename(filePath),
      imported_at: new Date().toISOString()
    },
    created_at: new Date().toISOString()
  })
  .select()
  .single();
```

**Key Facts:**
- Document **ALWAYS** gets `organization_id` from the `orgId` parameter
- The `orgId` comes from `setupData.organizationId` which was set during organization creation
- Table: `documents` (NOT `bylaw_sections` or `bylaws_documents`)
- Column: `organization_id` (UUID reference to `organizations.id`)

---

### 4. Section Storage (`/src/services/setupService.js` lines 236-242)

**What Happens:**
```javascript
const storageResult = await sectionStorage.storeSections(
  orgId,           // organization_id
  document.id,     // document_id
  parseResult.sections,
  supabase
);
```

**Calls:** `/src/services/sectionStorage.js` - `storeSections()`

---

### 5. Section Insertion (`/src/services/sectionStorage.js` lines 61-72)

**Critical Code:**
```javascript
const { data, error } = await supabase
  .from('document_sections')
  .insert(batch)
  .select();
```

**Section Data Structure:**
```javascript
{
  document_id: documentId,              // Links to documents table
  parent_section_id: section.parent_id,
  ordinal: section.ordinal,
  depth: section.depth,
  section_number: section.section_number,
  section_title: section.title,
  section_type: section.type,
  original_text: section.content || section.text,
  current_text: section.content || section.text,
  metadata: { ... },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}
```

**Key Facts:**
- Sections are stored in `document_sections` table
- Each section has `document_id` linking to the `documents` table
- Organization association is INDIRECT: `document_sections.document_id → documents.id → documents.organization_id`

---

## Database Schema Analysis

### Tables Used

#### 1. `organizations` Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  organization_type VARCHAR(50) DEFAULT 'neighborhood_council',
  -- ... other columns
);
```

#### 2. `documents` Table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  document_type VARCHAR(50) DEFAULT 'bylaws',
  status VARCHAR(50) DEFAULT 'draft',
  -- ... other columns
);
```

#### 3. `document_sections` Table
```sql
CREATE TABLE document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  section_number VARCHAR(50),
  section_title TEXT,
  section_type VARCHAR(50),
  original_text TEXT,
  current_text TEXT,
  -- ... other columns
);
```

---

## Comparison: Setup vs. Dashboard

### Setup Storage (CORRECT)

**Organization Creation:**
```javascript
// setupData.organizationId = "abc-123-def"
```

**Document Insertion:**
```javascript
.from('documents')
.insert({
  organization_id: "abc-123-def",  // ← Correct
  title: "Bylaws",
  document_type: "bylaws",
  status: "draft"
})
```

### Dashboard Retrieval (VERIFY THIS)

**From `/src/routes/dashboard.js` lines 136-141:**
```javascript
const { data: documents, error } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', orgId)  // ← Is orgId correct here?
  .order('created_at', { ascending: false })
  .limit(50);
```

**Critical Question:** What is the value of `orgId` in the dashboard route?

**From `/src/routes/dashboard.js` lines 24-37:**
```javascript
const orgId = req.session.organizationId || req.query.org_id;

if (!orgId) {
  return res.redirect('/dashboard/select-org');
}
```

---

## Potential Issues Identified

### Issue #1: Session organizationId Not Set

**Symptom:** Dashboard redirects to `/dashboard/select-org` or queries with `undefined` orgId

**Root Cause:** After setup completion, the session might not have `organizationId` set

**Evidence from `/src/routes/setup.js` lines 389-407:**
```javascript
router.get('/success', (req, res) => {
  const setupData = req.session.setupData || {};

  // Store organization_id for dashboard access
  if (setupData.organizationId) {
    req.session.organizationId = setupData.organizationId;  // ✅ This should work
  }

  // Clear setup data and mark as configured
  delete req.session.setupData;
  req.session.isConfigured = true;

  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
    }
    res.redirect('/dashboard');
  });
});
```

**This code looks correct!** The `organizationId` SHOULD be set in the session.

---

### Issue #2: RLS Policies Blocking Dashboard Queries

**RLS Policy from Database Schema:**
```sql
CREATE POLICY "Users see own organization documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Problem:** This policy requires:
1. User must be authenticated (`auth.uid()` must return a valid UUID)
2. User must have a record in `user_organizations` table linking them to the organization

**During Setup:**
- Setup wizard runs with **service role** (bypasses RLS)
- Documents are created successfully
- BUT: No `user_organizations` record is created!

**Dashboard Query:**
- Runs with **anon** or **authenticated** role (RLS applies)
- RLS policy filters out documents where user is NOT in `user_organizations`
- Result: Empty array even though documents exist

---

## Critical Finding: Missing user_organizations Record

### The Problem

**Setup creates:**
1. ✅ `organizations` record (with correct ID)
2. ✅ `documents` record (with correct `organization_id`)
3. ✅ `document_sections` records (with correct `document_id`)
4. ❌ NO `user_organizations` record linking user to organization

**Dashboard needs:**
- User to have a record in `user_organizations` table
- This record must have the correct `organization_id`
- RLS policy checks this table for access permission

---

## Verification Steps

### Step 1: Check if documents exist in database

**Run in Supabase SQL Editor:**
```sql
SELECT
  id,
  organization_id,
  title,
  document_type,
  status,
  created_at
FROM documents
WHERE organization_id = 'YOUR_ORG_ID_HERE'
ORDER BY created_at DESC;
```

**Expected Result:** Should return 1+ documents

---

### Step 2: Check user_organizations table

**Run in Supabase SQL Editor:**
```sql
SELECT
  id,
  user_id,
  organization_id,
  role,
  permissions,
  joined_at
FROM user_organizations
WHERE organization_id = 'YOUR_ORG_ID_HERE';
```

**Expected Result:** Should return 0 rows (THIS IS THE BUG)

---

### Step 3: Check RLS policies

**Run in Supabase SQL Editor:**
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'documents';
```

**Expected Result:** Will show RLS policy that requires `user_organizations` membership

---

## Root Cause Conclusion

**The setup wizard creates documents correctly with proper `organization_id` associations.**

**However, the dashboard cannot retrieve these documents because:**

1. **No `user_organizations` record is created during setup**
2. **RLS policies require this record to grant access**
3. **Dashboard queries are filtered by RLS and return empty results**

**The issue is NOT with document storage - it's with access control setup.**

---

## Recommended Fixes

### Fix #1: Create user_organizations Record During Setup

**Add to `/src/routes/setup.js` in the `organization` step:**

```javascript
case 'organization':
  // ... existing organization creation code ...

  if (data && data.id) {
    setupData.organizationId = data.id;

    // FIX: Create user_organizations record
    const { error: memberError } = await supabase
      .from('user_organizations')
      .insert({
        user_id: auth.uid(),           // Current user (if authenticated)
        organization_id: data.id,
        role: 'owner',                 // First user is owner
        permissions: {
          can_edit_sections: true,
          can_create_suggestions: true,
          can_vote: true,
          can_approve_stages: [],
          can_manage_users: true,
          can_manage_workflows: true
        }
      });

    if (memberError) {
      console.error('Failed to create membership:', memberError);
      // Rollback organization creation
      await supabase.from('organizations').delete().eq('id', data.id);
      throw new Error('Failed to create organization membership');
    }
  }
  break;
```

---

### Fix #2: Add RLS Policy for Setup Wizard

**Add to database migrations:**

```sql
-- Allow service role to bypass RLS for setup wizard
CREATE POLICY "service_role_bypass_documents"
  ON documents
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

---

### Fix #3: Session-based Access for Setup Wizard

**Add temporary RLS policy for newly created organizations:**

```sql
-- Allow access to organization created in this session
CREATE POLICY "setup_wizard_access"
  ON documents
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_organization_id', true)::uuid
    OR
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Set session variable during setup:**
```javascript
await supabase.rpc('set_config', {
  setting: 'app.current_organization_id',
  value: organizationId
});
```

---

## Summary of Findings

### ✅ What's Working

1. Organization creation with unique slug
2. Document insertion with correct `organization_id`
3. Section parsing and storage with proper hierarchy
4. Document record structure and relationships
5. Session storage of `organizationId` after setup

### ❌ What's Broken

1. **Missing `user_organizations` record during setup**
2. RLS policies blocking dashboard queries for setup user
3. No authentication flow integration with setup wizard

### 🔍 What Needs Verification

1. Are users authenticated during setup wizard?
2. What is the value of `auth.uid()` during setup?
3. Does the session maintain `organizationId` after redirect?
4. Are RLS policies active during dashboard queries?

---

## Next Steps

1. **Verify documents exist in database** (SQL query above)
2. **Verify user_organizations table is empty** (SQL query above)
3. **Implement Fix #1** to create membership records during setup
4. **Test dashboard access** after implementing fix
5. **Add authentication flow** to setup wizard if not already present

---

## File References

- `/src/routes/setup.js` - Setup wizard routes and logic
- `/src/services/setupService.js` - Document import and processing
- `/src/services/sectionStorage.js` - Section storage to database
- `/src/parsers/wordParser.js` - Document parsing logic
- `/src/routes/dashboard.js` - Dashboard query logic
- `/database/migrations/001_generalized_schema.sql` - Database schema
- `/database/migrations/005_implement_proper_rls.sql` - RLS policies

---

**Analysis Complete**
**Memory Key:** `analysis/setup/document-flow`
**Status:** Ready for implementation
