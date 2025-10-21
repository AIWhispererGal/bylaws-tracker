# Database Migration History Archive

This directory contains historical database migrations that have already been applied to production databases.

## Archived Migrations

This archive contains migrations numbered 002-031, including:
- RLS (Row Level Security) policy iterations
- User authentication implementations
- Workflow system enhancements
- Multi-organization support
- Permission architecture updates
- Emergency fixes and patches

## Why These Were Archived

- **Already applied** - These migrations have been run on all environments
- **Historical reference** - Kept for understanding schema evolution
- **Dependency tracking** - Shows how the database evolved over time
- **Migration cleanup** - Active migrations folder should only contain pending/active migrations

## Active Migrations

Current active migrations should be in:
- `/database/migrations` - Contains only migrations not yet applied or actively maintained

## Schema History

To understand the current schema's evolution, review these files chronologically. Each migration builds upon previous ones.

## Rollback Considerations

⚠️ **WARNING**: Do not attempt to rollback these migrations without:
1. Full database backup
2. Understanding of dependent migrations
3. Testing in non-production environment first

## Migration Naming Convention

Migrations follow the pattern:
```
<number>_<description>.sql
```

Examples:
- `005_implement_proper_rls.sql`
- `012_workflow_enhancements.sql`
- `024_permissions_architecture.sql`

## Viewing Migration Content

To review a specific migration:

```bash
cat archive/migration-history/<migration-file>.sql
```

## Archive Date

Files archived: 2025-10-21

## Last Applied Migration

The last migration in this archive represents the state before archiving. Check `/database/migrations` for the current active migration sequence.
