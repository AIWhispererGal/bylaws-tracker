/**
 * Centralized Permissions Middleware
 *
 * This middleware provides a unified permissions system using the new
 * user_types and organization_roles architecture from migration 024.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Check if user has a specific global permission
 */
async function hasGlobalPermission(userId, permission) {
  try {
    const { data, error } = await supabase.rpc('user_has_global_permission', {
      p_user_id: userId,
      p_permission: permission
    });

    if (error) {
      console.error('[Permissions] Error checking global permission:', error);
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.error('[Permissions] Exception checking global permission:', error);
    return false;
  }
}

/**
 * Check if user has a specific organization permission
 */
async function hasOrgPermission(userId, organizationId, permission) {
  try {
    const { data, error } = await supabase.rpc('user_has_org_permission', {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_permission: permission
    });

    if (error) {
      console.error('[Permissions] Error checking org permission:', error);
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.error('[Permissions] Exception checking org permission:', error);
    return false;
  }
}

/**
 * Check if user has minimum role level in organization
 */
async function hasMinRoleLevel(userId, organizationId, minLevel) {
  try {
    const { data, error} = await supabase.rpc('user_has_min_role_level', {
      p_user_id: userId,
      p_organization_id: organizationId,
      p_min_level: minLevel
    });

    if (error) {
      console.error('[Permissions] Error checking role level:', error);
      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.error('[Permissions] Exception checking role level:', error);
    return false;
  }
}

/**
 * Get user's effective permissions (merged global + org)
 */
async function getEffectivePermissions(userId, organizationId) {
  try {
    const { data, error } = await supabase.rpc('get_user_effective_permissions', {
      p_user_id: userId,
      p_organization_id: organizationId
    });

    if (error) {
      console.error('[Permissions] Error getting effective permissions:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Permissions] Exception getting effective permissions:', error);
    return null;
  }
}

/**
 * Get user's type (global_admin, regular_user, etc.)
 */
async function getUserType(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_types!inner(type_code)')
      .eq('id', userId)
      .maybeSingle();  // ✅ FIX: Use maybeSingle() to handle 0 rows

    if (error) {
      console.error('[Permissions] Error getting user type:', error);
      return null;
    }

    if (!data) {
      console.warn(`[Permissions] User ${userId} has no user_type record`);
      return null;
    }

    return data?.user_types?.type_code || null;
  } catch (error) {
    console.error('[Permissions] Exception getting user type:', error);
    return null;
  }
}

/**
 * Get user's role in organization (owner, admin, member, viewer)
 */
async function getUserRole(userId, organizationId) {
  try {
    const { data, error } = await supabase
      .from('user_organizations')
      .select('organization_roles!inner(role_code, role_name, hierarchy_level)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();  // ✅ FIX: Use maybeSingle() to handle 0 rows

    if (error) {
      console.error('[Permissions] Error getting user role:', error);
      return null;
    }

    if (!data) {
      console.warn(`[Permissions] User ${userId} has no role in org ${organizationId}`);
      return null;
    }

    return data?.organization_roles || null;
  } catch (error) {
    console.error('[Permissions] Exception getting user role:', error);
    return null;
  }
}

// ============================================================================
// EXPRESS MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Middleware: Require specific permission
 */
function requirePermission(permission, orgLevel = false) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.session?.currentOrganization || req.body?.organization_id || req.params?.organization_id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      let hasPermission = false;

      if (orgLevel) {
        if (!organizationId) {
          return res.status(400).json({
            error: 'Organization context required',
            code: 'ORG_REQUIRED'
          });
        }
        hasPermission = await hasOrgPermission(userId, organizationId, permission);
      } else {
        hasPermission = await hasGlobalPermission(userId, permission);
      }

      if (!hasPermission) {
        console.log(`[Permissions] User ${userId} denied: ${permission} (orgLevel: ${orgLevel})`);
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
          required: permission
        });
      }

      next();
    } catch (error) {
      console.error('[Permissions] Error in requirePermission middleware:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
}

/**
 * Middleware: Require minimum role level
 */
function requireMinRoleLevel(minLevel) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.session?.currentOrganization || req.body?.organization_id || req.params?.organization_id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!organizationId) {
        return res.status(400).json({
          error: 'Organization context required',
          code: 'ORG_REQUIRED'
        });
      }

      const hasLevel = await hasMinRoleLevel(userId, organizationId, minLevel);

      if (!hasLevel) {
        console.log(`[Permissions] User ${userId} denied: minimum level ${minLevel} required`);
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE_LEVEL',
          required_level: minLevel
        });
      }

      next();
    } catch (error) {
      console.error('[Permissions] Error in requireMinRoleLevel middleware:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
}

/**
 * Middleware: Require specific role
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.session?.currentOrganization || req.body?.organization_id || req.params?.organization_id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!organizationId) {
        return res.status(400).json({
          error: 'Organization context required',
          code: 'ORG_REQUIRED'
        });
      }

      const userRole = await getUserRole(userId, organizationId);

      if (!userRole || !allowedRoles.includes(userRole.role_code)) {
        console.log(`[Permissions] User ${userId} denied: role ${userRole?.role_code || 'none'} not in [${allowedRoles.join(', ')}]`);
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'ROLE_NOT_ALLOWED',
          required_roles: allowedRoles,
          user_role: userRole?.role_code || null
        });
      }

      next();
    } catch (error) {
      console.error('[Permissions] Error in requireRole middleware:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
}

/**
 * Middleware: Check if user is global admin
 */
function requireGlobalAdmin(req, res, next) {
  return requirePermission('can_access_all_organizations', false)(req, res, next);
}

/**
 * Middleware: Attach user permissions to request object
 */
function attachPermissions(req, res, next) {
  (async () => {
    try {
      // Get user ID from session or req.user
      const userId = req.session?.userId || req.user?.id;
      // Get org ID from session (try both possible keys)
      const organizationId = req.session?.organizationId || req.session?.currentOrganization || req.organizationId;

      if (!userId) {
        req.permissions = {};
        req.userType = null;
        req.userRole = null;
        return next();
      }

      req.userType = await getUserType(userId);

      if (organizationId) {
        req.permissions = await getEffectivePermissions(userId, organizationId) || {};
        req.userRole = await getUserRole(userId, organizationId);
      } else {
        req.permissions = {};
        req.userRole = null;
      }

      next();
    } catch (error) {
      console.error('[Permissions] Error attaching permissions:', error);
      req.permissions = {};
      req.userType = null;
      req.userRole = null;
      next();
    }
  })();
}

// ============================================================================
// BACKWARDS COMPATIBILITY HELPERS
// ============================================================================

/**
 * Legacy: Check if user is global admin (backwards compatible)
 */
async function isGlobalAdmin(userId) {
  const userType = await getUserType(userId);
  return userType === 'global_admin';
}

/**
 * Legacy: Check if user is org admin (backwards compatible)
 */
async function isOrgAdmin(userId, organizationId) {
  return await hasMinRoleLevel(userId, organizationId, 3);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Permission checks
  hasGlobalPermission,
  hasOrgPermission,
  hasMinRoleLevel,
  getEffectivePermissions,
  getUserType,
  getUserRole,

  // Express middleware
  requirePermission,
  requireMinRoleLevel,
  requireRole,
  requireGlobalAdmin,
  attachPermissions,

  // Backwards compatibility
  isGlobalAdmin,
  isOrgAdmin
};
