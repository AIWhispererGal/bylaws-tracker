/**
 * Test script to verify setup check is working correctly
 * Run with: node test-setup-check.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testSetupCheck() {
  console.log('Testing setup check...\n');

  // Initialize Supabase service client (bypasses RLS)
  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Check if organizations table has any entries
    const { data, error } = await supabaseService
      .from('organizations')
      .select('id, name, created_at')
      .limit(5);

    if (error) {
      console.error('❌ Error checking organizations:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log(`✅ Successfully connected to Supabase`);
    console.log(`✅ Found ${data?.length || 0} organization(s)\n`);

    if (data && data.length > 0) {
      console.log('Organizations found:');
      data.forEach((org, index) => {
        console.log(`  ${index + 1}. ${org.name} (ID: ${org.id})`);
        console.log(`     Created: ${new Date(org.created_at).toLocaleString()}`);
      });
      console.log('\n✅ Setup is CONFIGURED - should redirect to /auth/select');
    } else {
      console.log('⚠️  No organizations found');
      console.log('⚠️  Setup is NOT CONFIGURED - should redirect to /setup');
    }

  } catch (error) {
    console.error('❌ Setup check failed:', error);
  }
}

testSetupCheck();
