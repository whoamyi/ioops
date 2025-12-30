/**
 * Enhanced Email System UI for Admin Panel
 * Multi-company support with template selection and preview
 */

// State
let selectedCompany = 'ioops';
let selectedTemplate = null;
let selectedShipment = null;
let emailPreview = null;

// Initialize Email System
function initializeEmailSystem() {
  console.log('[Email System] Initializing...');

  // Load companies
  loadCompanies();

  // Setup event listeners
  setupEmailEventListeners();
}

// Load available companies
async function loadCompanies() {
  try {
    const response = await fetch(`${API_BASE}/email/companies`);
    const data = await response.json();

    renderCompanySelection(data.companies);
  } catch (error) {
    console.error('[Email] Error loading companies:', error);
  }
}

// Render company selection
function renderCompanySelection(companies) {
  const container = document.getElementById('email-company-selection');
  if (!container) return;

  container.innerHTML = companies.map(company => `
    <div class="company-card ${selectedCompany === company.key ? 'selected' : ''}"
         data-company="${company.key}"
         onclick="selectCompany('${company.key}')">
      <div class="company-icon">${company.name.charAt(0)}</div>
      <div class="company-info">
        <h4>${company.name}</h4>
        <p>${company.displayName}</p>
      </div>
    </div>
  `).join('');
}

// Select company
async function selectCompany(companyKey) {
  console.log('[Email] Company selected:', companyKey);
  selectedCompany = companyKey;

  // Update UI
  document.querySelectorAll('.company-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.company === companyKey);
  });

  // Load templates for this company
  await loadTemplates(companyKey);
}

// Load templates for selected company
async function loadTemplates(companyKey) {
  try {
    const response = await fetch(`${API_BASE}/email/templates/${companyKey}`);
    const data = await response.json();

    renderTemplates(data.templates);
  } catch (error) {
    console.error('[Email] Error loading templates:', error);
  }
}

// Render templates grouped by category
function renderTemplates(templatesByCategory) {
  const container = document.getElementById('email-templates-list');
  if (!container) return;

  let html = '';

  Object.keys(templatesByCategory).forEach(category => {
    html += `<div class="template-category">
      <h3>${category}</h3>
      <div class="template-grid">`;

    templatesByCategory[category].forEach(template => {
      html += `
        <div class="template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}"
             data-template-id="${template.id}"
             onclick="selectTemplate('${template.id}')">
          <h4>${template.name}</h4>
          <p class="template-scenario">${template.scenario}</p>
          <div class="template-subject">${template.subject}</div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

// Select template
async function selectTemplate(templateId) {
  console.log('[Email] Template selected:', templateId);

  // Find template in current data
  const response = await fetch(`${API_BASE}/email/templates/${selectedCompany}`);
  const data = await response.json();

  // Find the template
  for (const category of Object.values(data.templates)) {
    const template = category.find(t => t.id === templateId);
    if (template) {
      selectedTemplate = template;
      break;
    }
  }

  // Update UI
  document.querySelectorAll('.template-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.templateId === templateId);
  });

  // Show customization section
  document.getElementById('email-customization').style.display = 'block';

  // Show required fields
  renderRequiredFields(selectedTemplate.requiredFields);
}

// Render required fields info
function renderRequiredFields(fields) {
  const container = document.getElementById('required-fields-info');
  if (!container) return;

  container.innerHTML = `
    <h4>Required Data Fields:</h4>
    <div class="field-tags">
      ${fields.map(field => `<span class="field-tag">${field}</span>`).join('')}
    </div>
    <p class="field-note">These fields will be automatically populated from the shipment data.</p>
  `;
}

// Preview email
async function previewEmail() {
  if (!selectedTemplate || !selectedShipment) {
    alert('Please select a shipment and template first');
    return;
  }

  const customMessage = document.getElementById('custom-message-input').value;
  const customBodyContent = document.getElementById('custom-body-content').value;
  const actionRequired = document.getElementById('action-required-input').value;

  try {
    const response = await fetch(`${API_BASE}/email/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: selectedCompany,
        templateId: selectedTemplate.id,
        trackingId: selectedShipment.tracking_id,
        customMessage,
        customBodyContent,
        actionRequired
      })
    });

    const data = await response.json();
    emailPreview = data.preview;

    // Show preview modal
    showPreviewModal(emailPreview);

  } catch (error) {
    console.error('[Email] Error generating preview:', error);
    alert('Failed to generate preview: ' + error.message);
  }
}

// Show preview modal
function showPreviewModal(preview) {
  const modal = document.getElementById('email-preview-modal');
  if (!modal) {
    console.error('[Email] Preview modal not found');
    return;
  }

  document.getElementById('preview-subject').textContent = preview.subject;
  document.getElementById('preview-to').textContent = preview.to;
  document.getElementById('preview-template').textContent = preview.template;

  const iframe = document.getElementById('preview-iframe');
  iframe.srcdoc = preview.html;

  modal.style.display = 'flex';
}

// Close preview modal
function closePreviewModal() {
  const modal = document.getElementById('email-preview-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Send email
async function sendEmail() {
  if (!selectedTemplate || !selectedShipment) {
    alert('Please select a shipment and template first');
    return;
  }

  const aliasKey = document.getElementById('email-alias-select').value;
  const recipientEmail = document.getElementById('recipient-email-override').value;
  const customMessage = document.getElementById('custom-message-input').value;
  const customSubject = document.getElementById('custom-subject-input').value;
  const customBodyContent = document.getElementById('custom-body-content').value;
  const actionRequired = document.getElementById('action-required-input').value;

  if (!confirm(`Send email to ${recipientEmail || selectedShipment.recipient_email}?`)) {
    return;
  }

  const sendBtn = document.getElementById('send-email-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    const response = await fetch(`${API_BASE}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: selectedCompany,
        templateId: selectedTemplate.id,
        trackingId: selectedShipment.tracking_id,
        aliasKey,
        recipientEmail,
        customMessage,
        customSubject,
        customBodyContent,
        actionRequired
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`Email sent successfully to ${data.to}`);
      closeEmailModal();
    } else {
      throw new Error(data.error || 'Failed to send email');
    }

  } catch (error) {
    console.error('[Email] Error sending email:', error);
    alert('Failed to send email: ' + error.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Email';
  }
}

// Open email modal for a shipment
function openEmailModal(shipment) {
  selectedShipment = shipment;

  const modal = document.getElementById('email-composer-modal');
  if (!modal) {
    console.error('[Email] Composer modal not found');
    return;
  }

  // Set shipment info
  document.getElementById('email-shipment-info').innerHTML = `
    <strong>Tracking ID:</strong> ${shipment.tracking_id}<br>
    <strong>Recipient:</strong> ${shipment.recipient_name || 'N/A'}<br>
    <strong>Email:</strong> ${shipment.recipient_email || 'N/A'}
  `;

  modal.style.display = 'flex';

  // Initialize if not already done
  if (!selectedCompany) {
    initializeEmailSystem();
  }
}

// Close email modal
function closeEmailModal() {
  const modal = document.getElementById('email-composer-modal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Reset selections
  selectedTemplate = null;
  selectedShipment = null;
  emailPreview = null;

  // Clear customization fields
  document.getElementById('custom-message-input').value = '';
  document.getElementById('custom-subject-input').value = '';
  document.getElementById('custom-body-content').value = '';
  document.getElementById('action-required-input').value = '';
}

// Setup event listeners
function setupEmailEventListeners() {
  // Preview button
  const previewBtn = document.getElementById('preview-email-btn');
  if (previewBtn) {
    previewBtn.addEventListener('click', previewEmail);
  }

  // Send button
  const sendBtn = document.getElementById('send-email-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendEmail);
  }

  // Close buttons
  const closeButtons = document.querySelectorAll('.close-email-modal');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', closeEmailModal);
  });

  const closePreviewButtons = document.querySelectorAll('.close-preview-modal');
  closePreviewButtons.forEach(btn => {
    btn.addEventListener('click', closePreviewModal);
  });
}

// Export functions for use in admin panel
window.openEmailModal = openEmailModal;
window.closeEmailModal = closeEmailModal;
window.selectCompany = selectCompany;
window.selectTemplate = selectTemplate;
window.previewEmail = previewEmail;
window.sendEmail = sendEmail;
window.closePreviewModal = closePreviewModal;
