
// ===== STEP 3: CODE GENERATION - SCRATCH-OFF & ACTIONS =====

// Scratch-off canvas functionality
function initializeScratchOff() {
  const canvas = document.createElement('canvas');
  canvas.id = 'scratch-canvas';
  canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; border-radius: 12px;';

  const codeDisplayEl = document.getElementById('security-code-display');
  if (!codeDisplayEl) return;

  const parent = codeDisplayEl.parentElement;
  if (!parent) return;

  // Make parent position relative for absolute canvas
  parent.style.position = 'relative';
  parent.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const rect = parent.getBoundingClientRect();

  // Set canvas size
  canvas.width = rect.width;
  canvas.height = rect.height;

  // Draw scratch-off overlay (silver lottery ticket style)
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#c0c0c0');
  gradient.addColorStop(0.5, '#e8e8e8');
  gradient.addColorStop(1, '#a8a8a8');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add texture pattern
  for (let i = 0; i < 50; i++) {
    const randomR = Math.random() * 50 + 150;
    const randomG = Math.random() * 50 + 150;
    const randomB = Math.random() * 50 + 150;
    ctx.fillStyle = `rgba(${randomR}, ${randomG}, ${randomB}, 0.3)`;
    const randomX = Math.random() * canvas.width;
    const randomY = Math.random() * canvas.height;
    const randomW = Math.random() * 20 + 5;
    const randomH = Math.random() * 20 + 5;
    ctx.fillRect(randomX, randomY, randomW, randomH);
  }

  // Add "SCRATCH TO REVEAL" text
  ctx.fillStyle = '#667eea';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCRATCH TO REVEAL', canvas.width / 2, canvas.height / 2);

  let isScratching = false;
  let scratchedPercentage = 0;

  function scratch(x, y) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
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
        copyBtn.style.color = '#667eea';
      }, 2000);
    }

    showNotification('Security code copied to clipboard!', 'success');
  } catch (error) {
    showNotification('Failed to copy code. Please copy it manually.', 'error');
  }
}

// Email security code
function emailSecurityCode() {
  const codeEl = document.getElementById('security-code-display');
  if (!codeEl || !verification) return;

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
