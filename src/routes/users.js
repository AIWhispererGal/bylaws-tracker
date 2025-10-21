/**
 * User Management Routes
 * Organization-level user administration
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { requireAdmin, requireOwner } = require('../middleware/roleAuth');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const inviteUserSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(255).optional().allow(''),
  role: Joi.string().valid('owner', 'admin', 'member', 'viewer').default('member')
});

const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member', 'viewer').required()
});

const updateUserPermissionsSchema = Joi.object({
  permissions: Joi.object({
    can_edit_sections: Joi.boolean().optional(),
    can_create_suggestions: Joi.boolean().optional(),
    can_vote: Joi.boolean().optional(),
    can_approve_stages: Joi.array().items(Joi.string().uuid()).optional(),
    can_manage_users: Joi.boolean().optional(),
    can_manage_workflows: Joi.boolean().optional()
  }).required()
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Log user activity
 */
async function logActivity(supabase, userId, organizationId, actionType, entityType, entityId, actionData = {}) {
  try {
    await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        action_data: actionData
      });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Check organization user limit
 * Returns default limit of 50 users per organization
 */
async function checkUserLimit(supabase, organizationId) {
  // Default user limit per organization
  // This can be made configurable in the future by adding max_users column to organizations table
  const maxUsers = 50;

  const { count, error: countError } = await supabase
    .from('user_organizations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (countError) throw countError;

  const currentUsers = count || 0;

  return {
    current: currentUsers,
    max: maxUsers,
    available: maxUsers - currentUsers,
    isAtLimit: currentUsers >= maxUsers
  };
}

// ============================================================================
// USER LISTING AND DETAILS
// ============================================================================

/**
 * GET /users
 * List all users in current organization
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { supabase } = req;
    const organizationId = req.session.organizationId;

    const { data: userOrgs, error } = await supabase
      .from('user_organizations')
      .select(`
        id,
        role,
        is_active,
        joined_at,
        last_active,
        invited_at,
        invited_by,
        users:user_id (
          id,
          email,
          name,
          avatar_url,
          last_login
        )
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    // Get user limit info
    const userLimit = await checkUserLimit(supabase, organizationId);

    res.json({
      success: true,
      users: userOrgs || [],
      userLimit
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /users/:userId
 * Get details for specific user
 */
router.get('/:userId', requireAdmin, async (req, res) => {
  try {
    const { supabase } = req;
    const { userId } = req.params;
    const organizationId = req.session.organizationId;

    const { data: userOrg, error } = await supabase
      .from('user_organizations')
      .select(`
        *,
        users:user_id (
          id,
          email,
          name,
          avatar_url,
          last_login,
          created_at
        )
      `)
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (error) throw error;

    if (!userOrg) {
      return res.status(404).json({
        success: false,
        error: 'User not found in organization'
      });
    }

    // Get recent activity
    const { data: activity } = await supabase
      .from('user_activity_log')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      success: true,
      user: userOrg,
      recentActivity: activity || []
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// USER INVITATION
// ============================================================================

/**
 * POST /users/invite
 * Invite new user to organization
 */
router.post('/invite', requireAdmin, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = inviteUserSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { email, name, role } = value;
    const { supabase, supabaseService } = req;
    const organizationId = req.session.organizationId;
    const inviterId = req.session.userId;

    // Check user limit
    const userLimit = await checkUserLimit(supabaseService, organizationId);
    if (userLimit.isAtLimit) {
      return res.status(403).json({
        success: false,
        error: `Organization has reached its user limit (${userLimit.max} users)`
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseService
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let userId;

    if (existingUser) {
      // Check if already member of this organization
      const { data: existingMembership } = await supabaseService
        .from('user_organizations')
        .select('id, is_active')
        .eq('user_id', existingUser.id)
        .eq('organization_id', organizationId)
        .single();

      if (existingMembership) {
        if (existingMembership.is_active) {
          return res.status(400).json({
            success: false,
            error: 'User is already a member of this organization'
          });
        } else {
          // Reactivate existing membership
          const { error: reactivateError } = await supabaseService
            .from('user_organizations')
            .update({
              is_active: true,
              role,
              invited_at: new Date().toISOString(),
              invited_by: inviterId
            })
            .eq('id', existingMembership.id);

          if (reactivateError) throw reactivateError;

          await logActivity(
            supabaseService,
            inviterId,
            organizationId,
            'user.reactivated',
            'user',
            existingUser.id,
            { email, role }
          );

          return res.json({
            success: true,
            message: 'User membership reactivated',
            user: {
              id: existingUser.id,
              email,
              role
            }
          });
        }
      }

      userId = existingUser.id;
    } else {
      // Create new user account (using Supabase Auth)
      const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          name: name || null,
          organization_id: organizationId,
          role: role
        },
        redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth/accept-invite`
      });

      if (authError) {
        return res.status(400).json({
          success: false,
          error: `Failed to send invitation: ${authError.message}`
        });
      }

      if (!authData.user) {
        return res.status(400).json({
          success: false,
          error: 'Failed to create user invitation'
        });
      }

      // Create user record
      const { data: newUser, error: userError } = await supabaseService
        .from('users')
        .insert({
          id: authData.user.id,
          email: authData.user.email,
          name: name || null,
          auth_provider: 'supabase'
        })
        .select()
        .single();

      if (userError) throw userError;

      userId = newUser.id;
    }

    // Create user_organization membership
    const { data: userOrg, error: membershipError } = await supabaseService
      .from('user_organizations')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        role: role,
        invited_at: new Date().toISOString(),
        invited_by: inviterId,
        is_active: true
      })
      .select()
      .single();

    if (membershipError) throw membershipError;

    // Log activity
    await logActivity(
      supabaseService,
      inviterId,
      organizationId,
      'user.invited',
      'user',
      userId,
      { email, role }
    );

    res.json({
      success: true,
      message: `Invitation sent to ${email}`,
      user: {
        id: userId,
        email,
        role,
        invited_at: userOrg.invited_at
      }
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invite user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// USER ROLE MANAGEMENT
// ============================================================================

/**
 * PUT /users/:userId/role
 * Update user's role in organization
 */
router.put('/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { supabase, supabaseService } = req;
    const organizationId = req.session.organizationId;
    const currentUserId = req.session.userId;

    // Validate input
    const { error: validationError, value } = updateUserRoleSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { role: newRole } = value;

    // Prevent users from changing their own role
    if (userId === currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot change your own role'
      });
    }

    // Get current user's role
    const { data: currentUserRole } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('organization_id', organizationId)
      .single();

    // Only owners can assign owner role
    if (newRole === 'owner' && currentUserRole.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'Only organization owners can assign owner role'
      });
    }

    // Update role
    const { data: updated, error: updateError } = await supabaseService
      .from('user_organizations')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(
      supabaseService,
      currentUserId,
      organizationId,
      'user.role_changed',
      'user',
      userId,
      { new_role: newRole }
    );

    res.json({
      success: true,
      message: 'User role updated',
      user: updated
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /users/:userId/permissions
 * Update user's custom permissions
 */
router.put('/:userId/permissions', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;
    const currentUserId = req.session.userId;

    // Validate input
    const { error: validationError, value } = updateUserPermissionsSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { permissions } = value;

    // Update permissions
    const { data: updated, error: updateError } = await supabaseService
      .from('user_organizations')
      .update({
        permissions,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(
      supabaseService,
      currentUserId,
      organizationId,
      'user.permissions_changed',
      'user',
      userId,
      { permissions }
    );

    res.json({
      success: true,
      message: 'User permissions updated',
      user: updated
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// USER REMOVAL
// ============================================================================

/**
 * DELETE /users/:userId
 * Remove user from organization (deactivate)
 */
router.delete('/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;
    const currentUserId = req.session.userId;

    // Prevent users from removing themselves
    if (userId === currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Cannot remove yourself from the organization'
      });
    }

    // Deactivate membership instead of deleting
    const { error: updateError } = await supabaseService
      .from('user_organizations')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('organization_id', organizationId);

    if (updateError) throw updateError;

    // Log activity
    await logActivity(
      supabaseService,
      currentUserId,
      organizationId,
      'user.removed',
      'user',
      userId,
      {}
    );

    res.json({
      success: true,
      message: 'User removed from organization'
    });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// ACTIVITY LOG
// ============================================================================

/**
 * GET /users/activity
 * Get organization activity log
 */
router.get('/activity/log', requireAdmin, async (req, res) => {
  try {
    const { supabase } = req;
    const organizationId = req.session.organizationId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { data: activities, error } = await supabase
      .from('user_activity_log')
      .select(`
        *,
        users:user_id (
          email,
          name
        )
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      activities: activities || [],
      pagination: {
        limit,
        offset,
        hasMore: activities && activities.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
