-- Migration 019: Add Suggestion Rejection Tracking
-- Date: October 17, 2025
-- Purpose: Track suggestion rejections with stage, timestamp, user, and notes
--          Allows admins to reject suggestions and track when/where/why

-- ============================================================
-- UPGRADE
-- ============================================================

-- Add rejection tracking columns to suggestions table
ALTER TABLE suggestions
ADD COLUMN rejected_at TIMESTAMP DEFAULT NULL,
ADD COLUMN rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN rejected_at_stage_id UUID REFERENCES workflow_stages(id) ON DELETE SET NULL,
ADD COLUMN rejection_notes TEXT DEFAULT NULL;

-- Add comments explaining each new column
COMMENT ON COLUMN suggestions.rejected_at IS
  'Timestamp when suggestion was rejected. NULL if not rejected.
   Used for filtering and displaying rejection history.';

COMMENT ON COLUMN suggestions.rejected_by IS
  'User who rejected the suggestion. NULL if not rejected.
   References users(id) with ON DELETE SET NULL to preserve history even if user deleted.';

COMMENT ON COLUMN suggestions.rejected_at_stage_id IS
  'Workflow stage at which suggestion was rejected.
   Shows context of rejection (e.g., rejected during Committee Review stage).
   References workflow_stages(id) with ON DELETE SET NULL.';

COMMENT ON COLUMN suggestions.rejection_notes IS
  'Optional notes about why suggestion was rejected.
   Provides context for future reference or auditing.';

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Index for filtering rejected suggestions by timestamp
-- Partial index only on rejected suggestions for efficiency
CREATE INDEX idx_suggestions_rejected_at
  ON suggestions(rejected_at)
  WHERE rejected_at IS NOT NULL;

COMMENT ON INDEX idx_suggestions_rejected_at IS
  'Optimizes queries filtering by rejection date.
   Partial index only on rejected suggestions (WHERE rejected_at IS NOT NULL).';

-- Index for filtering suggestions by who rejected them
CREATE INDEX idx_suggestions_rejected_by
  ON suggestions(rejected_by)
  WHERE rejected_by IS NOT NULL;

COMMENT ON INDEX idx_suggestions_rejected_by IS
  'Optimizes queries filtering by rejection author.
   Useful for admin reporting and auditing.';

-- Index for filtering suggestions by rejection stage
CREATE INDEX idx_suggestions_rejected_stage
  ON suggestions(rejected_at_stage_id)
  WHERE rejected_at_stage_id IS NOT NULL;

COMMENT ON INDEX idx_suggestions_rejected_stage IS
  'Optimizes queries filtering by workflow stage at rejection.
   Allows analysis of which stages have most rejections.';

-- Index for active (non-rejected) suggestions
-- This improves performance of the main suggestion list view
CREATE INDEX idx_suggestions_active
  ON suggestions(document_id, status)
  WHERE status != 'rejected';

COMMENT ON INDEX idx_suggestions_active IS
  'Optimizes queries for active suggestions (non-rejected).
   Improves performance of main document viewer suggestion list.
   Partial index excludes rejected suggestions.';

-- ============================================================
-- ROLLBACK
-- ============================================================

-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_suggestions_active;
-- DROP INDEX IF EXISTS idx_suggestions_rejected_stage;
-- DROP INDEX IF EXISTS idx_suggestions_rejected_by;
-- DROP INDEX IF EXISTS idx_suggestions_rejected_at;
-- ALTER TABLE suggestions DROP COLUMN IF EXISTS rejection_notes;
-- ALTER TABLE suggestions DROP COLUMN IF EXISTS rejected_at_stage_id;
-- ALTER TABLE suggestions DROP COLUMN IF EXISTS rejected_by;
-- ALTER TABLE suggestions DROP COLUMN IF EXISTS rejected_at;
