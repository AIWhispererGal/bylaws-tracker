/**
 * Welcome Screen Controller
 * Shows the welcome screen (Screen 1)
 */

const setupService = require('../services/setup-session.service');

/**
 * Show welcome screen
 */
exports.show = async (req, res) => {
  try {
    // Initialize setup session if not exists
    if (!req.session.setupId) {
      const setupId = await setupService.initializeSetup(req.session);
      req.session.setupId = setupId;
    }

    // Track analytics
    if (req.analytics) {
      req.analytics.track('setup_started', {
        setupId: req.session.setupId,
        timestamp: new Date().toISOString()
      });
    }

    res.render('setup/setup-welcome', {
      title: 'Welcome - Setup Wizard',
      progress: {
        current: 1,
        total: 5,
        percentage: 0
      }
    });
  } catch (error) {
    console.error('Error showing welcome screen:', error);
    res.status(500).render('error', {
      message: 'Failed to start setup wizard',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};
