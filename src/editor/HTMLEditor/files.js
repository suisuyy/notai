const mixin = {
  async handleFileSelection(file, previewArea, filePreview) {
    // Show preview area
    previewArea.style.display = 'block';
    filePreview.innerHTML = '';

    // Create and add file info element
    const fileInfo = document.createElement('div');
    fileInfo.style.fontSize = '12px';
    fileInfo.style.color = '#666';
    fileInfo.style.marginBottom = '8px';
    fileInfo.innerHTML = `
      <strong>File:</strong> ${file.name}<br>
      <strong>Type:</strong> ${file.type || 'Unknown'}<br>
      <strong>Size:</strong> ${this.formatFileSize(file.size)}
    `;

    // Handle different file types
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      filePreview.appendChild(img);

    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = URL.createObjectURL(file);
      filePreview.appendChild(video);
    } else if (file.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = URL.createObjectURL(file);
      filePreview.appendChild(audio);
    } else {
      const fileDetails = document.createElement('div');
      fileDetails.style.padding = '10px';
      fileDetails.style.backgroundColor = '#f5f5f5';
      fileDetails.style.borderRadius = '4px';
      fileDetails.textContent = `File ready for upload`;
      filePreview.appendChild(fileDetails);
    }
    filePreview.appendChild(fileInfo);

  },

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  async calculateSHA1(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  async uploadFile(file, ifInsertElement = true, appendInfo = false) {
    try {
      // Show loading spinner
      this.showSpinner();

      // Calculate SHA1 hash
      const shaCode = await this.calculateSHA1(file);
      const extension = file.name.split('.').pop().toLowerCase();
      const uploadUrl = `https://sharefile.suisuy.eu.org/${shaCode}.${extension}`;

      // Upload file
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (response.ok) {
        // Get device info if available
        let deviceInfo = '';
        if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
          const videoDevice = document.getElementById('videoDevices')?.selectedOptions[0]?.text;
          if (videoDevice && appendInfo) {
            deviceInfo = `<strong>Camera:</strong> ${videoDevice}<br>`;
          }
        }
        if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          const audioDevice = document.getElementById('audioDevices')?.selectedOptions[0]?.text;
          if (audioDevice && appendInfo) {
            deviceInfo += `<strong>Microphone:</strong> ${audioDevice}<br>`;
          }
        }

        // Create file info div
        const fileInfoDiv = document.createElement('div');
        fileInfoDiv.style.fontSize = '12px';

        let fileURL = `https://pub-cb2c87ea7373408abb1050dd43e3cd8e.r2.dev/${shaCode}.${extension}`;
        if (!ifInsertElement) {
          return fileURL;
        }
        if (appendInfo) {
          fileInfoDiv.innerHTML = `
          <a href="${fileURL}" target="_blank">link</a><br>
          ${file.type || 'Unknown type'} 
          ${this.formatFileSize(file.size)} 
          ${deviceInfo} 
          ${new Date().toLocaleString()}
          <br> <br>
        `;
        }
        else {
          fileInfoDiv.innerHTML = `
          <a href="${fileURL}" target="_blank">link</a><br>
          `;

        }


        // Create appropriate element based on file type
        let element;
        if (file.type.startsWith('image/')) {
          element = document.createElement('img');
          element.src = fileURL;
          element.alt = file.name;
        } else if (file.type.startsWith('video/')) {
          element = document.createElement('video');
          element.src = fileURL;
          element.controls = true;
        } else if (file.type.startsWith('audio/')) {
          element = document.createElement('audio');
          element.src = fileURL;
          element.controls = true;
        } else {
          element = document.createElement('iframe');
          element.src = fileURL;
          element.style.height = '500px';
          element.setAttribute('allowfullscreen', 'true');
        }

        // Create a new block for the media
        let brelement = document.createElement('br');
        const selection = window.getSelection();
        let block = this.currentBlock;

        if (!block) {
          block = document.createElement('div');
          block.className = 'block';
          if (selection.rangeCount > 0 && this.editor.contains(selection.getRangeAt(0)?.commonAncestorContainer)) {
            const range = selection.getRangeAt(0);

            range.insertNode(brelement);
            brelement.after(block);
            block.after(document.createElement('br'));
          } else {
            // If no selection, append to the end of editor
            this.editor.prepend(brelement);
            this.editor.prepend(block);
            this.editor.prepend(document.createElement('br'));

            // Scroll to the newly added content
          }
        }
        block.appendChild(element);
        block.appendChild(fileInfoDiv);
        block.appendChild(document.createElement('br'))
        block.appendChild(document.createElement('br'))
        //check range inside editor
        setTimeout(() => {
          element.scrollIntoView(true, { behavior: 'smooth' });

        }, 800);

        this.showToast('File uploaded successfully!', 'success');
        this.saveNote();
        return fileURL;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      this.showToast('Failed to upload file: ' + error.message);
    } finally {
      this.hideSpinner();
    }
  },
};

export default mixin;
