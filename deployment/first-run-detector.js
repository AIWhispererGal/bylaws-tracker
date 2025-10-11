/**
 * First-Run Detection Middleware
 *
 * Detects if the application is in an unconfigured state and redirects
 * users to the setup wizard. This ensures new deployments guide users
 * through initial configuration.
 *
 * Usage:
 *   const { firstRunDetector } = require('./middleware/first-run-detector');
 *   app.use(firstRunDetector);
 */

/**
 * Check if the application is fully configured
 * @returns {boolean} True if all required configuration is present
 */
const isConfigured = () => {
  // Check if critical environment variables are set and valid
  const hasSupabase =
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_URL !== 'https://your-project.supabase.co' &&
    process.env.SUPABASE_URL.includes('.supabase.co') &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_ANON_KEY !== 'your-anon-key-here' &&
    process.env.SUPABASE_ANON_KEY.length > 50;

  // Check setup completion flag
  const setupCompleted = process.env.SETUP_COMPLETED === 'true';

  return hasSupabase && setupCompleted;
};

/**
 * Middleware to detect first-run state and redirect to setup
 */
const firstRunDetector = (req, res, next) => {
  // List of paths that should bypass the setup check
  const exemptPaths = [
    '/setup',           // Setup wizard main page
    '/api/setup',       // Setup API endpoints
    '/health',          // Health check endpoint
    '/favicon.ico',     // Browser favicon requests
    '/public',          // Static assets
    '/css',             // Stylesheets
    '/js',              // JavaScript files
    '/images'           // Images
  ];

  // Check if current path is exempt
  const isExempt = exemptPaths.some(path => req.path.startsWith(path));

  // Also exempt static file extensions
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  const isStaticFile = staticExtensions.some(ext => req.path.endsWith(ext));

  if (isExempt || isStaticFile) {
    return next();
  }

  // Redirect to setup wizard if not configured
  if (!isConfigured()) {
    // Prevent redirect loops
    if (req.path !== '/setup') {
      console.log('[First-Run Detector] Redirecting to setup wizard...');
      return res.redirect('/setup');
    }
  }

  next();
};

/**
 * Get configuration status details
 * @returns {Object} Status object with configuration details
 */
const getConfigStatus = () => {
  return {
    configured: isConfigured(),
    setupCompleted: process.env.SETUP_COMPLETED === 'true',
    hasSupabase: !!(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_URL !== 'https://your-project.supabase.co'
    ),
    hasValidSupabaseKey: !!(
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_ANON_KEY.length > 50
    ),
    organizationName: process.env.ORGANIZATION_NAME || 'Not Set'
  };
};

/**
 * Express route to check configuration status (for health checks)
 */
const configStatusRoute = (req, res) => {
  const status = getConfigStatus();
  const httpStatus = status.configured ? 200 : 503;

  res.status(httpStatus).json({
    status: status.configured ? 'configured' : 'unconfigured',
    message: status.configured
      ? 'Application is fully configured'
      : 'Setup required - visit /setup',
    details: status
  });
};

module.exports = {
  firstRunDetector,
  isConfigured,
  getConfigStatus,
  configStatusRoute
};
