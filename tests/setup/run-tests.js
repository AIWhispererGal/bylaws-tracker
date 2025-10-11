#!/usr/bin/env node

/**
 * Test Runner for Setup Wizard
 * Runs all unit and integration tests
 */

const path = require('path');
const fs = require('fs');

console.log('===========================================');
console.log('  Setup Wizard Test Suite');
console.log('===========================================\n');

// Track results
const results = {
    passed: 0,
    failed: 0,
    total: 0
};

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Override console.log temporarily
const originalDescribe = global.describe;
const originalTest = global.test;

// Setup test environment
global.describe = (name, fn) => {
    console.log(`\n${colors.cyan}${name}${colors.reset}`);
    fn();
};

global.test = (name, fn) => {
    results.total++;
    try {
        if (fn.constructor.name === 'AsyncFunction') {
            // Handle async tests
            fn().then(() => {
                console.log(`  ${colors.green}✓${colors.reset} ${name}`);
                results.passed++;
            }).catch(error => {
                console.log(`  ${colors.red}✗${colors.reset} ${name}`);
                console.error(`    ${colors.red}${error.message}${colors.reset}`);
                results.failed++;
            });
        } else {
            fn();
            console.log(`  ${colors.green}✓${colors.reset} ${name}`);
            results.passed++;
        }
    } catch (error) {
        console.log(`  ${colors.red}✗${colors.reset} ${name}`);
        console.error(`    ${colors.red}${error.message}${colors.reset}`);
        results.failed++;
    }
};

global.beforeEach = (fn) => {
    global._beforeEachFn = fn;
};

global.expect = (value) => ({
    toBe: (expected) => {
        if (value !== expected) {
            throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
        }
    },
    toEqual: (expected) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
        }
    },
    toContain: (expected) => {
        if (!value.includes(expected)) {
            throw new Error(`Expected to contain "${expected}"`);
        }
    },
    toContainMatch: (regex) => {
        const found = value.some(item => regex.test(item));
        if (!found) {
            throw new Error(`Expected to contain match for ${regex}`);
        }
    },
    toBeDefined: () => {
        if (value === undefined) {
            throw new Error('Expected to be defined');
        }
    },
    toBeGreaterThan: (expected) => {
        if (value <= expected) {
            throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
    },
    not: {
        toBe: (expected) => {
            if (value === expected) {
                throw new Error(`Expected not to be ${expected}`);
            }
        }
    }
});

// Run tests
const testDir = __dirname;
const testFiles = [
    'setup-middleware.test.js',
    'setup-routes.test.js',
    'setup-integration.test.js'
];

console.log(`${colors.blue}Running ${testFiles.length} test suites...${colors.reset}\n`);

// Run each test file
testFiles.forEach(file => {
    const filePath = path.join(testDir, file);

    if (fs.existsSync(filePath)) {
        console.log(`\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        console.log(`${colors.yellow}Running: ${file}${colors.reset}`);
        console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

        try {
            require(filePath);
        } catch (error) {
            console.error(`${colors.red}Error loading test file: ${error.message}${colors.reset}`);
        }
    } else {
        console.log(`${colors.red}Test file not found: ${file}${colors.reset}`);
    }
});

// Wait for async tests to complete
setTimeout(() => {
    console.log(`\n\n${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}Test Results${colors.reset}`);
    console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    console.log(`Total Tests:  ${results.total}`);
    console.log(`${colors.green}Passed:       ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed:       ${results.failed}${colors.reset}`);

    const passRate = results.total > 0
        ? Math.round((results.passed / results.total) * 100)
        : 0;

    console.log(`\nPass Rate:    ${passRate}%`);

    if (results.failed === 0) {
        console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
        process.exit(0);
    } else {
        console.log(`\n${colors.red}✗ Some tests failed${colors.reset}`);
        process.exit(1);
    }
}, 2000); // Wait 2 seconds for async tests
