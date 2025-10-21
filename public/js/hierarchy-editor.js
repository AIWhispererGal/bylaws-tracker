/**
 * Hierarchy Editor JavaScript
 * Manages 10-level document hierarchy configuration
 */

class HierarchyEditor {
  constructor(options) {
    this.documentId = options.documentId;
    this.documentTitle = options.documentTitle;
    this.organizationId = options.organizationId;

    this.currentHierarchy = null;
    this.originalHierarchy = null;
    this.templates = {};

    // Numbering type options
    this.numberingTypes = {
      'roman': 'Roman (I, II, III...)',
      'numeric': 'Numeric (1, 2, 3...)',
      'alpha': 'Alpha Upper (A, B, C...)',
      'alphaLower': 'Alpha Lower (a, b, c...)'
    };
  }

  async init() {
    // Bind event handlers
    this.bindEvents();

    // Load templates
    await this.loadTemplates();

    // Load current hierarchy
    await this.loadCurrent();

    // Render hierarchy table
    this.renderTable();

    // Update preview
    this.updatePreview();
  }

  bindEvents() {
    // Template selector
    document.getElementById('templateSelector').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadTemplate(e.target.value);
      }
    });

    // Detect from document
    document.getElementById('detectBtn').addEventListener('click', () => {
      this.detectFromDocument();
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.save();
    });

    // Reset button
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.resetToDefault();
    });

    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', () => {
      window.location.href = `/admin/organization/${this.organizationId}`;
    });
  }

  async loadTemplates() {
    try {
      const response = await fetch('/admin/hierarchy-templates');
      const data = await response.json();

      if (data.success) {
        this.templates = {};
        data.templates.forEach(template => {
          this.templates[template.id] = template;
        });
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      showToast('Failed to load templates', 'danger');
    }
  }

  async loadCurrent() {
    try {
      const response = await fetch(`/admin/documents/${this.documentId}/hierarchy`);
      const data = await response.json();

      if (data.success) {
        this.currentHierarchy = data.hierarchy;
        this.originalHierarchy = JSON.parse(JSON.stringify(data.hierarchy));

        // If no hierarchy, use standard bylaws template as default
        if (!this.currentHierarchy.levels || this.currentHierarchy.levels.length === 0) {
          this.currentHierarchy = this.templates['standard-bylaws'];
        }
      }
    } catch (error) {
      console.error('Error loading current hierarchy:', error);
      showToast('Failed to load current hierarchy', 'danger');

      // Fallback to standard bylaws
      this.currentHierarchy = this.templates['standard-bylaws'] || this.createDefaultHierarchy();
    }
  }

  loadTemplate(templateName) {
    const template = this.templates[templateName];
    if (!template) {
      showToast('Template not found', 'danger');
      return;
    }

    this.currentHierarchy = JSON.parse(JSON.stringify(template));
    this.renderTable();
    this.updatePreview();

    showToast(`Loaded template: ${template.name}`, 'success');
  }

  async detectFromDocument() {
    try {
      // Show loading state
      const detectBtn = document.getElementById('detectBtn');
      detectBtn.disabled = true;
      detectBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Detecting...';

      // For now, use standard bylaws as fallback
      // In future, this would analyze document_sections to detect patterns
      showToast('Detection feature coming soon. Using Standard Bylaws template.', 'info');
      this.loadTemplate('standard-bylaws');

      // Reset button
      detectBtn.disabled = false;
      detectBtn.innerHTML = '<i class="bi bi-magic"></i> Detect from Document';
    } catch (error) {
      console.error('Error detecting hierarchy:', error);
      showToast('Failed to detect hierarchy', 'danger');
    }
  }

  renderTable() {
    const tbody = document.getElementById('hierarchyTableBody');
    tbody.innerHTML = '';

    // Ensure we always have 10 levels (depths 0-9)
    if (!this.currentHierarchy.levels) {
      this.currentHierarchy.levels = [];
    }

    // Create a map of existing levels by depth
    const levelMap = {};
    this.currentHierarchy.levels.forEach(level => {
      levelMap[level.depth] = level;
    });

    // Ensure all 10 levels exist (depths 0-9)
    for (let depth = 0; depth < 10; depth++) {
      if (!levelMap[depth]) {
        // Create default level if missing
        levelMap[depth] = {
          name: `Level ${depth + 1}`,
          depth: depth,
          numbering: 'numeric',
          prefix: ''
        };
        this.currentHierarchy.levels.push(levelMap[depth]);
      }
    }

    // Sort by depth and render all 10 rows
    const levels = [...this.currentHierarchy.levels].sort((a, b) => a.depth - b.depth);

    levels.forEach((level, index) => {
      const row = this.createLevelRow(level, index);
      tbody.appendChild(row);
    });
  }

  createLevelRow(level, index) {
    const tr = document.createElement('tr');
    tr.dataset.depth = level.depth;

    // Depth column
    const depthTd = document.createElement('td');
    depthTd.className = 'text-center fw-bold';
    depthTd.textContent = level.depth;
    tr.appendChild(depthTd);

    // Name input
    const nameTd = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-control form-control-sm';
    nameInput.value = level.name;
    nameInput.dataset.field = 'name';
    nameInput.dataset.depth = level.depth;
    nameInput.addEventListener('input', () => this.updateLevelField(level.depth, 'name', nameInput.value));
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    // Numbering type select
    const numberingTd = document.createElement('td');
    const numberingSelect = document.createElement('select');
    numberingSelect.className = 'form-select form-select-sm';
    numberingSelect.dataset.field = 'numbering';
    numberingSelect.dataset.depth = level.depth;

    for (const [type, label] of Object.entries(this.numberingTypes)) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = label;
      option.selected = level.numbering === type;
      numberingSelect.appendChild(option);
    }

    numberingSelect.addEventListener('change', () => this.updateLevelField(level.depth, 'numbering', numberingSelect.value));
    numberingTd.appendChild(numberingSelect);
    tr.appendChild(numberingTd);

    // Prefix input
    const prefixTd = document.createElement('td');
    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.className = 'form-control form-control-sm';
    prefixInput.value = level.prefix || '';
    prefixInput.dataset.field = 'prefix';
    prefixInput.dataset.depth = level.depth;
    prefixInput.placeholder = 'e.g., Section';
    prefixInput.addEventListener('input', () => this.updateLevelField(level.depth, 'prefix', prefixInput.value));
    prefixTd.appendChild(prefixInput);
    tr.appendChild(prefixTd);

    // Actions column (currently just visual indicator)
    const actionsTd = document.createElement('td');
    actionsTd.className = 'text-center';
    actionsTd.innerHTML = '<i class="bi bi-grip-vertical text-muted"></i>';
    tr.appendChild(actionsTd);

    return tr;
  }

  updateLevelField(depth, field, value) {
    const level = this.currentHierarchy.levels.find(l => l.depth === depth);
    if (level) {
      level[field] = value;
      this.updatePreview();
    }
  }

  updatePreview() {
    const preview = document.getElementById('hierarchyPreview');

    if (!this.currentHierarchy.levels || this.currentHierarchy.levels.length === 0) {
      preview.innerHTML = '<p class="text-muted">Configure hierarchy levels to see preview</p>';
      return;
    }

    const levels = [...this.currentHierarchy.levels].sort((a, b) => a.depth - b.depth);

    let html = '<div class="preview-hierarchy">';

    levels.forEach((level, index) => {
      const indent = level.depth * 20;
      const exampleNumber = this.formatExampleNumber(level.numbering, index + 1);
      const displayText = `${level.prefix}${exampleNumber}`;

      html += `
        <div class="preview-level" style="margin-left: ${indent}px;">
          <span class="preview-number">${displayText}</span>
          <span class="preview-name text-muted">${level.name}</span>
        </div>
      `;
    });

    html += '</div>';

    preview.innerHTML = html;
  }

  formatExampleNumber(type, num) {
    switch (type) {
      case 'roman':
        return this.toRoman(num);
      case 'numeric':
        return num.toString();
      case 'alpha':
        return String.fromCharCode(64 + num);
      case 'alphaLower':
        return String.fromCharCode(96 + num);
      default:
        return num.toString();
    }
  }

  toRoman(num) {
    const romanNumerals = [
      ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
    ];
    let result = '';
    for (const [roman, value] of romanNumerals) {
      while (num >= value) {
        result += roman;
        num -= value;
      }
    }
    return result;
  }

  validate() {
    // Check for 10 levels
    if (!this.currentHierarchy.levels || this.currentHierarchy.levels.length !== 10) {
      showToast('Hierarchy must have exactly 10 levels', 'danger');
      return false;
    }

    // Check depths 0-9
    const depths = this.currentHierarchy.levels.map(l => l.depth);
    const expectedDepths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const hasValidDepths = expectedDepths.every(d => depths.includes(d));

    if (!hasValidDepths) {
      showToast('Hierarchy must have depths 0-9', 'danger');
      return false;
    }

    // Check required fields
    for (const level of this.currentHierarchy.levels) {
      if (!level.name || !level.numbering || level.depth === undefined) {
        showToast(`Level ${level.depth} is missing required fields`, 'danger');
        return false;
      }

      if (!this.numberingTypes[level.numbering]) {
        showToast(`Invalid numbering type for level ${level.depth}`, 'danger');
        return false;
      }
    }

    return true;
  }

  async save() {
    // Validate
    if (!this.validate()) {
      return;
    }

    try {
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

      const response = await fetch(`/admin/documents/${this.documentId}/hierarchy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hierarchy: this.currentHierarchy
        })
      });

      const data = await response.json();

      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check-circle"></i> Save Configuration';

      if (data.success) {
        showToast('Hierarchy configuration saved successfully', 'success');
        this.originalHierarchy = JSON.parse(JSON.stringify(this.currentHierarchy));

        // Redirect after short delay
        setTimeout(() => {
          window.location.href = `/admin/organization/${this.organizationId}`;
        }, 1500);
      } else {
        showToast('Error: ' + (data.error || 'Failed to save'), 'danger');
      }
    } catch (error) {
      console.error('Error saving hierarchy:', error);
      showToast('Failed to save hierarchy', 'danger');

      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check-circle"></i> Save Configuration';
    }
  }

  async resetToDefault() {
    const confirmed = await showConfirmDialog({
      title: 'Reset to Organization Default',
      message: 'This will remove the custom hierarchy for this document and use the organization default. Are you sure?',
      confirmText: 'Reset',
      confirmClass: 'btn-warning',
      icon: 'arrow-counterclockwise'
    });

    if (!confirmed) {
      return;
    }

    try {
      const resetBtn = document.getElementById('resetBtn');
      resetBtn.disabled = true;
      resetBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Resetting...';

      const response = await fetch(`/admin/documents/${this.documentId}/hierarchy`, {
        method: 'DELETE'
      });

      const data = await response.json();

      resetBtn.disabled = false;
      resetBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset to Org Default';

      if (data.success) {
        showToast('Reset to organization default', 'success');

        // Redirect after short delay
        setTimeout(() => {
          window.location.href = `/admin/organization/${this.organizationId}`;
        }, 1500);
      } else {
        showToast('Error: ' + (data.error || 'Failed to reset'), 'danger');
      }
    } catch (error) {
      console.error('Error resetting hierarchy:', error);
      showToast('Failed to reset hierarchy', 'danger');

      const resetBtn = document.getElementById('resetBtn');
      resetBtn.disabled = false;
      resetBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset to Org Default';
    }
  }

  createDefaultHierarchy() {
    return {
      levels: [
        { name: 'Article', depth: 0, numbering: 'roman', prefix: 'Article ' },
        { name: 'Section', depth: 1, numbering: 'numeric', prefix: 'Section ' },
        { name: 'Subsection', depth: 2, numbering: 'numeric', prefix: '' },
        { name: 'Paragraph', depth: 3, numbering: 'alphaLower', prefix: '(' },
        { name: 'Subparagraph', depth: 4, numbering: 'numeric', prefix: '' },
        { name: 'Clause', depth: 5, numbering: 'alphaLower', prefix: '(' },
        { name: 'Subclause', depth: 6, numbering: 'roman', prefix: '' },
        { name: 'Item', depth: 7, numbering: 'numeric', prefix: '•' },
        { name: 'Subitem', depth: 8, numbering: 'alpha', prefix: '◦' },
        { name: 'Point', depth: 9, numbering: 'numeric', prefix: '-' }
      ],
      maxDepth: 10
    };
  }
}

// Export for use in EJS
if (typeof window !== 'undefined') {
  window.HierarchyEditor = HierarchyEditor;
}
