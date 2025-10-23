-- Migration 003: Add document_order field for proper sequential ordering
-- Date: 2025-10-22
-- Purpose: Replace JSONB metadata->ordinal_position with dedicated integer column
-- Risk: Low - Additive change, no data loss
-- Rollback: See rollback section at bottom

-- ============================================================================
-- PROBLEM SUMMARY
-- ============================================================================
-- The 'ordinal' field stores SIBLING position (1st child, 2nd child)
-- We need DOCUMENT order (1st in document, 2nd in document, etc.)
-- Currently using metadata->ordinal_position, but JSONB is slower than INTEGER
-- ============================================================================

BEGIN;

-- Step 1: Add document_order column (nullable initially)
-- ============================================================================
ALTER TABLE document_sections
ADD COLUMN IF NOT EXISTS document_order INTEGER;

COMMENT ON COLUMN document_sections.document_order IS
'Sequential position in document from parser (1, 2, 3...).
Use this for document-wide ordering. The "ordinal" field is for sibling position only.';

-- Step 2: Backfill from metadata->ordinal_position where it exists
-- ============================================================================
UPDATE document_sections
SET document_order = (metadata->>'ordinal_position')::integer
WHERE metadata ? 'ordinal_position'
  AND (metadata->>'ordinal_position') ~ '^\d+$'  -- Verify it's a valid number
  AND document_order IS NULL;

-- Step 3: Backfill remaining sections using created_at order as fallback
-- ============================================================================
-- This handles sections inserted before ordinal_position was added to metadata
WITH ordered_sections AS (
  SELECT
    id,
    document_id,
    ROW_NUMBER() OVER (
      PARTITION BY document_id
      ORDER BY created_at ASC, id ASC  -- Use created_at + id for deterministic order
    ) as calculated_order
  FROM document_sections
  WHERE document_order IS NULL
)
UPDATE document_sections ds
SET document_order = os.calculated_order
FROM ordered_sections os
WHERE ds.id = os.id;

-- Step 4: Verify all sections have document_order
-- ============================================================================
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM document_sections
  WHERE document_order IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % sections still have NULL document_order', missing_count;
  END IF;

  RAISE NOTICE 'Verification passed: All sections have document_order assigned';
END $$;

-- Step 5: Make column NOT NULL
-- ============================================================================
ALTER TABLE document_sections
ALTER COLUMN document_order SET NOT NULL;

-- Step 6: Add unique constraint within document
-- ============================================================================
-- This ensures no duplicate document_order values within same document
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_sections_document_order_unique
ON document_sections(document_id, document_order);

-- Step 7: Add performance index
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_doc_sections_document_order
ON document_sections(document_id, document_order);

-- Step 8: Add check constraint for positive values
-- ============================================================================
ALTER TABLE document_sections
ADD CONSTRAINT chk_document_order_positive
CHECK (document_order > 0);

-- Step 9: Update validation view to include document_order
-- ============================================================================
CREATE OR REPLACE VIEW v_section_ordering_validation AS
SELECT
  ds.id,
  ds.document_id,
  ds.section_number,
  ds.section_title,
  ds.ordinal as sibling_position,
  ds.document_order as parse_order,
  ds.depth,
  ds.path_ordinals,
  ds.metadata->>'ordinal_position' as metadata_order,
  d.title as document_title,
  -- Validation flags
  CASE
    WHEN ds.document_order::text = ds.metadata->>'ordinal_position' THEN true
    ELSE false
  END as matches_metadata,
  CASE
    WHEN ds.document_order = ROW_NUMBER() OVER (PARTITION BY ds.document_id ORDER BY ds.created_at)
    THEN true ELSE false
  END as matches_insert_order
FROM document_sections ds
JOIN documents d ON ds.document_id = d.id
ORDER BY ds.document_id, ds.document_order;

COMMENT ON VIEW v_section_ordering_validation IS
'Validates document_order field against metadata and created_at.
Use to verify migration correctness.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check ordering for most recent document
DO $$
DECLARE
  recent_doc_id UUID;
  section_count INTEGER;
  max_order INTEGER;
BEGIN
  -- Get most recent document
  SELECT id INTO recent_doc_id
  FROM documents
  ORDER BY created_at DESC
  LIMIT 1;

  -- Get section count and max order
  SELECT COUNT(*), MAX(document_order)
  INTO section_count, max_order
  FROM document_sections
  WHERE document_id = recent_doc_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Verification:';
  RAISE NOTICE 'Document: %', recent_doc_id;
  RAISE NOTICE 'Section count: %', section_count;
  RAISE NOTICE 'Max document_order: %', max_order;

  IF section_count = max_order THEN
    RAISE NOTICE 'Status: PASS - Sequential ordering verified';
  ELSE
    RAISE WARNING 'Status: CHECK NEEDED - Count mismatch (% vs %)', section_count, max_order;
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- Show sample sections with new ordering
SELECT
  section_number,
  section_title,
  ordinal as sibling_pos,
  document_order as doc_pos,
  depth,
  path_ordinals
FROM document_sections
WHERE document_id IN (SELECT id FROM documents ORDER BY created_at DESC LIMIT 1)
ORDER BY document_order ASC
LIMIT 20;

COMMIT;

-- ============================================================================
-- POST-MIGRATION STEPS
-- ============================================================================
-- 1. Update sectionStorage.js to populate document_order on insert
-- 2. Update all queries to use document_order instead of ordinal
-- 3. Monitor query performance (should improve)
-- 4. After confirming stability, can remove metadata->ordinal_position
-- ============================================================================

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- Run this if migration causes issues:
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_doc_sections_document_order_unique;
-- DROP INDEX IF EXISTS idx_doc_sections_document_order;
-- DROP VIEW IF EXISTS v_section_ordering_validation;
-- ALTER TABLE document_sections DROP CONSTRAINT IF EXISTS chk_document_order_positive;
-- ALTER TABLE document_sections DROP COLUMN IF EXISTS document_order;
-- COMMIT;
--
-- Then revert application code to use metadata->ordinal_position
-- ============================================================================
