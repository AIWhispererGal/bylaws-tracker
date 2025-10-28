/**
 * Section Storage Service
 * Handles storing parsed document sections to database with full hierarchy support
 */

class SectionStorage {
  /**
   * Store parsed sections in document_sections table
   * @param {string} organizationId - Organization UUID
   * @param {string} documentId - Document UUID
   * @param {Array} sections - Parsed sections from parser
   * @param {Object} supabase - Supabase client instance
   * @returns {Object} Result with success status
   */
  async storeSections(organizationId, documentId, sections, supabase) {
    try {
      console.log(`Starting section storage for document ${documentId}...`);
      console.log(`Total sections to store: ${sections.length}`);

      // Build hierarchy relationships
      const hierarchicalSections = await this.buildHierarchy(sections);

      console.log('Hierarchy built successfully');

      // Transform to database format
      const dbSections = hierarchicalSections.map((section, index) => {
        // Calculate path arrays will be handled by trigger
        return {
          document_id: documentId,
          parent_section_id: section.parent_id,
          ordinal: section.ordinal,  // Sibling position (by design)
          document_order: index + 1,  // Document-wide sequential order
          depth: section.depth,
          section_number: section.section_number,
          section_title: section.title,
          section_type: section.type,
          original_text: section.content || section.text || section.original_text,
          current_text: section.content || section.text || section.original_text,
          metadata: {
            citation: section.citation,
            level: section.level,
            article_number: section.article_number,
            parsed_number: section.number,
            prefix: section.prefix,
            ordinal_position: index + 1
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      console.log('Transformed sections to database format');

      // Insert sections in batches to avoid overwhelming the database
      const batchSize = 50;
      const insertedSections = [];

      for (let i = 0; i < dbSections.length; i += batchSize) {
        const batch = dbSections.slice(i, i + batchSize);
        console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} sections)...`);

        const { data, error } = await supabase
          .from('document_sections')
          .insert(batch)
          .select();

        if (error) {
          console.error('Error inserting section batch:', error);
          throw new Error(`Failed to insert sections: ${error.message}`);
        }

        insertedSections.push(...data);
      }

      console.log(`Successfully inserted ${insertedSections.length} sections`);

      // CRITICAL FIX: Now update parent_section_id relationships
      // This was missing! Parent relationships were never being set after insertion.
      console.log('Updating parent-child relationships with actual UUIDs...');
      const parentUpdateResult = await this.updateParentRelationships(documentId, supabase);

      if (!parentUpdateResult.success) {
        console.error('Error updating parent relationships:', parentUpdateResult.error);
        // Don't fail the whole operation, but warn
        console.warn('⚠️  Parent relationships could not be set. Hierarchy operations may not work correctly.');
      } else {
        console.log(`✓ Successfully updated ${parentUpdateResult.updatesApplied} parent relationships`);
      }

      // Verify inserted sections have proper paths
      const { data: verifyData, error: verifyError } = await supabase
        .from('document_sections')
        .select('id, section_number, depth, parent_section_id, path_ids, path_ordinals')
        .eq('document_id', documentId)
        .limit(5);

      if (verifyError) {
        console.warn('Could not verify paths, but sections were inserted:', verifyError);
      } else {
        console.log('Sample sections with paths and parents:', verifyData);
      }

      return {
        success: true,
        sectionsStored: insertedSections.length,
        sections: insertedSections,
        message: `Successfully stored ${insertedSections.length} sections with hierarchy`,
        parentRelationshipsUpdated: parentUpdateResult.updatesApplied || 0
      };

    } catch (error) {
      console.error('Error in storeSections:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Build parent-child hierarchy relationships from flat section list
   * @param {Array} sections - Flat list of parsed sections
   * @returns {Array} Sections with parent_temp_id and hierarchy metadata
   *
   * NOTE: parent_temp_id is a temporary reference. Actual parent_section_id UUIDs
   * will be resolved and set by updateParentRelationships() after insertion.
   */
  async buildHierarchy(sections) {
    const hierarchicalSections = [];
    const parentStack = []; // Stack to track current parent at each depth

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const depth = section.depth || 0;

      // Pop parents from stack until we find the right depth
      while (parentStack.length > depth) {
        parentStack.pop();
      }

      // Calculate ordinal among siblings at this depth
      let ordinal = 1;

      // Count siblings at same depth with same parent
      if (parentStack.length > 0) {
        const parentId = parentStack[parentStack.length - 1].tempId;
        const siblings = hierarchicalSections.filter(s =>
          s.parent_temp_id === parentId && s.depth === depth
        );
        ordinal = siblings.length + 1;
      } else {
        // Root level sections
        const rootSiblings = hierarchicalSections.filter(s =>
          s.depth === 0
        );
        ordinal = rootSiblings.length + 1;
      }

      // Build hierarchical section
      const hierarchicalSection = {
        ...section,
        tempId: i, // Temporary ID for building relationships (index in array)
        parent_temp_id: parentStack.length > 0 ? parentStack[parentStack.length - 1].tempId : null,
        ordinal: ordinal,
        depth: depth,
        section_number: this.formatSectionNumber(section),
        title: section.title || section.section_title || '(Untitled)',
        type: section.type || 'section',
        content: section.text || section.original_text || '',
        citation: section.citation || section.section_citation || `${section.prefix || ''}${section.number || ''}`
      };

      hierarchicalSections.push(hierarchicalSection);

      // Add to parent stack for potential children
      parentStack.push(hierarchicalSection);
    }

    console.log(`Built hierarchy for ${hierarchicalSections.length} sections`);
    console.log(`Root sections (depth 0): ${hierarchicalSections.filter(s => s.depth === 0).length}`);
    console.log(`Child sections (depth > 0): ${hierarchicalSections.filter(s => s.depth > 0).length}`);

    return hierarchicalSections;
  }

  /**
   * Format section number for display
   * @param {Object} section - Section object
   * @returns {string} Formatted section number
   */
  formatSectionNumber(section) {
    if (section.section_number) {
      return section.section_number;
    }

    if (section.citation) {
      return section.citation;
    }

    // Build from parts
    const prefix = section.prefix || '';
    const number = section.number || '';

    return `${prefix}${number}`.trim() || 'Unnumbered';
  }

  /**
   * Update parent relationships after initial insert
   * This is needed to link sections by actual UUIDs after database insertion
   * @param {string} documentId - Document UUID
   * @param {Object} supabase - Supabase client
   */
  async updateParentRelationships(documentId, supabase) {
    try {
      // CRITICAL: Fetch all sections ordered by document_order (sequential insertion order)
      // NOT by ordinal (which is sibling position only)
      const { data: sections, error } = await supabase
        .from('document_sections')
        .select('id, ordinal, depth, document_order, section_number')
        .eq('document_id', documentId)
        .order('document_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch sections: ${error.message}`);
      }

      if (!sections || sections.length === 0) {
        console.log('No sections found for parent relationship update');
        return { success: true, updatesApplied: 0 };
      }

      console.log(`Processing parent relationships for ${sections.length} sections...`);

      // Build parent map based on depth hierarchy
      const updates = [];
      const parentStack = [];

      for (const section of sections) {
        const depth = section.depth;

        // Pop parents from stack until we reach the correct parent depth level
        // Parent should be at depth = current_depth - 1
        while (parentStack.length > depth) {
          parentStack.pop();
        }

        // Update parent_section_id if we have a parent (depth > 0)
        if (depth > 0 && parentStack.length > 0) {
          const parent = parentStack[parentStack.length - 1];

          updates.push({
            id: section.id,
            parent_section_id: parent.id,
            section_number: section.section_number,
            parent_number: parent.section_number,
            depth: depth
          });
        } else if (depth === 0) {
          // Root level sections should have null parent
          // (Already null from insert, but document it for clarity)
        }

        // Add current section to parent stack for potential children
        parentStack.push(section);
      }

      // Apply updates in batch for efficiency
      if (updates.length > 0) {
        console.log(`Applying ${updates.length} parent relationship updates...`);

        // Log a sample of the relationships being set
        if (updates.length > 0) {
          const sample = updates.slice(0, 5);
          console.log('Sample parent relationships:');
          sample.forEach(u => {
            console.log(`  - ${u.section_number} (depth ${u.depth}) → parent: ${u.parent_number}`);
          });
        }

        // Batch update
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('document_sections')
            .update({ parent_section_id: update.parent_section_id })
            .eq('id', update.id);

          if (updateError) {
            console.warn(`Failed to update section ${update.section_number}:`, updateError);
          }
        }

        console.log('✓ Parent relationships updated successfully');
      } else {
        console.log('No parent relationships to update (all sections are root level)');
      }

      return { success: true, updatesApplied: updates.length };

    } catch (error) {
      console.error('Error updating parent relationships:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate stored sections
   * @param {string} documentId - Document UUID
   * @param {Object} supabase - Supabase client
   * @returns {Object} Validation result
   */
  async validateStoredSections(documentId, supabase) {
    try {
      const { data: sections, error } = await supabase
        .from('document_sections')
        .select('id, section_number, depth, path_ids, path_ordinals, parent_section_id')
        .eq('document_id', documentId)
        .order('ordinal', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch sections: ${error.message}`);
      }

      const issues = [];

      // Check each section
      for (const section of sections) {
        // Verify path_ids length matches depth + 1
        if (!section.path_ids || section.path_ids.length !== section.depth + 1) {
          issues.push({
            section_id: section.id,
            section_number: section.section_number,
            issue: `path_ids length ${section.path_ids?.length} != depth + 1 (${section.depth + 1})`
          });
        }

        // Verify path_ordinals length matches depth + 1
        if (!section.path_ordinals || section.path_ordinals.length !== section.depth + 1) {
          issues.push({
            section_id: section.id,
            section_number: section.section_number,
            issue: `path_ordinals length ${section.path_ordinals?.length} != depth + 1 (${section.depth + 1})`
          });
        }

        // Verify last element of path_ids is self
        if (section.path_ids && section.path_ids[section.path_ids.length - 1] !== section.id) {
          issues.push({
            section_id: section.id,
            section_number: section.section_number,
            issue: 'Last element of path_ids is not self'
          });
        }

        // Verify parent exists if depth > 0
        if (section.depth > 0 && !section.parent_section_id) {
          issues.push({
            section_id: section.id,
            section_number: section.section_number,
            issue: 'Missing parent_section_id for non-root section'
          });
        }
      }

      return {
        success: issues.length === 0,
        totalSections: sections.length,
        issues: issues,
        message: issues.length === 0
          ? 'All sections validated successfully'
          : `Found ${issues.length} validation issues`
      };

    } catch (error) {
      console.error('Error validating sections:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SectionStorage();
