/**
 * Section Storage Service - UPDATED for document_order field
 *
 * CHANGES:
 * - Line 31: Added document_order: index + 1
 * - Line 44: Keep ordinal_position in metadata for backward compatibility
 * - All other code unchanged
 */

class SectionStorage {
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
          document_order: index + 1,  // ← NEW: Document-wide sequential order
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
            ordinal_position: index + 1  // ← Keep for backward compatibility
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

      // Verify inserted sections have proper paths AND document_order
      const { data: verifyData, error: verifyError } = await supabase
        .from('document_sections')
        .select('id, section_number, depth, path_ids, path_ordinals, document_order')
        .eq('document_id', documentId)
        .order('document_order', { ascending: true })  // ← Use new field for verification
        .limit(5);

      if (verifyError) {
        console.warn('Could not verify paths, but sections were inserted:', verifyError);
      } else {
        console.log('Sample sections with paths and order:', verifyData);
        console.log('Document order sequence:', verifyData.map(s => s.document_order));
      }

      return {
        success: true,
        sectionsStored: insertedSections.length,
        sections: insertedSections,
        message: `Successfully stored ${insertedSections.length} sections with hierarchy`
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
   * @returns {Array} Sections with parent_id and hierarchy metadata
   *
   * NOTE: This method calculates 'ordinal' as sibling position (by design).
   * The 'document_order' field preserves the original parse sequence.
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
      // NOTE: This creates duplicate ordinals across different parents (by design)
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
        tempId: i, // Temporary ID for building relationships
        parent_temp_id: parentStack.length > 0 ? parentStack[parentStack.length - 1].tempId : null,
        parent_id: null, // Will be set after insertion
        ordinal: ordinal,  // Sibling position (1st child, 2nd child, etc.)
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

    // Now map temp IDs to actual relationships
    // Since we insert in order, parent_id will remain null for first pass
    // The database trigger will handle path_ids and path_ordinals

    console.log(`Built hierarchy for ${hierarchicalSections.length} sections`);
    console.log(`Root sections (depth 0): ${hierarchicalSections.filter(s => s.depth === 0).length}`);
    console.log(`Child sections (depth > 0): ${hierarchicalSections.filter(s => s.depth > 0).length}`);

    return hierarchicalSections;
  }

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

  async updateParentRelationships(documentId, supabase) {
    try {
      // Fetch all sections ordered by document_order (not ordinal!)
      const { data: sections, error } = await supabase
        .from('document_sections')
        .select('id, ordinal, depth, path_ordinals, document_order')
        .eq('document_id', documentId)
        .order('document_order', { ascending: true });  // ← Use document_order

      if (error) {
        throw new Error(`Failed to fetch sections: ${error.message}`);
      }

      // Build parent map based on depth
      const updates = [];
      const parentStack = [];

      for (const section of sections) {
        const depth = section.depth;

        // Pop parents from stack until we reach parent level
        while (parentStack.length > depth) {
          parentStack.pop();
        }

        // Update parent_section_id if we have a parent
        if (depth > 0 && parentStack.length > 0) {
          const parentId = parentStack[parentStack.length - 1].id;

          updates.push({
            id: section.id,
            parent_section_id: parentId
          });
        }

        // Add to parent stack
        parentStack.push(section);
      }

      // Apply updates
      if (updates.length > 0) {
        console.log(`Updating ${updates.length} parent relationships...`);

        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('document_sections')
            .update({ parent_section_id: update.parent_section_id })
            .eq('id', update.id);

          if (updateError) {
            console.warn(`Failed to update section ${update.id}:`, updateError);
          }
        }

        console.log('Parent relationships updated successfully');
      }

      return { success: true, updatesApplied: updates.length };

    } catch (error) {
      console.error('Error updating parent relationships:', error);
      return { success: false, error: error.message };
    }
  }

  async validateStoredSections(documentId, supabase) {
    try {
      const { data: sections, error } = await supabase
        .from('document_sections')
        .select('id, section_number, depth, path_ids, path_ordinals, parent_section_id, document_order')
        .eq('document_id', documentId)
        .order('document_order', { ascending: true });  // ← Use document_order

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

        // NEW: Verify document_order exists
        if (!section.document_order || section.document_order < 1) {
          issues.push({
            section_id: section.id,
            section_number: section.section_number,
            issue: 'Invalid or missing document_order'
          });
        }
      }

      // NEW: Verify document_order is sequential
      const orders = sections.map(s => s.document_order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          issues.push({
            section_id: null,
            section_number: 'ALL',
            issue: `document_order gap detected: expected ${i + 1}, got ${orders[i]}`
          });
          break;
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
