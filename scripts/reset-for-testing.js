#!/usr/bin/env node

/**
 * Reset Database for Setup Wizard Testing
 *
 * This script clears the organizations table to simulate a fresh install,
 * allowing you to test the setup wizard flow.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function resetForTesting() {
  console.log('\n🧪 Resetting database for setup wizard testing...\n');

  try {
    // 1. Clear organizations table
    console.log('1️⃣  Clearing organizations table...');
    const { error: orgError } = await supabase
      .from('organizations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (orgError) {
      console.error('❌ Error clearing organizations:', orgError.message);
      process.exit(1);
    }
    console.log('✅ Organizations table cleared\n');

    // 2. Clear documents table
    console.log('2️⃣  Clearing documents table...');
    const { error: docError } = await supabase
      .from('documents')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (docError) {
      console.error('❌ Error clearing documents:', docError.message);
      process.exit(1);
    }
    console.log('✅ Documents table cleared\n');

    // 3. Clear document_sections table
    console.log('3️⃣  Clearing document_sections table...');
    const { error: sectionsError } = await supabase
      .from('document_sections')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (sectionsError) {
      console.error('❌ Error clearing document_sections:', sectionsError.message);
      process.exit(1);
    }
    console.log('✅ Document sections table cleared\n');

    // 4. Clear workflow_templates table
    console.log('4️⃣  Clearing workflow_templates table...');
    const { error: workflowError } = await supabase
      .from('workflow_templates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (workflowError) {
      console.error('❌ Error clearing workflow_templates:', workflowError.message);
      process.exit(1);
    }
    console.log('✅ Workflow templates table cleared\n');

    // 5. Clear workflow_stages table
    console.log('5️⃣  Clearing workflow_stages table...');
    const { error: stagesError } = await supabase
      .from('workflow_stages')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (stagesError) {
      console.error('❌ Error clearing workflow_stages:', stagesError.message);
      process.exit(1);
    }
    console.log('✅ Workflow stages table cleared\n');

    console.log('🎉 Database reset complete!\n');
    console.log('You can now test the setup wizard by visiting:');
    console.log('👉 http://localhost:3000\n');
    console.log('The app will detect no organization and show the setup wizard.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

resetForTesting();
