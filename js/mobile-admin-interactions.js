/**
 * Mobile Admin Portal Interactions
 * Native App-Like Experience
 */

(function() {
  'use strict';

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function isMobile() {
    return window.innerWidth < 768;
  }

  function closeAllMenus() {
    document.querySelectorAll('.actions-menu.show').forEach(menu => {
      menu.classList.remove('show');
    });
  }

  function closeAllBottomSheets() {
    document.querySelectorAll('.bottom-sheet-overlay.show').forEach(overlay => {
      overlay.classList.remove('show');
    });
  }

  // ============================================
  // TRANSFORM TABLE ROWS TO MOBILE CARDS
  // ============================================

  function transformShipmentsToCards() {
    if (!isMobile()) return;

    const tbody = document.querySelector('#shipments-tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
      // Skip loading/empty rows
      if (row.cells.length < 7) return;

      const trackingId = row.cells[0]?.textContent?.trim();
      const status = row.cells[1]?.textContent?.trim();
      const location = row.cells[2]?.textContent?.trim();
      const recipient = row.cells[3]?.textContent?.trim();
      const verification = row.cells[4]?.textContent?.trim();
      const securityCode = row.cells[5]?.textContent?.trim();

      // Get action buttons from original row
      const actionsCell = row.cells[6];
      const buttons = actionsCell?.querySelectorAll('button') || [];

      // Create card HTML
      const card = document.createElement('div');
      card.className = 'shipment-card';
      card.innerHTML = `
        <div class="shipment-header">
          <div class="tracking-info">
            <h3>${trackingId}</h3>
            <span class="status">${status}</span>
            <p class="recipient">${recipient}</p>
            ${location ? `<p class="recipient">${location}</p>` : ''}
          </div>
          <button class="menu-toggle" aria-label="Actions">⋮</button>
        </div>

        <div class="action-buttons">
          <button class="btn-primary-action" data-action="send-email">
            <span class="btn-icon">✉️</span>
            <span>Send Email</span>
          </button>
          <button class="btn-secondary-action" data-action="view-details">
            <span class="btn-icon">📋</span>
            <span>Details</span>
          </button>
        </div>

        <div class="actions-menu">
          <button class="menu-item" data-action="view-link">
            <span class="btn-icon">🔗</span>
            View Link
          </button>
          <button class="menu-item" data-action="edit-code">
            <span class="btn-icon">✏️</span>
            Edit Code
          </button>
          <button class="menu-item danger" data-action="delete">
            <span class="btn-icon">🗑️</span>
            Delete Shipment
          </button>
        </div>
      `;

      // Replace row with card
      row.parentNode.replaceChild(card, row);

      // Attach event listeners
      attachCardEventListeners(card, buttons);
    });
  }

  // ============================================
  // ATTACH EVENT LISTENERS TO CARDS
  // ============================================

  function attachCardEventListeners(card, originalButtons) {
    const menuToggle = card.querySelector('.menu-toggle');
    const actionsMenu = card.querySelector('.actions-menu');
    const actionButtons = card.querySelectorAll('[data-action]');

    // Menu toggle
    if (menuToggle && actionsMenu) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        actionsMenu.classList.toggle('show');
      });
    }

    // Action button handlers
    actionButtons.forEach(btn => {
      const action = btn.dataset.action;
      let originalBtn;

      // Map actions to original buttons
      switch(action) {
        case 'send-email':
          originalBtn = Array.from(originalButtons).find(b =>
            b.textContent.includes('Send Email') || b.onclick?.toString().includes('sendEmail')
          );
          break;
        case 'view-details':
          originalBtn = Array.from(originalButtons).find(b =>
            b.textContent.includes('Details') || b.onclick?.toString().includes('details')
          );
          break;
        case 'view-link':
          originalBtn = Array.from(originalButtons).find(b =>
            b.textContent.includes('View Link') || b.onclick?.toString().includes('link')
          );
          break;
        case 'edit-code':
          originalBtn = Array.from(originalButtons).find(b =>
            b.textContent.includes('Edit') || b.onclick?.toString().includes('edit')
          );
          break;
        case 'delete':
          originalBtn = Array.from(originalButtons).find(b =>
            b.textContent.includes('Delete') || b.onclick?.toString().includes('delete')
          );
          break;
      }

      if (originalBtn && originalBtn.onclick) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeAllMenus();
          originalBtn.onclick.call(originalBtn, e);
        });
      }
    });
  }

  // ============================================
  // MODAL MOBILE OPTIMIZATIONS
  // ============================================

  function optimizeModalsForMobile() {
    if (!isMobile()) return;

    const modals = document.querySelectorAll('.production-email-modal');

    modals.forEach(modal => {
      // Add swipe-to-close gesture
      let startY = 0;
      let currentY = 0;

      const content = modal.querySelector('.production-email-modal-content');
      if (!content) return;

      content.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });

      content.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;

        if (deltaY > 0 && content.scrollTop === 0) {
          content.style.transform = `translateY(${deltaY}px)`;
          e.preventDefault();
        }
      });

      content.addEventListener('touchend', () => {
        const deltaY = currentY - startY;

        if (deltaY > 100) {
          // Close modal if dragged down more than 100px
          const closeBtn = modal.querySelector('.btn-close');
          if (closeBtn && closeBtn.onclick) {
            closeBtn.onclick();
          }
        }

        content.style.transform = '';
        startY = 0;
        currentY = 0;
      });
    });
  }

  // ============================================
  // PROGRESS BAR UPDATE
  // ============================================

  function updateProgressBar(step, totalSteps) {
    const progressBar = document.querySelector('.progress-bar');
    if (!progressBar) return;

    const percentage = (step / totalSteps) * 100;
    progressBar.style.setProperty('--progress', `${percentage}%`);
  }

  // ============================================
  // PREVENT BODY SCROLL WHEN MODAL OPEN
  // ============================================

  function preventBodyScrollWhenModalOpen() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const modal = document.querySelector('.production-email-modal[style*="display: flex"], .production-email-modal[style*="display:flex"]');

        if (modal) {
          document.body.style.overflow = 'hidden';
          document.body.style.position = 'fixed';
          document.body.style.width = '100%';
        } else {
          document.body.style.overflow = '';
          document.body.style.position = '';
          document.body.style.width = '';
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style']
    });
  }

  // ============================================
  // CLOSE MENUS ON OUTSIDE CLICK
  // ============================================

  function setupOutsideClickHandler() {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.actions-menu') && !e.target.closest('.menu-toggle')) {
        closeAllMenus();
      }
    });
  }

  // ============================================
  // SMOOTH SCROLL TO TOP ON TAB CHANGE
  // ============================================

  function setupTabScrollHandler() {
    const tabButtons = document.querySelectorAll('.tab-btn');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isMobile()) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  // ============================================
  // OPTIMIZE FILTER BAR FOR MOBILE
  // ============================================

  function optimizeFiltersForMobile() {
    if (!isMobile()) return;

    const filtersBar = document.querySelector('.filters-bar');
    if (!filtersBar) return;

    // Make filters collapsible on mobile
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'filters-toggle';
    toggleBtn.innerHTML = '🔍 Filters';
    toggleBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: #f5f5f5;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 12px;
    `;

    const filterGroups = filtersBar.querySelectorAll('.filter-group, #refresh-btn');
    const filtersContainer = document.createElement('div');
    filtersContainer.className = 'filters-container';
    filtersContainer.style.display = 'none';

    filterGroups.forEach(group => {
      filtersContainer.appendChild(group.cloneNode(true));
      group.style.display = 'none';
    });

    filtersBar.insertBefore(toggleBtn, filtersBar.firstChild);
    filtersBar.appendChild(filtersContainer);

    toggleBtn.addEventListener('click', () => {
      const isVisible = filtersContainer.style.display !== 'none';
      filtersContainer.style.display = isVisible ? 'none' : 'flex';
      filtersContainer.style.flexDirection = 'column';
      filtersContainer.style.gap = '8px';
      toggleBtn.innerHTML = isVisible ? '🔍 Filters' : '✕ Hide Filters';
    });
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    console.log('[Mobile Admin] Initializing mobile optimizations...');

    // Setup handlers
    setupOutsideClickHandler();
    setupTabScrollHandler();
    preventBodyScrollWhenModalOpen();

    // Initial transformations
    if (isMobile()) {
      transformShipmentsToCards();
      optimizeModalsForMobile();
      optimizeFiltersForMobile();
    }

    // Re-run transformations when shipments data changes
    const shipmentsObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && isMobile()) {
          transformShipmentsToCards();
        }
      });
    });

    const tbody = document.querySelector('#shipments-tbody');
    if (tbody) {
      shipmentsObserver.observe(tbody, {
        childList: true,
        subtree: true
      });
    }

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (isMobile()) {
          transformShipmentsToCards();
          optimizeModalsForMobile();
        }
      }, 250);
    });

    console.log('[Mobile Admin] Mobile optimizations initialized ✓');
  }

  // Start initialization
  init();

  // Expose utility functions globally
  window.MobileAdmin = {
    transformShipmentsToCards,
    optimizeModalsForMobile,
    updateProgressBar,
    closeAllMenus,
    closeAllBottomSheets
  };

})();
