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

// Reject payment
async function rejectPayment() {
  const reason = prompt('Enter reason for rejection (will be sent to recipient):');
  if (!reason) return;

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
    v.status === 'documents_submitted' || v.status === 'payment_submitted'
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

  // Show selected tab
  if (tab === 'verifications') {
    document.getElementById('verifications-list').style.display = 'block';
    loadVerifications();
  } else if (tab === 'shipments') {
    document.getElementById('shipments-tab').style.display = 'block';
    loadShipments();
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
             <button class="btn-view-link" data-token="${ship.verification_token}" data-id="${ship.tracking_id}">View Link</button>`
          : `<button class="btn-generate-link" data-id="${ship.tracking_id}">Generate Link</button>`
        }
      </td>
      <td>
        <code>${ship.security_code || '-'}</code>
        ${ship.security_code && !ship.code_verified
          ? `<button class="btn-edit-code" data-id="${ship.tracking_id}">Edit</button>`
          : ship.code_verified
          ? `<span class="badge-verified">✓ Verified</span>`
          : ''
        }
        ${ship.code_attempts >= 3 && !ship.code_verified
          ? `<button class="btn-reset-attempts" data-id="${ship.tracking_id}" style="background: #ff6b6b; margin-left: 5px;">🔄 Reset Attempts</button>`
          : ship.code_attempts > 0 && ship.code_attempts < 3 && !ship.code_verified
          ? `<small style="color: #ff6b6b; display: block; margin-top: 4px;">⚠ ${ship.code_attempts}/3 attempts used</small>`
          : ''
        }
      </td>
      <td>
        ${ship.recipient_email ? `<button class="btn-send-email" data-id="${ship.tracking_id}">📧 Email</button>` : ''}
        <button class="btn-view-details" data-id="${ship.tracking_id}">View</button>
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
      showEmailModal(trackingId);
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
  const shipment = shipments.find(s => s.tracking_id === trackingId);
  if (!shipment) return;

  if (shipment.code_verified) {
    alert('Cannot edit: Security code has already been verified');
    return;
  }

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

    // Display details in alert (could be enhanced with a modal later)
    let detailsText = `Shipment: ${trackingId}\n\n`;
    detailsText += `Status: ${details.shipment.status}\n`;
    detailsText += `Location: ${details.shipment.current_location || 'N/A'}\n`;
    detailsText += `Security Code: ${details.shipment.security_code || 'N/A'}\n`;
    detailsText += `Code Verified: ${details.shipment.code_verified ? 'Yes' : 'No'}\n\n`;

    if (details.verification) {
      detailsText += `Verification:\n`;
      detailsText += `  Email: ${details.verification.recipient_email}\n`;
      detailsText += `  Status: ${details.verification.status}\n`;
      detailsText += `  Escrow: ${details.verification.escrow_status}\n\n`;
    }

    detailsText += `Recent History:\n`;
    if (details.history.length > 0) {
      details.history.slice(0, 5).forEach(h => {
        detailsText += `  ${formatDate(h.timestamp)}: ${h.status}\n`;
      });
    } else {
      detailsText += `  No history available\n`;
    }

    alert(detailsText);
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