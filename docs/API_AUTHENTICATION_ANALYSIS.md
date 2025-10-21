# API Authentication & Authorization Analysis
**Date:** 2025-10-12
**Analyst:** Backend API Specialist
**Purpose:** Identify why dashboard cannot access documents

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** The application uses **Supabase anonymous key (anon)** for API calls, but RLS policies require **authenticated users with `auth.uid()`**. Since no Supabase Auth is implemented, `auth.uid()` returns NULL, causing all RLS policies to **deny access**.

**Impact:** Dashboard endpoints return empty results because RLS policies block all document/section queries when using the anon key.

---

## Authentication Architecture

### Current Implementation
```javascript
// server.js:22-23
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Middleware makes both available to routes:
app.use((req, res, next) => {
  req.supabase = supabase;           // ❌ Anon key - blocked by RLS
  req.supabaseService = supabaseService; // ✅ Service key - bypasses RLS
  next();
});
```

### Session Management
```javascript
// /src/routes/dashboard.js:12-21
function requireAuth(req, res, next) {
  if (!req.session.organizationId) {
    return res.redirect('/auth/select');
  }
  req.organizationId = req.session.organizationId;
  next();
}
```

**How it works:**
1. User visits `/auth/select`
2. User selects organization → stored in `req.session.organizationId`
3. All dashboard routes check `req.session.organizationId` exists
4. Application filters queries: `.eq('organization_id', req.organizationId)`

---

## RLS Policy Analysis

### What the Database Expects (from migration 005)

All RLS policies check **`auth.uid()`** to verify authenticated users:

```sql
-- Example: Documents policy (Line 259-268)
CREATE POLICY "users_see_org_documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- ❌ RETURNS NULL with anon key!
    )
  );
```

**Critical Issue:**
- `auth.uid()` comes from Supabase Auth JWT tokens
- Application uses **anon key** (not authenticated)
- `auth.uid()` = **NULL** → subquery returns empty set → policy denies access

### Why Setup Wizard Works

Setup wizard uses **service role key**:
```javascript
// Routes like /setup/* use:
const { supabaseService } = req;

const { data, error } = await supabaseService
  .from('organizations')
  .select('*');
```

**Service role key bypasses ALL RLS policies** (lines 131-139, 184-192, etc.):
```sql
CREATE POLICY "service_role_manage_documents"
  ON documents
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

---

## Dashboard Endpoint Behavior

### GET /dashboard/documents (Line 131-174)

```javascript
router.get('/documents', requireAuth, async (req, res) => {
  const { supabase } = req;  // ❌ Uses ANON key
  const orgId = req.organizationId;

  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', orgId)  // Application filter
    .order('created_at', { ascending: false })
    .limit(50);
```

**What happens:**
1. ✅ Session check passes (user selected org)
2. ✅ Application adds `.eq('organization_id', orgId)`
3. ❌ **Supabase RLS policy checks `auth.uid()`** → NULL
4. ❌ **Policy denies access** → returns empty array
5. ❌ Dashboard shows "No documents"

### GET /dashboard/sections (Line 179-253)

Same issue - uses `req.supabase` (anon key), RLS blocks access.

### GET /dashboard/overview (Line 42-126)

Same issue - all document queries blocked by RLS.

---

## Mismatch Between Design and Implementation

### What ADR-001 Says (Hybrid Model)

From `/docs/ADR-001-RLS-SECURITY-MODEL.md`:

> **RLS policies allow READ/WRITE for anon role (`USING (true)`)**
>
> Application Layer (Primary Enforcement):
> - **EVERY** query filters by `organization_id`

**Expected RLS Policy:**
```sql
-- This is what ADR-001 describes:
CREATE POLICY "allow_read_documents"
  ON documents FOR SELECT USING (true);
```

### What Was Actually Implemented

Migration 005 uses **auth-based policies**:
```sql
-- This is what exists in database:
CREATE POLICY "users_see_org_documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()  -- Requires Supabase Auth!
    )
  );
```

**Conflict:** Migration 005 contradicts ADR-001's design.

---

## Why This Breaks Document Access

### The RLS Execution Flow

```
User Request → Dashboard Route
  ↓
1. requireAuth() checks session ✅
  ↓
2. Sets req.organizationId = session.organizationId ✅
  ↓
3. Query: supabase.from('documents').eq('organization_id', orgId)
  ↓
4. Supabase sends query to PostgreSQL
  ↓
5. PostgreSQL RLS checks policy:
     - Check: auth.uid() IN user_organizations?
     - auth.uid() = NULL (anon key)
     - Result: DENY ❌
  ↓
6. Return empty result set []
  ↓
7. Dashboard shows "No documents"
```

### Why Setup Wizard Doesn't Break

```
Setup Request → Setup Route
  ↓
1. No requireAuth() check
  ↓
2. Query: supabaseService.from('organizations').select()
  ↓
3. Supabase sends with SERVICE_ROLE JWT
  ↓
4. PostgreSQL RLS checks:
     - Check: JWT role = 'service_role'?
     - Result: ALLOW ✅ (bypass all policies)
  ↓
5. Return all organizations
  ↓
6. Setup wizard works perfectly
```

---

## Solution Options

### Option 1: Use Service Role Key (Quick Fix) ⚡

**Change dashboard routes to use service key:**

```javascript
// src/routes/dashboard.js
router.get('/documents', requireAuth, async (req, res) => {
  const { supabaseService } = req;  // ✅ Use service key
  const orgId = req.organizationId;

  const { data: documents, error } = await supabaseService
    .from('documents')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
```

**Pros:**
- ✅ Immediate fix - works right now
- ✅ No database changes needed
- ✅ Application still enforces `organization_id` filtering
- ✅ Matches how setup wizard works

**Cons:**
- ⚠️ Service key bypasses ALL RLS (less secure)
- ⚠️ Relies 100% on application code for security
- ⚠️ If developer forgets `.eq('organization_id')`, data leaks across orgs

**Risk Level:** Medium (acceptable with strict code review)

---

### Option 2: Implement RLS per ADR-001 (Correct Fix) 🎯

**Update RLS policies to match ADR-001 design:**

```sql
-- Migration: 006_fix_rls_for_anon_access.sql
-- Drop auth-based policies
DROP POLICY "users_see_org_documents" ON documents;
DROP POLICY "users_see_org_sections" ON document_sections;

-- Create permissive policies (app enforces security)
CREATE POLICY "allow_read_documents"
  ON documents FOR SELECT USING (true);

CREATE POLICY "allow_read_sections"
  ON document_sections FOR SELECT USING (true);

CREATE POLICY "allow_write_documents"
  ON documents FOR INSERT WITH CHECK (true);

-- Keep service_role policies for admin operations
```

**Pros:**
- ✅ Matches ADR-001 architecture decision
- ✅ Works with anon key (no auth needed)
- ✅ Application enforces `organization_id` filtering
- ✅ RLS provides basic fail-safe against SQL injection
- ✅ Future-proof: can add auth.uid() policies later

**Cons:**
- ⚠️ Requires database migration
- ⚠️ Must audit ALL queries for `.eq('organization_id')`
- ⚠️ Less defense-in-depth (RLS doesn't validate org membership)

**Risk Level:** Medium (acceptable with thorough testing)

---

### Option 3: Implement Supabase Auth (Long-term) 🔐

**Add proper authentication system:**

1. Enable Supabase Auth
2. Create user accounts tied to `auth.users`
3. Link session to JWT tokens with `auth.uid()`
4. Keep current RLS policies (they'll work!)

**Pros:**
- ✅ Proper security at database level
- ✅ RLS policies work as designed
- ✅ Per-user permissions and audit trails
- ✅ Industry best practice

**Cons:**
- ⚠️ Major refactoring required
- ⚠️ Need user registration/login UI
- ⚠️ Setup wizard needs rework
- ⚠️ 2-4 weeks of development time

**Risk Level:** Low (most secure, but time-consuming)

---

## Recommended Action Plan

### Immediate (Today)

**Use Option 1 (Service Role Key):**

```javascript
// Change in src/routes/dashboard.js
- const { supabase } = req;
+ const { supabaseService } = req;

// Apply to ALL dashboard routes:
// - GET /documents
// - GET /sections
// - GET /overview
// - GET /suggestions
// - GET /activity
```

**Testing:**
1. Restart server
2. Visit `/dashboard`
3. Verify documents load
4. Test multi-tenant isolation (switch orgs)

---

### Short-term (This Week)

**Implement Option 2 (Fix RLS):**

1. Create migration `006_fix_rls_for_anon_access.sql`
2. Replace auth-based policies with `USING (true)`
3. Run migration on database
4. Change dashboard back to `req.supabase` (anon key)
5. Comprehensive testing

**Migration script:**
```sql
-- 006_fix_rls_for_anon_access.sql
BEGIN;

-- Documents
DROP POLICY IF EXISTS "users_see_org_documents" ON documents;
DROP POLICY IF EXISTS "editors_create_documents" ON documents;

CREATE POLICY "allow_anon_read_documents"
  ON documents FOR SELECT USING (true);

CREATE POLICY "allow_anon_write_documents"
  ON documents FOR INSERT WITH CHECK (true);

-- Repeat for: document_sections, suggestions, workflow_templates, etc.

-- Keep service_role policies for admin functions

COMMIT;
```

---

### Long-term (Next Quarter)

**Implement Option 3 (Supabase Auth):**

1. Design user authentication flow
2. Create registration/login UI
3. Migrate session to JWT tokens
4. Update RLS policies to use both `auth.uid()` AND `organization_id`
5. Add permission-based checks

---

## Security Considerations

### Current State (Broken)
- ❌ Dashboard cannot access documents (RLS blocks anon key)
- ❌ Application unusable in production
- ⚠️ Setup wizard works (uses service key)

### With Option 1 (Service Key)
- ✅ Dashboard works
- ⚠️ Security relies 100% on application code
- ⚠️ Missing `.eq('organization_id')` = data leak
- ✅ RLS disabled effectively (service key bypasses)
- **Code review critical:** Every query MUST filter by org_id

### With Option 2 (RLS true)
- ✅ Dashboard works
- ⚠️ Security relies 90% on application, 10% on RLS
- ⚠️ Missing `.eq('organization_id')` = data leak
- ✅ RLS catches SQL injection attempts
- **Code review critical:** Every query MUST filter by org_id

### With Option 3 (Supabase Auth)
- ✅ Dashboard works
- ✅ Database enforces user-level security
- ✅ Application enforces org-level security
- ✅ Defense-in-depth (RLS + app + auth)
- ✅ Audit trail per user

---

## Testing Requirements

### Multi-tenant Isolation Test

```javascript
// Test: Org A cannot see Org B documents
describe('Dashboard Multi-tenant', () => {
  it('Organization A cannot access Organization B documents', async () => {
    // Set session to Org A
    req.session.organizationId = orgA_id;

    const response = await request(app)
      .get('/dashboard/documents')
      .expect(200);

    const docIds = response.body.documents.map(d => d.id);

    // Verify no Org B documents in results
    expect(docIds).not.toContain(orgB_document_id);
  });

  it('Switching organizations changes visible documents', async () => {
    // Access with Org A
    req.session.organizationId = orgA_id;
    const docsA = await getDocuments();

    // Switch to Org B
    req.session.organizationId = orgB_id;
    const docsB = await getDocuments();

    // No overlap
    expect(docsA).not.toEqual(docsB);
  });
});
```

### Code Audit Checklist

For EVERY Supabase query:
- [ ] Has `.eq('organization_id', req.organizationId)`
- [ ] Uses `req.organizationId` from session (not user input)
- [ ] Validates organizationId exists before query
- [ ] Returns empty results (not error) when no org selected
- [ ] Logs org_id for audit trail

---

## Files Requiring Changes

### Option 1 (Service Key - Immediate)
1. `/src/routes/dashboard.js` - Change all `supabase` to `supabaseService`

### Option 2 (Fix RLS - Preferred)
1. `/database/migrations/006_fix_rls_for_anon_access.sql` - New migration
2. `/docs/ADR-001-RLS-SECURITY-MODEL.md` - Update status
3. `/src/routes/dashboard.js` - Keep using `req.supabase`
4. `/tests/integration/dashboard-isolation.test.js` - Add tests

### Option 3 (Supabase Auth - Future)
1. `/src/routes/auth.js` - Complete rewrite
2. `/src/middleware/auth.js` - New auth middleware
3. `/server.js` - JWT session handling
4. `/views/auth/*` - Login/register pages
5. All route handlers - Add auth checks

---

## Conclusion

**Immediate Action Required:**

The dashboard is completely broken because RLS policies require authenticated users (`auth.uid()`), but the application uses anonymous access.

**Choose one:**
1. **Quick fix (1 hour):** Use service role key in dashboard routes
2. **Proper fix (1 day):** Update RLS policies to match ADR-001 design
3. **Best fix (2-4 weeks):** Implement Supabase Auth properly

**Recommendation:** Start with Option 1 today, implement Option 2 this week, plan Option 3 for next quarter.

---

**Next Steps:**
1. Review this analysis with team
2. Choose solution approach
3. Implement and test
4. Update documentation
5. Deploy to production

**Contact:** Backend API Specialist
**Storage Key:** `analysis/api/routes-auth` (Claude Flow memory)
