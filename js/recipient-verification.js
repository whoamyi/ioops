// IOOPS Verification Portal - State Machine Implementation (Production Version)

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/ioops'
  : 'https://meridian-tracking.fly.dev/api/ioops';

// WebSocket connection for real-time updates
const WS_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://meridian-tracking.fly.dev';

let socket = null;

// State Machine
const STATES = {
  LOADING: 'LOADING',
  ERROR: 'ERROR',
  ENTRY_POINT: 'ENTRY_POINT',
  STEP_1_1_PERSONAL: 'STEP_1_1_PERSONAL',
  STEP_1_2_DOCUMENT: 'STEP_1_2_DOCUMENT',
  STEP_1_3_CAPTURE: 'STEP_1_3_CAPTURE',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  REJECTED: 'REJECTED',
  STEP_2_PAYMENT: 'STEP_2_PAYMENT',
  STEP_3_GENERATE: 'STEP_3_GENERATE',
  STEP_4_COMPLETE: 'STEP_4_COMPLETE',
  STEP_5_RECEIPT: 'STEP_5_RECEIPT'
};

let currentState = STATES.LOADING;
let verification = null;
let capturedDocuments = {
  document: null,
  address: null,
  face: null
};

// Store form data across steps
let personalInfoData = null;
let documentInfoData = null;

// Camera instance
let camera = null;

// Parse token from URL
function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

const token = getTokenFromURL();

// Persistence Functions
function saveVerificationState() {
  try {
    sessionStorage.setItem('ioops_verification_state', currentState);
    sessionStorage.setItem('ioops_verification_data', JSON.stringify(verification));
    sessionStorage.setItem('ioops_token', token);
    console.log('[Persistence] State saved');
  } catch (error) {
    console.warn('[Persistence] Failed to save state:', error);
  }
}

function loadVerificationState() {
  try {
    const savedState = sessionStorage.getItem('ioops_verification_state');
    const savedData = sessionStorage.getItem('ioops_verification_data');
    const savedToken = sessionStorage.getItem('ioops_token');

    if (savedState && savedData && savedToken === token) {
      verification = JSON.parse(savedData);
      currentState = savedState;
      console.log('[Persistence] Previous session restored');
      return true;
    }
  } catch (error) {
    console.warn('[Persistence] Failed to restore state:', error);
  }
  return false;
}

// State transition function
function transitionTo(newState) {
  console.log(`[State] Transitioning from ${currentState} to ${newState}`);
  currentState = newState;
  saveVerificationState();
  renderState();
}

// Render current state
function renderState() {
  console.log('[Render] Rendering state:', currentState);

  // Hide all sections first
  const els = {
    loading: document.getElementById('loading-state'),
    error: document.getElementById('error-state'),
    main: document.getElementById('main-content'),
    entry: document.getElementById('entry-point'),
    step11: document.getElementById('step-1-1'),
    step12: document.getElementById('step-1-2'),
    step13: document.getElementById('step-1-3'),
    waiting: document.getElementById('waiting-approval'),
    rejected: document.getElementById('rejected'),
    step2: document.getElementById('step-2'),
    step3: document.getElementById('step-3'),
    step4: document.getElementById('step-4'),
    step5: document.getElementById('step-5')
  };

  // Hide all
  Object.values(els).forEach(el => {
    if (el) el.style.display = 'none';
  });

  // Show appropriate sections
  if (currentState === STATES.LOADING) {
    if (els.loading) els.loading.style.display = 'flex';
  } else if (currentState === STATES.ERROR) {
    if (els.error) els.error.style.display = 'flex';
  } else {
    if (els.main) els.main.style.display = 'block';

    if (currentState === STATES.ENTRY_POINT && els.entry) {
      els.entry.style.display = 'block';
      renderEntryPoint();
    } else if (currentState === STATES.STEP_1_1_PERSONAL && els.step11) {
      els.step11.style.display = 'block';
      prefillPersonalInfo();
    } else if (currentState === STATES.STEP_1_2_DOCUMENT && els.step12) {
      els.step12.style.display = 'block';
      prefillDocumentInfo();
    } else if (currentState === STATES.STEP_1_3_CAPTURE && els.step13) {
      els.step13.style.display = 'block';
      initializeDocumentCapture();
    } else if (currentState === STATES.WAITING_APPROVAL && els.waiting) {
      els.waiting.style.display = 'block';
      renderWaitingState();
    } else if (currentState === STATES.REJECTED && els.rejected) {
      els.rejected.style.display = 'block';
      renderRejectedState();
    } else if (currentState === STATES.STEP_2_PAYMENT && els.step2) {
      els.step2.style.display = 'block';
      renderPaymentStep();
    } else if (currentState === STATES.STEP_3_GENERATE && els.step3) {
      els.step3.style.display = 'block';

      // If code already generated, show it and start polling
      if (verification && verification.code_revealed_at && verification.security_code) {
        const codeDisplay = document.getElementById('security-code-display');
        if (codeDisplay) {
          codeDisplay.textContent = verification.security_code;
        }

        const copyBtn = document.getElementById('copy-code-btn');
        if (copyBtn) {
          copyBtn.disabled = false;
        }

        const waitingSection = document.getElementById('code-usage-waiting');
        if (waitingSection) {
          waitingSection.style.display = 'block';
        }

        const generateBtn = document.getElementById('generate-code-btn');
        if (generateBtn) {
          generateBtn.style.display = 'none';
        }

        // Start polling if not completed yet
        if (verification.status !== 'completed') {
          startCodeUsagePolling();
        }
      }
    } else if (currentState === STATES.STEP_4_COMPLETE && els.step4) {
      els.step4.style.display = 'block';
      renderCompleteStep();
    } else if (currentState === STATES.STEP_5_RECEIPT && els.step5) {
      els.step5.style.display = 'block';
    }
  }

  updateProgressBar();
}

// Update progress indicator with dynamic progress line fill
function updateProgressIndicator(currentStep) {
  const steps = document.querySelectorAll('.progress-step');
  const progressLineFill = document.querySelector('.progress-line-fill');

  if (!steps || steps.length === 0) {
    console.warn('[Progress] No progress steps found');
    return;
  }

  // Remove all existing states
  steps.forEach((step) => {
    step.classList.remove('active', 'completed');
  });

  // Add appropriate classes based on step position
  steps.forEach((step, index) => {
    const stepNumber = index + 1;

    if (stepNumber < currentStep) {
      // Steps before current are completed
      step.classList.add('completed');
    } else if (stepNumber === currentStep) {
      // Current step is active
      step.classList.add('active');
    }
    // Steps after current remain default (no class)
  });

  // Calculate progress line fill percentage
  const totalSteps = steps.length;
  const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;

  // Update progress line fill width
  if (progressLineFill) {
    progressLineFill.style.width = progressPercent + '%';
  }

  console.log(`[Progress] Updated to step ${currentStep} (${progressPercent.toFixed(0)}% complete)`);
}

// Legacy wrapper function for backwards compatibility
function updateProgressBar() {
  // Determine current step from state
  let activeStep = 1;
  if (currentState === STATES.STEP_1_1_PERSONAL ||
      currentState === STATES.STEP_1_2_DOCUMENT ||
      currentState === STATES.STEP_1_3_CAPTURE ||
      currentState === STATES.WAITING_APPROVAL ||
      currentState === STATES.REJECTED) {
    activeStep = 1;
  } else if (currentState === STATES.STEP_2_PAYMENT) {
    activeStep = 2;
  } else if (currentState === STATES.STEP_3_GENERATE) {
    activeStep = 3;
  } else if (currentState === STATES.STEP_4_COMPLETE || currentState === STATES.STEP_5_RECEIPT) {
    activeStep = 4;
  }

  updateProgressIndicator(activeStep);
}

// Show error
function showError(message) {
  console.error('[Error]:', message);
  document.getElementById('error-message').textContent = message;
  transitionTo(STATES.ERROR);
}

// API calls
async function loadVerification() {
  try {
    // Try to restore previous session first
    if (loadVerificationState()) {
      console.log('[Restore] Previous session restored successfully');
      renderState();
      return;
    }

    console.log('[API] Loading verification from backend...');
    const response = await fetch(`${API_BASE}/verification/${token}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Verification not found or expired');
      }
      throw new Error('Failed to load verification session');
    }

    verification = await response.json();
    console.log('[API] Verification loaded:', verification.status);

    // Determine initial state based on backend status
    determineStateFromVerification();
  } catch (error) {
    showError(error.message);
  }
}

function determineStateFromVerification() {
  // State machine based on verification status from backend
  if (verification.status === 'initiated') {
    transitionTo(STATES.ENTRY_POINT);
  } else if (verification.status === 'documents_submitted') {
    // Check document approval status
    if (verification.all_documents_approved === true) {
      transitionTo(STATES.STEP_2_PAYMENT);
    } else if (verification.passport_approved === false ||
               verification.proof_of_address_approved === false ||
               verification.selfie_approved === false) {
      transitionTo(STATES.REJECTED);
    } else {
      transitionTo(STATES.WAITING_APPROVAL);
    }
  } else if (verification.status === 'payment_submitted') {
    if (verification.escrow_status === 'confirmed') {
      transitionTo(STATES.STEP_3_GENERATE);
    } else {
      transitionTo(STATES.STEP_2_PAYMENT);
    }
  } else if (verification.status === 'code_generated') {
    transitionTo(STATES.STEP_3_GENERATE);
  } else if (verification.status === 'completed') {
    transitionTo(STATES.STEP_4_COMPLETE);
  } else {
    transitionTo(STATES.ENTRY_POINT);
  }
}

// Submit all verification information (personal + document info + files) in one call
async function submitAllVerificationInfo() {
  try {
    console.log('[API] Submitting verification info and documents...');

    const formData = new FormData();

    // Personal information
    formData.append('full_name', personalInfoData.full_name);
    formData.append('address', personalInfoData.address);
    formData.append('country', personalInfoData.country);
    formData.append('phone', personalInfoData.phone);

    // Document information
    formData.append('id_type', documentInfoData.id_type);
    formData.append('id_country', documentInfoData.id_country);
    formData.append('id_number', documentInfoData.id_number);
    formData.append('id_expiry_date', documentInfoData.id_expiry_date);

    // Document files
    if (capturedDocuments.document) {
      formData.append('passport', capturedDocuments.document, 'document.jpg');
    }
    if (capturedDocuments.address) {
      formData.append('proof_of_address', capturedDocuments.address, 'address.jpg');
    }
    if (capturedDocuments.face) {
      formData.append('selfie_with_id', capturedDocuments.face, 'selfie.jpg');
    }

    const response = await fetch(`${API_BASE}/verification/${token}/submit-info`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to submit verification information');
    }

    const data = await response.json();
    console.log('[API] Submission successful:', data);

    // Reload verification data to get updated status
    await loadVerification();
  } catch (error) {
    showError(error.message);
  }
}

async function uploadPaymentReceipt(file) {
  try {
    console.log('[API] Uploading payment receipt...');

    const formData = new FormData();
    formData.append('receipt', file);

    const response = await fetch(`${API_BASE}/verification/${token}/upload-receipt`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload payment receipt');
    }

    const data = await response.json();
    console.log('[API] Payment receipt uploaded:', data);

    // Show success message
    alert(data.message || 'Payment receipt uploaded successfully. We will verify your payment within 24-48 hours.');

    // Reload verification data
    await loadVerification();
  } catch (error) {
    showError(error.message);
  }
}

// Polling interval ID
let pollingIntervalId = null;

async function generateVerificationCode() {
  try {
    console.log('[API] Generating verification code...');

    const response = await fetch(`${API_BASE}/verification/${token}/generate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate verification code');
    }

    const data = await response.json();
    console.log('[API] Code generated:', data);

    // Update verification with the security code
    verification.security_code = data.security_code;
    verification.code_revealed_at = new Date().toISOString();

    // Display the code
    const codeDisplay = document.getElementById('security-code-display');
    if (codeDisplay) {
      codeDisplay.textContent = data.security_code;
    }

    // Show success message
    const messageEl = document.getElementById('code-generation-message');
    if (messageEl) {
      messageEl.textContent = data.message;
      messageEl.style.display = 'block';
    }

    // Enable copy button
    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
      copyBtn.disabled = false;
    }

    // Show "waiting for code usage" section
    const waitingSection = document.getElementById('code-usage-waiting');
    if (waitingSection) {
      waitingSection.style.display = 'block';
    }

    // Hide generate button, show waiting state
    const generateBtn = document.getElementById('generate-code-btn');
    if (generateBtn) {
      generateBtn.style.display = 'none';
    }

    // Start polling for code usage
    startCodeUsagePolling();

    saveVerificationState();
  } catch (error) {
    showError(error.message);
  }
}

// Start polling to detect when code is used on Meridian
function startCodeUsagePolling() {
  console.log('[Polling] Starting code usage polling...');

  // Clear any existing polling
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
  }

  // Poll every 5 seconds
  pollingIntervalId = setInterval(async () => {
    try {
      console.log('[Polling] Checking verification status...');

      const response = await fetch(`${API_BASE}/verification/${token}`);
      if (!response.ok) {
        console.error('[Polling] Failed to fetch verification status');
        return;
      }

      const latestData = await response.json();

      // Check if code has been used
      if (latestData.status === 'completed' && latestData.code_used_at) {
        console.log('[Polling] Code has been used! Transitioning to completion...');

        // Update local verification data
        verification = latestData;

        // Stop polling
        stopCodeUsagePolling();

        // Transition to Step 4 (completion)
        transitionTo(STATES.STEP_4_COMPLETE);

        // Show success notification
        showNotification('Your security code has been verified! Shipment released.', 'success');
      }
    } catch (error) {
      console.error('[Polling] Error during polling:', error);
    }
  }, 5000); // Poll every 5 seconds
}

// Stop polling
function stopCodeUsagePolling() {
  if (pollingIntervalId) {
    console.log('[Polling] Stopping code usage polling');
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
  }
}

// Show notification (simple implementation)
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;

  // Determine background color based on type
  let bgColor = '#3B82F6'; // info (blue)
  if (type === 'success') bgColor = '#10B981'; // green
  if (type === 'error') bgColor = '#EF4444'; // red
  if (type === 'warning') bgColor = '#F59E0B'; // orange

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${bgColor};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 400px;
    font-weight: 500;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Validation Functions
function validatePersonalInfo() {
  const fullName = document.getElementById('full-name')?.value.trim();
  const address = document.getElementById('address')?.value.trim();
  const country = document.getElementById('country')?.value;
  const phone = document.getElementById('phone')?.value.trim();

  const errors = [];

  if (!fullName || fullName.length < 2) {
    errors.push('Full name is required and must be at least 2 characters');
  }

  if (!address || address.length < 5) {
    errors.push('Address is required and must be at least 5 characters');
  }

  if (!country || country === '' || country === 'Select country') {
    errors.push('Please select a country');
  }

  if (!phone || !/^[\d\s\-\+\(\)]{7,}$/.test(phone)) {
    errors.push('Please enter a valid phone number (minimum 7 digits)');
  }

  return errors;
}

function validateDocumentInfo() {
  const idType = document.getElementById('id-type')?.value;
  const idCountry = document.getElementById('id-country')?.value;
  const idNumber = document.getElementById('id-number')?.value.trim();
  const idExpiry = document.getElementById('id-expiry-date')?.value;

  const errors = [];

  if (!idType || idType === '' || idType === 'Select document type') {
    errors.push('Please select a document type');
  }

  if (!idCountry || idCountry === '' || idCountry === 'Select country') {
    errors.push('Please select the issuing country');
  }

  if (!idNumber || idNumber.length < 3) {
    errors.push('Document number is required (minimum 3 characters)');
  }

  if (!idExpiry) {
    errors.push('Document expiry date is required');
  } else {
    const expiryDate = new Date(idExpiry);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiryDate < today) {
      errors.push('Document has expired. Please provide a valid document with a future expiry date.');
    }

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 100);
    if (expiryDate > maxDate) {
      errors.push('Expiry date appears to be invalid. Please check the date entered.');
    }

    const minDate = new Date(1900, 0, 1);
    if (expiryDate < minDate) {
      errors.push('Expiry date appears to be invalid. Please enter a valid date.');
    }
  }

  return errors;
}

function validateCapturedDocuments() {
  const issues = [];

  if (!capturedDocuments.document) {
    issues.push('Identity document not captured');
  }
  if (!capturedDocuments.address) {
    issues.push('Proof of address not captured');
  }
  if (!capturedDocuments.face) {
    issues.push('Face capture not completed');
  }

  return issues;
}

function validatePaymentReceipt() {
  const fileInput = document.getElementById('payment-receipt');
  const file = fileInput?.files[0];

  if (!file) {
    return { valid: false, error: 'Please select a payment receipt file' };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB (backend allows 10MB)
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit. Please compress your file.' };
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Please upload a PDF or image file (JPG, PNG)' };
  }

  return { valid: true };
}

function showValidationErrors(errors, formId) {
  let errorContainer = document.getElementById(formId + '-errors');

  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = formId + '-errors';
    errorContainer.className = 'error-box';

    const form = document.getElementById(formId);
    if (form) {
      form.insertBefore(errorContainer, form.firstChild);
    }
  }

  errorContainer.innerHTML = '<h4>⚠ Please fix these errors:</h4><ul>' +
    errors.map(e => '<li>' + e + '</li>').join('') +
    '</ul>';
  errorContainer.style.display = 'block';

  errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearValidationErrors(formId) {
  const errorContainer = document.getElementById(formId + '-errors');
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}

// Rendering helper functions
function renderEntryPoint() {
  const escrowAmountEl = document.getElementById('escrow-amount-display');
  if (escrowAmountEl && verification) {
    escrowAmountEl.textContent = `$${verification.escrow_amount || 450} USD`;
  }
}

function prefillPersonalInfo() {
  if (!verification) return;

  if (verification.recipient_full_name) {
    document.getElementById('full-name').value = verification.recipient_full_name;
  }
  if (verification.recipient_address) {
    document.getElementById('address').value = verification.recipient_address;
  }
  if (verification.recipient_country) {
    document.getElementById('country').value = verification.recipient_country;
  }
  if (verification.recipient_phone) {
    document.getElementById('phone').value = verification.recipient_phone;
  }
}

function prefillDocumentInfo() {
  if (!verification) return;

  if (verification.id_type) {
    document.getElementById('id-type').value = verification.id_type;
  }
  if (verification.id_country) {
    document.getElementById('id-country').value = verification.id_country;
  }
  if (verification.id_number) {
    document.getElementById('id-number').value = verification.id_number;
  }
  if (verification.id_expiry_date) {
    document.getElementById('id-expiry-date').value = verification.id_expiry_date;
  }
}

function renderWaitingState() {
  const messageEl = document.querySelector('#waiting-approval p');
  if (messageEl) {
    messageEl.textContent = 'Your documents are currently being reviewed by our compliance team. This usually takes 24-48 hours. You will be notified via email once the review is complete.';
  }
}

function renderRejectedState() {
  if (!verification) return;

  // Calculate status counts
  const statusCounts = {
    approved: 0,
    rejected: 0,
    pending: 0
  };

  const documents = [
    {
      id: 'passport',
      name: 'ID Document',
      icon: '🆔',
      approved: verification.passport_approved,
      reason: verification.passport_rejection_reason,
      timestamp: verification.documents_reviewed_at
    },
    {
      id: 'address',
      name: 'Proof of Address',
      icon: '🏠',
      approved: verification.proof_of_address_approved,
      reason: verification.proof_of_address_rejection_reason,
      timestamp: verification.documents_reviewed_at
    },
    {
      id: 'selfie',
      name: 'Face Verification',
      icon: '📸',
      approved: verification.selfie_approved,
      reason: verification.selfie_rejection_reason,
      timestamp: verification.documents_reviewed_at
    }
  ];

  // Count statuses
  documents.forEach(doc => {
    if (doc.approved === true) statusCounts.approved++;
    else if (doc.approved === false) statusCounts.rejected++;
    else statusCounts.pending++;
  });

  // Render summary
  renderVerificationSummary(statusCounts);

  // Render each document card
  documents.forEach(doc => {
    renderDocumentStatusCard(doc);
  });

  // Render next steps
  renderNextSteps(statusCounts, documents);

  // Show/hide resubmit button
  const resubmitBtn = document.getElementById('resubmit-rejected-btn');
  if (resubmitBtn && statusCounts.rejected > 0) {
    resubmitBtn.style.display = 'inline-block';
    resubmitBtn.onclick = () => {
      transitionTo(STATES.STEP_1_1_PERSONAL);
    };
  }

  // Setup support button
  const supportBtn = document.getElementById('contact-support-btn-new');
  if (supportBtn) {
    supportBtn.onclick = () => {
      window.location.href = `/support?token=${token}`;
    };
  }
}

function renderVerificationSummary(statusCounts) {
  const summaryEl = document.getElementById('verification-summary');
  if (!summaryEl) return;

  const total = statusCounts.approved + statusCounts.rejected + statusCounts.pending;
  const percentage = total > 0 ? Math.round((statusCounts.approved / total) * 100) : 0;

  let statusClass = 'status-warning';
  let statusMessage = '⚠️ ATTENTION REQUIRED';

  if (statusCounts.approved === 3) {
    statusClass = 'status-success';
    statusMessage = '✅ VERIFICATION COMPLETE';
  } else if (statusCounts.approved === 2 && statusCounts.rejected === 0) {
    statusClass = 'status-info';
    statusMessage = '⏳ ALMOST COMPLETE';
  } else if (statusCounts.rejected === 3) {
    statusClass = 'status-error';
    statusMessage = '❌ ALL DOCUMENTS REJECTED';
  }

  summaryEl.innerHTML = `
    <div class="summary-card ${statusClass}">
      <h3>${statusMessage}</h3>
      <div class="summary-stats">
        <div class="stat">
          <span class="stat-value">${statusCounts.approved}</span>
          <span class="stat-label">Approved</span>
        </div>
        <div class="stat">
          <span class="stat-value">${statusCounts.rejected}</span>
          <span class="stat-label">Rejected</span>
        </div>
        <div class="stat">
          <span class="stat-value">${statusCounts.pending}</span>
          <span class="stat-label">Pending</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
      <p class="progress-text">${percentage}% Complete</p>
    </div>
  `;
}

function renderDocumentStatusCard(doc) {
  const badgeEl = document.getElementById(`${doc.id}-status-badge`);
  const detailsEl = document.getElementById(`${doc.id}-status-details`);
  const actionsEl = document.getElementById(`${doc.id}-action-buttons`);
  const timestampEl = document.getElementById(`${doc.id}-timestamp`);
  const cardEl = document.getElementById(`${doc.id}-status-card`);

  if (!cardEl) return;

  let statusBadge = '';
  let statusDetails = '';
  let actionButtons = '';
  let cardClass = '';

  if (doc.approved === true) {
    // APPROVED
    cardClass = 'card-approved';
    statusBadge = '<span class="badge badge-success">✓ APPROVED</span>';
    statusDetails = `
      <p class="status-message success">
        <strong>Status:</strong> Your document has been approved.
      </p>
    `;
    actionButtons = ''; // No action needed

  } else if (doc.approved === false) {
    // REJECTED
    cardClass = 'card-rejected';
    statusBadge = '<span class="badge badge-error">✗ REJECTED</span>';

    const attemptCount = 1; // TODO: Track attempt count in database
    const maxAttempts = 3;

    statusDetails = `
      <p class="status-message error">
        <strong>Status:</strong> Document rejected (Attempt ${attemptCount} of ${maxAttempts})
      </p>
      <div class="rejection-reason">
        <strong>Reason:</strong>
        <p>${doc.reason || 'Please resubmit a clearer image of your document.'}</p>
      </div>
    `;

    if (attemptCount >= maxAttempts) {
      actionButtons = `
        <button class="btn btn-secondary btn-sm" onclick="contactSupport('${doc.id}')">
          Contact Support
        </button>
      `;
    } else {
      actionButtons = `
        <button class="btn btn-primary btn-sm" onclick="resubmitDocument('${doc.id}')">
          Resubmit ${doc.name}
        </button>
      `;
    }

  } else {
    // PENDING
    cardClass = 'card-pending';
    statusBadge = '<span class="badge badge-warning">⏳ UNDER REVIEW</span>';
    statusDetails = `
      <p class="status-message pending">
        <strong>Status:</strong> Your document is being reviewed by our compliance team.
      </p>
      <p class="estimated-time">
        <strong>Estimated Review Time:</strong> 1-2 hours
      </p>
      <div class="loading-spinner"></div>
    `;
    actionButtons = ''; // No action needed while pending
  }

  // Apply card styling
  cardEl.className = `document-card ${cardClass}`;

  // Populate elements
  if (badgeEl) badgeEl.innerHTML = statusBadge;
  if (detailsEl) detailsEl.innerHTML = statusDetails;
  if (actionsEl) actionsEl.innerHTML = actionButtons;
  if (timestampEl && doc.timestamp) {
    const date = new Date(doc.timestamp);
    timestampEl.textContent = `Submitted: ${date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
}

function renderNextSteps(statusCounts, documents) {
  const nextStepsEl = document.getElementById('next-steps-section');
  if (!nextStepsEl) return;

  let nextStepsHTML = '<h3>📋 Next Steps</h3><div class="next-steps-list">';

  if (statusCounts.approved === 3) {
    // All approved - proceed to payment
    nextStepsHTML += `
      <div class="next-step completed">
        <span class="step-icon">✓</span>
        <p><strong>Step 1: Identity Verification</strong> - Complete</p>
      </div>
      <div class="next-step active">
        <span class="step-icon">→</span>
        <p><strong>Step 2: Payment</strong> - Proceed to escrow payment</p>
      </div>
      <div class="next-step">
        <span class="step-icon">3</span>
        <p><strong>Step 3: Generate Code</strong></p>
      </div>
      <div class="next-step">
        <span class="step-icon">4</span>
        <p><strong>Step 4: Complete</strong></p>
      </div>
    `;
  } else if (statusCounts.rejected > 0 && statusCounts.pending === 0) {
    // Some/all rejected, none pending - action required
    nextStepsHTML += `
      <div class="next-step action-required">
        <span class="step-icon">⚠️</span>
        <p><strong>Action Required:</strong> Resubmit ${statusCounts.rejected} rejected document(s)</p>
      </div>
    `;

    documents.forEach(doc => {
      if (doc.approved === false) {
        nextStepsHTML += `
          <div class="next-step">
            <span class="step-icon">📄</span>
            <p>Resubmit: ${doc.name}</p>
          </div>
        `;
      }
    });

    nextStepsHTML += `
      <div class="next-step">
        <span class="step-icon">⏰</span>
        <p><strong>Deadline:</strong> ${getResubmissionDeadline()}</p>
      </div>
    `;
  } else if (statusCounts.pending > 0) {
    // Some pending - wait for review
    nextStepsHTML += `
      <div class="next-step pending">
        <span class="step-icon">⏳</span>
        <p><strong>Waiting for Review:</strong> ${statusCounts.pending} document(s) under review</p>
      </div>
      <div class="next-step">
        <span class="step-icon">📧</span>
        <p>You will receive an email when the review is complete</p>
      </div>
      <div class="next-step">
        <span class="step-icon">🔄</span>
        <p>This page will automatically update when status changes</p>
      </div>
    `;

    if (statusCounts.rejected > 0) {
      nextStepsHTML += `
        <div class="next-step action-available">
          <span class="step-icon">✏️</span>
          <p>While waiting, you can resubmit the rejected document(s)</p>
        </div>
      `;
    }
  }

  nextStepsHTML += '</div>';
  nextStepsEl.innerHTML = nextStepsHTML;
}

function getResubmissionDeadline() {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);
  return deadline.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper functions for document-specific actions
function resubmitDocument(documentId) {
  sessionStorage.setItem('resubmit_document', documentId);
  transitionTo(STATES.STEP_1_3_CAPTURE);
}

function contactSupport(documentId) {
  window.location.href = `/support?issue=document_rejection&doc=${documentId}&token=${token}`;
}

function renderPaymentStep() {
  if (!verification) return;

  const amountEl = document.getElementById('escrow-amount-payment');
  if (amountEl) {
    amountEl.textContent = `$${verification.escrow_amount || 450} USD`;
  }

  const returnDaysEl = document.getElementById('escrow-return-days');
  if (returnDaysEl) {
    returnDaysEl.textContent = verification.escrow_return_days || 45;
  }

  // If payment already submitted, show status
  if (verification.escrow_status === 'pending_verification') {
    const statusEl = document.createElement('div');
    statusEl.className = 'status-message info';
    statusEl.innerHTML = '<p><strong>Payment Received:</strong> Your payment receipt is being verified. You will be notified within 24-48 hours.</p>';

    const formContainer = document.getElementById('payment-confirmation-form');
    if (formContainer) {
      formContainer.parentElement.insertBefore(statusEl, formContainer);
      formContainer.style.display = 'none';
    }
  }
}

function renderCompleteStep() {
  if (!verification) return;

  // Stop polling if still running
  stopCodeUsagePolling();

  // Display tracking ID
  const trackingIdEl = document.getElementById('completion-tracking-id');
  if (trackingIdEl) {
    trackingIdEl.textContent = verification.tracking_id || 'N/A';
  }

  // Display security code
  const codeDisplayEl = document.getElementById('completion-security-code');
  if (codeDisplayEl && verification.security_code) {
    codeDisplayEl.textContent = verification.security_code;
  }

  // Display verification date
  const verificationDateEl = document.getElementById('completion-verification-date');
  if (verificationDateEl && verification.code_used_at) {
    const date = new Date(verification.code_used_at);
    verificationDateEl.textContent = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Calculate and display escrow return information
  const escrowAmount = verification.escrow_amount || 450;
  const escrowReturnDays = verification.escrow_return_days || 45;

  const escrowAmountEl = document.getElementById('escrow-return-amount');
  if (escrowAmountEl) {
    escrowAmountEl.textContent = escrowAmount;
  }

  // Calculate escrow return date
  if (verification.code_used_at) {
    const returnDate = new Date(verification.code_used_at);
    returnDate.setDate(returnDate.getDate() + escrowReturnDays);

    const escrowReturnDateEl = document.getElementById('escrow-return-date');
    if (escrowReturnDateEl) {
      escrowReturnDateEl.textContent = returnDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    const escrowDaysEl = document.getElementById('escrow-return-days-count');
    if (escrowDaysEl) {
      escrowDaysEl.textContent = escrowReturnDays;
    }
  }

  // Calculate and display expected delivery date
  // Assuming delivery is 7-14 days after code usage (you can adjust this)
  if (verification.code_used_at) {
    const deliveryDate = new Date(verification.code_used_at);
    deliveryDate.setDate(deliveryDate.getDate() + 10); // 10 days average

    const deliveryDateEl = document.getElementById('expected-delivery-date');
    if (deliveryDateEl) {
      deliveryDateEl.textContent = deliveryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  // Display recipient information
  const recipientNameEl = document.getElementById('completion-recipient-name');
  if (recipientNameEl && verification.recipient_full_name) {
    recipientNameEl.textContent = verification.recipient_full_name;
  }

  const recipientAddressEl = document.getElementById('completion-recipient-address');
  if (recipientAddressEl && verification.recipient_address) {
    recipientAddressEl.textContent = verification.recipient_address;
  }

  // Setup PDF receipt download button
  const pdfDownloadBtn = document.getElementById('download-receipt-btn');
  if (pdfDownloadBtn) {
    pdfDownloadBtn.addEventListener('click', async () => {
      await downloadVerificationReceipt();
    });
  }
}

// Download PDF receipt
async function downloadVerificationReceipt() {
  try {
    console.log('[PDF] Downloading verification receipt...');

    const response = await fetch(`${API_BASE}/verification/${token}/receipt`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Failed to generate receipt');
    }

    // Get the PDF blob
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IOOPS-Receipt-${verification.tracking_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log('[PDF] Receipt downloaded successfully');
  } catch (error) {
    console.error('[PDF] Error downloading receipt:', error);
    alert('Failed to download receipt. Please try again or contact support.');
  }
}

// WebSocket Integration
function initializeWebSocket() {
  if (!token) return;

  console.log('[WebSocket] Connecting to real-time updates...');

  // Load Socket.IO from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
  script.onload = () => {
    socket = io(WS_BASE);

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      // Join verification-specific room
      socket.emit('join_verification', token);
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
    });

    // Listen for document approval/rejection events
    socket.on('document_approved', (data) => {
      console.log('[WebSocket] Document approved:', data);
      showNotification(`Your ${getDocumentName(data.documentType)} has been approved!`, 'success');

      // Reload verification data to get updated status
      loadVerification();
    });

    socket.on('document_rejected', (data) => {
      console.log('[WebSocket] Document rejected:', data);
      showNotification(`Your ${getDocumentName(data.documentType)} was rejected. Please review the feedback.`, 'error');

      // Reload verification data
      loadVerification();
    });

    // Listen for all documents approved
    socket.on('all_documents_approved', (data) => {
      console.log('[WebSocket] All documents approved!', data);
      showNotification('All documents approved! You can now proceed to payment.', 'success');

      // Reload and transition to payment step
      loadVerification();
    });
  };
  document.head.appendChild(script);
}

function getDocumentName(documentType) {
  const names = {
    'passport': 'ID Document',
    'proof_of_address': 'Proof of Address',
    'selfie_with_id': 'Face Verification'
  };
  return names[documentType] || documentType;
}

// Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  if (!token) {
    showError('No verification token provided');
    return;
  }

  // Initialize WebSocket for real-time updates
  initializeWebSocket();

  // Entry point - Begin button
  const beginBtn = document.getElementById('begin-verification-btn');
  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      transitionTo(STATES.STEP_1_1_PERSONAL);
    });
  }

  // Step 1.1 - Personal Info Form
  const personalInfoForm = document.getElementById('personal-info-form');
  if (personalInfoForm) {
    personalInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const errors = validatePersonalInfo();
      if (errors.length > 0) {
        showValidationErrors(errors, 'personal-info-form');
        return;
      }

      clearValidationErrors('personal-info-form');

      // Store data and move to next step
      personalInfoData = {
        full_name: document.getElementById('full-name').value,
        address: document.getElementById('address').value,
        country: document.getElementById('country').value,
        phone: document.getElementById('phone').value
      };

      transitionTo(STATES.STEP_1_2_DOCUMENT);
    });
  }

  // Step 1.2 - Document Info Form
  const documentInfoForm = document.getElementById('document-info-form');
  if (documentInfoForm) {
    documentInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const errors = validateDocumentInfo();
      if (errors.length > 0) {
        showValidationErrors(errors, 'document-info-form');
        return;
      }

      clearValidationErrors('document-info-form');

      // Store data and move to next step
      documentInfoData = {
        id_type: document.getElementById('id-type').value,
        id_country: document.getElementById('id-country').value,
        id_number: document.getElementById('id-number').value,
        id_expiry_date: document.getElementById('id-expiry-date').value
      };

      transitionTo(STATES.STEP_1_3_CAPTURE);
    });
  }

  // Step 1.3 - Submit Identity Button
  const submitIdentityBtn = document.getElementById('submit-identity-btn');
  if (submitIdentityBtn) {
    submitIdentityBtn.addEventListener('click', async () => {
      const errors = validateCapturedDocuments();
      if (errors.length > 0) {
        showValidationErrors(errors, 'step-1-3');
        return;
      }

      clearValidationErrors('step-1-3');

      // Submit everything to backend in one call
      await submitAllVerificationInfo();
    });
  }

  // Step 2 - Payment Form
  const paymentForm = document.getElementById('payment-confirmation-form');
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const validation = validatePaymentReceipt();
      if (!validation.valid) {
        showValidationErrors([validation.error], 'payment-confirmation-form');
        return;
      }

      clearValidationErrors('payment-confirmation-form');

      const fileInput = document.getElementById('payment-receipt');
      await uploadPaymentReceipt(fileInput.files[0]);
    });
  }

  // Step 3 - Generate Code
  const generateCodeBtn = document.getElementById('generate-code-btn');
  if (generateCodeBtn) {
    generateCodeBtn.addEventListener('click', async () => {
      await generateVerificationCode();
    });
  }

  // Copy code button
  const copyCodeBtn = document.getElementById('copy-code-btn');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      const codeDisplay = document.getElementById('security-code-display');
      if (codeDisplay && codeDisplay.textContent) {
        navigator.clipboard.writeText(codeDisplay.textContent);
        copyCodeBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyCodeBtn.textContent = 'Copy Code';
        }, 2000);
      }
    });
  }

  // Start the application
  loadVerification();
});

// Camera Capture Functions
function initializeDocumentCapture() {
  document.getElementById('document-capture-section').style.display = 'block';
  document.getElementById('address-capture-section').style.display = 'none';
  document.getElementById('face-capture-section').style.display = 'none';
  document.getElementById('capture-complete').style.display = 'none';

  startCamera('document');
}

async function startCamera(type) {
  try {
    const videoElement = document.getElementById(`${type}-video`);
    const statusElement = document.getElementById(`${type}-status`);

    statusElement.textContent = 'Requesting camera access...';

    const facingMode = type === 'face' ? 'user' : 'environment';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });

    videoElement.srcObject = stream;
    statusElement.textContent = 'Position document within frame';

    // Auto-capture after 3 seconds
    setTimeout(() => {
      captureImage(type);
    }, 3000);

  } catch (error) {
    console.error('Camera error:', error);
    document.getElementById(`${type}-status`).textContent = 'Camera access denied. Please enable camera permissions.';
  }
}

function captureImage(type) {
  const video = document.getElementById(`${type}-video`);
  const canvas = document.getElementById(`${type}-canvas`);
  const preview = document.getElementById(`${type}-preview`);
  const previewImg = document.getElementById(`${type}-preview-img`);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  canvas.toBlob((blob) => {
    capturedDocuments[type] = blob;
    previewImg.src = URL.createObjectURL(blob);

    // Stop video stream
    const stream = video.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    // Show preview
    document.querySelector(`#${type}-capture-section .capture-container`).style.display = 'none';
    preview.style.display = 'block';
  }, 'image/jpeg', 0.9);
}

// Confirm/Retake handlers
document.addEventListener('DOMContentLoaded', () => {
  // Document confirm
  const confirmDocBtn = document.getElementById('confirm-document');
  if (confirmDocBtn) {
    confirmDocBtn.addEventListener('click', () => {
      document.getElementById('document-capture-section').style.display = 'none';
      document.getElementById('address-capture-section').style.display = 'block';
      startCamera('address');
    });
  }

  // Document retake
  const retakeDocBtn = document.getElementById('retake-document');
  if (retakeDocBtn) {
    retakeDocBtn.addEventListener('click', () => {
      capturedDocuments.document = null;
      document.getElementById('document-preview').style.display = 'none';
      document.querySelector('#document-capture-section .capture-container').style.display = 'block';
      startCamera('document');
    });
  }

  // Address confirm
  const confirmAddrBtn = document.getElementById('confirm-address');
  if (confirmAddrBtn) {
    confirmAddrBtn.addEventListener('click', () => {
      document.getElementById('address-capture-section').style.display = 'none';
      document.getElementById('face-capture-section').style.display = 'block';
      startCamera('face');
    });
  }

  // Address retake
  const retakeAddrBtn = document.getElementById('retake-address');
  if (retakeAddrBtn) {
    retakeAddrBtn.addEventListener('click', () => {
      capturedDocuments.address = null;
      document.getElementById('address-preview').style.display = 'none';
      document.querySelector('#address-capture-section .capture-container').style.display = 'block';
      startCamera('address');
    });
  }

  // Face confirm
  const confirmFaceBtn = document.getElementById('confirm-face');
  if (confirmFaceBtn) {
    confirmFaceBtn.addEventListener('click', () => {
      document.getElementById('face-capture-section').style.display = 'none';
      document.getElementById('capture-complete').style.display = 'block';
    });
  }

  // Face retake
  const retakeFaceBtn = document.getElementById('retake-face');
  if (retakeFaceBtn) {
    retakeFaceBtn.addEventListener('click', () => {
      capturedDocuments.face = null;
      document.getElementById('face-preview').style.display = 'none';
      document.querySelector('#face-capture-section .capture-container').style.display = 'block';
      startCamera('face');
    });
  }
});
