const DEFAULT_FOLDER_ID = "1733485657799jj0.5911120915160637";

const mixin = {
  showNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    const input = document.getElementById("newFolderInput");
    inputContainer.style.display = "flex";
    input.value = "";
    input.focus();
  },

  hideNewFolderInput() {
    const inputContainer = document.querySelector(".folder-input-container");
    inputContainer.style.display = "none";
  },

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
  },

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
      });

      folders.forEach((folder) => {
        if (folder.parent_folder_id) {
          const parent = folderMap.get(folder.parent_folder_id);
          if (parent) {
            parent.children.push(folder);
            return;
          }
        }
        rootFolders.push(folder);
      });

      // Recursive function to render folder hierarchy
      const renderFolder = (folder, level = 0) => {
        const folderElement = document.createElement("div");
        folderElement.className = "folder-item";
        folderElement.setAttribute("data-folder-id", folder.folder_id);
        folderElement.style.paddingLeft = `${level * 20}px`;
        const isDefaultFolder = folder.folder_id === DEFAULT_FOLDER_ID;
        folderElement.innerHTML = `
                    <div class="folder-content">
                        <i class="fas fa-folder"></i>
                        <span>${folder.folder_name}</span>
                        <div class="folder-count">&nbsp;</div>
                    </div>
                    <div class="folder-actions">
                        <button class="add-note-btn" title="Add note to folder">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="delete-folder-btn" title="Delete folder" ${isDefaultFolder ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
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

        const deleteBtn = folderElement.querySelector('.delete-folder-btn');
        if (deleteBtn) {
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteFolder(folder);
          };
        }

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
  },

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
  },

  async showFolderUIAtBottom(folderId, folderName = 'Folder') {
    const pagesList = document.getElementById("pagesList");
    if (!pagesList || !folderId) {
      return false;
    }

    pagesList.innerHTML = '<div class="search-status loading">Loading folder contents...</div>';

    try {
      const [notes, folders] = await Promise.all([
        this.apiRequest("GET", `/folders/${folderId}/notes`),
        this.apiRequest("GET", `/folders/${folderId}/contents`)
      ]);

      pagesList.innerHTML = "";

      const header = document.createElement("div");
      header.className = "search-section-title";
      header.textContent = `Folder: ${folderName}`;
      pagesList.appendChild(header);

      const noteList = Array.isArray(notes) ? notes : [];
      const folderList = Array.isArray(folders) ? folders : [];

      if (!noteList.length && !folderList.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "search-empty";
        emptyState.textContent = "This folder is empty.";
        pagesList.appendChild(emptyState);
        return true;
      }

      this.renderFolderContents(noteList, folderList, pagesList);
      return true;
    } catch (error) {
      console.error('Error loading folder UI at bottom:', error);
      pagesList.innerHTML = '<div class="search-status">Unable to load folder contents.</div>';
      return false;
    }
  },

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
        subFolderElement.setAttribute("data-folder-id", folder.folder_id);
        const isDefaultFolder = folder.folder_id === DEFAULT_FOLDER_ID;
        subFolderElement.innerHTML = `
          <div class="folder-content">
            <i class="fas fa-folder"></i>
            <span>${folder.folder_name}</span>
          </div>
          <div class="folder-actions">
            <button class="add-note-btn" title="Add note to folder">
              <i class="fas fa-plus"></i>
            </button>
            <button class="delete-folder-btn" title="Delete folder" ${isDefaultFolder ? 'disabled' : ''}>
              <i class="fas fa-trash"></i>
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

        const deleteBtn = subFolderElement.querySelector('.delete-folder-btn');
        if (deleteBtn) {
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.deleteFolder(folder);
          };
        }

        container.appendChild(subFolderElement);
      });
    }
  },

  async deleteFolder(folder) {
    if (!folder || !folder.folder_id) {
      return;
    }
    if (folder.folder_id === DEFAULT_FOLDER_ID) {
      this.showToast('The default folder cannot be deleted.', 'error');
      return;
    }

    const folderName = folder.folder_name || 'this folder';
    const confirmDelete = confirm(`Delete "${folderName}" and all notes inside it? This cannot be undone.`);
    if (!confirmDelete) {
      return;
    }

    try {
      const encodedId = encodeURIComponent(folder.folder_id);
      const response = await this.apiRequest('DELETE', `/folders/${encodedId}`, null, false, true);
      if (response?.success) {
        if ('caches' in window) {
          try {
            await caches.delete('folders-cache');
            await caches.delete('notes-cache');
          } catch (cacheError) {
            console.warn('Unable to clear folder caches:', cacheError);
          }
        }
        this.showToast(`Deleted "${folderName}".`, 'success');
        await this.loadFolders();
        await this.loadNotes();
      } else {
        this.showToast(response?.error || 'Failed to delete folder.', 'error');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      this.showToast('Failed to delete folder.', 'error');
    }
  },
};

export default mixin;
