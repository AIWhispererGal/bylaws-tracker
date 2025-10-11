# Database Documentation Index

**Generalized Multi-Tenant Amendment Tracker**
**Version:** 2.0.0
**Last Updated:** 2025-10-07

---

## 📚 Documentation Files

### Quick Start

1. **[DESIGN_DECISIONS_SUMMARY.md](/docs/DESIGN_DECISIONS_SUMMARY.md)** - **START HERE**
   - Executive summary of all design decisions
   - Key trade-offs and rationale
   - Performance metrics
   - Migration checklist
   - ~400 lines, 10 min read

2. **[DATABASE_DESIGN.md](/docs/DATABASE_DESIGN.md)** - **COMPREHENSIVE GUIDE**
   - Complete design rationale with examples
   - Multi-tenancy architecture details
   - Hierarchy storage model explained
   - Workflow system implementation
   - Usage examples and query patterns
   - ~850 lines, 30 min read

3. **[ARCHITECTURE_DESIGN.md](ARCHITECTURE_DESIGN.md)** - **ORIGINAL DESIGN DOC**
   - Initial architecture proposal
   - Design alternatives comparison
   - Complete schema DDL reference
   - Migration strategy overview
   - ~850 lines, 30 min read

---

## 🗄️ Migration Files

### Executable SQL Scripts

#### 001_generalized_schema.sql
**Purpose:** Create complete new schema (non-destructive)

**Contents:**
- Organizations and user management tables
- Document sections with flexible hierarchy
- Configurable workflow system
- Suggestions and votes (multi-section support)
- Row-Level Security (RLS) policies
- Helper functions and triggers

**Run Command:**
```bash
psql -h your-db.supabase.co -U postgres -f database/migrations/001_generalized_schema.sql
```

**Expected Output:**
```
CREATE TABLE organizations
CREATE TABLE users
CREATE TABLE document_sections
... (15 tables total)
CREATE POLICY tenant_isolation
... (10+ RLS policies)
NOTICE: Generalized Schema Created Successfully
```

**Safety:** Non-destructive - creates new tables alongside existing ones

---

#### 002_migrate_existing_data.sql
**Purpose:** Migrate data from old schema to new schema

**Prerequisites:**
1. Run `001_generalized_schema.sql` first
2. Customize organization details (lines 39-50)
3. Test on staging database

**Contents:**
- Backup creation (preserves original data)
- Organization and document setup
- Section migration with hierarchy parsing
- Workflow template creation (2-stage default)
- Workflow state migration (committee/board)
- Suggestion and vote migration
- Data integrity validation

**Run Command:**
```bash
# 1. Edit configuration (required!)
nano database/migrations/002_migrate_existing_data.sql
# Update: organization_name, organization_slug, google_doc_id

# 2. Run migration
psql -h your-db.supabase.co -U postgres -f database/migrations/002_migrate_existing_data.sql
```

**Expected Output:**
```
NOTICE: ✓ Backup tables created with timestamp suffix
NOTICE: ✓ Organization created/updated
NOTICE: ✓ Document created/updated
NOTICE: ✓ Migrated 42 sections to document_sections
NOTICE: ✓ Created default 2-stage workflow
NOTICE: ✓ Migrated workflow states: 15 committee, 8 board
NOTICE: ✓ Migrated 23 suggestions with 35 section mappings
NOTICE: ✓ Migrated 47 votes
NOTICE: ✓ Data integrity validation passed
NOTICE: ========================================
NOTICE: MIGRATION COMPLETE
...
```

**Safety:**
- Creates timestamped backup tables
- Original tables preserved (not dropped)
- Includes rollback script (commented out)

---

## 🏗️ Legacy Migration Files

### migration_001_multi_section.sql
**Status:** Superseded by new migration
**Purpose:** Added multi-section amendment support to old schema
**Note:** Included for historical reference only

### migration_001_rollback.sql
**Status:** Superseded
**Purpose:** Rollback for old multi-section migration

### migrations/001-generalize-schema.js
**Status:** Superseded by SQL version
**Purpose:** Knex.js migration script (incomplete)
**Note:** Use SQL migrations instead

---

## 📖 Usage Guide

### For Developers

**First Time Setup:**
```bash
# 1. Read design summary (10 min)
cat docs/DESIGN_DECISIONS_SUMMARY.md

# 2. Review complete design (30 min)
cat docs/DATABASE_DESIGN.md

# 3. Understand your existing schema
psql -c "\d bylaw_sections"
psql -c "\d bylaw_suggestions"

# 4. Test migration on staging
createdb bylaws_test
pg_dump production_db | psql bylaws_test
psql bylaws_test -f database/migrations/001_generalized_schema.sql
psql bylaws_test -f database/migrations/002_migrate_existing_data.sql
```

**Application Code Updates:**
See [DATABASE_DESIGN.md - Phase 4](/docs/DATABASE_DESIGN.md#phase-4-application-code-updates)

---

### For Database Administrators

**Pre-Migration Checklist:**
```bash
# 1. Create backup
pg_dump production_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Check database size
psql -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# 3. Check current data volumes
psql -c "SELECT 'bylaw_sections' as table, COUNT(*) FROM bylaw_sections
         UNION ALL
         SELECT 'bylaw_suggestions', COUNT(*) FROM bylaw_suggestions
         UNION ALL
         SELECT 'bylaw_votes', COUNT(*) FROM bylaw_votes;"

# 4. Estimate migration time (~1 min per 1000 rows)
# Small DB (<1000 rows): ~2 minutes
# Medium DB (<10000 rows): ~15 minutes
# Large DB (>10000 rows): ~1 hour

# 5. Schedule maintenance window
# Recommended: Off-peak hours, allow 2x estimated time
```

**Migration Execution:**
```bash
# 1. Enable maintenance mode in application
curl -X POST https://your-app.com/api/admin/maintenance/enable

# 2. Run migrations
psql production_db -f database/migrations/001_generalized_schema.sql 2>&1 | tee migration_001.log
psql production_db -f database/migrations/002_migrate_existing_data.sql 2>&1 | tee migration_002.log

# 3. Validate migration
psql production_db -c "
  SELECT 'Old sections' as source, COUNT(*) FROM bylaw_sections
  UNION ALL
  SELECT 'New sections', COUNT(*) FROM document_sections;
"

# 4. Test application with new schema
# ... run integration tests ...

# 5. Disable maintenance mode
curl -X POST https://your-app.com/api/admin/maintenance/disable
```

**Post-Migration:**
```bash
# 1. Monitor performance
psql -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
         FROM pg_tables
         WHERE schemaname = 'public'
         ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"

# 2. Verify RLS policies
psql -c "SELECT schemaname, tablename, policyname, permissive, roles, qual
         FROM pg_policies
         WHERE schemaname = 'public';"

# 3. Check index usage (after 1 week)
psql -c "SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
         FROM pg_stat_user_indexes
         ORDER BY idx_scan DESC;"

# 4. Clean up backups (after 30 days)
psql -c "DROP TABLE _backup_bylaw_sections_20251007_120000;
         DROP TABLE _backup_bylaw_suggestions_20251007_120000;
         DROP TABLE _backup_bylaw_votes_20251007_120000;"
```

---

## 🔍 Schema Overview

### Core Tables (15 total)

**Multi-Tenancy:**
- `organizations` - Root tenant table
- `users` - User accounts (Supabase Auth)
- `user_organizations` - Membership & roles

**Document Management:**
- `documents` - Document metadata
- `document_sections` - Hierarchical sections (replaces `bylaw_sections`)

**Workflow System:**
- `workflow_templates` - Org-specific workflows
- `workflow_stages` - Individual approval stages
- `document_workflows` - Doc-to-workflow mapping
- `section_workflow_states` - Progress tracking (replaces `locked_by_committee`, `board_approved`)

**Suggestions & Voting:**
- `suggestions` - Amendment suggestions (replaces `bylaw_suggestions`)
- `suggestion_sections` - Multi-section mapping (new!)
- `suggestion_votes` - User votes (replaces `bylaw_votes`)

### Key Design Patterns

**Multi-Tenancy:**
```sql
-- Every table has organization_id
-- RLS policies enforce isolation
organization_id UUID REFERENCES organizations(id)
```

**Hierarchy:**
```sql
-- Adjacency list + materialized path hybrid
parent_section_id UUID
path_ids UUID[]       -- [root, parent, self]
path_ordinals INT[]   -- [1, 2, 3] = "1.2.3"
```

**Workflow:**
```sql
-- State machine with configurable stages
workflow_templates → workflow_stages → section_workflow_states
```

---

## 📊 Quick Reference

### Common Queries

**Get all sections in document order:**
```sql
SELECT
  REPEAT('  ', depth) || section_number as indented_number,
  section_title
FROM document_sections
WHERE document_id = :doc_id
ORDER BY path_ordinals;
```

**Get workflow progress for section:**
```sql
SELECT
  ws.stage_name,
  ws.stage_order,
  sws.status,
  sws.actioned_by,
  sws.actioned_at
FROM section_workflow_states sws
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
WHERE sws.section_id = :section_id
ORDER BY ws.stage_order DESC;
```

**Get sections pending approval:**
```sql
SELECT
  ds.section_number,
  ds.section_title,
  COUNT(s.id) as suggestion_count
FROM document_sections ds
JOIN section_workflow_states sws ON ds.id = sws.section_id
JOIN workflow_stages ws ON sws.workflow_stage_id = ws.id
LEFT JOIN suggestion_sections ss ON ds.id = ss.section_id
LEFT JOIN suggestions s ON ss.suggestion_id = s.id
WHERE ws.stage_name = 'Committee Review'
  AND sws.status = 'pending'
GROUP BY ds.id
ORDER BY suggestion_count DESC;
```

---

## 🆘 Troubleshooting

### Common Issues

**Issue: Migration fails with "organization_id violates foreign key constraint"**

**Solution:**
```sql
-- Check if organizations table has data
SELECT COUNT(*) FROM organizations;

-- If empty, migration config wasn't customized
-- Edit migration_002 file and re-run
```

---

**Issue: Sections not visible after migration**

**Solution:**
```sql
-- Check RLS policies are enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verify user belongs to organization
SELECT * FROM user_organizations WHERE user_id = auth.uid();
```

---

**Issue: Slow hierarchy queries**

**Solution:**
```sql
-- Check GIN index exists
\d document_sections

-- Should show: idx_doc_sections_path GIN (path_ids)

-- If missing:
CREATE INDEX idx_doc_sections_path ON document_sections USING GIN(path_ids);
ANALYZE document_sections;
```

---

## 📞 Support

**Documentation Issues:**
- File: This README or design docs
- Check: [DATABASE_DESIGN.md - Troubleshooting](/docs/DATABASE_DESIGN.md#appendix-c-troubleshooting)

**Migration Issues:**
- Backup Tables: `_backup_*` tables preserve original data
- Rollback: See commented rollback script in migration_002

**Performance Issues:**
- Check: Index usage with `pg_stat_user_indexes`
- Review: [DATABASE_DESIGN.md - Performance](/docs/DATABASE_DESIGN.md#performance-optimizations)

---

## 📝 File Structure

```
database/
├── README.md (this file)
├── ARCHITECTURE_DESIGN.md (original design doc)
├── schema.sql (original single-org schema)
├── migrations/
│   ├── 001_generalized_schema.sql ✅ (new schema DDL)
│   ├── 002_migrate_existing_data.sql ✅ (data migration)
│   ├── 001-generalize-schema.js (legacy, unused)
│   ├── migration_001_multi_section.sql (legacy)
│   └── migration_001_rollback.sql (legacy)
│
docs/
├── DESIGN_DECISIONS_SUMMARY.md ✅ (executive summary)
└── DATABASE_DESIGN.md ✅ (complete design guide)
```

**✅ = Required for new implementation**

---

## 🎯 Next Steps

1. **Read** [DESIGN_DECISIONS_SUMMARY.md](/docs/DESIGN_DECISIONS_SUMMARY.md) (10 min)
2. **Review** [DATABASE_DESIGN.md](/docs/DATABASE_DESIGN.md) (30 min)
3. **Test** Migration on staging database
4. **Update** Application code (see design doc Phase 4)
5. **Deploy** To production (during maintenance window)

---

**Questions?** Review the complete design documentation or check the troubleshooting sections.

**Ready to migrate?** Follow the Database Administrator checklist above.

---

*Last Updated: 2025-10-07*
*Hive Mind Agent: Database Analyst*
*Schema Version: 2.0.0*
