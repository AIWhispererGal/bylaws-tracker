#!/usr/bin/env node

/**
 * Run Database Migration for Setup Wizard
 *
 * This creates the organizations table and other required tables
 * for the setup wizard to work.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('\n🗄️  Running database migration...\n');

  try {
    // Check if organizations table already exists
    const { data: existingOrg, error: checkError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Organizations table already exists!');
      console.log('🎉 Database is ready.\n');
      return;
    }

    console.log('📝 Organizations table does not exist. Creating tables...\n');
    console.log('⚠️  This requires running SQL manually in Supabase.\n');
    console.log('📋 Please follow these steps:\n');
    console.log('1. Open Supabase: https://wqrcslmaytruvspzyfkz.supabase.co');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Copy and paste the SQL from:');
    console.log('   database/migrations/001_generalized_schema.sql');
    console.log('5. Click "Run"');
    console.log('6. Come back here and run: npm start\n');
    console.log('💡 Or I can show you a simplified version...\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runMigration();
