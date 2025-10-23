/**
 * Setup Wizard Routes
 * Handles the initial organization setup process
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { debounceMiddleware } = require('../middleware/debounce');

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
 * POST /setup/organization - Save organization info and create admin user
 */
router.post('/organization', debounceMiddleware, upload.single('logo'), async (req, res) => {
    try {
        // 🔒 SESSION-BASED LOCK: Prevent duplicate submissions from same session
        if (req.session.organizationCreationInProgress) {
            console.log('[SETUP-LOCK] ⏸️  Organization creation already in progress for this session');
            return res.status(409).json({
                success: false,
                error: 'Organization creation already in progress',
                message: 'Please wait for the current request to complete'
            });
        }

        // Set lock flag IMMEDIATELY (before any async operations)
        req.session.organizationCreationInProgress = true;
        console.log('[SETUP-LOCK] 🔒 Set organizationCreationInProgress lock for session');

        const organizationData = {
            organization_name: req.body.organization_name,
            organization_type: req.body.organization_type,
            state: req.body.state,
            country: req.body.country,
            contact_email: req.body.contact_email,
            logo_path: req.file ? req.file.path : null
        };

        const adminData = {
            admin_email: req.body.admin_email,
            admin_password: req.body.admin_password,
            admin_password_confirm: req.body.admin_password_confirm
        };

        // Validate required fields
        if (!organizationData.organization_name || !organizationData.organization_type) {
            return res.status(400).json({
                success: false,
                error: 'Organization name and type are required'
            });
        }

        // Validate admin credentials
        if (!adminData.admin_email || !adminData.admin_password) {
            return res.status(400).json({
                success: false,
                error: 'Admin email and password are required'
            });
        }

        if (adminData.admin_password !== adminData.admin_password_confirm) {
            return res.status(400).json({
                success: false,
                error: 'Passwords do not match'
            });
        }

        if (adminData.admin_password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters'
            });
        }

        // Check if this is the first organization (for superuser detection)
        const { data: existingOrgs, error: checkError } = await req.supabaseService
            .from('organizations')
            .select('id')
            .limit(1);

        if (checkError) {
            console.error('Error checking existing organizations:', checkError);
            return res.status(500).json({
                success: false,
                error: 'Failed to check setup status'
            });
        }

        const isFirstOrganization = !existingOrgs || existingOrgs.length === 0;

        // Check if user already exists (support for multi-org)
        console.log('[SETUP-AUTH] Checking for existing user:', adminData.admin_email);
        const { data: existingUsers, error: getUserError } = await req.supabaseService.auth.admin.listUsers();

        let authUser;
        const existingAuthUser = existingUsers?.users?.find(u => u.email === adminData.admin_email);

        if (existingAuthUser) {
            // User exists - verify password and link to new organization
            console.log('[SETUP-AUTH] User already exists, verifying password for:', existingAuthUser.id);

            // Verify password is correct
            const { data: signInData, error: signInError } = await req.supabaseService.auth.signInWithPassword({
                email: adminData.admin_email,
                password: adminData.admin_password
            });

            if (signInError) {
                console.error('[SETUP-AUTH] Password verification failed:', signInError);
                return res.status(400).json({
                    success: false,
                    error: 'This email is already registered. Please enter your correct password to create a new organization.'
                });
            }

            authUser = { user: existingAuthUser };
            console.log('[SETUP-AUTH] Existing user authenticated successfully');
        } else {
            // New user - create auth account
            console.log('[SETUP-AUTH] Creating new Supabase Auth user for:', adminData.admin_email);
            const { data: newAuthUser, error: authError } = await req.supabaseService.auth.admin.createUser({
                email: adminData.admin_email,
                password: adminData.admin_password,
                email_confirm: true, // Auto-confirm email for setup
                user_metadata: {
                    setup_user: true,
                    created_via: 'setup_wizard'
                }
            });

            if (authError) {
                console.error('[SETUP-AUTH] Error creating auth user:', authError);
                return res.status(400).json({
                    success: false,
                    error: authError.message || 'Failed to create admin account'
                });
            }

            authUser = newAuthUser;
            console.log('[SETUP-AUTH] New auth user created successfully:', authUser.user.id);

            // ✅ FIX: Create corresponding users table record with user_type_id
            console.log('[SETUP-AUTH] Creating users table record...');
            const { data: regularUserType, error: typeError } = await req.supabaseService
                .from('user_types')
                .select('id')
                .eq('type_code', 'regular_user')
                .single();

            if (typeError) {
                console.error('[SETUP-AUTH] Failed to get user type:', typeError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to initialize user account - could not get user type'
                });
            }

            const { error: userRecordError } = await req.supabaseService
                .from('users')
                .insert({
                    id: authUser.user.id,
                    email: authUser.user.email,
                    name: adminData.admin_name || adminData.admin_email,
                    user_type_id: regularUserType.id,
                    auth_provider: 'supabase',
                    last_login: new Date().toISOString()
                });

            if (userRecordError) {
                console.error('[SETUP-AUTH] Failed to create user record:', userRecordError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to initialize user account - could not create user record'
                });
            }

            console.log('[SETUP-AUTH] Users table record created successfully');
        }

        // Store in session
        req.session.setupData = req.session.setupData || {};
        req.session.setupData.organization = organizationData;
        req.session.setupData.adminUser = {
            user_id: authUser.user.id,
            email: adminData.admin_email,
            is_first_org: isFirstOrganization
        };
        req.session.setupData.completedSteps = ['organization'];

        // Store password temporarily for auto-login later (will be cleared after setup)
        req.session.adminPassword = adminData.admin_password;

        // 🔓 Clear session lock on success
        delete req.session.organizationCreationInProgress;
        console.log('[SETUP-LOCK] 🔓 Cleared organizationCreationInProgress lock (success)');

        // Return JSON response with redirect URL
        res.json({ success: true, redirectUrl: '/setup/document-type' });
    } catch (error) {
        console.error('Organization setup error:', error);

        // 🔓 Clear session lock on error
        delete req.session.organizationCreationInProgress;
        console.log('[SETUP-LOCK] 🔓 Cleared organizationCreationInProgress lock (error)');

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
        // 🔒 CHECK: Prevent duplicate processSetupData calls
        if (req.session.setupProcessingInProgress) {
            console.log('[SETUP-IMPORT-LOCK] ⏸️  Setup processing already in progress');
            return res.status(409).json({
                success: false,
                error: 'Setup processing already in progress',
                message: 'Please wait for the current setup to complete'
            });
        }

        // Set lock flag IMMEDIATELY (will be cleared when processSetupData completes)
        req.session.setupProcessingInProgress = true;
        console.log('[SETUP-IMPORT-LOCK] 🔒 Set setupProcessingInProgress lock');

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
            processSetupData(req.session.setupData, req.supabaseService)
                .then(() => {
                    console.log('[SETUP-DEBUG] ✅ processSetupData completed successfully');
                    req.session.setupData.status = 'complete';
                    console.log('[SETUP-DEBUG] ✅ Set status to "complete"');

                    // 🔓 Clear processing lock on success
                    delete req.session.setupProcessingInProgress;
                    console.log('[SETUP-IMPORT-LOCK] 🔓 Cleared setupProcessingInProgress lock (success)');

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

                    // 🔓 Clear processing lock on error
                    delete req.session.setupProcessingInProgress;
                    console.log('[SETUP-IMPORT-LOCK] 🔓 Cleared setupProcessingInProgress lock (error)');

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

        // 🔓 Clear processing lock on error
        delete req.session.setupProcessingInProgress;
        console.log('[SETUP-IMPORT-LOCK] 🔓 Cleared setupProcessingInProgress lock (import error)');

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
 * GET /setup/success - Success screen (redirects to dashboard)
 */
router.get('/success', async (req, res) => {
    const setupData = req.session.setupData || {};

    try {
        // Auto-login the user who just completed setup by creating a proper session with JWT
        if (setupData.adminUser && setupData.adminUser.email) {
            console.log('[SETUP-AUTH] Auto-logging in user:', setupData.adminUser.email);

            // Get the password from session (stored temporarily during organization step)
            const password = req.session.adminPassword;

            if (password) {
                // Sign in the user to get JWT tokens
                const { data: authData, error: signInError } = await req.supabaseService.auth.signInWithPassword({
                    email: setupData.adminUser.email,
                    password: password
                });

                if (signInError) {
                    console.error('[SETUP-AUTH] Error signing in user:', signInError);
                    // Fall back to session without JWT (user can log in manually later)
                } else if (authData && authData.session) {
                    // Store JWT tokens in session for authenticated Supabase client
                    req.session.supabaseJWT = authData.session.access_token;
                    req.session.supabaseRefreshToken = authData.session.refresh_token;
                    req.session.supabaseUser = authData.user;
                    console.log('[SETUP-AUTH] Successfully stored JWT tokens in session for:', authData.user.email);
                }

                // Clear the temporary password from session
                delete req.session.adminPassword;
            } else {
                console.warn('[SETUP-AUTH] No password available for auto-login');
            }

            // Store user info in session
            req.session.userId = setupData.adminUser.user_id;
            req.session.userEmail = setupData.adminUser.email;
            req.session.isAuthenticated = true;
        }

        // ✅ FIX: Store organization_id AND role for dashboard access
        if (setupData.organizationId) {
            req.session.organizationId = setupData.organizationId;
            console.log('[SETUP-AUTH] ✅ Set session.organizationId:', setupData.organizationId);
        }

        if (setupData.userRole) {
            req.session.userRole = setupData.userRole;
            console.log('[SETUP-AUTH] ✅ Set session.userRole:', setupData.userRole);

            // CRITICAL: Set isAdmin based on role
            req.session.isAdmin = ['owner', 'admin'].includes(setupData.userRole);
            console.log('[SETUP-AUTH] ✅ Set session.isAdmin:', req.session.isAdmin, '(role:', setupData.userRole, ')');
        }

        // Clear setup data and mark as configured
        delete req.session.setupData;
        req.session.isConfigured = true;

        // Save session and redirect to dashboard
        req.session.save((err) => {
            if (err) {
                console.error('[SETUP-AUTH] Session save error:', err);
            } else {
                console.log('[SETUP-AUTH] ✅ Session saved successfully');
            }
            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error('[SETUP-AUTH] Error during auto-login:', error);
        // Continue to dashboard anyway
        req.session.organizationId = setupData.organizationId;
        delete req.session.setupData;
        req.session.isConfigured = true;
        res.redirect('/dashboard');
    }
});

/**
 * POST /setup/clear-session - Clear setup session data
 */
router.post('/clear-session', (req, res) => {
    // Store organization_id before clearing setup data
    const organizationId = req.session.setupData?.organizationId;

    // Clear setup data
    delete req.session.setupData;

    // CRITICAL: Mark as configured so /bylaws doesn't redirect back to setup
    req.session.isConfigured = true;

    // Store organization_id for dashboard access
    if (organizationId) {
        req.session.organizationId = organizationId;
    }

    res.json({ success: true });
});

/**
 * Helper: Process setup data and create database entries in Supabase
 * @param {Object} setupData - Setup wizard data
 * @param {Object} supabaseService - Service role Supabase client (bypasses RLS)
 */
async function processSetupData(setupData, supabaseService) {
    // Use service role client to bypass RLS policies
    const supabase = supabaseService;
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
                    const adminUser = setupData.adminUser;
                    console.log('[SETUP-DEBUG] 📋 orgData:', JSON.stringify(orgData, null, 2));
                    console.log('[SETUP-DEBUG] 👤 adminUser:', adminUser ? `user_id: ${adminUser.user_id}` : 'not set');

                    // IDEMPOTENCY CHECK: Skip if organization already created
                    if (setupData.organizationId) {
                        console.log('[SETUP-DEBUG] ⏭️  Organization already created with ID:', setupData.organizationId);
                        break;
                    }

                    if (orgData && adminUser) {
                        console.log('[SETUP-DEBUG] ✅ orgData exists, creating organization...');
                        // Generate slug from organization name
                        const baseSlug = orgData.organization_name
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, '');

                        // ✅ NEW: Check if organization with this slug already exists
                        console.log('[SETUP-DEBUG] 🔍 Checking for existing organization with slug pattern:', baseSlug);
                        const { data: existingOrg, error: checkError } = await supabase
                            .from('organizations')
                            .select('id, name, slug')
                            .ilike('slug', `${baseSlug}%`)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (existingOrg && !checkError) {
                            console.log(`[SETUP-DEBUG] 🔄 Organization with similar slug already exists (id: ${existingOrg.id}, slug: ${existingOrg.slug})`);

                            // Check if this user is already linked to this organization
                            const { data: existingLink, error: linkCheckError } = await supabase
                                .from('user_organizations')
                                .select('id')
                                .eq('user_id', adminUser.user_id)
                                .eq('organization_id', existingOrg.id)
                                .maybeSingle();

                            if (existingLink && !linkCheckError) {
                                console.log(`[SETUP-DEBUG] ✅ User already linked to organization, returning existing org (idempotent)`);
                                setupData.organizationId = existingOrg.id;

                                // Mark step as complete and return success
                                if (!setupData.completedSteps.includes('organization')) {
                                    setupData.completedSteps.push('organization');
                                }

                                // Skip to next step - organization already exists
                                console.log('[SETUP-DEBUG] ⏭️  Skipping organization creation (already exists)');
                                break;
                            }
                        }

                        if (checkError && checkError.code !== 'PGRST116') {
                            // PGRST116 = no rows found (expected for new org)
                            console.error('[SETUP-DEBUG] ❌ Error checking for existing org:', checkError);
                            throw new Error('Failed to verify organization uniqueness');
                        }

                        // Generate unique slug with timestamp for new organizations
                        const timestamp = Date.now().toString(36);
                        const slug = `${baseSlug}-${timestamp}`;
                        console.log('[SETUP-DEBUG] 🔗 Generated unique slug:', slug);

                        console.log('[SETUP-DEBUG] 💾 Inserting into Supabase organizations table...');

                        // ✅ FIX: Build complete 10-level hierarchy from user choices
                        // Import organization config to get default 10-level schema
                        const organizationConfig = require('../config/organizationConfig');

                        // Build hierarchy_config in correct 10-level format
                        const hierarchyConfig = (() => {
                            // Get user's choices from setup wizard (or use defaults)
                            const level1Name = setupData.documentType?.level1_name || 'Article';
                            const level2Name = setupData.documentType?.level2_name || 'Section';
                            const numberingStyle = setupData.documentType?.numbering_style || 'roman';

                            // Get default 10-level hierarchy structure
                            const defaultHierarchy = organizationConfig.getDefaultConfig().hierarchy;

                            // Build complete hierarchy: customize first 2 levels, use defaults for remaining 8
                            return {
                                levels: [
                                    // Level 0: Customize with user's choice for level 1
                                    {
                                        name: level1Name,
                                        type: 'article',
                                        numbering: numberingStyle,
                                        prefix: `${level1Name} `,
                                        depth: 0
                                    },
                                    // Level 1: Customize with user's choice for level 2
                                    {
                                        name: level2Name,
                                        type: 'section',
                                        numbering: 'numeric',
                                        prefix: `${level2Name} `,
                                        depth: 1
                                    },
                                    // Levels 2-9: Use defaults from organizationConfig
                                    ...defaultHierarchy.levels.slice(2)
                                ],
                                maxDepth: 10,
                                allowNesting: true
                            };
                        })();

                        console.log('[SETUP-DEBUG] 📋 hierarchy_config to save:', JSON.stringify(hierarchyConfig, null, 2));

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
                                hierarchy_config: hierarchyConfig,
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

                        // Get the user_types ID for first org (global_admin) or regular (regular_user)
                        const userTypeCode = adminUser.is_first_org ? 'global_admin' : 'regular_user';
                        const { data: userType, error: userTypeError } = await supabase
                            .from('user_types')
                            .select('id')
                            .eq('type_code', userTypeCode)
                            .single();

                        if (userTypeError) {
                            console.error('[SETUP-DEBUG] ❌ Error getting user type:', userTypeError);
                            throw new Error(`Failed to get ${userTypeCode} user type`);
                        }

                        // Update user's user_type_id in users table
                        console.log('[SETUP-DEBUG] 👤 Setting user_type_id to:', userTypeCode, '(', userType.id, ')');
                        const { error: userUpdateError } = await supabase
                            .from('users')
                            .update({ user_type_id: userType.id })
                            .eq('id', adminUser.user_id);

                        if (userUpdateError) {
                            console.error('[SETUP-DEBUG] ❌ Error updating user type:', userUpdateError);
                            // Non-fatal: Continue with setup
                        } else {
                            console.log('[SETUP-DEBUG] ✅ User type updated successfully');
                        }

                        // Link user to organization via user_organizations table
                        console.log('[SETUP-DEBUG] 🔗 Linking user to organization...');
                        // Person creating organization should always be owner
                        const userRole = 'owner';
                        console.log('[SETUP-DEBUG] 👤 Assigning role:', userRole);

                        // Get the organization_roles ID for 'owner' (person creating org should be owner)
                        const { data: ownerRole, error: roleError } = await supabase
                            .from('organization_roles')
                            .select('id')
                            .eq('role_code', 'owner')
                            .single();

                        if (roleError) {
                            console.error('[SETUP-DEBUG] ❌ Error getting owner role:', roleError);
                            throw new Error('Failed to get owner role for organization creator');
                        }

                        // CRITICAL VALIDATION: Log everything before attempting INSERT
                        console.log('[SETUP-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('[SETUP-DEBUG] Attempting user_organizations INSERT with:');
                        console.log('[SETUP-DEBUG]   user_id:', adminUser?.user_id, '(type:', typeof adminUser?.user_id, ')');
                        console.log('[SETUP-DEBUG]   organization_id:', data?.id, '(type:', typeof data?.id, ')');
                        console.log('[SETUP-DEBUG]   role:', userRole);
                        console.log('[SETUP-DEBUG]   org_role_id:', ownerRole?.id, '(type:', typeof ownerRole?.id, ')');
                        console.log('[SETUP-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                        // Validate required fields
                        if (!adminUser?.user_id) {
                            throw new Error('CRITICAL: adminUser.user_id is missing!');
                        }
                        if (!data?.id) {
                            throw new Error('CRITICAL: organization.id is missing!');
                        }
                        if (!ownerRole?.id) {
                            throw new Error('CRITICAL: ownerRole.id is missing!');
                        }

                        const { error: linkError } = await supabaseService
                            .from('user_organizations')
                            .insert({
                                user_id: adminUser.user_id,
                                organization_id: data.id,
                                role: userRole, // Keep old column for backwards compatibility
                                org_role_id: ownerRole.id, // NEW: Use new permissions system
                                created_at: new Date().toISOString()
                            });

                        if (linkError) {
                            console.error('[SETUP-ERROR] ❌ CRITICAL: Failed to link user to organization!', linkError);
                            throw new Error(`Failed to link user to organization: ${linkError.message}`);
                        }

                        console.log('[SETUP-DEBUG] ✅ User', adminUser.user_id, 'linked to organization', data.id, 'with role:', userRole);

                        // ✅ FIX: Store organization_id and role in setupData for session update
                        setupData.userRole = userRole;
                        console.log('[SETUP-DEBUG] ✅ Stored userRole in setupData:', userRole);

                        // Create default workflow template for new organization
                        console.log('[SETUP-DEBUG] 🔄 Creating default workflow template...');
                        try {
                            const { data: workflowTemplate, error: workflowError } = await supabase
                                .from('workflow_templates')
                                .insert({
                                    organization_id: data.id,
                                    name: 'Default Approval Workflow',
                                    description: 'Standard two-stage approval workflow for document sections',
                                    is_default: true,
                                    is_active: true
                                })
                                .select()
                                .single();

                            if (workflowError) {
                                console.error('[SETUP-DEBUG] ❌ Failed to create default workflow:', workflowError);
                                // Non-fatal: Continue setup even if workflow creation fails
                            } else {
                                console.log('[SETUP-DEBUG] ✅ Default workflow template created:', workflowTemplate.id);

                                // Create workflow stages
                                const { error: stagesError } = await supabase
                                    .from('workflow_stages')
                                    .insert([
                                        {
                                            workflow_template_id: workflowTemplate.id,
                                            stage_name: 'Committee Review',
                                            stage_order: 1,
                                            can_lock: true,
                                            can_edit: true,
                                            can_approve: true,
                                            requires_approval: true,
                                            required_roles: ['admin', 'owner'],
                                            display_color: '#FFD700',
                                            icon: 'clipboard-check',
                                            description: 'Initial review by committee members'
                                        },
                                        {
                                            workflow_template_id: workflowTemplate.id,
                                            stage_name: 'Board Approval',
                                            stage_order: 2,
                                            can_lock: false,
                                            can_edit: false,
                                            can_approve: true,
                                            requires_approval: true,
                                            required_roles: ['owner'],
                                            display_color: '#90EE90',
                                            icon: 'check-circle',
                                            description: 'Final approval by board members'
                                        }
                                    ]);

                                if (stagesError) {
                                    console.error('[SETUP-DEBUG] ❌ Failed to create workflow stages:', stagesError);
                                    // Non-fatal: Continue setup even if stage creation fails
                                } else {
                                    setupData.workflowTemplateId = workflowTemplate.id;
                                    console.log('[SETUP-DEBUG] ✅ Created default workflow for organization', data.id);
                                    console.log('[SETUP-DEBUG] ✅ Workflow stages: Committee Review → Board Approval');
                                }
                            }
                        } catch (workflowErr) {
                            console.error('[SETUP-DEBUG] ❌ Error creating default workflow:', workflowErr);
                            // Non-fatal: Continue setup even if workflow creation fails
                        }
                    } else {
                        console.log('[SETUP-DEBUG] ⚠️  Missing orgData or adminUser');
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

                                // Log detailed validation errors if available
                                if (importResult.validationErrors && importResult.validationErrors.length > 0) {
                                    console.error('[SETUP-DEBUG] ❌ Validation errors:', JSON.stringify(importResult.validationErrors, null, 2));
                                }
                                if (importResult.warnings && importResult.warnings.length > 0) {
                                    console.error('[SETUP-DEBUG] ⚠️  Validation warnings:', JSON.stringify(importResult.warnings, null, 2));
                                }

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
