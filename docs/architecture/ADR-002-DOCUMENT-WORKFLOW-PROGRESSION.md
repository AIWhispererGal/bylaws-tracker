# ADR-002: Document Workflow Progression Architecture

**Status:** Proposed
**Date:** 2025-10-19
**Decision Makers:** System Architecture Team
**Related:** [ADR-001-RLS-SECURITY-MODEL.md](../ADR-001-RLS-SECURITY-MODEL.md), [WORKFLOW_SYSTEM_ARCHITECTURE.md](../WORKFLOW_SYSTEM_ARCHITECTURE.md)

---

## Context and Problem Statement

The current workflow system tracks approval status at the **section level** as documents progress through workflow stages (Draft → Review → Approval → Published). However, there is no mechanism to:

1. **Create new document versions** based on approved changes
2. **Apply approved suggestions** to create updated document text
3. **Progress entire documents** through workflow stages
4. **Preserve history** of document evolution

**User Requirement:**
> "We need a way to progress to next step of workflow for the whole document. My thought was we could just create a New document based of the changes to old."

### Current System State

**Existing Tables:**
- `documents` - Base document records (title, version, status)
- `document_sections` - Hierarchical section structure
- `section_workflow_states` - Section-level approval tracking
- `document_versions` - Snapshot storage (already exists)
- `suggestions` - User-submitted change proposals

**Workflow Progression:**
```
Section Level (Current):
Section 1 → Draft → Committee Review → Board Approval → Published
Section 2 → Draft → Committee Review → Board Approval → Published
...

Document Level (Needed):
Document → Apply All Approved Changes → New Version → Next Stage
```

---

## Decision Drivers

### Technical Requirements

1. **Preserve History**: Must maintain complete audit trail of all document versions
2. **Atomic Operations**: Version creation must be transactional (all-or-nothing)
3. **Performance**: Handle large documents (100+ sections) efficiently
4. **Scalability**: Support multiple simultaneous version creations
5. **Data Integrity**: Prevent conflicts and ensure consistency

### Business Requirements

1. **Flexibility**: Support different progression strategies (apply all vs. selective suggestions)
2. **Auditability**: Track who created versions, when, and why
3. **Rollback**: Ability to revert to previous versions if needed
4. **Permissions**: Control who can create versions and progress workflows
5. **Multi-tenancy**: Complete organization isolation via RLS

### UX Requirements

1. **Clarity**: Users understand what will happen when they "progress workflow"
2. **Preview**: Show what the new version will look like before creating it
3. **Selective Control**: Choose which suggestions to apply (not all-or-nothing)
4. **Status Visibility**: Clear indication of document version and workflow stage

---

## Considered Options

### Option A: Snapshot-Based Versioning (Recommended)

**Approach**: Store complete document snapshots in `document_versions` table. Original `documents` record remains as "master" with current version pointer.

**Data Model:**
```sql
documents (existing):
  - id (UUID, primary key)
  - version (VARCHAR, current version number like "1.2")
  - status (VARCHAR, current workflow status)
  - (other existing fields unchanged)

document_versions (enhanced):
  - id (UUID, primary key)
  - document_id (UUID, references documents)
  - version_number (VARCHAR, e.g., "1.0", "1.1", "2.0")
  - version_name (VARCHAR, user-friendly name)
  - description (TEXT, what changed)

  -- Snapshots
  - sections_snapshot (JSONB, complete section tree)
  - approval_snapshot (JSONB, workflow states)
  - applied_suggestions (JSONB[], which suggestions were included)

  -- Workflow
  - workflow_stage (VARCHAR, stage when created)
  - workflow_template_id (UUID, which workflow)

  -- Audit
  - created_by (UUID)
  - created_by_email (VARCHAR)
  - created_at (TIMESTAMP)

  -- Status
  - is_current (BOOLEAN, only one TRUE per document)
  - is_published (BOOLEAN)
  - published_at (TIMESTAMP)
```

**Progression Algorithm:**
```javascript
async function progressDocument(documentId, options) {
  // 1. VALIDATE
  const canProgress = await validateProgression(documentId, userId);
  if (!canProgress) throw new WorkflowError('Cannot progress');

  // 2. GATHER APPROVED SUGGESTIONS
  const suggestions = await getApprovedSuggestions(documentId, {
    strategy: options.applySuggestions, // 'approved' | 'all' | 'selected'
    selectedIds: options.selectedSuggestionIds
  });

  // 3. BUILD NEW SECTION TREE
  const currentSections = await getAllSections(documentId);
  const newSections = applySuggestionsToSections(currentSections, suggestions);

  // 4. CREATE VERSION SNAPSHOT (transactional)
  await supabase.rpc('create_document_version', {
    p_document_id: documentId,
    p_sections_snapshot: newSections,
    p_applied_suggestions: suggestions.map(s => s.id),
    p_version_name: options.versionName,
    p_description: options.description,
    p_created_by: userId
  });

  // 5. UPDATE DOCUMENT RECORD
  await updateDocumentVersion(documentId, newVersionNumber);

  // 6. PROGRESS WORKFLOW STAGE (if requested)
  if (options.moveToNextStage) {
    await progressWorkflowStage(documentId, options.targetStage);
  }

  // 7. LOG ACTIVITY
  await logActivity(userId, 'document.version_created', documentId);

  return { versionNumber: newVersionNumber, appliedCount: suggestions.length };
}
```

**Pros:**
- ✅ Preserves complete history (snapshots immutable)
- ✅ Fast reads (entire version in single JSON blob)
- ✅ Simple rollback (just change `is_current` flag)
- ✅ No complex version tree navigation
- ✅ Works with existing `document_versions` table

**Cons:**
- ⚠️ Large JSON snapshots (can be 1MB+ for big documents)
- ⚠️ Data duplication (each version stores full content)
- ⚠️ No easy diff between versions (need to compute client-side)

---

### Option B: New Document Records

**Approach**: Create new `documents` row for each version. Link via `parent_document_id` chain.

**Data Model:**
```sql
documents (modified):
  - id (UUID)
  - parent_document_id (UUID, self-reference)
  - original_document_id (UUID, points to first version)
  - version_number (VARCHAR)
  - workflow_stage (VARCHAR)
  - is_current (BOOLEAN)
```

**Version Chain:**
```
Document v1.0 (id: abc)
    ↓ parent_document_id
Document v1.1 (id: def)
    ↓ parent_document_id
Document v2.0 (id: ghi)
```

**Pros:**
- ✅ Each version is a real document (familiar structure)
- ✅ Easy to query specific versions
- ✅ Sections have normal foreign keys

**Cons:**
- ❌ Version tree traversal is complex
- ❌ Many duplicate document rows (clutter)
- ❌ Harder to find "current" version (must traverse chain)
- ❌ RLS policies get complicated (which version can user see?)
- ❌ Breaks assumption that `documents.id` is stable

---

### Option C: Hybrid Approach

**Approach**: Keep one `documents` record + `document_versions` snapshots + **optional** section-level deltas.

**Data Model:**
```sql
document_versions:
  -- Snapshots (like Option A)
  - sections_snapshot (JSONB, full snapshot)
  - approval_snapshot (JSONB)

  -- Deltas (optimization)
  - sections_changed (UUID[], which sections modified)
  - delta_from_version (UUID, previous version to diff against)
```

**Pros:**
- ✅ Best of both worlds (snapshots + deltas)
- ✅ Can compute diffs efficiently
- ✅ Optimized storage (store deltas for recent versions)

**Cons:**
- ⚠️ Complex implementation
- ⚠️ Requires delta computation logic
- ⚠️ Still stores full snapshots (fallback)

---

## Decision Outcome

**Chosen Option: A - Snapshot-Based Versioning** (with minor enhancements)

### Rationale

1. **Simplicity**: Leverages existing `document_versions` table with minimal changes
2. **Reliability**: Snapshots are immutable and complete (no dependency chains)
3. **Performance**: Single query to retrieve full version
4. **Rollback**: Trivial to revert (just toggle `is_current` flag)
5. **Compatibility**: Works seamlessly with current RLS policies

### Enhancements to Existing Schema

```sql
-- Migration 021: Document Workflow Progression
-- Enhance document_versions table for workflow progression

ALTER TABLE document_versions
ADD COLUMN IF NOT EXISTS applied_suggestions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(100),
ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES workflow_templates(id);

-- Index for finding versions by workflow stage
CREATE INDEX idx_document_versions_workflow_stage
  ON document_versions(document_id, workflow_stage);

-- Index for current version lookup
CREATE INDEX idx_document_versions_current
  ON document_versions(document_id)
  WHERE is_current = TRUE;

COMMENT ON COLUMN document_versions.applied_suggestions IS
  'Array of suggestion IDs that were applied in this version.
   Format: [{"id": "uuid", "section_id": "uuid", "action": "applied"}]';

COMMENT ON COLUMN document_versions.workflow_stage IS
  'Workflow stage when this version was created (e.g., "Committee Review", "Board Approval")';
```

---

## Implementation Design

### API Specification

#### POST `/api/documents/:id/progress`

**Purpose**: Create new document version by applying approved suggestions and optionally progress workflow stage.

**Request:**
```json
{
  "applySuggestions": "approved" | "all" | "selected",
  "selectedSuggestionIds": ["uuid1", "uuid2"], // if applySuggestions="selected"
  "versionName": "Q4 2025 Update",
  "description": "Applied board-approved amendments",
  "moveToNextStage": true,
  "targetStage": "board_approval" // if moveToNextStage=true
}
```

**Response (Success):**
```json
{
  "success": true,
  "version": {
    "id": "version-uuid",
    "versionNumber": "1.2",
    "appliedSuggestions": 12,
    "sectionsModified": 8,
    "workflowStage": "Board Approval",
    "createdAt": "2025-10-19T10:30:00Z"
  },
  "document": {
    "id": "doc-uuid",
    "currentVersion": "1.2",
    "status": "in_review"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Insufficient permissions to progress workflow",
  "code": "WORKFLOW_PERMISSION_DENIED",
  "details": {
    "requiredRole": "admin",
    "userRole": "member"
  }
}
```

**Validation Rules:**
```javascript
const progressDocumentSchema = Joi.object({
  applySuggestions: Joi.string()
    .valid('approved', 'all', 'selected', 'none')
    .default('approved'),

  selectedSuggestionIds: Joi.array()
    .items(Joi.string().uuid())
    .when('applySuggestions', {
      is: 'selected',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),

  versionName: Joi.string().max(255).optional(),
  description: Joi.string().max(5000).optional(),

  moveToNextStage: Joi.boolean().default(false),
  targetStage: Joi.string()
    .when('moveToNextStage', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
});
```

**Permissions:**
```javascript
// Who can create versions?
requireRole(['admin', 'owner'])

// Additional check: Can user progress to target stage?
if (moveToNextStage) {
  const canApprove = await canApproveStage(userId, targetStageId);
  if (!canApprove) throw new WorkflowError('Cannot approve at target stage');
}
```

---

#### GET `/api/documents/:id/versions`

**Purpose**: List all versions of a document with metadata.

**Query Parameters:**
- `limit` (default: 20, max: 100)
- `offset` (default: 0)
- `includeSnapshots` (default: false) - Include full section snapshots

**Response:**
```json
{
  "success": true,
  "versions": [
    {
      "id": "version-uuid",
      "versionNumber": "2.0",
      "versionName": "2025 Annual Review",
      "description": "Major amendments approved by board",
      "isCurrent": true,
      "isPublished": true,
      "publishedAt": "2025-10-15T14:00:00Z",
      "workflowStage": "Published",
      "appliedSuggestions": 15,
      "createdBy": {
        "id": "user-uuid",
        "email": "admin@org.com"
      },
      "createdAt": "2025-10-15T14:00:00Z"
    },
    // ... more versions
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

#### GET `/api/documents/:id/versions/:versionId/preview`

**Purpose**: Preview what a version will look like before creating it.

**Query Parameters:**
- `applySuggestions` (approved | all | selected)
- `selectedSuggestionIds` (comma-separated UUIDs)

**Response:**
```json
{
  "success": true,
  "preview": {
    "versionNumber": "1.3",
    "sectionsTotal": 42,
    "sectionsModified": 8,
    "suggestionsToApply": [
      {
        "id": "suggestion-uuid",
        "sectionId": "section-uuid",
        "sectionNumber": "Article I, Section 2",
        "currentText": "Original text...",
        "proposedText": "Suggested text...",
        "changeType": "modification"
      }
    ],
    "estimatedSize": "1.2 MB"
  }
}
```

---

#### POST `/api/documents/:id/versions/:versionId/restore`

**Purpose**: Restore a previous version as current.

**Request:**
```json
{
  "createNewVersion": true, // Create new version from restored content
  "reason": "Reverting problematic changes"
}
```

**Response:**
```json
{
  "success": true,
  "restoredVersion": "1.1",
  "newVersionNumber": "1.4", // if createNewVersion=true
  "message": "Version 1.1 restored successfully"
}
```

---

### Database Functions

#### `create_document_version()`

**Purpose**: Atomically create a new document version with snapshots.

```sql
CREATE OR REPLACE FUNCTION create_document_version(
  p_document_id UUID,
  p_version_name VARCHAR,
  p_description TEXT,
  p_sections_snapshot JSONB,
  p_approval_snapshot JSONB,
  p_applied_suggestions JSONB,
  p_workflow_stage VARCHAR,
  p_workflow_template_id UUID,
  p_created_by UUID,
  p_created_by_email VARCHAR
)
RETURNS TABLE(
  version_id UUID,
  version_number VARCHAR,
  is_current BOOLEAN
) AS $$
DECLARE
  v_version_number VARCHAR;
  v_version_id UUID;
  v_current_version VARCHAR;
BEGIN
  -- Get current version number
  SELECT version INTO v_current_version
  FROM documents
  WHERE id = p_document_id;

  -- Generate new version number (increment minor version)
  v_version_number := increment_version(v_current_version);

  -- Mark all previous versions as not current
  UPDATE document_versions
  SET is_current = FALSE
  WHERE document_id = p_document_id;

  -- Insert new version
  INSERT INTO document_versions (
    document_id,
    version_number,
    version_name,
    description,
    sections_snapshot,
    approval_snapshot,
    applied_suggestions,
    workflow_stage,
    workflow_template_id,
    created_by,
    created_by_email,
    is_current
  ) VALUES (
    p_document_id,
    v_version_number,
    p_version_name,
    p_description,
    p_sections_snapshot,
    p_approval_snapshot,
    p_applied_suggestions,
    p_workflow_stage,
    p_workflow_template_id,
    p_created_by,
    p_created_by_email,
    TRUE
  ) RETURNING id INTO v_version_id;

  -- Update document's current version
  UPDATE documents
  SET
    version = v_version_number,
    updated_at = NOW()
  WHERE id = p_document_id;

  -- Return version info
  RETURN QUERY
  SELECT v_version_id, v_version_number, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### `increment_version()`

**Purpose**: Smart version number incrementing.

```sql
CREATE OR REPLACE FUNCTION increment_version(current_version VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  major_ver INTEGER;
  minor_ver INTEGER;
BEGIN
  -- Parse "1.2" -> major=1, minor=2
  major_ver := split_part(current_version, '.', 1)::INTEGER;
  minor_ver := split_part(current_version, '.', 2)::INTEGER;

  -- Increment minor version
  minor_ver := minor_ver + 1;

  RETURN major_ver || '.' || minor_ver;
EXCEPTION
  WHEN OTHERS THEN
    -- Default to incrementing from 1.0
    RETURN '1.1';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### `apply_suggestions_to_sections()`

**Purpose**: Apply approved suggestions to section content.

```sql
CREATE OR REPLACE FUNCTION apply_suggestions_to_sections(
  p_document_id UUID,
  p_suggestion_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  v_sections JSONB;
  v_suggestion RECORD;
  v_section_id UUID;
BEGIN
  -- Get all document sections as JSONB
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'section_number', section_number,
      'section_title', section_title,
      'content', content,
      'path_ordinals', path_ordinals
    ) ORDER BY path_ordinals
  ) INTO v_sections
  FROM document_sections
  WHERE document_id = p_document_id;

  -- Apply each suggestion
  FOR v_suggestion IN
    SELECT s.id, s.suggested_text, ss.section_id
    FROM suggestions s
    JOIN suggestion_sections ss ON s.id = ss.suggestion_id
    WHERE s.id = ANY(p_suggestion_ids)
      AND s.status = 'approved'
  LOOP
    -- Update section content in JSONB
    v_sections := jsonb_set(
      v_sections,
      ARRAY[(
        SELECT pos::text
        FROM jsonb_array_elements(v_sections) WITH ORDINALITY arr(elem, pos)
        WHERE elem->>'id' = v_suggestion.section_id::text
      ), 'content'],
      to_jsonb(v_suggestion.suggested_text)
    );
  END LOOP;

  RETURN v_sections;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Business Logic Layer

**File:** `/src/services/documentVersionService.js`

```javascript
/**
 * Document Version Service
 * Handles document progression and versioning
 */

const { WorkflowError } = require('../utils/errors');

class DocumentVersionService {
  constructor(supabase, userId, organizationId) {
    this.supabase = supabase;
    this.userId = userId;
    this.organizationId = organizationId;
  }

  /**
   * Create new document version by applying suggestions
   */
  async createVersion(documentId, options) {
    // 1. Validate permissions
    await this.validateProgression(documentId, options);

    // 2. Gather suggestions to apply
    const suggestions = await this.getSuggestionsToApply(documentId, options);

    // 3. Build section snapshot with suggestions applied
    const sectionsSnapshot = await this.buildSectionSnapshot(documentId, suggestions);

    // 4. Build approval snapshot
    const approvalSnapshot = await this.buildApprovalSnapshot(documentId);

    // 5. Create version atomically
    const { data: version, error } = await this.supabase
      .rpc('create_document_version', {
        p_document_id: documentId,
        p_version_name: options.versionName || '',
        p_description: options.description || '',
        p_sections_snapshot: sectionsSnapshot,
        p_approval_snapshot: approvalSnapshot,
        p_applied_suggestions: suggestions.map(s => ({
          id: s.id,
          section_id: s.section_id,
          action: 'applied'
        })),
        p_workflow_stage: options.workflowStage || null,
        p_workflow_template_id: options.workflowTemplateId || null,
        p_created_by: this.userId,
        p_created_by_email: options.userEmail
      });

    if (error) throw new WorkflowError(`Failed to create version: ${error.message}`);

    // 6. Progress workflow stage if requested
    if (options.moveToNextStage) {
      await this.progressWorkflowStage(documentId, options.targetStage);
    }

    // 7. Mark applied suggestions as 'implemented'
    await this.markSuggestionsImplemented(suggestions.map(s => s.id), version[0].version_id);

    // 8. Log activity
    await this.logVersionCreation(documentId, version[0]);

    return version[0];
  }

  /**
   * Validate user can progress document workflow
   */
  async validateProgression(documentId, options) {
    // Check document exists and user has access
    const { data: doc, error } = await this.supabase
      .from('documents')
      .select('id, organization_id, status')
      .eq('id', documentId)
      .single();

    if (error || !doc) {
      throw new WorkflowError('Document not found');
    }

    if (doc.organization_id !== this.organizationId) {
      throw new WorkflowError('Access denied');
    }

    // Check user has required role (admin or owner)
    const { data: membership } = await this.supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', this.userId)
      .eq('organization_id', this.organizationId)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      throw new WorkflowError('Insufficient permissions to create version');
    }

    // If progressing workflow, check stage permissions
    if (options.moveToNextStage) {
      const canApprove = await this.canApproveStage(options.targetStageId);
      if (!canApprove) {
        throw new WorkflowError('Cannot approve at target workflow stage');
      }
    }
  }

  /**
   * Get suggestions to apply based on strategy
   */
  async getSuggestionsToApply(documentId, options) {
    const { applySuggestions, selectedSuggestionIds } = options;

    let query = this.supabase
      .from('suggestions')
      .select(`
        *,
        suggestion_sections!inner (section_id)
      `)
      .eq('suggestion_sections.section_id', documentId); // Via junction table

    switch (applySuggestions) {
      case 'approved':
        query = query.eq('status', 'approved');
        break;

      case 'selected':
        query = query.in('id', selectedSuggestionIds);
        break;

      case 'all':
        query = query.in('status', ['approved', 'pending']);
        break;

      case 'none':
        return [];

      default:
        throw new WorkflowError('Invalid applySuggestions strategy');
    }

    const { data: suggestions, error } = await query;
    if (error) throw error;

    return suggestions;
  }

  /**
   * Build section snapshot with suggestions applied
   */
  async buildSectionSnapshot(documentId, suggestions) {
    // Get all current sections
    const { data: sections, error } = await this.supabase
      .from('document_sections')
      .select('*')
      .eq('document_id', documentId)
      .order('path_ordinals', { ascending: true });

    if (error) throw error;

    // Create map of suggestions by section
    const suggestionMap = new Map();
    suggestions.forEach(s => {
      const sectionId = s.suggestion_sections[0].section_id;
      if (!suggestionMap.has(sectionId)) {
        suggestionMap.set(sectionId, []);
      }
      suggestionMap.get(sectionId).push(s);
    });

    // Apply suggestions to sections
    const modifiedSections = sections.map(section => {
      const sectionSuggestions = suggestionMap.get(section.id) || [];

      if (sectionSuggestions.length === 0) {
        return section; // No changes
      }

      // Apply most recent approved suggestion
      const latestSuggestion = sectionSuggestions
        .filter(s => s.status === 'approved')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

      if (latestSuggestion) {
        return {
          ...section,
          content: latestSuggestion.suggested_text,
          modified_by_suggestion: latestSuggestion.id
        };
      }

      return section;
    });

    return modifiedSections;
  }

  /**
   * Build approval snapshot (workflow states)
   */
  async buildApprovalSnapshot(documentId) {
    const { data: states, error } = await this.supabase
      .from('section_workflow_states')
      .select(`
        *,
        workflow_stages (stage_name, stage_order)
      `)
      .eq('document_sections.document_id', documentId);

    if (error) throw error;
    return states;
  }

  /**
   * Progress document to next workflow stage
   */
  async progressWorkflowStage(documentId, targetStageId) {
    // Get current workflow
    const { data: workflow } = await this.supabase
      .from('document_workflows')
      .select('*')
      .eq('document_id', documentId)
      .single();

    // Update to new stage
    await this.supabase
      .from('document_workflows')
      .update({
        current_stage_id: targetStageId,
        updated_at: new Date().toISOString()
      })
      .eq('document_id', documentId);

    // Create workflow state records for all sections at new stage
    const { data: sections } = await this.supabase
      .from('document_sections')
      .select('id')
      .eq('document_id', documentId);

    const stateRecords = sections.map(s => ({
      section_id: s.id,
      workflow_stage_id: targetStageId,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    await this.supabase
      .from('section_workflow_states')
      .upsert(stateRecords, {
        onConflict: 'section_id,workflow_stage_id'
      });
  }

  /**
   * Mark suggestions as implemented in version
   */
  async markSuggestionsImplemented(suggestionIds, versionId) {
    await this.supabase
      .from('suggestions')
      .update({
        status: 'implemented',
        implemented_in_version: versionId,
        updated_at: new Date().toISOString()
      })
      .in('id', suggestionIds);
  }

  /**
   * Log version creation activity
   */
  async logVersionCreation(documentId, version) {
    await this.supabase
      .from('user_activity_log')
      .insert({
        user_id: this.userId,
        organization_id: this.organizationId,
        action_type: 'document.version_created',
        entity_type: 'document',
        entity_id: documentId,
        action_data: {
          version_number: version.version_number,
          version_id: version.version_id,
          applied_suggestions: version.applied_suggestions?.length || 0
        }
      });
  }

  /**
   * Check if user can approve at workflow stage
   */
  async canApproveStage(stageId) {
    const { data, error } = await this.supabase
      .rpc('user_can_approve_stage', {
        p_user_id: this.userId,
        p_stage_id: stageId
      });

    if (error) throw error;
    return data;
  }
}

module.exports = DocumentVersionService;
```

---

### Route Implementation

**File:** `/src/routes/documents.js` (new file)

```javascript
const express = require('express');
const router = express.Router();
const Joi = require('joi');
const DocumentVersionService = require('../services/documentVersionService');
const { requireMember } = require('../middleware/roleAuth');
const { handleError } = require('../utils/errors');

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const progressDocumentSchema = Joi.object({
  applySuggestions: Joi.string()
    .valid('approved', 'all', 'selected', 'none')
    .default('approved'),

  selectedSuggestionIds: Joi.array()
    .items(Joi.string().uuid())
    .when('applySuggestions', {
      is: 'selected',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    }),

  versionName: Joi.string().max(255).optional().allow(''),
  description: Joi.string().max(5000).optional().allow(''),

  moveToNextStage: Joi.boolean().default(false),
  targetStage: Joi.string().uuid()
    .when('moveToNextStage', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/documents/:id/progress
 * Create new document version and optionally progress workflow
 */
router.post('/:id/progress', requireMember, async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const { supabase, session } = req;

    // Validate request body
    const { error: validationError, value } = progressDocumentSchema.validate(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError.details[0].message
      });
    }

    // Create version service
    const versionService = new DocumentVersionService(
      supabase,
      session.userId,
      session.organizationId
    );

    // Create version
    const version = await versionService.createVersion(documentId, {
      ...value,
      userEmail: session.userEmail
    });

    // Get updated document
    const { data: document } = await supabase
      .from('documents')
      .select('id, version, status')
      .eq('id', documentId)
      .single();

    res.json({
      success: true,
      version: {
        id: version.version_id,
        versionNumber: version.version_number,
        isCurrent: version.is_current
      },
      document
    });

  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/documents/:id/versions
 * List all versions of document
 */
router.get('/:id/versions', requireMember, async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const { supabase } = req;

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const includeSnapshots = req.query.includeSnapshots === 'true';

    // Build query
    let selectFields = `
      id,
      version_number,
      version_name,
      description,
      workflow_stage,
      is_current,
      is_published,
      published_at,
      created_by,
      created_by_email,
      created_at
    `;

    if (includeSnapshots) {
      selectFields += `,
        sections_snapshot,
        approval_snapshot,
        applied_suggestions
      `;
    } else {
      selectFields += `,
        jsonb_array_length(COALESCE(applied_suggestions, '[]'::jsonb)) as applied_suggestions_count
      `;
    }

    const { data: versions, count, error } = await supabase
      .from('document_versions')
      .select(selectFields, { count: 'exact' })
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      success: true,
      versions,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });

  } catch (error) {
    handleError(res, error);
  }
});

/**
 * GET /api/documents/:id/versions/:versionId/preview
 * Preview what a new version would look like
 */
router.get('/:id/versions/preview', requireMember, async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const { supabase, session } = req;

    const applySuggestions = req.query.applySuggestions || 'approved';
    const selectedIds = req.query.selectedSuggestionIds
      ? req.query.selectedSuggestionIds.split(',')
      : [];

    const versionService = new DocumentVersionService(
      supabase,
      session.userId,
      session.organizationId
    );

    // Get suggestions that would be applied
    const suggestions = await versionService.getSuggestionsToApply(documentId, {
      applySuggestions,
      selectedSuggestionIds: selectedIds
    });

    // Build preview
    const sectionsSnapshot = await versionService.buildSectionSnapshot(documentId, suggestions);

    // Calculate stats
    const sectionsModified = sectionsSnapshot.filter(s => s.modified_by_suggestion).length;
    const estimatedSize = JSON.stringify(sectionsSnapshot).length;

    res.json({
      success: true,
      preview: {
        sectionsTotal: sectionsSnapshot.length,
        sectionsModified,
        suggestionsToApply: suggestions.map(s => ({
          id: s.id,
          sectionId: s.suggestion_sections[0].section_id,
          suggestedText: s.suggested_text,
          rationale: s.rationale
        })),
        estimatedSize: `${(estimatedSize / 1024 / 1024).toFixed(2)} MB`
      }
    });

  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
```

---

## UI Design

### Document Viewer - Progress Workflow Section

**Location:** `/views/dashboard/document-viewer.ejs`

**HTML Structure:**
```html
<!-- Progress Workflow Panel -->
<div class="card mt-4">
  <div class="card-header bg-primary text-white">
    <h5 class="mb-0">
      <i class="bi bi-arrow-right-circle"></i>
      Progress Workflow
    </h5>
  </div>

  <div class="card-body">
    <!-- Current Status -->
    <div class="alert alert-info">
      <strong>Current Version:</strong> <%= document.version %>
      <br>
      <strong>Workflow Stage:</strong> <%= currentStage.stage_name %>
      <br>
      <strong>Approved Suggestions:</strong> <%= approvedSuggestionsCount %>
    </div>

    <!-- Configuration -->
    <form id="progressWorkflowForm">
      <div class="mb-3">
        <label class="form-label fw-bold">Apply Suggestions:</label>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="applySuggestions"
                 value="approved" id="applyApproved" checked>
          <label class="form-check-label" for="applyApproved">
            Apply all approved suggestions (<%= approvedSuggestionsCount %>)
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="applySuggestions"
                 value="selected" id="applySelected">
          <label class="form-check-label" for="applySelected">
            Apply selected suggestions only
          </label>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="radio" name="applySuggestions"
                 value="none" id="applyNone">
          <label class="form-check-label" for="applyNone">
            Create version snapshot without applying suggestions
          </label>
        </div>
      </div>

      <!-- Suggestion Selector (shown if "selected" is chosen) -->
      <div id="suggestionSelector" class="mb-3" style="display: none;">
        <label class="form-label">Select Suggestions to Apply:</label>
        <div class="list-group" style="max-height: 300px; overflow-y: auto;">
          <% suggestions.forEach(suggestion => { %>
            <label class="list-group-item">
              <input class="form-check-input me-2" type="checkbox"
                     name="selectedSuggestions[]" value="<%= suggestion.id %>">
              <strong><%= suggestion.section_number %></strong>:
              <%= suggestion.suggested_text.substring(0, 100) %>...
              <span class="badge bg-<%= suggestion.status === 'approved' ? 'success' : 'warning' %>">
                <%= suggestion.status %>
              </span>
            </label>
          <% }); %>
        </div>
      </div>

      <!-- Version Metadata -->
      <div class="mb-3">
        <label for="versionName" class="form-label">Version Name (Optional):</label>
        <input type="text" class="form-control" id="versionName"
               placeholder="e.g., Q4 2025 Update">
      </div>

      <div class="mb-3">
        <label for="versionDescription" class="form-label">Description:</label>
        <textarea class="form-control" id="versionDescription" rows="3"
                  placeholder="Describe what changed in this version..."></textarea>
      </div>

      <!-- Workflow Progression -->
      <div class="mb-3">
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="moveToNextStage">
          <label class="form-check-label" for="moveToNextStage">
            Progress to next workflow stage
          </label>
        </div>
      </div>

      <div id="stageSelector" class="mb-3" style="display: none;">
        <label for="targetStage" class="form-label">Target Stage:</label>
        <select class="form-select" id="targetStage">
          <% nextStages.forEach(stage => { %>
            <option value="<%= stage.id %>">
              <%= stage.stage_name %>
              <% if (!stage.can_approve) { %>
                (Requires <%= stage.required_roles.join(', ') %> role)
              <% } %>
            </option>
          <% }); %>
        </select>
      </div>

      <!-- Preview Button -->
      <button type="button" class="btn btn-outline-primary me-2" onclick="previewVersion()">
        <i class="bi bi-eye"></i> Preview Changes
      </button>

      <!-- Submit Button -->
      <button type="submit" class="btn btn-success">
        <i class="bi bi-arrow-right-circle"></i> Create Version & Progress
      </button>
    </form>
  </div>
</div>

<!-- Preview Modal -->
<div class="modal fade" id="versionPreviewModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Version Preview</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div id="previewContent">
          <!-- Dynamically populated -->
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
          Cancel
        </button>
        <button type="button" class="btn btn-success" onclick="confirmCreateVersion()">
          Confirm & Create Version
        </button>
      </div>
    </div>
  </div>
</div>
```

**JavaScript:**
```javascript
// Show/hide conditional UI elements
document.querySelector('input[name="applySuggestions"]').addEventListener('change', function(e) {
  const suggestionSelector = document.getElementById('suggestionSelector');
  suggestionSelector.style.display = e.target.value === 'selected' ? 'block' : 'none';
});

document.getElementById('moveToNextStage').addEventListener('change', function(e) {
  document.getElementById('stageSelector').style.display = e.target.checked ? 'block' : 'none';
});

// Preview version
async function previewVersion() {
  const formData = new FormData(document.getElementById('progressWorkflowForm'));
  const applySuggestions = formData.get('applySuggestions');
  const selectedIds = applySuggestions === 'selected'
    ? Array.from(formData.getAll('selectedSuggestions[]'))
    : [];

  const params = new URLSearchParams({
    applySuggestions,
    selectedSuggestionIds: selectedIds.join(',')
  });

  const response = await fetch(
    `/api/documents/<%= document.id %>/versions/preview?${params}`
  );
  const { preview } = await response.json();

  // Populate modal
  document.getElementById('previewContent').innerHTML = `
    <div class="alert alert-info">
      <h6>Changes Summary:</h6>
      <ul>
        <li><strong>Total Sections:</strong> ${preview.sectionsTotal}</li>
        <li><strong>Sections Modified:</strong> ${preview.sectionsModified}</li>
        <li><strong>Suggestions Applied:</strong> ${preview.suggestionsToApply.length}</li>
        <li><strong>Estimated Size:</strong> ${preview.estimatedSize}</li>
      </ul>
    </div>

    <h6>Suggestions to be Applied:</h6>
    <div class="list-group">
      ${preview.suggestionsToApply.map(s => `
        <div class="list-group-item">
          <h6>${s.sectionNumber}</h6>
          <p><strong>Proposed Change:</strong> ${s.suggestedText.substring(0, 200)}...</p>
          <small class="text-muted">${s.rationale}</small>
        </div>
      `).join('')}
    </div>
  `;

  // Show modal
  new bootstrap.Modal(document.getElementById('versionPreviewModal')).show();
}

// Confirm and create version
async function confirmCreateVersion() {
  const formData = new FormData(document.getElementById('progressWorkflowForm'));

  const payload = {
    applySuggestions: formData.get('applySuggestions'),
    versionName: formData.get('versionName'),
    description: formData.get('versionDescription'),
    moveToNextStage: formData.get('moveToNextStage') === 'on',
    targetStage: formData.get('targetStage')
  };

  if (payload.applySuggestions === 'selected') {
    payload.selectedSuggestionIds = Array.from(formData.getAll('selectedSuggestions[]'));
  }

  try {
    const response = await fetch(`/api/documents/<%= document.id %>/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('versionPreviewModal')).hide();

      // Show success message
      showToast('success', `Version ${result.version.versionNumber} created successfully!`);

      // Reload page to show new version
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast('error', result.error);
    }
  } catch (error) {
    showToast('error', 'Failed to create version: ' + error.message);
  }
}

// Toast notification helper
function showToast(type, message) {
  // Implementation depends on your toast library
  console.log(`[${type}] ${message}`);
}
```

---

## Migration Strategy

### Migration 021: Document Workflow Progression

**File:** `/database/migrations/021_document_workflow_progression.sql`

```sql
-- Migration 021: Document Workflow Progression
-- Date: 2025-10-19
-- Purpose: Add workflow progression capabilities to document versioning system

-- ============================================================================
-- PART 1: ENHANCE DOCUMENT_VERSIONS TABLE
-- ============================================================================

-- Add workflow-related columns to document_versions
ALTER TABLE document_versions
ADD COLUMN IF NOT EXISTS applied_suggestions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(100),
ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES workflow_templates(id);

-- Add comments
COMMENT ON COLUMN document_versions.applied_suggestions IS
  'Array of suggestion objects that were applied in this version.
   Format: [{"id": "uuid", "section_id": "uuid", "action": "applied", "applied_at": "timestamp"}]';

COMMENT ON COLUMN document_versions.workflow_stage IS
  'Workflow stage name when this version was created (e.g., "Committee Review", "Board Approval")';

COMMENT ON COLUMN document_versions.workflow_template_id IS
  'Reference to workflow template used when creating this version';

-- ============================================================================
-- PART 2: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding versions by workflow stage
CREATE INDEX IF NOT EXISTS idx_document_versions_workflow_stage
  ON document_versions(document_id, workflow_stage);

-- Index for current version lookup (partial index)
CREATE INDEX IF NOT EXISTS idx_document_versions_current
  ON document_versions(document_id)
  WHERE is_current = TRUE;

-- Index for published versions
CREATE INDEX IF NOT EXISTS idx_document_versions_published
  ON document_versions(document_id, published_at)
  WHERE is_published = TRUE;

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Function to increment version number
CREATE OR REPLACE FUNCTION increment_version(current_version VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  major_ver INTEGER;
  minor_ver INTEGER;
BEGIN
  -- Parse "1.2" -> major=1, minor=2
  major_ver := COALESCE(split_part(current_version, '.', 1)::INTEGER, 1);
  minor_ver := COALESCE(split_part(current_version, '.', 2)::INTEGER, 0);

  -- Increment minor version
  minor_ver := minor_ver + 1;

  RETURN major_ver || '.' || minor_ver;
EXCEPTION
  WHEN OTHERS THEN
    -- Default to incrementing from 1.0
    RETURN '1.1';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION increment_version IS 'Increment version number from "1.2" to "1.3"';

-- Function to create new document version atomically
CREATE OR REPLACE FUNCTION create_document_version(
  p_document_id UUID,
  p_version_name VARCHAR DEFAULT '',
  p_description TEXT DEFAULT '',
  p_sections_snapshot JSONB DEFAULT '[]'::jsonb,
  p_approval_snapshot JSONB DEFAULT '[]'::jsonb,
  p_applied_suggestions JSONB DEFAULT '[]'::jsonb,
  p_workflow_stage VARCHAR DEFAULT NULL,
  p_workflow_template_id UUID DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_created_by_email VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  version_id UUID,
  version_number VARCHAR,
  is_current BOOLEAN
) AS $$
DECLARE
  v_version_number VARCHAR;
  v_version_id UUID;
  v_current_version VARCHAR;
  v_org_id UUID;
BEGIN
  -- Get current version and org from document
  SELECT version, organization_id INTO v_current_version, v_org_id
  FROM documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found: %', p_document_id;
  END IF;

  -- Generate new version number
  v_version_number := increment_version(v_current_version);

  -- Mark all previous versions as not current
  UPDATE document_versions
  SET is_current = FALSE,
      updated_at = NOW()
  WHERE document_id = p_document_id
    AND is_current = TRUE;

  -- Insert new version
  INSERT INTO document_versions (
    document_id,
    version_number,
    version_name,
    description,
    sections_snapshot,
    approval_snapshot,
    applied_suggestions,
    workflow_stage,
    workflow_template_id,
    created_by,
    created_by_email,
    is_current,
    created_at
  ) VALUES (
    p_document_id,
    v_version_number,
    p_version_name,
    p_description,
    p_sections_snapshot,
    p_approval_snapshot,
    p_applied_suggestions,
    p_workflow_stage,
    p_workflow_template_id,
    p_created_by,
    p_created_by_email,
    TRUE,
    NOW()
  ) RETURNING id INTO v_version_id;

  -- Update document's current version
  UPDATE documents
  SET
    version = v_version_number,
    updated_at = NOW()
  WHERE id = p_document_id;

  -- Return version info
  RETURN QUERY
  SELECT v_version_id, v_version_number, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_document_version IS
  'Atomically create new document version with snapshots and update document record';

-- ============================================================================
-- PART 4: ADD STATUS TO SUGGESTIONS TABLE
-- ============================================================================

-- Add status tracking for suggestions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suggestions' AND column_name = 'implemented_in_version'
  ) THEN
    ALTER TABLE suggestions
    ADD COLUMN implemented_in_version UUID REFERENCES document_versions(id);

    CREATE INDEX idx_suggestions_implemented
      ON suggestions(implemented_in_version)
      WHERE implemented_in_version IS NOT NULL;

    COMMENT ON COLUMN suggestions.implemented_in_version IS
      'Reference to document_version where this suggestion was applied';
  END IF;
END $$;

-- ============================================================================
-- PART 5: UPDATE RLS POLICIES
-- ============================================================================

-- Document versions are visible to organization members
DROP POLICY IF EXISTS "Users see org document versions" ON document_versions;
CREATE POLICY "Users see org document versions"
  ON document_versions FOR SELECT
  USING (
    is_global_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_versions.document_id
        AND uo.user_id = auth.uid()
        AND uo.is_active = TRUE
    )
  );

-- Only admins and owners can create versions
DROP POLICY IF EXISTS "Admins create document versions" ON document_versions;
CREATE POLICY "Admins create document versions"
  ON document_versions FOR INSERT
  WITH CHECK (
    is_global_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_versions.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
        AND uo.is_active = TRUE
    )
  );

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- To rollback this migration:
-- DROP FUNCTION IF EXISTS create_document_version(...);
-- DROP FUNCTION IF EXISTS increment_version(VARCHAR);
-- DROP INDEX IF EXISTS idx_document_versions_workflow_stage;
-- DROP INDEX IF EXISTS idx_document_versions_current;
-- DROP INDEX IF EXISTS idx_document_versions_published;
-- DROP INDEX IF EXISTS idx_suggestions_implemented;
-- ALTER TABLE suggestions DROP COLUMN IF EXISTS implemented_in_version;
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS applied_suggestions;
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS workflow_stage;
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS workflow_template_id;
```

---

## Testing Strategy

### Unit Tests

**File:** `/tests/unit/document-version-service.test.js`

```javascript
const DocumentVersionService = require('../../src/services/documentVersionService');

describe('DocumentVersionService', () => {
  let service;
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    service = new DocumentVersionService(mockSupabase, 'user-id', 'org-id');
  });

  describe('createVersion()', () => {
    it('should create version with approved suggestions', async () => {
      const result = await service.createVersion('doc-id', {
        applySuggestions: 'approved',
        versionName: 'Test Version'
      });

      expect(result.version_number).toBe('1.1');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_document_version', {
        p_document_id: 'doc-id',
        p_version_name: 'Test Version',
        // ... other params
      });
    });

    it('should throw error if user lacks permissions', async () => {
      mockSupabase.from('user_organizations').select.mockResolvedValue({
        data: { role: 'member' }
      });

      await expect(
        service.createVersion('doc-id', {})
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getSuggestionsToApply()', () => {
    it('should filter by "approved" status', async () => {
      const suggestions = await service.getSuggestionsToApply('doc-id', {
        applySuggestions: 'approved'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('suggestions');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('should use selected IDs when strategy is "selected"', async () => {
      await service.getSuggestionsToApply('doc-id', {
        applySuggestions: 'selected',
        selectedSuggestionIds: ['id1', 'id2']
      });

      expect(mockSupabase.in).toHaveBeenCalledWith('id', ['id1', 'id2']);
    });
  });
});
```

### Integration Tests

**File:** `/tests/integration/document-workflow-progression.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');

describe('POST /api/documents/:id/progress', () => {
  it('should create new version with approved suggestions', async () => {
    const response = await request(app)
      .post('/api/documents/test-doc-id/progress')
      .set('Cookie', adminCookie)
      .send({
        applySuggestions: 'approved',
        versionName: 'Integration Test Version',
        description: 'Test version creation'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.version.versionNumber).toBe('1.1');

    // Verify version was created in database
    const { data: version } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', response.body.version.id)
      .single();

    expect(version.is_current).toBe(true);
    expect(version.version_name).toBe('Integration Test Version');
  });

  it('should reject request from non-admin user', async () => {
    const response = await request(app)
      .post('/api/documents/test-doc-id/progress')
      .set('Cookie', memberCookie)
      .send({ applySuggestions: 'approved' });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('permissions');
  });
});
```

### E2E Tests

**File:** `/tests/e2e/workflow-progression-flow.test.js`

```javascript
describe('Complete Workflow Progression Flow', () => {
  it('should progress document from draft to published', async () => {
    // 1. Admin creates suggestions
    const suggestion1 = await createSuggestion(sectionId, 'Updated text 1');
    const suggestion2 = await createSuggestion(sectionId2, 'Updated text 2');

    // 2. Admin approves suggestions at Stage 1
    await approveSuggestion(suggestion1.id, stage1Id);
    await approveSuggestion(suggestion2.id, stage1Id);

    // 3. Admin creates version and progresses to Stage 2
    const version1 = await createVersion(documentId, {
      applySuggestions: 'approved',
      versionName: 'Draft Complete',
      moveToNextStage: true,
      targetStage: stage2Id
    });

    expect(version1.versionNumber).toBe('1.1');

    // 4. Owner approves at Stage 2
    await approveAllSections(documentId, stage2Id, ownerId);

    // 5. Owner creates final version and publishes
    const version2 = await createVersion(documentId, {
      applySuggestions: 'none', // No new suggestions, just snapshot
      versionName: 'Published Version',
      moveToNextStage: true,
      targetStage: 'published'
    });

    expect(version2.versionNumber).toBe('1.2');

    // 6. Verify document is in published state
    const document = await getDocument(documentId);
    expect(document.version).toBe('1.2');
    expect(document.status).toBe('published');
  });
});
```

---

## Rollback Mechanism

### Restore Previous Version

**API Endpoint:** `POST /api/documents/:id/versions/:versionId/restore`

**Implementation:**
```javascript
router.post('/:id/versions/:versionId/restore', requireMember, async (req, res) => {
  try {
    const { id: documentId, versionId } = req.params;
    const { createNewVersion, reason } = req.body;
    const { supabase, session } = req;

    // Get version to restore
    const { data: version, error } = await supabase
      .from('document_versions')
      .select('*')
      .eq('id', versionId)
      .eq('document_id', documentId)
      .single();

    if (error || !version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (createNewVersion) {
      // Create new version from restored snapshot
      const versionService = new DocumentVersionService(
        supabase,
        session.userId,
        session.organizationId
      );

      const newVersion = await versionService.createVersion(documentId, {
        applySuggestions: 'none',
        versionName: `Restored from v${version.version_number}`,
        description: reason || `Restored from version ${version.version_number}`,
        sectionsSnapshot: version.sections_snapshot, // Use old snapshot
        approvalSnapshot: version.approval_snapshot
      });

      res.json({
        success: true,
        restoredVersion: version.version_number,
        newVersionNumber: newVersion.version_number,
        message: `Version ${version.version_number} restored as ${newVersion.version_number}`
      });
    } else {
      // Just mark this version as current
      await supabase
        .from('document_versions')
        .update({ is_current: false })
        .eq('document_id', documentId);

      await supabase
        .from('document_versions')
        .update({ is_current: true })
        .eq('id', versionId);

      await supabase
        .from('documents')
        .update({ version: version.version_number })
        .eq('id', documentId);

      res.json({
        success: true,
        restoredVersion: version.version_number,
        message: `Restored to version ${version.version_number}`
      });
    }

  } catch (error) {
    handleError(res, error);
  }
});
```

---

## Security Considerations

### Permission Model

**Who Can Create Versions:**
- Admin role (can create versions, cannot publish)
- Owner role (can create versions AND publish)
- Global Admin (can do anything)

**Enforcement Points:**
1. Middleware: `requireMember` (check authentication)
2. Service: `validateProgression()` (check role)
3. RLS: Document versions table policy (check organization)
4. Function: `create_document_version()` (SECURITY DEFINER)

### Data Validation

```javascript
// Prevent malicious JSON injection
function sanitizeSnapshot(snapshot) {
  // Limit snapshot size to 10MB
  const size = JSON.stringify(snapshot).length;
  if (size > 10 * 1024 * 1024) {
    throw new Error('Snapshot too large');
  }

  // Validate JSON structure
  if (!Array.isArray(snapshot)) {
    throw new Error('Snapshot must be an array');
  }

  return snapshot;
}
```

### Audit Trail

Every version creation is logged:
```javascript
await logActivity(userId, orgId, 'document.version_created', 'document', documentId, {
  version_number: versionNumber,
  applied_suggestions: appliedCount,
  workflow_stage: targetStage
});
```

---

## Performance Optimization

### Snapshot Size Management

**Problem:** Large documents can have 5MB+ snapshots.

**Solutions:**
1. **Compression:**
   ```javascript
   const zlib = require('zlib');

   // Compress before storing
   const compressed = zlib.gzipSync(JSON.stringify(snapshot));

   // Decompress when reading
   const decompressed = JSON.parse(zlib.gunzipSync(compressed));
   ```

2. **Pagination for Version List:**
   - Default limit: 20 versions per request
   - Don't include snapshots in list view (only in detail view)

3. **Background Processing:**
   ```javascript
   // Queue version creation for large documents
   if (sectionCount > 100) {
     await enqueueVersionCreation(documentId, options);
     return { status: 'queued', jobId: job.id };
   }
   ```

### Database Optimization

**Indexes:**
```sql
-- Fast current version lookup
CREATE INDEX idx_document_versions_current
  ON document_versions(document_id)
  WHERE is_current = TRUE;

-- Fast workflow stage filtering
CREATE INDEX idx_document_versions_workflow_stage
  ON document_versions(document_id, workflow_stage);
```

**Query Optimization:**
```javascript
// ❌ BAD: N+1 queries
for (const section of sections) {
  const suggestions = await getSuggestions(section.id);
}

// ✅ GOOD: Single query with JOIN
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

## Future Enhancements

### Phase 2 Features (Not in Initial Implementation)

1. **Diff View:**
   - Show side-by-side comparison of versions
   - Highlight changed sections
   - Visual diff of text changes

2. **Version Branching:**
   - Create multiple draft versions
   - Merge branches back to main

3. **Scheduled Publishing:**
   - Queue version for future publication
   - Auto-publish at specific date/time

4. **Version Comments:**
   - Allow users to comment on versions
   - Discussion threads per version

5. **Export Versions:**
   - Export specific version to PDF
   - Export to Word document
   - Generate changelog

---

## Deployment Checklist

### Pre-Deployment

- [ ] Migration 021 reviewed and tested locally
- [ ] Unit tests passing (90%+ coverage)
- [ ] Integration tests passing
- [ ] Performance tested with large documents (100+ sections)
- [ ] Security audit completed
- [ ] RLS policies validated
- [ ] Documentation complete

### Deployment Steps

1. [ ] Backup production database
2. [ ] Run migration 021 in production
3. [ ] Verify indexes created successfully
4. [ ] Deploy `documentVersionService.js`
5. [ ] Deploy `/src/routes/documents.js`
6. [ ] Mount routes in `server.js`
7. [ ] Deploy UI updates to document viewer
8. [ ] Test version creation end-to-end
9. [ ] Monitor error logs for 24 hours

### Post-Deployment

- [ ] Create test version in production
- [ ] Verify snapshots storing correctly
- [ ] Check RLS enforcement working
- [ ] Monitor database performance
- [ ] User acceptance testing
- [ ] Train admin users on new feature

### Rollback Plan

- [ ] Database backup ready
- [ ] Previous server version tagged in git
- [ ] Rollback SQL script prepared:
  ```sql
  -- Revert migration 021
  \i database/migrations/021_rollback.sql
  ```

---

## Appendix

### Related Documentation

- [WORKFLOW_SYSTEM_ARCHITECTURE.md](../WORKFLOW_SYSTEM_ARCHITECTURE.md) - Overall workflow system
- [ADR-001-RLS-SECURITY-MODEL.md](../ADR-001-RLS-SECURITY-MODEL.md) - Security model
- [WORKFLOW_API_REFERENCE.md](../WORKFLOW_API_REFERENCE.md) - API documentation

### Code References

- `/src/services/documentVersionService.js` - Core business logic
- `/src/routes/documents.js` - API endpoints
- `/database/migrations/021_document_workflow_progression.sql` - Database schema

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-19 | Architecture Team | Initial design |

---

**Document Status:** Proposed
**Next Review Date:** After implementation
**Approval Required From:** Technical Lead, Product Owner
