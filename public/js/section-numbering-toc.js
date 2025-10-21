/**
 * Section Numbering & Table of Contents System
 * IMAGES NOT WORDS, SIMPLE IS BETTER
 * Provides visual navigation through auto-numbered sections and dynamic TOC
 */

const SectionNavigator = {
  tocOpen: false,
  sections: [],
  activeSection: null,
  searchQuery: '',

  /**
   * Initialize the section numbering and TOC system
   */
  init() {
    this.buildSectionIndex();
    this.createTOCStructure();
    this.attachEventListeners();
    this.addSectionNumberBadges();
    this.setupIntersectionObserver();
    this.setupKeyboardNavigation();
  },

  /**
   * Build index of all sections with sequential numbering
   */
  buildSectionIndex() {
    const sectionCards = document.querySelectorAll('[id^="section-"]');
    this.sections = [];

    sectionCards.forEach((card, index) => {
      const sectionId = card.id.replace('section-', '');
      const titleElement = card.querySelector('h5');
      const citation = titleElement ? titleElement.textContent.trim() : 'Untitled';

      // Extract depth from existing depth classes or default to 0
      let depth = 0;
      const depthMatch = card.className.match(/depth-(\d+)/);
      if (depthMatch) {
        depth = parseInt(depthMatch[1]);
      }

      // Count suggestions
      const suggestionBadge = card.querySelector('[id^="suggestion-count-"]');
      const suggestionText = suggestionBadge ? suggestionBadge.textContent : '0';
      const suggestionCount = parseInt(suggestionText.match(/\d+/) || [0])[0];

      // Check if locked
      const isLocked = card.querySelector('.badge.bg-primary i.bi-lock-fill') !== null;

      this.sections.push({
        id: sectionId,
        number: index + 1,
        citation: citation,
        depth: depth,
        suggestionCount: suggestionCount,
        isLocked: isLocked,
        element: card
      });
    });
  },

  /**
   * Add visual number badges to each section header
   */
  addSectionNumberBadges() {
    this.sections.forEach(section => {
      const header = section.element.querySelector('.d-flex.justify-content-between.align-items-start');
      if (!header) return;

      const flexGrowDiv = header.querySelector('.flex-grow-1');
      if (!flexGrowDiv) return;

      // Create number badge
      const badge = document.createElement('div');
      badge.className = 'section-number-badge';
      badge.textContent = section.number;
      badge.setAttribute('data-section-id', section.id);
      badge.setAttribute('title', `Section ${section.number} - Click to copy link`);
      badge.setAttribute('aria-label', `Section number ${section.number}. Click to copy permanent link.`);
      badge.setAttribute('role', 'button');
      badge.setAttribute('tabindex', '0');

      // Insert at the beginning of the header content
      const firstChild = flexGrowDiv.querySelector('.d-flex.align-items-center.mb-2');
      if (firstChild) {
        firstChild.insertBefore(badge, firstChild.firstChild);
      }

      // Click to copy anchor link
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyAnchorLink(section);
      });

      // Keyboard support
      badge.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.copyAnchorLink(section);
        }
      });
    });
  },

  /**
   * Copy anchor link to clipboard
   */
  async copyAnchorLink(section) {
    const url = `${window.location.origin}${window.location.pathname}#section-${section.id}`;

    try {
      await navigator.clipboard.writeText(url);

      // Visual feedback
      const badge = document.querySelector(`[data-section-id="${section.id}"]`);
      if (badge) {
        badge.classList.add('copied');
        setTimeout(() => badge.classList.remove('copied'), 2000);
      }

      // Toast notification (if available)
      if (typeof showToast === 'function') {
        showToast('Link copied to clipboard!', 'success');
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      if (typeof showToast === 'function') {
        showToast('Failed to copy link', 'danger');
      }
    }
  },

  /**
   * Create TOC structure in DOM
   */
  createTOCStructure() {
    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'toc-backdrop';
    backdrop.id = 'toc-backdrop';
    backdrop.addEventListener('click', () => this.closeTOC());
    document.body.appendChild(backdrop);

    // Create TOC container
    const toc = document.createElement('nav');
    toc.className = 'document-toc';
    toc.id = 'document-toc';
    toc.setAttribute('aria-label', 'Table of Contents');

    // Mobile handle
    const handle = document.createElement('div');
    handle.className = 'toc-handle';
    handle.setAttribute('aria-hidden', 'true');
    toc.appendChild(handle);

    // Header
    const header = this.createTOCHeader();
    toc.appendChild(header);

    // Search
    const search = this.createTOCSearch();
    toc.appendChild(search);

    // Content
    const content = this.createTOCContent();
    toc.appendChild(content);

    // Depth summary
    const summary = this.createDepthSummary();
    toc.appendChild(summary);

    document.body.appendChild(toc);

    // Create toggle button
    const toggle = this.createToggleButton();
    document.body.appendChild(toggle);

    // Skip to content link (accessibility)
    const skipLink = document.createElement('a');
    skipLink.href = '#document-sections';
    skipLink.className = 'skip-to-content';
    skipLink.textContent = 'Skip to document sections';
    document.body.insertBefore(skipLink, document.body.firstChild);
  },

  /**
   * Create TOC header
   */
  createTOCHeader() {
    const header = document.createElement('div');
    header.className = 'toc-header';
    header.innerHTML = `
      <h3><i class="bi bi-list-ol"></i> Document Map</h3>
      <div class="toc-meta">
        <div class="toc-section-count">
          <i class="bi bi-file-text"></i>
          <span>${this.sections.length} sections</span>
        </div>
        <button class="toc-collapse-all" id="toc-collapse-all" aria-label="Collapse all sections">
          <i class="bi bi-arrows-collapse"></i> Collapse
        </button>
      </div>
    `;
    return header;
  },

  /**
   * Create TOC search box
   */
  createTOCSearch() {
    const search = document.createElement('div');
    search.className = 'toc-search';
    search.innerHTML = `
      <input type="text"
             class="toc-search-input"
             id="toc-search-input"
             placeholder="Search sections..."
             aria-label="Search table of contents">
      <i class="bi bi-search toc-search-icon" aria-hidden="true"></i>
    `;
    return search;
  },

  /**
   * Create TOC content with all sections
   */
  createTOCContent() {
    const content = document.createElement('div');
    content.className = 'toc-content';
    content.id = 'toc-content';
    content.setAttribute('role', 'navigation');

    this.sections.forEach(section => {
      const item = document.createElement('div');
      item.className = `toc-item depth-${section.depth}`;
      item.setAttribute('data-section-id', section.id);
      item.setAttribute('data-number', section.number);
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'link');
      item.setAttribute('aria-label', `Jump to section ${section.number}: ${section.citation}`);

      let metaBadges = '';
      if (section.suggestionCount > 0) {
        metaBadges += `<span class="toc-meta-badge suggestions">${section.suggestionCount} suggestions</span>`;
      }
      if (section.isLocked) {
        metaBadges += `<span class="toc-meta-badge locked"><i class="bi bi-lock-fill"></i> Locked</span>`;
      }

      item.innerHTML = `
        <div class="toc-item-content">
          <span class="toc-item-number">#${section.number}</span>
          <span class="toc-item-citation">${this.escapeHtml(section.citation)}</span>
          ${metaBadges ? `<div class="toc-item-meta">${metaBadges}</div>` : ''}
        </div>
      `;

      // Click to scroll to section
      item.addEventListener('click', () => this.scrollToSection(section));

      // Keyboard navigation
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.scrollToSection(section);
        }
      });

      content.appendChild(item);
    });

    return content;
  },

  /**
   * Create depth level summary
   */
  createDepthSummary() {
    const summary = document.createElement('div');
    summary.className = 'toc-depth-summary';

    // Count sections by depth
    const depthCounts = {};
    this.sections.forEach(section => {
      depthCounts[section.depth] = (depthCounts[section.depth] || 0) + 1;
    });

    const depthLabels = [
      'Articles', 'Sections', 'Subsections', 'Clauses',
      'Subclauses', 'Points', 'Subpoints', 'Items',
      'Subitems', 'Details'
    ];

    let chips = '';
    Object.keys(depthCounts).sort((a, b) => a - b).forEach(depth => {
      const label = depthLabels[depth] || `Level ${depth}`;
      chips += `
        <div class="toc-depth-chip depth-${depth}" data-depth="${depth}">
          <span>${label}: ${depthCounts[depth]}</span>
        </div>
      `;
    });

    summary.innerHTML = `
      <div class="toc-depth-summary-title">Structure Overview</div>
      <div class="toc-depth-chips">${chips}</div>
    `;

    return summary;
  },

  /**
   * Create toggle button
   */
  createToggleButton() {
    const button = document.createElement('button');
    button.className = 'toc-toggle-button';
    button.id = 'toc-toggle';
    button.setAttribute('aria-label', 'Toggle table of contents');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = `
      <i class="bi bi-list-ol"></i>
      <span class="toc-toggle-badge">${this.sections.length}</span>
    `;
    return button;
  },

  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Toggle button
    document.addEventListener('click', (e) => {
      const toggleButton = e.target.closest('#toc-toggle');
      if (toggleButton) {
        this.toggleTOC();
      }
    });

    // Collapse all button
    document.addEventListener('click', (e) => {
      const collapseButton = e.target.closest('#toc-collapse-all');
      if (collapseButton) {
        this.collapseAllSections();
      }
    });

    // Search input
    document.addEventListener('input', (e) => {
      if (e.target.id === 'toc-search-input') {
        this.handleSearch(e.target.value);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K to toggle TOC
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggleTOC();
      }

      // Escape to close TOC
      if (e.key === 'Escape' && this.tocOpen) {
        this.closeTOC();
      }
    });
  },

  /**
   * Toggle TOC open/closed
   */
  toggleTOC() {
    if (this.tocOpen) {
      this.closeTOC();
    } else {
      this.openTOC();
    }
  },

  /**
   * Open TOC
   */
  openTOC() {
    this.tocOpen = true;
    document.getElementById('document-toc').classList.add('open');
    document.getElementById('toc-backdrop').classList.add('visible');
    document.getElementById('toc-toggle').classList.add('active');
    document.getElementById('toc-toggle').setAttribute('aria-expanded', 'true');

    // Focus search input
    setTimeout(() => {
      document.getElementById('toc-search-input').focus();
    }, 300);
  },

  /**
   * Close TOC
   */
  closeTOC() {
    this.tocOpen = false;
    document.getElementById('document-toc').classList.remove('open');
    document.getElementById('toc-backdrop').classList.remove('visible');
    document.getElementById('toc-toggle').classList.remove('active');
    document.getElementById('toc-toggle').setAttribute('aria-expanded', 'false');
  },

  /**
   * Scroll to section and highlight
   */
  scrollToSection(section) {
    const element = section.element;

    // Smooth scroll to section
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });

    // Update URL hash
    if (history.replaceState) {
      history.replaceState(null, null, `#section-${section.id}`);
    }

    // Highlight active section in TOC
    this.setActiveSection(section.id);

    // Expand section if collapsed
    if (!element.classList.contains('expanded')) {
      element.click();
    }

    // Close TOC on mobile
    if (window.innerWidth <= 768) {
      setTimeout(() => this.closeTOC(), 300);
    }

    // Flash highlight
    element.style.transition = 'background-color 0.3s ease';
    element.style.backgroundColor = '#fef3c7';
    setTimeout(() => {
      element.style.backgroundColor = '';
    }, 1000);
  },

  /**
   * Set active section in TOC
   */
  setActiveSection(sectionId) {
    // Remove previous active
    document.querySelectorAll('.toc-item.active').forEach(item => {
      item.classList.remove('active');
    });

    // Set new active
    const activeItem = document.querySelector(`.toc-item[data-section-id="${sectionId}"]`);
    if (activeItem) {
      activeItem.classList.add('active');

      // Scroll into view in TOC
      activeItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }

    this.activeSection = sectionId;
  },

  /**
   * Handle search filtering
   */
  handleSearch(query) {
    this.searchQuery = query.toLowerCase();

    this.sections.forEach(section => {
      const tocItem = document.querySelector(`.toc-item[data-section-id="${section.id}"]`);
      if (!tocItem) return;

      const matches =
        section.citation.toLowerCase().includes(this.searchQuery) ||
        section.number.toString().includes(this.searchQuery);

      if (matches || this.searchQuery === '') {
        tocItem.classList.remove('hidden');
      } else {
        tocItem.classList.add('hidden');
      }
    });
  },

  /**
   * Collapse all sections in document
   */
  collapseAllSections() {
    this.sections.forEach(section => {
      if (section.element.classList.contains('expanded')) {
        section.element.click();
      }
    });

    if (typeof showToast === 'function') {
      showToast('All sections collapsed', 'info');
    }
  },

  /**
   * Setup intersection observer for auto-highlighting active section
   */
  setupIntersectionObserver() {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id.replace('section-', '');
          this.setActiveSection(sectionId);
        }
      });
    }, observerOptions);

    // Observe all sections
    this.sections.forEach(section => {
      observer.observe(section.element);
    });
  },

  /**
   * Setup keyboard navigation within TOC
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (!this.tocOpen) return;

      const tocContent = document.getElementById('toc-content');
      const items = Array.from(tocContent.querySelectorAll('.toc-item:not(.hidden)'));
      const activeElement = document.activeElement;
      const currentIndex = items.indexOf(activeElement);

      // Arrow up/down to navigate TOC items
      if (e.key === 'ArrowDown' && currentIndex < items.length - 1) {
        e.preventDefault();
        items[currentIndex + 1].focus();
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        e.preventDefault();
        items[currentIndex - 1].focus();
      }
    });
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on document viewer page
  if (document.querySelector('[id^="section-"]')) {
    SectionNavigator.init();

    // Handle direct anchor links
    if (window.location.hash && window.location.hash.startsWith('#section-')) {
      const sectionId = window.location.hash.replace('#section-', '');
      const section = SectionNavigator.sections.find(s => s.id === sectionId);
      if (section) {
        setTimeout(() => {
          SectionNavigator.scrollToSection(section);
        }, 500);
      }
    }
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SectionNavigator;
}
