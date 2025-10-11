-- GENERALIZED MULTI-TENANT AMENDMENT TRACKER SCHEMA
-- Version: 2.0.0
-- Date: 2025-10-07
-- Purpose: Transform Bylaws Amendment Tracker into multi-tenant platform
--          with flexible hierarchies and configurable workflows
--
-- Design Decisions:
-- 1. Multi-Tenancy: Supabase RLS with organization_id on all tables
-- 2. Hierarchy: Adjacency list + materialized path for performance
-- 3. Workflow: Stage-based state machine with configurable templates
-- 4. Numbering: Separate display format from logical structure

-- ============================================================================
-- PART 1: MULTI-TENANCY FOUNDATION
-- ============================================================================

-- Organizations table: Root of all tenant data
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE, -- URL-friendly: "reseda-neighborhood-council"
  organization_type VARCHAR(50) DEFAULT 'neighborhood_council',

  -- Configuration
  settings JSONB DEFAULT '{}'::jsonb, -- Custom org settings

  -- Hierarchy terminology (customizable per org)
  hierarchy_config JSONB DEFAULT '{
    "levels": [
      {"name": "Article", "numbering": "roman", "prefix": "Article"},
      {"name": "Section", "numbering": "numeric", "prefix": "Section"}
    ],
    "max_depth": 5
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
CREATE INDEX idx_orgs_type ON organizations(organization_type);

COMMENT ON TABLE organizations IS 'Root table for multi-tenant isolation. Each organization has independent documents and workflows.';
COMMENT ON COLUMN organizations.hierarchy_config IS 'JSON defining document structure levels, numbering schemes, and display formats';

-- ============================================================================
-- PART 2: USER MANAGEMENT
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,

  -- Auth integration (Supabase Auth recommended)
  auth_provider VARCHAR(50) DEFAULT 'supabase',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- User-Organization membership and roles
CREATE TABLE user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Role-based access
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'

  -- Permissions (flexible JSONB for custom permissions)
  permissions JSONB DEFAULT '{
    "can_edit_sections": true,
    "can_create_suggestions": true,
    "can_vote": true,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false
  }'::jsonb,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON user_organizations(organization_id);
CREATE INDEX idx_user_orgs_role ON user_organizations(organization_id, role);

-- ============================================================================
-- PART 3: DOCUMENT MANAGEMENT
-- ============================================================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'bylaws', -- 'bylaws', 'policy', 'procedure', 'constitution'

  -- External integration
  google_doc_id VARCHAR(255), -- For Google Docs integration
  external_source VARCHAR(50), -- 'google_docs', 'word', 'manual'

  -- Versioning
  version VARCHAR(50) DEFAULT '1.0',
  version_history JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'archived', 'superseded'
  published_at TIMESTAMP,
  archived_at TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Custom fields per organization

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(organization_id, google_doc_id)
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(organization_id, status);
CREATE INDEX idx_documents_google ON documents(google_doc_id) WHERE google_doc_id IS NOT NULL;
CREATE INDEX idx_documents_type ON documents(organization_id, document_type);

COMMENT ON TABLE documents IS 'Documents with amendments tracked. Each org can have multiple documents with different types and versions.';

-- ============================================================================
-- PART 4: DYNAMIC HIERARCHY - DOCUMENT SECTIONS
-- ============================================================================

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
  section_type VARCHAR(50), -- "article", "section", "subsection", "chapter", "clause"

  -- Content (simplified from old new_text/final_text model)
  original_text TEXT, -- Original text before any amendments
  current_text TEXT, -- Latest approved/working text

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Custom attributes

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(document_id, parent_section_id, ordinal),
  CHECK(depth >= 0 AND depth <= 10), -- Max 10 levels
  CHECK(array_length(path_ids, 1) = depth + 1),
  CHECK(array_length(path_ordinals, 1) = depth + 1),
  CHECK(path_ids[array_length(path_ids, 1)] = id), -- Last element is self
  CHECK(ordinal > 0) -- Ordinals start at 1
);

-- Indexes for performance
CREATE INDEX idx_doc_sections_document ON document_sections(document_id);
CREATE INDEX idx_doc_sections_parent ON document_sections(parent_section_id);
CREATE INDEX idx_doc_sections_path ON document_sections USING GIN(path_ids);
CREATE INDEX idx_doc_sections_depth ON document_sections(document_id, depth);
CREATE INDEX idx_doc_sections_ordinal ON document_sections(parent_section_id, ordinal);
CREATE INDEX idx_doc_sections_number ON document_sections(document_id, section_number);

COMMENT ON TABLE document_sections IS 'Flexible hierarchy supporting arbitrary nesting depths and numbering schemes';
COMMENT ON COLUMN document_sections.path_ids IS 'Materialized path for fast ancestor/descendant queries. Auto-maintained by trigger.';
COMMENT ON COLUMN document_sections.path_ordinals IS 'Ordinal path for natural sorting (e.g., [1,2,3] = 1.2.3)';

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

    -- Verify parent is in same document
    IF NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM document_sections
      WHERE id = NEW.parent_section_id
      AND document_id = NEW.document_id
    ) THEN
      RAISE EXCEPTION 'Parent section must be in the same document';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();

-- ============================================================================
-- PART 5: CONFIGURABLE WORKFLOWS
-- ============================================================================

-- Organization-specific workflow definitions
CREATE TABLE workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(organization_id, name)
);

CREATE INDEX idx_workflow_templates_org ON workflow_templates(organization_id);
CREATE INDEX idx_workflow_templates_default ON workflow_templates(organization_id, is_default) WHERE is_default = TRUE;

COMMENT ON TABLE workflow_templates IS 'Configurable N-stage approval workflows. Replaces hardcoded committee/board model.';

-- Workflow stages (replaces hardcoded locked_by_committee/board_approved)
CREATE TABLE workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,

  -- Stage definition
  stage_name VARCHAR(100) NOT NULL, -- "Committee Review", "Board Approval", "Legal Review"
  stage_order INTEGER NOT NULL, -- 1, 2, 3... (sequential progression)

  -- Capabilities
  can_lock BOOLEAN DEFAULT TRUE, -- Can lock sections at this stage
  can_edit BOOLEAN DEFAULT FALSE, -- Can edit section text at this stage
  can_approve BOOLEAN DEFAULT TRUE, -- Can approve/reject at this stage
  requires_approval BOOLEAN DEFAULT TRUE, -- Must be approved to progress

  -- Required roles for this stage (JSONB array)
  required_roles JSONB DEFAULT '["admin"]'::jsonb, -- Roles that can action this stage

  -- Display
  display_color VARCHAR(7), -- Hex color: "#FFD700"
  icon VARCHAR(50), -- Icon identifier
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workflow_template_id, stage_order),
  UNIQUE(workflow_template_id, stage_name),
  CHECK(stage_order > 0)
);

CREATE INDEX idx_workflow_stages_template ON workflow_stages(workflow_template_id, stage_order);
CREATE INDEX idx_workflow_stages_order ON workflow_stages(workflow_template_id, stage_order);

COMMENT ON TABLE workflow_stages IS 'Individual stages within a workflow. Defines capabilities and requirements for each approval step.';

-- Document uses a specific workflow
CREATE TABLE document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  activated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(document_id) -- One workflow per document
);

CREATE INDEX idx_document_workflows_doc ON document_workflows(document_id);
CREATE INDEX idx_document_workflows_template ON document_workflows(workflow_template_id);

-- Section state tracking (replaces locked_by_committee/board_approved columns)
CREATE TABLE section_workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  workflow_stage_id UUID NOT NULL REFERENCES workflow_stages(id),

  -- State
  status VARCHAR(50) NOT NULL, -- 'pending', 'approved', 'rejected', 'locked', 'in_progress'

  -- Action metadata
  actioned_by UUID REFERENCES users(id),
  actioned_by_email VARCHAR(255), -- For backward compatibility
  actioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  selected_suggestion_id UUID, -- Will reference suggestions(id) - added later

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(section_id, workflow_stage_id)
);

CREATE INDEX idx_section_states_section ON section_workflow_states(section_id);
CREATE INDEX idx_section_states_stage ON section_workflow_states(workflow_stage_id);
CREATE INDEX idx_section_states_status ON section_workflow_states(section_id, status);
CREATE INDEX idx_section_states_actioned_by ON section_workflow_states(actioned_by);

COMMENT ON TABLE section_workflow_states IS 'Tracks approval state for each section at each workflow stage. Provides audit trail.';

-- ============================================================================
-- PART 6: SUGGESTIONS AND VOTES
-- ============================================================================

CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-section support (via junction table)
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  is_multi_section BOOLEAN DEFAULT FALSE,

  -- Content
  suggested_text TEXT,
  rationale TEXT,

  -- Author (flexible to support public submissions)
  author_user_id UUID REFERENCES users(id),
  author_email VARCHAR(255), -- For public submissions without accounts
  author_name VARCHAR(255),

  -- External integration
  google_suggestion_id VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'selected', 'rejected', 'merged', 'withdrawn'
  support_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  article_scope VARCHAR(255), -- e.g., "Article III" (for multi-section)
  section_range VARCHAR(255), -- e.g., "Sections 2-5" (for multi-section)

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_suggestions_doc ON suggestions(document_id);
CREATE INDEX idx_suggestions_author ON suggestions(author_user_id);
CREATE INDEX idx_suggestions_status ON suggestions(document_id, status);
CREATE INDEX idx_suggestions_google ON suggestions(google_suggestion_id) WHERE google_suggestion_id IS NOT NULL;

COMMENT ON TABLE suggestions IS 'Amendment suggestions. Can apply to single or multiple sections via junction table.';

-- Add foreign key constraint for selected_suggestion_id
ALTER TABLE section_workflow_states
  ADD CONSTRAINT fk_selected_suggestion
  FOREIGN KEY (selected_suggestion_id)
  REFERENCES suggestions(id)
  ON DELETE SET NULL;

-- Junction table for multi-section suggestions
CREATE TABLE suggestion_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL, -- Order within the suggestion (1, 2, 3...)

  UNIQUE(suggestion_id, section_id),
  UNIQUE(suggestion_id, ordinal)
);

CREATE INDEX idx_suggestion_sections_suggestion ON suggestion_sections(suggestion_id);
CREATE INDEX idx_suggestion_sections_section ON suggestion_sections(section_id);
CREATE INDEX idx_suggestion_sections_ordinal ON suggestion_sections(suggestion_id, ordinal);

COMMENT ON TABLE suggestion_sections IS 'Maps suggestions to one or more sections. Enables range-based amendments.';

-- Votes table
CREATE TABLE suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255), -- For public voting without accounts

  vote_type VARCHAR(20) DEFAULT 'support', -- 'support', 'oppose', 'neutral'
  is_preferred BOOLEAN DEFAULT FALSE, -- User's preferred suggestion among alternatives

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(suggestion_id, user_id),
  UNIQUE(suggestion_id, user_email)
);

CREATE INDEX idx_votes_suggestion ON suggestion_votes(suggestion_id);
CREATE INDEX idx_votes_user ON suggestion_votes(user_id);
CREATE INDEX idx_votes_type ON suggestion_votes(suggestion_id, vote_type);

-- ============================================================================
-- PART 7: USEFUL VIEWS FOR QUERIES
-- ============================================================================

-- View: Suggestions with section details
CREATE OR REPLACE VIEW v_suggestions_with_sections AS
SELECT
  s.*,
  ARRAY_AGG(ss.section_id ORDER BY ss.ordinal) as section_ids,
  STRING_AGG(ds.section_number || ' - ' || ds.section_title, ', ' ORDER BY ss.ordinal) as section_citations,
  COUNT(ss.section_id) as section_count
FROM suggestions s
LEFT JOIN suggestion_sections ss ON s.id = ss.suggestion_id
LEFT JOIN document_sections ds ON ss.section_id = ds.id
GROUP BY s.id;

COMMENT ON VIEW v_suggestions_with_sections IS 'Denormalized view of suggestions with aggregated section information';

-- View: Section workflow progress
CREATE OR REPLACE VIEW v_section_workflow_progress AS
SELECT
  ds.id as section_id,
  ds.document_id,
  ds.section_number,
  ds.section_title,
  d.organization_id,
  wt.name as workflow_name,
  ws.stage_name as current_stage,
  ws.stage_order as current_stage_order,
  sws.status as stage_status,
  sws.actioned_by,
  sws.actioned_at,
  (SELECT MAX(stage_order) FROM workflow_stages WHERE workflow_template_id = wt.id) as total_stages,
  ws.stage_order::float / (SELECT MAX(stage_order) FROM workflow_stages WHERE workflow_template_id = wt.id) as progress_percentage
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
LEFT JOIN document_workflows dw ON d.id = dw.document_id
LEFT JOIN workflow_templates wt ON dw.workflow_template_id = wt.id
LEFT JOIN section_workflow_states sws ON ds.id = sws.section_id
LEFT JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.status IN ('approved', 'locked', 'in_progress')
ORDER BY ds.path_ordinals;

COMMENT ON VIEW v_section_workflow_progress IS 'Shows current workflow stage and progress for all sections';

-- ============================================================================
-- PART 8: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_workflow_states ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see orgs they belong to
CREATE POLICY "Users see own organizations"
  ON organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Documents: Users can only access documents in their organizations
CREATE POLICY "Users see own organization documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- Document Sections: Inherit from documents
CREATE POLICY "Users see sections in accessible documents"
  ON document_sections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
      AND uo.user_id = auth.uid()
    )
  );

-- Suggestions: Inherit from documents
CREATE POLICY "Users see suggestions in accessible documents"
  ON suggestions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = suggestions.document_id
      AND uo.user_id = auth.uid()
    )
  );

-- Allow public to create suggestions (if enabled in org settings)
CREATE POLICY "Public can create suggestions"
  ON suggestions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = suggestions.document_id
      AND (o.settings->>'allow_public_suggestions')::boolean = true
    )
    OR
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = suggestions.document_id
      AND uo.user_id = auth.uid()
    )
  );

-- Workflow templates: Organization-scoped
CREATE POLICY "Users see own organization workflows"
  ON workflow_templates
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE organizations IS '✅ RLS Enabled: Users see only organizations they belong to';
COMMENT ON TABLE documents IS '✅ RLS Enabled: Organization-scoped access';
COMMENT ON TABLE document_sections IS '✅ RLS Enabled: Inherits from documents';

-- ============================================================================
-- PART 9: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get section breadcrumb path
CREATE OR REPLACE FUNCTION get_section_breadcrumb(section_uuid UUID)
RETURNS TABLE (
  section_id UUID,
  section_number VARCHAR,
  section_title TEXT,
  depth INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.section_number,
    ds.section_title,
    ds.depth
  FROM document_sections ds
  WHERE ds.id = ANY((
    SELECT path_ids
    FROM document_sections
    WHERE id = section_uuid
  ))
  ORDER BY array_position((
    SELECT path_ids
    FROM document_sections
    WHERE id = section_uuid
  ), ds.id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_section_breadcrumb IS 'Returns full breadcrumb path for a section (e.g., Article I > Section 2 > Subsection A)';

-- Function: Get all descendants of a section
CREATE OR REPLACE FUNCTION get_section_descendants(section_uuid UUID)
RETURNS TABLE (
  section_id UUID,
  section_number VARCHAR,
  section_title TEXT,
  depth INTEGER,
  relative_depth INTEGER
) AS $$
DECLARE
  base_depth INTEGER;
BEGIN
  SELECT depth INTO base_depth FROM document_sections WHERE id = section_uuid;

  RETURN QUERY
  SELECT
    ds.id,
    ds.section_number,
    ds.section_title,
    ds.depth,
    ds.depth - base_depth as relative_depth
  FROM document_sections ds
  WHERE section_uuid = ANY(ds.path_ids)
    AND ds.id != section_uuid
  ORDER BY ds.path_ordinals;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_section_descendants IS 'Returns all descendant sections in tree order';

-- ============================================================================
-- PART 10: SEED DATA FOR DEFAULT WORKFLOWS
-- ============================================================================

-- This will be populated during migration from existing data
-- See migration script for population logic

-- ============================================================================
-- SUMMARY OF CHANGES FROM OLD SCHEMA
-- ============================================================================
--
-- REPLACED:
-- - bylaw_sections.doc_id → document_sections.document_id (+ organization context)
-- - bylaw_sections.section_citation → document_sections.section_number + section_type
-- - bylaw_sections.locked_by_committee → section_workflow_states (stage 1)
-- - bylaw_sections.board_approved → section_workflow_states (stage 2)
-- - bylaw_sections.new_text/final_text → document_sections.current_text (simplified)
-- - bylaw_suggestions.section_id → suggestion_sections (many-to-many)
--
-- ADDED:
-- - organizations: Multi-tenant root
-- - users, user_organizations: Proper user management
-- - documents: Document metadata and versioning
-- - document_sections.path_ids/path_ordinals: Fast hierarchy queries
-- - workflow_templates, workflow_stages: Configurable N-stage workflows
-- - section_workflow_states: Audit trail of all approvals
-- - RLS policies: Tenant isolation at database level
--
-- BENEFITS:
-- ✅ Support multiple organizations on single database
-- ✅ Arbitrary hierarchy depths (not just Article/Section)
-- ✅ Configurable approval workflows (not just 2-stage)
-- ✅ Better performance with materialized paths
-- ✅ Comprehensive audit trail
-- ✅ Future-proof for new features (versioning, templates, etc.)
--
-- ============================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Generalized Schema Created Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Schema version: 2.0.0';
  RAISE NOTICE 'Multi-tenancy: Enabled with RLS';
  RAISE NOTICE 'Hierarchy: Flexible adjacency list + materialized path';
  RAISE NOTICE 'Workflows: Configurable N-stage state machine';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run migration script to populate from old schema';
  RAISE NOTICE '2. Update application code to use new tables';
  RAISE NOTICE '3. Configure RLS policies for your auth setup';
  RAISE NOTICE '4. Create default workflows for organizations';
  RAISE NOTICE '========================================';
END $$;
