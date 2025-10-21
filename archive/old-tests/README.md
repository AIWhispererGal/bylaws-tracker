# Legacy Tests & Debug Scripts Archive

This directory contains root-level test files and debug scripts that were created during development but are no longer actively maintained.

## Archived Files

Types of files archived here:
- One-off test scripts (test-*.js)
- Debug and diagnostic scripts (debug-*.js, check-*.js)
- Database connection tests
- Setup verification scripts
- Quick utility scripts

## Why These Were Archived

- **Ad-hoc testing** - Created for one-time diagnostics
- **Superseded by formal tests** - Replaced by organized test suite in `/tests`
- **Development artifacts** - Used during troubleshooting, no longer needed
- **Root directory cleanup** - Moving utility scripts to proper location

## Current Testing Approach

Active test infrastructure:
- `/tests/unit` - Unit tests with Jest
- `/tests/integration` - Integration tests
- `/tests/e2e` - End-to-end tests
- `/tests/manual` - Manual testing guides

## Running Old Scripts

These scripts may still be functional but are not maintained. Use with caution:

```bash
node archive/old-tests/<script-name>.js
```

**Note**: Scripts may have outdated dependencies or database schema assumptions.

## Archive Date

Files archived: 2025-10-21
