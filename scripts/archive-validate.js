#!/usr/bin/env node

/**
 * Archive Validation Script
 * Validates archive structure and integrity after cleanup operations
 */

const fs = require('fs');
const path = require('path');

const VALIDATION_RESULTS = {
  timestamp: new Date().toISOString(),
  phase: process.argv[2] || 'unknown',
  checks: [],
  passed: 0,
  failed: 0,
  warnings: []
};

// Color output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function check(name, condition, critical = true) {
  const result = {
    name,
    passed: condition,
    critical
  };

  VALIDATION_RESULTS.checks.push(result);

  if (condition) {
    VALIDATION_RESULTS.passed++;
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } else {
    VALIDATION_RESULTS.failed++;
    const symbol = critical ? '✗' : '⚠';
    const color = critical ? colors.red : colors.yellow;
    console.log(`${color}${symbol}${colors.reset} ${name}`);

    if (!critical) {
      VALIDATION_RESULTS.warnings.push(name);
    }
  }

  return condition;
}

function fileExists(filepath) {
  try {
    return fs.existsSync(filepath);
  } catch (error) {
    return false;
  }
}

function directoryExists(dirpath) {
  try {
    const stat = fs.statSync(dirpath);
    return stat.isDirectory();
  } catch (error) {
    return false;
  }
}

function countFiles(dirpath, extension = null) {
  try {
    if (!directoryExists(dirpath)) return 0;

    let count = 0;
    const files = fs.readdirSync(dirpath, { withFileTypes: true });

    for (const file of files) {
      const fullPath = path.join(dirpath, file.name);

      if (file.isDirectory()) {
        count += countFiles(fullPath, extension);
      } else if (!extension || file.name.endsWith(extension)) {
        count++;
      }
    }

    return count;
  } catch (error) {
    return 0;
  }
}

function validateArchiveStructure() {
  console.log(`\n${colors.blue}=== Archive Structure Validation ===${colors.reset}\n`);

  check('Archive directory exists', directoryExists('archive'));

  // Expected archive subdirectories
  const expectedDirs = [
    'archive/docs',
    'archive/database',
    'archive/test-files'
  ];

  expectedDirs.forEach(dir => {
    check(`${dir} exists`, directoryExists(dir), false);
  });
}

function validateCriticalFiles() {
  console.log(`\n${colors.blue}=== Critical Files Validation ===${colors.reset}\n`);

  // Critical root files
  check('server.js exists', fileExists('server.js'));
  check('package.json exists', fileExists('package.json'));

  // Critical directories
  check('src/ directory exists', directoryExists('src'));
  check('views/ directory exists', directoryExists('views'));
  check('public/ directory exists', directoryExists('public'));
  check('database/ directory exists', directoryExists('database'));

  // Count critical files
  const srcCount = countFiles('src', '.js');
  const viewCount = countFiles('views', '.ejs');

  check(`src/ has JavaScript files (found ${srcCount})`, srcCount > 0);
  check(`views/ has EJS files (found ${viewCount})`, viewCount > 0);

  VALIDATION_RESULTS.srcFileCount = srcCount;
  VALIDATION_RESULTS.viewFileCount = viewCount;
}

function validateActiveDocumentation() {
  console.log(`\n${colors.blue}=== Active Documentation Validation ===${colors.reset}\n`);

  // Key documentation that should NOT be archived
  const activeDocs = [
    'README.md',
    'docs/roadmap/README.md',
    '.env.example'
  ];

  activeDocs.forEach(doc => {
    check(`${doc} exists (active)`, fileExists(doc));
  });
}

function validateNoUnintendedDeletions() {
  console.log(`\n${colors.blue}=== Unintended Deletion Check ===${colors.reset}\n`);

  // Files that should NEVER be deleted
  const protectedFiles = [
    'server.js',
    'package.json',
    'package-lock.json',
    '.gitignore'
  ];

  protectedFiles.forEach(file => {
    check(`Protected file ${file} intact`, fileExists(file));
  });

  // Protected directories
  const protectedDirs = [
    'src',
    'views',
    'public',
    'database',
    'node_modules'
  ];

  protectedDirs.forEach(dir => {
    check(`Protected directory ${dir}/ intact`, directoryExists(dir));
  });
}

function generateReport() {
  console.log(`\n${colors.blue}=== Validation Summary ===${colors.reset}\n`);

  const totalChecks = VALIDATION_RESULTS.passed + VALIDATION_RESULTS.failed;
  const passRate = ((VALIDATION_RESULTS.passed / totalChecks) * 100).toFixed(1);

  console.log(`Phase: ${colors.yellow}${VALIDATION_RESULTS.phase}${colors.reset}`);
  console.log(`Checks Passed: ${colors.green}${VALIDATION_RESULTS.passed}/${totalChecks}${colors.reset} (${passRate}%)`);

  if (VALIDATION_RESULTS.failed > 0) {
    console.log(`${colors.red}Failed Checks: ${VALIDATION_RESULTS.failed}${colors.reset}`);
  }

  if (VALIDATION_RESULTS.warnings.length > 0) {
    console.log(`${colors.yellow}Warnings: ${VALIDATION_RESULTS.warnings.length}${colors.reset}`);
  }

  // Save report
  const reportPath = `tests/validation/phase-${VALIDATION_RESULTS.phase}-report.json`;
  try {
    fs.mkdirSync('tests/validation', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(VALIDATION_RESULTS, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);
  } catch (error) {
    console.error(`Failed to save report: ${error.message}`);
  }

  // Exit code
  const criticalFailures = VALIDATION_RESULTS.checks.filter(c => !c.passed && c.critical).length;

  if (criticalFailures > 0) {
    console.log(`\n${colors.red}VALIDATION FAILED - ${criticalFailures} critical issues${colors.reset}`);
    process.exit(1);
  } else if (VALIDATION_RESULTS.failed > 0) {
    console.log(`\n${colors.yellow}VALIDATION PASSED WITH WARNINGS${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.green}VALIDATION PASSED - All checks successful${colors.reset}`);
    process.exit(0);
  }
}

// Main execution
console.log(`${colors.blue}╔════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.blue}║   Archive Cleanup Validation Script       ║${colors.reset}`);
console.log(`${colors.blue}╚════════════════════════════════════════════╝${colors.reset}`);
console.log(`\nPhase: ${VALIDATION_RESULTS.phase}`);
console.log(`Timestamp: ${VALIDATION_RESULTS.timestamp}\n`);

// Run all validations
validateCriticalFiles();
validateArchiveStructure();
validateActiveDocumentation();
validateNoUnintendedDeletions();

// Generate final report
generateReport();
