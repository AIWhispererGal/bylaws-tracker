# Cleanup Validation Protocol

## Overview
This document defines the validation protocol for the 4-phase cleanup operation.

## Baseline Established
- **Timestamp**: 2025-10-21
- **Passing Tests**: 656 tests
- **Test Suites**: 45 total (20 passing, 25 failing)
- **Critical Files**: All verified intact
- **Project Size**: 136 MB

## Phase Validation Commands

### After Each Phase:
```bash
# 1. Run validation script
node scripts/archive-validate.js <phase-name>

# 2. Run phase monitor
bash scripts/phase-monitor.sh <phase-name>

# 3. Check test suite (critical tests only)
npm test -- --testPathPattern="unit" --bail
```

## Validation Checklist (Per Phase)

### Phase 1: Documentation Consolidation
- [ ] All active docs remain (README.md, roadmap, guides)
- [ ] Archived docs moved to archive/docs/
- [ ] No gaps in documentation navigation
- [ ] Test suite: 656+ passing
- [ ] Git status: Expected changes only

### Phase 2: Migration Files Archival
- [ ] Active migrations remain in database/migrations/
- [ ] Old migrations moved to archive/database/
- [ ] Database functionality intact
- [ ] Test suite: 656+ passing
- [ ] No database connection issues

### Phase 3: Test Files Archival
- [ ] Active tests remain in tests/
- [ ] Legacy tests moved to archive/test-files/
- [ ] Current test suite runs successfully
- [ ] Test suite: 656+ passing
- [ ] Coverage metrics maintained

### Phase 4: Recovery Documentation Archival
- [ ] Current session docs remain
- [ ] Old recovery docs moved to archive/docs/recovery/
- [ ] Emergency procedures documented
- [ ] Test suite: 656+ passing
- [ ] All critical files intact

## Critical Failure Indicators

### STOP IMMEDIATELY if:
1. ❌ Test suite drops below 656 passing tests
2. ❌ server.js or package.json deleted/corrupted
3. ❌ src/ or views/ directories missing files
4. ❌ Git shows unexpected deletions
5. ❌ Application fails to start

### Warning Indicators (Monitor):
1. ⚠️ Archive structure incomplete
2. ⚠️ Documentation links broken
3. ⚠️ Storage savings less than expected
4. ⚠️ New test failures (not in baseline)

## Rollback Procedure

If critical failure detected:
```bash
# 1. Stop all operations immediately
git status

# 2. Check what was changed
git diff --name-status

# 3. Restore from git if needed
git checkout <file>

# 4. Validate restoration
node scripts/archive-validate.js rollback

# 5. Run full test suite
npm test
```

## Success Criteria (All Phases Complete)

### Required:
✅ All 4 phases complete without critical failures
✅ Test suite maintains 656+ passing tests
✅ All critical files intact (server.js, package.json, src/, views/, public/)
✅ Archive structure valid and organized
✅ No broken imports or dependencies
✅ Application starts successfully

### Desired:
✅ Storage reduction of 5-10 MB
✅ Improved organization and findability
✅ Clear archive taxonomy
✅ Documentation index updated

## Validation Reports

Each phase generates:
1. **JSON Report**: `tests/validation/phase-<name>-report.json`
2. **Console Output**: Real-time validation results
3. **Exit Code**: 0 = success, 1 = failure

### Final Validation Report Location:
`tests/validation/FINAL_VALIDATION_REPORT.md`

## Monitoring During Cleanup

### Real-time Monitoring:
```bash
# Watch file changes
watch -n 2 'git status --short | wc -l'

# Monitor test status
watch -n 5 'npm test 2>&1 | tail -5'

# Check disk usage
watch -n 10 'du -sh . docs/ archive/'
```

### Alert Thresholds:
- Modified files > 600: ⚠️ Review changes
- Test failures > baseline: ❌ STOP
- Storage increase: ❌ STOP (should decrease)

## Post-Cleanup Validation

### Final Checks:
```bash
# 1. Full test suite
npm test

# 2. Final validation
node scripts/archive-validate.js final

# 3. Git status review
git status

# 4. Storage measurement
du -sh . archive/ docs/

# 5. Application start test
npm start &
sleep 5
pkill -f "node server.js"
```

## Validation Team Responsibilities

### Tester Agent:
- Run validation after each phase
- Monitor test suite continuously
- Generate validation reports
- Alert on critical failures
- Measure storage savings

### Handoff to Next Session:
- All validation reports in tests/validation/
- Clear PASS/FAIL status for each phase
- Storage metrics documented
- Any issues or warnings noted
- Rollback steps if needed

---

**Status**: PROTOCOL ACTIVE - Monitoring all cleanup phases
