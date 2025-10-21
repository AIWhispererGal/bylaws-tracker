/**
 * Debug script to show middleware registration order
 * Run with: node debug-middleware-order.js
 */

require('dotenv').config();

// Mock necessary dependencies
const mockSupabase = {
  from: () => ({
    select: () => ({ limit: () => ({ data: [], error: null }) }),
    update: () => ({ eq: () => ({ data: null, error: null }) }),
    delete: () => ({ eq: () => ({ data: null, error: null }) }),
    insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) })
  }),
  auth: {
    getUser: () => ({ data: { user: null }, error: null })
  }
};

// Mock createClient
require.cache[require.resolve('@supabase/supabase-js')] = {
  exports: {
    createClient: () => mockSupabase
  }
};

// Now load the server
const express = require('express');
const path = require('path');

// Override console.log to suppress server startup messages
const originalLog = console.log;
console.log = () => {};

// Load server.js but prevent it from starting
const originalListen = express.application.listen;
express.application.listen = function() {
  // Don't actually start the server
  return {
    close: () => {}
  };
};

// Load the server configuration
require('./server');

// Restore console.log
console.log = originalLog;
express.application.listen = originalListen;

// Find the app instance
const app = express.application;

console.log('\n📋 Middleware Registration Order:\n');

let middlewareCount = 0;
let routerCount = 0;

// Walk through all middleware
function walkStack(stack, prefix = '') {
  stack.forEach((middleware, index) => {
    middlewareCount++;

    if (middleware.name === 'router') {
      routerCount++;
      const routePath = middleware.regexp.source
        .replace(/\\/g, '')
        .replace('\\', '/')
        .replace('^', '')
        .replace('$', '')
        .replace('(?:', '')
        .replace(')?', '')
        .replace(/\(\?\:\/\)/g, '/')
        .replace('/?', '');

      console.log(`${String(middlewareCount).padStart(3)}. [ROUTER] ${routePath || '/'}`);

      // Show routes in this router
      if (middleware.handle && middleware.handle.stack) {
        middleware.handle.stack.forEach((route) => {
          if (route.route) {
            const methods = Object.keys(route.route.methods).join(',').toUpperCase();
            console.log(`       └─ ${methods} ${route.route.path}`);
          }
        });
      }
    } else if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
      console.log(`${String(middlewareCount).padStart(3)}. [ROUTE] ${methods} ${middleware.route.path}`);
    } else {
      const name = middleware.name || 'anonymous';
      const pathRegex = middleware.regexp ? middleware.regexp.source : 'all';
      console.log(`${String(middlewareCount).padStart(3)}. [${name.toUpperCase()}] ${pathRegex}`);
    }
  });
}

// Check if we can access the app's stack
const appStack = app._router ? app._router.stack : [];
walkStack(appStack);

console.log(`\nTotal middleware: ${middlewareCount}`);
console.log(`Total routers: ${routerCount}`);
console.log('\nLook for:');
console.log('  1. Any middleware BEFORE /admin router that might intercept');
console.log('  2. Any catch-all routes that match /admin/sections/*');
console.log('  3. The position of /admin router in the stack\n');