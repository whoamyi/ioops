// IOOPS Verification Portal - State Machine Implementation (Production Version)

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/ioops'
  : 'https://meridian-tracking.fly.dev/api/ioops';

// WebSocket connection for real-time updates
const WS_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://meridian-tracking.fly.dev';

let socket = null;

// Push notification support
let pushSubscription = null;
const VAPID_PUBLIC_KEY = 'BPmsX3DYziJkOed2glX1Lv3TpKKV7HE90KjEtXpeEJpThhurBrmdIyX1trUxAZZwcnSxnEsAANhHJ2AQF1gFA8A';

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

      // Show push notification prompt when user reaches waiting state
      setTimeout(() => {
        showPushNotificationPrompt();
      }, 1500); // Small delay after page renders
    } else if (currentState === STATES.REJECTED && els.rejected) {
      els.rejected.style.display = 'block';
      renderRejectedState();
    } else if (currentState === STATES.STEP_2_PAYMENT && els.step2) {
      els.step2.style.display = 'block';
      renderPaymentStep();
    } else if (currentState === STATES.STEP_3_GENERATE && els.step3) {
      els.step3.style.display = 'block';

      // If code already generated, show it and start polling
      if (verification && verification.security_code_revealed && verification.security_code) {
        // Display the code - try both possible element IDs
        let codeDisplay = document.getElementById('security-code-display');
        if (!codeDisplay) {
          codeDisplay = document.getElementById('security-code');
        }
        if (codeDisplay) {
          codeDisplay.textContent = verification.security_code;
        }

        // Show the code display container
        const codeDisplayContainer = document.getElementById('code-display');
        if (codeDisplayContainer) {
          codeDisplayContainer.style.display = 'block';
        }
        // Populate tracking ID in instructions
        const trackingIdEl = document.getElementById('code-tracking-id');
        if (trackingIdEl && verification.tracking_id) {
          trackingIdEl.textContent = verification.tracking_id;
        }


        const copyBtn = document.getElementById('copy-code-btn');
        if (copyBtn) {
          copyBtn.disabled = false;
        }

        const waitingSection = document.getElementById('code-usage-waiting');
        if (waitingSection) {
          waitingSection.style.display = 'block';
        }

        // Hide generate button and its parent wrapper
        const generateBtn = document.getElementById('generate-code-btn');
        if (generateBtn) {
          generateBtn.style.display = 'none';
          // Also hide parent action-buttons div
          if (generateBtn.parentElement && generateBtn.parentElement.classList.contains('action-buttons')) {
            generateBtn.parentElement.style.display = 'none';
          }
        }
        setTimeout(() => initializeScratchOff(), 100);
        // Attach event listeners to buttons
        attachCodeButtonListeners();


        // Start polling if not completed yet
        if (verification.status !== 'completed') {
          startCodeUsagePolling();
        }
      }
    } else if (currentState === STATES.STEP_4_COMPLETE && els.step4) {
      els.step4.style.display = 'block';
      renderCompleteStep();
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
  } else if (currentState === STATES.STEP_4_COMPLETE || currentState === STATES.STEP_4_COMPLETE) {
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

    // Determine state based on backend status (this is the source of truth)
    determineStateFromVerification();

    // Save the current state for faster subsequent renders
    saveVerificationState();
  } catch (error) {
    showError(error.message);
  }
}

function determineStateFromVerification() {
  // State machine based on verification status from backend
  if (verification.status === 'initiated') {
    transitionTo(STATES.ENTRY_POINT);
  } else if (verification.status === 'documents_submitted' || verification.status === 'documents_approved') {
    // Check document approval status
    if (verification.all_documents_approved === true) {
      transitionTo(STATES.STEP_2_PAYMENT);
    } else {
      // Show REJECTED state for all cases where documents are under review
      // This allows users to see document status cards and track progress
      // The resubmit button will only show when statusCounts.rejected > 0
      transitionTo(STATES.REJECTED);
    }
  } else if (verification.status === 'payment_submitted') {
    if (verification.escrow_status === 'confirmed') {
      transitionTo(STATES.STEP_3_GENERATE);
    } else {
      transitionTo(STATES.STEP_2_PAYMENT);
    }
  } else if (verification.status === 'escrow_confirmed') {
    // Payment approved, show code generation step
    transitionTo(STATES.STEP_3_GENERATE);
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

    // Push notification prompt will be shown on the waiting page (see renderState WAITING_APPROVAL)
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
    verification.security_code_revealed = new Date().toISOString();
    verification.status = 'code_generated';

    // Display the code - try both possible element IDs
    let codeDisplay = document.getElementById('security-code-display');
    if (!codeDisplay) {
      codeDisplay = document.getElementById('security-code');
    }
    if (codeDisplay) {
      codeDisplay.textContent = data.security_code;
    }

    // Show the code display container
    const codeDisplayContainer = document.getElementById('code-display');
    if (codeDisplayContainer) {
      codeDisplayContainer.style.display = 'block';
    }

    // Populate tracking ID in instructions
    const trackingIdEl = document.getElementById('code-tracking-id');
    if (trackingIdEl && verification.tracking_id) {
      trackingIdEl.textContent = verification.tracking_id;
    }

    // Show success message (if element exists)
    const messageEl = document.getElementById('code-generation-message');
    if (messageEl) {
      messageEl.textContent = data.message;
      messageEl.style.display = 'block';
    } else {
      // Show success notification if message element doesn't exist
      showNotification(data.message || 'Security code generated successfully!', 'success');
    }

    // Enable copy button (if it exists)
    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
      copyBtn.disabled = false;
    }

    // Show "waiting for code usage" section (if it exists)
    const waitingSection = document.getElementById('code-usage-waiting');
    if (waitingSection) {
      waitingSection.style.display = 'block';
    }

    // Hide generate button and its parent wrapper
    const generateBtn = document.getElementById('generate-code-btn');
    if (generateBtn) {
      generateBtn.style.display = 'none';
      // Also hide parent action-buttons div
      if (generateBtn.parentElement && generateBtn.parentElement.classList.contains('action-buttons')) {
        generateBtn.parentElement.style.display = 'none';
      }
    }

    // Start polling for code usage
    // Initialize scratch-off effect for the code
    setTimeout(() => initializeScratchOff(), 100);
    // Attach event listeners to buttons
    attachCodeButtonListeners();

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

      // Check if security code has changed
      if (latestData.security_code && latestData.security_code !== verification.security_code) {
        console.log('[Polling] Security code has been updated by admin!');
        console.log('[Polling] Old code:', verification.security_code);
        console.log('[Polling] New code:', latestData.security_code);

        // Update local verification data
        verification.security_code = latestData.security_code;

        // Update the displayed code
        const codeDisplay = document.getElementById('security-code-display');
        if (codeDisplay) {
          codeDisplay.textContent = latestData.security_code;

          // Add visual indication that code was updated
          codeDisplay.style.animation = 'none';
          setTimeout(() => {
            codeDisplay.style.animation = 'pulse 0.5s ease-in-out 3';
          }, 10);
        }

        // Re-initialize scratch-off with new code
        setTimeout(() => initializeScratchOff(), 100);

        // Show notification to user
        showNotification('Your security code has been updated!', 'info');

        // Save updated state
        saveVerificationState();
      }

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

  // Check if resubmitting a specific document
  const resubmitDoc = sessionStorage.getItem('resubmit_document');

  // Determine which documents are required
  let needsPassport, needsProofOfAddress, needsSelfie;

  if (resubmitDoc) {
    // Individual document resubmission
    needsPassport = (resubmitDoc === 'passport');
    needsProofOfAddress = (resubmitDoc === 'address');
    needsSelfie = (resubmitDoc === 'selfie');
  } else {
    // Full submission - documents that are not uploaded yet OR rejected
    needsPassport = !verification?.passport_document_url || verification?.passport_approved === false;
    needsProofOfAddress = !verification?.proof_of_address_url || verification?.proof_of_address_approved === false;
    needsSelfie = !verification?.selfie_with_id_url || verification?.selfie_approved === false;
  }

  if (needsPassport && !capturedDocuments.document) {
    issues.push('Identity document not captured');
  }
  if (needsProofOfAddress && !capturedDocuments.address) {
    issues.push('Proof of address not captured');
  }
  if (needsSelfie && !capturedDocuments.face) {
    issues.push('Selfie photo not captured');
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

  // Setup "Check Status" button
  const checkStatusBtn = document.getElementById('check-approval-btn');
  if (checkStatusBtn) {
    // Remove any existing listeners by cloning
    const newBtn = checkStatusBtn.cloneNode(true);
    checkStatusBtn.parentNode.replaceChild(newBtn, checkStatusBtn);

    newBtn.addEventListener('click', async () => {
      console.log('[Check Status] Reloading verification status...');
      newBtn.disabled = true;
      newBtn.textContent = 'Checking...';

      try {
        await loadVerification();
        showNotification('Status updated', 'success');
      } catch (error) {
        console.error('[Check Status] Error:', error);
        showNotification('Failed to check status', 'error');
      } finally {
        newBtn.disabled = false;
        newBtn.textContent = 'Check Status';
      }
    });
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

  // SVG icons for documents
  const icons = {
    passport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="10" r="3"></circle><path d="M7 21v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"></path></svg>',
    address: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    selfie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>'
  };

  const documents = [
    {
      id: 'passport',
      name: 'ID Document',
      icon: icons.passport,
      approved: verification.passport_approved,
      reason: verification.passport_rejection_reason,
      timestamp: verification.documents_reviewed_at
    },
    {
      id: 'address',
      name: 'Proof of Address',
      icon: icons.address,
      approved: verification.proof_of_address_approved,
      reason: verification.proof_of_address_rejection_reason,
      timestamp: verification.documents_reviewed_at
    },
    {
      id: 'selfie',
      name: 'Face Verification',
      icon: icons.selfie,
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

  // Show/hide resubmit button based on rejection count
  const resubmitBtn = document.getElementById('resubmit-rejected-btn');
  if (resubmitBtn) {
    console.log('[Resubmit Button] Status counts:', statusCounts);
    console.log('[Resubmit Button] Current display style:', resubmitBtn.style.display);
    if (statusCounts.rejected > 0) {
      console.log('[Resubmit Button] Showing button - rejected count:', statusCounts.rejected);
      resubmitBtn.style.display = 'inline-block';
      resubmitBtn.style.visibility = 'visible';
      resubmitBtn.style.opacity = '1';
      resubmitBtn.style.position = 'static';
      resubmitBtn.style.pointerEvents = 'auto';
      resubmitBtn.disabled = false;
      resubmitBtn.onclick = () => {
        // Find the first rejected document and set it for resubmission
        const rejectedDoc = documents.find(doc => doc.approved === false);
        if (rejectedDoc) {
          sessionStorage.setItem('resubmit_document', rejectedDoc.id);
        }
        // Go directly to camera capture for resubmitting rejected documents
        transitionTo(STATES.STEP_1_3_CAPTURE);
      };
    } else {
      console.log('[Resubmit Button] Hiding button - no rejections');
      resubmitBtn.style.display = 'none';
      resubmitBtn.style.visibility = 'hidden';
      resubmitBtn.style.opacity = '0';
      resubmitBtn.style.position = 'absolute';
      resubmitBtn.style.pointerEvents = 'none';
      resubmitBtn.disabled = true;
    }
    console.log('[Resubmit Button] After update, display:', resubmitBtn.style.display);
  }

  // Setup support button to show modal
  const supportBtn = document.getElementById('contact-support-btn-new');
  if (supportBtn) {
    supportBtn.onclick = () => {
      showSupportModal();
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

  let nextStepsHTML = '<h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>Next Steps</h3><div class="next-steps-list">';

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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="step-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="step-icon"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
        <p>You will receive an email when the review is complete</p>
      </div>
      <div class="next-step">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="step-icon"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
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
    returnDaysEl.textContent = verification.escrow_return_days || 7;
  }

  // NEW: Check payment request status and show appropriate section
  const requestSection = document.getElementById('payment-request-section');
  const waitingSection = document.getElementById('payment-waiting-section');
  const detailsSection = document.getElementById('payment-details-section');

  console.log('[Payment Step] Current status:', verification.payment_details_status);

  if (verification.payment_details_status === 'waiting') {
    // Hide request, show waiting
    if (requestSection) requestSection.style.display = 'none';
    if (waitingSection) {
      waitingSection.style.display = 'block';
      const methodDisplay = document.getElementById('selected-payment-method-display');
      if (methodDisplay) {
        const methodNames = {
          'bank_transfer': 'Bank Transfer',
          'cryptocurrency': 'Cryptocurrency',
          'other': 'Alternative Payment'
        };
        methodDisplay.textContent = methodNames[verification.payment_method_requested] || 'payment';
      }
      // Start polling for payment details
      startPaymentDetailsPolling();
    }
    if (detailsSection) detailsSection.style.display = 'none';
  } else if (verification.payment_details_status === 'provided' && verification.payment_details) {
    // Hide request and waiting, show details
    if (requestSection) requestSection.style.display = 'none';
    if (waitingSection) waitingSection.style.display = 'none';
    if (detailsSection) {
      detailsSection.style.display = 'block';
      showPaymentDetails({
        payment_method: verification.payment_method_requested,
        payment_details: verification.payment_details,
        escrow_amount: verification.escrow_amount
      });
    }
  } else {
    // Show request button (default state)
    if (requestSection) requestSection.style.display = 'block';
    if (waitingSection) waitingSection.style.display = 'none';
    if (detailsSection) detailsSection.style.display = 'none';
  }

  // If payment was rejected, show rejection message
  if (verification.rejection_reason && verification.escrow_status === 'pending') {
    const rejectionEl = document.createElement('div');
    rejectionEl.className = 'status-message error';
    rejectionEl.style.cssText = 'background: #fff3cd; border-left: 4px solid #dc3545; padding: 16px; border-radius: 8px; margin-bottom: 24px;';
    rejectionEl.innerHTML = `
      <p style="margin: 0 0 12px 0;"><strong style="color: #dc3545;">❌ Payment Receipt Rejected</strong></p>
      <p style="margin: 0 0 12px 0; color: #856404;"><strong>Reason:</strong> ${verification.rejection_reason}</p>
      <p style="margin: 0; color: #856404;">Please upload a new payment receipt below.</p>
    `;

    const formContainer = document.getElementById('payment-confirmation-form');
    if (formContainer && formContainer.parentElement) {
      formContainer.parentElement.insertBefore(rejectionEl, formContainer);
    }
  }
  // If payment already submitted and pending verification, show status
  else if (verification.escrow_status === 'pending_verification') {
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

  console.log('[Step 4] Rendering completion screen', verification);

  // Stop polling if still running
  stopCodeUsagePolling();

  // Populate escrow amount
  const escrowAmountEl = document.getElementById('step4-escrow-amount');
  if (escrowAmountEl) {
    const amount = verification.escrow_amount || '€450';
    escrowAmountEl.textContent = typeof amount === 'string' ? amount : `€${amount}`;
  }

  // Populate refund period
  const refundPeriodEl = document.getElementById('step4-refund-period');
  if (refundPeriodEl) {
    const days = verification.escrow_return_days || 7;
    refundPeriodEl.textContent = `${days} business days`;
  }

  // Calculate and populate return date
  const returnDateEl = document.getElementById('step4-return-date');
  if (returnDateEl && verification.code_used_at) {
    const returnDate = new Date(verification.code_used_at);
    const days = verification.escrow_return_days || 7;
    returnDate.setDate(returnDate.getDate() + days);
    returnDateEl.textContent = returnDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Populate tracking ID
  const trackingIdEl = document.getElementById('step4-tracking-summary');
  if (trackingIdEl) {
    trackingIdEl.textContent = verification.tracking_id || 'N/A';
  }

  // Populate verification token
  const tokenEl = document.getElementById('step4-token-summary');
  if (tokenEl) {
    tokenEl.textContent = verification.verification_token || token || 'N/A';
  }

  // Populate completion date
  const completionDateEl = document.getElementById('step4-completion-date');
  if (completionDateEl && verification.code_used_at) {
    const date = new Date(verification.code_used_at);
    completionDateEl.textContent = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Setup PDF receipt download button
  const pdfDownloadBtn = document.getElementById('download-receipt-btn');
  if (pdfDownloadBtn) {
    // Remove existing listeners
    const newBtn = pdfDownloadBtn.cloneNode(true);
    pdfDownloadBtn.parentNode.replaceChild(newBtn, pdfDownloadBtn);

    // Add new listener
    newBtn.addEventListener('click', async () => {
      await downloadVerificationReceipt();
    });
  }

  // Setup email receipt button
  const emailReceiptBtn = document.getElementById('email-receipt-btn');
  if (emailReceiptBtn) {
    // Remove existing listeners
    const newBtn = emailReceiptBtn.cloneNode(true);
    emailReceiptBtn.parentNode.replaceChild(newBtn, emailReceiptBtn);

    // Add new listener
    newBtn.addEventListener('click', async () => {
      await emailVerificationReceipt();
    });
  }

  console.log('[Step 4] Completion screen rendered successfully');
}
// Download PDF receipt
async function downloadVerificationReceipt() {
  try {
    console.log('[PDF] Downloading verification receipt...');

    const response = await fetch(`${API_BASE}/verification/${token}/receipt.pdf`, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PDF] Server error:', errorText);
      throw new Error('Failed to generate receipt');
    }

    // Get the PDF blob
    const blob = await response.blob();

    // Verify it's actually a PDF
    if (blob.type !== 'application/pdf') {
      console.error('[PDF] Invalid content type:', blob.type);
      throw new Error('Invalid response format');
    }

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IOOPS-Certificate-${verification.tracking_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    console.log('[PDF] Receipt downloaded successfully');
    showNotification('Receipt downloaded successfully!', 'success');
  } catch (error) {
    console.error('[PDF] Error downloading receipt:', error);
    alert('Failed to download receipt. Please try again or contact support.');
  }
}

// Email verification receipt
async function emailVerificationReceipt() {
  if (!verification) return;

  const completionDate = verification.code_used_at ? new Date(verification.code_used_at).toLocaleDateString() : 'N/A';
  const escrowAmount = verification.escrow_amount || '€450';
  const escrowDays = verification.escrow_return_days || 7;

  let returnDate = 'N/A';
  if (verification.code_used_at) {
    const date = new Date(verification.code_used_at);
    date.setDate(date.getDate() + escrowDays);
    returnDate = date.toLocaleDateString();
  }

  const subject = `IOOPS Verification Receipt - ${verification.tracking_id}`;
  const body = `Your IOOPS verification has been completed successfully.

Tracking ID: ${verification.tracking_id}
Completion Date: ${completionDate}

Escrow Refund Information:
- Amount: ${escrowAmount}
- Refund Period: ${escrowDays} business days
- Expected Return: ${returnDate}

For your official PDF receipt, please use the Download button on the verification portal.

If you have any questions, please contact support@ioops.org

IOOPS - International Oversight & Operations Protocol System`;

  const emailLink = `mailto:${verification.recipient_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = emailLink;
}

// Push Notification Functions
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[Push] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[Push] Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
}

async function subscribeToPushNotifications() {
  if (!('PushManager' in window)) {
    console.log('[Push] Push notifications not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('[Push] Existing subscription found, sending to backend');
      pushSubscription = existingSubscription;

      // Send existing subscription to backend
      const response = await fetch(`${API_BASE}/verification/${token}/subscribe-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: existingSubscription.toJSON() })
      });

      if (response.ok) {
        console.log('[Push] Existing subscription saved to backend');
        return true;
      } else {
        console.error('[Push] Failed to save existing subscription to backend');
        return false;
      }
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Notification permission denied');
      return false;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    pushSubscription = subscription;
    console.log('[Push] Push subscription created:', subscription);

    // Send subscription to backend
    const response = await fetch(`${API_BASE}/verification/${token}/subscribe-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });

    if (response.ok) {
      console.log('[Push] Subscription saved to backend');
      return true;
    } else {
      console.error('[Push] Failed to save subscription to backend');
      return false;
    }
  } catch (error) {
    console.error('[Push] Failed to subscribe to push notifications:', error);
    return false;
  }
}

async function initializePushNotifications() {
  // Register service worker
  await registerServiceWorker();

  // Check if push notifications are supported
  if (!('PushManager' in window)) {
    console.log('[Push] Push notifications not supported in this browser');
    return;
  }

  // Check if user has already granted or denied permission
  if (Notification.permission === 'granted') {
    // Permission already granted, subscribe immediately
    console.log('[Push] Notification permission already granted');
    await subscribeToPushNotifications();
  } else if (Notification.permission === 'default') {
    // Permission not asked yet - we'll ask after first document submission
    console.log('[Push] Will request notification permission after document submission');
  } else {
    console.log('[Push] Notification permission denied');
  }
}

function showPushNotificationPrompt() {
  console.log('[Debug] showPushNotificationPrompt called');
  console.log('[Debug] Current permission:', Notification.permission);

  // Only show if permission hasn't been decided yet
  if (Notification.permission !== 'default') {
    console.log('[Debug] Permission not default, skipping prompt');
    return;
  }

  console.log('[Debug] Creating modal HTML...');
  // Create and show a friendly prompt
  const promptHTML = `
    <div id="push-permission-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      ">
        <div style="font-size: 48px; margin-bottom: 15px;">🔔</div>
        <h3 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 22px;">Get Instant Updates!</h3>
        <p style="margin: 0 0 10px 0; color: #333; font-size: 15px; line-height: 1.5;">
          <strong>Don't miss important updates!</strong> Get notified immediately when your verification is approved—no need to keep checking back.
        </p>
        <p style="margin: 0 0 25px 0; color: #4CAF50; font-size: 14px; font-weight: 500;">
          ✓ Instant approval alerts • ✓ Zero spam • ✓ Complete privacy
        </p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="enable-push-btn" style="
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          ">Yes, Notify Me!</button>
          <button id="maybe-later-btn" style="
            background: transparent;
            color: #999;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            text-decoration: underline;
          ">Skip for now</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', promptHTML);

  document.getElementById('enable-push-btn').addEventListener('click', async () => {
    document.getElementById('push-permission-modal').remove();
    await subscribeToPushNotifications();
  });

  document.getElementById('maybe-later-btn').addEventListener('click', () => {
    document.getElementById('push-permission-modal').remove();
  });
}

// WebSocket Integration
function initializeWebSocket() {
  if (!token) {
    console.warn('[WebSocket] No token available, skipping WebSocket initialization');
    return;
  }

  console.log('[WebSocket] Connecting to real-time updates...');
  console.log('[WebSocket] WS_BASE:', WS_BASE);
  console.log('[WebSocket] Token:', token);

  // Check if Socket.IO is already loaded
  if (typeof io !== 'undefined') {
    console.log('[WebSocket] Socket.IO already loaded, connecting...');
    connectWebSocket();
    return;
  }

  // Load Socket.IO from CDN
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
  script.onload = () => {
    console.log('[WebSocket] Socket.IO library loaded successfully');
    connectWebSocket();
  };
  script.onerror = (error) => {
    console.error('[WebSocket] Failed to load Socket.IO library:', error);
    console.error('[WebSocket] Real-time updates will not work. Please check your internet connection.');
  };
  document.head.appendChild(script);
}

function connectWebSocket() {
  try {
    socket = io(WS_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected with ID:', socket.id);
      // Join verification-specific room
      console.log('[WebSocket] Joining room: verification_' + token);
      socket.emit('join_verification', token);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected. Reason:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
      // Rejoin room on reconnect
      socket.emit('join_verification', token);
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

    // Listen for payment approval/rejection
    socket.on('payment_approved', (data) => {
      console.log('[WebSocket] Payment approved!', data);
      showNotification('Your payment has been approved! Security code is now available.', 'success');

      // Reload verification data
      loadVerification();
    });

    socket.on('payment_rejected', (data) => {
      console.log('[WebSocket] Payment rejected:', data);
      showNotification(`Payment rejected: ${data.reason}. Please upload a new receipt.`, 'error');

      // Reload verification data to show rejection message
      loadVerification();
    });
    
    // Listen for payment details provided
    socket.on('payment_details_provided', (data) => {
      console.log('[WebSocket] Payment details provided!', data);
      console.log('[WebSocket] Current state:', currentState);
      console.log('[WebSocket] Current step visibility - Step 2:', document.getElementById('step-2')?.style.display);

      // Stop polling
      stopPaymentDetailsPolling();

      // CRITICAL: Reload full verification data to get complete payment details
      // The WebSocket event may have incomplete data, so we fetch from backend
      loadVerification().then(() => {
        console.log('[WebSocket] Verification reloaded after payment details event');

        // The loadVerification will update verification object and trigger state transition
        // No need to manually call showPaymentDetails here - renderPaymentStep will handle it

        // Show notification
        showNotification('Payment details received! You can now proceed with your deposit.', 'success');
      }).catch(error => {
        console.error('[WebSocket] Error reloading verification:', error);

        // Fallback: update verification with data from event
        verification.payment_method_requested = data.payment_method;
        verification.payment_details = data.payment_details;
        verification.payment_details_status = 'provided';

        // Show payment details with notification
        showPaymentDetails(data, true);
      });

      console.log('[WebSocket] After payment details handling - initiating reload');
    });
  } catch (error) {
    console.error('[WebSocket] Error initializing WebSocket connection:', error);
  }
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

  // Initialize push notifications
  initializePushNotifications();

  // Setup payment request listeners
  setupPaymentRequestListeners();

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

// Track which document is being resubmitted (if any)
let currentResubmitDocument = null;

// Camera Capture Functions
function initializeDocumentCapture() {
  console.log('[Upload] Initializing file upload handlers');
  setupFileUploadHandlers();
}





// Submit a single document resubmission
async function submitSingleDocumentResubmission(documentId, captureType) {
  try {
    console.log('[Resubmission] Submitting single document:', documentId);

    const formData = new FormData();

    // Map document IDs to their file field names
    const fileFieldMap = {
      'passport': 'passport_file',
      'address': 'proof_of_address_file',
      'selfie': 'selfie_file'
    };

    const captureTypeMap = {
      'passport': 'document',
      'address': 'address',
      'selfie': 'face'
    };

    const actualCaptureType = captureTypeMap[documentId];
    const capturedFile = capturedDocuments[actualCaptureType];

    if (!capturedFile) {
      throw new Error('No document captured');
    }

    // Append only the specific document being resubmitted
    formData.append(fileFieldMap[documentId], capturedFile, `${documentId}.jpg`);

    // Submit to backend
    const response = await fetch(`${API_BASE}/verification/${token}/resubmit/${documentId}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to submit document resubmission');
    }

    const result = await response.json();
    console.log('[Resubmission] Success:', result);

    // Clear the resubmission flag
    sessionStorage.removeItem('resubmit_document');
    currentResubmitDocument = null;

    // Show success notification
    showNotification('Document resubmitted successfully! Our team will review it shortly.', 'success');

    // Reload verification data to get updated status
    await loadVerification();

    // Transition back to waiting/rejected state to show updated status
    // The backend will now show this document as "pending" instead of "rejected"

  } catch (error) {
    console.error('[Resubmission] Error:', error);
    showNotification('Failed to submit document: ' + error.message, 'error');
  }
}

// Support Modal Functions
function showSupportModal() {
  const modal = document.getElementById('support-modal');
  if (modal) {
    // Update email and WhatsApp links with current verification token
    const emailLink = document.getElementById('email-support-link');
    const whatsappLink = document.getElementById('whatsapp-support-link');
    
    if (emailLink && token) {
      emailLink.href = `mailto:support@ioops.org?subject=Verification Support - ${token}`;
    }
    
    if (whatsappLink && token) {
      whatsappLink.href = `https://wa.me/1234567890?text=Hi, I need help with my verification (Token: ${token})`;
    }
    
    modal.style.display = 'flex';
  }
}

function closeSupportModal() {
  const modal = document.getElementById('support-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Setup support modal close handlers
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-support-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSupportModal);
  }
  
  const modal = document.getElementById('support-modal');
  if (modal) {
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSupportModal();
      }
    });
  }
});

// ===== STEP 3: CODE GENERATION - SCRATCH-OFF & ACTIONS =====

// Scratch-off canvas functionality
// Scratch-off canvas functionality
function initializeScratchOff() {
  console.log('[Scratch] Initializing scratch-off canvas');
  
  const codeDisplayEl = document.getElementById('security-code-display');
  if (!codeDisplayEl) {
    console.warn('[Scratch] Code display element not found');
    return;
  }

  const parent = codeDisplayEl.parentElement;
  if (!parent) {
    console.warn('[Scratch] Parent element not found');
    return;
  }

  // Remove existing canvas if any
  const existingCanvas = document.getElementById('scratch-canvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }

  // Make parent position relative for absolute canvas
  parent.style.position = 'relative';
  parent.style.overflow = 'hidden'; // Prevent canvas overflow

  // Wait for layout to settle
  requestAnimationFrame(() => {
    const canvas = document.createElement('canvas');
    canvas.id = 'scratch-canvas';
    canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; border-radius: 12px; touch-action: none;';
    
    parent.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const rect = parent.getBoundingClientRect();

    // Set canvas size to match parent (with device pixel ratio for crisp rendering)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    console.log('[Scratch] Canvas size:', rect.width, 'x', rect.height);

    // Draw scratch-off overlay (silver lottery ticket style)
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, '#c0c0c0');
    gradient.addColorStop(0.5, '#e8e8e8');
    gradient.addColorStop(1, '#a8a8a8');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Add texture pattern
    for (let i = 0; i < 50; i++) {
      const randomR = Math.random() * 50 + 150;
      const randomG = Math.random() * 50 + 150;
      const randomB = Math.random() * 50 + 150;
      ctx.fillStyle = `rgba(${randomR}, ${randomG}, ${randomB}, 0.3)`;
      const randomX = Math.random() * rect.width;
      const randomY = Math.random() * rect.height;
      const randomW = Math.random() * 20 + 5;
      const randomH = Math.random() * 20 + 5;
      ctx.fillRect(randomX, randomY, randomW, randomH);
    }

    // Add "SCRATCH TO REVEAL" text (responsive font size)
    ctx.fillStyle = '#1e3a8a';
    const fontSize = Math.max(16, Math.min(28, rect.width / 15));
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCRATCH TO REVEAL', rect.width / 2, rect.height / 2);

    let isScratching = false;
    let scratchedPercentage = 0;

    function scratch(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      const scratchRadius = Math.max(20, Math.min(40, rect.width / 10)); // Responsive scratch radius
      ctx.arc(x, y, scratchRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    function calculateScratchedArea() {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      let transparent = 0;

      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] < 128) {
          transparent++;
        }
      }

      scratchedPercentage = (transparent / (pixels.length / 4)) * 100;

      // If 60% scratched, auto-reveal
      if (scratchedPercentage > 60) {
        canvas.style.transition = 'opacity 0.5s';
        canvas.style.opacity = '0';
        setTimeout(() => canvas.remove(), 500);
      }
    }

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
      isScratching = true;
      const rect = canvas.getBoundingClientRect();
      scratch(e.clientX - rect.left, e.clientY - rect.top);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isScratching) return;
      const rect = canvas.getBoundingClientRect();
      scratch(e.clientX - rect.left, e.clientY - rect.top);
      calculateScratchedArea();
    });

    canvas.addEventListener('mouseup', () => {
      isScratching = false;
    });

    canvas.addEventListener('mouseleave', () => {
      isScratching = false;
    });

    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isScratching = true;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      scratch(touch.clientX - rect.left, touch.clientY - rect.top);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isScratching) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      scratch(touch.clientX - rect.left, touch.clientY - rect.top);
      calculateScratchedArea();
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      isScratching = false;
    });

    console.log('[Scratch] Scratch-off canvas initialized successfully');
  });
}

// Attach event listeners to code action buttons
function attachCodeButtonListeners() {
  console.log('[Buttons] Attaching event listeners to code action buttons');

  const copyBtn = document.getElementById('copy-code-btn');
  if (copyBtn) {
    copyBtn.removeEventListener('click', copySecurityCode);
    copyBtn.addEventListener('click', copySecurityCode);
    console.log('[Buttons] Copy button listener attached');
  } else {
    console.warn('[Buttons] Copy button not found');
  }

  const emailBtn = document.getElementById('email-code-btn');
  if (emailBtn) {
    emailBtn.removeEventListener('click', emailSecurityCode);
    emailBtn.addEventListener('click', emailSecurityCode);
    console.log('[Buttons] Email button listener attached');
  } else {
    console.warn('[Buttons] Email button not found');
  }

  const downloadBtn = document.getElementById('download-code-btn');
  if (downloadBtn) {
    downloadBtn.removeEventListener('click', downloadSecurityCode);
    downloadBtn.addEventListener('click', downloadSecurityCode);
    console.log('[Buttons] Download button listener attached');
  } else {
    console.warn('[Buttons] Download button not found');
  }
}


// Copy code to clipboard
async function copySecurityCode() {
  const codeEl = document.getElementById('security-code-display');
  if (!codeEl) return;

  const code = codeEl.textContent;

  try {
    await navigator.clipboard.writeText(code);

    // Change button text temporarily
    const copyBtn = document.getElementById('copy-code-btn');
    if (copyBtn) {
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; margin-right: 8px; vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>Copied!';
      copyBtn.style.background = '#48bb78';
      copyBtn.style.color = 'white';

      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = 'white';
        copyBtn.style.color = '#1e3a8a';
      }, 2000);
    }

    showNotification('Security code copied to clipboard!', 'success');
  } catch (error) {
    showNotification('Failed to copy code. Please copy it manually.', 'error');
  }
}

// Email security code
function emailSecurityCode() {
  console.log('[Email] Email button clicked');
  const codeEl = document.getElementById('security-code-display');
  if (!codeEl || !verification) return;
  console.log('[Email] codeEl:', codeEl, 'verification:', verification);

  const code = codeEl.textContent;
  const subject = `Your IOOPS Verification Code - ${verification.tracking_id}`;
  const body = `Your verification security code is: ${code}

Tracking ID: ${verification.tracking_id}

Instructions:
1. Go to https://meridian-net.org/track
2. Enter your tracking number: ${verification.tracking_id}
3. Enter your security code: ${code}
4. Click "Release Shipment"

This code is confidential. Do not share it with anyone except on the official Meridian tracking portal.

IOOPS Verification System`;

  const emailLink = `mailto:${verification.recipient_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = emailLink;
}

// Download security code as text file
function downloadSecurityCode() {
  const codeEl = document.getElementById('security-code-display');
  if (!codeEl || !verification) return;

  const code = codeEl.textContent;
  const content = `IOOPS VERIFICATION SECURITY CODE
================================

Tracking ID: ${verification.tracking_id}
Security Code: ${code}
Generated On: ${new Date().toLocaleString()}

INSTRUCTIONS:
1. Visit: https://meridian-net.org/track
2. Enter Tracking Number: ${verification.tracking_id}
3. Enter Security Code: ${code}
4. Click "Release Shipment"

IMPORTANT: Keep this code confidential.
Only use it on the official Meridian tracking portal.

---
Generated by IOOPS Verification System
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IOOPS-Code-${verification.tracking_id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  showNotification('Security code downloaded successfully!', 'success');
}

// Event listeners for code action buttons
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('copy-code-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copySecurityCode);
  }

  const emailBtn = document.getElementById('email-code-btn');
  if (emailBtn) {
    emailBtn.addEventListener('click', emailSecurityCode);
  }

  const downloadBtn = document.getElementById('download-code-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadSecurityCode);
  }
});
// ===== PAYMENT REQUEST WORKFLOW =====

// Open payment method selection modal
function openPaymentMethodModal() {
  console.log('[Payment] Opening payment method modal');
  const modal = document.getElementById('payment-method-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// Close payment method modal
function closePaymentMethodModal() {
  console.log('[Payment] Closing payment method modal');
  const modal = document.getElementById('payment-method-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Request payment details from admin
async function requestPaymentDetails(paymentMethod) {
  try {
    console.log('[Payment] Requesting payment details for:', paymentMethod);

    const response = await fetch(`${API_BASE}/verification/${token}/request-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: paymentMethod })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to request payment details');
    }

    const data = await response.json();
    console.log('[Payment] Payment request sent successfully:', data);

    // Update verification state
    verification.payment_method_requested = paymentMethod;
    verification.payment_details_status = 'waiting';

    // Close modal
    closePaymentMethodModal();

    // Show waiting section
    showPaymentWaitingSection(paymentMethod);

    // Start polling for payment details
    startPaymentDetailsPolling();

    showNotification('Payment details request sent! Our team will provide the information shortly.', 'success');

    return data;
  } catch (error) {
    console.error('[Payment] Error requesting payment details:', error);
    showNotification('Failed to send request: ' + error.message, 'error');
    throw error;
  }
}

// Show the waiting section after payment request
function showPaymentWaitingSection(paymentMethod) {
  console.log('[Payment] Showing waiting section for:', paymentMethod);

  // Hide request section
  const requestSection = document.getElementById('payment-request-section');
  if (requestSection) {
    requestSection.style.display = 'none';
  }

  // Show waiting section
  const waitingSection = document.getElementById('payment-waiting-section');
  if (waitingSection) {
    waitingSection.style.display = 'block';
  }

  // Update payment method display
  const methodDisplay = document.getElementById('selected-payment-method-display');
  if (methodDisplay) {
    const methodNames = {
      'bank_transfer': 'Bank Transfer',
      'cryptocurrency': 'Cryptocurrency',
      'other': 'Alternative Payment'
    };
    methodDisplay.textContent = methodNames[paymentMethod] || 'payment';
  }
}

// Show payment details once admin sends them
function showPaymentDetails(paymentData, showNotif = false) {
  console.log('[Payment] Displaying payment details:', paymentData);

  // Hide waiting section
  const waitingSection = document.getElementById('payment-waiting-section');
  if (waitingSection) {
    waitingSection.style.display = 'none';
  }

  // Show details section
  const detailsSection = document.getElementById('payment-details-section');
  if (detailsSection) {
    detailsSection.style.display = 'block';
  }

  // Update title based on payment method
  const titleEl = document.getElementById('payment-method-title');
  if (titleEl) {
    const titles = {
      'bank_transfer': 'Bank Transfer Details',
      'cryptocurrency': 'Cryptocurrency Payment Details',
      'other': 'Payment Details'
    };
    titleEl.textContent = titles[paymentData.payment_method] || 'Transfer Details';
  }

  // Populate payment details content
  const contentEl = document.getElementById('payment-details-content');
  if (contentEl) {
    contentEl.innerHTML = renderPaymentDetailsHTML(paymentData);
  }

  // Only show notification if this is a real-time event (not page load)
  if (showNotif) {
    showNotification('Payment details received! You can now proceed with your deposit.', 'success');
  }
}

// Render payment details HTML based on payment method
function renderPaymentDetailsHTML(paymentData) {
  const method = paymentData.payment_method;
  const details = paymentData.payment_details || {};

  // Helper function to create a copyable field
  const createCopyableField = (value, label) => {
    if (!value || value === 'Not provided') {
      return `<span class="value">${value || 'Not provided'}</span>`;
    }
    return `
      <span class="value" style="display: flex; align-items: center; gap: 8px;">
        <span style="flex: 1;">${value}</span>
        <button class="copy-btn" onclick="copyToClipboard('${value.replace(/'/g, "\\'")}', '${label}')"
                style="padding: 6px 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
      </span>
    `;
  };

  if (method === 'bank_transfer') {
    return `
      <div class="info-row">
        <span class="label">Amount:</span>
        <span class="value">${paymentData.escrow_amount || verification.escrow_amount || '€450'}</span>
      </div>
      <div class="info-row">
        <span class="label">Bank Name:</span>
        ${createCopyableField(details.bank_name, 'Bank Name')}
      </div>
      <div class="info-row">
        <span class="label">Account Holder:</span>
        ${createCopyableField(details.account_holder, 'Account Holder')}
      </div>
      <div class="info-row">
        <span class="label">IBAN:</span>
        ${createCopyableField(details.iban, 'IBAN')}
      </div>
      <div class="info-row">
        <span class="label">SWIFT/BIC:</span>
        ${createCopyableField(details.swift_bic, 'SWIFT/BIC')}
      </div>
      <div class="info-row">
        <span class="label">Reference:</span>
        ${createCopyableField(details.reference || verification.tracking_id, 'Reference')}
      </div>
      ${details.additional_info ? `
      <div class="info-row">
        <span class="label">Additional Info:</span>
        <span class="value">${details.additional_info}</span>
      </div>
      ` : ''}
    `;
  } else if (method === 'cryptocurrency') {
    return `
      <div class="info-row">
        <span class="label">Amount:</span>
        <span class="value" id="escrow-amount">${paymentData.escrow_amount || verification.escrow_amount || '€450'}</span>
      </div>
      <div class="info-row">
        <span class="label">Cryptocurrency:</span>
        <span class="value">${details.crypto_type || 'Not specified'}</span>
      </div>
      <div class="info-row">
        <span class="label">Network:</span>
        <span class="value">${details.network || 'Not specified'}</span>
      </div>
      <div class="info-row">
        <span class="label">Wallet Address:</span>
        ${createCopyableField(details.wallet_address, 'Wallet Address')}
      </div>
      ${details.amount_crypto ? `
      <div class="info-row">
        <span class="label">Amount in Crypto:</span>
        ${createCopyableField(details.amount_crypto, 'Crypto Amount')}
      </div>
      ` : ''}
      ${details.additional_info ? `
      <div class="info-row">
        <span class="label">Additional Info:</span>
        <span class="value">${details.additional_info}</span>
      </div>
      ` : ''}
    `;
  } else {
    // Other payment methods
    return `
      <div class="info-row">
        <span class="label">Amount:</span>
        <span class="value" id="escrow-amount">${paymentData.escrow_amount || verification.escrow_amount || '€450'}</span>
      </div>
      <div class="info-row">
        <span class="label">Payment Method:</span>
        <span class="value">${details.method_name || 'Alternative Payment'}</span>
      </div>
      ${details.account_info ? `
      <div class="info-row">
        <span class="label">Account/ID:</span>
        ${createCopyableField(details.account_info, 'Account/ID')}
      </div>
      ` : ''}
      ${details.recipient_name ? `
      <div class="info-row">
        <span class="label">Recipient Name:</span>
        ${createCopyableField(details.recipient_name, 'Recipient Name')}
      </div>
      ` : ''}
      ${details.reference ? `
      <div class="info-row">
        <span class="label">Reference:</span>
        ${createCopyableField(details.reference, 'Reference')}
      </div>
      ` : ''}
      ${details.instructions ? `
      <div style="margin-top: 16px; padding: 16px; background: #eff6ff; border-radius: 8px;">
        <strong style="color: #1e40af;">Instructions:</strong>
        <p style="margin: 8px 0 0 0; color: #1e3a8a; white-space: pre-wrap;">${details.instructions}</p>
      </div>
      ` : ''}
    `;
  }
}

// Copy to clipboard function
function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification(`${label} copied to clipboard!`, 'success');
  }).catch(err => {
    console.error('[Copy] Failed to copy:', err);
    showNotification('Failed to copy to clipboard', 'error');
  });
}

// Poll for payment details updates
let paymentDetailsPollingInterval = null;

function startPaymentDetailsPolling() {
  if (paymentDetailsPollingInterval) {
    clearInterval(paymentDetailsPollingInterval);
  }

  console.log('[Payment] Starting payment details polling...');

  paymentDetailsPollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/verification/${token}`);
      if (!response.ok) return;

      const latestData = await response.json();

      // Check if payment details have been provided
      if (latestData.payment_details_status === 'provided' && latestData.payment_details) {
        console.log('[Payment] Payment details received!');

        // Stop polling
        stopPaymentDetailsPolling();

        // Update verification object
        verification = latestData;

        // Show payment details
        showPaymentDetails(latestData);
      }
    } catch (error) {
      console.error('[Payment] Polling error:', error);
    }
  }, 5000); // Poll every 5 seconds
}

function stopPaymentDetailsPolling() {
  if (paymentDetailsPollingInterval) {
    console.log('[Payment] Stopping payment details polling');
    clearInterval(paymentDetailsPollingInterval);
    paymentDetailsPollingInterval = null;
  }
}

// Setup payment request event listeners
function setupPaymentRequestListeners() {
  // Request payment details button
  const requestBtn = document.getElementById('request-payment-details-btn');
  if (requestBtn) {
    requestBtn.addEventListener('click', () => {
      openPaymentMethodModal();
    });
  }

  // Close modal button
  const closeBtn = document.getElementById('close-payment-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closePaymentMethodModal();
    });
  }

  // Payment method selection buttons
  const methodButtons = document.querySelectorAll('.payment-method-option');
  methodButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const method = button.getAttribute('data-method');
      if (method) {
        await requestPaymentDetails(method);
      }
    });
  });

  // Close modal when clicking outside
  const modal = document.getElementById('payment-method-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePaymentMethodModal();
      }
    });
  }
}


// === FILE UPLOAD HANDLERS ===
/**
 * File Upload Handler for Document Verification
 * Replaces camera capture with file upload functionality
 */

// Store uploaded files
const uploadedFiles = {
  passport: null,
  proof_of_address: null,
  selfie: null
};

// Setup file upload handlers
function setupFileUploadHandlers() {
  console.log('[Upload] Setting up file upload handlers');

  // Check if resubmitting a specific document
  const resubmitDoc = sessionStorage.getItem('resubmit_document');
  currentResubmitDocument = resubmitDoc;

  // Get upload section elements
  const passportSection = document.getElementById('passport-upload-section');
  const proofSection = document.getElementById('proof-of-address-upload-section');
  const selfieSection = document.getElementById('selfie-upload-section');

  // Determine which documents to show
  let needsPassport, needsProofOfAddress, needsSelfie;

  if (resubmitDoc) {
    // Individual document resubmission - only show the specific rejected document
    console.log('[Upload] Resubmitting single document:', resubmitDoc);
    needsPassport = (resubmitDoc === 'passport');
    needsProofOfAddress = (resubmitDoc === 'address');
    needsSelfie = (resubmitDoc === 'selfie');
  } else {
    // Full submission or general resubmission
    // Show documents that are: (a) not uploaded yet OR (b) rejected
    needsPassport = !verification?.passport_document_url || verification?.passport_approved === false;
    needsProofOfAddress = !verification?.proof_of_address_url || verification?.proof_of_address_approved === false;
    needsSelfie = !verification?.selfie_with_id_url || verification?.selfie_approved === false;
  }

  // Show/hide sections based on what needs to be submitted
  if (passportSection) passportSection.style.display = needsPassport ? 'block' : 'none';
  if (proofSection) proofSection.style.display = needsProofOfAddress ? 'block' : 'none';
  if (selfieSection) selfieSection.style.display = needsSelfie ? 'block' : 'none';

  console.log('[Upload] Showing upload sections:', {
    passport: needsPassport,
    proofOfAddress: needsProofOfAddress,
    selfie: needsSelfie,
    singleDocResubmit: resubmitDoc
  });

  // Passport (ID) upload
  const passportInput = document.getElementById('passport-file-input');
  const passportPreview = document.getElementById('passport-preview');
  const passportPreviewImg = document.getElementById('passport-preview-img');
  const removePassport = document.getElementById('remove-passport');
  const passportLabel = document.querySelector('label[for="passport-file-input"]');

  passportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('[Upload] Passport file selected:', file.name);
      uploadedFiles.passport = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        passportPreviewImg.src = event.target.result;
        passportPreview.style.display = 'block';
        passportLabel.style.display = 'none';
        checkAllUploaded();
      };
      reader.readAsDataURL(file);
    }
  });

  removePassport.addEventListener('click', () => {
    console.log('[Upload] Removing passport file');
    uploadedFiles.passport = null;
    passportInput.value = '';
    passportPreview.style.display = 'none';
    passportLabel.style.display = 'flex';
    checkAllUploaded();
  });

  // Proof of Address upload
  const proofInput = document.getElementById('proof-of-address-file-input');
  const proofPreview = document.getElementById('proof-of-address-preview');
  const proofPreviewImg = document.getElementById('proof-of-address-preview-img');
  const removeProof = document.getElementById('remove-proof-of-address');
  const proofLabel = document.querySelector('label[for="proof-of-address-file-input"]');

  proofInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('[Upload] Proof of address file selected:', file.name);
      uploadedFiles.proof_of_address = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        proofPreviewImg.src = event.target.result;
        proofPreview.style.display = 'block';
        proofLabel.style.display = 'none';
        checkAllUploaded();
      };
      reader.readAsDataURL(file);
    }
  });

  removeProof.addEventListener('click', () => {
    console.log('[Upload] Removing proof of address file');
    uploadedFiles.proof_of_address = null;
    proofInput.value = '';
    proofPreview.style.display = 'none';
    proofLabel.style.display = 'flex';
    checkAllUploaded();
  });

  // Selfie upload
  const selfieInput = document.getElementById('selfie-file-input');
  const selfiePreview = document.getElementById('selfie-preview');
  const selfiePreviewImg = document.getElementById('selfie-preview-img');
  const removeSelfie = document.getElementById('remove-selfie');
  const selfieLabel = document.querySelector('label[for="selfie-file-input"]');

  selfieInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('[Upload] Selfie file selected:', file.name);
      uploadedFiles.selfie = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        selfiePreviewImg.src = event.target.result;
        selfiePreview.style.display = 'block';
        selfieLabel.style.display = 'none';
        checkAllUploaded();
      };
      reader.readAsDataURL(file);
    }
  });

  removeSelfie.addEventListener('click', () => {
    console.log('[Upload] Removing selfie file');
    uploadedFiles.selfie = null;
    selfieInput.value = '';
    selfiePreview.style.display = 'none';
    selfieLabel.style.display = 'flex';
    checkAllUploaded();
  });

  // Check if all files are uploaded
  function checkAllUploaded() {
    const submitBtn = document.getElementById('submit-identity-btn');
    const statusText = document.getElementById('upload-status');

    if (!submitBtn || !statusText) return;

    // Check if resubmitting a specific document
    const resubmitDoc = sessionStorage.getItem('resubmit_document');

    // Determine which documents are required
    let needsPassport, needsProofOfAddress, needsSelfie;

    if (resubmitDoc) {
      // Individual document resubmission
      needsPassport = (resubmitDoc === 'passport');
      needsProofOfAddress = (resubmitDoc === 'address');
      needsSelfie = (resubmitDoc === 'selfie');
    } else {
      // Full submission - documents that are not uploaded yet OR rejected
      needsPassport = !verification?.passport_document_url || verification?.passport_approved === false;
      needsProofOfAddress = !verification?.proof_of_address_url || verification?.proof_of_address_approved === false;
      needsSelfie = !verification?.selfie_with_id_url || verification?.selfie_approved === false;
    }

    // Check if all required documents are uploaded
    const requiredDocuments = [];
    const uploadedDocuments = [];

    if (needsPassport) {
      requiredDocuments.push('passport');
      if (uploadedFiles.passport) uploadedDocuments.push('passport');
    }
    if (needsProofOfAddress) {
      requiredDocuments.push('proof_of_address');
      if (uploadedFiles.proof_of_address) uploadedDocuments.push('proof_of_address');
    }
    if (needsSelfie) {
      requiredDocuments.push('selfie');
      if (uploadedFiles.selfie) uploadedDocuments.push('selfie');
    }

    const allRequiredUploaded = uploadedDocuments.length === requiredDocuments.length && requiredDocuments.length > 0;

    if (allRequiredUploaded) {
      submitBtn.disabled = false;
      statusText.textContent = '✓ All required documents uploaded. Ready to submit.';
      statusText.style.color = '#10b981';
    } else {
      submitBtn.disabled = true;
      statusText.textContent = `${uploadedDocuments.length} of ${requiredDocuments.length} required documents uploaded`;
      statusText.style.color = '#6b7280';
    }
  }

  // Submit handler
  const submitBtn = document.getElementById('submit-identity-btn');
  if (submitBtn) {
    // Remove any existing listeners by cloning
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

    newSubmitBtn.addEventListener('click', async () => {
      // Check if resubmitting a specific document
      const resubmitDoc = sessionStorage.getItem('resubmit_document');

      // Determine which documents are required
      let needsPassport, needsProofOfAddress, needsSelfie;

      if (resubmitDoc) {
        // Individual document resubmission
        needsPassport = (resubmitDoc === 'passport');
        needsProofOfAddress = (resubmitDoc === 'address');
        needsSelfie = (resubmitDoc === 'selfie');
      } else {
        // Full submission - documents that are not uploaded yet OR rejected
        needsPassport = !verification?.passport_document_url || verification?.passport_approved === false;
        needsProofOfAddress = !verification?.proof_of_address_url || verification?.proof_of_address_approved === false;
        needsSelfie = !verification?.selfie_with_id_url || verification?.selfie_approved === false;
      }

      // Validate all required documents are present
      const missingDocs = [];
      if (needsPassport && !uploadedFiles.passport) missingDocs.push('passport');
      if (needsProofOfAddress && !uploadedFiles.proof_of_address) missingDocs.push('proof of address');
      if (needsSelfie && !uploadedFiles.selfie) missingDocs.push('selfie photo');

      if (missingDocs.length > 0) {
        alert(`Please upload the following required documents: ${missingDocs.join(', ')}`);
        return;
      }

      newSubmitBtn.disabled = true;
      newSubmitBtn.textContent = 'Uploading...';

      try {
        const formData = new FormData();

        // Use stored data if available, otherwise fall back to verification data (for resubmissions)
        const personalInfo = personalInfoData || {
          full_name: verification.recipient_full_name,
          address: verification.recipient_address,
          country: verification.recipient_country,
          phone: verification.recipient_phone
        };

        const documentInfo = documentInfoData || {
          id_type: verification.id_type,
          id_number: verification.id_number,
          id_country: verification.id_country,
          id_expiry_date: verification.id_expiry_date
        };

        console.log('[Upload] Personal info:', personalInfo);
        console.log('[Upload] Document info:', documentInfo);

        // Validation: Check that we have all required personal info
        if (!personalInfo.full_name || !personalInfo.address || !personalInfo.country || !personalInfo.phone) {
          console.error('[Upload] Missing personal information:', personalInfo);
          alert('Error: Missing personal information. Please refresh and start from the beginning.');
          newSubmitBtn.disabled = false;
          newSubmitBtn.textContent = 'Submit Documents';
          return;
        }

        // Validation: Check that we have all required document info
        if (!documentInfo.id_type || !documentInfo.id_number || !documentInfo.id_country || !documentInfo.id_expiry_date) {
          console.error('[Upload] Missing document information:', documentInfo);
          alert('Error: Missing document information. Please refresh and start from the beginning.');
          newSubmitBtn.disabled = false;
          newSubmitBtn.textContent = 'Submit Documents';
          return;
        }

        // Add personal information
        formData.append('full_name', personalInfo.full_name);
        formData.append('address', personalInfo.address);
        formData.append('country', personalInfo.country);
        formData.append('phone', personalInfo.phone);

        // Add document information
        formData.append('id_type', documentInfo.id_type);
        formData.append('id_number', documentInfo.id_number);
        formData.append('id_country', documentInfo.id_country);
        formData.append('id_expiry_date', documentInfo.id_expiry_date);

        // CRITICAL: Send resubmission context to backend
        // This tells backend which specific document is being resubmitted
        if (resubmitDoc) {
          formData.append('resubmit_specific_document', resubmitDoc);
          console.log('[Upload] Sending specific document resubmission flag:', resubmitDoc);
        }

        // Add files (only include new files, backend will keep existing approved ones)
        if (uploadedFiles.passport) {
          formData.append('passport', uploadedFiles.passport, 'passport.jpg');
        }
        if (uploadedFiles.proof_of_address) {
          formData.append('proof_of_address', uploadedFiles.proof_of_address, 'proof_of_address.jpg');
        }
        if (uploadedFiles.selfie) {
          formData.append('selfie_with_id', uploadedFiles.selfie, 'selfie.jpg');
        }

        console.log('[Upload] Submitting documents to backend');

        const response = await fetch(`${API_BASE}/verification/${token}/submit-info`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        console.log('[Upload] Documents uploaded successfully');

        // Clear resubmission flag if it was set
        if (sessionStorage.getItem('resubmit_document')) {
          sessionStorage.removeItem('resubmit_document');
          currentResubmitDocument = null;
          console.log('[Upload] Cleared resubmission flag');
        }

        // Show success notification
        showNotification('Documents submitted successfully! Awaiting review.', 'success');

        // Reload verification to get updated status
        await loadVerification();

        // Transition to waiting for approval
        transitionTo(STATES.WAITING_APPROVAL);

      } catch (error) {
        console.error('[Upload] Error:', error);
        alert(`Failed to upload documents: ${error.message}\n\nPlease try again.`);
        newSubmitBtn.disabled = false;
        newSubmitBtn.textContent = 'Submit Documents';
      }
    });
  }

  // Initial check
  checkAllUploaded();
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
