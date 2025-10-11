/**
 * Setup Wizard Routes
 * Handles the initial organization setup process
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/setup');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'setup-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'image/png',
            'image/jpeg',
            'image/svg+xml'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

/**
 * GET /setup - Show setup wizard welcome screen
 */
router.get('/', (req, res) => {
    // Check if already configured
    if (req.app.locals.isConfigured) {
        return res.redirect('/dashboard');
    }

    res.render('setup/welcome', {
        layout: 'setup/layout',
        title: 'Welcome',
        currentStep: 1,
        csrfToken: '' // CSRF disabled for setup routes
    });
});

/**
 * GET /setup/organization - Organization info form
 */
router.get('/organization', (req, res) => {
    res.render('setup/organization', {
        layout: 'setup/layout',
        title: 'Organization Information',
        currentStep: 2,
        csrfToken: '', // CSRF disabled for setup routes
        formData: req.session.setupData?.organization || {}
    });
});

/**
 * POST /setup/organization - Save organization info
 */
router.post('/organization', upload.single('logo'), async (req, res) => {
    try {
        const organizationData = {
            organization_name: req.body.organization_name,
            organization_type: req.body.organization_type,
            state: req.body.state,
            country: req.body.country,
            contact_email: req.body.contact_email,
            logo_path: req.file ? req.file.path : null
        };

        // Validate required fields
        if (!organizationData.organization_name || !organizationData.organization_type) {
            return res.status(400).json({
                success: false,
                error: 'Organization name and type are required'
            });
        }

        // Store in session
        req.session.setupData = req.session.setupData || {};
        req.session.setupData.organization = organizationData;
        req.session.setupData.completedSteps = ['organization'];

        // Return JSON response with redirect URL
        res.json({ success: true, redirectUrl: '/setup/document-type' });
    } catch (error) {
        console.error('Organization setup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /setup/document-type - Document structure selection
 */
router.get('/document-type', (req, res) => {
    res.render('setup/document-type-full', {
        title: 'Document Structure',
        currentStep: 3,
        csrfToken: '', // CSRF disabled for setup routes
        formData: req.session.setupData?.documentType || {}
    });
});

/**
 * POST /setup/document-type - Save document structure
 */
router.post('/document-type', express.json(), async (req, res) => {
    try {
        const documentTypeData = {
            structure_type: req.body.structure_type,
            level1_name: req.body.level1_name || 'Article',
            level2_name: req.body.level2_name || 'Section',
            numbering_style: req.body.numbering_style || 'roman'
        };

        // Validate
        if (!documentTypeData.structure_type) {
            return res.status(400).json({
                success: false,
                error: 'Document structure type is required'
            });
        }

        // Store in session
        req.session.setupData = req.session.setupData || {};
        req.session.setupData.documentType = documentTypeData;
        req.session.setupData.completedSteps = req.session.setupData.completedSteps || [];
        if (!req.session.setupData.completedSteps.includes('document')) {
            req.session.setupData.completedSteps.push('document');
        }

        res.json({ success: true, redirectUrl: '/setup/workflow' });
    } catch (error) {
        console.error('Document type setup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /setup/workflow - Workflow configuration
 */
router.get('/workflow', (req, res) => {
    res.render('setup/workflow', {
        layout: 'setup/layout',
        title: 'Approval Workflow',
        currentStep: 4,
        csrfToken: '', // CSRF disabled for setup routes
        formData: req.session.setupData?.workflow || {}
    });
});

/**
 * POST /setup/workflow - Save workflow configuration
 */
router.post('/workflow', express.json(), async (req, res) => {
    try {
        const workflowData = {
            template: req.body.template,
            stages: req.body.stages || [],
            notifications: req.body.notifications || {}
        };

        // Validate
        if (!workflowData.stages || workflowData.stages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one workflow stage is required'
            });
        }

        // Validate each stage
        for (const stage of workflowData.stages) {
            if (!stage.name || !stage.approvalType) {
                return res.status(400).json({
                    success: false,
                    error: 'Each stage must have a name and approval type'
                });
            }
        }

        // Store in session
        req.session.setupData = req.session.setupData || {};
        req.session.setupData.workflow = workflowData;
        req.session.setupData.completedSteps = req.session.setupData.completedSteps || [];
        if (!req.session.setupData.completedSteps.includes('workflow')) {
            req.session.setupData.completedSteps.push('workflow');
        }

        res.json({ success: true, redirectUrl: '/setup/import' });
    } catch (error) {
        console.error('Workflow setup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /setup/import - Document import screen
 */
router.get('/import', (req, res) => {
    res.render('setup/import', {
        layout: 'setup/layout',
        title: 'Import Bylaws',
        currentStep: 5,
        csrfToken: '', // CSRF disabled for setup routes
        formData: req.session.setupData?.import || {}
    });
});

/**
 * POST /setup/import - Process document upload
 */
router.post('/import', upload.single('document'), async (req, res) => {
    try {
        let importData = {};

        if (req.body.googleDocUrl) {
            // Google Docs import
            importData = {
                source: 'google_docs',
                url: req.body.googleDocUrl,
                auto_detect_structure: req.body.auto_detect_structure !== 'false',
                preserve_formatting: req.body.preserve_formatting === 'true',
                create_initial_version: req.body.create_initial_version !== 'false'
            };

            // TODO: Implement Google Docs fetching
            // For now, just validate URL
            if (!importData.url.includes('docs.google.com/document')) {
                throw new Error('Invalid Google Docs URL');
            }
        } else if (req.file) {
            // File upload
            importData = {
                source: 'file_upload',
                file_path: req.file.path,
                file_name: req.file.originalname,
                auto_detect_structure: req.body.auto_detect_structure !== 'false',
                preserve_formatting: req.body.preserve_formatting === 'true',
                create_initial_version: req.body.create_initial_version !== 'false'
            };
        } else {
            // No document - skip import (optional step)
            importData = {
                source: 'skipped',
                skipped: true
            };
        }

        // Store in session
        req.session.setupData = req.session.setupData || {};
        req.session.setupData.import = importData;
        req.session.setupData.completedSteps = req.session.setupData.completedSteps || [];
        if (!req.session.setupData.completedSteps.includes('import')) {
            req.session.setupData.completedSteps.push('import');
        }

        // Trigger async processing
        console.log('[SETUP-DEBUG] 🔔 Triggering async processSetupData via setImmediate');
        console.log('[SETUP-DEBUG] 📊 Current session setupData:', JSON.stringify(req.session.setupData, null, 2));
        setImmediate(() => {
            console.log('[SETUP-DEBUG] 🏃 setImmediate callback executing...');
            processSetupData(req.session.setupData, req.supabase)
                .then(() => {
                    console.log('[SETUP-DEBUG] ✅ processSetupData completed successfully');
                    req.session.setupData.status = 'complete';
                    console.log('[SETUP-DEBUG] ✅ Set status to "complete"');
                    // Save session to persist status change
                    req.session.save((err) => {
                        if (err) console.error('[SETUP] Session save error:', err);
                        console.log('[SETUP-DEBUG] ✅ Session saved successfully');
                    });
                })
                .catch(err => {
                    console.error('[SETUP-DEBUG] ❌ Setup processing error:', err);
                    console.error('[SETUP-DEBUG] ❌ Error stack:', err.stack);
                    req.session.setupData.status = 'error';
                    req.session.setupData.error = err.message;
                    req.session.setupData.errorDetails = err.stack || JSON.stringify(err, null, 2);
                    console.log('[SETUP-DEBUG] ❌ Set status to "error"');
                    // Save session to persist error status
                    req.session.save((err) => {
                        if (err) console.error('[SETUP] Session save error:', err);
                        console.log('[SETUP-DEBUG] ❌ Error session saved');
                    });
                });
        });

        res.json({ success: true, redirectUrl: '/setup/processing' });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /setup/processing - Processing screen
 */
router.get('/processing', (req, res) => {
    res.render('setup/processing-full', {
        title: 'Processing Setup',
        currentStep: 5,
        csrfToken: '' // CSRF disabled for setup routes
    });
});

/**
 * GET /setup/status - Check setup progress
 */
router.get('/status', (req, res) => {
    console.log('[SETUP-DEBUG] 📡 /setup/status endpoint called');

    const setupData = req.session.setupData || {};
    console.log('[SETUP-DEBUG] 📊 setupData from session:', JSON.stringify(setupData, null, 2));

    const completedSteps = setupData.completedSteps || [];
    console.log('[SETUP-DEBUG] 📊 completedSteps:', completedSteps);

    const status = setupData.status || 'processing';
    console.log('[SETUP-DEBUG] 📊 status:', status);

    const allSteps = ['organization', 'document', 'workflow', 'import', 'database', 'finalize'];

    // Calculate progress percentage
    const progressPercentage = (completedSteps.length / allSteps.length) * 100;
    console.log('[SETUP-DEBUG] 📊 progressPercentage:', progressPercentage);

    // Determine current step (first incomplete step)
    const currentStep = allSteps.find(step => !completedSteps.includes(step)) || 'finalize';
    console.log('[SETUP-DEBUG] 📊 currentStep:', currentStep);

    // Calculate estimated time remaining (5 seconds per remaining step)
    const remainingSteps = allSteps.length - completedSteps.length;
    const estimatedSeconds = Math.max(remainingSteps * 5, 0);
    console.log('[SETUP-DEBUG] 📊 estimatedSeconds:', estimatedSeconds);

    // Format error details if available
    const errorDetails = setupData.errorDetails || null;

    const response = {
        status: status,
        completedSteps: completedSteps,
        currentStep: currentStep,
        progressPercentage: Math.round(progressPercentage),
        estimatedSeconds: estimatedSeconds,
        totalSteps: allSteps.length,
        error: setupData.error || null,
        errorDetails: errorDetails
    };

    console.log('[SETUP-DEBUG] 📤 Sending response:', JSON.stringify(response, null, 2));

    res.json(response);
});

/**
 * GET /setup/success - Success screen
 */
router.get('/success', (req, res) => {
    const setupData = req.session.setupData || {};

    res.render('setup/success', {
        layout: 'setup/layout',
        title: 'Setup Complete',
        currentStep: 6,
        csrfToken: '', // CSRF disabled for setup routes
        organization: setupData.organization || {},
        documentStructure: formatDocumentStructure(setupData.documentType),
        workflowStages: setupData.workflow?.stages?.length || 0,
        sectionsImported: setupData.sectionsCount || 0
    });
});

/**
 * POST /setup/clear-session - Clear setup session data
 */
router.post('/clear-session', (req, res) => {
    // Clear setup data
    delete req.session.setupData;

    // CRITICAL: Mark as configured so /bylaws doesn't redirect back to setup
    req.session.isConfigured = true;

    res.json({ success: true });
});

/**
 * Helper: Process setup data and create database entries in Supabase
 */
async function processSetupData(setupData, supabase) {
    console.log('[SETUP-DEBUG] 🚀 START processSetupData()');
    console.log('[SETUP-DEBUG] 📊 Initial setupData:', JSON.stringify(setupData, null, 2));
    console.log('[SETUP-DEBUG] 📊 Initial completedSteps:', setupData.completedSteps);

    const steps = ['organization', 'document', 'workflow', 'import', 'database', 'finalize'];
    console.log('[SETUP-DEBUG] 📝 Steps to process:', steps);

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`[SETUP-DEBUG] ⏳ BEFORE step ${i + 1}/${steps.length}: "${step}"`);
        console.log(`[SETUP-DEBUG] 📊 completedSteps before step: [${setupData.completedSteps.join(', ')}]`);

        try {
            console.log(`[SETUP-DEBUG] ⏱️  Starting 1-second delay for step: "${step}"`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
            console.log(`[SETUP-DEBUG] ✅ Delay completed for step: "${step}"`);

            if (!setupData.completedSteps.includes(step)) {
                console.log(`[SETUP-DEBUG] ➕ Adding "${step}" to completedSteps`);
                setupData.completedSteps.push(step);
                console.log(`[SETUP-DEBUG] 📊 completedSteps after push: [${setupData.completedSteps.join(', ')}]`);
            } else {
                console.log(`[SETUP-DEBUG] ⏭️  Step "${step}" already in completedSteps, skipping add`);
            }

            console.log(`[SETUP-DEBUG] 🔧 Processing step logic: "${step}"`);

            switch (step) {
                case 'organization':
                    console.log('[SETUP-DEBUG] 🏢 Processing organization step');
                    // Create organization record in Supabase
                    const orgData = setupData.organization;
                    console.log('[SETUP-DEBUG] 📋 orgData:', JSON.stringify(orgData, null, 2));

                    // IDEMPOTENCY CHECK: Skip if organization already created
                    if (setupData.organizationId) {
                        console.log('[SETUP-DEBUG] ⏭️  Organization already created with ID:', setupData.organizationId);
                        break;
                    }

                    if (orgData) {
                        console.log('[SETUP-DEBUG] ✅ orgData exists, creating organization...');
                        // Generate slug from organization name with timestamp for uniqueness
                        const baseSlug = orgData.organization_name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, '');

                        const timestamp = Date.now().toString(36);
                        const slug = `${baseSlug}-${timestamp}`;
                        console.log('[SETUP-DEBUG] 🔗 Generated slug:', slug);

                        console.log('[SETUP-DEBUG] 💾 Inserting into Supabase organizations table...');
                        const { data, error } = await supabase
                            .from('organizations')
                            .insert({
                                name: orgData.organization_name,
                                slug: slug,
                                organization_type: orgData.organization_type,
                                state: orgData.state,
                                country: orgData.country,
                                contact_email: orgData.contact_email,
                                logo_url: orgData.logo_path,
                                is_configured: true
                            })
                            .select()
                            .single();

                        if (error) {
                            console.log('[SETUP-DEBUG] ❌ Supabase error:', error);
                            throw error;
                        }
                        console.log('[SETUP-DEBUG] ✅ Organization created with ID:', data.id);
                        setupData.organizationId = data.id;
                    } else {
                        console.log('[SETUP-DEBUG] ⚠️  No orgData found');
                    }
                    break;

                case 'document':
                    console.log('[SETUP-DEBUG] 📄 Processing document step (no-op)');
                    // Document structure is stored in organization_config
                    // No separate action needed
                    break;

                case 'workflow':
                    console.log('[SETUP-DEBUG] 🔄 Processing workflow step (no-op)');
                    // Workflow is stored in organization_config
                    // No separate action needed
                    break;

                case 'import':
                    console.log('[SETUP-DEBUG] 📥 Processing import step');

                    // IDEMPOTENCY CHECK: Skip if sections already imported
                    if (setupData.sectionsImported) {
                        console.log('[SETUP-DEBUG] ⏭️  Sections already imported, skipping');
                        break;
                    }

                    const importData = setupData.import;

                    if (importData && !importData.skipped && importData.source === 'file_upload') {
                        console.log('[SETUP-DEBUG] 📄 Processing uploaded file:', importData.file_path);

                        try {
                            // Use setupService to process the document import
                            const setupService = require('../services/setupService');
                            const organizationId = setupData.organizationId;

                            if (!organizationId) {
                                throw new Error('Organization ID not found in setup data');
                            }

                            console.log('[SETUP-DEBUG] 🔄 Calling setupService.processDocumentImport...');
                            const importResult = await setupService.processDocumentImport(
                                organizationId,
                                importData.file_path,
                                supabase
                            );

                            if (importResult.success) {
                                console.log('[SETUP-DEBUG] ✅ Successfully parsed and stored', importResult.sectionsCount, 'sections');
                                setupData.sectionsCount = importResult.sectionsCount;
                                setupData.sectionsImported = true;
                                setupData.documentId = importResult.document.id;

                                if (importResult.warnings && importResult.warnings.length > 0) {
                                    console.warn('[SETUP-DEBUG] ⚠️  Import warnings:', importResult.warnings);
                                }
                            } else {
                                console.error('[SETUP-DEBUG] ❌ Import failed:', importResult.error);
                                throw new Error('Failed to import document: ' + importResult.error);
                            }
                        } catch (parseError) {
                            console.error('[SETUP-DEBUG] ❌ Parse error:', parseError);
                            console.error('[SETUP-DEBUG] ❌ Stack trace:', parseError.stack);
                            throw new Error('Failed to parse document: ' + parseError.message);
                        }
                    } else {
                        console.log('[SETUP-DEBUG] ⏭️  No file upload to process, skipping import');
                    }
                    break;

                case 'database':
                    console.log('[SETUP-DEBUG] 🗄️  Processing database step (no-op)');
                    // Tables already exist in Supabase
                    // No migration needed
                    break;

                case 'finalize':
                    console.log('[SETUP-DEBUG] 🏁 Processing finalize step');
                    // Store section count
                    setupData.sectionsCount = 0;
                    console.log('[SETUP-DEBUG] ✅ Set sectionsCount to 0');
                    break;
            }

            console.log(`[SETUP-DEBUG] ✅ AFTER step ${i + 1}/${steps.length}: "${step}" completed`);
            console.log(`[SETUP-DEBUG] 📊 completedSteps after step: [${setupData.completedSteps.join(', ')}]`);
        } catch (error) {
            console.error(`[SETUP-DEBUG] ❌ ERROR in step "${step}":`, error);
            console.error(`[SETUP-DEBUG] ❌ Error stack:`, error.stack);
            console.error(`[SETUP-DEBUG] ❌ Error details:`, JSON.stringify(error, null, 2));
            throw error;
        }
    }

    console.log('[SETUP-DEBUG] 🎉 ALL STEPS COMPLETED');
    console.log('[SETUP-DEBUG] 📊 Final completedSteps:', setupData.completedSteps);
    console.log('[SETUP-DEBUG] 🏁 END processSetupData()');
    return true;
}

/**
 * Helper: Format document structure for display
 */
function formatDocumentStructure(documentType) {
    if (!documentType) return 'Article → Section';

    const level1 = documentType.level1_name || 'Article';
    const level2 = documentType.level2_name || 'Section';

    return `${level1} → ${level2}`;
}

module.exports = router;
