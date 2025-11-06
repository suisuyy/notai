import utils from '../../utils/index.js';
import globalDevices from '../../state/globalDevices.js';

const mixin = {
  getCurrentOtterBlock(startElement) {
    if (!startElement) {
      startElement = document.activeElement || document.querySelector('.block');

      // If still no starting element found, return null
      if (!startElement) {
        return null;
      }
    }

    // Start with the current element
    let currentElement = startElement;

    // Find the closest .block element from the starting element
    let closestBlock = currentElement.classList.contains('block') ?
      currentElement : currentElement.closest('.block');

    // If no block found, return null
    if (!closestBlock) {
      return null;
    }

    // Find the outermost .block until we reach body
    let outermostBlock = closestBlock;
    let parent = outermostBlock.parentElement;

    while (parent && parent !== document.body) {
      // If parent has .block class, update outermost block
      if (parent.classList.contains('block')) {
        outermostBlock = parent;
      }
      parent = parent.parentElement;
    }

    return outermostBlock;

  },

  setupCodeCopyButton() {
    const copyBtn = document.getElementById('codeCopyBtn');
    let activeCodeElement = null;

    document.addEventListener('pointerdown', (e) => {
      const target = e.target;
      const codeElement = target.closest('pre, code');

      if (codeElement) {
        activeCodeElement = codeElement;
        const rect = codeElement.getBoundingClientRect();
        const buttonRect = copyBtn.getBoundingClientRect();

        // Calculate position at top of code element
        let parentDiv = codeElement;
        while (parentDiv && parentDiv.nodeName !== 'DIV') {
          parentDiv = parentDiv.parentElement;
        }
        let parentRect = parentDiv.getBoundingClientRect();
        let top = Math.max(rect.top, parentRect.top);
        let left = parentRect.left;

        // Adjust if scrolled past top
        if (rect.top < 0) {
          top = window.scrollY;
        }

        copyBtn.style.left = `${left}px`;
        copyBtn.style.top = `${top}px`;
        copyBtn.style.display = 'block';
      } else if (!e.target.closest('#codeCopyBtn')) {
        copyBtn.style.display = 'none';
        activeCodeElement = null;
      }
    });

    // Handle scroll events to keep button visible
    document.addEventListener('scroll', () => {
      if (activeCodeElement && copyBtn.style.display !== 'none') {
        const rect = activeCodeElement.getBoundingClientRect();
        const buttonRect = copyBtn.getBoundingClientRect();

        if (rect.top < 0 && rect.bottom > buttonRect.height) {
          // Element is scrolled but still partially visible
          copyBtn.style.top = `${window.scrollY}px`;
        } else if (rect.top >= 0) {
          // Element is fully visible
          copyBtn.style.top = `${rect.top + window.scrollY}px`;
        } else {
          // Element is scrolled out of view
          copyBtn.style.display = 'none';
          activeCodeElement = null;
        }
      }
    });

    copyBtn.addEventListener('click', async () => {
      if (activeCodeElement) {
        try {
          await navigator.clipboard.writeText(activeCodeElement.innerText);
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.style.display = 'none';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy text:', err);
        }
      }
    });
  },

  showSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) return;

    // Position the spinner at the last pointer-down location
    let x = this.lastPointerPosition.x;
    let y = this.lastPointerPosition.y;
    const spinnerSize = 40; // Assuming spinner width and height are 40px

    // Adjust position to keep spinner within viewport
    if (x + spinnerSize > window.innerWidth) {
      x = window.innerWidth - spinnerSize - 10; // 10px padding
    }
    if (y + spinnerSize > window.innerHeight) {
      y = window.innerHeight - spinnerSize - 10; // 10px padding
    }

    spinner.style.left = `${x}px`;
    spinner.style.top = `${y}px`;
    spinner.style.display = 'block';

    // Automatically hide the spinner after 5 seconds
    this.spinnerTimeout = setTimeout(() => {
      this.hideSpinner();
    }, 15000);
  },

  hideSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) return;

    spinner.style.display = 'none';

    // Clear the timeout if the spinner is hidden manually
    if (this.spinnerTimeout) {
      clearTimeout(this.spinnerTimeout);
      this.spinnerTimeout = null;
    }
  },

  convertNewlinesToBreaks(text) {
    return text.replace(/\n/g, '<br>');
  },

  htmlToMarkdown(html) {
    // Basic HTML to MD conversion
    let md = html;
    // Headers
    md = md.replace(/<h1>(.*?)<\/h1>/gi, "# $1\n");
    md = md.replace(/<h2>(.*?)<\/h2>/gi, "## $1\n");
    md = md.replace(/<h3>(.*?)<\/h3>/gi, "### $1\n");
    // Bold
    md = md.replace(/<strong>(.*?)<\/strong>/gi, "**$1**");
    // Italic
    md = md.replace(/<em>(.*?)<\/em>/gi, "*$1*");
    // Links
    md = md.replace(/<a href="(.*?)">(.*?)<\/a>/gi, "[$2]($1)");
    // Images
    md = md.replace(/<img src="(.*?)".*?>/gi, "![]($1)");
    // Lists
    md = md.replace(/<ul>(.*?)<\/ul>/gi, "$1\n");
    md = md.replace(/<ol>(.*?)<\/ol>/gi, "$1\n");
    md = md.replace(/<li>(.*?)<\/li>/gi, "- $1\n");
    // Paragraphs
    md = md.replace(/<p>(.*?)<\/p>/gi, "$1\n\n");
    // Clean up
    md = md.replace(/&nbsp;/g, " ");
    return md.trim();
  },

  async fetchReadmeContent() {
    try {
      // const response = await fetch('README.md');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await marked(response.text());
    } catch (error) {
      console.error("Failed to fetch README.md:", error);
      return `Welcome ! this is all new UI to interact with ai models,  you can write your note here, select some text and use the AI toolbar to generate content based on your text. 
go to <a href="https://github.com/suisuyy/notai/tree/can?tab=readme-ov-file#introduction"> Help </a>  to see how to use the Notetaking app powered by LLM

`; // Fallback content
    }
  },

  async loadHelpPage() {
    try {
      const readmeContent = await this.fetchReadmeContent();
      const helpMarkdown = document.getElementById('helpMarkdown');
      if (helpMarkdown) {
        helpMarkdown.innerHTML = marked.parse(readmeContent);
      }
      window.location.href = 'help.html';
    } catch (error) {
      console.error("Error loading help page:", error);
      this.showToast("Failed to load help page.");
    }
  },

  insertContent(text) {
    this.editor.innerHTML += this.convertNewlinesToBreaks(text);
  },

  setEditableState(isEditable) {
    this.isEditable = isEditable;
    if (this.editor) {
      this.editor.contentEditable = isEditable;
    }

    const titleEl = document.getElementById("noteTitle");
    if (titleEl) {
      titleEl.contentEditable = isEditable;
    }

    const button = document.getElementById("toggleEditableBtn");
    if (button) {
      const icon = button.querySelector("i");
      if (icon) {
        icon.className = isEditable ? "fas fa-lock-open" : "fas fa-lock";
      }
      button.title = isEditable ? "Lock Editor" : "Unlock Editor";
    }
  },

  toggleEditable() {
    this.setEditableState(!this.isEditable);
  },

  toggleSourceView() {
    this.isSourceView = !this.isSourceView;
    const sourceView = this.sourceViewEditor;
    const editor = this.editor;

    if (this.isSourceView) {
      // Switching to source view
      this.editor.style.display = "none";
      this.sourceViewEditor.getWrapperElement().style.display = "block";
      this.sourceViewEditor.setValue(editor.innerHTML);

      setTimeout(() => {
        let formattedCode = prettier.format(this.editor.innerHTML, {
          parser: "html",
          plugins: [prettierPlugins.html],
          "trailingComma": "es5",
          "tabWidth": 4,
          "useTabs": false,
          "singleQuote": true,


        })
        this.sourceViewEditor.setValue(formattedCode)
      }, 1000);

      // Add input event listener to sync changes
      // sourceView.addEventListener('input', () => {
      //   editor.innerHTML = sourceView.value;
      //   this.delayedSaveNote();
      // });


    } else {
      // Switching back to editor view
      this.editor.innerHTML = this.sourceViewEditor.getValue();  // Apply source changes to editor
      this.editor.style.display = "block";
      this.sourceViewEditor.getWrapperElement().style.display = "none";
      this.delayedSaveNote();
    }
  },

  setupSelectionHandler() {
    // Remove any existing listener
    document.removeEventListener("selectionchange", this.selectionChangeHandler);

    // Create the handler
    this.selectionChangeHandler = () => {
      const selection = window.getSelection();
      if (!selection.isCollapsed && selection.toString().trim()) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Get toolbar dimensions
        const toolbarWidth = this.aiToolbar.offsetWidth || 300; // Fallback width if not yet rendered
        const toolbarHeight = this.aiToolbar.offsetHeight || 150; // Fallback height

        // Calculate initial position - center the toolbar on the selection
        let leftPosition = rect.left + (rect.width / 2) - (toolbarWidth / 2);
        let topPosition = rect.bottom + window.scrollY + 30;  // 30px below pointer

        // Ensure left position stays within window bounds
        const maxLeft = window.innerWidth - toolbarWidth - 20; // 20px padding from right
        const minLeft = 20; // 20px padding from left

        // Clamp the position between min and max bounds
        leftPosition = Math.min(Math.max(leftPosition, minLeft), maxLeft);

        // Check bottom boundary
        if (topPosition + toolbarHeight > window.innerHeight + window.scrollY) {
          // Place above the selection if it would overflow bottom
          topPosition = rect.top + window.scrollY - toolbarHeight - 10;
        }

        // Apply the position
        this.aiToolbar.style.display = 'block';
        this.aiToolbar.style.top = `${topPosition}px`;
        this.aiToolbar.style.left = `${leftPosition}px`;
      } else {
        // Hide toolbar completely when no selection
        this.aiToolbar.style.display = 'none';
        this.aiToolbar.classList.remove("visible");
      }
    };

    // Add the listener
    document.addEventListener("selectionchange", this.selectionChangeHandler);
  },

  async setupEventListeners() {
    try {
      // Auto-save on user interactions
      document.body.addEventListener('pointerdown', () => this.idleSync());
      document.body.addEventListener('keypress', () => this.idleSync());

      // Delegated tab switching for ask/comment groups (works after reload)
      this.editor.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.ask-tabs button, .comment-tabs button');
        if (!btn || !this.editor.contains(btn)) return;
        const group = btn.closest('.ask-group, .comment-group');
        if (!group) return;
        const isAsk = group.classList.contains('ask-group');
        const tabsBar = btn.parentElement;
        const contentsWrap = group.querySelector(isAsk ? '.ask-contents' : '.comment-contents');
        const contentSel = isAsk ? '.ask-content' : '.comment-content';
        const model = btn.getAttribute('data-model');

        // update buttons
        tabsBar.querySelectorAll('button').forEach(b => { b.classList.remove('active'); });
        btn.classList.add('active');

        // show target content
        if (contentsWrap) {
          contentsWrap.querySelectorAll(contentSel).forEach(c => (c.style.display = 'none'));
          const target = contentsWrap.querySelector(`${contentSel}[data-model="${model}"]`);
          if (target) target.style.display = 'block';
        }
      }, true);

      // Allow dropdowns to re-open after mouse leaves the toolbar
      if (this.toolbar) {
        this.toolbar.addEventListener('mouseleave', () => {
          this.toolbar.classList.remove('dropdowns-locked');
        });
        // Also unlock when user clicks any dropdown toggle button
        this.toolbar.addEventListener('click', (e) => {
          if (e.target.closest && e.target.closest('.dropdown .dropbtn')) {
            this.toolbar.classList.remove('dropdowns-locked');
          }
        }, true);
      }

      // Get all required elements
      const uploadModal = document.getElementById('uploadModal');
      const uploadFileBtn = document.getElementById('uploadFileBtn');
      const closeUploadBtn = uploadModal?.querySelector('.close');
      const fileInput = document.getElementById('fileInput');
      const selectFileBtn = document.getElementById('selectFileBtn');
      const uploadBtn = document.getElementById('uploadBtn');
      const previewArea = document.getElementById('previewArea');
      const filePreview = document.getElementById('filePreview');
      const capturePhotoBtn = document.getElementById('capturePhotoBtn');
      const captureVideoBtn = document.getElementById('captureVideoBtn');
      const captureAudioBtn = document.getElementById('captureAudioBtn');
      const stopRecordingBtn = document.getElementById('stopRecordingBtn');
      const videoDevices = document.getElementById('videoDevices');
      const audioDevices = document.getElementById('audioDevices');
      const quickAskBtn = document.getElementById('quickAskBtn');
      const addBlockBtn = document.getElementById('addBlockBtn');
      const viewSourceBtn = document.getElementById('viewSourceBtn');
      const toggleEditableBtn = document.getElementById('toggleEditableBtn');
      const saveNoteBtn = document.getElementById('saveNoteBtn');
      const plainTextBtn = document.getElementById('plainTextBtn');
      const toggleSidebarBtn = document.getElementById('toggleSidebar');
      const newPageBtn = document.getElementById('newPageBtn');
      const newFolderBtn = document.getElementById('newFolderBtn');
      const createFolderBtn = document.getElementById('createFolderBtn');
      const cancelFolderBtn = document.getElementById('cancelFolderBtn');
      const newFolderInput = document.getElementById('newFolderInput');
      const textColorInput = document.getElementById('textColor');
      const bgColorInput = document.getElementById('bgColor');
      const formatButtons = document.querySelectorAll('.formatting-tools button[data-command]');

      // Setup file upload and media capture handlers
      if (uploadModal && uploadFileBtn && closeUploadBtn &&
        fileInput && selectFileBtn && uploadBtn && previewArea && filePreview) {

        // Mobile-friendly Undo/Redo buttons in + insert dropdown
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
        if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

        uploadFileBtn.onclick = () => {
          uploadModal.style.display = 'block';
          previewArea.style.display = 'none';
          filePreview.innerHTML = '';
          this.setupMediaDevices();
        };

        closeUploadBtn.onclick = () => {
          uploadModal.style.display = 'none';
          // Stop all media tracks when closing modal
          const videoPreview = document.getElementById('videoPreview');
          if (videoPreview.srcObject) {
            videoPreview.srcObject.getTracks().forEach(track => track.stop());
          }
          this.stopMediaTracks();

        };

        if (captureVideoBtn) {
          captureVideoBtn.addEventListener('click', async () => {
            const deviceId = videoDevices.value;
            const audioDeviceId = audioDevices.value;
            if (!deviceId) {
              this.showToast('Please select a camera first');
              return;
            }
            if (!audioDeviceId) {
              this.showToast('Please select a microphone for video recording');
              return;
            }

            // If already recording, stop it
            if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
              this.currentMediaRecorder.stop();
              const videoPreview = document.getElementById('videoPreview');
              if (videoPreview.srcObject) {
                videoPreview.srcObject.getTracks().forEach(track => track.stop());
                videoPreview.style.display = 'none';
              }
              document.getElementById('mediaPreview').style.display = 'none';
              captureVideoBtn.innerHTML = '<i class="fas fa-video"></i> ';
              captureVideoBtn.style.backgroundColor = '#2ecc71';
              return;
            }

            // Start new recording with audio
            const stream = await this.startMediaStream(deviceId, true);
            if (stream) {
              // Add audio track from selected microphone
              try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                  audio: { deviceId: { exact: audioDeviceId } }
                });
                audioStream.getAudioTracks().forEach(track => {
                  stream.addTrack(track);
                });
              } catch (error) {
                console.error('Error adding audio track:', error);
                this.showToast('Error accessing microphone');
                stream.getTracks().forEach(track => track.stop());
                return;
              }

              const mediaRecorder = new MediaRecorder(stream, {
                mimeType: this.videoRecordType
              });
              const chunks = [];

              mediaRecorder.ondataavailable = e => chunks.push(e.data);
              mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: this.videoRecordType });
                stream.getTracks().forEach(track => track.stop());

                // Create preview
                const videoPreview = document.createElement('video');
                videoPreview.controls = true;
                videoPreview.src = URL.createObjectURL(blob);
                const previewArea = document.getElementById('previewArea');
                const filePreview = document.getElementById('filePreview');
                previewArea.style.display = 'block';
                filePreview.innerHTML = '';
                filePreview.appendChild(videoPreview);

                // Create file for upload
                const file = new File([blob], 'video.' + this.videoRecordExt, { type: this.videoRecordType });
                document.getElementById('fileInput').files = new DataTransfer().files;
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                document.getElementById('fileInput').files = dataTransfer.files;

                // Reset button state
                captureVideoBtn.innerHTML = '<i class="fas fa-video"></i> ';
                captureVideoBtn.style.backgroundColor = '#2ecc71';
              };

              mediaRecorder.start();
              this.currentMediaRecorder = mediaRecorder;
              document.getElementById('mediaPreview').style.display = 'block';
              document.getElementById('videoPreview').style.display = 'block';

              // Update button to show recording state
              captureVideoBtn.innerHTML = '<i class="fas fa-stop"></i> ';
              captureVideoBtn.style.backgroundColor = '#e74c3c';
            }
          });
        }

        if (stopRecordingBtn) {
          stopRecordingBtn.addEventListener('click', () => {
            if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
              this.currentMediaRecorder.stop();
              document.getElementById('stopRecordingBtn').style.display = 'none';
              document.getElementById('audioRecordingControls').style.display = 'none';
              document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
              document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
            }
          });
        }

        selectFileBtn.onclick = () => fileInput.click();

        // Handle file selection
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            await this.handleFileSelection(file, previewArea, filePreview);
          }
        };

        // Handle file upload
        uploadBtn.onclick = async () => {
          const file = fileInput.files[0];
          if (file) {
            await this.uploadFile(file, true, true);
            uploadModal.style.display = 'none';
          }
        };

        document
          .getElementById("insertIframe")
          .addEventListener("click", () => this.insertIframe());

        // Setup media capture handlers
        if (capturePhotoBtn) {
          capturePhotoBtn.addEventListener('click', async () => {
            const deviceId = videoDevices.value;
            if (!deviceId) {
              this.showToast('Please select a camera first');
              return;
            }
            const stream = await this.startMediaStream(deviceId);
            if (stream) {
              const videoPreview = document.getElementById('videoPreview');
              const shootPhotoBtn = document.getElementById('shootPhotoBtn');
              videoPreview.style.display = 'block';
              document.getElementById('mediaPreview').style.display = 'block';
              shootPhotoBtn.style.display = 'block';
              capturePhotoBtn.style.display = 'none';
            }
            globalDevices.mediaStream = stream;
          });
        }

        const shootPhotoBtn = document.getElementById('shootPhotoBtn');
        if (shootPhotoBtn) {
          shootPhotoBtn.addEventListener('click', async () => {
            const videoPreview = document.getElementById('videoPreview');
            if (videoPreview.srcObject) {
              const blob = await this.capturePhoto(videoPreview.srcObject);
              if (blob) {
                const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                await this.handleFileSelection(file, previewArea, filePreview);
                shootPhotoBtn.style.display = 'none';
                capturePhotoBtn.style.display = 'block';
              }

              let stream = globalDevices.mediaStream;
              const tracks = stream.getTracks();
              // Stop each track
              tracks.forEach(track => {
                track.stop();
                console.log('Stopped track:', track.kind, track.id);
              });
              stream = null;
              globalDevices.mediaStream = null;




            }
          });
        }

        if (captureAudioBtn) {
          captureAudioBtn.addEventListener('click', async () => {
            const deviceId = audioDevices.value;
            const mediaRecorder = await this.startRecording(deviceId);
            if (mediaRecorder) {
              this.currentMediaRecorder = mediaRecorder;
            }
          });
        }

        if (stopRecordingBtn) {
          stopRecordingBtn.addEventListener('click', () => {
            if (this.currentMediaRecorder && this.currentMediaRecorder.state === 'recording') {
              this.currentMediaRecorder.stop();
              document.getElementById('stopRecordingBtn').style.display = 'none';
              document.getElementById('audioRecordingControls').style.display = 'none';
              document.getElementById('captureAudioBtn').innerHTML = '<i class="fas fa-microphone"></i>';
              document.getElementById('captureAudioBtn').style.backgroundColor = '#2ecc71';
            }
          });
        }
      }

      // Quick Ask button 
      if (quickAskBtn) {
        quickAskBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          //set quickaskbtn disabled and enable it after 5 seconds
          quickAskBtn.disabled = true;
          quickAskBtn.style.backgroundColor = '#ccc';
          setTimeout(() => {
            quickAskBtn.disabled = false;
            quickAskBtn.style.backgroundColor = '';
          }, 5000);

          this.handleQuickAsk();
        });
      }

      // Sidebar toggle
      if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
      }

      // New page button
      if (newPageBtn) {
        newPageBtn.addEventListener('click', () => this.createNewNote());
      }

      // New folder button and related events
      if (newFolderBtn && createFolderBtn && cancelFolderBtn && newFolderInput) {
        newFolderBtn.addEventListener('click', () => this.showNewFolderInput());
        createFolderBtn.addEventListener('click', () => this.createFolder());
        cancelFolderBtn.addEventListener('click', () => this.hideNewFolderInput());
        newFolderInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.createFolder();
          } else if (e.key === 'Escape') {
            this.hideNewFolderInput();
          }
        });
      }

      // Format buttons
      formatButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const command = button.dataset.command;
          if (command.startsWith('h')) {
            this.formatBlock(command);
          } else {
            this.executeCommand(command);
          }
          // Hide any open dropdowns after action
          this.hideAllDropdowns();
        });
      });

      // Text color
      if (textColorInput) {
        textColorInput.addEventListener('input', (e) => {
          document.execCommand('foreColor', false, e.target.value);
        });
      }

      // Background color
      if (bgColorInput) {
        bgColorInput.addEventListener('input', (e) => {
          document.execCommand('hiliteColor', false, e.target.value);
        });
      }

      // Add block button
      if (addBlockBtn) {
        addBlockBtn.addEventListener('click', () => {
          this.addNewBlock();
        });
      }

      // View source button
      if (viewSourceBtn) {
        viewSourceBtn.addEventListener('click', () => {
          this.toggleSourceView();
        });
      }

      // Toggle editable button
      if (toggleEditableBtn) {
        toggleEditableBtn.addEventListener('click', () => {
          this.toggleEditable();
        });
      }

      // Keyboard shortcuts for undo/redo
      this.editor.addEventListener('keydown', (e) => {
        // Cmd/Ctrl+Z => undo, Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y => redo
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const meta = isMac ? e.metaKey : e.ctrlKey;
        if (meta && !e.altKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
          return;
        }
        if (meta && (!e.altKey) && (e.key.toLowerCase() === 'z' && e.shiftKey || e.key.toLowerCase() === 'y')) {
          e.preventDefault();
          this.redo();
          return;
        }
      });

      // Save button
      if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', async () => {
          try {
            await this.cleanNote();

            this.saveNote();


          } catch (error) {
            console.error('Error saving note:', error);

            this.saveNote();
          }



        });
      }

      // Plain text button
      if (plainTextBtn) {
        plainTextBtn.addEventListener('click', () => { this.convertToPlainText(); this.hideAllDropdowns(); });
      }

      // Auto-save on content changes
      if (this.editor) {

        // Fine-grained history via beforeinput to capture intent types
        this.editor.addEventListener('beforeinput', (e) => {
          // Types that should snapshot prior state
          const type = e.inputType || '';
          const now = Date.now();
          const typingTypes = new Set([
            'insertText', 'insertCompositionText'
          ]);
          const mergeableDelete = new Set([
            'deleteContentBackward', 'deleteContentForward'
          ]);
          const structuralTypes = new Set([
            'insertParagraph', 'insertLineBreak', 'insertFromPaste', 'insertFromPasteAsQuotation',
            'formatBold', 'formatItalic', 'formatUnderline', 'formatStrikeThrough',
            'formatBlock', 'formatRemove', 'historyUndo', 'historyRedo'
          ]);

          // Coalesce continuous typing/deleting within 1s; snapshot on boundary changes
          const shouldCoalesce = typingTypes.has(type) || mergeableDelete.has(type);
          const boundaryChange = type !== this.lastInputType || (now - this.lastInputTime) > 1000;
          if (shouldCoalesce && boundaryChange) {
            this.recordSnapshot('typing-start:' + type);
          } else if (!shouldCoalesce) {
            // Non-typing actions always snapshot before
            this.recordSnapshot('before:' + type);
          }
          this.lastInputType = type;
          this.lastInputTime = now;
        }, { capture: true });

        // Input: after DOM is mutated, ensure we have a post snapshot for structural edits
        this.editor.addEventListener('input', () => {

          clearTimeout(this.inputToUpdateLastUpdatedTimeoutID);
          this.inputToUpdateLastUpdatedTimeoutID = setTimeout(() => {
            this.lastUpdated = utils.getCurrentTimeString();
            console.log(' this.editor.addEventListener input update this.lastupdated  :', this.lastUpdated);
            this.delayedSaveNote();
            this.updateTableOfContents();
          }, 5000);

          // For non-typing input or explicit structural changes, take a post snapshot
          // Detect lastInputType captured in beforeinput
          const structuralPostTypes = new Set([
            'insertParagraph', 'insertLineBreak', 'insertFromPaste', 'insertFromPasteAsQuotation'
          ]);
          if (structuralPostTypes.has(this.lastInputType)) {
            this.recordSnapshot('after:' + this.lastInputType);
          }
        });

        this.editor.addEventListener('paste', () => {
          this.delayedSaveNote();
          setTimeout(() => {
            this.cleanNote();

          }, 1000);
        });

        // Handle keyboard shortcuts
        this.editor.lastKey = null;
        let resetTimeout = null;
        let rect = { top: 0, left: 0 };
        this.editor.addEventListener('keydown', (e) => {
          //log rect
          console.log('rect', rect);

          // Prioritize quick ask on Cmd/Ctrl + Enter
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.handleQuickAsk();
            this.editor.lastKey = e.key;
            return;
          }

          // If Enter is pressed inside a heading (h1–h4) and the caret is at the end,
          // create a normal block after the heading and move the caret there.
          if (e.key === 'Enter') {
            const selection = window.getSelection();
            const anchorEl = selection && selection.anchorNode ? (selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement) : null;

            // If we're inside a non-editable group (comment/ask), ignore custom enter behavior
            const nonEditableGroup = anchorEl && anchorEl.closest ? anchorEl.closest('.comment-group, .ask-group') : null;
            if (nonEditableGroup) {
              e.preventDefault();
              utils.insertTextAtCursor('\n', 50);
              this.editor.lastKey = e.key;
              return;
            }

            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE
                ? range.startContainer
                : range.startContainer.parentElement;
              const heading = startNode && startNode.closest ? startNode.closest('h1,h2,h3,h4') : null;

              if (heading) {
                // Check if caret is at the end of the heading
                const endRange = document.createRange();
                endRange.selectNodeContents(heading);
                endRange.collapse(false);
                const atEndOfHeading = range.collapsed && range.compareBoundaryPoints(Range.START_TO_START, endRange) === 0;

                if (atEndOfHeading) {
                  e.preventDefault();
                  const newBlock = document.createElement('div');
                  newBlock.innerHTML = '<br>';
                  if (heading.nextSibling) {
                    heading.parentNode.insertBefore(newBlock, heading.nextSibling);
                  } else {
                    heading.parentNode.appendChild(newBlock);
                  }
                  const newRange = document.createRange();
                  newRange.setStart(newBlock, 0);
                  newRange.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(newRange);
                  this.editor.lastKey = e.key;
                  return;
                }
              }
            }

            // Default: inside normal blocks, just newline not new block
            e.preventDefault();
            // If caret is at the end of an inline formatted element (b/i/u/span/etc.),
            // break out of that element and insert a line break outside it
            try {
              const sel = window.getSelection();
              if (sel && sel.rangeCount) {
                const r = sel.getRangeAt(0);
                const node = r.startContainer.nodeType === Node.ELEMENT_NODE ? r.startContainer : r.startContainer.parentElement;
                const inline = node && node.closest ? node.closest('b,strong,i,em,u,mark,s,code,span[style]') : null;
                if (inline) {
                  const endR = document.createRange();
                  endR.selectNodeContents(inline);
                  endR.collapse(false);
                  const atEnd = r.collapsed && r.compareBoundaryPoints(Range.START_TO_START, endR) === 0;
                  if (atEnd) {
                    const br = document.createElement('br');
                    inline.parentNode.insertBefore(br, inline.nextSibling);
                    const after = document.createRange();
                    after.setStartAfter(br);
                    after.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(after);
                    // Clear active formatting for the new line
                    document.execCommand('removeFormat');
                    this.editor.lastKey = e.key;
                    return;
                  }
                }
              }
            } catch (_) { }

            utils.insertTextAtCursor('\n', 50);
            try { document.execCommand('removeFormat'); } catch (_) { }

          } else {
            rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
            let button = document.querySelector('#quickAskBtn');

            button.style.top = '';
            button.style.left = '';

          }

          //check if ol already exist, if exist, remove it
          let ol = document.querySelector('.ai-input-shortcuts');
          if (ol) {
            ol.remove();
          }
          //if key is space and last key is space too, show the ai action as list, when click , insert each prompts
          if (e.key === ' ' && this.editor.lastKey === ' ') {

            ol = document.createElement('ul');
            ol.classList.add('ai-input-shortcuts');
            ol.style.position = 'fixed';
            //get current cursor location and set ol top and let
            let selection = window.getSelection();
            let range = selection.getRangeAt(0);
            let rect = range.getBoundingClientRect();
            ol.style.top = rect.top + 30 + 'px';
            ol.style.left = rect.left + 'px';
            //make sure ol inside window
            if (rect.top + 80 > window.innerHeight) {
              ol.style.top = window.innerHeight - 80 + 'px';
            }
            if (rect.left + 300 > window.innerWidth) {
              ol.style.left = window.innerWidth - 300 + 'px';
            }
            ol.style.zIndex = '9999';
            ol.style.backgroundColor = 'black';
            ol.style.color = 'white';
            ol.style.width = '300px';
            ol.style.overflow = 'auto';
            ol.style.scrollbarWidth = 'none';
            ol.style.padding = '10px';
            ol.addEventListener('pointerover', () => {
              ol.style.backgroundColor = '#222200';
              clearTimeout(resetTimeout);
            });
            ol.addEventListener('pointerdown', () => {
              e.preventDefault();
            });
            ol.addEventListener('pointerout', () => {

              resetTimeout = setTimeout(() => {
                ol.remove();
              }
                , 10000);
            });

            document.body.appendChild(ol);

            //remove ol after 8 seconds
            clearTimeout(resetTimeout);
            resetTimeout = setTimeout(() => {
              ol.remove();
            }, 5000);

            let allprompts = this.aiSettings.prompts;
            for (let custometoool of this.aiSettings.customTools) {
              allprompts[custometoool.name] = custometoool.prompt;
            }

            //create li for quick ask
            let li = document.createElement('li');

            li = document.createElement('li');
            li.innerHTML = '<i class="fas fa-paper-plane"></i>';
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => {
              ol.remove();
              this.handleQuickAsk();
            }
            );
            ol.appendChild(li);

            for (let key in allprompts) {
              let li = document.createElement('li');
              li.innerHTML = key;
              li.style.cursor = 'pointer';

              li.addEventListener('pointerdown', (e) => {
                e.preventDefault();
              }

              );
              li.addEventListener('click', () => {
                ol.remove();
                let insertedText = this.aiSettings.prompts[key];
                //remove {text} from prompt
                insertedText = insertedText.replace('{text}', '');
                utils.insertTextAtCursor(insertedText);
              });
              ol.appendChild(li);




            }
          }



          // if (e.key === '/' && !e.shiftKey) {
          //   this.showBlockMenu(e);
          // }

          this.editor.lastKey = e.key;
        });

        this.editor.addEventListener('drop', (event) => {
          event.preventDefault();

          this.showToast('drop file to upload');

          const files = event.dataTransfer.files;
          if (files.length === 0) {
            console.log('No files dropped.');
            return;
          }

          for (const file of files) {
            if (file.type.startsWith('image/')) {
              console.log(`Image file dropped: ${file.name}`);
              // Process the image file here
            } else {
              console.log('Non-image file dropped.');
            }
            this.uploadFile(file);
          }
        });

        this.clearNotes();

      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  },

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const editor = document.querySelector(".editor");

    if (sidebar && mainContent) {
      sidebar.classList.toggle("hidden");
    }
  },

  showToast(message, type = 'error') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    toast.innerHTML = `
        <div class="toast-message">${message}</div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    if (!toastContainer) {
      console.error("toastContainer not found in the DOM");
      return;
    }

    // Add to container
    toastContainer.appendChild(toast);

    // Handle close button
    const closeBtn = toast.querySelector('.toast-close');
    const closeToast = () => {
      toast.style.animation = 'slideOut 0.3s ease-out forwards';
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    };

    closeBtn.addEventListener('click', closeToast);

    // Auto close after 10 seconds
    setTimeout(closeToast, 10000);

    // **New Code Starts Here**
    if (type === 'error') {
      // After 1 second, add the 'hide' class to transition background to white
      setTimeout(() => {
        toast.classList.add('hide');
      }, 1000); // 1000 milliseconds = 1 second
    }
    // **New Code Ends Here**
  },
};

export default mixin;
