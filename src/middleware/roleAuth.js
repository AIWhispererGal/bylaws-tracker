/**
 * Role-Based Authorization Middleware
 * Checks user permissions within their current organization
 *
 * MIGRATION NOTE: This file now uses the new permissions architecture from migration 024.
 * - Uses user_types and organization_roles tables
 * - Maintains backwards compatibility with old permission checks
 * - Will be fully migrated in future version
 */

const { isGlobalAdmin } = require('./globalAdmin');
const {
  hasMinRoleLevel,
  hasOrgPermission,
  getUserRole: getNewUserRole,
  getUserType
} = require('./permissions');

/**
 * Check if user has required role level
 * Role hierarchy: owner > admin > member > viewer
 * Global admins always pass role checks
 *
 * HYBRID MODE: Uses new permissions system with backwards compatibility fallback
 */
async function hasRole(req, requiredRole) {
  if (!req.session.userId) {
    return false;
  }

  // Global admins bypass all role checks
  if (await isGlobalAdmin(req)) {
    return true;
  }

  if (!req.session.organizationId) {
    return false;
  }

  const roleHierarchy = {
    'owner': 4,
    'admin': 3,
    'member': 2,
    'viewer': 1
  };

  const requiredLevel = roleHierarchy[requiredRole] || 0;

  try {
    // TRY NEW PERMISSIONS SYSTEM FIRST (from migration 024)
    const hasLevel = await hasMinRoleLevel(
      req.session.userId,
      req.session.organizationId,
      requiredLevel
    );

    if (hasLevel !== null && hasLevel !== undefined) {
      return hasLevel;
    }

    // FALLBACK: Use old system if new system unavailable
    console.log('[roleAuth] Falling back to legacy permission check');
    const { supabase } = req;
    const { data, error } = await supabase
      .from('user_organizations')
      .select('role, is_active')
      .eq('user_id', req.session.userId)
      .eq('organization_id', req.session.organizationId)
      .single();

    if (error || !data || !data.is_active) {
      return false;
    }

    const userRoleLevel = roleHierarchy[data.role] || 0;
    return userRoleLevel >= requiredLevel;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * Middleware: Require owner role
 */
async function requireOwner(req, res, next) {
  if (!await hasRole(req, 'owner')) {
    return res.status(403).json({
      success: false,
      error: 'Organization owner access required'
    });
  }
  next();
}

/**
 * Middleware: Require admin role (owner or admin)
 * Global admins automatically have admin access
 */
async function requireAdmin(req, res, next) {
  if (!await hasRole(req, 'admin')) {
    return res.status(403).json({
      success: false,
      error: 'Only organization admins can invite users'
    });
  }
  next();
}

/**
 * Middleware: Require member role (any authenticated member)
 */
async function requireMember(req, res, next) {
  if (!await hasRole(req, 'member')) {
    return res.status(403).json({
      success: false,
      error: 'Organization membership required'
    });
  }
  next();
}

/**
 * Middleware: Check specific permission
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.session.userId || !req.session.organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { supabase } = req;

    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select('permissions, is_active')
        .eq('user_id', req.session.userId)
        .eq('organization_id', req.session.organizationId)
        .single();

      if (error || !data || !data.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const permissions = data.permissions || {};
      if (!permissions[permission]) {
        return res.status(403).json({
          success: false,
          error: `Permission denied: ${permission}`
        });
      }

      next();
    } catch (error) {
      console.error('Error checking permission:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed'
      });
    }
  };
}

/**
 * Check if user can approve at specific workflow stage
 */
async function canApproveStage(req, stageId) {
  if (!req.session.userId) {
    return false;
  }

  const { supabase } = req;

  try {
    // Get stage required roles
    const { data: stage, error: stageError } = await supabase
      .from('workflow_stages')
      .select(`
        required_roles,
        workflow_templates:workflow_template_id (
          organization_id
        )
      `)
      .eq('id', stageId)
      .single();

    if (stageError || !stage) {
      return false;
    }

    const orgId = stage.workflow_templates.organization_id;

    // Get user's role in organization
    const { data: userOrg, error: userError } = await supabase
      .from('user_organizations')
      .select('role, is_active')
      .eq('user_id', req.session.userId)
      .eq('organization_id', orgId)
      .single();

    if (userError || !userOrg || !userOrg.is_active) {
      return false;
    }

    // Check if user's role is in required roles
    const requiredRoles = stage.required_roles || [];
    return requiredRoles.includes(userOrg.role);
  } catch (error) {
    console.error('Error checking stage approval permission:', error);
    return false;
  }
}

/**
 * Middleware: Require approval permission for workflow stage
 */
function requireStageApproval(stageIdParam = 'stageId') {
  return async (req, res, next) => {
    const stageId = req.params[stageIdParam] || req.body.workflow_stage_id;

    if (!stageId) {
      return res.status(400).json({
        success: false,
        error: 'Workflow stage ID required'
      });
    }

    if (!await canApproveStage(req, stageId)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to approve at this workflow stage'
      });
    }

    next();
  };
}

/**
 * Get user's role in current organization
 * HYBRID MODE: Tries new system first, falls back to old
 */
async function getUserRole(req) {
  if (!req.session.userId || !req.session.organizationId) {
    return null;
  }

  try {
    // TRY NEW PERMISSIONS SYSTEM FIRST
    const newRole = await getNewUserRole(
      req.session.userId,
      req.session.organizationId
    );

    if (newRole) {
      return {
        role: newRole.role_code,
        role_name: newRole.role_name,
        hierarchy_level: newRole.hierarchy_level,
        permissions: {} // Will be populated from organization_roles.org_permissions
      };
    }

    // FALLBACK: Use old system
    console.log('[roleAuth] Falling back to legacy role lookup');
    const { supabase } = req;
    const { data, error } = await supabase
      .from('user_organizations')
      .select('role, permissions, is_active')
      .eq('user_id', req.session.userId)
      .eq('organization_id', req.session.organizationId)
      .single();

    if (error || !data || !data.is_active) {
      return null;
    }

    return {
      role: data.role,
      permissions: data.permissions || {}
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Attach user role to request object
 */
async function attachUserRole(req, res, next) {
  if (req.session.userId && req.session.organizationId) {
    req.userRole = await getUserRole(req);
  }
  next();
}

module.exports = {
  hasRole,
  requireOwner,
  requireAdmin,
  requireMember,
  requirePermission,
  canApproveStage,
  requireStageApproval,
  getUserRole,
  attachUserRole
};
