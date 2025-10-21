/**
 * Workflow Management API Routes
 * Complete RESTful API for workflow approval system
 *
 * Features:
 * - Workflow template CRUD operations
 * - Workflow stage management
 * - Section workflow state tracking
 * - Approval/rejection actions
 * - Approval history audit trail
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createWorkflowSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().max(1000).optional(),
  isDefault: Joi.boolean().default(false)
});

const updateWorkflowSchema = Joi.object({
  name: Joi.string().min(3).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  isDefault: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
  stages: Joi.array().items(Joi.object({
    id: Joi.alternatives().try(Joi.string().uuid(), Joi.string().allow(null)).optional(),
    stage_name: Joi.string().min(2).max(100).required(),
    stage_order: Joi.number().integer().min(1).required(),
    can_lock: Joi.boolean().default(false),
    can_edit: Joi.boolean().default(false),
    can_approve: Joi.boolean().default(true),
    requires_approval: Joi.boolean().default(true),
    required_roles: Joi.array().items(
      Joi.string().valid('owner', 'admin', 'member', 'viewer')
    ).min(1).required(),
    display_color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: Joi.string().max(50).optional().allow(''),
    description: Joi.string().max(500).optional().allow(''),
    approval_type: Joi.string().valid('single', 'majority', 'unanimous', 'supermajority').optional(),
    vote_threshold: Joi.number().integer().min(1).max(100).optional()
  })).optional()
});

const createStageSchema = Joi.object({
  stageName: Joi.string().min(2).max(100).required(),
  stageOrder: Joi.number().integer().min(1).optional(),
  canLock: Joi.boolean().default(false),
  canEdit: Joi.boolean().default(false),
  canApprove: Joi.boolean().default(true),
  requiresApproval: Joi.boolean().default(true),
  requiredRoles: Joi.array().items(
    Joi.string().valid('owner', 'admin', 'member', 'viewer')
  ).min(1).required(),
  displayColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: Joi.string().max(50).optional(),
  description: Joi.string().max(500).optional()
});

const approveRejectSchema = Joi.object({
  notes: Joi.string().max(2000).optional(),
  metadata: Joi.object().optional()
});

const reorderStagesSchema = Joi.object({
  stageOrders: Joi.array().items(
    Joi.object({
      stageId: Joi.string().uuid().required(),
      order: Joi.number().integer().min(1).required()
    })
  ).min(1).required()
});

// ============================================================================
// MIDDLEWARE - PERMISSION CHECKS
// ============================================================================

/**
 * Ensure user is authenticated
 */
function requireAuth(req, res, next) {
  console.log('[requireAuth] Checking auth for:', req.method, req.path);
  console.log('[requireAuth] Session userId:', req.session?.userId);

  if (!req.session.userId) {
    console.log('[requireAuth] No userId in session - returning 401');
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  console.log('[requireAuth] Auth passed, calling next()');
  next();
}

/**
 * Ensure user is admin for their organization
 */
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin && !req.isGlobalAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
}

/**
 * Ensure user has an active organization
 */
function requireOrganization(req, res, next) {
  if (!req.session.organizationId) {
    return res.status(400).json({
      success: false,
      error: 'Organization context required'
    });
  }
  next();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user can approve at specific workflow stage
 * @param {Object} supabase - Supabase client
 * @param {string} userId - User UUID
 * @param {string} stageId - Workflow stage UUID
 * @returns {Promise<boolean>}
 */
async function userCanApproveStage(supabase, userId, stageId, organizationId = null) {
  try {
    // Build query for user's organization membership
    let query = supabase
      .from('user_organizations')
      .select('role, permissions, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    // If organization ID provided, filter by it to handle multiple memberships
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data: userOrg, error: orgError } = await query.maybeSingle();

    if (orgError || !userOrg) {
      console.error('Error fetching user organization:', orgError);
      return false;
    }

    // Check if user has global admin or superuser permissions
    const permissions = userOrg.permissions || {};
    if (permissions.is_global_admin || permissions.is_superuser) {
      return true; // Global admins and superusers can approve all stages
    }

    // Check if user has "all" stages approval permission
    if (permissions.can_approve_stages &&
        Array.isArray(permissions.can_approve_stages) &&
        permissions.can_approve_stages.includes('all')) {
      return true;
    }

    // Get stage requirements
    const { data: stage, error: stageError } = await supabase
      .from('workflow_stages')
      .select('id, stage_name, required_roles, can_approve')
      .eq('id', stageId)
      .single();

    if (stageError || !stage) {
      console.error('Error fetching stage:', stageError);
      return false;
    }

    // Stage must allow approvals
    if (!stage.can_approve) {
      return false;
    }

    // Check if user has permission to approve this specific stage
    if (permissions.can_approve_stages &&
        Array.isArray(permissions.can_approve_stages) &&
        (permissions.can_approve_stages.includes(stageId) ||
         permissions.can_approve_stages.includes(stage.stage_name))) {
      return true;
    }

    // Check if user's role is in the required roles array
    return stage.required_roles && stage.required_roles.includes(userOrg.role);
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Get current workflow stage for a section
 * @param {Object} supabase - Supabase client
 * @param {string} sectionId - Section UUID
 * @returns {Promise<Object|null>}
 */
async function getCurrentWorkflowStage(supabase, sectionId) {
  try {
    const { data: sectionState, error } = await supabase
      .from('section_workflow_states')
      .select(`
        *,
        workflow_stage:workflow_stage_id (
          id,
          stage_name,
          stage_order,
          can_lock,
          can_edit,
          can_approve,
          requires_approval,
          required_roles,
          display_color,
          icon
        )
      `)
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching workflow stage:', error);
      return null;
    }

    return sectionState;
  } catch (error) {
    console.error('Get workflow stage error:', error);
    return null;
  }
}

/**
 * Create approval history entry
 * @param {Object} supabase - Supabase client
 * @param {string} sectionId - Section UUID
 * @param {string} userId - User UUID
 * @param {string} action - Action type (approved, rejected, advanced, locked)
 * @param {string} notes - Optional notes
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>}
 */
async function createApprovalHistory(supabase, sectionId, userId, action, notes = null, metadata = {}) {
  try {
    const { data, error } = await supabase
      .from('section_workflow_states')
      .insert({
        section_id: sectionId,
        status: action === 'approved' ? 'approved' : (action === 'rejected' ? 'rejected' : 'pending'),
        actioned_by: userId,
        actioned_at: new Date().toISOString(),
        approval_metadata: {
          action,
          notes,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating approval history:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Create approval history error:', error);
    return null;
  }
}

/**
 * Check if all sections in document are approved
 * @param {Object} supabase - Supabase client
 * @param {string} documentId - Document UUID
 * @returns {Promise<boolean>}
 */
async function checkDocumentApprovalStatus(supabase, documentId) {
  try {
    // Get all sections for document
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    if (sectionsError || !sections || sections.length === 0) {
      return false;
    }

    // Check if all sections have approved workflow state
    const { count: approvedCount, error: countError } = await supabase
      .from('section_workflow_states')
      .select('*', { count: 'exact', head: true })
      .in('section_id', sections.map(s => s.id))
      .eq('status', 'approved');

    if (countError) {
      console.error('Error counting approved sections:', countError);
      return false;
    }

    return approvedCount === sections.length;
  } catch (error) {
    console.error('Document approval check error:', error);
    return false;
  }
}

// ============================================================================
// WORKFLOW TEMPLATE ENDPOINTS
// ============================================================================

/**
 * GET /api/workflow/templates
 * List all workflow templates for current organization
 */
router.get('/templates', requireAuth, requireOrganization, async (req, res) => {
  try {
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    const { data: templates, error } = await supabaseService
      .from('workflow_templates')
      .select(`
        *,
        workflow_stages (
          id,
          stage_name,
          stage_order,
          can_lock,
          can_edit,
          can_approve,
          requires_approval,
          required_roles,
          display_color,
          icon
        )
      `)
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching workflow templates:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch workflow templates'
      });
    }

    res.json({
      success: true,
      templates: templates || []
    });
  } catch (error) {
    console.error('List workflow templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/templates
 * Create new workflow template (admin only)
 */
router.post('/templates', requireAuth, requireAdmin, requireOrganization, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = createWorkflowSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { name, description, isDefault } = value;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // If setting as default, unset other defaults first
    if (isDefault) {
      await supabaseService
        .from('workflow_templates')
        .update({ is_default: false })
        .eq('organization_id', organizationId);
    }

    // Create workflow template
    const { data: template, error } = await supabaseService
      .from('workflow_templates')
      .insert({
        organization_id: organizationId,
        name,
        description,
        is_default: isDefault,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create workflow template'
      });
    }

    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Create workflow template error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workflow/templates/:id
 * Get workflow template details with stages
 */
router.get('/templates/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { supabaseService } = req;

    const { data: template, error } = await supabaseService
      .from('workflow_templates')
      .select(`
        *,
        workflow_stages (
          id,
          stage_name,
          stage_order,
          can_lock,
          can_edit,
          can_approve,
          requires_approval,
          required_roles,
          display_color,
          icon,
          description
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching workflow template:', error);
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    // Sort stages by order
    if (template.workflow_stages) {
      template.workflow_stages.sort((a, b) => a.stage_order - b.stage_order);
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Get workflow template error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/workflow/templates/:id
 * Update workflow template (admin only)
 */
router.put('/templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error: validationError, value } = updateWorkflowSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: existing, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (existing.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // If setting as default, unset other defaults first
    if (value.isDefault) {
      await supabaseService
        .from('workflow_templates')
        .update({ is_default: false })
        .eq('organization_id', existing.organization_id);
    }

    // Update template
    const { data: template, error } = await supabaseService
      .from('workflow_templates')
      .update({
        name: value.name,
        description: value.description,
        is_default: value.isDefault,
        is_active: value.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating workflow template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update workflow template'
      });
    }

    // Handle stages if provided
    if (value.stages && Array.isArray(value.stages)) {
      // Get existing stages
      const { data: existingStages } = await supabaseService
        .from('workflow_stages')
        .select('id')
        .eq('workflow_template_id', id);

      const existingStageIds = (existingStages || []).map(s => s.id);
      const newStageIds = value.stages
        .filter(s => s.id && !s.id.startsWith('new-'))
        .map(s => s.id);

      // Delete stages that are no longer present
      const stagesToDelete = existingStageIds.filter(id => !newStageIds.includes(id));
      if (stagesToDelete.length > 0) {
        await supabaseService
          .from('workflow_stages')
          .delete()
          .in('id', stagesToDelete);
      }

      // Process each stage (create or update)
      for (const stage of value.stages) {
        const stageData = {
          workflow_template_id: id,
          stage_name: stage.stage_name,
          stage_order: stage.stage_order,
          can_lock: stage.can_lock || false,
          can_edit: stage.can_edit || false,
          can_approve: stage.can_approve || false,
          requires_approval: stage.requires_approval || false,
          required_roles: stage.required_roles || [],
          display_color: stage.display_color || '#6c757d',
          icon: stage.icon || '',
          description: stage.description || ''
        };

        // Add approval fields if they exist in database schema (future enhancement)
        // For now, these are collected by frontend but not stored
        // Uncomment when database columns are added:
        // if (stage.approval_type) stageData.approval_type = stage.approval_type;
        // if (stage.vote_threshold) stageData.vote_threshold = stage.vote_threshold;

        if (stage.id && !stage.id.startsWith('new-')) {
          // Update existing stage
          await supabaseService
            .from('workflow_stages')
            .update(stageData)
            .eq('id', stage.id);
        } else {
          // Create new stage
          await supabaseService
            .from('workflow_stages')
            .insert(stageData);
        }
      }
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Update workflow template error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/workflow/templates/:id
 * Delete workflow template (admin only, not if in use)
 */
router.delete('/templates/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: template, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id, name')
      .eq('id', id)
      .single();

    if (checkError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Check if template is in use
    const { count: usageCount, error: countError } = await supabaseService
      .from('document_workflows')
      .select('*', { count: 'exact', head: true })
      .eq('workflow_template_id', id);

    if (countError) {
      console.error('Error checking template usage:', countError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check template usage'
      });
    }

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete workflow template "${template.name}" - it is currently in use by ${usageCount} document(s)`
      });
    }

    // Delete template (CASCADE will delete stages)
    const { error: deleteError } = await supabaseService
      .from('workflow_templates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting workflow template:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete workflow template'
      });
    }

    res.json({
      success: true,
      message: `Workflow template "${template.name}" deleted successfully`
    });
  } catch (error) {
    console.error('Delete workflow template error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/templates/:id/set-default
 * Set workflow template as default for organization
 */
router.post('/templates/:id/set-default', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: template, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id, name')
      .eq('id', id)
      .single();

    if (checkError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Unset all other defaults
    await supabaseService
      .from('workflow_templates')
      .update({ is_default: false })
      .eq('organization_id', template.organization_id);

    // Set this template as default
    const { error: updateError } = await supabaseService
      .from('workflow_templates')
      .update({ is_default: true })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting default template:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to set default template'
      });
    }

    res.json({
      success: true,
      message: `"${template.name}" is now the default workflow template`
    });
  } catch (error) {
    console.error('Set default template error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/documents/:documentId/assign
 * Assign workflow template to document and initialize section states
 */
router.post('/documents/:documentId/assign', requireAuth, requireAdmin, requireOrganization, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { templateId } = req.body;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Validate template ID
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'Template ID is required'
      });
    }

    // Check if workflow already assigned
    const { data: existing } = await supabaseService
      .from('document_workflows')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'This document already has a workflow assigned. Remove the existing workflow first.'
      });
    }

    // Get template and verify organization access
    const { data: template, error: templateError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id, name')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Get first stage from template
    const { data: firstStage, error: stageError } = await supabaseService
      .from('workflow_stages')
      .select('id, stage_name')
      .eq('workflow_template_id', templateId)
      .order('stage_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (stageError || !firstStage) {
      return res.status(400).json({
        success: false,
        error: 'Template has no stages defined. Please add stages to the template first.'
      });
    }

    // Create document_workflows record
    const { error: workflowError } = await supabaseService
      .from('document_workflows')
      .insert({
        document_id: documentId,
        workflow_template_id: templateId
        // Note: activated_at has DEFAULT NOW() in database schema
      });

    if (workflowError) {
      console.error('Error creating document workflow:', workflowError);
      return res.status(500).json({
        success: false,
        error: 'Failed to assign workflow to document'
      });
    }

    // Get all sections for this document
    const { data: sections, error: sectionsError } = await supabaseService
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch document sections'
      });
    }

    if (!sections || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document has no sections. Add sections before assigning a workflow.'
      });
    }

    // Initialize workflow states for all sections at Stage 1
    const stateInserts = sections.map(section => ({
      section_id: section.id,
      workflow_stage_id: firstStage.id,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { error: statesError } = await supabaseService
      .from('section_workflow_states')
      .insert(stateInserts);

    if (statesError) {
      console.error('Error initializing section states:', statesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize workflow states for sections'
      });
    }

    res.json({
      success: true,
      message: `Workflow "${template.name}" assigned successfully to document`,
      data: {
        templateName: template.name,
        initialStage: firstStage.stage_name,
        sectionsInitialized: sections.length
      }
    });
  } catch (error) {
    console.error('Assign workflow error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// WORKFLOW STAGE ENDPOINTS
// ============================================================================

/**
 * POST /api/workflow/templates/:id/stages
 * Add stage to workflow template
 */
router.post('/templates/:id/stages', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const { error: validationError, value } = createStageSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: template, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id')
      .eq('id', templateId)
      .single();

    if (checkError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Get next stage order if not specified
    let stageOrder = value.stageOrder;
    if (!stageOrder) {
      const { data: existingStages } = await supabaseService
        .from('workflow_stages')
        .select('stage_order')
        .eq('workflow_template_id', templateId)
        .order('stage_order', { ascending: false })
        .limit(1);

      stageOrder = existingStages && existingStages.length > 0
        ? existingStages[0].stage_order + 1
        : 1;
    }

    // Create stage
    const { data: stage, error } = await supabaseService
      .from('workflow_stages')
      .insert({
        workflow_template_id: templateId,
        stage_name: value.stageName,
        stage_order: stageOrder,
        can_lock: value.canLock,
        can_edit: value.canEdit,
        can_approve: value.canApprove,
        requires_approval: value.requiresApproval,
        required_roles: value.requiredRoles,
        display_color: value.displayColor || '#6C757D',
        icon: value.icon || 'circle',
        description: value.description
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating workflow stage:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create workflow stage'
      });
    }

    res.status(201).json({
      success: true,
      stage
    });
  } catch (error) {
    console.error('Create workflow stage error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/workflow/templates/:id/stages/:stageId
 * Update workflow stage
 */
router.put('/templates/:id/stages/:stageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: templateId, stageId } = req.params;
    const { error: validationError, value } = createStageSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: template, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id')
      .eq('id', templateId)
      .single();

    if (checkError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Update stage
    const { data: stage, error } = await supabaseService
      .from('workflow_stages')
      .update({
        stage_name: value.stageName,
        stage_order: value.stageOrder,
        can_lock: value.canLock,
        can_edit: value.canEdit,
        can_approve: value.canApprove,
        requires_approval: value.requiresApproval,
        required_roles: value.requiredRoles,
        display_color: value.displayColor,
        icon: value.icon,
        description: value.description
      })
      .eq('id', stageId)
      .eq('workflow_template_id', templateId)
      .select()
      .single();

    if (error) {
      console.error('Error updating workflow stage:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update workflow stage'
      });
    }

    res.json({
      success: true,
      stage
    });
  } catch (error) {
    console.error('Update workflow stage error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/workflow/templates/:id/stages/:stageId
 * Delete workflow stage
 */
router.delete('/templates/:id/stages/:stageId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: templateId, stageId } = req.params;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: template, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id')
      .eq('id', templateId)
      .single();

    if (checkError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Check if stage is in use
    const { count: usageCount, error: countError } = await supabaseService
      .from('section_workflow_states')
      .select('*', { count: 'exact', head: true })
      .eq('workflow_stage_id', stageId);

    if (countError) {
      console.error('Error checking stage usage:', countError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check stage usage'
      });
    }

    if (usageCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete stage - it is currently in use by ${usageCount} section(s)`
      });
    }

    // Delete stage
    const { error: deleteError } = await supabaseService
      .from('workflow_stages')
      .delete()
      .eq('id', stageId)
      .eq('workflow_template_id', templateId);

    if (deleteError) {
      console.error('Error deleting workflow stage:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete workflow stage'
      });
    }

    res.json({
      success: true,
      message: 'Workflow stage deleted successfully'
    });
  } catch (error) {
    console.error('Delete workflow stage error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/templates/:id/stages/reorder
 * Reorder workflow stages
 */
router.post('/templates/:id/stages/reorder', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: templateId } = req.params;
    const { error: validationError, value } = reorderStagesSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    // Verify template belongs to organization
    const { data: template, error: checkError } = await supabaseService
      .from('workflow_templates')
      .select('id, organization_id')
      .eq('id', templateId)
      .single();

    if (checkError || !template) {
      return res.status(404).json({
        success: false,
        error: 'Workflow template not found'
      });
    }

    if (template.organization_id !== organizationId && !req.isGlobalAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow template'
      });
    }

    // Update stage orders
    const updatePromises = value.stageOrders.map(({ stageId, order }) =>
      supabaseService
        .from('workflow_stages')
        .update({ stage_order: order })
        .eq('id', stageId)
        .eq('workflow_template_id', templateId)
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Stages reordered successfully'
    });
  } catch (error) {
    console.error('Reorder stages error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SECTION WORKFLOW ENDPOINTS
// ============================================================================

/**
 * GET /api/workflow/sections/:sectionId/state
 * Get current workflow state for section
 */
router.get('/sections/:sectionId/state', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { supabaseService } = req;

    const state = await getCurrentWorkflowStage(supabaseService, sectionId);

    // Get section lock information
    const { data: section, error: sectionError } = await supabaseService
      .from('document_sections')
      .select('id, is_locked, locked_at, locked_by, locked_text, selected_suggestion_id, original_text, current_text')
      .eq('id', sectionId)
      .single();

    if (sectionError) {
      console.error('Error fetching section lock info:', sectionError);
    }

    // If no workflow state exists, return a default pending state
    if (!state) {
      return res.json({
        success: true,
        state: {
          status: 'pending',
          workflow_stage: {
            stage_name: 'Draft',
            display_color: '#6c757d',
            icon: 'pencil'
          }
        },
        permissions: {
          canApprove: false,
          canReject: false,
          canLock: false,
          canEdit: true
        },
        stage: {
          stage_name: 'Draft',
          display_color: '#6c757d',
          icon: 'pencil'
        },
        section: section || { is_locked: false }
      });
    }

    // Get user permissions for this stage
    const userId = req.session.userId;
    const organizationId = req.session.organizationId;
    const canApprove = await userCanApproveStage(
      supabaseService,
      userId,
      state.workflow_stage_id,
      organizationId
    );

    // Check if user can unlock (admin/owner/global admin only)
    const { data: userOrg, error: orgError } = await supabaseService
      .from('user_organizations')
      .select('role, permissions')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    const permissions = userOrg?.permissions || {};
    const isGlobalAdmin = permissions.is_global_admin || permissions.is_superuser || req.isGlobalAdmin;
    const isOwnerOrAdmin = ['owner', 'admin'].includes(userOrg?.role);
    const canUnlock = section?.is_locked && (isGlobalAdmin || isOwnerOrAdmin);

    res.json({
      success: true,
      state,
      permissions: {
        canApprove: canApprove && state.workflow_stage.can_approve,
        canReject: canApprove && state.workflow_stage.can_approve,
        canLock: canApprove && state.workflow_stage.can_lock && !section?.is_locked,
        canEdit: state.workflow_stage.can_edit && !section?.is_locked,
        canUnlock: canUnlock
      },
      stage: state.workflow_stage,
      section: section || { is_locked: false }
    });
  } catch (error) {
    console.error('Get workflow state error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/sections/:sectionId/approve
 * Approve section at current workflow stage
 */
router.post('/sections/:sectionId/approve', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { error: validationError, value } = approveRejectSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { supabaseService } = req;
    const userId = req.session.userId;

    // Get current workflow stage
    const currentState = await getCurrentWorkflowStage(supabaseService, sectionId);

    if (!currentState || !currentState.workflow_stage) {
      return res.status(404).json({
        success: false,
        error: 'Section has no active workflow stage'
      });
    }

    // Check if user can approve at this stage
    const organizationId = req.session.organizationId;
    const canApprove = await userCanApproveStage(
      supabaseService,
      userId,
      currentState.workflow_stage_id,
      organizationId
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to approve at this stage'
      });
    }

    // Check if section is locked before approving
    const { data: section, error: sectionError } = await supabaseService
      .from('document_sections')
      .select('is_locked')
      .eq('id', sectionId)
      .single();

    if (sectionError) {
      console.error('Error fetching section:', sectionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check section lock status'
      });
    }

    if (!section.is_locked) {
      return res.status(400).json({
        success: false,
        error: 'Section must be locked before approval. Please select a suggestion and lock it first.',
        code: 'SECTION_NOT_LOCKED',
        requiresLock: true
      });
    }

    // Update workflow state to approved
    const { data: updatedState, error: updateError } = await supabaseService
      .from('section_workflow_states')
      .update({
        status: 'approved',
        actioned_by: userId,
        actioned_at: new Date().toISOString(),
        approval_metadata: {
          action: 'approved',
          notes: value.notes,
          timestamp: new Date().toISOString(),
          ...value.metadata
        }
      })
      .eq('id', currentState.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving section:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to approve section'
      });
    }

    res.json({
      success: true,
      message: 'Section approved successfully',
      state: updatedState
    });
  } catch (error) {
    console.error('Approve section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/sections/:sectionId/reject
 * Reject section with reason
 */
router.post('/sections/:sectionId/reject', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { error: validationError, value } = approveRejectSchema.validate(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    if (!value.notes) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const { supabaseService } = req;
    const userId = req.session.userId;

    // Get current workflow stage
    const currentState = await getCurrentWorkflowStage(supabaseService, sectionId);

    if (!currentState || !currentState.workflow_stage) {
      return res.status(404).json({
        success: false,
        error: 'Section has no active workflow stage'
      });
    }

    // Check if user can approve/reject at this stage
    const organizationId = req.session.organizationId;
    const canApprove = await userCanApproveStage(
      supabaseService,
      userId,
      currentState.workflow_stage_id,
      organizationId
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to reject at this stage'
      });
    }

    // Update workflow state to rejected
    const { data: updatedState, error: updateError } = await supabaseService
      .from('section_workflow_states')
      .update({
        status: 'rejected',
        actioned_by: userId,
        actioned_at: new Date().toISOString(),
        approval_metadata: {
          action: 'rejected',
          notes: value.notes,
          timestamp: new Date().toISOString(),
          ...value.metadata
        }
      })
      .eq('id', currentState.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting section:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to reject section'
      });
    }

    res.json({
      success: true,
      message: 'Section rejected',
      state: updatedState
    });
  } catch (error) {
    console.error('Reject section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/sections/:sectionId/advance
 * Move section to next workflow stage
 */
router.post('/sections/:sectionId/advance', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { supabaseService } = req;
    const userId = req.session.userId;

    // Get current workflow stage
    const currentState = await getCurrentWorkflowStage(supabaseService, sectionId);

    if (!currentState || !currentState.workflow_stage) {
      return res.status(404).json({
        success: false,
        error: 'Section has no active workflow stage'
      });
    }

    // Check if current stage is approved
    if (currentState.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Section must be approved before advancing to next stage'
      });
    }

    // Get next stage
    const { data: nextStage, error: stageError } = await supabaseService
      .from('workflow_stages')
      .select('*')
      .eq('workflow_template_id', currentState.workflow_stage.workflow_template_id)
      .gt('stage_order', currentState.workflow_stage.stage_order)
      .order('stage_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (stageError) {
      console.error('Error fetching next stage:', stageError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch next workflow stage'
      });
    }

    if (!nextStage) {
      return res.status(400).json({
        success: false,
        error: 'Section is already at the final workflow stage'
      });
    }

    // Create new workflow state for next stage
    const { data: newState, error: createError } = await supabaseService
      .from('section_workflow_states')
      .insert({
        section_id: sectionId,
        workflow_stage_id: nextStage.id,
        status: 'pending',
        approval_metadata: {
          action: 'advanced',
          previous_stage: currentState.workflow_stage.stage_name,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (createError) {
      console.error('Error advancing section:', createError);
      return res.status(500).json({
        success: false,
        error: 'Failed to advance section to next stage'
      });
    }

    res.json({
      success: true,
      message: `Section advanced to "${nextStage.stage_name}"`,
      state: newState,
      nextStage
    });
  } catch (error) {
    console.error('Advance section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workflow/sections/:sectionId/history
 * Get approval history for section
 */
router.get('/sections/:sectionId/history', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { supabaseService } = req;

    // Return empty history for now since sections don't have workflow states yet
    // When workflow is fully implemented, this will query actual approval history
    const { data: history, error } = await supabaseService
      .from('section_workflow_states')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching approval history:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch approval history'
      });
    }

    res.json({
      success: true,
      history: history || []
    });
  } catch (error) {
    console.error('Get approval history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SUGGESTION REJECTION ENDPOINTS (Phase 2)
// ============================================================================

/**
 * POST /api/workflow/suggestions/:suggestionId/reject
 * Reject a suggestion at current workflow stage
 * Requires admin permissions (owner, admin, or global admin)
 */
router.post('/suggestions/:suggestionId/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { sectionId, notes } = req.body;
    const { supabaseService } = req;
    const userId = req.session.userId;

    // Fetch current workflow stage for the section
    const { data: workflowState } = await supabaseService
      .from('section_workflow_states')
      .select(`
        workflow_stage_id,
        workflow_stage:workflow_stages(stage_name)
      `)
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentStageId = workflowState?.workflow_stage_id;
    const stageName = workflowState?.workflow_stage?.stage_name || 'Unknown';

    // Update suggestion with rejection info
    const { data: suggestion, error } = await supabaseService
      .from('suggestions')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_by: userId,
        rejected_at_stage_id: currentStageId,
        rejection_notes: notes || `Rejected at ${stageName} stage`,
        updated_at: new Date().toISOString()
      })
      .eq('id', suggestionId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting suggestion:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to reject suggestion'
      });
    }

    res.json({
      success: true,
      suggestion,
      message: `Suggestion rejected at ${stageName} stage`
    });
  } catch (error) {
    console.error('Reject suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/suggestions/:suggestionId/unreject
 * Reverse rejection (admin only)
 */
router.post('/suggestions/:suggestionId/unreject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { supabaseService } = req;

    // Update suggestion to reopen
    const { data: suggestion, error } = await supabaseService
      .from('suggestions')
      .update({
        status: 'open',
        rejected_at: null,
        rejected_by: null,
        rejected_at_stage_id: null,
        rejection_notes: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', suggestionId)
      .select()
      .single();

    if (error) {
      console.error('Error unrejecting suggestion:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unreject suggestion'
      });
    }

    res.json({
      success: true,
      suggestion,
      message: 'Suggestion reopened successfully'
    });
  } catch (error) {
    console.error('Unreject suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workflow/documents/:docId/suggestions
 * Fetch suggestions with optional status filter
 * NOTE: Rejected suggestions are NOT loaded by default (requires includeRejected=true)
 */
router.get('/documents/:docId/suggestions', requireAuth, async (req, res) => {
  try {
    const { docId } = req.params;
    const { status, includeRejected } = req.query;
    const { supabaseService } = req;

    // DEFENSIVE CHECK - Critical for debugging
    if (!supabaseService) {
      console.error('[SUGGESTIONS API] CRITICAL: supabaseService is undefined!');
      console.error('[SUGGESTIONS API] req.supabaseService:', req.supabaseService);
      console.error('[SUGGESTIONS API] This indicates middleware failure');
      return res.status(500).json({
        success: false,
        error: 'Database client not initialized',
        details: 'Server configuration error - contact administrator'
      });
    }

    console.log('[SUGGESTIONS API] Request params:', { docId, status, includeRejected });

    let query = supabaseService
      .from('suggestions')
      .select('*')
      .eq('document_id', docId);

    console.log('[SUGGESTIONS API] Base query created');

    // Filter by status if provided
    if (status && status !== 'all') {
      console.log('[SUGGESTIONS API] Adding status filter:', status);
      query = query.eq('status', status);
    }

    // IMPORTANT: Exclude rejected unless explicitly requested
    // This supports the "Show Rejected" toggle button
    if (includeRejected !== 'true' && status !== 'rejected') {
      console.log('[SUGGESTIONS API] Excluding rejected suggestions');
      query = query.neq('status', 'rejected');
    }

    query = query.order('created_at', { ascending: false });

    console.log('[SUGGESTIONS API] Executing query...');
    const { data: suggestions, error } = await query;
    console.log('[SUGGESTIONS API] Query completed. Error:', !!error, 'Count:', suggestions?.length || 0);

    if (error) {
      console.error('Error fetching suggestions:', error);
      console.error('Query params:', { docId, status, includeRejected });
      console.error('Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch suggestions',
        details: error.hint || error.details || 'Check server logs'
      });
    }

    res.json({
      success: true,
      suggestions: suggestions || [],
      count: (suggestions || []).length,
      includesRejected: includeRejected === 'true'
    });
  } catch (error) {
    console.error('Fetch suggestions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SECTION WORKFLOW ENDPOINTS (Enhanced Lock Endpoint)
// ============================================================================

/**
 * POST /api/workflow/sections/:sectionId/lock
 * Lock section with approved suggestion
 *
 * ENHANCED (Phase 2): Returns complete section data, updated workflow state,
 * and updated suggestions list to enable client-side refresh without additional API calls
 */
router.post('/sections/:sectionId/lock', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { suggestionId, notes } = req.body;
    const { supabaseService } = req;
    const userId = req.session.userId;

    // Get current workflow stage
    const currentState = await getCurrentWorkflowStage(supabaseService, sectionId);

    if (!currentState || !currentState.workflow_stage) {
      return res.status(404).json({
        success: false,
        error: 'Section has no active workflow stage'
      });
    }

    // Check if stage allows locking
    if (!currentState.workflow_stage.can_lock) {
      return res.status(400).json({
        success: false,
        error: 'Current workflow stage does not allow section locking'
      });
    }

    // Check if user can approve at this stage
    const organizationId = req.session.organizationId;
    const canApprove = await userCanApproveStage(
      supabaseService,
      userId,
      currentState.workflow_stage_id,
      organizationId
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to lock sections at this stage'
      });
    }

    // Get current section text first
    const { data: currentSection, error: currentSectionError } = await supabaseService
      .from('document_sections')
      .select('current_text, original_text')
      .eq('id', sectionId)
      .single();

    if (currentSectionError) {
      console.error('Error fetching current section:', currentSectionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch section data'
      });
    }

    // Get suggestion if provided
    let suggestedText = null;
    if (suggestionId) {
      const { data: suggestion, error: suggestionError } = await supabaseService
        .from('suggestions')
        .select('suggested_text')
        .eq('id', suggestionId)
        .single();

      if (!suggestionError && suggestion) {
        suggestedText = suggestion.suggested_text;
      }
    }

    // Determine what text to lock (suggestion or current text)
    const textToLock = suggestedText || currentSection.current_text || currentSection.original_text;

    // Lock the section and update current_text to the locked text
    const { data: section, error: lockError } = await supabaseService
      .from('document_sections')
      .update({
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: userId,
        selected_suggestion_id: suggestionId,
        locked_text: textToLock,
        // Update current_text to the locked text
        current_text: textToLock
      })
      .eq('id', sectionId)
      .select()
      .single();

    if (lockError) {
      console.error('Error locking section:', lockError);
      return res.status(500).json({
        success: false,
        error: 'Failed to lock section'
      });
    }

    // Update workflow state metadata to record the lock action
    // (Don't create new workflow state - locking doesn't change stages)
    if (currentState.id) {
      await supabaseService
        .from('section_workflow_states')
        .update({
          approval_metadata: {
            ...currentState.approval_metadata,
            locked: true,
            locked_by: userId,
            locked_at: new Date().toISOString(),
            locked_suggestion_id: suggestionId,
            locked_notes: notes
          }
        })
        .eq('id', currentState.id);
    }

    // ============================================================================
    // PHASE 2 ENHANCEMENT: Return comprehensive data for client-side refresh
    // ============================================================================

    // Get updated workflow state with permissions
    const updatedState = await getCurrentWorkflowStage(supabaseService, sectionId);

    // Check user permissions for this stage
    const canApproveNow = await userCanApproveStage(
      supabaseService,
      userId,
      updatedState?.workflow_stage_id,
      organizationId
    );

    // Get updated suggestions list for this section
    // First get suggestion IDs from suggestion_sections junction table
    const { data: sectionSuggestions } = await supabaseService
      .from('suggestion_sections')
      .select('suggestion_id')
      .eq('section_id', sectionId);

    const suggestionIds = (sectionSuggestions || []).map(ss => ss.suggestion_id);

    let updatedSuggestions = [];
    if (suggestionIds.length > 0) {
      const { data } = await supabaseService
        .from('suggestions')
        .select('*')
        .in('id', suggestionIds)
        .neq('status', 'rejected') // Exclude rejected by default
        .order('created_at', { ascending: false });

      updatedSuggestions = data || [];
    }

    res.json({
      success: true,
      message: 'Section locked successfully',
      // Complete section data
      section: {
        id: section.id,
        is_locked: section.is_locked,
        locked_at: section.locked_at,
        locked_by: section.locked_by,
        locked_text: section.locked_text,
        current_text: section.current_text,
        original_text: section.original_text,
        selected_suggestion_id: section.selected_suggestion_id
      },
      // Updated workflow state
      workflow: {
        status: 'locked',
        stage: updatedState?.workflow_stage,
        canApprove: canApproveNow && updatedState?.workflow_stage?.can_approve,
        canLock: false, // Disabled after locking
        canEdit: updatedState?.workflow_stage?.can_edit && !section.is_locked
      },
      // Updated suggestions list
      suggestions: updatedSuggestions || []
    });
  } catch (error) {
    console.error('Lock section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// DOCUMENT-LEVEL WORKFLOW PROGRESSION ENDPOINTS (MVP TASK 2)
// ============================================================================

/**
 * POST /api/workflow/documents/:documentId/approve-unmodified
 * Bulk approve all sections that have no suggestions (unmodified)
 * Admin/Owner only
 */
router.post('/documents/:documentId/approve-unmodified', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { supabaseService } = req;
    const userId = req.session.userId;
    const organizationId = req.session.organizationId;

    // Get all sections for this document
    const { data: sections, error: sectionsError } = await supabaseService
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch document sections'
      });
    }

    if (!sections || sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document has no sections'
      });
    }

    const sectionIds = sections.map(s => s.id);

    // Get sections that have suggestions
    const { data: suggestedSections } = await supabaseService
      .from('suggestion_sections')
      .select('section_id')
      .in('section_id', sectionIds);

    const sectionsWithSuggestions = new Set(
      (suggestedSections || []).map(ss => ss.section_id)
    );

    // Find unmodified sections (no suggestions)
    const unmodifiedSections = sections.filter(s => !sectionsWithSuggestions.has(s.id));

    if (unmodifiedSections.length === 0) {
      return res.json({
        success: true,
        message: 'No unmodified sections to approve',
        approvedCount: 0
      });
    }

    // Get current workflow states for unmodified sections
    const { data: workflowStates } = await supabaseService
      .from('section_workflow_states')
      .select('section_id, workflow_stage_id, status')
      .in('section_id', unmodifiedSections.map(s => s.id))
      .order('created_at', { ascending: false });

    // Build map of current states
    const stateMap = new Map();
    (workflowStates || []).forEach(state => {
      if (!stateMap.has(state.section_id)) {
        stateMap.set(state.section_id, state);
      }
    });

    // Approve each unmodified section
    let approvedCount = 0;
    for (const section of unmodifiedSections) {
      const currentState = stateMap.get(section.id);

      if (!currentState || currentState.status === 'approved') {
        continue; // Skip if no workflow or already approved
      }

      // Update to approved
      const { error: updateError } = await supabaseService
        .from('section_workflow_states')
        .update({
          status: 'approved',
          actioned_by: userId,
          actioned_at: new Date().toISOString(),
          approval_metadata: {
            action: 'auto-approved',
            reason: 'No modifications suggested',
            timestamp: new Date().toISOString()
          }
        })
        .eq('section_id', section.id)
        .eq('workflow_stage_id', currentState.workflow_stage_id);

      if (!updateError) {
        approvedCount++;
      }
    }

    res.json({
      success: true,
      message: `Approved ${approvedCount} unmodified section(s)`,
      approvedCount,
      totalSections: sections.length
    });
  } catch (error) {
    console.error('Approve unmodified sections error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/documents/:documentId/progress
 * Progress document to next workflow stage
 * Creates new version with all approved changes
 * Admin/Owner only
 */
router.post('/documents/:documentId/progress', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { notes } = req.body;
    const { supabaseService } = req;
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;
    const organizationId = req.session.organizationId;

    // Get document details
    const { data: document, error: docError } = await supabaseService
      .from('documents')
      .select('id, title, version, organization_id')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Get workflow configuration
    const { data: workflow } = await supabaseService
      .from('document_workflows')
      .select(`
        workflow_template_id,
        workflow_templates:workflow_template_id (
          id,
          name,
          workflow_stages (
            id,
            stage_name,
            stage_order
          )
        )
      `)
      .eq('document_id', documentId)
      .single();

    if (!workflow) {
      return res.status(400).json({
        success: false,
        error: 'Document has no workflow assigned'
      });
    }

    // Get all sections
    const { data: sections, error: sectionsError } = await supabaseService
      .from('document_sections')
      .select('*')
      .eq('document_id', documentId)
      .order('path_ordinals', { ascending: true });

    if (sectionsError || !sections) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch document sections'
      });
    }

    // Check if ALL sections are approved
    const sectionIds = sections.map(s => s.id);
    const { data: workflowStates } = await supabaseService
      .from('section_workflow_states')
      .select('section_id, status, workflow_stage_id')
      .in('section_id', sectionIds)
      .order('created_at', { ascending: false });

    // Build map of current states
    const stateMap = new Map();
    (workflowStates || []).forEach(state => {
      if (!stateMap.has(state.section_id)) {
        stateMap.set(state.section_id, state);
      }
    });

    // Check if all sections are approved
    const unapprovedSections = sections.filter(s => {
      const state = stateMap.get(s.id);
      return !state || state.status !== 'approved';
    });

    if (unapprovedSections.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot progress: ${unapprovedSections.length} section(s) not approved`,
        unapprovedCount: unapprovedSections.length,
        totalSections: sections.length
      });
    }

    // Build new document version with approved changes
    const sectionsSnapshot = sections.map(section => {
      // Use locked_text if locked, otherwise current_text or original_text
      const finalText = section.is_locked
        ? section.locked_text
        : (section.current_text || section.original_text);

      return {
        ...section,
        final_text: finalText,
        was_modified: section.is_locked && section.locked_text !== section.original_text
      };
    });

    // Get all approved suggestions
    const { data: approvedSuggestions } = await supabaseService
      .from('suggestions')
      .select('id, section_id, status')
      .eq('document_id', documentId)
      .eq('status', 'approved');

    const appliedSuggestions = (approvedSuggestions || []).map(s => ({
      id: s.id,
      section_id: s.section_id,
      action: 'applied',
      applied_at: new Date().toISOString()
    }));

    // Get current stage name
    const currentStage = stateMap.values().next().value;
    const stageName = workflow.workflow_templates?.workflow_stages?.find(
      s => s.id === currentStage?.workflow_stage_id
    )?.stage_name || 'Unknown';

    // Create new document version using database function
    const { data: versionData, error: versionError } = await supabaseService
      .rpc('create_document_version', {
        p_document_id: documentId,
        p_version_name: `Progression from ${stageName}`,
        p_description: notes || `Document progressed from ${stageName} stage`,
        p_sections_snapshot: sectionsSnapshot,
        p_approval_snapshot: workflowStates || [],
        p_applied_suggestions: appliedSuggestions,
        p_workflow_stage: stageName,
        p_workflow_template_id: workflow.workflow_template_id,
        p_created_by: userId,
        p_created_by_email: userEmail
      });

    if (versionError) {
      console.error('Error creating document version:', versionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create document version'
      });
    }

    // Mark suggestions as implemented
    if (approvedSuggestions && approvedSuggestions.length > 0) {
      await supabaseService
        .from('suggestions')
        .update({
          status: 'implemented',
          implemented_at: new Date().toISOString(),
          implemented_in_version: versionData[0].version_id
        })
        .in('id', approvedSuggestions.map(s => s.id));
    }

    res.json({
      success: true,
      message: `Document progressed successfully to version ${versionData[0].version_number}`,
      version: {
        id: versionData[0].version_id,
        version_number: versionData[0].version_number
      },
      stats: {
        sectionsProcessed: sections.length,
        suggestionsApplied: appliedSuggestions.length,
        fromStage: stageName
      }
    });
  } catch (error) {
    console.error('Progress document error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/workflow/documents/:documentId/progress-status
 * Check if document is ready to progress (all sections approved)
 */
router.get('/documents/:documentId/progress-status', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { supabaseService } = req;

    // Get all sections
    const { data: sections } = await supabaseService
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    if (!sections || sections.length === 0) {
      return res.json({
        success: true,
        canProgress: false,
        reason: 'No sections in document',
        stats: {
          totalSections: 0,
          approvedSections: 0,
          percentage: 0
        }
      });
    }

    const sectionIds = sections.map(s => s.id);

    // Get workflow states
    const { data: workflowStates } = await supabaseService
      .from('section_workflow_states')
      .select('section_id, status')
      .in('section_id', sectionIds)
      .order('created_at', { ascending: false });

    // Build map of current states
    const stateMap = new Map();
    (workflowStates || []).forEach(state => {
      if (!stateMap.has(state.section_id)) {
        stateMap.set(state.section_id, state);
      }
    });

    // Count approved sections
    const approvedCount = sections.filter(s => {
      const state = stateMap.get(s.id);
      return state && state.status === 'approved';
    }).length;

    const percentage = Math.round((approvedCount / sections.length) * 100);
    const canProgress = approvedCount === sections.length;

    // Count unmodified sections
    const { data: suggestedSections } = await supabaseService
      .from('suggestion_sections')
      .select('section_id')
      .in('section_id', sectionIds);

    const sectionsWithSuggestions = new Set(
      (suggestedSections || []).map(ss => ss.section_id)
    );

    const unmodifiedCount = sections.filter(s => !sectionsWithSuggestions.has(s.id)).length;

    res.json({
      success: true,
      canProgress,
      reason: canProgress ? 'All sections approved' : `${sections.length - approvedCount} section(s) pending approval`,
      stats: {
        totalSections: sections.length,
        approvedSections: approvedCount,
        unmodifiedSections: unmodifiedCount,
        percentage
      }
    });
  } catch (error) {
    console.error('Check progress status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/workflow/sections/:sectionId/unlock
 * Unlock section (admin/owner/global admin only)
 */
router.post('/sections/:sectionId/unlock', requireAuth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { notes } = req.body;
    const { supabaseService } = req;
    const userId = req.session.userId;
    const organizationId = req.session.organizationId;

    // Check if user is admin, owner, or global admin
    const { data: userOrg, error: orgError } = await supabaseService
      .from('user_organizations')
      .select('role, permissions')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (orgError || !userOrg) {
      return res.status(403).json({
        success: false,
        error: 'Organization membership required'
      });
    }

    // Check permissions
    const permissions = userOrg.permissions || {};
    const isGlobalAdmin = permissions.is_global_admin || permissions.is_superuser || req.isGlobalAdmin;
    const isOwnerOrAdmin = ['owner', 'admin'].includes(userOrg.role);

    if (!isGlobalAdmin && !isOwnerOrAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only organization admins, owners, or global admins can unlock sections'
      });
    }

    // Unlock the section
    const { data: section, error: unlockError } = await supabaseService
      .from('document_sections')
      .update({
        is_locked: false,
        locked_at: null,
        locked_by: null,
        selected_suggestion_id: null,
        locked_text: null
        // Note: We keep current_text as-is (the previously locked text becomes the current text)
      })
      .eq('id', sectionId)
      .select()
      .single();

    if (unlockError) {
      console.error('Error unlocking section:', unlockError);
      return res.status(500).json({
        success: false,
        error: 'Failed to unlock section'
      });
    }

    // Get current workflow state to update metadata
    const currentState = await getCurrentWorkflowStage(supabaseService, sectionId);
    if (currentState && currentState.id) {
      await supabaseService
        .from('section_workflow_states')
        .update({
          approval_metadata: {
            ...currentState.approval_metadata,
            unlocked: true,
            unlocked_by: userId,
            unlocked_at: new Date().toISOString(),
            unlock_notes: notes
          }
        })
        .eq('id', currentState.id);
    }

    res.json({
      success: true,
      message: 'Section unlocked successfully',
      section
    });
  } catch (error) {
    console.error('Unlock section error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
