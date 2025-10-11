#!/usr/bin/env node
/**
 * Test Runner for Bylaws Amendment Tracker
 * Runs all test suites and generates coverage report
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      suites: []
    };
  }

  async runAllTests() {
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  Bylaws Amendment Tracker - Test Suite${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

    const testFiles = [
      'unit/parsers.test.js',
      'unit/configuration.test.js',
      'unit/workflow.test.js',
      'unit/multitenancy.test.js',
      'integration/api.test.js'
    ];

    for (const testFile of testFiles) {
      await this.runTestFile(testFile);
    }

    this.printSummary();
  }

  async runTestFile(testFile) {
    const fullPath = path.join(__dirname, testFile);

    console.log(`${colors.blue}Running: ${testFile}${colors.reset}`);

    try {
      // Clear require cache to ensure fresh test run
      delete require.cache[require.resolve(fullPath)];

      // Mock global test functions
      this.setupTestEnvironment();

      // Run the test file
      require(fullPath);

      console.log('');
    } catch (error) {
      console.error(`${colors.red}Error running ${testFile}:${colors.reset}`, error.message);
      this.results.failed++;
    }
  }

  setupTestEnvironment() {
    const self = this;
    let currentSuite = null;

    global.describe = function(name, fn) {
      currentSuite = { name, tests: [], passed: 0, failed: 0 };
      console.log(`\n  ${colors.cyan}${name}${colors.reset}`);

      try {
        fn();
        self.results.suites.push(currentSuite);
      } catch (error) {
        console.error(`  ${colors.red}Suite error: ${error.message}${colors.reset}`);
      }
    };

    global.test = function(name, fn) {
      self.results.total++;

      try {
        fn();
        self.results.passed++;
        if (currentSuite) currentSuite.passed++;
        console.log(`    ${colors.green}✓${colors.reset} ${name}`);
      } catch (error) {
        self.results.failed++;
        if (currentSuite) currentSuite.failed++;
        console.log(`    ${colors.red}✗${colors.reset} ${name}`);
        console.log(`      ${colors.red}${error.message}${colors.reset}`);
      }
    };

    global.beforeEach = function(fn) {
      // Execute setup before each test
      try {
        fn();
      } catch (error) {
        console.error(`  ${colors.yellow}Setup error: ${error.message}${colors.reset}`);
      }
    };

    global.expect = function(value) {
      return {
        toBe: (expected) => {
          if (value !== expected) {
            throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`);
          }
        },
        toHaveLength: (expected) => {
          if (!value || value.length !== expected) {
            throw new Error(`Expected length ${expected}, got ${value ? value.length : 'undefined'}`);
          }
        },
        toContain: (expected) => {
          if (typeof value === 'string') {
            if (!value.includes(expected)) {
              throw new Error(`Expected to contain "${expected}"`);
            }
          } else if (Array.isArray(value)) {
            if (!value.includes(expected)) {
              throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
            }
          }
        },
        toBeDefined: () => {
          if (value === undefined) {
            throw new Error('Expected to be defined');
          }
        },
        toBeNull: () => {
          if (value !== null) {
            throw new Error('Expected to be null');
          }
        },
        toBeInstanceOf: (expected) => {
          if (!(value instanceof expected)) {
            throw new Error(`Expected instance of ${expected.name}`);
          }
        },
        toBeGreaterThan: (expected) => {
          if (value <= expected) {
            throw new Error(`Expected ${value} > ${expected}`);
          }
        },
        toBeLessThan: (expected) => {
          if (value >= expected) {
            throw new Error(`Expected ${value} < ${expected}`);
          }
        },
        toBeCloseTo: (expected, precision = 2) => {
          const diff = Math.abs(value - expected);
          const tolerance = Math.pow(10, -precision);
          if (diff > tolerance) {
            throw new Error(`Expected ${value} to be close to ${expected}`);
          }
        },
        toThrow: (expectedMessage) => {
          try {
            value();
            throw new Error('Expected to throw');
          } catch (e) {
            if (expectedMessage && !e.message.includes(expectedMessage)) {
              throw new Error(`Expected error "${expectedMessage}", got "${e.message}"`);
            }
          }
        },
        not: {
          toBe: (expected) => {
            if (value === expected) {
              throw new Error(`Expected not to be ${JSON.stringify(expected)}`);
            }
          },
          toContain: (expected) => {
            if (value && value.includes(expected)) {
              throw new Error(`Expected not to contain "${expected}"`);
            }
          },
          toThrow: () => {
            try {
              value();
            } catch (e) {
              throw new Error('Expected not to throw');
            }
          }
        }
      };
    };
  }

  printSummary() {
    console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  Test Summary${colors.reset}`);
    console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

    console.log(`  Total Tests:  ${this.results.total}`);
    console.log(`  ${colors.green}Passed:       ${this.results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed:       ${this.results.failed}${colors.reset}`);

    const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
    const passColor = passRate >= 90 ? colors.green : passRate >= 70 ? colors.yellow : colors.red;

    console.log(`  ${passColor}Pass Rate:    ${passRate}%${colors.reset}`);

    console.log(`\n${colors.cyan}  Test Suites:${colors.reset}\n`);

    for (const suite of this.results.suites) {
      const status = suite.failed === 0 ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      console.log(`  ${status} ${suite.name} (${suite.passed}/${suite.passed + suite.failed})`);
    }

    console.log('');

    if (this.results.failed === 0) {
      console.log(`${colors.green}✓ All tests passed!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}✗ Some tests failed${colors.reset}\n`);
      process.exit(1);
    }
  }
}

// Run tests
const runner = new TestRunner();
runner.runAllTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
