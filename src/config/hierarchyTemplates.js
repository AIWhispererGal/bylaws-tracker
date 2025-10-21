/**
 * Pre-built Hierarchy Templates for 10-Level Document Structure
 *
 * These templates provide common numbering schemas that can be applied
 * to documents during setup or customized per-document.
 *
 * Each template defines 10 levels (depth 0-9) with:
 * - name: Display name for the level
 * - depth: Hierarchy depth (0 = top level)
 * - numbering: Numbering scheme (roman, numeric, alpha, alphaLower)
 * - prefix: Text prefix before the number
 *
 * Numbering schemes:
 * - roman: I, II, III, IV, V, ...
 * - numeric: 1, 2, 3, 4, 5, ...
 * - alpha: A, B, C, D, E, ...
 * - alphaLower: a, b, c, d, e, ...
 */

module.exports = {
  'standard-bylaws': {
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
    name: 'Legal Document',
    description: 'Legal document structure with chapters and clauses',
    levels: [
      { name: 'Chapter',      depth: 0, numbering: 'roman',     prefix: 'Chapter ' },
      { name: 'Section',      depth: 1, numbering: 'numeric',   prefix: 'Section ' },
      { name: 'Clause',       depth: 2, numbering: 'numeric',   prefix: 'Clause ' },
      { name: 'Subclause',    depth: 3, numbering: 'numeric',   prefix: '' },
      { name: 'Paragraph',    depth: 4, numbering: 'alphaLower', prefix: '(' },
      { name: 'Subparagraph', depth: 5, numbering: 'numeric',   prefix: '' },
      { name: 'Item',         depth: 6, numbering: 'alphaLower', prefix: '(' },
      { name: 'Subitem',      depth: 7, numbering: 'roman',     prefix: '' },
      { name: 'Point',        depth: 8, numbering: 'numeric',   prefix: '•' },
      { name: 'Subpoint',     depth: 9, numbering: 'alpha',     prefix: '◦' }
    ],
    maxDepth: 10
  },

  'policy-manual': {
    name: 'Policy Manual',
    description: 'Corporate policy structure',
    levels: [
      { name: 'Part',         depth: 0, numbering: 'roman',     prefix: 'Part ' },
      { name: 'Section',      depth: 1, numbering: 'numeric',   prefix: 'Section ' },
      { name: 'Paragraph',    depth: 2, numbering: 'numeric',   prefix: '' },
      { name: 'Subparagraph', depth: 3, numbering: 'alphaLower', prefix: '(' },
      { name: 'Item',         depth: 4, numbering: 'numeric',   prefix: '' },
      { name: 'Subitem',      depth: 5, numbering: 'alphaLower', prefix: '(' },
      { name: 'Clause',       depth: 6, numbering: 'roman',     prefix: '' },
      { name: 'Subclause',    depth: 7, numbering: 'numeric',   prefix: '•' },
      { name: 'Point',        depth: 8, numbering: 'alpha',     prefix: '◦' },
      { name: 'Detail',       depth: 9, numbering: 'numeric',   prefix: '-' }
    ],
    maxDepth: 10
  },

  'technical-standard': {
    name: 'Technical Standard',
    description: 'Numeric hierarchy (1.1.1.1.1...)',
    levels: [
      { name: 'Level 1',  depth: 0, numbering: 'numeric', prefix: '' },
      { name: 'Level 2',  depth: 1, numbering: 'numeric', prefix: '' },
      { name: 'Level 3',  depth: 2, numbering: 'numeric', prefix: '' },
      { name: 'Level 4',  depth: 3, numbering: 'numeric', prefix: '' },
      { name: 'Level 5',  depth: 4, numbering: 'numeric', prefix: '' },
      { name: 'Level 6',  depth: 5, numbering: 'numeric', prefix: '' },
      { name: 'Level 7',  depth: 6, numbering: 'numeric', prefix: '' },
      { name: 'Level 8',  depth: 7, numbering: 'numeric', prefix: '' },
      { name: 'Level 9',  depth: 8, numbering: 'numeric', prefix: '' },
      { name: 'Level 10', depth: 9, numbering: 'numeric', prefix: '' }
    ],
    maxDepth: 10
  }
};
