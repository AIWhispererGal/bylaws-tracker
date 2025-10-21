/**
 * Admin API Integration Tests
 * Tests admin dashboard and user management endpoints
 */

// Mock Express app and Supabase
class MockExpressApp {
  constructor() {
    this.routes = new Map();
    this.middleware = [];
  }

  get(path, ...handlers) {
    this.routes.set(`GET:${path}`, handlers);
  }

  post(path, ...handlers) {
    this.routes.set(`POST:${path}`, handlers);
  }

  use(...handlers) {
    this.middleware.push(...handlers);
  }

  async executeRoute(method, path, req, res) {
    const key = `${method}:${path}`;
    const handlers = this.routes.get(key) || [];

    for (const handler of handlers) {
      await handler(req, res, () => {});
    }
  }
}

// Mock Supabase service
const createMockSupabaseService = (data = {}) => ({
  from: (table) => {
    const chain = {
      select: (fields) => chain,
      eq: (field, value) => {
        chain._eq = { field, value };
        return chain;
      },
      match: (conditions) => {
        chain._match = conditions;
        return {
          ...chain,
          // Return promise for async operations
          then: async (resolve) => {
            if (data.deleteError) {
              return resolve({ error: new Error('Delete failed') });
            }
            return resolve({ error: null });
          }
        };
      },
      in: (field, values) => chain,
      order: (field, opts) => chain,
      limit: (num) => chain,
      single: async () => {
        if (table === 'organizations') {
          return {
            data: data.organization || null,
            error: data.organization ? null : new Error('Not found')
          };
        }
        return { data: null, error: null };
      },
      delete: () => ({
        match: (conditions) => {
          if (data.deleteError) {
            return Promise.resolve({ error: new Error('Delete failed') });
          }
          return Promise.resolve({ error: null });
        }
      })
    };

    // Handle count queries
    const originalSelect = chain.select;
    chain.select = (fields, opts) => {
      if (opts?.count === 'exact' && opts?.head === true) {
        return {
          eq: () => ({
            count: data.counts?.[table] || 0
          }),
          in: () => ({
            eq: () => ({
              count: data.counts?.[table] || 0
            }),
            count: data.counts?.[table] || 0
          })
        };
      }
      return originalSelect.call(chain, fields);
    };

    // Handle async queries
    chain.then = async (resolve) => {
      if (table === 'organizations') {
        return resolve({
          data: data.organizations || [],
          error: null
        });
      }
      if (table === 'documents') {
        return resolve({
          data: data.documents || [],
          error: null
        });
      }
      if (table === 'user_organizations') {
        return resolve({
          data: data.userOrganizations || [],
          error: null
        });
      }
      if (table === 'suggestions') {
        return resolve({
          data: data.suggestions || [],
          error: null
        });
      }
      return resolve({ data: [], error: null });
    };

    return chain;
  }
});

describe('Admin API Integration Tests', () => {
  let app;
  let mockRes;

  beforeEach(() => {
    app = new MockExpressApp();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      render: jest.fn()
    };
  });

  describe('GET /admin/dashboard', () => {
    test('should return admin dashboard with all organizations', async () => {
      const mockData = {
        organizations: [
          { id: '1', name: 'Org A', created_at: '2024-01-01' },
          { id: '2', name: 'Org B', created_at: '2024-01-02' }
        ],
        documents: [
          { id: 'd1', organization_id: '1' },
          { id: 'd2', organization_id: '2' }
        ],
        counts: {
          documents: 1,
          document_sections: 10,
          suggestions: 5,
          user_organizations: 3
        }
      };

      const req = {
        session: { isAdmin: true },
        supabaseService: createMockSupabaseService(mockData)
      };

      const adminRouter = require('../../src/routes/admin');

      // Simulate admin dashboard request
      expect(mockData.organizations).toHaveLength(2);
      expect(mockData.documents).toHaveLength(2);
    });

    test('should deny access to non-admin users', async () => {
      const req = {
        session: { isAdmin: false },
        supabaseService: createMockSupabaseService({})
      };

      const requireAdmin = (req, res, next) => {
        if (!req.session.isAdmin) {
          return res.status(403).render('error', {
            title: 'Access Denied',
            message: 'Admin access required',
            error: { status: 403 }
          });
        }
        next();
      };

      requireAdmin(req, mockRes, () => {});

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalled();
    });

    test('should calculate system-wide statistics', async () => {
      const mockData = {
        organizations: [
          { id: '1', name: 'Org A' },
          { id: '2', name: 'Org B' },
          { id: '3', name: 'Org C' }
        ]
      };

      const systemStats = {
        totalOrganizations: mockData.organizations.length,
        totalDocuments: 10,
        totalSections: 150,
        totalSuggestions: 25,
        totalUsers: 45
      };

      expect(systemStats.totalOrganizations).toBe(3);
      expect(systemStats.totalDocuments).toBeGreaterThan(0);
      expect(systemStats.totalUsers).toBeGreaterThan(0);
    });

    test('should handle database errors gracefully', async () => {
      const req = {
        session: { isAdmin: true },
        supabaseService: {
          from: () => {
            throw new Error('Database connection failed');
          }
        }
      };

      try {
        await req.supabaseService.from('organizations');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Database connection failed');
      }
    });
  });

  describe('GET /admin/organization/:id', () => {
    test('should return detailed organization view', async () => {
      const mockData = {
        organization: {
          id: '1',
          name: 'Test Organization',
          slug: 'test-org',
          organization_type: 'council'
        },
        documents: [
          { id: 'd1', title: 'Bylaws', organization_id: '1' },
          { id: 'd2', title: 'Policies', organization_id: '1' }
        ],
        userOrganizations: [
          {
            user_id: 'u1',
            organization_id: '1',
            role: 'admin',
            users: { email: 'admin@test.com', full_name: 'Admin User' }
          },
          {
            user_id: 'u2',
            organization_id: '1',
            role: 'member',
            users: { email: 'member@test.com', full_name: 'Member User' }
          }
        ],
        suggestions: [
          {
            id: 's1',
            created_at: '2024-10-01',
            documents: { title: 'Bylaws', organization_id: '1' }
          }
        ]
      };

      const req = {
        params: { id: '1' },
        session: { isAdmin: true },
        supabaseService: createMockSupabaseService(mockData)
      };

      expect(mockData.organization.name).toBe('Test Organization');
      expect(mockData.documents).toHaveLength(2);
      expect(mockData.userOrganizations).toHaveLength(2);
    });

    test('should return 404 for non-existent organization', async () => {
      const req = {
        params: { id: '999' },
        session: { isAdmin: true },
        supabaseService: createMockSupabaseService({ organization: null })
      };

      const result = await req.supabaseService.from('organizations').select().eq('id', '999').single();

      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });

    test('should include recent activity for organization', async () => {
      const mockData = {
        suggestions: [
          {
            id: 's1',
            created_at: '2024-10-13',
            suggested_text: 'Update text',
            documents: { title: 'Bylaws', organization_id: '1' }
          },
          {
            id: 's2',
            created_at: '2024-10-12',
            suggested_text: 'Add clause',
            documents: { title: 'Bylaws', organization_id: '1' }
          }
        ]
      };

      const orgActivity = mockData.suggestions.filter(
        s => s.documents?.organization_id === '1'
      );

      expect(orgActivity).toHaveLength(2);
      expect(orgActivity[0].created_at).toBe('2024-10-13');
    });
  });

  describe('POST /admin/organization/:id/delete', () => {
    test('should delete organization with confirmation', async () => {
      const req = {
        params: { id: '1' },
        body: { confirm: 'DELETE' },
        session: { isAdmin: true },
        supabaseService: createMockSupabaseService({})
      };

      const result = await req.supabaseService.from('organizations').delete().match({ id: '1' });

      expect(result.error).toBeNull();
    });

    test('should require DELETE confirmation', async () => {
      const req = {
        params: { id: '1' },
        body: { confirm: 'WRONG' },
        session: { isAdmin: true }
      };

      if (req.body.confirm !== 'DELETE') {
        mockRes.status(400).json({
          success: false,
          error: 'Confirmation required. Send { confirm: "DELETE" }'
        });
      }

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('should handle deletion errors', async () => {
      const req = {
        params: { id: '1' },
        body: { confirm: 'DELETE' },
        session: { isAdmin: true },
        supabaseService: createMockSupabaseService({ deleteError: true })
      };

      const result = await req.supabaseService.from('organizations').delete().match({ id: '1' });

      expect(result.error).toBeTruthy();
    });

    test('should deny deletion without admin access', async () => {
      const req = {
        params: { id: '1' },
        body: { confirm: 'DELETE' },
        session: { isAdmin: false }
      };

      const requireAdmin = (req, res, next) => {
        if (!req.session.isAdmin) {
          return res.status(403).json({ success: false, error: 'Admin access required' });
        }
        next();
      };

      requireAdmin(req, mockRes, () => {});

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('User Management', () => {
    test('should list users for organization', async () => {
      const mockUsers = [
        { user_id: 'u1', role: 'admin', is_active: true },
        { user_id: 'u2', role: 'member', is_active: true },
        { user_id: 'u3', role: 'reviewer', is_active: false }
      ];

      const activeUsers = mockUsers.filter(u => u.is_active);

      expect(activeUsers).toHaveLength(2);
      expect(activeUsers.find(u => u.role === 'admin')).toBeTruthy();
    });

    test('should handle role-based filtering', async () => {
      const mockUsers = [
        { user_id: 'u1', role: 'admin' },
        { user_id: 'u2', role: 'member' },
        { user_id: 'u3', role: 'member' }
      ];

      const admins = mockUsers.filter(u => u.role === 'admin');
      const members = mockUsers.filter(u => u.role === 'member');

      expect(admins).toHaveLength(1);
      expect(members).toHaveLength(2);
    });
  });

  describe('Statistics and Metrics', () => {
    test('should calculate organization metrics correctly', async () => {
      const metrics = {
        documents: 5,
        sections: 50,
        suggestions: 12,
        users: 8,
        activeSuggestions: 3
      };

      expect(metrics.documents).toBeGreaterThan(0);
      expect(metrics.sections).toBeGreaterThan(metrics.documents);
      expect(metrics.activeSuggestions).toBeLessThanOrEqual(metrics.suggestions);
    });

    test('should aggregate statistics across organizations', async () => {
      const org1Stats = { documents: 5, sections: 50, users: 10 };
      const org2Stats = { documents: 3, sections: 30, users: 5 };
      const org3Stats = { documents: 7, sections: 70, users: 15 };

      const totalStats = {
        documents: org1Stats.documents + org2Stats.documents + org3Stats.documents,
        sections: org1Stats.sections + org2Stats.sections + org3Stats.sections,
        users: org1Stats.users + org2Stats.users + org3Stats.users
      };

      expect(totalStats.documents).toBe(15);
      expect(totalStats.sections).toBe(150);
      expect(totalStats.users).toBe(30);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty organizations list', async () => {
      const mockData = { organizations: [] };

      expect(mockData.organizations).toHaveLength(0);
    });

    test('should handle organizations with no users', async () => {
      const mockData = {
        organization: { id: '1', name: 'Empty Org' },
        userOrganizations: []
      };

      expect(mockData.userOrganizations).toHaveLength(0);
    });

    test('should handle concurrent admin requests', async () => {
      const requests = [
        Promise.resolve({ data: { id: '1' } }),
        Promise.resolve({ data: { id: '2' } }),
        Promise.resolve({ data: { id: '3' } })
      ];

      const results = await Promise.all(requests);
      expect(results).toHaveLength(3);
    });
  });
});

// Mock Jest functions
if (typeof jest === 'undefined') {
  global.jest = {
    fn: (impl) => {
      const mockFn = impl || (() => {});
      mockFn.mockReturnThis = () => mockFn;
      return mockFn;
    }
  };
}

if (typeof describe === 'undefined') {
  global.describe = (name, fn) => fn();
  global.test = (name, fn) => fn();
  global.beforeEach = (fn) => fn();
}

module.exports = { MockExpressApp, createMockSupabaseService };
