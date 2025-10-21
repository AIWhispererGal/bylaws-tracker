# Workflow Progression Quick Reference

**Related:** [ADR-002-DOCUMENT-WORKFLOW-PROGRESSION.md](./ADR-002-DOCUMENT-WORKFLOW-PROGRESSION.md)

---

## Overview

This document provides a quick reference for implementing and using the document workflow progression feature.

---

## Key Concepts

### What is Document Progression?

**Current System:** Tracks approval at **section level**
```
Section 1: Draft → Committee Review → Board Approval ✓
Section 2: Draft → Committee Review → Board Approval ✓
Section 3: Draft → Committee Review ⏳
```

**New Feature:** Progress **entire document** to next stage
```
Document v1.0 → Apply Approved Changes → Document v1.1 → Next Workflow Stage
```

### Version Snapshot

A complete "photograph" of the document at a point in time, stored in `document_versions` table:

- **sections_snapshot**: All section content (JSONB array)
- **approval_snapshot**: All workflow states (JSONB array)
- **applied_suggestions**: Which suggestions were implemented (JSONB array)
- **version_number**: Incrementing version like "1.1", "1.2"
- **is_current**: Only one version marked as current per document

---

## API Quick Reference

### 1. Create New Version & Progress Workflow

**Endpoint:** `POST /api/documents/:id/progress`

**Use Cases:**
- Apply approved suggestions to create updated document
- Move document to next workflow stage
- Create milestone snapshot

**Request:**
```json
{
  "applySuggestions": "approved",
  "versionName": "Q4 2025 Amendments",
  "description": "Board-approved changes",
  "moveToNextStage": true,
  "targetStage": "board_approval"
}
```

**Response:**
```json
{
  "success": true,
  "version": {
    "id": "uuid",
    "versionNumber": "1.2",
    "isCurrent": true
  },
  "document": {
    "id": "uuid",
    "version": "1.2",
    "status": "in_review"
  }
}
```

**Permission Required:** Admin or Owner role

---

### 2. Preview Version Before Creating

**Endpoint:** `GET /api/documents/:id/versions/preview?applySuggestions=approved`

**Use Cases:**
- See what will change before creating version
- Count how many sections will be modified
- Review which suggestions will be applied

**Query Parameters:**
- `applySuggestions`: "approved" | "all" | "selected"
- `selectedSuggestionIds`: "uuid1,uuid2,uuid3" (if applySuggestions="selected")

**Response:**
```json
{
  "success": true,
  "preview": {
    "sectionsTotal": 42,
    "sectionsModified": 8,
    "suggestionsToApply": [
      {
        "id": "uuid",
        "sectionId": "uuid",
        "sectionNumber": "Article I, Section 2",
        "suggestedText": "Updated text..."
      }
    ],
    "estimatedSize": "1.2 MB"
  }
}
```

---

### 3. List All Versions

**Endpoint:** `GET /api/documents/:id/versions?limit=20&offset=0`

**Query Parameters:**
- `limit`: Max versions to return (default: 20, max: 100)
- `offset`: Pagination offset (default: 0)
- `includeSnapshots`: Include full JSONB snapshots (default: false)

**Response:**
```json
{
  "success": true,
  "versions": [
    {
      "id": "uuid",
      "versionNumber": "2.0",
      "versionName": "2025 Annual Review",
      "isCurrent": true,
      "isPublished": true,
      "publishedAt": "2025-10-15T14:00:00Z",
      "workflowStage": "Published",
      "appliedSuggestionsCount": 15,
      "createdBy": { "id": "uuid", "email": "admin@org.com" },
      "createdAt": "2025-10-15T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### 4. Restore Previous Version

**Endpoint:** `POST /api/documents/:id/versions/:versionId/restore`

**Use Cases:**
- Undo problematic changes
- Revert to known-good version
- Create new version based on old content

**Request:**
```json
{
  "createNewVersion": true,
  "reason": "Reverting accidental changes"
}
```

**Response:**
```json
{
  "success": true,
  "restoredVersion": "1.1",
  "newVersionNumber": "1.4",
  "message": "Version 1.1 restored as 1.4"
}
```

---

## Database Schema Quick Reference

### Enhanced Tables

#### `document_versions` (existing, enhanced)

**New Columns:**
```sql
applied_suggestions JSONB DEFAULT '[]'::jsonb
-- Format: [{"id": "uuid", "section_id": "uuid", "action": "applied"}]

workflow_stage VARCHAR(100)
-- e.g., "Committee Review", "Board Approval", "Published"

workflow_template_id UUID REFERENCES workflow_templates(id)
-- Which workflow was active when version created
```

**New Indexes:**
```sql
idx_document_versions_workflow_stage (document_id, workflow_stage)
idx_document_versions_current (document_id) WHERE is_current = TRUE
idx_document_versions_published (document_id, published_at DESC) WHERE is_published = TRUE
```

#### `suggestions` (existing, enhanced)

**New Columns:**
```sql
implemented_in_version UUID REFERENCES document_versions(id)
-- Which version applied this suggestion

implemented_at TIMESTAMP
-- When suggestion was implemented
```

---

### Key Functions

#### `create_document_version()`

**Purpose:** Atomically create new version with snapshots

**Usage:**
```sql
SELECT * FROM create_document_version(
  p_document_id := 'doc-uuid',
  p_version_name := 'Q4 2025 Update',
  p_description := 'Applied board amendments',
  p_sections_snapshot := '[{...}, {...}]'::jsonb,
  p_approval_snapshot := '[{...}]'::jsonb,
  p_applied_suggestions := '[{"id": "uuid"}]'::jsonb,
  p_workflow_stage := 'Board Approval',
  p_workflow_template_id := 'template-uuid',
  p_created_by := 'user-uuid',
  p_created_by_email := 'admin@org.com'
);
```

**Returns:**
```
version_id    | version_number | is_current
--------------+----------------+-----------
uuid          | 1.2            | true
```

#### `increment_version()`

**Purpose:** Smart version number incrementing

**Usage:**
```sql
SELECT increment_version('1.5');  -- Returns: '1.6'
SELECT increment_version('2.0');  -- Returns: '2.1'
SELECT increment_version('');     -- Returns: '1.1'
```

---

## Permission Matrix

| Action | Viewer | Member | Admin | Owner | Global Admin |
|--------|--------|--------|-------|-------|--------------|
| View versions | ✓ | ✓ | ✓ | ✓ | ✓ |
| Preview version | ✗ | ✓ | ✓ | ✓ | ✓ |
| Create version | ✗ | ✗ | ✓ | ✓ | ✓ |
| Restore version | ✗ | ✗ | ✓ | ✓ | ✓ |
| Publish version | ✗ | ✗ | ✗ | ✓ | ✓ |
| Delete version | ✗ | ✗ | ✗ | ✓ | ✓ |

**RLS Enforcement:**
- All operations filtered by `organization_id`
- Global admins bypass organization check
- Service role used for atomic operations (SECURITY DEFINER functions)

---

## Workflow Progression Strategies

### Strategy 1: Apply Approved Suggestions

**When to Use:** After committee review, apply only formally approved changes

```javascript
{
  "applySuggestions": "approved",  // Only suggestions with status='approved'
  "moveToNextStage": true,
  "targetStage": "board_approval"
}
```

**Result:**
- Creates v1.1 with approved changes
- Moves document to Board Approval stage
- Marks suggestions as "implemented"

---

### Strategy 2: Apply Selected Suggestions

**When to Use:** Cherry-pick specific suggestions, not all approved ones

```javascript
{
  "applySuggestions": "selected",
  "selectedSuggestionIds": ["uuid1", "uuid2", "uuid5"],
  "versionName": "Partial Implementation"
}
```

**Result:**
- Only applies chosen suggestions
- Other approved suggestions remain for future versions
- Good for incremental changes

---

### Strategy 3: Create Snapshot Without Changes

**When to Use:** Milestone marker, no content changes

```javascript
{
  "applySuggestions": "none",
  "versionName": "Pre-Review Snapshot",
  "description": "Snapshot before board review"
}
```

**Result:**
- Creates version with current content (no changes)
- Useful for audit trail
- Can revert to this point later

---

### Strategy 4: Apply All Suggestions (Risky)

**When to Use:** Bulk apply all suggestions (approved + pending)

```javascript
{
  "applySuggestions": "all",  // ⚠️ Includes pending suggestions!
  "versionName": "Mass Update"
}
```

**Result:**
- Applies both approved AND pending suggestions
- Use with caution (may include unreviewed changes)
- Good for drafts or experimental versions

---

## Common Workflows

### Workflow A: Standard Progression

```
1. Committee reviews document
   → Suggests changes
   → Approves suggestions

2. Admin creates version v1.1
   POST /api/documents/:id/progress
   {
     "applySuggestions": "approved",
     "moveToNextStage": true,
     "targetStage": "board_approval"
   }

3. Board reviews v1.1
   → Approves all sections

4. Owner publishes v1.1
   POST /api/documents/:id/progress
   {
     "applySuggestions": "none",
     "moveToNextStage": true,
     "targetStage": "published"
   }
```

---

### Workflow B: Incremental Updates

```
1. Multiple suggestions accumulate over time

2. Admin creates monthly snapshot
   POST /api/documents/:id/progress
   {
     "applySuggestions": "approved",
     "versionName": "October 2025 Updates"
   }

3. Repeat monthly
   v1.1 (Oct) → v1.2 (Nov) → v1.3 (Dec) → v2.0 (Year-end)
```

---

### Workflow C: Emergency Rollback

```
1. Version v1.5 has problems
   → Need to revert to v1.4

2. Admin restores v1.4
   POST /api/documents/:id/versions/v1.4-uuid/restore
   {
     "createNewVersion": true,
     "reason": "Critical error in v1.5"
   }

3. Creates new version v1.6 (identical to v1.4)
   → Preserves audit trail
   → v1.5 remains in history but not current
```

---

## Testing Checklist

### Unit Tests

- [ ] `DocumentVersionService.createVersion()` creates version
- [ ] `DocumentVersionService.getSuggestionsToApply()` filters correctly
- [ ] `DocumentVersionService.buildSectionSnapshot()` applies suggestions
- [ ] `increment_version()` function handles edge cases
- [ ] Permission validation rejects unauthorized users

### Integration Tests

- [ ] POST /api/documents/:id/progress creates version in database
- [ ] Version marked as `is_current = TRUE`
- [ ] Previous versions marked as `is_current = FALSE`
- [ ] Document.version field updated
- [ ] Suggestions marked as "implemented"
- [ ] Activity log entry created
- [ ] RLS prevents cross-org access

### E2E Tests

- [ ] Admin can create version with approved suggestions
- [ ] Owner can publish version
- [ ] Member cannot create version (403 Forbidden)
- [ ] Preview shows correct suggestions before applying
- [ ] Restore creates new version from old snapshot
- [ ] Workflow stage progression updates section states

---

## Performance Considerations

### Snapshot Size Limits

**Problem:** Large documents create large snapshots

**Mitigation:**
```javascript
// Limit snapshot size to 10MB
const snapshotSize = JSON.stringify(snapshot).length;
if (snapshotSize > 10 * 1024 * 1024) {
  throw new Error('Snapshot too large. Document has too many sections.');
}
```

**Recommendation:**
- Keep documents under 100 sections
- Archive old documents
- Split very large documents into multiple documents

---

### Query Optimization

**Slow Query (N+1):**
```javascript
// ❌ BAD: 1 query + N queries per section
const sections = await getSections(documentId);
for (const section of sections) {
  const suggestions = await getSuggestions(section.id); // N queries!
}
```

**Fast Query (JOIN):**
```javascript
// ✅ GOOD: 1 query total
const sections = await supabase
  .from('document_sections')
  .select(`
    *,
    suggestions:suggestion_sections (
      suggestions (*)
    )
  `)
  .eq('document_id', documentId);
```

---

### Use `document_version_summary` View

**For Lists (Fast):**
```sql
-- Use view (excludes heavy JSONB snapshots)
SELECT * FROM document_version_summary
WHERE document_id = 'uuid'
ORDER BY created_at DESC
LIMIT 20;
```

**For Details (Slower):**
```sql
-- Use table (includes snapshots)
SELECT * FROM document_versions
WHERE id = 'version-uuid';
```

---

## Troubleshooting

### Issue: "Snapshot too large" error

**Cause:** Document has too many sections (1000+)

**Solutions:**
1. Split document into multiple documents
2. Implement compression (gzip)
3. Increase size limit (not recommended)

---

### Issue: Version number not incrementing

**Cause:** `increment_version()` function failing

**Debug:**
```sql
SELECT increment_version('1.5');  -- Should return '1.6'
SELECT increment_version('');     -- Should return '1.1'
SELECT increment_version('abc');  -- Should return '1.1' (fallback)
```

**Fix:** Check function exists:
```sql
SELECT * FROM pg_proc WHERE proname = 'increment_version';
```

---

### Issue: RLS blocking version creation

**Cause:** User not in admin/owner role

**Debug:**
```sql
-- Check user's role
SELECT role FROM user_organizations
WHERE user_id = 'user-uuid'
  AND organization_id = 'org-uuid';

-- Should be 'admin' or 'owner'
```

**Fix:** Ensure user has correct role:
```sql
UPDATE user_organizations
SET role = 'admin'
WHERE user_id = 'user-uuid'
  AND organization_id = 'org-uuid';
```

---

### Issue: Multiple versions marked as current

**Cause:** Race condition or failed transaction

**Debug:**
```sql
-- Check for multiple current versions
SELECT document_id, COUNT(*)
FROM document_versions
WHERE is_current = TRUE
GROUP BY document_id
HAVING COUNT(*) > 1;
```

**Fix:**
```sql
-- Mark only latest version as current
WITH latest AS (
  SELECT DISTINCT ON (document_id) id, document_id
  FROM document_versions
  ORDER BY document_id, created_at DESC
)
UPDATE document_versions
SET is_current = (id IN (SELECT id FROM latest));
```

---

## Migration Guide

### Applying Migration 021

```bash
# 1. Backup database
pg_dump -h localhost -U postgres -d bylaws_db > backup_pre_migration_021.sql

# 2. Apply migration
psql -h localhost -U postgres -d bylaws_db -f database/migrations/021_document_workflow_progression.sql

# 3. Verify migration
psql -h localhost -U postgres -d bylaws_db -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'document_versions'
  AND column_name IN ('applied_suggestions', 'workflow_stage', 'workflow_template_id');
"

# Should show 3 rows
```

### Rolling Back Migration 021

```bash
# Run rollback commands (from migration file comments)
psql -h localhost -U postgres -d bylaws_db <<EOF
-- Drop view
DROP VIEW IF EXISTS document_version_summary;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_document_versions_timestamp ON document_versions;
DROP FUNCTION IF EXISTS update_document_versions_timestamp();

-- Drop RLS policies
DROP POLICY IF EXISTS "Users see org document versions" ON document_versions;
DROP POLICY IF EXISTS "Admins create document versions" ON document_versions;
DROP POLICY IF EXISTS "Admins update document versions" ON document_versions;

-- Drop functions
DROP FUNCTION IF EXISTS create_document_version(...);
DROP FUNCTION IF EXISTS increment_version(VARCHAR);

-- Drop indexes
DROP INDEX IF EXISTS idx_suggestions_status_implemented;
DROP INDEX IF EXISTS idx_suggestions_implemented;
DROP INDEX IF EXISTS idx_document_versions_created;
DROP INDEX IF EXISTS idx_document_versions_published;
DROP INDEX IF EXISTS idx_document_versions_current;
DROP INDEX IF EXISTS idx_document_versions_workflow_stage;

-- Drop columns
ALTER TABLE suggestions DROP COLUMN IF EXISTS implemented_at;
ALTER TABLE suggestions DROP COLUMN IF EXISTS implemented_in_version;
ALTER TABLE document_versions DROP COLUMN IF EXISTS workflow_template_id;
ALTER TABLE document_versions DROP COLUMN IF EXISTS workflow_stage;
ALTER TABLE document_versions DROP COLUMN IF EXISTS applied_suggestions;
EOF
```

---

## Next Steps

1. **Review:** Read [ADR-002-DOCUMENT-WORKFLOW-PROGRESSION.md](./ADR-002-DOCUMENT-WORKFLOW-PROGRESSION.md) for full design
2. **Implement:** Create `/src/services/documentVersionService.js`
3. **Test:** Run integration tests
4. **Deploy:** Apply migration 021 to production
5. **Train:** Educate admins on new feature

---

**Last Updated:** 2025-10-19
**Related Documents:**
- [ADR-002-DOCUMENT-WORKFLOW-PROGRESSION.md](./ADR-002-DOCUMENT-WORKFLOW-PROGRESSION.md) - Full architecture
- [WORKFLOW_SYSTEM_ARCHITECTURE.md](../WORKFLOW_SYSTEM_ARCHITECTURE.md) - Overall workflow system
