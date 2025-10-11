# Section Storage Quick Reference

## TL;DR

**What**: Service to store parsed document sections with full hierarchy to database

**Where**: `/src/services/sectionStorage.js`

**Integration**: Automatically called from setup wizard after document parsing

---

## Quick Usage

```javascript
const sectionStorage = require('./sectionStorage');

// Store sections after parsing
const result = await sectionStorage.storeSections(
  organizationId,  // UUID
  documentId,      // UUID
  parsedSections,  // Array from parser
  supabaseClient   // Supabase instance
);

// Check result
console.log(`Stored ${result.sectionsStored} sections`);
console.log(result.success ? '✅ Success' : '❌ Failed');
```

---

## Key Methods

### `storeSections(orgId, docId, sections, supabase)`
**Purpose**: Store all sections with hierarchy
**Returns**: `{ success, sectionsStored, sections, message }`

### `buildHierarchy(sections)`
**Purpose**: Calculate parent-child relationships
**Returns**: Sections with `parent_id` and `ordinal` set

### `validateStoredSections(docId, supabase)`
**Purpose**: Verify hierarchy integrity
**Returns**: `{ success, totalSections, issues, message }`

---

## Input Format

Sections from parser should have:
```javascript
{
  type: 'article',        // Required
  number: 'I',           // Required
  title: 'Organization', // Required
  text: 'Content...',    // Required
  depth: 0,              // Required (0=root, 1=child, etc.)
  prefix: 'Article ',    // Optional
  citation: 'Article I'  // Optional
}
```

---

## Output (Database)

Stored in `document_sections` table:
```sql
id                    | UUID (auto)
document_id           | From parameter
parent_section_id     | Calculated from hierarchy
ordinal               | Position among siblings (1, 2, 3...)
depth                 | From input (0, 1, 2...)
path_ids              | Auto by trigger [ancestor_uuids]
path_ordinals         | Auto by trigger [1, 2, 1]
section_number        | Formatted display number
section_title         | From input
section_type          | From input
original_text         | From input
current_text          | From input
metadata              | Legacy fields
```

---

## Hierarchy Example

**Input**:
```javascript
[
  { depth: 0, number: 'I' },    // Article I
  { depth: 1, number: '1' },    // Section 1
  { depth: 1, number: '2' },    // Section 2
  { depth: 0, number: 'II' }    // Article II
]
```

**Result**:
```
Article I (ordinal: 1, parent: null)
  └─ Section 1 (ordinal: 1, parent: Article I)
  └─ Section 2 (ordinal: 2, parent: Article I)
Article II (ordinal: 2, parent: null)
```

---

## Error Handling

**Common Errors**:

1. **Missing depth**: Sections must have depth property
   - Fix: Ensure parser sets `depth: 0, 1, 2...`

2. **Invalid parent**: Child without parent at previous depth
   - Fix: Check depth values are sequential (0→1→2, not 0→2)

3. **Trigger not fired**: path_ids/path_ordinals not set
   - Fix: Verify database trigger exists and is enabled

---

## Validation Checks

Automatic validation checks for:
- ✅ `path_ids` length = depth + 1
- ✅ `path_ordinals` length = depth + 1
- ✅ Last `path_ids` element is self UUID
- ✅ Non-root sections have `parent_section_id`

---

## Performance

**Batch Size**: 50 sections per insert (configurable)

**Speed**:
- Small doc (<100 sections): ~1 second
- Medium doc (<500 sections): ~3 seconds
- Large doc (>1000 sections): ~10 seconds

**Indexes Required**:
```sql
CREATE INDEX idx_doc_sections_path ON document_sections USING GIN(path_ids);
CREATE INDEX idx_doc_sections_parent ON document_sections(parent_section_id);
```

---

## Testing

**Unit Tests**:
```bash
npm test tests/sectionStorage.test.js
```

**Manual Test**:
```javascript
const testSections = [
  { depth: 0, number: 'I', title: 'Test', text: 'Content' }
];

const result = await sectionStorage.storeSections(
  'org-uuid', 'doc-uuid', testSections, supabase
);

console.assert(result.success);
console.assert(result.sectionsStored === 1);
```

---

## Common Queries

**Get all sections in order**:
```sql
SELECT * FROM document_sections
WHERE document_id = $1
ORDER BY path_ordinals;
```

**Get children of section**:
```sql
SELECT * FROM document_sections
WHERE parent_section_id = $1
ORDER BY ordinal;
```

**Get section breadcrumb**:
```sql
SELECT * FROM get_section_breadcrumb($1);
```

---

## Files

- **Service**: `/src/services/sectionStorage.js` (344 lines)
- **Tests**: `/tests/sectionStorage.test.js` (181 lines)
- **Docs**: `/docs/SECTION_STORAGE.md` (340 lines)
- **Integration**: `/src/services/setupService.js` (modified)

---

## Quick Debugging

**Problem**: Sections not storing
```javascript
// Check result object
console.log('Success?', result.success);
console.log('Error:', result.error);
console.log('Stack:', result.stack);
```

**Problem**: Wrong hierarchy
```javascript
// Validate after storage
const validation = await sectionStorage.validateStoredSections(docId, supabase);
console.log('Issues:', validation.issues);
```

**Problem**: Missing paths
```sql
-- Check trigger exists
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'trg_update_section_path';

-- Manually check paths
SELECT id, depth, array_length(path_ids, 1) as path_length
FROM document_sections
WHERE document_id = 'your-doc-uuid';
```

---

## Support

- **Full Docs**: `/docs/SECTION_STORAGE.md`
- **Implementation**: `/docs/SECTION_STORAGE_IMPLEMENTATION.md`
- **Tests**: `/tests/sectionStorage.test.js`
- **Schema**: `/database/migrations/001_generalized_schema.sql`

---

**Last Updated**: 2025-10-09
**Version**: 1.0.0
