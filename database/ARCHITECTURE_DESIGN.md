# Database Architecture Design: Generalized Multi-Tenant Amendment Tracker

## Executive Summary

This document outlines the database architecture for transforming the Bylaws Amendment Tracker from a single-organization tool into a generalized, multi-tenant platform supporting:
- Multiple organizations with isolated data
- Arbitrary document hierarchy structures (not just Article/Section)
- Configurable N-stage approval workflows (not just committee/board)
- Flexible numbering schemes and terminology

## Part 1: Multi-Tenancy Decision

### RECOMMENDATION: Option A - Supabase Multi-Tenant (organization_id on all tables)

**Chosen Architecture:** Single Supabase database with Row-Level Security (RLS) for tenant isolation.

### Justification

| Criterion | Option A (Supabase Multi-Tenant) | Option B (Per-Org DBs) | Option C (Hybrid) |
|-----------|----------------------------------|------------------------|-------------------|
| **Maintenance Complexity** | ✅ Low - Single schema to manage | ❌ High - N schemas to maintain | ⚠️ Medium - Two codebases |
| **Security** | ✅ Strong with RLS | ✅ Strongest (physical isolation) | ⚠️ Mixed security models |
| **Scalability** | ✅ Excellent (Postgres scales well) | ❌ Limited by DB count | ⚠️ Complex scaling paths |
| **Deployment Simplicity** | ✅ Simple - One connection | ❌ Complex - Multiple connections | ❌ Very complex |
| **Cross-Org Analytics** | ✅ Easy (aggregate queries) | ❌ Impossible | ⚠️ Partial |
| **Cost** | ✅ Single DB cost | ❌ N × DB cost | ⚠️ Variable |
| **Backup/Recovery** | ✅ Single backup point | ❌ N backup processes | ⚠️ Two processes |

### Security Implementation

Row-Level Security (RLS) provides tenant isolation at the database level:

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only see their organization's data
CREATE POLICY "Users see own organization"
  ON documents
  FOR SELECT
  USING (organization_id = (
    SELECT organization_id
    FROM user_organizations
    WHERE user_id = auth.uid()
  ));

-- Prevent cross-tenant data leaks
CREATE POLICY "Prevent cross-tenant section access"
  ON document_sections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
      AND uo.user_id = auth.uid()
    )
  );
```

### Why Not Option B (Per-Org Isolation)?

While separate databases offer the strongest isolation, they introduce operational complexity:
- **Schema migrations** must run N times (once per org)
- **Connection pooling** becomes complex with dynamic org creation
- **Cross-org features** (like template sharing) become impossible
- **Monitoring** requires N dashboards
- **Costs scale linearly** with organizations

### Why Not Option C (Hybrid)?

Hybrid approaches create dual complexity:
- Two separate codebases to maintain
- Different security models to audit
- Complex migration paths between hosting types
- Feature parity challenges between modes

## Part 2: Dynamic Hierarchy Schema

### Core Design Principles

1. **Hierarchy as a Tree:** Use adjacency list model with path materialization for performance
2. **Flexible Metadata:** JSON fields for custom attributes per organization
3. **Numbering Separation:** Decouple display numbering from tree structure
4. **Terminology Freedom:** Store display labels separately from structure

### New Table: `document_sections` (replaces `bylaw_sections`)

```sql
CREATE TABLE document_sections (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Hierarchy (Adjacency List Model)
  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL, -- Position among siblings (1, 2, 3...)
  depth INTEGER NOT NULL DEFAULT 0, -- 0=root, 1=child, 2=grandchild...

  -- Path Materialization (for fast queries)
  path_ids UUID[] NOT NULL, -- Array: [root_id, parent_id, ..., self_id]
  path_ordinals INTEGER[] NOT NULL, -- Array: [1, 2, 1] for "Section 1.2.1"

  -- Display Information
  section_number VARCHAR(50), -- Display number: "1", "1.1", "I.A.3", "Article V"
  section_title TEXT,
  section_type VARCHAR(50), -- "article", "section", "subsection", "chapter"

  -- Content
  original_text TEXT,
  current_text TEXT, -- Latest approved text (replaces new_text/final_text)

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(document_id, parent_section_id, ordinal),
  CHECK(depth >= 0 AND depth <= 10), -- Max 10 levels
  CHECK(array_length(path_ids, 1) = depth + 1),
  CHECK(array_length(path_ordinals, 1) = depth + 1),
  CHECK(path_ids[array_length(path_ids, 1)] = id) -- Last element is self
);

-- Indexes
CREATE INDEX idx_doc_sections_document ON document_sections(document_id);
CREATE INDEX idx_doc_sections_parent ON document_sections(parent_section_id);
CREATE INDEX idx_doc_sections_path ON document_sections USING GIN(path_ids);
CREATE INDEX idx_doc_sections_depth ON document_sections(document_id, depth);
CREATE INDEX idx_doc_sections_ordinal ON document_sections(parent_section_id, ordinal);

-- Trigger to maintain path materialization
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;
  ELSE
    -- Child section: inherit parent's path and append self
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();
```

### Querying the Hierarchy

```sql
-- Get all sections in document order (depth-first)
SELECT
  section_number,
  section_title,
  depth,
  REPEAT('  ', depth) || section_number AS indented_number
FROM document_sections
WHERE document_id = :doc_id
ORDER BY path_ordinals;

-- Get all children of a section
SELECT *
FROM document_sections
WHERE parent_section_id = :section_id
ORDER BY ordinal;

-- Get all descendants of a section (recursive)
SELECT *
FROM document_sections
WHERE :target_id = ANY(path_ids)
  AND id != :target_id
ORDER BY path_ordinals;

-- Get breadcrumb path for a section
SELECT
  ds.section_number,
  ds.section_title
FROM document_sections ds
WHERE ds.id = ANY((
  SELECT path_ids
  FROM document_sections
  WHERE id = :section_id
))
ORDER BY array_position((
  SELECT path_ids
  FROM document_sections
  WHERE id = :section_id
), ds.id);
```

## Part 3: Configurable Workflow Schema

### New Tables: Workflow Configuration

```sql
-- Organization-specific workflow definitions
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

-- Workflow stages (replaces hardcoded committee/board)
CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,

  -- Stage definition
  stage_name VARCHAR(100) NOT NULL, -- "Committee Review", "Board Approval", "Legal Review"
  stage_order INTEGER NOT NULL, -- 1, 2, 3...

  -- Capabilities
  can_lock BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,

  -- Display
  display_color VARCHAR(7), -- Hex color: "#FFD700"
  icon VARCHAR(50), -- Icon identifier

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workflow_template_id, stage_order),
  UNIQUE(workflow_template_id, stage_name)
);

-- Document uses a specific workflow
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  activated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(document_id) -- One workflow per document
);

-- Section state tracking (replaces locked_by_committee/board_approved)
CREATE TABLE section_workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  workflow_stage_id UUID NOT NULL REFERENCES workflow_stages(id),

  -- State
  status VARCHAR(50) NOT NULL, -- 'pending', 'approved', 'rejected', 'locked'

  -- Action metadata
  actioned_by VARCHAR(255),
  actioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  selected_suggestion_id UUID REFERENCES suggestions(id),

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(section_id, workflow_stage_id)
);

-- Indexes
CREATE INDEX idx_workflow_stages_template ON workflow_stages(workflow_template_id, stage_order);
CREATE INDEX idx_section_states_section ON section_workflow_states(section_id);
CREATE INDEX idx_section_states_stage ON section_workflow_states(workflow_stage_id);
CREATE INDEX idx_section_states_status ON section_workflow_states(section_id, status);
```

### Example Workflow Configurations

```sql
-- Example 1: Simple 2-stage (Committee → Board)
INSERT INTO workflow_templates (id, organization_id, name, is_default)
VALUES ('wf1', 'org1', 'Standard Committee/Board', true);

INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, display_color)
VALUES
  ('wf1', 'Committee Review', 1, '#FFD700'),
  ('wf1', 'Board Approval', 2, '#90EE90');

-- Example 2: Complex 4-stage workflow
INSERT INTO workflow_templates (id, organization_id, name)
VALUES ('wf2', 'org1', 'Legal Review Required');

INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, can_edit, display_color)
VALUES
  ('wf2', 'Committee Draft', 1, true, '#87CEEB'),
  ('wf2', 'Legal Review', 2, false, '#FFA500'),
  ('wf2', 'Committee Final', 3, false, '#FFD700'),
  ('wf2', 'Board Approval', 4, false, '#90EE90');
```

### Querying Workflow State

```sql
-- Get current workflow stage for a section
SELECT
  ws.stage_name,
  ws.stage_order,
  sws.status,
  sws.actioned_by,
  sws.actioned_at
FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.section_id = :section_id
  AND sws.status IN ('approved', 'locked')
ORDER BY ws.stage_order DESC
LIMIT 1;

-- Get all sections at a specific workflow stage
SELECT
  ds.section_number,
  ds.section_title,
  sws.status,
  sws.actioned_at
FROM document_sections ds
JOIN section_workflow_states sws ON ds.id = sws.section_id
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE ds.document_id = :doc_id
  AND ws.stage_name = 'Committee Review'
  AND sws.status = 'pending';
```

## Part 4: Supporting Tables

### Organizations Table

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly: "reseda-neighborhood-council"

  -- Configuration
  settings JSONB DEFAULT '{}'::jsonb, -- Custom org settings

  -- Hierarchy terminology (customizable per org)
  hierarchy_config JSONB DEFAULT '{
    "levels": [
      {"name": "Article", "numbering": "roman"},
      {"name": "Section", "numbering": "numeric"}
    ]
  }'::jsonb,

  -- Subscription/Limits
  plan_type VARCHAR(50) DEFAULT 'free',
  max_documents INTEGER DEFAULT 5,
  max_users INTEGER DEFAULT 10,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMP
);

CREATE INDEX idx_orgs_slug ON organizations(slug);
CREATE INDEX idx_orgs_deleted ON organizations(deleted_at) WHERE deleted_at IS NULL;
```

### Documents Table

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- External integration
  google_doc_id VARCHAR(255), -- For Google Docs integration
  external_source VARCHAR(50), -- 'google_docs', 'word', 'manual'

  -- Versioning
  version VARCHAR(50) DEFAULT '1.0',
  version_history JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'archived'
  published_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Custom fields

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, google_doc_id)
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_google ON documents(google_doc_id) WHERE google_doc_id IS NOT NULL;
```

### User Management

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,

  -- Auth (if not using Supabase Auth)
  password_hash TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Role-based access
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'

  -- Permissions
  permissions JSONB DEFAULT '{
    "can_edit_sections": true,
    "can_approve_stages": [],
    "can_manage_users": false
  }'::jsonb,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON user_organizations(organization_id);
```

### Suggestions (Updated)

```sql
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-section support (via junction table)
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  is_multi_section BOOLEAN DEFAULT FALSE,

  -- Content
  suggested_text TEXT,
  rationale TEXT,

  -- Author
  author_user_id UUID REFERENCES users(id),
  author_email VARCHAR(255), -- For public submissions
  author_name VARCHAR(255),

  -- External integration
  google_suggestion_id VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'selected', 'rejected', 'merged'
  support_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Junction table for multi-section suggestions
CREATE TABLE suggestion_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL, -- Order within the suggestion

  UNIQUE(suggestion_id, section_id),
  UNIQUE(suggestion_id, ordinal)
);

-- Votes table (mostly unchanged)
CREATE TABLE suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),

  vote_type VARCHAR(20) DEFAULT 'support', -- 'support', 'oppose', 'neutral'
  is_preferred BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(suggestion_id, user_id),
  UNIQUE(suggestion_id, user_email)
);

CREATE INDEX idx_suggestions_doc ON suggestions(document_id);
CREATE INDEX idx_suggestion_sections_suggestion ON suggestion_sections(suggestion_id);
CREATE INDEX idx_suggestion_sections_section ON suggestion_sections(section_id);
CREATE INDEX idx_votes_suggestion ON suggestion_votes(suggestion_id);
```

## Part 5: Complete Schema DDL

See `/database/schema_generalized.sql` for the complete, executable schema.

## Part 6: Migration Strategy

### Phase 1: Data Mapping (Read-Only)

Create migration views that map old schema to new:

```sql
-- Map old bylaw_sections to new document_sections
CREATE VIEW migration_v_bylaw_sections AS
SELECT
  bs.id,
  d.id as document_id,
  NULL::UUID as parent_section_id, -- Flatten initially
  bs.section_citation as section_number,
  bs.section_title,
  bs.original_text,
  bs.new_text as current_text,
  COALESCE(bs.final_text, bs.new_text, bs.original_text) as effective_text
FROM bylaw_sections bs
CROSS JOIN (
  -- Assume single document for migration
  SELECT id FROM documents LIMIT 1
) d;
```

### Phase 2: Data Migration Script

```sql
-- Step 1: Create default organization
INSERT INTO organizations (id, name, slug, hierarchy_config)
VALUES (
  'org-reseda-nc',
  'Reseda Neighborhood Council',
  'reseda-nc',
  '{
    "levels": [
      {"name": "Article", "numbering": "roman"},
      {"name": "Section", "numbering": "numeric"}
    ]
  }'::jsonb
);

-- Step 2: Create default document
INSERT INTO documents (id, organization_id, title, google_doc_id)
SELECT
  gen_random_uuid(),
  'org-reseda-nc',
  'Bylaws',
  :google_doc_id;

-- Step 3: Migrate sections with hierarchy parsing
INSERT INTO document_sections (
  id,
  document_id,
  parent_section_id,
  ordinal,
  section_number,
  section_title,
  section_type,
  original_text,
  current_text
)
SELECT
  bs.id,
  d.id,
  NULL, -- Will need custom logic to determine parent
  ROW_NUMBER() OVER (ORDER BY bs.section_citation),
  bs.section_citation,
  bs.section_title,
  CASE
    WHEN bs.section_citation LIKE 'Article %' THEN 'article'
    WHEN bs.section_citation LIKE '%Section %' THEN 'section'
    ELSE 'other'
  END,
  bs.original_text,
  COALESCE(bs.final_text, bs.new_text, bs.original_text)
FROM bylaw_sections bs
CROSS JOIN documents d
WHERE d.organization_id = 'org-reseda-nc';

-- Step 4: Create default workflow
INSERT INTO workflow_templates (id, organization_id, name, is_default)
VALUES ('wf-default', 'org-reseda-nc', 'Standard Committee/Board', true);

INSERT INTO workflow_stages (workflow_template_id, stage_name, stage_order, display_color)
VALUES
  ('wf-default', 'Committee Review', 1, '#FFD700'),
  ('wf-default', 'Board Approval', 2, '#90EE90');

-- Step 5: Migrate workflow states
INSERT INTO section_workflow_states (
  section_id,
  workflow_stage_id,
  status,
  actioned_by,
  actioned_at,
  notes,
  selected_suggestion_id
)
SELECT
  bs.id,
  ws.id,
  CASE
    WHEN bs.locked_by_committee THEN 'approved'::VARCHAR
    ELSE 'pending'::VARCHAR
  END,
  bs.locked_by,
  bs.locked_at,
  bs.committee_notes,
  bs.selected_suggestion_id
FROM bylaw_sections bs
CROSS JOIN workflow_stages ws
WHERE ws.stage_name = 'Committee Review'
  AND bs.locked_by_committee = true;

-- Board approval states
INSERT INTO section_workflow_states (
  section_id,
  workflow_stage_id,
  status,
  actioned_at
)
SELECT
  bs.id,
  ws.id,
  'approved'::VARCHAR,
  bs.board_approved_at
FROM bylaw_sections bs
CROSS JOIN workflow_stages ws
WHERE ws.stage_name = 'Board Approval'
  AND bs.board_approved = true;

-- Step 6: Migrate suggestions (unchanged mostly)
-- Already compatible, just need to link to document_id
UPDATE bylaw_suggestions
SET document_id = (SELECT id FROM documents WHERE organization_id = 'org-reseda-nc');
```

### Phase 3: Application Code Migration

Update queries in `server.js`:

```javascript
// OLD: Fetch sections
const { data } = await supabase
  .from('bylaw_sections')
  .select('*')
  .eq('doc_id', docId);

// NEW: Fetch sections with organization context
const { data } = await supabase
  .from('document_sections')
  .select(`
    *,
    document:documents!inner (
      id,
      title,
      organization_id
    )
  `)
  .eq('document.id', docId)
  .order('path_ordinals');

// OLD: Check if locked
if (section.locked_by_committee) { ... }

// NEW: Check workflow state
const { data: states } = await supabase
  .from('section_workflow_states')
  .select(`
    *,
    stage:workflow_stages (
      stage_name,
      stage_order
    )
  `)
  .eq('section_id', sectionId)
  .eq('status', 'approved')
  .order('stage.stage_order', { ascending: false })
  .limit(1);

const isLocked = states.length > 0;
const currentStage = states[0]?.stage?.stage_name;
```

### Phase 4: Rollback Plan

```sql
-- Create backup tables before migration
CREATE TABLE _backup_bylaw_sections AS SELECT * FROM bylaw_sections;
CREATE TABLE _backup_bylaw_suggestions AS SELECT * FROM bylaw_suggestions;
CREATE TABLE _backup_suggestion_sections AS SELECT * FROM suggestion_sections;

-- If migration fails, restore:
DROP TABLE IF EXISTS document_sections CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Restore from backup
INSERT INTO bylaw_sections SELECT * FROM _backup_bylaw_sections;
-- ... etc
```

## Part 7: Performance Considerations

### Indexing Strategy

1. **Organization Isolation:** Index on `organization_id` for all multi-tenant tables
2. **Hierarchy Queries:** GIN index on `path_ids` for ancestor/descendant queries
3. **Workflow Lookups:** Composite index on `(section_id, status)` for fast state checks
4. **Sorting:** Index on `path_ordinals` for document-order queries

### Query Optimization

```sql
-- Avoid N+1 queries with proper JOINs
SELECT
  ds.*,
  d.title,
  d.organization_id,
  ws.stage_name,
  sws.status,
  COUNT(DISTINCT s.id) as suggestion_count
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
LEFT JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
LEFT JOIN suggestion_sections ss ON ds.id = ss.section_id
LEFT JOIN suggestions s ON ss.suggestion_id = s.id
WHERE d.organization_id = :org_id
  AND d.id = :doc_id
GROUP BY ds.id, d.id, ws.id, sws.id
ORDER BY ds.path_ordinals;
```

### Caching Strategy

1. **Organization Settings:** Cache `organizations.hierarchy_config` in application memory
2. **Workflow Definitions:** Cache workflow templates per organization (rarely change)
3. **Section Tree:** Cache entire section tree per document (invalidate on edit)

## Part 8: Trade-offs and Rationale

### Multi-Tenancy Decision

**Chosen:** Supabase RLS-based multi-tenancy

**Trade-offs:**
- ✅ **Pro:** Simple to deploy and maintain
- ✅ **Pro:** Cost-effective scaling
- ✅ **Pro:** Easy cross-org analytics
- ⚠️ **Con:** Requires careful RLS policy testing
- ⚠️ **Con:** Single point of failure (mitigated by Supabase SLA)

**Why it works:**
- This application is read-heavy, not write-heavy (good for shared DB)
- Supabase RLS is battle-tested and performant
- Future features (template sharing, cross-org benchmarking) benefit from shared DB

### Hierarchy Model Decision

**Chosen:** Adjacency list with path materialization

**Alternatives Considered:**
- **Nested Sets:** Rejected due to complexity of updates (requires rebalancing)
- **Closure Table:** Rejected due to storage overhead (N² rows for deep trees)

**Trade-offs:**
- ✅ **Pro:** Simple to understand and maintain
- ✅ **Pro:** Fast ancestor/descendant queries with path arrays
- ✅ **Pro:** Easy to insert/move nodes
- ⚠️ **Con:** Recursive queries needed for some operations (but Postgres CTEs are fast)

### Workflow Model Decision

**Chosen:** Stage-based state machine with junction table

**Trade-offs:**
- ✅ **Pro:** Flexible N-stage workflows
- ✅ **Pro:** Audit trail of all stage transitions
- ✅ **Pro:** Easy to add new stages without schema changes
- ⚠️ **Con:** More complex queries than boolean flags
- ⚠️ **Con:** Requires workflow configuration UI

**Why it works:**
- Different organizations have different approval processes
- Future-proofs for 3, 4, 5+ stage workflows
- Enables workflow analytics (time in each stage, bottlenecks)

## Part 9: Next Steps

1. **Review this design** with the team
2. **Create `schema_generalized.sql`** with full DDL
3. **Build migration script** with test data
4. **Update application code** to use new schema
5. **Add RLS policies** for security
6. **Create seed data** for demo organizations
7. **Update documentation** for new features

## Appendix A: Comparison to Old Schema

| Old Schema | New Schema | Reason for Change |
|------------|------------|-------------------|
| `bylaw_sections.doc_id` | `document_sections.document_id` | Clearer naming |
| `section_citation` | `section_number` + `section_type` | Structured data |
| Flat section list | Hierarchical tree | Support nesting |
| `locked_by_committee`, `board_approved` | `section_workflow_states` | Flexible workflows |
| `new_text`, `final_text` | `current_text` | Simplify versioning |
| No multi-tenancy | `organization_id` everywhere | Multi-org support |

## Appendix B: Example Queries

See `/database/example_queries.sql` for comprehensive query examples.

---

**Document Version:** 1.0
**Author:** Database Architect
**Date:** 2025-10-07
**Status:** Proposed for Review
