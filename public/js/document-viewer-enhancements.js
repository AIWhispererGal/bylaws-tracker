/**
 * Document Viewer Enhancements
 * - Lazy loading of suggestions
 * - Depth visualization
 * - Admin restrictions handling
 * - Workflow progression
 */

const DocumentViewerEnhancements = {
  /**
   * Track which sections have loaded suggestions
   */
  loadedSections: new Set(),

  /**
   * Initialize enhancements
   */
  init() {
    this.setupLazyLoading();
    this.setupDepthVisualization();
    this.setupAdminRestrictions();
    this.setupTOCNavigation();
    console.log('[Document Viewer] Enhancements initialized');
  },

  /**
   * Setup lazy loading for suggestions
   */
  setupLazyLoading() {
    // Suggestions are loaded when section is expanded
    // This is already handled by the toggleSection function
    // We just need to hook into it
    console.log('[Lazy Loading] Configured');
  },

  /**
   * Load suggestions for a section when expanded
   */
  async loadSuggestionsForSection(sectionId) {
    // Skip if already loaded
    if (this.loadedSections.has(sectionId)) {
      console.log(`[Lazy Loading] Section ${sectionId} already loaded`);
      return;
    }

    console.log(`[Lazy Loading] Loading suggestions for section ${sectionId}`);

    const container = document.querySelector(`#suggestions-container-${sectionId}`);
    if (!container) {
      console.warn(`[Lazy Loading] Container not found for section ${sectionId}`);
      return;
    }

    // Show loading spinner
    container.innerHTML = `
      <div class="section-loading-spinner">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Loading suggestions...</span>
      </div>
    `;

    try {
      // Fetch suggestions for this section
      const response = await fetch(`/api/dashboard/suggestions?section_id=${sectionId}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load suggestions');
      }

      const suggestions = result.suggestions || [];

      // Update suggestion count badge
      const countBadge = document.querySelector(`#suggestion-count-${sectionId}`);
      if (countBadge) {
        countBadge.textContent = `${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''}`;
      }

      // Render suggestions
      if (suggestions.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i class="bi bi-lightbulb"></i>
            <p class="mb-0 mt-2">No suggestions for this section</p>
          </div>
        `;
      } else {
        container.innerHTML = suggestions.map(suggestion => this.renderSuggestion(suggestion)).join('');
      }

      // Mark as loaded
      this.loadedSections.add(sectionId);
      console.log(`[Lazy Loading] Loaded ${suggestions.length} suggestions for section ${sectionId}`);

    } catch (error) {
      console.error('[Lazy Loading] Error:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load suggestions. Please try again.
        </div>
      `;
    }
  },

  /**
   * Render a single suggestion
   */
  renderSuggestion(suggestion) {
    const statusClass = suggestion.status === 'open' ? 'success' : suggestion.status === 'rejected' ? 'danger' : 'secondary';
    const statusLabel = suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1);

    return `
      <div class="suggestion-item">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <span class="badge bg-${statusClass}">${statusLabel}</span>
          <small class="text-muted">${this.formatDate(suggestion.created_at)}</small>
        </div>
        <div class="mb-2">
          <strong>Suggested by:</strong> ${this.escapeHtml(suggestion.author_name || suggestion.author_email || 'Anonymous')}
        </div>
        <div class="mb-2">
          <strong>Change:</strong>
          <div class="suggested-text mt-1 p-2 bg-light rounded">
            ${this.escapeHtml(suggestion.suggested_text || suggestion.suggested_content || '')}
          </div>
        </div>
        ${suggestion.rationale ? `
          <div class="mb-2">
            <strong>Rationale:</strong>
            <div class="text-muted">${this.escapeHtml(suggestion.rationale)}</div>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Setup depth visualization
   */
  setupDepthVisualization() {
    const sections = document.querySelectorAll('.section-card');

    sections.forEach(section => {
      const sectionId = section.dataset.sectionId;
      if (!sectionId) return;

      // Get depth from section data (you'll need to add this to the template)
      // For now, we'll try to determine depth from the TOC data
      const depth = this.getSectionDepth(sectionId);

      // Add depth attribute
      section.setAttribute('data-depth', depth);

      // Add depth indicator element
      const indicator = document.createElement('div');
      indicator.className = 'section-depth-indicator';
      section.insertBefore(indicator, section.firstChild);
    });

    console.log('[Depth Visualization] Applied to sections');
  },

  /**
   * Get section depth (helper function)
   */
  getSectionDepth(sectionId) {
    // Try to find depth from TOC data
    const tocItem = document.querySelector(`.toc-item[data-section-id="${sectionId}"]`);
    if (tocItem) {
      const depthClass = Array.from(tocItem.classList).find(cls => cls.startsWith('depth-'));
      if (depthClass) {
        return parseInt(depthClass.split('-')[1]) || 0;
      }
    }

    // Default to 0
    return 0;
  },

  /**
   * Setup admin restrictions
   */
  setupAdminRestrictions() {
    // Add tooltips to disabled buttons
    const disabledButtons = document.querySelectorAll('.section-action-disabled');

    disabledButtons.forEach(button => {
      const reason = button.dataset.disabledReason || 'This action is not available';
      button.setAttribute('title', reason);
      button.setAttribute('data-bs-toggle', 'tooltip');
    });

    // Initialize Bootstrap tooltips if available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
    }

    console.log('[Admin Restrictions] Configured');
  },

  /**
   * Setup TOC navigation
   */
  setupTOCNavigation() {
    // Smooth scroll is handled by CSS
    // Add active state tracking on scroll
    const sections = document.querySelectorAll('.section-card');
    const tocLinks = document.querySelectorAll('.toc-link');

    if (sections.length === 0 || tocLinks.length === 0) return;

    // Update active TOC item on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionNumber = entry.target.dataset.sectionNumber;
            if (sectionNumber) {
              // Remove active class from all links
              tocLinks.forEach(link => link.classList.remove('active'));

              // Add active class to current link
              const activeLink = document.querySelector(`.toc-link[href="#${entry.target.id}"]`);
              if (activeLink) {
                activeLink.classList.add('active');
              }
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px'
      }
    );

    sections.forEach(section => observer.observe(section));

    console.log('[TOC Navigation] Configured');
  },

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'Unknown date';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

/**
 * DEPRECATED: This function has been merged into the main toggleSection function
 * in document-viewer.ejs. The original toggleSection now checks for
 * DocumentViewerEnhancements and uses lazy loading automatically.
 *
 * Keeping this stub for backward compatibility in case any code references it.
 */
function toggleSectionEnhanced(sectionId) {
  console.warn('toggleSectionEnhanced is deprecated. Use toggleSection instead.');
  if (typeof window.toggleSection === 'function') {
    window.toggleSection(sectionId);
  }
}

/**
 * Create new document version (workflow progression)
 */
async function createNewDocumentVersion(documentId) {
  if (!confirm('Create a new version of this document with all approved changes?\n\nThis will:\n- Apply all approved suggestions\n- Create a new version\n- Keep the original as version history')) {
    return;
  }

  try {
    const response = await fetch(`/api/workflow/documents/${documentId}/create-version`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (result.success) {
      alert(`New version created successfully!\n\nVersion: ${result.version.version_number}\nSections updated: ${result.version.sections_updated || 0}`);
      window.location.reload();
    } else {
      throw new Error(result.error || 'Failed to create new version');
    }
  } catch (error) {
    console.error('[Workflow Progression] Error:', error);
    alert('Failed to create new version: ' + error.message);
  }
}

/**
 * Toggle TOC visibility
 */
function toggleTOC() {
  const tocContent = document.getElementById('tocContent');
  const toggleBtn = document.querySelector('.toc-toggle-btn');

  if (!tocContent || !toggleBtn) return;

  tocContent.classList.toggle('collapsed');
  toggleBtn.classList.toggle('collapsed');
}

/**
 * Scroll to section with highlight
 */
function scrollToSection(sectionNumber) {
  const section = document.querySelector(`[data-section-number="${sectionNumber}"]`);
  if (!section) return;

  // Scroll to section
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Add highlight animation
  section.classList.add('section-highlight');
  setTimeout(() => {
    section.classList.remove('section-highlight');
  }, 2000);
}

/**
 * Copy link to clipboard
 */
function copyLinkToClipboard(anchorId, event) {
  event.preventDefault();
  event.stopPropagation();

  const url = window.location.origin + window.location.pathname + '#' + anchorId;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      // Show toast notification
      showToast('Link copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy:', err);
      showToast('Failed to copy link', 'danger');
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      showToast('Link copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('Failed to copy link', 'danger');
    }

    document.body.removeChild(textArea);
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  toast.style.zIndex = '9999';
  toast.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// CONSOLIDATED: DOMContentLoaded listener removed to prevent duplicate initialization
// The main document-viewer.ejs now calls DocumentViewerEnhancements.init() directly
// in its consolidated initialization block (see document-viewer.ejs line ~2589)
