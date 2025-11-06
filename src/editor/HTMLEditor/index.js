import { DEFAULT_SYSTEM_PROMPT, DEFAULT_MODELS } from './constants.js';
import coreMixin from './core.js';
import aiMixin from './ai.js';
import commentsMixin from './comments.js';
import blocksMixin from './blocks.js';
import authMixin from './auth.js';
import foldersMixin from './folders.js';
import notesMixin from './notes.js';
import filesMixin from './files.js';
import mediaMixin from './media.js';
import historyMixin from './history.js';
import apiMixin from './api.js';

class HTMLEditor {
  constructor() {
    // Define DEFAULT_SYSTEM_PROMPT as a class property
    this.DEFAULT_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;

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
    this.DEFAULT_MODELS = [...DEFAULT_MODELS];

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

  stoptrackTimeoutid = 0;

}

Object.assign(
  HTMLEditor.prototype,
  coreMixin,
  aiMixin,
  commentsMixin,
  blocksMixin,
  authMixin,
  foldersMixin,
  notesMixin,
  filesMixin,
  mediaMixin,
  historyMixin,
  apiMixin,
);

export default HTMLEditor;
