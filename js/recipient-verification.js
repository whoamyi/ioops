// IOOPS Verification Portal - Client-side Logic

// const API_BASE = 'https://meridian-tracking.fly.dev/api/ioops';
const API_BASE = 'http://localhost:3000/api/ioops'; // For local development

// Parse verification token from URL
function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

// API Client
class VerificationAPI {
  static async getVerification(token) {
    const response = await fetch(`${API_BASE}/verification/${token}`);
    if (!response.ok) {
      throw new Error('Failed to load verification session');
    }
    return response.json();
  }

  static async submitInfo(token, formData) {
    const response = await fetch(`${API_BASE}/verification/${token}/submit-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (!response.ok) {
      throw new Error('Failed to submit information');
    }
    return response.json();
  }

  static async submitInfoWithFiles(token, formData) {
    const response = await fetch(`${API_BASE}/verification/${token}/submit-info`, {
      method: 'POST',
      body: formData  // FormData automatically sets correct Content-Type with boundary
    });
    if (!response.ok) {
      throw new Error('Failed to submit information and documents');
    }
    return response.json();
  }

  static async uploadReceipt(token, file) {
    console.log('[API] uploadReceipt called with token:', token, 'file:', file.name);
    const formData = new FormData();
    formData.append('receipt', file);
    console.log('[API] FormData created, sending POST request...');

    const response = await fetch(`${API_BASE}/verification/${token}/upload-receipt`, {
      method: 'POST',
      body: formData
    });
    console.log('[API] Response status:', response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Error response:', errorText);
      throw new Error('Failed to upload payment receipt: ' + response.status);
    }
    const data = await response.json();
    console.log('[API] Response data:', data);
    return data;
  }

  static async confirmEscrow(token, reference) {
    const response = await fetch(`${API_BASE}/verification/${token}/confirm-escrow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escrow_reference: reference })
    });
    if (!response.ok) {
      throw new Error('Failed to confirm escrow deposit');
    }
    return response.json();
  }

  static async generateCode(token) {
    const response = await fetch(`${API_BASE}/verification/${token}/generate-code`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error('Failed to generate security code');
    }
    return response.json();
  }
}

// State Management
let verification = null;
let currentStep = 1;
const token = getTokenFromURL();
let statusPollInterval = null;
let socket = null;
let justUploadedReceipt = false; // Flag to prevent polling from re-showing rejection after upload

// Poll for verification status updates
async function pollVerificationStatus() {
  try {
    const updatedVerification = await VerificationAPI.getVerification(token);
    const oldStatus = verification.status;
    const oldDocumentsApproved = verification.all_documents_approved;
    const oldEscrowStatus = verification.escrow_status;
    const hadRejection = verification.rejection_reason || verification.rejected_at;

    // PRESERVE APPROVED STATUS - Don't overwrite with null from API
    if (updatedVerification.passport_approved !== null) {
      verification.passport_approved = updatedVerification.passport_approved;
    }
    if (updatedVerification.proof_of_address_approved !== null) {
      verification.proof_of_address_approved = updatedVerification.proof_of_address_approved;
    }
    if (updatedVerification.selfie_approved !== null) {
      verification.selfie_approved = updatedVerification.selfie_approved;
    }
    if (updatedVerification.all_documents_approved !== null) {
      verification.all_documents_approved = updatedVerification.all_documents_approved;
    }

    // Always update other fields
    verification.status = updatedVerification.status;
    verification.progress = updatedVerification.progress;
    verification.escrow_status = updatedVerification.escrow_status;
    verification.payment_receipt_url = updatedVerification.payment_receipt_url;
    verification.escrow_confirmed_at = updatedVerification.escrow_confirmed_at;
    verification.code_used_at = updatedVerification.code_used_at;
    verification.approval_timestamp = updatedVerification.approval_timestamp;

    // ONLY update rejection fields if we haven't just uploaded a new receipt
    // (prevents stale server data from overwriting our cleared state)
    if (!justUploadedReceipt) {
      verification.rejection_reason = updatedVerification.rejection_reason;
      verification.rejected_at = updatedVerification.rejected_at;
    } else {
      console.log('[POLL] Skipping rejection fields update - receipt just uploaded');
    }

    // Check if documents were approved
    if (!oldDocumentsApproved && verification.all_documents_approved) {
      updateDocumentStatuses();
      showNotification('All documents approved! You can now proceed to Step 2.', 'success');
    } else if (verification.status === 'documents_submitted') {
      // Only update if there's actual approval data
      if (updatedVerification.passport_approved !== null ||
          updatedVerification.proof_of_address_approved !== null ||
          updatedVerification.selfie_approved !== null) {
        updateDocumentStatuses();
      }
    }

    // Check if payment status changed - update persistent UI display
    if (oldEscrowStatus !== 'confirmed' && verification.escrow_status === 'confirmed') {
      // Payment was approved - update persistent display
      justUploadedReceipt = false; // Clear flag - admin has made a decision
      console.log('[POLL] Payment approved - cleared justUploadedReceipt flag');
      updatePaymentStatus();
    } else if (!hadRejection && (updatedVerification.rejection_reason || updatedVerification.rejected_at)) {
      // Payment was rejected - update persistent display
      // Admin rejected the NEW receipt - update our state and clear the flag
      justUploadedReceipt = false; // Clear flag - admin has made a decision
      verification.rejection_reason = updatedVerification.rejection_reason;
      verification.rejected_at = updatedVerification.rejected_at;
      console.log('[POLL] Payment rejected - cleared justUploadedReceipt flag and updated rejection data');
      updatePaymentStatus();
    } else if (hadRejection && !verification.rejection_reason && !verification.rejected_at) {
      // Rejection was cleared (new receipt uploaded) - update persistent display
      updatePaymentStatus();
    }

    // Check if verification was completed (security code used on Meridian portal)
    if (verification.status === 'completed' && verification.code_used_at && currentStep === 4) {
      console.log('[POLL] Verification completed! Code was used on Meridian portal.');
      showNotification('Your security code has been verified! Verification complete.', 'success');
      // Show completion state within Step 4
      showStep4Completed();
    }

  } catch (error) {
    console.error('Status poll error:', error);
  }
}

// Start polling for status updates
function startStatusPolling() {
  if (statusPollInterval) clearInterval(statusPollInterval);

  // Poll every 5 seconds when documents submitted but not approved
  if (verification.status === 'documents_submitted' && !verification.all_documents_approved) {
    statusPollInterval = setInterval(pollVerificationStatus, 5000);
  }

  // Poll every 10 seconds when payment submitted or documents approved (waiting for payment action)
  if ((verification.status === 'payment_submitted' && !verification.progress.escrow_confirmed) ||
      (verification.status === 'documents_approved' && verification.escrow_status !== 'confirmed')) {
    statusPollInterval = setInterval(pollVerificationStatus, 10000);
  }
}

// Stop polling
function stopStatusPolling() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
}

// Update document statuses in UI - COMPLETELY REDESIGNED
function updateDocumentStatuses() {
  const documentFields = [
    { type: 'passport', name: 'Passport / ID Document (Photo Page)', approved: verification.passport_approved, reason: verification.passport_rejection_reason, url: verification.passport_document_url },
    { type: 'proof_of_address', name: 'Proof of Address', approved: verification.proof_of_address_approved, reason: verification.proof_of_address_rejection_reason, url: verification.proof_of_address_url },
    { type: 'selfie', name: 'Selfie with ID Document', approved: verification.selfie_approved, reason: verification.selfie_rejection_reason, url: verification.selfie_with_id_url }
  ];

  documentFields.forEach(doc => {
    const groupEl = document.querySelector(`[data-document-type="${doc.type}"]`);
    if (!groupEl) return;

    // Clear the entire group content
    groupEl.innerHTML = '';

    // Add label
    const label = document.createElement('label');
    label.className = 'document-label';
    label.innerHTML = doc.name + ' <span class="required">*</span>';
    groupEl.appendChild(label);

    // Add description
    const descriptions = {
      'passport': 'Upload the main page of your passport or ID card showing your photo and personal details',
      'proof_of_address': 'Recent utility bill, bank statement, or government document (dated within last 3 months)',
      'selfie': 'Take a photo of yourself holding your passport/ID next to your face (for verification purposes)'
    };
    const desc = document.createElement('p');
    desc.className = 'document-description';
    desc.textContent = descriptions[doc.type] || '';
    groupEl.appendChild(desc);

    if (doc.approved === true) {
      // APPROVED: Show filename + status badge on same line
      const filename = doc.url ? doc.url.split('/').pop() : 'Unknown file';

      const fileDisplay = document.createElement('div');
      fileDisplay.className = 'document-approved-display';
      fileDisplay.innerHTML = `
        <div class="approved-file-container">
          <span class="approved-filename" title="${filename}">${filename}</span>
          <div class="field-status approved">
            <span class="status-icon">✓</span>
            <span class="status-text">Approved</span>
          </div>
        </div>
      `;
      groupEl.appendChild(fileDisplay);

    } else if (doc.approved === false) {
      // REJECTED: Show input field for resubmission + rejection reason
      const inputContainer = document.createElement('div');
      inputContainer.className = 'document-input-container';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = `${doc.type}-upload`;
      fileInput.name = doc.type;
      fileInput.className = 'file-input';
      fileInput.disabled = false;
      fileInput.accept = doc.type === 'selfie' ? 'image/*' : 'image/*,.pdf';

      const inputLabel = document.createElement('label');
      inputLabel.htmlFor = `${doc.type}-upload`;
      inputLabel.className = 'file-input-label';
      inputLabel.innerHTML = `<span>Choose File</span>`;
      inputLabel.appendChild(fileInput);

      inputContainer.appendChild(inputLabel);
      groupEl.appendChild(inputContainer);

      // Show rejection reason
      const reasonBox = document.createElement('div');
      reasonBox.className = 'rejection-reason-box';
      reasonBox.innerHTML = `
        <div class="field-status rejected">
          <span class="status-icon">✗</span>
          <span class="status-text">Rejected</span>
        </div>
        <div class="rejection-details">
          <strong>Reason:</strong> ${doc.reason || 'Document does not meet requirements'}
          <p class="resubmit-notice">Please upload a new document</p>
        </div>
      `;
      groupEl.appendChild(reasonBox);

    } else if (doc.approved === null) {
      // UNDER REVIEW: Show filename + status badge if file exists, no input field
      if (doc.url) {
        const filename = doc.url.split('/').pop();
        const fileDisplay = document.createElement('div');
        fileDisplay.className = 'document-review-display';
        fileDisplay.innerHTML = `
          <div class="reviewing-file-container">
            <span class="review-filename" title="${filename}">${filename}</span>
            <div class="field-status reviewing">
              <span class="status-icon">⏳</span>
              <span class="status-text">Under Review</span>
            </div>
          </div>
        `;
        groupEl.appendChild(fileDisplay);
      } else {
        // No file uploaded yet - show input field
        const inputContainer = document.createElement('div');
        inputContainer.className = 'document-input-container';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = `${doc.type}-upload`;
        fileInput.name = doc.type;
        fileInput.className = 'file-input';
        fileInput.disabled = false;
        fileInput.accept = doc.type === 'selfie' ? 'image/*' : 'image/*,.pdf';

        const inputLabel = document.createElement('label');
        inputLabel.htmlFor = `${doc.type}-upload`;
        inputLabel.className = 'file-input-label';
        inputLabel.innerHTML = `<span>Choose File</span>`;
        inputLabel.appendChild(fileInput);

        inputContainer.appendChild(inputLabel);
        groupEl.appendChild(inputContainer);
      }
    }
  });

  // UPDATE SUBMIT BUTTON
  const submitBtn = document.querySelector('#recipient-form button[type="submit"]');
  if (submitBtn) {
    // Check if any documents are rejected
    const hasRejectedDocs = verification.passport_approved === false || verification.proof_of_address_approved === false || verification.selfie_approved === false;

    if (verification.all_documents_approved) {
      // All documents approved - allow continue to Step 2
      submitBtn.textContent = 'Continue to Step 2 →';
      submitBtn.disabled = false;
      submitBtn.onclick = (e) => {
        e.preventDefault();
        renderStep(2);
      };
    } else if (hasRejectedDocs) {
      // Some documents rejected - allow resubmission
      submitBtn.textContent = 'Resubmit Documents';
      submitBtn.disabled = false;
      submitBtn.onclick = null; // Use default form submit
    } else if (verification.status === 'documents_submitted') {
      // All documents under review or approved - disable button
      submitBtn.textContent = 'Under Review...';
      submitBtn.disabled = true;
      submitBtn.onclick = null;
    }
  }
}

// Show notification banner
function showNotification(message, type = 'info') {
  const notif = document.createElement('div');
  notif.className = `notification notification-${type}`;
  notif.innerHTML = `
    <span class="notification-icon">${type === 'success' ? '✓' : 'ℹ'}</span>
    <span class="notification-text">${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.insertBefore(notif, document.body.firstChild);

  // Auto-remove after 10 seconds
  setTimeout(() => notif.remove(), 10000);
}

// Initialize Portal
async function initializePortal() {
  if (!token) {
    showError('Invalid verification link. Please check your email for the correct URL.');
    return;
  }

  try {
    showLoading('Loading verification session...');
    verification = await VerificationAPI.getVerification(token);

    // Update tracking ID display
    const trackingIdEl = document.getElementById('tracking-id');
    if (trackingIdEl) trackingIdEl.textContent = verification.tracking_id;

    const recipientEmailEl = document.getElementById('recipient-email');
    if (recipientEmailEl) recipientEmailEl.textContent = verification.recipient_email;

    const referenceNumberEl = document.getElementById('reference-number');
    if (referenceNumberEl) {
      referenceNumberEl.textContent = `${verification.tracking_id} | Session: ${token.substring(0, 16)}...`;
    }

    // Determine current step based on progress
    if (verification.security_code_revealed) {
      currentStep = 4; // Show Step 4 (will determine waiting vs completed state later)
    } else if (verification.progress.escrow_confirmed) {
      currentStep = 3;
    } else if (verification.all_documents_approved) {
      // Documents approved, can access Step 2
      currentStep = verification.status === 'payment_submitted' ? 2 : 2;
    } else if (verification.progress.documents_submitted) {
      // Documents submitted but not approved yet - stay on Step 1
      currentStep = 1;
    } else {
      currentStep = 1;
    }

    hideLoading();
    renderStep(currentStep);

    // Setup WebSocket for real-time updates
    setupWebSocket();

    // Start polling for status updates (as fallback)
    startStatusPolling();

  } catch (error) {
    showError(error.message);
  }
}

// Step Rendering
function renderStep(step) {
  currentStep = step;

  // Update progress bar
  console.log(`[DEBUG] Updating progress bar for step ${currentStep}`);
  for (let i = 1; i <= 4; i++) {
    const stepElement = document.querySelector(`.step[data-step="${i}"]`);
    if (stepElement) {
      // Force remove all state classes first
      stepElement.classList.remove('active', 'completed');

      if (i < currentStep) {
        stepElement.classList.add('completed');
        console.log(`Step ${i}: COMPLETED (green) - Classes:`, stepElement.className);
      } else if (i === currentStep) {
        stepElement.classList.add('active');
        console.log(`Step ${i}: ACTIVE (highlighted) - Classes:`, stepElement.className);
      } else {
        console.log(`Step ${i}: INACTIVE (grey) - Classes:`, stepElement.className);
      }

      // Force browser to recognize class change
      void stepElement.offsetHeight;
    } else {
      console.warn(`Step element not found for step ${i}`);
    }
  }

  // Hide all steps
  document.querySelectorAll('.verification-step').forEach(el => el.style.display = 'none');

  // Show current step
  const currentStepElement = document.getElementById(`step-${step}`);
  console.log('Rendering step:', step, 'Element found:', currentStepElement);
  if (currentStepElement) {
    currentStepElement.style.display = 'block';
    console.log('Step element display set to block');
  } else {
    console.error('Step element not found for step:', step);
  }

  // Populate Step 1 with any available data (pre-filled or submitted)
  if (step === 1) {
    populateStep1Data();

    // Update document statuses if any documents were submitted
    // (Check if any document URL exists, meaning documents were uploaded at some point)
    if (verification.passport_document_url || verification.proof_of_address_url || verification.selfie_with_id_url) {
      updateDocumentStatuses();
    }
  }

  // Lock completed steps - show completion status instead of forms
  lockCompletedSteps();

  // Populate data for specific steps
  if (step === 2) {
    // HTML already contains "EUR €", just insert the number
    document.getElementById('escrow-amount').textContent =
      parseFloat(verification.escrow_amount).toLocaleString();
    document.getElementById('escrow-confirm-amount').textContent = parseFloat(verification.escrow_amount).toLocaleString();

    // Update payment status display
    updatePaymentStatus();
  }

  if (step === 4 && verification.security_code_revealed) {
    const securityCodeEl = document.getElementById('security-code');
    if (securityCodeEl) securityCodeEl.textContent = verification.security_code;

    const trackingIdDisplayEl = document.getElementById('tracking-id-display');
    if (trackingIdDisplayEl) trackingIdDisplayEl.textContent = verification.tracking_id;
  }

  // Handle Step 4 state (waiting vs completed)
  if (step === 4) {
    if (verification.status === 'completed' && verification.code_used_at) {
      // Show completed state
      showStep4Completed();
    } else {
      // Show waiting state (default)
      const waitingState = document.getElementById('step-4-waiting');
      const completedState = document.getElementById('step-4-completed');
      if (waitingState) waitingState.style.display = 'block';
      if (completedState) completedState.style.display = 'none';
    }
  }
}

// Show Step 4 completion state
function showStep4Completed() {
  const waitingState = document.getElementById('step-4-waiting');
  const completedState = document.getElementById('step-4-completed');

  if (waitingState) waitingState.style.display = 'none';
  if (completedState) completedState.style.display = 'block';

  // Populate completion data
  const trackingIdEl = document.getElementById('completion-tracking-id');
  if (trackingIdEl) trackingIdEl.textContent = verification.tracking_id;

  const completionDateEl = document.getElementById('completion-date');
  if (completionDateEl && verification.code_used_at) {
    completionDateEl.textContent = new Date(verification.code_used_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const escrowAmountEl = document.getElementById('escrow-return-amount');
  if (escrowAmountEl) {
    escrowAmountEl.textContent = parseFloat(verification.escrow_amount).toLocaleString();
  }

  // Calculate escrow return date (from database or default 7 days)
  const escrowReturnDays = verification.escrow_return_days || 7;
  const returnDate = new Date(verification.code_used_at);
  returnDate.setDate(returnDate.getDate() + escrowReturnDays);

  const returnDateEl = document.getElementById('escrow-return-date');
  if (returnDateEl) {
    returnDateEl.textContent = returnDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  const escrowDaysEl = document.getElementById('escrow-return-days');
  if (escrowDaysEl) escrowDaysEl.textContent = escrowReturnDays;

  const escrowDays2El = document.getElementById('escrow-return-days-2');
  if (escrowDays2El) escrowDays2El.textContent = escrowReturnDays;

  // Stop polling since verification is complete
  stopStatusPolling();
}

// Populate Step 1 form with submitted or pre-filled data
function populateStep1Data() {
  // Populate text fields with any available data (pre-filled from verification record or previously submitted)
  document.getElementById('full-name').value = verification.recipient_full_name || '';
  document.getElementById('address').value = verification.recipient_address || '';
  document.getElementById('country').value = verification.recipient_country || '';
  document.getElementById('phone').value = verification.recipient_phone || '';
  document.getElementById('id-type').value = verification.id_type || 'passport';
  document.getElementById('id-number').value = verification.id_number || '';
  document.getElementById('id-country').value = verification.id_country || '';
  document.getElementById('id-expiry-date').value = verification.id_expiry_date || '';

  // Update document statuses (this will rebuild the entire document section dynamically)
  if (verification.status === 'documents_submitted') {
    updateDocumentStatuses();
  }

  // If documents submitted, disable all form inputs except rejected ones
  if (verification.status === 'documents_submitted') {
    // Disable text inputs, selects, and textareas
    document.querySelectorAll('#recipient-form input:not([type="file"]), #recipient-form select, #recipient-form textarea').forEach(input => {
      input.disabled = true;
    });
  }
}

// Lock completed steps
function lockCompletedSteps() {
  // Lock Step 1 if documents submitted
  if (verification.progress.documents_submitted && currentStep > 1) {
    const step1 = document.getElementById('step-1');
    if (!step1.querySelector('.step-locked')) {
      const form = step1.querySelector('form');
      const stepContent = step1.querySelector('.step-content');

      // Hide form
      if (form) form.style.display = 'none';

      // Add locked message with document status
      const lockedDiv = document.createElement('div');
      lockedDiv.className = 'step-locked';

      // Determine document status
      let statusHTML = '';
      if (verification.all_documents_approved) {
        statusHTML = `
          <div class="document-status success">
            <span class="status-icon">✓</span>
            <span class="status-text">Documents Approved</span>
          </div>
        `;
      } else if (verification.passport_approved === false || verification.proof_of_address_approved === false || verification.selfie_approved === false) {
        // Show rejected documents with reasons
        const rejections = [];
        if (verification.passport_approved === false) {
          rejections.push({
            name: 'Passport/ID',
            reason: verification.passport_rejection_reason || 'No reason provided',
            type: 'passport'
          });
        }
        if (verification.proof_of_address_approved === false) {
          rejections.push({
            name: 'Proof of Address',
            reason: verification.proof_of_address_rejection_reason || 'No reason provided',
            type: 'proof_of_address'
          });
        }
        if (verification.selfie_approved === false) {
          rejections.push({
            name: 'Selfie',
            reason: verification.selfie_rejection_reason || 'No reason provided',
            type: 'selfie'
          });
        }

        statusHTML = rejections.map(rej => `
          <div class="document-status error">
            <span class="status-icon">✗</span>
            <span class="status-text">${rej.name} - Rejected</span>
            <p class="rejection-reason">Reason: ${rej.reason}</p>
            <button class="btn-retake" onclick="retakeDocument('${rej.type}')">Retake Image</button>
          </div>
        `).join('');
      } else {
        statusHTML = `
          <div class="document-status pending">
            <span class="status-icon">⏳</span>
            <span class="status-text">Documents Under Review</span>
          </div>
        `;
      }

      lockedDiv.innerHTML = `
        <div class="locked-icon">✓</div>
        <h3>Information Submitted</h3>
        <p>Your personal information and identity documents have been successfully submitted.</p>
        ${statusHTML}
      `;
      stepContent.appendChild(lockedDiv);
    }
  }

  // Lock Step 2 if payment submitted
  if (verification.status === 'payment_submitted' && currentStep > 2) {
    const step2 = document.getElementById('step-2');
    if (!step2.querySelector('.step-locked')) {
      const form = step2.querySelector('form');
      const stepContent = step2.querySelector('.step-content');

      // Hide form and other elements
      if (form) form.style.display = 'none';
      const bankDetails = step2.querySelector('.bank-details');
      const amountBox = step2.querySelector('.escrow-amount-box');
      if (bankDetails) bankDetails.style.display = 'none';
      if (amountBox) amountBox.style.display = 'none';

      // Add locked message
      const lockedDiv = document.createElement('div');
      lockedDiv.className = 'step-locked';
      lockedDiv.innerHTML = `
        <div class="locked-icon">✓</div>
        <h3>Payment Receipt Submitted</h3>
        <p>Your payment receipt has been uploaded and is pending verification.</p>
        <p class="verification-note">We will verify your payment within 24-48 hours and notify you via email.</p>
      `;
      stepContent.appendChild(lockedDiv);
    }
  }
}

// Retake Document Function
function retakeDocument(documentType) {
  // Return to Step 1 to allow resubmission
  currentStep = 1;
  renderStep(1);

  // Scroll to the document upload section
  setTimeout(() => {
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Highlight the rejected document input
    const inputMap = {
      'passport': 'passport-upload',
      'proof_of_address': 'proof_of_address-upload',
      'selfie': 'selfie-upload'
    };

    const inputId = inputMap[documentType];
    if (inputId) {
      const input = document.getElementById(inputId);
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 500);
}

// Update payment status display on Step 2
function updatePaymentStatus() {
  const statusSection = document.getElementById('payment-status-section');
  const escrowForm = document.getElementById('escrow-form');
  const uploadSuccess = document.getElementById('upload-success');

  console.log('[UPDATE_PAYMENT_STATUS] Called with verification:', {
    rejection_reason: verification.rejection_reason,
    rejected_at: verification.rejected_at,
    escrow_status: verification.escrow_status,
    status: verification.status,
    payment_receipt_url: verification.payment_receipt_url
  });

  // Check if payment was rejected (has actual rejection_reason with content)
  if (verification.rejection_reason && verification.rejection_reason.trim()) {
    console.log('[UPDATE_PAYMENT_STATUS] Showing rejection notice');
    // Payment was rejected - show rejection notice with admin's reason only
    const statusHTML = `
      <div class="document-status error" style="margin-bottom: 20px;">
        <span class="status-icon">✕</span>
        <div style="flex: 1;">
          <span class="status-text">Payment Receipt Rejected</span>
          <p style="margin: 5px 0 10px 0; font-size: 14px; color: #721c24;">
            <strong>Reason:</strong> ${verification.rejection_reason}
          </p>
          <p style="margin: 5px 0 0 0; font-size: 14px;">
            Please upload a new payment receipt below addressing the issue mentioned above.
          </p>
        </div>
      </div>
    `;
    statusSection.innerHTML = statusHTML;
    statusSection.style.display = 'block';
    escrowForm.style.display = 'block';
    uploadSuccess.style.display = 'none';
    return;
  }

  // Check if payment receipt has been uploaded
  if (verification.payment_receipt_url) {
    // Payment receipt has been submitted
    const escrowStatus = verification.escrow_status;

    let statusHTML = '';

    if (escrowStatus === 'confirmed') {
      // Payment approved - show persistent success notice with Continue button
      statusHTML = `
        <div class="document-status success" style="margin-bottom: 20px;">
          <span class="status-icon">✓</span>
          <div style="flex: 1;">
            <span class="status-text">Payment Verified!</span>
            <p style="margin: 5px 0 15px 0; font-size: 14px;">Your payment has been verified and approved. You can now proceed to generate your security code.</p>
            <button type="button" class="btn-continue-to-step3" style="background: #28a745; color: white; padding: 10px 30px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              Continue to Step 3
            </button>
          </div>
        </div>
      `;
      statusSection.innerHTML = statusHTML;
      statusSection.style.display = 'block';
      escrowForm.style.display = 'none';
      uploadSuccess.style.display = 'none';

      // Attach click handler for Continue button
      const continueBtn = statusSection.querySelector('.btn-continue-to-step3');
      if (continueBtn) {
        continueBtn.addEventListener('click', () => {
          renderStep(3);
        });
      }
    } else if (verification.status === 'payment_submitted') {
      // Payment pending review
      console.log('[UPDATE_PAYMENT_STATUS] Showing "Under Review" notice');
      statusHTML = `
        <div class="document-status pending" style="margin-bottom: 20px;">
          <span class="status-icon">⏳</span>
          <div style="flex: 1;">
            <span class="status-text">Payment Receipt Under Review</span>
            <p style="margin: 5px 0 0 0; font-size: 14px;">Your payment receipt has been submitted and is currently being verified by our team. You will be notified once the verification is complete.</p>
          </div>
        </div>
      `;
      statusSection.innerHTML = statusHTML;
      statusSection.style.display = 'block';
      escrowForm.style.display = 'none';
      uploadSuccess.style.display = 'none';
    }
  } else {
    // No payment receipt uploaded yet - show form
    statusSection.style.display = 'none';
    escrowForm.style.display = 'block';
    uploadSuccess.style.display = 'none';
  }
}

// ============================================================================
// Event Handlers for Simplified Flow (Payment-focused)
// ============================================================================

// Step 1: Confirm Info Button
const confirmInfoBtn = document.getElementById('confirm-info-btn');
if (confirmInfoBtn) {
  confirmInfoBtn.addEventListener('click', () => {
    renderStep(2);
  });
}

// Step 2: Receipt Upload Handlers
const receiptInput = document.getElementById('receipt-input');
const uploadArea = document.getElementById('upload-area');
const uploadPreview = document.getElementById('upload-preview');
const uploadReceiptBtn = document.getElementById('upload-receipt-btn');
const removeFileBtn2 = document.getElementById('remove-file-btn');

if (uploadArea && receiptInput) {
  uploadArea.addEventListener('click', () => {
    receiptInput.click();
  });

  receiptInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      // Show preview
      const uploadPrompt = uploadArea.querySelector('.upload-prompt');
      if (uploadPrompt) uploadPrompt.style.display = 'none';
      if (uploadPreview) {
        uploadPreview.style.display = 'flex';
        const fileName = uploadPreview.querySelector('#file-name');
        if (fileName) fileName.textContent = file.name;

        // Preview image if it's an image file
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const previewImg = document.getElementById('preview-image');
            if (previewImg) previewImg.src = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      }
      // Enable upload button
      if (uploadReceiptBtn) uploadReceiptBtn.disabled = false;
    }
  });
}

if (removeFileBtn2) {
  removeFileBtn2.addEventListener('click', () => {
    if (receiptInput) receiptInput.value = '';
    const uploadPrompt = uploadArea?.querySelector('.upload-prompt');
    if (uploadPrompt) uploadPrompt.style.display = 'block';
    if (uploadPreview) uploadPreview.style.display = 'none';
    if (uploadReceiptBtn) uploadReceiptBtn.disabled = true;
  });
}

if (uploadReceiptBtn) {
  uploadReceiptBtn.addEventListener('click', async () => {
    const file = receiptInput?.files[0];
    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    try {
      showLoading('Uploading receipt...');
      const result = await VerificationAPI.uploadReceipt(token, file);
      hideLoading();

      // Update verification status
      verification.escrow_status = 'pending';
      verification.payment_receipt_url = result.payment_receipt_url;

      // Show payment status container
      const paymentStatusContainer = document.getElementById('payment-status-container');
      if (paymentStatusContainer) paymentStatusContainer.style.display = 'block';

      // Hide upload section
      const uploadSection = document.getElementById('upload-section');
      if (uploadSection) uploadSection.style.display = 'none';

      // Show pending status
      const paymentPending = document.getElementById('payment-pending');
      if (paymentPending) {
        paymentPending.style.display = 'flex';
        const submittedTime = paymentPending.querySelector('#payment-submitted-time');
        if (submittedTime) submittedTime.textContent = new Date().toLocaleString();
      }

      // Start polling
      startStatusPolling();
    } catch (error) {
      hideLoading();
      alert('Error uploading receipt: ' + error.message);
    }
  });
}

// ============================================================================
// Original Form Handlers (for document upload flow - may not be used)
// ============================================================================

const recipientForm = document.getElementById('recipient-form');
if (recipientForm) {
recipientForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Check if all documents are approved (moving to next step)
  if (verification.all_documents_approved) {
    renderStep(2);
    return;
  }

  // For resubmission - create FormData
  const formData = new FormData();

  // Add text fields ONLY on first submission, not on resubmission
  if (!verification.progress.documents_submitted) {
    formData.append('full_name', document.getElementById('full-name').value);
    formData.append('address', document.getElementById('address').value);
    formData.append('country', document.getElementById('country').value);
    formData.append('phone', document.getElementById('phone').value);
    formData.append('id_type', document.getElementById('id-type').value);
    formData.append('id_number', document.getElementById('id-number').value);
    formData.append('id_country', document.getElementById('id-country').value);
    formData.append('id_expiry_date', document.getElementById('id-expiry-date').value);
  }

  // Get file inputs
  const passportInput = document.getElementById('passport-upload');
  const addressProofInput = document.getElementById('proof_of_address-upload');
  const selfieInput = document.getElementById('selfie-upload');

  const passportFile = passportInput?.files[0];
  const addressProofFile = addressProofInput?.files[0];
  const selfieFile = selfieInput?.files[0];

  // Check which documents need to be uploaded
  const missingDocs = [];

  // On FIRST submission (no documents submitted yet) - require ALL documents
  if (!verification.progress.documents_submitted) {
    if (!passportFile) missingDocs.push('Passport / ID Document');
    if (!addressProofFile) missingDocs.push('Proof of Address');
    if (!selfieFile) missingDocs.push('Selfie with ID');
  } else {
    // On RESUBMISSION - only require REJECTED documents
    if (verification.passport_approved === false && !passportFile) {
      missingDocs.push('Passport / ID Document (rejected)');
    }
    if (verification.proof_of_address_approved === false && !addressProofFile) {
      missingDocs.push('Proof of Address (rejected)');
    }
    if (verification.selfie_approved === false && !selfieFile) {
      missingDocs.push('Selfie with ID (rejected)');
    }
  }

  if (missingDocs.length > 0) {
    alert(`Please upload the following required documents:\n- ${missingDocs.join('\n- ')}`);
    return;
  }

  // Only append files being submitted
  // On first submission: append all files
  // On resubmission: append only rejected files that have new uploads
  if (!verification.progress.documents_submitted) {
    // First submission - add all files
    if (passportFile) formData.append('passport', passportFile);
    if (addressProofFile) formData.append('proof_of_address', addressProofFile);
    if (selfieFile) formData.append('selfie_with_id', selfieFile);
  } else {
    // Resubmission - add only rejected files
    if (verification.passport_approved === false && passportFile) {
      formData.append('passport', passportFile);
    }
    if (verification.proof_of_address_approved === false && addressProofFile) {
      formData.append('proof_of_address', addressProofFile);
    }
    if (verification.selfie_approved === false && selfieFile) {
      formData.append('selfie_with_id', selfieFile);
    }
  }

  try {
    showLoading('Uploading documents...');
    const result = await VerificationAPI.submitInfoWithFiles(token, formData);

    // Update verification state
    verification.progress.documents_submitted = true;
    verification.status = 'documents_submitted';

    hideLoading();
    showNotification('Documents submitted successfully! Our team is reviewing your information.', 'success');

    // Reload verification data to get updated statuses
    verification = await VerificationAPI.getVerification(token);

    // Update UI immediately
    updateDocumentStatuses();

    // Start polling for status updates
    startStatusPolling();
  } catch (error) {
    hideLoading();
    alert('Error: ' + error.message);
  }
});
}

// Note: File previews for Step 1 documents are now handled dynamically by updateDocumentStatuses()

// File Upload Preview for Step 2
const paymentReceiptInput = document.getElementById('payment-receipt');
if (paymentReceiptInput) {
paymentReceiptInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-preview').style.display = 'flex';
  }
});
}

const removeFileBtn = document.getElementById('remove-file');
if (removeFileBtn) {
removeFileBtn.addEventListener('click', () => {
  document.getElementById('payment-receipt').value = '';
  document.getElementById('file-preview').style.display = 'none';
});
}

const escrowForm = document.getElementById('escrow-form');
if (escrowForm) {
escrowForm.addEventListener('submit', async (e) => {
  console.log('[ESCROW] Form submit event triggered');
  e.preventDefault();
  console.log('[ESCROW] Default form submission prevented');

  const fileInput = document.getElementById('payment-receipt');
  const file = fileInput.files[0];
  console.log('[ESCROW] File selected:', file ? file.name : 'No file');

  if (!file) {
    alert('Please select a payment receipt to upload');
    return;
  }

  try {
    console.log('[ESCROW] Starting upload to:', `${API_BASE}/verification/${token}/upload-receipt`);
    showLoading('Uploading payment receipt...');
    const result = await VerificationAPI.uploadReceipt(token, file);
    console.log('[ESCROW] Upload successful:', result);
    hideLoading();

    // Hide the form and show success message
    document.getElementById('escrow-form').style.display = 'none';
    document.getElementById('upload-success').style.display = 'block';

    // Update verification state
    verification.progress.escrow_confirmed = false; // Still pending admin verification
    verification.status = 'payment_submitted';
    verification.payment_receipt_url = result.payment_receipt_url || 'uploaded';

    console.log('[ESCROW] Before clearing rejection - rejection_reason:', verification.rejection_reason);

    // Set flag to prevent polling from overwriting our cleared state
    justUploadedReceipt = true;
    console.log('[ESCROW] Set justUploadedReceipt flag to prevent polling overwrite');

    // Clear any previous rejection (new upload clears rejection status)
    verification.rejection_reason = null;
    verification.rejected_at = null;
    verification.escrow_status = 'pending_verification'; // Backend sets this on upload

    console.log('[ESCROW] After clearing rejection - rejection_reason:', verification.rejection_reason);
    console.log('[ESCROW] Verification status updated to payment_submitted');

    // Update status display immediately to show "Under Review" (clears rejection notice)
    updatePaymentStatus();

    // Restart polling to check for admin approval/rejection
    startStatusPolling();
  } catch (error) {
    console.error('[ESCROW] Upload failed:', error);
    hideLoading();
    alert('Error: ' + error.message);
  }
});
}

const generateCodeBtn = document.getElementById('generate-code-btn');
if (generateCodeBtn) {
generateCodeBtn.addEventListener('click', async () => {
  try {
    // Hide button, show animation
    document.getElementById('generate-button-container').style.display = 'none';
    document.getElementById('generating-animation').style.display = 'block';

    // Wait for psychological effect (2.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Actually "generate" (reveal) the code
    const result = await VerificationAPI.generateCode(token);
    verification.security_code = result.security_code;
    verification.security_code_revealed = true;

    // Move to step 4
    renderStep(4);
  } catch (error) {
    document.getElementById('generating-animation').style.display = 'none';
    document.getElementById('generate-button-container').style.display = 'block';
    alert('Error: ' + error.message);
  }
});
}

// Copy Code Button
const copyCodeBtn = document.getElementById('copy-code-btn');
if (copyCodeBtn) {
copyCodeBtn.addEventListener('click', () => {
  const code = document.getElementById('security-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-code-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="btn-icon">✓</span> Copied!';
    btn.style.backgroundColor = '#28a745';

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.backgroundColor = '';
    }, 3000);
  }).catch(() => {
    alert('Failed to copy code. Please copy it manually.');
  });
});
}

// Email Code Button
const emailCodeBtn = document.getElementById('email-code-btn');
if (emailCodeBtn) {
emailCodeBtn.addEventListener('click', () => {
  const code = document.getElementById('security-code').textContent;
  const trackingId = verification.tracking_id;
  const recipientEmail = verification.recipient_email;

  const subject = `IOOPS Security Release Code - ${trackingId}`;
  const body = `Your IOOPS Security Release Code

Tracking ID: ${trackingId}
Security Code: ${code}

Please use this code on the Meridian tracking portal (https://meridian-net.org) to release your shipment.

IMPORTANT: Keep this code secure. Do not share it with anyone except on the official Meridian portal.

---
IOOPS European Regional Office
Verification Services`;

  const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  window.location.href = mailtoLink;

  const btn = document.getElementById('email-code-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">✓</span> Email Opened';
  btn.style.backgroundColor = '#28a745';

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.backgroundColor = '';
  }, 3000);
});
}

// Download Code Button
const downloadCodeBtn = document.getElementById('download-code-btn');
if (downloadCodeBtn) {
downloadCodeBtn.addEventListener('click', () => {
  const code = document.getElementById('security-code').textContent;
  const trackingId = verification.tracking_id;
  const recipientEmail = verification.recipient_email;

  const content = `IOOPS SECURITY RELEASE CODE
================================

Tracking ID: ${trackingId}
Recipient: ${recipientEmail}
Security Code: ${code}

Generated: ${new Date().toLocaleString()}

INSTRUCTIONS:
1. Visit the Meridian tracking portal at https://meridian-net.org
2. Enter your tracking ID: ${trackingId}
3. Enter your security code: ${code}
4. Your shipment will be released for final delivery

IMPORTANT SECURITY NOTICE:
- Keep this code secure and confidential
- Do not share this code with anyone except on the official Meridian portal
- This code is unique to your shipment and cannot be regenerated

For assistance, contact IOOPS European Regional Office
Verification Services

---
Document Reference: ${token.substring(0, 16)}...
`;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IOOPS-Security-Code-${trackingId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const btn = document.getElementById('download-code-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">✓</span> Downloaded';
  btn.style.backgroundColor = '#28a745';

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.backgroundColor = '';
  }, 3000);
});
}

// Download Receipt Button (Step 5 - Completion) - PDF Version
document.addEventListener('DOMContentLoaded', () => {
  const downloadReceiptBtn = document.getElementById('download-receipt-btn');
  if (downloadReceiptBtn) {
    downloadReceiptBtn.addEventListener('click', () => {
      downloadPDFReceipt();
    });
  }
});

async function downloadPDFReceipt() {
  if (!verification || verification.status !== 'completed') {
    alert('Verification not completed yet');
    return;
  }

  const btn = document.getElementById('download-receipt-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Generating PDF...';
  btn.disabled = true;

  try {
    // Fetch PDF from backend
    const response = await fetch(`${API_BASE}/verification/${token}/receipt.pdf`);

    if (!response.ok) {
      throw new Error('Failed to generate receipt');
    }

    // Get PDF blob
    const blob = await response.blob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IOOPS-Receipt-${verification.tracking_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show success state
    btn.innerHTML = '<span class="btn-icon">✓</span> Downloaded!';
    btn.style.backgroundColor = '#28a745';

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.backgroundColor = '';
      btn.disabled = false;
    }, 3000);

  } catch (error) {
    console.error('Error downloading PDF receipt:', error);
    btn.innerHTML = '<span class="btn-icon">❌</span> Download Failed';
    btn.style.backgroundColor = '#dc3545';

    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.backgroundColor = '';
      btn.disabled = false;
    }, 3000);
  }
}

// Legacy text-based receipt function (kept for fallback)
function generateVerificationReceipt() {
  if (!verification || verification.status !== 'completed') {
    alert('Verification not completed yet');
    return;
  }

  const escrowReturnDays = 7 /* 7 business days after delivery completion */;
  const returnDate = new Date(verification.code_used_at);
  returnDate.setDate(returnDate.getDate() + escrowReturnDays);

  const content = `
===============================================================================
                    IOOPS VERIFICATION RECEIPT
        International Oversight Organization for Parcel Security
                   European Regional Office
===============================================================================

VERIFICATION COMPLETION CERTIFICATE

This document certifies that the recipient verification process has been
successfully completed and the shipment has been released for final delivery.

-------------------------------------------------------------------------------
VERIFICATION DETAILS
-------------------------------------------------------------------------------

Tracking ID:              ${verification.tracking_id}
Recipient Name:           ${verification.recipient_full_name || 'N/A'}
Recipient Email:          ${verification.recipient_email}
Verification Token:       ${token}

Completion Date:          ${new Date(verification.code_used_at).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })}

Status:                   COMPLETED - Released for Delivery

-------------------------------------------------------------------------------
ESCROW DEPOSIT INFORMATION
-------------------------------------------------------------------------------

Escrow Amount:            EUR €${parseFloat(verification.escrow_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Payment Verified:         ${verification.escrow_confirmed_at ? new Date(verification.escrow_confirmed_at).toLocaleDateString() : 'Yes'}
Return Period:            ${escrowReturnDays} business days from completion
Expected Return Date:     ${returnDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

The escrow deposit will be automatically returned to the account used for the
initial payment. You will receive email confirmation once the transfer has been
processed.

-------------------------------------------------------------------------------
VERIFICATION PROCESS SUMMARY
-------------------------------------------------------------------------------

✓ Step 1: Identity documents submitted and approved
✓ Step 2: Escrow deposit received and verified
✓ Step 3: Security release code generated
✓ Step 4: Security code verified on Meridian tracking portal
✓ Step 5: Shipment released for final delivery

-------------------------------------------------------------------------------
SHIPMENT STATUS
-------------------------------------------------------------------------------

Current Status:           Released for Delivery
Security Hold:            CLEARED
Authorization:            VERIFIED

You will continue to receive tracking updates via email as your shipment
progresses to final delivery. The carrier will contact you to schedule
the delivery appointment.

-------------------------------------------------------------------------------
IMPORTANT INFORMATION
-------------------------------------------------------------------------------

• This receipt serves as official documentation of your completed verification
• Keep this receipt for your records
• The escrow deposit return is automated and requires no action from you
• For questions regarding your shipment, use your tracking ID: ${verification.tracking_id}

-------------------------------------------------------------------------------
CONTACT INFORMATION
-------------------------------------------------------------------------------

IOOPS European Regional Office
Verification Services Division

Email:    verification@ioops.org
Support:  compliance@ioops.org
Web:      https://ioops.org/verification

-------------------------------------------------------------------------------

Document Generated:       ${new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })}
Reference Number:         ${verification.tracking_id}-VER-${new Date(verification.code_used_at).getTime()}

===============================================================================
              This is an official IOOPS verification document
===============================================================================
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IOOPS-Verification-Receipt-${verification.tracking_id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const btn = document.getElementById('download-receipt-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">✓</span> Downloaded';
  btn.style.backgroundColor = '#28a745';

  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.backgroundColor = '';
  }, 3000);
}

// Loading State
function showLoading(message) {
  const loadingMessage = document.getElementById('loading-message');
  const loadingState = document.getElementById('loading-state');
  const mainContent = document.getElementById('main-content');

  if (!loadingMessage || !loadingState || !mainContent) {
    console.error('[LOADING] Required elements not found:', {
      loadingMessage: !!loadingMessage,
      loadingState: !!loadingState,
      mainContent: !!mainContent
    });
    return;
  }

  loadingMessage.textContent = message;
  loadingState.style.display = 'block';
  mainContent.style.display = 'none';
}

function hideLoading() {
  const loadingState = document.getElementById('loading-state');
  const mainContent = document.getElementById('main-content');

  if (loadingState) {
    loadingState.style.display = 'none';
    // Remove from DOM to prevent accessibility issues
    if (loadingState.parentNode) {
      loadingState.parentNode.removeChild(loadingState);
    }
  }

  if (mainContent) {
    mainContent.style.display = 'block';
    mainContent.style.opacity = '1';
  }
}

// Error State
function showError(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-state').style.display = 'block';
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
}

// Setup WebSocket connection for real-time updates
function setupWebSocket() {
  // Check if Socket.IO is available
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client not loaded. Real-time updates will not work. Falling back to polling.');
    return;
  }

  socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('[User] WebSocket connected');
    // Join verification-specific room using token
    socket.emit('join_verification', token);
  });

  socket.on('disconnect', () => {
    console.log('[User] WebSocket disconnected');
  });

  // Listen for document approved events
  socket.on('document_approved', async (data) => {
    console.log('[User] Document approved:', data);

    // IMMEDIATELY UPDATE VERIFICATION OBJECT
    if (data.documentType === 'passport') {
      verification.passport_approved = true;
    } else if (data.documentType === 'proof_of_address') {
      verification.proof_of_address_approved = true;
    } else if (data.documentType === 'selfie') {
      verification.selfie_approved = true;
    }

    if (data.allDocumentsApproved) {
      verification.all_documents_approved = true;
      verification.status = 'documents_approved';
    }

    // UPDATE UI IMMEDIATELY without waiting for API call
    updateDocumentStatuses();

    // Show notification
    const docNames = {
      'passport': 'Passport / ID Document',
      'proof_of_address': 'Proof of Address',
      'selfie': 'Selfie with ID'
    };
    showNotification(`${docNames[data.documentType]} approved!`, 'success');

    if (data.allDocumentsApproved) {
      showNotification('All documents approved! You can now proceed to Step 2.', 'success');

      // Automatically transition to Step 2
      setTimeout(() => {
        currentStep = 2;
        renderStep(2);
      }, 2000); // 2 second delay to show the notification
    }
  });

  // Listen for document rejected events
  socket.on('document_rejected', async (data) => {
    console.log('[User] Document rejected:', data);

    // IMMEDIATELY UPDATE VERIFICATION OBJECT
    if (data.documentType === 'passport') {
      verification.passport_approved = false;
      verification.passport_rejection_reason = data.reason;
    } else if (data.documentType === 'proof_of_address') {
      verification.proof_of_address_approved = false;
      verification.proof_of_address_rejection_reason = data.reason;
    } else if (data.documentType === 'selfie') {
      verification.selfie_approved = false;
      verification.selfie_rejection_reason = data.reason;
    }

    // UPDATE UI IMMEDIATELY without waiting for API call
    updateDocumentStatuses();

    // Show notification with rejection reason
    const docNames = {
      'passport': 'Passport / ID Document',
      'proof_of_address': 'Proof of Address',
      'selfie': 'Selfie with ID'
    };
    showNotification(
      `${docNames[data.documentType]} was rejected.\nReason: ${data.reason}\n\nPlease resubmit your document.`,
      'error'
    );

    // Enable resubmission by staying on Step 1
    currentStep = 1;
    renderStep(1);
  });

  // Listen for payment approved events
  socket.on('payment_approved', async (data) => {
    console.log('[User] Payment approved:', data);

    // Update verification object
    verification.escrow_status = 'confirmed';
    verification.status = 'escrow_confirmed';
    verification.progress.escrow_confirmed = true;

    // Show notification
    showNotification('Payment verified! You can now generate your security code.', 'success');

    // Automatically transition to Step 3 after delay
    setTimeout(() => {
      currentStep = 3;
      renderStep(3);
    }, 2000);
  });

  // Listen for payment rejected events
  socket.on('payment_rejected', async (data) => {
    console.log('[User] Payment rejected:', data);

    // Update verification object
    verification.escrow_status = 'pending';
    verification.status = 'documents_approved';
    verification.payment_receipt_url = null;

    // Show notification with rejection reason
    showNotification(
      `Payment receipt rejected.\nReason: ${data.reason}\n\nPlease upload a new receipt.`,
      'error'
    );

    // Return to Step 2, hide success message, show form
    currentStep = 2;
    renderStep(2);
    document.getElementById('escrow-form').style.display = 'block';
    document.getElementById('upload-success').style.display = 'none';
  });

  socket.on('connect_error', (error) => {
    console.error('[User] WebSocket connection error:', error);
  });
}

// ============================================================================
// CAMERA CAPTURE INTEGRATION
// ============================================================================

// Camera state
let cameraModule = null;
let currentCaptureType = null; // 'passport', 'proof_of_address', or 'selfie'
let capturedBlobs = {}; // Store captured images by type

/**
 * Initialize document upload fields with camera capture buttons
 * Called by updateDocumentStatuses() when rendering upload fields
 */
function initializeCameraCapture() {
  const documentTypes = [
    { type: 'passport', label: 'Passport / ID Document (Photo Page)', facingMode: 'environment' },
    { type: 'proof_of_address', label: 'Proof of Address', facingMode: 'environment' },
    { type: 'selfie', label: 'Identity Verification Photo', facingMode: 'user' }
  ];

  documentTypes.forEach(docType => {
    const fieldContainer = document.querySelector(`[data-document-type="${docType.type}"]`);
    if (!fieldContainer) return;

    // Find file input within this container
    const fileInput = fieldContainer.querySelector(`input[type="file"]`);
    if (!fileInput) return;

    // Check if camera button already exists
    if (fieldContainer.querySelector('.camera-capture-btn')) return;

    // Add camera capture button only if camera is supported
    if (CameraCapture.isSupported()) {
      const cameraBtn = document.createElement('button');
      cameraBtn.type = 'button';
      cameraBtn.className = 'camera-capture-btn';
      cameraBtn.innerHTML = 'Capture with Camera';
      cameraBtn.onclick = () => openCamera(docType.type, docType.facingMode);

      // Insert camera button after the file input label
      const inputLabel = fileInput.parentElement;
      if (inputLabel && inputLabel.classList.contains('file-input-label')) {
        inputLabel.parentElement.appendChild(cameraBtn);
      }
    }
  });
}

/**
 * Open camera interface for specific document type
 */
async function openCamera(documentType, facingMode = 'environment') {
  currentCaptureType = documentType;

  // Show camera interface
  const cameraInterface = document.getElementById('camera-interface');
  cameraInterface.style.display = 'block';

  // Hide document fields temporarily
  document.querySelectorAll('[data-document-type]').forEach(el => {
    el.style.display = 'none';
  });

  // Set instruction text based on document type
  const instructions = {
    'passport': {
      title: 'Capture Identity Document',
      text: 'Position the photo page of your passport or ID card within the frame. Ensure all text is legible and the image is not blurred.',
      guide: 'document-guide'
    },
    'proof_of_address': {
      title: 'Capture Proof of Address',
      text: 'Capture your utility bill, bank statement, or official document clearly. The document must be dated within the last 3 months.',
      guide: 'document-guide'
    },
    'selfie': {
      title: 'Identity Verification Photo',
      text: 'Position your face within the circle. Hold your identity document next to your face so both are clearly visible.',
      guide: 'face-guide'
    }
  };

  const instruction = instructions[documentType] || instructions['passport'];
  document.getElementById('camera-instruction-title').textContent = instruction.title;
  document.getElementById('camera-instruction-text').textContent = instruction.text;

  // Show appropriate guide overlay
  document.getElementById('document-guide').style.display = 'none';
  document.getElementById('face-guide').style.display = 'none';
  document.getElementById(instruction.guide).style.display = 'flex';

  // Show switch camera button only on mobile
  const switchBtn = document.getElementById('switch-camera-btn');
  if (window.innerWidth <= 768) {
    switchBtn.style.display = 'inline-block';
  }

  try {
    // Initialize camera module
    cameraModule = new CameraCapture();
    await cameraModule.initializeCamera(facingMode);

    // Start preview
    const videoElement = document.getElementById('camera-preview');
    cameraModule.startPreview(videoElement);

  } catch (error) {
    console.error('Camera initialization error:', error);
    alert(error.message);
    closeCamera();
  }
}

/**
 * Manually capture current frame
 */
async function manualCapture() {
  if (!cameraModule) return;

  try {
    // Show capturing indicator
    document.getElementById('capturing-indicator').style.display = 'flex';

    // Capture frame
    const canvas = document.getElementById('camera-canvas');
    const blob = await cameraModule.captureFrame(canvas);

    // Hide capturing indicator
    document.getElementById('capturing-indicator').style.display = 'none';

    // Show preview
    showCapturePreview(blob);

  } catch (error) {
    console.error('Capture error:', error);
    document.getElementById('capturing-indicator').style.display = 'none';
    alert('Failed to capture image. Please try again.');
  }
}

/**
 * Show captured image preview with confirm/retake options
 */
function showCapturePreview(blob) {
  // Hide video preview
  document.getElementById('camera-preview').style.display = 'none';
  document.querySelector('.camera-controls').style.display = 'none';
  document.querySelectorAll('.capture-overlay').forEach(el => el.style.display = 'none');

  // Show preview
  const previewContainer = document.getElementById('capture-preview');
  const imgElement = document.getElementById('captured-image');
  imgElement.src = URL.createObjectURL(blob);
  previewContainer.style.display = 'block';

  // Store blob temporarily
  capturedBlobs[currentCaptureType] = blob;
}

/**
 * Retake photo
 */
function retakePhoto() {
  // Hide preview
  document.getElementById('capture-preview').style.display = 'none';

  // Show video preview again
  document.getElementById('camera-preview').style.display = 'block';
  document.querySelector('.camera-controls').style.display = 'flex';

  // Show appropriate guide overlay
  const guideId = currentCaptureType === 'selfie' ? 'face-guide' : 'document-guide';
  document.getElementById(guideId).style.display = 'flex';

  // Clear temporary blob
  delete capturedBlobs[currentCaptureType];
}

/**
 * Confirm captured image and close camera
 */
function confirmCapture() {
  const blob = capturedBlobs[currentCaptureType];
  if (!blob) return;

  // Create a File object from the blob
  const fileName = `${currentCaptureType}-${Date.now()}.jpg`;
  const file = new File([blob], fileName, { type: 'image/jpeg' });

  // Get the file input for this document type
  const fileInput = document.querySelector(`input[name="${currentCaptureType}"]`);
  if (fileInput) {
    // Create a DataTransfer to set the file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Trigger change event so existing validation works
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Close camera
  closeCamera();

  // Show success message
  showNotification(`${currentCaptureType.replace('_', ' ')} captured successfully`, 'success');
}

/**
 * Close camera and cleanup
 */
function closeCamera() {
  // Stop camera
  if (cameraModule) {
    cameraModule.stopCamera();
    cameraModule = null;
  }

  // Hide camera interface
  document.getElementById('camera-interface').style.display = 'none';
  document.getElementById('capture-preview').style.display = 'none';
  document.getElementById('camera-preview').style.display = 'block';
  document.querySelector('.camera-controls').style.display = 'flex';

  // Show document fields again
  document.querySelectorAll('[data-document-type]').forEach(el => {
    el.style.display = 'block';
  });

  currentCaptureType = null;
}

/**
 * Switch between front and back cameras (mobile)
 */
async function switchCamera() {
  if (!cameraModule) return;

  try {
    await cameraModule.switchCamera();
  } catch (error) {
    console.error('Camera switch error:', error);
    alert('Failed to switch camera. Please try again.');
  }
}

// Camera UI Event Listeners
const manualCaptureBtn = document.getElementById('manual-capture-btn');
if (manualCaptureBtn) manualCaptureBtn.addEventListener('click', manualCapture);

const cancelCameraBtn = document.getElementById('cancel-camera-btn');
if (cancelCameraBtn) cancelCameraBtn.addEventListener('click', closeCamera);

const retakeBtn = document.getElementById('retake-btn');
if (retakeBtn) retakeBtn.addEventListener('click', retakePhoto);

const confirmCaptureBtn = document.getElementById('confirm-capture-btn');
if (confirmCaptureBtn) confirmCaptureBtn.addEventListener('click', confirmCapture);

const switchCameraBtn = document.getElementById('switch-camera-btn');
if (switchCameraBtn) switchCameraBtn.addEventListener('click', switchCamera);

// Hook into existing document status update to add camera buttons
const originalUpdateDocumentStatuses = updateDocumentStatuses;
updateDocumentStatuses = function() {
  originalUpdateDocumentStatuses.call(this);
  // Add camera capture buttons after document fields are rendered
  setTimeout(initializeCameraCapture, 100);
};

// ============================================================================
// END CAMERA CAPTURE INTEGRATION
// ============================================================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializePortal);
