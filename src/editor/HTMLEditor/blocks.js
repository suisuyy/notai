const mixin = {
  getGroupEditableTargets(groupEl) {
    if (!groupEl) {
      return [];
    }

    const isAsk = groupEl.classList.contains('ask-group');
    const isComment = groupEl.classList.contains('comment-group');
    const selector = isAsk
      ? '.ask-content'
      : isComment
        ? '.comment-content'
        : '';

    if (!selector) {
      return [groupEl];
    }

    const allTargets = Array.from(groupEl.querySelectorAll(selector));
    if (!allTargets.length) {
      return [groupEl];
    }

    const visibleTargets = allTargets.filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    return visibleTargets.length ? visibleTargets : [allTargets[0]];
  },

  setGroupEditableState(groupEl, isEditable) {
    if (!groupEl) {
      return;
    }

    const targets = this.getGroupEditableTargets(groupEl);
    groupEl.dataset.groupEditing = isEditable ? '1' : '0';
    groupEl.classList.toggle('is-group-editing', isEditable);
    groupEl.setAttribute('contenteditable', 'false');

    targets.forEach((target) => {
      target.setAttribute('contenteditable', isEditable ? 'true' : 'false');
      target.spellcheck = false;
      target.setAttribute('autocorrect', 'off');
      target.setAttribute('autocapitalize', 'off');
    });

    if (isEditable) {
      targets[0]?.focus?.();
    }
  },
  getBlockContext() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const hasSelection = !range.collapsed && !!selection.toString().trim();
    const startContainer = range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : range.startContainer;

    if (!this.editor || !(this.editor instanceof Node)) {
      return null;
    }

    // Find the current block, prioritizing the block containing the cursor
    let currentBlock = startContainer?.closest?.('.block') || this.currentBlock;
    if (!currentBlock || !(currentBlock instanceof Node) || !this.editor.contains(currentBlock)) {
      currentBlock = null;
    }

    function sanitizeFragment(root) {
      if (!root?.querySelectorAll) {
        return root;
      }
      root.querySelectorAll('.quick-ask-media-info').forEach((element) => element.remove());
      return root;
    }

    function extractTextWithLineBreaks(range) {
      let fragment = sanitizeFragment(range.cloneContents());
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
    const getBeforeCaretText = () => {
      try {
        const beforeRange = document.createRange();
        beforeRange.setStart(this.editor, 0);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        return extractTextWithLineBreaks(beforeRange);
      } catch {
        return "";
      }
    };

    let contextText = "";
    let currentText = "";

    if (currentBlock) {
      let beforeBlockText = "";
      try {
        const beforeBlockRange = document.createRange();
        beforeBlockRange.setStart(this.editor, 0);
        beforeBlockRange.setEnd(currentBlock, 0);
        beforeBlockText = extractTextWithLineBreaks(beforeBlockRange).trim();
      } catch {
        beforeBlockText = "";
      }

      // In block mode with selection: use text before selected text inside the same block.
      // If that is empty, fall back to text before the block.
      if (hasSelection && currentBlock.contains(range.startContainer)) {
        try {
          const inBlockBeforeSelectionRange = document.createRange();
          inBlockBeforeSelectionRange.setStart(currentBlock, 0);
          inBlockBeforeSelectionRange.setEnd(range.startContainer, range.startOffset);
          contextText = extractTextWithLineBreaks(inBlockBeforeSelectionRange).trim();
        } catch {
          contextText = "";
        }
      }
      if (!contextText) {
        contextText = beforeBlockText;
      }
      if (hasSelection) {
        currentText = selection.toString().trim();
      } else {
        try {
          const currentBlockRange = document.createRange();
          currentBlockRange.selectNodeContents(currentBlock);
          currentText = extractTextWithLineBreaks(currentBlockRange).trim();
        } catch {
          currentText = "";
        }
      }
    } else {
      const beforeCaretText = getBeforeCaretText();
      if (hasSelection) {
        // With selection outside blocks: use text before selected text.
        contextText = beforeCaretText.trim();
        currentText = selection.toString().trim();
      } else {
        // No selection and outside blocks: use text before current line.
        const normalized = beforeCaretText.replace(/\r\n/g, "\n");
        const lineStartIndex = normalized.lastIndexOf("\n");
        contextText = (lineStartIndex === -1 ? "" : normalized.slice(0, lineStartIndex)).trim();
        currentText = (lineStartIndex === -1 ? normalized : normalized.slice(lineStartIndex + 1)).trim();
      }
    }

    console.log('Current text:', currentText, '\n Context:', contextText);
    return {
      currentText: currentText,
      contextText: contextText
    };
  },

  executeCommand(command, value = null) {
    // Snapshot before formatting command
    this.recordSnapshot('execCommand:' + command);
    document.execCommand(command, false, value);
    // Snapshot after if content changed (coalescing handled by recordSnapshot)
    this.recordSnapshot('execCommand:after:' + command);
    this.editor.focus();
    // Hide menus if any open
    this.hideAllDropdowns();
  },

  formatBlock(tag) {
    this.recordSnapshot('formatBlock:' + tag);
    document.execCommand("formatBlock", false, `<${tag}>`);
    this.recordSnapshot('formatBlock:after:' + tag);
    // Hide menus if any open
    this.hideAllDropdowns();
  },

  addNewBlock(preserveSelection = false, anchorNode = null, anchorRange = null) {
    // Try to use current selection; if it's gone due to toolbar click,
    // prefer any cached selection restored by core before calling this.
    let selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // As a fallback, try restoring last saved selection (if present)
      if (this._savedSelection) {
        this.restoreSelection(this._savedSelection);
        selection = window.getSelection();
      }
    }
    const selectedText = selection.toString().trim();

    // If there is a non-collapsed selection inside the editor, wrap it into a new block
    // Unless explicitly preserving the selection (used by AI replies)
    if (!preserveSelection && selection.rangeCount > 0) {
      const selRange = selection.getRangeAt(0);
      const isInEditor = this.editor.contains(selRange.commonAncestorContainer);
      const hasContent = !selRange.collapsed && selectedText.length > 0;
      if (isInEditor && hasContent) {
        const block = document.createElement('div');
        block.className = 'block';
        // Preserve formatting by cloning the selection
        const fragment = selRange.cloneContents();
        block.appendChild(fragment);

        block.classList.add('highlight');
        setTimeout(() => block.classList.remove('highlight'), 1000);

        // Replace selection with the new block and add spacing after
        selRange.deleteContents();
        selRange.insertNode(block);
        block.after(document.createElement('br'));

        // Place caret at start of the new block
        const newRange = document.createRange();
        newRange.selectNodeContents(block);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        this.currentBlock = block;
        block.focus();
        return block;
      }
    }

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

    // Create new block for non-selected text case, or when preserving selection
    const block = document.createElement("div");
    block.className = "block";
    block.innerHTML = '<br><br><br><br>';


    // Add highlight effect
    block.classList.add('highlight');
    setTimeout(() => {
      block.classList.remove('highlight');
    }, 1000);

    // Get current selection and find closest block
    let range;
    if (anchorRange) {
      range = anchorRange.cloneRange ? anchorRange.cloneRange() : anchorRange;
    } else if (selection && selection.rangeCount > 0) {
      const selRange = selection.getRangeAt(0);
      range = selRange.cloneRange ? selRange.cloneRange() : selRange;
    } else {
      range = document.createRange();
      range.selectNodeContents(this.editor);
      range.collapse(false);
    }
    // Prefer the block that contains the selection (or provided anchorNode)
    let currentBlock = null;
    const isUsableBlock = (candidate) => (
      candidate instanceof HTMLElement &&
      candidate.isConnected &&
      this.editor?.contains(candidate)
    );
    try {
      const anchor = anchorNode || (selection && selection.rangeCount > 0 ? selection.getRangeAt(0).commonAncestorContainer : null);
      if (anchor) {
        let el = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
        if (el) currentBlock = el.closest('.block');
        if (!currentBlock && this.editor) {
          const blocks = Array.from(this.editor.querySelectorAll('.block'));
          currentBlock = blocks.find((blockEl) => blockEl.contains(anchor));
        }
        if (!currentBlock) currentBlock = this.getCurrentOtterBlock(anchor);
      }
    } catch (_) { }
    // Fallback to the last known currentBlock
    if (!isUsableBlock(currentBlock) && isUsableBlock(this.currentBlock)) {
      currentBlock = this.currentBlock;
    }
    if (isUsableBlock(currentBlock)) {
      this.currentBlock = currentBlock;
    } else {
      currentBlock = null;
      this.currentBlock = null;
    }

    // Insert the block after the cursor position
    const blankLine = document.createElement('br');

    if (currentBlock) {
      // Insert after current block
      currentBlock.after(blankLine);
      blankLine.after(block);
      block.after(document.createElement('br'));
      this.currentBlock = block;
    } else {
      // Insert at cursor position if valid, otherwise append to editor end.
      if (this.editor.contains(range.commonAncestorContainer)) {
        range.collapse(false); // Collapse to end
        range.insertNode(blankLine);
        blankLine.after(block);
        block.after(document.createElement('br'));
        this.currentBlock = block;
      } else if (this.editor) {
        this.editor.appendChild(blankLine);
        this.editor.appendChild(block);
        this.editor.appendChild(document.createElement('br'));
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
  },

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
  },

  createLink() {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
    }
  },

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


  },

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
  },

  attachGroupControls(groupEl) {
    try {
      if (!groupEl) return;
      if (groupEl.dataset.controlsAttached === '1' && groupEl.querySelector('.group-controls')) {
        return;
      }
      // If controls already exist but the marker is stale, reuse the existing element instead of rebuilding.
      const existingControls = groupEl.querySelector('.group-controls');
      if (existingControls) {
        groupEl.dataset.controlsAttached = '1';
        return;
      }
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
        const isEditable = groupEl.dataset.groupEditing === '1';
        if (isEditable) {
          this.setGroupEditableState(groupEl, false);
          toggleBtn.innerHTML = '<span aria-label="Edit" title="Edit" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">✏️</span>';
        } else {
          this.setGroupEditableState(groupEl, true);
          toggleBtn.innerHTML = '<span aria-label="Lock" title="Lock" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;">🔒</span>';
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
  },

  ensureGroupControls() {
    try {
      const groups = this.editor.querySelectorAll('.ask-group, .comment-group');
      groups.forEach((g) => this.attachGroupControls(g));
      // Watch for newly inserted groups once per editor instance.
      if (!this._groupControlsObserver) {
        this._groupControlsObserver = new MutationObserver((mutations) => {
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
      } else {
        this._groupControlsObserver.disconnect();
      }
      this._groupControlsObserver.observe(this.editor, { childList: true, subtree: true });

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
  },
};

export default mixin;
