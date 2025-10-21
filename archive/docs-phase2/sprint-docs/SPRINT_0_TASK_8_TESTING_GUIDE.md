# My Tasks Section - Quick Testing Guide

## Overview
This guide helps you quickly test the My Tasks section implementation.

---

## Prerequisites

1. **Server Running**: `npm start` or `node server.js`
2. **Database**: Supabase connection configured
3. **User Account**: Test user created and logged in
4. **Organization**: User has organization selected

---

## Quick Test Scenarios

### Scenario 1: Empty State (No Tasks)

**Goal**: Verify "All caught up" message displays

**Steps**:
1. Login with a test user
2. Navigate to `/dashboard`
3. Look for "My Tasks" section at top

**Expected Result**:
```
┌─────────────────────────────────────┐
│ 📋 My Tasks                         │
├─────────────────────────────────────┤
│           ✅                         │
│  All caught up! No pending tasks.   │
└─────────────────────────────────────┘
```

**Pass Criteria**: ✅ Green checkmark icon visible, encouraging message displayed

---

### Scenario 2: Pending Approval Task

**Goal**: Test approval task displays and navigation works

**Setup SQL**:
```sql
-- First, get a section ID from your database
SELECT id, section_number, section_title, document_id
FROM document_sections
WHERE document_id IN (
  SELECT id FROM documents WHERE organization_id = '[your-org-id]'
)
LIMIT 1;

-- Create a pending workflow state
INSERT INTO section_workflow_states (
  section_id,
  status,
  workflow_stage_id,
  actioned_at
) VALUES (
  '[section-id-from-above]',
  'pending',
  (SELECT id FROM workflow_stages LIMIT 1),
  NOW()
);
```

**Steps**:
1. Run the SQL above
2. Refresh dashboard (`/dashboard`)
3. Look for task with ⚠️ yellow icon

**Expected Result**:
```
[⚠️] Approve: [Section Title]    [Approval] →
    Pending in [Document Name]
```

**Pass Criteria**:
- ✅ Task appears at top (warning priority)
- ✅ Yellow warning color
- ✅ Clipboard icon
- ✅ "Approval" badge visible
- ✅ Clicking navigates to document

---

### Scenario 3: User's Suggestion

**Goal**: Test user's own suggestion displays

**Setup API Call**:
```bash
# Use your actual document/section IDs
curl -X POST http://localhost:3000/api/dashboard/suggestions \
  -H "Content-Type: application/json" \
  -H "Cookie: [your-session-cookie]" \
  -d '{
    "document_id": "[document-id]",
    "section_id": "[section-id]",
    "suggested_text": "This is a test suggestion",
    "rationale": "Testing the My Tasks feature",
    "author_name": "Test User",
    "author_email": "[your-user-email]",
    "status": "open"
  }'
```

**Or via UI**:
1. Navigate to a document
2. Click "Add Suggestion" on any section
3. Fill in suggestion text
4. Submit

**Steps**:
1. Create suggestion (API or UI)
2. Navigate to `/dashboard`
3. Look for task with 💡 blue icon

**Expected Result**:
```
[💡] Your suggestion in [Document]  [Your Suggestion] →
    Awaiting review - submitted [date]
```

**Pass Criteria**:
- ✅ Task appears (info priority - likely at bottom)
- ✅ Blue/cyan info color
- ✅ Light bulb icon
- ✅ "Your Suggestion" badge
- ✅ Shows submission date

---

### Scenario 4: Recent Document Update

**Goal**: Test recent update task displays

**Setup SQL**:
```sql
-- Update a document to trigger "recent update"
UPDATE documents
SET updated_at = NOW()
WHERE id IN (
  SELECT id FROM documents
  WHERE organization_id = '[your-org-id]'
  LIMIT 1
);
```

**Steps**:
1. Run the SQL above
2. Navigate to `/dashboard`
3. Look for task with 📄 blue icon

**Expected Result**:
```
[📄] Review: [Document Title]    [Review] →
    Updated [today's date]
```

**Pass Criteria**:
- ✅ Task appears (primary priority - middle)
- ✅ Blue primary color
- ✅ File icon
- ✅ "Review" badge
- ✅ Shows update date

---

### Scenario 5: Multiple Tasks - Priority Sorting

**Goal**: Verify tasks sort correctly by priority

**Setup**: Create all three task types using scenarios 2-4

**Expected Order**:
1. ⚠️ Approval tasks (warning - yellow)
2. 📄 Review tasks (primary - blue)
3. 💡 Your Suggestions (info - cyan)

**Pass Criteria**:
- ✅ Tasks appear in priority order
- ✅ All three task types visible
- ✅ Task count badge shows correct number
- ✅ Colors match priority levels

---

### Scenario 6: Mobile Responsive

**Goal**: Verify mobile layout works

**Steps**:
1. Open dashboard with tasks
2. Resize browser to mobile width (< 576px)
3. Or use browser DevTools device emulation

**Expected Changes**:
- ✅ Task items stack vertically
- ✅ Badge wraps to new row below content
- ✅ Text no longer truncated
- ✅ Icons remain visible
- ✅ Clickable areas remain easy to tap

---

### Scenario 7: Task Navigation

**Goal**: Verify clicking tasks navigates correctly

**Steps**:
1. Dashboard with at least one task
2. Click on a task item

**Expected Results**:

For **Approval Task**:
- Navigate to `/dashboard/document/[doc-id]#section-[section-id]`
- Page scrolls to specific section
- Section is highlighted or visible

For **Review Task**:
- Navigate to `/dashboard/document/[doc-id]`
- Document page loads
- No anchor scroll

For **Suggestion Task**:
- Navigate to `/dashboard/document/[doc-id]#suggestion-[suggestion-id]`
- Page scrolls to suggestion
- Suggestion is highlighted or visible

**Pass Criteria**: ✅ All navigation URLs work correctly

---

### Scenario 8: Task Count Badge

**Goal**: Test task count display

**Test Cases**:
| Tasks | Expected Badge |
|-------|----------------|
| 0 | No badge shown |
| 1 | Badge shows "1" |
| 5 | Badge shows "5" |
| 10 | Badge shows "10", no "View All" |
| 11+ | Badge shows count, "View All" link appears |

**Pass Criteria**: ✅ Badge displays correct count

---

### Scenario 9: "View All" Link

**Goal**: Test View All link appears when needed

**Setup**: Create 11 or more tasks (any type)

**Expected Result**:
```
┌────────────────────────────────────────────┐
│ 📋 My Tasks (15)    View All (15) → │
├────────────────────────────────────────────┤
│ [Only top 10 tasks shown]                  │
└────────────────────────────────────────────┘
```

**Pass Criteria**:
- ✅ "View All" link appears when > 10 tasks
- ✅ Only 10 tasks displayed
- ✅ Link shows total count

---

## Automated Testing

### Run Test Suite
```bash
# Run all dashboard tests
npm test tests/integration/dashboard-my-tasks.test.js

# Run with coverage
npm test -- --coverage tests/integration/dashboard-my-tasks.test.js
```

### Expected Output
```
PASS tests/integration/dashboard-my-tasks.test.js
  Dashboard My Tasks Section
    Task Aggregation
      ✓ should return empty array when no tasks exist
      ✓ should aggregate pending approvals correctly
      ✓ should aggregate user suggestions correctly
      ✓ should aggregate recent document updates correctly
    Priority Sorting
      ✓ should sort tasks by priority: warning > primary > info
    Task Limiting
      ✓ should limit to top 10 tasks
    [... more tests ...]

Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total
```

---

## Performance Testing

### Load Time Test

**Goal**: Verify dashboard loads quickly

**Steps**:
1. Open browser DevTools → Network tab
2. Navigate to `/dashboard`
3. Check "Finish" time

**Pass Criteria**:
- ✅ Total load < 2 seconds
- ✅ Task queries < 500ms
- ✅ No console errors

---

### Database Query Test

**Goal**: Verify efficient queries

**Steps**:
1. Enable Supabase query logging
2. Load dashboard
3. Check query count and execution time

**Pass Criteria**:
- ✅ Max 4 queries for tasks (docs, sections, states, suggestions)
- ✅ All queries < 200ms each
- ✅ Queries use indexed columns

---

## Security Testing

### RLS Test - Cross-Organization

**Goal**: Ensure users can't see other org's tasks

**Steps**:
1. Create tasks for Org A
2. Login as user from Org B
3. View dashboard

**Pass Criteria**:
- ✅ User B sees NO tasks from Org A
- ✅ Only sees their own org's tasks
- ✅ No errors in console

---

### RLS Test - User Isolation

**Goal**: Ensure "Your Suggestions" only shows user's own

**Steps**:
1. User A creates suggestion
2. User B (same org) views dashboard

**Expected**:
- User A sees their suggestion in "Your Suggestions"
- User B does NOT see User A's suggestion in "Your Suggestions"

**Pass Criteria**: ✅ Users only see their own suggestions

---

## Accessibility Testing

### Keyboard Navigation

**Steps**:
1. Navigate to dashboard
2. Press Tab repeatedly
3. Try to access all tasks using only keyboard

**Pass Criteria**:
- ✅ All tasks are keyboard accessible
- ✅ Focus indicators visible
- ✅ Enter key activates task links

---

### Screen Reader Test

**Steps**:
1. Enable screen reader (NVDA, JAWS, or macOS VoiceOver)
2. Navigate to My Tasks section
3. Listen to announcements

**Pass Criteria**:
- ✅ Section title announced clearly
- ✅ Task count announced
- ✅ Each task title and description read
- ✅ Task types announced

---

## Error Handling Testing

### Database Connection Failure

**Goal**: Verify graceful degradation

**Steps**:
1. Temporarily break Supabase connection (wrong URL)
2. Load dashboard

**Expected**:
- ✅ Dashboard still renders
- ✅ My Tasks shows empty state OR is hidden
- ✅ User sees error message or just no tasks
- ✅ No white screen of death

---

### Missing Data Test

**Goal**: Handle missing/null data gracefully

**Setup SQL**:
```sql
-- Create section with minimal data
INSERT INTO document_sections (document_id, section_number)
VALUES ('[doc-id]', '99.99');
-- Note: missing section_title

-- Create workflow state for it
INSERT INTO section_workflow_states (section_id, status)
VALUES ('[section-id]', 'pending');
```

**Pass Criteria**:
- ✅ Task displays with section_number as fallback
- ✅ No JavaScript errors
- ✅ Description shows "Pending in [Document]"

---

## Edge Cases

### Edge Case 1: Very Long Title

**Setup**: Create section with 200+ character title

**Expected**:
- ✅ Title truncates with ellipsis (...)
- ✅ Full title visible on hover (tooltip)
- ✅ Layout doesn't break

---

### Edge Case 2: Special Characters

**Setup**: Create task with title: `<script>alert('xss')</script>`

**Expected**:
- ✅ Special characters are escaped
- ✅ No XSS vulnerability
- ✅ Displays as plain text

---

### Edge Case 3: Many Tasks (100+)

**Setup**: Create 100 tasks via script

**Expected**:
- ✅ Only top 10 displayed
- ✅ "View All (100)" link shown
- ✅ No performance degradation
- ✅ Sorting still works

---

## Regression Testing

### After Code Changes

**Quick Smoke Test**:
1. ✅ Dashboard loads without errors
2. ✅ My Tasks section visible
3. ✅ At least one task displays correctly
4. ✅ Clicking task navigates properly
5. ✅ Mobile layout works

---

## Troubleshooting

### Issue: Tasks Not Appearing

**Check**:
1. User is authenticated (`req.session.userId` exists)
2. Organization is selected (`req.session.organizationId` exists)
3. Database queries returning data (check server logs)
4. RLS policies allow user to read data

**Debug**:
```javascript
// Add to dashboard route
console.log('User:', req.session.userId);
console.log('Org:', req.organizationId);
console.log('Tasks:', myTasks);
```

---

### Issue: Navigation Not Working

**Check**:
1. URL format is correct (`/dashboard/document/[id]#anchor`)
2. Document ID exists in database
3. User has access to document (RLS)

**Debug**:
```javascript
// Check task URL
console.log('Task URL:', task.url);
```

---

### Issue: Mobile Layout Broken

**Check**:
1. CSS file loaded (`/css/style.css`)
2. Bootstrap 5 loaded
3. Viewport meta tag present
4. No CSS conflicts

**Debug**:
```bash
# Check CSS file exists
ls public/css/style.css

# Check server logs for 404s
```

---

## Sign-Off Checklist

Before marking complete:

- [ ] All 9 test scenarios pass
- [ ] Automated tests pass (25/25)
- [ ] Performance < 2s load time
- [ ] Security tests pass (RLS verified)
- [ ] Accessibility tests pass (keyboard + screen reader)
- [ ] Mobile responsive verified
- [ ] Error handling works
- [ ] Edge cases handled
- [ ] Documentation complete
- [ ] Code reviewed

---

## Quick Test Script

For rapid testing, use this script:

```bash
#!/bin/bash
# quick-test-my-tasks.sh

echo "🧪 Testing My Tasks Section"
echo ""

# Test 1: Check if server is running
echo "1️⃣ Checking server..."
curl -s http://localhost:3000/dashboard > /dev/null && echo "✅ Server running" || echo "❌ Server not running"

# Test 2: Check CSS file exists
echo "2️⃣ Checking CSS..."
[ -f public/css/style.css ] && echo "✅ CSS file exists" || echo "❌ CSS file missing"

# Test 3: Check dashboard route
echo "3️⃣ Checking dashboard route..."
grep -q "myTasks" src/routes/dashboard.js && echo "✅ Task logic present" || echo "❌ Task logic missing"

# Test 4: Check template
echo "4️⃣ Checking template..."
grep -q "My Tasks" views/dashboard/dashboard.ejs && echo "✅ UI present" || echo "❌ UI missing"

echo ""
echo "📊 Quick test complete!"
```

---

**Document Version**: 1.0
**Last Updated**: October 14, 2025
**Testing Status**: Ready for QA
