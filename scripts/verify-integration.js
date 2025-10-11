#!/usr/bin/env node

/**
 * Integration Verification Script
 * Tests that the setup wizard integration is working correctly
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

console.log('🔍 Verifying Setup Wizard Integration...\n');

const tests = [
  {
    name: 'Health Check Endpoint',
    path: '/api/health',
    expectedStatus: 200,
    description: 'Verify health check endpoint responds'
  },
  {
    name: 'Setup Wizard Access',
    path: '/setup',
    expectedStatus: 200,
    description: 'Verify setup wizard is accessible'
  },
  {
    name: 'Config Endpoint',
    path: '/api/config',
    expectedStatus: 200,
    description: 'Verify API config endpoint'
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: test.path,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      const passed = res.statusCode === test.expectedStatus;

      console.log(`${passed ? '✅' : '❌'} ${test.name}`);
      console.log(`   Path: ${test.path}`);
      console.log(`   Expected: ${test.expectedStatus}, Got: ${res.statusCode}`);
      console.log(`   ${test.description}\n`);

      resolve({ test: test.name, passed, status: res.statusCode });
    });

    req.on('error', (error) => {
      console.log(`❌ ${test.name}`);
      console.log(`   Path: ${test.path}`);
      console.log(`   Error: ${error.message}`);
      console.log(`   ${test.description}\n`);

      resolve({ test: test.name, passed: false, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      console.log(`❌ ${test.name}`);
      console.log(`   Path: ${test.path}`);
      console.log(`   Error: Request timeout`);
      console.log(`   ${test.description}\n`);

      resolve({ test: test.name, passed: false, error: 'Timeout' });
    });

    req.end();
  });
}

async function verifyIntegration() {
  console.log('Starting server verification...');
  console.log(`Server should be running at http://${HOST}:${PORT}\n`);
  console.log('─'.repeat(60));
  console.log('');

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('─'.repeat(60));
  console.log('\n📊 Summary:\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}\n`);

  if (passed === total) {
    console.log('🎉 All integration tests passed!');
    console.log('\n✅ Setup wizard integration is working correctly.');
    console.log('✅ Health check endpoint is operational.');
    console.log('✅ API endpoints are accessible.\n');
    console.log('Next steps:');
    console.log('1. Test the setup wizard in a browser');
    console.log('2. Complete the setup wizard workflow');
    console.log('3. Verify main application loads after setup\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed.');
    console.log('\nPossible issues:');
    console.log('- Server may not be running (start with: npm start)');
    console.log('- Environment variables may be missing');
    console.log('- Database connection may be down\n');
    process.exit(1);
  }
}

// Run verification
verifyIntegration().catch(error => {
  console.error('Error running verification:', error);
  process.exit(1);
});
