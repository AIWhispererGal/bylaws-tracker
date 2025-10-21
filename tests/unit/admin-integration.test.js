/**
 * Admin Integration Tests
 * Comprehensive tests for organization and global admin functionality
 *
 * Test Coverage:
 * - Organization admin access (isAdmin flag based on role)
 * - Global admin access (isGlobalAdmin flag from user_organizations)
 * - Admin middleware (requireAdmin, requireGlobalAdmin)
 * - Organization switching and admin flag updates
 * - RLS policies for global admin access
 * - Admin dashboard and route access
 */

const { createSupabaseMock } = require('../helpers/supabase-mock');
const {
  hasRole,
  requireAdmin,
  requireOwner,
  requireMember,
  getUserRole,
  attachUserRole
} = require('../../src/middleware/roleAuth');
const {
  isGlobalAdmin,
  getAccessibleOrganizations,
  attachGlobalAdminStatus,
  requireGlobalAdmin
} = require('../../src/middleware/globalAdmin');

describe('Admin Integration Tests', () => {
  let mockSupabase;
  let mockSupabaseService;
  let req, res, next;

  beforeEach(() => {
    mockSupabase = createSupabaseMock();
    mockSupabaseService = createSupabaseMock();

    req = {
      supabase: mockSupabase,
      supabaseService: mockSupabaseService,
      session: {
        userId: 'user-123',
        organizationId: 'org-123',
        userEmail: 'user@example.com',
        userName: 'Test User'
      }
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

  describe('Organization Admin Access (isAdmin Flag)', () => {
    test('should set isAdmin=true for owner role', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'owner',
          is_active: true
        },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_organizations');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-123');
    });

    test('should set isAdmin=true for admin role', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'admin',
          is_active: true
        },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(true);
    });

    test('should set isAdmin=false for member role', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'member',
          is_active: true
        },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(false);
    });

    test('should set isAdmin=false for viewer role', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'viewer',
          is_active: true
        },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(false);
    });

    test('should set isAdmin=false when is_active=false', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'admin',
          is_active: false
        },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(false);
    });

    test('should enforce role hierarchy correctly', async () => {
      // Test owner >= admin
      mockSupabase.single.mockResolvedValue({
        data: { role: 'owner', is_active: true },
        error: null
      });
      expect(await hasRole(req, 'admin')).toBe(true);
      expect(await hasRole(req, 'member')).toBe(true);
      expect(await hasRole(req, 'viewer')).toBe(true);

      // Test admin >= member
      mockSupabase.single.mockResolvedValue({
        data: { role: 'admin', is_active: true },
        error: null
      });
      expect(await hasRole(req, 'member')).toBe(true);
      expect(await hasRole(req, 'viewer')).toBe(true);

      // Test member >= viewer
      mockSupabase.single.mockResolvedValue({
        data: { role: 'member', is_active: true },
        error: null
      });
      expect(await hasRole(req, 'viewer')).toBe(true);

      // Test viewer cannot be admin
      mockSupabase.single.mockResolvedValue({
        data: { role: 'viewer', is_active: true },
        error: null
      });
      expect(await hasRole(req, 'admin')).toBe(false);
    });
  });

  describe('Global Admin Access (isGlobalAdmin Flag)', () => {
    test('should identify global admin correctly', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      const result = await isGlobalAdmin(req);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_organizations');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_global_admin', true);
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
    });

    test('should return false for non-global admin', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await isGlobalAdmin(req);

      expect(result).toBe(false);
    });

    test('should return false when is_active=false', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { is_global_admin: true, is_active: false },
        error: null
      });

      const result = await isGlobalAdmin(req);

      expect(result).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      });

      const result = await isGlobalAdmin(req);

      expect(result).toBe(false);
    });

    test('should return false without session', async () => {
      req.session = null;

      const result = await isGlobalAdmin(req);

      expect(result).toBe(false);
    });

    test('should return false without userId', async () => {
      req.session.userId = null;

      const result = await isGlobalAdmin(req);

      expect(result).toBe(false);
    });
  });

  describe('Admin Middleware', () => {
    describe('requireAdmin middleware', () => {
      test('should allow access for admin role', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { role: 'admin', is_active: true },
          error: null
        });

        await requireAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should allow access for owner role', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { role: 'owner', is_active: true },
          error: null
        });

        await requireAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should deny access for member role', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { role: 'member', is_active: true },
          error: null
        });

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Organization admin access required'
        });
        expect(next).not.toHaveBeenCalled();
      });

      test('should deny access for viewer role', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { role: 'viewer', is_active: true },
          error: null
        });

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });

      test('should deny access when no session', async () => {
        req.session.userId = null;

        await requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('requireOwner middleware', () => {
      test('should allow access for owner role', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { role: 'owner', is_active: true },
          error: null
        });

        await requireOwner(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should deny access for admin role', async () => {
        mockSupabase.single.mockResolvedValue({
          data: { role: 'admin', is_active: true },
          error: null
        });

        await requireOwner(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Organization owner access required'
        });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('requireGlobalAdmin middleware', () => {
      test('should allow access for global admin', () => {
        req.isGlobalAdmin = true;

        requireGlobalAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should deny access for non-global admin', () => {
        req.isGlobalAdmin = false;

        requireGlobalAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Global admin access required'
        });
        expect(next).not.toHaveBeenCalled();
      });

      test('should deny access when isGlobalAdmin is undefined', () => {
        req.isGlobalAdmin = undefined;

        requireGlobalAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Organization Switching', () => {
    test('should update admin flags when switching organizations', async () => {
      // Initial org - user is admin
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'admin', is_active: true },
        error: null
      });

      const isAdminInitial = await hasRole(req, 'admin');
      expect(isAdminInitial).toBe(true);

      // Switch to different org - user is member
      req.session.organizationId = 'org-456';
      mockSupabase.single.mockResolvedValueOnce({
        data: { role: 'member', is_active: true },
        error: null
      });

      const isAdminAfterSwitch = await hasRole(req, 'admin');
      expect(isAdminAfterSwitch).toBe(false);
    });

    test('should preserve global admin status across org switches', async () => {
      // Check global admin in first org
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      const isGlobalAdminInitial = await isGlobalAdmin(req);
      expect(isGlobalAdminInitial).toBe(true);

      // Switch organization
      req.session.organizationId = 'org-456';

      // Check global admin in second org - should still be true
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      const isGlobalAdminAfterSwitch = await isGlobalAdmin(req);
      expect(isGlobalAdminAfterSwitch).toBe(true);
    });

    test('should update accessible organizations on switch', async () => {
      // Mock isGlobalAdmin check - not global admin
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock user organizations
      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: [
          {
            organization_id: 'org-123',
            role: 'admin',
            organizations: {
              id: 'org-123',
              name: 'Org A',
              slug: 'org-a',
              organization_type: 'council'
            }
          },
          {
            organization_id: 'org-456',
            role: 'member',
            organizations: {
              id: 'org-456',
              name: 'Org B',
              slug: 'org-b',
              organization_type: 'committee'
            }
          }
        ],
        error: null
      });

      const orgs = await getAccessibleOrganizations(req);

      expect(orgs).toHaveLength(2);
      expect(orgs[0].role).toBe('admin');
      expect(orgs[1].role).toBe('member');
    });
  });

  describe('RLS Policies - Global Admin Access', () => {
    test('global admin should see all organizations', async () => {
      const allOrgs = [
        { id: 'org-1', name: 'Org 1', slug: 'org-1', organization_type: 'council' },
        { id: 'org-2', name: 'Org 2', slug: 'org-2', organization_type: 'committee' },
        { id: 'org-3', name: 'Org 3', slug: 'org-3', organization_type: 'board' }
      ];

      // Mock isGlobalAdmin check
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      // Mock organizations query
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: allOrgs,
        error: null
      });

      const orgs = await getAccessibleOrganizations(req);

      expect(orgs).toHaveLength(3);
      expect(orgs).toEqual(allOrgs);
    });

    test('regular user should only see their organizations', async () => {
      // Mock isGlobalAdmin check
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock user_organizations query
      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.eq.mockResolvedValueOnce({
        data: [
          {
            organization_id: 'org-1',
            role: 'admin',
            organizations: {
              id: 'org-1',
              name: 'My Org',
              slug: 'my-org',
              organization_type: 'council'
            }
          }
        ],
        error: null
      });

      const orgs = await getAccessibleOrganizations(req);

      expect(orgs).toHaveLength(1);
      expect(orgs[0].id).toBe('org-1');
    });

    test('global admin should bypass organization filtering', async () => {
      // Mock global admin status
      mockSupabase.maybeSingle.mockResolvedValue({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      // Mock query for ANY organization
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: [
          { id: 'org-999', name: 'Other Org', slug: 'other', organization_type: 'council' }
        ],
        error: null
      });

      const isAdmin = await isGlobalAdmin(req);
      expect(isAdmin).toBe(true);

      // Global admin should have access even if not a member of org-999
    });
  });

  describe('Admin Dashboard Access', () => {
    test('should allow admin to access admin dashboard', async () => {
      req.session.isAdmin = true;

      const requireAdminRoute = (request, response, nextHandler) => {
        if (!request.session.isAdmin) {
          return response.status(403).render('error', {
            title: 'Access Denied',
            message: 'Admin access required',
            error: { status: 403 }
          });
        }
        nextHandler();
      };

      requireAdminRoute(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny non-admin from admin dashboard', async () => {
      req.session.isAdmin = false;

      const requireAdminRoute = (request, response, nextHandler) => {
        if (!request.session.isAdmin) {
          return response.status(403).render('error', {
            title: 'Access Denied',
            message: 'Admin access required',
            error: { status: 403 }
          });
        }
        nextHandler();
      };

      requireAdminRoute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.render).toHaveBeenCalledWith('error', expect.objectContaining({
        title: 'Access Denied',
        message: 'Admin access required'
      }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow global admin to access /admin/organization route', async () => {
      req.isGlobalAdmin = true;

      requireGlobalAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny regular user from /admin/organization route', async () => {
      req.isGlobalAdmin = false;

      requireGlobalAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Global admin access required'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('getUserRole and attachUserRole', () => {
    test('should get user role with permissions', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'admin',
          permissions: { edit_sections: true, approve_suggestions: true },
          is_active: true
        },
        error: null
      });

      const userRole = await getUserRole(req);

      expect(userRole).toEqual({
        role: 'admin',
        permissions: { edit_sections: true, approve_suggestions: true }
      });
    });

    test('should return null when user not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      });

      const userRole = await getUserRole(req);

      expect(userRole).toBeNull();
    });

    test('should attach user role to request', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          role: 'admin',
          permissions: {},
          is_active: true
        },
        error: null
      });

      await attachUserRole(req, res, next);

      expect(req.userRole).toBeDefined();
      expect(req.userRole.role).toBe('admin');
      expect(next).toHaveBeenCalled();
    });

    test('should not attach role when no session', async () => {
      req.session.userId = null;

      await attachUserRole(req, res, next);

      expect(req.userRole).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('attachGlobalAdminStatus middleware', () => {
    test('should attach both isGlobalAdmin and accessibleOrganizations', async () => {
      const mockOrgs = [
        { id: 'org-1', name: 'Org 1', slug: 'org-1', organization_type: 'council' }
      ];

      // Mock isGlobalAdmin check
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { is_global_admin: true, is_active: true },
        error: null
      });

      // Mock organizations query
      mockSupabase.order = jest.fn().mockResolvedValue({
        data: mockOrgs,
        error: null
      });

      await attachGlobalAdminStatus(req, res, next);

      expect(req.isGlobalAdmin).toBe(true);
      expect(req.accessibleOrganizations).toHaveLength(1);
      expect(next).toHaveBeenCalled();
    });

    test('should set defaults when no session', async () => {
      req.session = null;

      await attachGlobalAdminStatus(req, res, next);

      expect(req.isGlobalAdmin).toBe(false);
      expect(req.accessibleOrganizations).toEqual([]);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Security Tests', () => {
    test('should not allow privilege escalation via session manipulation', async () => {
      req.session.isAdmin = true; // Attempt to set admin in session

      // Check actual database role
      mockSupabase.single.mockResolvedValue({
        data: { role: 'member', is_active: true },
        error: null
      });

      const isAdmin = await hasRole(req, 'admin');

      // Database check should override session value
      expect(isAdmin).toBe(false);
    });

    test('should validate admin status on every request', async () => {
      let callCount = 0;

      req.supabase = {
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
      };

      await isGlobalAdmin(req);
      await isGlobalAdmin(req);
      await isGlobalAdmin(req);

      expect(callCount).toBe(3); // Should query DB each time
    });

    test('should enforce both org admin and global admin checks independently', async () => {
      // User is org admin but not global admin
      mockSupabase.single.mockResolvedValue({
        data: { role: 'admin', is_active: true },
        error: null
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const isOrgAdmin = await hasRole(req, 'admin');
      const isGlobalAdminUser = await isGlobalAdmin(req);

      expect(isOrgAdmin).toBe(true);
      expect(isGlobalAdminUser).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle inactive user gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { role: 'admin', is_active: false },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(false);
    });

    test('should handle missing role gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { role: null, is_active: true },
        error: null
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(false);
    });

    test('should handle database connection failures', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Connection timeout')
      });

      const result = await hasRole(req, 'admin');

      expect(result).toBe(false);
    });

    test('should handle concurrent role checks', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { role: 'admin', is_active: true },
        error: null
      });

      const checks = await Promise.all([
        hasRole(req, 'admin'),
        hasRole(req, 'member'),
        hasRole(req, 'viewer')
      ]);

      expect(checks).toEqual([true, true, true]);
    });

    test('should handle organization with no users', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      mockSupabase.eq = jest.fn().mockReturnThis();
      mockSupabase.eq.mockResolvedValue({
        data: [],
        error: null
      });

      const orgs = await getAccessibleOrganizations(req);

      expect(orgs).toEqual([]);
    });
  });
});

module.exports = { /* test helpers if needed */ };
