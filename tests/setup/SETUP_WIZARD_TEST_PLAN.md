# Setup Wizard Manual Test Plan

## Testing Environment Setup

### Prerequisites
- [ ] Fresh installation (no existing database)
- [ ] Node.js and dependencies installed
- [ ] Supabase project configured
- [ ] Environment variables set (.env file)

### Test Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 1. First-Run Detection Tests

### Test 1.1: Fresh Install Redirects to Setup
**Steps:**
1. Clear all database data
2. Navigate to `/` or `/dashboard`
3. Verify redirect to `/setup`

**Expected:** ✅ Automatically redirected to setup wizard

**Actual:** _______________

---

### Test 1.2: Configured Install Shows Main App
**Steps:**
1. Complete setup wizard
2. Navigate to `/`
3. Verify main app loads

**Expected:** ✅ Main app displayed, no redirect to setup

**Actual:** _______________

---

### Test 1.3: Cannot Access Main App While Unconfigured
**Steps:**
1. Clear database
2. Try to access `/bylaws`, `/dashboard`, `/api/sections`
3. Verify all redirect to `/setup`

**Expected:** ✅ All protected routes redirect to setup

**Actual:** _______________

---

### Test 1.4: Cannot Access Setup After Configured
**Steps:**
1. Complete setup
2. Navigate to `/setup`
3. Verify redirect to dashboard

**Expected:** ✅ Redirect to `/dashboard` or main app

**Actual:** _______________

---

## 2. Welcome Screen Tests

### Test 2.1: Welcome Page Displays
**Steps:**
1. Navigate to `/setup`
2. Check welcome message and organization logo
3. Check "Get Started" button

**Expected:**
- ✅ Professional welcome message
- ✅ Clear description of setup process
- ✅ Prominent "Get Started" button

**Actual:** _______________

---

### Test 2.2: Get Started Button
**Steps:**
1. Click "Get Started" button
2. Verify navigation to organization form

**Expected:** ✅ Navigate to `/setup/organization`

**Actual:** _______________

---

## 3. Organization Information Tests

### Test 3.1: Form Displays Correctly
**Steps:**
1. Navigate to `/setup/organization`
2. Check all form fields present

**Expected:**
- ✅ Organization name field
- ✅ Organization type dropdown
- ✅ State field
- ✅ Country field
- ✅ Contact email field
- ✅ Logo upload area

**Actual:** _______________

---

### Test 3.2: Required Field Validation
**Steps:**
1. Leave organization name blank
2. Click "Continue"
3. Verify error message

**Expected:** ✅ "Organization name is required" error displayed

**Actual:** _______________

---

### Test 3.3: Organization Type Required
**Steps:**
1. Fill name only
2. Click "Continue"
3. Verify error message

**Expected:** ✅ "Organization type is required" error

**Actual:** _______________

---

### Test 3.4: Email Format Validation
**Steps:**
1. Enter invalid email: "notanemail"
2. Tab out of field
3. Verify validation error

**Expected:** ✅ "Invalid email format" error

**Valid Emails to Test:**
- admin@example.com ✅
- user.name@domain.org ✅
- test+tag@subdomain.example.com ✅

**Invalid Emails to Test:**
- notanemail ❌
- @domain.com ❌
- user@domain ❌

**Actual:** _______________

---

### Test 3.5: Logo Upload - Click to Upload
**Steps:**
1. Click upload area
2. Select valid PNG file (< 2MB)
3. Verify preview shows

**Expected:**
- ✅ File dialog opens
- ✅ Image preview displays
- ✅ File name shows
- ✅ Remove button appears

**Actual:** _______________

---

### Test 3.6: Logo Upload - Drag and Drop
**Steps:**
1. Drag image file over upload area
2. Drop file
3. Verify preview

**Expected:**
- ✅ Drag-over styling appears
- ✅ Preview displays after drop
- ✅ Upload area hidden

**Actual:** _______________

---

### Test 3.7: Logo Upload - File Type Validation
**Steps:**
1. Upload .pdf file
2. Verify error message

**Expected:** ✅ "Please select an image file (PNG, JPG, or SVG)" error

**Actual:** _______________

---

### Test 3.8: Logo Upload - File Size Validation
**Steps:**
1. Upload 5MB image
2. Verify error message

**Expected:** ✅ "File size must be less than 2MB" error

**Actual:** _______________

---

### Test 3.9: Logo Upload - Remove Logo
**Steps:**
1. Upload logo
2. Click "Remove" button
3. Verify logo removed

**Expected:**
- ✅ Preview hidden
- ✅ Upload area shown again
- ✅ File input cleared

**Actual:** _______________

---

### Test 3.10: Valid Organization Submission
**Steps:**
1. Fill all required fields correctly:
   - Name: "Reseda Neighborhood Council"
   - Type: "Neighborhood Council"
   - State: "CA"
   - Email: "admin@resedanc.org"
2. Click "Continue"

**Expected:**
- ✅ Loading spinner shows
- ✅ Navigate to `/setup/document-type`
- ✅ Data saved in session

**Actual:** _______________

---

## 4. Document Structure Tests

### Test 4.1: Structure Cards Display
**Steps:**
1. Navigate to `/setup/document-type`
2. Check structure options

**Expected:**
- ✅ Article → Section card
- ✅ Chapter → Section card
- ✅ Part → Section card
- ✅ Custom structure card
- ✅ All cards have descriptions

**Actual:** _______________

---

### Test 4.2: Structure Selection
**Steps:**
1. Click "Article → Section" card
2. Verify selection

**Expected:**
- ✅ Card highlighted with border
- ✅ Customization section appears
- ✅ Preview section appears
- ✅ Labels pre-filled

**Actual:** _______________

---

### Test 4.3: Custom Labels
**Steps:**
1. Select structure
2. Change Level 1 name to "Part"
3. Change Level 2 name to "Chapter"
4. Verify preview updates

**Expected:**
- ✅ Preview shows "Part I"
- ✅ Preview shows "Chapter 1.1"
- ✅ Updates in real-time

**Actual:** _______________

---

### Test 4.4: Numbering Style Selection
**Steps:**
1. Try each numbering style:
   - Roman (I, II, III)
   - Numeric (1, 2, 3)
   - Alphabetic (A, B, C)
2. Verify preview updates

**Expected:** ✅ Preview reflects selected numbering

**Actual:** _______________

---

### Test 4.5: No Structure Selected Error
**Steps:**
1. Don't select any structure
2. Click "Continue"

**Expected:** ✅ "Please select a document structure" error

**Actual:** _______________

---

### Test 4.6: Valid Structure Submission
**Steps:**
1. Select "Article → Section"
2. Keep default labels
3. Click "Continue"

**Expected:**
- ✅ Navigate to `/setup/workflow`
- ✅ Data saved

**Actual:** _______________

---

## 5. Workflow Configuration Tests

### Test 5.1: Template Cards Display
**Steps:**
1. Navigate to `/setup/workflow`
2. Check workflow templates

**Expected:**
- ✅ Simple workflow card
- ✅ Committee workflow card
- ✅ Membership vote card
- ✅ Custom workflow card
- ✅ Descriptions present

**Actual:** _______________

---

### Test 5.2: Simple Template Selection
**Steps:**
1. Click "Simple" template
2. Verify pre-filled stages

**Expected:**
- ✅ 2 stages appear
- ✅ "Board Review"
- ✅ "President Approval"
- ✅ Workflow visualization shows

**Actual:** _______________

---

### Test 5.3: Committee Template Selection
**Steps:**
1. Click "Committee" template
2. Verify stages

**Expected:**
- ✅ 3 stages appear
- ✅ "Committee Review" (majority)
- ✅ "Board Approval" (majority)
- ✅ "President Signature" (single)

**Actual:** _______________

---

### Test 5.4: Add Custom Stage
**Steps:**
1. Select "Custom" template
2. Click "Add Stage" button
3. Fill in stage details

**Expected:**
- ✅ New stage form appears
- ✅ Can enter stage name
- ✅ Can select approval type
- ✅ Workflow diagram updates

**Actual:** _______________

---

### Test 5.5: Remove Stage
**Steps:**
1. Add multiple stages
2. Click "Remove" on a stage
3. Verify removal

**Expected:**
- ✅ Stage removed from list
- ✅ Diagram updates
- ✅ No errors

**Actual:** _______________

---

### Test 5.6: Quorum Approval Type
**Steps:**
1. Select approval type "Quorum"
2. Verify quorum field appears
3. Enter 50
4. Verify in diagram

**Expected:**
- ✅ Quorum percentage field shows
- ✅ Accepts values 1-100
- ✅ Validation for out-of-range

**Actual:** _______________

---

### Test 5.7: No Stages Error
**Steps:**
1. Select custom template
2. Remove all stages
3. Click "Continue"

**Expected:** ✅ "At least one workflow stage is required" error

**Actual:** _______________

---

### Test 5.8: Stage Name Required
**Steps:**
1. Add stage with blank name
2. Click "Continue"

**Expected:** ✅ "Stage name is required" error

**Actual:** _______________

---

### Test 5.9: Notification Settings
**Steps:**
1. Check notification options
2. Toggle checkboxes

**Expected:**
- ✅ On Submit checkbox
- ✅ On Approval checkbox
- ✅ On Rejection checkbox
- ✅ On Complete checkbox
- ✅ All toggleable

**Actual:** _______________

---

### Test 5.10: Valid Workflow Submission
**Steps:**
1. Select "Committee" template
2. Click "Continue"

**Expected:**
- ✅ Navigate to `/setup/import`
- ✅ Workflow saved

**Actual:** _______________

---

## 6. Document Import Tests

### Test 6.1: Upload Zone Display
**Steps:**
1. Navigate to `/setup/import`
2. Check upload interface

**Expected:**
- ✅ Drag-and-drop zone visible
- ✅ "Browse" button present
- ✅ File type instructions clear
- ✅ Google Docs tab available

**Actual:** _______________

---

### Test 6.2: File Upload - Click Browse
**Steps:**
1. Click "Browse" button
2. Select .docx file
3. Verify preview

**Expected:**
- ✅ File dialog opens
- ✅ File name displays
- ✅ File size displays
- ✅ Parsing options appear

**Actual:** _______________

---

### Test 6.3: File Upload - Drag and Drop
**Steps:**
1. Drag .docx file
2. Drop on upload zone

**Expected:**
- ✅ Drop zone highlights on drag
- ✅ File accepted on drop
- ✅ Preview shows

**Actual:** _______________

---

### Test 6.4: Invalid File Type
**Steps:**
1. Upload .pdf file
2. Verify error

**Expected:** ✅ "Please select a Word document (.docx or .doc)" error

**Actual:** _______________

---

### Test 6.5: File Too Large
**Steps:**
1. Upload 15MB file
2. Verify error

**Expected:** ✅ "File size must be less than 10MB" error

**Actual:** _______________

---

### Test 6.6: Remove Uploaded File
**Steps:**
1. Upload file
2. Click "Remove" button

**Expected:**
- ✅ File removed
- ✅ Upload zone visible again
- ✅ Parsing options hidden

**Actual:** _______________

---

### Test 6.7: Parsing Options
**Steps:**
1. Upload valid file
2. Check parsing options

**Expected:**
- ✅ "Auto-detect structure" checkbox
- ✅ "Preserve formatting" checkbox
- ✅ "Create initial version" checkbox
- ✅ All checkable

**Actual:** _______________

---

### Test 6.8: Google Docs Tab
**Steps:**
1. Click "Google Docs" tab
2. Check interface

**Expected:**
- ✅ URL input field
- ✅ Helper text with example
- ✅ Parsing options available

**Actual:** _______________

---

### Test 6.9: Google Docs URL Validation
**Steps:**
1. Enter invalid URL
2. Try to continue

**Expected:** ✅ "Please enter a valid Google Docs URL" error

**Valid URL:** https://docs.google.com/document/d/abc123/edit

**Actual:** _______________

---

### Test 6.10: Skip Import Option
**Steps:**
1. Click "Skip for now" link
2. Confirm dialog

**Expected:**
- ✅ Confirmation dialog appears
- ✅ Can cancel or confirm
- ✅ On confirm: proceed to processing

**Actual:** _______________

---

### Test 6.11: Valid File Upload Submission
**Steps:**
1. Upload valid .docx file
2. Enable "Auto-detect structure"
3. Click "Continue"

**Expected:**
- ✅ "Uploading..." message shows
- ✅ Progress indication
- ✅ Navigate to `/setup/processing`

**Actual:** _______________

---

## 7. Processing Screen Tests

### Test 7.1: Processing Screen Displays
**Steps:**
1. After import submission
2. Check processing screen

**Expected:**
- ✅ Loading animation
- ✅ Progress indicators
- ✅ Status messages
- ✅ Estimated time remaining

**Actual:** _______________

---

### Test 7.2: Status Updates
**Steps:**
1. Watch processing for 30 seconds
2. Observe status changes

**Expected:**
- ✅ Status messages update
- ✅ Progress bar advances
- ✅ Estimated time decreases
- ✅ No errors displayed

**Actual:** _______________

---

### Test 7.3: Auto-Redirect on Complete
**Steps:**
1. Wait for processing to complete
2. Verify auto-redirect

**Expected:**
- ✅ Auto-redirect to `/setup/success`
- ✅ No manual action needed
- ✅ Redirect within 2 seconds

**Actual:** _______________

---

## 8. Success Screen Tests

### Test 8.1: Success Screen Display
**Steps:**
1. Complete setup
2. Check success screen

**Expected:**
- ✅ Success message
- ✅ Setup summary displayed
- ✅ Organization name shown
- ✅ Document structure shown
- ✅ Workflow stages count
- ✅ Sections imported count
- ✅ "Go to Dashboard" button

**Actual:** _______________

---

### Test 8.2: Setup Summary Accuracy
**Steps:**
1. Review displayed information
2. Compare with input data

**Expected:**
- ✅ Organization name matches
- ✅ Document structure matches
- ✅ Workflow count accurate
- ✅ Section count reasonable

**Actual:** _______________

---

### Test 8.3: Go to Dashboard
**Steps:**
1. Click "Go to Dashboard"
2. Verify navigation

**Expected:**
- ✅ Navigate to main app
- ✅ Setup session cleared
- ✅ Can access all features
- ✅ Cannot return to setup

**Actual:** _______________

---

## 9. Navigation & Session Tests

### Test 9.1: Progress Indicator
**Steps:**
1. Go through each step
2. Check progress indicator

**Expected:**
- ✅ Current step highlighted
- ✅ Completed steps marked
- ✅ Future steps grayed out
- ✅ Visual progress clear

**Actual:** _______________

---

### Test 9.2: Go Back and Edit
**Steps:**
1. Complete organization step
2. Go to document type
3. Click browser back button
4. Edit organization name
5. Continue forward

**Expected:**
- ✅ Can go back
- ✅ Previous data loaded
- ✅ Changes saved
- ✅ Continue where left off

**Actual:** _______________

---

### Test 9.3: Session Persistence
**Steps:**
1. Fill organization form
2. Close browser
3. Reopen and navigate to `/setup`

**Expected:**
- ✅ Session data preserved (if applicable)
- ✅ Can resume or restart
- ✅ No data loss

**Actual:** _______________

---

### Test 9.4: Refresh Page During Setup
**Steps:**
1. Fill form partially
2. Refresh page (F5)
3. Check form state

**Expected:**
- ✅ Form data preserved
- ✅ No errors
- ✅ Can continue

**Actual:** _______________

---

## 10. Error Handling Tests

### Test 10.1: Network Error During Upload
**Steps:**
1. Simulate network disconnection
2. Try to upload file

**Expected:**
- ✅ Error message displayed
- ✅ "Network error" or similar
- ✅ Can retry
- ✅ No crash

**Actual:** _______________

---

### Test 10.2: Database Connection Error
**Steps:**
1. Stop Supabase connection
2. Try to continue setup

**Expected:**
- ✅ Friendly error message
- ✅ "Unable to connect" message
- ✅ Retry option
- ✅ No sensitive info exposed

**Actual:** _______________

---

### Test 10.3: Invalid File Content
**Steps:**
1. Upload corrupted .docx file
2. Attempt to process

**Expected:**
- ✅ "Unable to read file" error
- ✅ Can select different file
- ✅ No crash

**Actual:** _______________

---

### Test 10.4: Server Timeout
**Steps:**
1. Simulate very slow server
2. Try to submit form

**Expected:**
- ✅ Timeout message after reasonable wait
- ✅ Option to retry
- ✅ Loading state ends

**Actual:** _______________

---

## 11. Accessibility Tests

### Test 11.1: Keyboard Navigation
**Steps:**
1. Use only keyboard (Tab, Enter, Space)
2. Navigate through entire setup

**Expected:**
- ✅ All fields reachable
- ✅ Tab order logical
- ✅ Focus indicators visible
- ✅ Can submit forms
- ✅ Can select options

**Actual:** _______________

---

### Test 11.2: Screen Reader
**Steps:**
1. Enable screen reader
2. Navigate setup

**Expected:**
- ✅ All labels read
- ✅ Errors announced
- ✅ Required fields indicated
- ✅ Progress announced

**Actual:** _______________

---

### Test 11.3: Color Contrast
**Steps:**
1. Check text readability
2. Use contrast checker tool

**Expected:**
- ✅ Text meets WCAG AA (4.5:1)
- ✅ Interactive elements clear
- ✅ Error messages readable

**Actual:** _______________

---

### Test 11.4: Focus Management
**Steps:**
1. Tab through forms
2. Check focus after errors

**Expected:**
- ✅ Focus on first error
- ✅ Focus visible
- ✅ Logical flow

**Actual:** _______________

---

## 12. Mobile Responsive Tests

### Test 12.1: Mobile Layout (375px)
**Steps:**
1. Resize to 375px width
2. Check all screens

**Expected:**
- ✅ No horizontal scroll
- ✅ All content visible
- ✅ Buttons tappable
- ✅ Forms usable

**Actual:** _______________

---

### Test 12.2: Tablet Layout (768px)
**Steps:**
1. Resize to 768px width
2. Check layout

**Expected:**
- ✅ Responsive grid
- ✅ Touch targets 44px+
- ✅ Readable text
- ✅ Proper spacing

**Actual:** _______________

---

### Test 12.3: Touch Interactions
**Steps:**
1. Use touch device
2. Test drag-and-drop
3. Test file selection

**Expected:**
- ✅ Touch targets large enough
- ✅ Drag-drop works or alternative
- ✅ File picker accessible
- ✅ No hover-only features

**Actual:** _______________

---

## 13. Security Tests

### Test 13.1: CSRF Protection
**Steps:**
1. Inspect form submissions
2. Check for CSRF tokens

**Expected:**
- ✅ CSRF token present
- ✅ Token validated server-side
- ✅ Rejection without token

**Actual:** _______________

---

### Test 13.2: File Upload Security
**Steps:**
1. Try uploading .exe file renamed to .docx
2. Check rejection

**Expected:**
- ✅ File type validated by content
- ✅ Malicious files rejected
- ✅ No arbitrary code execution

**Actual:** _______________

---

### Test 13.3: SQL Injection Prevention
**Steps:**
1. Enter `'; DROP TABLE organizations; --` in org name
2. Submit form

**Expected:**
- ✅ Treated as string
- ✅ No SQL execution
- ✅ Properly escaped

**Actual:** _______________

---

### Test 13.4: XSS Prevention
**Steps:**
1. Enter `<script>alert('XSS')</script>` in fields
2. Check output

**Expected:**
- ✅ Script tags escaped
- ✅ No script execution
- ✅ Displayed as text

**Actual:** _______________

---

## 14. Performance Tests

### Test 14.1: Page Load Time
**Steps:**
1. Clear cache
2. Load each setup page
3. Measure load time

**Expected:**
- ✅ All pages < 2 seconds
- ✅ No blocking resources
- ✅ Progressive rendering

**Actual:** _______________

---

### Test 14.2: File Upload Speed
**Steps:**
1. Upload 5MB file
2. Measure upload time

**Expected:**
- ✅ Upload completes < 10 seconds
- ✅ Progress indication
- ✅ No timeout

**Actual:** _______________

---

### Test 14.3: Processing Time
**Steps:**
1. Complete import
2. Measure processing duration

**Expected:**
- ✅ Complete in < 60 seconds
- ✅ Realistic progress estimates
- ✅ No hanging

**Actual:** _______________

---

## Test Summary

**Date Tested:** _______________
**Tested By:** _______________
**Environment:** _______________

### Overall Results
- Total Tests: 100+
- Passed: _____
- Failed: _____
- Blocked: _____
- Skipped: _____

### Critical Issues Found
1. _______________
2. _______________
3. _______________

### Recommendations
1. _______________
2. _______________
3. _______________

### Sign-off
- [ ] All critical tests passed
- [ ] No blocking issues
- [ ] Ready for deployment

**Signature:** _______________ **Date:** _______________
