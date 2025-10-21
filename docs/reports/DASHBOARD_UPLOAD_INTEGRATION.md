# Dashboard Upload Modal - Integration Guide

## Quick Integration Steps

The upload modal HTML and JavaScript have been created in a separate file for easy integration:

**File**: `/views/admin/dashboard-upload-modal.html`

### Step 1: Add Upload Button to Quick Actions

Find this section in `/views/admin/dashboard.ejs`:

```html
<h5 class="mb-3">Quick Actions</h5>
<div class="d-flex gap-2 flex-wrap">
  <a href="/admin/workflows" class="btn btn-outline-primary">
    <i class="bi bi-diagram-3"></i> Manage Workflows
  </a>
```

Add this button as the FIRST button in the div:

```html
<button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#uploadDocumentModal">
  <i class="bi bi-file-earmark-arrow-up"></i> Upload Document
</button>
```

### Step 2: Add Modal Before Closing Scripts

Find this section near the bottom of `/views/admin/dashboard.ejs` (before the `<script>` tags):

```html
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script>
```

Insert the entire contents of `dashboard-upload-modal.html` right before the closing `</div></div>`.

### Complete Integration Example

```html
    </div> <!-- End of org-table -->
  </div> <!-- End of container -->

  <!-- ========================= -->
  <!-- INSERT MODAL HERE -->
  <!-- ========================= -->
  <div class="modal fade" id="uploadDocumentModal" ...>
    <!-- Full modal from dashboard-upload-modal.html -->
  </div>

  <!-- Modal script -->
  <script>
    // Upload handler from dashboard-upload-modal.html
  </script>

  <!-- Existing scripts -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    function deleteOrganization(orgId, orgName) {
      // Existing code...
    }
  </script>
</body>
</html>
```

## Verification

After integration, verify:

1. ✅ Upload button appears in Quick Actions
2. ✅ Clicking button opens modal
3. ✅ File input accepts .doc/.docx only
4. ✅ Upload progress bar appears
5. ✅ Success/error messages display correctly
6. ✅ Page reloads after successful upload

## Testing

Test with a sample .docx file:

```bash
# 1. Login as admin
# 2. Navigate to /admin/dashboard
# 3. Click "Upload Document"
# 4. Select test.docx
# 5. Click "Upload Document" in modal
# 6. Verify progress indicator
# 7. Verify success message
# 8. Check document appears in organization
```

## Troubleshooting

**Modal doesn't open**:
- Verify Bootstrap JS is loaded
- Check browser console for errors
- Ensure modal ID matches button target

**Upload fails**:
- Check server logs for errors
- Verify organization is selected
- Confirm user has admin role

**Progress bar not showing**:
- Check XHR upload event listeners
- Verify progressDiv display logic

## API Endpoint

The upload route is already implemented at:
- **POST** `/admin/documents/upload`
- **Middleware**: `requireAdmin`
- **Max Size**: 10MB
- **Allowed Types**: `.doc`, `.docx`

## Files Created

1. `/src/routes/admin.js` - Upload route handler (✅ Complete)
2. `/views/admin/dashboard-upload-modal.html` - Modal HTML + JS (✅ Complete)
3. `/docs/reports/SPRINT0_DOCUMENT_UPLOAD.md` - Full documentation (✅ Complete)

## Next Steps

After integrating the modal:

1. Restart server: `npm start`
2. Test upload with sample document
3. Verify sections created in database
4. Check dashboard shows new document
5. Test error scenarios (large file, wrong type)

---

**Status**: Ready for integration
**Estimated Integration Time**: 5 minutes
