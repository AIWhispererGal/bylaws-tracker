-- Migration 017: Add Section Locking Columns to document_sections
-- Date: 2025-10-15
-- Purpose: Add columns needed for workflow section locking functionality
-- Referenced in: src/routes/workflow.js lines 1677-1686

-- ============================================================================
-- PART 1: ADD LOCKING COLUMNS TO DOCUMENT_SECTIONS
-- ============================================================================

-- Add is_locked column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections' AND column_name = 'is_locked'
    ) THEN
        ALTER TABLE document_sections
        ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;

        RAISE NOTICE '✅ Added is_locked column to document_sections';
    ELSE
        RAISE NOTICE '✅ is_locked column already exists';
    END IF;
END $$;

-- Add locked_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections' AND column_name = 'locked_at'
    ) THEN
        ALTER TABLE document_sections
        ADD COLUMN locked_at TIMESTAMP;

        RAISE NOTICE '✅ Added locked_at column to document_sections';
    ELSE
        RAISE NOTICE '✅ locked_at column already exists';
    END IF;
END $$;

-- Add locked_by column (foreign key to users/auth.users)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections' AND column_name = 'locked_by'
    ) THEN
        ALTER TABLE document_sections
        ADD COLUMN locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

        RAISE NOTICE '✅ Added locked_by column to document_sections';
    ELSE
        RAISE NOTICE '✅ locked_by column already exists';
    END IF;
END $$;

-- Add selected_suggestion_id column (foreign key to suggestions)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections' AND column_name = 'selected_suggestion_id'
    ) THEN
        ALTER TABLE document_sections
        ADD COLUMN selected_suggestion_id UUID REFERENCES suggestions(id) ON DELETE SET NULL;

        RAISE NOTICE '✅ Added selected_suggestion_id column to document_sections';
    ELSE
        RAISE NOTICE '✅ selected_suggestion_id column already exists';
    END IF;
END $$;

-- Add locked_text column (stores the approved suggestion text)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_sections' AND column_name = 'locked_text'
    ) THEN
        ALTER TABLE document_sections
        ADD COLUMN locked_text TEXT;

        RAISE NOTICE '✅ Added locked_text column to document_sections';
    ELSE
        RAISE NOTICE '✅ locked_text column already exists';
    END IF;
END $$;

-- ============================================================================
-- PART 2: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for finding locked sections
CREATE INDEX IF NOT EXISTS idx_document_sections_is_locked
ON document_sections(is_locked)
WHERE is_locked = TRUE;

-- Index for finding sections locked by user
CREATE INDEX IF NOT EXISTS idx_document_sections_locked_by
ON document_sections(locked_by)
WHERE locked_by IS NOT NULL;

-- Index for finding sections with selected suggestions
CREATE INDEX IF NOT EXISTS idx_document_sections_selected_suggestion
ON document_sections(selected_suggestion_id)
WHERE selected_suggestion_id IS NOT NULL;

-- ============================================================================
-- PART 3: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN document_sections.is_locked IS 'Whether the section is locked for editing';
COMMENT ON COLUMN document_sections.locked_at IS 'Timestamp when section was locked';
COMMENT ON COLUMN document_sections.locked_by IS 'User who locked the section';
COMMENT ON COLUMN document_sections.selected_suggestion_id IS 'Approved suggestion that was locked in';
COMMENT ON COLUMN document_sections.locked_text IS 'Text of the approved suggestion';

-- ============================================================================
-- PART 4: VERIFY SCHEMA
-- ============================================================================

-- Show the locking-related columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE
        WHEN column_name IN ('is_locked', 'locked_at', 'locked_by', 'selected_suggestion_id', 'locked_text')
        THEN '✓'
        ELSE ''
    END as "New Column"
FROM information_schema.columns
WHERE table_name = 'document_sections'
  AND column_name IN ('is_locked', 'locked_at', 'locked_by', 'selected_suggestion_id', 'locked_text')
ORDER BY ordinal_position;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 017 Completed Successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Added locking columns to document_sections:';
    RAISE NOTICE '✅ is_locked (BOOLEAN, default FALSE)';
    RAISE NOTICE '✅ locked_at (TIMESTAMP, nullable)';
    RAISE NOTICE '✅ locked_by (UUID, FK to auth.users)';
    RAISE NOTICE '✅ selected_suggestion_id (UUID, FK to suggestions)';
    RAISE NOTICE '✅ locked_text (TEXT, nullable)';
    RAISE NOTICE '';
    RAISE NOTICE 'Added performance indexes:';
    RAISE NOTICE '✅ idx_document_sections_is_locked';
    RAISE NOTICE '✅ idx_document_sections_locked_by';
    RAISE NOTICE '✅ idx_document_sections_selected_suggestion';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'The /api/workflow/sections/:sectionId/lock endpoint';
    RAISE NOTICE 'can now execute successfully!';
    RAISE NOTICE '========================================';
END $$;
