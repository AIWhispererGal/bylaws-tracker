# Quick Reference - Workflow Fixes

## Files Modified

| File | Purpose | Lines Changed |
|------|---------|---------------|
| `/database/migrations/012_workflow_enhancements.sql` | Atomic lock function | +152 lines |
| `/src/routes/approval.js` | Updated endpoints | ~100 lines |
| `/src/utils/errors.js` | Error handling utilities | +44 lines (new) |
| `/tests/unit/workflow-fixes.test.js` | Unit tests | +351 lines (new) |

## Key Changes Summary

### 1. Race Condition Fix (Issue #1)
**Problem:** Multiple users could lock same section simultaneously
**Solution:** Atomic database function with row-level locking

**Database Function:**
```sql
lock_section_atomic(
  p_section_id UUID,
  p_stage_id UUID,
  p_user_id UUID,
  p_suggestion_id UUID,
  p_notes TEXT
) RETURNS JSONB
```

**Returns:**
```json
{
  "success": true,
  "state_id": "uuid"
}
// OR
{
  "success": false,
  "error": "Section is already locked",
  "code": "SECTION_LOCKED"
}
```

### 2. Input Validation (Issue #2)
**Added validation schema for `/approval/progress`:**
```javascript
{
  section_id: UUID (required),
  notes: string, max 5000 chars (optional)
}
```

### 3. Error Standardization (Issue #3)
**New error codes:**
- `VALIDATION_ERROR` (400) - Invalid input
- `PERMISSION_DENIED` (403) - Insufficient permissions
- `SECTION_NOT_FOUND` (404) - Section doesn't exist
- `WORKFLOW_NOT_FOUND` (404) - No workflow configured
- `FINAL_STAGE_REACHED` (400) - Already at final stage
- `SECTION_LOCKED` (400) - Section already locked
- `LOCK_CONTENTION` (409) - Concurrent lock attempt
- `DATABASE_ERROR` (500) - Database operation failed
- `INTERNAL_ERROR` (500) - Unexpected error

## API Response Format

### Success
```json
{
  "success": true,
  "message": "Section locked successfully",
  "state_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Error
```json
{
  "success": false,
  "error": "User-friendly error message",
  "code": "ERROR_CODE"
}
```

## Common Error Scenarios

| Scenario | HTTP Code | Error Code | Message |
|----------|-----------|------------|---------|
| Invalid UUID | 400 | VALIDATION_ERROR | "section_id" must be a valid GUID |
| Missing permission | 403 | PERMISSION_DENIED | You do not have permission... |
| Section not found | 404 | SECTION_NOT_FOUND | Section not found |
| Already locked | 400 | SECTION_LOCKED | Section is already locked at this stage |
| Concurrent lock | 409 | LOCK_CONTENTION | Section is being locked by another user |
| Database error | 500 | DATABASE_ERROR | Failed to lock section |

## Testing Commands

### Run Unit Tests
```bash
npm test -- tests/unit/workflow-fixes.test.js
# Expected: 19 tests passing
```

### Check Syntax
```bash
node -c src/utils/errors.js
node -c src/routes/approval.js
```

### Verify Migration
```bash
# Check function exists in database
SELECT proname FROM pg_proc WHERE proname = 'lock_section_atomic';
```

## Integration Points

### Frontend Integration
```javascript
// Lock a section
const response = await fetch('/approval/lock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    section_id: sectionId,
    workflow_stage_id: stageId,
    selected_suggestion_id: suggestionId,
    notes: 'User notes'
  })
});

const result = await response.json();

if (!result.success) {
  // Handle specific error codes
  switch (result.code) {
    case 'SECTION_LOCKED':
      showMessage('This section is already locked');
      break;
    case 'LOCK_CONTENTION':
      showMessage('Someone else is locking this section. Please try again.');
      break;
    case 'PERMISSION_DENIED':
      showMessage('You do not have permission to lock this section');
      break;
    default:
      showMessage('An error occurred. Please try again.');
  }
}
```

### Progress Section
```javascript
const response = await fetch('/approval/progress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    section_id: sectionId,
    notes: 'Progress notes'
  })
});
```

## Database Monitoring

### Check Lock Performance
```sql
-- Monitor lock function calls
SELECT
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_user_functions
WHERE funcname = 'lock_section_atomic';
```

### Check for Lock Contention
```sql
-- Find lock wait events
SELECT
  pid,
  usename,
  application_name,
  wait_event,
  state,
  query
FROM pg_stat_activity
WHERE wait_event_type = 'Lock'
  AND query LIKE '%section_workflow_states%';
```

### Audit Trail
```sql
-- Recent workflow actions
SELECT
  action,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM workflow_audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY action
ORDER BY count DESC;
```

## Troubleshooting

### Issue: Lock function not found
**Solution:**
```bash
# Apply migration
psql -f database/migrations/012_workflow_enhancements.sql
```

### Issue: Permission denied errors
**Solution:**
```javascript
// Check user has correct role in organization
SELECT role FROM user_organizations
WHERE user_id = 'user-uuid'
  AND organization_id = 'org-uuid'
  AND is_active = true;
```

### Issue: Validation errors
**Solution:**
- Verify UUIDs are properly formatted (lowercase, hyphens)
- Check notes field is not longer than 5000 characters
- Ensure required fields are present

### Issue: Database errors
**Solution:**
- Check Supabase connection
- Verify RLS policies allow operation
- Check user session is valid

## Performance Expectations

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Lock section | < 100ms | Atomic operation with index lookup |
| Progress section | < 150ms | Multiple DB queries, validated |
| Approve section | < 120ms | Single upsert operation |
| Validation | < 5ms | In-memory schema validation |

## Security Considerations

### Production Error Handling
- Generic 500 errors sanitized in production
- WorkflowError messages always shown (user-friendly)
- Full stack traces logged server-side only
- Session data logged for debugging (userId, orgId)

### Permissions Checked
1. User must be member of organization
2. User must have role that can approve at stage
3. Global admins bypass role check
4. All checks via RLS policies + middleware

## Next Steps

1. **Apply migration** to production database
2. **Deploy code** to production server
3. **Monitor logs** for first 24 hours
4. **Review metrics** after 1 week
5. **Consider optimizations** based on usage patterns

## Related Documentation

- Full details: `/docs/WORKFLOW_FIXES_SUMMARY.md`
- Deployment guide: `/docs/IMPLEMENTATION_CHECKLIST.md`
- Migration file: `/database/migrations/012_workflow_enhancements.sql`
- Error utilities: `/src/utils/errors.js`

---

**Status:** ✅ All fixes complete and tested
**Test Results:** 19/19 passing
**Ready for:** Production deployment
