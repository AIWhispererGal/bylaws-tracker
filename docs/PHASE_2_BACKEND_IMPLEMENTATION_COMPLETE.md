# Phase 2 Backend API Implementation - COMPLETE

**Date:** October 17, 2025
**Agent:** Coder (Hive Mind Swarm)
**Status:** ✅ IMPLEMENTATION COMPLETE

---

## 📋 Summary

Successfully implemented Phase 2 backend APIs for hierarchy management, suggestion rejection, and enhanced lock endpoint as specified in `docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`.

---

## ✅ Deliverables

### 1. Hierarchy Management Endpoints (src/routes/admin.js)

Added 4 new endpoints to `/src/routes/admin.js`:

#### GET /admin/documents/:docId/hierarchy
- Fetches current hierarchy config (document override OR organization default)
- Returns metadata indicating source (document vs organization)
- **Authentication:** requireAdmin middleware
- **Response:**
  ```json
  {
    "success": true,
    "hierarchy": { "levels": [...], "maxDepth": 10 },
    "source": "document" | "organization",
    "documentId": "uuid",
    "documentTitle": "string"
  }
  ```

#### PUT /admin/documents/:docId/hierarchy
- Updates per-document hierarchy configuration
- **Validation:**
  - Exactly 10 levels required
  - Depths must be 0-9
  - Each level must have: name, numbering, depth
  - Valid numbering types: roman, numeric, alpha, alphaLower
- **Authentication:** requireAdmin middleware
- **Response:**
  ```json
  {
    "success": true,
    "message": "Document hierarchy configuration updated",
    "document": { "id": "uuid", "title": "string", "hierarchy_override": {...} }
  }
  ```

#### DELETE /admin/documents/:docId/hierarchy
- Resets document to organization default hierarchy
- Sets `hierarchy_override` to NULL
- **Authentication:** requireAdmin middleware
- **Response:**
  ```json
  {
    "success": true,
    "message": "Document hierarchy reset to organization default",
    "document": { "id": "uuid", "title": "string" },
    "usingDefault": true
  }
  ```

#### GET /admin/hierarchy-templates
- Returns pre-built 10-level schema templates
- **Templates included:**
  - `standard-bylaws` - Traditional bylaws with Roman numerals for articles
  - `legal-document` - Legal structure with chapters and clauses
  - `policy-manual` - Corporate policy structure
  - `technical-standard` - Numeric hierarchy (1.1.1.1.1...)
- **Authentication:** requireAdmin middleware
- **Response:**
  ```json
  {
    "success": true,
    "templates": [
      {
        "id": "standard-bylaws",
        "name": "Standard Bylaws",
        "description": "...",
        "levels": [...10 levels...],
        "maxDepth": 10
      },
      ...
    ]
  }
  ```

### 2. Suggestion Rejection Endpoints (src/routes/workflow.js)

Added 3 new endpoints to `/src/routes/workflow.js`:

#### POST /api/workflow/suggestions/:suggestionId/reject
- Rejects a suggestion with stage tracking
- **Required fields:** `sectionId`, optional: `notes`
- **Authentication:** requireAuth + requireAdmin middleware
- **Behavior:**
  - Fetches current workflow stage for the section
  - Updates suggestion status to 'rejected'
  - Tracks: rejected_at, rejected_by, rejected_at_stage_id, rejection_notes
- **Response:**
  ```json
  {
    "success": true,
    "suggestion": {...},
    "message": "Suggestion rejected at Committee Review stage"
  }
  ```

#### POST /api/workflow/suggestions/:suggestionId/unreject
- Reverses rejection (reopens suggestion)
- **Authentication:** requireAuth + requireAdmin middleware
- **Behavior:**
  - Clears all rejection tracking fields (sets to NULL)
  - Sets status back to 'open'
- **Response:**
  ```json
  {
    "success": true,
    "suggestion": {...},
    "message": "Suggestion reopened successfully"
  }
  ```

#### GET /api/workflow/documents/:docId/suggestions
- Lists suggestions with optional filter
- **Query parameters:**
  - `status` - Filter by status (optional)
  - `includeRejected` - Set to 'true' to include rejected suggestions
- **Important:** Rejected suggestions are **NOT loaded by default**
  - This supports the "Show Rejected" toggle button
  - Must explicitly pass `includeRejected=true` to see rejected suggestions
- **Authentication:** requireAuth middleware
- **Response:**
  ```json
  {
    "success": true,
    "suggestions": [
      {
        "id": "uuid",
        "status": "rejected",
        "rejected_at": "2025-10-17T...",
        "rejected_by_user": { "id": "...", "full_name": "..." },
        "rejected_at_stage": { "id": "...", "stage_name": "Committee Review" },
        "rejection_notes": "Rejected at Committee Review stage"
      },
      ...
    ],
    "count": 15,
    "includesRejected": false
  }
  ```

### 3. Enhanced Lock Endpoint (src/routes/workflow.js)

Modified existing `POST /api/workflow/sections/:sectionId/lock` endpoint:

#### Changes:
- **Original response:** Only returned updated section
- **Enhanced response:** Returns complete section data, workflow state, and suggestions list

#### Enhanced Response Structure:
```json
{
  "success": true,
  "message": "Section locked successfully",
  "section": {
    "id": "uuid",
    "is_locked": true,
    "locked_at": "2025-10-17T...",
    "locked_by": "user-uuid",
    "locked_text": "Full section text...",
    "current_text": "Full section text...",
    "original_text": "Original text...",
    "selected_suggestion_id": "suggestion-uuid"
  },
  "workflow": {
    "status": "locked",
    "stage": {
      "id": "stage-uuid",
      "stage_name": "Committee Review",
      "can_lock": true,
      "can_approve": true,
      "can_edit": false
    },
    "canApprove": true,
    "canLock": false,
    "canEdit": false
  },
  "suggestions": [
    // Updated suggestions list (excludes rejected)
  ]
}
```

#### Benefits:
- Enables **client-side section refresh** without additional API calls
- Frontend receives all necessary data to update UI immediately
- No page reload required after locking
- Supports Phase 2 Feature 3 (Client-Side Section Reload After Lock-in)

---

## 🔧 Implementation Details

### Files Modified

**1. /src/routes/admin.js**
- Added 4 new endpoints (lines 602-913)
- Total lines added: ~311 lines
- Includes validation logic for hierarchy schemas
- Embedded hierarchy templates (4 pre-built schemas)

**2. /src/routes/workflow.js**
- Added 3 new endpoints (lines 1678-1891)
- Enhanced 1 existing endpoint (lines 1976-2036)
- Total lines added: ~280 lines
- Includes proper admin permission checks
- Uses existing middleware (requireAuth, requireAdmin)

### Database Dependencies

**IMPORTANT:** These endpoints assume the following database migrations have been applied:

1. **Migration 018:** `documents.hierarchy_override JSONB` column
   - Status: ⚠️ NOT YET CREATED
   - Required for: Hierarchy management endpoints

2. **Migration 019:** Suggestion rejection tracking columns
   - `suggestions.rejected_at TIMESTAMP`
   - `suggestions.rejected_by UUID REFERENCES users(id)`
   - `suggestions.rejected_at_stage_id UUID REFERENCES workflow_stages(id)`
   - `suggestions.rejection_notes TEXT`
   - Status: ⚠️ NOT YET CREATED
   - Required for: Suggestion rejection endpoints

**Next Steps:** Create and apply these migrations before testing endpoints.

### Middleware Used

All endpoints use existing middleware from the codebase:

- `requireAuth` - Ensures user is authenticated (from workflow.js lines 87-95)
- `requireAdmin` - Ensures user has admin permissions (from workflow.js lines 100-108)
- Supabase service client accessed via `req.supabaseService`
- Session data accessed via `req.session.userId`, `req.session.organizationId`

### Error Handling

All endpoints include comprehensive error handling:

- **400 Bad Request** - Invalid input, validation failures
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found (document, suggestion, etc.)
- **500 Internal Server Error** - Database or unexpected errors

Console logging included for all errors:
```javascript
console.error('Reject suggestion error:', error);
```

---

## 🧪 Testing Requirements

### Unit Tests Needed

**File:** `tests/integration/phase2-backend.test.js` (to be created)

Test cases:

1. **Hierarchy Endpoints:**
   - ✅ GET hierarchy (document with override)
   - ✅ GET hierarchy (document without override, uses org default)
   - ✅ PUT hierarchy (valid 10-level config)
   - ✅ PUT hierarchy (invalid config - should reject)
   - ✅ DELETE hierarchy (reset to default)
   - ✅ GET templates (returns 4 templates)

2. **Suggestion Rejection:**
   - ✅ Reject suggestion as admin
   - ✅ Reject suggestion as non-admin (should fail with 403)
   - ✅ Unreject suggestion
   - ✅ GET suggestions with `includeRejected=false` (default)
   - ✅ GET suggestions with `includeRejected=true`

3. **Enhanced Lock Endpoint:**
   - ✅ Lock section, verify enhanced response structure
   - ✅ Verify workflow state included
   - ✅ Verify suggestions list updated
   - ✅ Verify permissions calculated correctly

### Manual Testing Checklist

- [ ] Test hierarchy GET endpoint with Postman/curl
- [ ] Test hierarchy PUT with valid config
- [ ] Test hierarchy PUT with invalid config (should reject)
- [ ] Test hierarchy DELETE (reset to default)
- [ ] Test hierarchy templates GET
- [ ] Test suggestion reject as admin
- [ ] Test suggestion reject as non-admin (should fail)
- [ ] Test suggestion unreject
- [ ] Test lock endpoint, verify enhanced response
- [ ] Verify RLS policies allow these operations

---

## 📝 API Documentation

### Hierarchy Management

**Base URL:** `/admin/documents/:docId/hierarchy`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/documents/:docId/hierarchy` | Admin | Get hierarchy config |
| PUT | `/admin/documents/:docId/hierarchy` | Admin | Update hierarchy config |
| DELETE | `/admin/documents/:docId/hierarchy` | Admin | Reset to org default |
| GET | `/admin/hierarchy-templates` | Admin | Get pre-built templates |

### Suggestion Rejection

**Base URL:** `/api/workflow`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/suggestions/:suggestionId/reject` | Admin | Reject suggestion |
| POST | `/suggestions/:suggestionId/unreject` | Admin | Unreject suggestion |
| GET | `/documents/:docId/suggestions?includeRejected=true` | Auth | List suggestions |

### Enhanced Lock Endpoint

**Base URL:** `/api/workflow/sections/:sectionId`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/sections/:sectionId/lock` | Auth | Lock section (enhanced) |

---

## 🚀 Deployment Notes

### Pre-Deployment Checklist

1. ✅ Code syntax validated
2. ⚠️ Database migrations NOT YET CREATED (required before deployment)
3. ⚠️ Unit tests NOT YET CREATED (recommended before deployment)
4. ✅ Middleware dependencies satisfied (using existing middleware)
5. ⚠️ RLS policies NOT YET VERIFIED (should be tested with migrations)

### Deployment Steps

1. **Create and apply database migrations:**
   ```bash
   # Create migration files
   # Apply to dev environment
   # Test migrations
   # Apply to production
   ```

2. **Deploy code:**
   ```bash
   git add src/routes/admin.js src/routes/workflow.js
   git commit -m "feat: Phase 2 backend APIs - hierarchy management, suggestion rejection, enhanced lock"
   git push origin main
   # Render auto-deploys
   ```

3. **Verify deployment:**
   - Test each endpoint with Postman
   - Check error logs
   - Verify RLS policies

### Rollback Plan

If issues arise:

1. **Database rollback:**
   ```sql
   -- Revert migration 018
   ALTER TABLE documents DROP COLUMN hierarchy_override;

   -- Revert migration 019
   ALTER TABLE suggestions
     DROP COLUMN rejected_at,
     DROP COLUMN rejected_by,
     DROP COLUMN rejected_at_stage_id,
     DROP COLUMN rejection_notes;
   ```

2. **Code rollback:**
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## 🔗 Related Documentation

- **Full roadmap:** `docs/roadmap/PHASE_2_ENHANCEMENTS_ROADMAP.md`
- **Phase 1 work:** `docs/NEXT_SESSION_WORKFLOW_FIXES.md`
- **10-level parsing:** `docs/reports/P5_EXECUTIVE_SUMMARY.md`
- **Workflow lock:** `docs/WORKFLOW_LOCK_IMPLEMENTATION_COMPLETE.md`

---

## ✅ Completion Status

**Backend APIs:** ✅ COMPLETE
**Database migrations:** ⚠️ PENDING (create migrations 018 and 019)
**Frontend UI:** ⚠️ PENDING (separate task)
**Testing:** ⚠️ PENDING (create integration tests)

---

## 📊 Code Statistics

**Files modified:** 2
**Lines added:** ~591 lines
**New endpoints:** 7 (4 hierarchy + 3 rejection)
**Enhanced endpoints:** 1 (lock endpoint)
**Pre-built templates:** 4 hierarchy schemas

---

## 🎯 Next Steps

### Immediate (Before Testing)
1. Create `database/migrations/018_add_per_document_hierarchy.sql`
2. Create `database/migrations/019_add_suggestion_rejection_tracking.sql`
3. Apply migrations to dev environment
4. Test all endpoints manually

### Short-term (Before Production Deployment)
1. Create integration tests in `tests/integration/phase2-backend.test.js`
2. Run full test suite
3. Update API documentation
4. Create user guide for admins

### Long-term (Frontend Integration)
1. Create hierarchy editor UI (`views/admin/document-hierarchy-editor.ejs`)
2. Add suggestion rejection UI (tabs, buttons)
3. Implement client-side refresh after lock
4. E2E testing

---

**Implementation Date:** October 17, 2025
**Coder Agent:** Hive Mind Swarm
**Status:** ✅ READY FOR DATABASE MIGRATIONS
