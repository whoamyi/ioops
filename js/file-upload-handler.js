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

    const allUploaded = uploadedFiles.passport && uploadedFiles.proof_of_address && uploadedFiles.selfie;

    if (allUploaded) {
      submitBtn.disabled = false;
      statusText.textContent = '✓ All documents uploaded. Ready to submit.';
      statusText.style.color = '#10b981';
    } else {
      submitBtn.disabled = true;
      const uploaded = [uploadedFiles.passport, uploadedFiles.proof_of_address, uploadedFiles.selfie].filter(Boolean).length;
      statusText.textContent = `${uploaded} of 3 documents uploaded`;
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
      if (!uploadedFiles.passport || !uploadedFiles.proof_of_address || !uploadedFiles.selfie) {
        alert('Please upload all 3 documents before submitting.');
        return;
      }

      newSubmitBtn.disabled = true;
      newSubmitBtn.textContent = 'Uploading...';

      try {
        const formData = new FormData();
        formData.append('passport', uploadedFiles.passport, 'passport.jpg');
        formData.append('proof_of_address', uploadedFiles.proof_of_address, 'proof_of_address.jpg');
        formData.append('selfie', uploadedFiles.selfie, 'selfie.jpg');

        console.log('[Upload] Submitting documents to backend');

        const response = await fetch(`${API_BASE}/verification/${token}/upload-documents`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        console.log('[Upload] Documents uploaded successfully');

        // Show success notification
        showNotification('Documents submitted successfully! Awaiting review.', 'success');

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
