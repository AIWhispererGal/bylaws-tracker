-- Migration: Fix user_organizations table schema
-- Issue: Missing created_at column
-- Date: 2025-01-12

-- Check if column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_organizations'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_organizations
        ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

        RAISE NOTICE 'Added created_at column to user_organizations';
    ELSE
        RAISE NOTICE 'Column created_at already exists in user_organizations';
    END IF;
END $$;

-- Also add updated_at if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_organizations'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_organizations
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

        RAISE NOTICE 'Added updated_at column to user_organizations';
    ELSE
        RAISE NOTICE 'Column updated_at already exists in user_organizations';
    END IF;
END $$;

-- Verify the table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_organizations'
ORDER BY ordinal_position;
