/**
 * Authentication Routes
 * Complete authentication system with Supabase Auth integration
 * Supports user registration, login, logout, session management, and user invitations
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { requireGlobalAdmin, attachGlobalAdminStatus } = require('../middleware/globalAdmin');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(255).optional(),
  organizationId: Joi.string().uuid().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional() // Optional remember me checkbox
});

const inviteUserSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(255).optional(),
  role: Joi.string().valid('owner', 'admin', 'member', 'viewer').default('member'),
  organizationId: Joi.string().uuid().required()
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user is admin for the organization
 * Global admins automatically have admin access
 */
async function isOrgAdmin(supabase, userId, organizationId) {
  // Check if user is a global admin first
  const { data: globalAdminCheck } = await supabase
    .from('user_organizations')
    .select('is_global_admin')
    .eq('user_id', userId)
    .eq('is_global_admin', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (globalAdminCheck) {
    return true; // Global admins can invite users to any organization
  }

  // Check organization-level admin status
  const { data, error } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) return false;
  return ['owner', 'admin'].includes(data.role);
}

/**
 * Count users in organization
 */
async function countOrgUsers(supabase, organizationId) {
  const { count, error } = await supabase
    .from('user_organizations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (error) throw error;
  return count || 0;
}

/**
 * Get organization user limit
 * Returns default limit of 50 users per organization
 */
async function getOrgUserLimit(supabase, organizationId) {
  // Default user limit per organization
  // This can be made configurable in the future by adding max_users column to organizations table
  return 50;
}

/**
 * Create or update user record in users table
 */
async function upsertUser(supabase, authUser) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: authUser.id,
      email: authUser.email,
      name: authUser.user_metadata?.name || null,
      avatar_url: authUser.user_metadata?.avatar_url || null,
      auth_provider: 'supabase',
      last_login: new Date().toISOString()
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create user_organization record
 */
async function createUserOrganization(supabase, userId, organizationId, role = 'member') {
  const { data, error } = await supabase
    .from('user_organizations')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      role: role,
      joined_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    // If already exists, update last login
    if (error.code === '23505') {
      const { data: updated } = await supabase
        .from('user_organizations')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .select()
        .single();
      return updated;
    }
    throw error;
  }
  return data;
}

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

/**
 * GET /auth/register
 * Display registration page
 */
router.get('/register', (req, res) => {
  // If already logged in, redirect to dashboard or org selection
  if (req.session.userId) {
    if (req.session.organizationId) {
      return res.redirect('/dashboard');
    }
    return res.redirect('/auth/select');
  }

  res.render('auth/register', {
    title: 'Register',
    error: null
  });
});

/**
 * POST /auth/register
 * Register a new user with Supabase Auth
 * Creates user account and associates with organization
 */
router.post('/register', async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = registerSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { email, password, name, organizationId } = value;
    const { supabase, supabaseService } = req;

    // If organizationId provided, check user limit
    if (organizationId) {
      const userCount = await countOrgUsers(supabaseService, organizationId);
      const userLimit = await getOrgUserLimit(supabaseService, organizationId);

      if (userCount >= userLimit) {
        return res.status(403).json({
          success: false,
          error: `Organization has reached its user limit (${userLimit} users)`
        });
      }
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || null
        },
        emailRedirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`
      }
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        error: authError.message
      });
    }

    if (!authData.user) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create user account'
      });
    }

    // Create user record in users table
    const user = await upsertUser(supabaseService, authData.user);

    // Create user_organization record if organizationId provided
    let userOrg = null;
    if (organizationId) {
      userOrg = await createUserOrganization(
        supabaseService,
        authData.user.id,
        organizationId,
        'member'
      );
    }

    // Set session with JWT tokens
    req.session.userId = authData.user.id;
    req.session.userEmail = authData.user.email;
    req.session.userName = name || null;
    if (authData.session) {
      req.session.supabaseJWT = authData.session.access_token;
      req.session.supabaseRefreshToken = authData.session.refresh_token;
      req.session.supabaseUser = authData.user;
    }
    if (organizationId) {
      req.session.organizationId = organizationId;
    }

    res.json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      session: authData.session,
      needsEmailVerification: !authData.user.email_confirmed_at
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/login
 * Display login page
 */
router.get('/login', (req, res) => {
  // If already logged in, redirect to dashboard or org selection
  if (req.session.userId) {
    if (req.session.organizationId) {
      return res.redirect('/dashboard');
    }
    return res.redirect('/auth/select');
  }

  res.render('auth/login', {
    title: 'Login',
    error: null
  });
});

/**
 * POST /auth/login
 * Authenticate user with Supabase
 * Creates Express session with Supabase JWT
 */
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = loginSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { email, password } = value;
    const { supabase, supabaseService } = req;

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    if (!authData.user || !authData.session) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }

    // Update user record
    const user = await upsertUser(supabaseService, authData.user);

    // Get user's organizations
    const { data: userOrgs, error: orgsError } = await supabaseService
      .from('user_organizations')
      .select(`
        organization_id,
        role,
        organizations:organization_id (
          id,
          name,
          slug
        )
      `)
      .eq('user_id', authData.user.id);

    if (orgsError) {
      console.error('Error fetching user organizations:', orgsError);
    }

    // Set session with JWT tokens for authenticated Supabase client
    req.session.userId = authData.user.id;
    req.session.userEmail = authData.user.email;
    req.session.userName = user.name;
    req.session.supabaseJWT = authData.session.access_token;
    req.session.supabaseRefreshToken = authData.session.refresh_token;
    req.session.supabaseUser = authData.user;

    // If user has organizations, set the first one as default
    if (userOrgs && userOrgs.length > 0) {
      const defaultOrg = userOrgs[0];
      req.session.organizationId = defaultOrg.organization_id;
      req.session.organizationName = defaultOrg.organizations.name;
      req.session.userRole = defaultOrg.role;
      req.session.isConfigured = true;

      // CRITICAL FIX: Set admin status based on role
      req.session.isAdmin = ['owner', 'admin'].includes(defaultOrg.role);
    }

    // Check if user is a global admin (can access any organization)
    const { data: globalAdminCheck } = await supabaseService
      .from('user_organizations')
      .select('is_global_admin')
      .eq('user_id', authData.user.id)
      .eq('is_global_admin', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    req.session.isGlobalAdmin = !!globalAdminCheck;

    // CRITICAL FIX: Explicitly save session before sending response
    // This ensures JWT is persisted before client-side redirect happens
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Error saving session:', saveErr);
        return res.status(500).json({
          success: false,
          error: 'Session save failed'
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        organizations: userOrgs || [],
        session: {
          expiresAt: authData.session.expires_at,
          expiresIn: authData.session.expires_in
        },
        redirectTo: userOrgs && userOrgs.length > 0 ? '/dashboard' : '/auth/select'
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/logout
 * Display logout confirmation or directly logout and redirect
 */
router.get('/logout', async (req, res) => {
  try {
    const { supabase } = req;

    // Sign out from Supabase if session exists
    if (req.session.supabaseJWT) {
      await supabase.auth.signOut();
    }

    // Destroy Express session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      // Redirect to login regardless of error
      res.redirect('/auth/login');
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/auth/login');
  }
});

/**
 * POST /auth/logout
 * Clear Supabase session and destroy Express session (API endpoint)
 */
router.post('/logout', async (req, res) => {
  try {
    const { supabase } = req;

    // Sign out from Supabase if session exists
    if (req.session.supabaseJWT) {
      await supabase.auth.signOut();
    }

    // Destroy Express session
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({
          success: false,
          error: 'Logout failed'
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
        redirectTo: '/auth/login'
      });
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/profile
 * Display user profile page
 */
router.get('/profile', async (req, res) => {
  try {
    // Require authentication
    if (!req.session.userId) {
      return res.redirect('/auth/login');
    }

    const { supabaseService } = req;

    // Get user details
    const { data: user, error } = await supabaseService
      .from('users')
      .select('*')
      .eq('id', req.session.userId)
      .single();

    if (error || !user) {
      console.error('Error loading user profile:', error);
      return res.status(500).render('error', {
        message: 'Failed to load profile',
        details: error?.message
      });
    }

    // Get user's organizations
    const { data: userOrgs } = await supabaseService
      .from('user_organizations')
      .select(`
        role,
        is_global_admin,
        organizations:organization_id (
          id,
          name,
          organization_type
        )
      `)
      .eq('user_id', req.session.userId)
      .eq('is_active', true);

    res.render('auth/profile', {
      title: 'Profile',
      user: user,
      organizations: userOrgs || [],
      currentOrgId: req.session.organizationId
    });

  } catch (error) {
    console.error('Profile page error:', error);
    res.status(500).render('error', {
      message: 'Error loading profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/session
 * Return current session info and validate JWT
 * Refresh token if expired
 */
router.get('/session', async (req, res) => {
  try {
    const { supabase } = req;

    // Check if session exists
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'No active session'
      });
    }

    // Get current Supabase session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session validation error:', sessionError);
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Invalid session'
      });
    }

    // If no session or expired, try to refresh
    if (!session) {
      if (req.session.supabaseRefreshToken) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: req.session.supabaseRefreshToken
        });

        if (refreshError || !refreshData.session) {
          // Clear invalid session
          req.session.destroy();
          return res.status(401).json({
            success: false,
            authenticated: false,
            error: 'Session expired'
          });
        }

        // Update session with new tokens
        req.session.supabaseJWT = refreshData.session.access_token;
        req.session.supabaseRefreshToken = refreshData.session.refresh_token;
        req.session.supabaseUser = refreshData.user;

        return res.json({
          success: true,
          authenticated: true,
          user: {
            id: req.session.userId,
            email: req.session.userEmail,
            name: req.session.userName
          },
          organization: {
            id: req.session.organizationId,
            name: req.session.organizationName,
            role: req.session.userRole
          },
          session: {
            expiresAt: refreshData.session.expires_at,
            expiresIn: refreshData.session.expires_in
          },
          refreshed: true
        });
      }

      // No refresh token available
      req.session.destroy();
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Session expired'
      });
    }

    // Valid session exists
    res.json({
      success: true,
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName
      },
      organization: {
        id: req.session.organizationId,
        name: req.session.organizationName,
        role: req.session.userRole
      },
      session: {
        expiresAt: session.expires_at,
        expiresIn: session.expires_in
      }
    });

  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({
      success: false,
      authenticated: false,
      error: 'Session validation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /auth/invite-user
 * Invite user to organization (org admin only)
 * Enforces 50 user limit per organization and creates invitation record
 */
router.post('/invite-user', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate input
    const { error: validationError, value } = inviteUserSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { email, name, role, organizationId } = value;
    const { supabase, supabaseService } = req;

    // Check if user is admin for this organization
    const isAdmin = await isOrgAdmin(supabaseService, req.session.userId, organizationId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only organization admins can invite users'
      });
    }

    // Check user limit
    const userCount = await countOrgUsers(supabaseService, organizationId);
    const userLimit = await getOrgUserLimit(supabaseService, organizationId);

    if (userCount >= userLimit) {
      return res.status(403).json({
        success: false,
        error: `Organization has reached its user limit (${userLimit} users)`,
        currentUsers: userCount,
        maxUsers: userLimit
      });
    }

    // Check if user already exists in this organization
    const { data: existingUser } = await supabaseService
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      const { data: existingMembership } = await supabaseService
        .from('user_organizations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMembership) {
        return res.status(400).json({
          success: false,
          error: 'User is already a member of this organization'
        });
      }
    }

    // Check if there's already a pending invitation for this email
    const { data: existingInvite } = await supabaseService
      .from('user_invitations')
      .select('id, status')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return res.status(400).json({
        success: false,
        error: 'A pending invitation already exists for this email'
      });
    }

    // Generate secure invitation token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('base64url');

    // Create invitation record in database
    const { data: invitation, error: inviteError } = await supabaseService
      .from('user_invitations')
      .insert({
        organization_id: organizationId,
        email: email,
        role: role,
        token: token,
        status: 'pending',
        invited_by: req.session.userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create invitation'
      });
    }

    // Generate invitation URL
    const inviteUrl = `${process.env.APP_URL || 'http://localhost:3000'}/auth/accept-invite?token=${token}`;

    // In production, send email here using your email service
    // For now, log the invitation URL
    console.log('Invitation URL:', inviteUrl);

    res.json({
      success: true,
      message: `Invitation sent to ${email}`,
      invitation: {
        id: invitation.id,
        email,
        role,
        organizationId,
        inviteUrl: process.env.NODE_ENV === 'development' ? inviteUrl : undefined,
        sentAt: new Date().toISOString(),
        expiresAt: invitation.expires_at
      }
    });

  } catch (error) {
    console.error('User invitation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/accept-invite
 * Display invitation acceptance form
 * Validates token and shows organization details
 */
router.get('/accept-invite', async (req, res) => {
  try {
    const { token } = req.query;
    const { supabaseService } = req;

    // Validate token parameter
    if (!token) {
      return res.status(400).render('error', {
        message: 'Invalid invitation link',
        details: 'No invitation token provided'
      });
    }

    // Fetch invitation with organization details
    const { data: invitation, error } = await supabaseService
      .from('user_invitations')
      .select(`
        *,
        organization:organizations(
          id,
          name,
          organization_type
        )
      `)
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (error || !invitation) {
      console.error('Invitation lookup error:', error);
      return res.status(404).render('error', {
        message: 'Invitation not found',
        details: 'This invitation may have expired or already been accepted'
      });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabaseService
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return res.status(410).render('error', {
        message: 'Invitation expired',
        details: 'This invitation has expired. Please request a new invitation from your organization administrator.'
      });
    }

    // Check if user with this email already exists
    const { data: existingUser } = await supabaseService
      .from('users')
      .select('id, email')
      .eq('email', invitation.email)
      .single();

    if (existingUser) {
      // User exists, check if already in organization
      const { data: existingMembership } = await supabaseService
        .from('user_organizations')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('organization_id', invitation.organization_id)
        .single();

      if (existingMembership) {
        return res.status(400).render('error', {
          message: 'Already a member',
          details: 'You are already a member of this organization. Please sign in instead.'
        });
      }
    }

    // Render invitation acceptance form
    res.render('auth/accept-invite', {
      title: 'Accept Invitation',
      invitation: invitation,
      email: invitation.email,
      error: null
    });

  } catch (error) {
    console.error('Error displaying invitation:', error);
    res.status(500).render('error', {
      message: 'Error loading invitation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/accept-invitation (ALIAS)
 * Redirect to /auth/accept-invite for URL compatibility
 * Handles both invitation/invite URL formats
 */
router.get('/accept-invitation', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).render('error', {
      message: 'Invalid invitation link',
      details: 'No invitation token provided'
    });
  }
  // Redirect to the canonical route with token
  res.redirect(`/auth/accept-invite?token=${encodeURIComponent(token)}`);
});

/**
 * POST /auth/accept-invitation (ALIAS)
 * Redirect to /auth/accept-invite for API compatibility
 */
router.post('/accept-invitation', async (req, res) => {
  // Forward the request to the canonical route
  req.url = '/auth/accept-invite';
  router.handle(req, res);
});

/**
 * POST /auth/accept-invite
 * Process invitation acceptance
 * Creates user account and links to organization
 */
router.post('/accept-invite', async (req, res) => {
  try {
    const { token, full_name, password } = req.body;
    const { supabase, supabaseService } = req;

    // Validate input
    if (!token || !full_name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Fetch and validate invitation
    const { data: invitation, error: inviteError } = await supabaseService
      .from('user_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired invitation'
      });
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseService
        .from('user_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return res.status(410).json({
        success: false,
        error: 'This invitation has expired'
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseService
      .from('users')
      .select('id')
      .eq('email', invitation.email)
      .single();

    let userId;

    if (existingUser) {
      // User exists, just link to organization
      userId = existingUser.id;
    } else {
      // Create new Supabase Auth user
      const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
        email: invitation.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: full_name
        }
      });

      if (authError) {
        console.error('Auth user creation error:', authError);
        return res.status(400).json({
          success: false,
          error: authError.message || 'Failed to create user account'
        });
      }

      if (!authData.user) {
        return res.status(500).json({
          success: false,
          error: 'Failed to create user account'
        });
      }

      userId = authData.user.id;

      // Create user record in users table
      await upsertUser(supabaseService, {
        id: userId,
        email: invitation.email,
        user_metadata: { name: full_name }
      });
    }

    // Link user to organization
    const { error: orgLinkError } = await supabaseService
      .from('user_organizations')
      .insert({
        user_id: userId,
        organization_id: invitation.organization_id,
        role: invitation.role,
        is_active: true,
        joined_at: new Date().toISOString()
      });

    if (orgLinkError) {
      console.error('Organization link error:', orgLinkError);
      // If duplicate, it means user is already a member
      if (orgLinkError.code !== '23505') {
        return res.status(500).json({
          success: false,
          error: 'Failed to link user to organization'
        });
      }
    }

    // Mark invitation as accepted
    await supabaseService
      .from('user_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    // Auto-login the user
    const { data: sessionData, error: loginError } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password: password
    });

    if (loginError || !sessionData.session) {
      // User created but login failed - they can login manually
      return res.json({
        success: true,
        message: 'Account created successfully. Please sign in.',
        redirectTo: '/auth/login'
      });
    }

    // Set session
    req.session.userId = userId;
    req.session.userEmail = invitation.email;
    req.session.userName = full_name;
    req.session.supabaseJWT = sessionData.session.access_token;
    req.session.supabaseRefreshToken = sessionData.session.refresh_token;
    req.session.supabaseUser = sessionData.user;
    req.session.organizationId = invitation.organization_id;
    req.session.userRole = invitation.role;
    req.session.isAdmin = ['owner', 'admin'].includes(invitation.role);
    req.session.isConfigured = true;

    // Save session before responding
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session save error:', saveErr);
        return res.json({
          success: true,
          message: 'Account created successfully. Please sign in.',
          redirectTo: '/auth/login'
        });
      }

      res.json({
        success: true,
        message: 'Welcome! Your account has been created successfully.',
        redirectTo: '/dashboard'
      });
    });

  } catch (error) {
    console.error('Invitation acceptance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// ORGANIZATION SELECTION (Keep existing functionality)
// ============================================================================

/**
 * GET /auth/select - Organization selection page
 * Allows users to select which organization dashboard to access
 * Global admins see ALL organizations, regular users see only their organizations
 */
router.get('/select', async (req, res) => {
  try {
    const { supabaseService, supabase } = req;
    let organizations = [];
    let isGlobalAdmin = false;

    // Check if user is logged in and is a global admin
    if (req.session?.userId) {
      const { data: globalAdminCheck } = await supabase
        .from('user_organizations')
        .select('is_global_admin')
        .eq('user_id', req.session.userId)
        .eq('is_global_admin', true)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      isGlobalAdmin = !!globalAdminCheck;

      if (isGlobalAdmin) {
        // Global admin: show ALL organizations
        const { data, error } = await supabaseService
          .from('organizations')
          .select('id, name, organization_type, created_at')
          .order('name');

        if (error) throw error;
        organizations = data || [];
      } else {
        // Regular user: show only their organizations
        const { data, error } = await supabase
          .from('user_organizations')
          .select(`
            organization_id,
            role,
            organizations:organization_id (
              id,
              name,
              organization_type,
              created_at
            )
          `)
          .eq('user_id', req.session.userId)
          .eq('is_active', true);

        if (error) throw error;

        organizations = data?.map(uo => ({
          id: uo.organizations.id,
          name: uo.organizations.name,
          organization_type: uo.organizations.organization_type,
          created_at: uo.organizations.created_at,
          role: uo.role
        })) || [];
      }
    } else {
      // Not logged in: show all organizations (for setup/demo purposes)
      const { data, error } = await supabaseService
        .from('organizations')
        .select('id, name, organization_type, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      organizations = data || [];
    }

    res.render('auth/select-organization', {
      title: 'Select Organization',
      organizations: organizations || [],
      currentOrgId: req.session.organizationId || null,
      isAdmin: req.session.isAdmin || false,
      isGlobalAdmin: isGlobalAdmin,
      user: req.session.userId ? {
        id: req.session.userId,
        email: req.session.userEmail
      } : null
    });
  } catch (error) {
    console.error('Error loading organization selection:', error);
    res.status(500).send('Error loading organizations');
  }
});

/**
 * POST /auth/select - Set selected organization in session
 */
router.post('/select', async (req, res) => {
  try {
    const { organizationId } = req.body;
    const { supabaseService } = req;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }

    // Verify organization exists
    const { data: org, error } = await supabaseService
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single();

    if (error || !org) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    // Get user's role in this organization
    let userRole = 'member';
    let isAdmin = false;
    if (req.session.userId) {
      const { data: userOrg } = await supabaseService
        .from('user_organizations')
        .select('role')
        .eq('user_id', req.session.userId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .single();

      if (userOrg) {
        userRole = userOrg.role;
        isAdmin = ['owner', 'admin'].includes(userOrg.role);
      }
    }

    // Set organization in session
    req.session.organizationId = organizationId;
    req.session.organizationName = org.name;
    req.session.userRole = userRole;
    req.session.isAdmin = isAdmin;
    req.session.isConfigured = true;

    // Save session before responding (ensures persistence before client redirect)
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Error saving session:', saveErr);
        return res.status(500).json({
          success: false,
          error: 'Session save failed'
        });
      }

      res.json({
        success: true,
        message: `Switched to ${org.name}`,
        organizationId: org.id,
        organizationName: org.name
      });
    });
  } catch (error) {
    console.error('Error selecting organization:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /auth/switch/:organizationId - Quick organization switcher
 */
router.get('/switch/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { supabaseService } = req;

    // Verify organization exists
    const { data: org, error } = await supabaseService
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single();

    if (error || !org) {
      return res.status(404).send('Organization not found');
    }

    // Set organization in session
    req.session.organizationId = organizationId;
    req.session.organizationName = org.name;
    req.session.isConfigured = true;

    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error switching organization:', error);
    res.status(500).send('Error switching organization');
  }
});

/**
 * GET /auth/admin - Admin mode toggle
 * SECURITY: Only global admins can toggle admin mode
 * This prevents unauthorized users from gaining elevated privileges
 */
router.get('/admin', attachGlobalAdminStatus, requireGlobalAdmin, (req, res) => {
  req.session.isAdmin = !req.session.isAdmin;
  res.redirect('/auth/select');
});

// ============================================================================
// PASSWORD RESET ROUTES
// ============================================================================

/**
 * GET /auth/forgot-password
 * Display forgot password form
 */
router.get('/forgot-password', (req, res) => {
  // If already logged in, redirect to dashboard
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    error: null,
    success: null
  });
});

/**
 * POST /auth/forgot-password
 * Send password reset email via Supabase
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address'
      });
    }

    const { supabase } = req;

    // Send password reset email using Supabase
    // IMPORTANT: Supabase requires the redirect URL to be added to "Redirect URLs" in dashboard
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password`
    });

    if (error) {
      console.error('Password reset email error:', error);
      // Don't reveal whether email exists for security
      // Still return success message
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive password reset instructions shortly.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /auth/reset-password
 * Display password reset form
 * Token is provided via URL fragment by Supabase
 */
router.get('/reset-password', (req, res) => {
  // If already logged in, redirect to dashboard
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  res.render('auth/reset-password', {
    title: 'Reset Password',
    error: null
  });
});

/**
 * POST /auth/reset-password
 * Update user password via Supabase using recovery token
 * Accepts recovery token from URL fragment (sent by client)
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { password, confirmPassword, access_token, refresh_token } = req.body;

    // Validate input
    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both password and confirmation'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long'
      });
    }

    // Validate recovery token
    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: 'Recovery token is required. Please use the link from your email.'
      });
    }

    // Create Supabase client with the recovery token session
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    const supabaseWithToken = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    });

    // Set the session using the recovery tokens
    const { error: sessionError } = await supabaseWithToken.auth.setSession({
      access_token,
      refresh_token
    });

    if (sessionError) {
      console.error('Session setup error:', sessionError);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link. Please request a new one.'
      });
    }

    // Update password using the authenticated client
    const { data, error } = await supabaseWithToken.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('Password update error:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to update password'
      });
    }

    if (!data.user) {
      return res.status(400).json({
        success: false,
        error: 'Failed to update password. Please request a new reset link.'
      });
    }

    // Sign out to clear the reset token
    await supabaseWithToken.auth.signOut();

    res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in with your new password.',
      redirectTo: '/auth/login'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
