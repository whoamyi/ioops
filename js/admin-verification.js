// IOOPS Admin Verification Portal

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/admin'
  : 'https://meridian-tracking.fly.dev/api/admin';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://meridian-tracking.fly.dev';

const FRONTEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5500'
  : 'https://www.ioops.org';

const PRODUCTION_EMAIL_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api/admin/production-email'
  : 'https://meridian-tracking.fly.dev/api/admin/production-email';

// State
let verifications = [];
let selectedVerification = null;
let currentFilter = 'all';
let searchQuery = '';
let socket = null;
let currentTab = 'verifications';
let shipments = [];
let emailTemplates = [];
let pendingRejection = null; // Track document being rejected via modal
let sentEmails = [];
let sentEmailsFilters = {
  company: '',
  search: ''
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadVerifications();
  setupEventListeners();
  setupWebSocket();
  startAutoRefresh();
  setupTabs();
  loadEmailTemplates();
  setupModalListeners();
});

function setupEventListeners() {
  document.getElementById('status-filter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    renderVerifications();
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderVerifications();
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadVerifications();
  });

  document.getElementById('close-panel').addEventListener('click', () => {
    closeDetailPanel();
  });

  // Rejection Modal Event Listeners
  document.getElementById('preset-rejection-reason').addEventListener('change', (e) => {
    const customGroup = document.getElementById('custom-rejection-reason-group');
    if (e.target.value === 'custom') {
      customGroup.style.display = 'block';
    } else {
      customGroup.style.display = 'none';
    }
  });

  document.getElementById('close-rejection-modal').addEventListener('click', () => {
    document.getElementById('rejection-modal').style.display = 'none';
    pendingRejection = null;
  });

  document.getElementById('cancel-rejection').addEventListener('click', () => {
    document.getElementById('rejection-modal').style.display = 'none';
    pendingRejection = null;
  });

  document.getElementById('confirm-rejection').addEventListener('click', async () => {
    await processDocumentRejection();
  });
}

// Load all verifications from API
async function loadVerifications() {
  try {
    const response = await fetch(`${API_BASE}/verifications`);
    if (!response.ok) throw new Error('Failed to load verifications');

    verifications = await response.json();
    renderVerifications();
    updateStats();
  } catch (error) {
    console.error('Error loading verifications:', error);
    showError('Failed to load verifications');
  }
}

// Render verifications list
function renderVerifications() {
  const container = document.getElementById('verifications-list');

  // Filter verifications
  let filtered = verifications.filter(v => {
    if (currentFilter !== 'all' && v.status !== currentFilter) return false;
    if (searchQuery) {
      const searchText = `${v.tracking_id} ${v.recipient_email} ${v.recipient_full_name || ''}`.toLowerCase();
      if (!searchText.includes(searchQuery)) return false;
    }
    return true;
  });

  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>No verifications found</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(v => createVerificationCard(v)).join('');

  // Add click handlers
  document.querySelectorAll('.verification-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      selectVerification(id);
    });
  });
}

// Create verification card HTML
function createVerificationCard(verification) {
  const actionRequired = getActionRequired(verification);
  const statusClass = verification.status.replace(/_/g, '-');

  return `
    <div class="verification-card ${selectedVerification?.id === verification.id ? 'selected' : ''}"
         data-id="${verification.id}">
      <div class="card-header">
        <div class="card-title">
          <div class="tracking-id">${verification.tracking_id}</div>
          <div class="recipient-email">${verification.recipient_email}</div>
        </div>
        <span class="status-badge status-${statusClass}">${formatStatus(verification.status)}</span>
      </div>

      <div class="card-info">
        <div class="info-item">
          <span class="info-label">Escrow Amount</span>
          <span class="info-value">EUR €${parseFloat(verification.escrow_amount).toLocaleString()}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Escrow Status</span>
          <span class="info-value">${formatEscrowStatus(verification.escrow_status)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Created</span>
          <span class="info-value">${formatDate(verification.created_at)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Last Updated</span>
          <span class="info-value">${formatDate(verification.updated_at)}</span>
        </div>
      </div>

      <div class="card-footer">
        ${actionRequired ? `<span class="action-required">⚠ ${actionRequired}</span>` : '<span></span>'}
        <span class="view-details">View Details →</span>
      </div>
    </div>
  `;
}

// Select and show verification details
function selectVerification(id) {
  selectedVerification = verifications.find(v => v.id === id);
  if (!selectedVerification) return;

  renderVerifications(); // Update selection in list
  showDetailPanel();
}

// Show detail panel
function showDetailPanel() {
  const panel = document.getElementById('detail-panel');
  const content = document.getElementById('panel-content');

  content.innerHTML = renderDetailPanel(selectedVerification);
  panel.style.display = 'flex';

  // Fix all document image URLs to use production backend
  fixDocumentURLs();

  // Setup action buttons
  setupActionButtons();
}

// Fix document URLs to use production backend
function fixDocumentURLs() {
  // Fix all document preview images
  document.querySelectorAll('.document-preview-img').forEach(img => {
    const url = img.getAttribute('data-full-url');
    if (url && !url.startsWith('http')) {
      img.src = `${BACKEND_URL}${url}`;
    }
  });

  // Fix payment receipt images
  document.querySelectorAll('.payment-receipt-preview').forEach(img => {
    const url = img.getAttribute('data-full-url');
    if (url && !url.startsWith('http')) {
      img.src = `${BACKEND_URL}${url}`;
    }
  });
}

// Close detail panel
function closeDetailPanel() {
  document.getElementById('detail-panel').style.display = 'none';
  selectedVerification = null;
  renderVerifications();
}

// Render detail panel content
function renderDetailPanel(v) {
  return `
    <div class="detail-section">
      <h3 class="section-title">Tracking Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Tracking ID</span>
          <span class="detail-value">${v.tracking_id}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status</span>
          <span class="detail-value">${formatStatus(v.status)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Escrow Amount</span>
          <span class="detail-value">EUR €${parseFloat(v.escrow_amount).toLocaleString()}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Escrow Status</span>
          <span class="detail-value">${formatEscrowStatus(v.escrow_status)}</span>
        </div>
      </div>
    </div>

    ${v.recipient_full_name ? `
    <div class="detail-section">
      <h3 class="section-title">Recipient Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Full Name</span>
          <span class="detail-value">${v.recipient_full_name}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Email</span>
          <span class="detail-value">${v.recipient_email}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Country</span>
          <span class="detail-value">${v.recipient_country}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${v.recipient_phone || 'N/A'}</span>
        </div>
        <div class="detail-item" style="grid-column: 1 / -1;">
          <span class="detail-label">Address</span>
          <span class="detail-value">${v.recipient_address}</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3 class="section-title">Identity Document</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Document Type</span>
          <span class="detail-value">${formatIdType(v.id_type)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Document Number</span>
          <span class="detail-value">${v.id_number}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Issuing Country</span>
          <span class="detail-value">${v.id_country}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Expiry Date</span>
          <span class="detail-value">${formatDate(v.id_expiry_date)}</span>
        </div>
      </div>
    </div>
    ` : ''}

    ${v.passport_document_url ? `
    <div class="detail-section">
      <h3 class="section-title">Uploaded Documents</h3>
      ${v.all_documents_approved ? `
        <div class="approval-notice">
          ✓ All documents have been approved on ${formatDate(v.documents_reviewed_at)}
        </div>
      ` : ''}
      <div class="document-preview">
        ${renderDocumentItem('Passport / ID Document', v.passport_document_url, 'passport', v)}
        ${renderDocumentItem('Proof of Address', v.proof_of_address_url, 'proof_of_address', v)}
        ${renderDocumentItem('Selfie with ID', v.selfie_with_id_url, 'selfie', v)}
      </div>
    </div>
    ` : ''}

    ${v.payment_receipt_url ? `
    <div class="detail-section">
      <h3 class="section-title">Payment Receipt</h3>
      ${v.escrow_status === 'confirmed' ? `
        <div class="approval-notice">
          ✓ Payment has been approved on ${formatDate(v.escrow_confirmed_at)}
        </div>
      ` : ''}
      <div class="document-preview">
        ${renderPaymentReceiptItem('Payment Receipt', v.payment_receipt_url, v)}
      </div>
    </div>
    ` : ''}
    ${renderPaymentDetailsSection(v)}


    ${v.security_code ? `
    <div class="detail-section">
      <h3 class="section-title">Security Code</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Code</span>
          <span class="detail-value" style="font-family: monospace; font-size: 18px; font-weight: bold;">${v.security_code}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Code Revealed</span>
          <span class="detail-value">${v.code_revealed_at ? formatDate(v.code_revealed_at) : 'Not yet'}</span>
        </div>
        <div class="detail-item" style="grid-column: 1 / -1;">
          <button class="btn-edit-code-detail" data-tracking-id="${v.tracking_id}" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ✏️ Edit Security Code
          </button>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="action-buttons">
      ${getActionButtons()}
    </div>
  `;
}

// Render document item with individual approval controls
function renderDocumentItem(name, url, documentType, verification) {
  if (!url) return '';

  const isImage = /\.(jpg|jpeg|png)$/i.test(url);

  // Determine approval status for this document
  let approvalStatus = 'pending';
  let rejectionReason = '';

  if (documentType === 'passport' && verification.passport_approved !== null) {
    approvalStatus = verification.passport_approved ? 'approved' : 'rejected';
    rejectionReason = verification.passport_rejection_reason || '';
  } else if (documentType === 'proof_of_address' && verification.proof_of_address_approved !== null) {
    approvalStatus = verification.proof_of_address_approved ? 'approved' : 'rejected';
    rejectionReason = verification.proof_of_address_rejection_reason || '';
  } else if (documentType === 'selfie' && verification.selfie_approved !== null) {
    approvalStatus = verification.selfie_approved ? 'approved' : 'rejected';
    rejectionReason = verification.selfie_rejection_reason || '';
  }

  const statusBadgeHTML = approvalStatus === 'approved'
    ? '<span class="doc-status-badge doc-approved">✓ Approved</span>'
    : approvalStatus === 'rejected'
    ? '<span class="doc-status-badge doc-rejected">✗ Rejected</span>'
    : '<span class="doc-status-badge doc-pending">⏳ Pending Review</span>';

  const showButtons = verification.status === 'documents_submitted' && approvalStatus === 'pending';

  return `
    <div class="document-item">
      <div class="document-header">
        <span class="document-name">${name}</span>
        ${statusBadgeHTML}
        <button class="btn-view-doc" data-doc-url="${url}">
          View Full Size
        </button>
      </div>
      ${isImage ? `<img src="${url}" class="document-preview-img" data-full-url="${url}" alt="${name}">` : ''}
      ${rejectionReason ? `<div class="rejection-reason">Rejection reason: ${rejectionReason}</div>` : ''}
      ${showButtons ? `
        <div class="document-actions">
          <button class="btn-doc-approve" data-doc-type="${documentType}">
            ✓ Approve
          </button>
          <button class="btn-doc-reject" data-doc-type="${documentType}">
            ✗ Reject
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// Render payment receipt item with approval controls
function renderPaymentReceiptItem(name, url, verification) {
  if (!url) return '';

  const isImage = /\.(jpg|jpeg|png)$/i.test(url);
  const escrowStatus = verification.escrow_status;

  // Determine approval status
  let approvalStatus = 'pending';
  if (escrowStatus === 'confirmed') {
    approvalStatus = 'approved';
  } else if (escrowStatus === 'pending' && verification.status === 'documents_approved') {
    approvalStatus = 'pending';
  } else if (verification.status === 'payment_submitted') {
    approvalStatus = 'pending';
  }

  const statusBadgeHTML = approvalStatus === 'approved'
    ? '<span class="doc-status-badge doc-approved">✓ Approved</span>'
    : '<span class="doc-status-badge doc-pending">⏳ Pending Review</span>';

  const showButtons = verification.status === 'payment_submitted' && escrowStatus !== 'confirmed';

  return `
    <div class="document-item">
      <div class="document-header">
        <span class="document-name">${name}</span>
        ${statusBadgeHTML}
        <button class="btn-view-doc" data-doc-url="${url}">
          View Full Size
        </button>
      </div>
      ${isImage ? `<img src="${url}" class="payment-receipt-preview" data-full-url="${url}" alt="${name}">` : ''}
      ${showButtons ? `
        <div class="document-actions">
          <button class="btn-payment-approve">
            ✓ Approve Payment
          </button>
          <button class="btn-payment-reject">
            ✗ Reject Payment
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// Get action buttons based on status
function getActionButtons() {
  // No bottom action buttons needed - all actions are inline with their respective sections
  return '';
}

// Setup action button handlers
function setupActionButtons() {
  // Handle payment action buttons
  document.querySelectorAll('.btn-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;

      if (action === 'approve-payment') {
        await approvePayment();
      } else if (action === 'reject-payment') {
        await rejectPayment();
      }
    });
  });

  // Handle individual document approve buttons
  document.querySelectorAll('.btn-doc-approve').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const documentType = btn.dataset.docType;
      await approveIndividualDocument(documentType);
    });
  });

  // Handle individual document reject buttons
  document.querySelectorAll('.btn-doc-reject').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const documentType = btn.dataset.docType;
      await rejectIndividualDocument(documentType);
    });
  });

  // Handle payment receipt approve button
  document.querySelectorAll('.btn-payment-approve').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await approvePayment();
    });
  });

  // Handle payment receipt reject button
  document.querySelectorAll('.btn-payment-reject').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await rejectPayment();
    });
  });

  // Handle edit code button in detail panel
  document.querySelectorAll('.btn-edit-code-detail').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const trackingId = btn.dataset.trackingId;
      showEditCodeModal(trackingId);
    });
  });

  // Handle view document buttons
  document.querySelectorAll('.btn-view-doc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const docUrl = btn.dataset.docUrl;
      if (docUrl) {
        window.open(`${BACKEND_URL}${docUrl}`, '_blank');
      }
    });
  });
  
  // Setup payment details form listeners
  setupPaymentDetailsFormListeners();
}

// Approve payment
async function approvePayment() {
  if (!confirm('Approve this payment? This will unlock the security code generation for the recipient.')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/verifications/${selectedVerification.id}/approve-payment`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to approve payment');

    alert('Payment approved! The recipient can now generate their security code.');
    await loadVerifications();
    closeDetailPanel();
  } catch (error) {
    console.error('Error approving payment:', error);
    alert('Failed to approve payment: ' + error.message);
  }
}

// Reject payment - show modal
async function rejectPayment() {
  // Show payment rejection modal
  document.getElementById('payment-rejection-tracking-id').textContent = selectedVerification.tracking_id;
  document.getElementById('preset-payment-rejection-reason').value = '';
  document.getElementById('custom-payment-rejection-reason').value = '';
  document.getElementById('custom-payment-rejection-reason-group').style.display = 'none';
  document.getElementById('payment-rejection-modal').style.display = 'flex';
}

// Process payment rejection after modal confirmation
async function processPaymentRejection() {
  const presetReason = document.getElementById('preset-payment-rejection-reason').value;
  const customReason = document.getElementById('custom-payment-rejection-reason').value;
  
  let reason = '';
  if (presetReason === 'custom') {
    reason = customReason.trim();
  } else {
    reason = presetReason;
  }

  if (!reason) {
    alert('Please select or enter a rejection reason.');
    return;
  }

  // Close modal
  document.getElementById('payment-rejection-modal').style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/verifications/${selectedVerification.id}/reject-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) throw new Error('Failed to reject payment');

    alert('Payment rejected. The recipient will be notified to resubmit.');
    await loadVerifications();
    closeDetailPanel();
  } catch (error) {
    console.error('Error rejecting payment:', error);
    alert('Failed to reject payment: ' + error.message);
  }
}

// Update header stats
function updateStats() {
  const pendingCount = verifications.filter(v =>
    v.status === 'documents_submitted' || v.status === 'payment_submitted' || v.payment_details_status === 'waiting'
  ).length;

  const today = new Date().toDateString();
  const activeCount = verifications.filter(v =>
    new Date(v.updated_at).toDateString() === today
  ).length;

  document.getElementById('pending-count').textContent = pendingCount;
  document.getElementById('active-count').textContent = activeCount;
}

// Helper functions
function getActionRequired(v) {
  if (v.payment_details_status === 'waiting') return 'Provide Payment Details';
  if (v.status === 'documents_submitted') return 'Review Documents';
  if (v.status === 'payment_submitted') return 'Review Payment';
  return null;
}

function formatStatus(status) {
  const statuses = {
    'initiated': 'Initiated',
    'documents_submitted': 'Documents Submitted',
    'documents_approved': 'Documents Approved',
    'payment_submitted': 'Payment Submitted',
    'escrow_confirmed': 'Escrow Confirmed',
    'code_generated': 'Code Generated',
    'completed': 'Completed'
  };
  return statuses[status] || status;
}

function formatEscrowStatus(status) {
  const statuses = {
    'pending': 'Pending',
    'pending_verification': 'Pending Verification',
    'confirmed': 'Confirmed',
    'refunded': 'Refunded'
  };
  return statuses[status] || status;
}

function formatIdType(type) {
  const types = {
    'passport': 'Passport',
    'national_id': 'National ID Card',
    'drivers_license': 'Driver\'s License'
  };
  return types[type] || type;
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showError(message) {
  const container = document.getElementById('verifications-list');
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠</div>
      <p>${message}</p>
    </div>
  `;
}

// Setup WebSocket connection for real-time updates
function setupWebSocket() {
  // Check if Socket.IO is available
  if (typeof io === 'undefined') {
    console.warn('Socket.IO client not loaded. Real-time updates will not work.');
    return;
  }

  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('[Admin] WebSocket connected');
    // Join admin room to receive all verification updates
    socket.emit('join_admin');
  });

  socket.on('disconnect', () => {
    console.log('[Admin] WebSocket disconnected');
  });

  // Listen for document approved events
  socket.on('document_approved', (data) => {
    console.log('[Admin] Document approved:', data);
    // Refresh verifications list to show updated status
    loadVerifications().then(() => {
      // If detail panel is open, refresh it too
      if (selectedVerification) {
        const updatedVerification = verifications.find(v => v.id === selectedVerification.id);
        if (updatedVerification) {
          selectedVerification = updatedVerification;
          showDetailPanel();
        }
      }
    });
  });

  // Listen for document rejected events
  socket.on('document_rejected', (data) => {
    console.log('[Admin] Document rejected:', data);
    // Refresh verifications list to show updated status
    loadVerifications().then(() => {
      // If detail panel is open, refresh it too
      if (selectedVerification) {
        const updatedVerification = verifications.find(v => v.id === selectedVerification.id);
        if (updatedVerification) {
          selectedVerification = updatedVerification;
          showDetailPanel();
        }
      }
    });
  });

  socket.on('connect_error', (error) => {
    console.error('[Admin] WebSocket connection error:', error);
  });
}

// Auto-refresh every 30 seconds
function startAutoRefresh() {
  setInterval(() => {
    loadVerifications();
  }, 30000);
}

// Approve individual document
async function approveIndividualDocument(documentType) {
  const docNames = {
    'passport': 'Passport / ID Document',
    'proof_of_address': 'Proof of Address',
    'selfie': 'Selfie with ID'
  };

  if (!confirm(`Approve ${docNames[documentType]}?`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/verifications/${selectedVerification.id}/approve-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType })
    });

    if (!response.ok) throw new Error('Failed to approve document');

    const result = await response.json();

    // IMMEDIATELY UPDATE ADMIN UI - Don't wait for page refresh
    const detailPanel = document.getElementById('panel-content');
    if (detailPanel) {
      const docNameMap = {
        'passport': 'Passport',
        'proof_of_address': 'Proof of Address',
        'selfie': 'Selfie'
      };

      const sections = detailPanel.querySelectorAll('[class*="document"]');
      sections.forEach(section => {
        if (section.textContent.includes(docNameMap[documentType])) {
          const badge = section.querySelector('.doc-status-badge');
          if (badge) {
            badge.className = 'doc-status-badge doc-approved';
            badge.innerHTML = '✓ Approved';
          }

          const actions = section.querySelector('.document-actions');
          if (actions) {
            actions.style.display = 'none';
          }
        }
      });
    }

    // Update local verification object
    if (documentType === 'passport') {
      selectedVerification.passport_approved = true;
    } else if (documentType === 'proof_of_address') {
      selectedVerification.proof_of_address_approved = true;
    } else if (documentType === 'selfie') {
      selectedVerification.selfie_approved = true;
    }

    if (result.allDocumentsApproved) {
      alert(`${docNames[documentType]} approved! All 3 documents are now approved. The recipient will be notified to proceed with Step 2 (Payment).`);
    } else {
      alert(`${docNames[documentType]} approved! Waiting for other documents to be approved.`);
    }

    await loadVerifications();

    // Update selectedVerification with fresh data but DON'T re-render the panel
    // We already updated the UI above, re-rendering would show buttons again
    const updatedVerification = verifications.find(v => v.id === selectedVerification.id);
    if (updatedVerification) {
      selectedVerification = updatedVerification;
    }
  } catch (error) {
    console.error('Error approving document:', error);
    alert('Failed to approve document: ' + error.message);
  }
}

// Reject individual document
async function rejectIndividualDocument(documentType) {
  const docNames = {
    'passport': 'Passport / ID Document',
    'proof_of_address': 'Proof of Address',
    'selfie': 'Selfie with ID'
  };

  // Show rejection modal instead of prompt
  pendingRejection = documentType;
  document.getElementById('rejection-document-name').textContent = docNames[documentType];
  document.getElementById('preset-rejection-reason').value = '';
  document.getElementById('custom-rejection-reason').value = '';
  document.getElementById('custom-rejection-reason-group').style.display = 'none';
  document.getElementById('rejection-modal').style.display = 'flex';
}

// Process rejection after modal confirmation
async function processDocumentRejection() {
  const presetReason = document.getElementById('preset-rejection-reason').value;
  const customReason = document.getElementById('custom-rejection-reason').value;
  
  let reason = '';
  if (presetReason === 'custom') {
    reason = customReason.trim();
  } else {
    reason = presetReason;
  }

  if (!reason) {
    alert('Please select or enter a rejection reason.');
    return;
  }

  const documentType = pendingRejection;
  const docNames = {
    'passport': 'Passport / ID Document',
    'proof_of_address': 'Proof of Address',
    'selfie': 'Selfie with ID'
  };
  
  // Close modal
  document.getElementById('rejection-modal').style.display = 'none';
  pendingRejection = null;

  try {
    const response = await fetch(`${API_BASE}/verifications/${selectedVerification.id}/reject-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentType, reason })
    });

    if (!response.ok) throw new Error('Failed to reject document');

    // IMMEDIATELY UPDATE ADMIN UI - Don't wait for page refresh
    const detailPanel = document.getElementById('panel-content');
    if (detailPanel) {
      const docNameMap = {
        'passport': 'Passport',
        'proof_of_address': 'Proof of Address',
        'selfie': 'Selfie'
      };

      const sections = detailPanel.querySelectorAll('[class*="document"]');
      let found = false;
      sections.forEach(section => {
        if (found) return;
        if (section.textContent.includes(docNameMap[documentType])) {
          found = true;

          const badge = section.querySelector('.doc-status-badge');
          if (badge) {
            badge.className = 'doc-status-badge doc-rejected';
            badge.innerHTML = '✗ Rejected';
          }

          let reasonDiv = section.querySelector('.rejection-reason');
          if (!reasonDiv) {
            reasonDiv = document.createElement('div');
            reasonDiv.className = 'rejection-reason';
            reasonDiv.style.cssText = `
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 8px 12px;
              border-radius: 4px;
              margin-top: 10px;
              font-size: 13px;
              color: #856404;
              max-height: 50px;
              overflow: hidden;
              line-height: 1.4;
            `;
            section.appendChild(reasonDiv);
          }
          reasonDiv.textContent = 'Reason: ' + reason;

          const actions = section.querySelector('.document-actions');
          if (actions) {
            actions.style.display = 'none';
          }
        }
      });
    }

    // Update local verification object
    if (documentType === 'passport') {
      selectedVerification.passport_approved = false;
      selectedVerification.passport_rejection_reason = reason;
    } else if (documentType === 'proof_of_address') {
      selectedVerification.proof_of_address_approved = false;
      selectedVerification.proof_of_address_rejection_reason = reason;
    } else if (documentType === 'selfie') {
      selectedVerification.selfie_approved = false;
      selectedVerification.selfie_rejection_reason = reason;
    }

    alert(`${docNames[documentType]} rejected. The recipient will be notified to resubmit this document.`);

    await loadVerifications();

    // Update selectedVerification with fresh data but DON'T re-render the panel
    // We already updated the UI above, re-rendering would show buttons again
    const updatedVerification = verifications.find(v => v.id === selectedVerification.id);
    if (updatedVerification) {
      selectedVerification = updatedVerification;
    }
  } catch (error) {
    console.error('Error rejecting document:', error);
    alert('Failed to reject document: ' + error.message);
  }
}

// ===========================
// SHIPMENT MANAGEMENT
// ===========================

// Setup tab switching
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      switchTab(currentTab);
    });
  });
}

// Switch between tabs
function switchTab(tab) {
  // Hide all tab contents
  document.getElementById('verifications-list').style.display = 'none';
  document.getElementById('shipments-tab').style.display = 'none';
  const sentEmailsTab = document.getElementById('sent-emails-tab');
  if (sentEmailsTab) {
    sentEmailsTab.style.display = 'none';
  }

  // Show selected tab
  if (tab === 'verifications') {
    document.getElementById('verifications-list').style.display = 'block';
    loadVerifications();
  } else if (tab === 'shipments') {
    document.getElementById('shipments-tab').style.display = 'block';
    loadShipments();
  } else if (tab === 'sent-emails' && sentEmailsTab) {
    sentEmailsTab.style.display = 'block';
    loadSentEmails();
  }

  // Update active tab button
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

// Load all shipments
async function loadShipments() {
  try {
    const response = await fetch(`${API_BASE}/shipments`);
    if (!response.ok) throw new Error('Failed to load shipments');

    shipments = await response.json();
    renderShipments();
  } catch (error) {
    console.error('Error loading shipments:', error);
    showShipmentsError('Failed to load shipments');
  }
}

// Render shipments table
function renderShipments() {
  const tbody = document.getElementById('shipments-tbody');

  if (shipments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #999;">
          No shipments found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = shipments.map(ship => `
    <tr>
      <td><strong>${ship.tracking_id}</strong></td>
      <td><span class="status-badge status-${ship.shipment_status}">${ship.shipment_status}</span></td>
      <td>${ship.current_location || '-'}</td>
      <td>${ship.recipient_email || '-'}</td>
      <td>
        ${ship.verification_token
          ? `<span class="badge-success">✓ Active</span>
             <button class="btn-action btn-view-link" data-token="${ship.verification_token}" data-id="${ship.tracking_id}" title="View Link">
               <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/></svg>
             </button>`
          : `<button class="btn-action btn-generate-link" data-id="${ship.tracking_id}" title="Generate Link">+</button>`
        }
      </td>
      <td>
        <code>${ship.security_code || '-'}</code>
        ${ship.security_code && !ship.code_verified
          ? `<button class="btn-action btn-edit-code" data-id="${ship.tracking_id}" title="Edit Code">
               <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
             </button>`
          : ship.code_verified
          ? `<span class="badge-verified">✓</span>`
          : ''
        }
        ${ship.code_attempts >= 3 && !ship.code_verified
          ? `<button class="btn-action btn-reset-attempts" data-id="${ship.tracking_id}" title="Reset Attempts" style="background: #ff6b6b;">
               <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
             </button>`
          : ship.code_attempts > 0 && ship.code_attempts < 3 && !ship.code_verified
          ? `<small class="attempts-warning">⚠ ${ship.code_attempts}/3</small>`
          : ''
        }
      </td>
      <td class="actions-cell">
        ${ship.recipient_email ? `<button class="btn-action btn-send-email" data-id="${ship.tracking_id}" title="Send Email">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>
        </button>` : ''}
        <button class="btn-action btn-view-details" data-id="${ship.tracking_id}" title="View Details">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/></svg>
        </button>
        <button class="btn-action btn-delete-shipment" data-id="${ship.tracking_id}" title="Delete Shipment" style="background: #dc3545;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>
      </td>
    </tr>
  `).join('');

  // Attach event listeners
  attachShipmentActions();
}

// Attach event listeners to shipment action buttons
function attachShipmentActions() {
  // Generate verification link buttons
  document.querySelectorAll('.btn-generate-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const trackingId = btn.dataset.id;
      generateVerificationLink(trackingId);
    });
  });

  // View link buttons
  document.querySelectorAll('.btn-view-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const token = btn.dataset.token;
      showVerificationLink(token);
    });
  });

  // Edit security code buttons
  document.querySelectorAll('.btn-edit-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const trackingId = btn.dataset.id;
      showEditCodeModal(trackingId);
    });
  });

  // Send email buttons
  document.querySelectorAll('.btn-send-email').forEach(btn => {
    btn.addEventListener('click', () => {
      const trackingId = btn.dataset.id;
      const shipment = shipments.find(s => s.tracking_id === trackingId);
      if (shipment && shipment.recipient_email) {
        // Use new production email modal
        if (typeof openProductionEmailModal === 'function') {
          openProductionEmailModal(trackingId, shipment.recipient_email, shipment.recipient_name || 'Recipient');
        } else {
          console.error('[Admin] Production email modal not loaded');
          alert('Email system not ready. Please refresh the page.');
        }
      } else {
        alert('No recipient email found for this shipment');
      }
    });
  });

  // View details buttons
  document.querySelectorAll('.btn-view-details').forEach(btn => {
    btn.addEventListener('click', async () => {
      const trackingId = btn.dataset.id;
      await viewShipmentDetails(trackingId);
    });
  });

  // Reset attempts buttons
  document.querySelectorAll('.btn-reset-attempts').forEach(btn => {
    btn.addEventListener('click', async () => {
      const trackingId = btn.dataset.id;
      await resetSecurityCodeAttempts(trackingId);
    });
  });

  // Delete shipment buttons
  document.querySelectorAll('.btn-delete-shipment').forEach(btn => {
    btn.addEventListener('click', async () => {
      const trackingId = btn.dataset.id;
      await deleteShipment(trackingId);
    });
  });
}

// Generate verification link for a shipment
async function generateVerificationLink(trackingId) {
  const recipientEmail = prompt('Recipient Email:');
  if (!recipientEmail) return;

  const recipientName = prompt('Recipient Full Name:');
  if (!recipientName) return;

  const escrowAmount = prompt('Escrow Amount (EUR):', '56000');

  try {
    const response = await fetch(`${API_BASE}/shipments/${trackingId}/generate-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        escrow_amount: escrowAmount || 56000
      })
    });

    if (!response.ok) throw new Error('Failed to generate verification link');

    const result = await response.json();

    const url = `${FRONTEND_URL}/recipient-verification.html?token=${result.verification_token}`;

    // Show link in alert
    alert(`Verification Link Generated:\n\n${url}\n\nToken: ${result.verification_token}\n\n${result.existing ? '(This link already existed)' : '(New link created)'}`);

    // Reload shipments to show updated state
    loadShipments();
  } catch (error) {
    console.error('Error generating link:', error);
    alert('Failed to generate verification link: ' + error.message);
  }
}

// Show verification link for existing verification
function showVerificationLink(token) {
  const url = `${FRONTEND_URL}/recipient-verification.html?token=${token}`;

  // Create a copyable alert with the link
  const copyToClipboard = confirm(
    `Verification Link:\n\n${url}\n\nToken: ${token}\n\nClick OK to copy the link to clipboard, or Cancel to close.`
  );

  if (copyToClipboard) {
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    }).catch(() => {
      alert('Could not copy to clipboard. Please copy manually:\n\n' + url);
    });
  }
}

// Show edit code modal
function showEditCodeModal(trackingId) {
  // Try to find in shipments array first
  let shipment = shipments.find(s => s.tracking_id === trackingId);

  // If not found and we have a selected verification, use that
  if (!shipment && selectedVerification && selectedVerification.tracking_id === trackingId) {
    shipment = selectedVerification;
  }

  if (!shipment) {
    console.error('[Edit Code] Could not find shipment/verification for tracking ID:', trackingId);
    alert('Error: Could not find verification data');
    return;
  }

  if (shipment.code_verified) {
    alert('Cannot edit: Security code has already been verified');
    return;
  }

  console.log('[Edit Code] Opening modal for:', trackingId, 'Current code:', shipment.security_code);

  document.getElementById('code-tracking-id').textContent = trackingId;
  document.getElementById('new-security-code').value = shipment.security_code || '';
  document.getElementById('code-modal').style.display = 'flex';

  // Store tracking ID for save action
  document.getElementById('save-code').dataset.trackingId = trackingId;
}

// Save security code
async function saveSecurityCode() {
  const trackingId = document.getElementById('save-code').dataset.trackingId;
  const newCode = document.getElementById('new-security-code').value.trim().toUpperCase();

  // Validate format
  if (!/^[A-Z0-9]{10}$/.test(newCode)) {
    alert('Security code must be exactly 10 alphanumeric uppercase characters (A-Z, 0-9)');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/shipments/${trackingId}/security-code`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ security_code: newCode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update security code');
    }

    alert('Security code updated successfully!');
    document.getElementById('code-modal').style.display = 'none';
    loadShipments();
  } catch (error) {
    console.error('Error updating code:', error);
    alert('Failed to update security code: ' + error.message);
  }
}

// Reset security code attempts for a shipment
async function resetSecurityCodeAttempts(trackingId) {
  if (!confirm(`Reset security code attempts for ${trackingId}?\n\nThis will allow the recipient to try entering the code again (3 new attempts).`)) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/shipments/${trackingId}/reset-attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset attempts');
    }

    const result = await response.json();
    alert(`✓ Attempts reset successfully!\n\nThe recipient now has ${result.attemptsRemaining} attempts to enter the security code.`);
    loadShipments();
  } catch (error) {
    console.error('Error resetting attempts:', error);
    alert('Failed to reset attempts: ' + error.message);
  }
}

// Delete shipment and all related data
async function deleteShipment(trackingId) {
  if (!confirm(`⚠️ DELETE SHIPMENT ${trackingId}?\n\nThis will permanently delete:\n- The shipment record\n- All tracking events\n- IOOPS verification (if exists)\n- All related audit logs\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`)) {
    return;
  }

  // Double confirmation for safety
  const confirmText = prompt(`To confirm deletion, type the tracking ID exactly:\n${trackingId}`);
  if (confirmText !== trackingId) {
    alert('Deletion cancelled - tracking ID did not match');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/shipments/${trackingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete shipment');
    }

    const result = await response.json();
    alert(`✓ Shipment ${trackingId} deleted successfully!\n\nAll related data has been permanently removed from the database.`);
    loadShipments(); // Refresh the list
  } catch (error) {
    console.error('Error deleting shipment:', error);
    alert('Failed to delete shipment: ' + error.message);
  }
}

// Load email templates
async function loadEmailTemplates() {
  try {
    const response = await fetch(`${API_BASE}/email-templates`);
    if (!response.ok) throw new Error('Failed to load email templates');

    emailTemplates = await response.json();
  } catch (error) {
    console.error('Error loading templates:', error);
  }
}

// Show email modal
function showEmailModal(trackingId) {
  const shipment = shipments.find(s => s.tracking_id === trackingId);
  if (!shipment || !shipment.recipient_email) {
    alert('No recipient email found for this shipment');
    return;
  }

  document.getElementById('email-modal').style.display = 'flex';
  document.getElementById('send-email').dataset.trackingId = trackingId;

  // Populate from aliases
  populateFromAliases();

  // Populate templates based on category
  populateTemplates();
}

// Populate from email aliases
function populateFromAliases() {
  // Map alias keys to display addresses (matches email-config.js structure)
  const aliases = [
    { key: 'compliance', display: 'compliance@ioops.org' },
    { key: 'oversight', display: 'oversight@ioops.org' },
    { key: 'verification', display: 'verification@ioops.org' },
    { key: 'clearance', display: 'clearance@ioops.org' },
    { key: 'security', display: 'security@ioops.org' },
    { key: 'coordination', display: 'coordination@ioops.org' },
    { key: 'protocols', display: 'protocols@ioops.org' },
    { key: 'europe', display: 'europe@ioops.org' },
    { key: 'operationsSupport', display: 'operations-support@ioops.org' },
    { key: 'transit', display: 'transit@ioops.org' },
    { key: 'geneva', display: 'geneva@ioops.org' },
    { key: 'brussels', display: 'brussels@ioops.org' },
    { key: 'washington', display: 'washington@ioops.org' },
    { key: 'singapore', display: 'singapore@ioops.org' },
    { key: 'dubai', display: 'dubai@ioops.org' },
    { key: 'standards', display: 'standards@ioops.org' },
    { key: 'documentation', display: 'documentation@ioops.org' },
    { key: 'legal', display: 'legal@ioops.org' },
    { key: 'press', display: 'press@ioops.org' },
    { key: 'partnerships', display: 'partnerships@ioops.org' }
  ];

  const select = document.getElementById('from-alias');
  select.innerHTML = '<option value="">Select email address...</option>' +
    aliases.map(alias => `<option value="${alias.key}">${alias.display}</option>`).join('');
}

// Populate email templates based on category
function populateTemplates() {
  const category = document.getElementById('template-category').value;
  const templates = category ? emailTemplates.filter(t => t.category === category) : [];

  const select = document.getElementById('template-name');
  select.innerHTML = '<option value="">Select template...</option>' +
    templates.map(t => `<option value="${t.filename}">${t.name}</option>`).join('');
}

// Send email from template
async function sendEmailFromTemplate() {
  const trackingId = document.getElementById('send-email').dataset.trackingId;
  const category = document.getElementById('template-category').value;
  const templateName = document.getElementById('template-name').value;
  const fromAlias = document.getElementById('from-alias').value;
  const customMessage = document.getElementById('custom-message').value;

  if (!category) {
    alert('Please select a template category');
    return;
  }

  if (!templateName) {
    alert('Please select a template');
    return;
  }

  if (!fromAlias) {
    alert('Please select a sender email address');
    return;
  }

  if (!customMessage.trim()) {
    alert('Please enter your message');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_id: trackingId,
        template_category: category,
        template_name: templateName.replace('.html', ''),
        from_alias: fromAlias,
        custom_message: customMessage
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send email');
    }

    alert('Email sent successfully!');
    document.getElementById('email-modal').style.display = 'none';
    // Clear form
    document.getElementById('custom-message').value = '';
  } catch (error) {
    console.error('Error sending email:', error);
    alert('Failed to send email: ' + error.message);
  }
}

// View shipment details
async function viewShipmentDetails(trackingId) {
  try {
    const response = await fetch(`${API_BASE}/shipments/${trackingId}`);
    if (!response.ok) throw new Error('Failed to load shipment details');

    const details = await response.json();
    const shipment = details.shipment;
    const verification = details.verification;
    const history = details.history || [];

    // Populate modal fields
    document.getElementById('detail-tracking-id').textContent = trackingId;
    document.getElementById('detail-status').textContent = shipment.status || 'N/A';
    document.getElementById('detail-location').textContent = shipment.current_location || 'N/A';

    // Declared value
    if (shipment.shipment_value) {
      document.getElementById('detail-declared-value').textContent =
        `€${Number(shipment.shipment_value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    } else {
      document.getElementById('detail-declared-value').textContent = 'N/A';
    }

    // Sender & Receiver
    document.getElementById('detail-sender-name').textContent = shipment.sender_name || 'N/A';
    document.getElementById('detail-receiver-name').textContent = shipment.recipient_name || 'N/A';
    document.getElementById('detail-sender-address').textContent = shipment.sender_address || 'N/A';
    document.getElementById('detail-receiver-address').textContent = shipment.recipient_address || 'N/A';

    // Security & Verification
    document.getElementById('detail-security-code').textContent = shipment.security_code || 'N/A';
    document.getElementById('detail-code-verified').textContent = shipment.code_verified ? 'Yes' : 'No';

    if (verification) {
      document.getElementById('detail-verification-status').textContent = verification.status || 'N/A';
      document.getElementById('detail-escrow-amount').textContent = verification.escrow_amount
        ? `€${Number(verification.escrow_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        : 'N/A';
      document.getElementById('detail-escrow-status').textContent = verification.escrow_status || 'N/A';
      document.getElementById('detail-recipient-email').textContent = verification.recipient_email || 'N/A';
    } else {
      document.getElementById('detail-verification-status').textContent = 'No verification';
      document.getElementById('detail-escrow-amount').textContent = 'N/A';
      document.getElementById('detail-escrow-status').textContent = 'N/A';
      document.getElementById('detail-recipient-email').textContent = 'N/A';
    }

    // Recent History
    const historyContainer = document.getElementById('detail-recent-history');
    if (history.length > 0) {
      historyContainer.innerHTML = history.slice(0, 10).map(h => `
        <div style="padding: 10px; border-left: 3px solid #0891b2; margin-bottom: 10px; background: #f9fafb;">
          <div style="font-weight: 600; color: #1f2937;">${h.status}</div>
          <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">${formatDate(h.timestamp)}</div>
          ${h.location ? `<div style="font-size: 13px; color: #6b7280;">Location: ${h.location}</div>` : ''}
        </div>
      `).join('');
    } else {
      historyContainer.innerHTML = '<p style="color: #6b7280; font-style: italic;">No history available</p>';
    }

    // Show modal
    document.getElementById('shipment-details-modal').style.display = 'block';
  } catch (error) {
    console.error('Error loading details:', error);
    alert('Failed to load shipment details: ' + error.message);
  }
}

// Setup modal event listeners
function setupModalListeners() {
  // Helper function to safely add event listeners
  const addListener = (id, event, handler) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  };

  // Close email modal
  addListener('close-email-modal', 'click', () => {
    document.getElementById('email-modal').style.display = 'none';
  });

  addListener('cancel-email', 'click', () => {
    document.getElementById('email-modal').style.display = 'none';
  });

  // Send email button
  addListener('send-email', 'click', sendEmailFromTemplate);

  // Template category change
  addListener('template-category', 'change', populateTemplates);

  // Close code modal
  addListener('close-code-modal', 'click', () => {
    document.getElementById('code-modal').style.display = 'none';
  });

  addListener('cancel-code', 'click', () => {
    document.getElementById('code-modal').style.display = 'none';
  });

  // Save code button
  addListener('save-code', 'click', saveSecurityCode);

  // Payment rejection modal
  addListener('preset-payment-rejection-reason', 'change', (e) => {
    const customGroup = document.getElementById('custom-payment-rejection-reason-group');
    if (e.target.value === 'custom') {
      customGroup.style.display = 'block';
    } else {
      customGroup.style.display = 'none';
    }
  });

  addListener('close-payment-rejection-modal', 'click', () => {
    document.getElementById('payment-rejection-modal').style.display = 'none';
  });

  addListener('cancel-payment-rejection', 'click', () => {
    document.getElementById('payment-rejection-modal').style.display = 'none';
  });

  addListener('confirm-payment-rejection', 'click', async () => {
    await processPaymentRejection();
  });

  // Refresh shipments button (may not exist on verifications tab)
  addListener('refresh-shipments-btn', 'click', () => {
    loadShipments();
  });

  // Shipment filters (may not exist on verifications tab)
  addListener('shipment-status-filter', 'change', () => {
    loadShipments();
  });

  addListener('shipment-search', 'input', () => {
    loadShipments();
  });

  // Shipment details modal
  addListener('close-shipment-details-modal', 'click', () => {
    document.getElementById('shipment-details-modal').style.display = 'none';
  });

  addListener('close-shipment-details-btn', 'click', () => {
    document.getElementById('shipment-details-modal').style.display = 'none';
  });

  // Close modal when clicking outside
  const shipmentDetailsModal = document.getElementById('shipment-details-modal');
  if (shipmentDetailsModal) {
    shipmentDetailsModal.addEventListener('click', (e) => {
      if (e.target === shipmentDetailsModal) {
        shipmentDetailsModal.style.display = 'none';
      }
    });
  }
}

// Show shipments error
function showShipmentsError(message) {
  const tbody = document.getElementById('shipments-tbody');
  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px; color: #dc3545;">
        ⚠ ${message}
      </td>
    </tr>
  `;
}

// ===========================
// SENT EMAILS MANAGEMENT
// ===========================

// Load sent emails from backend
async function loadSentEmails() {
  console.log('[Sent Emails] Loading sent emails history...');

  try {
    const params = new URLSearchParams();
    if (sentEmailsFilters.company) {
      params.append('company', sentEmailsFilters.company);
    }
    params.append('limit', '100');

    const url = `${PRODUCTION_EMAIL_API}/sent-history?${params.toString()}`;
    console.log('[Sent Emails] Fetching from:', url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to load sent emails');
    }

    const data = await response.json();
    sentEmails = data.emails || [];

    console.log('[Sent Emails] Loaded', sentEmails.length, 'emails');
    renderSentEmails();
  } catch (error) {
    console.error('[Sent Emails] Error loading:', error);
    showSentEmailsError('Failed to load sent emails: ' + error.message);
  }
}

// Render sent emails table
function renderSentEmails() {
  const tbody = document.getElementById('sent-emails-tbody');
  if (!tbody) return;

  // Apply search filter
  let filtered = sentEmails;
  if (sentEmailsFilters.search) {
    const query = sentEmailsFilters.search.toLowerCase();
    filtered = sentEmails.filter(email => {
      const searchText = `${email.tracking_id} ${email.to_email} ${email.to_name} ${email.template_id}`.toLowerCase();
      return searchText.includes(query);
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
          No sent emails found
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(email => {
    const date = new Date(email.sent_at);
    const companyBadge = email.company === 'IOOPS'
      ? '<span class="badge-ioops">IOOPS</span>'
      : '<span class="badge-meridian">Meridian</span>';

    const testModeBadge = email.test_mode
      ? '<span class="badge-test">TEST</span>'
      : '';

    return `
      <tr>
        <td>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</td>
        <td>
          <strong>${email.template_id.split('-').slice(0, 2).join('-')}</strong><br>
          <small style="color: #666;">${getTemplateShortName(email.template_id)}</small>
        </td>
        <td>${companyBadge} ${testModeBadge}</td>
        <td>
          <strong>${email.to_name}</strong><br>
          <small>${email.to_email}</small>
        </td>
        <td><strong>${email.tracking_id}</strong></td>
        <td><small>${email.from_email}</small></td>
        <td><small>${email.sent_by}</small></td>
        <td>
          <button class="btn-view-sent-email" data-email-id="${email.id}" style="padding: 5px 10px; font-size: 12px;">View</button>
        </td>
      </tr>
    `;
  }).join('');

  // Add click handlers for view buttons
  document.querySelectorAll('.btn-view-sent-email').forEach(btn => {
    btn.addEventListener('click', () => {
      const emailId = parseInt(btn.dataset.emailId);
      viewSentEmailDetails(emailId);
    });
  });
}

// Get short template name
function getTemplateShortName(templateId) {
  const parts = templateId.split('-');
  if (parts.length > 2) {
    return parts.slice(2).join(' ');
  }
  return templateId;
}

// View sent email details
function viewSentEmailDetails(emailId) {
  const email = sentEmails.find(e => e.id === emailId);
  if (!email) return;

  const date = new Date(email.sent_at);
  const details = `
📧 Sent Email Details
═══════════════════════════════════

Template: ${email.template_id}
Company: ${email.company}${email.test_mode ? ' (TEST MODE)' : ''}

From: ${email.from_email}
To: ${email.to_name} <${email.to_email}>

Subject: ${email.subject}

Tracking ID: ${email.tracking_id}
Message ID: ${email.message_id}

Sent At: ${date.toLocaleString()}
Sent By: ${email.sent_by}
  `.trim();

  alert(details);
}

// Show sent emails error
function showSentEmailsError(message) {
  const tbody = document.getElementById('sent-emails-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #dc3545;">
          ⚠ ${message}
        </td>
      </tr>
    `;
  }
}

// Setup sent emails filters
function setupSentEmailsFilters() {
  const companyFilter = document.getElementById('sent-emails-company-filter');
  if (companyFilter) {
    companyFilter.addEventListener('change', (e) => {
      sentEmailsFilters.company = e.target.value;
      loadSentEmails();
    });
  }

  const searchInput = document.getElementById('sent-emails-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      sentEmailsFilters.search = e.target.value;
      renderSentEmails();
    });
  }

  const refreshBtn = document.getElementById('refresh-sent-emails-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadSentEmails();
    });
  }
}

// Initialize sent emails filters
document.addEventListener('DOMContentLoaded', () => {
  setupSentEmailsFilters();
});

// Render payment details request section in admin panel
function renderPaymentDetailsSection(v) {
  if (!v.payment_method_requested) {
    return '';
  }

  const methodNames = {
    'bank_transfer': 'Bank Transfer',
    'cryptocurrency': 'Cryptocurrency',
    'other': 'Other Payment Method'
  };

  const methodName = methodNames[v.payment_method_requested] || v.payment_method_requested;

  if (v.payment_details_status === 'waiting') {
    // Show form to provide payment details
    return `
      <div class="detail-section" style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px;">
        <h3 class="section-title" style="color: #92400e;">⚠️ Payment Details Requested</h3>
        <p style="color: #78350f; margin-bottom: 16px;">
          Recipient has requested <strong>${methodName}</strong> details. Provide the account information below.
        </p>

        <div id="payment-details-form-container">
          ${renderPaymentDetailsForm(v.payment_method_requested)}
        </div>

        <div class="action-buttons" style="margin-top: 20px;">
          <button class="btn-primary" id="send-payment-details-btn">Send Details to Recipient</button>
          <button class="btn-secondary" id="cancel-payment-details-btn">Cancel</button>
        </div>
      </div>
    `;
  } else if (v.payment_details_status === 'provided') {
    // Show provided details
    return `
      <div class="detail-section">
        <h3 class="section-title">✓ Payment Details Provided</h3>
        <div class="approval-notice" style="margin-bottom: 12px;">
          Payment details for <strong>${methodName}</strong> were sent on ${formatDate(v.payment_details_provided_at)}
        </div>

        <button class="btn-secondary" id="toggle-payment-details-btn" style="margin-bottom: 12px;">
          <span id="payment-details-toggle-icon">▼</span> View Payment Details Sent
        </button>

        <div id="provided-payment-details-content" style="display: none; margin-top: 12px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #374151;">Details Provided to Recipient:</h4>
          <div class="detail-grid">
            ${renderProvidedPaymentDetails(v.payment_method_requested, v.payment_details)}
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

// Render payment details form based on method
function renderPaymentDetailsForm(method) {
  if (method === 'bank_transfer') {
    return `
      <div class="form-group">
        <label>Bank Name *</label>
        <input type="text" id="payment-bank-name" placeholder="e.g., BNP Paribas" required>
      </div>
      <div class="form-group">
        <label>Account Holder *</label>
        <input type="text" id="payment-account-holder" placeholder="Full name on account" required>
      </div>
      <div class="form-group">
        <label>IBAN *</label>
        <input type="text" id="payment-iban" placeholder="FR76 3000 4025 1800 0100 0509 383" required>
      </div>
      <div class="form-group">
        <label>SWIFT/BIC *</label>
        <input type="text" id="payment-swift" placeholder="BNPAFRPP" required>
      </div>
      <div class="form-group">
        <label>Reference (Optional)</label>
        <input type="text" id="payment-reference" placeholder="Payment reference">
      </div>
      <div class="form-group">
        <label>Additional Info (Optional)</label>
        <textarea id="payment-additional-info" rows="3" placeholder="Any special instructions..."></textarea>
      </div>
    `;
  } else if (method === 'cryptocurrency') {
    return `
      <div class="form-group">
        <label>Cryptocurrency Type *</label>
        <select id="payment-crypto-type" required>
          <option value="">Select cryptocurrency...</option>
          <option value="Bitcoin (BTC)">Bitcoin (BTC)</option>
          <option value="USDT (TRC20)">USDT (TRC20)</option>
          <option value="USDT (ERC20)">USDT (ERC20)</option>
          <option value="Ethereum (ETH)">Ethereum (ETH)</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Network *</label>
        <input type="text" id="payment-network" placeholder="e.g., Bitcoin Network, Tron (TRC20)" required>
      </div>
      <div class="form-group">
        <label>Wallet Address *</label>
        <input type="text" id="payment-wallet" placeholder="Full wallet address" required>
      </div>
      <div class="form-group">
        <label>Amount in Crypto (Optional)</label>
        <input type="text" id="payment-crypto-amount" placeholder="e.g., 0.0123 BTC">
      </div>
      <div class="form-group">
        <label>Additional Info (Optional)</label>
        <textarea id="payment-additional-info" rows="3" placeholder="Any special instructions..."></textarea>
      </div>
    `;
  } else {
    // Other payment methods
    return `
      <div class="form-group">
        <label>Payment Method Name *</label>
        <input type="text" id="payment-method-name" placeholder="e.g., PayPal, Western Union" required>
      </div>
      <div class="form-group">
        <label>Account/ID *</label>
        <input type="text" id="payment-account-info" placeholder="Account number or ID" required>
      </div>
      <div class="form-group">
        <label>Recipient Name (Optional)</label>
        <input type="text" id="payment-recipient-name" placeholder="Name to send payment to">
      </div>
      <div class="form-group">
        <label>Reference (Optional)</label>
        <input type="text" id="payment-reference" placeholder="Reference or memo">
      </div>
      <div class="form-group">
        <label>Instructions *</label>
        <textarea id="payment-instructions" rows="4" placeholder="Detailed instructions for recipient..." required></textarea>
      </div>
    `;
  }
}

// Render provided payment details
function renderProvidedPaymentDetails(method, details) {
  if (!details) return '<p>No details available</p>';

  if (method === 'bank_transfer') {
    return `
      <div class="detail-item"><span class="detail-label">Bank Name</span><span class="detail-value">${details.bank_name || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">Account Holder</span><span class="detail-value">${details.account_holder || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">IBAN</span><span class="detail-value">${details.iban || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">SWIFT/BIC</span><span class="detail-value">${details.swift_bic || 'N/A'}</span></div>
      ${details.reference ? `<div class="detail-item"><span class="detail-label">Reference</span><span class="detail-value">${details.reference}</span></div>` : ''}
      ${details.additional_info ? `<div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Additional Info</span><span class="detail-value">${details.additional_info}</span></div>` : ''}
    `;
  } else if (method === 'cryptocurrency') {
    return `
      <div class="detail-item"><span class="detail-label">Cryptocurrency</span><span class="detail-value">${details.crypto_type || 'N/A'}</span></div>
      <div class="detail-item"><span class="detail-label">Network</span><span class="detail-value">${details.network || 'N/A'}</span></div>
      <div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Wallet Address</span><span class="detail-value" style="font-family: monospace; word-break: break-all;">${details.wallet_address || 'N/A'}</span></div>
      ${details.amount_crypto ? `<div class="detail-item"><span class="detail-label">Amount</span><span class="detail-value">${details.amount_crypto}</span></div>` : ''}
      ${details.additional_info ? `<div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Additional Info</span><span class="detail-value">${details.additional_info}</span></div>` : ''}
    `;
  } else {
    return `
      <div class="detail-item"><span class="detail-label">Payment Method</span><span class="detail-value">${details.method_name || 'N/A'}</span></div>
      ${details.account_info ? `<div class="detail-item"><span class="detail-label">Account/ID</span><span class="detail-value">${details.account_info}</span></div>` : ''}
      ${details.recipient_name ? `<div class="detail-item"><span class="detail-label">Recipient Name</span><span class="detail-value">${details.recipient_name}</span></div>` : ''}
      ${details.reference ? `<div class="detail-item"><span class="detail-label">Reference</span><span class="detail-value">${details.reference}</span></div>` : ''}
      ${details.instructions ? `<div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Instructions</span><span class="detail-value" style="white-space: pre-wrap;">${details.instructions}</span></div>` : ''}
    `;
  }
}

// Collect payment details from form
function collectPaymentDetailsFromForm(method) {
  console.log('[Admin] Collecting payment details for method:', method);

  if (method === 'bank_transfer') {
    const bankNameEl = document.getElementById('payment-bank-name');
    const accountHolderEl = document.getElementById('payment-account-holder');
    const ibanEl = document.getElementById('payment-iban');
    const swiftEl = document.getElementById('payment-swift');
    const referenceEl = document.getElementById('payment-reference');
    const additionalInfoEl = document.getElementById('payment-additional-info');

    console.log('[Admin] Form elements found:', {
      bankName: !!bankNameEl,
      accountHolder: !!accountHolderEl,
      iban: !!ibanEl,
      swift: !!swiftEl
    });

    console.log('[Admin] Form values:', {
      bank_name: bankNameEl?.value,
      account_holder: accountHolderEl?.value,
      iban: ibanEl?.value,
      swift_bic: swiftEl?.value
    });

    return {
      bank_name: bankNameEl?.value?.trim() || '',
      account_holder: accountHolderEl?.value?.trim() || '',
      iban: ibanEl?.value?.trim() || '',
      swift_bic: swiftEl?.value?.trim() || '',
      reference: referenceEl?.value?.trim() || '',
      additional_info: additionalInfoEl?.value?.trim() || ''
    };
  } else if (method === 'cryptocurrency') {
    return {
      crypto_type: document.getElementById('payment-crypto-type')?.value || '',
      network: document.getElementById('payment-network')?.value || '',
      wallet_address: document.getElementById('payment-wallet')?.value || '',
      amount_crypto: document.getElementById('payment-crypto-amount')?.value || '',
      additional_info: document.getElementById('payment-additional-info')?.value || ''
    };
  } else {
    return {
      method_name: document.getElementById('payment-method-name')?.value || '',
      account_info: document.getElementById('payment-account-info')?.value || '',
      recipient_name: document.getElementById('payment-recipient-name')?.value || '',
      reference: document.getElementById('payment-reference')?.value || '',
      instructions: document.getElementById('payment-instructions')?.value || ''
    };
  }
}

// Send payment details to recipient
async function sendPaymentDetailsToRecipient() {
  if (!selectedVerification) return;

  const method = selectedVerification.payment_method_requested;
  const paymentDetails = collectPaymentDetailsFromForm(method);

  console.log('[Admin] Sending payment details for method:', method);
  console.log('[Admin] Collected payment details:', paymentDetails);

  // Validate required fields
  if (method === 'bank_transfer' && (!paymentDetails.bank_name || !paymentDetails.iban || !paymentDetails.swift_bic)) {
    console.error('[Admin] Validation failed:', {
      bank_name: paymentDetails.bank_name,
      iban: paymentDetails.iban,
      swift_bic: paymentDetails.swift_bic
    });
    alert('Please fill in all required fields (Bank Name, IBAN, SWIFT/BIC)');
    return;
  }
  if (method === 'cryptocurrency' && (!paymentDetails.crypto_type || !paymentDetails.network || !paymentDetails.wallet_address)) {
    alert('Please fill in all required fields (Crypto Type, Network, Wallet Address)');
    return;
  }
  if (method === 'other' && (!paymentDetails.method_name || !paymentDetails.instructions)) {
    alert('Please fill in all required fields (Method Name, Instructions)');
    return;
  }

  try {
    console.log('[Admin] Sending payment details:', paymentDetails);

    const response = await fetch(`${BACKEND_URL}/api/admin/verifications/${selectedVerification.id}/provide-payment-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_details: paymentDetails })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send payment details');
    }

    const result = await response.json();
    console.log('[Admin] Payment details sent successfully:', result);

    alert('Payment details sent to recipient successfully!');

    // Refresh verification data
    await loadVerifications();

    // Refresh detail panel
    const updatedVerification = verifications.find(v => v.id === selectedVerification.id);
    if (updatedVerification) {
      selectedVerification = updatedVerification;
      showDetailPanel();
    }

  } catch (error) {
    console.error('[Admin] Error sending payment details:', error);
    alert('Failed to send payment details: ' + error.message);
  }
}

// Setup payment details form listeners
function setupPaymentDetailsFormListeners() {
  const sendBtn = document.getElementById('send-payment-details-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendPaymentDetailsToRecipient);
  }

  const cancelBtn = document.getElementById('cancel-payment-details-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (confirm('Cancel payment details form? The recipient is still waiting.')) {
        closeDetailPanel();
      }
    });
  }

  // Toggle payment details visibility
  const toggleBtn = document.getElementById('toggle-payment-details-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const content = document.getElementById('provided-payment-details-content');
      const icon = document.getElementById('payment-details-toggle-icon');
      if (content && icon) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        icon.textContent = isVisible ? '▼' : '▲';
        toggleBtn.innerHTML = `<span id="payment-details-toggle-icon">${isVisible ? '▼' : '▲'}</span> ${isVisible ? 'View' : 'Hide'} Payment Details Sent`;
      }
    });
  }
}
