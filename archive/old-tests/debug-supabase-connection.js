/**
 * Debug Supabase connection - check what we're actually connecting to
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('=== ENVIRONMENT VARIABLES ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '(set - ' + process.env.SUPABASE_ANON_KEY.substring(0, 20) + '...)' : '(NOT SET)');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '(set - ' + process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...)' : '(NOT SET)');
console.log('\n');

async function debugConnection() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  console.log('=== TESTING SERVICE ROLE CLIENT ===');
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error, count } = await serviceClient
      .from('organizations')
      .select('*', { count: 'exact' })
      .limit(10);

    console.log('Query result:');
    console.log('- Error:', error);
    console.log('- Count:', count);
    console.log('- Data rows:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('\nOrganizations found:');
      data.forEach((org, i) => {
        console.log(`  ${i + 1}. ${org.name} (ID: ${org.id})`);
      });
    }
  } catch (err) {
    console.error('Exception:', err);
  }

  console.log('\n=== TESTING ANON CLIENT (with RLS) ===');
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data, error, count } = await anonClient
      .from('organizations')
      .select('*', { count: 'exact' })
      .limit(10);

    console.log('Query result:');
    console.log('- Error:', error);
    console.log('- Count:', count);
    console.log('- Data rows:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('\nOrganizations found:');
      data.forEach((org, i) => {
        console.log(`  ${i + 1}. ${org.name} (ID: ${org.id})`);
      });
    }
  } catch (err) {
    console.error('Exception:', err);
  }

  console.log('\n=== CHECKING RLS POLICIES ===');
  try {
    const { data: policies, error: policyError } = await serviceClient
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'organizations');

    if (policyError) {
      console.log('Could not fetch policies:', policyError.message);
    } else {
      console.log(`Found ${policies?.length || 0} RLS policies on organizations table`);
      if (policies && policies.length > 0) {
        policies.forEach(p => {
          console.log(`  - ${p.policyname}: ${p.cmd} (${p.permissive})`);
        });
      }
    }
  } catch (err) {
    console.log('Could not check policies:', err.message);
  }
}

debugConnection();
