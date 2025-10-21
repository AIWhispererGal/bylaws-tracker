/**
 * Mobile Menu Handler for Bylaws Amendment Tracker
 * Handles hamburger menu toggle and sidebar slide-out on mobile devices
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }

  function initMobileMenu() {
    // Create mobile menu button
    createMobileMenuButton();

    // Create overlay
    createOverlay();

    // Setup event listeners
    setupEventListeners();

    // Handle window resize
    handleResize();
  }

  function createMobileMenuButton() {
    // Check if button already exists
    if (document.getElementById('mobile-menu-toggle')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'mobile-menu-toggle';
    button.className = 'mobile-menu-btn';
    button.setAttribute('aria-label', 'Toggle navigation menu');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<i class="bi bi-list"></i>';

    document.body.insertBefore(button, document.body.firstChild);
  }

  function createOverlay() {
    // Check if overlay already exists
    if (document.querySelector('.sidebar-overlay')) {
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
  }

  function setupEventListeners() {
    const toggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (!toggle || !sidebar || !overlay) {
      console.warn('Mobile menu: Required elements not found');
      return;
    }

    // Toggle button click
    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      toggleMenu();
    });

    // Overlay click - close menu
    overlay.addEventListener('click', function() {
      closeMenu();
    });

    // Close menu when clicking on navigation links
    const navLinks = sidebar.querySelectorAll('.nav-link');
    navLinks.forEach(function(link) {
      link.addEventListener('click', function() {
        // Small delay to allow navigation to proceed
        setTimeout(closeMenu, 200);
      });
    });

    // Keyboard accessibility - Escape key closes menu
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && sidebar.classList.contains('show')) {
        closeMenu();
        toggle.focus();
      }
    });

    // Handle swipe gestures on mobile
    if ('ontouchstart' in window) {
      let touchStartX = 0;
      let touchEndX = 0;

      sidebar.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      sidebar.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }, { passive: true });

      function handleSwipe() {
        const swipeThreshold = 50;
        const swipeDistance = touchEndX - touchStartX;

        // Swipe left to close
        if (swipeDistance < -swipeThreshold) {
          closeMenu();
        }
      }
    }
  }

  function toggleMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');
    const isOpen = sidebar.classList.contains('show');

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');

    sidebar.classList.add('show');
    overlay.classList.add('show');
    document.body.classList.add('menu-open');

    toggle.setAttribute('aria-expanded', 'true');
    toggle.innerHTML = '<i class="bi bi-x"></i>';

    // Focus trap - focus first link in sidebar
    setTimeout(function() {
      const firstLink = sidebar.querySelector('.nav-link');
      if (firstLink) {
        firstLink.focus();
      }
    }, 300);
  }

  function closeMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const toggle = document.getElementById('mobile-menu-toggle');

    if (!sidebar || !overlay || !toggle) {
      return;
    }

    sidebar.classList.remove('show');
    overlay.classList.remove('show');
    document.body.classList.remove('menu-open');

    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<i class="bi bi-list"></i>';
  }

  function handleResize() {
    let resizeTimer;

    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        // Close menu on desktop breakpoint
        if (window.innerWidth > 768) {
          closeMenu();
        }
      }, 250);
    });
  }

  // Expose closeMenu globally for other scripts if needed
  window.closeMobileMenu = closeMenu;

  // Debug logging (remove in production)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Mobile menu initialized');
  }
})();
