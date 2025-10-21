/**
 * Check suggestions table schema
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  console.log('\n🔍 Checking suggestions table schema...\n');

  // Try to get a sample suggestion
  const { data: suggestions, error } = await supabase
    .from('suggestions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying suggestions:', error);
  }

  if (suggestions && suggestions.length > 0) {
    console.log('Available fields in suggestions table:');
    Object.keys(suggestions[0]).forEach(key => {
      console.log(`  - ${key}`);
    });
  } else {
    console.log('No suggestions found, checking what columns can be inserted...');

    // Try to get schema by attempting a dummy insert (will fail but show schema)
    const { error: insertError } = await supabase
      .from('suggestions')
      .insert({});

    console.log('\nInsert error (shows required fields):', insertError?.message);
  }

  // Check suggestion_sections junction table
  console.log('\n🔍 Checking suggestion_sections junction table...\n');

  const { data: junctionData, error: junctionError } = await supabase
    .from('suggestion_sections')
    .select('*')
    .limit(1);

  if (junctionError) {
    console.error('Error querying suggestion_sections:', junctionError);
  }

  if (junctionData && junctionData.length > 0) {
    console.log('Available fields in suggestion_sections table:');
    Object.keys(junctionData[0]).forEach(key => {
      console.log(`  - ${key}`);
    });
  } else {
    console.log('No data in suggestion_sections junction table');
  }
}

checkSchema()
  .then(() => {
    console.log('\n✨ Schema check complete\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
