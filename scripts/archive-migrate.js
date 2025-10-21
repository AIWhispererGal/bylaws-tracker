#!/usr/bin/env node

/**
 * Archive Migration Script
 *
 * Safely moves files to archive directories with git awareness.
 * Maintains file history and provides rollback capabilities.
 *
 * Usage:
 *   node scripts/archive-migrate.js --dry-run
 *   node scripts/archive-migrate.js --execute
 *   node scripts/archive-migrate.js --rollback <manifest-file>
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARCHIVE_BASE = path.join(PROJECT_ROOT, 'archive');
const MANIFEST_DIR = path.join(ARCHIVE_BASE, 'manifests');

// Archive categories and their target patterns
const ARCHIVE_CATEGORIES = {
  'outdated-docs': {
    patterns: [
      'IMPLEMENTATION_GUIDE.md',
      'PARSER_COMPLETE.md',
      'DEPLOYMENT_GUIDE.md',
      'FINAL_SETUP_CHECKLIST.md',
      'GENERALIZATION_GUIDE.md',
      'SETUP_GUIDE.md',
      'CONFIGURATION_GUIDE.md',
      'MIGRATION_GUIDE.md',
      'IMPLEMENTATION_SUMMARY.md',
      'QUICKSTART.md',
      'DEBUG_FORM.md',
      'RENDER_DEPLOYMENT_COMPLETE.md',
      'CURRENTSCHEMA.txt',
      'INVITATION_FIX_README.txt',
      'RECOVERY_OPTIONS.md',
      'SECURITY_FIXES_COMPLETED.md'
    ],
    description: 'Outdated documentation files from root'
  },
  'database-diagnostics': {
    patterns: [
      'database/CHECK_DOCUMENT_SECTIONS_SCHEMA.sql',
      'database/CHECK_USER_TYPES.sql',
      'database/DIAGNOSE_STATUS_ERROR.sql',
      'database/TEST_USER_TYPES_QUERY.sql',
      'database/diagnostic_check.sql',
      'database/diagnosis/**'
    ],
    description: 'Database diagnostic and check scripts'
  },
  'old-tests': {
    patterns: [
      'test-section-routes.js',
      'test-section-routes-http.js',
      'test-final-verification.js',
      'test-setup-check.js',
      'debug-middleware-order.js',
      'debug-supabase-connection.js',
      'check-database-tables.js',
      'check-if-data-still-exists.js',
      'seed-test-organization.js',
      'query-with-raw-sql.js',
      'quick-login.js'
    ],
    description: 'Root-level test and debug scripts'
  },
  'migration-history': {
    patterns: [
      'database/migrations/002_*.sql',
      'database/migrations/003_*.sql',
      'database/migrations/004_*.sql',
      'database/migrations/005_*.sql',
      'database/migrations/006_*.sql',
      'database/migrations/007_*.sql',
      'database/migrations/008_*.sql',
      'database/migrations/009_*.sql',
      'database/migrations/010_*.sql',
      'database/migrations/011_*.sql',
      'database/migrations/012_*.sql',
      'database/migrations/013_*.sql',
      'database/migrations/014_*.sql',
      'database/migrations/015_*.sql',
      'database/migrations/016_*.sql',
      'database/migrations/017_*.sql',
      'database/migrations/018_*.sql',
      'database/migrations/019_*.sql',
      'database/migrations/020_*.sql',
      'database/migrations/021_*.sql',
      'database/migrations/022_*.sql',
      'database/migrations/023_*.sql',
      'database/migrations/024_*.sql',
      'database/migrations/025_*.sql',
      'database/migrations/026_*.sql',
      'database/migrations/027_*.sql',
      'database/migrations/028_*.sql',
      'database/migrations/029_*.sql',
      'database/migrations/030_*.sql',
      'database/migrations/031_*.sql',
      'database/migrations/QUICK_*.sql',
      'database/migrations/README_*.md',
      'database/migrations/TESTRESULT*.txt'
    ],
    description: 'Historical database migrations'
  }
};

class ArchiveMigrator {
  constructor() {
    this.isGitRepo = this.checkGitRepo();
    this.manifest = {
      timestamp: new Date().toISOString(),
      migrations: [],
      rollbackable: this.isGitRepo
    };
  }

  checkGitRepo() {
    try {
      execSync('git rev-parse --git-dir', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  log(message, level = 'info') {
    const prefix = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      skip: '⏭️'
    }[level] || 'ℹ️';
    console.log(`${prefix} ${message}`);
  }

  expandPattern(pattern) {
    const fullPath = path.join(PROJECT_ROOT, pattern);

    // Handle glob patterns
    if (pattern.includes('*')) {
      const glob = require('glob');
      return glob.sync(fullPath, { nodir: true });
    }

    // Handle directory patterns
    if (pattern.endsWith('/**')) {
      const baseDir = fullPath.slice(0, -3);
      if (!fs.existsSync(baseDir)) return [];

      const getAllFiles = (dir) => {
        const files = [];
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...getAllFiles(fullPath));
          } else {
            files.push(fullPath);
          }
        }
        return files;
      };

      return getAllFiles(baseDir);
    }

    // Single file
    return fs.existsSync(fullPath) ? [fullPath] : [];
  }

  moveFile(sourcePath, category, dryRun = true) {
    const relativePath = path.relative(PROJECT_ROOT, sourcePath);
    const fileName = path.basename(sourcePath);
    const targetDir = path.join(ARCHIVE_BASE, category);
    const targetPath = path.join(targetDir, fileName);

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      this.log(`Source not found: ${relativePath}`, 'skip');
      return false;
    }

    // Check if already in archive
    if (sourcePath.startsWith(ARCHIVE_BASE)) {
      this.log(`Already archived: ${relativePath}`, 'skip');
      return false;
    }

    if (dryRun) {
      this.log(`Would move: ${relativePath} → archive/${category}/${fileName}`, 'info');
      return true;
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Handle duplicate filenames
    let finalTargetPath = targetPath;
    let counter = 1;
    while (fs.existsSync(finalTargetPath)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      finalTargetPath = path.join(targetDir, `${base}_${counter}${ext}`);
      counter++;
    }

    try {
      if (this.isGitRepo) {
        // Use git mv to preserve history
        execSync(`git mv "${sourcePath}" "${finalTargetPath}"`, {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
        this.log(`Git moved: ${relativePath} → ${path.relative(PROJECT_ROOT, finalTargetPath)}`, 'success');
      } else {
        // Regular file move
        fs.renameSync(sourcePath, finalTargetPath);
        this.log(`Moved: ${relativePath} → ${path.relative(PROJECT_ROOT, finalTargetPath)}`, 'success');
      }

      this.manifest.migrations.push({
        source: relativePath,
        target: path.relative(PROJECT_ROOT, finalTargetPath),
        category,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      this.log(`Failed to move ${relativePath}: ${error.message}`, 'error');
      return false;
    }
  }

  async migrate(dryRun = true) {
    this.log(`Starting archive migration (${dryRun ? 'DRY RUN' : 'EXECUTE'})...`, 'info');
    this.log(`Git repository: ${this.isGitRepo ? 'Yes' : 'No'}`, 'info');

    let totalFiles = 0;
    let movedFiles = 0;

    for (const [category, config] of Object.entries(ARCHIVE_CATEGORIES)) {
      this.log(`\nProcessing category: ${category}`, 'info');
      this.log(`  ${config.description}`, 'info');

      for (const pattern of config.patterns) {
        const files = this.expandPattern(pattern);
        totalFiles += files.length;

        for (const file of files) {
          if (this.moveFile(file, category, dryRun)) {
            movedFiles++;
          }
        }
      }
    }

    this.log(`\nMigration summary:`, 'info');
    this.log(`  Total files matched: ${totalFiles}`, 'info');
    this.log(`  Files ${dryRun ? 'would be' : ''} moved: ${movedFiles}`, 'success');

    if (!dryRun && movedFiles > 0) {
      this.saveManifest();
    }

    return { totalFiles, movedFiles };
  }

  saveManifest() {
    if (!fs.existsSync(MANIFEST_DIR)) {
      fs.mkdirSync(MANIFEST_DIR, { recursive: true });
    }

    const manifestFile = path.join(
      MANIFEST_DIR,
      `migration-${Date.now()}.json`
    );

    fs.writeFileSync(manifestFile, JSON.stringify(this.manifest, null, 2));
    this.log(`Manifest saved: ${path.relative(PROJECT_ROOT, manifestFile)}`, 'success');

    return manifestFile;
  }

  rollback(manifestFile) {
    this.log('Starting rollback...', 'info');

    if (!fs.existsSync(manifestFile)) {
      this.log(`Manifest not found: ${manifestFile}`, 'error');
      return false;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

    if (!manifest.rollbackable) {
      this.log('Manifest marked as not rollbackable (non-git migration)', 'error');
      return false;
    }

    let rolledBack = 0;

    for (const migration of manifest.migrations.reverse()) {
      const sourcePath = path.join(PROJECT_ROOT, migration.target);
      const targetPath = path.join(PROJECT_ROOT, migration.source);

      if (!fs.existsSync(sourcePath)) {
        this.log(`Source not found, skipping: ${migration.target}`, 'warning');
        continue;
      }

      try {
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        if (this.isGitRepo) {
          execSync(`git mv "${sourcePath}" "${targetPath}"`, {
            cwd: PROJECT_ROOT,
            stdio: 'pipe'
          });
        } else {
          fs.renameSync(sourcePath, targetPath);
        }

        this.log(`Restored: ${migration.source}`, 'success');
        rolledBack++;
      } catch (error) {
        this.log(`Failed to restore ${migration.source}: ${error.message}`, 'error');
      }
    }

    this.log(`\nRollback complete: ${rolledBack} files restored`, 'success');
    return true;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const migrator = new ArchiveMigrator();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Archive Migration Script

Usage:
  node scripts/archive-migrate.js [options]

Options:
  --dry-run     Show what would be moved without making changes (default)
  --execute     Actually perform the migration
  --rollback <manifest-file>   Rollback a previous migration
  --help, -h    Show this help message

Examples:
  node scripts/archive-migrate.js --dry-run
  node scripts/archive-migrate.js --execute
  node scripts/archive-migrate.js --rollback archive/manifests/migration-123456789.json
    `);
    process.exit(0);
  }

  if (args.includes('--rollback')) {
    const manifestIndex = args.indexOf('--rollback') + 1;
    const manifestFile = args[manifestIndex];

    if (!manifestFile) {
      console.error('❌ Error: --rollback requires a manifest file path');
      process.exit(1);
    }

    migrator.rollback(manifestFile);
  } else {
    const dryRun = !args.includes('--execute');
    migrator.migrate(dryRun);
  }
}

module.exports = ArchiveMigrator;
