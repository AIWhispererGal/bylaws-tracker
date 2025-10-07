-- ROLLBACK SCRIPT FOR MULTI-SECTION MIGRATION
-- Use this if you need to undo the changes
-- Version: 1.0

-- Drop view
DROP VIEW IF EXISTS v_suggestions_with_sections;

-- Drop indexes
DROP INDEX IF EXISTS idx_suggestion_sections_suggestion;
DROP INDEX IF EXISTS idx_suggestion_sections_section;
DROP INDEX IF EXISTS idx_suggestion_sections_ordinal;
DROP INDEX IF EXISTS idx_bylaw_sections_article;
DROP INDEX IF EXISTS idx_bylaw_sections_section_num;

-- Drop junction table
DROP TABLE IF EXISTS suggestion_sections CASCADE;

-- Remove added columns from bylaw_suggestions
ALTER TABLE bylaw_suggestions
  DROP COLUMN IF EXISTS is_multi_section,
  DROP COLUMN IF EXISTS article_scope,
  DROP COLUMN IF EXISTS section_range;

-- Remove added columns from bylaw_sections
ALTER TABLE bylaw_sections
  DROP COLUMN IF EXISTS article_number,
  DROP COLUMN IF EXISTS section_number;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Multi-section migration rolled back successfully';
END $$;
