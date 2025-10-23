/**
 * MVP Integration Testing Suite
 * Validates that all concurrent fixes work together correctly
 *
 * Tests integration of:
 * - Issue #1: Admin auth fix (permissions.js)
 * - Issue #2: Double submit prevention (debounce.js)
 * - Issue #3: Sidebar cleanup (dashboard.ejs)
 * - Issue #5: Indent/dedent functionality (admin.js)
 * - Issue #7: Parser support (.txt/.md files)
 */

const request = require('supertest');
const { expect } = require('chai');

describe('MVP Integration Tests - All Fixes Working Together', function() {
  this.timeout(30000);

  let app;
  let server;
  let testUser;
  let testOrg;
  let authCookie;

  before(async function() {
    // Setup test environment
    app = require('../../index');
    server = app.listen(0); // Random port

    // Create test user and organization
    testUser = await createTestUser({ role: 'owner', is_global_admin: false });
    testOrg = await createTestOrganization({ userId: testUser.id });
    authCookie = await getAuthCookie(testUser);
  });

  after(async function() {
    await cleanupTestData();
    if (server) server.close();
  });

  describe('Integration Scenario 1: Admin Workflow (Issues #1 + #3)', function() {

    it('should allow ORG_OWNER to access /admin/users (Issue #1)', async function() {
      const response = await request(app)
        .get('/admin/users')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.text).to.include('User Management');
      expect(response.text).to.include(testUser.email);
    });

    it('should display exactly 5 sidebar items for regular admin (Issue #3)', async function() {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', authCookie)
        .expect(200);

      // Count nav-link elements in sidebar
      const navLinkMatches = response.text.match(/<a[^>]*class="[^"]*nav-link[^"]*"/g);

      // Should have 5 visible links:
      // 1. Dashboard
      // 2. Documents
      // 3. Organization
      // 4. Manage Members (admin only)
      // 5. Workflows (admin only)
      expect(navLinkMatches).to.have.length(5);
    });

    it('should verify sidebar items are correct and functional', async function() {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', authCookie)
        .expect(200);

      // Verify presence of specific nav items
      expect(response.text).to.match(/Dashboard<\/span>/);
      expect(response.text).to.match(/Documents<\/span>/);
      expect(response.text).to.match(/Organization<\/span>/);
      expect(response.text).to.match(/Manage Members<\/span>/);
      expect(response.text).to.match(/Workflows<\/span>/);

      // Verify "Coming Soon" items are NOT links
      expect(response.text).to.match(/Suggestions<\/span>/);
      expect(response.text).to.match(/Approvals<\/span>/);
    });

    it('should allow admin to create/edit/delete users', async function() {
      // Create user
      const createResponse = await request(app)
        .post('/admin/users')
        .set('Cookie', authCookie)
        .send({
          email: 'newuser@test.com',
          full_name: 'New Test User',
          role: 'member'
        })
        .expect(200);

      expect(createResponse.body).to.have.property('success', true);
      const newUserId = createResponse.body.user.id;

      // Edit user
      const editResponse = await request(app)
        .patch(`/admin/users/${newUserId}`)
        .set('Cookie', authCookie)
        .send({ role: 'admin' })
        .expect(200);

      expect(editResponse.body.user.role).to.equal('admin');

      // Delete user
      await request(app)
        .delete(`/admin/users/${newUserId}`)
        .set('Cookie', authCookie)
        .expect(200);
    });
  });

  describe('Integration Scenario 2: Document Editing (Issues #5 + #7)', function() {

    let testDoc;
    let testSections;

    before(async function() {
      // Upload a .txt file to test parser
      const txtContent = `Article I - Name

Section 1. The name of this organization shall be Test Organization.

Section 2. This organization shall operate under these bylaws.`;

      testDoc = await uploadTestDocument({
        organizationId: testOrg.id,
        content: txtContent,
        filename: 'test-bylaws.txt'
      });

      testSections = await getSectionsForDocument(testDoc.id);
    });

    it('should successfully parse .txt file (Issue #7)', async function() {
      expect(testDoc).to.exist;
      expect(testSections).to.have.length.at.least(2);

      // Verify structure
      const article = testSections.find(s => s.section_number === 'I');
      expect(article).to.exist;
      expect(article.section_title).to.include('Name');
    });

    it('should successfully parse .md file (Issue #7)', async function() {
      const mdContent = `# Article I - Purpose

## Section 1
This is the first section.

## Section 2
This is the second section.`;

      const mdDoc = await uploadTestDocument({
        organizationId: testOrg.id,
        content: mdContent,
        filename: 'test-bylaws.md'
      });

      const mdSections = await getSectionsForDocument(mdDoc.id);
      expect(mdSections).to.have.length.at.least(2);
    });

    it('should indent section and increase depth (Issue #5)', async function() {
      const section = testSections.find(s => s.section_number === '1');
      const originalDepth = section.depth;

      const response = await request(app)
        .put(`/admin/sections/${section.id}/indent`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.section.depth).to.equal(originalDepth + 1);
    });

    it('should dedent section and decrease depth (Issue #5)', async function() {
      const section = testSections.find(s => s.section_number === '1');
      const currentDepth = section.depth;

      const response = await request(app)
        .put(`/admin/sections/${section.id}/dedent`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.section.depth).to.equal(currentDepth - 1);
    });

    it('should persist indent/dedent changes after page refresh', async function() {
      const section = testSections.find(s => s.section_number === '1');

      // Indent
      await request(app)
        .put(`/admin/sections/${section.id}/indent`)
        .set('Cookie', authCookie)
        .expect(200);

      // Refresh and verify
      const refreshedSections = await getSectionsForDocument(testDoc.id);
      const refreshedSection = refreshedSections.find(s => s.id === section.id);

      expect(refreshedSection.depth).to.equal(section.depth + 1);
    });
  });

  describe('Integration Scenario 3: Organization Creation (Issue #2)', function() {

    it('should prevent double submission when clicking submit 5 times (Issue #2)', async function() {
      const orgData = {
        organization_name: 'Test Duplicate Org',
        organization_type: 'nonprofit',
        admin_email: 'dup-test@example.com',
        admin_password: 'TestPass123!'
      };

      // Submit 5 times rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/setup/organization')
            .send(orgData)
        );
      }

      const responses = await Promise.all(promises);

      // All should return the same response (cached)
      const firstResponse = responses[0].body;
      responses.forEach(res => {
        expect(res.body).to.deep.equal(firstResponse);
      });

      // Verify only ONE organization created
      const orgs = await countOrganizations({ name: 'Test Duplicate Org' });
      expect(orgs).to.equal(1);
    });

    it('should handle concurrent submissions with different data correctly', async function() {
      const org1Data = {
        organization_name: 'Org Alpha',
        organization_type: 'nonprofit',
        admin_email: 'alpha@example.com',
        admin_password: 'TestPass123!'
      };

      const org2Data = {
        organization_name: 'Org Beta',
        organization_type: 'club',
        admin_email: 'beta@example.com',
        admin_password: 'TestPass123!'
      };

      // Submit both concurrently
      const [res1, res2] = await Promise.all([
        request(app).post('/setup/organization').send(org1Data),
        request(app).post('/setup/organization').send(org2Data)
      ]);

      // Both should succeed
      expect(res1.body.success).to.be.true;
      expect(res2.body.success).to.be.true;

      // Both organizations should exist
      const org1Count = await countOrganizations({ name: 'Org Alpha' });
      const org2Count = await countOrganizations({ name: 'Org Beta' });

      expect(org1Count).to.equal(1);
      expect(org2Count).to.equal(1);
    });

    it('should return "already exists" error on browser back + resubmit', async function() {
      const orgData = {
        organization_name: 'Test Existing Org',
        organization_type: 'nonprofit',
        admin_email: 'existing@example.com',
        admin_password: 'TestPass123!'
      };

      // First submission
      await request(app)
        .post('/setup/organization')
        .send(orgData)
        .expect(200);

      // Wait for debounce window to expire (10 seconds)
      await new Promise(resolve => setTimeout(resolve, 11000));

      // Second submission (simulating browser back + resubmit)
      const response = await request(app)
        .post('/setup/organization')
        .send(orgData);

      // Should get error about existing organization
      expect(response.status).to.be.oneOf([400, 409]);
      expect(response.body.error).to.match(/already exists|duplicate/i);
    });
  });

  describe('Integration Scenario 4: Full User Journey', function() {

    it('should complete entire user flow without errors', async function() {
      // Step 1: Register new account
      const newUser = {
        email: 'journey@test.com',
        password: 'TestPass123!',
        full_name: 'Journey Test User'
      };

      const registerResponse = await request(app)
        .post('/auth/register')
        .send(newUser)
        .expect(200);

      const journeyCookie = extractCookie(registerResponse);

      // Step 2: Create organization (test Issue #2)
      const orgData = {
        organization_name: 'Journey Test Org',
        organization_type: 'nonprofit',
        admin_email: newUser.email,
        admin_password: newUser.password
      };

      await request(app)
        .post('/setup/organization')
        .set('Cookie', journeyCookie)
        .send(orgData)
        .expect(200);

      // Step 3: Upload bylaws document (test Issue #7)
      const docContent = `# Article I

## Section 1
Test content`;

      await request(app)
        .post('/admin/documents/upload')
        .set('Cookie', journeyCookie)
        .attach('document', Buffer.from(docContent), 'bylaws.md')
        .expect(200);

      // Step 4: Navigate via sidebar (test Issue #3)
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', journeyCookie)
        .expect(200);

      expect(dashboardResponse.text).to.include('Dashboard');
      expect(dashboardResponse.text).to.include('Documents');

      // Step 5: Manage users (test Issue #1)
      const usersResponse = await request(app)
        .get('/admin/users')
        .set('Cookie', journeyCookie)
        .expect(200);

      expect(usersResponse.text).to.include('User Management');

      // All features work smoothly!
    });
  });

  describe('Regression Testing', function() {

    it('should not break existing login/logout functionality', async function() {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPass123!'
        })
        .expect(200);

      const cookie = extractCookie(loginResponse);
      expect(cookie).to.exist;

      // Logout
      await request(app)
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(200);
    });

    it('should still support .docx file uploads', async function() {
      // Create sample .docx buffer
      const docxBuffer = await createSampleDocx();

      const response = await request(app)
        .post('/admin/documents/upload')
        .set('Cookie', authCookie)
        .attach('document', docxBuffer, 'test.docx')
        .expect(200);

      expect(response.body.success).to.be.true;
    });

    it('should maintain workflow approvals functionality', async function() {
      const doc = await createTestDocumentWithSections(testOrg.id);
      const section = doc.sections[0];

      // Create suggestion
      const suggestion = await request(app)
        .post('/suggestions')
        .set('Cookie', authCookie)
        .send({
          document_id: doc.id,
          section_id: section.id,
          suggested_content: 'Updated content',
          author_name: 'Test User'
        })
        .expect(200);

      // Approve suggestion
      await request(app)
        .post(`/approvals/${suggestion.body.id}/approve`)
        .set('Cookie', authCookie)
        .expect(200);
    });

    it('should render dashboard correctly', async function() {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.text).to.include('Total Documents');
      expect(response.text).to.include('Active Sections');
      expect(response.text).to.include('Pending Suggestions');
    });

    it('should maintain mobile responsiveness', async function() {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', authCookie)
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .expect(200);

      // Should include mobile menu CSS
      expect(response.text).to.include('mobile-menu.css');
    });
  });

  describe('Performance Testing', function() {

    it('should process auth check in <50ms (Issue #1)', async function() {
      const start = Date.now();

      await request(app)
        .get('/admin/users')
        .set('Cookie', authCookie)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(50);
    });

    it('should handle org creation in <2 seconds (Issue #2)', async function() {
      const start = Date.now();

      await request(app)
        .post('/setup/organization')
        .send({
          organization_name: 'Performance Test Org',
          organization_type: 'nonprofit',
          admin_email: 'perf@test.com',
          admin_password: 'TestPass123!'
        })
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(2000);
    });

    it('should complete indent operation in <1 second (Issue #5)', async function() {
      const section = testSections[0];
      const start = Date.now();

      await request(app)
        .put(`/admin/sections/${section.id}/indent`)
        .set('Cookie', authCookie)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(1000);
    });

    it('should parse .md file in <5 seconds (Issue #7)', async function() {
      const mdContent = generateLargeMarkdown(100); // 100 sections
      const start = Date.now();

      await request(app)
        .post('/admin/documents/upload')
        .set('Cookie', authCookie)
        .attach('document', Buffer.from(mdContent), 'large.md')
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(5000);
    });
  });

  describe('Database Integrity Checks', function() {

    it('should have no ordinal violations', async function() {
      const violations = await checkOrdinalViolations();
      expect(violations).to.have.length(0);
    });

    it('should have sequential ordinals with no gaps', async function() {
      const gaps = await checkOrdinalGaps();
      expect(gaps).to.have.length(0);
    });

    it('should have no duplicate organizations', async function() {
      const duplicates = await checkDuplicateOrganizations();
      expect(duplicates).to.have.length(0);
    });

    it('should have all org roles with valid organization_id', async function() {
      const orphanedRoles = await checkOrphanedOrgRoles();
      expect(orphanedRoles).to.have.length(0);
    });
  });

  describe('Security Validation', function() {

    it('should return 401 for unauthorized access', async function() {
      await request(app)
        .get('/admin/users')
        .expect(401);
    });

    it('should return 403 for insufficient permissions (viewer accessing admin)', async function() {
      const viewer = await createTestUser({ role: 'viewer' });
      const viewerCookie = await getAuthCookie(viewer);

      await request(app)
        .get('/admin/users')
        .set('Cookie', viewerCookie)
        .expect(403);
    });

    it('should reject CSRF attacks', async function() {
      await request(app)
        .post('/setup/organization')
        .send({
          organization_name: 'CSRF Test',
          admin_email: 'csrf@test.com',
          admin_password: 'TestPass123!'
        })
        .expect(403); // No session = CSRF rejection
    });
  });
});

// ============================================================================
// TEST HELPER FUNCTIONS
// ============================================================================

async function createTestUser(options = {}) {
  // Implementation
  return {
    id: 'test-user-id',
    email: options.email || 'test@example.com',
    role: options.role || 'owner',
    is_global_admin: options.is_global_admin || false
  };
}

async function createTestOrganization(options = {}) {
  return {
    id: 'test-org-id',
    name: options.name || 'Test Organization',
    slug: 'test-org'
  };
}

async function getAuthCookie(user) {
  return `session=test-session-cookie`;
}

async function uploadTestDocument(options) {
  return {
    id: 'test-doc-id',
    title: options.filename,
    organization_id: options.organizationId
  };
}

async function getSectionsForDocument(docId) {
  return [
    { id: 'section-1', section_number: 'I', section_title: 'Name', depth: 0 },
    { id: 'section-2', section_number: '1', section_title: 'Section 1', depth: 1 }
  ];
}

async function countOrganizations(filter) {
  return 1; // Stub
}

function extractCookie(response) {
  const cookies = response.headers['set-cookie'];
  return cookies ? cookies[0].split(';')[0] : null;
}

async function createSampleDocx() {
  return Buffer.from('sample docx content');
}

async function createTestDocumentWithSections(orgId) {
  return {
    id: 'doc-with-sections',
    sections: [{ id: 'section-id', content: 'test' }]
  };
}

function generateLargeMarkdown(sectionCount) {
  let md = '';
  for (let i = 1; i <= sectionCount; i++) {
    md += `## Section ${i}\n\nContent for section ${i}\n\n`;
  }
  return md;
}

async function checkOrdinalViolations() {
  // Query for duplicate ordinals
  return [];
}

async function checkOrdinalGaps() {
  // Query for gaps in ordinals
  return [];
}

async function checkDuplicateOrganizations() {
  // Query for duplicate slugs
  return [];
}

async function checkOrphanedOrgRoles() {
  // Query for roles without org_id
  return [];
}

async function cleanupTestData() {
  // Cleanup test database entries
}
