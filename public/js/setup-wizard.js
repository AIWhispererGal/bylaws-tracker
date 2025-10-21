/**
 * Setup Wizard JavaScript
 * Handles client-side interactions, validation, and AJAX form submissions
 */

const SetupWizard = {
    // CSRF token
    csrfToken: document.querySelector('meta[name="csrf-token"]')?.content || '',

    /**
     * Initialize Organization Form
     */
    initOrganizationForm() {
        const form = document.getElementById('organizationForm');
        if (!form) return;

        // Logo upload functionality
        this.initLogoUpload();

        // Password confirmation validation
        this.initPasswordValidation();

        // Real-time validation
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('is-invalid')) {
                    this.validateField(input);
                }
            });
        });

        // Form submission
        form.addEventListener('submit', (e) => this.handleOrganizationSubmit(e));
    },

    /**
     * Initialize Password Validation
     */
    initPasswordValidation() {
        const password = document.getElementById('adminPassword');
        const confirmPassword = document.getElementById('adminPasswordConfirm');

        if (!password || !confirmPassword) return;

        const validatePasswordMatch = () => {
            if (confirmPassword.value && password.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
                confirmPassword.classList.add('is-invalid');
                confirmPassword.classList.remove('is-valid');
            } else {
                confirmPassword.setCustomValidity('');
                if (confirmPassword.value) {
                    confirmPassword.classList.remove('is-invalid');
                    confirmPassword.classList.add('is-valid');
                }
            }
        };

        password.addEventListener('input', validatePasswordMatch);
        confirmPassword.addEventListener('input', validatePasswordMatch);
    },

    /**
     * Initialize Logo Upload
     * FIX-2: Prevent double popup by using single event listener
     */
    initLogoUpload() {
        const uploadArea = document.getElementById('logoUploadArea');
        const uploadPrompt = document.getElementById('uploadPrompt');
        const fileInput = document.getElementById('logoFile');
        const preview = document.getElementById('logoPreview');
        const previewImg = document.getElementById('logoPreviewImg');
        const removeBtn = document.getElementById('removeLogo');

        if (!uploadArea) return;

        // FIX-2: Single unified click handler to prevent double-triggering
        const browseBtn = document.getElementById('browseBtn');
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
        }

        // Remove the uploadPrompt click listener to prevent double-popup
        // Users can only click the browse button now

        // File selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleLogoFile(file, preview, previewImg, uploadPrompt);
            }
        });

        // Remove logo
        removeBtn?.addEventListener('click', () => {
            fileInput.value = '';
            preview.style.display = 'none';
            uploadPrompt.style.display = 'block';
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                fileInput.files = e.dataTransfer.files;
                this.handleLogoFile(file, preview, previewImg, uploadPrompt);
            }
        });
    },

    /**
     * Handle Logo File
     */
    handleLogoFile(file, preview, previewImg, uploadPrompt) {
        // Validate file
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, or SVG)');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert('File size must be less than 2MB');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
            uploadPrompt.style.display = 'none';
        };
        reader.readAsDataURL(file);
    },

    /**
     * Handle Organization Form Submit
     */
    async handleOrganizationSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');

        // Prevent double submission
        if (submitBtn.disabled) {
            return;
        }

        // Validate all fields
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        // Disable submit button to prevent double-click
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

        // Show loading
        document.getElementById('formLoading').style.display = 'flex';

        // Prepare form data
        const formData = new FormData(form);

        try {
            const response = await fetch('/setup/organization', {
                method: 'POST',
                // FormData includes CSRF token from hidden input field
                // Do not set headers - FormData sets its own Content-Type with boundary
                body: formData
            });

            const result = await response.json();

            if (result.success && result.redirectUrl) {
                window.location.href = result.redirectUrl;
            } else {
                throw new Error(result.error || 'Failed to save organization info');
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to save: ' + error.message);

            // Re-enable button on error
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Continue <i class="bi bi-arrow-right"></i>';
        } finally {
            document.getElementById('formLoading').style.display = 'none';
        }
    },

    /**
     * Initialize Document Type Form
     */
    initDocumentTypeForm() {
        const form = document.getElementById('documentTypeForm');
        if (!form) return;

        // Structure card selection
        const structureCards = document.querySelectorAll('.structure-card.selectable');
        const selectedInput = document.getElementById('selectedStructure');
        const customizationSection = document.getElementById('customizationSection');
        const previewSection = document.getElementById('previewSection');

        structureCards.forEach(card => {
            card.addEventListener('click', () => {
                // Remove previous selection
                structureCards.forEach(c => c.classList.remove('selected'));

                // Select this card
                card.classList.add('selected');
                const structure = card.dataset.structure;
                selectedInput.value = structure;

                // Show customization
                customizationSection.style.display = 'block';
                previewSection.style.display = 'block';

                // Pre-fill labels based on selection
                this.updateStructureLabels(structure);
                this.updateStructurePreview();
            });
        });

        // Update preview on input
        const customInputs = customizationSection.querySelectorAll('input, select');
        customInputs.forEach(input => {
            input.addEventListener('input', () => this.updateStructurePreview());
        });

        // Form submission
        form.addEventListener('submit', (e) => this.handleDocumentTypeSubmit(e));
    },

    /**
     * Update Structure Labels
     */
    updateStructureLabels(structure) {
        const level1Input = document.getElementById('level1Name');
        const level2Input = document.getElementById('level2Name');

        const labels = {
            'article-section': { level1: 'Article', level2: 'Section' },
            'chapter-section': { level1: 'Chapter', level2: 'Section' },
            'part-section': { level1: 'Part', level2: 'Section' },
            'custom': { level1: '', level2: '' }
        };

        const label = labels[structure] || labels['article-section'];
        level1Input.value = label.level1;
        level2Input.value = label.level2;
    },

    /**
     * Update Structure Preview
     */
    updateStructurePreview() {
        const level1 = document.getElementById('level1Name').value || 'Article';
        const level2 = document.getElementById('level2Name').value || 'Section';
        const numbering = document.querySelector('input[name="numbering_style"]:checked')?.value || 'roman';

        const numbers = {
            'roman': ['I', 'II'],
            'numeric': ['1', '2'],
            'alpha': ['A', 'B']
        };

        const nums = numbers[numbering];

        const preview = document.getElementById('structurePreview');
        preview.innerHTML = `
            <div class="structure-example">
                <div class="example-item level-1">${level1} ${nums[0]} - Name</div>
                <div class="example-item level-2">${level2} ${nums[0]}.1 - Details</div>
                <div class="example-item level-2">${level2} ${nums[0]}.2 - More Details</div>
                <div class="example-item level-1">${level1} ${nums[1]} - Purpose</div>
                <div class="example-item level-2">${level2} ${nums[1]}.1 - Mission</div>
            </div>
        `;
    },

    /**
     * Handle Document Type Submit
     */
    async handleDocumentTypeSubmit(e) {
        e.preventDefault();
        const form = e.target;

        // Validate structure selection
        if (!document.getElementById('selectedStructure').value) {
            document.getElementById('structureError').style.display = 'block';
            return;
        }

        // Show loading
        document.getElementById('formLoading').style.display = 'flex';

        const formData = new FormData(form);

        try {
            const response = await fetch('/setup/document-type', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(Object.fromEntries(formData))
            });

            const result = await response.json();

            if (result.success && result.redirectUrl) {
                window.location.href = result.redirectUrl;
            } else {
                throw new Error(result.error || 'Failed to save document type');
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to save: ' + error.message);
        } finally {
            document.getElementById('formLoading').style.display = 'none';
        }
    },

    /**
     * Initialize Workflow Form
     */
    initWorkflowForm() {
        const form = document.getElementById('workflowForm');
        if (!form) return;

        // Template selection
        const templateCards = document.querySelectorAll('.template-card.selectable');
        const selectedInput = document.getElementById('selectedTemplate');
        const workflowBuilder = document.getElementById('workflowBuilder');

        templateCards.forEach(card => {
            card.addEventListener('click', () => {
                templateCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const template = card.dataset.template;
                selectedInput.value = template;

                // Show workflow builder
                workflowBuilder.style.display = 'block';
                document.getElementById('workflowVisualization').style.display = 'block';
                document.getElementById('notificationSettings').style.display = 'block';

                // Load template
                this.loadWorkflowTemplate(template);
            });
        });

        // Add stage button
        document.getElementById('addStageBtn')?.addEventListener('click', () => {
            this.addWorkflowStage();
        });

        // Form submission
        form.addEventListener('submit', (e) => this.handleWorkflowSubmit(e));
    },

    /**
     * Load Workflow Template
     */
    loadWorkflowTemplate(template) {
        const stagesContainer = document.getElementById('workflowStages');
        stagesContainer.innerHTML = '';

        const templates = {
            'simple': [
                { name: 'Board Review', type: 'single', approvers: '' },
                { name: 'President Approval', type: 'single', approvers: '' }
            ],
            'committee': [
                { name: 'Committee Review', type: 'majority', approvers: '' },
                { name: 'Board Approval', type: 'majority', approvers: '' },
                { name: 'President Signature', type: 'single', approvers: '' }
            ],
            'membership': [
                { name: 'Committee Review', type: 'majority', approvers: '' },
                { name: 'Board Approval', type: 'majority', approvers: '' },
                { name: 'Membership Vote', type: 'supermajority', approvers: '', supermajority: 67 }
            ],
            'custom': []
        };

        const stages = templates[template] || templates['simple'];
        stages.forEach(stage => this.addWorkflowStage(stage));

        this.updateWorkflowVisualization();
    },

    /**
     * Add Workflow Stage
     */
    addWorkflowStage(data = {}) {
        const template = document.getElementById('stageTemplate');
        const stagesContainer = document.getElementById('workflowStages');

        const stageEl = template.content.cloneNode(true);
        const stageDiv = stageEl.querySelector('.workflow-stage');
        const index = stagesContainer.children.length;

        stageDiv.dataset.stageIndex = index;

        // Fill in data if provided
        if (data.name) stageEl.querySelector('.stage-name').value = data.name;
        if (data.type) stageEl.querySelector('.stage-approval-type').value = data.type;
        if (data.approvers) stageEl.querySelector('.stage-approvers').value = data.approvers;
        if (data.supermajority) stageEl.querySelector('.stage-supermajority').value = data.supermajority;
        // Support legacy 'quorum' field name for backwards compatibility
        if (data.quorum) stageEl.querySelector('.stage-supermajority').value = data.quorum;

        // Show supermajority field if needed
        const approvalType = stageEl.querySelector('.stage-approval-type');
        approvalType.addEventListener('change', (e) => {
            const supermajorityField = e.target.closest('.stage-content').querySelector('.supermajority-field');
            supermajorityField.style.display = e.target.value === 'supermajority' ? 'block' : 'none';
        });

        if (data.type === 'supermajority') {
            stageEl.querySelector('.supermajority-field').style.display = 'block';
        }
        // Support legacy 'quorum' type for backwards compatibility
        if (data.type === 'quorum') {
            stageEl.querySelector('.supermajority-field').style.display = 'block';
        }

        // Remove button
        stageEl.querySelector('.remove-stage').addEventListener('click', (e) => {
            e.target.closest('.workflow-stage').remove();
            this.updateWorkflowVisualization();
        });

        // Update visualization on change
        stageEl.querySelector('.stage-name').addEventListener('input', () => {
            this.updateWorkflowVisualization();
        });

        stagesContainer.appendChild(stageEl);
        this.updateWorkflowVisualization();
    },

    /**
     * Update Workflow Visualization
     */
    updateWorkflowVisualization() {
        const stages = document.querySelectorAll('.workflow-stage');
        const diagram = document.getElementById('workflowDiagram');

        if (!diagram) return;

        let html = '';
        stages.forEach((stage, index) => {
            const name = stage.querySelector('.stage-name').value || `Stage ${index + 1}`;
            html += `
                <div class="workflow-diagram-stage">
                    <div class="badge bg-primary p-2">${name}</div>
                </div>
            `;
            if (index < stages.length - 1) {
                html += '<i class="bi bi-arrow-right text-primary"></i>';
            }
        });

        diagram.innerHTML = html;
    },

    /**
     * Handle Workflow Submit
     */
    async handleWorkflowSubmit(e) {
        e.preventDefault();
        const form = e.target;

        // Collect workflow stages
        const stages = [];
        document.querySelectorAll('.workflow-stage').forEach(stageEl => {
            const approvalType = stageEl.querySelector('.stage-approval-type').value;
            const stage = {
                name: stageEl.querySelector('.stage-name').value,
                approvalType: approvalType,
                approvers: stageEl.querySelector('.stage-approvers').value.split('\n').filter(e => e.trim()),
                skipIfAuthor: stageEl.querySelector('.stage-skip-if-author').checked
            };

            // Add vote threshold for supermajority type
            if (approvalType === 'supermajority') {
                stage.voteThreshold = stageEl.querySelector('.stage-supermajority')?.value || null;
            }

            stages.push(stage);
        });

        const data = {
            template: document.getElementById('selectedTemplate').value,
            stages: stages,
            notifications: {
                onSubmit: document.getElementById('notifyOnSubmit').checked,
                onApproval: document.getElementById('notifyOnApproval').checked,
                onRejection: document.getElementById('notifyOnRejection').checked,
                onComplete: document.getElementById('notifyOnComplete').checked
            }
        };

        // Show loading
        document.getElementById('formLoading').style.display = 'flex';

        try {
            const response = await fetch('/setup/workflow', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': this.csrfToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success && result.redirectUrl) {
                window.location.href = result.redirectUrl;
            } else {
                throw new Error(result.error || 'Failed to save workflow');
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to save: ' + error.message);
        } finally {
            document.getElementById('formLoading').style.display = 'none';
        }
    },

    /**
     * Initialize Import Form
     */
    initImportForm() {
        const form = document.getElementById('importForm');
        if (!form) return;

        // File upload
        this.initFileUpload();

        // Google Docs import
        this.initGoogleDocsImport();

        // Skip import
        document.getElementById('skipImportLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to skip importing your bylaws? You can add them later.')) {
                window.location.href = '/setup/processing?skip=true';
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => this.handleImportSubmit(e));
    },

    /**
     * Initialize File Upload
     * FIX-2: Prevent double popup by using single event listener
     */
    initFileUpload() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('documentFile');
        const filePreview = document.getElementById('filePreview');
        const browseBtn = document.getElementById('browseBtn');

        if (!uploadZone) return;

        // FIX-2: Single unified click handler to prevent double-triggering
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
        }

        // Remove the uploadZone click listener to prevent double-popup
        // Users can only click the browse button or drag-and-drop now

        // File selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleDocumentFile(file);
            }
        });

        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                fileInput.files = e.dataTransfer.files;
                this.handleDocumentFile(file);
            }
        });

        // Remove file
        document.getElementById('removeFile')?.addEventListener('click', () => {
            fileInput.value = '';
            filePreview.style.display = 'none';
            uploadZone.style.display = 'block';
            document.getElementById('parsingOptions').style.display = 'none';
        });
    },

    /**
     * Handle Document File
     */
    handleDocumentFile(file) {
        // Validate file
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword'
        ];

        if (!validTypes.includes(file.type)) {
            alert('Please select a Word document (.docx or .doc)');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            return;
        }

        // Show preview
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = this.formatFileSize(file.size);
        document.getElementById('filePreview').style.display = 'block';
        document.getElementById('uploadZone').style.display = 'none';
        document.getElementById('parsingOptions').style.display = 'block';
    },

    /**
     * Initialize Google Docs Import
     */
    initGoogleDocsImport() {
        const urlInput = document.getElementById('googleDocUrl');
        if (!urlInput) return;

        urlInput.addEventListener('input', () => {
            const isValid = this.validateGoogleDocsUrl(urlInput.value);
            if (urlInput.value && !isValid) {
                urlInput.setCustomValidity('Please enter a valid Google Docs URL');
            } else {
                urlInput.setCustomValidity('');
            }
        });
    },

    /**
     * Validate Google Docs URL
     */
    validateGoogleDocsUrl(url) {
        return url.includes('docs.google.com/document');
    },

    /**
     * Handle Import Submit
     */
    async handleImportSubmit(e) {
        e.preventDefault();
        const form = e.target;

        // Get active tab
        const activeTab = document.querySelector('.nav-link.active').id;
        const isGoogleDocs = activeTab === 'google-tab';

        // Show loading
        const loading = document.getElementById('formLoading');
        const loadingMessage = document.getElementById('loadingMessage');
        loading.style.display = 'flex';
        loadingMessage.textContent = 'Uploading your document...';

        try {
            let response;

            if (isGoogleDocs) {
                const url = document.getElementById('googleDocUrl').value;
                response = await fetch('/setup/import', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': this.csrfToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ googleDocUrl: url })
                });
            } else {
                const formData = new FormData(form);
                response = await fetch('/setup/import', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-Token': this.csrfToken
                    },
                    body: formData
                });
            }

            loadingMessage.textContent = 'Processing your document...';
            const result = await response.json();

            if (result.success && result.redirectUrl) {
                // Redirect to processing screen
                window.location.href = result.redirectUrl;
            } else {
                throw new Error(result.error || 'Failed to import document');
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('Failed to import: ' + error.message);
        } finally {
            loading.style.display = 'none';
        }
    },

    /**
     * Validate Field
     */
    validateField(field) {
        if (!field.checkValidity()) {
            field.classList.add('is-invalid');
            field.classList.remove('is-valid');
            return false;
        } else {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
            return true;
        }
    },

    /**
     * Format File Size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
};

// Auto-initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    // Check which form is present and initialize accordingly
    if (document.getElementById('organizationForm')) {
        SetupWizard.initOrganizationForm();
    }
    if (document.getElementById('documentTypeForm')) {
        SetupWizard.initDocumentTypeForm();
    }
    if (document.getElementById('workflowForm')) {
        SetupWizard.initWorkflowForm();
    }
    if (document.getElementById('importForm')) {
        SetupWizard.initImportForm();
    }
});
