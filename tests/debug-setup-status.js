require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

console.log('=== DETECTIVE: SETUP STATUS CHECK DIAGNOSTIC ===\n');

console.log('1️⃣ Environment Variables:');
console.log('  SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '✗ MISSING');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ MISSING');
console.log('  SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ Set' : '✗ MISSING');
console.log('');

console.log('2️⃣ Client Initialization (matching server.js line 24):');
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
console.log('  supabaseService created:', supabaseService ? '✓' : '✗ FAILED');
console.log('  Using key type:', SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');
console.log('');

async function checkSetupStatus() {
  console.log('3️⃣ Executing checkSetupStatus (matching server.js lines 187-213):');

  try {
    // Exact copy of the function from server.js
    const { data, error } = await supabaseService
      .from('organizations')
      .select('id')
      .limit(1);

    console.log('  Query executed');
    console.log('  Error:', error ? JSON.stringify(error) : 'null');
    console.log('  Data:', data ? JSON.stringify(data) : 'null');
    console.log('  Data length:', data?.length || 0);
    console.log('');

    if (error) {
      console.error('❌ ERROR in query:', error);
      console.error('❌ Error details:', JSON.stringify(error));
      return false;
    }

    const isConfigured = data && data.length > 0;
    console.log(`4️⃣ Result: isConfigured = ${isConfigured}`);
    console.log('  Logic: data=${data ? "truthy" : "falsy"} AND data.length=${data?.length} > 0');
    console.log('');

    return isConfigured;
  } catch (error) {
    console.error('❌ EXCEPTION in checkSetupStatus:', error);
    return false;
  }
}

// Run the test
checkSetupStatus().then(result => {
  console.log('=== FINAL VERDICT ===');
  console.log('checkSetupStatus returned:', result);
  console.log('Expected: true (if organizations exist in database)');
  console.log('');

  if (result === false) {
    console.log('🔍 INVESTIGATION RESULTS:');
    console.log('The function returned FALSE when it should return TRUE.');
    console.log('Possible causes:');
    console.log('  1. Database query returned empty (no organizations)');
    console.log('  2. Database query had an error (RLS policies blocking)');
    console.log('  3. Supabase client not properly initialized');
  } else {
    console.log('✅ Function is working correctly!');
  }

  process.exit(result ? 0 : 1);
}).catch(err => {
  console.error('💥 FATAL ERROR:', err);
  process.exit(1);
});
