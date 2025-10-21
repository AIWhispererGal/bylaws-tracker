#!/usr/bin/env node
/**
 * Check if user has user_type_id set
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '2234d0d2-60d5-4f86-84b8-dd0dd44dc042';

async function checkUser() {
  console.log('\n🔍 CHECKING USER TYPE ID\n');
  console.log('User ID:', USER_ID);
  console.log('');

  // Check users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, user_type_id, created_at')
    .eq('id', USER_ID)
    .single();

  if (userError) {
    console.error('❌ Error querying users table:', userError);
    return;
  }

  console.log('✅ User record found:');
  console.log('   Email:', userData.email);
  console.log('   Created:', userData.created_at);
  console.log('   user_type_id:', userData.user_type_id || '❌ NULL (THIS IS THE PROBLEM!)');
  console.log('');

  // Check available user types
  const { data: types, error: typesError } = await supabase
    .from('user_types')
    .select('id, type_code, type_name')
    .order('type_code');

  if (typesError) {
    console.error('❌ Error querying user_types:', typesError);
    return;
  }

  console.log('📋 Available user types:');
  types.forEach(type => {
    console.log(`   • ${type.type_code} (${type.type_name}) - ID: ${type.id}`);
  });
  console.log('');

  // Provide fix SQL
  if (!userData.user_type_id) {
    const regularUserType = types.find(t => t.type_code === 'regular_user');
    if (regularUserType) {
      console.log('💡 FIX SQL:');
      console.log('');
      console.log(`UPDATE users`);
      console.log(`SET user_type_id = '${regularUserType.id}'`);
      console.log(`WHERE id = '${USER_ID}';`);
      console.log('');
      console.log('✅ Run this in Supabase SQL Editor to fix the user!');
    }
  } else {
    console.log('✅ User has user_type_id set - no fix needed!');
  }
}

checkUser().catch(console.error);
