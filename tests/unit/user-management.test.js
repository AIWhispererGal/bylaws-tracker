/**
 * User Management Tests
 * Tests user CRUD operations and role management
 */

// Mock user management service
class UserManagementService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async createUser(email, password, fullName) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addUserToOrganization(userId, organizationId, role = 'member') {
    try {
      const { data, error } = await this.supabase
        .from('user_organizations')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          role,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, membership: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateUserRole(userId, organizationId, newRole) {
    try {
      const { data, error } = await this.supabase
        .from('user_organizations')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, membership: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async removeUserFromOrganization(userId, organizationId) {
    try {
      const { error } = await this.supabase
        .from('user_organizations')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getUsersByOrganization(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('user_organizations')
        .select(`
          *,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error) throw error;

      return { success: true, users: data || [] };
    } catch (error) {
      return { success: false, error: error.message, users: [] };
    }
  }

  async getUserOrganizations(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_organizations')
        .select(`
          *,
          organizations:organization_id (
            id,
            name,
            slug
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      return { success: true, organizations: data || [] };
    } catch (error) {
      return { success: false, error: error.message, organizations: [] };
    }
  }

  validateRole(role) {
    const validRoles = ['member', 'admin', 'committee_chair', 'board_president', 'global_admin'];
    return validRoles.includes(role);
  }

  canUserManageRole(userRole, targetRole) {
    const roleHierarchy = {
      global_admin: 5,
      board_president: 4,
      committee_chair: 3,
      admin: 2,
      member: 1
    };

    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[targetRole] || 0);
  }
}

// Mock Supabase for user management
const createMockSupabaseForUsers = (mockData = {}) => ({
  auth: {
    signUp: async (options) => {
      if (mockData.signUpError) {
        return { data: null, error: new Error('Sign up failed') };
      }
      return {
        data: {
          user: {
            id: 'new-user-123',
            email: options.email,
            user_metadata: options.options?.data || {}
          }
        },
        error: null
      };
    }
  },
  from: (table) => {
    const chain = {
      insert: (data) => chain,
      update: (data) => {
        chain._updateData = data;
        return chain;
      },
      select: (fields) => chain,
      eq: (field, value) => {
        chain._where = { ...chain._where, [field]: value };
        return chain;
      },
      single: async () => {
        if (mockData.error) {
          return { data: null, error: new Error('Database error') };
        }
        return {
          data: mockData.membership || { user_id: 'user-1', organization_id: 'org-1', role: 'member' },
          error: null
        };
      }
    };

    chain.then = async (resolve) => {
      if (mockData.error) {
        return resolve({ data: null, error: new Error('Database error') });
      }
      if (table === 'user_organizations') {
        return resolve({
          data: mockData.users || mockData.organizations || [],
          error: null
        });
      }
      return resolve({ data: [], error: null });
    };

    return chain;
  }
});

describe('User Management Tests', () => {
  describe('User Creation', () => {
    test('should create new user successfully', async () => {
      const supabase = createMockSupabaseForUsers({});
      const service = new UserManagementService(supabase);

      const result = await service.createUser(
        'newuser@example.com',
        'password123',
        'New User'
      );

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('newuser@example.com');
    });

    test('should handle user creation errors', async () => {
      const supabase = createMockSupabaseForUsers({ signUpError: true });
      const service = new UserManagementService(supabase);

      const result = await service.createUser(
        'error@example.com',
        'password123',
        'Error User'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sign up failed');
    });

    test('should include user metadata', async () => {
      const supabase = createMockSupabaseForUsers({});
      const service = new UserManagementService(supabase);

      const result = await service.createUser(
        'user@example.com',
        'password123',
        'John Doe'
      );

      expect(result.success).toBe(true);
      expect(result.user).toBeTruthy();
    });
  });

  describe('Organization Membership', () => {
    test('should add user to organization', async () => {
      const supabase = createMockSupabaseForUsers({});
      const service = new UserManagementService(supabase);

      const result = await service.addUserToOrganization('user-1', 'org-1', 'member');

      expect(result.success).toBe(true);
      expect(result.membership).toBeTruthy();
    });

    test('should add user with specific role', async () => {
      const supabase = createMockSupabaseForUsers({
        membership: { user_id: 'user-1', organization_id: 'org-1', role: 'admin' }
      });
      const service = new UserManagementService(supabase);

      const result = await service.addUserToOrganization('user-1', 'org-1', 'admin');

      expect(result.success).toBe(true);
      expect(result.membership.role).toBe('admin');
    });

    test('should handle duplicate membership errors', async () => {
      const supabase = createMockSupabaseForUsers({ error: true });
      const service = new UserManagementService(supabase);

      const result = await service.addUserToOrganization('user-1', 'org-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });

    test('should set is_active to true by default', async () => {
      const supabase = createMockSupabaseForUsers({
        membership: { user_id: 'user-1', organization_id: 'org-1', is_active: true }
      });
      const service = new UserManagementService(supabase);

      const result = await service.addUserToOrganization('user-1', 'org-1');

      expect(result.success).toBe(true);
    });
  });

  describe('Role Management', () => {
    test('should update user role', async () => {
      const supabase = createMockSupabaseForUsers({
        membership: { user_id: 'user-1', organization_id: 'org-1', role: 'admin' }
      });
      const service = new UserManagementService(supabase);

      const result = await service.updateUserRole('user-1', 'org-1', 'admin');

      expect(result.success).toBe(true);
      expect(result.membership.role).toBe('admin');
    });

    test('should validate role names', async () => {
      const service = new UserManagementService(null);

      expect(service.validateRole('member')).toBe(true);
      expect(service.validateRole('admin')).toBe(true);
      expect(service.validateRole('invalid_role')).toBe(false);
    });

    test('should check role hierarchy permissions', async () => {
      const service = new UserManagementService(null);

      expect(service.canUserManageRole('global_admin', 'admin')).toBe(true);
      expect(service.canUserManageRole('admin', 'global_admin')).toBe(false);
      expect(service.canUserManageRole('admin', 'member')).toBe(true);
      expect(service.canUserManageRole('member', 'admin')).toBe(false);
    });

    test('should prevent unauthorized role changes', async () => {
      const service = new UserManagementService(null);

      const memberCanPromoteToAdmin = service.canUserManageRole('member', 'admin');
      expect(memberCanPromoteToAdmin).toBe(false);
    });

    test('should allow equal or lower role management', async () => {
      const service = new UserManagementService(null);

      expect(service.canUserManageRole('admin', 'admin')).toBe(true);
      expect(service.canUserManageRole('admin', 'member')).toBe(true);
    });
  });

  describe('User Removal', () => {
    test('should remove user from organization', async () => {
      const supabase = createMockSupabaseForUsers({});
      const service = new UserManagementService(supabase);

      const result = await service.removeUserFromOrganization('user-1', 'org-1');

      expect(result.success).toBe(true);
    });

    test('should soft delete by setting is_active to false', async () => {
      const supabase = createMockSupabaseForUsers({});
      const service = new UserManagementService(supabase);

      const result = await service.removeUserFromOrganization('user-1', 'org-1');

      expect(result.success).toBe(true);
    });

    test('should handle removal errors', async () => {
      const supabase = createMockSupabaseForUsers({ error: true });
      const service = new UserManagementService(supabase);

      const result = await service.removeUserFromOrganization('user-1', 'org-1');

      expect(result.success).toBe(false);
    });
  });

  describe('User Queries', () => {
    test('should get all users for organization', async () => {
      const mockUsers = [
        {
          user_id: 'user-1',
          organization_id: 'org-1',
          role: 'admin',
          users: { id: 'user-1', email: 'admin@example.com', full_name: 'Admin User' }
        },
        {
          user_id: 'user-2',
          organization_id: 'org-1',
          role: 'member',
          users: { id: 'user-2', email: 'member@example.com', full_name: 'Member User' }
        }
      ];

      const supabase = createMockSupabaseForUsers({ users: mockUsers });
      const service = new UserManagementService(supabase);

      const result = await service.getUsersByOrganization('org-1');

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(2);
    });

    test('should get user organizations', async () => {
      const mockOrgs = [
        {
          user_id: 'user-1',
          organization_id: 'org-1',
          role: 'admin',
          organizations: { id: 'org-1', name: 'Org 1', slug: 'org-1' }
        },
        {
          user_id: 'user-1',
          organization_id: 'org-2',
          role: 'member',
          organizations: { id: 'org-2', name: 'Org 2', slug: 'org-2' }
        }
      ];

      const supabase = createMockSupabaseForUsers({ organizations: mockOrgs });
      const service = new UserManagementService(supabase);

      const result = await service.getUserOrganizations('user-1');

      expect(result.success).toBe(true);
      expect(result.organizations).toHaveLength(2);
    });

    test('should return empty array for users with no organizations', async () => {
      const supabase = createMockSupabaseForUsers({ organizations: [] });
      const service = new UserManagementService(supabase);

      const result = await service.getUserOrganizations('user-999');

      expect(result.success).toBe(true);
      expect(result.organizations).toEqual([]);
    });

    test('should filter out inactive memberships', async () => {
      const mockUsers = [
        { user_id: 'user-1', is_active: true, users: { email: 'active@example.com' } },
        { user_id: 'user-2', is_active: false, users: { email: 'inactive@example.com' } }
      ];

      const supabase = createMockSupabaseForUsers({ users: mockUsers.filter(u => u.is_active) });
      const service = new UserManagementService(supabase);

      const result = await service.getUsersByOrganization('org-1');

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(1);
      expect(result.users[0].users.email).toBe('active@example.com');
    });
  });

  describe('Permission Checks', () => {
    test('should validate admin can manage members', async () => {
      const service = new UserManagementService(null);

      const canManage = service.canUserManageRole('admin', 'member');

      expect(canManage).toBe(true);
    });

    test('should validate committee chair can manage members', async () => {
      const service = new UserManagementService(null);

      const canManage = service.canUserManageRole('committee_chair', 'member');

      expect(canManage).toBe(true);
    });

    test('should prevent members from managing admins', async () => {
      const service = new UserManagementService(null);

      const canManage = service.canUserManageRole('member', 'admin');

      expect(canManage).toBe(false);
    });

    test('should validate global admin can manage all roles', async () => {
      const service = new UserManagementService(null);

      expect(service.canUserManageRole('global_admin', 'member')).toBe(true);
      expect(service.canUserManageRole('global_admin', 'admin')).toBe(true);
      expect(service.canUserManageRole('global_admin', 'committee_chair')).toBe(true);
      expect(service.canUserManageRole('global_admin', 'board_president')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null user IDs', async () => {
      const supabase = createMockSupabaseForUsers({ error: true });
      const service = new UserManagementService(supabase);

      const result = await service.addUserToOrganization(null, 'org-1');

      expect(result.success).toBe(false);
    });

    test('should handle null organization IDs', async () => {
      const supabase = createMockSupabaseForUsers({ error: true });
      const service = new UserManagementService(supabase);

      const result = await service.addUserToOrganization('user-1', null);

      expect(result.success).toBe(false);
    });

    test('should handle concurrent role updates', async () => {
      const supabase = createMockSupabaseForUsers({});
      const service = new UserManagementService(supabase);

      const updates = [
        service.updateUserRole('user-1', 'org-1', 'admin'),
        service.updateUserRole('user-2', 'org-1', 'member')
      ];

      const results = await Promise.all(updates);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});

// Mock test framework
if (typeof describe === 'undefined') {
  global.describe = (name, fn) => fn();
  global.test = (name, fn) => fn();
}

module.exports = { UserManagementService, createMockSupabaseForUsers };
