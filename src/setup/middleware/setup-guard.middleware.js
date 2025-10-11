/**
 * Setup Guard Middleware
 * Protects routes based on setup completion status
 */

const db = require('../../../config/database');

/**
 * Check if organization is already configured
 * If yes, redirect to dashboard
 */
exports.redirectIfConfigured = async (req, res, next) => {
  try {
    // Check if organization exists and setup is complete
    const result = await db.query(
      'SELECT COUNT(*) as count FROM organization WHERE setup_completed = true'
    );

    if (result.rows[0].count > 0) {
      // Setup already completed, redirect to dashboard
      return res.redirect('/dashboard');
    }

    // Setup not completed, continue to setup wizard
    next();
  } catch (error) {
    // If table doesn't exist, setup is definitely not complete
    if (error.code === '42P01') {
      return next();
    }

    console.error('Error checking setup status:', error);
    // On error, allow setup to proceed
    next();
  }
};

/**
 * Ensure setup is not completed
 * Redirect to dashboard if completed
 */
exports.requireIncomplete = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT setup_completed FROM organization LIMIT 1'
    );

    if (result.rows.length > 0 && result.rows[0].setup_completed) {
      return res.redirect('/dashboard');
    }

    next();
  } catch (error) {
    console.error('Error checking setup completion:', error);
    next();
  }
};

/**
 * Ensure setup is completed
 * Redirect to setup wizard if not completed
 */
exports.requireComplete = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM organization WHERE setup_completed = true'
    );

    if (result.rows[0].count === 0) {
      return res.redirect('/setup');
    }

    next();
  } catch (error) {
    // If error (e.g., table doesn't exist), redirect to setup
    return res.redirect('/setup');
  }
};
