# Quick Start: Cleanup Validation

## Tester Agent: READY ✅

### Baseline Established
- **656 passing tests** (threshold - do not drop below)
- All critical files verified intact
- Storage baseline: 136 MB (docs: 8.1 MB)

---

## Run Validation After Each Phase

### Phase 1: Documentation Consolidation
```bash
node scripts/archive-validate.js phase1
```

### Phase 2: Migration Files Archival
```bash
node scripts/archive-validate.js phase2
```

### Phase 3: Test Files Archival
```bash
node scripts/archive-validate.js phase3
```

### Phase 4: Recovery Documentation Archival
```bash
node scripts/archive-validate.js phase4
```

### Final Validation
```bash
node scripts/archive-validate.js final
npm test
```

---

## What Gets Checked

✅ **Critical Files**: server.js, package.json, /src, /views, /public
✅ **Test Suite**: Must maintain 656+ passing tests
✅ **Archive Structure**: Valid organization
✅ **Protected Files**: No unexpected deletions
✅ **Storage**: Tracking size changes

---

## Alert Thresholds

### 🚨 CRITICAL (Stop Immediately):
- Test count < 656
- Critical files deleted
- Source/view directories missing files

### ⚠️ WARNING (Investigate):
- Archive structure incomplete
- New test failures
- Storage increase

---

## Quick Health Check
```bash
# One-liner to verify critical files
ls -la server.js package.json src/ views/ && echo "✅ OK"

# Test count
npm test 2>&1 | grep "Tests:"

# Storage
du -sh . docs/ archive/
```

---

## Files Created
- `/scripts/archive-validate.js` - Main validation
- `/scripts/phase-monitor.sh` - Quick phase check
- `/tests/validation/` - All validation docs & reports

---

## Current Status
🟢 **READY** - Awaiting Phase 1 completion for validation

---

**Next**: Run validation after Phase 1 cleanup completes
