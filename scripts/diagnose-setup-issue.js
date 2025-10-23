const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * Diagnostic Script: Setup Wizard Issues
 *
 * Checks for:
 * 1. Duplicate organizations being created
 * 2. User-organization linking failures
 * 3. Users without proper organization assignments
 */

async function diagnose() {
  console.log('🔍 Starting Setup Issue Diagnosis...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check recent organizations
  console.log('📊 Checking recent organizations...');
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name, slug, created_at, is_configured')
    .order('created_at', { ascending: false })
    .limit(10);

  if (orgsError) {
    console.error('❌ Error fetching organizations:', orgsError);
  } else {
    console.log(`Found ${orgs.length} recent organizations:`);
    orgs.forEach((org, i) => {
      console.log(`  ${i + 1}. ${org.name} (${org.slug})`);
      console.log(`     - ID: ${org.id}`);
      console.log(`     - Created: ${org.created_at}`);
      console.log(`     - Configured: ${org.is_configured}`);
    });

    // Check for duplicates (same slug pattern)
    const slugMap = {};
    orgs.forEach(org => {
      const baseSlug = org.slug.replace(/-[a-z0-9]+$/, ''); // Remove timestamp suffix
      if (!slugMap[baseSlug]) {
        slugMap[baseSlug] = [];
      }
      slugMap[baseSlug].push(org);
    });

    console.log('\n🔍 Checking for duplicate organizations...');
    let foundDuplicates = false;
    Object.entries(slugMap).forEach(([baseSlug, orgList]) => {
      if (orgList.length > 1) {
        foundDuplicates = true;
        console.log(`⚠️  DUPLICATE: ${orgList.length} orgs with similar slug "${baseSlug}":`);
        orgList.forEach(org => {
          console.log(`   - ${org.name} (${org.slug}) created at ${org.created_at}`);
        });
      }
    });
    if (!foundDuplicates) {
      console.log('✅ No duplicate organizations found');
    }
  }

  console.log('\n📊 Checking user-organization links...');
  const { data: links, error: linksError } = await supabase
    .from('user_organizations')
    .select(`
      id,
      user_id,
      organization_id,
      role,
      created_at,
      users:user_id (id, email, organization_id),
      organizations:organization_id (id, name, slug)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (linksError) {
    console.error('❌ Error fetching user-org links:', linksError);
  } else {
    console.log(`Found ${links.length} recent user-organization links:`);
    links.forEach((link, i) => {
      console.log(`  ${i + 1}. User: ${link.users?.email || link.user_id}`);
      console.log(`     - Organization: ${link.organizations?.name || link.organization_id}`);
      console.log(`     - Role: ${link.role}`);
      console.log(`     - Created: ${link.created_at}`);
      console.log(`     - User's org_id field: ${link.users?.organization_id || 'NULL'}`);
    });
  }

  console.log('\n📊 Checking users without organization_id...');
  const { data: usersWithoutOrg, error: usersError } = await supabase
    .from('users')
    .select('id, email, organization_id, created_at')
    .is('organization_id', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
  } else {
    if (usersWithoutOrg.length > 0) {
      console.log(`⚠️  Found ${usersWithoutOrg.length} users without organization_id:`);
      usersWithoutOrg.forEach((user, i) => {
        console.log(`  ${i + 1}. ${user.email}`);
        console.log(`     - ID: ${user.id}`);
        console.log(`     - Created: ${user.created_at}`);
      });
    } else {
      console.log('✅ All users have organization_id set');
    }
  }

  console.log('\n📊 Checking orphaned organizations (no linked users)...');
  const { data: allOrgs } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .order('created_at', { ascending: false });

  if (allOrgs) {
    const orphanedOrgs = [];
    for (const org of allOrgs) {
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
      console.log(`⚠️  Found ${orphanedOrgs.length} orphaned organizations (no users):`);
      orphanedOrgs.forEach((org, i) => {
        console.log(`  ${i + 1}. ${org.name} (${org.slug})`);
        console.log(`     - ID: ${org.id}`);
      });
    } else {
      console.log('✅ All organizations have at least one linked user');
    }
  }

  console.log('\n✅ Diagnosis complete!');
}

diagnose()
  .catch(err => {
    console.error('❌ Diagnosis failed:', err);
    console.error('Stack:', err.stack);
  })
  .finally(() => {
    process.exit(0);
  });
