/**
 * Check if data still exists in database (might be hidden by RLS)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkDataExists() {
  console.log('🔍 Checking if data still exists in database...\n');

  const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const tables = [
    'organizations',
    'users',
    'user_organizations',
    'documents',
    'document_sections',
    'suggestions'
  ];

  console.log('Using SERVICE_ROLE_KEY (should bypass ALL RLS)\n');
  console.log('═'.repeat(60) + '\n');

  for (const table of tables) {
    try {
      // Try with count
      const { count, error: countError } = await supabaseService
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.log(`❌ ${table}: Error - ${countError.message}`);
        console.log(`   Code: ${countError.code}`);
        console.log(`   Details: ${countError.details}\n`);
        continue;
      }

      if (count === 0) {
        console.log(`⚠️  ${table}: 0 rows (EMPTY or RLS blocking)`);
      } else {
        console.log(`✅ ${table}: ${count} rows (DATA EXISTS!)`);

        // Get sample data
        const { data: sample } = await supabaseService
          .from(table)
          .select('*')
          .limit(1);

        if (sample && sample.length > 0) {
          const keys = Object.keys(sample[0]).slice(0, 5).join(', ');
          console.log(`   Sample columns: ${keys}...`);
        }
      }
      console.log('');

    } catch (error) {
      console.log(`❌ ${table}: Exception - ${error.message}\n`);
    }
  }

  console.log('═'.repeat(60));
  console.log('\n💡 INTERPRETATION:');
  console.log('- If counts > 0: Data exists but might be hidden by RLS');
  console.log('- If counts = 0: Data was actually deleted');
  console.log('- If errors: RLS policy might be blocking service role\n');
}

checkDataExists();
