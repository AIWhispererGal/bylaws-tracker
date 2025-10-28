/**
 * Dashboard Routes
 * Multi-tenant dashboard with RLS security
 *
 * UPDATED: Now uses new permissions architecture from migration 024
 */

const express = require('express');
const router = express.Router();
const tocService = require('../services/tocService');
const { attachPermissions } = require('../middleware/permissions');

/**
 * Middleware to check authentication and get organization_id from session
 * Validates both Express session AND Supabase JWT for RLS security
 */
async function requireAuth(req, res, next) {
  // Check if organization is selected in session
  if (!req.session?.organizationId) {
    // Redirect to organization selection instead of returning error
    return res.redirect('/auth/select');
  }

  // Set organization_id for RLS queries
  req.organizationId = req.session.organizationId;

  // Verify Supabase authentication context
  // The authenticatedSupabase middleware already handles JWT validation/refresh
  // Here we just verify that the client is properly authenticated
  try {
    // If we have a JWT in session, verify the Supabase client has proper auth context
    if (req.session.supabaseJWT) {
      // Test that RLS will work by checking if user context is set
      const { data: { user }, error } = await req.supabase.auth.getUser(req.session.supabaseJWT);

      if (error || !user) {
        // JWT is invalid but session exists - clear JWT and redirect
        console.warn('Invalid JWT in session, clearing auth tokens');
        delete req.session.supabaseJWT;
        delete req.session.supabaseRefreshToken;
        delete req.session.supabaseUser;

        // For now, continue with anon access (will be restricted by RLS)
        // In production, you might want to redirect to login
        console.warn('Continuing with anonymous access - RLS will enforce security');
      } else {
        // Store user info for views/logging
        req.user = user;
        req.session.supabaseUser = user; // Keep session in sync
      }
    } else {
      // No JWT - using anonymous access
      // RLS policies will restrict access appropriately
      console.log('No JWT in session - using anonymous access');
    }
  } catch (error) {
    console.error('Error validating authentication in requireAuth:', error);
    // Continue anyway - RLS will provide defense in depth
  }

  next();
}

/**
 * GET /dashboard - Main dashboard view
 * UPDATED: Attaches permissions for conditional rendering
 */
router.get('/', requireAuth, attachPermissions, async (req, res) => {
  try {
    const { supabase } = req;
    const orgId = req.organizationId;

    // Construct user object from session
    const user = req.session.userId ? {
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName || req.session.userEmail
    } : null;

    // Get recent suggestions for dashboard
    let recentSuggestions = [];

    try {
      // Get documents for this organization
      const { data: orgDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('organization_id', orgId);

      const docIds = orgDocs?.map(d => d.id) || [];

      if (docIds.length > 0) {
        // Get recent suggestions (last 10, open and rejected)
        const { data: suggestions } = await supabase
          .from('suggestions')
          .select(`
            id,
            suggested_text,
            suggested_content,
            status,
            created_at,
            author_name,
            author_email,
            document_id
          `)
          .in('document_id', docIds)
          .in('status', ['open', 'rejected'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (suggestions && suggestions.length > 0) {
          // For each suggestion, get section citation via junction table
          for (const suggestion of suggestions) {
            const { data: sectionLinks } = await supabase
              .from('suggestion_sections')
              .select(`
                section_id,
                document_sections:section_id (
                  section_number,
                  section_title
                )
              `)
              .eq('suggestion_id', suggestion.id)
              .order('ordinal', { ascending: true })
              .limit(1);

            if (sectionLinks && sectionLinks.length > 0 && sectionLinks[0].document_sections) {
              const section = sectionLinks[0].document_sections;
              suggestion.section_citation = section.section_title
                ? `${section.section_number} - ${section.section_title}`
                : section.section_number;
            } else {
              suggestion.section_citation = 'Unknown Section';
            }
          }

          recentSuggestions = suggestions;
        }
      }
    } catch (suggestionError) {
      console.error('Error loading suggestions:', suggestionError);
      // Continue rendering dashboard even if suggestions fail
    }

    res.render('dashboard/dashboard', {
      title: 'Dashboard',
      organizationId: req.organizationId,
      user: user,
      recentSuggestions: recentSuggestions,
      // NEW: Pass permissions to view
      permissions: req.permissions || {},
      userRole: req.userRole || null,
      userType: req.userType || null
    });
  } catch (error) {
    console.error('Dashboard render error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

/**
 * GET /overview - Organization statistics
 */
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const orgId = req.organizationId;

    // Validate organization ID exists
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID is required'
      });
    }

    // Get total documents
    const { count: docsCount, error: docsError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    if (docsError) throw docsError;

    // Get total sections (via documents first, then count sections)
    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', orgId);

    let totalSections = 0;
    if (docs && docs.length > 0) {
      const docIds = docs.map(d => d.id);
      const { count: sectionsCount } = await supabase
        .from('document_sections')
        .select('*', { count: 'exact', head: true })
        .in('document_id', docIds);

      totalSections = sectionsCount || 0;
    }

    // Get pending suggestions (reuse docs query)
    let totalSuggestions = 0;
    if (docs && docs.length > 0) {
      const docIds = docs.map(d => d.id);
      const { count: suggestionsCount } = await supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .in('document_id', docIds)
        .eq('status', 'open');

      totalSuggestions = suggestionsCount || 0;
    }

    // Get approval progress (sections with workflow states)
    let approvalProgress = 0;
    if (docs && docs.length > 0 && totalSections > 0) {
      const docIds = docs.map(d => d.id);

      // Get all section IDs
      const { data: sectionData } = await supabase
        .from('document_sections')
        .select('id')
        .in('document_id', docIds);

      if (sectionData && sectionData.length > 0) {
        const sectionIds = sectionData.map(s => s.id);

        // Count sections with approved/locked workflow states
        const { count: approvedCount } = await supabase
          .from('section_workflow_states')
          .select('*', { count: 'exact', head: true })
          .in('section_id', sectionIds)
          .in('status', ['approved', 'locked']);

        approvalProgress = Math.round(((approvedCount || 0) / totalSections) * 100);
      }
    }

    res.json({
      success: true,
      stats: {
        totalDocuments: docsCount || 0,
        activeSections: totalSections,
        pendingSuggestions: totalSuggestions,
        approvalProgress: approvalProgress
      }
    });
  } catch (error) {
    console.error('Overview fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /documents - List documents
 */
router.get('/documents', requireAuth, async (req, res) => {
  try {
    // If this is a browser request (not AJAX), redirect to main dashboard
    // IMPORTANT: If accessed via /api/dashboard/documents, always return JSON
    const isApiPath = req.originalUrl.includes('/api/');
    const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || req.query.ajax === 'true';

    if (!isApiPath && req.accepts('html') && !isAjax) {
      return res.redirect('/dashboard');
    }

    const { supabase } = req;
    const orgId = req.organizationId;

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Enrich with section counts
    for (const doc of documents) {
      const { count: sectionCount } = await supabase
        .from('document_sections')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc.id);

      doc.section_count = sectionCount || 0;

      const { count: suggestionCount } = await supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', doc.id)
        .eq('status', 'open');

      doc.pending_suggestions = suggestionCount || 0;
    }

    res.json({
      success: true,
      documents
    });
  } catch (error) {
    console.error('Documents fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /sections - List sections with status
 */
router.get('/sections', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const orgId = req.organizationId;
    const { documentId } = req.query;

    // Get documents for this organization
    let query = supabase
      .from('documents')
      .select('id')
      .eq('organization_id', orgId);

    if (documentId) {
      query = query.eq('id', documentId);
    }

    const { data: docs, error: docsError } = await query;
    if (docsError) throw docsError;

    if (!docs || docs.length === 0) {
      return res.json({ success: true, sections: [] });
    }

    const docIds = docs.map(d => d.id);

    // Get sections
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select(`
        *,
        documents:document_id (
          id,
          title,
          document_type
        )
      `)
      .in('document_id', docIds)
      .order('document_order', { ascending: true })
      .limit(100);

    if (sectionsError) throw sectionsError;

    // Get workflow states for these sections
    const sectionIds = sections.map(s => s.id);
    const { data: states } = await supabase
      .from('section_workflow_states')
      .select('section_id, status, workflow_stage_id, actioned_at')
      .in('section_id', sectionIds);

    // Attach workflow states to sections
    const statesMap = new Map();
    if (states) {
      states.forEach(state => {
        statesMap.set(state.section_id, state);
      });
    }

    sections.forEach(section => {
      const state = statesMap.get(section.id);
      section.workflow_status = state ? state.status : 'draft';
      section.last_action = state ? state.actioned_at : null;
    });

    res.json({
      success: true,
      sections
    });
  } catch (error) {
    console.error('Sections fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /suggestions/count - Get suggestion count for a section (LIGHTWEIGHT)
 * PERFORMANCE OPTIMIZATION: Returns only count, no data transfer
 */
router.get('/suggestions/count', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const { section_id } = req.query;

    if (!section_id) {
      return res.status(400).json({
        success: false,
        error: 'section_id is required'
      });
    }

    // Ultra-fast count query (no data payload)
    const { data: sectionLinks, error: linksError } = await supabase
      .from('suggestion_sections')
      .select('suggestion_id')
      .eq('section_id', section_id);

    if (linksError) throw linksError;

    if (!sectionLinks || sectionLinks.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    const suggestionIds = sectionLinks.map(link => link.suggestion_id);

    // Count only non-rejected suggestions
    const { count } = await supabase
      .from('suggestions')
      .select('*', { count: 'exact', head: true })
      .in('id', suggestionIds)
      .is('rejected_at', null);

    res.json({
      success: true,
      count: count || 0
    });

  } catch (error) {
    console.error('Suggestion count fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /suggestions - Get suggestions (filtered by section_id OR all pending for org)
 * If section_id provided: returns suggestions for that specific section
 * If no section_id: returns all pending suggestions for the organization
 */
router.get('/suggestions', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const orgId = req.organizationId;
    const { section_id, includeRejected, status } = req.query;

    // CASE 1: Get suggestions for a specific section
    if (section_id) {
      // Query via junction table to find suggestions for this section
      const { data: sectionLinks, error: linksError } = await supabase
        .from('suggestion_sections')
        .select('suggestion_id')
        .eq('section_id', section_id);

      if (linksError) throw linksError;

      if (!sectionLinks || sectionLinks.length === 0) {
        return res.json({
          success: true,
          suggestions: []
        });
      }

      // Get the actual suggestions with filtering
      const suggestionIds = sectionLinks.map(link => link.suggestion_id);

      let query = supabase
        .from('suggestions')
        .select('*')
        .in('id', suggestionIds);

      // Filter by status if provided
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Exclude rejected unless explicitly requested (Phase 2 feature)
      if (includeRejected !== 'true' && status !== 'rejected') {
        query = query.neq('status', 'rejected');
      }

      query = query.order('created_at', { ascending: false });

      const { data: suggestions, error: suggestionsError } = await query;

      if (suggestionsError) throw suggestionsError;

      return res.json({
        success: true,
        suggestions: suggestions || [],
        includesRejected: includeRejected === 'true'
      });
    }

    // CASE 2: Get all pending suggestions for the organization
    // Get documents for this organization
    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', orgId);

    if (!docs || docs.length === 0) {
      return res.json({ success: true, suggestions: [] });
    }

    const docIds = docs.map(d => d.id);

    // Get pending suggestions
    const { data: suggestions, error } = await supabase
      .from('suggestions')
      .select(`
        *,
        documents:document_id (
          id,
          title
        )
      `)
      .in('document_id', docIds)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Get section info for each suggestion
    for (const suggestion of suggestions) {
      const { data: sectionLinks } = await supabase
        .from('suggestion_sections')
        .select(`
          section_id,
          document_sections:section_id (
            section_number,
            section_title
          )
        `)
        .eq('suggestion_id', suggestion.id)
        .order('ordinal', { ascending: true });

      suggestion.sections = sectionLinks || [];
    }

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Suggestions fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /activity - Recent activity feed
 */
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const orgId = req.organizationId;
    const limit = parseInt(req.query.limit) || 20;

    // Get documents for this organization
    const { data: docs } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', orgId);

    if (!docs || docs.length === 0) {
      return res.json({ success: true, activity: [] });
    }

    const docIds = docs.map(d => d.id);

    // Combine recent activities from multiple sources
    const activities = [];

    // Recent suggestions
    const { data: recentSuggestions } = await supabase
      .from('suggestions')
      .select('id, author_name, author_email, created_at, document_id')
      .in('document_id', docIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (recentSuggestions) {
      recentSuggestions.forEach(s => {
        activities.push({
          type: 'suggestion_created',
          timestamp: s.created_at,
          description: `New suggestion by ${s.author_name || s.author_email}`,
          icon: 'lightbulb',
          color: 'info'
        });
      });
    }

    // Recent workflow actions
    const { data: recentActions } = await supabase
      .from('section_workflow_states')
      .select(`
        status,
        actioned_by_email,
        actioned_at,
        section_id,
        document_sections:section_id (
          section_number,
          document_id
        )
      `)
      .order('actioned_at', { ascending: false })
      .limit(limit);

    if (recentActions) {
      recentActions.forEach(action => {
        if (docIds.includes(action.document_sections?.document_id)) {
          const statusLabels = {
            'approved': 'approved',
            'locked': 'locked',
            'rejected': 'rejected',
            'in_progress': 'started review of'
          };

          activities.push({
            type: 'workflow_action',
            timestamp: action.actioned_at,
            description: `${action.actioned_by_email || 'Someone'} ${statusLabels[action.status] || action.status} Section ${action.document_sections?.section_number || 'Unknown'}`,
            icon: action.status === 'approved' ? 'check-circle' : 'activity',
            color: action.status === 'approved' ? 'success' : 'primary'
          });
        }
      });
    }

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      activity: activities.slice(0, limit)
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /suggestions - Create a new suggestion
 * Mounted at: /api/dashboard/suggestions
 * UPDATED: Uses new permission check (members and above can create suggestions)
 */
router.post('/suggestions', requireAuth, attachPermissions, async (req, res) => {
  try {
    const { supabase, supabaseService } = req;
    const {
      document_id,
      section_id,
      suggested_text,
      rationale,
      author_name,
      author_email,
      status
    } = req.body;

    // Validate required fields
    if (!document_id || !section_id || !suggested_text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: document_id, section_id, suggested_text'
      });
    }

    // NEW: Check if user has permission to create suggestions
    if (req.permissions && !req.permissions.can_create_suggestions) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create suggestions',
        code: 'PERMISSION_DENIED'
      });
    }

    // Step 1: Create suggestion with authenticated client (respects RLS)
    const { data: suggestion, error: suggestionError } = await supabase
      .from('suggestions')
      .insert({
        document_id,
        suggested_text,
        rationale: rationale || null,
        author_name: author_name || 'Anonymous',
        author_email: author_email || 'anonymous@example.com',
        status: status || 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (suggestionError) {
      console.error('[SUGGESTION CREATE] Error creating suggestion:', suggestionError);
      throw suggestionError;
    }

    console.log('[SUGGESTION CREATE] Suggestion created:', suggestion.id);

    // Step 2: Link suggestion to section via junction table
    // Use service client to bypass RLS on junction table
    // (Junction table RLS may be too restrictive for user inserts)
    const { error: linkError } = await supabaseService
      .from('suggestion_sections')
      .insert({
        suggestion_id: suggestion.id,
        section_id: section_id,
        ordinal: 1
      });

    if (linkError) {
      console.error('[SUGGESTION CREATE] Error linking to section:', linkError);
      // Rollback: delete the suggestion we just created
      await supabaseService
        .from('suggestions')
        .delete()
        .eq('id', suggestion.id);

      throw new Error('Failed to link suggestion to section: ' + linkError.message);
    }

    console.log('[SUGGESTION CREATE] Linked to section:', section_id);

    res.json({
      success: true,
      suggestion: {
        ...suggestion,
        section_id: section_id // Include for client convenience
      }
    });

  } catch (error) {
    console.error('[SUGGESTION CREATE] Fatal error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NOTE: Duplicate /suggestions route removed - consolidated into single route above at line 310

/**
 * GET /sections/:sectionId - Get section details
 * Used for diff comparison in suggestion view
 */
router.get('/sections/:sectionId', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const { sectionId } = req.params;
    const orgId = req.organizationId;

    // Get section with document info to verify organization access
    const { data: section, error: sectionError } = await supabase
      .from('document_sections')
      .select(`
        *,
        documents:document_id (
          id,
          title,
          organization_id
        )
      `)
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    // Verify organization access
    if (section.documents.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      section: {
        id: section.id,
        original_text: section.original_text || '',
        current_text: section.current_text || section.original_text || '',
        section_number: section.section_number,
        section_title: section.section_title
      }
    });

  } catch (error) {
    console.error('[SECTION GET] Error fetching section:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /documents/:documentId/toc - Get table of contents for document (API)
 * Returns hierarchical TOC structure for dynamic loading
 */
router.get('/documents/:documentId/toc', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const { documentId } = req.params;
    const orgId = req.organizationId;

    // Verify document access
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title')
      .eq('id', documentId)
      .eq('organization_id', orgId)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or access denied'
      });
    }

    // Fetch sections
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select('id, section_number, section_title, depth, parent_section_id, current_text, original_text, is_locked, path_ordinals')
      .eq('document_id', documentId)
      .order('document_order', { ascending: true });

    if (sectionsError) {
      throw sectionsError;
    }

    // Generate TOC
    const tocData = tocService.processSectionsForTOC(sections || []);

    res.json({
      success: true,
      document: {
        id: document.id,
        title: document.title
      },
      hierarchicalTOC: tocData.hierarchicalTOC,
      flatTOC: tocData.flatTOC,
      metadata: tocData.metadata,
      totalSections: tocData.sections.length
    });

  } catch (error) {
    console.error('[TOC API] Error generating TOC:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /sections/:sectionId/navigation - Get navigation info for section (API)
 * Returns previous, next, and parent section info for navigation
 */
router.get('/sections/:sectionId/navigation', requireAuth, async (req, res) => {
  try {
    const { supabase } = req;
    const { sectionId } = req.params;
    const orgId = req.organizationId;

    // Get section with document info
    const { data: section, error: sectionError } = await supabase
      .from('document_sections')
      .select(`
        id,
        section_number,
        parent_section_id,
        document_id,
        documents:document_id (
          organization_id
        )
      `)
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    // Verify organization access
    if (section.documents.organization_id !== orgId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get all sections for this document
    const { data: allSections } = await supabase
      .from('document_sections')
      .select('id, section_number, parent_section_id, path_ordinals')
      .eq('document_id', section.document_id)
      .order('document_order', { ascending: true });

    if (!allSections) {
      throw new Error('Failed to load document sections');
    }

    // Assign numbers
    const numberedSections = tocService.assignSectionNumbers(allSections);

    // Find current section number
    const currentSection = numberedSections.find(s => s.id === sectionId);
    if (!currentSection) {
      return res.status(404).json({
        success: false,
        error: 'Section not found in document'
      });
    }

    // Get navigation
    const navigation = tocService.getSectionNavigation(numberedSections, currentSection.number);

    res.json({
      success: true,
      currentSection: {
        number: currentSection.number,
        anchorId: currentSection.anchorId,
        citation: currentSection.section_number
      },
      navigation
    });

  } catch (error) {
    console.error('[NAVIGATION API] Error getting navigation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Document viewer handler function
 * Used by both /document/:documentId and /documents/:documentId routes
 */
async function handleDocumentView(req, res) {
  try {
    const { supabase } = req;
    const { documentId } = req.params;
    const orgId = req.organizationId;

    console.log('[DOCUMENT VIEWER] Loading document:', documentId);
    console.log('[DOCUMENT VIEWER] Organization:', orgId);

    // Fetch document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('organization_id', orgId)
      .single();

    if (docError || !document) {
      console.error('[DOCUMENT VIEWER] Document fetch error:', docError);
      return res.status(404).render('error', {
        title: 'Document Not Found',
        message: 'The requested document could not be found or you do not have permission to view it.',
        error: docError
      });
    }

    console.log('[DOCUMENT VIEWER] Document loaded:', document.title);

    // OPTIMIZED: Load ONLY sections (no suggestions, minimal workflow data)
    // This dramatically reduces initial page load time
    const { data: sections, error: sectionsError } = await supabase
      .from('document_sections')
      .select(`
        id,
        section_number,
        section_title,
        section_type,
        current_text,
        original_text,
        is_locked,
        locked_at,
        locked_by,
        locked_text,
        selected_suggestion_id,
        parent_section_id,
        ordinal,
        depth,
        path_ordinals
      `)
      .eq('document_id', documentId)
      .order('document_order', { ascending: true });

    if (sectionsError) {
      console.error('[DOCUMENT VIEWER] Error fetching sections:', sectionsError);
    } else {
      console.log('[DOCUMENT VIEWER] Sections loaded (FAST):', sections?.length || 0);
    }

    // REMOVED: No longer loading all suggestions upfront
    // Suggestions will be loaded via AJAX when sections are expanded

    // Get quick suggestion count for document summary
    const { count: suggestionCount } = await supabase
      .from('suggestions')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId)
      .eq('status', 'open');

    // Construct user object from session
    const user = req.session.userId ? {
      id: req.session.userId,
      email: req.session.userEmail,
      name: req.session.userName || req.session.userEmail
    } : null;

    // NEW: Use permissions from attachPermissions middleware
    // Falls back to role-based checks if new system unavailable
    const userPermissions = req.permissions ? {
      canView: true,
      canSuggest: req.permissions.can_create_suggestions || false,
      canApprove: req.userRole?.hierarchy_level >= 3 || false, // Admin or owner
      canLock: req.userRole?.hierarchy_level >= 3 || false,
      canReject: req.userRole?.hierarchy_level >= 3 || false,
      canEdit: req.permissions.can_edit_sections || false,
      canVote: req.permissions.can_vote || false
    } : {
      // FALLBACK: Legacy role-based permissions
      canView: true,
      canSuggest: ['member', 'admin', 'owner'].includes(req.session.userRole || 'viewer'),
      canApprove: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
      canLock: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
      canReject: ['admin', 'owner'].includes(req.session.userRole || 'viewer'),
      canEdit: ['member', 'admin', 'owner'].includes(req.session.userRole || 'viewer'),
      canVote: ['member', 'admin', 'owner'].includes(req.session.userRole || 'viewer')
    };

    // ============================================================
    // BUILD SECTION NUMBERS AND TABLE OF CONTENTS (using tocService)
    // ============================================================

    // Process sections through TOC service for efficient numbering and hierarchy
    const tocData = tocService.processSectionsForTOC(sections || []);

    console.log('[DOCUMENT VIEWER] TOC generated:', {
      totalSections: tocData.metadata.totalSections,
      rootSections: tocData.metadata.rootSections,
      maxDepth: tocData.metadata.maxDepth,
      sectionsWithContent: tocData.metadata.sectionsWithContent
    });

    res.render('dashboard/document-viewer', {
      title: document.title,
      document,
      sections: tocData.sections, // Sections with numbers and anchorIds
      tableOfContents: tocData.hierarchicalTOC, // Hierarchical TOC structure
      flatTOC: tocData.flatTOC, // Flat TOC for simple navigation
      tocMetadata: tocData.metadata, // TOC statistics
      suggestions: [], // Empty - loaded lazily
      suggestionCount: suggestionCount || 0, // Total count for summary
      organizationId: orgId,
      user: user,
      userRole: req.userRole || req.session.userRole || 'viewer', // NEW: From permissions middleware
      userPermissions: userPermissions,
      permissions: req.permissions || {}, // NEW: Pass full permissions object
      userType: req.userType || null, // NEW: global_admin or regular_user
      req: req
    });

  } catch (error) {
    console.error('[DOCUMENT VIEWER] Fatal error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'An error occurred while loading the document.',
      error
    });
  }
}

/**
 * GET /document/:documentId - Document viewer (singular)
 */
router.get('/document/:documentId', requireAuth, attachPermissions, handleDocumentView);

/**
 * GET /documents/:documentId - Document viewer (plural - alias)
 * Handles links from dashboard that use /dashboard/documents/:id
 */
router.get('/documents/:documentId', requireAuth, attachPermissions, handleDocumentView);

module.exports = router;
