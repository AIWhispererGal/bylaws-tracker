-- Migration 021: Document Workflow Progression
-- Date: 2025-10-19
-- Purpose: Add workflow progression capabilities to document versioning system
-- Depends on: Migration 008 (workflow system), Migration 012 (workflow enhancements)

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
  ON document_versions(document_id, workflow_stage)
  WHERE workflow_stage IS NOT NULL;

-- Index for current version lookup (partial index for fast queries)
CREATE INDEX IF NOT EXISTS idx_document_versions_current
  ON document_versions(document_id)
  WHERE is_current = TRUE;

-- Index for published versions
CREATE INDEX IF NOT EXISTS idx_document_versions_published
  ON document_versions(document_id, published_at DESC)
  WHERE is_published = TRUE;

-- Index for version creation timestamp (for recent versions queries)
CREATE INDEX IF NOT EXISTS idx_document_versions_created
  ON document_versions(document_id, created_at DESC);

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
  major_ver := COALESCE(NULLIF(split_part(current_version, '.', 1), '')::INTEGER, 1);
  minor_ver := COALESCE(NULLIF(split_part(current_version, '.', 2), '')::INTEGER, 0);

  -- Increment minor version
  minor_ver := minor_ver + 1;

  RETURN major_ver || '.' || minor_ver;
EXCEPTION
  WHEN OTHERS THEN
    -- Default to incrementing from 1.0
    RETURN '1.1';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION increment_version IS
  'Increment version number from "1.2" to "1.3". Handles edge cases like empty strings and invalid formats.';

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
  v_version_number := increment_version(COALESCE(v_current_version, '1.0'));

  -- Mark all previous versions as not current (atomic operation)
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
    COALESCE(p_version_name, ''),
    COALESCE(p_description, ''),
    COALESCE(p_sections_snapshot, '[]'::jsonb),
    COALESCE(p_approval_snapshot, '[]'::jsonb),
    COALESCE(p_applied_suggestions, '[]'::jsonb),
    p_workflow_stage,
    p_workflow_template_id,
    p_created_by,
    p_created_by_email,
    TRUE, -- is_current
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
  'Atomically create new document version with snapshots and update document record.
   This function is SECURITY DEFINER to allow version creation even with RLS enabled.
   Handles marking previous versions as not current, generating version numbers, and updating document record.';

-- ============================================================================
-- PART 4: ADD STATUS TRACKING TO SUGGESTIONS TABLE
-- ============================================================================

-- Add status tracking for when suggestions are implemented
DO $$
BEGIN
  -- Add implemented_in_version column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suggestions' AND column_name = 'implemented_in_version'
  ) THEN
    ALTER TABLE suggestions
    ADD COLUMN implemented_in_version UUID REFERENCES document_versions(id);

    COMMENT ON COLUMN suggestions.implemented_in_version IS
      'Reference to document_version where this suggestion was applied and implemented';
  END IF;

  -- Add implemented_at timestamp if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suggestions' AND column_name = 'implemented_at'
  ) THEN
    ALTER TABLE suggestions
    ADD COLUMN implemented_at TIMESTAMP;

    COMMENT ON COLUMN suggestions.implemented_at IS
      'Timestamp when suggestion was implemented in a document version';
  END IF;
END $$;

-- Create index for finding implemented suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_implemented
  ON suggestions(implemented_in_version)
  WHERE implemented_in_version IS NOT NULL;

-- Create index for suggestions by status and implementation
CREATE INDEX IF NOT EXISTS idx_suggestions_status_implemented
  ON suggestions(status, implemented_at DESC)
  WHERE status = 'implemented';

-- ============================================================================
-- PART 5: UPDATE RLS POLICIES FOR DOCUMENT_VERSIONS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users see org document versions" ON document_versions;
DROP POLICY IF EXISTS "Admins create document versions" ON document_versions;
DROP POLICY IF EXISTS "Admins update document versions" ON document_versions;

-- Policy: Users can see document versions for their organization
CREATE POLICY "Users see org document versions"
  ON document_versions FOR SELECT
  USING (
    -- Global admins see everything
    is_global_admin(auth.uid()) OR
    -- Users see versions for documents in their organization
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_versions.document_id
        AND uo.user_id = auth.uid()
        AND uo.is_active = TRUE
    )
  );

-- Policy: Only admins and owners can create versions
CREATE POLICY "Admins create document versions"
  ON document_versions FOR INSERT
  WITH CHECK (
    -- Global admins can create versions for any document
    is_global_admin(auth.uid()) OR
    -- Admins and owners can create versions for their org's documents
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_versions.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
        AND uo.is_active = TRUE
    )
  );

-- Policy: Only admins and owners can update versions (for marking published, etc.)
CREATE POLICY "Admins update document versions"
  ON document_versions FOR UPDATE
  USING (
    -- Global admins can update any version
    is_global_admin(auth.uid()) OR
    -- Admins and owners can update versions for their org's documents
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
-- PART 6: CREATE VIEW FOR VERSION SUMMARY
-- ============================================================================

-- Create a view for efficient version summary queries (without heavy JSONB data)
CREATE OR REPLACE VIEW document_version_summary AS
SELECT
  dv.id,
  dv.document_id,
  dv.version_number,
  dv.version_name,
  dv.description,
  dv.workflow_stage,
  dv.workflow_template_id,
  dv.is_current,
  dv.is_published,
  dv.published_at,
  dv.created_by,
  dv.created_by_email,
  dv.created_at,
  dv.approved_at,
  dv.approved_by,
  dv.approval_stage,
  -- Count applied suggestions without loading full JSONB
  jsonb_array_length(COALESCE(dv.applied_suggestions, '[]'::jsonb)) as applied_suggestions_count,
  -- Document info
  d.title as document_title,
  d.organization_id,
  -- Creator info
  u.email as creator_email,
  u.id as creator_id
FROM document_versions dv
JOIN documents d ON dv.document_id = d.id
LEFT JOIN auth.users u ON dv.created_by = u.id;

COMMENT ON VIEW document_version_summary IS
  'Optimized view for listing document versions without loading heavy JSONB snapshots.
   Use this for version lists and summaries. For full version data including snapshots, query document_versions directly.';

-- ============================================================================
-- PART 7: ADD TRIGGER FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_document_versions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_document_versions_timestamp ON document_versions;
CREATE TRIGGER trigger_update_document_versions_timestamp
  BEFORE UPDATE ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_document_versions_timestamp();

COMMENT ON TRIGGER trigger_update_document_versions_timestamp ON document_versions IS
  'Automatically update updated_at timestamp when document_versions row is modified';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_name = 'document_versions'
    AND column_name IN ('applied_suggestions', 'workflow_stage', 'workflow_template_id');

  IF v_count < 3 THEN
    RAISE EXCEPTION 'Migration 021 verification failed: Missing columns in document_versions';
  END IF;

  RAISE NOTICE 'Migration 021 verification passed: All columns present in document_versions';
END $$;

-- Verify indexes were created
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_indexes
  WHERE tablename = 'document_versions'
    AND indexname IN (
      'idx_document_versions_workflow_stage',
      'idx_document_versions_current',
      'idx_document_versions_published',
      'idx_document_versions_created'
    );

  IF v_count < 4 THEN
    RAISE EXCEPTION 'Migration 021 verification failed: Missing indexes on document_versions';
  END IF;

  RAISE NOTICE 'Migration 021 verification passed: All indexes created on document_versions';
END $$;

-- Verify functions were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_version'
  ) THEN
    RAISE EXCEPTION 'Migration 021 verification failed: increment_version function not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_document_version'
  ) THEN
    RAISE EXCEPTION 'Migration 021 verification failed: create_document_version function not found';
  END IF;

  RAISE NOTICE 'Migration 021 verification passed: All functions created';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- To rollback this migration, run the following SQL:
/*

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
DROP FUNCTION IF EXISTS create_document_version(UUID, VARCHAR, TEXT, JSONB, JSONB, JSONB, VARCHAR, UUID, UUID, VARCHAR);
DROP FUNCTION IF EXISTS increment_version(VARCHAR);

-- Drop indexes
DROP INDEX IF EXISTS idx_suggestions_status_implemented;
DROP INDEX IF EXISTS idx_suggestions_implemented;
DROP INDEX IF EXISTS idx_document_versions_created;
DROP INDEX IF EXISTS idx_document_versions_published;
DROP INDEX IF EXISTS idx_document_versions_current;
DROP INDEX IF EXISTS idx_document_versions_workflow_stage;

-- Drop columns from suggestions
ALTER TABLE suggestions DROP COLUMN IF EXISTS implemented_at;
ALTER TABLE suggestions DROP COLUMN IF EXISTS implemented_in_version;

-- Drop columns from document_versions
ALTER TABLE document_versions DROP COLUMN IF EXISTS workflow_template_id;
ALTER TABLE document_versions DROP COLUMN IF EXISTS workflow_stage;
ALTER TABLE document_versions DROP COLUMN IF EXISTS applied_suggestions;

*/
