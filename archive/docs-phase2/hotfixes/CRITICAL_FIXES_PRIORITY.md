# Critical Fixes Priority List - Setup Hang Issue

**Generated:** 2025-10-07
**Issue:** Organization setup form hangs indefinitely
**Root Cause:** Race condition in session persistence + async processing anti-pattern

---

## 🔴 CRITICAL - Fix Immediately (P0)

### 1. Add Session Save Callback to Organization Route
**File:** `/src/routes/setup.js:79-112`
**Line:** 79-112
**Impact:** HIGH - Prevents all setup hangs
**Effort:** 5 minutes

**Current Code:**
```javascript
router.post('/organization', upload.single('logo'), async (req, res) => {
    try {
        req.session.setupData = { ... };
        req.session.setupData.completedSteps = ['organization'];

        // ❌ Response sent before session saved
        res.json({ success: true, redirectUrl: '/setup/document-type' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**Fixed Code:**
```javascript
router.post('/organization', upload.single('logo'), async (req, res) => {
    try {
        req.session.setupData = { ... };
        req.session.setupData.completedSteps = ['organization'];

        // ✅ Wait for session save before responding
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save session'
                });
            }
            res.json({ success: true, redirectUrl: '/setup/document-type' });
        });
    } catch (error) {
        console.error('Organization setup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
```

---

### 2. Add Session Save Callback to Document Type Route
**File:** `/src/routes/setup.js:129-161`
**Line:** 129-161
**Impact:** HIGH
**Effort:** 5 minutes

**Fixed Code:**
```javascript
router.post('/document-type', express.json(), async (req, res) => {
    try {
        const documentTypeData = { ... };

        req.session.setupData = req.session.setupData || {};
        req.session.setupData.documentType = documentTypeData;
        req.session.setupData.completedSteps =
            req.session.setupData.completedSteps || [];
        if (!req.session.setupData.completedSteps.includes('document')) {
            req.session.setupData.completedSteps.push('document');
        }

        // ✅ Wait for session save
        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save session'
                });
            }
            res.json({ success: true, redirectUrl: '/setup/workflow' });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

### 3. Add Session Save Callback to Workflow Route
**File:** `/src/routes/setup.js:180-221`
**Line:** 180-221
**Impact:** HIGH
**Effort:** 5 minutes

**Fixed Code:**
```javascript
router.post('/workflow', express.json(), async (req, res) => {
    try {
        const workflowData = { ... };

        req.session.setupData = req.session.setupData || {};
        req.session.setupData.workflow = workflowData;
        req.session.setupData.completedSteps =
            req.session.setupData.completedSteps || [];
        if (!req.session.setupData.completedSteps.includes('workflow')) {
            req.session.setupData.completedSteps.push('workflow');
        }

        // ✅ Wait for session save
        req.session.save((err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save session'
                });
            }
            res.json({ success: true, redirectUrl: '/setup/import' });
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

### 4. Remove Async Processing Anti-Pattern from Import Route
**File:** `/src/routes/setup.js:240-313`
**Line:** 286-304
**Impact:** CRITICAL - Main cause of hang
**Effort:** 15 minutes

**Current Code:**
```javascript
router.post('/import', upload.single('document'), async (req, res) => {
    try {
        // ... store import data ...
        req.session.setupData.import = importData;

        // ❌ BROKEN: setImmediate loses session context
        setImmediate(() => {
            processSetupData(req.session.setupData, req.supabase)
                .then(() => {
                    req.session.setupData.status = 'complete';
                })
                .catch(err => {
                    req.session.setupData.status = 'error';
                });
        });

        res.json({ success: true, redirectUrl: '/setup/processing' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

**Fixed Code:**
```javascript
router.post('/import', upload.single('document'), async (req, res) => {
    try {
        // ... store import data ...
        req.session.setupData.import = importData;

        // ✅ OPTION 1: Process synchronously
        try {
            await processSetupData(req.session.setupData, req.supabase);
            req.session.setupData.status = 'complete';
        } catch (err) {
            console.error('Setup processing error:', err);
            req.session.setupData.status = 'error';
            req.session.setupData.error = err.message;
        }

        // ✅ Save session with new status
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Redirect based on status
        if (req.session.setupData.status === 'complete') {
            res.json({ success: true, redirectUrl: '/setup/success' });
        } else {
            res.json({
                success: false,
                error: req.session.setupData.error,
                redirectUrl: '/setup/processing' // Show error screen
            });
        }
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

### 5. Fix Database Schema References
**File:** `/src/setup/middleware/setup-guard.middleware.js:15-16`
**Line:** 15-16
**Impact:** HIGH - Breaks setup detection
**Effort:** 2 minutes

**Current Code:**
```javascript
const result = await db.query(
    'SELECT COUNT(*) as count FROM organization WHERE setup_completed = true'
);
```

**Fixed Code:**
```javascript
// ✅ Use correct table name and column
const result = await db.query(
    'SELECT COUNT(*) as count FROM organizations WHERE is_configured = true'
);
```

---

## 🟡 HIGH PRIORITY - Fix Within 24 Hours (P1)

### 6. Add Client-Side Timeout Protection
**File:** `/public/js/setup-wizard.js`
**Impact:** MEDIUM - Prevents infinite spinner
**Effort:** 10 minutes

**Add to setup-wizard.js:**
```javascript
// ✅ Add timeout protection to polling
initProcessingPolling() {
    const MAX_POLL_TIME = 120000; // 2 minutes
    const MAX_POLL_ATTEMPTS = 60; // 60 attempts at 1s intervals
    const startTime = Date.now();
    let attemptCount = 0;

    const pollInterval = setInterval(async () => {
        attemptCount++;
        const elapsedTime = Date.now() - startTime;

        // Check timeout
        if (elapsedTime > MAX_POLL_TIME || attemptCount > MAX_POLL_ATTEMPTS) {
            clearInterval(pollInterval);
            this.showTimeoutError();
            return;
        }

        try {
            const response = await fetch('/setup/status');
            const data = await response.json();

            if (data.status === 'complete') {
                clearInterval(pollInterval);
                window.location.href = '/setup/success';
            } else if (data.status === 'error') {
                clearInterval(pollInterval);
                this.showError(data.error);
            }

            // Update progress bar
            this.updateProgress(data.progressPercentage);
        } catch (error) {
            console.error('Polling error:', error);
            clearInterval(pollInterval);
            this.showError('Connection lost. Please refresh the page.');
        }
    }, 1000);
}

showTimeoutError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `
        <div class="alert alert-danger">
            <h4>Setup Timeout</h4>
            <p>The setup process is taking longer than expected.</p>
            <button class="btn btn-primary" onclick="location.reload()">
                Refresh and Try Again
            </button>
            <a href="/setup" class="btn btn-secondary">
                Restart Setup
            </a>
        </div>
    `;
    errorDiv.style.display = 'block';
}

showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `
        <div class="alert alert-danger">
            <h4>Setup Error</h4>
            <p>${message || 'An error occurred during setup.'}</p>
            <button class="btn btn-primary" onclick="location.reload()">
                Try Again
            </button>
        </div>
    `;
    errorDiv.style.display = 'block';
}
```

---

### 7. Add Server-Side Timeout to processSetupData
**File:** `/src/routes/setup.js:405-524`
**Line:** 405-524
**Impact:** MEDIUM
**Effort:** 10 minutes

**Add timeout wrapper:**
```javascript
async function processSetupDataWithTimeout(setupData, supabase, timeoutMs = 60000) {
    console.log('[SETUP] Starting setup processing with timeout:', timeoutMs);

    return Promise.race([
        processSetupData(setupData, supabase),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Setup processing timeout')), timeoutMs)
        )
    ]);
}

// Update import route to use timeout version
router.post('/import', async (req, res) => {
    try {
        await processSetupDataWithTimeout(
            req.session.setupData,
            req.supabase,
            60000 // 60 second timeout
        );
        // ...
    } catch (error) {
        if (error.message === 'Setup processing timeout') {
            req.session.setupData.status = 'timeout';
            req.session.setupData.error = 'Setup took too long to complete';
        }
        // ...
    }
});
```

---

### 8. Fix setupService.js Schema Inconsistencies
**File:** `/src/services/setupService.js:18-32`
**Line:** 18-32
**Impact:** MEDIUM
**Effort:** 5 minutes

**Current Code:**
```javascript
const { data, error } = await supabase
    .from('organizations')
    .insert({
        name: organizationData.name,
        org_type: organizationData.type,  // ❌ Wrong column name
        settings: { ... }                  // ❌ Wrong column name
    });
```

**Fixed Code:**
```javascript
const { data, error } = await supabase
    .from('organizations')
    .insert({
        name: organizationData.name,
        organization_type: organizationData.type,  // ✅ Correct
        // Note: settings might be hierarchy_config or removed entirely
        // Check actual schema
    });
```

---

## 🟢 MEDIUM PRIORITY - Fix Within 1 Week (P2)

### 9. Implement Redis Session Store
**File:** `/server.js:22-31`
**Line:** 22-31
**Impact:** MEDIUM - Production readiness
**Effort:** 30 minutes

**Install dependencies:**
```bash
npm install connect-redis redis
```

**Update server.js:**
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Initialize Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.connect().catch(console.error);

redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
});

// Session middleware with Redis
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
```

---

### 10. Add Distributed Lock for Setup
**File:** Create new file `/src/utils/distributed-lock.js`
**Impact:** MEDIUM - Prevents concurrent setup
**Effort:** 45 minutes

**Create distributed-lock.js:**
```javascript
const { v4: uuidv4 } = require('uuid');

class DistributedLock {
    constructor(redisClient, key, ttl = 30000) {
        this.redis = redisClient;
        this.key = `lock:${key}`;
        this.ttl = ttl;
        this.lockId = uuidv4();
        this.acquired = false;
    }

    async acquire() {
        try {
            const result = await this.redis.set(
                this.key,
                this.lockId,
                {
                    PX: this.ttl,  // Expire in milliseconds
                    NX: true        // Set if not exists
                }
            );

            this.acquired = result === 'OK';
            return this.acquired;
        } catch (error) {
            console.error('Lock acquire error:', error);
            return false;
        }
    }

    async release() {
        if (!this.acquired) return;

        // Lua script for atomic check + delete
        const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        `;

        try {
            await this.redis.eval(script, {
                keys: [this.key],
                arguments: [this.lockId]
            });
            this.acquired = false;
        } catch (error) {
            console.error('Lock release error:', error);
        }
    }
}

module.exports = DistributedLock;
```

**Use in setup routes:**
```javascript
const DistributedLock = require('../utils/distributed-lock');

router.post('/organization', async (req, res) => {
    const lock = new DistributedLock(
        req.app.locals.redisClient,
        'setup:global',
        30000
    );

    if (!await lock.acquire()) {
        return res.status(409).json({
            success: false,
            error: 'Setup is already in progress. Please wait or contact support.'
        });
    }

    try {
        // ... setup logic ...
    } finally {
        await lock.release();
    }
});
```

---

## 🔵 LOW PRIORITY - Future Improvements (P3)

### 11. Implement Job Queue for Async Processing
**Impact:** LOW - Better architecture
**Effort:** 4 hours

Use Bull or BullMQ for reliable background processing:

```bash
npm install bull
```

```javascript
const Queue = require('bull');
const setupQueue = new Queue('setup-processing', process.env.REDIS_URL);

// Producer
router.post('/import', async (req, res) => {
    const job = await setupQueue.add({
        sessionId: req.sessionID,
        setupData: req.session.setupData
    });

    res.json({
        success: true,
        jobId: job.id,
        redirectUrl: '/setup/processing'
    });
});

// Consumer (separate file)
setupQueue.process(async (job) => {
    const { setupData } = job.data;
    await processSetupData(setupData);
    await job.progress(100);
});
```

---

### 12. Implement Saga Pattern for Rollback
**Impact:** LOW - Better error recovery
**Effort:** 6 hours

See full implementation in `/docs/ARCHITECTURE_ANALYSIS_SETUP_HANG.md` section 9.3.

---

### 13. Add State Machine Implementation
**Impact:** LOW - Better state management
**Effort:** 8 hours

See full design in `/docs/ARCHITECTURE_DIAGRAMS.md` Diagram 7.

---

## Testing Checklist

After applying P0 and P1 fixes, test:

- [ ] Submit organization form → should redirect immediately
- [ ] Fill document type form → should save and redirect
- [ ] Configure workflow → should save and redirect
- [ ] Import document → should process without hanging
- [ ] Refresh during setup → should resume from correct step
- [ ] Two users start setup → second should get error
- [ ] Setup timeout after 2 minutes → should show error
- [ ] Database error during setup → should rollback cleanly
- [ ] Server restart during setup → should resume (if Redis used)

---

## Deployment Plan

### Phase 1: Critical Fixes (Deploy Immediately)
1. Apply fixes #1-5 (session save callbacks + schema fixes)
2. Test in development
3. Deploy to staging
4. Test end-to-end setup flow
5. Deploy to production

### Phase 2: High Priority (Deploy Within 24h)
1. Apply fixes #6-8 (timeout protection)
2. Test timeout scenarios
3. Deploy to production

### Phase 3: Medium Priority (Deploy Within 1 Week)
1. Set up Redis infrastructure
2. Apply fixes #9-10 (Redis session + distributed lock)
3. Test with load testing tool
4. Deploy to production

### Phase 4: Future Improvements (As Needed)
1. Implement job queue (#11)
2. Implement saga pattern (#12)
3. Implement state machine (#13)

---

## Monitoring and Alerting

After fixes, add monitoring:

```javascript
// Log all session saves
req.session.save((err) => {
    if (err) {
        console.error('[MONITOR] Session save failed:', {
            sessionId: req.sessionID,
            route: req.path,
            error: err.message
        });
        // Send to monitoring service (e.g., Sentry)
    }
});

// Track setup completion time
const setupStartTime = Date.now();
// ... setup process ...
const setupDuration = Date.now() - setupStartTime;
console.log('[MONITOR] Setup completed:', {
    duration: setupDuration,
    organizationId: data.id
});
```

Set up alerts for:
- Setup duration > 30 seconds
- Session save failures > 5% of requests
- Setup errors > 10% of attempts

---

## Rollback Plan

If deployment causes issues:

1. Revert to previous version
2. Restore database backup (if schema changed)
3. Clear Redis session store
4. Notify users to restart setup

Keep previous version deployable for 48 hours.
