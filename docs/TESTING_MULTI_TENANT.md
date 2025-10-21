# Multi-Tenant Isolation Testing Guide

**Purpose:** Validate that organizations cannot access each other's data

**When to Run:** Before every deployment, after database schema changes

---

## 🎯 Test Objectives

1. **Data Isolation**: Verify Org A cannot read/write Org B's data
2. **Permission Boundaries**: Test role-based access controls
3. **Setup Wizard**: Ensure first-time setup works correctly
4. **Performance**: Validate queries are efficient with 99+ organizations

---

## 🧪 Test Suite Structure

### Test Categories:

1. **Unit Tests**: Individual security functions
2. **Integration Tests**: Multi-org scenarios
3. **End-to-End Tests**: Full user workflows
4. **Performance Tests**: Query efficiency at scale

---

## 📋 Test Scenarios

### Scenario 1: Basic Data Isolation

```javascript
describe('Multi-tenant data isolation', () => {
  let orgA, orgB, userA, userB, docA, docB;

  beforeEach(async () => {
    // Setup: Create two independent organizations
    orgA = await createOrganization({
      name: 'Los Angeles NC',
      slug: 'la-nc'
    });

    orgB = await createOrganization({
      name: 'Reseda NC',
      slug: 'reseda-nc'
    });

    // Create users in each org
    userA = await createUser({
      email: 'admin@la-nc.org',
      name: 'LA Admin',
      organization_id: orgA.id,
      role: 'admin'
    });

    userB = await createUser({
      email: 'admin@reseda-nc.org',
      name: 'Reseda Admin',
      organization_id: orgB.id,
      role: 'admin'
    });

    // Create documents in each org
    docA = await createDocument({
      title: 'LA Bylaws',
      organization_id: orgA.id
    });

    docB = await createDocument({
      title: 'Reseda Bylaws',
      organization_id: orgB.id
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  test('User A can read their own org documents', async () => {
    const result = await getDocuments(userA.id);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(docA.id);
    expect(result.data[0].title).toBe('LA Bylaws');
  });

  test('User A CANNOT read Org B documents', async () => {
    const result = await getDocuments(userA.id);

    expect(result.data).not.toContainEqual(
      expect.objectContaining({ id: docB.id })
    );
  });

  test('User A CANNOT update Org B documents', async () => {
    const result = await updateDocument(userA.id, docB.id, {
      title: 'Hacked!'
    });

    expect(result.error).toBeTruthy();
    expect(result.error.message).toContain('Unauthorized');

    // Verify doc unchanged
    const { data: unchanged } = await supabase
      .from('documents')
      .select('title')
      .eq('id', docB.id)
      .single();

    expect(unchanged.title).toBe('Reseda Bylaws');
  });

  test('User A CANNOT delete Org B documents', async () => {
    const result = await deleteDocument(userA.id, docB.id);

    expect(result.error).toBeTruthy();

    // Verify doc still exists
    const { data: exists } = await supabase
      .from('documents')
      .select('id')
      .eq('id', docB.id)
      .single();

    expect(exists).toBeTruthy();
  });

  test('Direct database query without org filter FAILS', async () => {
    // Simulate developer forgetting org_id filter
    const { data, error } = await supabase
      .from('documents')
      .select('*');

    // With RLS enabled, this should work but return ALL docs
    // Application MUST filter by org_id
    expect(data.length).toBeGreaterThanOrEqual(2);

    // This test demonstrates WHY we need application filtering
    const orgA_docs = data.filter(d => d.organization_id === orgA.id);
    const orgB_docs = data.filter(d => d.organization_id === orgB.id);

    expect(orgA_docs).not.toEqual(orgB_docs);
  });
});
```

---

### Scenario 2: Permission Boundaries

```javascript
describe('Permission-based access control', () => {
  let org, adminUser, memberUser, viewerUser, document;

  beforeEach(async () => {
    org = await createOrganization({ name: 'Test Org' });

    adminUser = await createUser({
      email: 'admin@test.org',
      organization_id: org.id,
      role: 'admin',
      permissions: {
        can_edit_sections: true,
        can_create_suggestions: true,
        can_vote: true,
        can_approve_stages: ['committee', 'board'],
        can_manage_users: true,
        can_manage_workflows: true
      }
    });

    memberUser = await createUser({
      email: 'member@test.org',
      organization_id: org.id,
      role: 'member',
      permissions: {
        can_edit_sections: true,
        can_create_suggestions: true,
        can_vote: true,
        can_approve_stages: [],
        can_manage_users: false,
        can_manage_workflows: false
      }
    });

    viewerUser = await createUser({
      email: 'viewer@test.org',
      organization_id: org.id,
      role: 'viewer',
      permissions: {
        can_edit_sections: false,
        can_create_suggestions: true,
        can_vote: true,
        can_approve_stages: [],
        can_manage_users: false,
        can_manage_workflows: false
      }
    });

    document = await createDocument({
      title: 'Test Document',
      organization_id: org.id
    });
  });

  test('Admin can create workflows', async () => {
    const result = await createWorkflow(adminUser.id, {
      name: 'Custom Workflow',
      organization_id: org.id
    });

    expect(result.error).toBeFalsy();
    expect(result.data.name).toBe('Custom Workflow');
  });

  test('Member CANNOT create workflows', async () => {
    const result = await createWorkflow(memberUser.id, {
      name: 'Unauthorized Workflow',
      organization_id: org.id
    });

    expect(result.error).toBeTruthy();
    expect(result.error.message).toContain('Insufficient permissions');
  });

  test('Member can edit sections', async () => {
    const section = await createSection({
      document_id: document.id,
      section_title: 'Test Section'
    });

    const result = await updateSection(memberUser.id, section.id, {
      current_text: 'Updated text'
    });

    expect(result.error).toBeFalsy();
  });

  test('Viewer CANNOT edit sections', async () => {
    const section = await createSection({
      document_id: document.id,
      section_title: 'Test Section'
    });

    const result = await updateSection(viewerUser.id, section.id, {
      current_text: 'Hacked text'
    });

    expect(result.error).toBeTruthy();
    expect(result.error.message).toContain('can_edit_sections');
  });

  test('All users can create suggestions', async () => {
    const section = await createSection({
      document_id: document.id
    });

    const adminSuggestion = await createSuggestion(adminUser.id, {
      document_id: document.id,
      section_id: section.id,
      suggested_text: 'Admin suggestion'
    });

    const memberSuggestion = await createSuggestion(memberUser.id, {
      document_id: document.id,
      section_id: section.id,
      suggested_text: 'Member suggestion'
    });

    const viewerSuggestion = await createSuggestion(viewerUser.id, {
      document_id: document.id,
      section_id: section.id,
      suggested_text: 'Viewer suggestion'
    });

    expect(adminSuggestion.error).toBeFalsy();
    expect(memberSuggestion.error).toBeFalsy();
    expect(viewerSuggestion.error).toBeFalsy();
  });
});
```

---

### Scenario 3: Setup Wizard

```javascript
describe('Setup wizard flow', () => {
  test('Anonymous user can create first organization', async () => {
    // Simulate setup wizard (no authenticated user yet)
    const result = await supabase
      .from('organizations')
      .insert({
        name: 'New Neighborhood Council',
        slug: 'new-nc',
        hierarchy_config: {
          levels: [
            { name: 'Article', type: 'article', numbering: 'roman', depth: 0 },
            { name: 'Section', type: 'section', numbering: 'numeric', depth: 1 }
          ],
          maxDepth: 5
        }
      })
      .select()
      .single();

    expect(result.error).toBeFalsy();
    expect(result.data.name).toBe('New Neighborhood Council');
  });

  test('Setup wizard can create first user', async () => {
    const org = await createOrganization({ name: 'Test Org' });

    const result = await supabase
      .from('users')
      .insert({
        email: 'admin@test.org',
        name: 'Admin User'
      })
      .select()
      .single();

    expect(result.error).toBeFalsy();
  });

  test('Setup wizard can create user-org membership', async () => {
    const org = await createOrganization({ name: 'Test Org' });
    const user = await createUser({ email: 'admin@test.org' });

    const result = await supabase
      .from('user_organizations')
      .insert({
        user_id: user.id,
        organization_id: org.id,
        role: 'owner',
        permissions: {
          can_edit_sections: true,
          can_create_suggestions: true,
          can_vote: true,
          can_approve_stages: ['committee', 'board'],
          can_manage_users: true,
          can_manage_workflows: true
        }
      })
      .select()
      .single();

    expect(result.error).toBeFalsy();
    expect(result.data.role).toBe('owner');
  });

  test('Setup wizard can import initial document', async () => {
    const org = await createOrganization({ name: 'Test Org' });
    const user = await createUser({
      email: 'admin@test.org',
      organization_id: org.id
    });

    const result = await supabase
      .from('documents')
      .insert({
        title: 'Bylaws',
        organization_id: org.id,
        document_type: 'bylaws',
        status: 'draft'
      })
      .select()
      .single();

    expect(result.error).toBeFalsy();
    expect(result.data.organization_id).toBe(org.id);
  });
});
```

---

### Scenario 4: Cross-Org Joins (Security)

```javascript
describe('Cross-organization join attempts', () => {
  let orgA, orgB, docA, docB, sectionA, sectionB;

  beforeEach(async () => {
    orgA = await createOrganization({ name: 'Org A' });
    orgB = await createOrganization({ name: 'Org B' });

    docA = await createDocument({
      title: 'Doc A',
      organization_id: orgA.id
    });

    docB = await createDocument({
      title: 'Doc B',
      organization_id: orgB.id
    });

    sectionA = await createSection({
      document_id: docA.id,
      section_title: 'Section A'
    });

    sectionB = await createSection({
      document_id: docB.id,
      section_title: 'Section B'
    });
  });

  test('Cannot create suggestion linking Org A section to Org B document', async () => {
    const result = await supabase
      .from('suggestions')
      .insert({
        document_id: docB.id, // Org B document
        suggested_text: 'Cross-org hack'
      })
      .select()
      .single();

    if (result.error) {
      // Good! Validation caught it
      expect(result.error).toBeTruthy();
    } else {
      // If insert succeeded, ensure section linkage fails
      const linkResult = await supabase
        .from('suggestion_sections')
        .insert({
          suggestion_id: result.data.id,
          section_id: sectionA.id // Org A section!
        });

      expect(linkResult.error).toBeTruthy();
    }
  });

  test('Cannot move section from Org A doc to Org B doc', async () => {
    const result = await supabase
      .from('document_sections')
      .update({
        document_id: docB.id // Try to move to Org B
      })
      .eq('id', sectionA.id);

    // Trigger should prevent this
    expect(result.error).toBeTruthy();
  });
});
```

---

### Scenario 5: Performance at Scale

```javascript
describe('Performance with 99 organizations', () => {
  let organizations = [];

  beforeAll(async () => {
    // Create 99 orgs with documents
    for (let i = 1; i <= 99; i++) {
      const org = await createOrganization({
        name: `NC ${i}`,
        slug: `nc-${i}`
      });

      await createDocument({
        title: `Bylaws ${i}`,
        organization_id: org.id
      });

      organizations.push(org);
    }
  }, 30000); // 30 second timeout

  test('Query single org documents is fast', async () => {
    const targetOrg = organizations[50]; // Middle org

    const startTime = Date.now();
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', targetOrg.id);
    const endTime = Date.now();

    expect(data).toHaveLength(1);
    expect(endTime - startTime).toBeLessThan(100); // < 100ms
  });

  test('Query ALL orgs documents is acceptable', async () => {
    const startTime = Date.now();
    const { data } = await supabase
      .from('documents')
      .select('*');
    const endTime = Date.now();

    expect(data.length).toBeGreaterThanOrEqual(99);
    expect(endTime - startTime).toBeLessThan(500); // < 500ms
  });

  test('Complex join across org is efficient', async () => {
    const targetOrg = organizations[50];

    const startTime = Date.now();
    const { data } = await supabase
      .from('document_sections')
      .select(`
        *,
        documents!inner(
          title,
          organization_id
        ),
        suggestions(*)
      `)
      .eq('documents.organization_id', targetOrg.id);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(200); // < 200ms
  });
});
```

---

## 🔧 Test Utilities

```javascript
// test/utils/test-helpers.js

async function createOrganization(data) {
  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name: data.name,
      slug: data.slug,
      hierarchy_config: data.hierarchy_config || {
        levels: [
          { name: 'Article', type: 'article', numbering: 'roman', depth: 0 },
          { name: 'Section', type: 'section', numbering: 'numeric', depth: 1 }
        ],
        maxDepth: 5
      }
    })
    .select()
    .single();

  if (error) throw error;
  return org;
}

async function createUser(data) {
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: data.email,
      name: data.name || 'Test User'
    })
    .select()
    .single();

  if (error) throw error;

  // Create org membership if specified
  if (data.organization_id) {
    await supabase
      .from('user_organizations')
      .insert({
        user_id: user.id,
        organization_id: data.organization_id,
        role: data.role || 'member',
        permissions: data.permissions || {
          can_edit_sections: true,
          can_create_suggestions: true,
          can_vote: true
        }
      });
  }

  return user;
}

async function createDocument(data) {
  const { data: doc, error } = await supabase
    .from('documents')
    .insert({
      title: data.title,
      organization_id: data.organization_id,
      document_type: data.document_type || 'bylaws',
      status: data.status || 'draft'
    })
    .select()
    .single();

  if (error) throw error;
  return doc;
}

async function createSection(data) {
  const { data: section, error } = await supabase
    .from('document_sections')
    .insert({
      document_id: data.document_id,
      parent_section_id: data.parent_section_id || null,
      ordinal: data.ordinal || 1,
      section_title: data.section_title || 'Test Section',
      section_number: data.section_number || '1',
      original_text: data.original_text || '',
      current_text: data.current_text || ''
    })
    .select()
    .single();

  if (error) throw error;
  return section;
}

async function cleanupTestData() {
  // Delete in correct order (respect foreign keys)
  await supabase.from('suggestion_votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('suggestion_sections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('suggestions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('section_workflow_states').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('document_sections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('document_workflows').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('workflow_stages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('workflow_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('user_organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

module.exports = {
  createOrganization,
  createUser,
  createDocument,
  createSection,
  cleanupTestData
};
```

---

## 🚀 Running Tests

```bash
# Run all multi-tenant tests
npm run test:multi-tenant

# Run specific test suite
npm test -- --testNamePattern="Multi-tenant data isolation"

# Run with coverage
npm run test:coverage

# Run performance tests
npm run test:performance
```

---

## ✅ Success Criteria

### All tests must pass:
- [ ] Data isolation between organizations
- [ ] Permission boundaries respected
- [ ] Setup wizard works
- [ ] Cross-org joins prevented
- [ ] Performance acceptable at scale (99+ orgs)

### Manual verification:
- [ ] Try accessing another org's data via UI
- [ ] Test with real-world data volumes
- [ ] Verify audit logs capture security events
- [ ] Performance profiling shows no N+1 queries

---

**Last Updated:** 2025-10-12
**Test Coverage Target:** 95%
**Next Review:** 2025-11-12
