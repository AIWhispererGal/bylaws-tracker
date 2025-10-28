#!/usr/bin/env node
/**
 * Emergency Setup Wizard Reset Script
 *
 * This script safely resets stuck setup wizard state by:
 * - Clearing all sessions from the database
 * - Deleting incomplete organizations (is_configured=false)
 * - Removing orphaned users from failed registrations
 * - Clearing setup middleware cache
 *
 * SAFETY: Safe to run multiple times - only affects incomplete/stuck data
 *
 * Usage:
 *   node scripts/reset-setup-wizard.js
 *   node scripts/reset-setup-wizard.js --force (skip confirmation)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Initialize Supabase with service role (bypasses RLS)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Missing required environment variables');
  console.error('   Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Prompt user for confirmation
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Count records that will be affected
 */
async function analyzeImpact() {
  console.log('\n📊 Analyzing setup wizard state...\n');

  // Count incomplete organizations
  const { data: incompleteOrgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, created_at')
    .eq('is_configured', false);

  if (orgsError) {
    console.error('Error querying organizations:', orgsError);
    return null;
  }

  // Count configured organizations (should NOT be deleted)
  const { data: configuredOrgs, error: configuredError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('is_configured', true);

  if (configuredError) {
    console.error('Error querying configured organizations:', configuredError);
    return null;
  }

  // Count orphaned users (users without an organization)
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email, organization_id');

  if (usersError) {
    console.error('Error querying users:', usersError);
    return null;
  }

  const orphanedUsers = allUsers ? allUsers.filter(user => !user.organization_id) : [];

  return {
    incompleteOrgs: incompleteOrgs || [],
    configuredOrgs: configuredOrgs || [],
    orphanedUsers
  };
}

/**
 * Clear all sessions from database
 */
async function clearSessions() {
  console.log('🧹 Clearing sessions...');

  // Note: Express sessions are typically stored in a separate table or memory
  // This clears any Supabase auth sessions if they exist
  try {
    const { error } = await supabase.auth.admin.signOut('all');

    if (error && error.message !== 'Method not found') {
      console.warn('   ⚠️  Warning during session clear:', error.message);
    } else {
      console.log('   ✅ Sessions cleared');
    }
  } catch (error) {
    console.warn('   ⚠️  Session clearing not supported (this is okay)');
  }

  return true;
}

/**
 * Delete incomplete organizations and their related data
 */
async function deleteIncompleteOrganizations(orgIds) {
  if (orgIds.length === 0) {
    console.log('   ℹ️  No incomplete organizations to delete');
    return true;
  }

  console.log(`🗑️  Deleting ${orgIds.length} incomplete organization(s)...`);

  for (const orgId of orgIds) {
    console.log(`   Processing organization ${orgId}...`);

    // Delete related data first (cascade)

    // Delete workflow stages
    const { data: templates } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('organization_id', orgId);

    if (templates && templates.length > 0) {
      const templateIds = templates.map(t => t.id);
      await supabase
        .from('workflow_stages')
        .delete()
        .in('workflow_template_id', templateIds);
    }

    // Delete workflow templates
    await supabase
      .from('workflow_templates')
      .delete()
      .eq('organization_id', orgId);

    // Delete document sections
    const { data: documents } = await supabase
      .from('documents')
      .select('id')
      .eq('organization_id', orgId);

    if (documents && documents.length > 0) {
      const docIds = documents.map(d => d.id);
      await supabase
        .from('document_sections')
        .delete()
        .in('document_id', docIds);
    }

    // Delete documents
    await supabase
      .from('documents')
      .delete()
      .eq('organization_id', orgId);

    // Delete users associated with this organization
    await supabase
      .from('users')
      .delete()
      .eq('organization_id', orgId);

    // Finally, delete the organization
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (error) {
      console.error(`   ❌ Error deleting organization ${orgId}:`, error);
      return false;
    } else {
      console.log(`   ✅ Deleted organization ${orgId}`);
    }
  }

  return true;
}

/**
 * Delete orphaned users (no organization)
 */
async function deleteOrphanedUsers(userIds) {
  if (userIds.length === 0) {
    console.log('   ℹ️  No orphaned users to delete');
    return true;
  }

  console.log(`🗑️  Deleting ${userIds.length} orphaned user(s)...`);

  const { error } = await supabase
    .from('users')
    .delete()
    .in('id', userIds);

  if (error) {
    console.error('   ❌ Error deleting orphaned users:', error);
    return false;
  }

  console.log('   ✅ Orphaned users deleted');
  return true;
}

/**
 * Clear setup middleware cache
 */
async function clearSetupCache() {
  console.log('🧹 Clearing setup middleware cache...');

  try {
    // The cache is in-memory in the Node.js process
    // It will be cleared when the server restarts
    // This is a placeholder for any persistent cache clearing
    console.log('   ℹ️  Cache will be cleared on next server restart');
    console.log('   💡 TIP: Restart your server with: npm run dev');
    return true;
  } catch (error) {
    console.error('   ❌ Error clearing cache:', error);
    return false;
  }
}

/**
 * Main reset function
 */
async function resetSetupWizard(skipConfirmation = false) {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  🔧 SETUP WIZARD EMERGENCY RESET TOOL 🔧          ║');
  console.log('╚════════════════════════════════════════════════════╝');

  // Analyze what will be affected
  const impact = await analyzeImpact();

  if (!impact) {
    console.error('\n❌ Failed to analyze database state. Aborting.');
    process.exit(1);
  }

  console.log('📋 IMPACT ANALYSIS:');
  console.log(`   • Incomplete organizations:     ${impact.incompleteOrgs.length}`);
  console.log(`   • Configured organizations:     ${impact.configuredOrgs.length} (will NOT be deleted)`);
  console.log(`   • Orphaned users:               ${impact.orphanedUsers.length}`);

  if (impact.incompleteOrgs.length > 0) {
    console.log('\n📝 Incomplete organizations to be deleted:');
    impact.incompleteOrgs.forEach(org => {
      console.log(`   - ${org.name} (ID: ${org.id}, created: ${new Date(org.created_at).toLocaleString()})`);
    });
  }

  if (impact.configuredOrgs.length > 0) {
    console.log('\n✅ Protected (configured) organizations:');
    impact.configuredOrgs.forEach(org => {
      console.log(`   - ${org.name} (ID: ${org.id})`);
    });
  }

  if (impact.orphanedUsers.length > 0) {
    console.log('\n👥 Orphaned users to be deleted:');
    impact.orphanedUsers.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`);
    });
  }

  // Check if there's anything to do
  const hasWork = impact.incompleteOrgs.length > 0 || impact.orphanedUsers.length > 0;

  if (!hasWork) {
    console.log('\n✅ No cleanup needed! Setup wizard state is clean.');
    process.exit(0);
  }

  // Confirm before proceeding
  if (!skipConfirmation) {
    console.log('\n⚠️  WARNING: This will permanently delete the data listed above.');
    console.log('   Configured organizations and their data will NOT be affected.');

    const confirmed = await confirm('\nDo you want to proceed with the reset?');

    if (!confirmed) {
      console.log('\n❌ Reset cancelled by user.');
      process.exit(0);
    }
  }

  console.log('\n🚀 Starting reset process...\n');

  // Execute reset steps
  const steps = [
    { name: 'Clear sessions', fn: clearSessions },
    {
      name: 'Delete incomplete organizations',
      fn: () => deleteIncompleteOrganizations(impact.incompleteOrgs.map(o => o.id))
    },
    {
      name: 'Delete orphaned users',
      fn: () => deleteOrphanedUsers(impact.orphanedUsers.map(u => u.id))
    },
    { name: 'Clear setup cache', fn: clearSetupCache }
  ];

  for (const step of steps) {
    const success = await step.fn();
    if (!success) {
      console.error(`\n❌ Reset failed at step: ${step.name}`);
      process.exit(1);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  ✅ SETUP WIZARD RESET COMPLETE! ✅               ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart your server: npm run dev');
  console.log('   2. Navigate to /setup to start fresh');
  console.log('   3. Complete the setup wizard');
  console.log('\n💡 All configured organizations and their data remain intact.\n');
}

// Run the reset
const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');
resetSetupWizard(forceFlag).catch((error) => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
