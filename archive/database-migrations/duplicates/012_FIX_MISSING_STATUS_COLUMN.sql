-- Emergency Fix: Restore missing status column in section_workflow_states
-- Date: 2025-10-14
-- Issue: status column was accidentally dropped from section_workflow_states table

-- ============================================================================
-- STEP 1: CHECK WHAT COLUMNS EXIST
-- ============================================================================

-- Run this query first to see what columns you have:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'section_workflow_states'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 2: IF STATUS COLUMN IS MISSING, ADD IT BACK
-- ============================================================================

-- Add status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'section_workflow_states' AND column_name = 'status'
    ) THEN
        ALTER TABLE section_workflow_states
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';

        RAISE NOTICE '✅ Added missing status column';
    ELSE
        RAISE NOTICE '✅ Status column already exists';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: VERIFY THE FIX
-- ============================================================================

-- Check that status column now exists
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'section_workflow_states' AND column_name = 'status'
        ) THEN '✅ Status column exists'
        ELSE '❌ Status column still missing'
    END AS status_check;

-- Show all columns in the table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'section_workflow_states'
ORDER BY ordinal_position;

-- ============================================================================
-- COMPLETE SCHEMA FOR REFERENCE
-- ============================================================================
-- section_workflow_states should have these columns:
-- 1. id (UUID PRIMARY KEY)
-- 2. section_id (UUID NOT NULL)
-- 3. workflow_stage_id (UUID NOT NULL)
-- 4. status (VARCHAR(50) NOT NULL)  <-- THIS ONE WAS MISSING
-- 5. actioned_by (UUID)
-- 6. actioned_by_email (VARCHAR(255))
-- 7. actioned_at (TIMESTAMP)
-- 8. notes (TEXT)
-- 9. selected_suggestion_id (UUID)
-- 10. created_at (TIMESTAMP)
-- 11. updated_at (TIMESTAMP)
-- 12. approval_metadata (JSONB) - added by migration 008
-- ============================================================================
