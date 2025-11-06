import currentUser, { setCurrentUser, clearCurrentUser } from '../../state/currentUser.js';

const mixin = {
  async register(userId, password, email) {
    const passwordHash = CryptoJS.SHA256(password).toString();
    const result = await this.apiRequest("POST", "/users", {
      user_id: userId,
      password_hash: passwordHash,
      email,
    });

    if (result.success) {
      setCurrentUser({ userId, credentials: passwordHash });
      try {
        localStorage.setItem("passwordHash", passwordHash);
      } catch {
        // Ignore storage errors (e.g., disabled cookies)
      }
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  },

  async login(userId, password) {
    const passwordHash = btoa(password);
    const result = await this.apiRequest("GET", "/notes"); // Test auth with notes endpoint

    if (!result.error) {
      setCurrentUser({ userId, credentials: passwordHash });
      try {
        localStorage.setItem("passwordHash", passwordHash);
      } catch {
        // Ignore storage errors
      }
      this.updateAuthUI();
      await this.loadNotes();
      return true;
    }
    return false;
  },

  logout() {
    clearCurrentUser();
    try {
      localStorage.removeItem("passwordHash");
    } catch {
      // Ignore storage errors
    }
    this.updateAuthUI();
    this.clearNotes();
  },

  updateAuthUI() {
    const isLoggedIn = currentUser.userId && currentUser.credentials;
    if (!isLoggedIn) {
      //ask user to confirm login yes to login, no do nothin
      let confirmLogin = confirm('Do you want to login?');
      if (confirmLogin) {

        window.location.href = "auth.html";

      }
    }
  },

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
  },
};

export default mixin;
