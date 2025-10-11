-- Migration: Complete Organizations Table Schema Fix
-- Purpose: Add ALL missing columns identified by DETECTIVE
-- Date: 2025-01-07
-- Safe to run multiple times - uses IF NOT EXISTS

-- Add state column (required by form)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS state VARCHAR(100);

-- Add country column (required by form)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'USA';

-- Add contact_email column (required by form)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Add logo_url column (required by code)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add website_url column (nice to have)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add theme_color column (for branding)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7) DEFAULT '#1a73e8';

-- Verify columns exist
DO $$
BEGIN
    RAISE NOTICE 'Verifying organizations table schema...';

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'state'
    ) THEN
        RAISE NOTICE '✓ state column exists';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'country'
    ) THEN
        RAISE NOTICE '✓ country column exists';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'contact_email'
    ) THEN
        RAISE NOTICE '✓ contact_email column exists';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'organizations' AND column_name = 'logo_url'
    ) THEN
        RAISE NOTICE '✓ logo_url column exists';
    END IF;

    RAISE NOTICE 'Migration completed successfully!';
END $$;
