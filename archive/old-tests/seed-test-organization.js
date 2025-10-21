/**
 * Seed test organization into database
 * Run with: node seed-test-organization.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function seedTestOrganization() {
  console.log('Seeding test organization...\n');

  const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Create test organization
    const { data: org, error: orgError } = await supabaseService
      .from('organizations')
      .insert({
        name: 'Test Organization',
        organization_type: 'nonprofit',
        website: 'https://example.com',
        contact_email: 'admin@example.com',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zip_code: '12345'
      })
      .select()
      .single();

    if (orgError) {
      console.error('❌ Error creating organization:', orgError);
      return;
    }

    console.log(`✅ Created organization: ${org.name} (ID: ${org.id})\n`);

    // Create test admin user (Supabase Auth user)
    const testEmail = 'admin@example.com';
    const testPassword = 'TestPassword123!';

    const { data: authUser, error: authError } = await supabaseService.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Test Admin'
      }
    });

    if (authError) {
      console.error('❌ Error creating auth user:', authError);
      console.log('   (This might be okay if user already exists)');
    } else {
      console.log(`✅ Created auth user: ${testEmail}`);
      console.log(`   Password: ${testPassword}\n`);

      // Create user in users table
      const { error: userError } = await supabaseService
        .from('users')
        .insert({
          id: authUser.user.id,
          email: testEmail,
          name: 'Test Admin'
        });

      if (userError && userError.code !== '23505') { // Ignore duplicate key error
        console.error('❌ Error creating user:', userError);
      } else {
        console.log(`✅ Created user in users table\n`);
      }

      // Link user to organization with owner role
      const { error: userOrgError } = await supabaseService
        .from('user_organizations')
        .insert({
          user_id: authUser.user.id,
          organization_id: org.id,
          role: 'owner',
          is_active: true
        });

      if (userOrgError) {
        console.error('❌ Error linking user to org:', userOrgError);
      } else {
        console.log(`✅ Linked user to organization as owner\n`);
      }
    }

    console.log('════════════════════════════════════════');
    console.log('✅ SEED COMPLETE!');
    console.log('════════════════════════════════════════');
    console.log('\nYou can now:');
    console.log(`1. Go to http://localhost:3000/`);
    console.log(`   → Should redirect to /auth/select`);
    console.log(`\n2. Click "Login" and use:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log('\n3. Select "Test Organization" to access dashboard');
    console.log('════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
  }
}

seedTestOrganization();
