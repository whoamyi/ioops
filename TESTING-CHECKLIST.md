# Camera Capture Testing Checklist

## Pre-Testing Setup

- [ ] Backend server running (`http://localhost:3000`)
- [ ] IOOPS frontend accessible (direct HTML file or served via HTTP)
- [ ] Test verification link with valid token obtained
- [ ] Camera/webcam connected and functional
- [ ] Browser console open for debugging

---

## Browser Compatibility Tests

### Desktop Browsers

- [ ] **Chrome** (Windows/Mac/Linux)
  - [ ] Camera opens successfully
  - [ ] Video preview displays correctly
  - [ ] Manual capture works
  - [ ] Captured image shows in preview
  - [ ] File attached to input after confirm
  - [ ] Form submission includes captured files

- [ ] **Firefox** (Windows/Mac/Linux)
  - [ ] Camera permission prompt appears
  - [ ] All camera functions work
  - [ ] No console errors

- [ ] **Safari** (Mac)
  - [ ] HTTPS requirement respected
  - [ ] Camera access works
  - [ ] File attachment works

- [ ] **Edge** (Windows)
  - [ ] All features functional
  - [ ] UI renders correctly

### Mobile Browsers

- [ ] **Safari iOS** (iPhone/iPad)
  - [ ] Passport: Rear camera opens
  - [ ] Selfie: Front camera opens
  - [ ] "Switch Camera" button shows on mobile
  - [ ] Portrait mode: 3:4 viewport
  - [ ] Landscape mode: 16:9 viewport
  - [ ] Touch controls work smoothly

- [ ] **Chrome Android**
  - [ ] Camera permissions granted
  - [ ] Front/back camera switch works
  - [ ] Capture and preview functional
  - [ ] Form submission successful

---

## Functional Tests

### Happy Path (Complete Flow)

- [ ] **Step 1: Open Camera**
  1. [ ] Click "Capture with Camera" on passport field
  2. [ ] Browser requests camera permission
  3. [ ] User grants permission
  4. [ ] Camera interface displays
  5. [ ] Live video preview shows

- [ ] **Step 2: Capture Document**
  1. [ ] Alignment guide (rectangle) visible
  2. [ ] Position document in frame
  3. [ ] Click "Capture Image" button
  4. [ ] Captured image displays in preview
  5. [ ] "Retake" and "Use This Image" buttons visible

- [ ] **Step 3: Confirm Capture**
  1. [ ] Click "Use This Image"
  2. [ ] Camera interface closes
  3. [ ] Document field shows file attached
  4. [ ] Success notification appears
  5. [ ] File name visible (e.g., `passport-1234567890.jpg`)

- [ ] **Step 4: Repeat for All Documents**
  1. [ ] Capture proof of address (rear camera, rectangle guide)
  2. [ ] Capture selfie (front camera, circular guide)
  3. [ ] All 3 documents captured successfully

- [ ] **Step 5: Submit Form**
  1. [ ] Click "Submit Information"
  2. [ ] Form uploads 3 JPEG files to backend
  3. [ ] Backend receives files correctly
  4. [ ] Admin portal shows uploaded documents
  5. [ ] No errors in browser console

---

## Error Handling Tests

### Permission Denied

- [ ] **Test:** User denies camera permission
- [ ] **Expected:** Error message displays:
  > "Camera access was denied. Please enable camera permissions in your browser settings."
- [ ] **Action:** Camera interface closes gracefully

### No Camera Detected

- [ ] **Test:** Disable camera hardware or access blocked
- [ ] **Expected:** Error message displays:
  > "No camera device detected. Please ensure a camera is connected."
- [ ] **Action:** User can still use file upload

### Camera In Use

- [ ] **Test:** Open Zoom/Skype, then try to use camera
- [ ] **Expected:** Error message displays:
  > "Camera is in use by another application. Please close other apps and try again."
- [ ] **Action:** User closes other apps and retries successfully

### Browser Not Supported

- [ ] **Test:** Access from very old browser (IE11, etc.)
- [ ] **Expected:** Camera button hidden, only file upload visible
- [ ] **Action:** User can still complete verification via file upload

---

## User Experience Tests

### Retake Workflow

- [ ] **Test:** Capture image, click "Retake"
- [ ] **Expected:**
  - [ ] Preview hides
  - [ ] Live camera preview returns
  - [ ] Alignment guide reappears
  - [ ] User can recapture

### Cancel Mid-Capture

- [ ] **Test:** Open camera, click "Cancel" before capturing
- [ ] **Expected:**
  - [ ] Camera stops
  - [ ] Camera interface hides
  - [ ] Document fields reappear
  - [ ] No file attached

### Switch Camera (Mobile Only)

- [ ] **Test:** On mobile, click "Switch Camera"
- [ ] **Expected:**
  - [ ] Camera switches front ↔ back
  - [ ] Preview updates immediately
  - [ ] Guide remains visible

### Multiple Captures

- [ ] **Test:** Capture passport, then recapture it, then capture address, then recapture selfie
- [ ] **Expected:**
  - [ ] Each field allows multiple captures
  - [ ] Latest capture overwrites previous
  - [ ] Only final captures submitted

---

## Visual/UI Tests

### Desktop Layout

- [ ] Camera viewport: 640px max width, 4:3 aspect ratio
- [ ] Controls centered below viewport
- [ ] Buttons: "Capture Image" (primary blue), "Cancel" (gray)
- [ ] Alignment guides visible and centered
- [ ] Institutional color scheme (navy blue, gold accents)

### Mobile Layout (Portrait)

- [ ] Camera viewport: Full width, 3:4 aspect ratio
- [ ] Controls stacked vertically
- [ ] Button order: Capture → Switch Camera → Cancel
- [ ] Face circle: 200px diameter
- [ ] Document frame: 80% x 60%

### Mobile Layout (Landscape)

- [ ] Camera viewport: 16:9 aspect ratio
- [ ] Max height: 350px
- [ ] Face circle: 180px diameter
- [ ] No horizontal scroll

### Transitions & Animations

- [ ] Camera interface fades in (300ms)
- [ ] Buttons have hover effects (200ms)
- [ ] Success notification slides down from top
- [ ] Capture spinner rotates smoothly
- [ ] No janky or abrupt transitions

---

## Performance Tests

### Image Quality

- [ ] **Check:** Captured image resolution
  - [ ] Desktop: ~1920x1080 or ~1280x720
  - [ ] Mobile: ~1280x720 or higher (device dependent)
  - [ ] JPEG quality: 92%
  - [ ] File size: 150-400 KB per image

### Memory Usage

- [ ] **Check:** Browser DevTools → Performance
  - [ ] No memory leaks after multiple captures
  - [ ] Camera stream released after close
  - [ ] Blob URLs revoked properly

### Network Tests

- [ ] **Test:** Slow 3G network (Chrome DevTools throttling)
  - [ ] Camera opens normally (no network required)
  - [ ] Form submission time acceptable (~5-10s for 3 images)

---

## Integration Tests

### Backend Compatibility

- [ ] **Verify:** Files received by Multer
  ```javascript
  // Backend logs should show:
  {
    passport: { filename: 'passport-1234567890.jpg', size: 245678 },
    proof_of_address: { filename: 'proof_of_address-1234567891.jpg', size: 312456 },
    selfie_with_id: { filename: 'selfie-1234567892.jpg', size: 289012 }
  }
  ```

- [ ] **Check:** Files saved to `backend/uploads/identity-documents/`
- [ ] **Check:** Database records updated with file paths
- [ ] **Check:** Admin portal displays uploaded images correctly

### WebSocket Real-Time Updates

- [ ] **Test:** Admin approves/rejects document
  - [ ] User sees instant status update
  - [ ] Camera button reappears if rejected
  - [ ] User can recapture and resubmit

### Form Validation

- [ ] **Test:** Submit form with only 2 documents captured
  - [ ] Expected: Alert "Please upload the following required documents: Selfie with ID"
  - [ ] Form does not submit

- [ ] **Test:** Submit form with all 3 documents captured
  - [ ] Expected: Form submits successfully
  - [ ] Loading indicator shows "Uploading documents..."

---

## Accessibility Tests

### Keyboard Navigation

- [ ] Tab through camera interface
- [ ] Press Enter on "Capture Image" button
- [ ] Press Escape to close camera (if implemented)

### Screen Readers (Optional)

- [ ] Camera button has descriptive text
- [ ] Instructions read aloud correctly
- [ ] Error messages announced

---

## Security Tests

### HTTPS Enforcement

- [ ] **Production:** Verify HTTPS required for camera
- [ ] **Development:** `localhost` HTTP works for testing

### Privacy

- [ ] Camera indicator shows when active
- [ ] Camera stops immediately on close
- [ ] No images sent to third parties
- [ ] No telemetry or analytics

---

## Cross-Device Tests

### Recommended Test Matrix

| Device | Browser | Tests |
|--------|---------|-------|
| Windows 10 | Chrome 120+ | Full functional tests |
| macOS | Safari 16+ | HTTPS, permissions, capture |
| iPhone 12+ | Safari iOS 15+ | Mobile UI, front/back camera |
| Android (Samsung) | Chrome Mobile | Mobile UI, camera switch |
| iPad Pro | Safari iPadOS | Tablet landscape/portrait |

---

## Known Issues / Edge Cases

- [ ] **DataTransfer API** not supported in Safari < 14.1
  - **Fallback:** Direct file upload still works
- [ ] **HTTPS required** on Safari (iOS/macOS)
  - **Solution:** Deploy to HTTPS or test on `localhost`
- [ ] **Aspect ratio** varies by device
  - **Solution:** Responsive CSS adjusts automatically

---

## Success Criteria

✅ **All tests pass**
✅ **No console errors** in any browser
✅ **Mobile experience smooth** (no lag, no scroll issues)
✅ **Images uploaded successfully** to backend
✅ **Admin can review** captured documents
✅ **File sizes acceptable** (< 500 KB per image)
✅ **User feedback positive** (intuitive, professional)

---

## Reporting Bugs

If you encounter issues, note:

1. **Browser & Version** (Chrome 121, Safari 16.4, etc.)
2. **Device** (iPhone 14, Windows 10, etc.)
3. **Steps to Reproduce**
4. **Expected vs. Actual Behavior**
5. **Console Errors** (screenshot or copy/paste)
6. **Network Tab** (if upload-related)

Submit to: [GitHub Issues](https://github.com/your-repo/issues) or internal tracker.

---

**Last Updated:** 2025-12-26
**Implementation Version:** 1.0