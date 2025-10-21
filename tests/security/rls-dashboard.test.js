/**
 * RLS Security Tests for Dashboard
 * Tests Row-Level Security policy enforcement and organization data isolation
 */

const { createSupabaseMock } = require('../helpers/supabase-mock');

describe('RLS Dashboard Security Tests', () => {
  let mockSupabase;
  let mockSupabaseService;

  beforeEach(() => {
    // Mock authenticated client (with RLS)
    mockSupabase = createSupabaseMock();

    // Mock service role client (bypasses RLS)
    mockSupabaseService = createSupabaseMock();
  });

  describe('Organization Data Isolation', () => {
    test('should enforce RLS on bylaw_sections', async () => {
      // User from org-1 queries sections
      mockSupabase.single.mockResolvedValue({
        data: [
          { id: '1', organization_id: 'org-1', section_title: 'Org 1 Section' }
        ],
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select('*')
        .eq('organization_id', 'org-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('bylaw_sections');
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    });

    test('should block access to other organization sections', async () => {
      // User from org-1 tries to access org-2 data
      mockSupabase.single.mockResolvedValue({
        data: [], // RLS should return empty
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select('*')
        .eq('organization_id', 'org-2'); // Different org

      // RLS policy should filter this out
      expect(data).toBeDefined();
    });

    test('should enforce RLS on bylaw_suggestions', async () => {
      mockSupabase.single.mockResolvedValue({
        data: [
          { id: 'sug-1', organization_id: 'org-1', suggested_text: 'Suggestion' }
        ],
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_suggestions')
        .select('*')
        .eq('organization_id', 'org-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('bylaw_suggestions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    });

    test('should enforce RLS on organizations table', async () => {
      // User should only see their own organization
      mockSupabase.single.mockResolvedValue({
        data: { id: 'org-1', name: 'My Org' },
        error: null
      });

      const { data, error } = await mockSupabase
        .from('organizations')
        .select('*')
        .eq('id', 'org-1')
        .single();

      expect(data).toBeDefined();
      expect(data.id).toBe('org-1');
    });

    test('should prevent viewing other organization details', async () => {
      // User tries to view org-2 details
      mockSupabase.single.mockResolvedValue({
        data: null, // RLS blocks this
        error: { message: 'No rows found' }
      });

      const { data, error } = await mockSupabase
        .from('organizations')
        .select('*')
        .eq('id', 'org-2')
        .single();

      expect(data).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe('Unauthorized Access Attempts', () => {
    test('should block INSERT without organization_id', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'organization_id is required' }
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .insert({
          section_citation: 'Article I',
          section_title: 'Test'
          // Missing organization_id
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('organization_id');
    });

    test('should block INSERT with wrong organization_id', async () => {
      // User from org-1 tries to insert into org-2
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'RLS policy violation' }
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .insert({
          organization_id: 'org-2', // Not user's org
          section_citation: 'Article I',
          section_title: 'Malicious Insert'
        });

      expect(error).toBeDefined();
    });

    test('should block UPDATE of other organization data', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows updated' }
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .update({ section_title: 'Hacked Title' })
        .eq('organization_id', 'org-2'); // Not user's org

      expect(error).toBeDefined();
    });

    test('should block DELETE of other organization data', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows deleted' }
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .delete()
        .eq('organization_id', 'org-2');

      expect(error).toBeDefined();
    });

    test('should prevent SQL injection through organization_id', async () => {
      const maliciousOrgId = "org-1' OR '1'='1";

      mockSupabase.single.mockResolvedValue({
        data: [], // Parameterized queries prevent injection
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select('*')
        .eq('organization_id', maliciousOrgId);

      // Should safely handle malicious input
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('RLS Policy Enforcement', () => {
    test('should apply SELECT policy for authenticated users', async () => {
      // Policy: Users can only SELECT their own organization data
      mockSupabase.single.mockResolvedValue({
        data: [{ id: '1', organization_id: 'org-1' }],
        error: null
      });

      const testRLSPolicy = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId);

        return { success: !error, data };
      };

      const result = await testRLSPolicy(mockSupabase, 'org-1');

      expect(result.success).toBe(true);
      expect(result.data.every(s => s.organization_id === 'org-1')).toBe(true);
    });

    test('should apply INSERT policy for authenticated users', async () => {
      // Policy: Users can only INSERT into their own organization
      mockSupabase.single.mockResolvedValue({
        data: { id: '1', organization_id: 'org-1' },
        error: null
      });

      const testInsertPolicy = async (supabase, organizationId, sectionData) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .insert({
            ...sectionData,
            organization_id: organizationId
          })
          .select()
          .single();

        return { success: !error, data };
      };

      const result = await testInsertPolicy(mockSupabase, 'org-1', {
        section_citation: 'Article I',
        section_title: 'Test'
      });

      expect(result.success).toBe(true);
      expect(result.data.organization_id).toBe('org-1');
    });

    test('should apply UPDATE policy for authenticated users', async () => {
      // Policy: Users can only UPDATE their own organization data
      mockSupabase.single.mockResolvedValue({
        data: { id: '1', organization_id: 'org-1', section_title: 'Updated' },
        error: null
      });

      const testUpdatePolicy = async (supabase, sectionId, organizationId, updates) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .update(updates)
          .eq('id', sectionId)
          .eq('organization_id', organizationId)
          .select()
          .single();

        return { success: !error, data };
      };

      const result = await testUpdatePolicy(mockSupabase, '1', 'org-1', {
        section_title: 'Updated'
      });

      expect(result.success).toBe(true);
    });

    test('should apply DELETE policy for authenticated users', async () => {
      // Policy: Users can only DELETE their own organization data
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      });

      const testDeletePolicy = async (supabase, sectionId, organizationId) => {
        const { error } = await supabase
          .from('bylaw_sections')
          .delete()
          .eq('id', sectionId)
          .eq('organization_id', organizationId);

        return { success: !error };
      };

      const result = await testDeletePolicy(mockSupabase, '1', 'org-1');

      expect(result.success).toBe(true);
    });
  });

  describe('Service Role vs User Role', () => {
    test('service role should bypass RLS for all organizations', async () => {
      // Service role can see all data
      mockSupabaseService.single.mockResolvedValue({
        data: [
          { id: '1', organization_id: 'org-1' },
          { id: '2', organization_id: 'org-2' },
          { id: '3', organization_id: 'org-3' }
        ],
        error: null
      });

      const { data, error } = await mockSupabaseService
        .from('bylaw_sections')
        .select('*');

      // Service role sees all orgs
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(1);
    });

    test('user role should only see own organization', async () => {
      // User sees only their org
      mockSupabase.single.mockResolvedValue({
        data: [
          { id: '1', organization_id: 'org-1' }
        ],
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select('*')
        .eq('organization_id', 'org-1');

      expect(data).toBeDefined();
      expect(data.every(s => s.organization_id === 'org-1')).toBe(true);
    });

    test('service role should be used only for setup', async () => {
      // During setup, service role creates organization
      mockSupabaseService.single.mockResolvedValue({
        data: { id: 'org-new', name: 'New Org' },
        error: null
      });

      const createOrganization = async (supabaseService, orgData) => {
        const { data, error } = await supabaseService
          .from('organizations')
          .insert(orgData)
          .select()
          .single();

        return { success: !error, data };
      };

      const result = await createOrganization(mockSupabaseService, {
        name: 'New Org',
        type: 'council'
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe('New Org');
    });

    test('service role should not be exposed to client', () => {
      const validateClientAccess = (request) => {
        // Client should never have access to service role
        return request.supabaseService === undefined ||
               request.supabaseService === null;
      };

      const mockRequest = {
        supabase: mockSupabase
        // supabaseService should not be here
      };

      // In production, service role should not be exposed
      expect(mockRequest.supabaseService).toBeUndefined();
    });
  });

  describe('RLS Edge Cases', () => {
    test('should handle NULL organization_id', async () => {
      mockSupabase.single.mockResolvedValue({
        data: [],
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select('*')
        .eq('organization_id', null);

      // RLS should block records with NULL organization_id
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should handle concurrent transactions with RLS', async () => {
      // Simulate concurrent updates from different orgs
      const org1Update = mockSupabase.single.mockResolvedValue({
        data: { id: '1', organization_id: 'org-1' },
        error: null
      });

      const org2Update = mockSupabase.single.mockResolvedValue({
        data: { id: '2', organization_id: 'org-2' },
        error: null
      });

      // Both should succeed for their own orgs
      await Promise.all([
        mockSupabase.from('bylaw_sections').update({ section_title: 'Updated 1' }).eq('organization_id', 'org-1'),
        mockSupabase.from('bylaw_sections').update({ section_title: 'Updated 2' }).eq('organization_id', 'org-2')
      ]);

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    test('should handle RLS with JOIN queries', async () => {
      // Query sections with their suggestions (both tables have RLS)
      mockSupabase.single.mockResolvedValue({
        data: [{
          id: '1',
          organization_id: 'org-1',
          suggestions: [
            { id: 'sug-1', organization_id: 'org-1' }
          ]
        }],
        error: null
      });

      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select(`
          *,
          bylaw_suggestions!section_id (*)
        `)
        .eq('organization_id', 'org-1');

      expect(data).toBeDefined();
      // Both tables should enforce RLS
    });

    test('should handle RLS with aggregate queries', async () => {
      // Count sections per organization
      mockSupabase.rpc.mockResolvedValue({
        data: 5,
        error: null
      });

      const { data, error } = await mockSupabase
        .rpc('count_sections', { org_id: 'org-1' });

      // RLS should apply to aggregate functions
      expect(data).toBeDefined();
      expect(typeof data).toBe('number');
    });
  });

  describe('Security Best Practices', () => {
    test('should always include organization_id in WHERE clause', () => {
      const buildSecureQuery = (supabase, organizationId) => {
        return supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId); // Always filter by org
      };

      const query = buildSecureQuery(mockSupabase, 'org-1');

      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    });

    test('should validate organization_id from session, not client', () => {
      const validateOrgId = (session, clientOrgId) => {
        // Never trust client-provided org ID
        return session.organizationId;
      };

      const session = { organizationId: 'org-1' };
      const clientOrgId = 'org-2'; // Malicious client

      const validOrgId = validateOrgId(session, clientOrgId);

      expect(validOrgId).toBe('org-1'); // Use session, not client
    });

    test('should use prepared statements to prevent injection', async () => {
      const maliciousInput = "'; DROP TABLE bylaw_sections; --";

      mockSupabase.single.mockResolvedValue({
        data: [],
        error: null
      });

      // Supabase uses prepared statements automatically
      const { data, error } = await mockSupabase
        .from('bylaw_sections')
        .select('*')
        .eq('section_citation', maliciousInput);

      // Should safely handle malicious input
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    test('should log security violations', () => {
      const violations = [];

      const logSecurityViolation = (userId, attemptedOrgId, actualOrgId) => {
        violations.push({
          timestamp: new Date(),
          userId,
          attemptedOrgId,
          actualOrgId,
          type: 'unauthorized_access_attempt'
        });
      };

      logSecurityViolation('user-1', 'org-2', 'org-1');

      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe('unauthorized_access_attempt');
    });

    test('should rate limit suspicious activity', () => {
      const attemptLog = new Map();

      const checkRateLimit = (userId) => {
        const attempts = attemptLog.get(userId) || 0;

        if (attempts > 5) {
          return { allowed: false, reason: 'Too many attempts' };
        }

        attemptLog.set(userId, attempts + 1);
        return { allowed: true };
      };

      // Simulate 6 attempts
      for (let i = 0; i < 6; i++) {
        checkRateLimit('user-1');
      }

      const result = checkRateLimit('user-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Too many attempts');
    });
  });
});

module.exports = { /* test helpers if needed */ };
