/**
 * Query database using raw SQL to bypass RLS entirely
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function queryWithSQL() {
  console.log('Querying with raw SQL (bypasses RLS completely)...\n');

  const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Use RPC to execute raw SQL
    const { data, error } = await supabaseService.rpc('exec_sql', {
      query: 'SELECT id, name, organization_type, created_at FROM organizations LIMIT 10'
    });

    if (error) {
      console.log('❌ RPC method not available, trying direct query...');

      // Try direct query with postgrest
      const { data: orgData, error: orgError } = await supabaseService
        .from('organizations')
        .select('id, name, organization_type, created_at')
        .limit(10);

      if (orgError) {
        console.error('❌ Direct query error:', orgError);
      } else {
        console.log(`✅ Found ${orgData?.length || 0} organizations:\n`);
        if (orgData && orgData.length > 0) {
          orgData.forEach((org, i) => {
            console.log(`${i + 1}. ${org.name}`);
            console.log(`   ID: ${org.id}`);
            console.log(`   Type: ${org.organization_type}`);
            console.log(`   Created: ${new Date(org.created_at).toLocaleString()}`);
            console.log('');
          });
        } else {
          console.log('   No organizations found in database');
          console.log('   This suggests:');
          console.log('   1. Wrong Supabase project in .env');
          console.log('   2. Organizations table is actually empty');
          console.log('   3. Database connection issue');
        }
      }
    } else {
      console.log('✅ Raw SQL query successful:', data);
    }

  } catch (error) {
    console.error('❌ Query failed:', error.message);
  }
}

queryWithSQL();
