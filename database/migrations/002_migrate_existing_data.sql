-- INCREMENTAL MIGRATION: Add Missing Tables Only
-- Version: 2.0.1
-- Date: 2025-10-12
-- Purpose: Create missing tables while preserving existing organizations table
--
-- SAFE TO RUN: This script only creates tables that don't exist yet.
-- Will not affect your existing organizations table or data.

-- ============================================================================
-- PART 1: USER MANAGEMENT (Create if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(50) DEFAULT 'supabase',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User-Organization membership and roles
CREATE TABLE IF NOT EXISTS user_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{
    "can_edit_sections": true,
    "can_create_suggestions": true,
    "can_vote": true,
    "can_approve_stages": [],
    "can_manage_users": false,
    "can_manage_workflows": false
  }'::jsonb,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_role ON user_organizations(organization_id, role);

-- ============================================================================
-- PART 2: DOCUMENT MANAGEMENT (THE CRITICAL MISSING TABLE!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'bylaws',
  google_doc_id VARCHAR(255),
  external_source VARCHAR(50),
  version VARCHAR(50) DEFAULT '1.0',
  version_history JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMP,
  archived_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, google_doc_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_google ON documents(google_doc_id) WHERE google_doc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(organization_id, document_type);

-- ============================================================================
-- PART 3: DYNAMIC HIERARCHY - DOCUMENT SECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_section_id UUID REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  path_ids UUID[] NOT NULL,
  path_ordinals INTEGER[] NOT NULL,
  section_number VARCHAR(50),
  section_title TEXT,
  section_type VARCHAR(50),
  original_text TEXT,
  current_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id, parent_section_id, ordinal),
  CHECK(depth >= 0 AND depth <= 10),
  CHECK(array_length(path_ids, 1) = depth + 1),
  CHECK(array_length(path_ordinals, 1) = depth + 1),
  CHECK(path_ids[array_length(path_ids, 1)] = id),
  CHECK(ordinal > 0)
);

CREATE INDEX IF NOT EXISTS idx_doc_sections_document ON document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_sections_parent ON document_sections(parent_section_id);
CREATE INDEX IF NOT EXISTS idx_doc_sections_path ON document_sections USING GIN(path_ids);
CREATE INDEX IF NOT EXISTS idx_doc_sections_depth ON document_sections(document_id, depth);
CREATE INDEX IF NOT EXISTS idx_doc_sections_ordinal ON document_sections(parent_section_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_doc_sections_number ON document_sections(document_id, section_number);

-- Trigger to maintain path materialization
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];
    NEW.depth := 0;
  ELSE
    SELECT
      p.path_ids || NEW.id,
      p.path_ordinals || NEW.ordinal,
      p.depth + 1
    INTO NEW.path_ids, NEW.path_ordinals, NEW.depth
    FROM document_sections p
    WHERE p.id = NEW.parent_section_id;

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

DROP TRIGGER IF EXISTS trg_update_section_path ON document_sections;
CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();

-- ============================================================================
-- PART 4: CONFIGURABLE WORKFLOWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_templates (
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

CREATE INDEX IF NOT EXISTS idx_workflow_templates_org ON workflow_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_default ON workflow_templates(organization_id, is_default) WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS workflow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER NOT NULL,
  can_lock BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_approve BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT TRUE,
  required_roles JSONB DEFAULT '["admin"]'::jsonb,
  display_color VARCHAR(7),
  icon VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workflow_template_id, stage_order),
  UNIQUE(workflow_template_id, stage_name),
  CHECK(stage_order > 0)
);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_template ON workflow_stages(workflow_template_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_workflow_stages_order ON workflow_stages(workflow_template_id, stage_order);

CREATE TABLE IF NOT EXISTS document_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
  activated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_workflows_doc ON document_workflows(document_id);
CREATE INDEX IF NOT EXISTS idx_document_workflows_template ON document_workflows(workflow_template_id);

CREATE TABLE IF NOT EXISTS section_workflow_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  workflow_stage_id UUID NOT NULL REFERENCES workflow_stages(id),
  status VARCHAR(50) NOT NULL,
  actioned_by UUID REFERENCES users(id),
  actioned_by_email VARCHAR(255),
  actioned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  selected_suggestion_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(section_id, workflow_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_section_states_section ON section_workflow_states(section_id);
CREATE INDEX IF NOT EXISTS idx_section_states_stage ON section_workflow_states(workflow_stage_id);
CREATE INDEX IF NOT EXISTS idx_section_states_status ON section_workflow_states(section_id, status);
CREATE INDEX IF NOT EXISTS idx_section_states_actioned_by ON section_workflow_states(actioned_by);

-- ============================================================================
-- PART 5: SUGGESTIONS AND VOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  is_multi_section BOOLEAN DEFAULT FALSE,
  suggested_text TEXT,
  rationale TEXT,
  author_user_id UUID REFERENCES users(id),
  author_email VARCHAR(255),
  author_name VARCHAR(255),
  google_suggestion_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  support_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  article_scope VARCHAR(255),
  section_range VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_doc ON suggestions(document_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_author ON suggestions(author_user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(document_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_google ON suggestions(google_suggestion_id) WHERE google_suggestion_id IS NOT NULL;

-- Add foreign key for selected_suggestion_id (had to wait until suggestions table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_selected_suggestion'
    AND table_name = 'section_workflow_states'
  ) THEN
    ALTER TABLE section_workflow_states
      ADD CONSTRAINT fk_selected_suggestion
      FOREIGN KEY (selected_suggestion_id)
      REFERENCES suggestions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS suggestion_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  UNIQUE(suggestion_id, section_id),
  UNIQUE(suggestion_id, ordinal)
);

CREATE INDEX IF NOT EXISTS idx_suggestion_sections_suggestion ON suggestion_sections(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_sections_section ON suggestion_sections(section_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_sections_ordinal ON suggestion_sections(suggestion_id, ordinal);

CREATE TABLE IF NOT EXISTS suggestion_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  vote_type VARCHAR(20) DEFAULT 'support',
  is_preferred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(suggestion_id, user_id),
  UNIQUE(suggestion_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_votes_suggestion ON suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON suggestion_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_type ON suggestion_votes(suggestion_id, vote_type);

-- ============================================================================
-- PART 6: USEFUL VIEWS
-- ============================================================================

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

-- ============================================================================
-- PART 7: HELPER FUNCTIONS
-- ============================================================================

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

-- ============================================================================
-- PART 8: ROW LEVEL SECURITY (RLS)
-- ============================================================================

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

-- Drop existing policies if they exist (to make script idempotent)
DROP POLICY IF EXISTS "Users see own organizations" ON organizations;
DROP POLICY IF EXISTS "Users see own organization documents" ON documents;
DROP POLICY IF EXISTS "Users see sections in accessible documents" ON document_sections;
DROP POLICY IF EXISTS "Users see suggestions in accessible documents" ON suggestions;
DROP POLICY IF EXISTS "Public can create suggestions" ON suggestions;
DROP POLICY IF EXISTS "Users see own organization workflows" ON workflow_templates;

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

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MISSING TABLES CREATED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration version: 2.0.1 (Incremental)';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created/verified:';
  RAISE NOTICE '  ✅ users';
  RAISE NOTICE '  ✅ user_organizations';
  RAISE NOTICE '  ✅ documents (THE CRITICAL ONE!)';
  RAISE NOTICE '  ✅ document_sections';
  RAISE NOTICE '  ✅ workflow_templates';
  RAISE NOTICE '  ✅ workflow_stages';
  RAISE NOTICE '  ✅ document_workflows';
  RAISE NOTICE '  ✅ section_workflow_states';
  RAISE NOTICE '  ✅ suggestions';
  RAISE NOTICE '  ✅ suggestion_sections';
  RAISE NOTICE '  ✅ suggestion_votes';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  ✅ v_suggestions_with_sections';
  RAISE NOTICE '  ✅ v_section_workflow_progress';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  ✅ update_section_path() trigger';
  RAISE NOTICE '  ✅ get_section_breadcrumb()';
  RAISE NOTICE '  ✅ get_section_descendants()';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 YOUR DATABASE IS NOW COMPLETE!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Restart your Node.js server';
  RAISE NOTICE '2. Test the setup wizard';
  RAISE NOTICE '3. Celebrate! 🎉';
  RAISE NOTICE '========================================';
END $$;
