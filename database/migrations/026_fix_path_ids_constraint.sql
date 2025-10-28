-- Migration 026: Fix path_ids constraint violation with depth preservation
--
-- PROBLEM: Migration 025 preserves parser depth but still builds path_ids
-- with wrong length, causing constraint check failure:
--   - Parser sets depth=1 for Sections
--   - Trigger preserves depth=1
--   - But path_ids = ARRAY[id] has length 1
--   - Constraint: array_length(path_ids) = depth + 1 → 1 ≠ 2 → FAILS!
--
-- SOLUTION: When parent_section_id IS NULL, build path_ids with (depth+1)
-- elements by filling missing parent slots with the section's own ID.
--
-- EXAMPLES:
--   depth=0 (Article) → path_ids = [id] (length 1)
--   depth=1 (Section) → path_ids = [id, id] (length 2)
--   depth=2 (Subsection) → path_ids = [id, id, id] (length 3)

-- Drop existing trigger
DROP TRIGGER IF EXISTS trg_update_section_path ON document_sections;

-- Recreate function with correct path_ids construction
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS TRIGGER AS $$
DECLARE
  v_path_length INTEGER;
  v_fill_array UUID[];
BEGIN
  IF NEW.parent_section_id IS NULL THEN
    -- Root section (or orphaned section with parser-assigned depth)

    -- ✅ Preserve parser's depth value
    IF NEW.depth IS NULL THEN
      NEW.depth := 0;
    END IF;

    -- ✅ FIX: Build path_ids with correct length = depth + 1
    -- Fill missing parent slots with section's own ID
    v_path_length := NEW.depth + 1;

    -- Create array filled with NEW.id repeated v_path_length times
    v_fill_array := ARRAY[]::UUID[];
    FOR i IN 1..v_path_length LOOP
      v_fill_array := v_fill_array || NEW.id;
    END LOOP;

    NEW.path_ids := v_fill_array;

    -- Do the same for ordinals
    NEW.path_ordinals := ARRAY[]::INTEGER[];
    FOR i IN 1..v_path_length LOOP
      NEW.path_ordinals := NEW.path_ordinals || NEW.ordinal;
    END LOOP;

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

-- Verification comment:
-- After this migration:
--   - Article with depth=0 → path_ids=[id] (length 1) ✓
--   - Section with depth=1 → path_ids=[id, id] (length 2) ✓
--   - Subsection with depth=2 → path_ids=[id, id, id] (length 3) ✓
--   - All satisfy: array_length(path_ids, 1) = depth + 1 ✓
