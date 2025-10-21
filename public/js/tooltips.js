/**
 * Tooltip Initialization
 * Enables Bootstrap 5 tooltips for all elements with data-bs-toggle="tooltip"
 */

(function() {
  'use strict';

  /**
   * Initialize all tooltips on page load
   */
  function initializeTooltips() {
    // Get all elements with tooltip attribute
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');

    // Initialize Bootstrap tooltips
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => {
      return new bootstrap.Tooltip(tooltipTriggerEl, {
        trigger: 'hover focus',
        placement: 'top',
        html: false,
        delay: { show: 300, hide: 100 }
      });
    });

    console.log(`[Tooltips] Initialized ${tooltipList.length} tooltips`);
  }

  /**
   * Re-initialize tooltips (for dynamically added content)
   */
  function reinitializeTooltips() {
    // Dispose of existing tooltips first
    const existingTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    existingTooltips.forEach(el => {
      const tooltip = bootstrap.Tooltip.getInstance(el);
      if (tooltip) {
        tooltip.dispose();
      }
    });

    // Reinitialize
    initializeTooltips();
  }

  /**
   * Show tooltip on disabled button click
   * Provides feedback when users click disabled actions
   */
  function handleDisabledClicks() {
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[disabled], .disabled');
      if (target) {
        const tooltip = bootstrap.Tooltip.getInstance(target);
        if (tooltip) {
          tooltip.show();
          setTimeout(() => tooltip.hide(), 2000);
        }
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initializeTooltips();
      handleDisabledClicks();
    });
  } else {
    initializeTooltips();
    handleDisabledClicks();
  }

  // Expose reinitialize function globally for dynamic content
  window.reinitializeTooltips = reinitializeTooltips;

})();
