#!/usr/bin/env node

/**
 * Archive Validation Script
 *
 * Validates archive integrity and provides health checks.
 *
 * Usage:
 *   node scripts/archive-validate.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARCHIVE_BASE = path.join(PROJECT_ROOT, 'archive');

class ArchiveValidator {
  constructor() {
    this.issues = [];
    this.stats = {
      totalCategories: 0,
      totalFiles: 0,
      totalSize: 0,
      categoryStats: {}
    };
  }

  log(message, level = 'info') {
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[level] || 'ℹ️';
    console.log(`${prefix} ${message}`);
  }

  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  validateStructure() {
    this.log('Validating archive structure...', 'info');

    if (!fs.existsSync(ARCHIVE_BASE)) {
      this.issues.push({
        severity: 'error',
        message: 'Archive directory does not exist'
      });
      return false;
    }

    const expectedCategories = [
      'outdated-docs',
      'old-tests',
      'deprecated-code',
      'migration-history',
      'test-files',
      'database-diagnostics',
      'root-level-files'
    ];

    for (const category of expectedCategories) {
      const categoryPath = path.join(ARCHIVE_BASE, category);

      if (!fs.existsSync(categoryPath)) {
        this.issues.push({
          severity: 'warning',
          message: `Category directory missing: ${category}`
        });
      } else {
        this.stats.totalCategories++;
        this.validateCategory(category, categoryPath);
      }
    }

    return true;
  }

  validateCategory(category, categoryPath) {
    const readmePath = path.join(categoryPath, 'README.md');

    if (!fs.existsSync(readmePath)) {
      this.issues.push({
        severity: 'warning',
        message: `Missing README.md in ${category}`
      });
    }

    // Count files and calculate size
    const files = fs.readdirSync(categoryPath);
    let fileCount = 0;
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        fileCount++;
        totalSize += stats.size;
        this.stats.totalFiles++;
        this.stats.totalSize += stats.size;
      }
    }

    this.stats.categoryStats[category] = {
      fileCount,
      totalSize,
      formattedSize: this.formatBytes(totalSize)
    };
  }

  checkManifests() {
    this.log('\nChecking migration manifests...', 'info');

    const manifestDir = path.join(ARCHIVE_BASE, 'manifests');

    if (!fs.existsSync(manifestDir)) {
      this.log('No manifests directory found', 'warning');
      return;
    }

    const manifests = fs.readdirSync(manifestDir)
      .filter(f => f.endsWith('.json'));

    this.log(`Found ${manifests.length} migration manifest(s)`, 'info');

    for (const manifest of manifests) {
      const manifestPath = path.join(manifestDir, manifest);

      try {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        this.log(`  ${manifest}:`, 'info');
        this.log(`    Timestamp: ${data.timestamp}`, 'info');
        this.log(`    Migrations: ${data.migrations.length}`, 'info');
        this.log(`    Rollbackable: ${data.rollbackable ? 'Yes' : 'No'}`, 'info');
      } catch (error) {
        this.issues.push({
          severity: 'error',
          message: `Invalid manifest: ${manifest} - ${error.message}`
        });
      }
    }
  }

  generateReport() {
    this.log('\n=== Archive Validation Report ===', 'info');

    this.log(`\nStructure:`, 'info');
    this.log(`  Categories: ${this.stats.totalCategories}`, 'info');
    this.log(`  Total Files: ${this.stats.totalFiles}`, 'info');
    this.log(`  Total Size: ${this.formatBytes(this.stats.totalSize)}`, 'info');

    this.log(`\nCategory Breakdown:`, 'info');
    for (const [category, stats] of Object.entries(this.stats.categoryStats)) {
      this.log(`  ${category}:`, 'info');
      this.log(`    Files: ${stats.fileCount}`, 'info');
      this.log(`    Size: ${stats.formattedSize}`, 'info');
    }

    if (this.issues.length > 0) {
      this.log(`\nIssues Found: ${this.issues.length}`, 'warning');

      const errors = this.issues.filter(i => i.severity === 'error');
      const warnings = this.issues.filter(i => i.severity === 'warning');

      if (errors.length > 0) {
        this.log('\nErrors:', 'error');
        errors.forEach(issue => this.log(`  ${issue.message}`, 'error'));
      }

      if (warnings.length > 0) {
        this.log('\nWarnings:', 'warning');
        warnings.forEach(issue => this.log(`  ${issue.message}`, 'warning'));
      }
    } else {
      this.log('\n✅ No issues found!', 'success');
    }

    return this.issues.length === 0;
  }

  validate() {
    this.validateStructure();
    this.checkManifests();
    return this.generateReport();
  }
}

// CLI execution
if (require.main === module) {
  const validator = new ArchiveValidator();
  const isValid = validator.validate();
  process.exit(isValid ? 0 : 1);
}

module.exports = ArchiveValidator;
