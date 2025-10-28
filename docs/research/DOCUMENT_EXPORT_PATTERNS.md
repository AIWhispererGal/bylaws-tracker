# Document Export Patterns - Research Report

**Date:** 2025-10-28
**Agent:** Researcher
**Mission:** Export document with original and current text as JSON
**Swarm ID:** swarm-1761627819200-fnb2ykjdl

---

## Executive Summary

This document provides comprehensive research on implementing a JSON export feature for documents that includes both original text and current text for all sections, along with hierarchy information and metadata.

**Key Recommendations:**
1. **Server-side JSON generation** via new API endpoint
2. **Hierarchical JSON structure** with full section tree
3. **Export button in document header** with download icon
4. **Extensible format** for future export types (CSV, Word, PDF)

---

## 1. JSON Export Best Practices

### Industry Standards

**Document Export Formats:**
- **JSON:** Best for structured data, API integration, and web applications
- **CSV:** Best for tabular data and spreadsheet import
- **Word (.docx):** Best for document editing and formatting
- **PDF:** Best for read-only distribution and printing

**JSON Best Practices:**
1. Use clear, consistent field naming (snake_case or camelCase)
2. Include metadata at root level (export date, version, schema)
3. Use ISO 8601 format for timestamps
4. Include both human-readable and machine-readable identifiers
5. Nest hierarchical data naturally
6. Include schema version for future compatibility

### Hierarchical Data Structuring

Based on database schema analysis:
- Document has 1:many sections
- Sections have parent-child relationships (tree structure)
- Sections have depth (0 = root, 1+ = nested)
- Sections have ordinal position among siblings
- Sections have document_order for sequential display

**Best Practice:** Provide BOTH hierarchical (nested) and flat (array) representations.

---

## 2. Recommended JSON Structure

### Option A: Hierarchical Tree (Recommended)

```json
{
  "export_metadata": {
    "schema_version": "1.0.0",
    "export_timestamp": "2025-10-28T08:42:32.836Z",
    "export_format": "document_with_original_and_current_text",
    "exported_by": {
      "user_id": "uuid",
      "email": "user@example.com"
    },
    "application": {
      "name": "Bylaws Amendment Tracker",
      "version": "1.0.0"
    }
  },
  "document": {
    "id": "uuid",
    "title": "Neighborhood Council Bylaws",
    "description": "Official bylaws governing the organization",
    "document_type": "bylaws",
    "version": "1.0",
    "status": "draft",
    "organization": {
      "id": "uuid",
      "name": "Example Neighborhood Council",
      "slug": "example-nc"
    },
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-10-28T08:00:00Z",
    "section_count": 156,
    "hierarchy_config": {
      "levels": [
        {
          "name": "Article",
          "prefix": "Article",
          "numbering": "roman"
        },
        {
          "name": "Section",
          "prefix": "Section",
          "numbering": "numeric"
        }
      ]
    }
  },
  "sections": [
    {
      "id": "uuid",
      "section_number": "Article I",
      "section_title": "Name and Purpose",
      "section_type": "article",
      "depth": 0,
      "ordinal": 1,
      "document_order": 1,
      "path": ["Article I"],
      "original_text": "This organization shall be known as...",
      "current_text": "This organization shall be known as...",
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "locked_text": null,
      "has_suggestions": false,
      "selected_suggestion_id": null,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-10-28T07:30:00Z",
      "text_comparison": {
        "is_modified": false,
        "character_count_original": 245,
        "character_count_current": 245,
        "word_count_original": 42,
        "word_count_current": 42
      },
      "children": [
        {
          "id": "uuid",
          "section_number": "Section 1.1",
          "section_title": "Name",
          "section_type": "section",
          "depth": 1,
          "ordinal": 1,
          "document_order": 2,
          "path": ["Article I", "Section 1.1"],
          "original_text": "The name of this organization...",
          "current_text": "The official name of this organization...",
          "is_locked": true,
          "locked_at": "2025-10-27T14:30:00Z",
          "locked_by": "uuid",
          "locked_text": "The official name of this organization...",
          "has_suggestions": true,
          "selected_suggestion_id": "uuid",
          "created_at": "2025-01-15T10:00:00Z",
          "updated_at": "2025-10-27T14:30:00Z",
          "text_comparison": {
            "is_modified": true,
            "character_count_original": 156,
            "character_count_current": 178,
            "word_count_original": 28,
            "word_count_current": 32
          },
          "children": []
        }
      ]
    }
  ],
  "export_statistics": {
    "total_sections": 156,
    "root_sections": 12,
    "max_depth": 3,
    "modified_sections": 23,
    "locked_sections": 18,
    "sections_with_suggestions": 45
  }
}
```

### Option B: Flat Array (Simpler, but loses visual hierarchy)

```json
{
  "export_metadata": { /* same as above */ },
  "document": { /* same as above */ },
  "sections": [
    {
      "id": "uuid",
      "section_number": "Article I",
      "parent_id": null,
      "depth": 0,
      "original_text": "...",
      "current_text": "...",
      /* other fields */
    },
    {
      "id": "uuid",
      "section_number": "Section 1.1",
      "parent_id": "uuid-of-article-1",
      "depth": 1,
      "original_text": "...",
      "current_text": "...",
      /* other fields */
    }
  ]
}
```

**Recommendation:** Use **Option A (Hierarchical)** as primary format, but provide Option B as alternative via query parameter `?format=flat`.

---

## 3. Export Implementation Approach

### Server-Side vs Client-Side Generation

#### Server-Side (Recommended ✅)

**Pros:**
- Can handle large documents (1000+ sections)
- No browser memory limitations
- Can include database-only fields
- Proper Content-Disposition headers for download
- Can generate multiple formats in future
- Server can validate and sanitize data
- Consistent formatting across all clients

**Cons:**
- Additional server load
- Network transfer time for large exports

**Implementation:**
```javascript
// New route in dashboard.js or admin.js
router.get('/documents/:documentId/export', requireAuth, async (req, res) => {
  const format = req.query.format || 'hierarchical'; // 'hierarchical' or 'flat'
  const includeMetadata = req.query.metadata !== 'false';

  // Fetch document and all sections
  // Build JSON structure
  // Set headers for download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition',
    `attachment; filename="document-${documentId}-export-${timestamp}.json"`);
  res.json(exportData);
});
```

#### Client-Side

**Pros:**
- No server load
- Instant generation
- Works offline (if data cached)

**Cons:**
- Browser memory limits (may crash on large documents)
- Can only use data already loaded on page
- Inconsistent across browsers
- Cannot include server-only metadata

**Recommendation:** Use **server-side generation** for production quality and reliability.

---

## 4. Download Mechanism Patterns

### Pattern A: Direct API Route with Content-Disposition (Recommended ✅)

```javascript
// Server route
app.get('/api/documents/:id/export', async (req, res) => {
  const json = await generateExportJSON(req.params.id);
  const filename = `${document.title.replace(/\s+/g, '-')}-${Date.now()}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(json, null, 2)); // Pretty-print with 2-space indent
});

// Client-side
<a href="/api/documents/<%= document.id %>/export"
   download
   class="btn btn-outline-primary">
  <i class="bi bi-download"></i> Export JSON
</a>
```

**Pros:**
- Simple implementation
- Browser handles download automatically
- Works with right-click "Save As"
- No JavaScript required (progressive enhancement)

**Cons:**
- Navigates page on click (can be prevented with event.preventDefault() and fetch)

### Pattern B: Fetch + Blob Download (Modern approach)

```javascript
// Client-side JavaScript
async function exportDocument(documentId) {
  try {
    const response = await fetch(`/api/documents/${documentId}/export`);
    const json = await response.json();

    // Create blob and download
    const blob = new Blob([JSON.stringify(json, null, 2)],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${documentId}-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export document. Please try again.');
  }
}
```

**Pros:**
- No page navigation
- Can show loading spinner
- Can handle errors gracefully
- Can process JSON before download (filtering, formatting)

**Cons:**
- Requires JavaScript
- More complex implementation

**Recommendation:** Use **Pattern A** for simplicity, with optional upgrade to Pattern B for enhanced UX.

---

## 5. UI/UX Design Recommendations

### Button Placement

**Option 1: Document Header (Recommended ✅)**
```html
<!-- In document-viewer.ejs, near top -->
<div class="document-header d-flex justify-content-between align-items-center mb-4">
  <div>
    <h1><%= document.title %></h1>
    <p class="text-muted"><%= document.description %></p>
  </div>
  <div class="document-actions">
    <a href="/api/documents/<%= document.id %>/export"
       class="btn btn-outline-primary"
       download>
      <i class="bi bi-download"></i> Export JSON
    </a>
    <% if (userPermissions.canEdit) { %>
      <a href="/admin/documents/<%= document.id %>/edit"
         class="btn btn-outline-secondary">
        <i class="bi bi-pencil"></i> Edit
      </a>
    <% } %>
  </div>
</div>
```

**Option 2: Dashboard Document List**
```html
<!-- In dashboard.ejs documents table -->
<td>
  <a href="/dashboard/documents/<%= doc.id %>" class="btn btn-sm btn-primary">
    <i class="bi bi-eye"></i> View
  </a>
  <a href="/api/documents/<%= doc.id %>/export"
     class="btn btn-sm btn-outline-primary"
     download>
    <i class="bi bi-download"></i>
  </a>
</td>
```

### Icon Recommendations

Bootstrap Icons options:
- `bi-download` - Classic download icon (recommended)
- `bi-file-earmark-arrow-down` - File with download arrow
- `bi-cloud-download` - Cloud download
- `bi-box-arrow-down` - Box with arrow
- `bi-file-earmark-code` - For JSON specifically

**Recommendation:** Use `bi-download` for familiarity.

### Export Options UI

**Dropdown for Multiple Formats:**
```html
<div class="dropdown">
  <button class="btn btn-outline-primary dropdown-toggle"
          type="button"
          data-bs-toggle="dropdown">
    <i class="bi bi-download"></i> Export
  </button>
  <ul class="dropdown-menu">
    <li>
      <a class="dropdown-item" href="/api/documents/<%= document.id %>/export?format=hierarchical">
        <i class="bi bi-file-earmark-code"></i> JSON (Hierarchical)
      </a>
    </li>
    <li>
      <a class="dropdown-item" href="/api/documents/<%= document.id %>/export?format=flat">
        <i class="bi bi-file-earmark-code"></i> JSON (Flat)
      </a>
    </li>
    <li><hr class="dropdown-divider"></li>
    <li>
      <a class="dropdown-item disabled" href="#">
        <i class="bi bi-file-earmark-spreadsheet"></i> CSV (Coming Soon)
      </a>
    </li>
    <li>
      <a class="dropdown-item disabled" href="#">
        <i class="bi bi-file-earmark-word"></i> Word Document (Coming Soon)
      </a>
    </li>
  </ul>
</div>
```

### Loading State

**For server-side generation:**
```html
<button onclick="exportDocument('<%= document.id %>')"
        class="btn btn-outline-primary"
        id="exportBtn">
  <i class="bi bi-download"></i> Export JSON
</button>

<script>
async function exportDocument(docId) {
  const btn = document.getElementById('exportBtn');
  const originalHTML = btn.innerHTML;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';

  try {
    const response = await fetch(`/api/documents/${docId}/export`);
    const blob = await response.blob();

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${docId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Show success
    btn.innerHTML = '<i class="bi bi-check-circle"></i> Downloaded!';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }, 2000);
  } catch (error) {
    console.error('Export failed:', error);
    btn.innerHTML = '<i class="bi bi-x-circle"></i> Failed';
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }, 2000);
  }
}
</script>
```

---

## 6. Database Query Pattern

### Efficient Section Fetching

```javascript
// In dashboard.js or new export.js route
async function generateDocumentExport(documentId, format = 'hierarchical', supabase) {
  // 1. Fetch document with organization info
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select(`
      *,
      organizations:organization_id (
        id,
        name,
        slug,
        organization_type
      )
    `)
    .eq('id', documentId)
    .single();

  if (docError) throw docError;

  // 2. Fetch ALL sections in document order
  const { data: sections, error: sectionsError } = await supabase
    .from('document_sections')
    .select(`
      id,
      section_number,
      section_title,
      section_type,
      original_text,
      current_text,
      is_locked,
      locked_at,
      locked_by,
      locked_text,
      selected_suggestion_id,
      parent_section_id,
      ordinal,
      depth,
      document_order,
      path_ids,
      path_ordinals,
      metadata,
      created_at,
      updated_at
    `)
    .eq('document_id', documentId)
    .order('document_order', { ascending: true });

  if (sectionsError) throw sectionsError;

  // 3. Build export structure
  const exportData = {
    export_metadata: {
      schema_version: '1.0.0',
      export_timestamp: new Date().toISOString(),
      export_format: format,
      exported_by: {
        user_id: req.session.userId,
        email: req.session.userEmail
      },
      application: {
        name: 'Bylaws Amendment Tracker',
        version: '1.0.0'
      }
    },
    document: {
      id: document.id,
      title: document.title,
      description: document.description,
      document_type: document.document_type,
      version: document.version,
      status: document.status,
      organization: document.organizations,
      created_at: document.created_at,
      updated_at: document.updated_at,
      section_count: sections.length,
      hierarchy_config: document.hierarchy_override || document.organizations?.hierarchy_config
    },
    sections: format === 'hierarchical'
      ? buildHierarchicalSections(sections)
      : buildFlatSections(sections),
    export_statistics: calculateStatistics(sections)
  };

  return exportData;
}

function buildHierarchicalSections(sections) {
  // Build tree structure using parent_section_id relationships
  const sectionMap = new Map();
  const rootSections = [];

  // First pass: create all section objects
  sections.forEach(section => {
    sectionMap.set(section.id, {
      ...section,
      text_comparison: {
        is_modified: section.original_text !== section.current_text,
        character_count_original: section.original_text?.length || 0,
        character_count_current: section.current_text?.length || 0,
        word_count_original: section.original_text?.split(/\s+/).length || 0,
        word_count_current: section.current_text?.split(/\s+/).length || 0
      },
      children: []
    });
  });

  // Second pass: build tree
  sectionMap.forEach((section, id) => {
    if (section.parent_section_id) {
      const parent = sectionMap.get(section.parent_section_id);
      if (parent) {
        parent.children.push(section);
      }
    } else {
      rootSections.push(section);
    }
  });

  return rootSections;
}

function buildFlatSections(sections) {
  return sections.map(section => ({
    ...section,
    text_comparison: {
      is_modified: section.original_text !== section.current_text,
      character_count_original: section.original_text?.length || 0,
      character_count_current: section.current_text?.length || 0,
      word_count_original: section.original_text?.split(/\s+/).length || 0,
      word_count_current: section.current_text?.split(/\s+/).length || 0
    }
  }));
}

function calculateStatistics(sections) {
  return {
    total_sections: sections.length,
    root_sections: sections.filter(s => s.depth === 0).length,
    max_depth: Math.max(...sections.map(s => s.depth)),
    modified_sections: sections.filter(s => s.original_text !== s.current_text).length,
    locked_sections: sections.filter(s => s.is_locked).length,
    sections_with_suggestions: sections.filter(s => s.selected_suggestion_id).length
  };
}
```

---

## 7. Future Export Format Ideas

### CSV Export
**Use Case:** Spreadsheet analysis, bulk editing, data migration

**Structure:**
```csv
"Section Number","Section Title","Depth","Original Text","Current Text","Is Modified","Is Locked","Locked At","Updated At"
"Article I","Name and Purpose",0,"This organization...","This organization...",false,false,,"2025-10-28T08:00:00Z"
"Section 1.1","Name",1,"The name...","The official name...",true,true,"2025-10-27T14:30:00Z","2025-10-27T14:30:00Z"
```

**Implementation:**
```javascript
router.get('/documents/:id/export/csv', requireAuth, async (req, res) => {
  const sections = await fetchSections(req.params.id);
  const csv = generateCSV(sections);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="document-${req.params.id}.csv"`);
  res.send(csv);
});
```

### Word Document (.docx) Export
**Use Case:** Editing, formatting, official distribution

**Library:** `docx` npm package (https://docx.js.org/)

**Features:**
- Hierarchical heading styles
- Track changes for modified sections
- Comments for suggestions
- Table of contents

### PDF Export
**Use Case:** Read-only distribution, printing, archival

**Library:** `pdfkit` or `puppeteer`

**Features:**
- Professional formatting
- Table of contents with links
- Diff highlighting (red strikethrough for original, green for current)
- Page numbers and headers

### Markdown Export
**Use Case:** Documentation, version control, GitHub

**Structure:**
```markdown
# Document Title

## Article I - Name and Purpose

The organization shall...

### Section 1.1 - Name

**Original:** The name of this organization...

**Current:** The official name of this organization...

**Status:** Modified, Locked on 2025-10-27
```

---

## 8. Security Considerations

### Access Control
```javascript
// Verify user has permission to export
router.get('/documents/:id/export', requireAuth, async (req, res) => {
  const { supabase } = req;

  // Verify document belongs to user's organization
  const { data: document, error } = await supabase
    .from('documents')
    .select('organization_id')
    .eq('id', req.params.id)
    .single();

  if (error || !document) {
    return res.status(404).json({ error: 'Document not found' });
  }

  if (document.organization_id !== req.session.organizationId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Proceed with export...
});
```

### Data Sanitization
```javascript
function sanitizeForExport(text) {
  // Remove any sensitive data
  // Escape special characters if needed
  return text;
}
```

### Rate Limiting
```javascript
// Prevent abuse of export endpoint
const rateLimit = require('express-rate-limit');

const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 export requests per windowMs
});

router.get('/documents/:id/export', exportLimiter, requireAuth, async (req, res) => {
  // ...
});
```

---

## 9. Implementation Checklist

### Phase 1: Basic JSON Export (MVP)
- [ ] Create `/api/documents/:id/export` route in `src/routes/dashboard.js`
- [ ] Implement `generateDocumentExport()` function
- [ ] Implement `buildHierarchicalSections()` helper
- [ ] Implement `buildFlatSections()` helper
- [ ] Implement `calculateStatistics()` helper
- [ ] Add export button to document header in `views/dashboard/document-viewer.ejs`
- [ ] Test with small document (< 50 sections)
- [ ] Test with large document (> 500 sections)
- [ ] Verify download filename format
- [ ] Verify JSON structure and formatting

### Phase 2: Enhanced UX
- [ ] Add loading spinner during export generation
- [ ] Add success/error toast notifications
- [ ] Add export button to dashboard document list
- [ ] Implement `?format=flat` query parameter
- [ ] Add format selection dropdown
- [ ] Add export statistics to UI

### Phase 3: Additional Formats
- [ ] Implement CSV export
- [ ] Implement Word document export
- [ ] Implement PDF export (with diff highlighting)
- [ ] Implement Markdown export

### Phase 4: Advanced Features
- [ ] Add export history/audit log
- [ ] Add scheduled exports (email weekly)
- [ ] Add export templates (custom field selection)
- [ ] Add bulk export (multiple documents as ZIP)

---

## 10. Testing Recommendations

### Unit Tests
```javascript
describe('Document Export', () => {
  test('should generate hierarchical JSON structure', () => {
    const sections = mockSections();
    const result = buildHierarchicalSections(sections);
    expect(result[0].children).toBeDefined();
    expect(result[0].children.length).toBeGreaterThan(0);
  });

  test('should calculate export statistics correctly', () => {
    const sections = mockSections();
    const stats = calculateStatistics(sections);
    expect(stats.total_sections).toBe(sections.length);
    expect(stats.modified_sections).toBeGreaterThan(0);
  });

  test('should include text comparison metadata', () => {
    const sections = buildFlatSections(mockSections());
    expect(sections[0].text_comparison).toBeDefined();
    expect(sections[0].text_comparison.is_modified).toBeDefined();
  });
});
```

### Integration Tests
```javascript
describe('Export API Endpoint', () => {
  test('should return JSON with correct structure', async () => {
    const response = await request(app)
      .get('/api/documents/test-doc-id/export')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body.export_metadata).toBeDefined();
    expect(response.body.document).toBeDefined();
    expect(response.body.sections).toBeInstanceOf(Array);
  });

  test('should reject unauthorized access', async () => {
    await request(app)
      .get('/api/documents/other-org-doc/export')
      .expect(403);
  });

  test('should support format query parameter', async () => {
    const response = await request(app)
      .get('/api/documents/test-doc-id/export?format=flat')
      .expect(200);

    expect(response.body.export_metadata.export_format).toBe('flat');
  });
});
```

### Manual Testing Checklist
- [ ] Export small document (< 50 sections) - verify structure
- [ ] Export large document (> 500 sections) - verify performance
- [ ] Export document with deeply nested hierarchy (depth > 3)
- [ ] Export document with no modifications - verify original = current
- [ ] Export document with many locked sections - verify locked_text present
- [ ] Verify download filename is meaningful
- [ ] Verify JSON is pretty-printed (readable)
- [ ] Test with different browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Verify organization access control works

---

## 11. Performance Considerations

### Query Optimization
```javascript
// GOOD: Single query with all needed fields
const { data } = await supabase
  .from('document_sections')
  .select('id, section_number, original_text, current_text, ...')
  .eq('document_id', documentId)
  .order('document_order');

// BAD: Multiple queries in loop
for (const sectionId of sectionIds) {
  const { data } = await supabase
    .from('document_sections')
    .select('*')
    .eq('id', sectionId)
    .single();
}
```

### Memory Management
```javascript
// For very large documents (1000+ sections), use streaming
router.get('/documents/:id/export', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="export.json"');

  const stream = createExportStream(req.params.id);
  stream.pipe(res);
});
```

### Caching Strategy
```javascript
// Cache export for 5 minutes (if document hasn't changed)
const cacheKey = `export:${documentId}:${documentUpdatedAt}`;
const cached = await cache.get(cacheKey);

if (cached) {
  return res.json(cached);
}

const exportData = await generateDocumentExport(documentId);
await cache.set(cacheKey, exportData, 300); // 5 minutes TTL
return res.json(exportData);
```

---

## 12. Coordination Notes

**For Coder Agent:**
- Implement route at `/api/documents/:documentId/export`
- Use existing `requireAuth` middleware
- Follow existing code patterns in `src/routes/dashboard.js`
- Use Supabase client from `req.supabase`
- Return JSON with proper headers

**For Tester Agent:**
- Create unit tests for helper functions
- Create integration tests for API endpoint
- Test with various document sizes and structures
- Verify access control and security

**For Reviewer Agent:**
- Verify JSON structure matches specification
- Check for SQL injection vulnerabilities
- Review error handling
- Verify performance with large datasets

---

## 13. References

**Existing Codebase Patterns:**
- Document fetching: `src/routes/dashboard.js` lines 999-1013
- Section querying: `src/routes/dashboard.js` lines 1019-1039
- Hierarchy building: `src/services/sectionStorage.js` lines 129-185
- TOC generation: `src/services/tocService.js`

**Database Schema:**
- Documents: `database/schema.sql` lines 71-90
- Sections: `database/schema.sql` lines 4-33
- Organizations: `database/schema.sql` lines 103-119

**External Libraries:**
- CSV: `csv-stringify` (npm)
- Word: `docx` (npm)
- PDF: `pdfkit` or `puppeteer` (npm)

---

## Conclusion

**Recommended Implementation:**
1. Server-side JSON generation via new API route
2. Hierarchical JSON structure with full metadata
3. Simple download button in document header
4. Progressive enhancement with loading states
5. Extensible architecture for future formats

**Expected Timeline:**
- Phase 1 (MVP): 4-6 hours
- Phase 2 (UX): 2-3 hours
- Phase 3 (Formats): 8-10 hours
- Phase 4 (Advanced): 10-15 hours

**Priority:** HIGH (user-requested feature, high value, low complexity)

---

**Research completed by:** Researcher Agent
**Coordination key:** `hive/researcher/export-patterns`
**Next steps:** Hand off to Coder agent for implementation
