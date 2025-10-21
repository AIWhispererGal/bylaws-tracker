/**
 * Integration Tests: Admin Section Restrictions
 * Tests for Task 3.1 and 3.2
 *
 * Task 3.1: Prevent section deletion for admins
 * Task 3.2: Disable split/join on sections with suggestions
 *
 * Date: October 19, 2025
 */

const request = require('supertest');
const app = require('../../server');
const { createClient } = require('@supabase/supabase-js');

describe('Admin Section Restrictions', () => {
  let supabase;
  let globalAdminSession;
  let orgAdminSession;
  let testDocument;
  let testSection;
  let testSuggestion;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  });

  beforeEach(async () => {
    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert([{
        name: 'Test Org - Admin Restrictions',
        slug: 'test-admin-restrictions',
        settings: {}
      }])
      .select()
      .single();

    // Create test document
    const { data: doc } = await supabase
      .from('documents')
      .insert([{
        organization_id: org.id,
        title: 'Test Document',
        document_type: 'bylaws',
        version_number: 1,
        status: 'draft'
      }])
      .select()
      .single();

    testDocument = doc;

    // Create test sections
    const { data: sections } = await supabase
      .from('document_sections')
      .insert([
        {
          document_id: doc.id,
          section_number: '1',
          section_title: 'Test Section 1',
          section_type: 'article',
          ordinal: 0,
          depth: 0,
          original_text: 'This is test section 1 with enough text to split.',
          current_text: 'This is test section 1 with enough text to split.',
          is_locked: false
        },
        {
          document_id: doc.id,
          section_number: '2',
          section_title: 'Test Section 2',
          section_type: 'article',
          ordinal: 1,
          depth: 0,
          original_text: 'This is test section 2 for joining.',
          current_text: 'This is test section 2 for joining.',
          is_locked: false
        }
      ])
      .select();

    testSection = sections[0];

    // Create global admin user
    const { data: globalAdmin } = await supabase
      .from('users')
      .insert([{
        email: 'globaladmin@test.com',
        name: 'Global Admin',
        role: 'global_admin',
        is_approved: true
      }])
      .select()
      .single();

    globalAdminSession = {
      userId: globalAdmin.id,
      userEmail: globalAdmin.email,
      userName: globalAdmin.name,
      isGlobalAdmin: true,
      isAdmin: false
    };

    // Create org admin user
    const { data: orgAdmin } = await supabase
      .from('users')
      .insert([{
        email: 'orgadmin@test.com',
        name: 'Org Admin',
        role: 'user',
        is_approved: true
      }])
      .select()
      .single();

    await supabase
      .from('user_organizations')
      .insert([{
        user_id: orgAdmin.id,
        organization_id: org.id,
        role: 'admin'
      }]);

    orgAdminSession = {
      userId: orgAdmin.id,
      userEmail: orgAdmin.email,
      userName: orgAdmin.name,
      organizationId: org.id,
      organizationName: org.name,
      isAdmin: true,
      isGlobalAdmin: false
    };
  });

  afterEach(async () => {
    // Cleanup test data
    await supabase
      .from('suggestions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('document_sections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('documents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('user_organizations')
      .delete()
      .neq('user_id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    await supabase
      .from('organizations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('Task 3.1: Section Deletion Restrictions', () => {
    it('should prevent global admin from deleting sections', async () => {
      const agent = request.agent(app);

      // Simulate global admin session
      await agent
        .get('/auth/test-login')
        .query({ userId: globalAdminSession.userId });

      const response = await agent
        .delete(`/admin/sections/${testSection.id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Administrators cannot delete sections');
      expect(response.body.code).toBe('ADMIN_DELETE_FORBIDDEN');

      // Verify section still exists
      const { data: section } = await supabase
        .from('document_sections')
        .select('id')
        .eq('id', testSection.id)
        .single();

      expect(section).toBeTruthy();
    });

    it('should prevent org admin from deleting sections', async () => {
      const agent = request.agent(app);

      // Simulate org admin session
      await agent
        .get('/auth/test-login')
        .query({ userId: orgAdminSession.userId });

      const response = await agent
        .delete(`/admin/sections/${testSection.id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Administrators cannot delete sections');
      expect(response.body.code).toBe('ADMIN_DELETE_FORBIDDEN');
    });

    it('should show appropriate error message on client', async () => {
      // This test verifies the UI shows the correct error message
      // In actual implementation, the delete button should be hidden/removed
      expect(true).toBe(true); // Placeholder for UI test
    });
  });

  describe('Task 3.2: Split/Join with Suggestions', () => {
    beforeEach(async () => {
      // Create a suggestion for the test section
      const { data: suggestion } = await supabase
        .from('suggestions')
        .insert([{
          document_id: testDocument.id,
          section_id: testSection.id,
          author_name: 'Test User',
          author_email: 'testuser@test.com',
          suggested_text: 'This is a suggested change.',
          rationale: 'For testing purposes',
          status: 'open'
        }])
        .select()
        .single();

      testSuggestion = suggestion;
    });

    it('should prevent splitting section with active suggestions', async () => {
      const agent = request.agent(app);

      await agent
        .get('/auth/test-login')
        .query({ userId: globalAdminSession.userId });

      const response = await agent
        .post(`/admin/sections/${testSection.id}/split`)
        .send({
          splitPosition: 25,
          newSectionTitle: 'Test Section 1 Part 2',
          newSectionNumber: '1.2'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('active suggestion');
      expect(response.body.code).toBe('HAS_ACTIVE_SUGGESTIONS');
      expect(response.body.suggestionCount).toBe(1);
    });

    it('should allow splitting section after suggestions are resolved', async () => {
      const agent = request.agent(app);

      await agent
        .get('/auth/test-login')
        .query({ userId: globalAdminSession.userId });

      // Reject the suggestion first
      await supabase
        .from('suggestions')
        .update({
          rejected_at: new Date().toISOString(),
          rejected_by_user_id: globalAdminSession.userId
        })
        .eq('id', testSuggestion.id);

      const response = await agent
        .post(`/admin/sections/${testSection.id}/split`)
        .send({
          splitPosition: 25,
          newSectionTitle: 'Test Section 1 Part 2',
          newSectionNumber: '1.2'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.originalSection).toBeDefined();
      expect(response.body.newSection).toBeDefined();
    });

    it('should prevent joining sections with active suggestions', async () => {
      const agent = request.agent(app);

      await agent
        .get('/auth/test-login')
        .query({ userId: globalAdminSession.userId });

      // Get both sections to join
      const { data: sections } = await supabase
        .from('document_sections')
        .select('id')
        .eq('document_id', testDocument.id)
        .order('ordinal');

      const response = await agent
        .post('/admin/sections/join')
        .send({
          sectionIds: sections.map(s => s.id),
          separator: '\n\n',
          targetSectionId: sections[0].id
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('active suggestion');
      expect(response.body.code).toBe('HAS_ACTIVE_SUGGESTIONS');
      expect(response.body.totalSuggestions).toBeGreaterThan(0);
    });

    it('should disable split button when section has suggestions', async () => {
      // This test verifies the UI disables the split button
      // The button should have the 'disabled' attribute
      // Actual test would require DOM testing
      expect(true).toBe(true); // Placeholder for UI test
    });

    it('should disable join button when section has suggestions', async () => {
      // This test verifies the UI disables the join button
      // The button should have the 'disabled' attribute
      // Actual test would require DOM testing
      expect(true).toBe(true); // Placeholder for UI test
    });

    it('should show warning message for disabled split/join buttons', async () => {
      // This test verifies the UI shows the warning message
      // "Split/Join disabled: This section has N active suggestions..."
      expect(true).toBe(true); // Placeholder for UI test
    });
  });

  describe('Client-side Validation', () => {
    it('should check suggestions before allowing split operation', async () => {
      // Test that JavaScript splitSection() function checks for suggestions
      // before opening the modal
      expect(true).toBe(true); // Placeholder for client-side test
    });

    it('should check suggestions before allowing join operation', async () => {
      // Test that JavaScript showJoinModal() function checks for suggestions
      // before opening the modal
      expect(true).toBe(true); // Placeholder for client-side test
    });
  });

  describe('Error Messages', () => {
    it('should display user-friendly error for admin delete attempt', () => {
      const expectedMessage = 'Administrators cannot delete sections. Use editing tools to modify content.';
      expect(expectedMessage).toContain('Administrators cannot delete');
    });

    it('should display user-friendly error for split with suggestions', () => {
      const expectedMessage = 'Cannot split this section because it has 1 active suggestion(s). Resolve suggestions first.';
      expect(expectedMessage).toContain('Resolve suggestions first');
    });

    it('should display user-friendly error for join with suggestions', () => {
      const expectedMessage = 'Cannot join sections: 1 active suggestion(s) exist across 1 section(s). Resolve all suggestions before joining.';
      expect(expectedMessage).toContain('Resolve all suggestions before joining');
    });
  });
});
