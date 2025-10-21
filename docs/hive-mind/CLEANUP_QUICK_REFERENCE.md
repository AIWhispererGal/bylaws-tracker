# 🚀 DIRECTORY CLEANUP - QUICK REFERENCE
**For: Coder Agent Implementation**
**Time Required: 4-5 hours**
**Risk Level: LOW**

---

## 📋 CLEANUP CHECKLIST

### Phase 1: Root Folder (30 min) ✅ DO FIRST
```bash
# 1. Create archive structure
mkdir -p archive/2025-10-october/{completed-sprints,resolved-issues,diagnostics,implementations}
mkdir -p archive/database-snapshots/migrations/{superseded,test-versions,backups}
mkdir -p archive/guides-superseded
mkdir -p scripts/{utilities,database}
mkdir -p database/utilities

# 2. Move root documents (15 files)
git mv CURRENTSCHEMA.txt archive/database-snapshots/
git mv INVITATION_FIX_README.txt archive/2025-10-october/resolved-issues/
git mv RECOVERY_OPTIONS.md archive/2025-10-october/diagnostics/
git mv SECURITY_FIXES_COMPLETED.md archive/2025-10-october/resolved-issues/
git mv CONFIGURATION_GUIDE.md archive/guides-superseded/
git mv DEPLOYMENT_GUIDE.md archive/guides-superseded/
git mv GENERALIZATION_GUIDE.md archive/guides-superseded/
git mv IMPLEMENTATION_GUIDE.md archive/guides-superseded/
git mv MIGRATION_GUIDE.md archive/guides-superseded/
git mv SETUP_GUIDE.md archive/guides-superseded/
git mv QUICKSTART.md archive/guides-superseded/
git mv FINAL_SETUP_CHECKLIST.md archive/guides-superseded/
git mv PARSER_COMPLETE.md archive/2025-10-october/completed-sprints/
git mv RENDER_DEPLOYMENT_COMPLETE.md archive/2025-10-october/completed-sprints/
git mv DEBUG_FORM.md archive/2025-10-october/diagnostics/

# 3. Move scripts (4 files)
git mv parse_bylaws.js scripts/utilities/
git mv quick-login.js scripts/utilities/
git mv seed-test-organization.js scripts/database/
git mv query-with-raw-sql.js scripts/database/

# 4. Delete temporary diagnostics (8 files)
git rm check-database-tables.js
git rm check-if-data-still-exists.js
git rm debug-middleware-order.js
git rm debug-supabase-connection.js
git rm test-final-verification.js
git rm test-section-routes-http.js
git rm test-section-routes.js
git rm test-setup-check.js

# 5. Delete Word temp file
rm "~\$CBYLAWS_2024.txt"
```

**Verification:**
```bash
ls -1 *.md *.js *.txt 2>/dev/null | wc -l
# Should be ≤ 10 files
```

---

### Phase 2: Documentation (2 hours)

#### Step 1: Archive Completed Sprints/Phases
```bash
# Sprint 0 docs (19 files)
mkdir -p archive/2025-10-october/completed-sprints/sprint-0/{tasks,reports}

git mv docs/SPRINT_0_*.md archive/2025-10-october/completed-sprints/sprint-0/tasks/
git mv docs/reports/SPRINT0_*.md archive/2025-10-october/completed-sprints/sprint-0/reports/

# Phase 2 completed features (9 files)
mkdir -p archive/2025-10-october/completed-sprints/phase-2

git mv docs/PHASE_2_BACKEND_IMPLEMENTATION_COMPLETE.md archive/2025-10-october/completed-sprints/phase-2/
git mv docs/PHASE_2_FEATURE_2_*.md archive/2025-10-october/completed-sprints/phase-2/
git mv docs/PHASE_2_HIERARCHY_EDITOR_COMPLETE.md archive/2025-10-october/completed-sprints/phase-2/
git mv docs/PHASE_2_SECTION_REFRESH_*.md archive/2025-10-october/completed-sprints/phase-2/
```

#### Step 2: Archive Emergency/Quick Fixes (130 files)
```bash
mkdir -p archive/2025-10-october/resolved-issues/{workflow,auth,rls,general}

# Use pattern matching
git mv docs/*FIX*.md archive/2025-10-october/resolved-issues/general/
git mv docs/*FIXES*.md archive/2025-10-october/resolved-issues/general/
git mv docs/*QUICK*.md archive/2025-10-october/resolved-issues/general/
git mv docs/*EMERGENCY*.md archive/2025-10-october/resolved-issues/general/
git mv docs/*HOTFIX*.md archive/2025-10-october/resolved-issues/general/

# Workflow-specific
git mv archive/2025-10-october/resolved-issues/general/WORKFLOW_*.md archive/2025-10-october/resolved-issues/workflow/

# Auth-specific
git mv archive/2025-10-october/resolved-issues/general/AUTH_*.md archive/2025-10-october/resolved-issues/auth/

# RLS-specific
git mv archive/2025-10-october/resolved-issues/general/RLS_*.md archive/2025-10-october/resolved-issues/rls/
```

#### Step 3: Archive Implementations (50+ files)
```bash
mkdir -p archive/2025-10-october/implementations/{lazy-loading,permissions,invitations,toc,workflow}

git mv docs/*IMPLEMENTATION*.md archive/2025-10-october/implementations/
git mv docs/*COMPLETE.md archive/2025-10-october/implementations/
git mv docs/TOC_*.md archive/2025-10-october/implementations/toc/
git mv docs/LAZY_LOADING_*.md archive/2025-10-october/implementations/lazy-loading/
git mv docs/PERMISSIONS_*.md archive/2025-10-october/implementations/permissions/
git mv docs/INVITATION_*.md archive/2025-10-october/implementations/invitations/
```

#### Step 4: Archive Diagnostics & Reports
```bash
mkdir -p archive/2025-10-october/diagnostics/{diagnosis,reports,research}

git mv docs/diagnosis/*.md archive/2025-10-october/diagnostics/diagnosis/
git mv docs/research/*.md archive/2025-10-october/diagnostics/research/

# Reports (keep master reports, archive detailed)
git mv docs/reports/P*.md archive/2025-10-october/diagnostics/reports/
git mv docs/reports/*_REPORT.md archive/2025-10-october/diagnostics/reports/
git mv docs/reports/TESTING_*.md archive/2025-10-october/diagnostics/reports/
```

#### Step 5: Consolidate Session Logs
```bash
mkdir -p docs/session-logs

git mv docs/SESSION_*.md docs/session-logs/
git mv docs/hive-mind/HIVE_*.md docs/session-logs/
```

#### Step 6: Consolidate Duplicate READMEs
```bash
# Create master index
cat > docs/INDEX.md << 'EOF'
# Documentation Index

## Active Documentation
- [Roadmap](roadmap/README.md) - Development roadmap
- [Architecture](architecture/) - System architecture
- [Authentication](auth/) - Auth system docs
- [Design](design/) - Design specifications

## Archives
- [Completed Sprints](../archive/2025-10-october/completed-sprints/)
- [Resolved Issues](../archive/2025-10-october/resolved-issues/)
- [Implementations](../archive/2025-10-october/implementations/)
EOF

# Archive feature READMEs
git mv docs/analysis/README.md archive/2025-10-october/diagnostics/
git mv docs/diagnosis/README.md archive/2025-10-october/diagnostics/
```

**Verification:**
```bash
find docs/ -name "*.md" | wc -l
# Should be ~120 files (down from 483)
```

---

### Phase 3: Database Migrations (45 min)

```bash
# Move superseded migrations
git mv database/migrations/005_TEST_RLS_POLICIES.sql archive/database-snapshots/migrations/test-versions/
git mv database/migrations/005_fix_rls_properly.sql archive/database-snapshots/migrations/superseded/
git mv database/migrations/005_implement_proper_rls.sql archive/database-snapshots/migrations/superseded/
git mv database/migrations/012_workflow_enhancements_BACKUP.sql archive/database-snapshots/migrations/backups/
git mv database/migrations/023_fix_rls_infinite_recursion.sql archive/database-snapshots/migrations/superseded/
git mv database/migrations/026_fix_multi_org_setup_SIMPLE.sql archive/database-snapshots/migrations/superseded/
git mv database/migrations/027_fix_setup_rls_policies_QUICK.sql archive/database-snapshots/migrations/superseded/
git mv database/migrations/030_disable_rls_all_setup_tables.sql archive/database-snapshots/migrations/superseded/

# Move utility scripts
git mv database/migrations/CLEAR_*.sql database/utilities/
git mv database/migrations/COMPLETE_*.sql database/utilities/
git mv database/migrations/FIX_ORGANIZATIONS_SCHEMA.sql database/utilities/
git mv database/migrations/NUKE_TEST_DATA.sql database/utilities/
git mv database/migrations/QUICK_FIX_*.sql database/utilities/
git mv database/migrations/SIMPLE_SETUP.sql database/utilities/

# Move documentation
git mv database/migrations/*.md archive/2025-10-october/diagnostics/
git mv database/migrations/*.txt archive/2025-10-october/diagnostics/
```

**Verification:**
```bash
ls -1 database/migrations/*.sql | wc -l
# Should be ~42 files (down from 53)
```

---

### Phase 4: Test Cleanup (1 hour) - OPTIONAL

**Review these tests before archiving:**
```bash
# Check test status
npm test 2>&1 | tee test-results.txt

# Archive only if tests are stale/unused
mkdir -p archive/tests/{bug-fixes,deprecated}

# Example (verify first!)
# git mv tests/setup-parser-integration.test.js archive/tests/bug-fixes/
# git mv tests/success-redirect.test.js archive/tests/bug-fixes/
```

**Keep all manual tests - they're valuable!**

---

## 🎯 EXPECTED RESULTS

### Before
```
Root folder:     35 files
docs/:           483 files (7.9 MB)
database/:       53 migrations
Duplicates:      130+ emergency docs, 11 migration copies
```

### After
```
Root folder:     8 files (-77%)
docs/:           120 files (3.2 MB, -59%)
database/:       42 migrations (-20%)
Duplicates:      0
Archive:         6.2 MB (organized)
```

---

## ⚠️ SAFETY CHECKS

### Before Each Phase
```bash
# Create backup
git add -A
git commit -m "Checkpoint before cleanup phase X"

# Create branch
git checkout -b cleanup-phase-X
```

### After Each Phase
```bash
# Verify application still works
npm run dev &
sleep 5
curl http://localhost:3000/health
kill %1

# Verify tests
npm test

# Commit if successful
git add -A
git commit -m "Cleanup Phase X complete"
```

### Rollback If Needed
```bash
git reset --hard HEAD~1
# or
git checkout main
git branch -D cleanup-phase-X
```

---

## 📊 PROGRESS TRACKING

```bash
# Check progress
echo "Root files: $(ls -1 *.md *.js *.txt 2>/dev/null | wc -l)"
echo "Doc files: $(find docs/ -name '*.md' | wc -l)"
echo "Migrations: $(ls -1 database/migrations/*.sql | wc -l)"
echo "Archive size: $(du -sh archive/ 2>/dev/null || echo '0')"
```

---

## 🔗 REFERENCES

- **Full Report:** `/docs/hive-mind/DIRECTORY_AUDIT_REPORT.md`
- **Files Analyzed:** 714+
- **Categories:** ACTIVE, ARCHIVE, DELETE, CONSOLIDATE
- **Risk Level:** LOW (all git mv, minimal deletion)

---

## ✅ COMPLETION CRITERIA

- [ ] Phase 1: Root folder ≤ 10 files
- [ ] Phase 2: Docs reduced to ~120 files
- [ ] Phase 3: Migrations cleaned to 42 canonical
- [ ] Phase 4: Tests verified (optional archive)
- [ ] All changes committed to git
- [ ] Application tested and working
- [ ] Archive README created with index

---

**Status:** Ready for Coder Agent
**Priority:** HIGH (improves maintainability)
**Estimated Time:** 4-5 hours
**Next:** Execute Phase 1, verify, proceed
