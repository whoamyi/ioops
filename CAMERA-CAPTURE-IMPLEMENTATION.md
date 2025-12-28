# Camera Capture Implementation Guide

## Overview

This document outlines the **guided camera capture system** implemented for the IOOPS identity verification portal. The system replaces traditional file uploads with a professional, institutional-grade document capture interface using **native browser APIs only** (no external dependencies).

---

## Implementation Summary

### **What Was Changed**

1. **Added Camera Capture Module** (`js/camera-capture.js`)
   - Standalone JavaScript class using native `getUserMedia` API
   - Handles camera initialization, preview, capture, and quality analysis
   - Mobile-first with automatic front/back camera selection
   - Graceful error handling with user-friendly messages

2. **Enhanced HTML Structure** (`recipient-verification.html`)
   - Added camera interface UI (video preview, overlays, controls)
   - Document alignment guide frames (rectangle with corner brackets)
   - Face verification guide (circular overlay with dimmed background)
   - Capture preview with retake/confirm workflow

3. **Integrated Camera Logic** (`js/recipient-verification.js`)
   - Hooks into existing document upload workflow
   - Adds "Capture with Camera" buttons next to file inputs
   - Converts captured Blobs to File objects for existing backend compatibility
   - No changes to form submission or API calls

4. **Comprehensive Styling** (`css/recipient-verification.css`)
   - Institutional color scheme (navy blue, gold accents)
   - Responsive design (desktop, tablet, mobile, landscape)
   - Smooth transitions and subtle animations
   - High-DPI display support

### **What Remains Unchanged**

✅ **Backend Infrastructure**
- All API endpoints (`/api/ioops/verification/:token/*`)
- Database schema (`ioops_verifications`, `ioops_documents`)
- Multer file upload handling
- Admin review portal
- WebSocket real-time updates

✅ **Frontend Architecture**
- 4-step verification flow
- Form validation logic
- Status polling & WebSocket integration
- Document approval/rejection state management

---

## Camera Capture Flow

### **Step 1: User Initiates Capture**

```
User clicks "Capture with Camera" button
         ↓
openCamera(documentType, facingMode)
         ↓
Initialize CameraCapture module
         ↓
Request camera permissions
         ↓
Start live video preview
         ↓
Show alignment guide overlay
```

### **Step 2: Document Positioning**

```
User positions document in frame
         ↓
Live preview shows alignment guides:
  - Passport/ID: Rectangle frame with corner brackets
  - Proof of Address: Rectangle frame
  - Selfie: Circular face guide
         ↓
User presses "Capture Image" button
         ↓
manualCapture() triggered
```

### **Step 3: Image Capture & Preview**

```
Capture current video frame to canvas
         ↓
Convert canvas to JPEG Blob (92% quality)
         ↓
Show captured image preview
         ↓
User chooses:
  [Retake] → Return to Step 2
  [Use This Image] → Proceed to Step 4
```

### **Step 4: Confirm & Attach**

```
confirmCapture()
         ↓
Convert Blob to File object
         ↓
Assign to file input (DataTransfer API)
         ↓
Trigger change event
         ↓
Close camera interface
         ↓
Show success notification
         ↓
User submits form (existing workflow)
```

---

## Technical Specifications

### **Camera Module** (`camera-capture.js`)

#### **Core Methods**

| Method | Purpose | Returns |
|--------|---------|---------|
| `initializeCamera(facingMode)` | Request camera access | `Promise<MediaStream>` |
| `startPreview(videoElement)` | Attach stream to `<video>` | `void` |
| `captureFrame(canvas)` | Capture current frame | `Promise<Blob>` |
| `switchCamera()` | Toggle front/back camera | `Promise<void>` |
| `stopCamera()` | Release camera resources | `void` |

#### **Quality Analysis** (Unused in MVP, ready for future enhancement)

```javascript
analyzeFrameQuality(blob)
  ↓
Returns: {
  brightness: 0-255,    // Average perceived brightness
  edgeRatio: 0-1,       // Contrast transitions
  fillRatio: 0-1,       // Estimated document coverage
  width: number,        // Image width
  height: number        // Image height
}
```

#### **Browser Support**

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ 53+ | ✅ 53+ | Full support |
| Safari | ✅ 11+ | ✅ 11+ | Requires HTTPS |
| Firefox | ✅ 36+ | ✅ 36+ | Full support |
| Edge | ✅ 79+ | ✅ 79+ | Chromium-based |

---

## UI/UX Guidelines

### **Language & Tone**

**Before (Casual)**:
> "Upload your documents"
> "Take a selfie"
> "Click here"

**After (Institutional)**:
> "Submit identity verification documents"
> "Capture verification photo"
> "Proceed to document capture"

### **Copy Examples**

**Passport Capture:**
```
Title: Capture Identity Document
Text: Position the photo page of your passport or ID card within
      the frame. Ensure all text is legible and the image is not
      blurred.
```

**Selfie Capture:**
```
Title: Identity Verification Photo
Text: Position your face within the circle. Hold your identity
      document next to your face so both are clearly visible.
```

**Error Handling:**
```
Camera Access Denied:
"Camera access was denied. Please enable camera permissions in
your browser settings."

No Camera Detected:
"No camera device detected. Please ensure a camera is connected."

Camera In Use:
"Camera is in use by another application. Please close other apps
and try again."
```

### **Visual Design Principles**

1. **Color Palette**
   - Primary: Navy Blue (`#1a1a2e`)
   - Accent: Gold (`#d4af37`)
   - Success: Green (`#28a745`)
   - Error: Red (`#dc3545`)
   - Background: Light Gray (`#f8f9fa`)

2. **Typography**
   - Font Family: System fonts (SF Pro, Segoe UI, Roboto)
   - Headings: 600-700 weight
   - Body: 400-500 weight
   - Monospace: Courier New (for codes/IBANs)

3. **Spacing & Layout**
   - Generous whitespace (20-30px margins)
   - Centered content (max-width: 640px for camera)
   - Rounded corners (8-12px border-radius)
   - Subtle shadows (`box-shadow: 0 4px 12px rgba(...)`)

4. **Transitions**
   - Fade in/out: 300ms ease
   - Hover effects: 200ms ease
   - Button presses: `translateY(-2px)` lift

---

## Mobile Responsive Behavior

### **Portrait Mode** (default)
```
Camera Viewport: 3:4 aspect ratio
Face Circle: 200px diameter
Document Frame: 80% width x 60% height
Controls: Stacked vertically, full width
```

### **Landscape Mode**
```
Camera Viewport: 16:9 aspect ratio
Face Circle: 180px diameter
Max Height: 350px (prevent excessive height)
```

### **Button Order (Mobile)**
```
1. [Capture Image]      ← Primary action
2. [Switch Camera]      ← Secondary (if available)
3. [Cancel]             ← Tertiary
```

---

## Integration with Existing Backend

### **No Backend Changes Required**

The camera capture system is **100% frontend-only**. Captured images are converted to `File` objects and assigned to existing file inputs, making them indistinguishable from user-uploaded files.

**Before (File Upload):**
```javascript
<input type="file" name="passport" accept="image/*,.pdf">
```

**After (Camera Capture):**
```javascript
const blob = await cameraModule.captureFrame(canvas);
const file = new File([blob], 'passport-1234567890.jpg', {
  type: 'image/jpeg'
});

const dataTransfer = new DataTransfer();
dataTransfer.items.add(file);
fileInput.files = dataTransfer.files;

// Trigger change event → existing validation runs
fileInput.dispatchEvent(new Event('change', { bubbles: true }));
```

**Backend receives:**
```javascript
{
  passport: File {
    name: "passport-1234567890.jpg",
    type: "image/jpeg",
    size: 245678
  }
}
```

**Multer processes this identically to a file upload.**

---

## Testing Scenarios

### **Happy Path**

1. ✅ User opens verification page
2. ✅ Clicks "Capture with Camera" on passport field
3. ✅ Grants camera permission
4. ✅ Positions passport in frame
5. ✅ Clicks "Capture Image"
6. ✅ Reviews captured image
7. ✅ Clicks "Use This Image"
8. ✅ Camera closes, file attached to input
9. ✅ Repeats for proof of address & selfie
10. ✅ Submits form → backend receives 3 JPEG files

### **Error Scenarios**

| Scenario | Expected Behavior |
|----------|-------------------|
| Camera permission denied | Show error message with instructions to enable in browser settings |
| No camera detected | Show error message suggesting to check device connections |
| Camera in use by another app | Show error message to close other apps and retry |
| Browser doesn't support `getUserMedia` | Hide camera button, show only file upload |
| User clicks "Cancel" mid-capture | Stop camera, return to document fields |
| User clicks "Retake" after capture | Hide preview, restart camera preview |

### **Mobile Scenarios**

| Device | Test | Expected Behavior |
|--------|------|-------------------|
| iPhone Safari | Passport capture | Rear camera opens, guide visible |
| iPhone Safari | Selfie capture | Front camera opens, face circle visible |
| Android Chrome | Switch camera | Toggles front/back cameras |
| iPad landscape | Passport capture | 16:9 viewport, guide adjusts |

---

## Performance Considerations

### **Image Quality vs. File Size**

**Settings:**
```javascript
canvas.toBlob((blob) => {
  // ...
}, 'image/jpeg', 0.92);  // 92% quality
```

**Typical Results:**
- 1920x1080 capture: ~250-400 KB
- 1280x720 capture: ~150-250 KB
- Well within 10MB backend limit

### **Memory Management**

**Camera Stream Cleanup:**
```javascript
stopCamera() {
  if (this.stream) {
    this.stream.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
  if (this.videoElement) {
    this.videoElement.srcObject = null;
  }
}
```

**Blob URL Cleanup:**
```javascript
showCapturePreview(blob) {
  imgElement.src = URL.createObjectURL(blob);
  // ...
}

closeCamera() {
  // Revoke object URL when closing camera
  if (imgElement.src.startsWith('blob:')) {
    URL.revokeObjectURL(imgElement.src);
  }
}
```

---

## Security & Privacy

### **Camera Permissions**

- Browser prompts user for camera access (one-time or always)
- No automatic camera activation (user must click button)
- Camera indicator shows when active (browser-enforced)
- Camera stops immediately on close/cancel

### **HTTPS Requirement**

- Safari (iOS/macOS) **requires HTTPS** for `getUserMedia`
- Development: `localhost` is exempt (HTTP allowed)
- Production: Helmet CSP already enforces HTTPS

### **No Cloud Processing**

- All image processing happens **client-side**
- Captured frames never leave user's device until form submission
- No third-party services involved
- No telemetry or analytics

---

## Future Enhancement Opportunities

### **Phase 2 Enhancements** (Not Implemented)

1. **Auto-Capture** (commented out in `camera-capture.js`)
   ```javascript
   startAutoCapture(canvas, callback, { type: 'document' })
   // Automatically captures when:
   // - Brightness 40-220 (good lighting)
   // - Stability >92% (minimal motion)
   // - Fill ratio >30% (document visible)
   ```

2. **Real-Time Feedback**
   ```javascript
   // Show quality hints during preview:
   "Too dark - increase lighting"
   "Hold steady"
   "Move closer to document"
   ```

3. **Sequential Document Flow**
   ```
   Instead of showing all 3 document fields:
   Screen 1: Passport capture
   Screen 2: Proof of address capture
   Screen 3: Selfie capture
   Screen 4: Review all + submit
   ```

4. **Enhanced Copy & Instructions**
   - Step-by-step wizard ("Step 1 of 3: Identity Document")
   - Contextual tips ("Ensure your name is visible")
   - Progress indicators ("2 of 3 documents captured")

---

## Troubleshooting

### **Camera Not Opening**

**Check:**
1. Browser console for errors
2. Browser camera permissions (Settings → Site Permissions)
3. HTTPS connection (required for Safari)
4. No other app using camera (Zoom, Skype, etc.)
5. Camera hardware connected (if external webcam)

**Debug:**
```javascript
CameraCapture.isSupported()  // Returns false if getUserMedia unavailable
```

### **Captured Image Not Attached**

**Check:**
1. File input exists: `document.querySelector('input[name="passport"]')`
2. DataTransfer API supported (Chrome 60+, Safari 14.1+)
3. Change event fired: Listen for `'change'` event on file input
4. Blob converted to File successfully

**Debug:**
```javascript
console.log('File input:', fileInput);
console.log('Files:', fileInput.files);
console.log('File 0:', fileInput.files[0]);
```

### **Camera Stays Active After Close**

**Cause:** Stream not properly stopped

**Fix:**
```javascript
// Ensure all tracks are stopped:
if (cameraModule && cameraModule.stream) {
  cameraModule.stream.getTracks().forEach(track => {
    track.stop();
    console.log('Stopped track:', track.kind);
  });
}
```

---

## File Structure

```
ioops/
├── recipient-verification.html         (Camera UI elements added)
├── css/
│   └── recipient-verification.css      (Camera styles added)
├── js/
│   ├── camera-capture.js               (NEW: Camera module)
│   └── recipient-verification.js       (Camera integration added)
└── CAMERA-CAPTURE-IMPLEMENTATION.md    (This file)
```

---

## Conclusion

This implementation delivers a **professional, institutional-grade camera capture experience** without introducing external dependencies or backend changes. The system is:

✅ **Backward Compatible** - Works with existing backend unchanged
✅ **Mobile-First** - Optimized for smartphone document capture
✅ **Privacy-Focused** - No cloud processing, client-side only
✅ **Error-Resilient** - Graceful fallbacks and clear error messages
✅ **Visually Consistent** - Matches institutional design language

**Next Steps:**
1. Test on real devices (iPhone, Android, desktop)
2. Gather user feedback on capture experience
3. Monitor backend for file size/format issues
4. Consider Phase 2 enhancements (auto-capture, sequential flow)

For questions or issues, refer to the code comments in `camera-capture.js` and `recipient-verification.js`.