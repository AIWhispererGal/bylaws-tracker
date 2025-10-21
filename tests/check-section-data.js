/**
 * Quick diagnostic: Check section data in database
 * Run with: node tests/check-section-data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSectionData() {
  console.log('\n🔍 Checking document_sections table data...\n');

  // Get a sample document
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, title')
    .limit(1);

  if (docsError) {
    console.error('Error fetching documents:', docsError);
    return;
  }

  if (!docs || docs.length === 0) {
    console.log('❌ No documents found in database');
    return;
  }

  const doc = docs[0];
  console.log(`📄 Document: ${doc.title} (${doc.id})\n`);

  // Get sections for this document
  const { data: sections, error: sectionsError } = await supabase
    .from('document_sections')
    .select('*')
    .eq('document_id', doc.id)
    .limit(5);

  if (sectionsError) {
    console.error('Error fetching sections:', sectionsError);
    return;
  }

  if (!sections || sections.length === 0) {
    console.log('❌ No sections found for this document');
    return;
  }

  console.log(`✅ Found ${sections.length} sections\n`);

  sections.forEach((section, index) => {
    console.log(`Section ${index + 1}:`);
    console.log(`  ID: ${section.id}`);
    console.log(`  Number: ${section.section_number || 'N/A'}`);
    console.log(`  Title: ${section.section_title || 'N/A'}`);
    console.log(`  Type: ${section.section_type || 'N/A'}`);
    console.log(`  Has section_text: ${!!section.section_text}`);
    console.log(`  section_text length: ${section.section_text?.length || 0}`);

    if (section.section_text) {
      console.log(`  First 100 chars: ${section.section_text.substring(0, 100)}...`);
    } else {
      console.log(`  ⚠️  section_text is NULL or empty!`);
    }

    console.log('');
  });

  // Check table schema
  console.log('\n📋 Checking document_sections schema...\n');
  const { data: columns, error: schemaError } = await supabase
    .rpc('get_table_columns', { table_name: 'document_sections' })
    .catch(async () => {
      // Fallback: query information_schema
      return await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .eq('table_name', 'document_sections');
    });

  if (columns && columns.length > 0) {
    console.log('Columns in document_sections:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
  }
}

checkSectionData()
  .then(() => {
    console.log('\n✨ Diagnostic complete\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
