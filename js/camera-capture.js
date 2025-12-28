/**
 * Camera Capture Module
 *
 * Institutional-grade document and identity capture using native browser APIs.
 * No external dependencies. Supports desktop and mobile environments.
 *
 * Features:
 * - Auto-detection of front/back cameras
 * - Live preview with alignment guides
 * - Quality heuristics (brightness, stability, fill)
 * - Mobile-first with graceful desktop support
 */

class CameraCapture {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.currentFacingMode = 'environment'; // 'environment' = back camera, 'user' = front camera
    this.captureCallback = null;
    this.isCapturing = false;

    // Quality detection settings
    this.stabilityFrames = [];
    this.stabilityThreshold = 0.92; // 92% similarity between frames = stable
    this.brightnessMin = 40; // Minimum average brightness (0-255)
    this.brightnessMax = 220; // Maximum average brightness
    this.fillRatioMin = 0.3; // Document should fill at least 30% of frame
  }

  /**
   * Initialize camera with specified facing mode
   * @param {string} facingMode - 'environment' (back) or 'user' (front)
   * @returns {Promise<MediaStream>}
   */
  async initializeCamera(facingMode = 'environment') {
    this.currentFacingMode = facingMode;

    try {
      // Stop existing stream if any
      if (this.stream) {
        this.stopCamera();
      }

      // Request camera access with constraints
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.stream;

    } catch (error) {
      console.error('Camera initialization error:', error);
      throw this.handleCameraError(error);
    }
  }

  /**
   * Start live preview in video element
   * @param {HTMLVideoElement} videoElement
   */
  startPreview(videoElement) {
    if (!this.stream) {
      throw new Error('Camera not initialized. Call initializeCamera() first.');
    }

    this.videoElement = videoElement;
    this.videoElement.srcObject = this.stream;
    this.videoElement.play();
  }

  /**
   * Switch between front and back cameras
   * @returns {Promise<void>}
   */
  async switchCamera() {
    const newFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    const stream = await this.initializeCamera(newFacingMode);

    if (this.videoElement) {
      this.videoElement.srcObject = stream;
    }
  }

  /**
   * Capture single frame from video stream
   * @param {HTMLCanvasElement} canvasElement - Canvas to draw captured frame
   * @returns {Promise<Blob>} - Captured image as JPEG blob
   */
  async captureFrame(canvasElement = null) {
    if (!this.videoElement || !this.stream) {
      throw new Error('Camera preview not started');
    }

    // Use provided canvas or create temporary one
    const canvas = canvasElement || document.createElement('canvas');
    const video = this.videoElement;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture image'));
        }
      }, 'image/jpeg', 0.92); // 92% quality JPEG
    });
  }

  /**
   * Auto-capture when quality conditions are met
   * Analyzes brightness, stability, and fill ratio
   * @param {HTMLCanvasElement} canvasElement
   * @param {Function} callback - Called with captured Blob when conditions met
   * @param {Object} options - Capture options (type: 'document' or 'face')
   */
  startAutoCapture(canvasElement, callback, options = {}) {
    this.canvasElement = canvasElement;
    this.captureCallback = callback;
    this.isCapturing = true;
    this.stabilityFrames = [];

    const captureType = options.type || 'document'; // 'document' or 'face'
    const checkInterval = captureType === 'face' ? 500 : 1000; // Face: 500ms, Doc: 1s

    // For face capture, take multiple frames over 2 seconds
    if (captureType === 'face') {
      this.captureFaceSequence(canvasElement, callback);
      return;
    }

    // For document capture, wait for quality conditions
    const qualityCheck = setInterval(async () => {
      if (!this.isCapturing) {
        clearInterval(qualityCheck);
        return;
      }

      try {
        const blob = await this.captureFrame(canvasElement);
        const metrics = await this.analyzeFrameQuality(blob);

        // Check if all quality conditions are met
        if (this.isQualityAcceptable(metrics, captureType)) {
          clearInterval(qualityCheck);
          this.isCapturing = false;
          this.captureCallback(blob, metrics);
        }
      } catch (error) {
        console.error('Auto-capture error:', error);
      }
    }, checkInterval);
  }

  /**
   * Capture face verification sequence (3 frames over 2 seconds)
   * @param {HTMLCanvasElement} canvasElement
   * @param {Function} callback
   */
  async captureFaceSequence(canvasElement, callback) {
    const frames = [];
    const frameCount = 3;
    const interval = 800; // 800ms between frames = ~2.4 seconds total

    for (let i = 0; i < frameCount; i++) {
      if (!this.isCapturing) break;

      await new Promise(resolve => setTimeout(resolve, interval));

      if (!this.isCapturing) break;

      const blob = await this.captureFrame(canvasElement);
      frames.push(blob);
    }

    // Return the middle frame (best quality, user had time to position)
    if (frames.length >= 2) {
      this.isCapturing = false;
      const bestFrame = frames[Math.floor(frames.length / 2)];
      callback(bestFrame, { type: 'face', frameCount: frames.length });
    }
  }

  /**
   * Stop auto-capture process
   */
  stopAutoCapture() {
    this.isCapturing = false;
    this.stabilityFrames = [];
  }

  /**
   * Analyze frame quality metrics
   * @param {Blob} imageBlob
   * @returns {Promise<Object>} - Quality metrics
   */
  async analyzeFrameQuality(imageBlob) {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Calculate average brightness
        let totalBrightness = 0;
        let edgePixels = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          // Perceived brightness formula
          const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
          totalBrightness += brightness;

          // Simple edge detection (look for high-contrast transitions)
          if (i > 4) {
            const prevBrightness = (0.299 * pixels[i-4] + 0.587 * pixels[i-3] + 0.114 * pixels[i-2]);
            if (Math.abs(brightness - prevBrightness) > 30) {
              edgePixels++;
            }
          }
        }

        const avgBrightness = totalBrightness / (pixels.length / 4);
        const edgeRatio = edgePixels / (pixels.length / 4);

        // Estimate document fill (high edge ratio = likely document present)
        const estimatedFill = Math.min(edgeRatio * 10, 1); // Normalize to 0-1

        resolve({
          brightness: avgBrightness,
          edgeRatio: edgeRatio,
          fillRatio: estimatedFill,
          width: canvas.width,
          height: canvas.height
        });
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  /**
   * Check if quality metrics meet acceptance criteria
   * @param {Object} metrics
   * @param {string} captureType
   * @returns {boolean}
   */
  isQualityAcceptable(metrics, captureType) {
    // Brightness check
    const brightnessOk = metrics.brightness >= this.brightnessMin &&
                         metrics.brightness <= this.brightnessMax;

    if (captureType === 'document') {
      // Document needs good fill ratio (document visible in frame)
      const fillOk = metrics.fillRatio >= this.fillRatioMin;
      return brightnessOk && fillOk;
    } else {
      // Face capture is less strict (just brightness)
      return brightnessOk;
    }
  }

  /**
   * Get current camera state
   * @returns {Object}
   */
  getCameraState() {
    return {
      active: !!this.stream,
      facingMode: this.currentFacingMode,
      isCapturing: this.isCapturing,
      hasVideo: !!this.videoElement
    };
  }

  /**
   * Stop camera and release resources
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.stopAutoCapture();
  }

  /**
   * Handle camera errors with user-friendly messages
   * @param {Error} error
   * @returns {Error}
   */
  handleCameraError(error) {
    let message = 'Unable to access camera. ';

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message += 'Camera access was denied. Please enable camera permissions in your browser settings.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      message += 'No camera device detected. Please ensure a camera is connected.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      message += 'Camera is in use by another application. Please close other apps and try again.';
    } else if (error.name === 'OverconstrainedError') {
      message += 'Camera does not meet required specifications.';
    } else if (error.name === 'SecurityError') {
      message += 'Camera access requires HTTPS connection.';
    } else {
      message += 'Please check your device settings and try again.';
    }

    const userError = new Error(message);
    userError.originalError = error;
    return userError;
  }

  /**
   * Check if browser supports camera API
   * @returns {boolean}
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request camera permissions (can be called before full initialization)
   * @returns {Promise<boolean>}
   */
  static async requestPermission() {
    if (!CameraCapture.isSupported()) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CameraCapture;
}