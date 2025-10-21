/**
 * Check what fields exist in document_sections
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkFields() {
  console.log('\n🔍 Checking document_sections fields...\n');

  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!sections || sections.length === 0) {
    console.log('No sections found');
    return;
  }

  const section = sections[0];
  console.log('Available fields in document_sections:');
  Object.keys(section).forEach(key => {
    const value = section[key];
    const type = typeof value;
    const hasValue = value !== null && value !== undefined && value !== '';
    console.log(`  ${key}: ${type} ${hasValue ? '✓ HAS VALUE' : '✗ empty/null'}`);

    if (hasValue && (key.includes('text') || key.includes('content') || key.includes('body'))) {
      console.log(`    → "${String(value).substring(0, 100)}..."`);
    }
  });
}

checkFields()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
