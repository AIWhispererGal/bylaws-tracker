-- Migration: Fix Organizations Table Schema
-- Purpose: Add missing columns to organizations table
-- Date: 2025-01-07
-- Safe to run multiple times - uses IF NOT EXISTS

-- Add contact_email column for organization contact
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Add logo_url column for organization branding
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add website_url column for organization website
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add theme_color column for custom branding
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS theme_color VARCHAR(7) DEFAULT '#1a73e8';

-- Add custom_footer column for organization-specific footer content
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS custom_footer TEXT;

-- Add analytics_enabled column to control analytics tracking
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN DEFAULT false;

-- Add settings column for flexible configuration storage
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add comments to document columns
COMMENT ON COLUMN organizations.contact_email IS 'Primary contact email for the organization';
COMMENT ON COLUMN organizations.logo_url IS 'URL to organization logo image';
COMMENT ON COLUMN organizations.website_url IS 'Organization website URL';
COMMENT ON COLUMN organizations.theme_color IS 'Hex color code for UI theming';
COMMENT ON COLUMN organizations.custom_footer IS 'Custom HTML/text for organization footer';
COMMENT ON COLUMN organizations.analytics_enabled IS 'Whether to enable analytics tracking';
COMMENT ON COLUMN organizations.settings IS 'JSON object for flexible organization settings';

-- Create index on contact_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_contact_email
ON organizations(contact_email);

-- Verify the migration
DO $$
BEGIN
    -- Check if all columns exist
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'organizations'
        AND column_name IN ('contact_email', 'logo_url', 'website_url', 'theme_color', 'custom_footer', 'analytics_enabled', 'settings')
        GROUP BY table_name
        HAVING COUNT(*) = 7
    ) THEN
        RAISE NOTICE 'Migration successful: All columns added to organizations table';
    ELSE
        RAISE WARNING 'Migration incomplete: Some columns may not have been added';
    END IF;
END $$;