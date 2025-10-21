/**
 * Check database tables and data
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkDatabase() {
  console.log('Checking database tables...\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const tables = [
    'organizations',
    'users',
    'user_organizations',
    'documents',
    'document_sections'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabaseService
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(3);

      if (error) {
        console.log(`❌ ${table}: Error - ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`);
        if (data && data.length > 0) {
          console.log(`   Sample: ${JSON.stringify(data[0], null, 2).substring(0, 200)}...`);
        }
      }
    } catch (error) {
      console.log(`❌ ${table}: ${error.message}`);
    }
    console.log('');
  }
}

checkDatabase();
