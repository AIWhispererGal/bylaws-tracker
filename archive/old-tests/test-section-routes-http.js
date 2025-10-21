/**
 * HTTP Test for section routes
 * Tests if routes actually respond correctly when called
 * Run with: node test-section-routes-http.js
 */

const http = require('http');

// Test configuration
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

// Test routes
const testRoutes = [
  { method: 'POST', path: '/admin/sections/test-id-123/split' },
  { method: 'PUT', path: '/admin/sections/test-id-456/move' }
];

// Make a test request
function testRoute(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    // Send minimal body for POST/PUT
    if (method !== 'GET') {
      req.write(JSON.stringify({}));
    }

    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('\n🧪 Testing Section Routes via HTTP\n');
  console.log(`Testing server at http://${HOST}:${PORT}\n`);

  for (const route of testRoutes) {
    try {
      console.log(`Testing ${route.method} ${route.path}...`);
      const response = await testRoute(route.method, route.path);

      console.log(`  Status: ${response.statusCode} ${response.statusMessage}`);

      if (response.statusCode === 404) {
        console.log('  ❌ Route returns 404 - NOT FOUND');
      } else if (response.statusCode === 302 || response.statusCode === 303) {
        console.log(`  ⚠️  Route redirects to: ${response.headers.location}`);
        if (response.headers.location === '/setup') {
          console.log('  ⚠️  Being redirected to setup wizard!');
        }
      } else if (response.statusCode === 401 || response.statusCode === 403) {
        console.log('  ✅ Route found (auth required)');
      } else if (response.statusCode === 400 || response.statusCode === 500) {
        console.log('  ✅ Route found (error in processing)');
      } else {
        console.log('  ✅ Route is accessible');
      }

      // Show body preview if any
      if (response.body) {
        const preview = response.body.substring(0, 100);
        console.log(`  Body preview: ${preview}${response.body.length > 100 ? '...' : ''}`);
      }

      console.log('');
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }

  console.log('Test complete!\n');
  console.log('If routes return 404 or redirect to /setup:');
  console.log('  1. Check server.js middleware order');
  console.log('  2. Ensure /admin is in allowedPaths for setup middleware');
  console.log('  3. Restart server after changes\n');
}

// Check if server is running
const checkServer = http.get(`http://${HOST}:${PORT}/api/health`, (res) => {
  if (res.statusCode === 200 || res.statusCode === 500) {
    console.log('✅ Server is running');
    runTests();
  }
}).on('error', (err) => {
  console.error('❌ Server is not running!');
  console.error(`Please start the server first: npm start`);
  console.error(`Error: ${err.message}`);
  process.exit(1);
});