# Table of Contents Implementation

## Overview

This document describes the backend implementation of section numbering and table of contents (TOC) generation for the Bylaws Tool.

## Features

✅ **Sequential Section Numbering** - Deterministic, consistent numbering (1, 2, 3, ...)
✅ **Hierarchical TOC Generation** - Parent-child relationships with subsection counts
✅ **Flat TOC Support** - Simple navigation lists with indentation levels
✅ **Deep Linking** - URL hash navigation to specific sections
✅ **Section Navigation** - Previous, next, parent navigation
✅ **Performance Optimized** - O(n) complexity, < 50ms for 100 sections
✅ **API Endpoints** - Dynamic TOC loading and navigation data

## Architecture

### Components

1. **TOC Service** (`src/services/tocService.js`)
   - Core TOC generation logic
   - Section numbering
   - Hierarchy building
   - Navigation utilities

2. **Dashboard Routes** (`src/routes/dashboard.js`)
   - Document viewer integration
   - API endpoints for TOC and navigation

3. **Client-Side Navigation** (`public/js/document-navigation.js`)
   - Scroll-to-section functionality
   - URL hash handling
   - TOC click handlers

## API Reference

### TOC Service Functions

#### `assignSectionNumbers(sections)`

Assigns sequential numbers to sections based on display order.

**Parameters:**
- `sections` (Array): Section objects from database

**Returns:**
- Array: Sections with `number` and `anchorId` properties

**Example:**
```javascript
const sections = [
  { id: '1', section_number: 'Article I' },
  { id: '2', section_number: 'Article II' }
];

const numbered = tocService.assignSectionNumbers(sections);
// Result: [
//   { id: '1', section_number: 'Article I', number: 1, anchorId: 'section-1' },
//   { id: '2', section_number: 'Article II', number: 2, anchorId: 'section-2' }
// ]
```

#### `generateTableOfContents(sections)`

Generates hierarchical TOC structure with parent-child relationships.

**Parameters:**
- `sections` (Array): Sections with numbers already assigned

**Returns:**
- Array: Hierarchical TOC structure

**Example:**
```javascript
const toc = tocService.generateTableOfContents(numberedSections);
// Result: [
//   {
//     id: '1',
//     number: 1,
//     anchorId: 'section-1',
//     citation: 'Article I',
//     depth: 0,
//     children: [
//       { id: '2', number: 2, ... }
//     ],
//     subsectionCount: 1
//   }
// ]
```

#### `generateFlatTOC(sections)`

Generates flat TOC list for simple navigation menus.

**Parameters:**
- `sections` (Array): Sections with numbers already assigned

**Returns:**
- Array: Flat TOC items with indentation levels

#### `findSectionByAnchor(sections, anchorId)`

Finds a section by its anchor ID.

**Parameters:**
- `sections` (Array): Sections with numbers assigned
- `anchorId` (String): Anchor ID (e.g., "section-42")

**Returns:**
- Object|null: Section object or null if not found

#### `getSectionNavigation(sections, currentNumber)`

Gets navigation info (previous, next, parent) for a section.

**Parameters:**
- `sections` (Array): Sections with numbers assigned
- `currentNumber` (Number): Current section number

**Returns:**
- Object: Navigation info with prev, next, parent sections

**Example:**
```javascript
const nav = tocService.getSectionNavigation(sections, 5);
// Result: {
//   prev: { number: 4, anchorId: 'section-4', citation: 'Article IV' },
//   next: { number: 6, anchorId: 'section-6', citation: 'Article VI' },
//   parent: { number: 1, anchorId: 'section-1', citation: 'Article I' }
// }
```

#### `generateTOCMetadata(sections)`

Generates metadata for document summary.

**Parameters:**
- `sections` (Array): Sections with numbers assigned

**Returns:**
- Object: TOC metadata

**Example:**
```javascript
const metadata = tocService.generateTOCMetadata(sections);
// Result: {
//   totalSections: 42,
//   maxDepth: 3,
//   rootSections: 5,
//   sectionsWithContent: 38,
//   lockedSections: 2
// }
```

#### `processSectionsForTOC(sections)`

Complete TOC processing pipeline. Combines all steps.

**Parameters:**
- `sections` (Array): Raw sections from database

**Returns:**
- Object: Complete TOC data structure

**Example:**
```javascript
const tocData = tocService.processSectionsForTOC(rawSections);
// Result: {
//   sections: [...],           // Numbered sections
//   hierarchicalTOC: [...],    // Hierarchical structure
//   flatTOC: [...],            // Flat navigation list
//   metadata: {...}            // Statistics
// }
```

## API Endpoints

### `GET /api/dashboard/documents/:documentId/toc`

Returns table of contents for a document.

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "uuid",
    "title": "Organization Bylaws"
  },
  "hierarchicalTOC": [...],
  "flatTOC": [...],
  "metadata": {
    "totalSections": 42,
    "maxDepth": 3,
    "rootSections": 5,
    "sectionsWithContent": 38,
    "lockedSections": 2
  },
  "totalSections": 42
}
```

### `GET /api/dashboard/sections/:sectionId/navigation`

Returns navigation info for a section.

**Response:**
```json
{
  "success": true,
  "currentSection": {
    "number": 5,
    "anchorId": "section-5",
    "citation": "Article V"
  },
  "navigation": {
    "prev": {
      "number": 4,
      "anchorId": "section-4",
      "citation": "Article IV"
    },
    "next": {
      "number": 6,
      "anchorId": "section-6",
      "citation": "Article VI"
    },
    "parent": {
      "number": 1,
      "anchorId": "section-1",
      "citation": "Article I"
    }
  }
}
```

## Frontend Integration

### Document Viewer Template

The TOC data is available in the document viewer template:

```ejs
<!-- Hierarchical TOC -->
<div class="toc-container" data-toc-container>
  <% tableOfContents.forEach(item => { %>
    <div class="toc-item depth-<%= item.depth %>">
      <a href="#<%= item.anchorId %>" data-section-number="<%= item.number %>">
        <%= item.citation %>
        <% if (item.subsectionCount > 0) { %>
          <span class="subsection-count">(<%= item.subsectionCount %>)</span>
        <% } %>
      </a>
    </div>
  <% }); %>
</div>

<!-- Flat TOC for navigation -->
<nav class="section-navigation">
  <% flatTOC.forEach(item => { %>
    <a href="#<%= item.anchorId %>"
       class="nav-link indent-<%= item.indentLevel %>"
       data-section-number="<%= item.number %>">
      <%= item.citation %>
    </a>
  <% }); %>
</nav>

<!-- Section with anchor -->
<% sections.forEach(section => { %>
  <div id="<%= section.anchorId %>"
       class="section-card"
       data-section-id="<%= section.id %>">
    <h3>Section <%= section.number %>: <%= section.section_number %></h3>
    <!-- Section content -->
  </div>
<% }); %>
```

### JavaScript Navigation

```javascript
// Include the navigation script
<script src="/js/document-navigation.js"></script>

// Scroll to a section programmatically
DocumentNavigation.scrollToSection(42);

// Or by anchor ID
DocumentNavigation.scrollToSection('section-42');

// Get navigation for a section
const nav = await DocumentNavigation.getSectionNavigation('section-uuid');
```

### Deep Linking

Users can link directly to sections using URL hashes:

```
https://example.com/dashboard/document/uuid#section-42
```

The page will automatically scroll to section 42 on load.

## Performance

### Benchmarks

| Sections | Processing Time | Target |
|----------|-----------------|--------|
| 100      | < 50ms         | ✅     |
| 500      | < 200ms        | ✅     |
| 1000     | < 400ms        | ✅     |

### Optimization Techniques

1. **O(n) Complexity** - Single pass for most operations
2. **No Deep Cloning** - Minimal memory allocations
3. **Map-Based Lookup** - Fast parent/child relationships
4. **Lazy Loading** - Navigation data loaded on demand
5. **Database Query Optimization** - Sections pre-ordered by `path_ordinals`

## Testing

### Run Tests

```bash
npm test tests/unit/toc-service.test.js
```

### Test Coverage

- ✅ Sequential numbering
- ✅ Flat TOC generation
- ✅ Hierarchical TOC with parent-child relationships
- ✅ Deep hierarchy (3+ levels)
- ✅ Orphaned sections (missing parents)
- ✅ Section navigation (prev, next, parent)
- ✅ Metadata generation
- ✅ Performance with 100 and 500 sections
- ✅ Edge cases (empty arrays, null inputs)

## Migration Notes

### Existing Documents

The TOC system works with existing documents without database changes. Section numbers are generated dynamically based on `path_ordinals` ordering.

### No Database Migration Required

All TOC data is computed on-the-fly from existing section data:
- `path_ordinals` - Determines section order
- `depth` - Determines hierarchy level
- `parent_section_id` - Determines parent-child relationships

## Future Enhancements

### Possible Improvements

1. **Custom Numbering Schemes** - Roman numerals, letters, etc.
2. **TOC Caching** - Cache generated TOC in Redis for large documents
3. **TOC Customization** - User-configurable TOC display options
4. **Print-Friendly TOC** - Separate TOC for PDF exports
5. **Bookmark Support** - Save user's reading position
6. **Section Search** - Search within TOC

## Troubleshooting

### TOC Not Updating

**Symptom:** TOC shows old section numbers after document changes.

**Solution:** TOC is generated on page load. Refresh the page or use the dynamic API endpoint.

### Incorrect Section Order

**Symptom:** Sections appear in wrong order in TOC.

**Cause:** `path_ordinals` not properly set during document upload.

**Solution:** Re-import document or manually update `path_ordinals` in database.

### Deep Linking Not Working

**Symptom:** URL hash doesn't scroll to section.

**Cause:** JavaScript not loaded or section anchor missing.

**Solution:**
1. Check `/js/document-navigation.js` is included
2. Verify section has `id="section-X"` attribute
3. Check browser console for errors

## Support

For issues or questions about the TOC implementation:
- Check test suite: `tests/unit/toc-service.test.js`
- Review service code: `src/services/tocService.js`
- API documentation: This file

---

**Last Updated:** 2025-10-19
**Version:** 1.0.0
**Author:** Backend Development Team
