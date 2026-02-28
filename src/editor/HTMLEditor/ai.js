import { AI_PROXY_URL } from '../../config.js';
import utils from '../../utils/index.js';

const mixin = {
  setupAIToolbar() {
    const initToolbarCheckbox = (id, storageKey, defaultValue) => {
      const checkbox = document.getElementById(id);
      if (!checkbox) {
        return;
      }
      try {
        const saved = localStorage.getItem(storageKey);
        checkbox.checked = saved === null ? defaultValue : saved === 'true';
        checkbox.addEventListener('mousedown', (event) => {
          this._savedSelection = this.captureSelection && this.captureSelection();
          // Keep current text selection so toolbar does not auto-hide while toggling options.
          event.preventDefault();
          event.stopPropagation();
        });
        checkbox.addEventListener('pointerdown', (event) => {
          event.stopPropagation();
        });
        checkbox.addEventListener('change', () => {
          localStorage.setItem(storageKey, checkbox.checked ? 'true' : 'false');
          if (this._savedSelection && this.restoreSelection) {
            this.restoreSelection(this._savedSelection);
            this._savedSelection = null;
          }
        });
      } catch (_) { }
    };

    // Load saved model preferences
    const savedModels = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');

    // Set initial button texts and values
    ['modelBtn1', 'modelBtn2', 'modelBtn3'].forEach((btnId, index) => {
      const btn = document.getElementById(btnId);
      const modelValue = savedModels[`model${index + 1}`] || (index === 0 ? 'gpt-4o-mini' : 'none');
      btn.textContent = this.getModelDisplayName(modelValue);
      btn.setAttribute('data-selected-value', modelValue);
    });

    // Handle custom dropdowns
    document.querySelectorAll('.custom-dropdown').forEach((dropdown, index) => {
      const btn = dropdown.querySelector('.model-select-btn');
      const options = dropdown.querySelector('.model-options');

      // Toggle dropdown
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.model-options').forEach(opt => {
          if (opt !== options) opt.classList.remove('show');
        });
        options.classList.toggle('show');
      });

      this.updateModelDropdowns();
    });

    // Close dropdowns when clicking outside, but not the AI toolbar itself
    document.addEventListener('click', (e) => {
      // Don't close if clicking inside the AI toolbar
      if (!this.aiToolbar.contains(e.target)) {
        document.querySelectorAll('.model-options').forEach(opt => {
          opt.classList.remove('show');
        });
      }
    });

    // Initialize AI toolbar checkbox preferences
    initToolbarCheckbox('enableSystemPromptCheckbox', 'aiEnableSystemPrompt', true);
    initToolbarCheckbox('enableContextCheckbox', 'aiEnableContext', true);
    initToolbarCheckbox('useCommentCheckbox', 'aiUseComment', false);
    this.aiToolbar?.querySelectorAll('.ai-extras label').forEach((label) => {
      label.addEventListener('mousedown', (event) => {
        this._savedSelection = this.captureSelection && this.captureSelection();
        event.preventDefault();
        event.stopPropagation();
      });
      label.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      label.addEventListener('click', (event) => {
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (!checkbox || event.target === checkbox) {
          return;
        }
        // Toggle from label text click while keeping selection stable.
        event.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
    this.setupAIRequestDetailsModal();
  },

  updateModelDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach((dropdown, index) => {
      const btn = dropdown.querySelector('.model-select-btn');
      const options = dropdown.querySelector('.model-options');

      // First, clear any existing options to avoid duplication
      options.innerHTML = '';

      // Add a "None" option
      const noneButton = document.createElement('button');
      noneButton.setAttribute('data-value', 'none');
      noneButton.textContent = 'None';
      noneButton.addEventListener('click', (e) => {
        e.stopPropagation();
        btn.textContent = 'None';
        btn.setAttribute('data-selected-value', 'none');
        options.classList.remove('show');
        const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
        preferences[`model${index + 1}`] = 'none';
        localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
      });
      options.appendChild(noneButton);

      // Dynamically create and append a button for each model
      this.aiSettings.models.forEach(model => {
        const button = document.createElement('button');
        button.setAttribute('data-value', model.model_id);
        button.textContent = model.name;

        // Add an event listener to handle model selection
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent the click from bubbling up

          // Update the button text and data-selected-value attribute
          btn.textContent = model.name;
          btn.setAttribute('data-selected-value', model.model_id);

          // Hide the dropdown after selection
          options.classList.remove('show');

          // Save the selected model preference to localStorage
          const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
          preferences[`model${index + 1}`] = model.model_id;
          localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
        });

        // Append the button to the options container
        // Add an event listener to handle model selection
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent the click from bubbling up

          // Update the button text and data-selected-value attribute
          btn.textContent = model.name;
          btn.setAttribute('data-selected-value', model.model_id);

          // Hide the dropdown after selection
          options.classList.remove('show');

          // Save the selected model preference to localStorage
          const preferences = JSON.parse(localStorage.getItem('aiModelPreferences') || '{}');
          preferences[`model${index + 1}`] = model.model_id;
          localStorage.setItem('aiModelPreferences', JSON.stringify(preferences));
        });

        // Append the button to the options container
        options.appendChild(button);
      });
    });

    // Handle selection changes
    this.setupSelectionHandler();
  },

  getModelDisplayName(value) {
    const model = this.aiSettings.models.find(m => m.model_id === value);
    return model ? model.name : value;
  },

  setupAIRequestDetailsModal() {
    if (this._aiRequestDetailsModalBound) {
      return;
    }

    const modal = document.getElementById('aiRequestDetailsModal');
    if (!modal) {
      return;
    }

    const closeButton = document.getElementById('aiRequestDetailsCloseBtn');
    const closeIcon = modal.querySelector('[data-close-ai-details]');
    const closeModal = () => {
      modal.style.display = 'none';
    };

    closeButton?.addEventListener('click', closeModal);
    closeIcon?.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    this._aiRequestDetailsModalBound = true;
  },

  formatAIRequestDetails(runDetails) {
    const run = runDetails || {};
    const requests = Array.isArray(run.requests) ? run.requests : [];
    const lines = [];

    requests.forEach((entry, index) => {
      if (index > 0) {
        lines.push('');
      }
      lines.push(`Request ${index + 1}${entry.model ? ` (${entry.model})` : ''}`);
      lines.push(`URL: ${entry.requestUrl || ''}`);
      lines.push(`Method: ${entry.requestMethod || 'POST'}`);
      lines.push('Body:');
      lines.push(`${entry.requestBody || ''}`);
      lines.push('Response Final Result:');
      lines.push(`${entry.rawResponseText || ''}`);
    });

    return lines.join('\n');
  },

  openAIRequestDetailsModal(runDetails) {
    this.setupAIRequestDetailsModal();
    const modal = document.getElementById('aiRequestDetailsModal');
    const content = document.getElementById('aiRequestDetailsContent');
    if (!modal || !content) {
      return;
    }

    content.textContent = this.formatAIRequestDetails(runDetails);
    modal.style.display = 'block';
  },

  showAIRequestCompletedNotice(runDetails) {
    const requests = Array.isArray(runDetails?.requests) ? runDetails.requests : [];
    const okCount = requests.filter((entry) => !entry.error).length;
    const total = requests.length;
    const message = `AI request finished (${okCount}/${total} succeeded)`;

    this.showToast(message, 'success', {
      actionLabel: 'Details',
      onAction: () => this.openAIRequestDetailsModal(runDetails),
      durationMs: 15000,
    });
  },

  async handleAIAction(action, text, includeCurrentBlockMedia = false, options = {}) {
    const {
      skipContext = false,
      inputAudioBase64 = null,
      inputAudioFormat = 'wav',
      ignoreCurrentBlockAudio = false,
    } = options;

    this.lastUpdated = utils.getCurrentTimeString();
    //log last updated time
    console.log('handleaiaction update this.lastupdated:', this.lastUpdated);

    // Respect explicit UI toggle instead of auto length-based heuristic
    const useCommentCheckbox = document.getElementById('useCommentCheckbox');
    const useComment = !!(useCommentCheckbox && useCommentCheckbox.checked);
    const enableSystemPromptCheckbox = document.getElementById('enableSystemPromptCheckbox');
    const enableSystemPrompt = !(enableSystemPromptCheckbox && !enableSystemPromptCheckbox.checked);
    const enableContextCheckbox = document.getElementById('enableContextCheckbox');
    const enableContext = !(enableContextCheckbox && !enableContextCheckbox.checked);

    let customTool = null;
    let prompt = "";
    if (this.aiSettings.prompts[action]) {
      prompt = this.aiSettings.prompts[action].replace('{text}', text);
    } else {
      // Handle custom tools
      customTool = this.aiSettings.customTools.find(tool => tool.id === action);
      if (customTool) {
        prompt = customTool.prompt.replace('{text}', text);
      }
    }

    let promptWithContext = prompt;
    if (!skipContext && enableContext && typeof this.getBlockContext === 'function') {
      const context = this.getBlockContext();
      let contextText = (context?.contextText || '').trim();

      const extractTextWithLineBreaks = (sourceRange) => {
        const fragment = sourceRange.cloneContents();
        const textParts = [];

        const walk = (node) => {
          if (!node) return;
          if (node.nodeType === Node.TEXT_NODE) {
            textParts.push(node.nodeValue || '');
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }
          if (node.tagName === "DIV" || node.tagName === "P" || node.tagName === "BR") {
            textParts.push("\n");
          } else {
            textParts.push(" ");
          }
          Array.from(node.childNodes || []).forEach(walk);
        };

        walk(fragment);
        return textParts.join("");
      };

      // Fallback: derive context directly from current selection to ensure previous text is included.
      if (!contextText) {
        try {
          const activeSelection = window.getSelection();
          if (activeSelection && activeSelection.rangeCount && this.editor) {
            const activeRange = activeSelection.getRangeAt(0);
            const startNode = activeRange.startContainer;
            const startElement = startNode.nodeType === Node.ELEMENT_NODE ? startNode : startNode.parentElement;
            const activeBlock = startElement?.closest?.('.block');

            if (activeBlock && this.editor.contains(activeBlock)) {
              try {
                const inBlockPrefixRange = document.createRange();
                inBlockPrefixRange.setStart(activeBlock, 0);
                inBlockPrefixRange.setEnd(startNode, activeRange.startOffset);
                contextText = extractTextWithLineBreaks(inBlockPrefixRange).trim();
              } catch {
                contextText = "";
              }

              if (!contextText) {
                const blocks = Array.from(this.editor.querySelectorAll('.block'));
                const blockIndex = blocks.indexOf(activeBlock);
                if (blockIndex > 0) {
                  contextText = (blocks[blockIndex - 1].textContent || '').trim();
                }
              }
            } else {
              const preSelectionRange = document.createRange();
              preSelectionRange.setStart(this.editor, 0);
              preSelectionRange.setEnd(startNode, activeRange.startOffset);
              contextText = extractTextWithLineBreaks(preSelectionRange).trim();
            }
          }
        } catch {
          contextText = contextText || "";
        }
      }

      promptWithContext =
        'Use <history> as context only.\n<history>\n' +
        contextText +
        '\n</history>\n\n' +
        prompt;
    }

    // Get selected models from buttons
    const model1 = document.getElementById("modelBtn1").getAttribute('data-selected-value') || 'gpt-4o-mini';
    const model2 = document.getElementById("modelBtn2").getAttribute('data-selected-value') || 'none';
    const model3 = document.getElementById("modelBtn3").getAttribute('data-selected-value') || 'none';

    // Build array of selected models (excluding "none")
    const selectedModels = [];
    if (model1 !== "none") selectedModels.push(model1);
    if (model2 !== "none") selectedModels.push(model2);
    if (model3 !== "none") selectedModels.push(model3);

    if (selectedModels.length === 0) {
      alert("Please select at least one AI model");
      return;
    }

    const aiRunDetails = {
      action,
      startedAt: new Date().toISOString(),
      selectedText: text || '',
      useComment,
      contextEnabled: !skipContext && enableContext,
      systemPromptEnabled: enableSystemPrompt,
      systemPrompt: enableSystemPrompt ? this.aiSettings.systemPrompt : '',
      requests: [],
    };
    this._latestAIRequestDetails = aiRunDetails;

    // Hide AI toolbar immediately
    this.aiToolbar.style.display = 'none';
    this.aiToolbar.classList.remove("visible");

    // Get the current block where selection is  
    let selection = window.getSelection();
    let currentBlock = this.currentBlock;
    const range = selection.getRangeAt(0);
    const selectionRange = range.cloneRange ? range.cloneRange() : range;
    const selectionAnchorNode = range ? (range.endContainer || range.commonAncestorContainer) : null;
    let selectionAnchorBlock = null;
    if (selectionAnchorNode) {
      const anchorEl = selectionAnchorNode.nodeType === Node.ELEMENT_NODE ? selectionAnchorNode : selectionAnchorNode.parentElement;
      if (anchorEl) {
        selectionAnchorBlock = anchorEl.closest('.block');
      }
    }
    let commentedSpan = null;

    // Check for image in selection or current block
    let imageUrl = null;
    let audioUrl = null;
    let audioFormat = inputAudioFormat || 'wav';
    let videoUrl = null;
    let selectedContent = range.cloneContents();
    let imgElement = selectedContent?.querySelector('img') || (includeCurrentBlockMedia ? currentBlock.querySelector('img') : null);

    //check for audio and video
    let audioElement = ignoreCurrentBlockAudio
      ? null
      : (selectedContent?.querySelector('audio') || (includeCurrentBlockMedia ? currentBlock.querySelector('audio') : null));
    let videoElement = selectedContent?.querySelector('video') || (includeCurrentBlockMedia ? currentBlock.querySelector('video') : null);


    if (imgElement && imgElement.src) {
      imageUrl = imgElement.src;
    }

    async function fetchAndConvertToBase64(url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]); // Extract Base64 part
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        return base64;
      } catch (error) {
        console.error("Error converting to Base64:", error);
        return null;
      }
    }

    if (inputAudioBase64) {
      audioUrl = inputAudioBase64;
      audioFormat = inputAudioFormat || 'wav';
    }

    if (!inputAudioBase64 && audioElement && audioElement.src) {
      if (this.aiSettings.compitable_mode) {
        audioUrl = await fetchAndConvertToBase64(audioElement.src);
        console.log("Base64 audio:", audioUrl);
      }
      else {
        audioUrl = audioElement.src;
      }

      const audioSrc = audioElement.src || '';
      if (audioSrc.startsWith('data:audio/wav')) {
        audioFormat = 'wav';
      }

    }

    if (videoElement && videoElement.src) {
      if (this.aiSettings.compitable_mode) {
        videoUrl = await fetchAndConvertToBase64(videoElement.src);
        console.log("Base64 video:", videoUrl);
      }
      else {
        videoUrl = videoElement.src || videoElement.querySelector('source').src;
      }

    }



    // To ensure the selected text is never removed when inserting
    // an AI response block, explicitly clear the active selection
    // in non-comment mode before we create any new blocks.
    try {
      if (!useComment && selection && selection.removeAllRanges) {
        selection.removeAllRanges();
      }
    } catch (_) { }

    // build content from audio, image, and video tags
    let content = (imageUrl || audioUrl || videoUrl) ? [
      { type: "text", text: promptWithContext },
      ...(imageUrl ? [{
        type: "image_url",
        image_url: {
          url: imageUrl,
        }
      }] : []),
      ...(audioUrl ? [{
        type: "input_audio",
        input_audio: {
          data: audioUrl,
          format: audioFormat
        }
      }] : []),
      ...(videoUrl ? [{
        type: "input_video",
        input_video: {
          data: videoUrl,
          format: 'mpeg'
        }
      }] : [])
    ] : promptWithContext

    // Prepare a single comment group container if in comment mode
    let commentGroup = null;
    let commentId = null;
    if (useComment) {
      let underlinedElem = utils.underlineSelectedText();
      if (!underlinedElem && selection && selection.anchorNode) {
        const anchor = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
        const existingU = anchor && anchor.closest ? anchor.closest('u') : null;
        if (existingU) underlinedElem = existingU;
      }
      commentId = 'comment' + (underlinedElem ? underlinedElem.id : Date.now());
      let commentContainer = document.getElementById('commentContainer');
      if (!commentContainer) {
        commentContainer = document.createElement('div');
        commentContainer.id = 'commentContainer';
        commentContainer.classList.add('commentContainer');
        this.editor.appendChild(commentContainer);
      }
      // Ensure container is the last child for visibility
      this.editor.appendChild(commentContainer);

      commentGroup = document.getElementById(commentId);
      if (!commentGroup) {
        commentGroup = document.createElement('div');
        commentGroup.id = commentId;
        commentGroup.classList.add('comment', 'block', 'comment-group');
        commentContainer.appendChild(commentGroup);
        commentGroup.setAttribute('contenteditable', 'false');
        commentGroup.innerHTML = `<h4 style="margin: 0; padding: 5px 28px 0 0;">${commentGroup.id}</h4>`;
        commentGroup.after(document.createElement('br'));
        commentGroup.before(document.createElement('br'));
      }
      // Ensure edit/delete controls are present
      this.attachGroupControls(commentGroup);
      commentGroup.classList.add('showcomment');
    }

    let completedResponses = 0;
    const totalResponses = selectedModels.length;
    const finalizeRequests = () => {
      this.showAIRequestCompletedNotice(aiRunDetails);
    };

    // Make parallel requests to selected models
    selectedModels.forEach(modelName => {
      const modelConfig = this.aiSettings.models.find(m => m.model_id === modelName);
      const modelSystemPrompt = enableSystemPrompt
        ? this.aiSettings.systemPrompt +
        (modelName.includes('audio') ? "\n\n you are in audio mode now, you are talent voice actor, you can sing and speak in various tone,do not use html to reply me, only use image or video tag if needed, use <br> tag for newline" : "")
        : '';
      const requestDetail = {
        model: modelName,
        requestUrl: modelConfig?.url || AI_PROXY_URL,
        requestMethod: 'POST',
        requestBody: '',
        rawResponseText: '',
        error: '',
        streamEnabled: false,
      };
      aiRunDetails.requests.push(requestDetail);

      let requestBody = {
        messages: [
          ...(enableSystemPrompt ? [{
            role: "system",
            content: modelSystemPrompt
          }] : []),
          {
            role: "user",
            content: content
          },
        ],
        model: modelName,
        temperature: 0.7,
        top_p: 1,
        stream: this.aiSettings.else.enable_stream,
      };

      if (Array.isArray(content) && content.some((item) => item?.type === 'input_audio')) {
        requestBody.modalities = ['text', 'audio'];
        requestBody.audio = { voice: 'alloy', format: 'wav' };
      }

      // If model has additional configuration in 'else' field, parse and merge it
      let additionalConfig = {};
      if (modelConfig && modelConfig.else) {
        try {
          additionalConfig = JSON.parse(modelConfig.else);
          requestBody = { ...requestBody, ...additionalConfig };
        } catch (error) {
          console.error('Error parsing additional config:', error);
        }
      }
      requestDetail.requestBody = JSON.stringify(requestBody, null, 2);




      let request = this.apiRequest('POST', '', requestBody, true);
      let block = null;
      let contentEl = null;
      if (useComment) {
        // Ensure a tabs bar and contents wrapper exist in the comment group
        let tabsBar = commentGroup.querySelector('.comment-tabs');
        let contentsWrap = commentGroup.querySelector('.comment-contents');
        if (!tabsBar) {
          tabsBar = document.createElement('div');
          tabsBar.className = 'comment-tabs';
          tabsBar.style.display = 'flex';
          tabsBar.style.gap = '8px';
          tabsBar.style.margin = '6px 0';
          tabsBar.style.flexWrap = 'wrap';
          commentGroup.appendChild(tabsBar);
        }
        if (!contentsWrap) {
          contentsWrap = document.createElement('div');
          contentsWrap.className = 'comment-contents';
          commentGroup.appendChild(contentsWrap);
        }
        // Show the comment block immediately near selection
        try {
          const uId = underlinedElem ? underlinedElem.id : (commentGroup.id || '').replace(/^comment/, '');
          this.showCommentTooltip(uId, { clientX: this.lastPointerPosition.x, clientY: this.lastPointerPosition.y });
        } catch (_) { }

        // Create a tab and a content container per model
        let content = contentsWrap.querySelector(`.comment-content[data-model="${modelName}"]`);
        let tabBtn = tabsBar.querySelector(`button[data-model="${modelName}"]`);
        if (!tabBtn) {
          tabBtn = document.createElement('button');
          tabBtn.textContent = modelName;
          tabBtn.setAttribute('data-model', modelName);
          tabBtn.className = 'model-tab';
          tabBtn.addEventListener('click', () => {
            // deactivate all tabs and hide all contents
            tabsBar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            contentsWrap.querySelectorAll('.comment-content').forEach(c => c.style.display = 'none');
            // activate this tab
            tabBtn.classList.add('active');
            const target = contentsWrap.querySelector(`.comment-content[data-model="${modelName}"]`);
            if (target) target.style.display = 'block';
          });
          tabsBar.appendChild(tabBtn);
        }
        if (!content) {
          content = document.createElement('div');
          content.className = 'comment-content';
          content.setAttribute('data-model', modelName);
          content.style.display = 'none';
          content.style.padding = '6px 0';
          contentsWrap.appendChild(content);
        }

        // If no tab is active yet, activate this one by default
        if (!tabsBar.querySelector('button.active')) {
          tabBtn.click();
        }

        // The element to write AI content into
        contentEl = content;
      }
      else {
        // Ensure a single parent ask group with tabs for normal mode
        let askGroup = this.currentAskGroup;
        if (!askGroup) {
          // Preserve user selection when creating AI response block, and anchor below selection's block
          askGroup = this.addNewBlock(true, selectionAnchorBlock || selectionAnchorNode, selectionRange);
          askGroup.classList.add('ask-group');
          askGroup.setAttribute('contenteditable', 'false');
          askGroup.innerHTML = '';
          // Add edit/delete controls to the ask group
          this.attachGroupControls(askGroup);
          this.currentAskGroup = askGroup;
          // Clear the reference after a short delay so subsequent actions create a new group
          setTimeout(() => { if (this.currentAskGroup === askGroup) this.currentAskGroup = null; }, 2000);
        }

        // Setup tabs and contents containers inside ask group
        let tabsBar = askGroup.querySelector('.ask-tabs');
        let contentsWrap = askGroup.querySelector('.ask-contents');
        if (!tabsBar) {
          tabsBar = document.createElement('div');
          tabsBar.className = 'ask-tabs';
          tabsBar.style.display = 'flex';
          tabsBar.style.gap = '8px';
          tabsBar.style.margin = '6px 0';
          tabsBar.style.flexWrap = 'wrap';
          askGroup.appendChild(tabsBar);
        }
        if (!contentsWrap) {
          contentsWrap = document.createElement('div');
          contentsWrap.className = 'ask-contents';
          askGroup.appendChild(contentsWrap);
        }

        // Tab and content per model
        let content = contentsWrap.querySelector(`.ask-content[data-model="${modelName}"]`);
        let tabBtn = tabsBar.querySelector(`button[data-model="${modelName}"]`);
        if (!tabBtn) {
          tabBtn = document.createElement('button');
          tabBtn.textContent = modelName;
          tabBtn.setAttribute('data-model', modelName);
          tabBtn.className = 'model-tab';
          tabBtn.addEventListener('click', () => {
            tabsBar.querySelectorAll('button').forEach(b => { b.classList.remove('active'); });
            contentsWrap.querySelectorAll('.ask-content').forEach(c => c.style.display = 'none');
            tabBtn.classList.add('active');
            const target = contentsWrap.querySelector(`.ask-content[data-model="${modelName}"]`);
            if (target) target.style.display = 'block';
          });
          tabsBar.appendChild(tabBtn);
        }
        if (!content) {
          content = document.createElement('div');
          content.className = 'ask-content';
          content.setAttribute('data-model', modelName);
          content.style.display = 'none';
          content.style.padding = '6px 0';
          contentsWrap.appendChild(content);
        }

        if (!tabsBar.querySelector('button.active')) {
          tabBtn.click();
        }

        contentEl = content;
        block = askGroup; // keep reference compatibility
      }

      request.then(async response => {
        if (response.error) {
          // Handle rate limit or other API errors
          const errorMessage = response.error.code === "RateLimitReached"
            ? `Rate limit reached for ${modelName}. Please try again later or choose another model.`
            : `Error with ${modelName}: ${response.error.message + response.error.code || response.error.toString() || 'Unknown error'}`;
          requestDetail.error = errorMessage;
          requestDetail.rawResponseText = errorMessage;
          this.showToast(errorMessage);
          return;
        }

        let enable_stream = this.aiSettings.else.enable_stream;
        if (additionalConfig.stream === false) enable_stream = false;

        //if model name include gpt-4o-audio or gpt-4o-mini-audio, set enable_stream to false;
        modelName.includes('gpt-4o-audio') ? enable_stream = false : enable_stream = enable_stream;
        modelName.includes('gpt-4o-mini-audio') ? enable_stream = false : enable_stream = enable_stream;
        modelName.includes('openai-audio') ? enable_stream = false : enable_stream = enable_stream;
        requestDetail.streamEnabled = enable_stream;


        if (enable_stream) {
          //the text will be in eventstream like {"id":"chatcmpl-b2RL2SeSw6wgjYjgB5qKfURWtXI1w","choices":[{"index":0,"delta":{"role":"assistant","content":""},"logprobs":null,"finish_reason":null}],"created":1740386280,"model":"gemini-2.0-flash","object":"chat.completion.chunk"}	
          //so we need to concat the content
          let text = "";
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = ""; // Add a buffer to handle incomplete chunks
          let chunkCounter = 0;
          let done = false;

          while (!done) {
            const { done: doneReading, value } = await reader.read();
            done = doneReading;

            // If we have data to process
            if (value) {
              // Decode with stream option to properly handle multi-byte characters
              const chunk = decoder.decode(value, { stream: true });
              chunkCounter++;

              // Add chunk to buffer
              buffer += chunk;

              // Process complete messages
              const lines = buffer.split("\n\n");
              // Keep the last part in buffer as it might be incomplete
              buffer = lines.pop() || "";

              for (const line of lines) {
                // Skip empty lines
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine === "[DONE]") continue;

                // Handle data: prefix
                const jsonStr = trimmedLine.replace(/^data: /, "");

                //check jsonStr is valid json or not
                if (jsonStr && jsonStr === "[DONE]") {
                  continue;
                }

                try {
                  const parsedData = JSON.parse(jsonStr);

                  if (parsedData && parsedData.choices) {
                    const delta = parsedData.choices[0]?.delta;
                    if (delta && delta.content) {
                      text += delta.content;
                      contentEl.innerHTML += delta.content;
                      if (chunkCounter === 6) {
                        contentEl.innerHTML = text;

                      }
                      if (chunkCounter === 80) {
                        contentEl.innerHTML = text;

                      }
                    }
                  }
                } catch (error) {
                  console.error('Error parsing JSON:', error, 'Line:', jsonStr);
                }
              }
            }
          }

          // Process any data left in the buffer
          if (buffer.trim()) {
            const jsonStr = buffer.replace(/^data: /, "").trim();
            if (jsonStr && jsonStr !== "[DONE]") {
              try {
                const parsedData = JSON.parse(jsonStr);
                if (parsedData && parsedData.choices) {
                  const delta = parsedData.choices[0]?.delta;
                  if (delta && delta.content) {
                    text += delta.content;
                  }
                }
              } catch (error) {
                console.error('Error parsing final JSON:', error);
              }
            }
          }

          // Final update of the UI
          contentEl.innerHTML = text + '<br><br> by ' + modelName;
          requestDetail.rawResponseText = text;
          console.log(text);

          this.delayedSaveNote();
        }

        else {
          let responseObject = await response.json();
          console.log(responseObject);
          // Handle the response for audio output , the audio is in responseObject.choices[0].message.audio, it has properties data: kjasbase64, transcript: "text"
          if (responseObject.choices[0].message.audio) {
            let audio = responseObject.choices[0].message.audio;
            let audioUrl = 'data:audio/wav;base64,' + audio.data;
            requestDetail.rawResponseText = audio.transcript || '';
            contentEl.innerHTML = `<audio controls src="${audioUrl}" type="audio/wav"></audio>
            <br><br> ${audio.transcript} 
            <br><br> by ${modelName}`;

          }
          else {
            requestDetail.rawResponseText = responseObject.choices[0].message.content || '';
            contentEl.innerHTML = responseObject.choices[0].message.content + '<br><br> by ' + modelName;

          }

          this.cleanNote();
          this.delayedSaveNote();

        }
      }).catch(error => {
        console.error(`Error with ${modelName} request:`, error);
        requestDetail.error = `${error || 'error'}`;
        requestDetail.rawResponseText = `${error || 'error'}`;
        this.showToast(`Error with ${modelName}: ${error || ' error'}`);
      }).finally(() => {
        completedResponses++;
        if (completedResponses === totalResponses) {
          this.delayedSaveNote(true);
          this.cleanNote();
          finalizeRequests();
        }
      });

    });

  },

  async handleQuickAsk(options = {}) {
    const {
      inputAudioBase64 = null,
      inputAudioFormat = 'wav',
      textPrompt = 'What is in this recording?',
      ignoreCurrentBlockAudio = false,
    } = options;
    const context = this.getBlockContext();
    if (!context) {
      alert('Please select or create a block first');
      return;
    }

    const promptText = inputAudioBase64
      ? `${textPrompt}\n\nthis is our chat history,when generate image, dont include text from history unless needed :\n <history>${context.contextText}\n</history>\n\n\n${context.currentText}`
      : 'this is our chat history,when generate image, dont include text from history unless needed :\n <history>' + context.contextText + '\n</history>\n\n\n' + context.currentText;

    return this.handleAIAction('ask', promptText, true, {
      skipContext: true,
      inputAudioBase64,
      inputAudioFormat,
      ignoreCurrentBlockAudio,
    });
  },

  setupAISettings() {
    const modal = document.getElementById('aiSettingsModal');
    const aiSettingsBtn = document.getElementById('aiSettingsBtn');
    const closeBtn = modal.querySelector('.close');
    const saveBtn = document.getElementById('saveSettings');
    const addCustomToolBtn = document.getElementById('addCustomTool');
    const enableStreamCheckbox = document.getElementById('enableStreamCheckbox');

    // Load current settings
    document.getElementById('systemPrompt').value = this.aiSettings.systemPrompt;
    document.getElementById('askPrompt').value = this.aiSettings.prompts.ask;
    document.getElementById('correctPrompt').value = this.aiSettings.prompts.correct;
    document.getElementById('translatePrompt').value = this.aiSettings.prompts.translate;

    // Ensure the else object exists
    if (!this.aiSettings.else) {
      this.aiSettings.else = {};
    }

    // Set the checkbox based on the current setting
    enableStreamCheckbox.checked = this.aiSettings.else.enable_stream || false; // Default to false if undefined

    this.renderCustomTools();
    this.renderModelSettings();

    // Event listeners
    aiSettingsBtn.onclick = () => {
      // Update values from current settings when opening modal
      document.getElementById('askPrompt').value = this.aiSettings.prompts.ask;
      document.getElementById('correctPrompt').value = this.aiSettings.prompts.correct;
      document.getElementById('translatePrompt').value = this.aiSettings.prompts.translate;
      // Add help text for using {text} in prompt templates
      document.getElementById('askPrompt').title = "Use {text} where you want the selected text inserted.";
      document.getElementById('correctPrompt').title = "Use {text} where you want the selected text inserted.";
      document.getElementById('translatePrompt').title = "Use {text} where you want the selected text inserted.";

      this.renderCustomTools();
      this.renderModelSettings();
      modal.style.display = "block";
    };
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (e) => {
      if (e.target === modal) modal.style.display = "none";
    };

    addCustomToolBtn.onclick = () => this.addCustomTool();
    document.getElementById('addModelBtn').onclick = () => this.addModel();

    saveBtn.onclick = async () => {

      await this.saveAISettings();
      modal.style.display = "none";
      this.updateAIToolbar();
      this.updateModelDropdowns();
    };

    // Add reset button functionality
    const resetSystemPromptBtn = document.getElementById('resetSystemPrompt');
    const editor = this; // Store reference to the class instance

    resetSystemPromptBtn.onclick = () => {
      if (confirm('Are you sure you want to reset the system prompt to default?')) {
        const systemPromptInput = document.getElementById('systemPrompt');
        systemPromptInput.value = editor.DEFAULT_SYSTEM_PROMPT;
        // Add highlight effect
        systemPromptInput.style.transition = 'background-color 0.3s';
        systemPromptInput.style.backgroundColor = '#e3f2fd';
        setTimeout(() => {
          systemPromptInput.style.backgroundColor = '';
        }, 500);
      }
    };
  },

  renderCustomTools() {
    const container = document.getElementById('customTools');
    container.innerHTML = '';

    this.aiSettings.customTools.forEach((tool, index) => {
      const toolDiv = document.createElement('div');
      toolDiv.className = 'custom-tool';
      toolDiv.style.marginBottom = '20px';
      toolDiv.innerHTML = `
          <div style="margin-bottom: 10px;">
            <input type="text" class="tool-name" placeholder="Tool Name" value="${tool.name}" style="width: 300px; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
            <button class="remove-tool" data-index="${index}" style="margin-left: 10px; padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
          </div>
          <div >
            <textarea class="tool-prompt" placeholder="Prompt Template" >${tool.prompt}</textarea>
            <small style="display: block; margin-top: 4px; color: #6c757d;">Use {text} where you want the selected text to be inserted</small>
          </div>
        `;

      toolDiv.querySelector('.remove-tool').onclick = () => {
        if (confirm('Are you sure you want to delete this custom tool?')) {
          this.aiSettings.customTools.splice(index, 1);
          this.renderCustomTools();
        }
      };

      container.appendChild(toolDiv);
    });


  },

  addCustomTool() {
    this.aiSettings.customTools.push({
      id: 'custom_' + Date.now(),
      name: '',
      prompt: ''
    });
    this.renderCustomTools();

    // Focus the name input of the newly added tool
    const tools = document.querySelectorAll('.custom-tool');
    const newTool = tools[tools.length - 1];
    if (newTool) {
      const nameInput = newTool.querySelector('.tool-name');
      nameInput.focus();
    }
  },

  renderModelSettings() {
    const container = document.getElementById('modelSettingsContainer');
    container.innerHTML = '';
    if (!this.aiSettings.models) {
      this.aiSettings.models = [];
    }
    this.aiSettings.models.forEach((model, index) => {
      const div = document.createElement('div');
      div.className = 'model-config';
      div.innerHTML = `
        <input type="text" class="model-name" placeholder="Model Name" value="${model.name}" name="model_name">
        <input type="text" class="model-id" placeholder="Model ID" value="${model.model_id}" name="model_id">
        <input type="text" class="model-url" placeholder="Model URL" value="${model.url}" name="model_url">
        <input type="text" class="model-api-key" placeholder="API Key" value="${model.api_key}" name="model_api_key">
        <textarea class="model-else" placeholder="Additional configuration (e.g. modalities, audio settings)" name="model_else">${model.else || ''}</textarea>
        <button class="remove-model" data-index="${index}"><i class="fas fa-trash"></i></button>
      `;

      div.querySelector('.remove-model').onclick = () => {
        this.aiSettings.models.splice(index, 1);
        this.renderModelSettings();
      };
      container.appendChild(div);
    });
  },

  addModel() {
    this.aiSettings.models.push({
      name: '',
      model_id: '',
      url: 'https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions',
      api_key: '',
      else: ''
    });
    this.renderModelSettings();
  },

  async loadUserConfig() {
    try {
      const config = await this.apiRequest("GET", "/users/config");
      if (config && !config.error) {
        // Parse the config if it's a string
        const parsedConfig = typeof config.config === 'string' ? JSON.parse(config.config) : config.config;

        // Load system prompt first
        if (parsedConfig.systemPrompt) {
          this.aiSettings.systemPrompt = parsedConfig.systemPrompt;
          // Update the textarea if it exists
          const systemPromptInput = document.getElementById('systemPrompt');
          if (systemPromptInput) {
            systemPromptInput.value = parsedConfig.systemPrompt;
          }
        } else {
          this.aiSettings.systemPrompt = this.DEFAULT_SYSTEM_PROMPT;
          const systemPromptInput = document.getElementById('systemPrompt');
          if (systemPromptInput) {
            systemPromptInput.value = this.DEFAULT_SYSTEM_PROMPT;
          }
        }

        // Merge prompts
        this.aiSettings.prompts = parsedConfig.prompts || {
          ask: "Answer this question: {text}",
          correct: "Correct any grammar or spelling errors in this text: {text}",
          translate: "Translate this text to English: {text}"
        };

        // Merge customTools
        this.aiSettings.customTools = parsedConfig.customTools || [];

        if (parsedConfig.models) {
          this.aiSettings.models = [...parsedConfig.models];
        } else {
          this.aiSettings.models = [...this.DEFAULT_MODELS];
        }
        this.updateModelDropdowns();
      }
      this.updateAIToolbar();
    } catch (error) {
      console.error("Error loading user config:", error);
    }
  },

  async saveAISettings() {
    // Gather updated model data from the UI
    const modelConfigs = document.querySelectorAll('.model-config');
    const updatedModels = Array.from(modelConfigs).map(mc => ({
      name: mc.querySelector('.model-name').value,
      model_id: mc.querySelector('.model-id').value,
      url: mc.querySelector('.model-url').value,
      api_key: mc.querySelector('.model-api-key').value,
      else: mc.querySelector('.model-else').value
    }));

    // Prepare the config object
    const config = {
      systemPrompt: document.getElementById('systemPrompt').value || "you are a assistant to help user write better doc now,  only output html body innerHTML code  to me, don't put it in ```html ```,do not use markdown, you can put a head h2 with 2 to 5 words at start to summary the doc; use inline style to avoid affect parent element, make the html doc looks beautiful, clean and mordern.",
      prompts: {
        ask: document.getElementById('askPrompt').value,
        correct: document.getElementById('correctPrompt').value,
        translate: document.getElementById('translatePrompt').value
      },
      customTools: Array.from(document.querySelectorAll('.custom-tool')).map((toolDiv, index) => ({
        id: this.aiSettings.customTools[index]?.id || 'custom_' + Date.now(),
        name: toolDiv.querySelector('.tool-name').value,
        prompt: toolDiv.querySelector('.tool-prompt').value
      })),
      models: updatedModels,
      else: {
        enable_stream: document.getElementById('enableStreamCheckbox').checked
      }
    };

    try {
      await this.apiRequest("POST", "/users/config", { config: JSON.stringify(config) });
      // Update local settings after successful save
      this.aiSettings = config;
    } catch (error) {
      console.error("Error saving user config:", error);
      alert("Failed to save settings to server");
    }
  },

  hideAllDropdowns() {
    try {
      // Clear inline styles so CSS hover works later
      document.querySelectorAll('.toolbar .dropdown .dropdown-content').forEach(dc => dc.style.display = '');
      // Lock dropdowns temporarily until mouse leaves toolbar or user clicks button again
      if (this.toolbar) this.toolbar.classList.add('dropdowns-locked');
    } catch (_) { }
  },

  updateAIToolbar() {
    const actionsContainer = this.aiToolbar.querySelector('.ai-actions');
    actionsContainer.innerHTML = `
      <button data-ai-action="ask"><i class="fas fa-question-circle"></i> Ask</button>
      <button data-ai-action="correct"><i class="fas fa-check-circle"></i> Correct</button>
      <button data-ai-action="translate"><i class="fas fa-language"></i> Translate</button>
    `;

    // Add custom tool buttons
    this.aiSettings.customTools.forEach(tool => {
      if (tool.name) {
        const button = document.createElement('button');
        button.setAttribute('data-ai-action', tool.id);
        button.innerHTML = `<i class="fas fa-magic"></i> ${tool.name}`;
        actionsContainer.appendChild(button);
      }
    });

    // Rebind click events
    actionsContainer.querySelectorAll('button').forEach(button => {
      // Preserve the user's selection across the toolbar click
      button.addEventListener('mousedown', (e) => {
        this._savedSelection = this.captureSelection && this.captureSelection();
        // Prevent focus change from collapsing selection
        e.preventDefault();
      });
      button.addEventListener('click', async () => {
        if (this._savedSelection && this.restoreSelection) {
          this.restoreSelection(this._savedSelection);
          this._savedSelection = null;
        }
        const action = button.dataset.aiAction;
        const selectedText = window.getSelection().toString().trim();
        this.aiToolbar.style.display = 'none';

        await this.handleAIAction(action, selectedText);
      });
    });
  },
};

export default mixin;
