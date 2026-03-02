import utils from '../../utils/index.js';
import globalDevices from '../../state/globalDevices.js';

const ESCAPE_HTML_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

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

  setupBlockControls() {
    if (!this.editor || this._blockControlsInitialized) {
      return;
    }

    this._blockControlsInitialized = true;
    this.blockControlsTarget = null;

    const controls = document.createElement('div');
    controls.id = 'activeBlockControls';
    controls.className = 'block-controls';
    controls.dataset.position = 'top';
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', 'Block shortcuts');
    controls.setAttribute('contenteditable', 'false');
    controls.style.display = 'none';

    const createButton = (iconClass, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'block-control-btn';
      btn.innerHTML = `<i class="fas ${iconClass}"></i>`;
      btn.title = label;
      btn.setAttribute('aria-label', label);
      return btn;
    };

    const gotoTopBtn = createButton('fa-arrow-up', 'Scroll block to top');
    const gotoBottomBtn = createButton('fa-arrow-down', 'Scroll block to bottom');
    const focusBtn = createButton('fa-bullseye', 'Move block into view');
    const copyBtn = createButton('fa-copy', 'Copy block contents');
    copyBtn.dataset.originalIcon = copyBtn.innerHTML;

    const scrollBlock = (target, topValue) => {
      if (!target) return;
      if (typeof target.scrollTo === 'function') {
        target.scrollTo({ top: topValue, behavior: 'smooth' });
      } else {
        target.scrollTop = topValue;
      }
    };

    gotoTopBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      scrollBlock(this.blockControlsTarget, 0);
    });

    gotoBottomBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.blockControlsTarget) {
        scrollBlock(this.blockControlsTarget, this.blockControlsTarget.scrollHeight);
      }
    });

    focusBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.focusBlockInViewport(this.blockControlsTarget);
    });

    copyBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this.copyActiveBlockContent();
    });

    controls.append(gotoTopBtn, gotoBottomBtn, focusBtn, copyBtn);

    controls.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    document.body.appendChild(controls);

    this.blockControls = controls;
    this.blockControlsTopBtn = gotoTopBtn;
    this.blockControlsBottomBtn = gotoBottomBtn;
    this.blockControlsFocusBtn = focusBtn;
    this.blockControlsCopyBtn = copyBtn;

    const repositionControls = () => {
      if (this.blockControlsTarget) {
        this.updateBlockControlsPosition(this.blockControlsTarget);
      }
    };

    this._boundBlockControlsUpdater = repositionControls;

    this.editor.addEventListener('scroll', repositionControls, { passive: true });
    window.addEventListener('resize', repositionControls);
    window.addEventListener('scroll', repositionControls, { passive: true });
    this.editor.addEventListener('input', () => {
      if (this.blockControlsTarget && !this.blockControlsTarget.isConnected) {
        this.hideBlockControls();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!this.blockControlsTarget) return;
      if (event.target.closest('.block-controls')) return;
      if (event.target.closest('.block')) return;
      this.hideBlockControls();
    });
  },

  showBlockControls(block) {
    if (!this.blockControls || !block) {
      return;
    }

    if (!block.isConnected) {
      this.hideBlockControls();
      return;
    }

    if (this.blockControlsTarget && this._boundBlockControlsUpdater) {
      if (this.blockControlsTarget?.dataset?.controlsPad) {
        delete this.blockControlsTarget.dataset.controlsPad;
      }
      this.blockControlsTarget.removeEventListener('scroll', this._boundBlockControlsUpdater);
    }

    this.blockControlsTarget = block;
    this.blockControls.style.display = 'flex';

    if (this._boundBlockControlsUpdater) {
      block.addEventListener('scroll', this._boundBlockControlsUpdater, { passive: true });
    }

    requestAnimationFrame(() => this.updateBlockControlsPosition(block));
  },

  hideBlockControls() {
    if (!this.blockControls) {
      return;
    }

    if (this.blockControlsTarget?.dataset?.controlsPad) {
      delete this.blockControlsTarget.dataset.controlsPad;
    }

    if (this.blockControlsTarget && this._boundBlockControlsUpdater) {
      this.blockControlsTarget.removeEventListener('scroll', this._boundBlockControlsUpdater);
    }

    this.blockControlsTarget = null;
    this.blockControls.style.display = 'none';
  },

  updateBlockControlsPosition(block) {
    if (!this.blockControls || !block || !this.blockControlsTarget) {
      return;
    }

    if (!block.isConnected) {
      this.hideBlockControls();
      return;
    }

    if (this.blockControls.style.display === 'none') {
      return;
    }

    const editorRect = this.editor?.getBoundingClientRect?.();
    const blockRect = block.getBoundingClientRect();

    if (!editorRect) return;

    const completelyOutOfView = blockRect.bottom < editorRect.top || blockRect.top > editorRect.bottom;
    if (completelyOutOfView) {
      this.hideBlockControls();
      return;
    }

    const offset = 8;
    const controlsRect = this.blockControls.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    const controlsHeight = controlsRect.height || 38;
    const controlsWidth = controlsRect.width || 140;

    const minTop = Math.max(offset, editorRect.top + offset);
    const maxTop = Math.min(
      viewportHeight - controlsHeight - offset,
      editorRect.bottom - controlsHeight - offset
    );

    const outsideAbove = blockRect.top - controlsHeight - offset;
    const outsideBelow = blockRect.bottom + offset;
    const insideTop = blockRect.top + offset;
    const insideBottom = blockRect.bottom - controlsHeight - offset;

    const canPlaceOutsideAbove = outsideAbove >= minTop && outsideAbove <= maxTop;
    const canPlaceOutsideBelow = outsideBelow >= minTop && outsideBelow <= maxTop;

    let preferredPlacement = 'top';
    const isScrollable = block.scrollHeight > block.clientHeight + 2;
    if (isScrollable) {
      const maxScrollTop = Math.max(0, block.scrollHeight - block.clientHeight);
      const atTop = block.scrollTop <= 2;
      const atBottom = (maxScrollTop - block.scrollTop) <= 2;
      if (atBottom) {
        preferredPlacement = 'bottom';
      } else if (!atTop && maxScrollTop > 0) {
        preferredPlacement = block.scrollTop > maxScrollTop / 2 ? 'bottom' : 'top';
      }
    } else {
      const spaceAbove = blockRect.top - minTop;
      const spaceBelow = maxTop - blockRect.bottom;
      preferredPlacement = spaceAbove >= spaceBelow ? 'top' : 'bottom';
    }

    const blockClippedTop = blockRect.top < editorRect.top;
    const blockClippedBottom = blockRect.bottom > editorRect.bottom;
    if (blockClippedTop && !blockClippedBottom) {
      preferredPlacement = 'bottom';
    } else if (blockClippedBottom && !blockClippedTop) {
      preferredPlacement = 'top';
    }

    let top = insideTop;
    let placement = 'top';
    let desiredPad = '';

    const pickAbove = () => {
      placement = 'top';
      if (canPlaceOutsideAbove) {
        top = outsideAbove;
        desiredPad = '';
      } else {
        top = insideTop;
        desiredPad = 'top';
      }
    };

    const pickBelow = () => {
      placement = 'bottom';
      if (canPlaceOutsideBelow) {
        top = outsideBelow;
        desiredPad = '';
      } else {
        top = insideBottom;
        desiredPad = 'bottom';
      }
    };

    if (preferredPlacement === 'top') {
      pickAbove();
    } else {
      pickBelow();
    }

    const currentPad = block.dataset.controlsPad || '';
    if (currentPad !== desiredPad) {
      if (desiredPad) {
        block.dataset.controlsPad = desiredPad;
      } else {
        delete block.dataset.controlsPad;
      }
      requestAnimationFrame(() => this.updateBlockControlsPosition(block));
      return;
    }

    top = Math.max(minTop, Math.min(top, maxTop));

    let left = blockRect.right - controlsWidth - offset;

    const editorLeftLimit = editorRect.left + offset;
    const editorRightLimit = editorRect.right - controlsWidth - offset;

    if (editorRightLimit >= editorLeftLimit) {
      left = Math.max(editorLeftLimit, Math.min(left, editorRightLimit));
    } else {
      left = editorRect.left + offset;
    }

    const maxLeft = viewportWidth - controlsWidth - offset;
    left = Math.max(offset, Math.min(left, maxLeft));

    this.blockControls.dataset.position = placement;

    this.blockControls.style.top = `${top}px`;
    this.blockControls.style.left = `${left}px`;
  },

  async copyActiveBlockContent() {
    if (!this.blockControlsTarget) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      this.showToast('Clipboard access is not available in this browser.', 'error');
      return;
    }

    try {
      const text = this.getBlockPlainText(this.blockControlsTarget);

      if (!text || !text.trim()) {
        this.showToast('This block is empty.', 'info');
        return;
      }

      await navigator.clipboard.writeText(text);
      this.showBlockCopyFeedback();
    } catch (error) {
      console.error('Failed to copy block:', error);
      this.showToast('Unable to copy block content.', 'error');
    }
  },

  showBlockCopyFeedback() {
    if (!this.blockControlsCopyBtn) return;

    if (!this.blockControlsCopyBtn.dataset.originalIcon) {
      this.blockControlsCopyBtn.dataset.originalIcon = this.blockControlsCopyBtn.innerHTML;
    }

    this.blockControlsCopyBtn.innerHTML = '<i class="fas fa-check"></i>';

    clearTimeout(this._blockCopyFeedbackTimer);
    this._blockCopyFeedbackTimer = setTimeout(() => {
      if (this.blockControlsCopyBtn) {
        this.blockControlsCopyBtn.innerHTML = this.blockControlsCopyBtn.dataset.originalIcon;
      }
    }, 1500);
  },

  getBlockPlainText(block) {
    if (!block) return '';

    const blockLevelTags = new Set([
      'DIV', 'P', 'LI', 'UL', 'OL', 'SECTION', 'ARTICLE', 'ASIDE', 'PRE', 'BLOCKQUOTE',
      'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR', 'TD', 'TH', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
    ]);
    const parts = [];

    const appendNewline = () => {
      if (!parts.length) {
        parts.push('\n');
        return;
      }
      const last = parts[parts.length - 1];
      if (last.endsWith('\n')) return;
      parts.push('\n');
    };

    const traverse = (node) => {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.nodeValue || '');
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tag = node.tagName;

      if (tag === 'BR') {
        parts.push('\n');
        return;
      }

      Array.from(node.childNodes || []).forEach(traverse);

      if (blockLevelTags.has(tag)) {
        appendNewline();
      }
    };

    traverse(block);

    let text = parts.join('').replace(/\u00A0/g, ' ');
    text = text.replace(/[ \t]+\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trimEnd();
  },

  focusBlockInViewport(block) {
    if (!block) return;

    const editor = this.editor;

    if (!editor) {
      block.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const editorRect = editor.getBoundingClientRect();
    const blockRect = block.getBoundingClientRect();

    const blockOffsetWithinEditor = blockRect.top - editorRect.top + editor.scrollTop;
    const desiredOffset = editor.clientHeight * 0.25;
    const targetScroll = blockOffsetWithinEditor - desiredOffset;
    const maxScroll = editor.scrollHeight - editor.clientHeight;
    const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

    editor.scrollTo({ top: clampedScroll, behavior: 'smooth' });

    setTimeout(() => {
      if (this.blockControlsTarget === block) {
        this.updateBlockControlsPosition(block);
      }
    }, 200);
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

  insertPlainTextAtSelection(text) {
    if (typeof text !== 'string' || text.length === 0) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      return false;
    }

    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalized.split('\n');
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const fragment = document.createDocumentFragment();
    let lastNode = null;

    parts.forEach((part, index) => {
      const textNode = document.createTextNode(part);
      fragment.appendChild(textNode);
      lastNode = textNode;

      if (index < parts.length - 1) {
        const br = document.createElement('br');
        fragment.appendChild(br);
        lastNode = br;
      }
    });

    range.insertNode(fragment);

    if (lastNode) {
      const afterRange = document.createRange();
      afterRange.setStartAfter(lastNode);
      afterRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(afterRange);
    } else {
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    return true;
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
      window.location.href = '/help.html';
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
    document.removeEventListener("pointerdown", this.pointerDownHideHandler);
    if (this.aiToolbarShowTimeout) {
      clearTimeout(this.aiToolbarShowTimeout);
      this.aiToolbarShowTimeout = null;
    }

    const hideToolbar = () => {
      if (this.aiToolbarShowTimeout) {
        clearTimeout(this.aiToolbarShowTimeout);
        this.aiToolbarShowTimeout = null;
      }
      if (!this.aiToolbar) return;
      this.aiToolbar.style.display = 'none';
      this.aiToolbar.classList.remove("visible");
    };

    // Create the handler
    this.selectionChangeHandler = () => {
      if (this.aiToolbarShowTimeout) {
        clearTimeout(this.aiToolbarShowTimeout);
        this.aiToolbarShowTimeout = null;
      }

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        hideToolbar();
        return;
      }

      this.aiToolbarShowTimeout = setTimeout(() => {
        const activeSelection = window.getSelection();
        if (!activeSelection || activeSelection.isCollapsed || !activeSelection.toString().trim()) {
          hideToolbar();
          return;
        }
        if (!activeSelection.rangeCount || !this.aiToolbar) {
          hideToolbar();
          return;
        }

        const range = activeSelection.getRangeAt(0);
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
      }, 2000);
    };

    // Add the listener
    document.addEventListener("selectionchange", this.selectionChangeHandler);
    this.pointerDownHideHandler = (event) => {
      if (!this.aiToolbar || this.aiToolbar.contains(event.target)) {
        return;
      }
      hideToolbar();
    };
    document.addEventListener("pointerdown", this.pointerDownHideHandler);
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
      const quickAskCameraBtn = document.getElementById('quickAskCameraBtn');
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
        this.setupQuickAskVoiceControls(quickAskBtn);
      }
      if (quickAskCameraBtn) {
        quickAskCameraBtn.addEventListener('click', async () => {
          await this.handleQuickAskCameraCapture();
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
        // Preserve selection: prevent focus change on mousedown and cache selection
        addBlockBtn.addEventListener('mousedown', (e) => {
          this._savedSelection = this.captureSelection();
          e.preventDefault(); // keep selection from collapsing due to focus change
        });
        addBlockBtn.addEventListener('click', () => {
          // If selection collapsed/not in editor, restore cached selection for block wrapping
          const sel = window.getSelection();
          const hasRange = sel && sel.rangeCount > 0;
          const rng = hasRange ? sel.getRangeAt(0) : null;
          const inEditor = rng ? this.editor.contains(rng.commonAncestorContainer) : false;
          const emptySel = !rng || rng.collapsed || (sel.toString().trim().length === 0);
          if ((!inEditor || emptySel) && this._savedSelection) {
            this.restoreSelection(this._savedSelection);
          }
          this.addNewBlock();
          this._savedSelection = null;
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

        this.editor.addEventListener('paste', (event) => {
          let handled = false;
          const selection = window.getSelection();
          if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0);
            const startNode = range.startContainer;
            const anchorElement = startNode?.nodeType === Node.ELEMENT_NODE
              ? startNode
              : startNode?.parentElement;
            const block = anchorElement?.closest?.('.block') || this.currentBlock;

            const dataTransfer = event.clipboardData || window.clipboardData;
            if (block && dataTransfer) {
              const hasFiles = dataTransfer.files && dataTransfer.files.length > 0;
              let plainText = '';
              try {
                plainText = dataTransfer.getData('text/plain') || dataTransfer.getData('Text') || '';
              } catch (_) {
                plainText = '';
              }

              if (!hasFiles && plainText) {
                event.preventDefault();
                handled = this.insertPlainTextAtSelection(plainText);
                if (handled) {
                  this.currentBlock = block;
                }
              }
            }
          }

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

  initializeSearchUI() {
    try {
      const wrapper = document.getElementById('searchWrapper');
      const container = document.getElementById('globalSearchContainer');
      const toggleBtn = document.getElementById('searchToggleBtn');
      const input = document.getElementById('globalSearchInput');
      const searchBtn = document.getElementById('globalSearchBtn');
      const clearBtn = document.getElementById('searchClearBtn');
      const closeBtn = document.getElementById('searchCloseBtn');
      const resultsContainer = document.getElementById('searchResults');

      if (!input || !resultsContainer || !wrapper || !container || !toggleBtn) {
        return;
      }

      this._searchWrapper = wrapper;
      this._searchContainer = container;
      this._searchInput = input;
      this._searchToggleBtn = toggleBtn;

      const triggerSearch = () => {
        const term = input.value.trim();
        if (!term) {
          this.clearSearchResults({ keepInput: true });
          return;
        }
        this.showSearchUI({ focusInput: false });
        this.performSearch(term);
      };

      toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        if (this._searchUIOpen) {
          this.hideSearchUI({ keepInput: true });
        } else {
          this.showSearchUI({ focusInput: true });
        }
      });

      searchBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        this.showSearchUI({ focusInput: false });
        triggerSearch();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          triggerSearch();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          this.hideSearchUI({ keepInput: true });
          input.blur();
        }
      });

      input.addEventListener('input', () => {
        const term = input.value.trim();
        const hasValue = Boolean(term);
        if (hasValue) {
          clearBtn?.classList.add('active');
        } else {
          clearBtn?.classList.remove('active');
        }

        if (!hasValue) {
          this.clearSearchResults({ keepInput: true });
          return;
        }

        this.clearSearchResults({ keepInput: true });
        this.showSearchUI({ focusInput: false });

        const summary = document.getElementById('searchResultsSummary');
        const currentList = document.getElementById('searchResultsCurrent');
        const workspaceList = document.getElementById('searchResultsWorkspace');

        if (summary) {
          summary.textContent = term
            ? `Press Enter or click the search icon to search for "${term}"`
            : 'Search across your workspace';
        }
        if (currentList) {
          currentList.innerHTML = '<div class="search-empty">Press Enter to search this note.</div>';
        }
        if (workspaceList) {
          workspaceList.innerHTML = '<div class="search-status">Press Enter or click the search icon to search all notes and folders.</div>';
        }
      });

      clearBtn?.addEventListener('click', () => {
        input.value = '';
        clearBtn.classList.remove('active');
        this.clearSearchResults();
      });

      closeBtn?.addEventListener('click', () => {
        this.hideSearchUI({ keepInput: true });
      });

      resultsContainer.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const item = target.closest('.search-result-item');
        if (!item) {
          return;
        }

        const type = item.dataset.resultType;
        if (type === 'local') {
          this.focusLocalSearchMatch(item.dataset.matchId || '');
        } else if (type === 'note') {
          await this.openRemoteSearchNote(item.dataset.noteId, item.dataset.term);
        } else if (type === 'folder') {
          await this.openFolderFromSearch(item.dataset.folderId, item.dataset.folderName);
        } else {
          return;
        }

        this.hideSearchUI({ keepInput: true });
      });

      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.closest('#searchWrapper')) {
          return;
        }
        if (this._searchUIOpen) {
          this.hideSearchUI({ keepInput: true });
        }
      }, true);

      this.clearSearchResults({ keepInput: true });
      this.hideSearchUI({ keepInput: true, reset: false });
    } catch (error) {
      console.error('Failed to initialize search UI:', error);
    }
  },

  async performSearch(term) {
    this._lastSearchTerm = term;
    this._workspaceSearchResults = null;
    const localMatches = this.searchCurrentNote(term);
    this.renderSearchResults(term, localMatches, null, { isWorkspaceLoading: true });

    try {
      const encoded = encodeURIComponent(term);
      const remote = await this.apiRequest('GET', `/search?term=${encoded}`, null, false, true);
      if (remote?.error) {
        throw new Error(remote.error);
      }
      if (this._lastSearchTerm !== term) {
        return;
      }
      this._workspaceSearchResults = remote;
      this.renderSearchResults(term, localMatches, remote);
    } catch (error) {
      console.error('Global search error:', error);
      if (this._lastSearchTerm === term) {
        this.renderSearchResults(term, localMatches, null, {
          workspaceError: 'Unable to search all notes. Please try again.',
        });
      }
    }
  },

  searchCurrentNote(term) {
    const matches = [];
    this._currentNoteSearchMatches = [];
    if (!term || !this.editor) {
      return matches;
    }

    const normalizedTerm = term.toLowerCase();
    const walker = document.createTreeWalker(this.editor, NodeFilter.SHOW_TEXT, null);
    let matchIndex = 0;
    const MAX_MATCHES = 50;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (parent && parent.closest && parent.closest('script,style,noscript')) {
        continue;
      }
      const text = node.textContent || '';
      if (!text.trim()) {
        continue;
      }
      const lower = text.toLowerCase();
      let fromIndex = 0;
      while (fromIndex < lower.length) {
        const foundAt = lower.indexOf(normalizedTerm, fromIndex);
        if (foundAt === -1) {
          break;
        }
        const id = `local-${matchIndex}`;
        matchIndex += 1;
        const excerpt = this.createSearchSnippet(text, foundAt, term.length);
        const record = {
          id,
          node,
          startOffset: foundAt,
          endOffset: foundAt + term.length,
          excerpt,
        };
        this._currentNoteSearchMatches.push(record);
        matches.push({ id, excerpt });
        fromIndex = foundAt + term.length;
        if (matches.length >= MAX_MATCHES) {
          return matches;
        }
      }
      if (matches.length >= MAX_MATCHES) {
        break;
      }
    }

    return matches;
  },

  renderSearchResults(term, localMatches = [], workspaceResults = null, options = {}) {
    const container = document.getElementById('searchResults');
    const summary = document.getElementById('searchResultsSummary');
    const currentList = document.getElementById('searchResultsCurrent');
    const workspaceList = document.getElementById('searchResultsWorkspace');

    if (!container || !summary || !currentList || !workspaceList) {
      return;
    }

    container.classList.remove('hidden');
    this.showSearchUI({ focusInput: false });

    if (term) {
      const totalWorkspaceMatches = workspaceResults
        ? (workspaceResults.notes?.length || 0) + (workspaceResults.folders?.length || 0)
        : 0;
      summary.textContent = workspaceResults
        ? `Found ${localMatches.length} note matches and ${totalWorkspaceMatches} workspace matches for “${term}”`
        : `Matches for “${term}”`;
    } else {
      summary.textContent = 'Search across your workspace';
    }

    if (!localMatches.length) {
      currentList.innerHTML = '<div class="search-empty">No matches in this note.</div>';
    } else {
      currentList.innerHTML = '';
      const fragment = document.createDocumentFragment();
      const noteLabel = this.currentNoteTitle || 'Current note';
      localMatches.forEach((match, index) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.resultType = 'local';
        item.dataset.matchId = match.id;
        item.innerHTML = `
          <div class="search-result-title">
            <span class="search-result-label">${this.escapeHTML(noteLabel)}</span>
            <span class="search-result-title-text">Match #${index + 1}</span>
          </div>
          <div class="search-result-snippet">${match.excerpt}</div>
        `;
        fragment.appendChild(item);
      });
      currentList.appendChild(fragment);
    }

    if (options.workspaceError) {
      workspaceList.innerHTML = `<div class="search-status">${this.escapeHTML(options.workspaceError)}</div>`;
      return;
    }

    if (options.isWorkspaceLoading) {
      workspaceList.innerHTML = '<div class="search-status loading">Searching all notes…</div>';
      return;
    }

    if (!workspaceResults) {
      workspaceList.innerHTML = '<div class="search-empty">Press Enter to search all notes and folders.</div>';
      return;
    }

    const folderMatches = workspaceResults.folders || [];
    const noteMatches = workspaceResults.notes || [];

    if (!folderMatches.length && !noteMatches.length) {
      workspaceList.innerHTML = '<div class="search-empty">No notes or folders matched your search.</div>';
      return;
    }

    workspaceList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    folderMatches.forEach((folder) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.resultType = 'folder';
      item.dataset.folderId = folder.folder_id;
      item.dataset.folderName = folder.folder_name || '';
      item.innerHTML = `
        <div class="search-result-title">
          <span class="search-result-label">Folder</span>
          <span class="search-result-title-text">${this.escapeHTML(folder.folder_name || 'Untitled folder')}</span>
        </div>
        <div class="search-result-meta">${folder.parent_folder_id ? 'Nested folder' : 'Top-level folder'}</div>
      `;
      fragment.appendChild(item);
    });

    noteMatches.forEach((note) => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.resultType = 'note';
      item.dataset.noteId = note.note_id;
      item.dataset.term = term;
      const metaBits = [];
      if (note.folder_name) {
        metaBits.push(`In ${note.folder_name}`);
      }
      if (note.match_field) {
        metaBits.push(note.match_field === 'title' ? 'Title match' : 'Content match');
      }
      const snippetText = this.stripHTMLTags(note.snippet || '');
      item.innerHTML = `
        <div class="search-result-title">
          <span class="search-result-label">${this.escapeHTML(note.folder_name || 'Note')}</span>
          <span class="search-result-title-text">${this.escapeHTML(note.title || 'Untitled')}</span>
        </div>
        <div class="search-result-meta">${this.escapeHTML(metaBits.join(' • ') || 'Note match')}</div>
        <div class="search-result-snippet">${this.escapeHTML(snippetText)}</div>
      `;
      fragment.appendChild(item);
    });

    workspaceList.appendChild(fragment);
  },

  clearSearchResults(options = {}) {
    const { keepInput = false } = options;
    const container = document.getElementById('searchResults');
    const summary = document.getElementById('searchResultsSummary');
    const currentList = document.getElementById('searchResultsCurrent');
    const workspaceList = document.getElementById('searchResultsWorkspace');
    const input = document.getElementById('globalSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    this._lastSearchTerm = '';
    this._currentNoteSearchMatches = [];
    this._workspaceSearchResults = null;

    if (!keepInput && input) {
      input.value = '';
      clearBtn?.classList.remove('active');
    }

    container?.classList.remove('hidden');
    if (summary) {
      summary.textContent = 'Search across your workspace';
    }
    if (currentList) {
      currentList.innerHTML = '<div class="search-empty">Type in the search box to search this note.</div>';
    }
    if (workspaceList) {
      workspaceList.innerHTML = '<div class="search-empty">Search includes all folders and notes.</div>';
    }
  },

  showSearchUI(options = {}) {
    const { focusInput = false } = options;
    if (!this._searchContainer || !this._searchWrapper) {
      return;
    }
    this._searchUIOpen = true;
    this._searchWrapper.classList.add('active');
    this._searchContainer.classList.remove('hidden');
    this._searchToggleBtn?.classList.add('active');
    if (focusInput && this._searchInput) {
      requestAnimationFrame(() => this._searchInput?.focus());
    }
  },

  hideSearchUI(options = {}) {
    const { keepInput = true, reset = true } = options;
    if (!this._searchContainer || !this._searchWrapper) {
      return;
    }
    if (reset) {
      this.clearSearchResults({ keepInput });
    }
    this._searchUIOpen = false;
    this._searchWrapper.classList.remove('active');
    this._searchContainer.classList.add('hidden');
    this._searchToggleBtn?.classList.remove('active');
  },

  focusLocalSearchMatch(matchId) {
    if (!matchId) {
      return false;
    }

    const matches = this._currentNoteSearchMatches || [];
    let match = matches.find((m) => m.id === matchId);
    if (!match && this._lastSearchTerm) {
      this.searchCurrentNote(this._lastSearchTerm);
      match = (this._currentNoteSearchMatches || []).find((m) => m.id === matchId);
    }

    if (!match) {
      this.showToast('Search result is no longer available. Please search again.', 'info');
      return false;
    }

    try {
      if (!match.node?.isConnected) {
        throw new Error('Detached node');
      }

      const range = document.createRange();
      const text = match.node.textContent || '';
      const start = Math.min(match.startOffset, text.length);
      let end = Math.min(match.endOffset, text.length);
      if (end <= start) {
        end = Math.min(start + 1, text.length);
      }
      range.setStart(match.node, start);
      range.setEnd(match.node, end);

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      const target = match.node.parentElement || this.editor;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    } catch (error) {
      console.error('Failed to focus search result:', error);
      this.showToast('Unable to focus search match. Please search again.', 'error');
      return false;
    }
  },

  async openRemoteSearchNote(noteId, term) {
    if (!noteId) {
      return false;
    }
    try {
      await this.loadNote(noteId);
      const query = term || this._lastSearchTerm;
      if (!query) {
        return true;
      }
      setTimeout(() => {
        const focused = this.focusFirstMatchInCurrentNote(query);
        if (!focused) {
          this.showToast('Opened note but could not locate the search term.', 'info');
        }
      }, 60);
      return true;
    } catch (error) {
      console.error('Failed to open note from search:', error);
      this.showToast('Unable to open note from search.', 'error');
      return false;
    }
  },

  focusFirstMatchInCurrentNote(term) {
    if (!term) {
      return false;
    }
    const matches = this.searchCurrentNote(term);
    if (!matches.length) {
      return false;
    }
    const first = this._currentNoteSearchMatches?.[0];
    if (first) {
      return Boolean(this.focusLocalSearchMatch(first.id));
    }
    return false;
  },

  async openFolderFromSearch(folderId, folderName = '') {
    if (!folderId) {
      return false;
    }

    this.ensureSidebarVisible();
    const normalizedFolderId = String(folderId);

    const findFolderElement = () => Array.from(document.querySelectorAll('[data-folder-id]'))
      .find((el) => String(el.dataset.folderId) === normalizedFolderId);

    let target = findFolderElement();
    try {
      if (!target) {
        await this.loadFolders();
        target = findFolderElement();
      }
      if (!target) {
        this.showToast('Folder not found. Please refresh your folders list.', 'info');
        return false;
      }

      const hasOpenContents =
        target.classList.contains('open') &&
        target.nextElementSibling?.classList?.contains('folder-contents');
      if (!hasOpenContents) {
        await this.loadFolderContents(normalizedFolderId, target);
      }

      const targetName =
        folderName ||
        target.querySelector('.folder-content span')?.textContent?.trim() ||
        'Folder';
      if (typeof this.showFolderUIAtBottom === 'function') {
        await this.showFolderUIAtBottom(normalizedFolderId, targetName);
      }

      this.highlightFolderElement(target);
      return true;
    } catch (error) {
      console.error('Failed to navigate to folder from search:', error);
      this.showToast('Unable to open folder from search.', 'error');
      return false;
    }
  },

  highlightFolderElement(element) {
    if (!element) {
      return;
    }
    element.classList.add('search-hit-folder');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      element.classList.remove('search-hit-folder');
    }, 1600);
  },

  createSearchSnippet(text, startIndex, termLength, context = 50) {
    if (!text) {
      return '';
    }
    const start = Math.max(0, startIndex - context);
    const end = Math.min(text.length, startIndex + termLength + context);
    let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) {
      snippet = `...${snippet}`;
    }
    if (end < text.length) {
      snippet = `${snippet}...`;
    }
    return this.escapeHTML(snippet);
  },

  escapeHTML(value = '') {
    const stringValue = `${value ?? ''}`;
    return stringValue.replace(/[&<>"']/g, (char) => ESCAPE_HTML_MAP[char] || char);
  },

  stripHTMLTags(value = '') {
    const text = `${value ?? ''}`;
    if (!text) {
      return '';
    }
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]*>?/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const mainContent = document.querySelector(".main-content");
    const editor = document.querySelector(".editor");

    if (sidebar && mainContent) {
      sidebar.classList.toggle("hidden");
    }
  },

  ensureSidebarVisible() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar?.classList.contains("hidden")) {
      sidebar.classList.remove("hidden");
    }
  },

  showToast(message, type = 'error', options = {}) {
    const {
      actionLabel = '',
      onAction = null,
      durationMs = 10000,
    } = options || {};
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}${actionLabel ? ' has-action' : ''}`;
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = `${message ?? ''}`;
    toast.appendChild(messageEl);

    if (actionLabel && typeof onAction === 'function') {
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.className = 'toast-action';
      actionButton.textContent = actionLabel;
      actionButton.addEventListener('click', () => {
        try {
          onAction();
        } catch (error) {
          console.error('Toast action failed:', error);
        }
      });
      toast.appendChild(actionButton);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'toast-close';
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    toast.appendChild(closeButton);

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
        if (toast.parentElement === toastContainer) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    };

    closeBtn.addEventListener('click', closeToast);

    // Auto close after configured timeout
    setTimeout(closeToast, durationMs);

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
