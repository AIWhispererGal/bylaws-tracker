# Apply Migration 025: Fix Depth Trigger

## Quick Apply (Copy-Paste to Supabase SQL Editor)

1. Go to: https://auuzurghrjokbqzivfca.supabase.co/project/auuzurghrjokbqzivfca/sql
2. Paste this SQL:

```sql
-- Migration 025: Fix depth trigger to preserve parser-calculated depth

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
    IF NEW.depth IS NULL THEN
      NEW.depth := 0;
    END IF;

  ELSE
    -- Child section: inherit parent's path and append self
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

-- Recreate trigger
CREATE TRIGGER trg_update_section_path
  BEFORE INSERT OR UPDATE OF parent_section_id, ordinal
  ON document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_path();
```

3. Click "RUN" button
4. Expected output: "Success. No rows returned"

## What This Fixes

**BEFORE**: Trigger unconditionally set `depth = 0` for all sections
**AFTER**: Trigger preserves depth value from parser (Section=1, Article=0, etc.)

## Testing

After applying migration:
1. Delete old document from database (has incorrect depth=0)
2. Re-upload same document
3. Check document_sections table: depth should vary (0, 1, 2, etc.)
4. Test section operations (indent/dedent/up/down)

## Verification SQL

```sql
-- Check depth distribution
SELECT depth, COUNT(*) as count
FROM document_sections
WHERE document_id = 'YOUR_DOCUMENT_ID'
GROUP BY depth
ORDER BY depth;

-- Expected: Multiple depth values (0, 1, 2, ...)
-- Not: All rows with depth=0
```
