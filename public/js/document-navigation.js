/**
 * Document Navigation & Deep Linking
 * Handles scroll-to-section and TOC navigation
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    scrollBehavior: 'smooth',
    scrollOffset: 80, // Offset for fixed headers
    highlightDuration: 2000, // How long to highlight section
    highlightClass: 'section-highlight'
  };

  /**
   * Scroll to a section by number or anchor ID
   * @param {string|number} target - Section number or anchor ID (e.g., 42 or "section-42")
   */
  function scrollToSection(target) {
    let anchorId;

    // Convert target to anchor ID format
    if (typeof target === 'number' || !target.startsWith('section-')) {
      anchorId = `section-${target}`;
    } else {
      anchorId = target;
    }

    // Find target element
    const targetElement = document.getElementById(anchorId);
    if (!targetElement) {
      console.warn(`[NAVIGATION] Section not found: ${anchorId}`);
      return;
    }

    // Calculate scroll position with offset
    const elementPosition = targetElement.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - CONFIG.scrollOffset;

    // Scroll to section
    window.scrollTo({
      top: offsetPosition,
      behavior: CONFIG.scrollBehavior
    });

    // Highlight section temporarily
    highlightSection(targetElement);

    // Update URL hash without triggering scroll
    updateURLHash(anchorId);
  }

  /**
   * Highlight a section temporarily
   * @param {HTMLElement} element - Section element to highlight
   */
  function highlightSection(element) {
    // Add highlight class
    element.classList.add(CONFIG.highlightClass);

    // Remove after duration
    setTimeout(() => {
      element.classList.remove(CONFIG.highlightClass);
    }, CONFIG.highlightDuration);
  }

  /**
   * Update URL hash without triggering scroll event
   * @param {string} hash - Hash to set (without #)
   */
  function updateURLHash(hash) {
    if (history.pushState) {
      history.pushState(null, null, `#${hash}`);
    } else {
      // Fallback for older browsers
      window.location.hash = hash;
    }
  }

  /**
   * Handle TOC link clicks
   * @param {Event} event - Click event
   */
  function handleTOCClick(event) {
    const link = event.target.closest('[data-section-number]');
    if (!link) return;

    event.preventDefault();

    const sectionNumber = link.getAttribute('data-section-number');
    if (sectionNumber) {
      scrollToSection(sectionNumber);
    }
  }

  /**
   * Handle URL hash on page load
   */
  function handleInitialHash() {
    const hash = window.location.hash;
    if (!hash) return;

    // Remove # prefix
    const anchorId = hash.substring(1);

    // Wait for page to fully load before scrolling
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => scrollToSection(anchorId), 100);
      });
    } else {
      setTimeout(() => scrollToSection(anchorId), 100);
    }
  }

  /**
   * Generate section navigation buttons
   * @param {string} sectionId - Section ID
   * @returns {Promise<Object>} Navigation data
   */
  async function getSectionNavigation(sectionId) {
    try {
      const response = await fetch(`/api/dashboard/sections/${sectionId}/navigation`);
      if (!response.ok) {
        throw new Error('Failed to fetch navigation data');
      }

      const data = await response.json();
      return data.navigation;
    } catch (error) {
      console.error('[NAVIGATION] Error fetching navigation:', error);
      return null;
    }
  }

  /**
   * Render section navigation controls
   * @param {HTMLElement} container - Container element for navigation
   * @param {Object} navigation - Navigation data
   */
  function renderSectionNavigation(container, navigation) {
    if (!container || !navigation) return;

    let html = '<div class="section-navigation">';

    // Previous button
    if (navigation.prev) {
      html += `
        <button class="btn btn-sm btn-outline-primary me-2"
                data-section-number="${navigation.prev.number}"
                title="Previous: ${navigation.prev.citation}">
          <i class="bi bi-arrow-left"></i> Previous
        </button>
      `;
    }

    // Parent button
    if (navigation.parent) {
      html += `
        <button class="btn btn-sm btn-outline-secondary me-2"
                data-section-number="${navigation.parent.number}"
                title="Parent: ${navigation.parent.citation}">
          <i class="bi bi-arrow-up"></i> Parent
        </button>
      `;
    }

    // Next button
    if (navigation.next) {
      html += `
        <button class="btn btn-sm btn-outline-primary"
                data-section-number="${navigation.next.number}"
                title="Next: ${navigation.next.citation}">
          Next <i class="bi bi-arrow-right"></i>
        </button>
      `;
    }

    html += '</div>';
    container.innerHTML = html;

    // Attach click handlers
    container.querySelectorAll('[data-section-number]').forEach(button => {
      button.addEventListener('click', () => {
        const sectionNumber = button.getAttribute('data-section-number');
        scrollToSection(sectionNumber);
      });
    });
  }

  /**
   * Initialize Table of Contents navigation
   */
  function initializeTOC() {
    // Find TOC container
    const tocContainer = document.querySelector('[data-toc-container]');
    if (!tocContainer) return;

    // Attach click handler to TOC links
    tocContainer.addEventListener('click', handleTOCClick);

    console.log('[NAVIGATION] TOC navigation initialized');
  }

  /**
   * Initialize section navigation buttons
   * Finds all sections and adds navigation controls
   */
  function initializeSectionNavigation() {
    const sectionCards = document.querySelectorAll('[data-section-id]');

    sectionCards.forEach(async (card) => {
      const sectionId = card.getAttribute('data-section-id');
      const navContainer = card.querySelector('[data-nav-container]');

      if (navContainer && sectionId) {
        const navigation = await getSectionNavigation(sectionId);
        if (navigation) {
          renderSectionNavigation(navContainer, navigation);
        }
      }
    });
  }

  /**
   * Add keyboard shortcuts for navigation
   */
  function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Alt + Arrow keys for navigation
      if (event.altKey) {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          // Navigate to parent or previous section
          // Implementation depends on current section context
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          // Navigate to next section
        }
      }
    });
  }

  /**
   * Initialize all navigation features
   */
  function initialize() {
    // Handle initial hash
    handleInitialHash();

    // Initialize TOC navigation
    initializeTOC();

    // Initialize section navigation (lazy load on demand)
    // initializeSectionNavigation(); // Uncomment if needed

    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts();

    console.log('[NAVIGATION] Document navigation initialized');
  }

  // Expose public API
  window.DocumentNavigation = {
    scrollToSection,
    getSectionNavigation,
    renderSectionNavigation,
    initialize
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
