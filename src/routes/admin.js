/**
 * Admin Dashboard Routes
 * View and manage all organizations from a central dashboard
 *
 * UPDATED: Now uses new permissions architecture from migration 024
 */

const express = require('express');
const router = express.Router();
const { requireGlobalAdmin } = require('../middleware/globalAdmin');
const {
  requireMinRoleLevel,
  requirePermission,
  attachPermissions
} = require('../middleware/permissions');

/**
 * Middleware to check admin access (organization-level OR global admin)
 * For organization-specific admin tasks
 * Allows both org admins and global admins to access
 */
function requireAdmin(req, res, next) {
  // Allow if user is org admin OR global admin
  if (!req.session.isAdmin && !req.isGlobalAdmin) {
    return res.status(403).render('error', {
      title: 'Access Denied',
      message: 'Admin access required',
      error: { status: 403 }
    });
  }
  next();
}

/**
 * GET /admin/users - User management page
 * UPDATED: Uses new permissions system (admin level 3+)
 */
router.get('/users', requirePermission('can_manage_users', true), attachPermissions, async (req, res) => {
  try {
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;
    const currentUserId = req.session.userId;

    // Fetch all users in the organization with their roles and details
    const { data: userOrgs, error: userOrgsError } = await supabaseService
      .from('user_organizations')
      .select(`
        id,
        user_id,
        role,
        is_active,
        joined_at,
        created_at,
        last_active
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (userOrgsError) {
      console.error('Error fetching user organizations:', userOrgsError);
      throw userOrgsError;
    }

    // Get user details for each user_organization entry
    let users = [];
    if (userOrgs && userOrgs.length > 0) {
      const userIds = userOrgs.map(uo => uo.user_id);

      // Fetch user details from users table
      const { data: userDetails, error: usersError } = await supabaseService
        .from('users')
        .select('id, email, full_name, is_global_admin, created_at')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching user details:', usersError);
      }

      // Also try to get last sign in from auth.users if available
      let authUsers = [];
      try {
        const { data: authData } = await supabaseService.auth.admin.listUsers();
        if (authData && authData.users) {
          authUsers = authData.users;
        }
      } catch (authError) {
        console.log('Could not fetch auth users (may need admin privileges)');
      }

      // Combine all data
      users = userOrgs.map(userOrg => {
        const userDetail = userDetails?.find(u => u.id === userOrg.user_id) || {};
        const authUser = authUsers.find(u => u.id === userOrg.user_id);

        return {
          id: userOrg.user_id,
          email: userDetail.email || 'Unknown',
          full_name: userDetail.full_name || userDetail.email || 'Unknown User',
          role: userDetail.is_global_admin ? 'global_admin' : userOrg.role,
          is_global_admin: userDetail.is_global_admin || false,
          status: userOrg.is_active ? 'active' : 'inactive',
          created_at: userOrg.created_at || userOrg.joined_at,
          // Try to get last active from various sources
          last_active: authUser?.last_sign_in_at ||
                      userOrg.last_active ||
                      null
        };
      });
    }

    // Get current user details
    const currentUser = users.find(u => u.id === currentUserId) || {
      id: currentUserId,
      email: req.session.userEmail,
      role: req.session.userRole,
      is_global_admin: req.session.isGlobalAdmin || false
    };

    // Organization settings for user limits
    const maxUsers = 50; // Default limit, can be made configurable
    const userCount = users.length;

    // Check if current user is admin/owner
    const isAdmin = currentUser.role === 'admin' ||
                   currentUser.role === 'owner' ||
                   currentUser.is_global_admin;

    // Render the users.ejs template with all required data
    res.render('admin/users', {
      title: 'User Management',
      organizationId: organizationId,
      organizationName: req.session.organizationName,
      users: users,
      currentUser: currentUser,
      isAdmin: isAdmin,
      maxUsers: maxUsers,
      userCount: userCount,
      // NEW: Pass permissions to view
      permissions: req.permissions || {},
      userRole: req.userRole || null,
      userType: req.userType || null
    });
  } catch (error) {
    console.error('User management page error:', error);
    res.status(500).send('Error loading user management page');
  }
});

/**
 * GET /admin/dashboard - Admin overview of user's organizations
 * Shows organizations where user has admin or owner access
 */
router.get('/dashboard', attachPermissions, async (req, res) => {
  try {
    const { supabaseService } = req;
    const userId = req.session.userId;

    // Get organizations where user has admin or owner role
    const { data: userOrgs, error: orgsError } = await supabaseService
      .from('user_organizations')
      .select(`
        organization_id,
        role,
        organizations!inner(*)
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('role', ['owner', 'admin'])
      .order('created_at', { ascending: false });

    if (orgsError) throw orgsError;

    // Extract organizations from joined data
    const organizations = userOrgs?.map(uo => ({
      ...uo.organizations,
      userRole: uo.role
    })) || [];

    // Enrich each organization with statistics
    const enrichedOrgs = await Promise.all(
      (organizations || []).map(async (org) => {
        // Get document count
        const { count: docCount } = await supabaseService
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        // Get section count
        const { data: docs } = await supabaseService
          .from('documents')
          .select('id')
          .eq('organization_id', org.id);

        let sectionCount = 0;
        if (docs && docs.length > 0) {
          const docIds = docs.map(d => d.id);
          const { count } = await supabaseService
            .from('document_sections')
            .select('*', { count: 'exact', head: true })
            .in('document_id', docIds);
          sectionCount = count || 0;
        }

        // Get suggestion count
        let suggestionCount = 0;
        if (docs && docs.length > 0) {
          const docIds = docs.map(d => d.id);
          const { count } = await supabaseService
            .from('suggestions')
            .select('*', { count: 'exact', head: true })
            .in('document_id', docIds)
            .eq('status', 'open');
          suggestionCount = count || 0;
        }

        // Get user count
        const { count: userCount } = await supabaseService
          .from('user_organizations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id);

        return {
          ...org,
          stats: {
            documents: docCount || 0,
            sections: sectionCount,
            suggestions: suggestionCount,
            users: userCount || 0
          }
        };
      })
    );

    // Calculate system-wide statistics
    const systemStats = {
      totalOrganizations: organizations.length,
      totalDocuments: enrichedOrgs.reduce((sum, org) => sum + org.stats.documents, 0),
      totalSections: enrichedOrgs.reduce((sum, org) => sum + org.stats.sections, 0),
      totalSuggestions: enrichedOrgs.reduce((sum, org) => sum + org.stats.suggestions, 0),
      totalUsers: enrichedOrgs.reduce((sum, org) => sum + org.stats.users, 0)
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      organizations: enrichedOrgs,
      systemStats,
      currentOrgId: req.session.organizationId || null
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).send('Error loading admin dashboard');
  }
});

/**
 * GET /admin/organization - Organization settings/configuration page
 * Shows settings for organizations where user has admin access
 */
router.get('/organization', requirePermission('can_configure_organization', true), attachPermissions, async (req, res) => {
  try {
    const { supabaseService } = req;
    const userId = req.session.userId;

    // Get organizations where user has admin or owner role
    const { data: userOrgs, error: userOrgsError } = await supabaseService
      .from('user_organizations')
      .select(`
        organization_id,
        role,
        organizations!inner(
          id,
          name,
          organization_type,
          state,
          country,
          created_at,
          settings,
          hierarchy_config
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('role', ['owner', 'admin']);

    if (userOrgsError) throw userOrgsError;

    // Extract organizations from the joined data
    const organizations = userOrgs?.map(uo => ({
      ...uo.organizations,
      userRole: uo.role
    })) || [];

    res.render('admin/organization-settings', {
      title: 'Organization Settings',
      organizations: organizations,
      currentOrgId: req.session.organizationId || null
    });
  } catch (error) {
    console.error('Organization settings page error:', error);
    res.status(500).send('Error loading organization settings page');
  }
});

/**
 * GET /admin/organization/:id - Detailed organization view
 */
router.get('/organization/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { supabaseService } = req;

    // Get organization details
    const { data: org, error: orgError } = await supabaseService
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (orgError || !org) {
      return res.status(404).send('Organization not found');
    }

    // Get documents
    const { data: documents } = await supabaseService
      .from('documents')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false });

    // Get users
    // Step 1: Get user_organizations (bypasses RLS with service role)
    const { data: userOrgs, error: userOrgsError } = await supabaseService
      .from('user_organizations')
      .select('*')
      .eq('organization_id', id);

    console.log('[ADMIN-ORG] User organizations found:', userOrgs?.length || 0);

    if (userOrgsError) {
      console.error('[ADMIN-ORG] Error fetching user orgs:', userOrgsError);
    }

    // Step 2: Get user details separately if we have userOrgs
    let users = [];
    if (userOrgs && userOrgs.length > 0) {
      const userIds = userOrgs.map(uo => uo.user_id);

      console.log('[ADMIN-ORG] Fetching user details for IDs:', userIds);

      const { data: userDetails, error: usersError } = await supabaseService
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);

      if (usersError) {
        console.error('[ADMIN-ORG] Error fetching users:', usersError);
      }

      console.log('[ADMIN-ORG] User details found:', userDetails?.length || 0);

      // Manually join the data
      users = userOrgs.map(userOrg => ({
        ...userOrg,
        users: userDetails?.find(u => u.id === userOrg.user_id) || null
      }));
    } else {
      console.log('[ADMIN-ORG] No user organizations found for org:', id);
    }

    console.log('[ADMIN-ORG] Final users count:', users.length);

    // Get recent activity
    const { data: recentSuggestions } = await supabaseService
      .from('suggestions')
      .select(`
        *,
        documents:document_id (
          title,
          organization_id
        )
      `)
      .limit(10)
      .order('created_at', { ascending: false });

    const orgActivity = (recentSuggestions || []).filter(
      s => s.documents?.organization_id === id
    );

    res.render('admin/organization-detail', {
      title: `Admin - ${org.name}`,
      organization: org,
      documents: documents || [],
      users: users || [],
      recentActivity: orgActivity
    });
  } catch (error) {
    console.error('Organization detail error:', error);
    res.status(500).send('Error loading organization details');
  }
});

/**
 * POST /admin/organization/:id/delete - Delete organization (with confirmation)
 */
router.post('/organization/:id/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;
    const { supabaseService } = req;

    if (confirm !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { confirm: "DELETE" }'
      });
    }

    // Note: This would need cascade deletes or manual cleanup
    // For now, just delete the organization record
    // Fix: Use match() for proper Supabase delete chaining
    const { error } = await supabaseService
      .from('organizations')
      .delete()
      .match({ id });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Organization deleted'
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/workflows - Workflow template management
 */
router.get('/workflows', requireAdmin, async (req, res) => {
  try {
    const { supabaseService } = req;
    const organizationId = req.query.org || req.session.organizationId;

    if (!organizationId) {
      return res.status(400).send('Organization context required');
    }

    // Get all workflow templates for organization
    const { data: templates, error: templatesError } = await supabaseService
      .from('workflow_templates')
      .select(`
        *,
        stages:workflow_stages(*)
      `)
      .eq('organization_id', organizationId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (templatesError) throw templatesError;

    // Enrich templates with document counts
    const enrichedTemplates = await Promise.all(
      (templates || []).map(async (template) => {
        const { count: docCount } = await supabaseService
          .from('document_workflows')
          .select('*', { count: 'exact', head: true })
          .eq('workflow_template_id', template.id);

        return {
          ...template,
          document_count: docCount || 0,
          stages: (template.stages || []).sort((a, b) => a.stage_order - b.stage_order)
        };
      })
    );

    res.render('admin/workflow-templates', {
      title: 'Workflow Templates',
      templates: enrichedTemplates
    });
  } catch (error) {
    console.error('Workflow templates page error:', error);
    res.status(500).send('Error loading workflow templates');
  }
});

/**
 * GET /admin/workflows/create - Create new workflow template
 */
router.get('/workflows/create', requireAdmin, async (req, res) => {
  try {
    res.render('admin/workflow-editor', {
      title: 'Create Workflow Template',
      template: null
    });
  } catch (error) {
    console.error('Workflow create page error:', error);
    res.status(500).send('Error loading workflow editor');
  }
});

/**
 * GET /admin/workflows/:id/edit - Edit existing workflow template
 */
router.get('/workflows/:id/edit', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { supabaseService } = req;

    // Get template with stages
    const { data: template, error: templateError } = await supabaseService
      .from('workflow_templates')
      .select(`
        *,
        stages:workflow_stages(*)
      `)
      .eq('id', id)
      .single();

    if (templateError || !template) {
      return res.status(404).send('Template not found');
    }

    // Sort stages by order
    template.stages = (template.stages || []).sort((a, b) => a.stage_order - b.stage_order);

    res.render('admin/workflow-editor', {
      title: `Edit ${template.name}`,
      template: template
    });
  } catch (error) {
    console.error('Workflow edit page error:', error);
    res.status(500).send('Error loading workflow editor');
  }
});

/**
 * GET /admin/documents/:documentId/assign-workflow - Workflow assignment page
 * Allows admins to assign a workflow template to a document
 */
router.get('/documents/:documentId/assign-workflow', requireAdmin, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { supabaseService } = req;
    const organizationId = req.session.organizationId;

    if (!organizationId) {
      return res.status(400).render('error', {
        message: 'Organization context required',
        user: req.user
      });
    }

    // Get document
    const { data: document, error: docError } = await supabaseService
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', organizationId)
      .single();

    if (docError || !document) {
      return res.status(404).render('error', {
        message: 'Document not found',
        user: req.user
      });
    }

    // Get sections count
    const { data: sections } = await supabaseService
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    // Check if workflow already assigned
    const { data: existing } = await supabaseService
      .from('document_workflows')
      .select('id')
      .eq('document_id', documentId)
      .maybeSingle();

    // Get templates
    const { data: templates } = await supabaseService
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
          display_color
        )
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    res.render('admin/workflow-assign', {
      title: 'Assign Workflow',
      document,
      sections: sections || [],
      templates: templates || [],
      hasWorkflow: !!existing,
      user: req.user,
      currentUser: req.user
    });
  } catch (error) {
    console.error('Workflow assignment page error:', error);
    res.status(500).render('error', {
      message: 'Error loading workflow assignment page',
      user: req.user
    });
  }
});

/**
 * POST /admin/documents/upload - Upload a new document
 * Allows org admins to upload additional documents after initial setup
 */
router.post('/documents/upload', requireAdmin, async (req, res) => {
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs').promises;

  // Configure multer for this route
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(__dirname, '../../uploads/documents');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
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
        'text/plain',
        'text/markdown'
      ];

      // Also check file extension as a fallback (some browsers may not send correct MIME types)
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = ['.docx', '.doc', '.txt', '.md'];

      if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only .doc, .docx, .txt, and .md files are allowed'));
      }
    }
  }).single('document');

  // Handle upload with multer middleware
  upload(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'File upload failed'
      });
    }

    try {
      const { supabaseService } = req;
      const organizationId = req.session.organizationId;

      // Validate organization access
      if (!organizationId) {
        // Clean up uploaded file
        if (req.file) {
          await fs.unlink(req.file.path).catch(console.error);
        }
        return res.status(400).json({
          success: false,
          error: 'No organization selected'
        });
      }

      // Verify user has admin access to this organization
      const { data: userOrg } = await supabaseService
        .from('user_organizations')
        .select('role')
        .eq('user_id', req.session.userId)
        .eq('organization_id', organizationId)
        .single();

      if (!userOrg || !['admin', 'owner', 'superuser'].includes(userOrg.role)) {
        // Clean up uploaded file
        if (req.file) {
          await fs.unlink(req.file.path).catch(console.error);
        }
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      console.log('[ADMIN-UPLOAD] Processing document:', req.file.originalname);
      console.log('[ADMIN-UPLOAD] Organization:', organizationId);

      // Use setupService to process the document import
      const setupService = require('../services/setupService');

      const importResult = await setupService.processDocumentImport(
        organizationId,
        req.file.path,
        supabaseService
      );

      // Clean up uploaded file after processing
      await fs.unlink(req.file.path).catch(console.error);

      if (importResult.success) {
        console.log('[ADMIN-UPLOAD] Successfully imported document with', importResult.sectionsCount, 'sections');

        res.json({
          success: true,
          message: `Document uploaded successfully with ${importResult.sectionsCount} sections`,
          document: {
            id: importResult.document.id,
            title: importResult.document.title,
            sectionsCount: importResult.sectionsCount
          },
          warnings: importResult.warnings || []
        });
      } else {
        console.error('[ADMIN-UPLOAD] Import failed:', importResult.error);
        res.status(400).json({
          success: false,
          error: importResult.error || 'Failed to process document',
          validationErrors: importResult.validationErrors || [],
          warnings: importResult.warnings || []
        });
      }
    } catch (error) {
      console.error('[ADMIN-UPLOAD] Fatal error:', error);

      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  });
});

// ============================================================================
// HIERARCHY CONFIGURATION ENDPOINTS (Phase 2)
// ============================================================================

/**
 * GET /admin/documents/:docId/hierarchy
 * Fetch current hierarchy config (document override OR org default)
 */
router.get('/documents/:docId/hierarchy', requireAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { supabaseService } = req;

    // Fetch document with hierarchy_override
    const { data: document, error: docError } = await supabaseService
      .from('documents')
      .select('id, title, organization_id, hierarchy_override')
      .eq('id', docId)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Check if document has custom hierarchy
    if (document.hierarchy_override) {
      return res.json({
        success: true,
        hierarchy: document.hierarchy_override,
        source: 'document',
        documentId: document.id,
        documentTitle: document.title
      });
    }

    // Otherwise fetch organization default
    const { data: org, error: orgError } = await supabaseService
      .from('organizations')
      .select('id, name, hierarchy_config')
      .eq('id', document.organization_id)
      .single();

    if (orgError || !org) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    res.json({
      success: true,
      hierarchy: org.hierarchy_config || {},
      source: 'organization',
      documentId: document.id,
      documentTitle: document.title,
      organizationId: org.id,
      organizationName: org.name
    });
  } catch (error) {
    console.error('Fetch hierarchy config error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /admin/documents/:docId/hierarchy
 * Update per-document hierarchy configuration
 */
router.put('/documents/:docId/hierarchy', requireAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { hierarchy } = req.body;
    const { supabaseService } = req;

    // Validate hierarchy structure
    if (!hierarchy || !hierarchy.levels || !Array.isArray(hierarchy.levels)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hierarchy structure. Expected { levels: [...], maxDepth: 10 }'
      });
    }

    // Validate 10 levels
    if (hierarchy.levels.length !== 10) {
      return res.status(400).json({
        success: false,
        error: `Hierarchy must have exactly 10 levels (received ${hierarchy.levels.length})`
      });
    }

    // Validate depths 0-9
    const depths = hierarchy.levels.map(level => level.depth);
    const expectedDepths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const hasValidDepths = expectedDepths.every(d => depths.includes(d));

    if (!hasValidDepths) {
      return res.status(400).json({
        success: false,
        error: 'Hierarchy levels must have depths 0-9'
      });
    }

    // Validate required fields for each level
    for (const level of hierarchy.levels) {
      if (!level.name || !level.numbering || level.depth === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Each level must have name, numbering, and depth'
        });
      }

      const validNumbering = ['roman', 'numeric', 'alpha', 'alphaLower'];
      if (!validNumbering.includes(level.numbering)) {
        return res.status(400).json({
          success: false,
          error: `Invalid numbering type "${level.numbering}". Must be: ${validNumbering.join(', ')}`
        });
      }
    }

    // Update document hierarchy_override
    const { data: document, error: updateError } = await supabaseService
      .from('documents')
      .update({
        hierarchy_override: hierarchy,
        updated_at: new Date().toISOString()
      })
      .eq('id', docId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating hierarchy:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update document hierarchy'
      });
    }

    res.json({
      success: true,
      message: 'Document hierarchy configuration updated',
      document: {
        id: document.id,
        title: document.title,
        hierarchy_override: document.hierarchy_override
      }
    });
  } catch (error) {
    console.error('Update hierarchy config error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /admin/documents/:docId/hierarchy
 * Reset to organization default
 */
router.delete('/documents/:docId/hierarchy', requireAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { supabaseService } = req;

    // Set hierarchy_override to NULL
    const { data: document, error: updateError } = await supabaseService
      .from('documents')
      .update({
        hierarchy_override: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', docId)
      .select('id, title, organization_id')
      .single();

    if (updateError) {
      console.error('Error resetting hierarchy:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to reset hierarchy'
      });
    }

    // Fetch org default for confirmation
    const { data: org } = await supabaseService
      .from('organizations')
      .select('name, hierarchy_config')
      .eq('id', document.organization_id)
      .single();

    res.json({
      success: true,
      message: `Document hierarchy reset to organization default`,
      document: {
        id: document.id,
        title: document.title
      },
      organizationName: org?.name,
      usingDefault: true
    });
  } catch (error) {
    console.error('Reset hierarchy error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/documents/:docId/hierarchy-editor
 * Render hierarchy editor page for a document
 */
router.get('/documents/:docId/hierarchy-editor', requireAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { supabaseService } = req;

    // Fetch document details
    const { data: document, error: docError } = await supabaseService
      .from('documents')
      .select('id, title, organization_id, hierarchy_override')
      .eq('id', docId)
      .single();

    if (docError || !document) {
      return res.status(404).render('error', {
        title: 'Document Not Found',
        message: 'The requested document could not be found',
        error: { status: 404 }
      });
    }

    // Verify user has access to this organization
    if (!req.isGlobalAdmin) {
      const { data: userOrg } = await supabaseService
        .from('user_organizations')
        .select('role')
        .eq('user_id', req.session.userId)
        .eq('organization_id', document.organization_id)
        .single();

      if (!userOrg || !['admin', 'owner'].includes(userOrg.role)) {
        return res.status(403).render('error', {
          title: 'Access Denied',
          message: 'Admin access required to configure hierarchy',
          error: { status: 403 }
        });
      }
    }

    res.render('admin/document-hierarchy-editor', {
      title: 'Hierarchy Editor',
      document: document,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName,
        is_global_admin: req.isGlobalAdmin
      }
    });
  } catch (error) {
    console.error('Hierarchy editor page error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Error loading hierarchy editor',
      error: { status: 500 }
    });
  }
});

/**
 * GET /admin/hierarchy-templates
 * Get pre-built 10-level schema templates
 */
router.get('/hierarchy-templates', requireAdmin, async (req, res) => {
  try {
    // Load pre-built templates
    const templates = {
      'standard-bylaws': {
        id: 'standard-bylaws',
        name: 'Standard Bylaws',
        description: 'Traditional bylaws structure with Roman numerals for articles',
        levels: [
          { name: 'Article',      depth: 0, numbering: 'roman',     prefix: 'Article ' },
          { name: 'Section',      depth: 1, numbering: 'numeric',   prefix: 'Section ' },
          { name: 'Subsection',   depth: 2, numbering: 'numeric',   prefix: '' },
          { name: 'Paragraph',    depth: 3, numbering: 'alphaLower', prefix: '(' },
          { name: 'Subparagraph', depth: 4, numbering: 'numeric',   prefix: '' },
          { name: 'Clause',       depth: 5, numbering: 'alphaLower', prefix: '(' },
          { name: 'Subclause',    depth: 6, numbering: 'roman',     prefix: '' },
          { name: 'Item',         depth: 7, numbering: 'numeric',   prefix: '•' },
          { name: 'Subitem',      depth: 8, numbering: 'alpha',     prefix: '◦' },
          { name: 'Point',        depth: 9, numbering: 'numeric',   prefix: '-' }
        ],
        maxDepth: 10
      },
      'legal-document': {
        id: 'legal-document',
        name: 'Legal Document',
        description: 'Legal document structure with chapters and clauses',
        levels: [
          { name: 'Chapter',    depth: 0, numbering: 'roman',   prefix: 'Chapter ' },
          { name: 'Section',    depth: 1, numbering: 'numeric', prefix: 'Section ' },
          { name: 'Clause',     depth: 2, numbering: 'numeric', prefix: 'Clause ' },
          { name: 'Subclause',  depth: 3, numbering: 'numeric', prefix: '' },
          { name: 'Paragraph',  depth: 4, numbering: 'alphaLower', prefix: '(' },
          { name: 'Subparagraph', depth: 5, numbering: 'numeric', prefix: '' },
          { name: 'Item',       depth: 6, numbering: 'alphaLower', prefix: '(' },
          { name: 'Subitem',    depth: 7, numbering: 'roman',   prefix: '' },
          { name: 'Point',      depth: 8, numbering: 'numeric', prefix: '•' },
          { name: 'Subpoint',   depth: 9, numbering: 'alpha',   prefix: '◦' }
        ],
        maxDepth: 10
      },
      'policy-manual': {
        id: 'policy-manual',
        name: 'Policy Manual',
        description: 'Corporate policy structure',
        levels: [
          { name: 'Part',       depth: 0, numbering: 'roman',   prefix: 'Part ' },
          { name: 'Section',    depth: 1, numbering: 'numeric', prefix: 'Section ' },
          { name: 'Paragraph',  depth: 2, numbering: 'numeric', prefix: '' },
          { name: 'Subparagraph', depth: 3, numbering: 'alphaLower', prefix: '(' },
          { name: 'Item',       depth: 4, numbering: 'numeric', prefix: '' },
          { name: 'Subitem',    depth: 5, numbering: 'alphaLower', prefix: '(' },
          { name: 'Clause',     depth: 6, numbering: 'roman',   prefix: '' },
          { name: 'Subclause',  depth: 7, numbering: 'numeric', prefix: '•' },
          { name: 'Point',      depth: 8, numbering: 'alpha',   prefix: '◦' },
          { name: 'Detail',     depth: 9, numbering: 'numeric', prefix: '-' }
        ],
        maxDepth: 10
      },
      'technical-standard': {
        id: 'technical-standard',
        name: 'Technical Standard',
        description: 'Numeric hierarchy (1.1.1.1.1...)',
        levels: [
          { name: 'Level 1', depth: 0, numbering: 'numeric', prefix: '' },
          { name: 'Level 2', depth: 1, numbering: 'numeric', prefix: '' },
          { name: 'Level 3', depth: 2, numbering: 'numeric', prefix: '' },
          { name: 'Level 4', depth: 3, numbering: 'numeric', prefix: '' },
          { name: 'Level 5', depth: 4, numbering: 'numeric', prefix: '' },
          { name: 'Level 6', depth: 5, numbering: 'numeric', prefix: '' },
          { name: 'Level 7', depth: 6, numbering: 'numeric', prefix: '' },
          { name: 'Level 8', depth: 7, numbering: 'numeric', prefix: '' },
          { name: 'Level 9', depth: 8, numbering: 'numeric', prefix: '' },
          { name: 'Level 10', depth: 9, numbering: 'numeric', prefix: '' }
        ],
        maxDepth: 10
      }
    };

    res.json({
      success: true,
      templates: Object.values(templates)
    });
  } catch (error) {
    console.error('Fetch hierarchy templates error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// SECTION EDITING ROUTES (P6)
// Purpose: Manual section manipulation by admins
// Date: October 18, 2025
// =====================================================

const {
  validateSectionEditable,
  validateAdjacentSiblings,
  validateMoveParameters
} = require('../middleware/sectionValidation');

/**
 * GET /admin/documents/:docId/sections/tree
 * Get hierarchical section tree for editing
 */
router.get('/documents/:docId/sections/tree', requireAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { supabaseService } = req;

    // Fetch all sections for the document
    const { data: sections, error } = await supabaseService
      .from('document_sections')
      .select(`
        id,
        parent_section_id,
        ordinal,
        depth,
        section_number,
        section_title,
        section_type,
        is_locked,
        locked_at,
        locked_by,
        path_ids,
        path_ordinals,
        original_text,
        current_text,
        suggestions:suggestion_sections(count),
        workflow_states:section_workflow_states(
          status,
          workflow_stages(
            id,
            stage_name
          )
        )
      `)
      .eq('document_id', docId)
      .order('document_order', { ascending: true });

    if (error) {
      console.error('Fetch sections error:', error);
      throw error;
    }

    // Build tree structure
    const tree = buildSectionTree(sections);

    res.json({
      success: true,
      tree: tree,
      totalSections: sections.length
    });

  } catch (error) {
    console.error('Get section tree error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch section tree'
    });
  }
});

/**
 * PUT /admin/sections/:id/retitle
 * Change section title and/or number
 * SIMPLEST operation - just update fields
 */
router.put('/sections/:id/retitle', requireAdmin, validateSectionEditable, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { title, sectionNumber } = req.body;
    const { supabaseService } = req;

    // Validate at least one field provided
    if (!title && !sectionNumber) {
      return res.status(400).json({
        success: false,
        error: 'Either title or sectionNumber must be provided'
      });
    }

    // Build update object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) {
      updates.section_title = title;
    }

    if (sectionNumber !== undefined) {
      updates.section_number = sectionNumber;
    }

    // Update section
    const { data, error } = await supabaseService
      .from('document_sections')
      .update(updates)
      .eq('id', sectionId)
      .select()
      .single();

    if (error) {
      console.error('Retitle section error:', error);
      throw error;
    }

    res.json({
      success: true,
      section: data,
      message: 'Section updated successfully'
    });

  } catch (error) {
    console.error('Retitle section error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retitle section'
    });
  }
});

/**
 * DELETE /admin/sections/:id
 * Delete section (with optional cascade to children)
 * RESTRICTION: Admins (global_admin, org_admin) CANNOT delete sections
 */
router.delete('/sections/:id', requireAdmin, validateSectionEditable, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { cascade = 'false', suggestions = 'delete' } = req.query;
    const { supabaseService } = req;
    const section = req.section;

    // RESTRICTION: Prevent admins from deleting sections
    // Admins can only edit content (rename, move, etc.), not delete sections
    if (req.session.isGlobalAdmin || req.session.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Administrators cannot delete sections. Use editing tools to modify content.',
        code: 'ADMIN_DELETE_FORBIDDEN'
      });
    }

    const shouldCascade = cascade === 'true';
    const deletedIds = [];

    // 1. Get descendants if cascading
    let descendantIds = [];
    if (shouldCascade) {
      const { data: descendants, error: descError } = await supabaseService
        .rpc('get_descendants', { p_section_id: sectionId });

      if (descError) {
        console.error('Get descendants error:', descError);
        throw descError;
      }

      descendantIds = descendants?.map(d => d.id) || [];
    } else {
      // Check if section has children
      const { data: children, error: childError } = await supabaseService
        .from('document_sections')
        .select('id')
        .eq('parent_section_id', sectionId)
        .limit(1);

      if (childError) throw childError;

      if (children && children.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Section has children. Use cascade=true to delete all descendants, or move/delete children first.',
          code: 'HAS_CHILDREN'
        });
      }
    }

    // 2. Handle suggestions based on parameter
    const sectionsToClean = [sectionId, ...descendantIds];

    if (suggestions === 'delete') {
      // Delete all suggestions for these sections
      // First, get suggestion IDs linked to these sections
      const { data: sectionSuggestions, error: junctionError } = await supabaseService
        .from('suggestion_sections')
        .select('suggestion_id')
        .in('section_id', sectionsToClean);

      if (junctionError) {
        console.error('Error checking suggestion_sections:', junctionError);
        throw junctionError;
      }

      if (sectionSuggestions && sectionSuggestions.length > 0) {
        const suggestionIds = [...new Set(sectionSuggestions.map(ss => ss.suggestion_id))];

        // Delete the suggestions
        const { error: suggError } = await supabaseService
          .from('suggestions')
          .delete()
          .in('id', suggestionIds);

        if (suggError) {
          console.error('Delete suggestions error:', suggError);
          throw suggError;
        }
      }
    } else if (suggestions === 'orphan') {
      // Remove section associations (orphan suggestions)
      // Delete the junction table entries to orphan the suggestions
      const { error: orphanError } = await supabaseService
        .from('suggestion_sections')
        .delete()
        .in('section_id', sectionsToClean);

      if (orphanError) {
        console.error('Orphan suggestions error:', orphanError);
        throw orphanError;
      }
    }

    // 3. Delete sections (cascades to workflow states via ON DELETE CASCADE)
    const { error: deleteError } = await supabaseService
      .from('document_sections')
      .delete()
      .in('id', sectionsToClean);

    if (deleteError) {
      console.error('Delete sections error:', deleteError);
      throw deleteError;
    }

    deletedIds.push(...sectionsToClean);

    // 4. Shift sibling ordinals down to close gap
    const { data: shiftedCount, error: shiftError } = await supabaseService
      .rpc('decrement_sibling_ordinals', {
        p_parent_id: section.parent_section_id,
        p_start_ordinal: section.ordinal,
        p_decrement_by: 1
      });

    if (shiftError) {
      console.error('Shift ordinals error:', shiftError);
      // Not fatal - continue
    }

    res.json({
      success: true,
      deleted: {
        sections: deletedIds,
        count: deletedIds.length
      },
      siblingsUpdated: shiftedCount || 0,
      message: `Successfully deleted ${deletedIds.length} section(s)`
    });

  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete section'
    });
  }
});

/**
 * PUT /admin/sections/:id/move
 * Move section to different parent or reorder within siblings
 */
router.put('/sections/:id/move', requireAdmin, validateSectionEditable, validateMoveParameters, async (req, res) => {
  try {
    const { id: sectionId } = req.params;
    const { newParentId, newOrdinal } = req.body;
    const { supabaseService } = req;
    const section = req.section;

    // Determine what's changing
    const changingParent = newParentId !== undefined && newParentId !== section.parent_section_id;
    const changingOrdinal = newOrdinal !== undefined && newOrdinal !== section.ordinal;

    if (!changingParent && !changingOrdinal) {
      return res.status(400).json({
        success: false,
        error: 'No changes requested. Provide newParentId and/or newOrdinal.'
      });
    }

    // CASE 1: Moving to different parent
    if (changingParent) {
      const targetParentId = newParentId;
      const targetOrdinal = newOrdinal !== undefined ? newOrdinal : 0; // Default to start

      // 1. Get siblings count at target parent
      const { data: siblingsCount, error: countError } = await supabaseService
        .rpc('get_siblings_count', {
          p_parent_id: targetParentId,
          p_document_id: section.document_id
        });

      if (countError) throw countError;

      // 2. Validate target ordinal
      const maxOrdinal = siblingsCount || 0;
      const finalOrdinal = Math.min(targetOrdinal, maxOrdinal);

      // 3. Shift ordinals at target parent to make space
      const { error: shiftError1 } = await supabaseService
        .rpc('increment_sibling_ordinals', {
          p_parent_id: targetParentId,
          p_start_ordinal: finalOrdinal,
          p_increment_by: 1
        });

      if (shiftError1) throw shiftError1;

      // 4. Update section
      const { data: updatedSection, error: updateError } = await supabaseService
        .from('document_sections')
        .update({
          parent_section_id: targetParentId,
          ordinal: finalOrdinal,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 5. Close gap at old parent
      const { error: shiftError2 } = await supabaseService
        .rpc('decrement_sibling_ordinals', {
          p_parent_id: section.parent_section_id,
          p_start_ordinal: section.ordinal,
          p_decrement_by: 1
        });

      if (shiftError2) {
        console.error('Close gap error:', shiftError2);
        // Not fatal
      }

      return res.json({
        success: true,
        section: updatedSection,
        message: `Section moved to new parent`
      });
    }

    // CASE 2: Reordering within same parent
    if (changingOrdinal) {
      const oldOrdinal = section.ordinal;
      const targetOrdinal = newOrdinal;

      // Get siblings count
      const { data: siblingsCount, error: countError } = await supabaseService
        .rpc('get_siblings_count', {
          p_parent_id: section.parent_section_id,
          p_document_id: section.document_id
        });

      if (countError) throw countError;

      const maxOrdinal = (siblingsCount || 1) - 1; // 0-indexed
      const finalOrdinal = Math.max(0, Math.min(targetOrdinal, maxOrdinal));

      if (finalOrdinal === oldOrdinal) {
        return res.json({
          success: true,
          section: section,
          message: 'Section already at target position'
        });
      }

      // Moving up (lower ordinal) - make space by incrementing ordinals
      if (finalOrdinal < oldOrdinal) {
        // Use RPC function to shift sections UP by 1
        const { error } = await supabaseService.rpc(
          'increment_sibling_ordinals',
          {
            p_parent_id: section.parent_section_id,
            p_start_ordinal: finalOrdinal,
            p_increment_by: 1
          }
        );

        if (error) throw error;
      }
      // Moving down (higher ordinal) - close gap by decrementing ordinals
      else {
        // Use RPC function to shift sections DOWN by 1
        const { error } = await supabaseService.rpc(
          'decrement_sibling_ordinals',
          {
            p_parent_id: section.parent_section_id,
            p_start_ordinal: oldOrdinal,
            p_decrement_by: 1
          }
        );

        if (error) throw error;
      }

      // Update section to final ordinal
      const { data: updatedSection, error: updateError } = await supabaseService
        .from('document_sections')
        .update({
          ordinal: finalOrdinal,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.json({
        success: true,
        section: updatedSection,
        message: `Section reordered from position ${oldOrdinal} to ${finalOrdinal}`
      });
    }

  } catch (error) {
    console.error('Move section error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to move section'
    });
  }
});

/**
 * Helper function to build tree structure from flat list
 */
function buildSectionTree(sections) {
  const lookup = {};
  const tree = [];

  // First pass: create lookup and add children arrays
  sections.forEach(section => {
    lookup[section.id] = {
      ...section,
      children: [],
      suggestionCount: section.suggestions?.[0]?.count || 0,
      workflowStatus: section.workflow_states?.[0]?.status || null,
      workflowStage: section.workflow_states?.[0]?.workflow_stages?.stage_name || null
    };
    delete lookup[section.id].suggestions;
    delete lookup[section.id].workflow_states;
  });

  // Second pass: build tree
  sections.forEach(section => {
    const node = lookup[section.id];
    if (section.parent_section_id && lookup[section.parent_section_id]) {
      lookup[section.parent_section_id].children.push(node);
    } else {
      tree.push(node); // Root level section
    }
  });

  return tree;
}

// =============================================================================
// SPLIT SECTION
// =============================================================================
/**
 * POST /admin/sections/:id/split
 * Split a section into two sections at a specified position
 *
 * Request body:
 * {
 *   "splitPosition": 100,  // Character position to split at
 *   "newSectionTitle": "Part 2",
 *   "newSectionNumber": "3.2"
 * }
 */
router.post('/sections/:id/split',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    const { id: sectionId } = req.params;
    const { splitPosition, newSectionTitle, newSectionNumber } = req.body;
    const { supabaseService } = req;
    const section = req.section; // From validateSectionEditable

    try {
      // RESTRICTION: Check for active suggestions on this section
      // Cannot split section if it has suggestions (preserves suggestion integrity)
      // First, get suggestion IDs that are linked to this section via the junction table
      const { data: sectionSuggestions, error: junctionError } = await supabaseService
        .from('suggestion_sections')
        .select('suggestion_id')
        .eq('section_id', sectionId);

      if (junctionError) {
        console.error('Error checking suggestion_sections:', junctionError);
        throw junctionError;
      }

      let activeSuggestions = [];
      if (sectionSuggestions && sectionSuggestions.length > 0) {
        const suggestionIds = sectionSuggestions.map(ss => ss.suggestion_id);

        const { data: suggestions, error: suggError } = await supabaseService
          .from('suggestions')
          .select('id, author_name')
          .in('id', suggestionIds)
          .is('rejected_at', null) // Only active suggestions
          .limit(5);

        if (suggError) {
          console.error('Error checking suggestions:', suggError);
          throw suggError;
        }

        activeSuggestions = suggestions || [];
      }

      if (activeSuggestions && activeSuggestions.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Cannot split this section because it has ${activeSuggestions.length} active suggestion(s). Resolve suggestions first.`,
          code: 'HAS_ACTIVE_SUGGESTIONS',
          suggestionCount: activeSuggestions.length,
          suggestions: activeSuggestions.map(s => ({
            id: s.id,
            author: s.author_name
          }))
        });
      }

      // Validate split position
      const currentText = section.current_text || section.original_text || '';
      if (!splitPosition || splitPosition < 0 || splitPosition >= currentText.length) {
        return res.status(400).json({
          success: false,
          error: 'Invalid split position. Must be between 0 and text length.',
          textLength: currentText.length
        });
      }

      // Split the text
      const firstPart = currentText.substring(0, splitPosition).trim();
      const secondPart = currentText.substring(splitPosition).trim();

      if (!firstPart || !secondPart) {
        return res.status(400).json({
          success: false,
          error: 'Split position would create empty section. Choose a different position.'
        });
      }

      // Step 1: Make space for new section (increment siblings after current section)
      await supabaseService.rpc('increment_sibling_ordinals', {
        p_parent_id: section.parent_section_id || null,
        p_start_ordinal: section.ordinal + 1,
        p_increment_by: 1
      });

      // Step 2: Update original section with first part
      const { error: updateError } = await supabaseService
        .from('document_sections')
        .update({
          current_text: firstPart,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);

      if (updateError) throw updateError;

      // Step 3: Create new section with second part
      const newSection = {
        document_id: section.document_id,
        parent_section_id: section.parent_section_id,
        section_number: newSectionNumber || `${section.section_number}.2`,
        section_title: newSectionTitle || `${section.section_title} (Part 2)`,
        section_type: section.section_type,
        ordinal: section.ordinal + 1,
        depth: section.depth,
        original_text: secondPart,
        current_text: secondPart,
        is_locked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Calculate path_ids and path_ordinals
      if (section.parent_section_id) {
        newSection.path_ids = [...(section.path_ids || [])];
        newSection.path_ordinals = [...(section.path_ordinals || [])];
      } else {
        newSection.path_ids = [];
        newSection.path_ordinals = [];
      }

      const { data: createdSection, error: insertError } = await supabaseService
        .from('document_sections')
        .insert([newSection])
        .select()
        .single();

      if (insertError) throw insertError;

      res.json({
        success: true,
        message: 'Section split successfully',
        originalSection: {
          id: sectionId,
          text: firstPart
        },
        newSection: {
          id: createdSection.id,
          section_number: createdSection.section_number,
          section_title: createdSection.section_title,
          text: secondPart
        }
      });

    } catch (error) {
      console.error('Split section error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to split section'
      });
    }
  }
);

// =============================================================================
// JOIN SECTIONS
// =============================================================================
/**
 * POST /admin/sections/join
 * Join multiple adjacent sections into one
 *
 * Request body:
 * {
 *   "sectionIds": ["uuid1", "uuid2", "uuid3"],
 *   "separator": "\n\n",
 *   "targetSectionId": "uuid1"  // Which section to keep (first by default)
 * }
 */
router.post('/sections/join',
  requireAdmin,
  validateAdjacentSiblings,
  async (req, res) => {
    const { sectionIds, separator = '\n\n', targetSectionId } = req.body;
    const { supabaseService } = req;
    const sections = req.sections; // From validateAdjacentSiblings (ordered by ordinal)

    try {
      // RESTRICTION: Check for active suggestions on ANY of the sections to be joined
      // Cannot join sections if any have suggestions (preserves suggestion integrity)
      // First, get suggestion IDs that are linked to any of these sections
      const { data: sectionSuggestions, error: junctionError } = await supabaseService
        .from('suggestion_sections')
        .select('suggestion_id, section_id')
        .in('section_id', sectionIds);

      if (junctionError) {
        console.error('Error checking suggestion_sections:', junctionError);
        throw junctionError;
      }

      let activeSuggestions = [];
      if (sectionSuggestions && sectionSuggestions.length > 0) {
        const suggestionIds = [...new Set(sectionSuggestions.map(ss => ss.suggestion_id))];

        const { data: suggestions, error: suggError } = await supabaseService
          .from('suggestions')
          .select('id, author_name')
          .in('id', suggestionIds)
          .is('rejected_at', null) // Only active suggestions
          .limit(10);

        if (suggError) {
          console.error('Error checking suggestions:', suggError);
          throw suggError;
        }

        // Map suggestions back to their sections
        activeSuggestions = (suggestions || []).map(sugg => {
          const sectionLink = sectionSuggestions.find(ss => ss.suggestion_id === sugg.id);
          return {
            ...sugg,
            section_id: sectionLink?.section_id
          };
        });
      }

      if (activeSuggestions && activeSuggestions.length > 0) {
        // Group suggestions by section for better error message
        const sectionSuggestionMap = {};
        activeSuggestions.forEach(s => {
          if (!sectionSuggestionMap[s.section_id]) {
            sectionSuggestionMap[s.section_id] = [];
          }
          sectionSuggestionMap[s.section_id].push(s);
        });

        const affectedSections = Object.keys(sectionSuggestionMap).map(sectionId => {
          const section = sections.find(s => s.id === sectionId);
          const count = sectionSuggestionMap[sectionId].length;
          return {
            id: sectionId,
            number: section?.section_number,
            title: section?.section_title,
            suggestionCount: count
          };
        });

        return res.status(400).json({
          success: false,
          error: `Cannot join sections: ${activeSuggestions.length} active suggestion(s) exist across ${affectedSections.length} section(s). Resolve all suggestions before joining.`,
          code: 'HAS_ACTIVE_SUGGESTIONS',
          totalSuggestions: activeSuggestions.length,
          affectedSections: affectedSections
        });
      }

      // Determine target section (default to first)
      const targetId = targetSectionId || sections[0].id;
      const targetSection = sections.find(s => s.id === targetId);

      if (!targetSection) {
        return res.status(400).json({
          success: false,
          error: 'Target section not found in provided section IDs'
        });
      }

      // Concatenate text from all sections
      const combinedText = sections
        .map(s => s.current_text || s.original_text || '')
        .filter(text => text.trim())
        .join(separator);

      // Get all suggestions from sections being merged
      const sectionsToRemove = sections.filter(s => s.id !== targetId).map(s => s.id);

      // Step 1: Move suggestions to target section
      if (sectionsToRemove.length > 0) {
        for (const sectionId of sectionsToRemove) {
          await supabaseService.rpc('relocate_suggestions', {
            p_old_section_id: sectionId,
            p_new_section_id: targetId
          });
        }
      }

      // Step 2: Update target section with combined text
      const { error: updateError } = await supabaseService
        .from('document_sections')
        .update({
          current_text: combinedText,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId);

      if (updateError) throw updateError;

      // Step 3: Delete other sections
      if (sectionsToRemove.length > 0) {
        const { error: deleteError } = await supabaseService
          .from('document_sections')
          .delete()
          .in('id', sectionsToRemove);

        if (deleteError) throw deleteError;
      }

      // Step 4: Close gaps in ordinals
      await supabaseService.rpc('decrement_sibling_ordinals', {
        p_parent_id: targetSection.parent_section_id || null,
        p_start_ordinal: targetSection.ordinal,
        p_decrement_by: sectionsToRemove.length
      });

      res.json({
        success: true,
        message: `Successfully joined ${sections.length} sections`,
        joinedSection: {
          id: targetId,
          section_number: targetSection.section_number,
          section_title: targetSection.section_title,
          text: combinedText,
          merged_count: sections.length
        }
      });

    } catch (error) {
      console.error('Join sections error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to join sections'
      });
    }
  }
);

// =============================================================================
// INDENT/DEDENT SECTIONS (Issue #5)
// =============================================================================

/**
 * POST /admin/sections/:id/indent
 * Increase section depth by making it a child of its previous sibling
 *
 * BEHAVIOR:
 * - Section becomes child of its earlier sibling (same parent)
 * - Depth increases by 1
 * - Ordinals recalculate correctly
 *
 * RESTRICTIONS:
 * - Section must have an earlier sibling
 * - Cannot indent first sibling (no previous sibling)
 */
router.post('/sections/:id/indent',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const { supabaseService } = req;
      const section = req.section; // From validateSectionEditable middleware

      console.log(`[INDENT] User ${userId} indenting section ${id}`);

      // 1. Find previous sibling (will become new parent)
      const { data: previousSibling, error: siblingError } = await supabaseService
        .from('document_sections')
        .select('id, ordinal, depth, section_number, section_title')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .lt('ordinal', section.ordinal)
        .order('ordinal', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (siblingError) {
        console.error('[INDENT] Sibling query error:', siblingError);
        throw siblingError;
      }

      if (!previousSibling) {
        return res.status(400).json({
          success: false,
          error: 'Cannot indent: no earlier sibling to indent under',
          code: 'NO_SIBLING'
        });
      }

      console.log(`[INDENT] Previous sibling found: ${previousSibling.id} (ordinal ${previousSibling.ordinal})`);

      // 2. Get count of new parent's children
      const { count: childCount } = await supabaseService
        .from('document_sections')
        .select('id', { count: 'exact', head: true })
        .eq('parent_section_id', previousSibling.id);

      const newOrdinal = (childCount || 0) + 1;

      console.log(`[INDENT] New parent will have ${childCount} children, new ordinal: ${newOrdinal}`);

      // 3. Update section to be child of previous sibling
      const { error: updateError } = await supabaseService
        .from('document_sections')
        .update({
          parent_section_id: previousSibling.id,
          ordinal: newOrdinal,
          depth: section.depth + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error('[INDENT] Update error:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to indent section'
        });
      }

      // 4. Close gap at old parent by decrementing ordinals
      if (section.parent_section_id !== null) {
        const { error: shiftError } = await supabaseService.rpc(
          'decrement_sibling_ordinals',
          {
            p_parent_id: section.parent_section_id,
            p_start_ordinal: section.ordinal,
            p_decrement_by: 1
          }
        );

        if (shiftError) {
          console.error('[INDENT] Ordinal shift error:', shiftError);
          // Not fatal - section moved successfully
        }
      } else {
        // Root level sections - use RPC function to shift ordinals
        const { error: shiftError } = await supabaseService.rpc(
          'decrement_sibling_ordinals',
          {
            p_parent_id: section.parent_section_id, // Will be NULL for root level
            p_start_ordinal: section.ordinal,
            p_decrement_by: 1
          }
        );

        if (shiftError) {
          console.error('[INDENT] Root ordinal shift error:', shiftError);
        }
      }

      console.log(`[INDENT] ✅ Section ${id} indented successfully`);

      res.json({
        success: true,
        message: 'Section indented successfully',
        newDepth: section.depth + 1,
        newParentId: previousSibling.id,
        newParentTitle: previousSibling.section_title,
        newOrdinal: newOrdinal
      });

    } catch (error) {
      console.error('[INDENT] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to indent section'
      });
    }
});

/**
 * POST /admin/sections/:id/dedent
 * Decrease section depth by making it a sibling of its parent
 *
 * BEHAVIOR:
 * - Section becomes sibling of its current parent
 * - Depth decreases by 1
 * - Inserted right after its current parent
 * - Ordinals recalculate correctly
 *
 * RESTRICTIONS:
 * - Section must have a parent (cannot dedent root level)
 */
router.post('/sections/:id/dedent',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const { supabaseService } = req;
      const section = req.section; // From validateSectionEditable middleware

      console.log(`[DEDENT] User ${userId} dedenting section ${id}`);

      // 1. Check if section is already at root level
      if (!section.parent_section_id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot dedent: section is already at root level',
          code: 'ALREADY_ROOT'
        });
      }

      // 2. Get parent section
      const { data: parent, error: parentError } = await supabaseService
        .from('document_sections')
        .select('id, parent_section_id, ordinal, depth, section_number, section_title')
        .eq('id', section.parent_section_id)
        .single();

      if (parentError || !parent) {
        console.error('[DEDENT] Parent query error:', parentError);
        return res.status(404).json({
          success: false,
          error: 'Parent section not found'
        });
      }

      console.log(`[DEDENT] Current parent: ${parent.id} (${parent.section_title}), grandparent: ${parent.parent_section_id || 'ROOT'}`);

      // 3. Section will become sibling of its current parent
      // Insert it right after the parent
      const newOrdinal = parent.ordinal + 1;

      // 4. Shift ordinals of sections after parent to make space
      if (parent.parent_section_id !== null) {
        await supabaseService.rpc('increment_sibling_ordinals', {
          p_parent_id: parent.parent_section_id,
          p_start_ordinal: newOrdinal,
          p_increment_by: 1
        });
      } else {
        // Shifting root-level sections - use RPC function
        const { error: shiftError } = await supabaseService.rpc(
          'increment_sibling_ordinals',
          {
            p_parent_id: parent.parent_section_id, // Will be NULL for root level
            p_start_ordinal: newOrdinal,
            p_increment_by: 1
          }
        );

        if (shiftError) {
          console.error('[DEDENT] Root shift error:', shiftError);
          throw shiftError;
        }
      }

      // 5. Update section
      const { error: updateError } = await supabaseService
        .from('document_sections')
        .update({
          parent_section_id: parent.parent_section_id, // Grandparent (or null for root)
          ordinal: newOrdinal,
          depth: section.depth - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        console.error('[DEDENT] Update error:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to dedent section'
        });
      }

      // 6. Close gap at old parent
      const { error: shiftError } = await supabaseService.rpc(
        'decrement_sibling_ordinals',
        {
          p_parent_id: section.parent_section_id,
          p_start_ordinal: section.ordinal,
          p_decrement_by: 1
        }
      );

      if (shiftError) {
        console.error('[DEDENT] Ordinal shift error:', shiftError);
        // Not fatal
      }

      console.log(`[DEDENT] ✅ Section ${id} dedented successfully`);

      res.json({
        success: true,
        message: 'Section dedented successfully',
        newDepth: section.depth - 1,
        newParentId: parent.parent_section_id,
        newOrdinal: newOrdinal,
        formerParentTitle: parent.section_title
      });

    } catch (error) {
      console.error('[DEDENT] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to dedent section'
      });
    }
});

/**
 * POST /admin/sections/:id/move-up
 * Move a section up one position among its siblings
 */
router.post('/sections/:id/move-up',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const { id } = req.params;
      const section = req.section;
      const { supabaseService } = req;

      console.log(`[MOVE-UP] Moving section ${id} up (current ordinal: ${section.ordinal})`);

      // Check if already first
      if (section.ordinal <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move up: section is already first among siblings',
          code: 'ALREADY_FIRST'
        });
      }

      // Find previous sibling (ordinal - 1)
      const { data: prevSibling, error: prevError } = await supabaseService
        .from('document_sections')
        .select('id, section_number, section_title, ordinal')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .eq('ordinal', section.ordinal - 1)
        .maybeSingle();

      if (prevError) {
        throw prevError;
      }

      if (!prevSibling) {
        return res.status(400).json({
          success: false,
          error: 'No previous sibling found',
          code: 'NO_PREV_SIBLING'
        });
      }

      // Swap ordinals using RPC function
      const { error: swapError } = await supabaseService.rpc('swap_sibling_ordinals', {
        p_section_id_1: section.id,
        p_section_id_2: prevSibling.id
      });

      if (swapError) {
        throw swapError;
      }

      console.log(`[MOVE-UP] ✅ Section ${id} moved up successfully`);

      res.json({
        success: true,
        message: `Moved up (now before "${prevSibling.section_number || prevSibling.section_title}")`,
        newOrdinal: section.ordinal - 1
      });

    } catch (error) {
      console.error('[MOVE-UP] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to move section up'
      });
    }
});

/**
 * POST /admin/sections/:id/move-down
 * Move a section down one position among its siblings
 */
router.post('/sections/:id/move-down',
  requireAdmin,
  validateSectionEditable,
  async (req, res) => {
    try {
      const { id } = req.params;
      const section = req.section;
      const { supabaseService } = req;

      console.log(`[MOVE-DOWN] Moving section ${id} down (current ordinal: ${section.ordinal})`);

      // Find next sibling (ordinal + 1)
      const { data: nextSibling, error: nextError } = await supabaseService
        .from('document_sections')
        .select('id, section_number, section_title, ordinal')
        .eq('document_id', section.document_id)
        .eq('parent_section_id', section.parent_section_id)
        .eq('ordinal', section.ordinal + 1)
        .maybeSingle();

      if (nextError) {
        throw nextError;
      }

      if (!nextSibling) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move down: section is already last among siblings',
          code: 'ALREADY_LAST'
        });
      }

      // Swap ordinals using RPC function
      const { error: swapError } = await supabaseService.rpc('swap_sibling_ordinals', {
        p_section_id_1: section.id,
        p_section_id_2: nextSibling.id
      });

      if (swapError) {
        throw swapError;
      }

      console.log(`[MOVE-DOWN] ✅ Section ${id} moved down successfully`);

      res.json({
        success: true,
        message: `Moved down (now after "${nextSibling.section_number || nextSibling.section_title}")`,
        newOrdinal: section.ordinal + 1
      });

    } catch (error) {
      console.error('[MOVE-DOWN] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to move section down'
      });
    }
});

module.exports = router;
