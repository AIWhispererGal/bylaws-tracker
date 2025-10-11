/**
 * Setup Required Middleware
 * Redirects to setup wizard if application is not configured
 */

class SetupMiddleware {
  constructor() {
    this.isConfigured = null;
    this.lastCheck = null;
    this.checkInterval = 60000; // Check every minute
  }

  /**
   * Check if application is configured
   */
  async checkConfiguration(supabase) {
    // Use cached result if recent
    const now = Date.now();
    if (this.isConfigured !== null && this.lastCheck && (now - this.lastCheck) < this.checkInterval) {
      return this.isConfigured;
    }

    try {
      // Check if organizations table has any entries
      const { data, error } = await supabase
        .from('organizations')
        .select('id, is_configured')
        .eq('is_configured', true)
        .limit(1);

      if (error) {
        console.error('Error checking configuration:', error);
        this.isConfigured = false;
      } else {
        this.isConfigured = data && data.length > 0;
      }

      this.lastCheck = now;
      return this.isConfigured;
    } catch (error) {
      console.error('Error in checkConfiguration:', error);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Middleware function
   */
  async middleware(req, res, next) {
    // Allow setup routes always
    if (req.path.startsWith('/setup') || req.path.startsWith('/api/setup')) {
      return next();
    }

    // Allow static assets
    if (req.path.startsWith('/css') ||
        req.path.startsWith('/js') ||
        req.path.startsWith('/images') ||
        req.path === '/favicon.ico') {
      return next();
    }

    // Check if configured
    const configured = await this.checkConfiguration(req.supabase);

    if (!configured) {
      // Redirect to setup wizard
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(503).json({
          success: false,
          error: 'Application not configured',
          redirectUrl: '/setup'
        });
      } else {
        return res.redirect('/setup');
      }
    }

    // Application is configured, continue
    next();
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.isConfigured = null;
    this.lastCheck = null;
  }
}

// Export singleton instance
const setupMiddleware = new SetupMiddleware();

module.exports = (req, res, next) => {
  setupMiddleware.middleware(req, res, next);
};

module.exports.clearCache = () => setupMiddleware.clearCache();
