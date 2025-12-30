# Comprehensive Fixes for IOOPS Verification System

## Overview
This document contains all fixes for the 5 reported issues. Apply these changes in order.

---

## FIX 1: Replace Camera with File Uploads

###  Step 1: Update HTML (recipient-verification.html)

**Location:** Lines 236-322 (STEP 1.3: Camera Capture section)

**Replace the entire STEP 1.3 section with the content from:**
`upload-section-replacement.html`

---

### Step 2: Add CSS for File Uploads

**File:** `css/recipient-verification.css`

**Add these styles at the end of the file:**

```css
/* File Upload Styles */
.upload-sections {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.upload-section {
    background: var(--bg-subtle);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
}

.upload-section h3 {
    font-size: 18px;
    margin-bottom: 8px;
    color: var(--text-primary);
}

.upload-description {
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
}

.file-upload-container {
    position: relative;
}

.file-upload-label {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: all 0.3s ease;
}

.file-upload-label:hover {
    border-color: var(--primary-color);
    background: var(--bg-hover);
}

.file-upload-label svg {
    margin-bottom: 12px;
    color: var(--text-secondary);
}

.file-upload-label span {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
}

.file-preview {
    position: relative;
    margin-top: 16px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
}

.file-preview img {
    width: 100%;
    height: auto;
    display: block;
    max-height: 400px;
    object-fit: contain;
    background: #000;
}

.remove-file-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(239, 68, 68, 0.9);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: background 0.2s;
}

.remove-file-btn:hover {
    background: rgba(220, 38, 38, 1);
}

.upload-status-text {
    text-align: center;
    margin-top: 12px;
    font-size: 14px;
    color: var(--text-secondary);
}

/* Mobile Adjustments */
@media (max-width: 768px) {
    .upload-section {
        padding: 16px;
    }

    .file-upload-label {
        padding: 30px 15px;
    }

    .file-upload-label span {
        font-size: 14px;
    }

    .file-preview img {
        max-height: 300px;
    }
}
```

---

### Step 3: Update JavaScript for File Uploads

**File:** `js/recipient-verification.js`

**Find the function `function transitionTo(newState)` and locate the case for `STATES.STEP_1_3_CAPTURE`**

**Replace the entire camera initialization code with:**

```javascript
case STATES.STEP_1_3_CAPTURE:
  console.log('[State] Transitioning to STEP_1_3_CAPTURE - File Upload');
  showStep('step-1-3');
  progressBar.setStep(1);

  // Setup file upload handlers
  setupFileUploadHandlers();
  break;
```

**Then add this new function after the state machine code:**

```javascript
// File Upload Handler Setup
function setupFileUploadHandlers() {
  const uploadedFiles = {
    passport: null,
    proof_of_address: null,
    selfie: null
  };

  // Passport upload
  const passportInput = document.getElementById('passport-file-input');
  const passportPreview = document.getElementById('passport-preview');
  const passportPreviewImg = document.getElementById('passport-preview-img');
  const removePassport = document.getElementById('remove-passport');

  passportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadedFiles.passport = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        passportPreviewImg.src = event.target.result;
        passportPreview.style.display = 'block';
        document.getElementById('passport-file-input').parentElement.querySelector('.file-upload-label').style.display = 'none';
        checkAllUploaded();
      };
      reader.readAsDataURL(file);
    }
  });

  removePassport.addEventListener('click', () => {
    uploadedFiles.passport = null;
    passportInput.value = '';
    passportPreview.style.display = 'none';
    document.getElementById('passport-file-input').parentElement.querySelector('.file-upload-label').style.display = 'flex';
    checkAllUploaded();
  });

  // Proof of Address upload
  const proofInput = document.getElementById('proof-of-address-file-input');
  const proofPreview = document.getElementById('proof-of-address-preview');
  const proofPreviewImg = document.getElementById('proof-of-address-preview-img');
  const removeProof = document.getElementById('remove-proof-of-address');

  proofInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadedFiles.proof_of_address = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        proofPreviewImg.src = event.target.result;
        proofPreview.style.display = 'block';
        document.getElementById('proof-of-address-file-input').parentElement.querySelector('.file-upload-label').style.display = 'none';
        checkAllUploaded();
      };
      reader.readAsDataURL(file);
    }
  });

  removeProof.addEventListener('click', () => {
    uploadedFiles.proof_of_address = null;
    proofInput.value = '';
    proofPreview.style.display = 'none';
    document.getElementById('proof-of-address-file-input').parentElement.querySelector('.file-upload-label').style.display = 'flex';
    checkAllUploaded();
  });

  // Selfie upload
  const selfieInput = document.getElementById('selfie-file-input');
  const selfiePreview = document.getElementById('selfie-preview');
  const selfiePreviewImg = document.getElementById('selfie-preview-img');
  const removeSelfie = document.getElementById('remove-selfie');

  selfieInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadedFiles.selfie = file;
      const reader = new FileReader();
      reader.onload = (event) => {
        selfiePreviewImg.src = event.target.result;
        selfiePreview.style.display = 'block';
        document.getElementById('selfie-file-input').parentElement.querySelector('.file-upload-label').style.display = 'none';
        checkAllUploaded();
      };
      reader.readAsDataURL(file);
    }
  });

  removeSelfie.addEventListener('click', () => {
    uploadedFiles.selfie = null;
    selfieInput.value = '';
    selfiePreview.style.display = 'none';
    document.getElementById('selfie-file-input').parentElement.querySelector('.file-upload-label').style.display = 'flex';
    checkAllUploaded();
  });

  // Check if all files are uploaded
  function checkAllUploaded() {
    const submitBtn = document.getElementById('submit-identity-btn');
    const statusText = document.getElementById('upload-status');

    const allUploaded = uploadedFiles.passport && uploadedFiles.proof_of_address && uploadedFiles.selfie;

    if (allUploaded) {
      submitBtn.disabled = false;
      statusText.textContent = '✓ All documents uploaded. Ready to submit.';
      statusText.style.color = 'var(--success-color)';
    } else {
      submitBtn.disabled = true;
      const uploaded = [uploadedFiles.passport, uploadedFiles.proof_of_address, uploadedFiles.selfie].filter(Boolean).length;
      statusText.textContent = `${uploaded} of 3 documents uploaded`;
      statusText.style.color = 'var(--text-secondary)';
    }
  }

  // Submit handler
  const submitBtn = document.getElementById('submit-identity-btn');
  submitBtn.onclick = async () => {
    if (!uploadedFiles.passport || !uploadedFiles.proof_of_address || !uploadedFiles.selfie) {
      alert('Please upload all 3 documents before submitting.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
      const formData = new FormData();
      formData.append('passport', uploadedFiles.passport, 'passport.jpg');
      formData.append('proof_of_address', uploadedFiles.proof_of_address, 'proof_of_address.jpg');
      formData.append('selfie', uploadedFiles.selfie, 'selfie.jpg');

      const response = await fetch(`${API_BASE}/verification/${token}/upload-documents`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      console.log('[Upload] Documents uploaded successfully');

      // Transition to waiting for approval
      transitionTo(STATES.WAITING_APPROVAL);

    } catch (error) {
      console.error('[Upload] Error:', error);
      alert('Failed to upload documents. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Documents';
    }
  };
}
```

---

## FIX 2: Adjust Payment Modal Height for Mobile

**File:** `js/recipient-verification.js`

**Find the payment modal HTML (around line 2348-2657) and update the inline styles:**

```javascript
// Find this line:
<div id="payment-method-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center;">

// Replace with:
<div id="payment-method-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; overflow-y: auto; padding: 20px 0;">
```

**Then find the modal content div and update:**

```javascript
// Find:
<div style="background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">

// Replace with:
<div style="background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 85vh; overflow-y: auto; position: relative; margin: auto;">
```

---

## FIX 3: Fix Security Code Update "Too Many Requests" Error

**File:** `backend/src/routes/ioops-verification.js`

**Find the security code update endpoint and add rate limiting fix:**

```javascript
// Add at the top of the file with other imports:
const codeUpdateAttempts = new Map();

// Then find the PUT /verification/:token/update-code endpoint
// Add this rate limiting logic at the start of the handler:

router.put('/verification/:token/update-code', async (req, res) => {
  const { token } = req.params;
  const { security_code } = req.body;

  // Rate limiting: max 3 attempts per 10 seconds
  const now = Date.now();
  const attempts = codeUpdateAttempts.get(token) || [];
  const recentAttempts = attempts.filter(time => now - time < 10000);

  if (recentAttempts.length >= 3) {
    return res.status(429).json({
      error: 'Too many update attempts. Please wait a moment and try again.'
    });
  }

  recentAttempts.push(now);
  codeUpdateAttempts.set(token, recentAttempts);

  // Clean up old entries
  setTimeout(() => {
    const current = codeUpdateAttempts.get(token) || [];
    const filtered = current.filter(time => Date.now() - time < 10000);
    if (filtered.length === 0) {
      codeUpdateAttempts.delete(token);
    } else {
      codeUpdateAttempts.set(token, filtered);
    }
  }, 10000);

  // Continue with existing code...
  try {
    // ... rest of the endpoint logic
```

---

## FIX 4: Improve PDF Receipt Layout

**File:** `backend/src/routes/generate-receipt.js`

**The PDF already has been fixed in previous session but may have unwanted characters. Check lines 120-283 for any emoji or special characters that look wrong and replace:**

1. Change line 207 (Escrow box title):
```javascript
// FROM:
doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e').text('💰 ESCROW DEPOSIT RETURN', 55, yPos, { lineBreak: false });

// TO:
doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e').text('ESCROW DEPOSIT RETURN', 55, yPos, { lineBreak: false });
```

2. Change line 249 (Security notice):
```javascript
// FROM:
addCenteredText('⚠ IMPORTANT NOTICE', yPos, 6, 'Helvetica-Bold');

// TO:
addCenteredText('IMPORTANT NOTICE', yPos, 6, 'Helvetica-Bold');
```

3. Change line 231 (Checkmark in steps):
```javascript
// FROM:
const checkmark = '✓';

// TO:
const checkmark = '[OK]';
```

---

## FIX 5: Email System Improvements

### Part A: Add Company Selection to Email System

**File:** Create new file `backend/src/routes/send-email-v2.js`

This will be a comprehensive rewrite. The content is too long for this file.
See separate file: `send-email-v2.js` (to be created)

---

## Testing Checklist

After applying all fixes:

- [ ] Test file upload on mobile (take photo)
- [ ] Test file upload on desktop (choose file)
- [ ] Test payment modal on mobile viewport
- [ ] Test security code update (multiple rapid clicks)
- [ ] Test PDF download (check for clean layout, no weird characters)
- [ ] Test email system with both IOOPS and Meridian
- [ ] Test email template preview
- [ ] Verify resubmission logic still works with file uploads

---

## Deployment Steps

1. Apply all fixes locally
2. Test thoroughly
3. Commit changes: `git add . && git commit -m "Fix camera, payment modal, security code, PDF, and email system"`
4. Push: `git push`
5. Deploy backend: `flyctl deploy --app meridian-tracking`
6. Deploy frontend (copy to IOOPS server or your hosting)
7. Test in production

