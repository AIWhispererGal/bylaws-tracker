-- MULTI-SECTION AMENDMENT SUPPORT - DATABASE MIGRATION
-- Run this in your Supabase SQL editor
-- Version: 1.0
-- Date: 2025-10-06

-- Step 1: Create junction table for suggestion-to-sections mapping
CREATE TABLE IF NOT EXISTS suggestion_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL,
  section_id UUID NOT NULL REFERENCES bylaw_sections(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL, -- Order within the suggestion (1, 2, 3...)
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(suggestion_id, section_id),
  UNIQUE(suggestion_id, ordinal)
);

-- Step 2: Add new columns to bylaw_suggestions for multi-section metadata
ALTER TABLE bylaw_suggestions
ADD COLUMN IF NOT EXISTS is_multi_section BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS article_scope VARCHAR(255), -- e.g., "Article III"
ADD COLUMN IF NOT EXISTS section_range VARCHAR(255); -- e.g., "Sections 2-5"

-- Step 3: Migrate existing single-section suggestions to junction table
INSERT INTO suggestion_sections (suggestion_id, section_id, ordinal)
SELECT id, section_id, 1
FROM bylaw_suggestions
WHERE section_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 4: Add article tracking to bylaw_sections for validation
ALTER TABLE bylaw_sections
ADD COLUMN IF NOT EXISTS article_number VARCHAR(20), -- "III", "IV", etc.
ADD COLUMN IF NOT EXISTS section_number INTEGER; -- 1, 2, 3 within article

-- Step 5: Populate article_number and section_number from existing citations
-- Example: "Article V, Section 6" → article_number="V", section_number=6
UPDATE bylaw_sections
SET
  article_number = CASE
    WHEN section_citation LIKE 'Article %' THEN
      SUBSTRING(section_citation FROM 'Article ([IVX]+)')
    ELSE NULL
  END,
  section_number = CASE
    WHEN section_citation LIKE '%Section %' THEN
      CAST(SUBSTRING(section_citation FROM 'Section (\d+)') AS INTEGER)
    ELSE NULL
  END
WHERE article_number IS NULL OR section_number IS NULL;

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_suggestion_sections_suggestion ON suggestion_sections(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_sections_section ON suggestion_sections(section_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_sections_ordinal ON suggestion_sections(suggestion_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_bylaw_sections_article ON bylaw_sections(article_number);
CREATE INDEX IF NOT EXISTS idx_bylaw_sections_section_num ON bylaw_sections(section_number);

-- Step 7: Create view for easy querying of multi-section suggestions
CREATE OR REPLACE VIEW v_suggestions_with_sections AS
SELECT
  s.*,
  ARRAY_AGG(
    ss.section_id ORDER BY ss.ordinal
  ) as section_ids,
  STRING_AGG(
    bs.section_citation, ', ' ORDER BY ss.ordinal
  ) as section_citations,
  COUNT(ss.section_id) as section_count
FROM bylaw_suggestions s
LEFT JOIN suggestion_sections ss ON s.id = ss.suggestion_id
LEFT JOIN bylaw_sections bs ON ss.section_id = bs.id
GROUP BY s.id;

-- Step 8: Add comment documentation
COMMENT ON TABLE suggestion_sections IS 'Junction table mapping suggestions to multiple sections for range-based amendments';
COMMENT ON COLUMN bylaw_suggestions.is_multi_section IS 'TRUE if suggestion applies to multiple sections';
COMMENT ON COLUMN bylaw_suggestions.article_scope IS 'Article number for multi-section suggestions (e.g., "Article III")';
COMMENT ON COLUMN bylaw_suggestions.section_range IS 'Human-readable range description (e.g., "Sections 2-5")';
COMMENT ON COLUMN bylaw_sections.article_number IS 'Roman numeral article number extracted from citation (e.g., "V", "III")';
COMMENT ON COLUMN bylaw_sections.section_number IS 'Numeric section number within article (e.g., 1, 2, 3)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Multi-section amendment migration complete!';
  RAISE NOTICE 'Created: suggestion_sections junction table';
  RAISE NOTICE 'Added: is_multi_section, article_scope, section_range columns';
  RAISE NOTICE 'Added: article_number, section_number columns to bylaw_sections';
  RAISE NOTICE 'Created: v_suggestions_with_sections view';
  RAISE NOTICE 'Migrated: % existing suggestions', (SELECT COUNT(*) FROM suggestion_sections);
END $$;
