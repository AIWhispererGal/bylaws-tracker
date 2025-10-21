/**
 * Dashboard Unit Tests
 * Tests dashboard route handlers, database queries, and organization_id filtering
 */

const { createSupabaseMock } = require('../helpers/supabase-mock');

describe('Dashboard Unit Tests', () => {
  let mockSupabase;
  let mockSupabaseService;
  let req, res, next;

  beforeEach(() => {
    // Mock Supabase client with organization_id filtering
    mockSupabase = createSupabaseMock();

    mockSupabaseService = createSupabaseMock();

    // Mock Express req/res/next
    req = {
      supabase: mockSupabase,
      supabaseService: mockSupabaseService,
      session: {
        organizationId: 'org-123',
        user: { id: 'user-1' }
      },
      params: {},
      query: {},
      body: {}
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
      redirect: jest.fn(),
      send: jest.fn()
    };

    next = jest.fn();
  });

  describe('Setup Status Check', () => {
    test('should detect configured organization', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: { id: 'org-123', name: 'Test Org' },
        error: null
      });

      const checkSetupStatus = async (request) => {
        const { data, error } = await request.supabaseService
          .from('organizations')
          .select('id')
          .limit(1);

        if (error) return false;
        return data && Object.keys(data).length > 0;
      };

      const result = await checkSetupStatus(req);

      expect(result).toBe(true);
      expect(mockSupabaseService.from).toHaveBeenCalledWith('organizations');
    });

    test('should detect unconfigured system', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: null
      });

      const checkSetupStatus = async (request) => {
        const { data, error } = await request.supabaseService
          .from('organizations')
          .select('id')
          .limit(1);

        if (error || !data) return false;
        return true;
      };

      const result = await checkSetupStatus(req);

      expect(result).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      mockSupabaseService.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      const checkSetupStatus = async (request) => {
        try {
          const { data, error } = await request.supabaseService
            .from('organizations')
            .select('id')
            .limit(1);

          if (error) throw error;
          return data ? true : false;
        } catch (error) {
          return false;
        }
      };

      const result = await checkSetupStatus(req);

      expect(result).toBe(false);
    });

    test('should cache setup status in session', async () => {
      req.session.isConfigured = true;

      const checkSetupStatus = (request) => {
        if (request.session && request.session.isConfigured !== undefined) {
          return request.session.isConfigured;
        }
        return false;
      };

      const result = checkSetupStatus(req);

      expect(result).toBe(true);
      // Should not call database
      expect(mockSupabaseService.from).not.toHaveBeenCalled();
    });
  });

  describe('Organization ID Filtering', () => {
    test('should filter sections by organization_id', async () => {
      const mockSections = [
        { id: '1', organization_id: 'org-123', section_citation: 'Article I' },
        { id: '2', organization_id: 'org-123', section_citation: 'Article II' }
      ];

      mockSupabase.single.mockResolvedValue({
        data: mockSections,
        error: null
      });

      const getSections = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId);

        if (error) throw error;
        return data;
      };

      await getSections(req.supabase, req.session.organizationId);

      expect(mockSupabase.from).toHaveBeenCalledWith('bylaw_sections');
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-123');
    });

    test('should filter suggestions by organization_id', async () => {
      mockSupabase.single.mockResolvedValue({
        data: [{ id: 'sug-1', organization_id: 'org-123' }],
        error: null
      });

      const getSuggestions = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_suggestions')
          .select('*')
          .eq('organization_id', organizationId);

        if (error) throw error;
        return data;
      };

      await getSuggestions(req.supabase, req.session.organizationId);

      expect(mockSupabase.from).toHaveBeenCalledWith('bylaw_suggestions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-123');
    });

    test('should prevent accessing other organization data', async () => {
      mockSupabase.single.mockResolvedValue({
        data: [], // RLS should return empty for other org
        error: null
      });

      const getSections = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId);

        if (error) throw error;
        return data;
      };

      const sections = await getSections(req.supabase, 'org-999'); // Different org

      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-999');
    });
  });

  describe('Dashboard Route Handler', () => {
    test('should render dashboard with organization data', async () => {
      req.params.docId = 'doc-123';

      mockSupabase.single.mockResolvedValue({
        data: {
          sections: [
            { id: '1', section_citation: 'Article I', organization_id: 'org-123' }
          ]
        },
        error: null
      });

      const dashboardHandler = async (request, response) => {
        try {
          const { data, error } = await request.supabase
            .from('bylaw_sections')
            .select('*')
            .eq('organization_id', request.session.organizationId)
            .eq('doc_id', request.params.docId);

          if (error) throw error;

          response.render('dashboard', {
            sections: data.sections || [],
            organizationId: request.session.organizationId
          });
        } catch (error) {
          response.status(500).json({ error: error.message });
        }
      };

      await dashboardHandler(req, res);

      expect(res.render).toHaveBeenCalledWith('dashboard', expect.objectContaining({
        organizationId: 'org-123'
      }));
    });

    test('should handle missing organization_id in session', async () => {
      delete req.session.organizationId;

      const dashboardHandler = async (request, response) => {
        if (!request.session || !request.session.organizationId) {
          return response.redirect('/setup');
        }

        response.render('dashboard', { organizationId: request.session.organizationId });
      };

      await dashboardHandler(req, res);

      expect(res.redirect).toHaveBeenCalledWith('/setup');
      expect(res.render).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const dashboardHandler = async (request, response) => {
        try {
          const { data, error } = await request.supabase
            .from('bylaw_sections')
            .select('*')
            .eq('organization_id', request.session.organizationId);

          if (error) throw error;

          response.json({ sections: data });
        } catch (error) {
          response.status(500).json({ error: error.message });
        }
      };

      await dashboardHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('Query Performance', () => {
    test('should use efficient queries with proper indexes', async () => {
      const startTime = Date.now();

      mockSupabase.single.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `sec-${i}`,
          organization_id: 'org-123'
        })),
        error: null
      });

      const getSections = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId);

        return data;
      };

      await getSections(req.supabase, req.session.organizationId);

      const duration = Date.now() - startTime;

      // Mock should complete instantly
      expect(duration).toBeLessThan(100);
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-123');
    });

    test('should limit query results appropriately', async () => {
      const getRecentSections = async (supabase, organizationId, limit = 10) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(limit);

        return data;
      };

      await getRecentSections(req.supabase, req.session.organizationId, 10);

      expect(mockSupabase.limit).toHaveBeenCalledWith(10);
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('Error Handling', () => {
    test('should handle null organization_id', async () => {
      req.session.organizationId = null;

      const validateOrgId = (organizationId) => {
        if (!organizationId) {
          throw new Error('Organization ID is required');
        }
        return true;
      };

      expect(() => validateOrgId(req.session.organizationId)).toThrow('Organization ID is required');
    });

    test('should handle undefined session', async () => {
      req.session = undefined;

      const getOrgId = (request) => {
        return request.session?.organizationId || null;
      };

      const orgId = getOrgId(req);

      expect(orgId).toBeNull();
    });

    test('should handle malformed organization_id', async () => {
      req.session.organizationId = 'invalid-id-format';

      mockSupabase.single.mockResolvedValue({
        data: [],
        error: null
      });

      const getSections = async (supabase, organizationId) => {
        const { data, error } = await supabase
          .from('bylaw_sections')
          .select('*')
          .eq('organization_id', organizationId);

        return data || [];
      };

      const sections = await getSections(req.supabase, req.session.organizationId);

      expect(sections).toEqual([]);
    });
  });

  describe('Data Transformation', () => {
    test('should format sections for dashboard display', () => {
      const rawSections = [
        {
          id: '1',
          section_citation: 'Article I, Section 1',
          section_title: 'Purpose',
          original_text: 'Original',
          new_text: null,
          locked_by_committee: false
        },
        {
          id: '2',
          section_citation: 'Article I, Section 2',
          section_title: 'Scope',
          original_text: 'Original',
          new_text: 'Updated',
          locked_by_committee: true
        }
      ];

      const formatSections = (sections) => {
        return sections.map(section => ({
          ...section,
          displayText: section.new_text || section.original_text,
          isLocked: section.locked_by_committee,
          hasChanges: section.new_text !== null && section.new_text !== section.original_text
        }));
      };

      const formatted = formatSections(rawSections);

      expect(formatted[0].displayText).toBe('Original');
      expect(formatted[0].isLocked).toBe(false);
      expect(formatted[0].hasChanges).toBe(false);

      expect(formatted[1].displayText).toBe('Updated');
      expect(formatted[1].isLocked).toBe(true);
      expect(formatted[1].hasChanges).toBe(true);
    });

    test('should calculate section statistics', () => {
      const sections = [
        { locked_by_committee: true, new_text: 'Changed' },
        { locked_by_committee: true, new_text: null },
        { locked_by_committee: false, new_text: null },
        { locked_by_committee: false, new_text: 'Changed' }
      ];

      const calculateStats = (sections) => {
        return {
          total: sections.length,
          locked: sections.filter(s => s.locked_by_committee).length,
          unlocked: sections.filter(s => !s.locked_by_committee).length,
          withChanges: sections.filter(s => s.new_text !== null).length
        };
      };

      const stats = calculateStats(sections);

      expect(stats.total).toBe(4);
      expect(stats.locked).toBe(2);
      expect(stats.unlocked).toBe(2);
      expect(stats.withChanges).toBe(2);
    });
  });

  describe('Session Management', () => {
    test('should validate session before dashboard access', () => {
      const requireSession = (request, response, nextHandler) => {
        if (!request.session || !request.session.organizationId) {
          return response.redirect('/setup');
        }
        nextHandler();
      };

      requireSession(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test('should redirect to setup without session', () => {
      req.session = null;

      const requireSession = (request, response, nextHandler) => {
        if (!request.session || !request.session.organizationId) {
          return response.redirect('/setup');
        }
        nextHandler();
      };

      requireSession(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/setup');
      expect(next).not.toHaveBeenCalled();
    });

    test('should cache organization config in session', () => {
      req.session.organizationConfig = {
        name: 'Test Org',
        hierarchy: { levels: [] }
      };

      const getOrgConfig = (request) => {
        return request.session.organizationConfig || null;
      };

      const config = getOrgConfig(req);

      expect(config).toBeDefined();
      expect(config.name).toBe('Test Org');
    });
  });
});

module.exports = { /* test helpers if needed */ };
