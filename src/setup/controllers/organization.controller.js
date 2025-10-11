/**
 * Organization Info Screen Controller
 * Handles organization information collection (Screen 2)
 */

const setupService = require('../services/setup-session.service');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/setup', req.session.setupId);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPG images are allowed'));
    }
  }
}).single('logo');

/**
 * Show organization form
 */
exports.show = async (req, res) => {
  try {
    const setupData = await setupService.getSetupData(req.session.setupId);

    res.render('setup/setup-organization', {
      title: 'Organization Info - Setup Wizard',
      progress: {
        current: 2,
        total: 5,
        percentage: 20
      },
      data: setupData?.organization || {},
      organizationTypes: [
        { value: 'hoa', label: 'Homeowners Association (HOA)' },
        { value: 'coa', label: 'Condominium Association (COA)' },
        { value: 'poa', label: 'Property Owners Association (POA)' },
        { value: 'social_club', label: 'Social Club' },
        { value: 'professional', label: 'Professional Organization' },
        { value: 'nonprofit', label: 'Nonprofit Corporation' },
        { value: 'corporation', label: 'For-Profit Corporation' },
        { value: 'government', label: 'Government Agency' },
        { value: 'school', label: 'School/University' },
        { value: 'religious', label: 'Religious Organization' },
        { value: 'other', label: 'Other' }
      ]
    });
  } catch (error) {
    console.error('Error showing organization screen:', error);
    res.status(500).render('error', {
      message: 'Failed to load organization form',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

/**
 * Save organization info and proceed
 */
exports.save = async (req, res) => {
  // Handle file upload
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: 'File upload error: ' + err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }

    try {
      const { name, type, email } = req.body;

      // Validation passed by middleware, save to session
      const organizationData = {
        name: name.trim(),
        type,
        email: email.toLowerCase().trim(),
        logo: req.file ? `/uploads/setup/${req.session.setupId}/${req.file.filename}` : null
      };

      await setupService.saveSetupStep(req.session.setupId, 'organization', organizationData);

      // Update progress
      await setupService.updateProgress(req.session.setupId, 2);

      // Track analytics
      if (req.analytics) {
        req.analytics.track('setup_step_2_complete', {
          setupId: req.session.setupId,
          organizationType: type,
          hasLogo: !!req.file
        });
      }

      // Return success and redirect URL
      res.json({
        success: true,
        redirect: '/setup/document-type'
      });
    } catch (error) {
      console.error('Error saving organization info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save organization information'
      });
    }
  });
};
