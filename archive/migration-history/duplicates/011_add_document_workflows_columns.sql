-- Migration 011.5: Add Missing Columns to document_workflows
-- Date: 2025-10-14
-- Purpose: Add status and current_stage_id columns needed by migration 012
-- Run this BEFORE migration 012

-- ============================================================================
-- PART 1: ADD MISSING COLUMNS TO DOCUMENT_WORKFLOWS
-- ============================================================================

-- Add status column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_workflows' AND column_name = 'status'
    ) THEN
        ALTER TABLE document_workflows
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';

        RAISE NOTICE '✅ Added status column to document_workflows';
    ELSE
        RAISE NOTICE '✅ Status column already exists';
    END IF;
END $$;

-- Add current_stage_id column (also referenced in migration 012)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_workflows' AND column_name = 'current_stage_id'
    ) THEN
        ALTER TABLE document_workflows
        ADD COLUMN current_stage_id UUID REFERENCES workflow_stages(id);

        RAISE NOTICE '✅ Added current_stage_id column to document_workflows';
    ELSE
        RAISE NOTICE '✅ current_stage_id column already exists';
    END IF;
END $$;

-- Add created_at and updated_at if missing (standard audit columns)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_workflows' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE document_workflows
        ADD COLUMN created_at TIMESTAMP DEFAULT NOW();

        RAISE NOTICE '✅ Added created_at column to document_workflows';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_workflows' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE document_workflows
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

        RAISE NOTICE '✅ Added updated_at column to document_workflows';
    END IF;
END $$;

-- ============================================================================
-- PART 2: ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN document_workflows.status IS 'Workflow status: active, paused, completed, cancelled';
COMMENT ON COLUMN document_workflows.current_stage_id IS 'Current workflow stage for the document';
COMMENT ON COLUMN document_workflows.created_at IS 'When workflow was activated';
COMMENT ON COLUMN document_workflows.updated_at IS 'Last update timestamp';

-- ============================================================================
-- PART 3: VERIFY SCHEMA
-- ============================================================================

-- Show the updated schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'document_workflows'
ORDER BY ordinal_position;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 011.5 Completed Successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Added columns to document_workflows:';
    RAISE NOTICE '✅ status (VARCHAR)';
    RAISE NOTICE '✅ current_stage_id (UUID)';
    RAISE NOTICE '✅ created_at (TIMESTAMP)';
    RAISE NOTICE '✅ updated_at (TIMESTAMP)';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'You can now run migration 012 successfully!';
    RAISE NOTICE '========================================';
END $$;
