import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_MODELS,
  DEFAULT_NOTE_BIG_NOTE_THRESHOLD,
  NOTE_SIZE_LIMIT_FOR_APPEND,
} from './constants.js';
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
    this.DEFAULT_NOTE_BIG_NOTE_THRESHOLD = DEFAULT_NOTE_BIG_NOTE_THRESHOLD;
    this.NOTE_SIZE_LIMIT_FOR_APPEND = NOTE_SIZE_LIMIT_FOR_APPEND;

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
    if (!editor || !sourceView || !toolbar) {
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
    this.aiToolbar = aiToolbar || null;
    this.setEditableState(false);
    this.currentNoteTitle = "";
    this.lastSavedContent = "";
    this.lastUpdated = null;
    this.lastInteractionTime = 0;
    this.currentNoteFolderId = null;
    this._oversizedDefaultNoteState = {
      noteId: null,
      status: 'idle',
      timer: null,
      noteData: null,
    };
    this._noteSizePolicyState = {
      noteId: null,
      contentLength: 0,
      blockInsertions: false,
      blockReason: '',
      noticeShown: false,
    };
    this._currentNoteSearchMatches = [];
    this._workspaceSearchResults = null;
    this._lastSearchTerm = '';
    this._searchDebounceTimer = null;
    this._searchUIOpen = false;
    this._searchContainer = null;
    this._searchWrapper = null;
    this._searchInput = null;
    this._searchToggleBtn = null;
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
    this.initializeSearchUI();
    this.setupCommentSystem();
    this.updateAIToolbar(); // Load custom AI buttons

    // Seed history with initial content after DOM is ready
    setTimeout(() => this.resetHistoryWithCurrentContent(), 0)

    // Add title auto-save
    const titleElement = document.getElementById("noteTitle");
    titleElement.addEventListener('beforeinput', (event) => {
      if (this.shouldPreventGrowthForCurrentNote(event, 'title')) {
        event.preventDefault();
      }
    });
    titleElement.addEventListener('input', () => this.delayedSaveNote());
    this.currentBlock = null;
    this.content = ""; // Store markdown content
    this.isSourceView = false;
    this.autoSaveTimeout = null;
    this.deferredRemoteNoteId = null;
    const audioRecordingConfig = this.resolvePreferredAudioRecordingConfig();
    this.audioRecordType = audioRecordingConfig.mimeType;
    this.audioRecordExt = audioRecordingConfig.fileExt;
    this.audioRecordLabel = audioRecordingConfig.formatLabel;
    this.audioInputFormat = audioRecordingConfig.inputAudioFormat;
    this.audioRecordOptions = audioRecordingConfig.recorderOptions;
    this.audioStreamConstraints = audioRecordingConfig.streamConstraints;
    const videoRecordingConfig = this.resolvePreferredVideoRecordingConfig();
    this.videoRecordType = videoRecordingConfig.mimeType;
    this.videoRecordExt = videoRecordingConfig.fileExt;
    this.quickAskVoiceMinDurationMs = 2000;
    this.quickAskCameraLongPressMs = 240;
    this.quickAskVoiceState = {
      active: false,
      busy: false,
      locked: false,
      pointerId: null,
      pressStartedAt: 0,
      recordingStartedAt: 0,
      recorder: null,
      stream: null,
      chunks: [],
      timerIntervalId: 0,
      startPromise: null,
      releaseRequested: null,
      completing: null,
      mimeType: '',
      formatLabel: this.audioRecordLabel,
      inputAudioFormat: this.audioInputFormat,
      audioBitsPerSecond: this.audioRecordOptions?.audioBitsPerSecond ?? null,
      promptContext: null,
      releaseRequested: null,
      newNoteRequested: false,
      newNotePromise: null,
    };
    this.quickAskCameraState = {
      active: false,
      busy: false,
      starting: false,
      pointerId: null,
      pressStartedAt: 0,
      holdTimerId: 0,
      timerIntervalId: 0,
      videoStream: null,
      audioStream: null,
      recorder: null,
      chunks: [],
      mimeType: '',
      inputAudioFormat: this.audioInputFormat,
      formatLabel: this.audioRecordLabel,
      promptContext: null,
      suppressClick: false,
      releaseRequested: false,
      newNoteRequested: false,
      newNotePromise: null,
    };
    this.aiResponseAudioState = {
      hasAutoplayed: false,
      currentElement: null,
    };

    this.checkAuthAndLoadNotes();
    this.loadFolders();
    this.setupCodeCopyButton();
    this.setupBlockControls();

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

      if (this.currentBlock) {
        this.showBlockControls(this.currentBlock);
      } else {
        this.hideBlockControls();
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

        this.hideCommentGroups();
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
        this.hideCommentGroups();

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
