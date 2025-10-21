/**
 * Get exact column list from information_schema
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getColumns() {
  console.log('\n📋 Getting suggestions table columns from database...\n');

  // Query information_schema
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'suggestions')
    .order('ordinal_position');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Columns in suggestions table:');
  data.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
    console.log(`  ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
  });

  // Also check suggestion_sections
  console.log('\n📋 Getting suggestion_sections table columns...\n');

  const { data: junctionData, error: junctionError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .eq('table_name', 'suggestion_sections')
    .order('ordinal_position');

  if (junctionError) {
    console.error('Error:', junctionError);
    return;
  }

  console.log('Columns in suggestion_sections table:');
  junctionData.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`  ${col.column_name}: ${col.data_type} ${nullable}`);
  });
}

getColumns()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
