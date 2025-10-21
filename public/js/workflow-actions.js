/**
 * Workflow Actions JavaScript
 * Handles approval, rejection, and locking of sections
 */

// Show toast notification
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;

  const toastId = 'toast-' + Date.now();
  const iconClass = type === 'success' ? 'check-circle-fill' : type === 'danger' ? 'x-circle-fill' : 'info-circle-fill';
  const bgClass = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-info';

  const toastHTML = `
    <div class="toast align-items-center text-white ${bgClass} border-0" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <i class="bi bi-${iconClass} me-2"></i>${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  toastContainer.insertAdjacentHTML('beforeend', toastHTML);

  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
  toast.show();

  // Remove from DOM after hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

// Approve section with confirmation
async function approveSection(sectionId) {
  // Show confirmation dialog first
  const confirmed = await showConfirmDialog({
    title: 'Approve Section',
    message: 'Are you sure you want to approve this section? This action will move the section to the next workflow stage.',
    confirmText: 'Approve',
    confirmClass: 'btn-success',
    icon: 'check-circle',
    showNotesInput: true,
    notesLabel: 'Approval notes (optional):'
  });

  if (!confirmed) {
    return;
  }

  const notes = confirmed.notes || null;

  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });

    const data = await response.json();

    if (data.success) {
      showToast('Section approved successfully', 'success');
      await refreshSectionStatus(sectionId);
      // Call the comprehensive refresh function if available
      if (typeof window.refreshWorkflowProgress === 'function') {
        window.refreshWorkflowProgress(window.documentId || document.querySelector('[data-document-id]')?.dataset.documentId);
      }
    } else {
      if (data.code === 'SECTION_NOT_LOCKED') {
        showToast('⚠️ Please lock a suggestion before approving', 'warning');
      } else {
        showToast('Error: ' + (data.error || 'Failed to approve section'), 'danger');
      }
    }
  } catch (error) {
    console.error('Error approving section:', error);
    showToast('An error occurred while approving the section', 'danger');
  }
}

// Reject section with confirmation
async function rejectSection(sectionId) {
  // Show confirmation dialog with required reason input
  const confirmed = await showConfirmDialog({
    title: 'Reject Section',
    message: 'Are you sure you want to reject this section? The section will be sent back for revision.',
    confirmText: 'Reject',
    confirmClass: 'btn-danger',
    icon: 'x-circle',
    showNotesInput: true,
    notesLabel: 'Reason for rejection (required):',
    notesRequired: true,
    notesPlaceholder: 'Please provide a clear reason for rejection...'
  });

  if (!confirmed) {
    return;
  }

  const reason = confirmed.notes;

  if (!reason || !reason.trim()) {
    showToast('Rejection reason is required', 'danger');
    return;
  }

  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();

    if (data.success) {
      showToast('Section rejected', 'success');
      await refreshSectionStatus(sectionId);
      // Call the comprehensive refresh function if available
      if (typeof window.refreshWorkflowProgress === 'function') {
        window.refreshWorkflowProgress(window.documentId || document.querySelector('[data-document-id]')?.dataset.documentId);
      }
    } else {
      showToast('Error: ' + (data.error || 'Failed to reject section'), 'danger');
    }
  } catch (error) {
    console.error('Error rejecting section:', error);
    showToast('An error occurred while rejecting the section', 'danger');
  }
}

// Lock section with selected suggestion and confirmation
async function lockSection(sectionId) {
  const suggestionId = getSelectedSuggestion(sectionId);

  if (!suggestionId) {
    showToast('Please select a suggestion to lock', 'danger');
    return;
  }

  // Show confirmation dialog
  const confirmed = await showConfirmDialog({
    title: 'Lock Section',
    message: 'Are you sure you want to lock this section? Once locked, no further edits can be made until unlocked by an administrator.',
    confirmText: 'Lock Section',
    confirmClass: 'btn-primary',
    icon: 'lock-fill',
    showNotesInput: true,
    notesLabel: 'Lock notes (optional):'
  });

  if (!confirmed) {
    return;
  }

  const notes = confirmed.notes || null;

  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestionId,
        notes
      })
    });

    const data = await response.json();

    if (data.success) {
      showToast('Section locked successfully', 'success');
      await refreshSectionStatus(sectionId);
      // Call the comprehensive refresh function if available
      if (typeof window.refreshWorkflowProgress === 'function') {
        window.refreshWorkflowProgress(window.documentId || document.querySelector('[data-document-id]')?.dataset.documentId);
      }
    } else {
      showToast('Error: ' + (data.error || 'Failed to lock section'), 'danger');
    }
  } catch (error) {
    console.error('Error locking section:', error);
    showToast('An error occurred while locking the section', 'danger');
  }
}

// Get selected suggestion for a section
function getSelectedSuggestion(sectionId) {
  // This will be implemented when suggestion selection UI is added
  // For now, return null to indicate no suggestion selected
  console.warn('Suggestion selection not yet implemented');
  return null;
}

// Refresh section workflow status
async function refreshSectionStatus(sectionId) {
  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/state`);
    const data = await response.json();

    if (data.success) {
      // Check if the global function exists before calling
      if (typeof window.updateSectionWorkflowBadge === 'function') {
        window.updateSectionWorkflowBadge(sectionId, data);
      } else {
        console.warn('updateSectionWorkflowBadge function not available');
      }
    }
  } catch (error) {
    console.error('Error refreshing section status:', error);
  }
}

// View approval history for a section
async function viewApprovalHistory(sectionId) {
  try {
    const response = await fetch(`/api/workflow/sections/${sectionId}/history`);
    const data = await response.json();

    if (data.success) {
      showApprovalHistoryModal(data.history, sectionId);
    } else {
      showToast('Error loading approval history', 'danger');
    }
  } catch (error) {
    console.error('Error loading approval history:', error);
    showToast('An error occurred while loading approval history', 'danger');
  }
}

// Show approval history modal
function showApprovalHistoryModal(history, sectionId) {
  const timeline = document.getElementById('approvalHistoryTimeline');
  if (!timeline) return;

  if (!history || history.length === 0) {
    timeline.innerHTML = `
      <div class="text-center text-muted py-3">
        <i class="bi bi-inbox"></i>
        <p class="mb-0">No approval history yet</p>
      </div>
    `;
  } else {
    let historyHTML = '';

    history.forEach(item => {
      const date = new Date(item.actioned_at).toLocaleString();
      const statusClass = item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : '';
      const icon = item.status === 'approved' ? 'check-circle-fill' : item.status === 'rejected' ? 'x-circle-fill' : 'clock-history';

      historyHTML += `
        <div class="approval-history-item ${statusClass}">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h6 class="mb-1">
                <i class="bi bi-${icon} me-2"></i>
                ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </h6>
              <p class="mb-1">
                <strong>${item.actioned_by_email || 'Unknown user'}</strong>
                ${item.stage_name ? ' - ' + item.stage_name : ''}
              </p>
              ${item.approval_metadata?.notes ? `
                <p class="mb-1 text-muted small">
                  <em>"${item.approval_metadata.notes}"</em>
                </p>
              ` : ''}
              <small class="text-muted">
                <i class="bi bi-calendar me-1"></i>${date}
              </small>
            </div>
          </div>
        </div>
      `;
    });

    timeline.innerHTML = historyHTML;
  }

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('approvalHistoryModal'));
  modal.show();
}

// Show confirmation dialog with Bootstrap modal
function showConfirmDialog(options) {
  return new Promise((resolve) => {
    const {
      title = 'Confirm Action',
      message = 'Are you sure you want to proceed?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmClass = 'btn-primary',
      icon = 'exclamation-triangle',
      showNotesInput = false,
      notesLabel = 'Notes:',
      notesRequired = false,
      notesPlaceholder = ''
    } = options;

    // Create modal HTML
    const modalId = 'confirmModal-' + Date.now();
    const modalHTML = `
      <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="${modalId}Label">
                <i class="bi bi-${icon} me-2"></i>${title}
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p>${message}</p>
              ${showNotesInput ? `
                <div class="mt-3">
                  <label for="${modalId}-notes" class="form-label">
                    ${notesLabel}
                    ${notesRequired ? '<span class="text-danger">*</span>' : ''}
                  </label>
                  <textarea
                    class="form-control"
                    id="${modalId}-notes"
                    rows="3"
                    placeholder="${notesPlaceholder}"
                    ${notesRequired ? 'required' : ''}
                  ></textarea>
                  ${notesRequired ? '<div class="invalid-feedback">This field is required</div>' : ''}
                </div>
              ` : ''}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${cancelText}</button>
              <button type="button" class="btn ${confirmClass}" id="${modalId}-confirm">${confirmText}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);

    // Handle confirm button
    const confirmBtn = document.getElementById(`${modalId}-confirm`);
    const notesInput = showNotesInput ? document.getElementById(`${modalId}-notes`) : null;

    confirmBtn.addEventListener('click', () => {
      // Validate notes if required
      if (notesRequired && notesInput) {
        const value = notesInput.value.trim();
        if (!value) {
          notesInput.classList.add('is-invalid');
          notesInput.focus();
          return;
        }
      }

      const result = {
        confirmed: true,
        notes: notesInput ? notesInput.value.trim() : null
      };

      modal.hide();
      resolve(result);
    });

    // Handle cancel/close
    modalElement.addEventListener('hidden.bs.modal', () => {
      // Remove from DOM
      modalElement.remove();

      // If not already resolved, resolve with false
      if (!confirmBtn.dataset.clicked) {
        resolve(false);
      }
    });

    // Mark as clicked when confirm is pressed
    confirmBtn.addEventListener('click', () => {
      confirmBtn.dataset.clicked = 'true';
    });

    // Remove invalid class on input
    if (notesInput) {
      notesInput.addEventListener('input', () => {
        notesInput.classList.remove('is-invalid');
      });
    }

    // Show modal
    modal.show();
  });
}

/**
 * PHASE 2: Refresh section UI after lock (no page reload required)
 * @param {string} sectionId - Section UUID
 * @param {Object} lockData - Response data from lock endpoint
 */
async function refreshSectionAfterLock(sectionId, lockData) {
  const sectionElement = document.querySelector(`#section-${sectionId}`);
  if (!sectionElement) {
    console.warn('Section element not found:', sectionId);
    return;
  }

  // 1. Update section header badges
  updateSectionHeaderBadges(sectionElement, lockData.section);

  // 2. Update section content text
  updateSectionContent(sectionElement, lockData.section);

  // 3. Update workflow action buttons
  updateWorkflowActions(sectionElement, sectionId, lockData.workflow);

  // 4. Update suggestions list (disable radios, highlight selected)
  updateSuggestionsListAfterLock(sectionElement, sectionId, lockData.suggestions, lockData.section);

  // 5. Update workflow status badge
  const workflowData = {
    success: true,
    state: { status: 'locked' },
    stage: lockData.workflow.stage,
    permissions: {
      canApprove: lockData.workflow.canApprove,
      canLock: lockData.workflow.canLock,
      canEdit: lockData.workflow.canEdit
    },
    section: lockData.section
  };

  // Call the existing updateSectionWorkflowBadge if it exists globally
  if (typeof window.updateSectionWorkflowBadge === 'function') {
    window.updateSectionWorkflowBadge(sectionId, workflowData);
  }

  // 6. Show locked alert box
  showLockedAlert(sectionElement, lockData.section);

  // 7. Scroll to section with smooth animation
  sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // 8. Add visual feedback (brief highlight)
  sectionElement.classList.add('section-updated');
  setTimeout(() => {
    sectionElement.classList.remove('section-updated');
  }, 2000);
}

/**
 * Update section header badges (Locked, Amended)
 */
function updateSectionHeaderBadges(sectionElement, sectionData) {
  // Find the badge container in the section header
  const headerDiv = sectionElement.querySelector('.d-flex.align-items-center.mb-2');
  if (!headerDiv) return;

  // Remove existing lock and amended badges
  const existingLockBadge = headerDiv.querySelector('.badge.bg-primary');
  const existingAmendedBadge = headerDiv.querySelector('.badge.bg-success');
  if (existingLockBadge && existingLockBadge.textContent.includes('Locked')) {
    existingLockBadge.remove();
  }
  if (existingAmendedBadge && existingAmendedBadge.textContent.includes('Amended')) {
    existingAmendedBadge.remove();
  }

  // Add "Locked" badge
  if (sectionData.is_locked) {
    const lockedBadge = document.createElement('span');
    lockedBadge.className = 'ms-2 badge bg-primary';
    lockedBadge.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Locked';
    headerDiv.appendChild(lockedBadge);
  }

  // Add "Amended" badge if text changed
  if (sectionData.locked_text && sectionData.original_text &&
      sectionData.locked_text !== sectionData.original_text) {
    const amendedBadge = document.createElement('span');
    amendedBadge.className = 'ms-2 badge bg-success';
    amendedBadge.innerHTML = '<i class="bi bi-pencil-square me-1"></i>Amended';
    headerDiv.appendChild(amendedBadge);
  }
}

/**
 * Update section content text
 */
function updateSectionContent(sectionElement, sectionData) {
  const contentDiv = sectionElement.querySelector('.section-text-full');
  if (!contentDiv) return;

  contentDiv.textContent = sectionData.locked_text || sectionData.current_text;
}

/**
 * Update workflow action buttons based on new permissions
 */
function updateWorkflowActions(sectionElement, sectionId, workflowData) {
  const actionsContainer = document.getElementById(`approval-actions-${sectionId}`);
  if (!actionsContainer) return;

  const actionsDiv = actionsContainer.querySelector('.approval-actions');
  if (!actionsDiv) return;

  let actionsHTML = '';

  // Approve button (enabled after lock if user has permission)
  if (workflowData.canApprove) {
    actionsHTML += `
      <button class="btn btn-success btn-sm" onclick="approveSection('${sectionId}')">
        <i class="bi bi-check-circle me-1"></i>Approve
      </button>
    `;
  }

  // Lock button (disabled after lock)
  actionsHTML += `
    <button class="btn btn-secondary btn-sm" disabled>
      <i class="bi bi-lock me-1"></i>Locked
    </button>
    <small class="text-muted d-block mt-1">Section is locked and ready for approval</small>
  `;

  actionsDiv.innerHTML = actionsHTML;
  actionsContainer.style.display = 'block';
}

/**
 * Update suggestions list to show selection and disable editing
 */
function updateSuggestionsListAfterLock(sectionElement, sectionId, suggestions, sectionData) {
  const suggestionsDiv = document.getElementById(`suggestions-list-${sectionId}`);
  if (!suggestionsDiv) return;

  // Find all radio buttons and disable them
  const radios = suggestionsDiv.querySelectorAll('input[type="radio"]');
  radios.forEach(radio => {
    radio.disabled = true;

    // Check the selected suggestion
    const radioValue = radio.value;
    if (radioValue === 'original' && !sectionData.selected_suggestion_id) {
      radio.checked = true;
      // Highlight the "Keep Original" option
      const container = radio.closest('.suggestion-item');
      if (container) {
        container.style.backgroundColor = '#e7f5ff';
        container.style.borderLeft = '4px solid #228be6';
      }
    } else if (radioValue === sectionData.selected_suggestion_id) {
      radio.checked = true;
      // Highlight the selected suggestion
      const container = radio.closest('.suggestion-item');
      if (container) {
        container.classList.add('selected-suggestion');
        container.style.backgroundColor = '#e7f5ff';
        container.style.borderLeft = '4px solid #228be6';
      }
    }
  });

  // Add a notice above the suggestions if not already present
  if (!suggestionsDiv.querySelector('.alert-info')) {
    const noticeDiv = document.createElement('div');
    noticeDiv.className = 'alert alert-info mb-2';
    noticeDiv.innerHTML = `
      <i class="bi bi-info-circle me-2"></i>
      <strong>Suggestion locked.</strong> No further changes can be made until an administrator unlocks this section.
    `;
    suggestionsDiv.insertBefore(noticeDiv, suggestionsDiv.firstChild);
  }
}

/**
 * Show locked alert in section
 */
function showLockedAlert(sectionElement, sectionData) {
  const contentDiv = sectionElement.querySelector('.section-content');
  if (!contentDiv) return;

  // Remove existing alert
  const existingAlert = contentDiv.querySelector('.locked-alert');
  if (existingAlert) existingAlert.remove();

  // Create new alert
  const alert = document.createElement('div');
  alert.className = 'alert alert-info locked-alert mb-3';

  const hasChanges = sectionData.locked_text !== sectionData.original_text;

  alert.innerHTML = `
    <div class="d-flex align-items-center justify-content-between">
      <div>
        <i class="bi bi-lock-fill me-2"></i>
        <strong>Section Locked</strong>
        ${hasChanges ? `
          <button class="btn btn-sm btn-outline-primary ms-3"
                  onclick="showDiffView('${sectionData.id}', event)">
            <i class="bi bi-eye"></i> Show Changes
          </button>
        ` : `
          <span class="text-muted ms-2">Original text locked without changes</span>
        `}
      </div>
      <small class="text-muted">
        Locked ${new Date(sectionData.locked_at).toLocaleString()}
      </small>
    </div>
  `;

  contentDiv.insertBefore(alert, contentDiv.firstChild);
}

// Export functions for use in document-viewer.ejs
if (typeof window !== 'undefined') {
  window.approveSection = approveSection;
  window.rejectSection = rejectSection;
  window.lockSection = lockSection;
  window.viewApprovalHistory = viewApprovalHistory;
  window.showToast = showToast;
  window.showConfirmDialog = showConfirmDialog;
  // PHASE 2: Export refresh functions
  window.refreshSectionAfterLock = refreshSectionAfterLock;
  window.updateSectionHeaderBadges = updateSectionHeaderBadges;
  window.updateSectionContent = updateSectionContent;
  window.updateWorkflowActions = updateWorkflowActions;
  window.updateSuggestionsListAfterLock = updateSuggestionsListAfterLock;
  window.showLockedAlert = showLockedAlert;
}
