-- Verify that metadata->ordinal_position exists and is populated correctly
SELECT
  id,
  section_number,
  section_title,
  ordinal AS sibling_ordinal,
  metadata->>'ordinal_position' AS document_order,
  path_ordinals,
  depth,
  created_at
FROM document_sections
WHERE document_id IN (
  SELECT id FROM documents ORDER BY created_at DESC LIMIT 1
)
ORDER BY (metadata->>'ordinal_position')::integer ASC
LIMIT 30;
