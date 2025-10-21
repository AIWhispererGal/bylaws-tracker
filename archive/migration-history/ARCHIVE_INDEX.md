# Database Migrations Archive Index

**Archive Date**: 2025-10-21
**Safety Tag**: `pre-cleanup-phase3`

## Summary

- **Total Files Archived**: 25 files
- **Active Migrations Remaining**: 29 files
- **Files Organized**: 53 → 29 active migrations

## Archive Organization

### 1. Duplicates (12 files)
Files representing earlier versions of migrations that were superseded by final versions.

- `005_fix_rls_properly.sql` → Superseded by `005_implement_proper_rls_FIXED.sql`
- `005_implement_proper_rls.sql` → Superseded by `005_implement_proper_rls_FIXED.sql`
- `006_fix_user_organizations_schema.sql` → Superseded by `006_implement_supabase_auth.sql`
- `011_add_document_workflows_columns.sql` → Superseded by `011_add_global_admin_suggestions.sql`
- `012_FIX_MISSING_STATUS_COLUMN.sql` → Superseded by `012_workflow_enhancements_fixed.sql`
- `012_workflow_enhancements.sql` → Superseded by `012_workflow_enhancements_fixed.sql`
- `012_workflow_enhancements_BACKUP.sql` → Backup version
- `017_add_document_sections_lock_columns.sql` → Superseded by `017_workflow_schema_fixes.sql`
- `023_fix_rls_infinite_recursion.sql` → Superseded by `023_fix_rls_infinite_recursion_v2.sql`
- `026_fix_multi_org_setup.sql` → Superseded by `026_fix_multi_org_setup_SIMPLE.sql`
- `027_fix_setup_rls_policies.sql` → Superseded by `027_fix_user_types_rls.sql`
- `030_disable_rls_CORRECTED.sql` → Superseded by `030_disable_rls_all_setup_tables.sql`

### 2. Test Files (1 file)
Testing and validation migrations used during development.

- `005_TEST_RLS_POLICIES.sql` → Test migration for RLS policy validation

### 3. Quick Fixes (3 files)
Temporary quick-fix migrations that were replaced by proper solutions.

- `027_fix_setup_rls_policies_QUICK.sql` → Quick fix replaced by proper migration
- `QUICK_FIX_USER_ORG_ISSUES.sql` → Quick fix for user organization issues
- `QUICK_FIX_USER_ORG_ISSUES_V2.sql` → Second version of quick fix

### 4. Emergency Fixes (2 files)
Emergency migrations used during critical production issues.

- `028_EMERGENCY_disable_rls_for_setup.sql` → Emergency RLS disable during setup issues
- `029_disable_rls_user_types.sql` → Emergency fix for user types RLS

### 5. Utility Scripts (5 files)
Ad-hoc utility scripts for database maintenance and testing.

- `CLEAR_ORGANIZATIONS.sql` → Utility to clear organization data
- `COMPLETE_FIX_ORGANIZATIONS.sql` → Complete organization fix script
- `FIX_ORGANIZATIONS_SCHEMA.sql` → Organization schema fix utility
- `NUKE_TEST_DATA.sql` → Test data cleanup utility
- `SIMPLE_SETUP.sql` → Simple setup utility script

## Active Migrations (29 files)

The following migrations remain active in `/database/migrations/`:

1. `001_generalized_schema.sql` - Initial generalized schema
2. `002_migrate_existing_data.sql` - Data migration (was 002_add_missing_tables.sql)
3. `003_fix_rls_policies.sql` - RLS policy fixes
4. `004_fix_rls_recursion.sql` - RLS recursion fixes
5. `005_implement_proper_rls_FIXED.sql` - Proper RLS implementation (final version)
6. `006_implement_supabase_auth.sql` - Supabase authentication implementation
7. `007_create_global_superuser.sql` - Global superuser creation
8. `008_enhance_user_roles_and_approval.sql` - User roles and approval workflow
9. `009_enhance_rls_organization_filtering.sql` - Organization filtering in RLS
10. `010_fix_first_user_admin.sql` - First user admin privilege fix
11. `011_add_global_admin_suggestions.sql` - Global admin suggestion system
12. `012_workflow_enhancements_fixed.sql` - Workflow enhancements (final version)
13. `013_fix_global_admin_rls.sql` - Global admin RLS fixes
14. `014_user_invitations.sql` - User invitation system
15. `015_fix_invitations_global_admin_rls.sql` - Invitation RLS for global admins
16. `016_fix_verification_function.sql` - Email verification function fixes
17. `017_workflow_schema_fixes.sql` - Workflow schema corrections
18. `018_add_per_document_hierarchy.sql` - Per-document hierarchy support
19. `019_add_suggestion_rejection_tracking.sql` - Suggestion rejection tracking
20. `020_section_editing_functions.sql` - Section editing functions
21. `021_document_workflow_progression.sql` - Document workflow progression
22. `022_fix_multi_org_email_support.sql` - Multi-organization email support
23. `023_fix_rls_infinite_recursion_v2.sql` - RLS recursion fix (v2)
24. `024_permissions_architecture.sql` - Permissions architecture redesign
25. `025_seed_organization_roles.sql` - Organization roles seeding
26. `026_fix_multi_org_setup_SIMPLE.sql` - Multi-org setup fix (simplified)
27. `027_fix_user_types_rls.sql` - User types RLS fix
28. `030_disable_rls_all_setup_tables.sql` - Disable RLS for setup tables
29. `031_fix_missing_user_type_ids.sql` - Missing user type IDs fix

## Notes

- Migration 002 was renamed from `002_add_missing_tables.sql` to `002_migrate_existing_data.sql` for clarity
- Migration numbers 028 and 029 were removed (archived as emergency fixes)
- All archived files are preserved for historical reference and recovery if needed
- The active migration sequence has gaps (002, then 003) - this is intentional as some migrations were consolidated

## Recovery Instructions

To restore any archived migration:

```bash
# Navigate to archive directory
cd archive/database-migrations/<category>/

# Copy file back to migrations directory
cp <migration-file>.sql ../../database/migrations/
```

## Validation

To verify the migration sequence integrity:

```bash
# List all active migrations in order
ls database/migrations/*.sql | sort -V

# Count active migrations (should be 29)
ls database/migrations/*.sql | wc -l

# Count archived files (should be 25)
find archive/database-migrations/ -name "*.sql" | wc -l
```
