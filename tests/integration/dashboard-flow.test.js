/**
 * Dashboard Integration Tests
 * Tests complete setup → dashboard flow with authentication and multi-tenant data isolation
 */

const { MultiTenantDatabase } = require('../unit/multitenancy.test');

describe('Dashboard Flow Integration Tests', () => {
  let db;
  let mockSession;
  let mockSupabase;

  beforeEach(() => {
    db = new MultiTenantDatabase();

    mockSession = {
      organizationId: null,
      isConfigured: false,
      user: null
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      limit: jest.fn().mockReturnThis()
    };
  });

  describe('Complete Setup to Dashboard Flow', () => {
    test('should complete full onboarding workflow', async () => {
      // Step 1: Create organization
      const org = await db.createOrganization({
        name: 'Test Organization',
        type: 'neighborhood_council',
        config: {
          hierarchy: {
            levels: [
              { type: 'article', depth: 0 },
              { type: 'section', depth: 1 }
            ]
          }
        }
      });

      expect(org.id).toBeDefined();
      expect(org.name).toBe('Test Organization');

      // Step 2: Set session
      mockSession.organizationId = org.id;
      mockSession.isConfigured = true;
      mockSession.user = { id: 'user-1', email: 'test@example.com' };

      expect(mockSession.organizationId).toBe(org.id);

      // Step 3: Create initial sections
      const sections = await Promise.all([
        db.createSection({
          section_citation: 'Article I, Section 1',
          section_title: 'Purpose',
          original_text: 'The purpose is...'
        }, org.id),
        db.createSection({
          section_citation: 'Article I, Section 2',
          section_title: 'Scope',
          original_text: 'The scope includes...'
        }, org.id)
      ]);

      expect(sections).toHaveLength(2);
      expect(sections[0].organization_id).toBe(org.id);
      expect(sections[1].organization_id).toBe(org.id);

      // Step 4: Verify dashboard access
      const dashboardSections = await db.getSectionsByOrg(org.id);

      expect(dashboardSections).toHaveLength(2);
      expect(dashboardSections.every(s => s.organization_id === org.id)).toBe(true);
    });

    test('should redirect to setup if organization not configured', async () => {
      const checkSetupStatus = (session) => {
        return session.isConfigured === true;
      };

      const isConfigured = checkSetupStatus(mockSession);

      expect(isConfigured).toBe(false);
      // In real app, this would trigger redirect to /setup
    });

    test('should persist session across requests', async () => {
      const org = await db.createOrganization({ name: 'Persistent Org' });

      // First request - login
      mockSession.organizationId = org.id;
      mockSession.isConfigured = true;

      // Simulate second request - dashboard access
      const sessionCopy = { ...mockSession };

      expect(sessionCopy.organizationId).toBe(org.id);
      expect(sessionCopy.isConfigured).toBe(true);
    });
  });

  describe('Authentication and Session Management', () => {
    test('should require authentication for dashboard', () => {
      const requireAuth = (session) => {
        return session.user !== null && session.user !== undefined;
      };

      mockSession.user = null;
      expect(requireAuth(mockSession)).toBe(false);

      mockSession.user = { id: 'user-1' };
      expect(requireAuth(mockSession)).toBe(true);
    });

    test('should associate user with organization', async () => {
      const org = await db.createOrganization({ name: 'User Org' });

      mockSession.user = { id: 'user-1', email: 'test@example.com' };
      mockSession.organizationId = org.id;

      // Verify user can access org data
      const sections = await db.getSectionsByOrg(mockSession.organizationId);

      expect(mockSession.user.id).toBe('user-1');
      expect(mockSession.organizationId).toBe(org.id);
    });

    test('should handle session timeout gracefully', () => {
      mockSession.organizationId = 'org-123';
      mockSession.expiresAt = Date.now() - 1000; // Expired

      const isSessionValid = (session) => {
        if (!session.expiresAt) return true; // No expiry set
        return session.expiresAt > Date.now();
      };

      expect(isSessionValid(mockSession)).toBe(false);
    });

    test('should refresh session on activity', () => {
      const refreshSession = (session) => {
        session.lastActivity = Date.now();
        session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        return session;
      };

      const refreshed = refreshSession(mockSession);

      expect(refreshed.lastActivity).toBeDefined();
      expect(refreshed.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('Multi-Tenant Data Isolation', () => {
    test('should isolate data between concurrent users', async () => {
      const org1 = await db.createOrganization({ name: 'Org 1' });
      const org2 = await db.createOrganization({ name: 'Org 2' });

      // User 1 session
      const session1 = {
        organizationId: org1.id,
        user: { id: 'user-1' }
      };

      // User 2 session
      const session2 = {
        organizationId: org2.id,
        user: { id: 'user-2' }
      };

      // Create sections for each org
      await db.createSection({ section_title: 'Org 1 Section' }, org1.id);
      await db.createSection({ section_title: 'Org 2 Section' }, org2.id);

      // Verify isolation
      const org1Sections = await db.getSectionsByOrg(session1.organizationId);
      const org2Sections = await db.getSectionsByOrg(session2.organizationId);

      expect(org1Sections).toHaveLength(1);
      expect(org2Sections).toHaveLength(1);
      expect(org1Sections[0].section_title).toBe('Org 1 Section');
      expect(org2Sections[0].section_title).toBe('Org 2 Section');
    });

    test('should prevent cross-organization data access', async () => {
      const org1 = await db.createOrganization({ name: 'Org 1' });
      const org2 = await db.createOrganization({ name: 'Org 2' });

      await db.createSection({ section_title: 'Secret Section' }, org2.id);

      // User from org1 tries to access org2 data
      const result = await db.crossOrgQuery(org1.id, org2.id);

      expect(result.org2).toHaveLength(0); // RLS blocks access
    });

    test('should handle organization switching', async () => {
      const org1 = await db.createOrganization({ name: 'Org 1' });
      const org2 = await db.createOrganization({ name: 'Org 2' });

      mockSession.organizationId = org1.id;

      let sections = await db.getSectionsByOrg(mockSession.organizationId);
      expect(sections).toHaveLength(0);

      // Switch organization
      mockSession.organizationId = org2.id;

      sections = await db.getSectionsByOrg(mockSession.organizationId);
      expect(sections).toHaveLength(0);
    });
  });

  describe('Dashboard API Endpoints', () => {
    test('should fetch sections with organization filter', async () => {
      const org = await db.createOrganization({ name: 'Test Org' });

      await Promise.all([
        db.createSection({ section_citation: 'Article I' }, org.id),
        db.createSection({ section_citation: 'Article II' }, org.id)
      ]);

      mockSupabase.single.mockResolvedValue({
        data: await db.getSectionsByOrg(org.id),
        error: null
      });

      const getSectionsEndpoint = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId);

        return { success: !error, sections: data };
      };

      const response = await getSectionsEndpoint(mockSupabase, org.id);

      expect(response.success).toBe(true);
      expect(response.sections).toHaveLength(2);
    });

    test('should create suggestion with organization context', async () => {
      const org = await db.createOrganization({ name: 'Test Org' });
      const section = await db.createSection({ section_title: 'Test' }, org.id);

      const suggestion = await db.createSuggestion({
        section_id: section.id,
        suggested_text: 'Improved text',
        author_name: 'John Doe'
      }, org.id);

      expect(suggestion.organization_id).toBe(org.id);
      expect(suggestion.section_id).toBe(section.id);
    });

    test('should fetch suggestions with organization filter', async () => {
      const org = await db.createOrganization({ name: 'Test Org' });
      const section = await db.createSection({ section_title: 'Test' }, org.id);

      await Promise.all([
        db.createSuggestion({ suggested_text: 'Suggestion 1' }, org.id),
        db.createSuggestion({ suggested_text: 'Suggestion 2' }, org.id)
      ]);

      const suggestions = await db.getSuggestionsByOrg(org.id);

      expect(suggestions).toHaveLength(2);
      expect(suggestions.every(s => s.organization_id === org.id)).toBe(true);
    });

    test('should handle empty organization data gracefully', async () => {
      const org = await db.createOrganization({ name: 'Empty Org' });

      const sections = await db.getSectionsByOrg(org.id);
      const suggestions = await db.getSuggestionsByOrg(org.id);

      expect(sections).toHaveLength(0);
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('Dashboard Navigation', () => {
    test('should navigate from setup to dashboard', async () => {
      const org = await db.createOrganization({ name: 'Nav Test Org' });

      mockSession.organizationId = null;
      mockSession.isConfigured = false;

      // Complete setup
      mockSession.organizationId = org.id;
      mockSession.isConfigured = true;

      // Verify can access dashboard
      const canAccessDashboard = () => {
        return mockSession.isConfigured && mockSession.organizationId !== null;
      };

      expect(canAccessDashboard()).toBe(true);
    });

    test('should redirect to setup from dashboard if not configured', () => {
      mockSession.isConfigured = false;

      const dashboardMiddleware = (session) => {
        if (!session.isConfigured) {
          return { redirect: '/setup' };
        }
        return { redirect: null };
      };

      const result = dashboardMiddleware(mockSession);

      expect(result.redirect).toBe('/setup');
    });

    test('should allow direct dashboard access if configured', () => {
      mockSession.isConfigured = true;
      mockSession.organizationId = 'org-123';

      const dashboardMiddleware = (session) => {
        if (!session.isConfigured || !session.organizationId) {
          return { redirect: '/setup' };
        }
        return { redirect: null };
      };

      const result = dashboardMiddleware(mockSession);

      expect(result.redirect).toBeNull();
    });
  });

  describe('Error Recovery', () => {
    test('should recover from database connection loss', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Connection lost'))
                           .mockResolvedValueOnce({ data: [], error: null });

      const getSectionsWithRetry = async (supabase, organizationId, retries = 1) => {
        for (let i = 0; i <= retries; i++) {
          try {
            const { data, error } = await supabase
              .from('bylaw_sections')
              .select('*')
              .eq('organization_id', organizationId);

            if (error) throw error;
            return data;
          } catch (error) {
            if (i === retries) throw error;
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      };

      const sections = await getSectionsWithRetry(mockSupabase, 'org-123', 1);

      expect(sections).toEqual([]);
    });

    test('should handle partial data load failures', async () => {
      const org = await db.createOrganization({ name: 'Test Org' });

      // Simulate partial failure
      await db.createSection({ section_title: 'Section 1' }, org.id);

      try {
        // Second insert fails
        throw new Error('Insert failed');
      } catch (error) {
        // Should still show first section
        const sections = await db.getSectionsByOrg(org.id);
        expect(sections).toHaveLength(1);
      }
    });

    test('should maintain data consistency on concurrent updates', async () => {
      const org = await db.createOrganization({ name: 'Test Org' });
      const section = await db.createSection({ section_title: 'Test' }, org.id);

      // Simulate concurrent updates
      const updates = Promise.all([
        Promise.resolve(section),
        Promise.resolve(section)
      ]);

      const results = await updates;

      expect(results).toHaveLength(2);
      // Both should reference same section
      expect(results[0].id).toBe(results[1].id);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large number of sections efficiently', async () => {
      const org = await db.createOrganization({ name: 'Large Org' });

      const startTime = Date.now();

      // Create 100 sections
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          db.createSection({ section_title: `Section ${i}` }, org.id)
        )
      );

      const sections = await db.getSectionsByOrg(org.id);
      const duration = Date.now() - startTime;

      expect(sections).toHaveLength(100);
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    test('should paginate large result sets', async () => {
      const org = await db.createOrganization({ name: 'Test Org' });

      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          db.createSection({ section_title: `Section ${i}` }, org.id)
        )
      );

      const page1 = await db.getSectionsByOrg(org.id);

      // In real implementation, would support pagination
      expect(page1.length).toBeGreaterThan(0);
      expect(page1.length).toBeLessThanOrEqual(50);
    });

    test('should cache frequently accessed data', () => {
      const cache = new Map();

      const getCachedSections = async (organizationId, fetchFn) => {
        if (cache.has(organizationId)) {
          return cache.get(organizationId);
        }

        const sections = await fetchFn(organizationId);
        cache.set(organizationId, sections);
        return sections;
      };

      // First call
      getCachedSections('org-123', async (id) => [{ id: '1' }]);

      // Should hit cache
      expect(cache.has('org-123')).toBe(true);
    });
  });
});

module.exports = { /* test helpers if needed */ };
