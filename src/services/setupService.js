/**
 * Setup Service
 * Handles all setup wizard business logic
 */

const wordParser = require('../parsers/wordParser');
const textParser = require('../parsers/textParser');
const hierarchyDetector = require('../parsers/hierarchyDetector');
const organizationConfig = require('../config/organizationConfig');
const sectionStorage = require('./sectionStorage');
const fs = require('fs').promises;
const path = require('path');

class SetupService {
  /**
   * Create organization record
   */
  async createOrganization(organizationData, supabase) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: organizationData.name,
          org_type: organizationData.type || 'neighborhood-council',
          settings: {
            terminology: organizationData.terminology || {},
            display: organizationData.display || {},
            features: organizationData.features || {}
          },
          is_configured: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating organization:', error);
        return { success: false, error: error.message };
      }

      return { success: true, organization: data };
    } catch (error) {
      console.error('Error in createOrganization:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save document configuration
   */
  async saveDocumentConfig(orgId, documentConfig, supabase) {
    try {
      // Build hierarchy configuration from document settings
      const hierarchyConfig = {
        levels: documentConfig.hierarchyLevels || [
          {
            name: 'Article',
            type: 'article',
            numbering: 'roman',
            prefix: 'Article ',
            depth: 0
          },
          {
            name: 'Section',
            type: 'section',
            numbering: 'numeric',
            prefix: 'Section ',
            depth: 1
          }
        ],
        maxDepth: documentConfig.maxDepth || 5,
        allowNesting: documentConfig.allowNesting !== false
      };

      // Update organization with document settings
      const { data, error } = await supabase
        .from('organizations')
        .update({
          hierarchy_config: hierarchyConfig,
          settings: {
            terminology: {
              documentName: documentConfig.documentName || 'Bylaws',
              sectionName: documentConfig.sectionName || 'Section',
              articleName: documentConfig.articleName || 'Article'
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) {
        console.error('Error saving document config:', error);
        return { success: false, error: error.message };
      }

      return { success: true, organization: data };
    } catch (error) {
      console.error('Error in saveDocumentConfig:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save workflow configuration
   */
  async saveWorkflowConfig(orgId, workflowConfig, supabase) {
    try {
      // Create workflow template
      const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .insert({
          organization_id: orgId,
          name: workflowConfig.name || 'Default Workflow',
          description: workflowConfig.description || 'Two-stage approval process',
          is_default: true,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (templateError) {
        console.error('Error creating workflow template:', templateError);
        return { success: false, error: templateError.message };
      }

      // Create workflow stages
      const stages = workflowConfig.stages || [
        {
          stage_name: 'Committee Review',
          stage_order: 1,
          can_lock: true,
          can_edit: true,
          can_approve: true,
          requires_approval: true,
          display_color: '#FFD700'
        },
        {
          stage_name: 'Board Approval',
          stage_order: 2,
          can_lock: false,
          can_edit: false,
          can_approve: true,
          requires_approval: true,
          display_color: '#90EE90'
        }
      ];

      const stageInserts = stages.map(stage => ({
        workflow_template_id: template.id,
        ...stage
      }));

      const { error: stagesError } = await supabase
        .from('workflow_stages')
        .insert(stageInserts);

      if (stagesError) {
        console.error('Error creating workflow stages:', stagesError);
        // Rollback: delete template
        await supabase.from('workflow_templates').delete().eq('id', template.id);
        return { success: false, error: stagesError.message };
      }

      return { success: true, template };
    } catch (error) {
      console.error('Error in saveWorkflowConfig:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process document import
   * @param {string} orgId - Organization ID
   * @param {string} filePath - Path to uploaded file
   * @param {object} supabase - Supabase client
   * @param {string} originalFilename - Optional original filename for document title
   */
  async processDocumentImport(orgId, filePath, supabase, originalFilename = null) {
    try {
      // Load organization config
      const config = await organizationConfig.loadConfig(orgId, supabase);

      // Debug: Check what config we actually have
      console.log('[SETUP-DEBUG] 📋 Loaded organization config:');
      console.log('[SETUP-DEBUG]   - Has hierarchy:', !!config.hierarchy);
      console.log('[SETUP-DEBUG]   - Hierarchy levels:', config.hierarchy?.levels?.length || 0);
      if (config.hierarchy?.levels) {
        config.hierarchy.levels.forEach(level => {
          console.log(`[SETUP-DEBUG]     * ${level.name} (type: ${level.type}, depth: ${level.depth})`);
        });
      }

      // Detect file type and select appropriate parser
      const ext = path.extname(filePath).toLowerCase();
      let parser;
      let parserName;

      if (['.txt', '.md'].includes(ext)) {
        parser = textParser;
        parserName = 'textParser';
        console.log(`[SETUP-DEBUG] 📄 Using textParser for ${ext} file`);
      } else if (['.docx', '.doc'].includes(ext)) {
        parser = wordParser;
        parserName = 'wordParser';
        console.log(`[SETUP-DEBUG] 📄 Using wordParser for ${ext} file`);
      } else {
        return {
          success: false,
          error: `Unsupported file type: ${ext}. Supported formats: .docx, .doc, .txt, .md`
        };
      }

      // Parse the document with the selected parser
      const parseResult = await parser.parseDocument(filePath, config);

      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse document'
        };
      }

      // Validate sections using the same parser's validation method
      const validation = parser.validateSections(parseResult.sections, config);

      if (!validation.valid) {
        return {
          success: false,
          error: 'Document validation failed',
          validationErrors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Create document record
      // FIX: Use actual original filename (without extension) as title instead of generic "Bylaws"
      // Priority: originalFilename param > extracted from filePath > config terminology > "Bylaws"
      let filename, filenameWithoutExt;

      if (originalFilename) {
        // Use original filename if provided (e.g., "My-Bylaws.docx")
        filename = originalFilename;
        filenameWithoutExt = path.basename(originalFilename, path.extname(originalFilename));
      } else {
        // Fall back to extracting from filePath (for backward compatibility)
        filename = path.basename(filePath);
        filenameWithoutExt = path.basename(filePath, path.extname(filePath));
      }

      const documentTitle = filenameWithoutExt || config.terminology?.documentName || 'Bylaws';

      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          organization_id: orgId,
          title: documentTitle,
          document_type: 'bylaws',
          status: 'draft',
          metadata: {
            source_file: filename,
            imported_at: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (docError) {
        console.error('Error creating document:', docError);
        return { success: false, error: docError.message };
      }

      console.log(`Document created with ID: ${document.id}`);
      console.log(`Storing ${parseResult.sections.length} sections...`);

      // Store sections using the new storage service
      const storageResult = await sectionStorage.storeSections(
        orgId,
        document.id,
        parseResult.sections,
        supabase
      );

      if (!storageResult.success) {
        console.error('Error storing sections:', storageResult.error);
        // Rollback: delete document
        await supabase.from('documents').delete().eq('id', document.id);
        return {
          success: false,
          error: storageResult.error,
          details: storageResult.stack
        };
      }

      console.log(`Successfully stored ${storageResult.sectionsStored} sections`);

      // Validate the stored sections
      const validationResult = await sectionStorage.validateStoredSections(
        document.id,
        supabase
      );

      if (!validationResult.success) {
        console.warn('Section validation warnings:', validationResult);
      } else if (validationResult.issues && validationResult.issues.length > 0) {
        console.warn(`Found ${validationResult.issues.length} validation issues:`, validationResult.issues);
      } else {
        console.log('All sections validated successfully');
      }

      // Clean up uploaded file
      try {
        await fs.unlink(filePath);
      } catch (cleanupError) {
        console.warn('Error cleaning up file:', cleanupError);
      }

      return {
        success: true,
        document,
        sectionsCount: storageResult.sectionsStored,
        sectionsStored: storageResult.sectionsStored,
        metadata: parseResult.metadata,
        warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
        validationResult: validationResult
      };
    } catch (error) {
      console.error('Error in processDocumentImport:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize database for organization
   */
  async initializeDatabase(orgId, supabase) {
    try {
      // Verify organization exists
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', orgId)
        .single();

      if (orgError || !org) {
        return { success: false, error: 'Organization not found' };
      }

      // Database is already initialized by previous steps
      // This method can be used for any additional initialization needed

      return { success: true };
    } catch (error) {
      console.error('Error in initializeDatabase:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete setup process
   */
  async completeSetup(orgId, supabase) {
    try {
      // Mark organization as configured
      const { data, error } = await supabase
        .from('organizations')
        .update({
          is_configured: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) {
        console.error('Error completing setup:', error);
        return { success: false, error: error.message };
      }

      // Clear configuration cache
      if (require('../middleware/setup-required').clearCache) {
        require('../middleware/setup-required').clearCache();
      }

      return { success: true, organization: data };
    } catch (error) {
      console.error('Error in completeSetup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get setup status
   */
  async getSetupStatus(orgId, supabase) {
    try {
      if (!orgId) {
        return {
          step: 'welcome',
          completed: false,
          progress: 0
        };
      }

      const { data: org, error } = await supabase
        .from('organizations')
        .select('id, is_configured, hierarchy_config')
        .eq('id', orgId)
        .single();

      if (error || !org) {
        return {
          step: 'organization',
          completed: false,
          progress: 10
        };
      }

      // Check what's been configured
      const hasOrg = !!org.id;
      const hasHierarchy = !!org.hierarchy_config;

      // Check for workflow template
      const { data: workflow } = await supabase
        .from('workflow_templates')
        .select('id')
        .eq('organization_id', orgId)
        .limit(1);

      const hasWorkflow = workflow && workflow.length > 0;

      // Check for document
      const { data: document } = await supabase
        .from('documents')
        .select('id')
        .eq('organization_id', orgId)
        .limit(1);

      const hasDocument = document && document.length > 0;

      // Determine current step and progress
      let step = 'welcome';
      let progress = 0;

      if (!hasOrg) {
        step = 'organization';
        progress = 10;
      } else if (!hasHierarchy) {
        step = 'document-type';
        progress = 30;
      } else if (!hasWorkflow) {
        step = 'workflow';
        progress = 50;
      } else if (!hasDocument) {
        step = 'import';
        progress = 70;
      } else {
        step = 'complete';
        progress = 100;
      }

      return {
        step,
        completed: org.is_configured,
        progress,
        organizationId: orgId,
        hasOrganization: hasOrg,
        hasHierarchy,
        hasWorkflow,
        hasDocument
      };
    } catch (error) {
      console.error('Error getting setup status:', error);
      return {
        step: 'welcome',
        completed: false,
        progress: 0,
        error: error.message
      };
    }
  }
}

module.exports = new SetupService();
