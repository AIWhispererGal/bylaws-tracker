require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Load from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// CORS for Google Apps Script
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make supabase available to all routes
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// ===========================================
// HELPER FUNCTIONS FOR MULTI-SECTION SUPPORT
// ===========================================

/**
 * Validates multi-section request
 * @param {Array<string>} sectionIds - Array of section UUIDs
 * @param {Object} supabase - Supabase client instance
 * @returns {Object} Validation result with article and range description
 */
async function validateMultiSectionRequest(sectionIds, supabase) {
  try {
    // Check max sections limit
    if (sectionIds.length > 10) {
      return {
        valid: false,
        error: 'Maximum of 10 sections can be selected at once'
      };
    }

    // Fetch all sections to validate
    const { data: sections, error } = await supabase
      .from('bylaw_sections')
      .select('id, section_citation, article_number, section_number')
      .in('id', sectionIds);

    if (error) {
      return {
        valid: false,
        error: 'Failed to fetch sections for validation'
      };
    }

    // Check all sections exist
    if (sections.length !== sectionIds.length) {
      return {
        valid: false,
        error: 'One or more section IDs are invalid'
      };
    }

    // Check all sections are in the same article
    const articleNumbers = [...new Set(sections.map(s => s.article_number))];
    if (articleNumbers.length > 1) {
      return {
        valid: false,
        error: `Sections must be from the same article. Found articles: ${articleNumbers.join(', ')}`
      };
    }

    // Sort sections by section_number
    const sortedSections = sections.sort((a, b) => a.section_number - b.section_number);

    // Check if sections are contiguous (optional warning)
    let warnings = [];
    if (sortedSections.length > 1) {
      for (let i = 1; i < sortedSections.length; i++) {
        if (sortedSections[i].section_number !== sortedSections[i-1].section_number + 1) {
          warnings.push(`Non-contiguous sections detected: Section ${sortedSections[i-1].section_number} to Section ${sortedSections[i].section_number}`);
        }
      }
    }

    // Generate article scope and section range descriptions
    const articleScope = articleNumbers[0] ? `Article ${articleNumbers[0]}` : 'Unknown Article';
    const sectionRange = sortedSections.length === 1
      ? `Section ${sortedSections[0].section_number}`
      : `Sections ${sortedSections[0].section_number}-${sortedSections[sortedSections.length-1].section_number}`;

    return {
      valid: true,
      articleScope,
      sectionRange,
      sections: sortedSections,
      warnings
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

// Routes
app.get('/', (req, res) => {
  res.redirect('/bylaws');
});

// Config endpoint for Google Apps Script
app.get('/api/config', (req, res) => {
  res.json({
    APP_URL: APP_URL,
    status: 'connected'
  });
});

// Bylaws routes
app.get('/bylaws', async (req, res) => {
  try {
    res.render('bylaws-improved', {
      title: 'Bylaws Amendment Tracker',
      user: null // No authentication for now
    });
  } catch (error) {
    console.error('Error loading bylaws page:', error);
    res.status(500).send('Error loading bylaws page');
  }
});

// API Routes

// Get all sections for a document (UPDATED to include article/section numbers and suggestion counts)
app.get('/bylaws/api/sections/:docId', async (req, res) => {
  try {
    const { docId } = req.params;

    // Fetch sections with their direct suggestions
    const { data: sections, error } = await supabase
      .from('bylaw_sections')
      .select(`
        *,
        bylaw_suggestions!section_id (
          id,
          suggested_text,
          author_name,
          status,
          support_count
        )
      `)
      .eq('doc_id', docId)
      .order('section_citation', { ascending: true });

    if (error) throw error;

    // For each section, also count multi-section suggestions that include it
    for (const section of sections) {
      // Count suggestions through junction table
      const { count: multiSectionCount, error: countError } = await supabase
        .from('suggestion_sections')
        .select('*', { count: 'exact', head: true })
        .eq('section_id', section.id);

      // Add counts to section
      section.total_suggestion_count = (section.bylaw_suggestions?.length || 0) + (multiSectionCount || 0);
      section.article_number = section.article_number;
      section.section_number = section.section_number;
    }

    res.json({ success: true, sections });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize document (parse sections)
app.post('/bylaws/api/initialize', async (req, res) => {
  try {
    const { docId, sections } = req.body;

    // Insert each section
    for (const section of sections) {
      const { error } = await supabase
        .from('bylaw_sections')
        .upsert({
          doc_id: docId,
          section_citation: section.citation,
          section_title: section.title,
          original_text: section.text
        }, {
          onConflict: 'doc_id,section_citation'
        });

      if (error) console.error('Error inserting section:', error);
    }

    res.json({ success: true, message: `Initialized ${sections.length} sections` });
  } catch (error) {
    console.error('Error initializing document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Lock section(s) with selected suggestion (UPDATED to support multi-section locking)
app.post('/bylaws/api/sections/:sectionId/lock', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { suggestionId, notes, lockedBy, sectionIds } = req.body;

    // Determine which sections to lock
    const sectionsToLock = sectionIds && sectionIds.length > 0 ? sectionIds : [sectionId];

    // Validate multi-section request if applicable
    if (sectionsToLock.length > 1) {
      const validation = await validateMultiSectionRequest(sectionsToLock, supabase);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }
    }

    // Check if any sections are already locked (atomic check)
    const { data: existingLocks, error: checkError } = await supabase
      .from('bylaw_sections')
      .select('id, section_citation, locked_by_committee')
      .in('id', sectionsToLock)
      .eq('locked_by_committee', true);

    if (checkError) throw checkError;

    if (existingLocks && existingLocks.length > 0) {
      const lockedCitations = existingLocks.map(s => s.section_citation).join(', ');
      return res.status(400).json({
        success: false,
        error: `Cannot lock: The following sections are already locked: ${lockedCitations}`
      });
    }

    // Get suggestion text if one is selected
    let newText = null;
    if (suggestionId && suggestionId !== 'original') {
      const { data: suggestion } = await supabase
        .from('bylaw_suggestions')
        .select('suggested_text')
        .eq('id', suggestionId)
        .single();

      newText = suggestion?.suggested_text;
    }

    // Lock all sections atomically using a transaction-like approach
    const lockedSectionIds = [];
    const lockTimestamp = new Date().toISOString();

    for (const sectionIdToLock of sectionsToLock) {
      const { data, error } = await supabase
        .from('bylaw_sections')
        .update({
          locked_by_committee: true,
          locked_at: lockTimestamp,
          locked_by: lockedBy || 'Committee',
          selected_suggestion_id: suggestionId === 'original' ? null : suggestionId,
          committee_notes: notes,
          new_text: newText,
          updated_at: lockTimestamp
        })
        .eq('id', sectionIdToLock)
        .select('id')
        .single();

      if (error) {
        // If any lock fails, attempt to rollback previous locks
        if (lockedSectionIds.length > 0) {
          await supabase
            .from('bylaw_sections')
            .update({
              locked_by_committee: false,
              locked_at: null,
              locked_by: null,
              selected_suggestion_id: null,
              committee_notes: null,
              new_text: null
            })
            .in('id', lockedSectionIds);
        }
        throw error;
      }

      lockedSectionIds.push(data.id);
    }

    res.json({
      success: true,
      message: `Successfully locked ${lockedSectionIds.length} section(s)`,
      lockedSectionIds
    });
  } catch (error) {
    console.error('Error locking section(s):', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unlock a section
app.post('/bylaws/api/sections/:sectionId/unlock', async (req, res) => {
  try {
    const { sectionId } = req.params;

    const { error } = await supabase
      .from('bylaw_sections')
      .update({
        locked_by_committee: false,
        locked_at: null,
        locked_by: null,
        selected_suggestion_id: null,
        committee_notes: null,
        new_text: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId);

    if (error) throw error;

    res.json({ success: true, message: 'Section unlocked successfully' });
  } catch (error) {
    console.error('Error unlocking section:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export committee selections as JSON
app.get('/bylaws/api/export/committee', async (req, res) => {
  try {
    const { data: sections, error } = await supabase
      .from('bylaw_sections')
      .select('*')
      .eq('locked_by_committee', true)
      .order('section_citation');

    if (error) throw error;

    const exportData = sections.map(section => ({
      citation: section.section_citation,
      title: section.section_title,
      old_text: section.original_text,
      new_text: section.new_text || section.original_text,
      locked_date: section.locked_at,
      locked_by: section.locked_by,
      notes: section.committee_notes,
      status: 'committee_approved'
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bylaws-committee-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Error exporting committee data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new suggestion (UPDATED to support multi-section suggestions)
app.post('/bylaws/api/suggestions', async (req, res) => {
  try {
    const {
      sectionId,      // For backward compatibility (single section)
      sectionIds,     // New: array of section IDs for multi-section
      suggestedText,
      rationale,
      authorName,
      authorEmail
    } = req.body;

    // Determine sections to apply suggestion to
    const targetSectionIds = sectionIds && sectionIds.length > 0
      ? sectionIds
      : (sectionId ? [sectionId] : []);

    if (targetSectionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one section ID must be provided'
      });
    }

    // Validate multi-section request
    let articleScope = null;
    let sectionRange = null;
    let isMultiSection = targetSectionIds.length > 1;

    if (isMultiSection) {
      const validation = await validateMultiSectionRequest(targetSectionIds, supabase);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }
      articleScope = validation.articleScope;
      sectionRange = validation.sectionRange;
    }

    // Create the suggestion record
    const { data: suggestion, error: suggestionError } = await supabase
      .from('bylaw_suggestions')
      .insert({
        section_id: targetSectionIds[0], // Keep first section for backward compatibility
        suggested_text: suggestedText,
        rationale: rationale || '',
        author_name: authorName || 'Anonymous',
        author_email: authorEmail || 'anonymous@example.com',
        status: 'open',
        is_multi_section: isMultiSection,
        article_scope: articleScope,
        section_range: sectionRange
      })
      .select()
      .single();

    if (suggestionError) throw suggestionError;

    // Insert entries in junction table for all sections
    const junctionInserts = targetSectionIds.map((sectionId, index) => ({
      suggestion_id: suggestion.id,
      section_id: sectionId,
      ordinal: index + 1
    }));

    const { error: junctionError } = await supabase
      .from('suggestion_sections')
      .insert(junctionInserts);

    if (junctionError) {
      // Rollback: delete the suggestion if junction table insert fails
      await supabase
        .from('bylaw_suggestions')
        .delete()
        .eq('id', suggestion.id);

      throw junctionError;
    }

    // Return the created suggestion with section info
    suggestion.section_ids = targetSectionIds;
    suggestion.section_count = targetSectionIds.length;

    res.json({ success: true, suggestion });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get suggestions for multiple sections (NEW ENDPOINT)
app.get('/bylaws/api/sections/multiple/suggestions', async (req, res) => {
  try {
    const { sectionIds } = req.query;

    if (!sectionIds) {
      return res.status(400).json({
        success: false,
        error: 'sectionIds query parameter is required'
      });
    }

    // Parse section IDs from comma-separated string
    const sectionIdArray = sectionIds.split(',').map(id => id.trim());

    // Validate the section IDs
    const validation = await validateMultiSectionRequest(sectionIdArray, supabase);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Query using the view to find suggestions that cover these sections
    const { data: suggestions, error } = await supabase
      .from('v_suggestions_with_sections')
      .select('*');

    if (error) throw error;

    // Filter and categorize suggestions
    const categorizedSuggestions = {
      exact_match: [],     // Suggestions that exactly match all requested sections
      full_coverage: [],   // Suggestions that include all requested sections plus more
      partial_overlap: []  // Suggestions that include some but not all requested sections
    };

    for (const suggestion of suggestions) {
      // Parse section_ids from the view (it's an array in PostgreSQL)
      const suggestionSectionIds = suggestion.section_ids || [];

      // Check overlap with requested sections
      const overlappingSections = suggestionSectionIds.filter(id =>
        sectionIdArray.includes(id)
      );

      if (overlappingSections.length === 0) {
        continue; // No overlap, skip this suggestion
      }

      // Categorize based on overlap
      if (overlappingSections.length === sectionIdArray.length &&
          suggestionSectionIds.length === sectionIdArray.length) {
        // Exact match: suggestion covers exactly the requested sections
        categorizedSuggestions.exact_match.push({
          ...suggestion,
          overlap_type: 'exact',
          overlapping_sections: overlappingSections
        });
      } else if (overlappingSections.length === sectionIdArray.length) {
        // Full coverage: suggestion includes all requested sections (plus maybe more)
        categorizedSuggestions.full_coverage.push({
          ...suggestion,
          overlap_type: 'full_coverage',
          overlapping_sections: overlappingSections
        });
      } else {
        // Partial overlap: suggestion includes some but not all requested sections
        categorizedSuggestions.partial_overlap.push({
          ...suggestion,
          overlap_type: 'partial',
          overlapping_sections: overlappingSections,
          coverage_percentage: Math.round((overlappingSections.length / sectionIdArray.length) * 100)
        });
      }
    }

    res.json({
      success: true,
      requested_sections: sectionIdArray,
      article_scope: validation.articleScope,
      section_range: validation.sectionRange,
      suggestions: categorizedSuggestions,
      summary: {
        exact_matches: categorizedSuggestions.exact_match.length,
        full_coverage: categorizedSuggestions.full_coverage.length,
        partial_overlaps: categorizedSuggestions.partial_overlap.length
      }
    });
  } catch (error) {
    console.error('Error fetching multi-section suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a suggestion
app.put('/bylaws/api/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { suggestedText, rationale } = req.body;

    const { data, error } = await supabase
      .from('bylaw_suggestions')
      .update({
        suggested_text: suggestedText,
        rationale: rationale
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, suggestion: data });
  } catch (error) {
    console.error('Error updating suggestion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a suggestion
app.delete('/bylaws/api/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('bylaw_suggestions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Suggestion deleted' });
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get suggestions for a section
app.get('/bylaws/api/sections/:sectionId/suggestions', async (req, res) => {
  try {
    const { sectionId } = req.params;

    const { data: suggestions, error } = await supabase
      .from('bylaw_suggestions')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export board approvals as JSON
app.get('/bylaws/api/export/board', async (req, res) => {
  try {
    const { data: sections, error } = await supabase
      .from('bylaw_sections')
      .select('*')
      .eq('board_approved', true)
      .order('section_citation');

    if (error) throw error;

    const exportData = sections.map(section => ({
      citation: section.section_citation,
      title: section.section_title,
      old_text: section.original_text,
      new_text: section.new_text,
      final_text: section.final_text,
      committee_date: section.locked_at,
      board_date: section.board_approved_at,
      status: 'board_approved'
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bylaws-board-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Error exporting board data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Make APP_URL available to views
app.use((req, res, next) => {
  res.locals.APP_URL = APP_URL;
  res.locals.GOOGLE_DOC_ID = process.env.GOOGLE_DOC_ID;
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`Bylaws Amendment Tracker running on ${APP_URL}`);
  console.log('');
  console.log('Current Configuration:');
  console.log(`- App URL: ${APP_URL}`);
  console.log(`- Supabase: ${SUPABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`- Google Doc ID: ${process.env.GOOGLE_DOC_ID || 'Not configured'}`);
  console.log('');
  console.log('To use NGROK:');
  console.log('1. Run: ngrok http 3000');
  console.log('2. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
  console.log('3. Update APP_URL in .env file');
  console.log('4. Restart the server');
  console.log('');
});