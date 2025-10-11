# Architecture Diagrams - Setup Flow Analysis

## Diagram 1: Current Broken Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SETUP WIZARD ARCHITECTURE                         │
│                         (Current - Broken)                               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Browser   │
│   Client    │
└──────┬──────┘
       │ 1. POST /setup/organization
       │    { name, type, email, logo }
       ▼
┌──────────────────────────────┐
│  Express Route Handler       │
│  /src/routes/setup.js:79     │
│                              │
│  ┌────────────────────────┐  │
│  │ req.session.setupData  │  │ ◄─── ❌ NOT SAVED YET
│  │ = { organization: {...}}│  │
│  └────────────────────────┘  │
│                              │
│  res.json({ success: true }) │  │ ◄─── ❌ SENT IMMEDIATELY
└──────────────┬───────────────┘
               │
               ├─────────────────────────┐
               │                         │
               ▼                         ▼
┌──────────────────────┐       ┌─────────────────────┐
│  Response to Client   │       │  setImmediate()     │
│                      │       │  Async Processing   │
│  { redirectUrl:      │       │                     │
│    '/setup/...' }    │       │  ❌ No req object   │
└──────┬───────────────┘       │  ❌ Can't save      │
       │                       │     session         │
       │                       └─────────┬───────────┘
       ▼                                 │
┌──────────────────┐                     │
│  Client Redirects│                     │
│  to Next Step    │                     ▼
└──────┬───────────┘           ┌──────────────────────┐
       │                       │ processSetupData()   │
       │                       │                      │
       │                       │ Updates:             │
       │ ❌ RACE CONDITION     │ setupData.status     │
       │                       │ = 'complete'         │
       │                       │                      │
       │                       │ ❌ NOT PERSISTED!    │
       │                       └──────────────────────┘
       │
       │ 2. GET /setup/status (polling)
       ▼
┌──────────────────────────────┐
│  Status Check Handler        │
│  /src/routes/setup.js:330    │
│                              │
│  status = setupData.status   │ ◄─── ❌ READS OLD VALUE
│           || 'processing'    │      (undefined)
│                              │
│  return { status: 'processing' }  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  Client Receives             │
│  { status: 'processing' }    │
│                              │
│  Shows spinner...            │
│  Polls again after 1s        │
└──────────────┬───────────────┘
               │
               │ ♾️  INFINITE LOOP
               │
               └─────────────────────┐
                                     ▼
                          ┌─────────────────────┐
                          │  HANG INDEFINITELY  │
                          │  Status never       │
                          │  updates to         │
                          │  'complete'         │
                          └─────────────────────┘
```

---

## Diagram 2: Session State Race Condition

```
TIME AXIS
═════════════════════════════════════════════════════════════════════

T0    │ Client: POST /setup/organization
      │
      ▼
T1    ├─► Server: Receive request
      │   req.session.setupData = { organization: {...} }
      │   ❌ Modify session in memory
      │
T2    ├─► Server: Send response
      │   res.json({ success: true, redirectUrl: '/setup/document-type' })
      │   ❌ Session NOT saved yet
      │
T3    ├─► Client: Receive response { redirectUrl: ... }
      │   Browser starts redirect
      │
T4    ├─► Client: GET /setup/document-type
      │   New request with session cookie
      │
T5    ├─► Server: Receive GET request
      │   ❌ Session may not be saved yet!
      │   ❌ Reads old/empty session
      │
      │   ┌─────────────────────────┐
      │   │   RACE CONDITION HERE   │
      │   │                         │
      │   │   Session save might    │
      │   │   complete before or    │
      │   │   after T5              │
      │   └─────────────────────────┘
      │
T6    ├─► Server: Session save completes (too late)
      │   setupData now persisted
      │   But request at T5 already used old data
      │
      ▼
      ❌ RESULT: Next route sees stale/empty session

═════════════════════════════════════════════════════════════════════

SESSION STORE STATES:

Memory Store (Express-Session default):
┌─────────────────────────────────────────┐
│  sessionStore = new MemoryStore()       │
│                                         │
│  T1: sessions[sessionId] = {...}        │  ← Modified
│  T2: (not persisted yet)                │  ← Response sent
│  T5: read sessions[sessionId]           │  ← May be old
│  T6: sessions[sessionId] = {...}        │  ← Finally saved
└─────────────────────────────────────────┘

Expected Behavior (with req.session.save callback):
┌─────────────────────────────────────────┐
│  T1: Modify session                     │
│  T2: req.session.save(() => {           │
│        res.json({...})  ← Wait          │
│      })                                 │
│  T3: Session saved ✓                    │
│  T4: Response sent ✓                    │
│  T5: Next request reads correct data ✓  │
└─────────────────────────────────────────┘
```

---

## Diagram 3: Database Schema Conflicts

```
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE SCHEMA CONFLICTS                           │
└─────────────────────────────────────────────────────────────────┘

ACTUAL SUPABASE SCHEMA:
┌─────────────────────────────────────┐
│  Table: organizations (plural)      │
├─────────────────────────────────────┤
│  id                 UUID PRIMARY KEY│
│  name               TEXT            │
│  slug               TEXT UNIQUE     │
│  organization_type  TEXT            │  ← Note: full name
│  state              TEXT            │
│  country            TEXT            │
│  contact_email      TEXT            │
│  logo_url           TEXT            │
│  is_configured      BOOLEAN         │  ← Missing in some queries
│  configured_at      TIMESTAMP       │
│  created_at         TIMESTAMP       │
│  updated_at         TIMESTAMP       │
└─────────────────────────────────────┘

❌ CONFLICTING QUERIES:

Location: server.js:84
┌─────────────────────────────────────┐
│  await supabase                     │
│    .from('organizations')  ✓        │
│    .select('id')          ✓        │
│    .limit(1)              ✓        │
└─────────────────────────────────────┘

Location: setup-guard.middleware.js:15-16
┌─────────────────────────────────────┐
│  await db.query(                    │
│    'SELECT COUNT(*) FROM            │
│     organization  ← ❌ WRONG (singular)
│     WHERE setup_completed = true'   │
│           ^^^^ ❌ COLUMN DOESN'T EXIST
│  )                                  │
└─────────────────────────────────────┘

Location: setupService.js:18-32
┌─────────────────────────────────────┐
│  await supabase                     │
│    .from('organizations')  ✓        │
│    .insert({                        │
│      name: ...,                     │
│      org_type: ...  ← ❌ WRONG      │
│                        (should be    │
│                        organization_type)
│      settings: {...}  ← ❌ WRONG    │
│                        (column       │
│                        doesn't exist)│
│    })                               │
└─────────────────────────────────────┘

IMPACT:
┌───────────────────────────────────────────────┐
│  Query Failures:                              │
│  ├─ Table not found (organization vs plural)  │
│  ├─ Column not found (setup_completed)        │
│  ├─ Column not found (org_type, settings)     │
│  └─ Silent failures (try-catch swallows)      │
│                                               │
│  Middleware Impact:                           │
│  ├─ setup-guard always fails                  │
│  ├─ Redirects to /setup even when configured  │
│  └─ Infinite setup loop                       │
└───────────────────────────────────────────────┘
```

---

## Diagram 4: Async Processing Anti-Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│           ASYNC PROCESSING ANTI-PATTERN FLOW                    │
└─────────────────────────────────────────────────────────────────┘

REQUEST HANDLER THREAD:
════════════════════════════════════════════════════════════════════

  POST /setup/import
       │
       ▼
  ┌─────────────────────────────────────┐
  │  Store import data in session       │
  │  req.session.setupData.import = {...}│
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  Queue async work with setImmediate │
  │                                     │
  │  setImmediate(() => {               │
  │    processSetupData(                │
  │      req.session.setupData, ← ❌    │
  │      req.supabase          ← ❌    │
  │    ).then(() => {                   │
  │      req.session.setupData.status   │
  │        = 'complete';  ← ❌ NO SAVE  │
  │    });                              │
  │  });                                │
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  Send response IMMEDIATELY          │
  │  res.json({ redirectUrl: ... })     │
  │                                     │
  │  ❌ Handler exits                   │
  │  ❌ req object becomes invalid      │
  │  ❌ Session not saved               │
  └─────────────────────────────────────┘

EVENT LOOP (setImmediate queue):
════════════════════════════════════════════════════════════════════

  [After handler exits]
       │
       ▼
  ┌─────────────────────────────────────┐
  │  setImmediate callback executes     │
  │                                     │
  │  const setupData = req.session      │
  │                    .setupData       │
  │                                     │
  │  ❌ req object may be stale         │
  │  ❌ req.session may be disconnected │
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  processSetupData(setupData, ...)   │
  │                                     │
  │  - Delay 1s                         │
  │  - Update setupData.status          │
  │  - Push to completedSteps           │
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  .then(() => {                      │
  │    setupData.status = 'complete';   │
  │                                     │
  │    ❌ Local variable update only    │
  │    ❌ req.session no longer valid   │
  │    ❌ No way to trigger save        │
  │  })                                 │
  └─────────────────────────────────────┘

CLIENT POLLING THREAD:
════════════════════════════════════════════════════════════════════

  Every 1 second:
       │
       ▼
  ┌─────────────────────────────────────┐
  │  GET /setup/status                  │
  │                                     │
  │  Read req.session.setupData.status  │
  │                                     │
  │  ❌ Reads from saved session        │
  │  ❌ setImmediate updates not saved  │
  │  ❌ Always returns 'processing'     │
  └─────────────┬───────────────────────┘
                │
                ▼
  ┌─────────────────────────────────────┐
  │  Client receives { status:          │
  │    'processing' }                   │
  │                                     │
  │  Shows spinner, polls again         │
  └─────────────────────────────────────┘
                │
                │ ♾️  INFINITE LOOP
                │
                └───────────────────────────┐
                                            ▼
                                ┌─────────────────────┐
                                │   HANG FOREVER      │
                                └─────────────────────┘

ROOT CAUSE:
═══════════════════════════════════════════════════════════════════

  ┌───────────────────────────────────────────────────┐
  │  setImmediate callback has no connection to       │
  │  the original request's session store.            │
  │                                                   │
  │  The callback modifies a local copy of            │
  │  setupData, but that copy is never persisted      │
  │  back to the session store.                       │
  │                                                   │
  │  Subsequent requests read from the session        │
  │  store, which was never updated.                  │
  └───────────────────────────────────────────────────┘
```

---

## Diagram 5: Correct Architecture (Proposed Fix)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CORRECTED SETUP ARCHITECTURE                          │
│                    (With Synchronous Processing)                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   Browser   │
│   Client    │
└──────┬──────┘
       │ 1. POST /setup/organization
       │
       ▼
┌──────────────────────────────────────────────────┐
│  Express Route Handler (Sequential)              │
│  /src/routes/setup.js                            │
│                                                  │
│  Step 1: Validate Input                          │
│  ├─ Check required fields                        │
│  ├─ Validate file upload                         │
│  └─ Return error if invalid                      │
│                                                  │
│  Step 2: Store in Session                        │
│  ├─ req.session.setupData = {...}                │
│  └─ ✓ Modified in memory                         │
│                                                  │
│  Step 3: Save Session (CRITICAL)                 │
│  ┌──────────────────────────────────────┐        │
│  │ await new Promise((resolve, reject) => {     │
│  │   req.session.save((err) => {                │
│  │     if (err) reject(err);                    │
│  │     else resolve();                          │
│  │   });                                        │
│  │ });                                          │
│  │                                              │
│  │ ✓ Session persisted before continuing       │
│  └──────────────────────────────────────┘        │
│                                                  │
│  Step 4: Send Response                           │
│  └─ res.json({ success: true, redirectUrl: ... })│
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Client Redirects│
              │  to Next Step    │
              └────────┬─────────┘
                       │
                       │ 2. GET /setup/document-type
                       ▼
              ┌─────────────────────────────┐
              │  Next Route Handler         │
              │                             │
              │  ✓ Reads saved session      │
              │  ✓ Has organization data    │
              │  ✓ Renders form correctly   │
              └─────────────────────────────┘

Alternative: Job Queue Approach
═════════════════════════════════════════════════════════════════════

┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ POST /setup/import
       ▼
┌──────────────────────────────┐
│  Express Handler             │
│                              │
│  1. Store in session & save  │
│  2. Create job in queue      │
│                              │
│  const job = await queue.add(│
│    'process-setup',          │
│    { sessionId, setupData }  │
│  );                          │
│                              │
│  3. Return job ID            │
│  res.json({ jobId: job.id }) │
└──────────────┬───────────────┘
               │
               ▼
       ┌───────────────┐         ┌─────────────────┐
       │  Redis Queue  │────────▶│  Worker Process │
       │  (Bull/BullMQ)│         │                 │
       └───────────────┘         │  1. Process job │
                                │  2. Update DB   │
                                │  3. Set progress│
                                └────────┬────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  Job Complete   │
                                │  Store result   │
                                └─────────────────┘
               ┌──────────────────────┘
               │
               ▼
       ┌─────────────────┐
       │  Client Polls   │
       │  GET /jobs/:id  │
       │                 │
       │  ✓ Real progress│
       │  ✓ Reliable     │
       │  ✓ Retryable    │
       └─────────────────┘
```

---

## Diagram 6: Transaction Boundary Design

```
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE TRANSACTION BOUNDARIES                     │
└─────────────────────────────────────────────────────────────────┘

CURRENT (No Transactions):
═══════════════════════════════════════════════════════════════════

  processSetupData()
       │
       ├─► INSERT organizations      [COMMIT]
       │   ✓ Committed immediately
       │
       ├─► INSERT workflow_templates [COMMIT]
       │   ✓ Committed immediately
       │
       ├─► INSERT workflow_stages    [COMMIT]
       │   ❌ FAILS
       │
       └─► ❌ Partial state:
           - Organization exists
           - Template exists
           - Stages missing
           - Inconsistent!

PROPOSED (With Transactions via RPC):
═══════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────┐
  │  Supabase RPC: setup_organization_transaction       │
  │                                                     │
  │  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;    │
  │                                                     │
  │  -- Step 1: Create organization                     │
  │  INSERT INTO organizations (...) RETURNING id;      │
  │                                                     │
  │  -- Step 2: Create workflow template                │
  │  INSERT INTO workflow_templates (org_id, ...)       │
  │    RETURNING id;                                    │
  │                                                     │
  │  -- Step 3: Create workflow stages                  │
  │  INSERT INTO workflow_stages (template_id, ...)     │
  │    VALUES (...);                                    │
  │                                                     │
  │  -- All or nothing                                  │
  │  COMMIT;                                            │
  │                                                     │
  │  EXCEPTION                                          │
  │    WHEN OTHERS THEN                                 │
  │      ROLLBACK;                                      │
  │      RAISE;                                         │
  │  END;                                               │
  └─────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Success:        │
                  │  All inserted ✓  │
                  │                  │
                  │  OR              │
                  │                  │
                  │  Failure:        │
                  │  All rolled back │
                  │  Nothing inserted│
                  └──────────────────┘

SAGA PATTERN (For Distributed Rollback):
═══════════════════════════════════════════════════════════════════

  ┌────────────────────────────────────────────────────┐
  │  SetupSaga                                         │
  │                                                    │
  │  Steps: [                                          │
  │    {                                               │
  │      execute: createOrganization,                 │
  │      compensate: deleteOrganization                │
  │    },                                              │
  │    {                                               │
  │      execute: createWorkflow,                      │
  │      compensate: deleteWorkflow                    │
  │    },                                              │
  │    {                                               │
  │      execute: importDocument,                      │
  │      compensate: deleteDocument                    │
  │    }                                               │
  │  ]                                                 │
  └────────────────────────────────────────────────────┘
                            │
                            ▼
           ┌────────────────────────────────┐
           │  Execution Flow:               │
           │                                │
           │  1. createOrganization() ✓     │
           │  2. createWorkflow() ✓         │
           │  3. importDocument() ❌ FAIL   │
           │                                │
           │  Compensation (Reverse Order): │
           │  3. (skip - never executed)    │
           │  2. deleteWorkflow() ✓         │
           │  1. deleteOrganization() ✓     │
           │                                │
           │  Result: Clean rollback ✓      │
           └────────────────────────────────┘
```

---

## Diagram 7: State Machine Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    SETUP STATE MACHINE                           │
└─────────────────────────────────────────────────────────────────┘

STATES:
═══════════════════════════════════════════════════════════════════

         [START]
            │
            ▼
    ┌───────────────┐
    │     IDLE      │  ← Initial state
    └───────┬───────┘
            │ startSetup()
            ▼
    ┌───────────────┐
    │ COLLECTING_ORG│  ← Show organization form
    └───────┬───────┘
            │ submitOrganization()
            ▼
    ┌───────────────┐
    │  SAVING_ORG   │  ← Save to database
    └───────┬───────┘
            │ success
            ▼
    ┌───────────────┐
    │ COLLECTING_DOC│  ← Show document form
    └───────┬───────┘
            │ submitDocument()
            ▼
    ┌───────────────┐
    │  SAVING_DOC   │  ← Save to database
    └───────┬───────┘
            │ success
            ▼
    ┌───────────────┐
    │COLLECTING_WF  │  ← Show workflow form
    └───────┬───────┘
            │ submitWorkflow()
            ▼
    ┌───────────────┐
    │  SAVING_WF    │  ← Save to database
    └───────┬───────┘
            │ success
            ▼
    ┌───────────────┐
    │  IMPORTING    │  ← Import document
    └───────┬───────┘
            │ success
            ▼
    ┌───────────────┐
    │  FINALIZING   │  ← Final setup
    └───────┬───────┘
            │ success
            ▼
    ┌───────────────┐
    │   COMPLETED   │  ← Terminal success state
    └───────────────┘

ERROR STATES:
═══════════════════════════════════════════════════════════════════

    Any State
        │ onError()
        ▼
    ┌───────────────┐
    │     ERROR     │  ← Error state
    └───────┬───────┘
            │
            ├─► retry()    → Back to previous state
            ├─► rollback() → ROLLING_BACK state
            └─► abort()    → ABORTED state

    ┌───────────────┐
    │ ROLLING_BACK  │  ← Compensating transactions
    └───────┬───────┘
            │ success
            ▼
    ┌───────────────┐
    │    ABORTED    │  ← Terminal failure state
    └───────────────┘

TIMEOUT DETECTION:
═══════════════════════════════════════════════════════════════════

    Any State (except IDLE, COMPLETED, ABORTED)
        │ timeout (60s)
        ▼
    ┌───────────────┐
    │   TIMEOUT     │  ← Timeout state
    └───────┬───────┘
            │
            ├─► retry()    → Back to previous state
            └─► abort()    → ABORTED state

STATE TRANSITION VALIDATION:
═══════════════════════════════════════════════════════════════════

    Valid Transitions:
    ┌─────────────────┬─────────────────────────────────┐
    │  From State     │  To State (Allowed)             │
    ├─────────────────┼─────────────────────────────────┤
    │  IDLE           │  COLLECTING_ORG                 │
    │  COLLECTING_ORG │  SAVING_ORG, ERROR              │
    │  SAVING_ORG     │  COLLECTING_DOC, ERROR,         │
    │                 │  ROLLING_BACK                   │
    │  COLLECTING_DOC │  SAVING_DOC, ERROR              │
    │  SAVING_DOC     │  COLLECTING_WF, ERROR,          │
    │                 │  ROLLING_BACK                   │
    │  ...            │  ...                            │
    │  FINALIZING     │  COMPLETED, ERROR,              │
    │                 │  ROLLING_BACK                   │
    │  ERROR          │  (previous state), ROLLING_BACK,│
    │                 │  ABORTED, TIMEOUT               │
    │  ROLLING_BACK   │  ABORTED, ERROR                 │
    │  TIMEOUT        │  (previous state), ABORTED      │
    │  COMPLETED      │  (terminal - none)              │
    │  ABORTED        │  IDLE (restart)                 │
    └─────────────────┴─────────────────────────────────┘

    Invalid Transitions (Blocked):
    ❌ COLLECTING_ORG → COLLECTING_WF (skips COLLECTING_DOC)
    ❌ SAVING_ORG → COMPLETED (skips intermediate steps)
    ❌ COMPLETED → ERROR (terminal state)
    ❌ ABORTED → SAVING_ORG (must restart from IDLE)
```

---

## Diagram 8: Distributed Lock Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│              DISTRIBUTED LOCK FOR SETUP                          │
└─────────────────────────────────────────────────────────────────┘

WITHOUT LOCK (Current - Broken):
═══════════════════════════════════════════════════════════════════

User A                          User B
  │                               │
  │ POST /setup/organization      │ POST /setup/organization
  ├─► Check if configured         ├─► Check if configured
  │   SELECT * FROM orgs          │   SELECT * FROM orgs
  │   → empty ✓                   │   → empty ✓
  │                               │
  ├─► INSERT organization         ├─► INSERT organization
  │   id: uuid-A                  │   id: uuid-B
  │   ✓ Success                   │   ✓ Success
  │                               │
  ❌ RESULT: Two organizations created!

WITH DISTRIBUTED LOCK (Proposed):
═══════════════════════════════════════════════════════════════════

User A                          User B
  │                               │
  │ POST /setup/organization      │ POST /setup/organization
  │                               │
  ├─► Try acquire lock            ├─► Try acquire lock
  │   "setup:global" (30s TTL)    │   "setup:global" (30s TTL)
  │                               │
  ├─► ✓ Lock acquired             ├─► ❌ Lock denied (held by A)
  │   Redis: SET NX EX            │   Redis: returns null
  │                               │
  │                               ├─► Return error:
  │                               │   "Setup already in progress"
  │                               │
  ├─► Check if configured         │
  │   SELECT * FROM orgs          │
  │   → empty ✓                   │
  │                               │
  ├─► INSERT organization         │
  │   id: uuid-A                  │
  │   ✓ Success                   │
  │                               │
  ├─► Release lock                │
  │   Redis: DEL "setup:global"   │
  │   ✓ Released                  │
  │                               │
  ✓ RESULT: Only one organization │

LOCK IMPLEMENTATION:
═══════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────┐
  │  class DistributedLock {                            │
  │    constructor(redis, key, ttl = 30000) {           │
  │      this.redis = redis;                            │
  │      this.key = `lock:${key}`;                      │
  │      this.ttl = ttl;                                │
  │      this.lockId = uuidv4();                        │
  │    }                                                │
  │                                                     │
  │    async acquire() {                                │
  │      const result = await this.redis.set(           │
  │        this.key,                                    │
  │        this.lockId,                                 │
  │        'PX', this.ttl,  // Expire in ms             │
  │        'NX'              // Set if not exists       │
  │      );                                             │
  │      return result === 'OK';                        │
  │    }                                                │
  │                                                     │
  │    async release() {                                │
  │      // Lua script for atomic check + delete        │
  │      const script = `                               │
  │        if redis.call("get", KEYS[1]) == ARGV[1]     │
  │        then                                         │
  │          return redis.call("del", KEYS[1])          │
  │        else                                         │
  │          return 0                                   │
  │        end                                          │
  │      `;                                             │
  │      await this.redis.eval(script, 1,               │
  │        this.key, this.lockId);                      │
  │    }                                                │
  │  }                                                  │
  │                                                     │
  │  // Usage:                                          │
  │  const lock = new DistributedLock(redis,            │
  │    'setup:global', 30000);                          │
  │                                                     │
  │  if (await lock.acquire()) {                        │
  │    try {                                            │
  │      await processSetup();                          │
  │    } finally {                                      │
  │      await lock.release();                          │
  │    }                                                │
  │  } else {                                           │
  │    throw new Error('Setup already in progress');    │
  │  }                                                  │
  └─────────────────────────────────────────────────────┘

LOCK TIMEOUT HANDLING:
═══════════════════════════════════════════════════════════════════

  Time: T0
  ├─► User A acquires lock (TTL: 30s)
  │
  Time: T0 + 25s
  ├─► User A still processing
  │   Lock still valid
  │
  Time: T0 + 30s
  ├─► Lock expires automatically (Redis TTL)
  │   ✓ Prevents deadlock
  │
  Time: T0 + 31s
  ├─► User B can now acquire lock
  │   ✓ System self-heals
  │
  Time: T0 + 35s
  ├─► User A tries to release lock
  │   ❌ Lock ID doesn't match (already expired)
  │   ✓ Safe - doesn't release User B's lock
```

This completes the architecture diagrams showing all critical issues and proposed solutions.
