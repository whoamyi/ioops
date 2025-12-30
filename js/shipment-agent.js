/**
 * Shipment Event Generator Agent
 * Admin UI for creating realistic shipment timelines
 */

// State
let airportsByRegion = {};
let securityZones = [];
let configTemplates = [];
let currentPreview = null;
let citiesByRegion = {};
let currencies = {};
let weightUnits = {};
let currentRouteInfo = null;

// Initialize Shipment Agent
async function initializeShipmentAgent() {
  console.log('[Shipment Agent] Initializing...');

  // Load all data
  await Promise.all([
    loadAirports(),
    loadSecurityZones(),
    loadConfigTemplates(),
    loadCities(),
    loadCurrencies(),
    loadWeightUnits()
  ]);

  setupShipmentAgentEventListeners();
}

// Load airports data
async function loadAirports() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/airports`);
    const data = await response.json();
    airportsByRegion = data.airports;

    renderAirportSelections();
  } catch (error) {
    console.error('[Shipment Agent] Error loading airports:', error);
  }
}

// Load security zones
async function loadSecurityZones() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/security-zones`);
    const data = await response.json();
    securityZones = data.securityZones;

    renderSecurityZoneSelection();
  } catch (error) {
    console.error('[Shipment Agent] Error loading security zones:', error);
  }
}

// Load configuration templates
async function loadConfigTemplates() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/config-templates`);
    const data = await response.json();
    configTemplates = data.templates;

    renderConfigTemplates();
  } catch (error) {
    console.error('[Shipment Agent] Error loading templates:', error);
  }
}

// Load cities data
async function loadCities() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/cities`);
    const data = await response.json();
    citiesByRegion = data.cities;

    renderCitySelection();
  } catch (error) {
    console.error('[Shipment Agent] Error loading cities:', error);
  }
}

// Load currencies
async function loadCurrencies() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/currencies`);
    const data = await response.json();
    currencies = data.currencies;

    renderCurrencySelection();
  } catch (error) {
    console.error('[Shipment Agent] Error loading currencies:', error);
  }
}

// Load weight units
async function loadWeightUnits() {
  try {
    const response = await fetch(`${API_BASE}/shipment-agent/weight-units`);
    const data = await response.json();
    weightUnits = data.weightUnits;

    renderWeightUnitSelection();
  } catch (error) {
    console.error('[Shipment Agent] Error loading weight units:', error);
  }
}

// Render airport dropdowns
function renderAirportSelections() {
  const originSelect = document.getElementById('origin-airport-select');
  const destinationSelect = document.getElementById('destination-airport-select');

  if (!originSelect || !destinationSelect) return;

  let optionsHTML = '<option value="">Select Airport</option>';

  Object.keys(airportsByRegion).forEach(region => {
    optionsHTML += `<optgroup label="${region}">`;
    airportsByRegion[region].forEach(airport => {
      optionsHTML += `<option value="${airport.code}">${airport.code} - ${airport.name}, ${airport.city}, ${airport.country}</option>`;
    });
    optionsHTML += '</optgroup>';
  });

  originSelect.innerHTML = optionsHTML;
  destinationSelect.innerHTML = optionsHTML;
}

// Render security zone selection
function renderSecurityZoneSelection() {
  const select = document.getElementById('security-zone-select');
  if (!select) return;

  let html = '<option value="">No Security Hold</option>';

  securityZones.forEach(zone => {
    html += `<option value="${zone.code}">${zone.name} (${zone.avgHoldTime}h avg hold)</option>`;
  });

  select.innerHTML = html;
}

// Filter security zones based on selected route
async function filterSecurityZonesByRoute() {
  const originAirport = document.getElementById('origin-airport-select').value;
  const destinationAirport = document.getElementById('destination-airport-select').value;

  if (!originAirport || !destinationAirport) {
    renderSecurityZoneSelection(); // Show all zones
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/shipment-agent/routes?from=${originAirport}&to=${destinationAirport}`);
    const data = await response.json();

    if (data.success && data.recommended) {
      currentRouteInfo = data;
      renderFilteredSecurityZones(data.recommended.securityZones);
    } else {
      renderSecurityZoneSelection();
    }
  } catch (error) {
    console.error('[Shipment Agent] Error fetching route info:', error);
    renderSecurityZoneSelection();
  }
}

// Render filtered security zones based on route
function renderFilteredSecurityZones(compatibleZones) {
  const select = document.getElementById('security-zone-select');
  if (!select) return;

  let html = '<option value="">No Security Hold</option>';

  const filteredZones = securityZones.filter(zone => compatibleZones.includes(zone.code));

  if (filteredZones.length > 0) {
    filteredZones.forEach(zone => {
      html += `<option value="${zone.code}">${zone.name} (${zone.avgHoldTime}h avg hold)</option>`;
    });
  } else {
    // If no compatible zones, show all
    securityZones.forEach(zone => {
      html += `<option value="${zone.code}">${zone.name} (${zone.avgHoldTime}h avg hold)</option>`;
    });
  }

  select.innerHTML = html;
}

// Render city selection
function renderCitySelection() {
  const datalist = document.getElementById('city-datalist');
  if (!datalist) return;

  let html = '';

  Object.keys(citiesByRegion).forEach(region => {
    citiesByRegion[region].forEach(city => {
      html += `<option value="${city.name}, ${city.country}"></option>`;
    });
  });

  datalist.innerHTML = html;
}

// Render currency selection
function renderCurrencySelection() {
  const select = document.getElementById('currency-select');
  if (!select) return;

  let html = '';

  Object.keys(currencies).forEach(code => {
    const currency = currencies[code];
    const selected = code === 'USD' ? 'selected' : '';
    html += `<option value="${code}" ${selected}>${currency.symbol} ${code}</option>`;
  });

  select.innerHTML = html;
}

// Render weight unit selection
function renderWeightUnitSelection() {
  const select = document.getElementById('weight-unit-select');
  if (!select) return;

  let html = '';

  Object.keys(weightUnits).forEach(unit => {
    const weightUnit = weightUnits[unit];
    const selected = unit === 'kg' ? 'selected' : '';
    html += `<option value="${unit}" ${selected}>${unit}</option>`;
  });

  select.innerHTML = html;
}

// Render configuration templates
function renderConfigTemplates(showAll = false) {
  const container = document.getElementById('config-templates');
  if (!container) return;

  const featuredTemplates = configTemplates.filter(t => t.featured);
  const additionalTemplates = configTemplates.filter(t => !t.featured);
  const templatesToShow = showAll ? configTemplates : featuredTemplates;

  const templateCards = templatesToShow.map(template => {
    // Build journey types display
    const journeyTypesDisplay = template.journeyTypes
      ? template.journeyTypes.map(jt => `${jt.label} (${jt.events})`).join(', ')
      : 'Various';

    // Count security zones
    const securityZonesCount = template.securityZones ? template.securityZones.length : 0;

    return `
      <div class="config-template-card" onclick="applyConfigTemplate('${template.id}')">
        <h4>${template.name}</h4>
        <p>${template.description}</p>
        <div class="template-details">
          <span class="badge">${template.origin} → ${template.destination}</span>
          ${securityZonesCount > 0 ? `<span class="badge badge-security">${securityZonesCount} security zones</span>` : ''}
          <span class="badge">${journeyTypesDisplay}</span>
        </div>
      </div>
    `;
  }).join('');

  const viewMoreButton = !showAll && additionalTemplates.length > 0 ? `
    <div class="view-more-templates-container">
      <button type="button" class="btn btn-outline" onclick="toggleTemplateView(true)">
        View More Templates (${additionalTemplates.length} more)
      </button>
    </div>
  ` : '';

  const showLessButton = showAll ? `
    <div class="view-more-templates-container">
      <button type="button" class="btn btn-outline" onclick="toggleTemplateView(false)">
        Show Less
      </button>
    </div>
  ` : '';

  container.innerHTML = templateCards + viewMoreButton + showLessButton;
}

// Toggle template view (show all or featured only)
function toggleTemplateView(showAll) {
  renderConfigTemplates(showAll);
}

// Apply configuration template
function applyConfigTemplate(templateId) {
  const template = configTemplates.find(t => t.id === templateId);
  if (!template) {
    console.error('[Shipment Agent] Template not found:', templateId);
    return;
  }

  console.log('[Shipment Agent] Applying template:', template);

  // Set airports (hidden from user, but needed for backend)
  const originSelect = document.getElementById('origin-airport-select');
  const destinationSelect = document.getElementById('destination-airport-select');

  if (originSelect) {
    originSelect.value = template.origin;
    console.log('[Shipment Agent] Set origin to:', template.origin, 'Actual value:', originSelect.value);
  }

  if (destinationSelect) {
    destinationSelect.value = template.destination;
    console.log('[Shipment Agent] Set destination to:', template.destination, 'Actual value:', destinationSelect.value);
  }

  // Populate security zones dropdown with template's available zones
  if (template.securityZones && template.securityZones.length > 0) {
    renderTemplateSecurityZones(template.securityZones);

    // Set default security zone if specified
    if (template.defaultSecurityZone) {
      const securitySelect = document.getElementById('security-zone-select');
      if (securitySelect) {
        securitySelect.value = template.defaultSecurityZone;

        // Generate security code
        const securityCodeInput = document.getElementById('security-code-input');
        if (securityCodeInput) {
          securityCodeInput.value = generateSecurityCode();
        }
      }
    }
  } else {
    // Fallback to route-based filtering
    filterSecurityZonesByRoute();
  }

  // Populate journey type selector with template's journey types
  if (template.journeyTypes && template.journeyTypes.length > 0) {
    renderJourneyTypes(template.journeyTypes);

    // Select the second option (Standard) by default, or first if only one
    const journeySelect = document.getElementById('journey-type-select');
    if (journeySelect && journeySelect.options.length > 1) {
      journeySelect.selectedIndex = 1; // Standard
    }
  }

  showNotification(`Template "${template.name}" applied`, 'success');
}

// Render security zones from template
function renderTemplateSecurityZones(templateZoneCodes) {
  const select = document.getElementById('security-zone-select');
  if (!select) return;

  let html = '<option value="">No Security Hold</option>';

  // Filter to only show zones from template
  const filteredZones = securityZones.filter(zone => templateZoneCodes.includes(zone.code));

  filteredZones.forEach(zone => {
    html += `<option value="${zone.code}">${zone.name} (${zone.avgHoldTime}h avg hold)</option>`;
  });

  select.innerHTML = html;
}

// Render journey types from template
function renderJourneyTypes(journeyTypes) {
  const select = document.getElementById('journey-type-select');
  if (!select) return;

  let html = '';

  journeyTypes.forEach((journeyType) => {
    html += `<option value="${journeyType.events}">${journeyType.label} (${journeyType.events} events)</option>`;
  });

  select.innerHTML = html;

  // Update the visible journey type section
  const journeySection = document.getElementById('journey-type-section');
  if (journeySection) {
    journeySection.style.display = 'block';
  }
}

// Generate security code (10 digits only)
function generateSecurityCode() {
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

// Generate random security code button
function generateRandomSecurityCode() {
  const code = generateSecurityCode();
  document.getElementById('security-code-input').value = code;
}

// Preview shipment timeline
async function previewShipmentTimeline() {
  const config = getShipmentConfig();

  if (!validateShipmentConfig(config)) {
    return;
  }

  const previewBtn = document.getElementById('preview-shipment-btn');
  previewBtn.disabled = true;
  previewBtn.textContent = 'Generating Preview...';

  try {
    const response = await fetch(`${API_BASE}/shipment-agent/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.error || 'Failed to generate preview';
      const details = data.details ? '\n\nDetails:\n- ' + data.details.join('\n- ') : '';
      throw new Error(errorMsg + details);
    }

    currentPreview = data;
    showPreviewModal(data);

  } catch (error) {
    console.error('[Shipment Agent] Error generating preview:', error);
    alert('Failed to generate preview: ' + error.message);
  } finally {
    previewBtn.disabled = false;
    previewBtn.textContent = 'Preview Timeline';
  }
}

// Show preview modal
function showPreviewModal(preview) {
  const modal = document.getElementById('shipment-preview-modal');
  if (!modal) {
    console.error('[Shipment Agent] Preview modal not found');
    return;
  }

  // Set summary
  document.getElementById('preview-origin').textContent = preview.summary.origin;
  document.getElementById('preview-destination').textContent = preview.summary.destination;
  document.getElementById('preview-total-events').textContent = preview.summary.totalEvents;
  document.getElementById('preview-duration').textContent = preview.summary.estimatedDuration;
  document.getElementById('preview-route').textContent = preview.summary.route;

  if (preview.summary.hasSecurityHold) {
    document.getElementById('preview-security-zone').textContent = preview.summary.securityZone;
    document.getElementById('preview-security-info').style.display = 'block';
  } else {
    document.getElementById('preview-security-info').style.display = 'none';
  }

  // Render events timeline
  const eventsContainer = document.getElementById('preview-events-timeline');
  eventsContainer.innerHTML = preview.events.map((event, index) => `
    <div class="timeline-event">
      <div class="timeline-marker">${event.order}</div>
      <div class="timeline-content">
        <div class="timeline-time">${event.formattedDate}</div>
        <div class="timeline-status">${event.status}</div>
        <div class="timeline-location">${event.location}</div>
        <div class="timeline-description">${event.description}</div>
        ${Object.keys(event.details).length > 0 ? `
          <div class="timeline-details">
            ${Object.entries(event.details).map(([key, value]) =>
              `<span class="detail-item"><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</span>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

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

  if (!confirm(`Create shipment with ${currentPreview.summary.totalEvents} events?\n\nThis will generate a new tracking ID and save all events to the database.`)) {
    return;
  }

  const config = getShipmentConfig();

  const createBtn = document.getElementById('create-shipment-btn');
  createBtn.disabled = true;
  createBtn.textContent = 'Creating Shipment...';

  try {
    const response = await fetch(`${API_BASE}/shipment-agent/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to create shipment');
    }

    alert(`Shipment created successfully!\n\nTracking ID: ${data.trackingId}\nTotal Events: ${data.totalEvents}\n\nFirst Event: ${data.firstEvent.status} at ${new Date(data.firstEvent.timestamp).toLocaleString()}\nLast Event: ${data.lastEvent.status} at ${new Date(data.lastEvent.timestamp).toLocaleString()}`);

    // Close modals
    closeShipmentPreviewModal();
    closeShipmentAgentModal();

    // Refresh shipments list if on admin page
    if (typeof loadShipments === 'function') {
      loadShipments();
    }

  } catch (error) {
    console.error('[Shipment Agent] Error creating shipment:', error);
    alert('Failed to create shipment: ' + error.message);
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Create Shipment';
  }
}

// Get shipment configuration from form
function getShipmentConfig() {
  const currencyCode = document.getElementById('currency-select').value;
  const currencySymbol = currencies[currencyCode]?.symbol || '$';
  const declaredAmount = document.getElementById('declared-value-input').value;

  const weightValue = document.getElementById('weight-value-input').value;
  const weightUnit = document.getElementById('weight-unit-select').value;

  // Check for journey type selector (new template system) or fallback to old events selector
  const journeyTypeSelect = document.getElementById('journey-type-select');
  let numberOfEvents = 30; // default

  if (journeyTypeSelect && journeyTypeSelect.value) {
    numberOfEvents = parseInt(journeyTypeSelect.value);
  } else {
    const eventsSelect = document.getElementById('number-events-select');
    if (eventsSelect) {
      numberOfEvents = parseInt(eventsSelect.value) || 30;
    }
  }

  return {
    originAirport: document.getElementById('origin-airport-select').value,
    destinationAirport: document.getElementById('destination-airport-select').value,
    shipperName: document.getElementById('shipper-name-input').value,
    shipperAddress: document.getElementById('shipper-address-input').value,
    recipientName: document.getElementById('recipient-name-input').value,
    recipientEmail: document.getElementById('recipient-email-input').value,
    recipientAddress: document.getElementById('recipient-address-input').value,
    recipientCity: document.getElementById('recipient-city-input').value,
    declaredValue: `${currencySymbol}${declaredAmount} ${currencyCode}`,
    weight: `${weightValue} ${weightUnit}`,
    securityZone: document.getElementById('security-zone-select').value || null,
    securityCode: document.getElementById('security-code-input').value || null,
    startDate: document.getElementById('start-date-input').value || null,
    numberOfEvents: numberOfEvents
  };
}

// Validate shipment configuration
function validateShipmentConfig(config) {
  const errors = [];

  if (!config.originAirport) errors.push('Origin airport is required');
  if (!config.destinationAirport) errors.push('Destination airport is required');
  if (!config.shipperName) errors.push('Shipper name is required');
  if (!config.recipientName) errors.push('Recipient name is required');
  if (!config.recipientAddress) errors.push('Recipient address is required');
  if (!config.recipientCity) errors.push('Recipient city is required');
  if (!config.declaredValue) errors.push('Declared value is required');
  if (!config.weight) errors.push('Weight is required');

  if (config.securityZone && !config.securityCode) {
    errors.push('Security code is required when security zone is selected');
  }

  if (config.securityCode && config.securityCode.length !== 10) {
    errors.push('Security code must be exactly 10 digits');
  }

  if (config.securityCode && !/^[0-9]{10}$/.test(config.securityCode)) {
    errors.push('Security code must contain only numbers (0-9)');
  }

  if (errors.length > 0) {
    alert('Please fix the following errors:\n\n' + errors.join('\n'));
    return false;
  }

  return true;
}

// Open shipment agent modal
function openShipmentAgentModal() {
  const modal = document.getElementById('shipment-agent-modal');
  if (!modal) {
    console.error('[Shipment Agent] Modal not found');
    return;
  }

  // Set default start date to now
  const now = new Date();
  document.getElementById('start-date-input').value = now.toISOString().slice(0, 16);

  modal.style.display = 'flex';

  // Initialize if not already done
  if (Object.keys(airportsByRegion).length === 0) {
    initializeShipmentAgent();
  }
}

// Close shipment agent modal
function closeShipmentAgentModal() {
  const modal = document.getElementById('shipment-agent-modal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Reset form
  document.getElementById('shipment-agent-form').reset();
  currentPreview = null;
}

// Filter security zones based on selected route
async function filterSecurityZonesByRoute() {
  const originAirport = document.getElementById('origin-airport-select').value;
  const destinationAirport = document.getElementById('destination-airport-select').value;

  if (!originAirport || !destinationAirport) {
    renderSecurityZoneSelection(); // Show all zones
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/shipment-agent/routes?from=${originAirport}&to=${destinationAirport}`);
    const data = await response.json();

    if (data.success && data.recommended) {
      currentRouteInfo = data;
      renderFilteredSecurityZones(data.recommended.securityZones);
    } else {
      renderSecurityZoneSelection(); // Fallback to all zones
    }
  } catch (error) {
    console.error('[Shipment Agent] Error fetching route info:', error);
    renderSecurityZoneSelection(); // Fallback to all zones
  }
}

// Render filtered security zones based on route
function renderFilteredSecurityZones(compatibleZones) {
  const select = document.getElementById('security-zone-select');
  if (!select) return;

  let html = '<option value="">No Security Hold</option>';

  // Filter to only show compatible zones
  const filteredZones = securityZones.filter(zone => compatibleZones.includes(zone.code));

  if (filteredZones.length > 0) {
    filteredZones.forEach(zone => {
      html += `<option value="${zone.code}">${zone.name} (${zone.avgHoldTime}h avg hold)</option>`;
    });
  } else {
    // If no compatible zones, show all
    securityZones.forEach(zone => {
      html += `<option value="${zone.code}">${zone.name} (${zone.avgHoldTime}h avg hold)</option>`;
    });
  }

  select.innerHTML = html;
}

// Setup event listeners
function setupShipmentAgentEventListeners() {
  const previewBtn = document.getElementById('preview-shipment-btn');
  if (previewBtn) {
    previewBtn.addEventListener('click', previewShipmentTimeline);
  }

  const createBtn = document.getElementById('create-shipment-btn');
  if (createBtn) {
    createBtn.addEventListener('click', createShipment);
  }

  const generateCodeBtn = document.getElementById('generate-security-code-btn');
  if (generateCodeBtn) {
    generateCodeBtn.addEventListener('click', generateRandomSecurityCode);
  }

  // Listen for origin/destination changes to filter security zones
  const originSelect = document.getElementById('origin-airport-select');
  const destinationSelect = document.getElementById('destination-airport-select');

  if (originSelect) {
    originSelect.addEventListener('change', filterSecurityZonesByRoute);
  }

  if (destinationSelect) {
    destinationSelect.addEventListener('change', filterSecurityZonesByRoute);
  }

  const closeButtons = document.querySelectorAll('.close-shipment-agent-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', closeShipmentAgentModal);
  });

  const closePreviewButtons = document.querySelectorAll('.close-shipment-preview-modal');
  closePreviewButtons.forEach(btn => {
    btn.addEventListener('click', closeShipmentPreviewModal);
  });
}

// Show notification
function showNotification(message, type = 'info') {
  // Simple notification - can be enhanced
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Export functions
window.openShipmentAgentModal = openShipmentAgentModal;
window.closeShipmentAgentModal = closeShipmentAgentModal;
window.closeShipmentPreviewModal = closeShipmentPreviewModal;
window.applyConfigTemplate = applyConfigTemplate;
window.generateRandomSecurityCode = generateRandomSecurityCode;
window.previewShipmentTimeline = previewShipmentTimeline;
window.createShipment = createShipment;
