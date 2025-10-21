/**
 * Quick diagnostic to test if section editing routes are registered
 * Run with: node test-section-routes.js
 */

const express = require('express');
const app = express();

// Simulate minimal required middleware
app.use((req, res, next) => {
  req.session = { isAdmin: true };
  req.supabaseService = {};
  next();
});

// Load admin routes
const adminRoutes = require('./src/routes/admin');
app.use('/admin', adminRoutes);

// List all registered routes
console.log('\n📋 Registered Section Routes:\n');
app._router.stack.forEach(middleware => {
  if (middleware.name === 'router' && middleware.regexp.test('/admin')) {
    middleware.handle.stack.forEach(route => {
      if (route.route && route.route.path.includes('section')) {
        const method = Object.keys(route.route.methods)[0].toUpperCase();
        const path = '/admin' + route.route.path;
        console.log(`  ${method.padEnd(6)} ${path}`);
      }
    });
  }
});

console.log('\n✅ All routes loaded successfully!\n');
console.log('If server shows 404, check:');
console.log('  1. Server fully restarted (not just saved file)');
console.log('  2. No middleware blocking the routes');
console.log('  3. Browser cache cleared (Ctrl+Shift+R)');
console.log('  4. Correct path: /admin/sections/:id/split (not /sections/:id/split)\n');
