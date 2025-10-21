-- Migration 018: Add Per-Document Hierarchy Override
-- Date: October 17, 2025
-- Purpose: Allow per-document numbering schema configuration
--          that overrides organization default hierarchy

-- ============================================================
-- UPGRADE
-- ============================================================

-- Add hierarchy_override column to documents table
ALTER TABLE documents
ADD COLUMN hierarchy_override JSONB DEFAULT NULL;

-- Add detailed comment explaining the column structure
COMMENT ON COLUMN documents.hierarchy_override IS
  'Per-document hierarchy configuration. If NULL, uses organization default.
   Format: {"levels": [...10 level definitions...], "maxDepth": 10}
   Each level should have: {name, depth, numbering, prefix}
   Numbering options: "roman", "numeric", "alpha", "alphaLower"
   Example:
   {
     "levels": [
       {"name": "Article", "depth": 0, "numbering": "roman", "prefix": "Article "},
       {"name": "Section", "depth": 1, "numbering": "numeric", "prefix": "Section "},
       ...
     ],
     "maxDepth": 10
   }';

-- Create index for documents with custom hierarchies
-- This speeds up queries filtering by organization for documents with overrides
CREATE INDEX idx_documents_hierarchy_override
  ON documents(organization_id)
  WHERE hierarchy_override IS NOT NULL;

-- Add index comment for documentation
COMMENT ON INDEX idx_documents_hierarchy_override IS
  'Optimizes queries for documents with custom hierarchy configurations.
   Only indexes documents where hierarchy_override IS NOT NULL.';

-- ============================================================
-- ROLLBACK
-- ============================================================

-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_documents_hierarchy_override;
-- ALTER TABLE documents DROP COLUMN IF EXISTS hierarchy_override;
