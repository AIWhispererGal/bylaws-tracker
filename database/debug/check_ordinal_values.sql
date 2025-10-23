-- Database Detective: Ordinal Value Investigation
-- This query checks if ordinal values are actually sequential in the database

-- First, find the most recently uploaded document
-- (Comment this out and replace with specific document_id if known)
SELECT
  id,
  title,
  created_at,
  'Recent Document' as context
FROM bylaw_documents
ORDER BY created_at DESC
LIMIT 1;

-- Check ordinal values for a specific document
-- Replace '<DOCUMENT_ID>' with actual document ID from above query
SELECT
  section_number,
  section_title,
  ordinal,
  depth,
  path_ordinals,
  parent_section_id,
  id
FROM bylaw_sections
WHERE document_id = '<DOCUMENT_ID>'
ORDER BY ordinal ASC
LIMIT 30;

-- Diagnostic: Check if ordinals are actually sequential
SELECT
  COUNT(*) as total_sections,
  MIN(ordinal) as min_ordinal,
  MAX(ordinal) as max_ordinal,
  COUNT(DISTINCT ordinal) as unique_ordinals,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT ordinal) THEN 'NO DUPLICATES'
    ELSE 'HAS DUPLICATES!'
  END as duplicate_check
FROM bylaw_sections
WHERE document_id = '<DOCUMENT_ID>';

-- Find any gaps or issues in ordinal sequence
SELECT
  ordinal,
  COUNT(*) as count,
  STRING_AGG(section_number, ', ') as sections
FROM bylaw_sections
WHERE document_id = '<DOCUMENT_ID>'
GROUP BY ordinal
HAVING COUNT(*) > 1
ORDER BY ordinal;

-- Check if path_ordinals match expected pattern
SELECT
  section_number,
  section_title,
  ordinal,
  depth,
  path_ordinals,
  CASE
    WHEN array_length(path_ordinals, 1) = depth + 1 THEN 'OK'
    ELSE 'MISMATCH!'
  END as path_ordinals_check
FROM bylaw_sections
WHERE document_id = '<DOCUMENT_ID>'
ORDER BY ordinal
LIMIT 20;
