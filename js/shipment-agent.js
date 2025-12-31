/**
 * Shipment Event Generator Agent - Template-Based System
 * Admin UI for creating shipment timelines using preset route templates
 */

// State
let routeTemplates = [];
let currentPreview = null;
let selectedTemplate = null;

// Note: API_BASE is defined by admin-verification.js which loads before this script

// Initialize Shipment Agent
async function initializeShipmentAgent() {
  console.log('[Shipment Agent] Initializing template-based system...');

  await loadRouteTemplates();
  setupShipmentAgentEventListeners();
  renderTemplateSelector();
}

// Load route templates from API
async function loadRouteTemplates() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/templates`);
    const data = await response.json();
    routeTemplates = data.templates;

    console.log('[Shipment Agent] Loaded templates:', routeTemplates);
  } catch (error) {
    console.error('[Shipment Agent] Error loading templates:', error);
    alert('Failed to load route templates. Please refresh the page.');
  }
}

// Render template selector
function renderTemplateSelector() {
  // Use the form container that exists in the HTML
  const formContainer = document.getElementById('shipment-agent-form');
  if (!formContainer) {
    console.error('[Shipment Agent] Form container not found');
    return;
  }

  if (routeTemplates.length === 0) {
    formContainer.innerHTML = '<p>No templates available. Please configure templates in the backend.</p>';
    return;
  }

  const currentTemplate = routeTemplates[0]; // Default to first template
  selectedTemplate = currentTemplate;

  // Clear and rebuild the entire form
  formContainer.innerHTML = `
    <div class="form-section">
      <h3>Select Route Template</h3>
      <div class="form-group">
        <label for="template-select">Origin → Destination</label>
        <div style="display: flex; gap: 8px; align-items: flex-start;">
          <select id="template-select" class="form-control" style="flex: 1;">
            ${routeTemplates.map((template, index) => `
              <option value="${index}" ${index === 0 ? 'selected' : ''}>
                ${template.name}
              </option>
            `).join('')}
          </select>
          <button type="button" id="swap-route-btn" class="btn-secondary" style="padding: 8px 16px; white-space: nowrap;" title="Swap origin and destination">
            <span style="font-size: 16px;">⇄</span> Swap
          </button>
        </div>
        <small class="form-text">Total available routes: ${routeTemplates.length}</small>
      </div>

      <div class="template-info" id="template-info-display">
        <div class="template-header">
          <span class="template-icon">✈️</span>
          <div>
            <h4>${currentTemplate.name}</h4>
            <p class="template-route">${currentTemplate.originCity}, ${currentTemplate.originCountry} → ${currentTemplate.destinationCity}, ${currentTemplate.destinationCountry}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Route Options</h3>
      <div class="form-group">
        <label for="route-select">Security Zone Route</label>
        <select id="route-select" class="form-control">
          ${currentTemplate.routes.map(route => {
            const routeDetails = currentTemplate.routeDetails?.[route];
            return `<option value="${route}">${routeDetails?.name || `Route ${route.slice(-1)}`}</option>`;
          }).join('')}
        </select>
        <small class="form-text">Security zone: <span id="security-zone-display">${currentTemplate.routeDetails?.routeA?.securityZone || 'Loading...'}</span></small>
      </div>

      <div class="form-group">
        <label for="journey-type-select">Journey Type</label>
        <select id="journey-type-select" class="form-control">
          ${currentTemplate.journeyTypes.map(type => `
            <option value="${type}" ${type === 'standard' ? 'selected' : ''}>
              ${type.charAt(0).toUpperCase() + type.slice(1)}
              ${type === 'minimal' ? '(~20 events, key milestones)' : ''}
              ${type === 'standard' ? '(~35 events, balanced detail)' : ''}
              ${type === 'detailed' ? '(~55 events, comprehensive)' : ''}
            </option>
          `).join('')}
        </select>
        <small class="form-text">Journey type controls event density. All types have the same timeline duration.</small>
      </div>
    </div>

    <div class="form-section">
      <h3>Shipment Details</h3>

      <div class="form-row">
        <div class="form-group">
          <label for="shipper-name">Shipper Name</label>
          <input type="text" id="shipper-name" class="form-control" placeholder="Company or individual name">
        </div>
        <div class="form-group">
          <label for="shipper-address">Shipper Address</label>
          <input type="text" id="shipper-address" class="form-control" placeholder="Full address">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="recipient-name">Recipient Name</label>
          <input type="text" id="recipient-name" class="form-control" placeholder="Recipient full name" required>
        </div>
        <div class="form-group">
          <label for="recipient-email">Recipient Email</label>
          <input type="email" id="recipient-email" class="form-control" placeholder="recipient@example.com">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="recipient-address">Recipient Address</label>
          <input type="text" id="recipient-address" class="form-control" placeholder="Full delivery address">
        </div>
        <div class="form-group">
          <label for="recipient-city">Recipient City</label>
          <input type="text" id="recipient-city" class="form-control" placeholder="City" value="${currentTemplate.destinationCity}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="declared-value">Declared Value (USD)</label>
          <input type="number" id="declared-value" class="form-control" placeholder="0.00" step="0.01">
        </div>
        <div class="form-group">
          <label for="weight-value">Weight (kg)</label>
          <input type="number" id="weight-value" class="form-control" placeholder="0.0" step="0.1">
        </div>
      </div>

      <div class="form-group">
        <label for="start-date">Start Date & Time</label>
        <input type="datetime-local" id="start-date" class="form-control" value="${new Date().toISOString().slice(0, 16)}">
        <small class="form-text">Timeline will start from this date/time</small>
      </div>

      <div class="form-group">
        <label for="security-code">Security Code (Optional)</label>
        <input type="text" id="security-code" class="form-control" placeholder="10-digit code" maxlength="10" pattern="[0-9]{10}">
        <small class="form-text">Leave empty to auto-generate. Must be exactly 10 digits (0-9).</small>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" id="preview-shipment-btn" class="btn-primary">
        <span>📋</span> Preview Timeline
      </button>
      <button type="button" id="reset-form-btn" class="btn-secondary">
        <span>🔄</span> Reset Form
      </button>
    </div>
  `;

  // Initial swap button state update
  setTimeout(() => {
    if (typeof updateSwapButtonState === 'function') {
      updateSwapButtonState();
    }
  }, 0);
}

// Update swap button state when template changes
function updateSwapButtonState() {
  if (!selectedTemplate) return;

  const swapBtn = document.getElementById('swap-route-btn');
  if (!swapBtn) return;

  // Check if reverse route exists
  const reverseExists = routeTemplates.some(t =>
    t.originCountry === selectedTemplate.destinationCountry &&
    t.originCity === selectedTemplate.destinationCity &&
    t.destinationCountry === selectedTemplate.originCountry &&
    t.destinationCity === selectedTemplate.originCity
  );

  // Update button appearance
  if (reverseExists) {
    swapBtn.disabled = false;
    swapBtn.style.opacity = '1';
    swapBtn.title = `Swap to ${selectedTemplate.destinationCity} → ${selectedTemplate.originCity}`;
  } else {
    swapBtn.disabled = true;
    swapBtn.style.opacity = '0.5';
    swapBtn.title = 'No reverse route available';
  }
}

// Setup event listeners
function setupShipmentAgentEventListeners() {
  // Preview button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'preview-shipment-btn' || e.target.closest('#preview-shipment-btn')) {
      previewShipmentTimeline();
    }
  });

  // Reset button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'reset-form-btn' || e.target.closest('#reset-form-btn')) {
      renderTemplateSelector();
    }
  });

  // Swap route button - find and select reverse route
  document.addEventListener('click', (e) => {
    // Check if click is on swap button or its children
    const swapBtn = e.target.closest('#swap-route-btn');
    if (swapBtn) {
      e.preventDefault();
      e.stopPropagation();

      console.log('[Shipment Agent] Swap button clicked');

      if (!selectedTemplate) {
        console.warn('[Shipment Agent] No template selected');
        return;
      }

      console.log('[Shipment Agent] Current template:', selectedTemplate.name);

      // Find reverse route (swap origin and destination)
      const reverseRoute = routeTemplates.find(t =>
        t.originCountry === selectedTemplate.destinationCountry &&
        t.originCity === selectedTemplate.destinationCity &&
        t.destinationCountry === selectedTemplate.originCountry &&
        t.destinationCity === selectedTemplate.originCity
      );

      if (reverseRoute) {
        console.log('[Shipment Agent] Found reverse route:', reverseRoute.name);
        // Found reverse route - select it
        const reverseIndex = routeTemplates.indexOf(reverseRoute);
        const templateSelect = document.getElementById('template-select');
        if (templateSelect) {
          templateSelect.value = reverseIndex;
          // Trigger change event to update the UI
          templateSelect.dispatchEvent(new Event('change'));
          console.log('[Shipment Agent] Swapped to:', reverseRoute.name);
        }
      } else {
        console.warn('[Shipment Agent] No reverse route found');
        alert(`No reverse route found for ${selectedTemplate.destinationCity} → ${selectedTemplate.originCity}.\n\nAvailable routes only go in one direction.`);
      }
    }
  });

  // Template selector change - rebuild form with new template
  document.addEventListener('change', (e) => {
    if (e.target.id === 'template-select') {
      const templateIndex = parseInt(e.target.value);
      selectedTemplate = routeTemplates[templateIndex];

      // Update template info display
      const templateInfo = document.getElementById('template-info-display');
      if (templateInfo && selectedTemplate) {
        templateInfo.innerHTML = `
          <div class="template-header">
            <span class="template-icon">✈️</span>
            <div>
              <h4>${selectedTemplate.name}</h4>
              <p class="template-route">${selectedTemplate.originCity}, ${selectedTemplate.originCountry} → ${selectedTemplate.destinationCity}, ${selectedTemplate.destinationCountry}</p>
            </div>
          </div>
        `;
      }

      // Update route selector
      const routeSelect = document.getElementById('route-select');
      if (routeSelect && selectedTemplate) {
        routeSelect.innerHTML = selectedTemplate.routes.map(route => {
          const routeDetails = selectedTemplate.routeDetails?.[route];
          return `<option value="${route}">${routeDetails?.name || `Route ${route.slice(-1)}`}</option>`;
        }).join('');

        // Update security zone display
        const securityZoneDisplay = document.getElementById('security-zone-display');
        if (securityZoneDisplay) {
          securityZoneDisplay.textContent = selectedTemplate.routeDetails?.routeA?.securityZone || 'Loading...';
        }
      }

      // Update journey type selector
      const journeyTypeSelect = document.getElementById('journey-type-select');
      if (journeyTypeSelect && selectedTemplate) {
        journeyTypeSelect.innerHTML = selectedTemplate.journeyTypes.map(type => `
          <option value="${type}" ${type === 'standard' ? 'selected' : ''}>
            ${type.charAt(0).toUpperCase() + type.slice(1)}
            ${type === 'minimal' ? '(~20 events, key milestones)' : ''}
            ${type === 'standard' ? '(~35 events, balanced detail)' : ''}
            ${type === 'detailed' ? '(~55 events, comprehensive)' : ''}
          </option>
        `).join('');
      }

      // Update swap button state
      updateSwapButtonState();
    }
  });

  // Route selector change - update security zone display
  document.addEventListener('change', (e) => {
    if (e.target.id === 'route-select') {
      const routeKey = e.target.value;
      const securityZoneDisplay = document.getElementById('security-zone-display');
      if (securityZoneDisplay && selectedTemplate?.routeDetails?.[routeKey]) {
        securityZoneDisplay.textContent = selectedTemplate.routeDetails[routeKey].securityZone;
      }
    }
  });

  // Create button (in modal)
  document.addEventListener('click', (e) => {
    if (e.target.id === 'create-shipment-btn' || e.target.closest('#create-shipment-btn')) {
      createShipment();
    }
  });

  // Close preview modal
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('close-shipment-preview-modal') || e.target.closest('.close-shipment-preview-modal')) {
      closeShipmentPreviewModal();
    }
  });

  // Close shipment agent modal
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('close-shipment-agent-modal')) {
      closeShipmentAgentModal();
    }
  });

  // Close on outside click (preview modal)
  document.addEventListener('click', (e) => {
    const previewModal = document.getElementById('shipment-preview-modal');
    if (e.target === previewModal) {
      closeShipmentPreviewModal();
    }
  });

  // Close on outside click (agent modal)
  document.addEventListener('click', (e) => {
    const agentModal = document.getElementById('shipment-agent-modal');
    if (e.target === agentModal) {
      closeShipmentAgentModal();
    }
  });
}

// Get configuration from form
function getShipmentConfig() {
  const route = document.getElementById('route-select')?.value || 'routeA';
  const journeyType = document.getElementById('journey-type-select')?.value || 'standard';
  const startDate = document.getElementById('start-date')?.value || new Date().toISOString();
  const securityCode = document.getElementById('security-code')?.value?.trim() || undefined;

  return {
    originCountry: selectedTemplate.originCountry,
    originCity: selectedTemplate.originCity,
    destinationCountry: selectedTemplate.destinationCountry,
    destinationCity: selectedTemplate.destinationCity,
    route,
    journeyType,
    startDate,
    securityCode,
    // Additional details
    shipperName: document.getElementById('shipper-name')?.value || '',
    shipperAddress: document.getElementById('shipper-address')?.value || '',
    recipientName: document.getElementById('recipient-name')?.value || '',
    recipientEmail: document.getElementById('recipient-email')?.value || '',
    recipientAddress: document.getElementById('recipient-address')?.value || '',
    recipientCity: document.getElementById('recipient-city')?.value || '',
    recipientPhone: '',
    declaredValue: document.getElementById('declared-value')?.value || 0,
    weight: document.getElementById('weight-value')?.value || 0
  };
}

// Validate configuration
function validateShipmentConfig(config) {
  const errors = [];

  if (!config.recipientName) {
    errors.push('Recipient name is required');
  }

  if (config.securityCode && config.securityCode.length !== 10) {
    errors.push('Security code must be exactly 10 digits');
  }

  if (config.securityCode && !/^[0-9]{10}$/.test(config.securityCode)) {
    errors.push('Security code must contain only numbers (0-9)');
  }

  if (errors.length > 0) {
    alert('Validation errors:\n\n' + errors.join('\n'));
    return false;
  }

  return true;
}

// Preview shipment timeline
async function previewShipmentTimeline() {
  console.log('[Shipment Agent] Preview button clicked');

  const config = getShipmentConfig();
  console.log('[Shipment Agent] Config:', config);

  if (!validateShipmentConfig(config)) {
    return;
  }

  const previewBtn = document.getElementById('preview-shipment-btn');
  previewBtn.disabled = true;
  previewBtn.innerHTML = '<span>⏳</span> Generating Preview...';

  try {
    console.log('[Shipment Agent] Sending template preview request');

    const response = await fetch(`${API_BASE}/shipment-agent/template-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await response.json();
    console.log('[Shipment Agent] Response:', data);

    if (!response.ok || !data.success) {
      const errorMsg = data.error || 'Failed to generate preview';
      const details = data.details ? '\n\nDetails: ' + data.details : '';
      throw new Error(errorMsg + details);
    }

    currentPreview = data;
    showPreviewModal(data);

  } catch (error) {
    console.error('[Shipment Agent] Error:', error);
    alert('Failed to generate preview:\n\n' + error.message);
  } finally {
    previewBtn.disabled = false;
    previewBtn.innerHTML = '<span>📋</span> Preview Timeline';
  }
}

// Show preview modal
function showPreviewModal(preview) {
  const modal = document.getElementById('shipment-preview-modal');
  if (!modal) {
    console.error('[Shipment Agent] Preview modal not found');
    return;
  }

  // Get origin and destination from config
  const config = getShipmentConfig();

  // Update summary fields using existing HTML structure
  document.getElementById('preview-origin').textContent = `${config.originCity}, ${config.originCountry}`;
  document.getElementById('preview-destination').textContent = `${config.destinationCity}, ${config.destinationCountry}`;
  document.getElementById('preview-total-events').textContent = `${preview.totalEvents} (${preview.confirmedEvents} confirmed + ${preview.pendingEvents} pending)`;
  document.getElementById('preview-duration').textContent = new Date(preview.estimatedCompletion).toLocaleDateString();
  document.getElementById('preview-route').textContent = `${preview.route.routeName} - ${preview.route.journeyType.toUpperCase()}`;

  // Show security zone info if available
  const securityInfo = document.getElementById('preview-security-info');
  const securityZone = document.getElementById('preview-security-zone');
  if (preview.route.securityZone) {
    securityZone.textContent = preview.route.securityZone;
    securityInfo.style.display = 'block';
  } else {
    securityInfo.style.display = 'none';
  }

  // Build events timeline
  const confirmedEvents = preview.events.filter(e => !e.is_pending);
  const pendingEvents = preview.events.filter(e => e.is_pending);

  const eventsHtml = `
    <div class="events-section">
      <h4>✓ Confirmed Events (${confirmedEvents.length})</h4>
      <div class="timeline-events">
        ${confirmedEvents.map(event => `
          <div class="timeline-event ${event.status === 'HLD' ? 'security-hold' : ''}">
            <div class="timeline-marker">${event.order}</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-status">${event.status}</span>
                <span class="timeline-time">${event.timestamp ? new Date(event.timestamp).toLocaleString() : 'Pending'}</span>
              </div>
              <div class="timeline-location">${event.location}</div>
              <div class="timeline-description">${event.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${pendingEvents.length > 0 ? `
    <div class="events-section pending-section">
      <h4>⏳ Pending Events (${pendingEvents.length}) - After Security Clearance</h4>
      <div class="timeline-events">
        ${pendingEvents.map(event => `
          <div class="timeline-event pending-event">
            <div class="timeline-marker">P${event.order - confirmedEvents.length}</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-status">${event.status}</span>
                <span class="timeline-offset">+${event.scheduled_offset} days after clearance</span>
              </div>
              <div class="timeline-location">${event.location}</div>
              <div class="timeline-description">${event.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  // Update timeline container
  const timelineContainer = document.getElementById('preview-events-timeline');
  if (timelineContainer) {
    timelineContainer.innerHTML = eventsHtml;
  }

  modal.style.display = 'flex';
}

// Close preview modal
function closeShipmentPreviewModal() {
  const modal = document.getElementById('shipment-preview-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Create and save shipment
async function createShipment() {
  if (!currentPreview) {
    alert('Please preview the shipment first');
    return;
  }

  if (!confirm(`Create shipment with ${currentPreview.totalEvents} events?\n\nThis will generate a new tracking ID and save all events to the database.`)) {
    return;
  }

  const config = getShipmentConfig();

  const createBtn = document.getElementById('create-shipment-btn');
  createBtn.disabled = true;
  createBtn.innerHTML = '<span>⏳</span> Creating Shipment...';

  try {
    const response = await fetch(`${API_BASE}/shipment-agent/template-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create shipment');
    }

    alert(`✓ Shipment created successfully!\n\nTracking ID: ${data.trackingId}\nTemplate: ${data.template}\nRoute: ${data.route}\nJourney Type: ${data.journeyType}\nTotal Events: ${data.totalEvents} (${data.confirmedEvents} confirmed + ${data.pendingEvents} pending)`);

    // Close modals
    closeShipmentPreviewModal();
    closeShipmentAgentModal();

    // Refresh shipments list if on admin page
    if (typeof loadShipments === 'function') {
      loadShipments();
    }

  } catch (error) {
    console.error('[Shipment Agent] Error creating shipment:', error);
    alert('Failed to create shipment:\n\n' + error.message);
  } finally {
    createBtn.disabled = false;
    createBtn.innerHTML = '<span>✓</span> Create Shipment';
  }
}

// Close shipment agent modal
function closeShipmentAgentModal() {
  const modal = document.getElementById('shipment-agent-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Open shipment agent modal (called from admin page button)
function openShipmentAgentModal() {
  const modal = document.getElementById('shipment-agent-modal');
  if (modal) {
    modal.style.display = 'flex';
    // Reinitialize template selector when opening
    renderTemplateSelector();
  } else {
    console.error('[Shipment Agent] Modal not found');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeShipmentAgent);
} else {
  initializeShipmentAgent();
}
