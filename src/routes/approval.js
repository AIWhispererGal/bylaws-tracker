/**
 * Approval Workflow Routes
 * Manage section approval progression through workflow stages
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { requireMember, requireStageApproval, canApproveStage } = require('../middleware/roleAuth');
const { WorkflowError, handleError } = require('../utils/errors');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const lockSectionSchema = Joi.object({
  section_id: Joi.string().uuid().required(),
  workflow_stage_id: Joi.string().uuid().required(),
  selected_suggestion_id: Joi.string().uuid().optional().allow(null),
  notes: Joi.string().max(5000).optional().allow('')
});

const progressSectionSchema = Joi.object({
  section_id: Joi.string().uuid().required(),
  notes: Joi.string().max(5000).optional().allow('').allow(null)
});

const approveSectionSchema = Joi.object({
  section_id: Joi.string().uuid().required(),
  workflow_stage_id: Joi.string().uuid().required(),
  status: Joi.string().valid('approved', 'rejected', 'in_progress').required(),
  notes: Joi.string().max(5000).optional().allow('')
});

const createVersionSchema = Joi.object({
  document_id: Joi.string().uuid().required(),
  version_name: Joi.string().max(255).optional().allow(''),
  description: Joi.string().max(5000).optional().allow(''),
  approval_stage: Joi.string().max(100).optional().allow('')
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
 * Get document's workflow template and stages
 */
async function getDocumentWorkflow(supabase, documentId) {
  const { data, error } = await supabase
    .from('document_workflows')
    .select(`
      workflow_template_id,
      workflow_templates:workflow_template_id (
        id,
        name,
        description,
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
      )
    `)
    .eq('document_id', documentId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get current workflow state for section
 */
async function getSectionWorkflowState(supabase, sectionId) {
  const { data, error } = await supabase
    .from('section_workflow_states')
    .select(`
      *,
      workflow_stages:workflow_stage_id (
        stage_name,
        stage_order
      )
    `)
    .eq('section_id', sectionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data;
}

// ============================================================================
// WORKFLOW PROGRESS VIEWING
// ============================================================================

/**
 * GET /approval/workflow/:documentId
 * Get workflow template and progress for document
 */
router.get('/workflow/:documentId', requireMember, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { supabase } = req;

    // Get workflow configuration
    const workflow = await getDocumentWorkflow(supabase, documentId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'No workflow configured for this document'
      });
    }

    // Get all sections for document
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, section_number, section_title')
      .eq('document_id', documentId)
      .order('path_ordinals', { ascending: true });

    if (sectionsError) throw sectionsError;

    // Get workflow states for all sections
    const sectionIds = sections.map(s => s.id);
    const { data: states } = await supabase
      .from('section_workflow_states')
      .select(`
        *,
        workflow_stages:workflow_stage_id (
          stage_name,
          stage_order
        )
      `)
      .in('section_id', sectionIds);

    // Build progress map
    const stateMap = new Map();
    (states || []).forEach(state => {
      if (!stateMap.has(state.section_id)) {
        stateMap.set(state.section_id, []);
      }
      stateMap.get(state.section_id).push(state);
    });

    // Attach states to sections
    const sectionsWithProgress = sections.map(section => {
      const sectionStates = stateMap.get(section.id) || [];
      const currentStage = sectionStates.find(s => s.status === 'in_progress' || s.status === 'approved');

      return {
        ...section,
        workflow_states: sectionStates,
        current_stage: currentStage?.workflow_stages?.stage_name || 'Not Started',
        current_stage_order: currentStage?.workflow_stages?.stage_order || 0,
        status: currentStage?.status || 'pending'
      };
    });

    // Calculate overall progress
    const stages = workflow.workflow_templates.workflow_stages || [];
    const totalStages = stages.length;
    const completedSections = sectionsWithProgress.filter(
      s => s.current_stage_order === totalStages && s.status === 'approved'
    ).length;
    const progressPercentage = sections.length > 0
      ? Math.round((completedSections / sections.length) * 100)
      : 0;

    res.json({
      success: true,
      workflow: {
        template: workflow.workflow_templates,
        stages
      },
      sections: sectionsWithProgress,
      progress: {
        totalSections: sections.length,
        completedSections,
        progressPercentage,
        stagesCount: totalStages
      }
    });
  } catch (error) {
    console.error('Error fetching workflow progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /approval/section/:sectionId/state
 * Get current workflow state for specific section
 */
router.get('/section/:sectionId/state', requireMember, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { supabase } = req;

    // Get section details
    const { data: section, error: sectionError } = await supabase
      .from('document_sections')
      .select('id, document_id, section_number, section_title')
      .eq('id', sectionId)
      .single();

    if (sectionError) throw sectionError;

    // Get workflow for document
    const workflow = await getDocumentWorkflow(supabase, section.document_id);

    // Get all states for this section
    const { data: states, error: statesError } = await supabase
      .from('section_workflow_states')
      .select(`
        *,
        workflow_stages:workflow_stage_id (
          stage_name,
          stage_order,
          can_lock,
          can_approve,
          required_roles
        ),
        users:actioned_by (
          email,
          name
        )
      `)
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true });

    if (statesError) throw statesError;

    // Check which stages user can approve
    const userId = req.session.userId;
    const stages = workflow?.workflow_templates?.workflow_stages || [];
    const userApprovalStages = [];

    for (const stage of stages) {
      const canApprove = await canApproveStage(req, stage.id);
      if (canApprove) {
        userApprovalStages.push(stage.id);
      }
    }

    res.json({
      success: true,
      section,
      workflow: workflow?.workflow_templates,
      states: states || [],
      userCanApprove: userApprovalStages
    });
  } catch (error) {
    console.error('Error fetching section state:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SECTION LOCKING AND APPROVAL
// ============================================================================

/**
 * POST /approval/lock
 * Lock section at specific workflow stage (with atomic race condition protection)
 */
router.post('/lock', requireMember, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = lockSectionSchema.validate(req.body);
    if (validationError) {
      throw new WorkflowError(
        validationError.details[0].message,
        'VALIDATION_ERROR',
        400
      );
    }

    const { section_id, workflow_stage_id, selected_suggestion_id, notes } = value;
    const { supabase, supabaseService } = req;
    const userId = req.session.userId;
    const organizationId = req.session.organizationId;

    // Check if user can approve at this stage
    if (!await canApproveStage(req, workflow_stage_id)) {
      throw new WorkflowError(
        'You do not have permission to lock sections at this workflow stage',
        'PERMISSION_DENIED',
        403
      );
    }

    // Call atomic lock function (prevents race condition)
    const { data, error } = await supabaseService.rpc('lock_section_atomic', {
      p_section_id: section_id,
      p_stage_id: workflow_stage_id,
      p_user_id: userId,
      p_suggestion_id: selected_suggestion_id,
      p_notes: notes || null
    });

    if (error) {
      console.error('Lock section database error:', error);
      throw new WorkflowError(
        'Failed to lock section',
        'DATABASE_ERROR',
        500
      );
    }

    // Check result from database function
    if (!data.success) {
      const statusCode = data.code === 'LOCK_CONTENTION' ? 409 : 400;
      throw new WorkflowError(
        data.error,
        data.code,
        statusCode
      );
    }

    // Log activity
    await logActivity(
      supabaseService,
      userId,
      organizationId,
      'section.locked',
      'section',
      section_id,
      {
        workflow_stage_id,
        selected_suggestion_id,
        notes
      }
    );

    res.status(200).json({
      success: true,
      message: 'Section locked successfully',
      state_id: data.state_id
    });

  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /approval/approve
 * Approve/reject section at workflow stage
 */
router.post('/approve', requireMember, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = approveSectionSchema.validate(req.body);
    if (validationError) {
      throw new WorkflowError(
        validationError.details[0].message,
        'VALIDATION_ERROR',
        400
      );
    }

    const { section_id, workflow_stage_id, status, notes } = value;
    const { supabase, supabaseService } = req;
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;
    const organizationId = req.session.organizationId;

    // Check if user can approve at this stage
    if (!await canApproveStage(req, workflow_stage_id)) {
      throw new WorkflowError(
        'You do not have permission to approve at this workflow stage',
        'PERMISSION_DENIED',
        403
      );
    }

    // Create or update workflow state
    const { data: state, error: stateError } = await supabaseService
      .from('section_workflow_states')
      .upsert({
        section_id,
        workflow_stage_id,
        status,
        actioned_by: userId,
        actioned_by_email: userEmail,
        actioned_at: new Date().toISOString(),
        notes,
        approval_metadata: {
          actioned_at: new Date().toISOString(),
          actioned_by: userId,
          approval_status: status
        }
      }, {
        onConflict: 'section_id,workflow_stage_id'
      })
      .select()
      .single();

    if (stateError) {
      console.error('Approve section database error:', stateError);
      throw new WorkflowError(
        'Failed to approve section',
        'DATABASE_ERROR',
        500
      );
    }

    // Log activity
    await logActivity(
      supabaseService,
      userId,
      organizationId,
      `section.${status}`,
      'section',
      section_id,
      {
        workflow_stage_id,
        notes
      }
    );

    res.json({
      success: true,
      message: `Section ${status} successfully`,
      state
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

/**
 * POST /approval/progress
 * Progress section to next workflow stage
 */
router.post('/progress', requireMember, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = progressSectionSchema.validate(req.body);
    if (validationError) {
      throw new WorkflowError(
        validationError.details[0].message,
        'VALIDATION_ERROR',
        400
      );
    }

    const { section_id, notes } = value;
    const { supabase, supabaseService } = req;
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;
    const organizationId = req.session.organizationId;

    // Get section's document
    const { data: section, error: sectionError } = await supabase
      .from('document_sections')
      .select('document_id')
      .eq('id', section_id)
      .single();

    if (sectionError || !section) {
      throw new WorkflowError(
        'Section not found',
        'SECTION_NOT_FOUND',
        404
      );
    }

    // Get workflow
    const workflow = await getDocumentWorkflow(supabase, section.document_id);
    if (!workflow) {
      throw new WorkflowError(
        'No workflow configured for this document',
        'WORKFLOW_NOT_FOUND',
        404
      );
    }

    // Get current state
    const currentState = await getSectionWorkflowState(supabase, section_id);

    // Determine next stage
    const stages = workflow.workflow_templates.workflow_stages || [];
    const sortedStages = stages.sort((a, b) => a.stage_order - b.stage_order);

    const currentStageOrder = currentState?.workflow_stages?.stage_order || 0;
    const nextStage = sortedStages.find(s => s.stage_order > currentStageOrder);

    if (!nextStage) {
      throw new WorkflowError(
        'Section is already at the final workflow stage',
        'FINAL_STAGE_REACHED',
        400
      );
    }

    // Check if user can approve at next stage
    if (!await canApproveStage(req, nextStage.id)) {
      throw new WorkflowError(
        'You do not have permission to progress to the next workflow stage',
        'PERMISSION_DENIED',
        403
      );
    }

    // Create state for next stage
    const { data: newState, error: stateError } = await supabaseService
      .from('section_workflow_states')
      .insert({
        section_id,
        workflow_stage_id: nextStage.id,
        status: 'in_progress',
        actioned_by: userId,
        actioned_by_email: userEmail,
        actioned_at: new Date().toISOString(),
        notes
      })
      .select()
      .single();

    if (stateError) {
      console.error('Progress section database error:', stateError);
      throw new WorkflowError(
        'Failed to progress section to next stage',
        'DATABASE_ERROR',
        500
      );
    }

    // Log activity
    await logActivity(
      supabaseService,
      userId,
      organizationId,
      'section.progressed',
      'section',
      section_id,
      {
        from_stage: currentState?.workflow_stages?.stage_name,
        to_stage: nextStage.stage_name,
        notes
      }
    );

    res.json({
      success: true,
      message: `Section progressed to ${nextStage.stage_name}`,
      state: newState,
      nextStage
    });
  } catch (error) {
    handleError(error, req, res);
  }
});

// ============================================================================
// DOCUMENT VERSIONING
// ============================================================================

/**
 * POST /approval/version
 * Create a version snapshot of document at current approval state
 */
router.post('/version', requireMember, async (req, res) => {
  try {
    // Validate input
    const { error: validationError, value } = createVersionSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    const { document_id, version_name, description, approval_stage } = value;
    const { supabase, supabaseService } = req;
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;
    const organizationId = req.session.organizationId;

    // Get document details
    const { data: document } = await supabase
      .from('documents')
      .select('version')
      .eq('id', document_id)
      .single();

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Get all sections
    const { data: sections } = await supabase
      .from('document_sections')
      .select('*')
      .eq('document_id', document_id)
      .order('path_ordinals', { ascending: true });

    // Get all workflow states
    const sectionIds = sections.map(s => s.id);
    const { data: states } = await supabase
      .from('section_workflow_states')
      .select(`
        *,
        workflow_stages:workflow_stage_id (
          stage_name,
          stage_order
        )
      `)
      .in('section_id', sectionIds);

    // Create snapshots
    const sectionsSnapshot = sections;
    const approvalSnapshot = states;

    // Generate version number
    const currentVersion = document.version || '1.0';
    const versionParts = currentVersion.split('.');
    const newMinorVersion = parseInt(versionParts[1] || 0) + 1;
    const newVersion = `${versionParts[0]}.${newMinorVersion}`;

    // Create version
    const { data: version, error: versionError } = await supabaseService
      .from('document_versions')
      .insert({
        document_id,
        version_number: newVersion,
        version_name: version_name || `Version ${newVersion}`,
        description,
        sections_snapshot: sectionsSnapshot,
        approval_snapshot: approvalSnapshot,
        created_by: userId,
        created_by_email: userEmail,
        approval_stage,
        metadata: {
          created_at: new Date().toISOString(),
          sections_count: sections.length,
          approval_states_count: states.length
        }
      })
      .select()
      .single();

    if (versionError) throw versionError;

    // Update document version
    await supabaseService
      .from('documents')
      .update({
        version: newVersion,
        updated_at: new Date().toISOString()
      })
      .eq('id', document_id);

    // Log activity
    await logActivity(
      supabaseService,
      userId,
      organizationId,
      'document.version_created',
      'document',
      document_id,
      {
        version_number: newVersion,
        version_name: version.version_name,
        sections_count: sections.length
      }
    );

    res.json({
      success: true,
      message: 'Document version created successfully',
      version
    });
  } catch (error) {
    console.error('Error creating document version:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /approval/versions/:documentId
 * Get all versions for document
 */
router.get('/versions/:documentId', requireMember, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { supabase } = req;

    const { data: versions, error } = await supabase
      .from('document_versions')
      .select(`
        *,
        users:created_by (
          email,
          name
        )
      `)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      versions: versions || []
    });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
