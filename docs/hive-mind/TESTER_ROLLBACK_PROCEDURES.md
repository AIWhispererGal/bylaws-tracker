# Emergency Rollback Procedures
## Directory Cleanup Safety Net

**Purpose:** Emergency procedures for reverting directory cleanup if issues arise
**Owner:** Tester Agent
**Risk Level:** LOW (if procedures followed)
**Last Updated:** 2025-10-21

---

## Quick Reference

### Emergency Commands (Copy-Paste Ready)

**Option 1: Uncommitted Changes**
```bash
# DISCARD ALL CHANGES (Nuclear option)
git reset --hard HEAD
git clean -fd
npm test  # Verify restoration
```

**Option 2: After Commit (Before Push)**
```bash
# Return to tagged state
git reset --hard pre-cleanup-state
npm test  # Verify restoration
```

**Option 3: After Push**
```bash
# Create revert commit
git revert <commit-hash>
npm test  # Verify restoration
```

---

## Detailed Rollback Scenarios

### Scenario 1: Tests Start Failing

**Symptoms:**
- npm test shows new failures
- Import errors appear
- Application won't start

**Diagnosis:**
```bash
# Compare test results
diff pre-cleanup-test-results.txt <(npm test 2>&1)

# Check for import errors
npm start 2>&1 | grep "Cannot find module"
```

**Resolution:**
```bash
# 1. Identify affected files
git diff --name-only

# 2. Restore specific files
git checkout HEAD -- path/to/file.js

# 3. Or restore all changes
git reset --hard HEAD

# 4. Verify fix
npm test
npm start
```

### Scenario 2: Application Won't Start

**Symptoms:**
- Server crashes on startup
- Module not found errors
- Require() failures

**Diagnosis:**
```bash
# Start with verbose logging
NODE_ENV=development npm start 2>&1 | tee start-error.log

# Check for missing files
grep "Cannot find module" start-error.log
```

**Resolution:**
```bash
# Quick fix: Restore from archive
cp archive/debug-scripts/missing-file.js ./

# Or full rollback
git reset --hard pre-cleanup-state
npm install  # Reinstall dependencies
npm start    # Verify
```

### Scenario 3: Broken Documentation Links

**Symptoms:**
- Documentation references non-existent files
- README links return 404

**Diagnosis:**
```bash
# Find broken markdown links
find docs -name "*.md" -exec grep -l "](.*\.md)" {} \;

# Test specific file
cat docs/roadmap/README.md | grep -o "\](.*\.md)"
```

**Resolution:**
```bash
# Option A: Update links manually
# Edit docs/roadmap/README.md
# Change: [link](../file.md)
# To: [link](../archive/docs/file.md)

# Option B: Restore original structure
git checkout HEAD -- docs/
```

### Scenario 4: Git History Issues

**Symptoms:**
- Git blame shows wrong authors
- Lost commit history
- File tracking broken

**Diagnosis:**
```bash
# Check file history
git log --follow -- path/to/file.js

# Verify git tracked moves
git log --all --follow --stat -- '*filename*'
```

**Resolution:**
```bash
# If git mv was used correctly, history is intact
# To verify:
git log --follow archive/debug-scripts/file.js

# If history lost, restore from backup
git reset --hard pre-cleanup-state
```

---

## Step-by-Step Rollback Procedures

### Full Rollback (Nuclear Option)

**When to Use:** Multiple issues, unclear cause, need clean slate

**Steps:**
1. **Stop Application**
   ```bash
   # Kill any running processes
   pkill -f "node server.js"
   ```

2. **Check Current State**
   ```bash
   git status
   git log --oneline -5
   ```

3. **Reset to Pre-Cleanup**
   ```bash
   # Discard all changes
   git reset --hard pre-cleanup-state

   # Remove untracked files
   git clean -fd

   # Verify reset
   git status  # Should show "nothing to commit"
   ```

4. **Verify Restoration**
   ```bash
   # Check files are back
   ls -la *.js  # Should see debug scripts

   # Run tests
   npm test

   # Start application
   npm start
   ```

5. **Document Issue**
   ```bash
   # Create issue report
   echo "Rollback executed due to: [reason]" > rollback-report.txt
   git add rollback-report.txt
   git commit -m "Document rollback reason"
   ```

### Partial Rollback (Surgical Fix)

**When to Use:** Specific file/directory causing issues

**Steps:**
1. **Identify Problem File**
   ```bash
   # From error message
   # Example: "Cannot find module './check-database-tables'"
   ```

2. **Restore from Archive**
   ```bash
   # Check if file in archive
   ls -la archive/debug-scripts/check-database-tables.js

   # Copy back to root
   cp archive/debug-scripts/check-database-tables.js ./

   # Or use git
   git mv archive/debug-scripts/check-database-tables.js ./
   ```

3. **Verify Fix**
   ```bash
   # Test specific functionality
   node check-database-tables.js

   # Run relevant tests
   npm test -- --testPathPattern="database"
   ```

4. **Commit Partial Revert**
   ```bash
   git add check-database-tables.js
   git commit -m "Restore check-database-tables.js - needed for operations"
   ```

### Time-Based Rollback (Recent Changes)

**When to Use:** Just made changes, realized mistake

**Steps:**
1. **View Recent Commits**
   ```bash
   git log --oneline -10
   ```

2. **Revert Specific Commit**
   ```bash
   # Creates new commit that undoes changes
   git revert <commit-hash>

   # Example:
   git revert abc123f
   ```

3. **Or Reset to Previous Commit**
   ```bash
   # Dangerous: Rewrites history
   git reset --hard HEAD~1  # Go back 1 commit
   git reset --hard HEAD~3  # Go back 3 commits
   ```

4. **Force Push (If Already Pushed)**
   ```bash
   # Only if you're sure!
   git push --force-with-lease origin cleanup/directory-organization
   ```

---

## Validation After Rollback

### Critical Checks

**1. Test Suite**
```bash
# Run full suite
npm test > post-rollback-test-results.txt

# Compare with baseline
diff pre-cleanup-test-results.txt post-rollback-test-results.txt

# Expected: No differences (or only pre-existing failures)
```

**2. Application Startup**
```bash
# Start server
npm start

# Check for errors (in separate terminal)
curl http://localhost:3000/health || echo "Server not responding"

# Stop server
pkill -f "node server.js"
```

**3. File Integrity**
```bash
# Check critical files exist
test -f server.js && echo "✓ server.js" || echo "✗ server.js MISSING"
test -f package.json && echo "✓ package.json" || echo "✗ package.json MISSING"
test -f jest.config.js && echo "✓ jest.config.js" || echo "✗ jest.config.js MISSING"

# Check src/ structure
ls -la src/
```

**4. Git Status**
```bash
# Should be clean or show intended changes
git status

# Check for unexpected deletions
git status | grep "deleted:" || echo "No unexpected deletions"
```

### Success Criteria

After rollback, verify:
- [ ] Test suite passes (656+ passing tests)
- [ ] Application starts without errors
- [ ] No "Cannot find module" errors
- [ ] Git status shows clean state
- [ ] All critical files present
- [ ] No unexpected deletions

---

## Prevention Checklist

**Before Future Cleanups:**
1. [ ] Create git branch
2. [ ] Tag current state
3. [ ] Run and save test results
4. [ ] Backup important files
5. [ ] Use git mv (not manual moves)
6. [ ] Commit incrementally
7. [ ] Test after each phase

**During Cleanup:**
1. [ ] Move files in small batches
2. [ ] Test after each batch
3. [ ] Commit after successful tests
4. [ ] Document what was moved
5. [ ] Update documentation links
6. [ ] Verify imports still work

**After Cleanup:**
1. [ ] Run full test suite
2. [ ] Start application
3. [ ] Check for errors
4. [ ] Validate documentation
5. [ ] Update README if needed
6. [ ] Create cleanup summary

---

## Contact & Escalation

**If Rollback Fails:**
1. Stop and document current state
2. Create issue report with:
   - What was attempted
   - Error messages
   - Git status output
   - Test results
3. Do NOT make additional changes
4. Seek assistance from:
   - Coordinator Agent
   - Original cleanup executor
   - Repository maintainer

**Recovery Resources:**
- Git reflog: `git reflog` (shows all state changes)
- Backup tags: `git tag -l "pre-cleanup*"`
- Archive directory: Check `/archive` for moved files

---

## Appendix: Common Errors & Solutions

### Error: "Cannot find module './debug-script'"

**Cause:** File moved to archive but still referenced

**Fix:**
```bash
# Restore file
cp archive/debug-scripts/debug-script.js ./

# Or update reference
# Edit file that requires it, change path to:
require('./archive/debug-scripts/debug-script')
```

### Error: "ENOENT: no such file or directory"

**Cause:** File moved but path not updated

**Fix:**
```bash
# Find which file has the reference
grep -r "missing-file.js" src/

# Update the path or restore file
```

### Error: Tests failing after rollback

**Cause:** Test environment not restored

**Fix:**
```bash
# Clean and reinstall
rm -rf node_modules
npm install

# Clear jest cache
npx jest --clearCache

# Run tests again
npm test
```

---

**End of Rollback Procedures**

*Created by: Tester Agent (Hive Mind)*
*Purpose: Safety net for directory cleanup*
*Next Review: After cleanup completion*
