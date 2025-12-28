/**
 * IOOPS Verification Flow - State Machine Implementation
 *
 * Transforms verification from a "form submission" into a "procedural workflow"
 *
 * Key Principles:
 * - Linear, gated progression (no back navigation)
 * - One screen visible at a time
 * - Validation prevents forward movement, not shame
 * - Institutional language and tone
 * - Camera-first capture (no file uploads)
 */

// Environment detection for API base URL
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/ioops'
  : 'https://meridian-tracking.fly.dev/api/ioops';

class VerificationFlow {
  constructor(token) {
    this.token = token;
    this.state = 'VERIFICATION_ENTRY';
    this.data = {};
    this.images = {};
    this.camera = null;

    // Load any saved data from session
    this.loadSessionData();

    // Initialize content first (hidden)
    this.render();

    // Delay showing content to ensure DOM is settled
    this.delayedReveal();
  }

  /**
   * Delayed reveal to prevent layout shift
   * Waits for DOM to settle before showing content
   */
  delayedReveal() {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Add a small delay to ensure all elements are properly positioned
        setTimeout(() => {
          this.showMainContent();
        }, 100);
      });
    });
  }

  /**
   * Show main content and hide loading state
   */
  showMainContent() {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const mainContent = document.getElementById('main-content');

    // Hide and remove loading state
    if (loadingState) {
      loadingState.style.opacity = '0';
      loadingState.style.transition = 'opacity 200ms ease-out';
      setTimeout(() => {
        loadingState.style.display = 'none';
        // Remove from DOM completely to avoid orphaned elements
        if (loadingState.parentNode) {
          loadingState.parentNode.removeChild(loadingState);
        }
      }, 200);
    }

    // Hide error state (keep in DOM for potential use)
    if (errorState) {
      errorState.style.display = 'none';
    }

    if (mainContent) {
      mainContent.style.display = 'block';
      mainContent.style.opacity = '0';
      // Force reflow
      mainContent.offsetHeight;
      mainContent.style.transition = 'opacity 300ms ease-in';
      requestAnimationFrame(() => {
        mainContent.style.opacity = '1';
      });
    }
  }

  /**
   * Valid state transitions (enforces linear progression)
   */
  getValidTransitions() {
    return {
      'VERIFICATION_ENTRY': ['STEP_1_1_PERSONAL_INFO'],
      'STEP_1_1_PERSONAL_INFO': ['STEP_1_2_DOCUMENT_DECLARATION'],
      'STEP_1_2_DOCUMENT_DECLARATION': ['STEP_1_3_CAPTURE_BRIEFING'],
      'STEP_1_3_CAPTURE_BRIEFING': ['STEP_1_3_CAPTURE_DOCUMENT'],
      'STEP_1_3_CAPTURE_DOCUMENT': ['STEP_1_3_REVIEW_DOCUMENT'],
      'STEP_1_3_REVIEW_DOCUMENT': ['STEP_1_3_CAPTURE_FACE', 'STEP_1_3_CAPTURE_DOCUMENT'], // Can retake
      'STEP_1_3_CAPTURE_FACE': ['STEP_1_3_REVIEW_FACE'],
      'STEP_1_3_REVIEW_FACE': ['STEP_1_SUBMITTING', 'STEP_1_3_CAPTURE_FACE'], // Can retake
      'STEP_1_SUBMITTING': ['STEP_1_COMPLETE', 'STEP_1_SUBMISSION_ERROR'], // Can fail
      'STEP_1_SUBMISSION_ERROR': ['STEP_1_3_REVIEW_FACE'], // Can retry from error
      'STEP_1_COMPLETE': ['STEP_2_ESCROW']
    };
  }

  /**
   * Transition to new state (with validation)
   */
  transitionTo(newState) {
    const validTransitions = this.getValidTransitions();

    if (validTransitions[this.state]?.includes(newState)) {
      console.log(`State transition: ${this.state} → ${newState}`);
      this.state = newState;
      this.saveSessionData();
      this.render();
    } else {
      console.error(`Invalid transition from ${this.state} to ${newState}`);
    }
  }

  /**
   * Load session data from sessionStorage
   */
  loadSessionData() {
    try {
      const saved = sessionStorage.getItem('ioops_verification_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = parsed.data || {};
        this.state = parsed.state || 'VERIFICATION_ENTRY';
      }
    } catch (error) {
      console.error('Error loading session data:', error);
    }
  }

  /**
   * Save session data to sessionStorage
   */
  saveSessionData() {
    try {
      sessionStorage.setItem('ioops_verification_data', JSON.stringify({
        data: this.data,
        state: this.state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  }

  /**
   * Main render function - displays current state
   */
  render() {
    const container = document.getElementById('main-content');
    if (!container) {
      console.error('Container #main-content not found');
      return;
    }

    // Clear container
    container.innerHTML = '';

    // Render based on current state
    switch (this.state) {
      case 'VERIFICATION_ENTRY':
        this.renderEntry(container);
        break;
      case 'STEP_1_1_PERSONAL_INFO':
        this.renderStep1_1(container);
        break;
      case 'STEP_1_2_DOCUMENT_DECLARATION':
        this.renderStep1_2(container);
        break;
      case 'STEP_1_3_CAPTURE_BRIEFING':
        this.renderStep1_3_Briefing(container);
        break;
      case 'STEP_1_3_CAPTURE_DOCUMENT':
        this.renderCaptureDocument(container);
        break;
      case 'STEP_1_3_REVIEW_DOCUMENT':
        this.renderReviewDocument(container);
        break;
      case 'STEP_1_3_CAPTURE_FACE':
        this.renderCaptureFace(container);
        break;
      case 'STEP_1_3_REVIEW_FACE':
        this.renderReviewFace(container);
        break;
      case 'STEP_1_SUBMITTING':
        this.renderSubmitting(container);
        break;
      case 'STEP_1_SUBMISSION_ERROR':
        this.renderSubmissionError(container);
        break;
      case 'STEP_1_COMPLETE':
        this.renderStep1Complete(container);
        break;
      default:
        container.innerHTML = `<div class="error-state"><p>Invalid state: ${this.state}</p></div>`;
    }
  }

  /**
   * VERIFICATION_ENTRY - Initial priming screen
   */
  renderEntry(container) {
    container.innerHTML = `
      <div class="verification-screen entry-screen">
        <div class="entry-content">
          <h2>Recipient Identity Verification</h2>

          <p class="entry-description">
            This verification process is required for compliance with international transfer regulations.
          </p>

          <div class="process-overview">
            <h3>This process involves three steps:</h3>
            <ol class="process-steps">
              <li>Your identity declaration</li>
              <li>Escrow deposit confirmation</li>
              <li>Security code generation</li>
            </ol>
          </div>

          <div class="requirements">
            <p><strong>Estimated time:</strong> 8–12 minutes</p>
            <p><strong>What will be required:</strong></p>
            <ul class="requirements-list">
              <li>Valid identity document (passport, national ID, or driver's license)</li>
              <li>Device with camera (for document capture)</li>
              <li>Bank transfer confirmation (for escrow step)</li>
            </ul>
          </div>

          <button type="button" id="btn-begin-verification" class="btn-primary btn-large">
            BEGIN VERIFICATION
          </button>
        </div>
      </div>
    `;

    // Attach event listener
    document.getElementById('btn-begin-verification').addEventListener('click', () => {
      this.transitionTo('STEP_1_1_PERSONAL_INFO');
    });
  }

  /**
   * STEP_1_1_PERSONAL_INFO - Personal declaration
   */
  renderStep1_1(container) {
    const data = this.data;

    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Step 1.1: Who You Are</h4>

          <form id="form-step-1-1" class="verification-form">
            <div class="form-group">
              <label for="full-name">Full Legal Name *</label>
              <input
                type="text"
                id="full-name"
                name="fullName"
                value="${data.fullName || ''}"
                required
                autocomplete="name"
                placeholder="As shown on identity document"
              />
              <span class="field-error" id="error-full-name" style="display: none;"></span>
            </div>

            <div class="form-group">
              <label for="dob">Date of Birth *</label>
              <input
                type="date"
                id="dob"
                name="dateOfBirth"
                value="${data.dateOfBirth || ''}"
                required
                autocomplete="bday"
              />
              <span class="field-error" id="error-dob" style="display: none;"></span>
            </div>

            <div class="form-group">
              <label for="nationality">Nationality *</label>
              <select id="nationality" name="nationality" required>
                <option value="">-- Select Country --</option>
                ${this.getCountryOptions(data.nationality)}
              </select>
              <span class="field-error" id="error-nationality" style="display: none;"></span>
            </div>

            <div class="form-group">
              <label for="address">Current Residential Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                value="${data.address || ''}"
                required
                autocomplete="street-address"
                placeholder="Street address, city, postal code"
              />
              <span class="field-error" id="error-address" style="display: none;"></span>
            </div>

            <div class="form-group">
              <label for="phone">Phone Number (Optional)</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value="${data.phone || ''}"
                autocomplete="tel"
                placeholder="+... (international format)"
              />
            </div>

            <div class="form-actions">
              <button type="button" id="btn-continue-1-1" class="btn-primary" disabled>
                CONTINUE
              </button>
            </div>

            <p class="form-note">
              Note: You can review or modify this information in the next step.
            </p>
          </form>
        </div>
      </div>
    `;

    // Attach validation and event handlers
    this.attachStep1_1Handlers();
  }

  /**
   * Attach handlers for Step 1.1
   */
  attachStep1_1Handlers() {
    const form = document.getElementById('form-step-1-1');
    const btn = document.getElementById('btn-continue-1-1');

    const validateForm = () => {
      const fullName = document.getElementById('full-name').value.trim();
      const dob = document.getElementById('dob').value;
      const nationality = document.getElementById('nationality').value;
      const address = document.getElementById('address').value.trim();

      // Error message elements
      const errorFullName = document.getElementById('error-full-name');
      const errorDob = document.getElementById('error-dob');
      const errorNationality = document.getElementById('error-nationality');
      const errorAddress = document.getElementById('error-address');

      // Validate Full Name
      let fullNameValid = true;
      if (fullName.length === 0) {
        errorFullName.textContent = 'Full name is required';
        errorFullName.style.display = 'block';
        fullNameValid = false;
      } else if (fullName.length < 2) {
        errorFullName.textContent = 'Full name must be at least 2 characters';
        errorFullName.style.display = 'block';
        fullNameValid = false;
      } else {
        errorFullName.style.display = 'none';
      }

      // Validate Date of Birth
      let dobValid = true;
      if (!dob) {
        errorDob.textContent = 'Date of birth is required';
        errorDob.style.display = 'block';
        dobValid = false;
      } else if (!this.isOver18(dob)) {
        errorDob.textContent = 'You must be 18 or older to proceed';
        errorDob.style.display = 'block';
        dobValid = false;
      } else {
        errorDob.style.display = 'none';
      }

      // Validate Nationality
      let nationalityValid = true;
      if (!nationality) {
        errorNationality.textContent = 'Please select your nationality';
        errorNationality.style.display = 'block';
        nationalityValid = false;
      } else {
        errorNationality.style.display = 'none';
      }

      // Validate Address
      let addressValid = true;
      if (address.length === 0) {
        errorAddress.textContent = 'Address is required';
        errorAddress.style.display = 'block';
        addressValid = false;
      } else if (address.length < 5) {
        errorAddress.textContent = 'Address must be at least 5 characters';
        errorAddress.style.display = 'block';
        addressValid = false;
      } else {
        errorAddress.style.display = 'none';
      }

      const valid = fullNameValid && dobValid && nationalityValid && addressValid;
      btn.disabled = !valid;
    };

    // Attach listeners to all form fields
    form.querySelectorAll('input, select').forEach(field => {
      field.addEventListener('change', validateForm);
      field.addEventListener('keyup', validateForm);
    });

    // Continue button handler
    btn.addEventListener('click', () => {
      this.data = {
        ...this.data,
        fullName: document.getElementById('full-name').value.trim(),
        dateOfBirth: document.getElementById('dob').value,
        nationality: document.getElementById('nationality').value,
        address: document.getElementById('address').value.trim(),
        phone: document.getElementById('phone').value.trim()
      };
      this.saveSessionData();
      this.transitionTo('STEP_1_2_DOCUMENT_DECLARATION');
    });

    // Initial validation
    validateForm();
  }

  /**
   * STEP_1_2_DOCUMENT_DECLARATION - Document details
   */
  renderStep1_2(container) {
    const data = this.data;

    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Step 1.2: Identity Document</h4>

          <form id="form-step-1-2" class="verification-form">
            <div class="form-group">
              <label for="document-type">Document Type *</label>
              <select id="document-type" name="documentType" required>
                <option value="">-- Select Type --</option>
                <option value="passport" ${data.documentType === 'passport' ? 'selected' : ''}>Passport</option>
                <option value="national_id" ${data.documentType === 'national_id' ? 'selected' : ''}>National ID Card</option>
                <option value="drivers_license" ${data.documentType === 'drivers_license' ? 'selected' : ''}>Driver's License</option>
              </select>
            </div>

            <div class="form-group">
              <label for="issuing-country">Issuing Country *</label>
              <select id="issuing-country" name="issuingCountry" required>
                <option value="">-- Select Country --</option>
                ${this.getCountryOptions(data.issuingCountry)}
              </select>
            </div>

            <div class="form-group">
              <label for="document-number">Document Number *</label>
              <input
                type="text"
                id="document-number"
                name="documentNumber"
                value="${data.documentNumber || ''}"
                required
                placeholder="As shown on document"
              />
            </div>

            <div class="form-group">
              <label for="expiry-date">Expiry Date *</label>
              <input
                type="date"
                id="expiry-date"
                name="expiryDate"
                value="${data.expiryDate || ''}"
                required
              />
              <p class="field-note">
                If your document is expired, you may still proceed, but verification may require additional review.
              </p>
            </div>

            <div class="form-actions">
              <button type="button" id="btn-continue-1-2" class="btn-primary" disabled>
                CONTINUE
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Attach validation and event handlers
    this.attachStep1_2Handlers();
  }

  /**
   * Attach handlers for Step 1.2
   */
  attachStep1_2Handlers() {
    const form = document.getElementById('form-step-1-2');
    const btn = document.getElementById('btn-continue-1-2');

    const validateForm = () => {
      const documentType = document.getElementById('document-type').value;
      const issuingCountry = document.getElementById('issuing-country').value;
      const documentNumber = document.getElementById('document-number').value.trim();
      const expiryDate = document.getElementById('expiry-date').value;

      // Validation rules
      const valid = documentType && issuingCountry && documentNumber.length >= 5 && expiryDate;
      btn.disabled = !valid;
    };

    // Attach listeners
    form.querySelectorAll('input, select').forEach(field => {
      field.addEventListener('change', validateForm);
      field.addEventListener('keyup', validateForm);
    });

    // Continue button handler
    btn.addEventListener('click', () => {
      this.data = {
        ...this.data,
        documentType: document.getElementById('document-type').value,
        issuingCountry: document.getElementById('issuing-country').value,
        documentNumber: document.getElementById('document-number').value.trim(),
        expiryDate: document.getElementById('expiry-date').value
      };
      this.saveSessionData();
      this.transitionTo('STEP_1_3_CAPTURE_BRIEFING');
    });

    // Initial validation
    validateForm();
  }

  /**
   * STEP_1_3_CAPTURE_BRIEFING - Pre-capture instruction screen
   */
  renderStep1_3_Briefing(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Step 1.3: Identity Evidence</h4>

          <div class="briefing-content">
            <p class="briefing-intro">We will now capture two images:</p>

            <ol class="capture-requirements">
              <li>
                <strong>Your identity document</strong><br>
                <span class="requirement-detail">Full document in frame, clearly legible</span>
              </li>
              <li>
                <strong>Your face</strong><br>
                <span class="requirement-detail">Clear, front-facing photo</span>
              </li>
            </ol>

            <div class="requirements-box">
              <h5>Requirements:</h5>
              <ul>
                <li>Good lighting (no shadows or glare)</li>
                <li>Steady device</li>
                <li>All text on document must be readable</li>
              </ul>
            </div>

            <p class="briefing-note">You may retake images as needed.</p>

            <div class="form-actions">
              <button type="button" id="btn-begin-capture" class="btn-primary btn-large">
                BEGIN CAPTURE
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listener
    document.getElementById('btn-begin-capture').addEventListener('click', () => {
      this.transitionTo('STEP_1_3_CAPTURE_DOCUMENT');
    });
  }

  /**
   * STEP_1_3_CAPTURE_DOCUMENT - Camera capture for document
   */
  async renderCaptureDocument(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Step 1.3: Capture Identity Document</h4>

          <div class="camera-container">
            <div class="camera-instruction">
              <p>Position your ${this.getDocumentTypeName()} within the frame</p>
            </div>

            <div id="camera-viewport" class="camera-viewport">
              <video id="camera-preview" autoplay playsinline></video>
              <canvas id="camera-canvas" style="display: none;"></canvas>

              <!-- Document guide overlay -->
              <div id="document-guide" class="capture-overlay">
                <div class="guide-frame document-frame">
                  <div class="corner top-left"></div>
                  <div class="corner top-right"></div>
                  <div class="corner bottom-left"></div>
                  <div class="corner bottom-right"></div>
                </div>
                <p class="guide-text">Align document within frame</p>
              </div>

              <div id="capturing-indicator" class="capturing-indicator" style="display: none;">
                <div class="capture-spinner"></div>
                <p>Processing capture...</p>
              </div>
            </div>

            <div class="camera-controls">
              <button type="button" id="btn-capture-document" class="btn-primary btn-large">
                CAPTURE IMAGE
              </button>
              <button type="button" id="btn-cancel-capture" class="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize camera
    try {
      if (!this.camera) {
        this.camera = new CameraCapture();
      }
      await this.camera.initializeCamera('environment'); // Back camera
      const videoElement = document.getElementById('camera-preview');
      this.camera.startPreview(videoElement);

      // Attach capture button handler
      document.getElementById('btn-capture-document').addEventListener('click', async () => {
        await this.captureDocumentImage();
      });

      // Cancel button
      document.getElementById('btn-cancel-capture').addEventListener('click', () => {
        if (this.camera) {
          this.camera.stopCamera();
        }
        this.transitionTo('STEP_1_3_CAPTURE_BRIEFING');
      });

    } catch (error) {
      console.error('Camera error:', error);
      container.innerHTML = `
        <div class="error-state">
          <h3>Camera Access Required</h3>
          <p>${error.message}</p>
          <button type="button" onclick="verificationFlow.transitionTo('STEP_1_3_CAPTURE_BRIEFING')" class="btn-secondary">
            Go Back
          </button>
        </div>
      `;
    }
  }

  /**
   * Capture document image
   */
  async captureDocumentImage() {
    if (!this.camera) return;

    try {
      // Show capturing indicator
      document.getElementById('capturing-indicator').style.display = 'flex';

      // Capture frame
      const canvas = document.getElementById('camera-canvas');
      const blob = await this.camera.captureFrame(canvas);

      // Store blob
      this.images.document = blob;
      this.images.documentDataURL = URL.createObjectURL(blob);

      // Stop camera
      this.camera.stopCamera();

      // Transition to review
      this.transitionTo('STEP_1_3_REVIEW_DOCUMENT');

    } catch (error) {
      console.error('Capture error:', error);
      document.getElementById('capturing-indicator').style.display = 'none';
      alert('Failed to capture image. Please try again.');
    }
  }

  /**
   * STEP_1_3_REVIEW_DOCUMENT - Review captured document
   */
  renderReviewDocument(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Captured Document Image</h4>

          <div class="capture-review">
            <div class="captured-image-container">
              <img src="${this.images.documentDataURL}" alt="Captured document" class="captured-image" />
            </div>

            <p class="review-question">Is this image clear and complete?</p>

            <div class="form-actions">
              <button type="button" id="btn-retake-document" class="btn-secondary">
                RETAKE
              </button>
              <button type="button" id="btn-use-document" class="btn-primary">
                USE THIS IMAGE
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    document.getElementById('btn-retake-document').addEventListener('click', () => {
      this.transitionTo('STEP_1_3_CAPTURE_DOCUMENT');
    });

    document.getElementById('btn-use-document').addEventListener('click', () => {
      this.transitionTo('STEP_1_3_CAPTURE_FACE');
    });
  }

  /**
   * STEP_1_3_CAPTURE_FACE - Camera capture for face
   */
  async renderCaptureFace(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Step 1.3: Identity Verification Photo</h4>

          <div class="camera-container">
            <div class="camera-instruction">
              <p>Position your face within the circle</p>
              <p class="instruction-detail">Look straight at the camera with a neutral expression</p>
            </div>

            <div id="camera-viewport" class="camera-viewport">
              <video id="camera-preview" autoplay playsinline></video>
              <canvas id="camera-canvas" style="display: none;"></canvas>

              <!-- Face guide overlay -->
              <div id="face-guide" class="capture-overlay">
                <div class="guide-frame face-frame">
                  <div class="face-circle"></div>
                </div>
                <p class="guide-text">Position face within circle</p>
              </div>

              <div id="capturing-indicator" class="capturing-indicator" style="display: none;">
                <div class="capture-spinner"></div>
                <p>Processing capture...</p>
              </div>
            </div>

            <div class="camera-controls">
              <button type="button" id="btn-capture-face" class="btn-primary btn-large">
                CAPTURE IMAGE
              </button>
              <button type="button" id="btn-cancel-capture" class="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Initialize camera
    try {
      if (!this.camera) {
        this.camera = new CameraCapture();
      }
      await this.camera.initializeCamera('user'); // Front camera
      const videoElement = document.getElementById('camera-preview');
      this.camera.startPreview(videoElement);

      // Attach capture button handler
      document.getElementById('btn-capture-face').addEventListener('click', async () => {
        await this.captureFaceImage();
      });

      // Cancel button
      document.getElementById('btn-cancel-capture').addEventListener('click', () => {
        if (this.camera) {
          this.camera.stopCamera();
        }
        this.transitionTo('STEP_1_3_REVIEW_DOCUMENT');
      });

    } catch (error) {
      console.error('Camera error:', error);
      container.innerHTML = `
        <div class="error-state">
          <h3>Camera Access Required</h3>
          <p>${error.message}</p>
          <button type="button" onclick="verificationFlow.transitionTo('STEP_1_3_REVIEW_DOCUMENT')" class="btn-secondary">
            Go Back
          </button>
        </div>
      `;
    }
  }

  /**
   * Capture face image
   */
  async captureFaceImage() {
    if (!this.camera) return;

    try {
      // Show capturing indicator
      document.getElementById('capturing-indicator').style.display = 'flex';

      // Capture frame
      const canvas = document.getElementById('camera-canvas');
      const blob = await this.camera.captureFrame(canvas);

      // Store blob
      this.images.face = blob;
      this.images.faceDataURL = URL.createObjectURL(blob);

      // Stop camera
      this.camera.stopCamera();

      // Transition to review
      this.transitionTo('STEP_1_3_REVIEW_FACE');

    } catch (error) {
      console.error('Capture error:', error);
      document.getElementById('capturing-indicator').style.display = 'none';
      alert('Failed to capture image. Please try again.');
    }
  }

  /**
   * STEP_1_3_REVIEW_FACE - Review captured face image
   */
  renderReviewFace(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <h4 class="substep-title">Captured Face Image</h4>

          <div class="capture-review">
            <div class="captured-image-container">
              <img src="${this.images.faceDataURL}" alt="Captured face" class="captured-image" />
            </div>

            <p class="review-question">Is your face clearly visible?</p>

            <div class="form-actions">
              <button type="button" id="btn-retake-face" class="btn-secondary">
                RETAKE
              </button>
              <button type="button" id="btn-use-face" class="btn-primary">
                USE THIS IMAGE
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    document.getElementById('btn-retake-face').addEventListener('click', () => {
      this.transitionTo('STEP_1_3_CAPTURE_FACE');
    });

    document.getElementById('btn-use-face').addEventListener('click', () => {
      this.submitStep1Data();
    });
  }

  /**
   * STEP_1_SUBMITTING - Submitting data to backend
   */
  renderSubmitting(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <div class="submitting-state">
            <div class="spinner"></div>
            <h4>Submitting your information...</h4>
            <p>Please do not close this window.</p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Submit Step 1 data to backend
   */
  async submitStep1Data() {
    // Transition to submitting state
    this.transitionTo('STEP_1_SUBMITTING');

    try {
      // Construct FormData
      const formData = new FormData();

      // Personal info (mapped to backend field names)
      formData.append('full_name', this.data.fullName);
      formData.append('address', this.data.address);
      formData.append('country', this.data.nationality); // Backend expects 'country'
      formData.append('phone', this.data.phone || '');

      // Document info (mapped to backend field names)
      formData.append('id_type', this.data.documentType); // Backend expects 'id_type'
      formData.append('id_number', this.data.documentNumber); // Backend expects 'id_number'
      formData.append('id_country', this.data.issuingCountry); // Backend expects 'id_country'
      formData.append('id_expiry_date', this.data.expiryDate); // Backend expects 'id_expiry_date'

      // Images (document serves as both passport and proof of address for now)
      formData.append('passport', this.images.document, 'document.jpg');
      formData.append('proof_of_address', this.images.document, 'address-proof.jpg'); // Using same document as proof of address
      formData.append('selfie_with_id', this.images.face, 'face.jpg');

      // Submit to backend
      const response = await fetch(`${API_BASE}/verification/${this.token}/submit-info`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Submission successful:', result);

      // Transition to complete
      this.transitionTo('STEP_1_COMPLETE');

    } catch (error) {
      console.error('Submission error:', error);
      // Store error for display
      this.lastError = error.message || 'Network connection error';
      // Transition to error state
      this.transitionTo('STEP_1_SUBMISSION_ERROR');
    }
  }

  /**
   * STEP_1_SUBMISSION_ERROR - Display submission error with retry option
   */
  renderSubmissionError(container) {
    const errorMessage = this.lastError || 'Unable to submit your information';

    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <div class="error-state">
            <div class="error-icon">⚠</div>
            <h3>Submission Failed</h3>

            <p class="error-message">
              ${errorMessage}
            </p>

            <div class="error-details">
              <p>This could be due to:</p>
              <ul>
                <li>Temporary network connection issue</li>
                <li>Server maintenance</li>
                <li>Session timeout</li>
              </ul>
            </div>

            <p class="error-instruction">
              Your information has been saved. You can try again or contact support if the problem persists.
            </p>

            <div class="form-actions">
              <button type="button" id="btn-retry-submission" class="btn-primary">
                TRY AGAIN
              </button>
            </div>

            <p class="support-note">
              If you continue to experience issues, please contact verification support.
            </p>
          </div>
        </div>
      </div>
    `;

    // Attach retry handler
    document.getElementById('btn-retry-submission').addEventListener('click', () => {
      this.transitionTo('STEP_1_3_REVIEW_FACE');
    });
  }

  /**
   * STEP_1_COMPLETE - Submission acknowledgment
   */
  renderStep1Complete(container) {
    container.innerHTML = `
      <div class="verification-screen">
        <div class="step-header">
          <h2>Identity Verification: Step 1 of 3</h2>
          <h3>Personal Declaration</h3>
        </div>

        <div class="step-content">
          <div class="completion-state">
            <div class="success-icon">✓</div>
            <h3>STEP 1 COMPLETE</h3>

            <div class="completion-summary">
              <div class="summary-item">
                <span class="summary-label">Personal Declaration:</span>
                <span class="summary-status">Submitted</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Document Evidence:</span>
                <span class="summary-status">Submitted</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Face Evidence:</span>
                <span class="summary-status">Submitted</span>
              </div>
            </div>

            <p class="completion-message">
              Your information is now under review.
              Verification typically completes within 2–4 hours.
            </p>

            <p class="completion-note">
              You may now proceed to the next step.
            </p>

            <div class="form-actions">
              <button type="button" id="btn-proceed-step-2" class="btn-primary btn-large">
                PROCEED TO STEP 2
              </button>
            </div>

            <p class="save-note">
              (Your data is saved. You can return to this page if you're disconnected.)
            </p>
          </div>
        </div>
      </div>
    `;

    // Attach event listener
    document.getElementById('btn-proceed-step-2').addEventListener('click', async () => {
      await this.checkApprovalAndProceed();
    });
  }

  /**
   * Helper: Get country options HTML
   * Comprehensive list covering 200+ jurisdictions worldwide
   */
  getCountryOptions(selectedCountry = '') {
    const countries = [
      // Europe
      'AL|Albania', 'AD|Andorra', 'AT|Austria', 'BY|Belarus', 'BE|Belgium',
      'BA|Bosnia and Herzegovina', 'BG|Bulgaria', 'HR|Croatia', 'CY|Cyprus',
      'CZ|Czech Republic', 'DK|Denmark', 'EE|Estonia', 'FI|Finland', 'FR|France',
      'DE|Germany', 'GR|Greece', 'HU|Hungary', 'IS|Iceland', 'IE|Ireland',
      'IT|Italy', 'XK|Kosovo', 'LV|Latvia', 'LI|Liechtenstein', 'LT|Lithuania',
      'LU|Luxembourg', 'MT|Malta', 'MD|Moldova', 'MC|Monaco', 'ME|Montenegro',
      'NL|Netherlands', 'MK|North Macedonia', 'NO|Norway', 'PL|Poland',
      'PT|Portugal', 'RO|Romania', 'RU|Russia', 'SM|San Marino', 'RS|Serbia',
      'SK|Slovakia', 'SI|Slovenia', 'ES|Spain', 'SE|Sweden', 'CH|Switzerland',
      'UA|Ukraine', 'GB|United Kingdom', 'VA|Vatican City',

      // North America
      'US|United States', 'CA|Canada', 'MX|Mexico', 'BZ|Belize', 'CR|Costa Rica',
      'SV|El Salvador', 'GT|Guatemala', 'HN|Honduras', 'NI|Nicaragua', 'PA|Panama',

      // Caribbean
      'AG|Antigua and Barbuda', 'BS|Bahamas', 'BB|Barbados', 'CU|Cuba',
      'DM|Dominica', 'DO|Dominican Republic', 'GD|Grenada', 'HT|Haiti',
      'JM|Jamaica', 'KN|Saint Kitts and Nevis', 'LC|Saint Lucia',
      'VC|Saint Vincent and the Grenadines', 'TT|Trinidad and Tobago',

      // South America
      'AR|Argentina', 'BO|Bolivia', 'BR|Brazil', 'CL|Chile', 'CO|Colombia',
      'EC|Ecuador', 'GY|Guyana', 'PY|Paraguay', 'PE|Peru', 'SR|Suriname',
      'UY|Uruguay', 'VE|Venezuela',

      // Asia - East & Southeast
      'CN|China', 'JP|Japan', 'KR|South Korea', 'KP|North Korea', 'MN|Mongolia',
      'TW|Taiwan', 'HK|Hong Kong', 'MO|Macau', 'BN|Brunei', 'KH|Cambodia',
      'ID|Indonesia', 'LA|Laos', 'MY|Malaysia', 'MM|Myanmar', 'PH|Philippines',
      'SG|Singapore', 'TH|Thailand', 'TL|Timor-Leste', 'VN|Vietnam',

      // Asia - South
      'AF|Afghanistan', 'BD|Bangladesh', 'BT|Bhutan', 'IN|India', 'MV|Maldives',
      'NP|Nepal', 'PK|Pakistan', 'LK|Sri Lanka',

      // Asia - Central
      'KZ|Kazakhstan', 'KG|Kyrgyzstan', 'TJ|Tajikistan', 'TM|Turkmenistan',
      'UZ|Uzbekistan',

      // Middle East
      'BH|Bahrain', 'IQ|Iraq', 'IR|Iran', 'IL|Israel', 'JO|Jordan', 'KW|Kuwait',
      'LB|Lebanon', 'OM|Oman', 'PS|Palestine', 'QA|Qatar', 'SA|Saudi Arabia',
      'SY|Syria', 'TR|Turkey', 'AE|United Arab Emirates', 'YE|Yemen',

      // Africa - North
      'DZ|Algeria', 'EG|Egypt', 'LY|Libya', 'MA|Morocco', 'SD|Sudan',
      'TN|Tunisia', 'EH|Western Sahara',

      // Africa - West
      'BJ|Benin', 'BF|Burkina Faso', 'CV|Cape Verde', 'CI|Côte d\'Ivoire',
      'GM|Gambia', 'GH|Ghana', 'GN|Guinea', 'GW|Guinea-Bissau', 'LR|Liberia',
      'ML|Mali', 'MR|Mauritania', 'NE|Niger', 'NG|Nigeria', 'SN|Senegal',
      'SL|Sierra Leone', 'TG|Togo',

      // Africa - Central
      'AO|Angola', 'CM|Cameroon', 'CF|Central African Republic', 'TD|Chad',
      'CG|Congo', 'CD|Democratic Republic of the Congo', 'GQ|Equatorial Guinea',
      'GA|Gabon', 'ST|São Tomé and Príncipe',

      // Africa - East
      'BI|Burundi', 'KM|Comoros', 'DJ|Djibouti', 'ER|Eritrea', 'ET|Ethiopia',
      'KE|Kenya', 'MG|Madagascar', 'MW|Malawi', 'MU|Mauritius', 'MZ|Mozambique',
      'RW|Rwanda', 'SC|Seychelles', 'SO|Somalia', 'SS|South Sudan', 'TZ|Tanzania',
      'UG|Uganda', 'ZM|Zambia', 'ZW|Zimbabwe',

      // Africa - Southern
      'BW|Botswana', 'LS|Lesotho', 'NA|Namibia', 'ZA|South Africa', 'SZ|Eswatini',

      // Oceania
      'AU|Australia', 'NZ|New Zealand', 'FJ|Fiji', 'KI|Kiribati', 'MH|Marshall Islands',
      'FM|Micronesia', 'NR|Nauru', 'PW|Palau', 'PG|Papua New Guinea', 'WS|Samoa',
      'SB|Solomon Islands', 'TO|Tonga', 'TV|Tuvalu', 'VU|Vanuatu',

      // British Overseas Territories & Crown Dependencies
      'AI|Anguilla', 'BM|Bermuda', 'IO|British Indian Ocean Territory',
      'VG|British Virgin Islands', 'KY|Cayman Islands', 'FK|Falkland Islands',
      'GI|Gibraltar', 'MS|Montserrat', 'PN|Pitcairn Islands',
      'SH|Saint Helena', 'GS|South Georgia', 'TC|Turks and Caicos Islands',
      'GG|Guernsey', 'JE|Jersey', 'IM|Isle of Man',

      // French Territories
      'GF|French Guiana', 'PF|French Polynesia', 'TF|French Southern Territories',
      'GP|Guadeloupe', 'MQ|Martinique', 'YT|Mayotte', 'NC|New Caledonia',
      'RE|Réunion', 'BL|Saint Barthélemy', 'MF|Saint Martin',
      'PM|Saint Pierre and Miquelon', 'WF|Wallis and Futuna',

      // US Territories
      'AS|American Samoa', 'GU|Guam', 'MP|Northern Mariana Islands',
      'PR|Puerto Rico', 'UM|US Minor Outlying Islands', 'VI|US Virgin Islands',

      // Netherlands Territories
      'AW|Aruba', 'CW|Curaçao', 'SX|Sint Maarten', 'BQ|Caribbean Netherlands',

      // Other Territories
      'AX|Åland Islands', 'AQ|Antarctica', 'CX|Christmas Island',
      'CC|Cocos Islands', 'CK|Cook Islands', 'FO|Faroe Islands', 'GL|Greenland',
      'NF|Norfolk Island', 'NU|Niue', 'SJ|Svalbard and Jan Mayen', 'TK|Tokelau'
    ];

    return countries.map(country => {
      const [code, name] = country.split('|');
      const selected = code === selectedCountry ? 'selected' : '';
      return `<option value="${code}" ${selected}>${name}</option>`;
    }).join('');
  }

  /**
   * Helper: Get document type name
   */
  getDocumentTypeName() {
    const typeMap = {
      'passport': 'passport',
      'national_id': 'national ID card',
      'drivers_license': 'driver\'s license'
    };
    return typeMap[this.data.documentType] || 'identity document';
  }

  /**
   * Helper: Check if over 18 years old
   */
  isOver18(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 >= 18;
    }

    return age >= 18;
  }

  /**
   * Check document approval status and proceed to Step 2 if approved
   */
  async checkApprovalAndProceed() {
    try {
      // Disable button and show loading state
      const btn = document.getElementById('btn-proceed-step-2');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'CHECKING APPROVAL STATUS...';
      }

      // Fetch verification status from backend
      const response = await fetch(`${API_BASE}/verification/${this.token}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if all documents are approved
      if (data.all_documents_approved === true) {
        // Documents approved - allow Step 2
        alert('Your documents have been approved! Proceeding to Step 2...');
        // TODO: Implement Step 2 transition when ready
        // this.transitionTo('STEP_2_ESCROW');
        window.location.href = 'recipient-verification.html?token=' + this.token;
      } else if (data.all_documents_approved === false) {
        // Documents explicitly rejected or pending
        const rejectionReasons = [];

        if (data.passport_approved === false && data.passport_rejection_reason) {
          rejectionReasons.push(`Passport: ${data.passport_rejection_reason}`);
        }
        if (data.proof_of_address_approved === false && data.proof_of_address_rejection_reason) {
          rejectionReasons.push(`Proof of Address: ${data.proof_of_address_rejection_reason}`);
        }
        if (data.selfie_approved === false && data.selfie_rejection_reason) {
          rejectionReasons.push(`Selfie: ${data.selfie_rejection_reason}`);
        }

        if (rejectionReasons.length > 0) {
          // Some documents were rejected
          alert('Some documents were rejected:\n\n' + rejectionReasons.join('\n\n') + '\n\nPlease resubmit your documents.');
          // Reload to allow resubmission
          window.location.reload();
        } else {
          // Documents are pending review
          alert('Your documents are currently under review by our verification team.\n\nThis process typically takes 2-4 hours. You will receive an email notification once the review is complete.\n\nYou can return to this page later to proceed to Step 2.');
        }
      } else {
        // Approval status is null (not yet reviewed)
        alert('Your documents are currently under review by our verification team.\n\nThis process typically takes 2-4 hours. You will receive an email notification once the review is complete.\n\nYou can return to this page later to proceed to Step 2.');
      }

      // Re-enable button
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'PROCEED TO STEP 2';
      }

    } catch (error) {
      console.error('Error checking approval status:', error);
      alert('Unable to check approval status. Please check your internet connection and try again.');

      // Re-enable button
      const btn = document.getElementById('btn-proceed-step-2');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'PROCEED TO STEP 2';
      }
    }
  }
}

// Global instance
let verificationFlow = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    verificationFlow = new VerificationFlow(token);
  } else {
    console.error('No verification token provided');
  }
});