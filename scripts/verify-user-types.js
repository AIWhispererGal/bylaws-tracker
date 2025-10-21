#!/usr/bin/env node
/**
 * Quick Diagnostic Script: Verify user_types table issue
 * Run: node scripts/verify-user-types.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseUserTypes() {
  console.log('🔍 ANALYST AGENT DIAGNOSIS TOOL');
  console.log('================================\n');

  // Test 1: Check for duplicates
  console.log('TEST 1: Checking for duplicate type_codes...');
  const { data: duplicates, error: dupError } = await supabase
    .from('user_types')
    .select('type_code, id, created_at')
    .order('type_code')
    .order('created_at');

  if (dupError) {
    console.error('❌ Error querying user_types:', dupError.message);
    return;
  }

  // Group by type_code
  const grouped = {};
  duplicates.forEach(row => {
    if (!grouped[row.type_code]) {
      grouped[row.type_code] = [];
    }
    grouped[row.type_code].push(row);
  });

  let hasDuplicates = false;
  Object.entries(grouped).forEach(([type_code, rows]) => {
    if (rows.length > 1) {
      console.error(`❌ DUPLICATE FOUND: '${type_code}' has ${rows.length} rows!`);
      rows.forEach((row, idx) => {
        console.error(`   ${idx + 1}. ID: ${row.id}, Created: ${row.created_at}`);
      });
      hasDuplicates = true;
    } else {
      console.log(`✅ '${type_code}' - OK (1 row)`);
    }
  });

  if (hasDuplicates) {
    console.log('\n❌ DIAGNOSIS: Duplicate type_codes found!');
    console.log('📋 FIX: Delete duplicate rows, keeping only the newest one.');
    console.log('📄 See: docs/reports/ANALYST_DIAGNOSIS_USER_TYPES_ERROR.md');
  } else {
    console.log('\n✅ No duplicates found.');
  }

  // Test 2: Check for required type_codes
  console.log('\nTEST 2: Checking for required type_codes...');
  const requiredTypes = ['regular_user', 'global_admin'];

  for (const typeCode of requiredTypes) {
    const { data, error } = await supabase
      .from('user_types')
      .select('id')
      .eq('type_code', typeCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.error(`❌ '${typeCode}' - NOT FOUND (zero rows)`);
      } else if (error.details?.includes('multiple')) {
        console.error(`❌ '${typeCode}' - MULTIPLE ROWS (should be 1)`);
      } else {
        console.error(`❌ '${typeCode}' - ERROR: ${error.message}`);
      }
    } else {
      console.log(`✅ '${typeCode}' - Found (ID: ${data.id})`);
    }
  }

  // Test 3: Show all type_codes
  console.log('\nTEST 3: All type_codes in database:');
  const { data: allTypes } = await supabase
    .from('user_types')
    .select('type_code, type_name, id')
    .order('type_code');

  if (allTypes && allTypes.length > 0) {
    allTypes.forEach(type => {
      console.log(`   - '${type.type_code}' (${type.type_name}) - ID: ${type.id}`);
    });
  } else {
    console.error('❌ No user_types found in database!');
  }

  // Test 4: Simulate the exact failing query
  console.log('\nTEST 4: Simulating exact query from setup.js (line 713-717)...');
  const userTypeCode = 'regular_user'; // This is what the code uses
  const { data: userType, error: userTypeError } = await supabase
    .from('user_types')
    .select('id')
    .eq('type_code', userTypeCode)
    .single();

  if (userTypeError) {
    console.error('❌ QUERY FAILED (This is the bug!)');
    console.error(`   Error: ${userTypeError.message}`);
    console.error(`   Code: ${userTypeError.code}`);
    console.error(`   Details: ${userTypeError.details || 'N/A'}`);

    if (userTypeError.code === 'PGRST116') {
      console.log('\n💡 ROOT CAUSE: Zero rows returned');
      console.log('   → type_code "regular_user" does not exist in database');
      console.log('   → Check spelling or run migration to create it');
    } else if (userTypeError.details?.includes('multiple')) {
      console.log('\n💡 ROOT CAUSE: Multiple rows returned');
      console.log('   → Duplicate type_code entries in database');
      console.log('   → Delete duplicates keeping only one');
    }
  } else {
    console.log('✅ QUERY SUCCEEDED');
    console.log(`   Found user_type ID: ${userType.id}`);
  }

  console.log('\n================================');
  console.log('📊 DIAGNOSIS COMPLETE');
  console.log('📄 Full report: docs/reports/ANALYST_DIAGNOSIS_USER_TYPES_ERROR.md');
}

diagnoseUserTypes().catch(err => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});
