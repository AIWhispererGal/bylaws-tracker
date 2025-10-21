# Database Diagnostics Archive

This directory contains SQL diagnostic scripts and database health check files created during development and troubleshooting.

## Archived Files

Types of files archived here:
- Schema verification scripts (CHECK_*.sql)
- Diagnostic queries (DIAGNOSE_*.sql)
- Test queries (TEST_*.sql)
- Health check scripts
- RLS policy audit scripts

## Why These Were Archived

- **One-time diagnostics** - Created for specific troubleshooting sessions
- **Schema verification** - Used to verify migrations, now complete
- **Development artifacts** - Useful during development, less needed in production
- **Organizational cleanup** - Moving specialized tools to dedicated location

## Current Diagnostic Tools

For active database diagnostics, use:
- `/scripts/diagnose-*.js` - JavaScript-based diagnostic tools
- `/database/schema.sql` - Current authoritative schema
- `/tests/integration` - Integration tests that verify database behavior

## Running Archived Diagnostics

These SQL scripts can still be run against your database:

```bash
# Using psql
psql -U your_user -d your_database -f archive/database-diagnostics/<script>.sql

# Using Supabase CLI
supabase db execute < archive/database-diagnostics/<script>.sql
```

**Note**: Scripts may reference old schema structures and may need updates to work with current database.

## Common Diagnostic Scripts

- `CHECK_DOCUMENT_SECTIONS_SCHEMA.sql` - Verify document sections table structure
- `CHECK_USER_TYPES.sql` - Verify user types configuration
- `DIAGNOSE_STATUS_ERROR.sql` - Debug status-related errors
- `diagnostic_check.sql` - General database health check

## Archive Date

Files archived: 2025-10-21

## Related Resources

- Database schema documentation: `/docs/architecture`
- Database testing: `/tests/integration`
- Migration guides: `/docs`
