-- Migration 025: Fix depth trigger to preserve parser-calculated depth
--
-- PROBLEM: The update_section_path() trigger unconditionally overwrites
-- the depth value calculated by parsers, forcing all sections to depth=0
-- because parent_section_id is NULL during initial insert.
--
-- SOLUTION: Only calculate depth from parent if parser didn't provide it.
-- This preserves the contextual depth from wordParser/textParser.

-- Drop existing trigger
DROP TRIGGER IF EXISTS trg_update_section_path ON document_sections;

-- Recreate function with depth preservation
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section
    NEW.path_ids := ARRAY[NEW.id];
    NEW.path_ordinals := ARRAY[NEW.ordinal];

    -- ✅ FIX: Only set depth=0 if parser didn't provide a value
    -- This allows parsers to set contextual depth (e.g., Section=1, Article=0)
    IF NEW.depth IS NULL THEN
      NEW.depth := 0;
    END IF;
    -- Otherwise preserve parser's depth value

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

-- Recreate trigger
CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();

-- Note: This migration does NOT fix existing data (all sections with depth=0).
-- To fix existing data, you would need to:
-- 1. Re-upload documents OR
-- 2. Run a data migration script to recalculate depth from section types
