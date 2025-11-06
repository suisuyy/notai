const API_BASE_URL = "https://notais.suisuy.eu.org";
let currentUser = {
  userId: localStorage.getItem("userId"),
  credentials: localStorage.getItem("credentials"),
};


let globalDevices = {
  mediaStream: null
};


let utils = {
  getCurrentTimeString() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  },
  underlineSelectedText() {
    if (window.getSelection) {
      const selection = window.getSelection();

      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        //check if it already in <u>,do nothing then
        if (range.startContainer.parentNode.nodeName === 'U') {
          return;
        }

        // Create underline element
        const uElement = document.createElement('u');
        //set a id for u, the id is u+Date.now()
        uElement.id = 'u' + Date.now();
        //create a space text elem
        const spaceText = document.createTextNode('\u00A0\u00A0');

        try {
          // Wrap selected content in the u element
          range.surroundContents(uElement);
          uElement.after(spaceText);
          return uElement;

          // Clear selection
          //selection.removeAllRanges();
        } catch (e) {
          console.error("Cannot wrap selection that crosses multiple nodes:", e);
          alert("Cannot underline text that spans across different elements or already includes formatting. Try selecting text within a single paragraph.");
        }
      } else {
        alert("Please select some text first.");
      }
    }
  },
  insertTextAtCursor(insertedText, removeSelectionDelay = 1000) {
    const activeElement = document.activeElement;

    if (activeElement.isContentEditable) {
      // For contenteditable elements
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      selection.deleteFromDocument();
      const range = selection.getRangeAt(0);
      //insertedText may be multiple lines, so split it and insert each line
      let lines = insertedText.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        let line = lines[i];

        if (i < lines.length - 1) {
          range.insertNode(document.createElement('br'));
        }
        range.insertNode(document.createTextNode(line + ' '));
      }
      // If the selection is not collapsed, collapse it
      selection.removeAllRanges();
      selection.addRange(range);
      setTimeout(() => {
        selection.removeAllRanges();
        range.collapse(false);
        selection.addRange(range);

      }, removeSelectionDelay);

    } else if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      // For textarea or input elements
      const startPos = activeElement.selectionStart;
      const endPos = activeElement.selectionEnd;
      const beforeText = activeElement.value.substring(0, startPos);
      const afterText = activeElement.value.substring(endPos, activeElement.value.length);
      activeElement.value = beforeText + insertedText + afterText;
      // Move the cursor to the end of the inserted text
      const cursorPosition = startPos + insertedText.length;
      activeElement.setSelectionRange(cursorPosition, cursorPosition);
      activeElement.focus();
    } else {
      // Unsupported element
      console.warn('The active element is neither contenteditable nor a textarea/input.');
      return false;
    }
  },
  base64ToBlob(base64String) {
    let mimeType;
    let base64Data;

    // Check if it's a data URL (starts with "data:")
    if (base64String.startsWith('data:')) {
      // Extract MIME type and base64 data
      const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);

      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format');
      }

      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      // If it's not a data URL, try to detect the type from content
      base64Data = base64String;
      mimeType = detectMimeTypeFromBase64(base64Data);
    }

    // Convert base64 to binary
    const binaryString = atob(base64Data);

    // Create array buffer from binary string
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob from array buffer
    return new Blob([bytes], { type: mimeType });
  },

  detectMimeTypeFromBase64(base64String) {
    // Decode a small portion of the beginning to check file signatures
    const sample = atob(base64String.substring(0, 24));
    const bytes = new Uint8Array(sample.length);
    for (let i = 0; i < sample.length; i++) {
      bytes[i] = sample.charCodeAt(i);
    }

    // Check file signatures (magic numbers)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }

    // JPEG signature: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }

    // GIF signature: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }

    // PDF signature: 25 50 44 46
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'application/pdf';
    }

    // MP3 signature: ID3 or FF FB
    if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xFF && bytes[1] === 0xFB)) {
      return 'audio/mpeg';
    }

    // MP4/M4A signature: 66 74 79 70
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return 'video/mp4';
    }

    // WebM signature: 1A 45 DF A3
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'video/webm';
    }

    // OGG signature: 4F 67 67 53
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'audio/ogg';
    }

    // WEBP signature: 52 49 46 46 then WEBP at offset 8
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }

    // Default to octet-stream if type cannot be determined
    return 'application/octet-stream';
  }
}


class HTMLEditor {
  constructor() {
    // Define DEFAULT_SYSTEM_PROMPT as a class property
    this.DEFAULT_SYSTEM_PROMPT = `
you are a assistant with most advanced knowledge, you should write html doc to reply me,  only output html body innerHTML code  to me, don't put it in codeblock do not use markdown;
you can put a head h2 with 2 to 5 words at start to summary the doc, aligned at left; 

use inline style to avoid affect parent element, make the html doc looks beautiful, clean and mordern, make style like MDN site.  

you can use image to show the concept when needed, like show a word definition via image, the img get api is simple, put the prompt after https://image.pollinations.ai/prompt/(you prompt for image here)??model=kontext , so you can just put it in a img tag, don't set any style of the img tag.

you can use audio tag too, when use asked you response in voice, use this get api https://text.pollinations.ai/(text prompt here)?model=openai-audio&voice=coral put it in audio tag, it will return audio response for the text prompt, don't set any style of the audio tag.  if user request TTS, you can use this api https://text.pollinations.ai/you are TTS engin now, just repeat this: (put the text you want to say here)?model=openai-audio&voice=coral

when in voice mode, you need not wrap text in html tags like div br span ..., just use markdown response me,only need simple img,audio,video tag for showing media when need

`;

    // Initialize core editor elements with error checking
    const editor = document.getElementById("editor");

    // Initialize last pointer position
    this.lastPointerPosition = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Load recent notes on startup
    this.updateRecentNotesUI();

    // Listen for pointer down events to update the last position
    document.addEventListener('pointerdown', (e) => {
      this.lastPointerPosition = { x: e.clientX, y: e.clientY };
    });
    const sourceView = document.getElementById("sourceView");
    const toolbar = document.querySelector(".toolbar");
    const aiToolbar = document.getElementById("aiToolbar");

    // Define DEFAULT_MODELS as a class property
    this.DEFAULT_MODELS = [
      { name: "gpt-4o", model_id: "gpt-4o", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "gpt-4o-mini", model_id: "gpt-4o-mini", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "Meta-Llama-3.1-405B-Instruct", model_id: "Meta-Llama-3.1-405B-Instruct", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "Llama-3.2-90B-Vision-Instruct", model_id: "Llama-3.2-90B-Vision-Instruct", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
      { name: "Mistral-large", model_id: "Mistral-large", url: "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions", api_key: '' },
    ];

    // Verify required elements exist
    if (!editor || !sourceView || !toolbar || !aiToolbar) {
      console.error("Required editor elements not found");
      return;
    }


    // Assign verified elements
    this.editor = editor;
    this.sourceViewEditor = CodeMirror.fromTextArea(
      sourceView,
      {
        mode: "htmlmixed",
        lineNumbers: true,
        autoCloseTags: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
        foldGutter: true,
        styleActiveLine: true,


      },
    );
    setTimeout(() => {
      let editorView = this.sourceViewEditor.getWrapperElement();
      editorView.style.display = 'none';
      editorView.style.height = '80vh';

    }, 2000);
    this.toolbar = toolbar;
    this.aiToolbar = aiToolbar;
    this.setEditableState(false);
    this.currentNoteTitle = "";
    this.lastSavedContent = "";
    this.lastUpdated = null;
    this.lastInteractionTime = 0;
    this._oversizedDefaultNoteState = {
      noteId: null,
      status: 'idle',
      timer: null,
      noteData: null,
    };
    this.aiSettings = {
      systemPrompt: this.DEFAULT_SYSTEM_PROMPT,

      prompts: {
        ask: "Answer this question: {text}",
        correct: "Correct any grammar or spelling errors in this text: {text}",
        translate: "Translate this text to English: {text}"
      },
      customTools: [],
      models: [...this.DEFAULT_MODELS],
      else: {
        enable_stream: true,
      }
    };
    this.loadUserConfig();
    this.setupEventListeners();
    this.setupAIToolbar();
    this.setupAISettings();
    this.setupTableOfContents();
    this.setupCommentSystem();
    this.updateAIToolbar(); // Load custom AI buttons

    // Seed history with initial content after DOM is ready
    setTimeout(() => this.resetHistoryWithCurrentContent(), 0)

    // Add title auto-save
    const titleElement = document.getElementById("noteTitle");
    titleElement.addEventListener('input', () => this.delayedSaveNote());
    this.currentBlock = null;
    this.content = ""; // Store markdown content
    this.isSourceView = false;
    this.autoSaveTimeout = null;
    this.deferredRemoteNoteId = null;
    this.audioRecordType = 'audio/webm';
    //check if the browser support webm, if not , use mp4
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      this.audioRecordType = 'audio/mp4';
    }
    //get file extension from the type
    this.audioRecordExt = this.audioRecordType.split('/')[1];
    //set video record type to video/this.audioRecordExt
    this.videoRecordType = 'video/' + this.audioRecordExt;
    this.videoRecordExt = this.audioRecordExt;


    this.checkAuthAndLoadNotes();
    this.loadFolders();
    this.setupCodeCopyButton();

    // Initialize undo/redo history
    this.initializeHistory();

    //timeout id and interval id 
    this.inputToUpdateLastUpdatedTimeoutID = 0;
    this.editor.addEventListener('pointerdown', (e) => {
      if (this.deferredRemoteNoteId) {
        const pendingNoteId = this.deferredRemoteNoteId;
        this.deferredRemoteNoteId = null;
        this.loadNote(pendingNoteId);
      }

      this.currentBlock?.classList?.remove('currentBlock');

      this.currentBlock = this.getCurrentOtterBlock(e.target);

      if (e.target.classList.contains('block')) {
      }

      console.log('current blcok', this.currentBlock)
      this.currentBlock?.classList?.add('highlight');
      this.currentBlock?.classList?.add('currentBlock');
      setTimeout(() => {
        this.currentBlock?.classList?.remove('highlight');
      }, 1500);

      if (e.target.tagName === "U") {
        console.log(e.target);
        //check if e.target insider a showcomment block, dont remove 
        let node = e.target;
        while (node) {
          if (node.classList && node.classList.contains('showcomment')) {
            this.showCommentTooltip(e.target.id, e);

            return;
          }
          node = node.parentElement;
        }

        document.querySelector('.showcomment')?.classList.remove('showcomment');
        this.showCommentTooltip(e.target.id, e);
      }
      else {
        let node = e.target;
        while (node) {
          if (node.classList && node.classList.contains('comment')) {
            return;
          }
          node = node.parentElement;
        }
        document.querySelectorAll('.showcomment').forEach(element => {
          element.classList.remove('showcomment');
        });


      }
    });
  }

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

  }

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
  }

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
  }

  hideSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (!spinner) return;

    spinner.style.display = 'none';

    // Clear the timeout if the spinner is hidden manually
    if (this.spinnerTimeout) {
      clearTimeout(this.spinnerTimeout);
      this.spinnerTimeout = null;
    }
  }

  async apiRequest(method, endpoint, body = null, isAIRequest = false, noSpinner = false) {
    // Show the spinner before making the request
    if (!noSpinner) this.showSpinner();

    const headers = {
      "Content-Type": "application/json",
    };

    if (isAIRequest) {
      const model = this.aiSettings.models.find(m => m.model_id === body?.model);
      if (model?.api_key) {
        headers["Authorization"] = `Bearer ${model.api_key}`;
      }
    } else if (currentUser.userId && currentUser.credentials) {
      headers["Authorization"] = `Basic ${currentUser.credentials}`;
    }

    try {
      const url = isAIRequest
        ? "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions"
        : `${API_BASE_URL}${endpoint}`;

      //get else from config and combine it to body
      let elseconfig = {}
      try {

        elseconfig = JSON.parse(this.aiSettings.models.find(m => m.model_id === body?.model)?.else || '{}');
        console.log('else config', elseconfig);
      } catch (error) {
        console.log('error when parse else config', error)
      }
      body = { ...body, ...elseconfig };
      const response = await fetch(
        isAIRequest && body?.model
          ? (this.aiSettings.models.find(m => m.model_id === body.model)?.url ||
            "https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions")
          : url, {
        method,
        headers,
        body: method === 'GET' ? null : body ? JSON.stringify(body) : null,
      });

      // Hide the spinner after the request completes
      this.hideSpinner();
      if (isAIRequest) {
        return response;
      }
      else {
        let responseObject = await response.json();
        return responseObject;
      }

    } catch (error) {
      console.error("API Error:", error);
      this.hideSpinner(); // Ensure spinner is hidden on error
      return { error: "Network error" };
    }
  }

  // Convert newline characters to <br> tags
  convertNewlinesToBreaks(text) {
    return text.replace(/\n/g, '<br>');
  }

  // Convert HTML to Markdown
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
  }



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
  }

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
  }

  // Insert content into the editor, converting newlines to <br>
  insertContent(text) {
    this.editor.innerHTML += this.convertNewlinesToBreaks(text);
  }

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
  }

  toggleEditable() {
    this.setEditableState(!this.isEditable);
  }

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
  }

  setupAIToolbar() {
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
  }

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
  }

  // Helper function to get display name for model
  getModelDisplayName(value) {
    const model = this.aiSettings.models.find(m => m.model_id === value);
    return model ? model.name : value;
  }

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
  }

  async handleAIAction(action, text, includeCurrentBlockMedia = false) {

    this.lastUpdated = utils.getCurrentTimeString();
    //log last updated time
    console.log('handleaiaction update this.lastupdated:', this.lastUpdated);

    const useComment = text.split(' ').length < 3;

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

    // Hide AI toolbar immediately
    this.aiToolbar.style.display = 'none';
    this.aiToolbar.classList.remove("visible");

    // Get the current block where selection is  
    let selection = window.getSelection();
    let currentBlock = this.currentBlock;
    const range = selection.getRangeAt(0);
    let commentedSpan = null;

    // Check for image in selection or current block
    let imageUrl = null;
    let audioUrl = null;
    let videoUrl = null;
    let selectedContent = range.cloneContents();
    let imgElement = selectedContent?.querySelector('img') || (includeCurrentBlockMedia ? currentBlock.querySelector('img') : null);

    //check for audio and video
    let audioElement = selectedContent?.querySelector('audio') || (includeCurrentBlockMedia ? currentBlock.querySelector('audio') : null);
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

    if (audioElement && audioElement.src) {
      if (this.aiSettings.compitable_mode) {
        audioUrl = await fetchAndConvertToBase64(audioElement.src);
        console.log("Base64 audio:", audioUrl);
      }
      else {
        audioUrl = audioElement.src;
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



    // build content from audio, image, and video tags
    let content = (imageUrl || audioUrl || videoUrl) ? [
      { type: "text", text: prompt },
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
          format: 'mpeg'
        }
      }] : []),
      ...(videoUrl ? [{
        type: "input_video",
        input_video: {
          data: videoUrl,
          format: 'mpeg'
        }
      }] : [])
    ] : prompt

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

    // Make parallel requests to selected models
    const requests = selectedModels.map(modelName => {
      const modelConfig = this.aiSettings.models.find(m => m.model_id === modelName);
      let requestBody = {
        messages: [
          {
            role: "system",
            content:
              this.aiSettings.systemPrompt +
              (modelName.includes('audio') ? "\n\n you are in audio mode now, you are talent voice actor, you can sing and speak in various tone,do not use html to reply me, only use image or video tag if needed, use <br> tag for newline" : "")
          },
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
          askGroup = this.addNewBlock();
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
          this.showToast(errorMessage);
          completedResponses++;
          if (completedResponses === totalResponses) {
            this.delayedSaveNote(true);
          }
          return;
        }

        let enable_stream = this.aiSettings.else.enable_stream;
        if (additionalConfig.stream === false) enable_stream = false;

        //if model name include gpt-4o-audio or gpt-4o-mini-audio, set enable_stream to false;
        modelName.includes('gpt-4o-audio') ? enable_stream = false : enable_stream = enable_stream;
        modelName.includes('gpt-4o-mini-audio') ? enable_stream = false : enable_stream = enable_stream;
        modelName.includes('openai-audio') ? enable_stream = false : enable_stream = enable_stream;


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
            contentEl.innerHTML = `<audio controls src="${audioUrl}" type="audio/wav"></audio>
            <br><br> ${audio.transcript} 
            <br><br> by ${modelName}`;

          }
          else {
            contentEl.innerHTML = responseObject.choices[0].message.content + '<br><br> by ' + modelName;

          }

          this.cleanNote();
          this.delayedSaveNote();

        }
      }).catch(error => {
        console.error(`Error with ${modelName} request:`, error);
        this.showToast(`Error with ${modelName}: ${error || ' error'}`);
        completedResponses++;
        if (completedResponses === totalResponses) {
          this.delayedSaveNote(true);
          this.cleanNote();

        }
      });

    });

    let completedResponses = 0;
    const totalResponses = requests.length;

    requests.forEach(async (request, index) => {
    });

  }

  async handleQuickAsk() {
    const context = this.getBlockContext();
    if (!context) {
      alert('Please select or create a block first');
      return;
    }
    this.handleAIAction('ask', 'this is our chat history,when generate image, dont include text from history unless needed :\n <history>' + context.contextText + '\n</history>\n\n\n' + context.currentText, true);
  }

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
  }

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


  }

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
  }

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
  }

  addModel() {
    this.aiSettings.models.push({
      name: '',
      model_id: '',
      url: 'https://gmapi.suisuy.eu.org/corsproxy?q=https://models.inference.ai.azure.com/chat/completions',
      api_key: '',
      else: ''
    });
    this.renderModelSettings();
  }

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
  }


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
  }

  hideAllDropdowns() {
    try {
      // Clear inline styles so CSS hover works later
      document.querySelectorAll('.toolbar .dropdown .dropdown-content').forEach(dc => dc.style.display = '');
      // Lock dropdowns temporarily until mouse leaves toolbar or user clicks button again
      if (this.toolbar) this.toolbar.classList.add('dropdowns-locked');
    } catch (_) { }
  }

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
      button.addEventListener('click', async () => {
        const action = button.dataset.aiAction;
        const selectedText = window.getSelection().toString().trim();
        this.aiToolbar.style.display = 'none';

        await this.handleAIAction(action, selectedText);
      });
    });
  }

  // Inject edit/delete controls into a response group element
  attachGroupControls(groupEl) {
    try {
      if (!groupEl) return;
      // If controls already exist (e.g., after reload), remove them so we can reattach fresh listeners
      const existingControls = groupEl.querySelector('.group-controls');
      if (existingControls) existingControls.remove();
      // Position container so controls are anchored to this block
      if (getComputedStyle(groupEl).position === 'static') groupEl.style.position = 'relative';

      const controls = document.createElement('div');
      controls.className = 'group-controls';
      controls.setAttribute('contenteditable', 'false');
      controls.style.position = 'absolute';
      controls.style.top = '6px';
      controls.style.right = '8px';
      controls.style.display = 'flex';
      controls.style.gap = '6px';
      controls.style.background = 'transparent';
      controls.style.border = 'none';
      controls.style.borderRadius = '8px';
      controls.style.padding = '0';
      controls.style.boxShadow = 'none';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.innerHTML = '<span aria-label="Edit" title="Edit" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">✏️</span>';
      toggleBtn.style.cursor = 'pointer';
      toggleBtn.style.border = 'none';
      toggleBtn.style.background = 'transparent';
      toggleBtn.style.padding = '0';
      toggleBtn.style.fontSize = '14px';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.innerHTML = '<span aria-label="Delete" title="Delete" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">🗑️</span>';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.border = 'none';
      deleteBtn.style.background = 'transparent';
      deleteBtn.style.padding = '0';
      deleteBtn.style.color = '#b91c1c';
      deleteBtn.style.fontSize = '14px';

      // Toggle editability
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isEditable = groupEl.getAttribute('contenteditable') === 'true';
        if (isEditable) {
          groupEl.setAttribute('contenteditable', 'false');
          toggleBtn.innerHTML = '<span aria-label="Edit" title="Edit" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">✏️</span>';
        } else {
          groupEl.setAttribute('contenteditable', 'true');
          toggleBtn.innerHTML = '<span aria-label="Lock" title="Lock" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">🔒</span>';
          groupEl.focus();
        }
      });

      // Delete whole block
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = confirm('Delete this AI response block?');
        if (ok) {
          const prev = groupEl.previousSibling;
          const next = groupEl.nextSibling;
          if (prev && prev.nodeName === 'BR') prev.remove();
          if (next && next.nodeName === 'BR') next.remove();
          groupEl.remove();
          this.delayedSaveNote();
        }
      });

      controls.appendChild(toggleBtn);
      controls.appendChild(deleteBtn);
      groupEl.appendChild(controls);

      // Mark that controls have been attached
      groupEl.dataset.controlsAttached = '1';
    } catch (err) {
      console.error('attachGroupControls error', err);
    }
  }

  // Ensure all existing groups have controls (useful after loading content)
  ensureGroupControls() {
    try {
      const groups = this.editor.querySelectorAll('.ask-group, .comment-group');
      groups.forEach((g) => this.attachGroupControls(g));
      // Also watch for newly inserted groups
      const obs = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.classList && (node.classList.contains('ask-group') || node.classList.contains('comment-group'))) {
              this.attachGroupControls(node);
            }
            node.querySelectorAll && node.querySelectorAll('.ask-group, .comment-group').forEach((el) => this.attachGroupControls(el));
          });
        }
      });
      obs.observe(this.editor, { childList: true, subtree: true });

      // Ensure a default active tab + content is visible
      groups.forEach((g) => {
        const isAsk = g.classList.contains('ask-group');
        const tabsSel = isAsk ? '.ask-tabs' : '.comment-tabs';
        const contentSel = isAsk ? '.ask-content' : '.comment-content';
        const wrapSel = isAsk ? '.ask-contents' : '.comment-contents';
        const tabsBar = g.querySelector(tabsSel);
        const contentsWrap = g.querySelector(wrapSel);
        if (!tabsBar || !contentsWrap) return;

        // Normalize any existing legacy-styled buttons
        tabsBar.querySelectorAll('button[data-model]').forEach(b => {
          b.classList.add('model-tab');
          b.removeAttribute('style');
        });
        const buttons = Array.from(tabsBar.querySelectorAll('button[data-model]'));
        const anyActive = buttons.some(b => b.classList.contains('active'));
        if (!anyActive && buttons.length > 0) {
          const first = buttons[0];
          buttons.forEach(b => { b.classList.remove('active'); });
          first.classList.add('active');
          const model = first.getAttribute('data-model');
          contentsWrap.querySelectorAll(contentSel).forEach(c => (c.style.display = 'none'));
          const target = contentsWrap.querySelector(`${contentSel}[data-model="${model}"]`);
          if (target) target.style.display = 'block';
        }
      });
    } catch (err) {
      console.error('ensureGroupControls error', err);
    }
  }

  setupCommentSystem() {
    const tooltip = document.getElementById('commentTooltip');
    let currentCommentElement = null;
    let isEditing = false;

    // Handle clicking on commented text
    this.editor.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('commented-text')) {
        const comment = target.getAttribute('data-comment');
        if (comment) {
          currentCommentElement = target;
          this.showCommentTooltip(target, e);
        }
      } else {
        // Hide tooltip when clicking anywhere else
        const tooltip = document.getElementById('commentTooltip');
        tooltip.style.display = 'none';
        currentCommentElement = null;
      }
    });

    // Handle close button click
    tooltip.querySelector('.close-tooltip')?.addEventListener('click', () => {
      tooltip.style.display = 'none';
      currentCommentElement = null;
    });

    // Handle comment editing
    tooltip.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-comment')) {
        isEditing = true;
        this.editComment(currentCommentElement);
      } else if (e.target.classList.contains('delete-comment')) {
        this.deleteComment(currentCommentElement);
        tooltip.style.display = 'none';
      }
    });
  }

  showCommentTooltip(target, e) {
    console.log(target);
    let targetid = 'comment' + target;
    let targetElem = document.getElementById(targetid);
    targetElem.classList.add('showcomment');
    //remove all other topcomment class
    let allComment = document.querySelectorAll('.topcomment');
    allComment.forEach((comment) => {
      comment.classList.remove('topcomment');
    });
    targetElem.classList.add('topcomment');
    //get mouse postion from e, and set target left ,top to that
    let left = e.clientX;
    let top = e.clientY;
    // targetElem.style.left=left+'px';
    targetElem.style.top = top + 150 + 'px';
  }

  editComment(element) {
    const tooltip = document.getElementById('commentTooltip');
    const currentComment = element.getAttribute('data-comment');

    tooltip.innerHTML = `
      <textarea class="comment-edit-input" rows="3">${currentComment}</textarea>
      <div class="comment-actions">
        <button class="save-comment">Save</button>
        <button class="cancel-comment">Cancel</button>
      </div>
    `;

    const input = tooltip.querySelector('.comment-edit-input');
    input.focus();
    input.select();

    const saveBtn = tooltip.querySelector('.save-comment');
    const cancelBtn = tooltip.querySelector('.cancel-comment');

    const handleSave = () => {
      const newComment = input.value.trim();
      if (newComment) {
        element.setAttribute('data-comment', newComment);
        // Add highlight effect
        element.classList.add('highlight');
        setTimeout(() => {
          element.classList.remove('highlight');
        }, 1000);

        this.delayedSaveNote();
      }
    };

    const handleCancel = () => {
    };

    saveBtn.addEventListener('click', handleSave);
    cancelBtn.addEventListener('click', handleCancel);

    // Handle Enter key to save
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSave();
      }
    });

    // Handle Escape key to cancel
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    });
  }

  deleteComment(element) {
    const confirmDelete = prompt('Type "yes" to confirm deleting this comment:');
    if (confirmDelete && confirmDelete.toLowerCase() === 'yes') {
      const text = element.textContent;
      const textNode = document.createTextNode(text);
      element.parentNode.replaceChild(textNode, element);
      this.delayedSaveNote();
    }
  }

  addComment() {
    const selection = window.getSelection();
    if (!selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const comment = prompt('Enter your comment:');

      if (comment) {
        const span = document.createElement('span');
        span.className = 'commented-text';
        span.setAttribute('data-comment', comment);

        range.surroundContents(span);
        // Add highlight effect
        span.classList.add('highlight');
        setTimeout(() => {
          span.classList.remove('highlight');
        }, 1000);

        this.delayedSaveNote();
      }
    } else {
      alert('Please select some text to comment on');
    }
  }

  // Get text from current block and all context above it
  getBlockContext() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;

    // Find the current block, prioritizing the block containing the cursor
    let currentBlock = this.currentBlock;

    // If no block found, try to find the last block
    if (!currentBlock) {
      const blocks = this.editor.querySelectorAll('.block');
      currentBlock = blocks[blocks.length - 1];
    }

    if (!currentBlock) return null;

    // Get all blocks before the current block
    const allBlocks = Array.from(this.editor.querySelectorAll('.block'));
    const currentBlockIndex = allBlocks.indexOf(currentBlock);

    // Collect context from previous blocks
    const contextBlocks = allBlocks.slice(0, currentBlockIndex);
    // const contextText = contextBlocks
    //   .map(block => block.textContent.trim())
    //   .filter(text => text)
    //   .join('\n\n');

    function extractTextWithLineBreaks(range) {
      let fragment = range.cloneContents();
      let textParts = [];

      function traverseNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          textParts.push(node.nodeValue);
        } else {
          if (node.tagName === "DIV" || node.tagName === "P" || node.tagName === "BR") {
            textParts.push("\n"); // Ensure line breaks are added for block elements
          }
          else {
            textParts.push(" ");
          }
          for (let child of node.childNodes) {
            traverseNodes(child);
          }
        }
      }

      traverseNodes(fragment);
      return textParts.join("");
    }
    let contextText = '';
    // Get the range at the current selection

    // Create a new range from start of div to cursor position
    const preCursorRange = document.createRange();
    preCursorRange.setStart(this.editor, 0);
    preCursorRange.setEnd(this.currentBlock, 0);

    // Get all text before cursor
    contextText = extractTextWithLineBreaks(preCursorRange);
    console.log(contextText);


    // Get the current block's text
    const currentText = currentBlock.textContent.trim();

    console.log('Current text:', currentText, '\n Context:', contextText);
    return {
      currentText: currentText,
      contextText: contextText
    };
  }




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
  }

  executeCommand(command, value = null) {
    // Snapshot before formatting command
    this.recordSnapshot('execCommand:' + command);
    document.execCommand(command, false, value);
    // Snapshot after if content changed (coalescing handled by recordSnapshot)
    this.recordSnapshot('execCommand:after:' + command);
    this.editor.focus();
    // Hide menus if any open
    this.hideAllDropdowns();
  }

  formatBlock(tag) {
    this.recordSnapshot('formatBlock:' + tag);
    document.execCommand("formatBlock", false, `<${tag}>`);
    this.recordSnapshot('formatBlock:after:' + tag);
    // Hide menus if any open
    this.hideAllDropdowns();
  }

  addNewBlock() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // if (selectedText) {
    //   // Create a new block element
    //   const block = document.createElement("div");
    //   block.className = "block";
    //   block.innerHTML = selectedText;
    //   block.classList.add('highlight');
    //   setTimeout(() => {
    //     block.classList.remove('highlight');
    //   }, 1500);

    //   // Get the range of the selected text
    //   const range = selection.getRangeAt(0);

    //   // Replace the selected text with the new block
    //   range.deleteContents();
    //   range.insertNode(block);

    //   // Clear the selection
    //   selection.removeAllRanges();

    //   // Focus the new block
    //   const textNode = block;
    //   if (textNode) {
    //     textNode.focus();
    //     const newRange = document.createRange();
    //     newRange.selectNodeContents(textNode);
    //     newRange.collapse(true);
    //     selection.addRange(newRange);
    //   }

    //   return block;
    // }

    // Create new block for non-selected text case
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = '<br><br><br><br>';


    // Add highlight effect
    block.classList.add('highlight');
    setTimeout(() => {
      block.classList.remove('highlight');
    }, 1000);

    // Get current selection and find closest block
    const range = selection.getRangeAt(0);
    let currentBlock = this.currentBlock;

    // Insert the block after the cursor position
    const blankLine = document.createElement('br');
    const blankLine2 = document.createElement('br');

    if (currentBlock) {
      // Insert after current block
      currentBlock.after(blankLine);
      blankLine.after(block);
      block.after(document.createElement('br'));
    } else {
      // Insert at cursor position
      if (this.editor.contains(range.commonAncestorContainer)) {
        range.collapse(false); // Collapse to end
        range.insertNode(blankLine);
        blankLine.after(block);
        block.after(document.createElement('br'));
        this.currentBlock = block;

      }


    }

    // Focus the new block and move cursor inside
    block.focus();
    const newRange = document.createRange();
    newRange.selectNodeContents(block);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
    return block;
  }




  showBlockMenu(e) {
    e.preventDefault();
    // Implement block menu for different block types
    // This would show a popup menu with options like:
    // - Text
    // - Heading
    // - List
    // - Todo
    // - Quote
    // etc.
  }

  createLink() {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  }

  insertMedia(type) {
    const url = prompt(`Enter ${type} URL:`);
    if (!url) return;

    const block = document.createElement("div");
    block.className = `block media-block ${type}-block`;

    let mediaElement;
    switch (type) {
      case "image":
        mediaElement = document.createElement("img");
        mediaElement.src = url;
        mediaElement.alt = "Inserted image";
        break;
      case "audio":
        mediaElement = document.createElement("audio");
        mediaElement.src = url;
        mediaElement.controls = true;
        break;
      case "video":
        mediaElement = document.createElement("video");
        mediaElement.src = url;
        mediaElement.controls = true;
        break;
    }

    block.appendChild(mediaElement);

    // Insert at cursor position
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(block);


  }

  insertIframe() {


    const url = prompt("Enter webpage URL:");
    if (!url) return;


    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; magnetometer; microphone; midi; payment; speaker; usb; vr");

    const range = window.getSelection().getRangeAt(0);
    //insert after range instead replace range


    range.insertNode(document.createElement('br'));
    range.collapse(false);
    range.insertNode(iframe);
  }

  async register(userId, password, email) {
    const passwordHash = CryptoJS.SHA256(password).toString();
    const result = await this.apiRequest("POST", "/users", {
      user_id: userId,
      password_hash: passwordHash,
      email,
    });

    if (result.success) {
      currentUser = { userId, passwordHash };
      localStorage.setItem("userId", userId);
      localStorage.setItem("passwordHash", passwordHash);
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  }

  async login(userId, password) {
    const passwordHash = btoa(password);
    const result = await this.apiRequest("GET", "/notes"); // Test auth with notes endpoint

    if (!result.error) {
      currentUser = { userId, passwordHash };
      localStorage.setItem("userId", userId);
      localStorage.setItem("passwordHash", passwordHash);
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  }

  logout() {
    currentUser = { userId: null, credentials: null };
    localStorage.removeItem("userId");
    localStorage.removeItem("credentials");
    this.updateAuthUI();
    this.clearNotes();
  }

  updateAuthUI() {
    const isLoggedIn = currentUser.userId && currentUser.credentials;
    if (!isLoggedIn) {
      //ask user to confirm login yes to login, no do nothin
      let confirmLogin = confirm('Do you want to login?');
      if (confirmLogin) {

        window.location.href = "auth.html";

      }
    }
  }

  async checkAuthAndLoadNotes() {
    const defaultNoteId = currentUser.userId ? `default_note_${currentUser.userId}` : null;

    if (!this.currentNoteId && defaultNoteId) {
      this.loadNote(defaultNoteId, { skipRemote: true });
    }

    if (currentUser.userId && currentUser.credentials) {
      const notes = await this.apiRequest("GET", `/folders/1733485657799jj0.5911120915160637/notes`);
      if (!notes.error) {
        const defaultNote = notes.find((note) => note.title === "default_note");

        if (!defaultNote) {
          const defaultNoteContent = `Welcome to your default note! 
go to <a href="https://github.com/suisuyy/notai/tree/can?tab=readme-ov-file#introduction"> Help </a>  to see how to use the Notetaking app powered by LLM

`;
          const createPayload = {
            note_id: defaultNoteId,
            title: "default_note",
            content: defaultNoteContent,
            folder_id: "1733485657799jj0.5911120915160637",
          };
          const result = await this.apiRequest("POST", "/notes", createPayload);

          if (result.success && defaultNoteId) {
            const now = new Date().toISOString();
            await this.updateNoteCache(defaultNoteId, {
              note_id: defaultNoteId,
              title: "default_note",
              content: defaultNoteContent,
              last_updated: now,
            });

            if (!this.currentNoteId || this.currentNoteId === defaultNoteId) {
              await this.loadNote(defaultNoteId, { skipRemote: true });
            }

            await this.loadNotes();
          }
        } else {
          if (defaultNoteId && (!this.currentNoteId || this.currentNoteId === defaultNoteId)) {
            await this.loadNote(defaultNoteId, { skipRemote: true });
          }
          await this.loadNotes();
        }
      }
    } else {
      this.logout();
    }
  }

  showNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    const input = document.getElementById("newFolderInput");
    inputContainer.style.display = "flex";
    input.value = "";
    input.focus();
  }

  hideNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    inputContainer.style.display = "none";
  }

  async createFolder() {
    const input = document.getElementById("newFolderInput");
    let folderName = input.value.trim();

    if (!folderName) {
      alert("Please enter a folder name");
      return;
    }

    // Replace spaces with underscores
    folderName = folderName.replace(/\s+/g, '_');

    const result = await this.apiRequest("POST", "/folders", {
      folder_id: Date.now() + folderName + Math.random(),
      name: folderName,
    });

    if (result.success) {
      this.hideNewFolderInput();
      await this.loadFolders();
    } else {
      alert("Failed to create folder: " + (result.error || "Unknown error"));
    }
  }

  async loadFolders(parentFolderId = null) {
    const endpoint = parentFolderId
      ? `/folders/${parentFolderId}/contents`
      : "/folders";
    const folders = await this.apiRequest("GET", endpoint);
    if (Array.isArray(folders)) {
      const foldersList = document.getElementById("folders");
      foldersList.innerHTML = "";

      // Create a map of parent-child relationships
      const folderMap = new Map();
      const rootFolders = [];

      folders.forEach((folder) => {
        folder.children = [];
        folderMap.set(folder.folder_id, folder);
        if (folder.parent_folder_id) {
          const parent = folderMap.get(folder.parent_folder_id);
          if (parent) {
            parent.children.push(folder);
          }
        } else {
          rootFolders.push(folder);
        }
      });

      // Recursive function to render folder hierarchy
      const renderFolder = (folder, level = 0) => {
        const folderElement = document.createElement("div");
        folderElement.className = "folder-item";
        folderElement.setAttribute("data-folder-id", folder.folder_id);
        folderElement.style.paddingLeft = `${level * 20}px`;
        folderElement.innerHTML = `
                    <div class="folder-content">
                        <i class="fas fa-folder"></i>
                        <span>${folder.folder_name}</span>
                        <div class="folder-count">${' '
          }</div>
                    </div>
                    <button class="add-note-btn" title="Add note to folder">
                        <i class="fas fa-plus"></i>
                    </button>
                `;

        // Add click handler for the folder itself
        folderElement.querySelector(".folder-content").onclick = async (e) => {
          e.stopPropagation();
          // Load and display folder contents
          await this.loadFolderContents(folder.folder_id, folderElement);
        };

        // Add click handler for the add note button
        const addNoteBtn = folderElement.querySelector(".add-note-btn");
        addNoteBtn.onclick = (e) => {
          e.stopPropagation();
          this.createNewNote(folder.folder_id);
        };

        foldersList.appendChild(folderElement);

        // Recursively render children
        folder.children.forEach((child) => {
          renderFolder(child, level + 1);
        });
      };

      // Render root folders
      rootFolders.forEach((folder) => {
        renderFolder(folder);
      });
    }
  }

  async loadNotes(folderId = "1733485657799jj0.5911120915160637") {
    try {
      // First try to get from cache
      const cache = await caches.open('folders-cache');
      const cachedResponse = await cache.match(`folder-${folderId}`);
      let cachedNotes = null;

      if (cachedResponse) {
        cachedNotes = await cachedResponse.json();
        // Update UI with cached data first
        this.updateNotesList(cachedNotes, folderId);
        console.log('Loaded notes from cache');
      }

      // Then fetch from remote
      const notes = await this.apiRequest("GET", `/folders/${folderId}/notes`);

      if (Array.isArray(notes)) {
        // Check if remote data is different from cache
        if (!cachedNotes || JSON.stringify(notes) !== JSON.stringify(cachedNotes)) {
          // Update UI with remote data
          this.updateNotesList(notes, folderId);

          // Update cache
          await cache.put(
            `folder-${folderId}`,
            new Response(JSON.stringify(notes))
          );
          console.log('Updated notes from remote and cached');
        }
      } else if (!cachedNotes) {
        // If remote fails and no cache, show error
        console.error("Failed to load notes");
        this.showToast('Failed to load notes');
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      this.showToast('Error loading notes');
    }
  }

  // Helper method to update the notes list UI
  updateNotesList(notes, folderId) {
    const pagesList = document.getElementById("pagesList");
    pagesList.innerHTML = "";

    notes.forEach((note) => {
      if (note.folder_id === folderId) {
        const noteElement = document.createElement("div");
        noteElement.className = "page-item";
        noteElement.textContent = note.title || "Untitled";
        noteElement.onclick = () => this.loadNote(note.note_id);
        pagesList.appendChild(noteElement);
      }
    });
  }

  getDefaultNoteId() {
    return currentUser.userId ? `default_note_${currentUser.userId}` : null;
  }

  isDefaultNoteId(noteId) {
    const defaultNoteId = this.getDefaultNoteId();
    return Boolean(defaultNoteId && noteId === defaultNoteId);
  }

  async ensureDefaultFolderExists() {
    try {
      const folders = await this.apiRequest("GET", "/folders", null, false, true);
      if (Array.isArray(folders)) {
        const existing = folders.find((folder) => {
          const name = (folder.folder_name || folder.name || "").toLowerCase();
          return name === "default";
        });
        if (existing) {
          return existing.folder_id;
        }
      }

      const folderId = `default_${currentUser.userId || "user"}_${Date.now()}`;
      const result = await this.apiRequest("POST", "/folders", {
        folder_id: folderId,
        name: "default",
      }, false, true);

      if (result && result.success) {
        await this.loadFolders();
        return folderId;
      }
      throw new Error("Failed to create default folder");
    } catch (error) {
      console.error("ensureDefaultFolderExists error:", error);
      throw error;
    }
  }

  resetOversizedDefaultNoteState(overrides = {}) {
    if (this._oversizedDefaultNoteState?.timer) {
      clearTimeout(this._oversizedDefaultNoteState.timer);
    }
    this._oversizedDefaultNoteState = {
      noteId: null,
      status: 'idle',
      timer: null,
      noteData: null,
      ...overrides,
    };
  }

  cloneNoteForOversizedHandling(note) {
    if (!note) return null;
    return {
      note_id: note.note_id,
      title: note.title,
      content: note.content,
      folder_id: note.folder_id,
      last_updated: note.last_updated,
    };
  }

  maybeScheduleOversizedDefaultNotePrompt(note) {
    if (!note || !this.isDefaultNoteId(note.note_id)) {
      if (!this.isDefaultNoteId(this._oversizedDefaultNoteState?.noteId)) {
        this.resetOversizedDefaultNoteState();
      }
      return;
    }

    const contentLength = (note.content || "").length;
    if (contentLength <= 10000) {
      return;
    }

    if (!this._oversizedDefaultNoteState || this._oversizedDefaultNoteState.noteId !== note.note_id) {
      this.resetOversizedDefaultNoteState({
        noteId: note.note_id,
        status: 'idle',
      });
    }

    this._oversizedDefaultNoteState.noteData = this.cloneNoteForOversizedHandling(note);

    if (this._oversizedDefaultNoteState.status !== 'idle') {
      return;
    }

    this._oversizedDefaultNoteState.status = 'scheduled';
    this._oversizedDefaultNoteState.timer = setTimeout(() => {
      this.promptOversizedDefaultNoteMove();
    }, 100);
  }

  async promptOversizedDefaultNoteMove() {
    if (!this._oversizedDefaultNoteState || this._oversizedDefaultNoteState.status !== 'scheduled') {
      return;
    }

    this._oversizedDefaultNoteState.timer = null;
    this._oversizedDefaultNoteState.status = 'prompting';

    const noteData = this.cloneNoteForOversizedHandling(this._oversizedDefaultNoteState.noteData);
    if (!noteData) {
      this.resetOversizedDefaultNoteState();
      return;
    }

    const shouldMove = confirm(
      "The default note is larger than 10,000 characters and may load slowly. Move its content to a new note inside the \"default\" folder?"
    );

    if (!shouldMove) {
      this.resetOversizedDefaultNoteState({
        noteId: noteData.note_id,
        status: 'done',
      });
      return;
    }

    try {
      await this.moveOversizedDefaultNoteContent(noteData);
      this.resetOversizedDefaultNoteState({
        noteId: noteData.note_id,
        status: 'done',
      });
    } catch (error) {
      console.error("Error handling oversized default note:", error);
      if (!error?._notaiNotified) {
        this.showToast("Failed to relocate default note content.", "error");
      }
      this.resetOversizedDefaultNoteState({
        noteId: noteData.note_id,
        status: 'idle',
        noteData,
      });
    }
  }

  async moveOversizedDefaultNoteContent(noteData) {
    const folderId = await this.ensureDefaultFolderExists();
    const timestamp = utils.getCurrentTimeString().replace(/\D/g, "");
    const newTitle = `default_${timestamp}`;
    const newNoteId = `${newTitle}_${currentUser.userId || "user"}`;

    const createPayload = {
      note_id: newNoteId,
      title: newTitle,
      content: noteData.content,
      folder_id: folderId,
    };

    const createResult = await this.apiRequest("POST", "/notes", createPayload, false, true);
    if (!createResult || !createResult.success) {
      this.showToast("Failed to move default note content. Please try again later.");
      const error = new Error("Failed to create new note for oversized default note.");
      error._notaiNotified = true;
      throw error;
    }

    const clearedContent = "<br><br>";
    let clearedNote = null;

    if (this.currentNoteId === noteData.note_id) {
      const titleElement = document.getElementById("noteTitle");
      if (titleElement) {
        titleElement.textContent = noteData.title || "default_note";
      }
      this.editor.innerHTML = clearedContent;
      this.resetHistoryWithCurrentContent();

      try {
        await this.saveNote(true);
        clearedNote = await this.apiRequest("GET", `/notes/${noteData.note_id}`, null, false, true);
      } catch (error) {
        this.showToast("Default note content moved, but clearing it failed. Please try saving manually.", "error");
        const err = error instanceof Error ? error : new Error("Failed to save cleared default note.");
        err._notaiNotified = true;
        throw err;
      }
    } else {
      const clearPayload = {
        note_id: noteData.note_id,
        title: noteData.title || "default_note",
        content: clearedContent,
        folder_id: noteData.folder_id || "1733485657799jj0.5911120915160637",
      };

      const clearResult = await this.apiRequest("POST", "/notes", clearPayload, false, true);
      if (!clearResult || !clearResult.success) {
        this.showToast("New note created but clearing the default note failed. Please clear it manually.", "error");
        const error = new Error("Failed to clear default note after moving content.");
        error._notaiNotified = true;
        throw error;
      }
      clearedNote = await this.apiRequest("GET", `/notes/${noteData.note_id}`, null, false, true);
    }

    if (!clearedNote || clearedNote.error) {
      clearedNote = {
        ...noteData,
        content: clearedContent,
        last_updated: new Date().toISOString(),
      };
    }

    if ((clearedNote.content || "") !== clearedContent) {
      this.showToast("Default note could not be cleared. Please clear it manually.", "error");
      const error = new Error("Cleared default note still contains original content.");
      error._notaiNotified = true;
      throw error;
    }

    let movedNote = await this.apiRequest("GET", `/notes/${newNoteId}`, null, false, true);
    if (!movedNote || movedNote.error) {
      movedNote = { ...createPayload, last_updated: new Date().toISOString() };
    }

    await this.updateNoteCache(newNoteId, movedNote);
    await this.updateNoteCache(noteData.note_id, clearedNote);

    if (this.currentNoteId === noteData.note_id) {
      this.updateNoteUI(clearedNote);
    }

    await this.loadFolders();
    await this.loadNotes(noteData.folder_id || "1733485657799jj0.5911120915160637");

    this.showToast(`Moved default note content to "${newTitle}" in folder "default".`, "success");
  }

  async loadNote(note_id, options = {}) {
    const { skipRemote = false } = options;
    console.log('Loading note:', note_id);

    const isSwitchingNote = this.currentNoteId && this.currentNoteId !== note_id;
    if (this.isDefaultNoteId(note_id)) {
      this.resetOversizedDefaultNoteState({
        noteId: note_id,
        status: 'idle',
      });
    } else {
      this.resetOversizedDefaultNoteState();
    }

    if (isSwitchingNote) {
      this.saveNote();
      this.initializeHistory();
    } else if (!this.currentNoteId) {
      this.initializeHistory();
    }

    this.currentNoteId = note_id;

    try {
      // First try to get from cache
      const cachedNote = await this.getNoteFromCache(note_id);
      if (cachedNote) {
        // Update UI with cached data
        this.updateNoteUI(cachedNote);
        this.maybeScheduleOversizedDefaultNotePrompt(cachedNote);
        console.log('Loaded note from cache');
      }

      if (skipRemote) {
        this.deferredRemoteNoteId = note_id;
        return;
      }

      this.deferredRemoteNoteId = null;

      // Then fetch from remote
      const note = await this.apiRequest("GET", `/notes/${note_id}`);
      if (note && !note.error) {
        // Check if remote content is different from cache
        if (!cachedNote ||
          note.content !== cachedNote.content ||
          note.last_updated !== cachedNote.last_updated) {



          // Update cache
          await this.updateNoteCache(note_id, note);
          console.log('Updated note from remote and cached');

          //check if currentnote id changed
          if (this.currentNoteId !== note.note_id) {
            console.log('currentNoteId changed, skipping update');
            return;
          }
          // Update UI with remote data
          this.updateNoteUI(note);
          this.maybeScheduleOversizedDefaultNotePrompt(note);


        }
      } else {
        console.error("Failed to load note:", note.error);
        // If remote fails but we have cache, keep using cache
        if (!cachedNote) {
          this.showToast('Failed to load note');
        }
        this.deferredRemoteNoteId = note_id;
      }
    } catch (error) {
      console.error('Error loading note:', error);
      this.showToast('Error loading note');
      this.deferredRemoteNoteId = note_id;
    }
  }

  // Helper method to update UI with note data
  updateNoteUI(note) {
    this.editor.innerHTML = note.content || "";
    document.getElementById("noteTitle").textContent = note.title || "";
    this.currentNoteId = note.note_id;
    this.currentNoteTitle = note.title;
    this.lastUpdated = note.last_updated;
    // Ensure AI blocks have controls even when loading from storage
    this.ensureGroupControls();
    // Re-attach after a tick to cover late-rendered content
    setTimeout(() => this.ensureGroupControls(), 0);
    // Reset history baseline for this note
    this.resetHistoryWithCurrentContent();
    //log last updated time
    console.log('updateNoteUI() Note this.lastupdated at:', this.lastUpdated);

    // Add to recent notes
    this.addToRecentNotes(note.note_id, note.title);

    // Update table of contents
    this.updateTableOfContents();

    // Set lazy loading for media elements
    const mediaElements = this.editor.querySelectorAll('img, iframe, video, audio');
    mediaElements.forEach(element => {
      element.setAttribute('loading', 'lazy');
      if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
        element.setAttribute('preload', 'none');
      }
    });
  }

  // Helper method to get note from cache
  async getNoteFromCache(note_id) {
    try {
      const cache = await caches.open('notes-cache');
      const response = await cache.match(`note-${note_id}`);
      if (response) {
        const data = await response.json();
        // After reading from cache, ensure controls are attached if content will be used
        setTimeout(() => this.ensureGroupControls(), 0);
        return data;
      }
      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  // Helper method to update note in cache
  async updateNoteCache(note_id, note) {
    try {
      const cache = await caches.open('notes-cache');
      const response = new Response(JSON.stringify(note));
      await cache.put(`note-${note_id}`, response);
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  }

  addToRecentNotes(noteId, noteTitle) {
    // Get existing recent notes from localStorage
    let recentNotes = JSON.parse(localStorage.getItem('recentNotes') || '[]');

    // Remove the note if it already exists
    recentNotes = recentNotes.filter(note => note.id !== noteId);

    // Add the new note to the beginning
    recentNotes.unshift({
      id: noteId,
      title: noteTitle,
      timestamp: new Date().toISOString()
    });

    // Keep only the last 30 notes
    recentNotes = recentNotes.slice(0, 30);

    // Save back to localStorage
    localStorage.setItem('recentNotes', JSON.stringify(recentNotes));

    // Update the UI
    this.updateRecentNotesUI();
  }

  updateRecentNotesUI() {
    // Get recent notes from localStorage
    const recentNotes = JSON.parse(localStorage.getItem('recentNotes') || '[]');
    const recentContainer = document.getElementById('recentNotes');

    if (!recentContainer) return;

    // Clear existing recent notes UI
    recentContainer.innerHTML = '';

    // Filter out current note from display
    const filteredNotes = recentNotes.filter(note => note.id !== this.currentNoteId);

    // Split into primary (up to 3) and overflow
    const primaryNotes = filteredNotes.slice(0, 2);
    const overflowNotes = filteredNotes.slice(0, 30);

    // Container for left-side visible tabs
    const tabsWrap = document.createElement('div');
    tabsWrap.className = 'recent-tabs-wrap';
    recentContainer.appendChild(tabsWrap);

    const makeNoteEl = (note) => {
      const noteEl = document.createElement('span');
      noteEl.className = 'recent-note';
      noteEl.setAttribute('data-note-id', note.id);
      noteEl.textContent = note.title;
      noteEl.title = new Date(note.timestamp).toLocaleString();
      noteEl.addEventListener('click', () => {
        // Store current note before switching
        if (this.currentNoteId && this.currentNoteTitle) {
          this.addToRecentNotes(this.currentNoteId, this.currentNoteTitle);
        }
        this.loadNote(note.id);
      });
      return noteEl;
    };

    primaryNotes.forEach(n => tabsWrap.appendChild(makeNoteEl(n)));

    // Build overflow dropdown if needed
    if (overflowNotes.length > 0) {
      const dd = document.createElement('div');
      dd.className = 'recent-dropdown';

      const btn = document.createElement('button');
      btn.className = 'recent-dropdown-btn';
      btn.type = 'button';
      btn.textContent = `(${overflowNotes.length}) ▾`;

      const menu = document.createElement('div');
      menu.className = 'recent-dropdown-menu';

      overflowNotes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'recent-dropdown-item';
        item.textContent = n.title;
        item.title = new Date(n.timestamp).toLocaleString();
        item.addEventListener('click', () => {
          if (this.currentNoteId && this.currentNoteTitle) {
            this.addToRecentNotes(this.currentNoteId, this.currentNoteTitle);
          }
          this.loadNote(n.id);
          menu.style.display = 'none';
        });
        menu.appendChild(item);
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
      });

      // Global outside-click closer (install once)
      if (!this._boundCloseRecentDropdown) {
        this._boundCloseRecentDropdown = (e) => {
          document.querySelectorAll('.recent-dropdown-menu').forEach(m => {
            const host = m.parentElement;
            if (host && !host.contains(e.target)) {
              m.style.display = 'none';
            }
          });
        };
        document.addEventListener('click', this._boundCloseRecentDropdown, true);
      }

      dd.appendChild(btn);
      dd.appendChild(menu);
      recentContainer.append(dd);
    }
  }

  async createNewNote(folderId = null) {
    let title = prompt("Enter note title:");
    if (!title) return;

    // Replace spaces with underscores
    title = title.replace(/\s+/g, '_');

    const noteId = title + "_" + currentUser.userId + "_" + Date.now();
    const result = await this.apiRequest("POST", "/notes", {
      note_id: noteId,
      title: title,
      content: "Start writing here...",
      folder_id: folderId || "1733485657799jj0.5911120915160637", // Use default folder if none provided
    });

    if (result.success) {
      if (folderId) {
        // If created in a folder, refresh just that folder's contents
        const folderElement = document.querySelector(
          `.folder-item[data-folder-id="${folderId}"]`
        );
        if (folderElement) {
          await this.loadFolderContents(folderId, folderElement);
        }
      } else {
        // If not in a folder, refresh the main notes list
        await this.loadNotes();
      }
      // Find and load the newly created note
      const notes = await this.apiRequest(
        "GET",
        folderId ? `/folders/${folderId}/notes` : "/notes"
      );
      const newNote = notes.find((note) => note.title === title);
      if (newNote) {
        await this.loadNote(newNote.note_id);
      }
    } else {
      alert("Failed to create note: " + (result.error || "Unknown error"));
    }
  }

  //sync if in idle, not interactive for 30s
  idleSync() {

    let idleTime = Date.now() - this.lastInteractionTime || 0;
    console.log('idelTime ', idleTime, this.lastInteractionTime);

    if (idleTime > 30000) {
      this.saveNote();
    }
    // Update last interaction time
    this.lastInteractionTime = Date.now();

  }

  //save delay for 10s, if called again, reset the timer
  delayedSaveNote() {
    console.log('delayedSaveNote() start ');

    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      console.log('delayedSaveNote saveNote() start ');

      this.saveNote();
    }, 10000);
  }



  async saveNote(isAutoSave = false) {
    if (!this.currentNoteId) {
      return;
    }

    // Get current title from the title element
    const currentTitle = document.getElementById("noteTitle").textContent.trim() || "Untitled";
    this.currentNoteTitle = currentTitle;
    let targetNoteId = this.currentNoteId;
    let targetNotecontent = this.editor.innerHTML;
    let targetlastUpdated = this.lastUpdated;

    const saveBtn = document.getElementById("saveNoteBtn");
    const saveIcon = saveBtn.querySelector(".fa-save");
    const spinnerIcon = saveBtn.querySelector(".fa-spinner");
    const spanText = saveBtn.querySelector("span");


    try {
      // Show spinner, hide save icon
      saveIcon.style.display = "none";
      spinnerIcon.style.display = "inline-block";
      spanText.textContent = " ";

      // Fetch current note from server to check last_updated
      const currentNote = await this.apiRequest("GET", `/notes/${this.currentNoteId}`, null, false, true);
      //compare content, if same return
      if (currentNote && currentNote.content === this.editor.innerHTML) {
        // Show saved state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "";

        return;
      }
      // Server has newer version - load it
      //need convert last_updated to number to compare, the last_updated is string like 2025-01-01 02:25:51
      if (currentNote && new Date(currentNote.last_updated).getTime() > new Date(targetlastUpdated).getTime()) {
        //if user change to anothe note , do nothing
        if (this.currentNoteId !== currentNote.note_id) {
          return;
        }
        this.editor.innerHTML = currentNote.content;
        document.getElementById("noteTitle").textContent = currentNote.title;
        this.lastUpdated = currentNote.last_updated;
        //log why update this.lastupdated
        console.log('saveNote() note from the server is newer currentNote.last_updated:', currentNote.last_updated);
        this.currentNoteTitle = currentNote.title;

        // Show saved state
        spinnerIcon.style.display = "none";
        saveNoteBtn.querySelector('.fa-save').style.display = "none";
        spanText.textContent = "⌄";

        return;
      }




      const result = await this.apiRequest("POST", `/notes`, {
        note_id: targetNoteId,
        content: targetNotecontent,
        title: currentTitle,
      }, false, true);

      if (result.success) {
        // Update last_updated timestamp after successful save
        const updatedNote = await this.apiRequest("GET", `/notes/${this.currentNoteId}`, null, false, true);
        if (updatedNote) {
          this.lastUpdated = updatedNote.last_updated;
        }

        // Show saved state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "^";
        saveNoteBtn.querySelector('.fa-save').style.display = "none";


      } else {
        // Show error state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "Error saving";
        setTimeout(() => {
          spanText.textContent = "";
        }, 2000);
      }
    } catch (error) {
      console.error("Save error:", error);
      // Show error state
      spinnerIcon.style.display = "none";
      saveIcon.style.display = "inline-block";
      spanText.textContent = "Error saving";
      setTimeout(() => {
        spanText.textContent = "";
      }, 2000);
    }
  }

  clearNotes() {
    document.getElementById("pagesList").innerHTML = "";
    this.editor.innerHTML = "Start writing here...>";
  }

  cleanNote() {
    //check all img and audio, video tags, if src is base64, upload to server and replace src with url
    let mediaElements = this.editor.querySelectorAll('img, audio, video');
    mediaElements.forEach(async element => {
      let src = element.src;
      if (src.startsWith('data:')) {
        let type = src.split(';')[0].split(':')[1];
        let data = src.split(',')[1];
        let blob = utils.base64ToBlob(src);
        let file = new File([blob], `media.${type.split('/')[1]}`, { type });
        let url = await this.uploadFile(file, false, false);
        if (url) {
          element.src = url;

        }
      }
      //if src start with blob, upload to server and replace src with url
      if (src.startsWith('blob:')) {
        this.showToast('cleaning media,blob url');

        try {
          let type = 'image/jpeg';
          //set type from src file extension
          if (src.endsWith('.png')) {
            type = 'image/png';
          }
          if (src.endsWith('.jpg')) {
            type = 'image/jpeg';
          }
          if (src.endsWith('.jpeg')) {
            type = 'image/jpeg';
          }
          if (src.endsWith('.gif')) {
            type = 'image/gif';
          }
          if (src.endsWith('.webp')) {

            type = 'image/webp';
          }
          if (src.endsWith('.mp4')) {
            type = 'video/mp4';
          }
          if (src.endsWith('.webm')) {
            type = 'video/webm';
          }
          if (src.endsWith('.ogg')) {
            type = 'video/ogg';
          }
          if (src.endsWith('.mp3')) {
            type = 'audio/mp3';
          }
          if (src.endsWith('.wav')) {
            type = 'audio/wav';
          }

          function blobUrlToBlob(blobUrl) {
            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', blobUrl, true);
              xhr.responseType = 'blob';

              xhr.onload = function () {
                if (this.status === 200) {
                  resolve(this.response);
                } else {
                  reject(new Error(`Failed to convert blob URL to blob: ${this.status}`));
                }
              };

              xhr.onerror = function () {
                reject(new Error('XHR error while converting blob URL to blob'));
              };

              xhr.send();
            });
          }
          let blob = await blobUrlToBlob(src);
          let file = new File([blob], `media.${type.split('/')[1]}`, { type });
          let url = await this.uploadFile(file, false, false);
          if (url) {
            element.src = url;
            // element.after(document.createTextNode(url));
          }

        } catch (error) {
          console.error('error cleaning blob url', error);
          this.showToast('error cleaning blob url' + error.toString());

        }

      }
    });
  }

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const editor = document.querySelector(".editor");

    if (sidebar && mainContent) {
      sidebar.classList.toggle("hidden");
    }
  }

  async loadFolderContents(folderId, folderElement) {
    // Check if content already exists in DOM
    let contentContainer = folderElement.nextElementSibling;
    if (contentContainer && contentContainer.classList.contains("folder-contents")) {
      contentContainer.remove();
      folderElement.classList.remove("open");
      return;
    }

    folderElement.classList.add("open");

    // Create container for folder contents
    contentContainer = document.createElement("div");
    contentContainer.className = "folder-contents";

    try {
      // First try to get from cache
      const cache = await caches.open('folders-cache');
      const cachedResponse = await cache.match(`folder-${folderId}`);
      let cachedData = null;

      if (cachedResponse) {
        cachedData = await cachedResponse.json();
        // Render cached data first
        this.renderFolderContents(cachedData.notes, cachedData.folders, contentContainer);
        // Insert content container after the folder element
        folderElement.after(contentContainer);
      }

      // Then fetch from remote
      const [notes, folders] = await Promise.all([
        this.apiRequest("GET", `/folders/${folderId}/notes`),
        this.apiRequest("GET", `/folders/${folderId}/contents`)
      ]);

      const remoteData = { notes, folders };

      // Check if remote data is different from cache
      if (!cachedData || JSON.stringify(remoteData) !== JSON.stringify(cachedData)) {
        // Update cache
        await cache.put(
          `folder-${folderId}`,
          new Response(JSON.stringify(remoteData))
        );

        // Update UI with new data
        contentContainer.innerHTML = ''; // Clear existing content
        this.renderFolderContents(notes, folders, contentContainer);

        if (!cachedData) {
          // If there was no cached data, insert container now
          folderElement.after(contentContainer);
        }
      }

    } catch (error) {
      console.error('Error loading folder contents:', error);
      if (!contentContainer.hasChildNodes()) {
        contentContainer.innerHTML = '<div class="error">Error loading contents</div>';
        folderElement.after(contentContainer);
      }
    }
  }

  // Helper method to render folder contents
  renderFolderContents(notes, folders, container) {
    // Render notes
    if (Array.isArray(notes)) {
      notes.forEach((note) => {
        const noteElement = document.createElement("div");
        noteElement.className = "page-item folder-note";
        noteElement.innerHTML = `
          <i class="fas fa-file-alt"></i>
          <span>${note.title || "Untitled"}</span>
        `;
        noteElement.onclick = () => this.loadNote(note.note_id);
        container.appendChild(noteElement);
      });
    }

    // Render folders
    if (Array.isArray(folders)) {
      folders.forEach((folder) => {
        const subFolderElement = document.createElement("div");
        subFolderElement.className = "folder-item sub-folder";
        subFolderElement.innerHTML = `
          <div class="folder-content">
            <i class="fas fa-folder"></i>
            <span>${folder.folder_name}</span>
            <button class="add-note-btn" title="Add note to folder">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        `;

        // Add click handler for the folder
        subFolderElement.querySelector(".folder-content").onclick = (e) => {
          e.stopPropagation();
          this.loadFolderContents(folder.folder_id, subFolderElement);
        };

        // Add click handler for the add note button
        const addNoteBtn = subFolderElement.querySelector(".add-note-btn");
        addNoteBtn.onclick = (e) => {
          e.stopPropagation();
          this.createNewNote(folder.folder_id);
        };

        container.appendChild(subFolderElement);
      });
    }
  }

  setupTableOfContents() {
    const tocBtn = document.getElementById('toggleTocBtn');
    const tocList = document.getElementById('tocList');

    tocBtn.addEventListener('click', () => {
      const isHidden = tocList.style.display === 'none';
      tocList.style.display = isHidden ? 'block' : 'none';
      this.updateTableOfContents();
    });
  }

  updateTableOfContents() {
    const tocList = document.getElementById('tocList');
    if (tocList.style.display === 'none') return;

    // Clear existing TOC
    tocList.innerHTML = '';

    // Get all headings from the editor
    const headings = this.editor.querySelectorAll('h1, h2, h3');

    headings.forEach((heading, index) => {
      const level = heading.tagName.toLowerCase();
      const text = heading.textContent;

      // Create TOC item
      const tocItem = document.createElement('div');
      tocItem.className = `toc-item toc-${level}`;
      tocItem.textContent = text;

      // Add click handler to scroll to heading
      tocItem.addEventListener('click', () => {
        heading.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'start' });
        setTimeout(() => {
          editor.editor.scrollLeft = 0;
        }, 100);
      });

      tocList.appendChild(tocItem);
    });
  }

  // Function to convert selected text to plain text, supporting text outside of blocks
  convertToPlainText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (!selectedText) return;

    // Insert a temporary span with the raw text at the selection
    const tempSpan = document.createElement('span');
    tempSpan.textContent = selectedText; // ensures plain text
    tempSpan.setAttribute('data-plain-temp', '1');

    // Replace selection contents with the temp span
    range.deleteContents();
    range.insertNode(tempSpan);

    // Select the temp span's contents
    const tempRange = document.createRange();
    tempRange.selectNodeContents(tempSpan);
    selection.removeAllRanges();
    selection.addRange(tempRange);

    // Remove inline formatting (bold/italic/links/etc.) within the selected span
    try {
      document.execCommand('removeFormat');
    } catch (_) { }

    // If inside a heading (h1–h4), split the heading so only the selection becomes plain text
    const heading = tempSpan.closest && tempSpan.closest('h1,h2,h3,h4');
    if (heading) {
      const level = heading.tagName.toLowerCase();

      // Build fragments for the parts before and after the selection within the heading
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(heading);
      beforeRange.setEndBefore(tempSpan);
      const hasBefore = beforeRange.toString().length > 0;
      const beforeFrag = hasBefore ? beforeRange.cloneContents() : null;

      const afterRange = document.createRange();
      afterRange.selectNodeContents(heading);
      afterRange.setStartAfter(tempSpan);
      const hasAfter = afterRange.toString().length > 0;
      const afterFrag = hasAfter ? afterRange.cloneContents() : null;

      const parent = heading.parentNode;
      const nextSibling = heading.nextSibling;

      // Remove original heading
      parent.removeChild(heading);

      // Insert before-heading portion (still a heading)
      if (hasBefore) {
        const beforeHeading = document.createElement(level);
        beforeHeading.appendChild(beforeFrag);
        parent.insertBefore(beforeHeading, nextSibling);
      }

      // Insert the selected portion as plain text block
      const plainDiv = document.createElement('div');
      plainDiv.textContent = tempSpan.textContent;
      parent.insertBefore(plainDiv, nextSibling);

      // Insert after-heading portion (still a heading)
      if (hasAfter) {
        const afterHeading = document.createElement(level);
        afterHeading.appendChild(afterFrag);
        parent.insertBefore(afterHeading, nextSibling);
      }

      // Place cursor at end of the inserted plain text block
      const newSel = window.getSelection();
      const caretRange = document.createRange();
      caretRange.selectNodeContents(plainDiv);
      caretRange.collapse(false);
      newSel.removeAllRanges();
      newSel.addRange(caretRange);
      return;
    }

    // Otherwise, not inside a heading: replace the temp span with a pure text node
    const plainTextNode = document.createTextNode(tempSpan.textContent);
    tempSpan.parentNode.replaceChild(plainTextNode, tempSpan);

    // Place caret after the inserted plain text
    const afterRange = document.createRange();
    afterRange.setStartAfter(plainTextNode);
    afterRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(afterRange);
  }

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
  }

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

  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async calculateSHA1(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  // insertIframe() {
  //   const url = prompt("Enter webpage URL:");
  //   if (!url) return;

  //   const block = this.addNewBlock();
  //   block.className = "block iframe-block";

  //   const iframe = document.createElement("iframe");

  //   iframe.setAttribute("frameborder", "0");
  //   iframe.setAttribute("allowfullscreen", "true");
  //   iframe.setAttribute("allow", "accelerometer; ambient-light-sensor; autoplay; battery; camera; clipboard-read; clipboard-write; display-capture; document-domain; encrypted-media; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; otp-credentials; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; sync-xhr; usb; web-share; xr-spatial-tracking");

  //   block.appendChild(iframe);
  //   this.editor.appendChild(block);
  // }

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
  }

  // Add media device handling methods
  stoptrackTimeoutid = 0;
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


  }

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
  }


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
  }

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
  }

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
  }

  // History helpers for undo/redo and selection capture/restore
  initializeHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 100;
    this.lastInputTime = 0;
    this.lastInputType = '';
  }

  resetHistoryWithCurrentContent() {
    this.undoStack = [];
    this.redoStack = [];
    this.recordSnapshot('init');
  }

  getNodePathFromRoot(node, root) {
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.childNodes, current);
      path.unshift(index);
      current = parent;
    }
    return path;
  }

  getNodeByPath(path, root) {
    let current = root;
    for (const index of path) {
      if (!current || !current.childNodes || !current.childNodes[index]) return null;
      current = current.childNodes[index];
    }
    return current || null;
  }

  captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const startPath = this.getNodePathFromRoot(range.startContainer, this.editor);
    const endPath = this.getNodePathFromRoot(range.endContainer, this.editor);
    return {
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset,
    };
  }

  restoreSelection(saved) {
    try {
      if (!saved) return;
      const startNode = this.getNodeByPath(saved.startPath, this.editor);
      const endNode = this.getNodeByPath(saved.endPath, this.editor);
      if (!startNode || !endNode) throw new Error('selection nodes not found');
      const range = document.createRange();
      range.setStart(startNode, Math.min(saved.startOffset ?? 0, startNode.nodeType === Node.TEXT_NODE ? (startNode.nodeValue?.length || 0) : (startNode.childNodes?.length || 0)));
      range.setEnd(endNode, Math.min(saved.endOffset ?? 0, endNode.nodeType === Node.TEXT_NODE ? (endNode.nodeValue?.length || 0) : (endNode.childNodes?.length || 0)));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_) {
      // Fallback: place caret at end
      const selection = window.getSelection();
      const range = document.createRange();
      if (this.editor.lastChild) {
        const endNode = this.editor.lastChild;
        if (endNode.nodeType === Node.TEXT_NODE) {
          range.setStart(endNode, endNode.nodeValue?.length || 0);
        } else {
          range.selectNodeContents(endNode);
          range.collapse(false);
        }
      } else {
        range.selectNodeContents(this.editor);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  recordSnapshot(reason = '') {
    if (!this.editor) return;
    const currentContent = this.editor.innerHTML;
    const last = this.undoStack[this.undoStack.length - 1];
    if (last && last.content === currentContent) return; // avoid duplicates

    const snapshot = {
      content: currentContent,
      selection: this.captureSelection(),
      reason,
      ts: Date.now(),
    };
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // New action invalidates redo stack
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack || this.undoStack.length <= 1) return; // need prior state
    const current = this.undoStack.pop();
    const previous = this.undoStack[this.undoStack.length - 1];
    if (!previous) return;
    // Push current to redo
    this.redoStack.push(current);
    // Restore previous
    this.editor.innerHTML = previous.content;
    this.restoreSelection(previous.selection);
    // Save after undo to cache/save system but avoid creating a new history entry
    this.delayedSaveNote();
  }

  redo() {
    if (!this.redoStack || this.redoStack.length === 0) return;
    const next = this.redoStack.pop();
    // Push current to undo
    const currentSnapshot = { content: this.editor.innerHTML, selection: this.captureSelection(), reason: 'pre-redo', ts: Date.now() };
    this.undoStack.push(currentSnapshot);
    // Apply redo state
    this.editor.innerHTML = next.content;
    this.restoreSelection(next.selection);
    // Save after redo
    this.delayedSaveNote();
  }
}

window.addEventListener('blur', () => {
  editor.stopMediaTracks();
}, { once: true });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    editor.stopMediaTracks();
  }
});

window.addEventListener('load', () => {
  setTimeout(() => {
    caches.open('app-cache').then(cache => {
      cache.addAll([
        './',
        './index.html',
        './styles.css',
        './script.js',
        './icons/notai-192x192.png',
        './icons/notai-512x512.png',

      ]);

      console.log('App cache updated');
      cache.addAll(['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
        'https://corsp.suisuy.eu.org?https://cdn.jsdelivr.net/npm/marked/marked.min.js',])
    })
  }, 5000);
})

// Initialize the editor and load folders
document.addEventListener("DOMContentLoaded", async () => {
  try {
    window.editor = new HTMLEditor();
    window.editor.loadFolders();

    // Profile Modal functionality
    const profileModal = document.getElementById('profileModal');
    const userProfileBtn = document.getElementById('userProfileBtn');
    const closeProfileBtn = profileModal.querySelector('.close, .close-profile-btn');
    const currentUserIdSpan = document.getElementById('currentUserId');

    userProfileBtn.addEventListener('click', () => {
      currentUserIdSpan.textContent = currentUser.userId || 'Unknown';
      profileModal.style.display = 'block';
    });

    closeProfileBtn.addEventListener('click', () => {
      profileModal.style.display = 'none';
    });




  } catch (error) {
    console.error('Error initializing editor:', error);
    // Redirect to auth page if initialization fails
    //window.location.href = 'auth.html';
  }
  // Delegate click event to parent element
  document.body.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.tagName === 'AUDIO') {
      event.preventDefault(); // Prevent default behavior
      document.activeElement.blur(); // Unfocus the contenteditable area
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      let url = target.src;
      //if url more than 200 characters, remove the rest of the url and append last 10 at the end 
      if (url.length > 200) {
        url = url.substring(0, 200) + '...' + url.slice(-10);
      }
      midiaURLContainer.innerText = url;
      midiaURLContainer.classList.remove('hidden');
      //set height and width to auto , maxwidth 100%,maxheight to 100000px
      // target.style.maxWidth = '100%';
      // target.style.maxHeight = '100000px';
      // target.style.width = 'auto';
      // target.classList.add('adapt_img');
      // setTimeout(() => {
      //   target.classList.remove('adapt_img');

      // }, 5000);

      if (target.tagName === 'IMG') {
        //create image tag to diplay the image
        imgDisplay.src = target.src;
        //imgDisplay.classList.remove('hidden');

      }

      else if (target.tagName === 'VIDEO') {

      }
      else if (target.tagName === 'AUDIO') {

      }

    }
    else if (target.id === 'midiaURLContainer') {
      //copy innerhtml to clipboard and show toast copyed
      navigator.clipboard.writeText(midiaURLContainer.innerHTML).then(() => {
        editor.showToast('Copied to clipboard', 'success');
        midiaURLContainer.classList.add('hidden');
      }).catch(err => {
        console.error('Failed to copy: ', err);
        editor.showToast('Failed to copy', 'error');
      });
    }
    else {
      midiaURLContainer.classList.add('hidden');
      imgDisplay.classList.add('hidden');
    }

  });

  // Prevent editing when clicking on non-editable blocks to prevent poping up keyboard on ios
  let setEditableTimeoutID = 0;
  document.body.addEventListener('pointerdown', (event) => {
    const target = event.target;
    let blockElem = target;
    while (blockElem && blockElem !== document.body) {
      if (blockElem.classList && blockElem.classList.contains('block')) {
        if (!blockElem.isContentEditable) {
          editor.editor.setAttribute("contenteditable", "false");
          clearTimeout(setEditableTimeoutID);
          setEditableTimeoutID = setTimeout(() => {
            editor.editor.setAttribute("contenteditable", "true");

          }, 500);
          break;
        }
      }
      blockElem = blockElem.parentElement;
    }
  });


});
// Add event listener for topbar pin button
document.getElementById('topbarPinBtn').addEventListener('pointerdown', (e) => {
  e.preventDefault();


  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const currentBlock = range.startContainer.parentElement.closest('.block');
  if (currentBlock) {
    if (currentBlock.classList.contains('pinned')) {
      currentBlock.classList.remove('pinned')
      setTimeout(() => {
        //scroll to the block
        currentBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
        //flash the block
        currentBlock.classList.add('highlight');
        setTimeout(() => {
          currentBlock.classList.remove('highlight');
        }, 1000);

      }, 200);
      return;
    }
    // Unpin other blocks
    document.querySelectorAll('.pinned').forEach(b => b.classList.remove('pinned'));
    currentBlock.classList.add('pinned');

  }
});

window.addEventListener('pointerup', () => {
  console.log('current selection:', window.getSelection().toString());
  if (window.getSelection().toString().length > 0) {
    window.selectionText = window.getSelection().toString();

  }
});

document.querySelector('#updateAppBtn').addEventListener('click', () => {
  //remove all caches
  caches.delete('app-cache').then(() => {
    console.log('Cache deleted');
    //remove service worker


  });
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister().then((res) => {
        if (res) {
          console.log('Service worker unregistered');
          //confirm reload
          setTimeout(() => {
            if (confirm(' Reload the page to update?')) {
              window.location.reload();
            }
          }, 2000);

        }

      }
      );

    });
  });
  setTimeout(() => {
    window.location.reload();

  }, 3000);


});
