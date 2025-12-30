#!/usr/bin/env python3
"""
Script to replace camera initialization with file upload setup in recipient-verification.js
"""

import re

# Read the JavaScript file
with open('js/recipient-verification.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace initializeDocumentCapture function
old_init_function = r'function initializeDocumentCapture\(\) \{[\s\S]*?^}'

new_init_function = '''function initializeDocumentCapture() {
  console.log('[Upload] Initializing file upload handlers');
  setupFileUploadHandlers();
}'''

content = re.sub(old_init_function, new_init_function, content, flags=re.MULTILINE)

# Remove all camera-related functions (startCamera, captureImage)
# Remove startCamera function
content = re.sub(r'async function startCamera\(type\) \{[\s\S]*?^\}', '', content, flags=re.MULTILINE)

# Remove captureImage function
content = re.sub(r'function captureImage\(type\) \{[\s\S]*?^\}', '', content, flags=re.MULTILINE)

# Remove the old camera confirm/retake event listeners block (lines 1816-1928)
# We'll replace it with a simpler version since file upload handlers are set up in setupFileUploadHandlers
old_camera_handlers = r'// Confirm/Retake handlers[\s\S]*?// Submit a single document resubmission'
new_camera_handlers = '''// Submit a single document resubmission'''

content = re.sub(old_camera_handlers, new_camera_handlers, content)

# Write back
with open('js/recipient-verification.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("JavaScript updated successfully - camera code replaced with file upload handlers!")

# Now append the file-upload-handler.js content at the end
with open('js/file-upload-handler.js', 'r', encoding='utf-8') as f:
    upload_handler_code = f.read()

with open('js/recipient-verification.js', 'a', encoding='utf-8') as f:
    f.write('\n\n')
    f.write('// === FILE UPLOAD HANDLERS ===\n')
    f.write(upload_handler_code)

print("File upload handler code appended successfully!")
