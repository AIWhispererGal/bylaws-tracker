# Multi-Tenant Security Checklist

**Purpose:** Ensure every code change maintains multi-tenant data isolation

**When to Use:** Before committing ANY code that queries or modifies database

---

## 🚨 CRITICAL RULES

### Rule 1: ALWAYS Filter by organization_id
Every SELECT, UPDATE, DELETE query MUST include organization_id filter.

```javascript
// ✅ CORRECT
const { data } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', userOrgId);

// ❌ WRONG - SECURITY VIOLATION!
const { data } = await supabase
  .from('documents')
  .select('*');
```

### Rule 2: ALWAYS Set organization_id on INSERT
Every INSERT must explicitly set organization_id.

```javascript
// ✅ CORRECT
await supabase
  .from('documents')
  .insert({
    title: 'New Document',
    organization_id: userOrgId  // REQUIRED!
  });

// ❌ WRONG - SECURITY VIOLATION!
await supabase
  .from('documents')
  .insert({
    title: 'New Document'
    // Missing organization_id!
  });
```

### Rule 3: VALIDATE Org Membership Before Write
Before UPDATE/DELETE, verify user belongs to organization.

```javascript
// ✅ CORRECT
async function updateDocument(userId, docId, updates) {
  // 1. Get document's org
  const { data: doc } = await supabase
    .from('documents')
    .select('organization_id')
    .eq('id', docId)
    .single();

  // 2. Check user membership
  const { data: membership } = await supabase
    .from('user_organizations')
    .select('role, permissions')
    .eq('user_id', userId)
    .eq('organization_id', doc.organization_id)
    .single();

  if (!membership) {
    throw new Error('Unauthorized: User not in organization');
  }

  // 3. Check permissions
  if (!membership.permissions.can_edit_sections) {
    throw new Error('Forbidden: Missing permission');
  }

  // 4. NOW update (with org_id filter for safety)
  await supabase
    .from('documents')
    .update(updates)
    .eq('id', docId)
    .eq('organization_id', doc.organization_id);
}

// ❌ WRONG - NO VALIDATION!
async function updateDocument(userId, docId, updates) {
  await supabase
    .from('documents')
    .update(updates)
    .eq('id', docId);
  // User could update ANY org's documents!
}
```

---

## 📋 Code Review Checklist

### For Every Database Query:

#### SELECT Queries
- [ ] Includes `.eq('organization_id', ...)` filter
- [ ] Filter uses verified user's organization_id (not from request)
- [ ] No hardcoded organization IDs
- [ ] Joins to related tables maintain org context

#### INSERT Queries
- [ ] Sets `organization_id` explicitly
- [ ] Value comes from verified user's org (not client input)
- [ ] User has permission to create in this org
- [ ] Related records also have correct org_id

#### UPDATE Queries
- [ ] Filters by `organization_id` AND record ID
- [ ] Validates user membership in org BEFORE update
- [ ] Checks user permissions for this action
- [ ] Cannot change `organization_id` (use validation)

#### DELETE Queries
- [ ] Filters by `organization_id` AND record ID
- [ ] Validates user has delete permission
- [ ] Checks for dependent records
- [ ] Considers soft-delete vs hard-delete

---

## 🔍 Common Vulnerability Patterns

### Pattern 1: Missing Organization Filter
```javascript
// ❌ VULNERABLE: Returns ALL orgs' documents
const allDocs = await supabase.from('documents').select('*');

// ✅ FIXED: Returns only user's org documents
const myDocs = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', userOrgId);
```

### Pattern 2: Client-Supplied Organization ID
```javascript
// ❌ VULNERABLE: Client controls org_id
app.get('/api/documents', async (req, res) => {
  const { organization_id } = req.query; // From client!
  const docs = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', organization_id);
  // Attacker can access ANY org!
});

// ✅ FIXED: Server determines org_id from session
app.get('/api/documents', async (req, res) => {
  const userId = req.user.id; // From authenticated session

  // Get user's org from trusted source
  const { data: membership } = await supabase
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', userId)
    .single();

  const docs = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', membership.organization_id);
});
```

### Pattern 3: Insufficient Permission Checks
```javascript
// ❌ VULNERABLE: No permission validation
async function approveSection(userId, sectionId) {
  await supabase
    .from('section_workflow_states')
    .update({ status: 'approved' })
    .eq('section_id', sectionId);
  // Any user can approve any section!
}

// ✅ FIXED: Check role and permissions
async function approveSection(userId, sectionId) {
  // 1. Get section's document and org
  const { data: section } = await supabase
    .from('document_sections')
    .select('document_id, documents!inner(organization_id)')
    .eq('id', sectionId)
    .single();

  // 2. Get user's membership and role
  const { data: membership } = await supabase
    .from('user_organizations')
    .select('role, permissions')
    .eq('user_id', userId)
    .eq('organization_id', section.documents.organization_id)
    .single();

  if (!membership) {
    throw new Error('Not member of this organization');
  }

  // 3. Check if user can approve (role-based)
  const canApprove = ['admin', 'committee_chair'].includes(membership.role);
  if (!canApprove) {
    throw new Error('Insufficient permissions to approve');
  }

  // 4. NOW approve
  await supabase
    .from('section_workflow_states')
    .update({
      status: 'approved',
      actioned_by: userId,
      actioned_at: new Date().toISOString()
    })
    .eq('section_id', sectionId);
}
```

### Pattern 4: Cascade Bypass
```javascript
// ❌ VULNERABLE: Child records from different org
async function createDocument(userId, data) {
  const { data: doc } = await supabase
    .from('documents')
    .insert({ ...data, organization_id: userOrgId })
    .select()
    .single();

  // BUG: section_ids could reference OTHER org's sections!
  await supabase
    .from('document_sections')
    .insert(
      data.section_ids.map(id => ({
        document_id: doc.id,
        section_id: id  // NOT VALIDATED!
      }))
    );
}

// ✅ FIXED: Validate child records belong to same org
async function createDocument(userId, data) {
  const { data: doc } = await supabase
    .from('documents')
    .insert({ ...data, organization_id: userOrgId })
    .select()
    .single();

  // Validate sections belong to this org
  const { data: validSections } = await supabase
    .from('document_sections')
    .select('id')
    .in('id', data.section_ids)
    .eq('documents.organization_id', userOrgId); // Check via join!

  if (validSections.length !== data.section_ids.length) {
    throw new Error('Invalid section IDs for this organization');
  }

  await supabase
    .from('document_sections')
    .insert(
      validSections.map(s => ({
        document_id: doc.id,
        section_id: s.id
      }))
    );
}
```

---

## 🛡️ Defense-in-Depth Layers

### Layer 1: Database (RLS)
- Enabled on all tables
- Policies allow anon access (app enforces)
- Purpose: Fail-safe against coding errors

### Layer 2: Helper Functions
```javascript
// Use these reusable security checks
async function getUserOrganization(userId) {
  const { data } = await supabase
    .from('user_organizations')
    .select('organization_id, role, permissions')
    .eq('user_id', userId)
    .single();
  return data;
}

async function validateOrgMembership(userId, organizationId) {
  const { data } = await supabase
    .from('user_organizations')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (!data) {
    throw new Error('User not member of organization');
  }
  return true;
}

async function checkPermission(userId, organizationId, permission) {
  const { data } = await supabase
    .from('user_organizations')
    .select('permissions')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  return data?.permissions?.[permission] === true;
}
```

### Layer 3: Middleware
```javascript
// Express middleware for org context
async function requireOrgMembership(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data } = await supabase
    .from('user_organizations')
    .select('organization_id, role, permissions')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return res.status(403).json({ error: 'Not member of any organization' });
  }

  // Attach to request for downstream use
  req.organizationId = data.organization_id;
  req.userRole = data.role;
  req.userPermissions = data.permissions;

  next();
}

// Usage
app.get('/api/documents', requireOrgMembership, async (req, res) => {
  const docs = await supabase
    .from('documents')
    .select('*')
    .eq('organization_id', req.organizationId); // Guaranteed safe!
  res.json(docs);
});
```

### Layer 4: Integration Tests
```javascript
describe('Multi-tenant isolation', () => {
  let orgA, orgB, userA, userB;

  beforeEach(async () => {
    // Create two separate organizations
    orgA = await createOrg('Organization A');
    orgB = await createOrg('Organization B');

    userA = await createUser('user-a@example.com', orgA.id);
    userB = await createUser('user-b@example.com', orgB.id);
  });

  it('User A cannot read Org B documents', async () => {
    const docB = await createDocument(userB.id, orgB.id, 'Secret Doc');

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docB.id)
      .eq('organization_id', orgA.id); // User A's org

    expect(data).toHaveLength(0);
  });

  it('User A cannot update Org B documents', async () => {
    const docB = await createDocument(userB.id, orgB.id, 'Original');

    const result = await updateDocument(userA.id, docB.id, {
      title: 'Hacked!'
    });

    expect(result.error).toBeTruthy();

    // Verify unchanged
    const { data } = await supabase
      .from('documents')
      .select('title')
      .eq('id', docB.id)
      .single();
    expect(data.title).toBe('Original');
  });

  it('User A cannot delete Org B documents', async () => {
    const docB = await createDocument(userB.id, orgB.id, 'Protected');

    const result = await deleteDocument(userA.id, docB.id);

    expect(result.error).toBeTruthy();

    // Verify still exists
    const { data } = await supabase
      .from('documents')
      .select('id')
      .eq('id', docB.id)
      .single();
    expect(data).toBeTruthy();
  });
});
```

---

## 🚀 Quick Validation Script

Run this before each deployment:

```bash
#!/bin/bash
# validate-security.sh

echo "🔍 Checking for security vulnerabilities..."

# Check for missing organization_id filters
echo "Checking for missing organization_id filters..."
grep -r "\.from(" src/ | grep -v "\.eq('organization_id'" && echo "⚠️  Found queries without org filter!" || echo "✅ All queries have org filters"

# Check for client-supplied org_id
echo "Checking for client-supplied organization_id..."
grep -r "req\.(query|body|params)\.organization_id" src/ && echo "⚠️  Found client-supplied org_id!" || echo "✅ No client-supplied org_id"

# Run integration tests
echo "Running multi-tenant isolation tests..."
npm run test:integration

echo "✅ Security validation complete!"
```

---

## 📊 Monitoring and Audit

### Metrics to Track:
- Failed authorization attempts (log to monitoring)
- Cross-org access attempts (should be zero)
- Permission escalation attempts
- Unusual query patterns

### Audit Log Example:
```javascript
async function auditLog(action, userId, resourceType, resourceId, organizationId, success) {
  await supabase.from('audit_log').insert({
    action,
    user_id: userId,
    resource_type: resourceType,
    resource_id: resourceId,
    organization_id: organizationId,
    success,
    timestamp: new Date().toISOString(),
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  });
}

// Usage
try {
  await updateDocument(userId, docId, updates);
  await auditLog('update_document', userId, 'document', docId, orgId, true);
} catch (error) {
  await auditLog('update_document', userId, 'document', docId, orgId, false);
  throw error;
}
```

---

## 🎯 Summary: The Golden Rules

1. **EVERY query filters by organization_id** (SELECT/UPDATE/DELETE)
2. **EVERY insert sets organization_id** explicitly
3. **VALIDATE membership** before write operations
4. **CHECK permissions** before privileged actions
5. **NEVER trust client** for organization_id
6. **USE helper functions** for repeated checks
7. **TEST isolation** between organizations
8. **AUDIT everything** for security review

---

**Questions?** Contact: Database Security Team
**Last Updated:** 2025-10-12
**Next Review:** 2025-11-12
