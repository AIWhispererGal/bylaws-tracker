-- Quick check: What columns does document_sections actually have?

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'document_sections'
ORDER BY ordinal_position;
