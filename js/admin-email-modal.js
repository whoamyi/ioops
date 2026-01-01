/**
 * Production Email Modal System
 * 4-step wizard for sending emails to shipment recipients
 *
 * Features:
 * - Company selection (IOOPS/Meridian)
 * - Chronological template browsing
 * - WYSIWYG template editing with TinyMCE
 * - Auto-fill from database
 * - Test mode
 * - Email preview
 * - Sent history
 */

// API Configuration - using global constant from admin-verification.js

// Modal State
let emailModalState = {
  step: 1,
  trackingId: null,
  recipientEmail: null,
  recipientName: null,
  selectedCompany: null,
  selectedTemplate: null,
  templateHtml: null,
  emailData: null,
  customSubject: null,
  fromAlias: null,
  testMode: false,
  testEmail: 'admin@ioops.org'
};

let monacoEditor = null;
let currentEmailHtml = ''; // Store complete HTML

/**
 * Initialize the production email modal
 */
function initProductionEmailModal() {
  console.log('[Email Modal] Initializing production email modal');
  setupModalEventListeners();
}

/**
 * Setup event listeners for modal
 */
function setupModalEventListeners() {
  // Close button
  const closeBtn = document.getElementById('close-production-email-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeProductionEmailModal);
  }

  // Navigation buttons
  const backBtn = document.getElementById('email-modal-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', handleBackStep);
  }

  const nextBtn = document.getElementById('email-modal-next-btn');
  if (nextBtn) {
    nextBtn.addEventListener('click', handleNextStep);
  }

  const sendBtn = document.getElementById('email-modal-send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', handleSendEmail);
  }

  // Test mode toggle
  const testModeToggle = document.getElementById('email-test-mode-toggle');
  if (testModeToggle) {
    testModeToggle.addEventListener('change', (e) => {
      emailModalState.testMode = e.target.checked;
      updateTestModeBanner();
    });
  }

  // Test email input
  const testEmailInput = document.getElementById('email-test-email-input');
  if (testEmailInput) {
    testEmailInput.addEventListener('input', (e) => {
      emailModalState.testEmail = e.target.value;
    });
  }
}

/**
 * Open production email modal for a shipment
 */
async function openProductionEmailModal(trackingId, recipientEmail, recipientName) {
  console.log('[Email Modal] Opening for:', trackingId, recipientEmail, recipientName);

  // Reset state
  emailModalState = {
    step: 1,
    trackingId,
    recipientEmail,
    recipientName,
    selectedCompany: null,
    selectedTemplate: null,
    templateHtml: null,
    emailData: null,
    customSubject: null,
    fromAlias: null,
    testMode: false,
    testEmail: 'admin@ioops.org'
  };

  // Load email data from backend
  try {
    await loadEmailDataForTracking(trackingId);
  } catch (error) {
    console.error('[Email Modal] Error loading email data:', error);
    alert('Failed to load shipment data for email. Please try again.');
    return;
  }

  // Show modal
  const modal = document.getElementById('production-email-modal');
  if (modal) {
    modal.style.display = 'flex';
    renderStep1CompanySelection();
  }
}

/**
 * Close production email modal
 */
function closeProductionEmailModal() {
  const modal = document.getElementById('production-email-modal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Clear Monaco editor if exists
  if (monacoEditor) {
    monacoEditor.dispose();
    monacoEditor = null;
  }
  currentEmailHtml = '';

  // Reset state
  emailModalState = {
    step: 1,
    trackingId: null,
    recipientEmail: null,
    recipientName: null,
    selectedCompany: null,
    selectedTemplate: null,
    templateHtml: null,
    emailData: null,
    customSubject: null,
    fromAlias: null,
    testMode: false,
    testEmail: 'admin@ioops.org'
  };
}

/**
 * Load email data from backend
 */
async function loadEmailDataForTracking(trackingId) {
  console.log('[Email Modal] Loading email data for:', trackingId);

  const response = await fetch(`${PRODUCTION_EMAIL_API}/generate-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackingId })
  });

  if (!response.ok) {
    throw new Error('Failed to load email data');
  }

  const data = await response.json();
  emailModalState.emailData = data.data;

  console.log('[Email Modal] Email data loaded:', emailModalState.emailData);
}

/**
 * Navigate steps
 */
function handleBackStep() {
  if (emailModalState.step > 1) {
    emailModalState.step--;
    renderCurrentStep();
  }
}

function handleNextStep() {
  // Validate current step
  if (emailModalState.step === 1 && !emailModalState.selectedCompany) {
    alert('Please select a company (IOOPS or Meridian)');
    return;
  }

  if (emailModalState.step === 2 && !emailModalState.selectedTemplate) {
    alert('Please select an email template');
    return;
  }

  if (emailModalState.step === 3) {
    // Validate editor has content
    if (!currentEmailHtml || !currentEmailHtml.trim()) {
      alert('Email content cannot be empty');
      return;
    }

    // Update subject
    const subjectInput = document.getElementById('email-subject-input');
    if (subjectInput) {
      emailModalState.customSubject = subjectInput.value;
    }

    // Update from alias
    const fromSelect = document.getElementById('email-from-alias-select');
    if (fromSelect) {
      emailModalState.fromAlias = fromSelect.value;
    }
  }

  if (emailModalState.step < 3) {
    emailModalState.step++;
    renderCurrentStep();
  }
}

/**
 * Render current step
 */
function renderCurrentStep() {
  console.log('[Email Modal] Rendering step:', emailModalState.step);

  switch (emailModalState.step) {
    case 1:
      renderStep1CompanySelection();
      break;
    case 2:
      renderStep2TemplateSelection();
      break;
    case 3:
      renderStep3TemplateEditor();
      break;
  }

  updateModalNavigation();
}

/**
 * Update modal navigation buttons
 */
function updateModalNavigation() {
  const backBtn = document.getElementById('email-modal-back-btn');
  const nextBtn = document.getElementById('email-modal-next-btn');
  const sendBtn = document.getElementById('email-modal-send-btn');
  const stepIndicator = document.getElementById('email-modal-step-indicator');

  if (stepIndicator) {
    stepIndicator.textContent = `Step ${emailModalState.step} of 3`;
  }

  if (backBtn) {
    backBtn.style.display = emailModalState.step > 1 ? 'inline-block' : 'none';
  }

  if (nextBtn) {
    nextBtn.style.display = emailModalState.step < 3 ? 'inline-block' : 'none';
  }

  if (sendBtn) {
    sendBtn.style.display = emailModalState.step === 3 ? 'inline-block' : 'none';
  }
}

/**
 * STEP 1: Company Selection
 */
function renderStep1CompanySelection() {
  const body = document.getElementById('production-email-modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="email-step-container">
      <h3 class="email-step-title">Select Email Company</h3>
      <p class="email-step-subtitle">Choose which company this email will be sent from</p>

      <div class="company-cards-grid">
        <div class="company-card ioops-card" data-company="IOOPS">
          <div class="company-card-icon">🛡️</div>
          <h4>IOOPS</h4>
          <p>International Operations & Oversight Protocol System</p>
          <div class="company-card-email">operations@ioops.org</div>
        </div>

        <div class="company-card meridian-card" data-company="MERIDIAN">
          <div class="company-card-icon">🌐</div>
          <h4>Meridian</h4>
          <p>Meridian Tracking & Shipping</p>
          <div class="company-card-email">infos@meridian-net.org</div>
        </div>
      </div>
    </div>
  `;

  // Add click handlers
  document.querySelectorAll('.company-card').forEach(card => {
    card.addEventListener('click', () => {
      emailModalState.selectedCompany = card.dataset.company;
      document.querySelectorAll('.company-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
}

/**
 * STEP 2: Template Selection
 */
async function renderStep2TemplateSelection() {
  const body = document.getElementById('production-email-modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="email-step-container">
      <h3 class="email-step-title">Select Email Template</h3>
      <p class="email-step-subtitle">
        Templates for <strong>${emailModalState.selectedCompany}</strong> •
        <a href="#" id="change-company-link">Change Company</a>
      </p>

      <div class="template-search-box">
        <input type="text" id="template-search-input" placeholder="Search templates..." />
      </div>

      <div id="templates-list-container" class="templates-list">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Loading templates...</p>
        </div>
      </div>
    </div>
  `;

  // Change company link
  const changeLink = document.getElementById('change-company-link');
  if (changeLink) {
    changeLink.addEventListener('click', (e) => {
      e.preventDefault();
      emailModalState.step = 1;
      renderCurrentStep();
    });
  }

  // Load templates from backend
  try {
    const templates = await loadTemplatesForCompany(emailModalState.selectedCompany);
    renderTemplatesList(templates);
  } catch (error) {
    console.error('[Email Modal] Error loading templates:', error);
    document.getElementById('templates-list-container').innerHTML = `
      <div class="error-message">
        <p>Failed to load templates. Please try again.</p>
      </div>
    `;
  }
}

/**
 * Load templates from backend
 */
async function loadTemplatesForCompany(company) {
  console.log('[Email Modal] Loading templates for:', company);

  const response = await fetch(`${PRODUCTION_EMAIL_API}/templates?company=${company}`);

  if (!response.ok) {
    throw new Error('Failed to load templates');
  }

  const data = await response.json();
  return data.templates;
}

/**
 * Render templates list
 */
function renderTemplatesList(templates) {
  const container = document.getElementById('templates-list-container');
  if (!container) return;

  if (templates.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        <p>No templates found for ${emailModalState.selectedCompany}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = templates.map(template => `
    <div class="template-item" data-template-id="${template.id}">
      <div class="template-item-header">
        <span class="template-sequence">${template.id}</span>
        <span class="template-category">${template.category}</span>
      </div>
      <h4 class="template-name">${template.name}</h4>
      <p class="template-description">${template.description || ''}</p>
      <div class="template-item-footer">
        <span class="template-from">From: ${template.from_alias}</span>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.template-item').forEach(item => {
    item.addEventListener('click', async () => {
      const templateId = item.dataset.templateId;
      await selectTemplate(templateId);
    });
  });

  // Search functionality
  const searchInput = document.getElementById('template-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll('.template-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? 'block' : 'none';
      });
    });
  }
}

/**
 * Select a template
 */
async function selectTemplate(templateId) {
  console.log('[Email Modal] Selecting template:', templateId);

  try {
    // Load template from backend
    const response = await fetch(`${PRODUCTION_EMAIL_API}/template/${templateId}`);
    if (!response.ok) {
      throw new Error('Failed to load template');
    }

    const data = await response.json();
    emailModalState.selectedTemplate = data.template;
    emailModalState.templateHtml = data.template.html;
    emailModalState.customSubject = data.template.subject;
    emailModalState.fromAlias = data.template.from_alias;

    console.log('[Email Modal] Template loaded:', emailModalState.selectedTemplate);
    console.log('[Email Modal] Template HTML length:', emailModalState.templateHtml?.length);
    console.log('[Email Modal] Template HTML preview:', emailModalState.templateHtml?.substring(0, 200));

    // Move to next step
    emailModalState.step = 3;
    renderCurrentStep();
  } catch (error) {
    console.error('[Email Modal] Error loading template:', error);
    alert('Failed to load template. Please try again.');
  }
}

/**
 * STEP 3: Template Editor
 */
function renderStep3TemplateEditor() {
  const body = document.getElementById('production-email-modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="email-step-container editor-container">
      <h3 class="email-step-title">Edit Email</h3>
      <p class="email-step-subtitle">
        Template: <strong>${emailModalState.selectedTemplate.name}</strong> •
        <a href="#" id="change-template-link">Change Template</a>
      </p>

      <div id="test-mode-banner" class="test-mode-banner" style="display: none;">
        ⚠️ TEST MODE - Email will be sent to <strong id="test-mode-email-display">${emailModalState.testEmail}</strong>
      </div>

      <div class="email-editor-grid">
        <div class="email-editor-settings">
          <div class="form-group">
            <label>Subject Line</label>
            <input type="text" id="email-subject-input" value="${replaceVariables(emailModalState.customSubject)}" />
          </div>

          <div class="form-group">
            <label>From Address</label>
            <select id="email-from-alias-select">
              ${renderFromAliasOptions()}
            </select>
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="email-test-mode-toggle" ${emailModalState.testMode ? 'checked' : ''} />
              Test Mode (send to test email)
            </label>
          </div>

          <div class="form-group" id="test-email-group" style="display: ${emailModalState.testMode ? 'block' : 'none'};">
            <label>Test Email Address</label>
            <input type="email" id="email-test-email-input" value="${emailModalState.testEmail}" />
          </div>

          <div class="email-recipient-info">
            <h4>Recipient</h4>
            <p><strong>${emailModalState.recipientName}</strong></p>
            <p>${emailModalState.recipientEmail}</p>
            <p>Tracking: ${emailModalState.trackingId}</p>
          </div>
        </div>

        <div class="email-editor-main">
          <!-- Tab Navigation -->
          <div style="display: flex; gap: 10px; margin-bottom: 15px; border-bottom: 2px solid #dee2e6;">
            <button type="button" class="editor-tab active" data-tab="preview" style="padding: 10px 20px; background: white; border: none; border-bottom: 3px solid #007bff; cursor: pointer; font-weight: 600;">
              👁️ Preview (What User Sees)
            </button>
            <button type="button" class="editor-tab" data-tab="source" style="padding: 10px 20px; background: white; border: none; border-bottom: 3px solid transparent; cursor: pointer;">
              📝 Edit HTML Source
            </button>
          </div>

          <!-- Preview Tab -->
          <div id="preview-tab-content" class="tab-content" style="display: block;">
            <iframe id="email-preview-iframe" style="width: 100%; min-height: 700px; border: 2px solid #dee2e6; border-radius: 8px; background: white;"></iframe>
          </div>

          <!-- Source Editor Tab -->
          <div id="source-tab-content" class="tab-content" style="display: none;">
            <div id="monaco-editor" style="width: 100%; height: 700px; border: 2px solid #dee2e6; border-radius: 8px;"></div>
            <button type="button" id="update-preview-btn" style="margin-top: 10px; padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
              ✅ Update Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Change template link
  const changeLink = document.getElementById('change-template-link');
  if (changeLink) {
    changeLink.addEventListener('click', (e) => {
      e.preventDefault();
      emailModalState.step = 2;
      renderCurrentStep();
    });
  }

  // Test mode toggle
  const testModeToggle = document.getElementById('email-test-mode-toggle');
  if (testModeToggle) {
    testModeToggle.addEventListener('change', (e) => {
      emailModalState.testMode = e.target.checked;
      updateTestModeBanner();
      document.getElementById('test-email-group').style.display = e.target.checked ? 'block' : 'none';
    });
  }

  // Test email input
  const testEmailInput = document.getElementById('email-test-email-input');
  if (testEmailInput) {
    testEmailInput.addEventListener('input', (e) => {
      emailModalState.testEmail = e.target.value;
      updateTestModeBanner();
    });
  }

  // Initialize email editor
  initializeEmailEditor();

  // Setup tab switching
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.dataset.tab;
      switchEditorTab(targetTab);
    });
  });

  // Setup update preview button
  const updateBtn = document.getElementById('update-preview-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      if (monacoEditor) {
        currentEmailHtml = monacoEditor.getValue();
        updateEmailPreview();
      }
    });
  }
}

/**
 * Render from alias options
 */
function renderFromAliasOptions() {
  const aliases = emailModalState.selectedCompany === 'IOOPS'
    ? ['operations', 'compliance', 'oversight', 'verification', 'clearance', 'security']
    : ['infos', 'support', 'diplomacy'];

  return aliases.map(alias => {
    const selected = alias === emailModalState.fromAlias ? 'selected' : '';
    const emailAddress = emailModalState.selectedCompany === 'IOOPS'
      ? `${alias}@ioops.org`
      : `${alias}@meridian-net.org`;
    return `<option value="${alias}" ${selected}>${emailAddress}</option>`;
  }).join('');
}

/**
 * Update test mode banner
 */
function updateTestModeBanner() {
  const banner = document.getElementById('test-mode-banner');
  const emailDisplay = document.getElementById('test-mode-email-display');

  if (banner && emailDisplay) {
    banner.style.display = emailModalState.testMode ? 'block' : 'none';
    emailDisplay.textContent = emailModalState.testEmail;
  }
}

/**
 * Switch between editor tabs
 */
function switchEditorTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.editor-tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.style.borderBottomColor = isActive ? '#007bff' : 'transparent';
    tab.style.fontWeight = isActive ? '600' : '400';
    if (isActive) tab.classList.add('active');
    else tab.classList.remove('active');
  });

  // Update tab content
  document.getElementById('preview-tab-content').style.display = tabName === 'preview' ? 'block' : 'none';
  document.getElementById('source-tab-content').style.display = tabName === 'source' ? 'block' : 'none';
}

/**
 * Initialize Monaco editor and preview
 */
function initializeEmailEditor() {
  console.log('[Email Modal] Initializing email editor...');

  setTimeout(() => {
    try {
      // Replace variables and get complete HTML
      const htmlWithData = replaceVariables(emailModalState.templateHtml);

      if (!htmlWithData || !htmlWithData.trim()) {
        console.warn('[Email Modal] No template HTML to load');
        return;
      }

      currentEmailHtml = htmlWithData;

      // Initialize Monaco Editor for HTML source editing
      require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
      require(['vs/editor/editor.main'], function () {
        monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
          value: currentEmailHtml,
          language: 'html',
          theme: 'vs',
          automaticLayout: true,
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 14
        });

        console.log('[Email Modal] Monaco editor initialized');
      });

      // Update preview
      updateEmailPreview();

    } catch (error) {
      console.error('[Email Modal] Error initializing editor:', error);
    }
  }, 100);
}

/**
 * Update email preview iframe
 */
function updateEmailPreview() {
  console.log('[Email Modal] Updating preview...');

  try {
    const previewIframe = document.getElementById('email-preview-iframe');
    if (!previewIframe) {
      console.warn('[Email Modal] Preview iframe not found');
      return;
    }

    // Write complete HTML to iframe
    const iframeDoc = previewIframe.contentDocument || previewIframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(currentEmailHtml);
    iframeDoc.close();

    console.log('[Email Modal] Preview updated');
  } catch (error) {
    console.error('[Email Modal] Error updating preview:', error);
  }
}

/**
 * Replace template variables with actual data
 */
function replaceVariables(text) {
  if (!text) {
    console.warn('[Email Modal] No text to replace');
    return '';
  }

  if (!emailModalState.emailData) {
    console.warn('[Email Modal] No email data for replacement');
    return text;
  }

  let replaced = text;

  try {
    for (const [key, value] of Object.entries(emailModalState.emailData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      replaced = replaced.replace(regex, value || '');
    }
    console.log('[Email Modal] Variables replaced successfully');
  } catch (error) {
    console.error('[Email Modal] Error replacing variables:', error);
    return text;
  }

  return replaced;
}

/**
 * Send email
 */
async function handleSendEmail() {
  console.log('[Email Modal] Sending email...');

  // Get current HTML from Monaco editor if it was edited
  if (monacoEditor) {
    currentEmailHtml = monacoEditor.getValue();
  }

  // Use the current email HTML
  emailModalState.templateHtml = currentEmailHtml;

  // Get subject
  const subjectInput = document.getElementById('email-subject-input');
  if (subjectInput) {
    emailModalState.customSubject = subjectInput.value;
  }

  // Get from alias
  const fromSelect = document.getElementById('email-from-alias-select');
  if (fromSelect) {
    emailModalState.fromAlias = fromSelect.value;
  }

  // Validate
  if (!emailModalState.customSubject || !emailModalState.customSubject.trim()) {
    alert('Please enter a subject line');
    return;
  }

  if (!emailModalState.templateHtml || !emailModalState.templateHtml.trim()) {
    alert('Email content cannot be empty. Please ensure the template loaded correctly.');
    return;
  }

  // Confirmation dialog
  const confirmMessage = emailModalState.testMode
    ? `Send TEST email to ${emailModalState.testEmail}?`
    : `Send email to ${emailModalState.recipientEmail}?\n\nSubject: ${emailModalState.customSubject}`;

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    // Send email via backend
    const response = await fetch(`${PRODUCTION_EMAIL_API}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: emailModalState.selectedTemplate.id,
        trackingId: emailModalState.trackingId,
        recipientEmail: emailModalState.recipientEmail,
        recipientName: emailModalState.recipientName,
        customHtml: emailModalState.templateHtml,
        customSubject: emailModalState.customSubject,
        fromAlias: emailModalState.fromAlias,
        company: emailModalState.selectedCompany,
        testMode: emailModalState.testMode,
        testEmail: emailModalState.testEmail,
        sentBy: 'admin@ioops.org'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send email');
    }

    const result = await response.json();

    console.log('[Email Modal] Email sent successfully:', result);

    alert(`✓ Email sent successfully!\n\nMessage ID: ${result.messageId}\n\n${emailModalState.testMode ? 'Sent to: ' + emailModalState.testEmail + ' (TEST MODE)' : 'Sent to: ' + emailModalState.recipientEmail}`);

    // Close modal
    closeProductionEmailModal();

    // Refresh shipments list if function exists
    if (typeof loadShipments === 'function') {
      loadShipments();
    }
  } catch (error) {
    console.error('[Email Modal] Error sending email:', error);
    alert('Failed to send email: ' + error.message);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductionEmailModal);
} else {
  initProductionEmailModal();
}

// Export for use in other scripts
window.openProductionEmailModal = openProductionEmailModal;
window.closeProductionEmailModal = closeProductionEmailModal;
