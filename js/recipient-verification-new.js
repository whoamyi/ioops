// IOOPS Verification Portal - State Machine Implementation

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/ioops'
  : 'https://meridian-tracking.fly.dev/api/ioops';

// State Machine
const STATES = {
  LOADING: 'LOADING',
  ERROR: 'ERROR',
  ENTRY_POINT: 'ENTRY_POINT',
  STEP_1_1_PERSONAL: 'STEP_1_1_PERSONAL',
  STEP_1_2_DOCUMENT: 'STEP_1_2_DOCUMENT',
  STEP_1_3_CAPTURE: 'STEP_1_3_CAPTURE',
  STEP_2_PAYMENT: 'STEP_2_PAYMENT',
  STEP_3_GENERATE: 'STEP_3_GENERATE',
  STEP_4_COMPLETE: 'STEP_4_COMPLETE'
};

let currentState = STATES.LOADING;
let verification = null;
let capturedDocuments = {
  document: null,
  address: null,
  face: null
};

// Camera instance
let camera = null;

// Parse token from URL
function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

const token = getTokenFromURL();

// State transition function
function transitionTo(newState) {
  console.log(`[State] Transitioning from ${currentState} to ${newState}`);
  currentState = newState;
  renderState();
}

// Render current state
function renderState() {
  // Hide all sections first
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('entry-point').style.display = 'none';
  document.getElementById('step-1-1').style.display = 'none';
  document.getElementById('step-1-2').style.display = 'none';
  document.getElementById('step-1-3').style.display = 'none';
  document.getElementById('step-2').style.display = 'none';
  document.getElementById('step-3').style.display = 'none';
  document.getElementById('step-4').style.display = 'none';

  // Update progress bar
  updateProgressBar();

  // Show appropriate section
  switch (currentState) {
    case STATES.LOADING:
      document.getElementById('loading-state').style.display = 'block';
      break;

    case STATES.ERROR:
      document.getElementById('error-state').style.display = 'block';
      break;

    case STATES.ENTRY_POINT:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('entry-point').style.display = 'block';
      break;

    case STATES.STEP_1_1_PERSONAL:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('step-1-1').style.display = 'block';
      break;

    case STATES.STEP_1_2_DOCUMENT:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('step-1-2').style.display = 'block';
      break;

    case STATES.STEP_1_3_CAPTURE:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('step-1-3').style.display = 'block';
      initializeDocumentCapture();
      break;

    case STATES.STEP_2_PAYMENT:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('step-2').style.display = 'block';
      populatePaymentDetails();
      break;

    case STATES.STEP_3_GENERATE:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('step-3').style.display = 'block';
      break;

    case STATES.STEP_4_COMPLETE:
      document.getElementById('main-content').style.display = 'block';
      document.getElementById('step-4').style.display = 'block';
      break;
  }
}

// Update progress bar based on current state
function updateProgressBar() {
  const steps = document.querySelectorAll('.step');
  steps.forEach(step => step.classList.remove('active'));

  let activeStep = 1;
  if (currentState === STATES.STEP_1_1_PERSONAL ||
      currentState === STATES.STEP_1_2_DOCUMENT ||
      currentState === STATES.STEP_1_3_CAPTURE) {
    activeStep = 1;
  } else if (currentState === STATES.STEP_2_PAYMENT) {
    activeStep = 2;
  } else if (currentState === STATES.STEP_3_GENERATE) {
    activeStep = 3;
  } else if (currentState === STATES.STEP_4_COMPLETE) {
    activeStep = 4;
  }

  const activeStepEl = document.querySelector(`.step[data-step="${activeStep}"]`);
  if (activeStepEl) {
    activeStepEl.classList.add('active');
  }
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
    const response = await fetch(`${API_BASE}/verification/${token}`);
    if (!response.ok) throw new Error('Failed to load verification session');
    verification = await response.json();
    transitionTo(STATES.ENTRY_POINT);
  } catch (error) {
    showError(error.message);
  }
}

async function submitPersonalInfo(formData) {
  try {
    const response = await fetch(`${API_BASE}/verification/${token}/submit-personal-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (!response.ok) throw new Error('Failed to submit personal information');
    const data = await response.json();
    verification = { ...verification, ...data };
    transitionTo(STATES.STEP_1_2_DOCUMENT);
  } catch (error) {
    showError(error.message);
  }
}

async function submitDocumentInfo(formData) {
  try {
    const response = await fetch(`${API_BASE}/verification/${token}/submit-document-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (!response.ok) throw new Error('Failed to submit document information');
    const data = await response.json();
    verification = { ...verification, ...data };
    transitionTo(STATES.STEP_1_3_CAPTURE);
  } catch (error) {
    showError(error.message);
  }
}

async function submitIdentityEvidence() {
  try {
    const formData = new FormData();

    if (capturedDocuments.document) {
      formData.append('passport', capturedDocuments.document, 'document.jpg');
    }
    if (capturedDocuments.address) {
      formData.append('proof_of_address', capturedDocuments.address, 'address.jpg');
    }
    if (capturedDocuments.face) {
      formData.append('selfie', capturedDocuments.face, 'selfie.jpg');
    }

    const response = await fetch(`${API_BASE}/verification/${token}/submit-identity`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Failed to submit identity evidence');
    const data = await response.json();
    verification = { ...verification, ...data };
    transitionTo(STATES.STEP_2_PAYMENT);
  } catch (error) {
    showError(error.message);
  }
}

// Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  if (!token) {
    showError('No verification token provided');
    return;
  }

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
      const formData = {
        full_name: document.getElementById('full-name').value,
        address: document.getElementById('address').value,
        country: document.getElementById('country').value,
        phone: document.getElementById('phone').value
      };
      await submitPersonalInfo(formData);
    });
  }

  // Step 1.2 - Document Info Form
  const documentInfoForm = document.getElementById('document-info-form');
  if (documentInfoForm) {
    documentInfoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        id_type: document.getElementById('id-type').value,
        id_country: document.getElementById('id-country').value,
        id_number: document.getElementById('id-number').value,
        id_expiry_date: document.getElementById('id-expiry-date').value
      };
      await submitDocumentInfo(formData);
    });
  }

  // Step 1.3 - Submit Identity Button
  const submitIdentityBtn = document.getElementById('submit-identity-btn');
  if (submitIdentityBtn) {
    submitIdentityBtn.addEventListener('click', async () => {
      await submitIdentityEvidence();
    });
  }

  // Step 2 - Payment Form
  const paymentForm = document.getElementById('payment-confirmation-form');
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('payment-receipt');
      if (fileInput.files[0]) {
        await uploadPaymentReceipt(fileInput.files[0]);
      }
    });
  }

  // Step 3 - Generate Code
  const generateCodeBtn = document.getElementById('generate-code-btn');
  if (generateCodeBtn) {
    generateCodeBtn.addEventListener('click', async () => {
      await generateVerificationCode();
    });
  }

  // Start the application
  loadVerification();
});

// Camera Capture Functions
function initializeDocumentCapture() {
  // Show document capture section first
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

    // Auto-capture simulation (in real implementation, use quality heuristics)
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

  // Convert to blob
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
      document.getElementById('document-preview').style.display = 'none';
      document.querySelector('#document-capture-section .capture-container').style.display = 'block';
      startCamera('document');
    });
  }

  // Address confirm
  const confirmAddressBtn = document.getElementById('confirm-address');
  if (confirmAddressBtn) {
    confirmAddressBtn.addEventListener('click', () => {
      document.getElementById('address-capture-section').style.display = 'none';
      document.getElementById('face-capture-section').style.display = 'block';
      startCamera('face');
    });
  }

  // Address retake
  const retakeAddressBtn = document.getElementById('retake-address');
  if (retakeAddressBtn) {
    retakeAddressBtn.addEventListener('click', () => {
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
      document.getElementById('face-preview').style.display = 'none';
      document.querySelector('#face-capture-section .capture-container').style.display = 'block';
      startCamera('face');
    });
  }
});

// Payment functions
function populatePaymentDetails() {
  if (verification) {
    const amountEl = document.getElementById('escrow-amount');
    const refEl = document.getElementById('payment-reference');

    if (amountEl && verification.escrow_amount) {
      amountEl.textContent = `€${verification.escrow_amount}`;
    }
    if (refEl && verification.tracking_id) {
      refEl.textContent = verification.tracking_id;
    }
  }
}

async function uploadPaymentReceipt(file) {
  try {
    const formData = new FormData();
    formData.append('receipt', file);

    const response = await fetch(`${API_BASE}/verification/${token}/upload-receipt`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Failed to upload payment receipt');
    const data = await response.json();
    verification = { ...verification, ...data };
    transitionTo(STATES.STEP_3_GENERATE);
  } catch (error) {
    showError(error.message);
  }
}

async function generateVerificationCode() {
  try {
    const response = await fetch(`${API_BASE}/verification/${token}/generate-code`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to generate verification code');
    const data = await response.json();

    // Display code
    const codeEl = document.getElementById('security-code');
    const codeDisplay = document.getElementById('code-display');

    if (codeEl && data.security_code) {
      codeEl.textContent = data.security_code;
      codeDisplay.style.display = 'block';

      // Hide generate button
      document.getElementById('generate-code-btn').style.display = 'none';

      // Transition to complete after showing code
      setTimeout(() => {
        transitionTo(STATES.STEP_4_COMPLETE);
      }, 3000);
    }
  } catch (error) {
    showError(error.message);
  }
}
