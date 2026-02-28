import globalDevices from '../../state/globalDevices.js';

const mixin = {
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

      const constraints = {
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
      };

      const audioDevice = document.getElementById('audioDevices').selectedOptions[0].text;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];
      let startTime = Date.now();
      let timerInterval;

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: this.audioRecordType });
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
          <strong>Duration:</strong> ${document.getElementById('recordingTime').textContent}<br>
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
        const file = new File([blob], 'recording.' + this.audioRecordExt, { type: this.audioRecordType });
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
        document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
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
    this.quickAskVoiceTimer = document.getElementById('quickAskVoiceTimer');
    this.quickAskVoiceLockZone = document.getElementById('quickAskVoiceLockZone');
    this.quickAskVoiceLockLabel = document.getElementById('quickAskVoiceLockLabel');
    this.quickAskVoiceActions = document.getElementById('quickAskVoiceActions');
    this.quickAskVoiceSendBtn = document.getElementById('quickAskVoiceSendBtn');
    this.quickAskVoiceCancelBtn = document.getElementById('quickAskVoiceCancelBtn');

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

      const recorderOptions = this.audioRecordType ? { mimeType: this.audioRecordType } : undefined;
      const mediaRecorder = recorderOptions
        ? new MediaRecorder(stream, recorderOptions)
        : new MediaRecorder(stream);

      state.stream = stream;
      state.recorder = mediaRecorder;
      state.mimeType = mediaRecorder.mimeType || this.audioRecordType || 'audio/webm';
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
        });
      } else {
        this.showQuickAskVoicePanelState({
          locked: false,
          title: 'Recording...',
          hint: 'Release to send. Slide up to lock.',
          lockLabel: 'Slide here for hands-free',
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

      try {
        clearInterval(state.timerIntervalId);
        state.timerIntervalId = 0;

        if (state.recorder && state.recorder.state !== 'inactive') {
          recordedBlob = await new Promise((resolve) => {
            const finalize = () => {
              const blob = state.chunks.length
                ? new Blob(state.chunks, { type: state.mimeType || this.audioRecordType || 'audio/webm' })
                : null;
              resolve(blob);
            };

            state.recorder.addEventListener('stop', finalize, { once: true });
            state.recorder.stop();
          });
        } else if (state.chunks.length) {
          recordedBlob = new Blob(state.chunks, { type: state.mimeType || this.audioRecordType || 'audio/webm' });
        }

        state.stream?.getTracks?.()?.forEach((track) => track.stop());

        if (send && !discard && recordedBlob?.size) {
          try {
            inputAudioBase64 = await this.convertAudioBlobToWavBase64(recordedBlob);
          } catch (error) {
            console.error('Error converting recorded audio to wav:', error);
            this.showToast('Voice recorded, but wav conversion failed.');
          }
        }
      } finally {
        this.resetQuickAskVoiceUI();
      }

      if (!send || discard) {
        return;
      }

      if (inputAudioBase64) {
        this.insertQuickAskAudioIntoCurrentBlock(inputAudioBase64, 'wav');
      }

      if (inputAudioBase64) {
        await this.handleQuickAsk({
          inputAudioBase64: includeAudio ? inputAudioBase64 : null,
          inputAudioFormat: 'wav',
          textPrompt: 'What is in this recording?',
          ignoreCurrentBlockAudio: !includeAudio,
        });
        return;
      }

      await this.handleQuickAsk({
        ignoreCurrentBlockAudio: true,
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
    return {
      audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
    };
  },

  showQuickAskVoicePanelState(options = {}) {
    const {
      locked = false,
      title,
      hint,
      lockLabel,
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

    this.quickAskVoicePanel?.classList.remove('visible', 'locked');
    this.quickAskVoicePanel?.setAttribute('aria-hidden', 'true');
    this.quickAskVoiceLockZone?.classList.remove('active');
    if (this.quickAskVoiceTitle) {
      this.quickAskVoiceTitle.textContent = 'Recording...';
    }
    if (this.quickAskVoiceHint) {
      this.quickAskVoiceHint.textContent = 'Release to send. Slide up to lock.';
    }
    if (this.quickAskVoiceLockLabel) {
      this.quickAskVoiceLockLabel.textContent = 'Slide here for hands-free';
    }
    if (this.quickAskVoiceTimer) {
      this.quickAskVoiceTimer.textContent = '0:00';
    }

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

  async convertAudioBlobToWavBase64(blob) {
    const audioBuffer = await this.decodeRecordedAudio(blob);
    const wavArrayBuffer = this.audioBufferToWav(audioBuffer);
    return this.arrayBufferToBase64(wavArrayBuffer);
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

  insertQuickAskAudioIntoCurrentBlock(base64Audio, format = 'wav') {
    if (!base64Audio || !this.editor) {
      return null;
    }

    const dataUrl = `data:audio/${format};base64,${base64Audio}`;
    const selection = window.getSelection();
    const anchorRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchorNode = anchorRange?.commonAncestorContainer || selection?.anchorNode || null;

    let block = null;
    if (anchorNode) {
      const anchorElement = anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentElement;
      const candidate = anchorElement?.closest?.('.block');
      if (candidate && this.editor.contains(candidate)) {
        block = candidate;
      }
    }

    if (!block && this.currentBlock && this.editor.contains(this.currentBlock)) {
      block = this.currentBlock;
    }

    if (!block) {
      block = this.addNewBlock(true, anchorNode, anchorRange);
    }

    if (!block) {
      return null;
    }

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = dataUrl;
    audio.setAttribute('type', `audio/${format}`);

    const hasMeaningfulContent =
      !!block.querySelector('img, audio, video, iframe, table, pre, code') ||
      !!block.textContent.trim();

    if (!hasMeaningfulContent) {
      block.innerHTML = '';
    } else {
      const lastChild = block.lastChild;
      if (!(lastChild && lastChild.nodeName === 'BR')) {
        block.appendChild(document.createElement('br'));
      }
    }

    block.appendChild(audio);
    block.appendChild(document.createElement('br'));

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

    return audio;
  },
};

export default mixin;
