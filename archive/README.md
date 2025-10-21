# Archive Directory

This directory contains archived files organized by category. Files are moved here to maintain a clean project structure while preserving historical content.

## Directory Structure

```
archive/
├── outdated-docs/         # Outdated documentation files
├── old-tests/            # Legacy test and debug scripts
├── deprecated-code/      # Deprecated source code files
├── migration-history/    # Historical database migrations
├── test-files/          # Test data and fixtures
├── database-diagnostics/ # Database diagnostic scripts
├── root-level-files/    # Miscellaneous root-level files
└── manifests/           # Migration manifests for rollback
```

## Categories

### outdated-docs/
Documentation files that have been superseded by newer versions or are no longer relevant to the current project state.

### old-tests/
Root-level test files, debug scripts, and one-off diagnostic tools that are no longer actively used.

### deprecated-code/
Source code files that have been replaced or are no longer part of the active codebase.

### migration-history/
Database migration files that have already been applied and are kept for historical reference.

### test-files/
Test data, fixtures, and example files used during development but not part of the production codebase.

### database-diagnostics/
SQL diagnostic scripts and database health check files.

### root-level-files/
Miscellaneous files from the project root that don't fit other categories.

## Migration Process

Files are moved to the archive using the migration script:

```bash
# Preview what will be archived (dry run)
node scripts/archive-migrate.js --dry-run

# Execute the migration
node scripts/archive-migrate.js --execute

# Rollback a migration
node scripts/archive-migrate.js --rollback archive/manifests/migration-<timestamp>.json
```

## Validation

Validate archive integrity:

```bash
node scripts/archive-validate.js
```

## Rollback

Each migration creates a manifest file in `archive/manifests/` that can be used to rollback changes:

1. Locate the manifest file for the migration you want to rollback
2. Run: `node scripts/archive-migrate.js --rollback <manifest-file>`

## Best Practices

1. **Never delete archived files** - They may contain historical context
2. **Review before archiving** - Ensure files are truly no longer needed
3. **Keep manifests** - Enable rollback capabilities
4. **Document reasons** - Update category READMEs with context
5. **Periodic cleanup** - Review archives every 6 months

## File History

When using git, file history is preserved through `git mv` commands. You can view the history of an archived file:

```bash
git log --follow archive/category/filename
```

## Index Files

Each category contains an index file (README.md) that lists the archived files and provides context about why they were archived.

## Created

Archive structure created: 2025-10-21
