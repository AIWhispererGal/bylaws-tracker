-- Migration 009: Add Section Editing RPC Functions
-- ============================================================================
--
-- ISSUE: Indent/dedent/move operations fail with "function not found" errors
-- ROOT CAUSE: RPC functions were designed but never deployed to production
-- FIX: Deploy the 3 critical RPC functions for section ordinal management
--
-- Created: 2025-10-23
-- Based on: archive/migration-history/020_section_editing_functions.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCTION 1: Increment Sibling Ordinals
-- Purpose: Shift ordinals UP to make space for new sections
-- ============================================================================

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

GRANT EXECUTE ON FUNCTION increment_sibling_ordinals(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_sibling_ordinals(UUID, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION increment_sibling_ordinals IS
'Increments ordinals of sibling sections starting from a given ordinal. Used when inserting sections between existing ones.';

-- ============================================================================
-- FUNCTION 2: Decrement Sibling Ordinals
-- Purpose: Shift ordinals DOWN to close gaps after deletion/indent
-- ============================================================================

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
  -- Update ordinals for siblings AFTER start_ordinal (close the gap)
  UPDATE document_sections
  SET ordinal = ordinal - p_decrement_by,
      updated_at = NOW()
  WHERE parent_section_id IS NOT DISTINCT FROM p_parent_id
    AND ordinal > p_start_ordinal;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_sibling_ordinals(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_sibling_ordinals(UUID, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION decrement_sibling_ordinals IS
'Decrements ordinals of sibling sections after a given ordinal. Used when deleting sections or indenting to close gaps.';

-- ============================================================================
-- FUNCTION 3: Swap Sibling Ordinals
-- Purpose: Swap ordinals between two sections for move up/down operations
-- ============================================================================

CREATE OR REPLACE FUNCTION swap_sibling_ordinals(
  p_section_id_1 UUID,
  p_section_id_2 UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_ordinal_1 INTEGER;
  v_ordinal_2 INTEGER;
  v_parent_1 UUID;
  v_parent_2 UUID;
BEGIN
  -- Get ordinals and parents of both sections
  SELECT ordinal, parent_section_id INTO v_ordinal_1, v_parent_1
  FROM document_sections WHERE id = p_section_id_1;

  SELECT ordinal, parent_section_id INTO v_ordinal_2, v_parent_2
  FROM document_sections WHERE id = p_section_id_2;

  -- Safety check: sections must have same parent
  IF v_parent_1 IS DISTINCT FROM v_parent_2 THEN
    RAISE EXCEPTION 'Cannot swap sections with different parents';
  END IF;

  -- Swap ordinals
  UPDATE document_sections
  SET ordinal = v_ordinal_2, updated_at = NOW()
  WHERE id = p_section_id_1;

  UPDATE document_sections
  SET ordinal = v_ordinal_1, updated_at = NOW()
  WHERE id = p_section_id_2;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION swap_sibling_ordinals(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION swap_sibling_ordinals(UUID, UUID) TO service_role;

COMMENT ON FUNCTION swap_sibling_ordinals IS
'Swaps ordinals between two sibling sections. Used for move up/down operations. Validates sections have same parent.';

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test the functions)
-- ============================================================================

-- To test, run these commands:

-- 1. Verify functions exist:
--    SELECT routine_name, routine_type
--    FROM information_schema.routines
--    WHERE routine_name IN ('increment_sibling_ordinals', 'decrement_sibling_ordinals', 'swap_sibling_ordinals')
--    AND routine_schema = 'public';

-- 2. Test increment (make space):
--    SELECT increment_sibling_ordinals(NULL::UUID, 2, 1);

-- 3. Test decrement (close gap):
--    SELECT decrement_sibling_ordinals(NULL::UUID, 2, 1);

-- 4. Test swap (requires two section IDs):
--    SELECT swap_sibling_ordinals('<section-id-1>'::UUID, '<section-id-2>'::UUID);

COMMIT;

-- ============================================================================
-- END OF MIGRATION 009
-- ============================================================================
