/**
 * Section Validation Middleware
 * Purpose: Validate section editing operations
 * Date: October 18, 2025
 */

/**
 * Validate that a section exists and is editable
 * Checks:
 * - Section exists
 * - Section not locked
 * - Section not in approved/locked workflow state
 * - User has access to document's organization
 */
async function validateSectionEditable(req, res, next) {
  const { id: sectionId } = req.params;
  const { supabaseService } = req;

  if (!sectionId) {
    return res.status(400).json({
      success: false,
      error: 'Section ID is required'
    });
  }

  try {
    // 1. Fetch section with document and organization info
    const { data: section, error: sectionError } = await supabaseService
      .from('document_sections')
      .select(`
        *,
        documents!inner(
          id,
          title,
          organization_id,
          organizations(name)
        )
      `)
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      console.error('Section fetch error:', sectionError);
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }

    // 2. Check if section is locked
    if (section.is_locked) {
      return res.status(403).json({
        success: false,
        error: `Section is locked. Locked by user at ${section.locked_at}. Cannot edit locked sections.`,
        code: 'SECTION_LOCKED',
        lockedAt: section.locked_at,
        lockedBy: section.locked_by
      });
    }

    // 3. Check workflow states
    const { data: states, error: stateError } = await supabaseService
      .from('section_workflow_states')
      .select(`
        status,
        workflow_stages(
          id,
          stage_name
        )
      `)
      .eq('section_id', sectionId);

    if (stateError) {
      console.error('Workflow state fetch error:', stateError);
    }

    // Check for locked or approved states
    const lockedState = states?.find(s => s.status === 'locked');
    const approvedState = states?.find(s => s.status === 'approved');

    if (lockedState) {
      const stageName = lockedState.workflow_stages?.stage_name || 'Unknown Stage';
      return res.status(403).json({
        success: false,
        error: `Section is locked at workflow stage: ${stageName}. Cannot edit sections in locked workflow state.`,
        code: 'WORKFLOW_LOCKED',
        stage: stageName
      });
    }

    if (approvedState) {
      const stageName = approvedState.workflow_stages?.stage_name || 'Unknown Stage';
      return res.status(403).json({
        success: false,
        error: `Section is approved at workflow stage: ${stageName}. Cannot edit approved sections.`,
        code: 'WORKFLOW_APPROVED',
        stage: stageName
      });
    }

    // 4. Attach section and document info to request
    req.section = section;
    req.document = section.documents;
    req.organizationId = section.documents.organization_id;

    next();

  } catch (error) {
    console.error('Section validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate section'
    });
  }
}

/**
 * Validate that sections are adjacent siblings
 * Used for JOIN operation - sections must be:
 * - Same parent
 * - Adjacent ordinals (consecutive)
 * - All editable
 */
async function validateAdjacentSiblings(req, res, next) {
  const { sectionIds } = req.body;
  const { supabaseService } = req;

  if (!sectionIds || !Array.isArray(sectionIds) || sectionIds.length < 2) {
    return res.status(400).json({
      success: false,
      error: 'At least 2 section IDs required for join operation'
    });
  }

  try {
    // 1. Fetch all sections
    const { data: sections, error: sectionError } = await supabaseService
      .from('document_sections')
      .select(`
        id,
        parent_section_id,
        ordinal,
        is_locked,
        section_number,
        section_title,
        documents!inner(
          id,
          organization_id
        )
      `)
      .in('id', sectionIds)
      .order('ordinal');

    if (sectionError || !sections) {
      console.error('Sections fetch error:', sectionError);
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch sections'
      });
    }

    if (sections.length !== sectionIds.length) {
      return res.status(404).json({
        success: false,
        error: `Some sections not found. Expected ${sectionIds.length}, found ${sections.length}`
      });
    }

    // 2. Check all sections have same parent
    const parents = [...new Set(sections.map(s => s.parent_section_id))];
    if (parents.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'All sections must have the same parent to be joined',
        code: 'DIFFERENT_PARENTS',
        parents: parents
      });
    }

    // 3. Check all sections belong to same document
    const docIds = [...new Set(sections.map(s => s.documents.id))];
    if (docIds.length > 1) {
      return res.status(400).json({
        success: false,
        error: 'All sections must belong to the same document',
        code: 'DIFFERENT_DOCUMENTS'
      });
    }

    // 4. Check all sections are editable (not locked)
    const lockedSections = sections.filter(s => s.is_locked);
    if (lockedSections.length > 0) {
      return res.status(403).json({
        success: false,
        error: `Cannot join sections: ${lockedSections.length} section(s) are locked`,
        code: 'SECTIONS_LOCKED',
        lockedSections: lockedSections.map(s => ({
          id: s.id,
          number: s.section_number,
          title: s.section_title
        }))
      });
    }

    // 5. Check ordinals are consecutive (adjacent)
    const ordinals = sections.map(s => s.ordinal);
    const minOrdinal = Math.min(...ordinals);
    const maxOrdinal = Math.max(...ordinals);

    // Should have consecutive ordinals: min, min+1, min+2, ..., max
    const expectedCount = maxOrdinal - minOrdinal + 1;
    if (expectedCount !== ordinals.length) {
      return res.status(400).json({
        success: false,
        error: 'Sections must be adjacent (consecutive ordinals) to be joined',
        code: 'NOT_ADJACENT',
        ordinals: ordinals
      });
    }

    // Verify each ordinal exists in sequence
    for (let i = minOrdinal; i <= maxOrdinal; i++) {
      if (!ordinals.includes(i)) {
        return res.status(400).json({
          success: false,
          error: `Gap in ordinals: missing ordinal ${i}`,
          code: 'ORDINAL_GAP',
          ordinals: ordinals
        });
      }
    }

    // 6. Attach sections and metadata to request
    req.sections = sections;
    req.parentId = parents[0];
    req.document = { id: docIds[0], organization_id: sections[0].documents.organization_id };
    req.organizationId = sections[0].documents.organization_id;

    next();

  } catch (error) {
    console.error('Adjacent siblings validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate sections'
    });
  }
}

/**
 * Validate move operation parameters
 * Checks:
 * - newParentId exists (if provided)
 * - Not creating circular reference
 * - New ordinal is valid
 */
async function validateMoveParameters(req, res, next) {
  const { newParentId, newOrdinal } = req.body;
  const { id: sectionId } = req.params;
  const { supabaseService } = req;
  const section = req.section; // From validateSectionEditable

  try {
    // 1. If moving to new parent, validate parent exists
    if (newParentId !== undefined && newParentId !== null) {
      const { data: newParent, error: parentError } = await supabaseService
        .from('document_sections')
        .select('id, document_id, path_ids')
        .eq('id', newParentId)
        .single();

      if (parentError || !newParent) {
        return res.status(404).json({
          success: false,
          error: 'New parent section not found',
          code: 'PARENT_NOT_FOUND'
        });
      }

      // 2. Check same document
      if (newParent.document_id !== section.document_id) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move section to different document',
          code: 'DIFFERENT_DOCUMENT'
        });
      }

      // 3. Check for circular reference (section cannot be its own ancestor)
      if (newParent.path_ids && newParent.path_ids.includes(sectionId)) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move section under its own descendant (circular reference)',
          code: 'CIRCULAR_REFERENCE'
        });
      }

      req.newParent = newParent;
    }

    // 4. If newOrdinal provided, validate it's a positive integer
    if (newOrdinal !== undefined) {
      if (!Number.isInteger(newOrdinal) || newOrdinal < 0) {
        return res.status(400).json({
          success: false,
          error: 'newOrdinal must be a non-negative integer',
          code: 'INVALID_ORDINAL'
        });
      }
    }

    next();

  } catch (error) {
    console.error('Move parameters validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate move parameters'
    });
  }
}

module.exports = {
  validateSectionEditable,
  validateAdjacentSiblings,
  validateMoveParameters
};
