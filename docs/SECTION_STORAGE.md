# Section Storage Service Documentation

## Overview

The Section Storage Service (`/src/services/sectionStorage.js`) handles storing parsed document sections to the `document_sections` table with full hierarchical relationships.

## Key Features

1. **Hierarchy Building**: Automatically calculates parent-child relationships from flat section lists
2. **Ordinal Calculation**: Determines correct ordinal positions among siblings
3. **Batch Insertion**: Efficiently inserts sections in batches
4. **Validation**: Verifies stored sections maintain correct hierarchy
5. **Path Management**: Works with database triggers to maintain `path_ids` and `path_ordinals`

## API Reference

### `storeSections(organizationId, documentId, sections, supabase)`

Main method to store parsed sections to database.

**Parameters:**
- `organizationId` (string): Organization UUID
- `documentId` (string): Document UUID
- `sections` (Array): Parsed sections from parser
- `supabase` (Object): Supabase client instance

**Returns:**
```javascript
{
  success: true,
  sectionsStored: 42,
  sections: [...], // Array of inserted section records
  message: "Successfully stored 42 sections with hierarchy"
}
```

**Section Object Format:**
```javascript
{
  type: 'article',           // Section type (article, section, subsection, etc.)
  number: 'I',               // Section number (I, 1, A, etc.)
  prefix: 'Article ',        // Display prefix
  title: 'Organization',     // Section title
  text: 'Full content...',   // Section content
  depth: 0,                  // Hierarchy depth (0=root, 1=child, etc.)
  citation: 'Article I',     // Full citation
  level: 'Article',          // Level name
  article_number: 1,         // Legacy field
  section_number: '1',       // Legacy field
  ordinal: 1                 // Position in document
}
```

### `buildHierarchy(sections)`

Builds parent-child relationships from flat section list.

**Algorithm:**
1. Maintains a stack of potential parents at each depth
2. For each section:
   - Pop parents from stack until reaching current depth
   - Calculate ordinal among siblings with same parent
   - Set parent reference to top of stack
   - Push self to stack for potential children

**Example:**
```javascript
// Input: Flat list
[
  { depth: 0, title: 'Article I' },
  { depth: 1, title: 'Section 1' },
  { depth: 1, title: 'Section 2' },
  { depth: 0, title: 'Article II' }
]

// Output: Hierarchical structure
[
  { depth: 0, ordinal: 1, parent_id: null },      // Article I
  { depth: 1, ordinal: 1, parent_temp_id: 0 },    // Section 1 (child of Article I)
  { depth: 1, ordinal: 2, parent_temp_id: 0 },    // Section 2 (child of Article I)
  { depth: 0, ordinal: 2, parent_id: null }       // Article II
]
```

### `validateStoredSections(documentId, supabase)`

Validates stored sections for hierarchy integrity.

**Checks:**
- `path_ids` length matches `depth + 1`
- `path_ordinals` length matches `depth + 1`
- Last element of `path_ids` is self
- Non-root sections have valid `parent_section_id`

**Returns:**
```javascript
{
  success: true,
  totalSections: 42,
  issues: [],
  message: "All sections validated successfully"
}
```

### `updateParentRelationships(documentId, supabase)`

Updates parent_section_id fields after initial insertion (optional).

Note: Initial implementation inserts with parent_id = null. Database triggers handle path calculations.

### `formatSectionNumber(section)`

Formats section number for display.

**Priority:**
1. Uses `section.section_number` if present
2. Falls back to `section.citation`
3. Builds from `prefix` + `number`
4. Returns "Unnumbered" if none available

## Database Schema

### `document_sections` Table

```sql
CREATE TABLE document_sections (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  parent_section_id UUID,           -- Adjacency list
  ordinal INTEGER NOT NULL,         -- Position among siblings
  depth INTEGER NOT NULL,           -- 0=root, 1=child, etc.

  -- Materialized paths (auto-maintained by trigger)
  path_ids UUID[] NOT NULL,         -- [root_id, parent_id, self_id]
  path_ordinals INTEGER[] NOT NULL, -- [1, 2, 1] = "1.2.1"

  -- Display
  section_number VARCHAR(50),
  section_title TEXT,
  section_type VARCHAR(50),

  -- Content
  original_text TEXT,
  current_text TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Database Triggers

The `update_section_path()` trigger automatically maintains:
- `path_ids`: Array of ancestor UUIDs
- `path_ordinals`: Array of ordinals for natural sorting
- `depth`: Calculated from parent depth + 1

## Usage Example

### In Setup Service

```javascript
const sectionStorage = require('./sectionStorage');

async function processDocumentImport(orgId, filePath, supabase) {
  // 1. Parse document
  const parseResult = await wordParser.parseDocument(filePath, config);

  // 2. Create document record
  const { data: document } = await supabase
    .from('documents')
    .insert({ organization_id: orgId, title: 'Bylaws' })
    .select()
    .single();

  // 3. Store sections with hierarchy
  const storageResult = await sectionStorage.storeSections(
    orgId,
    document.id,
    parseResult.sections,
    supabase
  );

  // 4. Validate
  const validationResult = await sectionStorage.validateStoredSections(
    document.id,
    supabase
  );

  console.log(`Stored ${storageResult.sectionsStored} sections`);
  console.log(`Validation: ${validationResult.message}`);

  return { success: true, document, storageResult };
}
```

### Querying Hierarchical Sections

```javascript
// Get all sections in document order
const { data: sections } = await supabase
  .from('document_sections')
  .select('*')
  .eq('document_id', documentId)
  .order('path_ordinals', { ascending: true });

// Get children of a section
const { data: children } = await supabase
  .from('document_sections')
  .select('*')
  .eq('parent_section_id', parentId)
  .order('ordinal', { ascending: true });

// Get section with full breadcrumb path
const { data: breadcrumb } = await supabase
  .rpc('get_section_breadcrumb', { section_uuid: sectionId });
```

## Error Handling

### Common Issues

**Issue: "path_ids length != depth + 1"**
- Cause: Database trigger not fired or parent_section_id incorrect
- Solution: Check trigger exists and is enabled
- Fix: Re-run `updateParentRelationships()`

**Issue: "Missing parent_section_id for non-root section"**
- Cause: Hierarchy building failed to assign parent
- Solution: Check section depth values are correct
- Fix: Rebuild hierarchy with correct depth values

**Issue: "Duplicate ordinals among siblings"**
- Cause: Ordinal calculation error
- Solution: Check parent stack management
- Fix: Rebuild hierarchy with corrected algorithm

## Performance Considerations

### Batch Size
Default batch size is 50 sections per insert. Adjust based on:
- Database connection limits
- Section complexity
- Network latency

```javascript
const batchSize = 50; // Configurable
for (let i = 0; i < sections.length; i += batchSize) {
  const batch = sections.slice(i, i + batchSize);
  await supabase.from('document_sections').insert(batch);
}
```

### Indexing
Ensure these indexes exist for optimal performance:
- `idx_doc_sections_document` (document_id)
- `idx_doc_sections_parent` (parent_section_id)
- `idx_doc_sections_path` (GIN index on path_ids)
- `idx_doc_sections_depth` (document_id, depth)

### Query Optimization
Use materialized paths for:
- Fast ancestor/descendant queries
- Natural ordering (path_ordinals)
- Breadcrumb generation

## Testing

### Unit Tests
```bash
npm test tests/sectionStorage.test.js
```

### Integration Tests
```javascript
// Create test database
// Run full workflow: parse -> store -> validate
// Verify hierarchy integrity
```

## Migration Notes

### From Old Schema
The old schema used:
- `bylaw_sections` table
- Flat structure with `article_number` and `section_number`
- No explicit hierarchy

New schema provides:
- `document_sections` table
- Full hierarchy with parent_section_id
- Materialized paths for performance
- Multi-level nesting support

### Data Migration
```javascript
// Old format
{
  section_citation: "Article I, Section 1",
  original_text: "Content",
  article_number: 1,
  section_number: 1
}

// New format
{
  section_number: "Section 1",
  section_title: "Organization",
  parent_section_id: article_uuid,
  depth: 1,
  ordinal: 1,
  path_ids: [article_uuid, section_uuid],
  path_ordinals: [1, 1],
  original_text: "Content"
}
```

## Future Enhancements

1. **Parallel Processing**: Use worker threads for large documents
2. **Incremental Updates**: Support updating hierarchy without full rebuild
3. **Conflict Resolution**: Handle merge conflicts in distributed edits
4. **Version Control**: Track hierarchy changes over time
5. **Diff Generation**: Compare hierarchies between versions

## Support

For issues or questions:
- Check validation output for specific error messages
- Review database logs for trigger execution
- Verify section depth values are sequential (0, 1, 2, not 0, 2, 3)
- Ensure parent sections exist before children

---

**Last Updated**: 2025-10-09
**Version**: 1.0.0
**Author**: Coder Agent
