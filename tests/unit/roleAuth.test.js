/**
 * Role Authorization Tests
 * Tests role-based access control and permission boundaries
 */

const {
  isGlobalAdmin,
  getAccessibleOrganizations,
  attachGlobalAdminStatus,
  requireGlobalAdmin
} = require('../../src/middleware/globalAdmin');

const { createSupabaseMock } = require('../helpers/supabase-mock');

describe('Role Authorization Tests', () => {
  describe('isGlobalAdmin', () => {
    test('should return true for global admin user', async () => {
      const mockSupabase = createSupabaseMock();
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      const req = {
        session: { userId: 'admin-123' },
        supabase: mockSupabase
      };

      const result = await isGlobalAdmin(req);
      expect(result).toBe(true);
    });

    test('should return false for non-admin user', async () => {
      const mockSupabase = createSupabaseMock();
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const result = await isGlobalAdmin(req);
      expect(result).toBe(false);
    });

    test('should return false when no session exists', async () => {
      const req = {
        session: null,
        supabase: createMockSupabase(false)
      };

      const result = await isGlobalAdmin(req);
      expect(result).toBe(false);
    });

    test('should return false when userId is missing', async () => {
      const req = {
        session: {},
        supabase: createMockSupabase(false)
      };

      const result = await isGlobalAdmin(req);
      expect(result).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      const mockSupabase = createSupabaseMock();
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const result = await isGlobalAdmin(req);
      expect(result).toBe(false);
    });
  });

  describe('getAccessibleOrganizations', () => {
    test('should return all organizations for global admin', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org A', slug: 'org-a', organization_type: 'council' },
        { id: '2', name: 'Org B', slug: 'org-b', organization_type: 'committee' }
      ];

      const mockSupabase = createSupabaseMock();

      // Mock isGlobalAdmin check to return true
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      // Mock organizations query
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: mockOrgs,
        error: null
      });

      const req = {
        session: { userId: 'admin-123' },
        supabase: mockSupabase
      };

      const result = await getAccessibleOrganizations(req);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Org A');
    });

    test('should return only user organizations for regular user', async () => {
      const mockSupabase = createSupabaseMock();

      // Mock isGlobalAdmin check to return false
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock user_organizations query with nested organizations data
      mockSupabase.eq = jest.fn().mockReturnThis();
      const mockUserOrgsQuery = {
        data: [{
          organization_id: '1',
          role: 'admin',
          organizations: {
            id: '1',
            name: 'My Org',
            slug: 'my-org',
            organization_type: 'council'
          }
        }],
        error: null
      };

      // Mock the final query execution after .eq() chains
      mockSupabase.eq.mockResolvedValueOnce(mockUserOrgsQuery);

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const result = await getAccessibleOrganizations(req);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('My Org');
      expect(result[0].role).toBe('admin');
    });

    test('should return empty array when no session', async () => {
      const req = {
        session: null,
        supabase: createMockSupabase(false)
      };

      const result = await getAccessibleOrganizations(req);
      expect(result).toEqual([]);
    });

    test('should handle database errors gracefully', async () => {
      const mockSupabase = createSupabaseMock();
      // Mock order() to return error
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: null,
        error: new Error('Query failed')
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const result = await getAccessibleOrganizations(req);
      expect(result).toEqual([]);
    });
  });

  describe('attachGlobalAdminStatus middleware', () => {
    test('should attach admin status and organizations to request', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org A', slug: 'org-a', organization_type: 'council' }
      ];

      const mockSupabase = createSupabaseMock();

      // Mock isGlobalAdmin check
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      // Mock organizations query for getAccessibleOrganizations
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: mockOrgs,
        error: null
      });

      const req = {
        session: { userId: 'admin-123' },
        supabase: mockSupabase
      };

      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await attachGlobalAdminStatus(req, {}, next);

      expect(req.isGlobalAdmin).toBe(true);
      expect(req.accessibleOrganizations).toHaveLength(1);
      expect(nextCalled).toBe(true);
    });

    test('should set defaults when no session exists', async () => {
      const req = { session: null };

      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await attachGlobalAdminStatus(req, {}, next);

      expect(req.isGlobalAdmin).toBe(false);
      expect(req.accessibleOrganizations).toEqual([]);
      expect(nextCalled).toBe(true);
    });
  });

  describe('requireGlobalAdmin middleware', () => {
    test('should allow access for global admin', () => {
      const req = { isGlobalAdmin: true };
      const res = {};

      let nextCalled = false;
      const next = () => { nextCalled = true; };

      requireGlobalAdmin(req, res, next);

      expect(nextCalled).toBe(true);
    });

    test('should deny access for non-admin user', () => {
      const req = { isGlobalAdmin: false };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const next = jest.fn();

      requireGlobalAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Global admin access required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should deny access when isGlobalAdmin is undefined', () => {
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      const next = jest.fn();

      requireGlobalAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Permission Boundary Tests', () => {
    test('should prevent privilege escalation', async () => {
      const mockSupabase = createSupabaseMock();
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const isAdmin = await isGlobalAdmin(req);
      expect(isAdmin).toBe(false);

      // Verify user can't modify admin flag
      req.session.isGlobalAdmin = true;
      const recheckAdmin = await isGlobalAdmin(req);
      expect(recheckAdmin).toBe(false); // Should still query DB
    });

    test('should enforce organization access control', async () => {
      const mockSupabase = createSupabaseMock();

      // Mock isGlobalAdmin check to return false
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock user_organizations query
      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: [{
          organization_id: '1',
          role: 'member',
          organizations: {
            id: '1',
            name: 'Allowed Org',
            slug: 'allowed',
            organization_type: 'council'
          }
        }],
        error: null
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const orgs = await getAccessibleOrganizations(req);

      expect(orgs).toHaveLength(1);
      expect(orgs.find(o => o.id === '999')).toBeUndefined();
    });

    test('should validate admin status on every request', async () => {
      let callCount = 0;

      const req = {
        session: { userId: 'user-123' },
        supabase: {
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    limit: () => ({
                      maybeSingle: async () => {
                        callCount++;
                        return { data: null, error: null };
                      }
                    })
                  })
                })
              })
            })
          })
        }
      };

      await isGlobalAdmin(req);
      await isGlobalAdmin(req);
      await isGlobalAdmin(req);

      expect(callCount).toBe(3); // Should query DB each time, no caching
    });
  });

  describe('Role-Based Access Control', () => {
    test('should differentiate between admin and member roles', async () => {
      const mockSupabase = createSupabaseMock();

      // Mock isGlobalAdmin check to return false
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock user_organizations query with multiple orgs
      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: [
          {
            organization_id: '1',
            role: 'admin',
            organizations: {
              id: '1',
              name: 'Admin Org',
              slug: 'admin-org',
              organization_type: 'council'
            }
          },
          {
            organization_id: '2',
            role: 'member',
            organizations: {
              id: '2',
              name: 'Member Org',
              slug: 'member-org',
              organization_type: 'council'
            }
          }
        ],
        error: null
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const orgs = await getAccessibleOrganizations(req);

      const adminOrg = orgs.find(o => o.id === '1');
      const memberOrg = orgs.find(o => o.id === '2');

      expect(adminOrg.role).toBe('admin');
      expect(memberOrg.role).toBe('member');
    });

    test('should handle multiple roles across organizations', async () => {
      const mockSupabase = createSupabaseMock();

      // Mock isGlobalAdmin check to return false
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock user_organizations query with multiple roles
      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: [
          {
            organization_id: '1',
            role: 'admin',
            organizations: {
              id: '1',
              name: 'Org A',
              slug: 'a',
              organization_type: 'council'
            }
          },
          {
            organization_id: '2',
            role: 'member',
            organizations: {
              id: '2',
              name: 'Org B',
              slug: 'b',
              organization_type: 'council'
            }
          },
          {
            organization_id: '3',
            role: 'reviewer',
            organizations: {
              id: '3',
              name: 'Org C',
              slug: 'c',
              organization_type: 'council'
            }
          }
        ],
        error: null
      });

      const req = {
        session: { userId: 'user-123' },
        supabase: mockSupabase
      };

      const orgs = await getAccessibleOrganizations(req);

      expect(orgs).toHaveLength(3);
      expect(orgs.map(o => o.role)).toEqual(['admin', 'member', 'reviewer']);
    });
  });
});

// Mock Jest if not available
if (typeof jest === 'undefined') {
  global.jest = {
    fn: (impl) => {
      const mockFn = impl || (() => {});
      mockFn.mockReturnThis = () => mockFn;
      mockFn.mock = { calls: [] };
      return mockFn;
    }
  };
}

if (typeof expect === 'undefined') {
  global.expect = (value) => ({
    toBe: (expected) => {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, got ${value}`);
      }
    },
    toEqual: (expected) => {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
      }
    },
    toHaveLength: (expected) => {
      if (value.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${value.length}`);
      }
    },
    toBeUndefined: () => {
      if (value !== undefined) {
        throw new Error(`Expected undefined, got ${value}`);
      }
    },
    not: {
      toHaveBeenCalled: () => {}
    }
  });
}
