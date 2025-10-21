# Test Files Archive

This directory contains test data, fixtures, and example files used during development.

## Archived Files

This directory may contain:
- Sample documents for testing parsing
- Test bylaw files
- Mock data fixtures
- Example upload files

## Why These Were Archived

- **Development testing** - Used during feature development
- **Example data** - Sample files for testing upload/parsing
- **One-time use** - Created for specific test scenarios
- **Size reduction** - Moving test data out of main codebase

## Current Test Data

Active test data should be in:
- `/tests/fixtures` - Test fixtures for automated tests
- `/tests/manual/samples` - Sample files for manual testing
- `/tests/e2e/data` - End-to-end test data

## Using Archived Test Files

These files can still be useful for:
- Regression testing
- Understanding parsing behavior with specific formats
- Recreating historical test scenarios

To use an archived test file:

```bash
# Copy to working directory
cp archive/test-files/<filename> tests/fixtures/

# Or reference directly
node scripts/parser.js archive/test-files/<filename>
```

## Archive Date

Files archived: 2025-10-21

## Test Data Guidelines

When creating new test data:
1. Store in `/tests/fixtures` for automated tests
2. Use descriptive filenames
3. Document the purpose in test files
4. Keep test data minimal and focused
