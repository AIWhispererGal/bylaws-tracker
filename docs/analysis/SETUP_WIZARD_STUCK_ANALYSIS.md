# Setup Wizard Stuck State Analysis

**Date:** 2025-10-27
**Analyst:** Code Analyzer Agent
**Issue:** "Organization creation already in progress" error preventing setup retry

---

## Executive Summary

The setup wizard is stuck due to a session-based lock mechanism that prevents duplicate organization creation. The lock is stored in `req.session.organizationCreationInProgress` and should be automatically cleared, but in some cases may persist if the previous attempt crashed or the session was not properly saved.

---

## Lock Mechanism Details

### Location: `/src/routes/setup.js`

**Lines 83-94** - Lock check and initialization:
```javascript
// 🔒 SESSION-BASED LOCK: Prevent duplicate submissions from same session
if (req.session.organizationCreationInProgress) {
    console.log('[SETUP-LOCK] ⏸️  Organization creation already in progress for this session');
    return res.status(409).json({
        success: false,
        error: 'Organization creation already in progress',
        message: 'Please wait for the current request to complete'
    });
}

// Set lock flag IMMEDIATELY (before any async operations)
req.session.organizationCreationInProgress = true;
console.log('[SETUP-LOCK] 🔒 Set organizationCreationInProgress lock for session');
```

**Lines 260-261** - Lock cleared on success:
```javascript
delete req.session.organizationCreationInProgress;
console.log('[SETUP-LOCK] 🔓 Cleared organizationCreationInProgress lock (success)');
```

**Lines 269-270** - Lock cleared on error:
```javascript
delete req.session.organizationCreationInProgress;
console.log('[SETUP-LOCK] 🔓 Cleared organizationCreationInProgress lock (error)');
```

---

## Session Variable Tracking

### Primary Lock Variable
- **Name:** `req.session.organizationCreationInProgress`
- **Type:** Boolean flag
- **Purpose:** Prevent duplicate organization creation from rapid clicks
- **Lifecycle:** Set immediately before processing, cleared on success or error

### Secondary Lock Variable (Import Step)
- **Name:** `req.session.setupProcessingInProgress`
- **Location:** Lines 408-419, 476-477, 494-495, 510-511
- **Purpose:** Prevent duplicate `processSetupData()` calls during import

---

## Root Cause Analysis

### Why the Lock Gets Stuck

1. **Server Crash During Processing**
   - Lock is set at line 93
   - Server crashes before reaching line 260 or 269
   - Session persists the lock state
   - Next attempt sees `organizationCreationInProgress = true`

2. **Session Save Failure**
   - Lock is cleared in memory (line 260/269)
   - Session save fails or doesn't complete
   - Lock persists in session store
   - User retries and sees stale lock

3. **Browser Refresh During Processing**
   - Request #1 starts, sets lock
   - User refreshes browser
   - Request #1 may still be running
   - Request #2 sees lock and blocks

4. **Multiple Browser Tabs**
   - Same session shared across tabs
   - Tab 1 sets lock
   - Tab 2 attempts same action
   - Tab 2 correctly blocked

---

## Database State Check

### Partial Organization Creation
When stuck, check if organization was partially created:

```sql
-- Check for organizations created in last hour
SELECT id, name, slug, created_at, is_configured
FROM organizations
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check for orphaned user_organizations links
SELECT uo.*, o.name as org_name, u.email
FROM user_organizations uo
LEFT JOIN organizations o ON uo.organization_id = o.id
LEFT JOIN users u ON uo.user_id = u.id
WHERE uo.created_at > NOW() - INTERVAL '1 hour'
ORDER BY uo.created_at DESC;
```

### Idempotency Protection
The code already has idempotency checks (lines 728-775):

```javascript
// IDEMPOTENCY CHECK: Skip if organization already created
if (setupData.organizationId) {
    console.log('[SETUP-DEBUG] ⏭️  Organization already created with ID:', setupData.organizationId);
    break;
}

// Check if organization with this slug already exists
const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .ilike('slug', `${baseSlug}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
```

---

## Solutions to Clear Stuck State

### Solution 1: Clear Session Lock (Recommended)
Add a new endpoint to clear stuck locks:

```javascript
/**
 * POST /setup/clear-locks - Emergency lock clearing
 */
router.post('/clear-locks', (req, res) => {
    console.log('[SETUP-LOCK] 🧹 Clearing all setup locks');

    delete req.session.organizationCreationInProgress;
    delete req.session.setupProcessingInProgress;

    req.session.save((err) => {
        if (err) {
            console.error('[SETUP-LOCK] Session save error:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to save session'
            });
        }

        console.log('[SETUP-LOCK] ✅ All locks cleared');
        res.json({ success: true, message: 'Locks cleared successfully' });
    });
});
```

### Solution 2: Add Lock Timeout
Enhance lock with timestamp and auto-expiry:

```javascript
// Check lock age (30 seconds max)
if (req.session.organizationCreationInProgress) {
    const lockAge = Date.now() - (req.session.lockSetAt || 0);

    if (lockAge < 30000) {
        // Lock is fresh, block request
        return res.status(409).json({
            success: false,
            error: 'Organization creation already in progress'
        });
    } else {
        // Lock is stale, clear it
        console.log('[SETUP-LOCK] 🕐 Stale lock detected, clearing');
        delete req.session.organizationCreationInProgress;
        delete req.session.lockSetAt;
    }
}

// Set lock with timestamp
req.session.organizationCreationInProgress = true;
req.session.lockSetAt = Date.now();
```

### Solution 3: UI Feedback Button
Add a "Reset Setup" button on the error screen:

```javascript
// In views/setup/organization.ejs error handler
if (xhr.status === 409) {
    showError(
        'Setup in progress. Please wait...',
        `<button onclick="clearLocks()">Having issues? Clear locks</button>`
    );
}

function clearLocks() {
    fetch('/setup/clear-locks', { method: 'POST' })
        .then(r => r.json())
        .then(() => {
            location.reload();
        });
}
```

---

## Testing Scenarios

### Scenario 1: Normal Operation
1. Submit organization form
2. Lock set → processing → success → lock cleared
3. **Expected:** No stuck state

### Scenario 2: Rapid Clicks
1. Click submit 5 times rapidly
2. Request #1 sets lock
3. Requests #2-5 blocked with 409
4. Request #1 completes, clears lock
5. **Expected:** Only 1 organization created, no stuck state

### Scenario 3: Server Crash
1. Submit organization form
2. Lock set at line 93
3. Kill server process (simulate crash)
4. Restart server
5. Try to submit again
6. **Expected:** Lock persists! (STUCK STATE)

### Scenario 4: Browser Refresh
1. Submit organization form
2. Immediately refresh browser
3. Try to submit again
4. **Expected:** May see 409 if first request still processing

---

## Immediate Action Items

1. **Add `/setup/clear-locks` endpoint** (Solution 1)
2. **Add lock timeout logic** (Solution 2)
3. **Add UI "Reset Setup" button** (Solution 3)
4. **Test all 4 scenarios** to verify fixes

---

## Log Patterns to Watch

### Normal Flow
```
[SETUP-LOCK] 🔒 Set organizationCreationInProgress lock for session
[SETUP-DEBUG] ✅ User linked to organization
[SETUP-LOCK] 🔓 Cleared organizationCreationInProgress lock (success)
```

### Stuck State Pattern
```
[SETUP-LOCK] 🔒 Set organizationCreationInProgress lock for session
[Server crashes or session save fails]
[Next request]
[SETUP-LOCK] ⏸️  Organization creation already in progress for this session
```

### Rapid Click Protection (Working as Intended)
```
[SETUP-LOCK] 🔒 Set organizationCreationInProgress lock for session
[SETUP-LOCK] ⏸️  Organization creation already in progress (blocked)
[SETUP-LOCK] ⏸️  Organization creation already in progress (blocked)
[SETUP-DEBUG] ✅ User linked to organization
[SETUP-LOCK] 🔓 Cleared organizationCreationInProgress lock (success)
```

---

## Recommendations

### Priority 1 (Critical)
- **Add lock timeout** - Prevents permanent stuck state
- **Add clear-locks endpoint** - Provides emergency escape hatch

### Priority 2 (High)
- **Add UI reset button** - User-friendly recovery
- **Log lock lifetime** - Monitor for stuck sessions

### Priority 3 (Medium)
- **Session store cleanup** - Periodic cleanup of old sessions
- **Health check endpoint** - Monitor setup lock status

---

## Related Files

- `/src/routes/setup.js` - Main setup wizard routes (lock implementation)
- `/docs/SESSION_LOCK_FIX_APPLIED.md` - Documentation of lock mechanism
- `/src/middleware/debounce.js` - Additional duplicate request protection
- Session store (varies by deployment - memory/redis/etc)

---

## Conclusion

The setup wizard lock mechanism is **working as designed** for preventing duplicate submissions, but lacks **timeout and recovery mechanisms** for edge cases (server crash, session save failure). The recommended fixes will add robustness without removing the duplicate protection.

**Status:** Analysis complete, ready for coder implementation.
