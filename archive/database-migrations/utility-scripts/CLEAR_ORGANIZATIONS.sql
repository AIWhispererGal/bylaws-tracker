-- Clear all organizations to allow fresh setup
-- Run this in Supabase SQL Editor to start fresh

DELETE FROM organizations WHERE slug = 'reseda-neighborhood-council';

-- Or to clear ALL organizations:
-- DELETE FROM organizations;

-- Verify it's cleared
SELECT COUNT(*) as organization_count FROM organizations;
