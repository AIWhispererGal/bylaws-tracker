-- 🧹 CLEAN SLATE - Remove all test data
-- Run this in Supabase SQL Editor to start fresh

-- Delete all organizations
DELETE FROM organizations;

-- Verify it's clean
SELECT COUNT(*) as total_organizations FROM organizations;

-- Should return: total_organizations = 0
