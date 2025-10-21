/**
 * Organization Context Middleware
 * Provides current organization information to views
 */

/**
 * Attach current organization info to res.locals
 * Makes organization data available in all templates
 */
async function attachOrganizationContext(req, res, next) {
  // Initialize empty organization context
  res.locals.currentOrganization = null;

  if (req.session?.organizationId) {
    try {
      const { data, error } = await req.supabase
        .from('organizations')
        .select('id, name, slug, organization_type')
        .eq('id', req.session.organizationId)
        .single();

      if (!error && data) {
        res.locals.currentOrganization = data;
      }
    } catch (error) {
      console.error('Error fetching current organization:', error);
      // Continue without organization context
    }
  }

  // Also attach user info for consistent access in templates
  if (req.session?.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName || req.session.userEmail,
      role: req.session.userRole || 'viewer',
      is_global_admin: req.isGlobalAdmin || false
    };
  } else {
    res.locals.currentUser = null;
  }

  next();
}

module.exports = {
  attachOrganizationContext
};
