/**
 * Global Admin Middleware
 * Provides helpers for global admin functionality
 */

/**
 * Check if current user is a global admin
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>}
 */
async function isGlobalAdmin(req) {
  if (!req.session?.userId) {
    return false;
  }

  try {
    const { data, error } = await req.supabase
      .from('user_organizations')
      .select('is_global_admin')
      .eq('user_id', req.session.userId)
      .eq('is_global_admin', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error checking global admin status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in isGlobalAdmin:', error);
    return false;
  }
}

/**
 * Get all organizations accessible to current user
 * For global admins: returns ALL organizations
 * For regular users: returns only their organizations
 * @param {Object} req - Express request object
 * @returns {Promise<Array>}
 */
async function getAccessibleOrganizations(req) {
  if (!req.session?.userId) {
    return [];
  }

  try {
    // Check if user is global admin
    const isAdmin = await isGlobalAdmin(req);

    if (isAdmin) {
      // Global admin: return ALL organizations
      const { data, error } = await req.supabase
        .from('organizations')
        .select('id, name, slug, organization_type')
        .order('name');

      if (error) throw error;
      return data || [];
    } else {
      // Regular user: return only their organizations
      const { data, error } = await req.supabase
        .from('user_organizations')
        .select(`
          organization_id,
          role,
          organizations:organization_id (
            id,
            name,
            slug,
            organization_type
          )
        `)
        .eq('user_id', req.session.userId)
        .eq('is_active', true);

      if (error) throw error;

      // Flatten the data structure
      return data?.map(uo => ({
        id: uo.organizations.id,
        name: uo.organizations.name,
        slug: uo.organizations.slug,
        organization_type: uo.organizations.organization_type,
        role: uo.role
      })) || [];
    }
  } catch (error) {
    console.error('Error getting accessible organizations:', error);
    return [];
  }
}

/**
 * Middleware to attach global admin status to request
 */
async function attachGlobalAdminStatus(req, res, next) {
  if (req.session?.userId) {
    req.isGlobalAdmin = await isGlobalAdmin(req);
    req.accessibleOrganizations = await getAccessibleOrganizations(req);
  } else {
    req.isGlobalAdmin = false;
    req.accessibleOrganizations = [];
  }
  next();
}

/**
 * Middleware to require global admin access
 */
function requireGlobalAdmin(req, res, next) {
  if (!req.isGlobalAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Global admin access required'
    });
  }
  next();
}

module.exports = {
  isGlobalAdmin,
  getAccessibleOrganizations,
  attachGlobalAdminStatus,
  requireGlobalAdmin
};
