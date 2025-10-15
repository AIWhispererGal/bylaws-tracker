/**
 * Workflow Template Editor
 * Handles workflow template creation and editing with drag-and-drop stage reordering
 */

let stageCounter = 0;
let sortable = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeSortable();
  initializeFormSubmit();

  // Initialize color pickers
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('stage-color')) {
      const swatch = e.target.parentElement.querySelector('.color-swatch');
      if (swatch) {
        swatch.style.backgroundColor = e.target.value;
      }
    }
  });
});

/**
 * Initialize SortableJS for drag-and-drop stage reordering
 */
function initializeSortable() {
  const stagesList = document.getElementById('stagesList');
  if (!stagesList) return;

  sortable = Sortable.create(stagesList, {
    animation: 150,
    handle: '.handle',
    ghostClass: 'sortable-drag',
    onEnd: updateStageOrders
  });
}

/**
 * Update stage order numbers after drag-and-drop
 */
function updateStageOrders() {
  const stages = document.querySelectorAll('.stage-item');
  stages.forEach((stage, index) => {
    const orderBadge = stage.querySelector('.stage-order-badge');
    if (orderBadge) {
      orderBadge.textContent = index + 1;
    }
    stage.dataset.stageOrder = index + 1;
  });
}

/**
 * Add a new stage to the workflow
 */
function addStage() {
  const stagesList = document.getElementById('stagesList');
  const emptyMessage = stagesList.querySelector('.text-muted');
  if (emptyMessage) {
    emptyMessage.remove();
  }

  const stageOrder = stagesList.children.length + 1;
  const stageId = `new-${Date.now()}-${stageCounter++}`;

  const stageHtml = `
    <div class="stage-item" data-stage-id="${stageId}" data-stage-order="${stageOrder}">
      <div class="stage-header" onclick="toggleStageContent(this)">
        <div class="d-flex align-items-center gap-3">
          <span class="handle"><i class="bi bi-grip-vertical"></i></span>
          <span class="stage-order-badge">${stageOrder}</span>
          <strong class="stage-name-display">New Stage</strong>
        </div>
        <div>
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="deleteStage(this, event)">
            <i class="bi bi-trash"></i>
          </button>
          <i class="bi bi-chevron-down toggle-icon"></i>
        </div>
      </div>

      <div class="stage-content show">
        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Stage Name <span class="required-indicator">*</span></label>
            <input type="text" class="form-control stage-name" value="" required
                   onchange="updateStageDisplay(this)">
          </div>

          <div class="col-md-6 mb-3">
            <label class="form-label">Display Color</label>
            <div class="d-flex align-items-center gap-2">
              <input type="color" class="form-control form-control-color stage-color" value="#6c757d">
              <span class="color-swatch" style="background-color: #6c757d"></span>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Icon</label>
            <input type="text" class="form-control stage-icon" value=""
                   placeholder="e.g., check-circle">
            <small class="text-muted">Bootstrap icon name (without 'bi-' prefix)</small>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Description</label>
          <textarea class="form-control stage-description" rows="2"></textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Permissions</label>
          <div class="permission-grid">
            <div class="form-check">
              <input class="form-check-input stage-can-lock" type="checkbox">
              <label class="form-check-label">Can Lock Sections</label>
            </div>
            <div class="form-check">
              <input class="form-check-input stage-can-edit" type="checkbox" checked>
              <label class="form-check-label">Can Edit Content</label>
            </div>
            <div class="form-check">
              <input class="form-check-input stage-can-approve" type="checkbox">
              <label class="form-check-label">Can Approve/Reject</label>
            </div>
            <div class="form-check">
              <input class="form-check-input stage-requires-approval" type="checkbox">
              <label class="form-check-label">Requires Approval</label>
            </div>
          </div>
        </div>

        <div class="mb-3">
          <label class="form-label">Required Roles</label>
          <select class="form-select stage-roles" multiple size="4">
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member" selected>Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <small class="text-muted">Hold Ctrl/Cmd to select multiple roles</small>
        </div>
      </div>
    </div>
  `;

  stagesList.insertAdjacentHTML('beforeend', stageHtml);

  // Auto-focus on new stage name input
  const newStage = stagesList.lastElementChild;
  const nameInput = newStage.querySelector('.stage-name');
  if (nameInput) {
    nameInput.focus();
  }
}

/**
 * Delete a stage with confirmation
 */
function deleteStage(button, event) {
  event.stopPropagation();

  if (!confirm('Are you sure you want to delete this stage?')) {
    return;
  }

  const stageItem = button.closest('.stage-item');
  stageItem.remove();

  // Update remaining stage orders
  updateStageOrders();

  // Show empty message if no stages left
  const stagesList = document.getElementById('stagesList');
  if (stagesList.children.length === 0) {
    stagesList.innerHTML = '<p class="text-muted text-center">No stages defined. Click "Add Stage" to create your first stage.</p>';
  }
}

/**
 * Toggle stage content visibility
 */
function toggleStageContent(header) {
  // Don't toggle if clicking on delete button
  if (event.target.closest('.btn-outline-danger')) {
    return;
  }

  const stageItem = header.closest('.stage-item');
  const content = stageItem.querySelector('.stage-content');
  const icon = header.querySelector('.toggle-icon');

  content.classList.toggle('show');
  icon.classList.toggle('bi-chevron-down');
  icon.classList.toggle('bi-chevron-up');
}

/**
 * Update stage display name when input changes
 */
function updateStageDisplay(input) {
  const stageItem = input.closest('.stage-item');
  const displayName = stageItem.querySelector('.stage-name-display');
  if (displayName) {
    displayName.textContent = input.value || 'New Stage';
  }
}

/**
 * Initialize form submission
 */
function initializeFormSubmit() {
  const form = document.getElementById('workflowForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateTemplate()) {
      return;
    }

    const templateData = collectTemplateData();

    try {
      const url = window.templateId
        ? `/api/workflows/${window.templateId}`
        : '/api/workflows';
      const method = window.templateId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      const result = await response.json();

      if (result.success) {
        showToast('Template saved successfully!', 'success');
        setTimeout(() => {
          window.location.href = '/admin/workflows';
        }, 1500);
      } else {
        showToast('Error: ' + result.error, 'danger');
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Error saving template', 'danger');
    }
  });
}

/**
 * Validate template before saving
 */
function validateTemplate() {
  const name = document.getElementById('templateName').value.trim();
  if (!name) {
    showToast('Please enter a template name', 'warning');
    document.getElementById('templateName').focus();
    return false;
  }

  const stages = document.querySelectorAll('.stage-item');
  if (stages.length === 0) {
    showToast('Please add at least one workflow stage', 'warning');
    return false;
  }

  // Validate each stage has a name
  for (let i = 0; i < stages.length; i++) {
    const stageName = stages[i].querySelector('.stage-name').value.trim();
    if (!stageName) {
      showToast(`Stage ${i + 1} needs a name`, 'warning');
      stages[i].querySelector('.stage-name').focus();
      return false;
    }
  }

  return true;
}

/**
 * Collect all template data from form
 */
function collectTemplateData() {
  const stages = [];
  const stageItems = document.querySelectorAll('.stage-item');

  stageItems.forEach((item, index) => {
    const rolesSelect = item.querySelector('.stage-roles');
    const selectedRoles = Array.from(rolesSelect.selectedOptions).map(opt => opt.value);

    stages.push({
      id: item.dataset.stageId.startsWith('new-') ? null : item.dataset.stageId,
      stage_name: item.querySelector('.stage-name').value.trim(),
      stage_order: index + 1,
      description: item.querySelector('.stage-description').value.trim(),
      display_color: item.querySelector('.stage-color').value,
      icon: item.querySelector('.stage-icon').value.trim(),
      can_lock: item.querySelector('.stage-can-lock').checked,
      can_edit: item.querySelector('.stage-can-edit').checked,
      can_approve: item.querySelector('.stage-can-approve').checked,
      requires_approval: item.querySelector('.stage-requires-approval').checked,
      required_roles: selectedRoles
    });
  });

  return {
    name: document.getElementById('templateName').value.trim(),
    description: document.getElementById('templateDescription').value.trim(),
    is_active: document.getElementById('isActive').checked,
    stages: stages
  };
}

/**
 * Load workflow template data (called from page)
 */
function loadWorkflowTemplate(templateId) {
  if (!templateId || !window.templateData) return;

  // Template info is already loaded by EJS
  // This function is for future AJAX-based loading if needed
}

/**
 * Delete current template
 */
async function deleteTemplate() {
  if (!window.templateId) return;

  if (!confirm('Are you sure you want to delete this template?\n\nThis action cannot be undone.')) {
    return;
  }

  const confirmText = prompt('Type "DELETE" to confirm deletion:');
  if (confirmText !== 'DELETE') {
    showToast('Deletion cancelled', 'info');
    return;
  }

  try {
    const response = await fetch(`/api/workflows/${window.templateId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const result = await response.json();

    if (result.success) {
      showToast('Template deleted successfully', 'success');
      setTimeout(() => {
        window.location.href = '/admin/workflows';
      }, 1500);
    } else {
      showToast('Error: ' + result.error, 'danger');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Error deleting template', 'danger');
  }
}

/**
 * Show toast notification
 */
function showToast(message, type) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  container.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast);
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}
