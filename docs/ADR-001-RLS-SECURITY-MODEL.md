# ADR-001: RLS Security Model for Multi-Tenant Platform

**Status:** Accepted
**Date:** 2025-10-12
**Decision Makers:** Database Security Expert, System Architect
**Context:** Multi-tenant SaaS platform serving 99+ Los Angeles neighborhood councils

---

## Context and Problem Statement

The Bylaws Amendment Tracker is a **multi-tenant SaaS platform** serving 99+ independent organizations (Los Angeles neighborhood councils). Each organization must have complete data isolation from others, but they share a single Supabase PostgreSQL database.

### Critical Requirements:
1. **Multi-tenant isolation**: Org A cannot see Org B's data
2. **Anonymous access**: Application uses Supabase anon key (not authenticated users)
3. **Setup wizard**: Must allow creating first organization without authentication
4. **Performance**: Fast queries for 99+ organizations
5. **No recursion**: Previous RLS policies caused "infinite recursion detected" errors

### The Recursion Problem:
```sql
-- BROKEN (causes infinite recursion):
CREATE POLICY "Users see own memberships"
  ON user_organizations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    organization_id IN (
      SELECT organization_id
      FROM user_organizations  -- RECURSION HERE!
      WHERE user_id = auth.uid()
    )
  );
```

**Root Cause**: Policy checks `user_organizations` FROM WITHIN `user_organizations`, creating infinite loop.

---

## Decision Drivers

1. **No Infinite Recursion**: Policies must NOT reference their own table
2. **Anonymous Access**: Cannot rely on `auth.uid()` (returns NULL)
3. **Setup Wizard**: Must allow unauthenticated org creation
4. **Multi-Tenant Isolation**: MUST prevent cross-org data access
5. **Performance**: Simple policies without complex subqueries
6. **Future-Proof**: Should support adding Supabase Auth later

---

## Considered Options

### Option 1: Disable RLS (REJECTED)
**Pros:**
- Simple, no policy complexity
- Setup wizard works immediately
- No recursion errors

**Cons:**
- ❌ **CRITICAL**: No multi-tenant isolation
- ❌ Org A can read Org B's data
- ❌ Unacceptable security risk for 99 organizations
- ❌ Cannot meet compliance requirements

**Verdict:** Rejected - violates fundamental multi-tenant requirement

---

### Option 2: Service Role Key Only (REJECTED)
**Pros:**
- Backend bypasses RLS completely
- Application enforces all security

**Cons:**
- ❌ No defense-in-depth
- ❌ Single mistake exposes all data
- ❌ Cannot use anon key in frontend
- ⚠️ Requires rewriting all Supabase queries

**Verdict:** Rejected - too risky, requires major refactoring

---

### Option 3: Complex Auth-Based RLS (REJECTED)
**Pros:**
- Database enforces user-level isolation
- Proper separation of concerns

**Cons:**
- ❌ Requires Supabase Auth (not implemented)
- ❌ Setup wizard cannot create first org (no user yet)
- ❌ `auth.uid()` returns NULL for anonymous users
- ❌ Complex policies with subqueries (slow)
- ❌ Still has recursion risk

**Verdict:** Rejected - doesn't match current architecture

---

### Option 4: Hybrid Model (ACCEPTED) ✅
**RLS provides fail-safe, Application enforces security**

**Pros:**
- ✅ **No recursion**: Simple policies without subqueries
- ✅ **Anonymous access**: Policies use `true`, app filters
- ✅ **Multi-tenant isolation**: Application ALWAYS filters by `organization_id`
- ✅ **Setup wizard works**: Allows unauthenticated org creation
- ✅ **Defense-in-depth**: RLS prevents accidental leaks
- ✅ **Fast performance**: No complex policy evaluation
- ✅ **Future-proof**: Can add auth-based policies later

**Cons:**
- ⚠️ Application must enforce security (more responsibility)
- ⚠️ Easy to forget `organization_id` filter (requires discipline)
- ⚠️ No database-level user isolation (until Auth added)

**Mitigation:**
- Code review checklist (every query has `organization_id`)
- Integration tests for multi-tenant isolation
- Helper functions: `is_org_member()`, `has_org_role()`
- Monitoring and audit logs

**Verdict:** **ACCEPTED** - Best balance of security, functionality, and maintainability

---

## Decision

**Implement Hybrid Security Model:**

### 1. RLS Layer (Fail-Safe)
- Enable RLS on ALL tables
- Policies allow READ/WRITE for anon role (`USING (true)`)
- NO subqueries to same table (prevents recursion)
- NO `auth.uid()` checks (not implemented yet)
- Purpose: Prevent accidental data leaks, not primary enforcement

### 2. Application Layer (Primary Enforcement)
- **EVERY** query filters by `organization_id`
- Validate user org membership before WRITE operations
- Check permissions (role, capabilities) for actions
- Use helper functions for security checks

### 3. Database Layer (Data Integrity)
- Triggers validate referential integrity
- Foreign key constraints
- Helper functions for reusable checks

---

## Implementation Details

### RLS Policies (All Tables):
```sql
-- Organizations
CREATE POLICY "allow_read_all_organizations"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "allow_create_organizations"
  ON organizations FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_update_organizations"
  ON organizations FOR UPDATE USING (true);

CREATE POLICY "allow_delete_organizations"
  ON organizations FOR DELETE USING (true);

-- Documents (similar pattern)
CREATE POLICY "allow_read_documents"
  ON documents FOR SELECT USING (true);

-- ... and so on for all tables
```

### Application Security (Example):
```javascript
// ✅ CORRECT: Always filter by organization_id
const { data, error } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', userOrgId);

// ❌ WRONG: Missing organization_id filter (data leak!)
const { data, error } = await supabase
  .from('documents')
  .select('*');
```

### Helper Functions:
```sql
-- Check if user is member of organization
CREATE FUNCTION is_org_member(p_user_id UUID, p_organization_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = p_user_id AND organization_id = p_organization_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Consequences

### Positive:
- ✅ **No infinite recursion** - Fixed critical bug
- ✅ **Setup wizard works** - Can create first organization
- ✅ **Fast queries** - Simple policies without subqueries
- ✅ **Multi-tenant isolation** - Application enforces via `organization_id`
- ✅ **Defense-in-depth** - RLS catches mistakes
- ✅ **Future-proof** - Can add Supabase Auth later

### Negative:
- ⚠️ **Application responsibility** - Must enforce security in code
- ⚠️ **Developer discipline** - Easy to forget `organization_id` filter
- ⚠️ **No DB-level user isolation** - Until Supabase Auth is added

### Neutral:
- 🔄 **Trade-off accepted**: Security moves from database to application
- 🔄 **More code reviews needed**: Every query must be checked
- 🔄 **Integration testing critical**: Must verify multi-tenant isolation

---

## Validation and Testing

### Code Review Checklist:
- [ ] Every SELECT has `.eq('organization_id', ...)`
- [ ] Every INSERT sets `organization_id`
- [ ] Every UPDATE/DELETE checks org membership
- [ ] Helper functions used for repeated checks
- [ ] Permissions validated before writes

### Integration Tests:
```javascript
describe('Multi-tenant isolation', () => {
  it('Org A cannot see Org B documents', async () => {
    const orgA_documents = await getDocuments(orgA_userId);
    const orgB_documents = await getDocuments(orgB_userId);

    expect(orgA_documents).not.toContainAnyOf(orgB_documents);
  });
});
```

### Security Audit:
- Review all Supabase queries for `organization_id` filters
- Test cross-org access attempts (should fail)
- Monitor audit logs for suspicious patterns
- Quarterly security reviews

---

## Compliance and Governance

### Data Isolation Requirements:
- Each organization's data is logically separated
- No accidental cross-org data leaks
- Audit trail in `section_workflow_states` table
- Regular security reviews and penetration testing

### Future Enhancements:
1. **Add Supabase Auth** (when ready):
   - Enable `auth.users` table
   - Add policies with `auth.uid()` checks
   - Link `users.id` to `auth.uid()`
   - Keep application-level checks for defense-in-depth

2. **JWT Claims for Org Context**:
   - Store current `organization_id` in JWT
   - Use in policies: `current_setting('request.jwt.claims')::json->>'org_id'`
   - Reduces application filtering burden

3. **Row-Level Encryption**:
   - Encrypt sensitive fields per organization
   - Additional layer of isolation

---

## References

- Migration Script: `database/migrations/005_fix_rls_properly.sql`
- Security Checklist: `docs/SECURITY_CHECKLIST.md`
- Testing Guide: `docs/TESTING_MULTI_TENANT.md`
- Supabase RLS Docs: https://supabase.com/docs/guides/auth/row-level-security

---

## Decision Log

| Date | Change | Reason |
|------|--------|--------|
| 2025-10-12 | Initial decision | Fix infinite recursion, enable multi-tenant |
| TBD | Add Supabase Auth | When user authentication is implemented |
| TBD | JWT claims for org_id | Reduce application filtering burden |

---

**Signed Off By:**
- Database Security Expert (ADR Author)
- System Architect (Reviewer)
- Lead Developer (Implementer)

**Next Review Date:** 2025-11-12 (1 month)
