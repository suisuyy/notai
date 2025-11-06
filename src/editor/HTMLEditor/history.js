const mixin = {
  initializeHistory() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 100;
    this.lastInputTime = 0;
    this.lastInputType = '';
  },

  resetHistoryWithCurrentContent() {
    this.undoStack = [];
    this.redoStack = [];
    this.recordSnapshot('init');
  },

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
  },

  getNodeByPath(path, root) {
    let current = root;
    for (const index of path) {
      if (!current || !current.childNodes || !current.childNodes[index]) return null;
      current = current.childNodes[index];
    }
    return current || null;
  },

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
  },

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
  },

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
  },

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
  },

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
  },
};

export default mixin;
