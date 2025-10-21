/**
 * Table of Contents Service
 * Generates sequential section numbers and hierarchical TOC structures
 *
 * Performance targets:
 * - O(n) complexity for TOC generation
 * - < 50ms for 100 sections
 * - No deep cloning or unnecessary memory allocations
 */

/**
 * Assign sequential numbers to sections based on display order
 * Numbers are based on: depth → citation → id (deterministic ordering)
 *
 * @param {Array} sections - Array of section objects from database
 * @returns {Array} Sections with number and anchorId properties added
 */
function assignSectionNumbers(sections) {
  if (!sections || sections.length === 0) {
    return [];
  }

  // Sections should already be ordered by path_ordinals from database query
  // Just assign sequential numbers
  sections.forEach((section, index) => {
    section.number = index + 1;
    section.anchorId = `section-${index + 1}`;
  });

  return sections;
}

/**
 * Generate hierarchical table of contents structure
 * Includes section numbers, citations, depth, parent relationships, and subsection counts
 *
 * @param {Array} sections - Sections with numbers already assigned
 * @returns {Array} Hierarchical TOC structure
 */
function generateTableOfContents(sections) {
  if (!sections || sections.length === 0) {
    return [];
  }

  const toc = [];
  const sectionMap = new Map(); // For quick lookup and building hierarchy

  // First pass: Create map of all sections with their basic info
  sections.forEach(section => {
    const tocNode = {
      id: section.id,
      number: section.number,
      anchorId: section.anchorId,
      citation: section.section_number || section.section_title || `Section ${section.number}`,
      title: section.section_title || '',
      depth: section.depth || 0,
      parentId: section.parent_section_id || null,
      hasContent: !!(section.current_text || section.original_text),
      contentLength: (section.current_text || section.original_text || '').length,
      isLocked: section.is_locked || false,
      children: [],
      subsectionCount: 0
    };

    sectionMap.set(section.id, tocNode);
  });

  // Second pass: Build parent-child relationships
  sections.forEach(section => {
    const tocNode = sectionMap.get(section.id);

    if (section.parent_section_id) {
      const parent = sectionMap.get(section.parent_section_id);
      if (parent) {
        parent.children.push(tocNode);
      } else {
        // Orphaned section - add to root level
        toc.push(tocNode);
      }
    } else {
      // Root level section
      toc.push(tocNode);
    }
  });

  // Third pass: Count subsections recursively
  function countSubsections(node) {
    if (node.children.length > 0) {
      node.subsectionCount = node.children.length;
      node.children.forEach(countSubsections);
    }
  }

  toc.forEach(countSubsections);

  return toc;
}

/**
 * Generate a flat TOC list (for simple navigation menus)
 *
 * @param {Array} sections - Sections with numbers already assigned
 * @returns {Array} Flat array of TOC items with indentation levels
 */
function generateFlatTOC(sections) {
  if (!sections || sections.length === 0) {
    return [];
  }

  return sections.map(section => ({
    id: section.id,
    number: section.number,
    anchorId: section.anchorId,
    citation: section.section_number || section.section_title || `Section ${section.number}`,
    title: section.section_title || '',
    depth: section.depth || 0,
    indentLevel: section.depth || 0,
    hasContent: !!(section.current_text || section.original_text),
    isLocked: section.is_locked || false
  }));
}

/**
 * Find section by anchor ID
 *
 * @param {Array} sections - Sections with numbers assigned
 * @param {String} anchorId - Anchor ID (e.g., "section-42")
 * @returns {Object|null} Section object or null if not found
 */
function findSectionByAnchor(sections, anchorId) {
  if (!sections || !anchorId) {
    return null;
  }

  const found = sections.find(section => section.anchorId === anchorId);
  return found || null;
}

/**
 * Get section navigation info (previous, next, parent)
 *
 * @param {Array} sections - Sections with numbers assigned
 * @param {Number} currentNumber - Current section number
 * @returns {Object} Navigation info with prev, next, parent sections
 */
function getSectionNavigation(sections, currentNumber) {
  if (!sections || !currentNumber) {
    return { prev: null, next: null, parent: null };
  }

  const currentIndex = sections.findIndex(s => s.number === currentNumber);
  if (currentIndex === -1) {
    return { prev: null, next: null, parent: null };
  }

  const current = sections[currentIndex];
  const prev = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const next = currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null;

  let parent = null;
  if (current.parent_section_id) {
    parent = sections.find(s => s.id === current.parent_section_id);
  }

  return {
    prev: prev ? { number: prev.number, anchorId: prev.anchorId, citation: prev.section_number } : null,
    next: next ? { number: next.number, anchorId: next.anchorId, citation: next.section_number } : null,
    parent: parent ? { number: parent.number, anchorId: parent.anchorId, citation: parent.section_number } : null
  };
}

/**
 * Generate TOC metadata for document summary
 *
 * @param {Array} sections - Sections with numbers assigned
 * @returns {Object} TOC metadata
 */
function generateTOCMetadata(sections) {
  if (!sections || sections.length === 0) {
    return {
      totalSections: 0,
      maxDepth: 0,
      rootSections: 0,
      sectionsWithContent: 0,
      lockedSections: 0
    };
  }

  const metadata = {
    totalSections: sections.length,
    maxDepth: Math.max(...sections.map(s => s.depth || 0)),
    rootSections: sections.filter(s => !s.parent_section_id).length,
    sectionsWithContent: sections.filter(s => s.current_text || s.original_text).length,
    lockedSections: sections.filter(s => s.is_locked).length
  };

  return metadata;
}

/**
 * Complete TOC processing pipeline
 * Combines all steps: numbering, hierarchy, flat list, metadata
 *
 * @param {Array} sections - Raw sections from database
 * @returns {Object} Complete TOC data structure
 */
function processSectionsForTOC(sections) {
  if (!sections || sections.length === 0) {
    return {
      sections: [],
      hierarchicalTOC: [],
      flatTOC: [],
      metadata: generateTOCMetadata([])
    };
  }

  // Step 1: Assign sequential numbers
  const numberedSections = assignSectionNumbers([...sections]); // Clone to avoid mutation

  // Step 2: Generate hierarchical TOC
  const hierarchicalTOC = generateTableOfContents(numberedSections);

  // Step 3: Generate flat TOC
  const flatTOC = generateFlatTOC(numberedSections);

  // Step 4: Generate metadata
  const metadata = generateTOCMetadata(numberedSections);

  return {
    sections: numberedSections,
    hierarchicalTOC,
    flatTOC,
    metadata
  };
}

module.exports = {
  assignSectionNumbers,
  generateTableOfContents,
  generateFlatTOC,
  findSectionByAnchor,
  getSectionNavigation,
  generateTOCMetadata,
  processSectionsForTOC
};
