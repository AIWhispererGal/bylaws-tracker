/**
 * Test Script: Session Persistence After Login
 *
 * This script tests that JWT tokens are properly stored in session
 * and persist across requests after login.
 *
 * Run with: node tests/test-session-persistence.js
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'mgallagh@gmail.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test-password-here';

async function testSessionPersistence() {
  console.log('\n🧪 Testing Session Persistence After Login\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test User: ${TEST_EMAIL}\n`);

  let sessionCookie = null;

  // Step 1: Login
  console.log('📝 Step 1: Logging in...');
  try {
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.error);
      return;
    }

    console.log('✅ Login successful');
    console.log('   User ID:', loginData.user.id);
    console.log('   Email:', loginData.user.email);
    console.log('   Redirect:', loginData.redirectTo);
    console.log('   Organizations:', loginData.organizations?.length || 0);

    // Extract session cookie
    const cookies = loginResponse.headers.raw()['set-cookie'];
    if (cookies && cookies.length > 0) {
      sessionCookie = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      console.log('   Session cookie received:', sessionCookie ? '✅' : '❌');
    } else {
      console.warn('⚠️  No session cookie in login response!');
    }

    // Wait a moment for session to save
    await new Promise(resolve => setTimeout(resolve, 100));

  } catch (error) {
    console.error('❌ Login request failed:', error.message);
    return;
  }

  // Step 2: Check session endpoint
  console.log('\n📝 Step 2: Checking session endpoint...');
  try {
    const sessionResponse = await fetch(`${BASE_URL}/auth/session`, {
      headers: {
        'Cookie': sessionCookie || ''
      }
    });

    const sessionData = await sessionResponse.json();

    if (sessionData.success && sessionData.authenticated) {
      console.log('✅ Session is authenticated');
      console.log('   User ID:', sessionData.user.id);
      console.log('   Email:', sessionData.user.email);
      console.log('   Organization:', sessionData.organization?.name || 'None');
      console.log('   Session expires in:', sessionData.session?.expiresIn || 'Unknown', 'seconds');
    } else {
      console.error('❌ Session not authenticated:', sessionData.error);
      return;
    }

  } catch (error) {
    console.error('❌ Session check failed:', error.message);
    return;
  }

  // Step 3: Load dashboard overview (requires JWT)
  console.log('\n📝 Step 3: Loading dashboard overview...');
  try {
    const overviewResponse = await fetch(`${BASE_URL}/api/dashboard/overview`, {
      headers: {
        'Cookie': sessionCookie || ''
      }
    });

    const overviewData = await overviewResponse.json();

    if (overviewData.success) {
      console.log('✅ Dashboard overview loaded');
      console.log('   Documents:', overviewData.stats.totalDocuments);
      console.log('   Sections:', overviewData.stats.activeSections);
      console.log('   Suggestions:', overviewData.stats.pendingSuggestions);
    } else {
      console.error('❌ Dashboard overview failed:', overviewData.error);
    }

  } catch (error) {
    console.error('❌ Dashboard overview request failed:', error.message);
  }

  // Step 4: Load documents (requires JWT and RLS pass)
  console.log('\n📝 Step 4: Loading documents (RLS test)...');
  try {
    const documentsResponse = await fetch(`${BASE_URL}/api/dashboard/documents`, {
      headers: {
        'Cookie': sessionCookie || ''
      }
    });

    const documentsData = await documentsResponse.json();

    if (documentsData.success) {
      console.log('✅ Documents loaded successfully');
      console.log('   Document count:', documentsData.documents?.length || 0);

      if (documentsData.documents && documentsData.documents.length > 0) {
        console.log('\n   First 3 documents:');
        documentsData.documents.slice(0, 3).forEach((doc, i) => {
          console.log(`   ${i + 1}. ${doc.title} (${doc.section_count} sections)`);
        });
      } else {
        console.log('   ⚠️  No documents found (might be empty organization)');
      }
    } else {
      console.error('❌ Documents load failed:', documentsData.error);
      console.log('   This indicates RLS policy blocking - JWT not working!');
    }

  } catch (error) {
    console.error('❌ Documents request failed:', error.message);
  }

  console.log('\n✨ Test complete!\n');
}

// Run tests
testSessionPersistence().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
