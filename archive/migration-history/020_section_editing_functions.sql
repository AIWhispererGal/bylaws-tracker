-- =====================================================
-- Migration 020: Section Editing Helper Functions
-- Purpose: Add database functions for section CRUD operations
-- Date: October 18, 2025
-- =====================================================

-- =====================================================
-- FUNCTION 1: Increment Sibling Ordinals
-- Purpose: Shift ordinals UP to make space for new sections
-- =====================================================
CREATE OR REPLACE FUNCTION increment_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_increment_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update ordinals for siblings at or after start_ordinal
  UPDATE document_sections
  SET ordinal = ordinal + p_increment_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal >= p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION increment_sibling_ordinals IS
'Increments ordinals of sibling sections starting from a given ordinal. Used when inserting sections between existing ones.';

-- =====================================================
-- FUNCTION 2: Decrement Sibling Ordinals
-- Purpose: Shift ordinals DOWN to close gaps after deletion
-- =====================================================
CREATE OR REPLACE FUNCTION decrement_sibling_ordinals(
  p_parent_id UUID,
  p_start_ordinal INTEGER,
  p_decrement_by INTEGER DEFAULT 1
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update ordinals for siblings after start_ordinal
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal > p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION decrement_sibling_ordinals IS
'Decrements ordinals of sibling sections after a given ordinal. Used when deleting sections to close gaps.';

-- =====================================================
-- FUNCTION 3: Relocate Suggestions
-- Purpose: Move all suggestions from one section to another
-- =====================================================
CREATE OR REPLACE FUNCTION relocate_suggestions(
  p_old_section_id UUID,
  p_new_section_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_relocated_count INTEGER;
BEGIN
  -- Update section_id in suggestion_sections junction table
  UPDATE suggestion_sections
  SET section_id = p_new_section_id,
      updated_at = NOW()
  WHERE section_id = p_old_section_id;

  GET DIAGNOSTICS v_relocated_count = ROW_COUNT;

  -- Also update direct section references in suggestions table if any
  UPDATE suggestions
  SET section_id = p_new_section_id,
      updated_at = NOW()
  WHERE section_id = p_old_section_id;

  RETURN v_relocated_count;
END;
$$;

COMMENT ON FUNCTION relocate_suggestions IS
'Moves all suggestions from old_section_id to new_section_id. Used during section merge or split operations.';

-- =====================================================
-- FUNCTION 4: Validate Section Editable
-- Purpose: Check if section can be edited (not locked/approved)
-- =====================================================
CREATE OR REPLACE FUNCTION validate_section_editable(
  p_section_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_is_approved BOOLEAN;
BEGIN
  -- Check if section is locked
  SELECT is_locked INTO v_is_locked
  FROM document_sections
  WHERE id = p_section_id;

  -- If section doesn't exist, return false
  IF v_is_locked IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If section is locked, return false
  IF v_is_locked = TRUE THEN
    RETURN FALSE;
  END IF;

  -- Check workflow states
  SELECT EXISTS (
    SELECT 1 FROM section_workflow_states
    WHERE section_id = p_section_id
      AND status IN ('locked', 'approved')
  ) INTO v_is_approved;

  -- Return true only if not locked and not approved
  RETURN NOT v_is_approved;
END;
$$;

COMMENT ON FUNCTION validate_section_editable IS
'Returns TRUE if section can be edited (not locked or approved in workflow). Returns FALSE otherwise.';

-- =====================================================
-- FUNCTION 5: Get Descendants
-- Purpose: Get all descendant sections for a given section
-- =====================================================
CREATE OR REPLACE FUNCTION get_descendants(
  p_section_id UUID
) RETURNS TABLE (
  id UUID,
  depth INTEGER,
  section_number VARCHAR,
  section_title TEXT,
  ordinal INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.depth,
    ds.section_number,
    ds.section_title,
    ds.ordinal
  FROM document_sections ds
  WHERE p_section_id = ANY(ds.path_ids)
    AND ds.id != p_section_id
  ORDER BY ds.path_ordinals;
END;
$$;

COMMENT ON FUNCTION get_descendants IS
'Returns all descendant sections using materialized path. Used for cascade operations like delete.';

-- =====================================================
-- FUNCTION 6: Get Siblings Count
-- Purpose: Count siblings for ordinal validation
-- =====================================================
CREATE OR REPLACE FUNCTION get_siblings_count(
  p_parent_id UUID,
  p_document_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM document_sections
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND document_id = p_document_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION get_siblings_count IS
'Returns count of sibling sections for a given parent. Used for ordinal validation.';

-- =====================================================
-- RLS POLICIES FOR SECTION EDITING
-- =====================================================

-- Allow admins to UPDATE sections in own organization
DROP POLICY IF EXISTS "Admins can edit sections" ON document_sections;
CREATE POLICY "Admins can edit sections"
  ON document_sections
  FOR UPDATE
  USING (
    -- Org admin or owner
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
    )
    OR
    -- Global admin
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_global_admin = TRUE
    )
  );

-- Allow admins to INSERT sections in own organization
DROP POLICY IF EXISTS "Admins can create sections" ON document_sections;
CREATE POLICY "Admins can create sections"
  ON document_sections FOR INSERT
  WITH CHECK (
    -- Org admin or owner
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
    )
    OR
    -- Global admin
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_global_admin = TRUE
    )
  );

-- Allow admins to DELETE sections in own organization
DROP POLICY IF EXISTS "Admins can delete sections" ON document_sections;
CREATE POLICY "Admins can delete sections"
  ON document_sections FOR DELETE
  USING (
    -- Org admin or owner
    EXISTS (
      SELECT 1 FROM documents d
      JOIN user_organizations uo ON d.organization_id = uo.organization_id
      WHERE d.id = document_sections.document_id
        AND uo.user_id = auth.uid()
        AND uo.role IN ('admin', 'owner')
    )
    OR
    -- Global admin
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_global_admin = TRUE
    )
  );

-- =====================================================
-- TEST QUERIES (Comment out before production)
-- =====================================================

/*
-- Test increment_sibling_ordinals
SELECT increment_sibling_ordinals(
  NULL::UUID,  -- Root level sections
  2,           -- Start at ordinal 2
  1            -- Increment by 1
);

-- Test decrement_sibling_ordinals
SELECT decrement_sibling_ordinals(
  NULL::UUID,  -- Root level sections
  2,           -- Start after ordinal 2
  1            -- Decrement by 1
);

-- Test validate_section_editable
SELECT validate_section_editable('some-section-uuid'::UUID);

-- Test get_descendants
SELECT * FROM get_descendants('some-section-uuid'::UUID);

-- Test get_siblings_count
SELECT get_siblings_count(NULL::UUID, 'some-doc-uuid'::UUID);
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Migration 020: Section editing helper functions added. Ready for section CRUD operations.';
