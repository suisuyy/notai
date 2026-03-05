import globalDevices from '../../state/globalDevices.js';
import utils from '../../utils/index.js';

const mixin = {
  resolvePreferredAudioRecordingConfig() {
    const candidates = [
      { mimeType: 'audio/mp4;codecs=mp4a.40.2', fileExt: 'm4a', formatLabel: 'M4A', inputAudioFormat: 'm4a', audioBitsPerSecond: 64000 },
      { mimeType: 'audio/mp4', fileExt: 'm4a', formatLabel: 'M4A', inputAudioFormat: 'm4a', audioBitsPerSecond: 64000 },
      { mimeType: 'audio/wav', fileExt: 'wav', formatLabel: 'WAV', inputAudioFormat: 'wav' },
      { mimeType: 'audio/webm', fileExt: 'webm', formatLabel: 'WEBM', inputAudioFormat: 'webm' },
    ];
    const selected = candidates.find((candidate) => {
      if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return candidate.mimeType === 'audio/webm';
      }
      return MediaRecorder.isTypeSupported(candidate.mimeType);
    }) || candidates[candidates.length - 1];

    return {
      mimeType: selected.mimeType,
      fileExt: selected.fileExt,
      formatLabel: selected.formatLabel,
      inputAudioFormat: selected.inputAudioFormat,
      recorderOptions: {
        mimeType: selected.mimeType,
        ...(selected.audioBitsPerSecond ? { audioBitsPerSecond: selected.audioBitsPerSecond } : {}),
      },
      streamConstraints: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 24000 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };
  },

  resolvePreferredVideoRecordingConfig() {
    const candidates = [
      { mimeType: 'video/webm;codecs=vp9,opus', fileExt: 'webm' },
      { mimeType: 'video/webm;codecs=vp8,opus', fileExt: 'webm' },
      { mimeType: 'video/webm', fileExt: 'webm' },
      { mimeType: 'video/mp4', fileExt: 'mp4' },
    ];
    const selected = candidates.find((candidate) => {
      if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return candidate.mimeType === 'video/webm';
      }
      return MediaRecorder.isTypeSupported(candidate.mimeType);
    }) || candidates[2];

    return {
      mimeType: selected.mimeType,
      fileExt: selected.fileExt,
    };
  },

  getAudioRecordingConstraints(audioDeviceId = null) {
    return {
      audio: {
        ...(audioDeviceId ? { deviceId: { exact: audioDeviceId } } : {}),
        ...(this.audioStreamConstraints || {}),
      }
    };
  },

  normalizeAudioRecordingMetadata(mimeType = '', fallbackMimeType = '') {
    const resolvedMimeType = (mimeType || fallbackMimeType || this.audioRecordType || 'audio/webm').toLowerCase();
    if (resolvedMimeType.includes('mp4')) {
      return {
        mimeType: resolvedMimeType.startsWith('video/') ? 'video/mp4' : 'audio/mp4',
        formatLabel: 'M4A',
        inputAudioFormat: 'm4a',
        fileExt: 'm4a',
      };
    }
    if (resolvedMimeType.includes('wav')) {
      return {
        mimeType: 'audio/wav',
        formatLabel: 'WAV',
        inputAudioFormat: 'wav',
        fileExt: 'wav',
      };
    }
    return {
      mimeType: 'audio/webm',
      formatLabel: 'WEBM',
      inputAudioFormat: 'webm',
      fileExt: 'webm',
    };
  },

  normalizeImageCaptureMetadata(mimeType = '', fallbackMimeType = '') {
    const resolvedMimeType = (mimeType || fallbackMimeType || 'image/jpeg').toLowerCase();
    if (resolvedMimeType.includes('png')) {
      return {
        mimeType: 'image/png',
        fileExt: 'png',
      };
    }
    if (resolvedMimeType.includes('webp')) {
      return {
        mimeType: 'image/webp',
        fileExt: 'webp',
      };
    }
    return {
      mimeType: 'image/jpeg',
      fileExt: 'jpg',
    };
  },

  formatCompactFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    const decimals = value >= 10 || index === 0 ? 0 : 1;
    return `${value.toFixed(decimals)}${units[index]}`;
  },

  createQuickAskMediaInfoLine({ fileExt = '', size = 0 } = {}) {
    const details = [];
    if (fileExt) {
      details.push(String(fileExt).toLowerCase());
    }
    if (Number.isFinite(size) && size > 0) {
      details.push(this.formatCompactFileSize(size));
    }
    return details.join(',');
  },

  createQuickAskMediaInfoElement(text = '') {
    if (!text) {
      return null;
    }
    const info = document.createElement('div');
    info.className = 'quick-ask-media-info';
    info.textContent = text;
    return info;
  },

  createQuickAskInsertedMediaBlock(anchorNode = null, anchorRange = null) {
    const block = this.addNewBlock(true, anchorNode, anchorRange);
    if (!block) {
      return null;
    }
    block.classList.add('media-block', 'quick-ask-media-block');
    block.innerHTML = '';
    return block;
  },

  emphasizeQuickAskInsertedBlock(block, focusElement = null) {
    if (!block) {
      return;
    }

    block.classList.remove('quick-ask-block-flash');
    void block.offsetWidth;
    block.classList.add('quick-ask-block-flash');
    window.setTimeout(() => {
      block.classList.remove('quick-ask-block-flash');
    }, 2200);

    const scrollTarget = focusElement || block;
    window.setTimeout(() => {
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 0);
  },

  async createAudioRecorder(stream) {
    const primaryOptions = this.audioRecordOptions?.mimeType
      ? { ...this.audioRecordOptions }
      : null;
    let mediaRecorder = null;

    if (primaryOptions) {
      try {
        mediaRecorder = new MediaRecorder(stream, primaryOptions);
      } catch (error) {
        console.warn('Primary audio recorder creation failed, retrying without options:', error);
      }
    }

    if (!mediaRecorder) {
      mediaRecorder = new MediaRecorder(stream);
    }

    const metadata = this.normalizeAudioRecordingMetadata(mediaRecorder.mimeType, primaryOptions?.mimeType || this.audioRecordType);
    return {
      mediaRecorder,
      metadata,
      audioBitsPerSecond: mediaRecorder.audioBitsPerSecond || primaryOptions?.audioBitsPerSecond || null,
      runtimeMimeType: mediaRecorder.mimeType || primaryOptions?.mimeType || this.audioRecordType,
    };
  },

  async setupMediaDevices() {
    try {
      globalDevices.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');

      const videoSelect = document.getElementById('videoDevices');
      const audioSelect = document.getElementById('audioDevices');

      // Clear existing options
      videoSelect.innerHTML = '<option value="">Select Camera</option>';
      audioSelect.innerHTML = '<option value="">Select Microphone</option>';

      // Add video devices and select first one by default
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${videoSelect.length}`;
        videoSelect.appendChild(option);
        // Select first device by default
        if (index === 0) {
          option.selected = true;

        }
      });

      // Add audio devices and select first one by default
      audioDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${audioSelect.length}`;
        audioSelect.appendChild(option);
        // Select first device by default
        if (index === 0) {
          option.selected = true;
        }
      });

      // Show device selectors if devices are available
      const deviceSelectors = document.querySelector('.device-selectors');
      if (videoDevices.length > 0 || audioDevices.length > 0) {
        deviceSelectors.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error enumerating devices:', error);
      this.showToast('Error accessing media devices');
    }
    clearTimeout(this.stoptrackTimeoutid)
    // this.stoptrackTimeoutid= setTimeout(() => {
    //   this.stopMediaTracks();
    // }, 120000);

    //add a one time event listener to stop media tracks when unfocused tab


  },

  stopMediaTracks() {
    // Check if the stream exists and has tracks
    if (globalDevices.mediaStream && globalDevices.mediaStream.getTracks) {
      console.log("Stopping media stream tracks...");
      globalDevices.mediaStream.getTracks().forEach(track => {
        track.stop(); // Stop each track (video and audio)
        console.log(`Track stopped: ${track.kind} - ${track.label}`);
      });
      console.log("All tracks stopped.");

      // Optional: Clear the reference to the stream object
      // This helps with garbage collection and prevents accidental reuse.
      globalDevices.mediaStream = null;
    } else {
      console.log("No active media stream to stop.");
    }
  },

  async startMediaStream(videoDeviceId = null, includeAudio = false) {
    try {
      const constraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: includeAudio ? { echoCancellation: false, noiseSuppression: false } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoPreview = document.getElementById('videoPreview');
      //this is important to mute the video to avoid noise
      videoPreview.muted = true;

      videoPreview.srcObject = stream;
      videoPreview.style.display = 'block';
      document.getElementById('mediaPreview').style.display = 'block';
      await videoPreview.play(); // Ensure video is playing before returning
      return stream;
    } catch (error) {
      console.error('Error accessing media:', error);
      this.showToast('Error accessing camera or microphone');
      return null;
    }
  },

  async capturePhoto(stream) {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoPreview = document.getElementById('videoPreview');
    const canvas = document.getElementById('photoCanvas');
    const context = canvas.getContext('2d');
    const videoDevice = document.getElementById('videoDevices').selectedOptions[0].text;
    try {
      // Wait for video metadata to load
      await new Promise((resolve) => {
        if (videoPreview.readyState >= 2) {
          resolve();
        } else {
          videoPreview.onloadeddata = () => resolve();
        }
      });

      // Set canvas dimensions to match video
      canvas.width = videoPreview.videoWidth;
      canvas.height = videoPreview.videoHeight;

      // Draw video frame to canvas
      context.drawImage(videoPreview, 0, 0);

      // Convert canvas to blob
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));

      // Stop the stream and hide video preview
      globalDevices.mediaStream.getTracks().forEach(track => track.stop());
      videoPreview.srcObject = null;
      videoPreview.style.display = 'none';

      // Create preview
      const previewArea = document.getElementById('previewArea');
      const filePreview = document.getElementById('filePreview');
      const img = document.createElement('img');
      img.src = URL.createObjectURL(blob);
      img.style.maxWidth = '100%';

      // Add file info above preview
      const fileInfo = document.createElement('div');
      fileInfo.style.fontSize = '12px';
      fileInfo.style.color = '#666';
      fileInfo.style.marginBottom = '8px';
      fileInfo.innerHTML = `
        <strong>Captured Photo</strong><br>
        <strong>Camera:</strong> ${videoDevice}<br>
        <strong>Resolution:</strong> ${canvas.width}x${canvas.height}<br>
        <strong>Size:</strong> ${this.formatFileSize(blob.size)}
      `;

      previewArea.style.display = 'block';
      filePreview.innerHTML = '';
      filePreview.appendChild(img);
      filePreview.appendChild(fileInfo);

      // Create file for upload
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      document.getElementById('fileInput').files = dataTransfer.files;


      return blob;
    } catch (error) {
      console.error('Error capturing photo:', error);
      this.showToast('Error capturing photo');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      return null;
    }
  },

  async startRecording(audioDeviceId = null) {
    try {
      // If already recording, stop it
      if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
        this.currentMediaRecorder.stop();
        document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
        return;
      }

      const constraints = this.getAudioRecordingConstraints(audioDeviceId);

      const audioDevice = document.getElementById('audioDevices').selectedOptions[0].text;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const { mediaRecorder, metadata, runtimeMimeType } = await this.createAudioRecorder(stream);
      const chunks = [];
      let startTime = Date.now();
      let timerInterval;
      let durationLabel = '00:00';

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const chunkMimeType = chunks.find((chunk) => chunk?.type)?.type || runtimeMimeType || metadata.mimeType;
        const runtimeMetadata = this.normalizeAudioRecordingMetadata(chunkMimeType, metadata.mimeType);
        const blob = new Blob(chunks, { type: chunkMimeType });
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        clearInterval(timerInterval);
        document.getElementById('recordingTime').textContent = '00:00';
        document.getElementById('stopRecordingBtn').style.display = 'none';
        document.getElementById('audioRecordingControls').style.display = 'none';
        document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';

        // Create preview with file info
        const fileInfo = document.createElement('div');
        fileInfo.style.fontSize = '12px';
        fileInfo.style.color = '#666';
        fileInfo.style.marginBottom = '8px';
        fileInfo.innerHTML = `
          <strong>Recorded Audio</strong><br>
          <strong>Microphone:</strong> ${audioDevice}<br>
          <strong>Format:</strong> ${runtimeMetadata.formatLabel}<br>
          <strong>Duration:</strong> ${durationLabel}<br>
          <strong>Size:</strong> ${this.formatFileSize(blob.size)}
        `;

        const audioPreview = document.createElement('audio');
        audioPreview.controls = true;
        audioPreview.src = URL.createObjectURL(blob);
        const previewArea = document.getElementById('previewArea');
        const filePreview = document.getElementById('filePreview');
        previewArea.style.display = 'block';
        filePreview.innerHTML = '';
        filePreview.appendChild(audioPreview);
        filePreview.appendChild(fileInfo);

        // Create file for upload
        const file = new File([blob], 'recording.' + runtimeMetadata.fileExt, { type: chunkMimeType });
        document.getElementById('fileInput').files = new DataTransfer().files;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('fileInput').files = dataTransfer.files;
      };

      // Update recording time
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        durationLabel = `${minutes}:${seconds}`;
        document.getElementById('recordingTime').textContent = durationLabel;
      }, 1000);

      mediaRecorder.start();
      document.getElementById('audioRecordingControls').style.display = 'flex';
      document.getElementById('stopRecordingBtn').style.display = 'block';
      document.getElementById('mediaPreview').style.display = 'block';
      document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-stop"></i>';
      document.getElementById('captureAudioBtn').style.backgroundColor = '#e74c3c';

      return mediaRecorder;
    } catch (error) {
      console.error('Error starting recording:', error);
      this.showToast('Error accessing microphone');
      return null;
    }
  },

  setupQuickAskVoiceControls(quickAskBtn) {
    if (this._quickAskVoiceControlsBound || !quickAskBtn) {
      return;
    }

    this.quickAskButton = quickAskBtn;
    this.quickAskVoicePanel = document.getElementById('quickAskVoicePanel');
    this.quickAskVoiceTitle = document.getElementById('quickAskVoiceTitle');
    this.quickAskVoiceHint = document.getElementById('quickAskVoiceHint');
    this.quickAskVoiceFormat = document.getElementById('quickAskVoiceFormat');
    this.quickAskVoiceTimer = document.getElementById('quickAskVoiceTimer');
    this.quickAskVoiceLockZone = document.getElementById('quickAskVoiceLockZone');
    this.quickAskVoiceLockLabel = document.getElementById('quickAskVoiceLockLabel');
    this.quickAskVoiceActions = document.getElementById('quickAskVoiceActions');
    this.quickAskVoiceSendBtn = document.getElementById('quickAskVoiceSendBtn');
    this.quickAskVoiceCancelBtn = document.getElementById('quickAskVoiceCancelBtn');
    this.quickAskCameraPreviewWrap = document.getElementById('quickAskCameraPreviewWrap');
    this.quickAskCameraPreview = document.getElementById('quickAskCameraPreview');

    quickAskBtn.addEventListener('pointerdown', (event) => {
      this.handleQuickAskVoicePointerDown(event);
    });

    window.addEventListener('pointermove', (event) => {
      this.handleQuickAskVoicePointerMove(event);
    });

    window.addEventListener('pointerup', (event) => {
      this.handleQuickAskVoicePointerUp(event);
    });

    window.addEventListener('pointercancel', (event) => {
      this.handleQuickAskVoicePointerCancel(event);
    });

    this.quickAskVoiceSendBtn?.addEventListener('click', async () => {
      await this.completeQuickAskVoiceRecording({
        send: true,
        includeAudio: this.shouldIncludeQuickAskAudio(),
      });
    });

    this.quickAskVoiceCancelBtn?.addEventListener('click', async () => {
      await this.completeQuickAskVoiceRecording({
        send: false,
        includeAudio: false,
        discard: true,
      });
    });

    this._quickAskVoiceControlsBound = true;
  },

  setupQuickAskCameraControls(quickAskCameraBtn) {
    if (this._quickAskCameraControlsBound || !quickAskCameraBtn) {
      return;
    }

    this.quickAskCameraButton = quickAskCameraBtn;
    this.quickAskVoicePanel = this.quickAskVoicePanel || document.getElementById('quickAskVoicePanel');
    this.quickAskVoiceTitle = this.quickAskVoiceTitle || document.getElementById('quickAskVoiceTitle');
    this.quickAskVoiceHint = this.quickAskVoiceHint || document.getElementById('quickAskVoiceHint');
    this.quickAskVoiceFormat = this.quickAskVoiceFormat || document.getElementById('quickAskVoiceFormat');
    this.quickAskVoiceTimer = this.quickAskVoiceTimer || document.getElementById('quickAskVoiceTimer');
    this.quickAskVoiceLockZone = this.quickAskVoiceLockZone || document.getElementById('quickAskVoiceLockZone');
    this.quickAskVoiceActions = this.quickAskVoiceActions || document.getElementById('quickAskVoiceActions');
    this.quickAskCameraPreviewWrap = this.quickAskCameraPreviewWrap || document.getElementById('quickAskCameraPreviewWrap');
    this.quickAskCameraPreview = this.quickAskCameraPreview || document.getElementById('quickAskCameraPreview');

    quickAskCameraBtn.addEventListener('pointerdown', (event) => {
      this.handleQuickAskCameraPointerDown(event);
    });

    window.addEventListener('pointerup', (event) => {
      this.handleQuickAskCameraPointerUp(event);
    });

    window.addEventListener('pointercancel', (event) => {
      this.handleQuickAskCameraPointerCancel(event);
    });

    quickAskCameraBtn.addEventListener('click', async (event) => {
      const state = this.quickAskCameraState;
      if (state.suppressClick) {
        state.suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      await this.handleQuickAskCameraCapture();
    });

    this._quickAskCameraControlsBound = true;
  },

  setQuickAskCameraButtonMode(mode = 'idle') {
    if (!this.quickAskCameraButton) {
      return;
    }
    this.quickAskCameraButton.classList.toggle('is-recording', mode === 'recording');
    this.quickAskCameraButton.innerHTML = mode === 'recording'
      ? '<i class="fas fa-circle"></i>'
      : '<i class="fas fa-camera"></i>';
  },

  async showQuickAskCameraPreview(stream) {
    if (!this.quickAskCameraPreviewWrap || !this.quickAskCameraPreview) {
      return;
    }
    this.quickAskVoicePanel?.classList.add('camera-mode');
    this.quickAskCameraPreviewWrap.hidden = false;
    this.quickAskCameraPreview.srcObject = stream;
    try {
      await this.quickAskCameraPreview.play();
    } catch (_) { }
  },

  hideQuickAskCameraPreview() {
    if (this.quickAskCameraPreview) {
      try {
        this.quickAskCameraPreview.pause?.();
      } catch (_) { }
      this.quickAskCameraPreview.srcObject = null;
    }
    if (this.quickAskCameraPreviewWrap) {
      this.quickAskCameraPreviewWrap.hidden = true;
    }
  },

  handleQuickAskCameraPointerDown(event) {
    if (!this.quickAskCameraButton || event.button !== 0) {
      return;
    }

    const state = this.quickAskCameraState;
    if (state.busy || state.active || this.quickAskVoiceState?.busy) {
      return;
    }

    state.pointerId = event.pointerId;
    state.pressStartedAt = Date.now();
    state.promptContext = this.getBlockContext();
    state.releaseRequested = false;
    state.suppressClick = false;
    clearTimeout(state.holdTimerId);
    state.holdTimerId = window.setTimeout(() => {
      this.startQuickAskCameraHoldCapture();
    }, this.quickAskCameraLongPressMs || 240);

    try {
      this.quickAskCameraButton.setPointerCapture?.(event.pointerId);
    } catch (_) { }
  },

  async handleQuickAskCameraPointerUp(event) {
    const state = this.quickAskCameraState;
    if (event.pointerId !== state.pointerId) {
      return;
    }

    clearTimeout(state.holdTimerId);
    state.holdTimerId = 0;

    try {
      if (this.quickAskCameraButton?.hasPointerCapture?.(event.pointerId)) {
        this.quickAskCameraButton.releasePointerCapture(event.pointerId);
      }
    } catch (_) { }

    if (!state.active && !state.starting) {
      state.pointerId = null;
      return;
    }

    event.preventDefault();
    state.suppressClick = true;

    if (state.starting && !state.recorder) {
      state.releaseRequested = true;
      return;
    }

    await this.completeQuickAskCameraHoldCapture({ send: true });
  },

  async handleQuickAskCameraPointerCancel(event) {
    const state = this.quickAskCameraState;
    if (event.pointerId !== state.pointerId) {
      return;
    }

    clearTimeout(state.holdTimerId);
    state.holdTimerId = 0;
    state.suppressClick = true;

    if (state.starting && !state.recorder) {
      state.active = false;
      await this.resetQuickAskCameraCaptureUI();
      return;
    }

    await this.completeQuickAskCameraHoldCapture({
      send: false,
      discard: true,
    });
  },

  handleQuickAskVoicePointerDown(event) {
    if (!this.quickAskButton || event.button !== 0) {
      return;
    }

    const state = this.quickAskVoiceState;
    if (state.busy || state.locked) {
      return;
    }

    event.preventDefault();
    state.active = true;
    state.busy = true;
    state.locked = false;
    state.pointerId = event.pointerId;
    state.pressStartedAt = Date.now();
    state.recordingStartedAt = 0;
    state.releaseRequested = null;
    state.completing = null;
    state.chunks = [];
    state.mimeType = '';
    state.formatLabel = this.audioRecordLabel;
    state.inputAudioFormat = this.audioInputFormat;
    state.audioBitsPerSecond = this.audioRecordOptions?.audioBitsPerSecond ?? null;
    state.promptContext = this.getBlockContext();
    state.releaseRequested = null;

    try {
      this.quickAskButton.setPointerCapture?.(event.pointerId);
    } catch (_) { }

    this.setQuickAskButtonMode('recording');
    this.showQuickAskVoicePanelState({
      locked: false,
      title: 'Starting recording...',
      hint: 'Release to send. Slide up to lock.',
      lockLabel: 'Slide here for hands-free',
      timerText: '0:00',
      formatText: 'Format: detecting...',
      lockActive: false,
    });

    state.startPromise = this.startQuickAskVoiceRecording();
  },

  handleQuickAskVoicePointerMove(event) {
    const state = this.quickAskVoiceState;
    if (!state.active || state.locked || event.pointerId !== state.pointerId || !this.quickAskVoiceLockZone) {
      return;
    }

    const rect = this.quickAskVoiceLockZone.getBoundingClientRect();
    const isInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (isInside) {
      this.lockQuickAskVoiceRecording();
      return;
    }

    this.quickAskVoiceLockZone.classList.remove('active');
  },

  handleQuickAskVoicePointerUp(event) {
    const state = this.quickAskVoiceState;
    if (!state.active || event.pointerId !== state.pointerId) {
      return;
    }

    event.preventDefault();
    this.releaseQuickAskVoicePointerCapture();

    if (state.locked) {
      state.active = false;
      state.pointerId = null;
      return;
    }

    this.completeQuickAskVoiceRecording({
      send: true,
      includeAudio: this.shouldIncludeQuickAskAudio(),
    });
  },

  handleQuickAskVoicePointerCancel(event) {
    const state = this.quickAskVoiceState;
    if (!state.active || event.pointerId !== state.pointerId) {
      return;
    }

    this.releaseQuickAskVoicePointerCapture();
    this.completeQuickAskVoiceRecording({
      send: false,
      includeAudio: false,
      discard: true,
    });
  },

  async startQuickAskVoiceRecording() {
    const state = this.quickAskVoiceState;

    try {
      const constraints = this.getQuickAskAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!state.busy) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const { mediaRecorder, metadata, audioBitsPerSecond, runtimeMimeType } = await this.createAudioRecorder(stream);

      state.stream = stream;
      state.recorder = mediaRecorder;
      state.mimeType = runtimeMimeType || metadata.mimeType;
      state.formatLabel = metadata.formatLabel;
      state.inputAudioFormat = metadata.inputAudioFormat;
      state.audioBitsPerSecond = audioBitsPerSecond;
      state.chunks = [];
      state.recordingStartedAt = Date.now();

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          state.chunks.push(event.data);
        }
      });

      mediaRecorder.start(250);
      this.startQuickAskVoiceTimer();

      if (state.locked) {
        this.showQuickAskVoicePanelState({
          locked: true,
          title: 'Recording locked',
          hint: 'Tap send when you are done.',
          lockLabel: 'Hands-free recording enabled',
          formatText: `Format: ${metadata.formatLabel}`,
        });
      } else {
        this.showQuickAskVoicePanelState({
          locked: false,
          title: 'Recording...',
          hint: 'Release to send. Slide up to lock.',
          lockLabel: 'Slide here for hands-free',
          formatText: `Format: ${metadata.formatLabel}`,
        });
      }

      if (state.releaseRequested) {
        const pending = state.releaseRequested;
        state.releaseRequested = null;
        await this.completeQuickAskVoiceRecording(pending);
      }
    } catch (error) {
      console.error('Error starting quick ask voice recording:', error);
      this.resetQuickAskVoiceUI();
      this.showToast('Error accessing microphone');
    } finally {
      state.startPromise = null;
    }
  },

  startQuickAskVoiceTimer() {
    const state = this.quickAskVoiceState;
    clearInterval(state.timerIntervalId);
    const tick = () => {
      if (!this.quickAskVoiceTimer) {
        return;
      }
      const startedAt = state.pressStartedAt || Date.now();
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const minutes = Math.floor(elapsed / 60).toString();
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      this.quickAskVoiceTimer.textContent = `${minutes}:${seconds}`;
    };
    tick();
    state.timerIntervalId = setInterval(tick, 250);
  },

  lockQuickAskVoiceRecording() {
    const state = this.quickAskVoiceState;
    if (!state.active || state.locked) {
      return;
    }

    state.locked = true;
    state.active = false;
    state.pointerId = null;
    this.releaseQuickAskVoicePointerCapture();
    this.quickAskVoiceLockZone?.classList.add('active');
    this.setQuickAskButtonMode('locked');
    this.showQuickAskVoicePanelState({
      locked: true,
      title: state.recordingStartedAt ? 'Recording locked' : 'Locking recording...',
      hint: 'Tap send when you are done.',
      lockLabel: 'Hands-free recording enabled',
      formatText: `Format: ${state.formatLabel || this.audioRecordLabel}`,
      lockActive: true,
    });
  },

  shouldIncludeQuickAskAudio() {
    const state = this.quickAskVoiceState;
    const startedAt = state.pressStartedAt || state.recordingStartedAt;
    if (!startedAt) {
      return false;
    }
    return (Date.now() - startedAt) >= this.quickAskVoiceMinDurationMs;
  },

  async completeQuickAskVoiceRecording(options = {}) {
    const state = this.quickAskVoiceState;
    const { send = true, includeAudio = true, discard = false } = options;

    state.active = false;
    state.pointerId = null;
    this.releaseQuickAskVoicePointerCapture();

    if (state.startPromise && !state.recorder) {
      state.releaseRequested = { send, includeAudio, discard };
      await state.startPromise;
      return;
    }

    if (state.completing) {
      return state.completing;
    }

    state.completing = (async () => {
      let recordedBlob = null;
      let inputAudioBase64 = null;
      let insertedAudioPayload = null;
      let aiAudioPayload = null;
      const promptContext = state.promptContext;
      const stateInputAudioFormat = state.inputAudioFormat;

      try {
        clearInterval(state.timerIntervalId);
        state.timerIntervalId = 0;

        if (state.recorder && state.recorder.state !== 'inactive') {
          recordedBlob = await new Promise((resolve) => {
            const finalize = () => {
              const chunkMimeType = state.chunks.find((chunk) => chunk?.type)?.type || state.mimeType || this.audioRecordType || 'audio/webm';
              const blob = state.chunks.length
                ? new Blob(state.chunks, { type: chunkMimeType })
                : null;
              resolve(blob);
            };

            state.recorder.addEventListener('stop', finalize, { once: true });
            state.recorder.stop();
          });
        } else if (state.chunks.length) {
          const chunkMimeType = state.chunks.find((chunk) => chunk?.type)?.type || state.mimeType || this.audioRecordType || 'audio/webm';
          recordedBlob = new Blob(state.chunks, { type: chunkMimeType });
        }

        state.stream?.getTracks?.()?.forEach((track) => track.stop());

        if (send && !discard && recordedBlob?.size) {
          try {
            insertedAudioPayload = await this.prepareRecordedAudioForBlock(recordedBlob, state.mimeType);
            if (includeAudio) {
              aiAudioPayload = await this.prepareRecordedAudioForAI(recordedBlob, state.mimeType);
              inputAudioBase64 = aiAudioPayload?.base64 || null;
            }
          } catch (error) {
            console.error('Error preparing recorded audio:', error);
            this.showToast('Voice recorded, but audio processing failed.');
          }
        }
      } finally {
        this.resetQuickAskVoiceUI();
      }

      if (!send || discard) {
        return;
      }

      if (insertedAudioPayload) {
        this.insertQuickAskAudioIntoCurrentBlock(insertedAudioPayload.base64, insertedAudioPayload);
      }

      if (inputAudioBase64) {
        await this.handleQuickAsk({
          inputAudioBase64: includeAudio ? inputAudioBase64 : null,
          inputAudioFormat: aiAudioPayload?.inputAudioFormat || stateInputAudioFormat || this.audioInputFormat,
          textPrompt: '',
          ignoreCurrentBlockAudio: !includeAudio,
          explicitCurrentText: promptContext?.currentText || '',
          explicitContextText: promptContext?.contextText || '',
        });
        return;
      }

      await this.handleQuickAsk({
        ignoreCurrentBlockAudio: true,
        explicitCurrentText: promptContext?.currentText || '',
        explicitContextText: promptContext?.contextText || '',
      });
    })();

    try {
      await state.completing;
    } finally {
      state.completing = null;
    }
  },

  getQuickAskAudioConstraints() {
    const audioSelect = document.getElementById('audioDevices');
    const selectedDeviceId = audioSelect?.value;
    return this.getAudioRecordingConstraints(selectedDeviceId);
  },

  showQuickAskVoicePanelState(options = {}) {
    const {
      locked = false,
      title,
      hint,
      lockLabel,
      formatText,
      timerText,
      lockActive = false,
    } = options;

    if (!this.quickAskVoicePanel) {
      return;
    }

    this.quickAskVoicePanel.classList.add('visible');
    this.quickAskVoicePanel.classList.toggle('locked', locked);
    this.quickAskVoicePanel.setAttribute('aria-hidden', 'false');
    this.quickAskVoiceTitle.textContent = title || this.quickAskVoiceTitle.textContent;
    this.quickAskVoiceHint.textContent = hint || this.quickAskVoiceHint.textContent;
    this.quickAskVoiceLockLabel.textContent = lockLabel || this.quickAskVoiceLockLabel.textContent;
    if (formatText && this.quickAskVoiceFormat) {
      this.quickAskVoiceFormat.textContent = formatText;
    }
    if (timerText) {
      this.quickAskVoiceTimer.textContent = timerText;
    }
    this.quickAskVoiceLockZone?.classList.toggle('active', lockActive);
  },

  setQuickAskButtonMode(mode = 'idle') {
    if (!this.quickAskButton) {
      return;
    }
    this.quickAskButton.classList.toggle('is-recording', mode === 'recording');
    this.quickAskButton.classList.toggle('is-locked', mode === 'locked');
    this.quickAskButton.innerHTML = mode === 'idle'
      ? '<i class="fas fa-paper-plane"></i>'
      : '<i class="fas fa-microphone"></i>';
  },

  resetQuickAskVoiceUI() {
    const state = this.quickAskVoiceState;
    clearInterval(state.timerIntervalId);

    state.active = false;
    state.busy = false;
    state.locked = false;
    state.pointerId = null;
    state.pressStartedAt = 0;
    state.recordingStartedAt = 0;
    state.recorder = null;
    state.stream = null;
    state.chunks = [];
    state.timerIntervalId = 0;
    state.releaseRequested = null;
    state.mimeType = '';
    state.formatLabel = this.audioRecordLabel;
    state.inputAudioFormat = this.audioInputFormat;
    state.audioBitsPerSecond = this.audioRecordOptions?.audioBitsPerSecond ?? null;
    state.promptContext = null;
    state.releaseRequested = null;

    this.quickAskVoicePanel?.classList.remove('visible', 'locked');
    this.quickAskVoicePanel?.classList.remove('camera-mode');
    this.quickAskVoicePanel?.setAttribute('aria-hidden', 'true');
    this.quickAskVoiceLockZone?.classList.remove('active');
    if (this.quickAskVoiceTitle) {
      this.quickAskVoiceTitle.textContent = 'Recording...';
    }
    if (this.quickAskVoiceHint) {
      this.quickAskVoiceHint.textContent = 'Release to send. Slide up to lock.';
    }
    if (this.quickAskVoiceFormat) {
      this.quickAskVoiceFormat.textContent = 'Format: -';
    }
    if (this.quickAskVoiceLockLabel) {
      this.quickAskVoiceLockLabel.textContent = 'Slide here for hands-free';
    }
    if (this.quickAskVoiceTimer) {
      this.quickAskVoiceTimer.textContent = '0:00';
    }
    this.hideQuickAskCameraPreview();

    this.setQuickAskButtonMode('idle');
  },

  releaseQuickAskVoicePointerCapture() {
    const pointerId = this.quickAskVoiceState?.pointerId;
    if (!this.quickAskButton || pointerId === null || pointerId === undefined) {
      return;
    }

    try {
      if (this.quickAskButton.hasPointerCapture?.(pointerId)) {
        this.quickAskButton.releasePointerCapture(pointerId);
      }
    } catch (_) { }
  },

  async prepareRecordedAudioForBlock(blob, mimeType = '') {
    const metadata = this.normalizeAudioRecordingMetadata(mimeType, blob?.type);
    return {
      ...metadata,
      size: blob?.size || 0,
      base64: await this.convertBlobToBase64(blob),
    };
  },

  async prepareRecordedAudioForAI(blob, mimeType = '') {
    const metadata = this.normalizeAudioRecordingMetadata(mimeType, blob?.type);
    if (metadata.inputAudioFormat !== 'webm') {
      return {
        ...metadata,
        base64: await this.convertBlobToBase64(blob),
      };
    }

    const audioBuffer = await this.decodeRecordedAudio(blob);
    const wavArrayBuffer = this.audioBufferToWav(audioBuffer);
    return {
      mimeType: 'audio/wav',
      formatLabel: 'WAV',
      inputAudioFormat: 'wav',
      fileExt: 'wav',
      base64: this.arrayBufferToBase64(wavArrayBuffer),
    };
  },

  async convertBlobToBase64(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async captureQuickAskPhoto() {
    let stream = null;
    let video = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      await new Promise((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
          return;
        }
        video.onloadeddata = () => resolve();
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) {
        throw new Error('Unable to capture photo');
      }

      return {
        blob,
        base64: await this.convertBlobToBase64(blob),
        mimeType: 'image/jpeg',
        size: blob.size,
        ...this.normalizeImageCaptureMetadata('image/jpeg'),
      };
    } finally {
      if (video) {
        video.pause?.();
        video.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  },

  async captureQuickAskPreviewFrame(videoElement) {
    if (!videoElement) {
      return null;
    }

    const width = videoElement.videoWidth || videoElement.clientWidth || 1280;
    const height = videoElement.videoHeight || videoElement.clientHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(videoElement, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      return null;
    }

    return {
      blob,
      base64: await this.convertBlobToBase64(blob),
      mimeType: 'image/jpeg',
      size: blob.size,
      ...this.normalizeImageCaptureMetadata('image/jpeg'),
    };
  },

  startQuickAskCameraTimer() {
    const state = this.quickAskCameraState;
    clearInterval(state.timerIntervalId);
    const tick = () => {
      if (!this.quickAskVoiceTimer) {
        return;
      }
      const startedAt = state.pressStartedAt || Date.now();
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const minutes = Math.floor(elapsed / 60).toString();
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      this.quickAskVoiceTimer.textContent = `${minutes}:${seconds}`;
    };
    tick();
    state.timerIntervalId = setInterval(tick, 250);
  },

  async startQuickAskCameraHoldCapture() {
    const state = this.quickAskCameraState;
    if (state.busy || state.active || this.quickAskVoiceState?.busy || !state.pointerId) {
      return;
    }

    state.busy = true;
    state.active = true;
    state.starting = true;
    state.releaseRequested = false;
    state.chunks = [];
    state.mimeType = '';
    state.inputAudioFormat = this.audioInputFormat;
    state.formatLabel = this.audioRecordLabel;
    this.setQuickAskCameraButtonMode('recording');
    this.showQuickAskVoicePanelState({
      title: 'Opening camera...',
      hint: 'Hold to talk and frame the shot. Release to send.',
      formatText: 'Audio: detecting...',
      timerText: '0:00',
    });

    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      if (!state.active) {
        videoStream.getTracks().forEach((track) => track.stop());
        return;
      }

      state.videoStream = videoStream;
      await this.showQuickAskCameraPreview(videoStream);

      const audioStream = await navigator.mediaDevices.getUserMedia(this.getQuickAskAudioConstraints());
      if (!state.active) {
        audioStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const { mediaRecorder, metadata, runtimeMimeType } = await this.createAudioRecorder(audioStream);
      state.audioStream = audioStream;
      state.recorder = mediaRecorder;
      state.mimeType = runtimeMimeType || metadata.mimeType;
      state.inputAudioFormat = metadata.inputAudioFormat;
      state.formatLabel = metadata.formatLabel;
      state.chunks = [];
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
          state.chunks.push(event.data);
        }
      });
      mediaRecorder.start(250);
      this.startQuickAskCameraTimer();
      this.showQuickAskVoicePanelState({
        title: 'Camera + audio',
        hint: 'Speak while framing. Release to send the latest frame.',
        formatText: `Audio: ${metadata.formatLabel}`,
      });

      if (state.releaseRequested) {
        await this.completeQuickAskCameraHoldCapture({ send: true });
      }
    } catch (error) {
      console.error('Error starting quick ask camera hold capture:', error);
      this.showToast('Unable to access camera or microphone');
      await this.resetQuickAskCameraCaptureUI();
    } finally {
      state.starting = false;
    }
  },

  async resetQuickAskCameraCaptureUI() {
    const state = this.quickAskCameraState;
    clearTimeout(state.holdTimerId);
    clearInterval(state.timerIntervalId);
    state.holdTimerId = 0;
    state.timerIntervalId = 0;
    state.videoStream?.getTracks?.()?.forEach((track) => track.stop());
    state.audioStream?.getTracks?.()?.forEach((track) => track.stop());
    state.active = false;
    state.busy = false;
    state.starting = false;
    state.pointerId = null;
    state.pressStartedAt = 0;
    state.videoStream = null;
    state.audioStream = null;
    state.recorder = null;
    state.chunks = [];
    state.mimeType = '';
    state.inputAudioFormat = this.audioInputFormat;
    state.formatLabel = this.audioRecordLabel;
    state.promptContext = null;
    state.releaseRequested = false;
    this.hideQuickAskCameraPreview();
    if (this.quickAskVoicePanel?.classList.contains('camera-mode')) {
      this.quickAskVoicePanel.classList.remove('visible', 'locked', 'camera-mode');
      this.quickAskVoicePanel.setAttribute('aria-hidden', 'true');
      this.quickAskVoiceLockZone?.classList.remove('active');
    }
    if (this.quickAskVoiceTitle) {
      this.quickAskVoiceTitle.textContent = 'Recording...';
    }
    if (this.quickAskVoiceHint) {
      this.quickAskVoiceHint.textContent = 'Release to send. Slide up to lock.';
    }
    if (this.quickAskVoiceFormat) {
      this.quickAskVoiceFormat.textContent = 'Format: -';
    }
    if (this.quickAskVoiceTimer) {
      this.quickAskVoiceTimer.textContent = '0:00';
    }
    this.setQuickAskCameraButtonMode('idle');
  },

  async completeQuickAskCameraHoldCapture(options = {}) {
    const state = this.quickAskCameraState;
    const { send = true, discard = false } = options;
    if (!state.busy && !state.active && !state.starting) {
      return;
    }

    clearTimeout(state.holdTimerId);
    state.holdTimerId = 0;
    state.active = false;

    let imagePayload = null;
    let recordedBlob = null;
    let insertedAudioPayload = null;
    let aiAudioPayload = null;
    const promptContext = state.promptContext;
    const stateInputAudioFormat = state.inputAudioFormat;

    try {
      imagePayload = await this.captureQuickAskPreviewFrame(this.quickAskCameraPreview);

      if (state.recorder && state.recorder.state !== 'inactive') {
        recordedBlob = await new Promise((resolve) => {
          const finalize = () => {
            const chunkMimeType = state.chunks.find((chunk) => chunk?.type)?.type || state.mimeType || this.audioRecordType || 'audio/webm';
            resolve(state.chunks.length ? new Blob(state.chunks, { type: chunkMimeType }) : null);
          };
          state.recorder.addEventListener('stop', finalize, { once: true });
          state.recorder.stop();
        });
      } else if (state.chunks.length) {
        const chunkMimeType = state.chunks.find((chunk) => chunk?.type)?.type || state.mimeType || this.audioRecordType || 'audio/webm';
        recordedBlob = new Blob(state.chunks, { type: chunkMimeType });
      }

      if (send && !discard && recordedBlob?.size) {
        insertedAudioPayload = await this.prepareRecordedAudioForBlock(recordedBlob, state.mimeType);
        if (this.shouldIncludeQuickAskCameraAudio()) {
          aiAudioPayload = await this.prepareRecordedAudioForAI(recordedBlob, state.mimeType);
        }
      }
    } catch (error) {
      console.error('Error completing quick ask camera hold capture:', error);
      this.showToast('Unable to finish camera ask');
    } finally {
      await this.resetQuickAskCameraCaptureUI();
    }

    if (!send || discard) {
      return;
    }

    if (imagePayload) {
      this.insertQuickAskImageIntoCurrentBlock(imagePayload.base64, imagePayload.mimeType, imagePayload);
    }
    if (insertedAudioPayload) {
      this.insertQuickAskAudioIntoCurrentBlock(insertedAudioPayload.base64, insertedAudioPayload);
    }

    await this.handleQuickAsk({
      inputAudioBase64: aiAudioPayload?.base64 || null,
      inputAudioFormat: aiAudioPayload?.inputAudioFormat || stateInputAudioFormat || this.audioInputFormat,
      inputImageBase64: imagePayload?.base64 || null,
      inputImageMimeType: imagePayload?.mimeType || 'image/jpeg',
      ignoreCurrentBlockAudio: !aiAudioPayload,
      explicitCurrentText: promptContext?.currentText || '',
      explicitContextText: promptContext?.contextText || '',
    });
  },

  shouldIncludeQuickAskCameraAudio() {
    return true;
  },

  insertQuickAskImageIntoCurrentBlock(base64Image, mimeType = 'image/jpeg', metadata = {}) {
    if (!base64Image || !this.editor) {
      return null;
    }

    const normalizedMetadata = {
      ...this.normalizeImageCaptureMetadata(mimeType, mimeType),
      ...metadata,
    };
    const dataUrl = `data:${normalizedMetadata.mimeType};base64,${base64Image}`;
    const selection = window.getSelection();
    const anchorRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchorNode = anchorRange?.commonAncestorContainer || selection?.anchorNode || null;
    const block = this.createQuickAskInsertedMediaBlock(anchorNode, anchorRange);

    if (!block) {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'quick-ask-media-entry quick-ask-image-entry';
    const image = document.createElement('img');
    image.src = dataUrl;
    image.alt = 'Quick camera capture';
    image.classList.add('quick-shot-image');
    wrapper.appendChild(image);

    const info = this.createQuickAskMediaInfoElement(
      this.createQuickAskMediaInfoLine({
        fileExt: normalizedMetadata.fileExt,
        size: normalizedMetadata.size,
      })
    );
    if (info) {
      wrapper.appendChild(info);
    }

    block.appendChild(wrapper);

    setTimeout(() => {
      image.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }, 0);

    this.currentBlock = block;
    this.showBlockControls?.(block);
    this.delayedSaveNote?.();

    try {
      const range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (_) { }

    return image;
  },

  async handleQuickAskCameraCapture() {
    const triggerButton = document.getElementById('quickAskCameraBtn');
    if (triggerButton?.disabled) {
      return;
    }
    if (this.quickAskCameraState?.busy || this.quickAskVoiceState?.busy) {
      return;
    }

    const promptContext = this.getBlockContext();

    try {
      if (triggerButton) {
        triggerButton.disabled = true;
        triggerButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      }

      const capture = await this.captureQuickAskPhoto();
      this.insertQuickAskImageIntoCurrentBlock(capture.base64, capture.mimeType, capture);
      await this.handleQuickAsk({
        inputImageBase64: capture.base64,
        inputImageMimeType: capture.mimeType,
        explicitCurrentText: promptContext?.currentText || '',
        explicitContextText: promptContext?.contextText || '',
      });
    } catch (error) {
      console.error('Quick camera ask failed:', error);
      this.showToast('Unable to capture photo');
    } finally {
      if (triggerButton) {
        triggerButton.disabled = false;
        triggerButton.innerHTML = '<i class="fas fa-camera"></i>';
      }
    }
  },

  async decodeRecordedAudio(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
      return await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      await audioContext.close();
    }
  },

  stopAIResponseAudioPlayback() {
    const state = this.aiResponseAudioState;
    if (!state) {
      return;
    }

    if (state.currentElement) {
      try {
        state.currentElement.pause();
        state.currentElement.currentTime = 0;
      } catch (_) { }
      state.currentElement.src = '';
      state.currentElement.load?.();
      state.currentElement = null;
    }
  },

  async autoplayAIResponseAudio(base64Audio, mimeType = '') {
    if (!base64Audio || this.aiResponseAudioState?.hasAutoplayed) {
      return false;
    }

    const resolvedMimeType = mimeType && mimeType !== 'application/octet-stream'
      ? mimeType
      : (utils.detectMimeTypeFromBase64(base64Audio) || 'audio/wav');
    const safeMimeType = resolvedMimeType === 'video/mp4' ? 'audio/mp4' : resolvedMimeType;
    const audioUrl = `data:${safeMimeType};base64,${base64Audio}`;

    this.stopAIResponseAudioPlayback();

    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = audioUrl;
      audio.onended = () => {
        if (this.aiResponseAudioState?.currentElement === audio) {
          this.aiResponseAudioState.currentElement = null;
        }
      };
      this.aiResponseAudioState.currentElement = audio;
      this.aiResponseAudioState.hasAutoplayed = true;
      await audio.play();
      return true;
    } catch (error) {
      this.aiResponseAudioState.currentElement = null;
      throw error;
    }
  },

  audioBufferToWav(audioBuffer) {
    const channelCount = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = channelCount * bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples * blockAlign);
    const view = new DataView(buffer);

    this.writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples * blockAlign, true);
    this.writeWavString(view, 8, 'WAVE');
    this.writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channelCount, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    this.writeWavString(view, 36, 'data');
    view.setUint32(40, samples * blockAlign, true);

    let offset = 44;
    const channelData = [];
    for (let channel = 0; channel < channelCount; channel += 1) {
      channelData.push(audioBuffer.getChannelData(channel));
    }

    for (let index = 0; index < samples; index += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][index] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += bytesPerSample;
      }
    }

    return buffer;
  },

  writeWavString(view, offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  },

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  },

  insertQuickAskAudioIntoCurrentBlock(base64Audio, metadata = {}) {
    if (!base64Audio || !this.editor) {
      return null;
    }

    const normalizedMetadata = typeof metadata === 'string'
      ? this.normalizeAudioRecordingMetadata(`audio/${metadata}`)
      : {
        ...this.normalizeAudioRecordingMetadata(metadata.mimeType || '', metadata.mimeType || ''),
        ...metadata,
      };
    const dataUrl = `data:${normalizedMetadata.mimeType};base64,${base64Audio}`;
    const selection = window.getSelection();
    const anchorRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchorNode = anchorRange?.commonAncestorContainer || selection?.anchorNode || null;
    const block = this.createQuickAskInsertedMediaBlock(anchorNode, anchorRange);

    if (!block) {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'quick-ask-media-entry quick-ask-audio-entry';
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = dataUrl;
    audio.setAttribute('type', normalizedMetadata.mimeType);
    wrapper.appendChild(audio);

    const info = this.createQuickAskMediaInfoElement(
      this.createQuickAskMediaInfoLine({
        fileExt: normalizedMetadata.fileExt,
        size: normalizedMetadata.size,
      })
    );
    if (info) {
      wrapper.appendChild(info);
    }

    block.appendChild(wrapper);

    this.currentBlock = block;
    this.showBlockControls?.(block);
    this.delayedSaveNote?.();

    try {
      const range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch (_) { }

    this.emphasizeQuickAskInsertedBlock(block, audio);

    return audio;
  },
};

export default mixin;
