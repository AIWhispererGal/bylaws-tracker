/**
 * Admin Dashboard Routes
 * View and manage all organizations from a central dashboard
 */

const express = require('express');
const router = express.Router();
const { requireGlobalAdmin } = require('../middleware/globalAdmin');

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
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    res.render('admin/user-management', {
      title: 'User Management',
      organizationId: req.session.organizationId,
      organizationName: req.session.organizationName,
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName
      }
    });
  } catch (error) {
    console.error('User management page error:', error);
    res.status(500).send('Error loading user management page');
  }
});

/**
 * GET /admin/dashboard - Admin overview of all organizations
 * Requires global admin access to view all organizations
 */
router.get('/dashboard', requireGlobalAdmin, async (req, res) => {
  try {
    const { supabaseService } = req;

    // Get all organizations with stats
    const { data: organizations, error: orgsError } = await supabaseService
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (orgsError) throw orgsError;

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
 * This route allows admins to configure global organization settings
 */
router.get('/organization', requireAdmin, async (req, res) => {
  try {
    const { supabaseService } = req;

    // Get all organizations for selection
    const { data: organizations, error } = await supabaseService
      .from('organizations')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    res.render('admin/organization-settings', {
      title: 'Organization Settings',
      organizations: organizations || [],
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
    const { data: users } = await supabaseService
      .from('user_organizations')
      .select(`
        *,
        users:user_id (
          email,
          full_name
        )
      `)
      .eq('organization_id', id);

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

module.exports = router;
