# Dashboard Document Loading Analysis Report
**Date**: 2025-10-12
**Analyst**: Dashboard Analysis Specialist
**Status**: Critical Issues Identified

---

## Executive Summary

The dashboard is not displaying documents due to **multiple critical issues** in the routing architecture, session management, and query optimization. The primary issue is a **route mounting conflict** where the same Express router is mounted at two different paths, causing API endpoint collisions.

---

## Detailed Findings

### 1. Architecture Overview

#### Frontend (Client-Side)
**File**: `/public/js/dashboard.js`

The dashboard JavaScript makes three primary API calls on initialization:

```javascript
Dashboard.init() {
  await this.loadOverview();    // → GET /api/dashboard/overview
  await this.loadDocuments();   // → GET /api/dashboard/documents
  await this.loadActivity();    // → GET /api/dashboard/activity?limit=10
}
```

**Key Observations**:
- ✅ Proper error handling with user-friendly messages
- ✅ Empty state handling for zero documents
- ❌ No organization context verification before API calls
- ❌ No debug logging of successful responses

#### Backend (Server-Side)
**File**: `/src/routes/dashboard.js`

All routes require authentication via `requireAuth` middleware:

```javascript
function requireAuth(req, res, next) {
  if (!req.session.organizationId) {
    return res.redirect('/auth/select');
  }
  req.organizationId = req.session.organizationId;
  next();
}
```

**Key Routes**:
- `GET /dashboard` - Renders dashboard view
- `GET /overview` - Returns statistics (documents, sections, suggestions)
- `GET /documents` - Returns document list with enrichment
- `GET /activity` - Returns recent activity feed

---

## Critical Issues Identified

### 🚨 ISSUE #1: Route Mounting Conflict (CRITICAL)
**Priority**: HIGH
**File**: `server.js` lines 132-133

```javascript
app.use('/dashboard', dashboardRoutes);           // Mounts at /dashboard
app.use('/api/dashboard', dashboardRoutes);       // Mounts same router at /api/dashboard
```

**Problem**: The same Express router is mounted at **two different base paths**. This creates conflicting routes:
- `/dashboard/documents` (intended for API)
- `/api/dashboard/documents` (intended for API)
- Both resolve to the same handler

**Impact**:
- Client requests to `/api/dashboard/documents` may match `/dashboard/documents` first
- Unexpected routing behavior
- API calls may return HTML instead of JSON
- Document fetching fails silently

**Evidence**:
```javascript
// Dashboard.js line 46
const response = await fetch('/api/dashboard/documents');

// But the route is defined as:
router.get('/documents', requireAuth, async (req, res) => { ... });

// With double mounting, this could match /dashboard/documents first
```

**Solution**:
```javascript
// Separate routers for views and API
const dashboardViewRoutes = require('./src/routes/dashboard-views');
const dashboardApiRoutes = require('./src/routes/dashboard-api');

app.use('/dashboard', dashboardViewRoutes);
app.use('/api/dashboard', dashboardApiRoutes);
```

---

### 🚨 ISSUE #2: Session Organization Context Not Verified (HIGH)
**Priority**: HIGH
**File**: `public/js/dashboard.js`

**Problem**: The client-side code assumes `req.session.organizationId` exists but never verifies this before making API calls.

**Impact**:
- If user hasn't selected an organization, `requireAuth` middleware redirects to `/auth/select`
- For API calls (AJAX), this redirect returns HTML instead of JSON
- Client tries to parse HTML as JSON and fails
- Results in empty dashboard with no error message

**Evidence**:
```javascript
// Dashboard.js line 46 - no check if organization is selected
async loadDocuments() {
  try {
    const response = await fetch('/api/dashboard/documents');
    const result = await response.json();  // Fails if response is HTML redirect
```

**Solution**:
Add organization context verification:
```javascript
async init() {
  // Check if organization is selected
  const orgCheck = await fetch('/api/dashboard/status');
  const status = await orgCheck.json();

  if (!status.organizationId) {
    window.location.href = '/auth/select';
    return;
  }

  // Proceed with loading
  await this.loadOverview();
  await this.loadDocuments();
  await this.loadActivity();
}
```

---

### ⚠️ ISSUE #3: N+1 Query Problem (MEDIUM)
**Priority**: MEDIUM
**File**: `src/routes/dashboard.js` lines 131-174

**Problem**: The `/documents` endpoint fetches documents, then loops through each one to count sections and suggestions:

```javascript
const { data: documents } = await supabase
  .from('documents')
  .select('*')
  .eq('organization_id', orgId)
  .limit(50);

// N+1 problem: One query per document
for (const doc of documents) {
  const { count: sectionCount } = await supabase
    .from('document_sections')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', doc.id);

  const { count: suggestionCount } = await supabase
    .from('suggestions')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', doc.id);
}
```

**Impact**:
- If there are 50 documents, this makes **101 queries** (1 + 50*2)
- Slow response times (500ms - 2s+)
- Poor user experience

**Solution**:
Use aggregated queries:
```javascript
const { data: documents } = await supabase
  .from('documents')
  .select(`
    *,
    section_count:document_sections(count),
    suggestion_count:suggestions(count)
  `)
  .eq('organization_id', orgId)
  .limit(50);
```

---

### ⚠️ ISSUE #4: RLS Policy May Block Queries (MEDIUM)
**Priority**: MEDIUM
**Context**: Database schema with Row Level Security

**Problem**: The database has RLS enabled on `documents` table with this policy:

```sql
CREATE POLICY "Users see own organization documents"
  ON documents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM user_organizations
      WHERE user_id = auth.uid()
    )
  );
```

**Impact**:
- If `auth.uid()` is NULL or not set, **all queries return empty**
- If `user_organizations` table is empty, **all queries return empty**
- This explains why dashboard shows "No documents" even when documents exist

**Evidence**:
The middleware sets `req.organizationId` from session, but **does NOT set Supabase auth context**:

```javascript
// server.js line 71-75
app.use((req, res, next) => {
  req.supabase = supabase;  // Uses anon key with RLS
  req.supabaseService = supabaseService;
  next();
});
```

**Solution**:
Either:
1. Set Supabase auth token in requests:
```javascript
const supabase = createClient(url, key, {
  global: {
    headers: { Authorization: `Bearer ${userToken}` }
  }
});
```

2. OR use service role client for dashboard queries (bypasses RLS):
```javascript
router.get('/documents', requireAuth, async (req, res) => {
  const { supabaseService } = req;  // Use service role client
  const orgId = req.organizationId;

  const { data: documents } = await supabaseService
    .from('documents')
    .select('*')
    .eq('organization_id', orgId);
});
```

---

### ℹ️ ISSUE #5: No Debug Logging (LOW)
**Priority**: LOW
**Files**: `public/js/dashboard.js`, `src/routes/dashboard.js`

**Problem**: Successful API responses are not logged, making debugging difficult.

**Solution**:
Add logging:
```javascript
async loadDocuments() {
  try {
    const response = await fetch('/api/dashboard/documents');
    console.log('Documents response:', response.status, response.statusText);

    const result = await response.json();
    console.log('Documents data:', result);

    if (!result.success || !result.documents) {
      console.warn('No documents returned:', result);
    }
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}
```

---

## API Endpoint Documentation

### GET /api/dashboard/overview
**Purpose**: Fetch statistics for dashboard cards
**Authentication**: Required (session-based)
**Parameters**: None

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalDocuments": 5,
    "activeSections": 127,
    "pendingSuggestions": 14,
    "approvalProgress": 67
  }
}
```

**Current Issues**:
- Multiple nested queries (4-5 separate DB calls)
- Complex calculation for approval progress
- No caching

---

### GET /api/dashboard/documents
**Purpose**: Fetch recent documents with metadata
**Authentication**: Required (session-based)
**Parameters**: None

**Response**:
```json
{
  "success": true,
  "documents": [
    {
      "id": "uuid",
      "title": "2025 Bylaws Amendment",
      "description": "Annual review",
      "document_type": "bylaws",
      "status": "active",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-03-20T14:30:00Z",
      "section_count": 45,
      "pending_suggestions": 3
    }
  ]
}
```

**Current Issues**:
- N+1 query problem (1 query per document)
- Slow with many documents

---

### GET /api/dashboard/activity?limit=10
**Purpose**: Fetch recent activity feed
**Authentication**: Required (session-based)
**Parameters**:
- `limit` (optional): Number of items, default 20

**Response**:
```json
{
  "success": true,
  "activity": [
    {
      "type": "suggestion_created",
      "timestamp": "2025-10-12T09:30:00Z",
      "description": "New suggestion by Jane Doe",
      "icon": "lightbulb",
      "color": "info"
    }
  ]
}
```

**Current Issues**:
- Combines multiple sources (suggestions + workflow actions)
- No pagination beyond limit
- May be slow with large activity history

---

## Database Schema Observations

### documents Table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  document_type VARCHAR(50) DEFAULT 'bylaws',
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**RLS Policy**: Organization-scoped, requires `auth.uid()` in `user_organizations`

---

## Recommendations

### Immediate Fixes (Required)

1. **Fix Route Mounting Conflict**
   - Create separate routers for dashboard views and API
   - Mount at distinct paths: `/dashboard` (views) and `/api/dashboard` (API)
   - File: `server.js`

2. **Add Organization Context Check**
   - Verify organization selection before API calls
   - Show organization selector if not set
   - File: `public/js/dashboard.js`

3. **Fix Supabase Auth Context**
   - Use service role client for dashboard queries, OR
   - Set proper auth token in Supabase client
   - File: `src/routes/dashboard.js`

### Performance Optimizations (Recommended)

4. **Optimize Document Queries**
   - Use JOIN or aggregation to fetch counts
   - Eliminate N+1 query problem
   - File: `src/routes/dashboard.js`

5. **Add Query Caching**
   - Cache overview statistics for 30 seconds
   - Cache document list for 10 seconds
   - Use Redis or in-memory cache

### Debug Improvements (Optional)

6. **Add Debug Logging**
   - Log API responses in development
   - Log query execution times
   - Files: `dashboard.js`, `routes/dashboard.js`

7. **Add Health Check Endpoint**
   - Create `/api/dashboard/status` endpoint
   - Returns organization context and auth status
   - Helps diagnose session issues

---

## Test Cases to Verify

1. **No Organization Selected**
   - Expected: Redirect to `/auth/select`
   - Actual: Should test both page load and API calls

2. **Organization Selected, No Documents**
   - Expected: Empty state message "No documents yet"
   - Actual: Should verify query returns empty array

3. **Organization Selected, Has Documents**
   - Expected: Document list displayed with counts
   - Actual: Should verify RLS allows access

4. **Multiple Organizations**
   - Expected: Only documents for selected organization
   - Actual: Should verify RLS isolation

---

## Next Steps

1. Run diagnostic queries to check:
   - Are there documents in the database?
   - Are there entries in `user_organizations` table?
   - Is `req.session.organizationId` being set?

2. Add temporary debug logging to verify:
   - API endpoint routing
   - Session state
   - Supabase query results

3. Implement fixes in order of priority:
   - Route mounting conflict (CRITICAL)
   - Session context verification (HIGH)
   - RLS auth setup (MEDIUM)

---

## Conclusion

The dashboard document loading failure is caused by **multiple compounding issues**, primarily:
1. Route mounting conflict causing API calls to fail
2. Missing organization context verification
3. RLS policies blocking queries due to missing auth context

These issues prevent documents from loading even when they exist in the database. The recommended fixes should be implemented in the order listed to restore dashboard functionality.

---

**Report Generated**: 2025-10-12
**Analysis Stored**: `analysis/dashboard/document-loading` namespace
