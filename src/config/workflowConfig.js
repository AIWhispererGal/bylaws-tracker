/**
 * Workflow Configuration Manager
 * Handles workflow stage definitions and state transitions
 */

class WorkflowConfig {
  constructor() {
    this.workflows = new Map();
  }

  /**
   * Load workflow configuration for an organization
   */
  async loadWorkflow(organizationId, supabase) {
    // Check cache first
    const cacheKey = `workflow_${organizationId}`;
    if (this.workflows.has(cacheKey)) {
      return this.workflows.get(cacheKey);
    }

    try {
      // Load default workflow template for organization
      const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .select(`
          *,
          stages:workflow_stages (*)
        `)
        .eq('organization_id', organizationId)
        .eq('is_default', true)
        .single();

      if (templateError || !template) {
        return this.getDefaultWorkflow();
      }

      // Sort stages by order
      template.stages = template.stages.sort((a, b) => a.stage_order - b.stage_order);

      // Cache the workflow
      this.workflows.set(cacheKey, template);
      return template;
    } catch (error) {
      console.error('Error loading workflow:', error);
      return this.getDefaultWorkflow();
    }
  }

  /**
   * Get default workflow configuration
   */
  getDefaultWorkflow() {
    return {
      id: 'default',
      name: 'Default Workflow',
      stages: [
        {
          id: 'stage_1',
          stage_name: 'Committee Review',
          stage_order: 1,
          can_lock: true,
          can_edit: true,
          can_approve: true,
          requires_approval: true,
          display_color: '#FFD700',
          icon: 'clipboard-check'
        },
        {
          id: 'stage_2',
          stage_name: 'Board Approval',
          stage_order: 2,
          can_lock: false,
          can_edit: false,
          can_approve: true,
          requires_approval: true,
          display_color: '#90EE90',
          icon: 'check-circle'
        }
      ]
    };
  }

  /**
   * Get current stage for a section
   */
  async getCurrentStage(sectionId, supabase) {
    try {
      const { data, error } = await supabase
        .from('section_workflow_states')
        .select(`
          *,
          stage:workflow_stages (*)
        `)
        .eq('section_id', sectionId)
        .eq('status', 'approved')
        .order('stage.stage_order', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0];
    } catch (error) {
      console.error('Error getting current stage:', error);
      return null;
    }
  }

  /**
   * Get next stage in workflow
   */
  getNextStage(currentStage, workflow) {
    if (!currentStage) {
      return workflow.stages[0];
    }

    const currentOrder = currentStage.stage_order || currentStage.stage?.stage_order;
    const nextStage = workflow.stages.find(s => s.stage_order === currentOrder + 1);

    return nextStage || null;
  }

  /**
   * Check if section can transition to next stage
   */
  async canTransition(sectionId, targetStageId, userId, supabase) {
    try {
      // Get current stage
      const currentState = await this.getCurrentStage(sectionId, supabase);

      // Get target stage
      const { data: targetStage, error } = await supabase
        .from('workflow_stages')
        .select('*')
        .eq('id', targetStageId)
        .single();

      if (error || !targetStage) {
        return { allowed: false, reason: 'Invalid target stage' };
      }

      // Check if sequential workflow is enforced
      if (currentState) {
        const workflow = await this.loadWorkflow(currentState.organization_id, supabase);

        if (workflow.require_sequential) {
          const nextStage = this.getNextStage(currentState.stage, workflow);
          if (nextStage && nextStage.id !== targetStageId) {
            return {
              allowed: false,
              reason: `Must complete ${nextStage.stage_name} first`
            };
          }
        }
      }

      // Check user permissions for target stage
      // TODO: Implement permission checking based on user role

      return { allowed: true };
    } catch (error) {
      console.error('Error checking transition:', error);
      return { allowed: false, reason: error.message };
    }
  }

  /**
   * Transition section to new stage
   */
  async transitionStage(sectionId, stageId, userId, notes, supabase) {
    try {
      const { data, error } = await supabase
        .from('section_workflow_states')
        .upsert({
          section_id: sectionId,
          workflow_stage_id: stageId,
          status: 'approved',
          actioned_by: userId,
          actioned_at: new Date().toISOString(),
          notes: notes
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, state: data };
    } catch (error) {
      console.error('Error transitioning stage:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get workflow progress for a document
   */
  async getDocumentProgress(documentId, supabase) {
    try {
      // Get all sections for document
      const { data: sections, error: sectionsError } = await supabase
        .from('document_sections')
        .select('id')
        .eq('document_id', documentId);

      if (sectionsError) throw sectionsError;

      const sectionIds = sections.map(s => s.id);

      // Get workflow states for all sections
      const { data: states, error: statesError } = await supabase
        .from('section_workflow_states')
        .select(`
          section_id,
          status,
          stage:workflow_stages (
            stage_name,
            stage_order
          )
        `)
        .in('section_id', sectionIds)
        .eq('status', 'approved');

      if (statesError) throw statesError;

      // Aggregate progress by stage
      const progress = {};
      states.forEach(state => {
        const stageName = state.stage.stage_name;
        if (!progress[stageName]) {
          progress[stageName] = {
            count: 0,
            order: state.stage.stage_order
          };
        }
        progress[stageName].count++;
      });

      return {
        totalSections: sections.length,
        stageProgress: progress
      };
    } catch (error) {
      console.error('Error getting document progress:', error);
      return null;
    }
  }

  /**
   * Clear cached workflows
   */
  clearCache(organizationId = null) {
    if (organizationId) {
      this.workflows.delete(`workflow_${organizationId}`);
    } else {
      this.workflows.clear();
    }
  }
}

module.exports = new WorkflowConfig();
