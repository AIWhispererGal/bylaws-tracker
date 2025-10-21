-- ============================================================================
-- SIMPLIFIED SETUP MIGRATION
-- Just the essentials to get the setup wizard working
-- ============================================================================

-- Organizations table (required for setup wizard)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  organization_type VARCHAR(50) DEFAULT 'neighborhood_council',
  settings JSONB DEFAULT '{}'::jsonb,
  hierarchy_config JSONB DEFAULT '{
    "levels": [
      {"name": "Article", "numbering": "roman", "prefix": "Article"},
      {"name": "Section", "numbering": "numeric", "prefix": "Section"}
    ]
  }'::jsonb,
  is_configured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add is_configured column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'organizations'
        AND column_name = 'is_configured'
    ) THEN
        ALTER TABLE organizations ADD COLUMN is_configured BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_configured ON organizations(is_configured);
