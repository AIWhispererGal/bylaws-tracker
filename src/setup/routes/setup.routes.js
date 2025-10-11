/**
 * Setup Wizard Routes
 * Handles all routes for the graphical setup wizard
 */

const express = require('express');
const router = express.Router();
const setupGuard = require('../middleware/setup-guard.middleware');
const sessionMiddleware = require('../middleware/session.middleware');
const validationMiddleware = require('../middleware/validation.middleware');

// Controllers
const welcomeController = require('../controllers/welcome.controller');
const organizationController = require('../controllers/organization.controller');
const documentController = require('../controllers/document.controller');
const workflowController = require('../controllers/workflow.controller');
const importController = require('../controllers/import.controller');
const finalizeController = require('../controllers/finalize.controller');

// Apply session middleware to all setup routes
router.use(sessionMiddleware.setupSession);

// Main setup route - detects and redirects to appropriate step
router.get('/', setupGuard.redirectIfConfigured, (req, res) => {
  const currentStep = req.session.setupProgress?.currentStep || 1;
  const stepRoutes = {
    1: '/setup/welcome',
    2: '/setup/organization',
    3: '/setup/document-type',
    4: '/setup/workflow',
    5: '/setup/import',
    6: '/setup/finalize',
    7: '/setup/complete'
  };
  res.redirect(stepRoutes[currentStep] || '/setup/welcome');
});

// Screen 1: Welcome
router.get('/welcome', setupGuard.redirectIfConfigured, welcomeController.show);

// Screen 2: Organization Info
router.get('/organization', setupGuard.redirectIfConfigured, organizationController.show);
router.post(
  '/organization',
  validationMiddleware.validateOrganization,
  organizationController.save
);

// Screen 3: Document Type
router.get('/document-type', setupGuard.redirectIfConfigured, documentController.show);
router.post(
  '/document-type',
  validationMiddleware.validateDocumentType,
  documentController.save
);

// Screen 4: Workflow Configuration
router.get('/workflow', setupGuard.redirectIfConfigured, workflowController.show);
router.post(
  '/workflow',
  validationMiddleware.validateWorkflow,
  workflowController.save
);

// Screen 5: Document Import
router.get('/import', setupGuard.redirectIfConfigured, importController.show);
router.post('/import/upload', importController.upload);
router.post('/import/parse', importController.parse);
router.post('/import/confirm', importController.confirm);

// Screen 6: Database Setup (SSE endpoint)
router.get('/finalize', setupGuard.redirectIfConfigured, finalizeController.start);

// Screen 7: Success
router.get('/complete', finalizeController.complete);

module.exports = router;
