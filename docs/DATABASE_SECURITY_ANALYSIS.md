# DATABASE SECURITY ANALYSIS - RLS POLICIES & DOCUMENT ACCESS

**Analysis Date:** 2025-10-13
**Analyst:** Database Security Specialist
**Status:** ⚠️ CRITICAL FINDINGS - RLS CURRENTLY DISABLED

---

## EXECUTIVE SUMMARY

### 🔴 CRITICAL SECURITY FINDING

**Row Level Security (RLS) is currently DISABLED on all tables**, including the `documents` table. This means there is currently **NO database-level multi-tenant isolation**.

### Current Security Posture

| Security Layer | Status | Risk Level |
|----------------|--------|------------|
| **RLS Policies** | ❌ DISABLED | 🔴 CRITICAL |
| **Application Filtering** | ⚠️ Partial | 🟡 MEDIUM |
| **Multi-Tenant Isolation** | ⚠️ App-Only | 🟡 MEDIUM |
| **Authentication** | ❌ Not Implemented | 🔴 HIGH |

---

## DETAILED FINDINGS

### 1. RLS Policy Status

#### Current State (Migration 004)
```sql
-- All tables have RLS DISABLED
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions DISABLE ROW LEVEL SECURITY;
-- ... and 8 more tables
```

**Location:** `/database/migrations/004_fix_rls_recursion.sql`

**Reason for Disabling:** The previous RLS implementation (Migration 003) caused infinite recursion errors:
```
ERROR: infinite recursion detected in policy for relation "user_organizations"
```

#### Root Cause of Recursion
The `user_organizations` table had a policy that queried itself:

```sql
-- ❌ BROKEN (causes infinite recursion)
CREATE POLICY "Users see own memberships"
  ON user_organizations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT organization_id
      FROM user_organizations  -- RECURSION: queries same table!
      WHERE user_id = auth.uid()
    )
  );
```

---

### 2. Document Table Structure

#### Schema Definition
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'bylaws',

  -- Status
  status VARCHAR(50) DEFAULT 'draft',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Points:**
- ✅ Has `organization_id` foreign key for multi-tenant isolation
- ✅ Cascading delete ensures data integrity
- ✅ Indexes on `organization_id` for query performance
- ❌ No RLS policies currently active

#### Current Indexes
```sql
CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_google ON documents(google_doc_id) WHERE google_doc_id IS NOT NULL;
CREATE INDEX idx_documents_type ON documents(organization_id, document_type);
```

---

### 3. Application-Level Security

#### Supabase Client Configuration
The application uses **two Supabase clients**:

```javascript
// server.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Regular client (for read operations)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Service client (for admin operations)
const supabaseService = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
);
```

#### Document Query Patterns

**Setup Service (Document Creation):**
```javascript
// src/services/setupService.js:213
const { data: document, error: docError } = await supabase
  .from('documents')
  .insert({
    organization_id: orgId,  // ✅ Filtered by org
    title: config.terminology?.documentName || 'Bylaws',
    document_type: 'bylaws',
    status: 'draft',
    metadata: { ... }
  })
  .select()
  .single();
```

**Dashboard Routes:**
```javascript
// src/routes/dashboard.js:49
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', organizationId)  // ✅ Filtered by org
  .order('created_at', { ascending: false });
```

**Admin Routes:**
```javascript
// src/routes/admin.js:43
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', organizationId)  // ✅ Filtered by org
```

✅ **Finding:** All document queries include `organization_id` filter in application code.

---

### 4. Authentication Status

#### Current State: NO AUTHENTICATION
- ❌ Supabase Auth NOT enabled
- ❌ `auth.uid()` always returns `NULL`
- ❌ No user sessions
- ❌ No login/logout functionality

#### Impact on RLS
All RLS policies that use `auth.uid()` will FAIL:
```sql
-- ❌ WILL NOT WORK (auth.uid() is NULL)
CREATE POLICY "Users see own orgs"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- Returns NULL!
    )
  );
```

---

### 5. Migration History & RLS Evolution

#### Migration 001: Initial RLS (FLAWED)
- **File:** `001_generalized_schema.sql`
- **Approach:** Auth-based policies using `auth.uid()`
- **Problem:** Application doesn't use Supabase Auth
- **Result:** Policies block all operations

#### Migration 003: Write Operation Policies (BROKEN)
- **File:** `003_fix_rls_policies.sql`
- **Approach:** Added INSERT/UPDATE/DELETE policies
- **Problem:** Introduced recursive policy on `user_organizations`
- **Result:** "infinite recursion detected" error

#### Migration 004: Complete RLS Disable (CURRENT)
- **File:** `004_fix_rls_recursion.sql`
- **Approach:** Disable ALL RLS on ALL tables
- **Impact:** No database-level security
- **Status:** ✅ Works but insecure

#### Migration 005: Proposed Fix (NOT APPLIED)
- **File:** `005_implement_proper_rls_FIXED.sql`
- **Approach:** Layer-based RLS with service role bypass
- **Status:** ⚠️ Available but not deployed
- **Complexity:** 815 lines, 12 policy layers

---

### 6. Proposed RLS Solution (Migration 005)

#### Architecture: Layer-Based Security

**Layer 1: user_organizations (Base - NO RECURSION)**
```sql
-- ✅ Direct auth.uid() check only
CREATE POLICY "users_see_own_memberships"
  ON user_organizations
  FOR SELECT
  USING (user_id = auth.uid());

-- ✅ Service role can bypass
CREATE POLICY "service_role_manage_memberships"
  ON user_organizations
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

**Layer 4: documents (Inherits from user_organizations)**
```sql
-- ✅ Uses user_organizations (not recursive)
CREATE POLICY "users_see_org_documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- ✅ Service role bypasses RLS
CREATE POLICY "service_role_manage_documents"
  ON documents
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

**Key Features:**
- ✅ No recursive policies (base layer is simple)
- ✅ Service role key bypasses ALL policies
- ✅ Supports anonymous setup (service role)
- ✅ Ready for future auth implementation

---

### 7. Security Risks & Mitigations

#### Risk Matrix

| Risk | Severity | Likelihood | Impact | Mitigation Status |
|------|----------|------------|--------|------------------|
| Cross-org data leak | 🔴 CRITICAL | 🟡 MEDIUM | 🔴 HIGH | ✅ App-level filtering |
| Accidental query without filter | 🔴 HIGH | 🟡 MEDIUM | 🔴 HIGH | ⚠️ Code review needed |
| Service key exposure | 🔴 CRITICAL | 🟢 LOW | 🔴 CRITICAL | ✅ Env vars only |
| SQL injection | 🟡 MEDIUM | 🟢 LOW | 🔴 HIGH | ✅ Parameterized queries |
| Setup wizard RLS block | 🔴 HIGH | 🔴 HIGH | 🔴 HIGH | ✅ RLS disabled |

#### Current Mitigations

1. **Application-Level Filtering** (PRIMARY)
   - ✅ All queries filter by `organization_id`
   - ✅ Session stores current org ID
   - ⚠️ Relies on developer discipline

2. **Foreign Key Constraints** (SECONDARY)
   - ✅ `documents.organization_id` references `organizations(id)`
   - ✅ Cascading deletes prevent orphans
   - ✅ Database enforces referential integrity

3. **Service Role Key Protection** (TERTIARY)
   - ✅ Stored in environment variables
   - ✅ Not committed to git
   - ✅ Separate from anon key

---

### 8. Recommended Actions

#### Priority 1: Immediate (Security Enhancement)

1. **Deploy Migration 005 (RLS with Service Role Bypass)**
   ```bash
   # Apply the fixed RLS policies
   psql $DATABASE_URL < database/migrations/005_implement_proper_rls_FIXED.sql
   ```

   **Benefits:**
   - ✅ Defense-in-depth security
   - ✅ Setup wizard still works (service role)
   - ✅ Catches accidental queries without filters
   - ✅ Ready for auth implementation

2. **Set Service Role Key in Environment**
   ```bash
   # .env
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

#### Priority 2: Short-Term (Code Hardening)

1. **Create Helper Functions**
   ```javascript
   // src/utils/supabaseHelpers.js

   // Force organization_id filter on all queries
   function queryDocuments(supabase, orgId, filters = {}) {
     if (!orgId) throw new Error('organization_id required');
     return supabase
       .from('documents')
       .select('*')
       .eq('organization_id', orgId)
       .match(filters);
   }
   ```

2. **Add Integration Tests**
   ```javascript
   // tests/security/multi-tenant-isolation.test.js

   describe('Multi-tenant isolation', () => {
     it('Org A cannot see Org B documents', async () => {
       const orgA_docs = await queryDocuments(supabase, ORG_A_ID);
       const orgB_docs = await queryDocuments(supabase, ORG_B_ID);

       expect(orgA_docs.every(d => d.organization_id === ORG_A_ID)).toBe(true);
       expect(orgB_docs.every(d => d.organization_id === ORG_B_ID)).toBe(true);
     });
   });
   ```

3. **Code Review Checklist**
   - [ ] Every SELECT has `.eq('organization_id', ...)`
   - [ ] Every INSERT sets `organization_id`
   - [ ] Every UPDATE/DELETE checks org ownership
   - [ ] No raw SQL without parameterization
   - [ ] Session stores current org ID securely

#### Priority 3: Long-Term (Architecture Evolution)

1. **Implement Supabase Auth**
   - Enable `auth.users` table
   - Link `users.id` to `auth.uid()`
   - Add login/logout routes
   - Implement session management

2. **JWT Claims for Org Context**
   ```javascript
   // Set current org in JWT claims
   const { data: { session } } = await supabase.auth.getSession();
   await supabase.auth.updateUser({
     data: { current_org_id: selectedOrgId }
   });
   ```

3. **Enhanced RLS with JWT**
   ```sql
   -- Use JWT claims instead of query
   CREATE POLICY "users_see_current_org_documents"
     ON documents
     FOR SELECT
     USING (
       organization_id::text =
       current_setting('request.jwt.claims', true)::json->>'current_org_id'
     );
   ```

---

## SECURITY MODEL DECISION

### Architecture Decision: Hybrid Security Model

**Chosen Approach:** Application enforces security, RLS provides fail-safe

**Rationale:**
1. ✅ No infinite recursion (simple policies)
2. ✅ Setup wizard works (service role bypass)
3. ✅ Fast queries (no complex policy evaluation)
4. ✅ Defense-in-depth (catches mistakes)
5. ✅ Future-proof (can add auth later)

**Trade-offs:**
- ⚠️ Application must enforce security
- ⚠️ Developer discipline required
- ⚠️ No DB-level user isolation (until auth added)

**Documentation:** See `ADR-001-RLS-SECURITY-MODEL.md` for full decision rationale.

---

## VERIFICATION QUERIES

### Check RLS Status
```sql
-- See which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) as policy_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'documents', 'document_sections')
ORDER BY tablename;
```

### Check Current Policies
```sql
-- List all policies (should be empty currently)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test Multi-Tenant Isolation
```sql
-- Create test organizations
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Org A', 'test-org-a'),
  ('00000000-0000-0000-0000-000000000002', 'Test Org B', 'test-org-b');

-- Create test documents
INSERT INTO documents (organization_id, title) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Org A Document'),
  ('00000000-0000-0000-0000-000000000002', 'Org B Document');

-- Query should only return Org A's documents
SELECT title, organization_id
FROM documents
WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Cleanup
DELETE FROM organizations WHERE slug LIKE 'test-org-%';
```

---

## FILES REVIEWED

### Schema Files
- ✅ `/database/migrations/001_generalized_schema.sql` (700 lines)
- ✅ `/database/migrations/003_fix_rls_policies.sql` (274 lines)
- ✅ `/database/migrations/004_fix_rls_recursion.sql` (123 lines)
- ✅ `/database/migrations/005_implement_proper_rls_FIXED.sql` (815 lines)

### Application Files
- ✅ `/server.js` (Supabase client setup)
- ✅ `/src/services/setupService.js` (Document creation)
- ✅ `/src/routes/dashboard.js` (Document queries)
- ✅ `/src/routes/admin.js` (Admin operations)

### Documentation Files
- ✅ `/docs/ADR-001-RLS-SECURITY-MODEL.md` (Architectural decision)
- ✅ `/docs/DATABASE_FIX_GUIDE.md` (Troubleshooting)
- ✅ `/database/diagnostic_check.sql` (Health checks)

---

## CONCLUSION

### Summary of Findings

1. **RLS is currently DISABLED** (Migration 004)
   - Reason: Infinite recursion in previous implementation
   - Impact: No database-level multi-tenant isolation
   - Status: Acceptable for current single-user setup

2. **Application-level security IS working**
   - All queries filter by `organization_id`
   - Foreign key constraints enforced
   - Session-based org context

3. **Migration 005 is available but not applied**
   - Fixes recursion issue
   - Supports service role bypass
   - Ready for deployment when needed

4. **Authentication is NOT implemented**
   - No Supabase Auth
   - No user sessions
   - Setup wizard works without auth

### Recommendations

**For Immediate Production Use:**
1. ✅ Current state is acceptable with single organization
2. ✅ Code review all queries for `organization_id` filters
3. ⚠️ Monitor for accidental cross-org queries

**For Multi-Organization Production:**
1. 🔴 MUST deploy Migration 005 (RLS with service role)
2. 🔴 MUST set `SUPABASE_SERVICE_ROLE_KEY` environment variable
3. 🔴 MUST implement integration tests for tenant isolation

**For Long-Term Security:**
1. 🟡 Implement Supabase Auth
2. 🟡 Add JWT claims for org context
3. 🟡 Enhance RLS policies with user-level isolation

---

## CONTACT & SUPPORT

**Analyst:** Database Security Specialist
**Review Date:** 2025-10-13
**Next Review:** 2025-11-13

**Related Documentation:**
- Architecture Decision: `/docs/ADR-001-RLS-SECURITY-MODEL.md`
- Security Checklist: `/docs/SECURITY_CHECKLIST.md`
- Testing Guide: `/docs/TESTING_MULTI_TENANT.md`

---

**END OF SECURITY ANALYSIS REPORT**
