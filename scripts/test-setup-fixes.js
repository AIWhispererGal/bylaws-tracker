const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Test Script: Verify Setup Wizard Fixes
 *
 * Tests:
 * 1. No duplicate organizations exist
 * 2. All users have organization_id set
 * 3. All user_organizations links have valid role
 * 4. Orphaned organizations don't exist
 */

async function testSetupFixes() {
  console.log('🧪 Testing Setup Wizard Fixes...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let allPassed = true;

  // Test 1: Check for duplicate organizations
  console.log('Test 1: Checking for duplicate organizations...');
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false });

  const slugMap = {};
  orgs.forEach(org => {
    const baseSlug = org.slug.replace(/-[a-z0-9]+$/, '');
    if (!slugMap[baseSlug]) {
      slugMap[baseSlug] = [];
    }
    slugMap[baseSlug].push(org);
  });

  const duplicates = Object.entries(slugMap).filter(([_, list]) => list.length > 1);
  if (duplicates.length > 0) {
    console.log('  ❌ FAIL: Found duplicate organizations:');
    duplicates.forEach(([baseSlug, list]) => {
      console.log(`     - ${baseSlug}: ${list.length} duplicates`);
      list.forEach(org => {
        console.log(`       - ${org.name} (${org.slug}) at ${org.created_at}`);
      });
    });
    allPassed = false;
  } else {
    console.log('  ✅ PASS: No duplicate organizations found\n');
  }

  // Test 2: Check users have organization_id
  console.log('Test 2: Checking users have organization_id...');
  const { data: usersWithoutOrg } = await supabase
    .from('users')
    .select('id, email, organization_id')
    .is('organization_id', null);

  if (usersWithoutOrg && usersWithoutOrg.length > 0) {
    console.log('  ❌ FAIL: Found users without organization_id:');
    usersWithoutOrg.forEach(user => {
      console.log(`     - ${user.email} (${user.id})`);
    });
    allPassed = false;
  } else {
    console.log('  ✅ PASS: All users have organization_id set\n');
  }

  // Test 3: Check user_organizations links have valid roles
  console.log('Test 3: Checking user_organizations have valid roles...');
  const { data: links } = await supabase
    .from('user_organizations')
    .select('id, user_id, organization_id, role, org_role_id');

  const invalidLinks = links.filter(link => !link.role && !link.org_role_id);
  if (invalidLinks.length > 0) {
    console.log('  ❌ FAIL: Found user_organizations links without role:');
    invalidLinks.forEach(link => {
      console.log(`     - Link ${link.id}: user ${link.user_id} -> org ${link.organization_id}`);
    });
    allPassed = false;
  } else {
    console.log('  ✅ PASS: All user_organizations have valid roles\n');
  }

  // Test 4: Check for orphaned organizations
  console.log('Test 4: Checking for orphaned organizations...');
  const orphanedOrgs = [];
  for (const org of orgs) {
    const { data: orgLinks } = await supabase
      .from('user_organizations')
      .select('id')
      .eq('organization_id', org.id)
      .limit(1);

    if (!orgLinks || orgLinks.length === 0) {
      orphanedOrgs.push(org);
    }
  }

  if (orphanedOrgs.length > 0) {
    console.log('  ❌ FAIL: Found orphaned organizations (no users):');
    orphanedOrgs.forEach(org => {
      console.log(`     - ${org.name} (${org.slug})`);
    });
    allPassed = false;
  } else {
    console.log('  ✅ PASS: All organizations have linked users\n');
  }

  // Test 5: Check setup wizard creates owner role
  console.log('Test 5: Checking owner roles in recent setups...');
  const recentLinks = links
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const nonOwners = recentLinks.filter(link => link.role !== 'owner');
  if (nonOwners.length === recentLinks.length && recentLinks.length > 0) {
    console.log('  ⚠️  WARNING: Recent user_organizations links don\'t have "owner" role');
    console.log('     This might indicate setup wizard is not setting role correctly');
    allPassed = false;
  } else {
    console.log('  ✅ PASS: Recent setups have owner roles\n');
  }

  // Summary
  console.log('═'.repeat(60));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED! Setup wizard fixes are working correctly.');
  } else {
    console.log('❌ SOME TESTS FAILED! Review the output above for details.');
  }
  console.log('═'.repeat(60));

  return allPassed;
}

testSetupFixes()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Test execution failed:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  });
