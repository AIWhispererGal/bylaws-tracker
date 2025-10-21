# RLS Quick Reference Guide

**Quick Start:** How to fix the infinite recursion error and enable proper multi-tenant security

---

## The Problem (TL;DR)

```sql
-- ❌ THIS CAUSES INFINITE RECURSION:
CREATE POLICY "bad" ON user_organizations
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations  -- ← Queries itself!
      WHERE user_id = auth.uid()
    )
  );
```

**Error:** `infinite recursion detected in policy for relation "user_organizations"`

---

## The Fix (TL;DR)

```sql
-- ✅ THIS WORKS (no recursion):
CREATE POLICY "good" ON user_organizations
  USING (user_id = auth.uid());  -- ← Direct comparison
```

---

## Quick Migration Steps

### 1. Apply the Migration

```bash
# In Supabase SQL Editor, run:
/database/migrations/005_implement_proper_rls.sql
```

### 2. Update Environment Variables

```bash
# Add to .env:
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

### 3. Update setupService.js

```javascript
// Replace:
const supabase = createClient(url, anonKey);

// With:
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey);
```

### 4. Test

```bash
# Test setup wizard:
npm start
# Navigate to /setup
```

---

## The Rule (Simple Version)

**For any RLS policy:**

1. **Base tables** (like `user_organizations`):
   - ✅ Use direct `auth.uid()` comparison
   - ❌ Never query the same table

2. **Child tables** (like `documents`):
   - ✅ Query parent tables (like `user_organizations`)
   - ❌ Never query yourself or children

3. **Service role bypass**:
   - Always check: `current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'`

---

## Common Patterns

### Pattern 1: Base Table (No Recursion)
```sql
CREATE POLICY "name" ON user_organizations
  USING (user_id = auth.uid());
```

### Pattern 2: Organization Access
```sql
CREATE POLICY "name" ON organizations
  USING (
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

### Pattern 3: Document Access (Performance)
```sql
CREATE POLICY "name" ON document_sections
  USING (
    EXISTS (
      SELECT 1
      FROM documents d
      INNER JOIN user_organizations uo
        ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
    )
  );
```

### Pattern 4: Service Role Bypass
```sql
CREATE POLICY "name" ON any_table
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

---

## Testing Commands

### Verify RLS is Enabled
```sql
SELECT * FROM verify_rls_enabled();
```

Expected output:
```
table_name              | rls_enabled | policy_count
------------------------|-------------|-------------
organizations           | true        | 5
user_organizations      | true        | 4
documents               | true        | 5
document_sections       | true        | 3
suggestions             | true        | 4
...
```

### Test Cross-Tenant Isolation
```sql
-- Create test users in different orgs
INSERT INTO users (id, email, name) VALUES
  ('user1-uuid', 'user1@council1.org', 'User 1'),
  ('user2-uuid', 'user2@council2.org', 'User 2');

-- Create memberships
INSERT INTO user_organizations (user_id, organization_id, role) VALUES
  ('user1-uuid', 'org1-uuid', 'owner'),
  ('user2-uuid', 'org2-uuid', 'owner');

-- Test: User 1 should NOT see Org 2's documents
SET request.jwt.claims = '{"sub": "user1-uuid", "role": "authenticated"}';
SELECT * FROM documents WHERE organization_id = 'org2-uuid';
-- Expected: 0 rows (blocked by RLS)
```

---

## Troubleshooting

### Error: "infinite recursion detected"
**Cause:** Policy queries the same table
**Fix:** Use direct `auth.uid()` comparison instead

### Error: "new row violates row-level security policy"
**Cause:** Missing INSERT policy or wrong role
**Fix:** Either:
1. Add service role key to request
2. Add INSERT policy with `WITH CHECK (true)`

### Setup wizard fails with RLS enabled
**Cause:** Using anon key instead of service role
**Fix:** Update `setupService.js` to use `SUPABASE_SERVICE_ROLE_KEY`

### Performance is slow with RLS
**Cause:** Missing indexes or wrong query pattern
**Fix:**
1. Ensure indexes exist (see migration 005)
2. Use `EXISTS` with JOIN for large tables
3. Use `IN` with subquery for small tables

---

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] No recursive policies
- [ ] Service role key configured (backend only)
- [ ] Anon key used for user operations
- [ ] Cross-tenant isolation tested
- [ ] Public suggestions work (if enabled)
- [ ] Setup wizard works with service role
- [ ] Performance acceptable (< 100ms queries)

---

## Need More Details?

See: `/docs/reports/RLS_SECURITY_REVIEW.md`

---

**Created:** 2025-10-12
**Migration:** 005_implement_proper_rls.sql
**Status:** ✅ Ready for deployment
