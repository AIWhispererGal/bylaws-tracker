/**
 * Authentication Diagnostic Script
 * Tests the complete authentication flow and document loading
 *
 * Run with: node tests/auth-diagnostic.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create clients
const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runDiagnostics() {
  console.log('\n🔍 AUTHENTICATION DIAGNOSTIC REPORT');
  console.log('=' .repeat(60));

  try {
    // TEST 1: Check if organizations exist
    console.log('\n1️⃣  Checking Organizations...');
    const { data: orgs, error: orgError } = await supabaseService
      .from('organizations')
      .select('id, name, slug, created_at')
      .limit(5);

    if (orgError) {
      console.error('❌ Error fetching organizations:', orgError.message);
    } else if (!orgs || orgs.length === 0) {
      console.log('⚠️  No organizations found - run setup wizard first');
      return;
    } else {
      console.log(`✅ Found ${orgs.length} organization(s)`);
      orgs.forEach(org => {
        console.log(`   - ${org.name} (ID: ${org.id})`);
      });
    }

    const firstOrg = orgs[0];

    // TEST 2: Check if documents exist (with service role)
    console.log('\n2️⃣  Checking Documents (Service Role)...');
    const { data: docs, error: docsError } = await supabaseService
      .from('documents')
      .select('id, title, document_type, organization_id, created_at')
      .eq('organization_id', firstOrg.id)
      .limit(5);

    if (docsError) {
      console.error('❌ Error fetching documents:', docsError.message);
    } else if (!docs || docs.length === 0) {
      console.log('⚠️  No documents found for organization:', firstOrg.name);
    } else {
      console.log(`✅ Found ${docs.length} document(s) for ${firstOrg.name}`);
      docs.forEach(doc => {
        console.log(`   - ${doc.title} (${doc.document_type})`);
      });
    }

    // TEST 3: Try to fetch documents with ANON key (should fail with RLS)
    console.log('\n3️⃣  Testing Anonymous Access (should fail)...');
    const { data: anonDocs, error: anonError } = await supabaseAnon
      .from('documents')
      .select('id, title')
      .eq('organization_id', firstOrg.id);

    if (anonError) {
      console.log('✅ Anonymous access blocked (as expected):', anonError.message);
    } else if (!anonDocs || anonDocs.length === 0) {
      console.log('✅ Anonymous access returns empty (RLS working)');
    } else {
      console.log('⚠️  WARNING: Anonymous access returned data - RLS may not be properly configured!');
      console.log(`   Found ${anonDocs.length} documents with anon key`);
    }

    // TEST 4: Check Auth Users
    console.log('\n4️⃣  Checking Auth Users...');
    const { data: { users }, error: usersError } = await supabaseService.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Error listing users:', usersError.message);
    } else if (!users || users.length === 0) {
      console.log('⚠️  No auth users found');
    } else {
      console.log(`✅ Found ${users.length} auth user(s)`);
      users.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      });
    }

    // TEST 5: Check user_organizations mappings
    console.log('\n5️⃣  Checking User-Organization Mappings...');
    const { data: userOrgs, error: userOrgsError } = await supabaseService
      .from('user_organizations')
      .select('user_id, organization_id, role, created_at')
      .eq('organization_id', firstOrg.id);

    if (userOrgsError) {
      console.error('❌ Error fetching user-org mappings:', userOrgsError.message);
    } else if (!userOrgs || userOrgs.length === 0) {
      console.log('⚠️  No user-organization mappings found');
    } else {
      console.log(`✅ Found ${userOrgs.length} user-org mapping(s)`);
      userOrgs.forEach(mapping => {
        console.log(`   - User ${mapping.user_id}: ${mapping.role}`);
      });
    }

    // TEST 6: Test authenticated access
    if (users && users.length > 0) {
      console.log('\n6️⃣  Testing Authenticated Access...');
      const testUser = users[0];

      // Note: We can't easily test JWT auth here without the actual password
      // This would need to be tested via the application flow
      console.log(`ℹ️  To test authenticated access:`);
      console.log(`   1. Complete setup wizard to create session with JWT`);
      console.log(`   2. Navigate to /dashboard`);
      console.log(`   3. Check browser console for JWT presence`);
      console.log(`   4. Verify documents load in dashboard`);
      console.log(`\n   User to test with: ${testUser.email}`);
    }

    // TEST 7: Check document sections
    if (docs && docs.length > 0) {
      console.log('\n7️⃣  Checking Document Sections...');
      const { data: sections, error: sectionsError } = await supabaseService
        .from('document_sections')
        .select('id, section_number, section_title')
        .eq('document_id', docs[0].id)
        .limit(5);

      if (sectionsError) {
        console.error('❌ Error fetching sections:', sectionsError.message);
      } else if (!sections || sections.length === 0) {
        console.log('⚠️  No sections found for document:', docs[0].title);
      } else {
        console.log(`✅ Found ${sections.length} section(s) for ${docs[0].title}`);
        sections.forEach(section => {
          console.log(`   - Section ${section.section_number}: ${section.section_title || 'No title'}`);
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Organizations:', orgs?.length || 0);
    console.log('✅ Documents:', docs?.length || 0);
    console.log('✅ Auth Users:', users?.length || 0);
    console.log('✅ User-Org Mappings:', userOrgs?.length || 0);

    if (users && users.length > 0 && userOrgs && userOrgs.length > 0) {
      console.log('\n✅ SETUP LOOKS GOOD!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Start the server: npm start');
      console.log('   2. Navigate to: http://localhost:3000/dashboard');
      console.log('   3. Documents should now load with authentication');
      console.log('\n🔍 Debugging Tips:');
      console.log('   - Check server logs for [SETUP-AUTH] messages');
      console.log('   - Verify JWT tokens in session: req.session.supabaseJWT');
      console.log('   - Check browser console for authentication errors');
      console.log('   - Verify RLS policies allow authenticated access');
    } else {
      console.log('\n⚠️  SETUP INCOMPLETE');
      console.log('   Please complete the setup wizard at /setup');
    }

  } catch (error) {
    console.error('\n❌ DIAGNOSTIC ERROR:', error);
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Run diagnostics
runDiagnostics()
  .then(() => {
    console.log('✅ Diagnostics complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Diagnostics failed:', error);
    process.exit(1);
  });
