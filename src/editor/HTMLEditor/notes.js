import currentUser from '../../state/currentUser.js';
import utils from '../../utils/index.js';

const DEFAULT_FOLDER_ID = "1733485657799jj0.5911120915160637";

const mixin = {
  decodeRouteSegment(segment = "") {
    try {
      return decodeURIComponent(segment).trim();
    } catch {
      return `${segment ?? ""}`.trim();
    }
  },

  normalizeRouteComparable(value = "") {
    return `${value ?? ""}`.trim().toLowerCase();
  },

  parseRoutePath(routePath = "") {
    const path = `${routePath ?? ""}`.trim();
    const segments = path.split("/").filter(Boolean);
    if (segments.length !== 2) {
      return null;
    }

    const [folderSegment, noteSegment] = segments;
    const folderName = this.decodeRouteSegment(folderSegment);
    const noteTitle = this.decodeRouteSegment(noteSegment);
    if (!folderName || !noteTitle) {
      return null;
    }

    return { folderName, noteTitle };
  },

  parseNoteRouteFromLocation() {
    const params = new URLSearchParams(window.location.search || "");
    const routeParam = params.get("p");
    if (routeParam) {
      const parsedFromParam = this.parseRoutePath(routeParam);
      if (parsedFromParam) {
        return parsedFromParam;
      }
    }

    const pathname = window.location?.pathname || "/";
    return this.parseRoutePath(pathname);
  },

  getFolderNameForRoute(folderId) {
    if (!folderId) {
      return "default";
    }

    if (this.folderNameById instanceof Map) {
      const knownName = this.folderNameById.get(String(folderId));
      if (knownName) {
        return knownName;
      }
    }

    const folderElement = Array.from(document.querySelectorAll("[data-folder-id]"))
      .find((element) => String(element.dataset.folderId) === String(folderId));
    const domName = folderElement?.querySelector(".folder-content span")?.textContent?.trim();
    return domName || "default";
  },

  updateUrlForNote(note, options = {}) {
    if (!note?.title || !window?.history || !window?.location) {
      return;
    }

    const { replace = false } = options;
    const folderName = this.getFolderNameForRoute(note.folder_id);
    const nextPath = `/${encodeURIComponent(folderName)}/${encodeURIComponent(note.title)}`;
    const params = new URLSearchParams(window.location.search || "");
    params.delete("raw");
    params.set("p", nextPath);
    const nextSearch = params.toString();
    const nextUrl = `/${nextSearch ? `?${nextSearch}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl === nextUrl) {
      return;
    }

    const state = {
      noteId: note.note_id,
      folderName,
      noteTitle: note.title,
    };

    if (replace) {
      window.history.replaceState(state, "", nextUrl);
    } else {
      window.history.pushState(state, "", nextUrl);
    }
  },

  async resolveNoteIdFromRoute(folderName, noteTitle) {
    if (!folderName || !noteTitle) {
      return null;
    }

    const folders = await this.apiRequest("GET", "/folders", null, false, true);
    if (!Array.isArray(folders)) {
      return null;
    }

    this.folderNameById = new Map();
    folders.forEach((folder) => {
      this.folderNameById.set(String(folder.folder_id), folder.folder_name || "");
    });

    const normalizedFolderName = this.normalizeRouteComparable(folderName);
    const targetFolder = folders.find((folder) => (
      this.normalizeRouteComparable(folder.folder_name) === normalizedFolderName
    ));

    if (!targetFolder?.folder_id) {
      return null;
    }

    const folderId = encodeURIComponent(targetFolder.folder_id);
    const notes = await this.apiRequest("GET", `/folders/${folderId}/notes`, null, false, true);
    if (!Array.isArray(notes)) {
      return null;
    }

    const normalizedNoteTitle = this.normalizeRouteComparable(noteTitle);
    const targetNote = notes.find((note) => (
      this.normalizeRouteComparable(note.title) === normalizedNoteTitle
    ));

    return targetNote?.note_id || null;
  },

  async openNoteFromRoute(route, options = {}) {
    const { folderName, noteTitle } = route || {};
    const { urlMode = "none" } = options;
    const noteId = await this.resolveNoteIdFromRoute(folderName, noteTitle);
    if (!noteId) {
      return false;
    }

    await this.loadNote(noteId, { urlMode });
    return true;
  },

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
  },

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
  },

  getDefaultNoteId() {
    return currentUser.userId ? `default_note_${currentUser.userId}` : null;
  },

  isDefaultNoteId(noteId) {
    const defaultNoteId = this.getDefaultNoteId();
    return Boolean(defaultNoteId && noteId === defaultNoteId);
  },

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
  },

  sanitizeNoteTitle(rawTitle = "", fallback = "Untitled") {
    const normalized = `${rawTitle ?? ""}`.trim().replace(/\s+/g, "_");
    return normalized || fallback;
  },

  buildTimestampedNoteTitle(prefix = "note") {
    const safePrefix = this.sanitizeNoteTitle(prefix, "note").toLowerCase();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const second = String(now.getSeconds()).padStart(2, "0");
    return `${safePrefix}_${year}${month}${day}_${hour}${minute}${second}`;
  },

  buildNoteIdFromTitle(title = "Untitled") {
    const safeTitle = this.sanitizeNoteTitle(title, "Untitled");
    const userId = currentUser.userId || "user";
    return `${safeTitle}_${userId}_${Date.now()}`;
  },

  async ensureFolderByName(folderName = "") {
    const normalizedName = `${folderName ?? ""}`.trim();
    if (!normalizedName) {
      return { folderId: DEFAULT_FOLDER_ID, created: false, folderName: "default" };
    }

    const canonicalName = this.sanitizeNoteTitle(normalizedName, "folder");
    const lowercaseName = canonicalName.toLowerCase();
    const folders = await this.apiRequest("GET", "/folders", null, false, true);
    if (Array.isArray(folders)) {
      const existing = folders.find((folder) => {
        const name = this.sanitizeNoteTitle(folder.folder_name || folder.name || "", "").toLowerCase();
        return name === lowercaseName;
      });
      if (existing?.folder_id) {
        return {
          folderId: existing.folder_id,
          created: false,
          folderName: existing.folder_name || canonicalName,
        };
      }
    }

    const folderId = `${canonicalName}_${currentUser.userId || "user"}_${Date.now()}`;
    const result = await this.apiRequest("POST", "/folders", {
      folder_id: folderId,
      name: canonicalName,
    }, false, true);

    if (!result?.success) {
      throw new Error(`Failed to create folder "${canonicalName}"`);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const refreshedFolders = await this.apiRequest("GET", "/folders", null, false, true);
      if (Array.isArray(refreshedFolders)) {
        const createdFolder = refreshedFolders.find((folder) => {
          const name = this.sanitizeNoteTitle(folder.folder_name || folder.name || "", "").toLowerCase();
          return name === lowercaseName;
        });
        if (createdFolder?.folder_id) {
          await this.loadFolders();
          return {
            folderId: createdFolder.folder_id,
            created: true,
            folderName: createdFolder.folder_name || canonicalName,
          };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await this.loadFolders();
    throw new Error(`Folder "${canonicalName}" was created but could not be resolved`);
  },

  async createAndOpenNote({
    title = "Untitled",
    folderId = DEFAULT_FOLDER_ID,
    content = "Start writing here...",
    refreshFolderContents = true,
    refreshMainList = true,
  } = {}) {
    const safeTitle = this.sanitizeNoteTitle(title, "Untitled");
    const noteId = this.buildNoteIdFromTitle(safeTitle);

    const result = await this.apiRequest("POST", "/notes", {
      note_id: noteId,
      title: safeTitle,
      content,
      folder_id: folderId || DEFAULT_FOLDER_ID,
    }, false, true);

    if (!result?.success) {
      throw new Error(result?.error || "Unknown error");
    }

    if (folderId && refreshFolderContents) {
      const folderElement = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
      if (folderElement) {
        await this.loadFolderContents(folderId, folderElement);
      }
    } else if (!folderId && refreshMainList) {
      await this.loadNotes();
    }

    await this.loadNote(noteId);
    return { noteId, title: safeTitle, folderId: folderId || DEFAULT_FOLDER_ID };
  },

  async createAndSwitchQuickNote(options = {}) {
    const {
      folderName = "",
      folderId = null,
      titlePrefix = "note",
      content = "Start writing here...",
    } = options;

    let targetFolderId = folderId || DEFAULT_FOLDER_ID;
    let targetFolderName = folderName || "default";

    if (!folderId && folderName) {
      const resolvedFolder = await this.ensureFolderByName(folderName);
      targetFolderId = resolvedFolder.folderId || targetFolderId;
      targetFolderName = resolvedFolder.folderName || targetFolderName;
    }

    const title = this.buildTimestampedNoteTitle(titlePrefix);
    const created = await this.createAndOpenNote({
      title,
      folderId: targetFolderId,
      content,
      refreshFolderContents: false,
      refreshMainList: false,
    });
    return {
      ...created,
      folderName: targetFolderName,
    };
  },

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
  },

  cloneNoteForOversizedHandling(note) {
    if (!note) return null;
    return {
      note_id: note.note_id,
      title: note.title,
      content: note.content,
      folder_id: note.folder_id,
      last_updated: note.last_updated,
    };
  },

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
  },

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
  },

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
  },

  async loadNote(note_id, options = {}) {
    const { skipRemote = false, urlMode = "auto" } = options;
    console.log('Loading note:', note_id);

    const isSwitchingNote = this.currentNoteId && this.currentNoteId !== note_id;
    let shouldPushRoute = urlMode === "push" || (urlMode === "auto" && Boolean(isSwitchingNote));
    let shouldReplaceRoute = urlMode === "replace";
    const updateRouteIfNeeded = (noteData) => {
      if (!noteData || urlMode === "none") {
        return;
      }
      this.updateUrlForNote(noteData, { replace: shouldReplaceRoute || !shouldPushRoute });
      shouldPushRoute = false;
      shouldReplaceRoute = true;
    };

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
        updateRouteIfNeeded(cachedNote);
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
          this.updateNoteUI(note, { addToRecents: isSwitchingNote });
          updateRouteIfNeeded(note);
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
  },

  updateNoteUI(note, opts = {}) {
    const { addToRecents = true } = opts;
    this.editor.innerHTML = note.content || "";
    this.currentBlock = null;
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

    // Add to recent notes (optional)
    if (addToRecents) {
      this.addToRecentNotes(note.note_id, note.title);
    }

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
  },

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
  },

  async updateNoteCache(note_id, note) {
    try {
      const cache = await caches.open('notes-cache');
      const response = new Response(JSON.stringify(note));
      await cache.put(`note-${note_id}`, response);
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  },

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
  },

  updateRecentNotesUI() {
    // Get recent notes from localStorage
    const recentNotes = JSON.parse(localStorage.getItem('recentNotes') || '[]');
    const recentContainer = document.getElementById('recentNotes');

    if (!recentContainer) return;

    // Ensure no legacy outside-click closer remains
    if (this._boundCloseRecentDropdown) {
      try { document.removeEventListener('click', this._boundCloseRecentDropdown, true); } catch (_) {}
      this._boundCloseRecentDropdown = null;
    }

    // Preserve open/closed state across re-renders (instance + DOM attribute)
    const domOpen = recentContainer?.dataset?.ddOpen === '1';
    if (typeof this.recentDropdownOpen === 'undefined') {
      this.recentDropdownOpen = domOpen || false;
    } else if (this.recentDropdownOpen !== domOpen) {
      // Keep DOM data attribute in sync with instance flag
      recentContainer.dataset.ddOpen = this.recentDropdownOpen ? '1' : '0';
    }

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
          // Close after selecting a note from the list
          this.recentDropdownOpen = false;
          if (recentContainer) recentContainer.dataset.ddOpen = '0';
          menu.style.display = 'none';
        });
        menu.appendChild(item);
      });

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        const nextOpen = !isOpen;
        this.recentDropdownOpen = nextOpen;
        if (recentContainer) recentContainer.dataset.ddOpen = nextOpen ? '1' : '0';
        menu.style.display = nextOpen ? 'block' : 'none';
      });

      // Restore previous open state (do not auto-close on outside clicks)
      if (this.recentDropdownOpen) {
        menu.style.display = 'block';
      }

      dd.appendChild(btn);
      dd.appendChild(menu);
      recentContainer.append(dd);
    }
  },

  async createNewNote(folderId = null) {
    let title = prompt("Enter note title:");
    if (!title) return;

    title = this.sanitizeNoteTitle(title, "Untitled");

    try {
      await this.createAndOpenNote({
        title,
        folderId,
      });
    } catch (error) {
      alert("Failed to create note: " + (error?.message || "Unknown error"));
    }
  },

  idleSync() {

    let idleTime = Date.now() - this.lastInteractionTime || 0;
    console.log('idelTime ', idleTime, this.lastInteractionTime);

    if (idleTime > 30000) {
      this.saveNote();
    }
    // Update last interaction time
    this.lastInteractionTime = Date.now();

  },

  delayedSaveNote() {
    console.log('delayedSaveNote() start ');

    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      console.log('delayedSaveNote saveNote() start ');

      this.saveNote();
    }, 10000);
  },

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
        // Remote newer: update UI and cache to keep offline state fresh
        this.editor.innerHTML = currentNote.content;
        document.getElementById("noteTitle").textContent = currentNote.title;
        this.lastUpdated = currentNote.last_updated;
        //log why update this.lastupdated
        console.log('saveNote() note from the server is newer currentNote.last_updated:', currentNote.last_updated);
        this.currentNoteTitle = currentNote.title;

        try {
          await this.updateNoteCache(this.currentNoteId, currentNote);
        } catch (e) {
          console.warn('Failed to update cache after remote-newer sync', e);
        }

        // Show saved state
        spinnerIcon.style.display = "none";
        // keep the same button reference used above
        saveBtn.querySelector('.fa-save').style.display = "none";
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
          try {
            await this.updateNoteCache(this.currentNoteId, updatedNote);
          } catch (e) {
            console.warn('Failed to update cache after save', e);
          }
        }

        // Show saved state
        spinnerIcon.style.display = "none";
        saveIcon.style.display = "inline-block";
        spanText.textContent = "^";
        // keep the same button reference used above
        saveBtn.querySelector('.fa-save').style.display = "none";


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
  },

  clearNotes() {
    document.getElementById("pagesList").innerHTML = "";
    this.editor.innerHTML = "Start writing here...>";
  },

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
  },

  setupTableOfContents() {
    const tocBtn = document.getElementById('toggleTocBtn');
    const tocList = document.getElementById('tocList');

    tocBtn.addEventListener('click', () => {
      const isHidden = tocList.style.display === 'none';
      tocList.style.display = isHidden ? 'block' : 'none';
      this.updateTableOfContents();
    });
  },

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
  },

  convertToPlainText() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    // Robustly extract selection text while preserving logical line breaks
    const extractTextWithLineBreaks = (range) => {
      const frag = range.cloneContents();
      let out = '';
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          out += node.nodeValue;
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
          node.childNodes && node.childNodes.forEach(walk);
          return;
        }
        const tag = node.tagName;
        if (tag === 'BR') {
          out += '\n';
          return;
        }
        node.childNodes && node.childNodes.forEach(walk);
        if (/^(DIV|P|LI|H1|H2|H3|H4|H5|H6|PRE|BLOCKQUOTE)$/i.test(tag)) {
          if (!out.endsWith('\n')) out += '\n';
        }
      };
      walk(frag);
      return out.replace(/\n+$/, '');
    };

    const selectedText = extractTextWithLineBreaks(range);

    if (!selectedText) return;

    // Helper: build a fragment that preserves newlines using <br>
    const buildPlainFragment = (text) => {
      const frag = document.createDocumentFragment();
      const parts = text.split(/\r?\n/);
      parts.forEach((part, idx) => {
        frag.appendChild(document.createTextNode(part));
        if (idx < parts.length - 1) {
          frag.appendChild(document.createElement('br'));
        }
      });
      return frag;
    };

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
      // Preserve line breaks inside the plain block
      plainDiv.appendChild(buildPlainFragment(tempSpan.textContent));
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

    // Otherwise, not inside a heading: replace the temp span with a fragment that preserves newlines
    const frag = buildPlainFragment(tempSpan.textContent);
    const parent = tempSpan.parentNode;
    parent.insertBefore(frag, tempSpan);
    // After inserting a fragment, the node just before tempSpan is the last inserted node
    const lastInserted = tempSpan.previousSibling;
    parent.removeChild(tempSpan);

    // Place caret after the inserted plain text
    const afterRange = document.createRange();
    // Place caret right after the last inserted node
    afterRange.setStartAfter(lastInserted);
    afterRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(afterRange);
  },
};

export default mixin;
