import HTMLEditor from "./editor/HTMLEditor/index.js";
import currentUser from "./state/currentUser.js";
import { DEFAULT_CACHE_NAME } from "./config.js";

const CORE_CACHE_ITEMS = [
  "./",
  "./index.html",
  "./auth.html",
  "./styles.css",
  "./src/config.js",
  "./src/main.js",
  "./src/editor/HTMLEditor/constants.js",
  "./src/editor/HTMLEditor/index.js",
  "./src/editor/HTMLEditor/core.js",
  "./src/editor/HTMLEditor/ai.js",
  "./src/editor/HTMLEditor/comments.js",
  "./src/editor/HTMLEditor/blocks.js",
  "./src/editor/HTMLEditor/auth.js",
  "./src/editor/HTMLEditor/folders.js",
  "./src/editor/HTMLEditor/notes.js",
  "./src/editor/HTMLEditor/files.js",
  "./src/editor/HTMLEditor/media.js",
  "./src/editor/HTMLEditor/history.js",
  "./src/editor/HTMLEditor/api.js",
  "./src/state/currentUser.js",
  "./src/state/globalDevices.js",
  "./src/utils/index.js",
  "./src/pages/auth.js",
  "./icons/notai-192x192.png",
  "./icons/notai-512x512.png",
];

const stopMediaTracksIfPossible = () => {
  const instance = window.editor;
  if (instance && typeof instance.stopMediaTracks === "function") {
    instance.stopMediaTracks();
  }
};

const warmRuntimeCache = () => {
  if (!("caches" in window)) {
    return;
  }

  setTimeout(() => {
    caches
      .open(DEFAULT_CACHE_NAME)
      .then((cache) => cache.addAll(CORE_CACHE_ITEMS))
      .then(() => {
        console.log("App cache updated");
        return caches.open(DEFAULT_CACHE_NAME);
      })
      .then((cache) =>
        cache.addAll([
          "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
          "https://corsp.suisuy.eu.org?https://cdn.jsdelivr.net/npm/marked/marked.min.js",
        ]),
      )
      .catch((error) => {
        console.warn("Failed to warm cache", error);
      });
  }, 5000);
};

window.addEventListener("blur", stopMediaTracksIfPossible, { once: true });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopMediaTracksIfPossible();
  }
});

window.addEventListener("load", warmRuntimeCache);

document.addEventListener("DOMContentLoaded", async () => {
  // In-app UI modals: login prompt and update prompt (set up early)
  const loginPromptModal = document.getElementById("loginPromptModal");
  const loginPromptLoginBtn = document.getElementById("loginPromptLoginBtn");
  const loginPromptDismissBtn = document.getElementById("loginPromptDismissBtn");
  const updatePromptModal = document.getElementById("updatePromptModal");
  const updatePromptReloadBtn = document.getElementById("updatePromptReloadBtn");
  const updatePromptLaterBtn = document.getElementById("updatePromptLaterBtn");

  const openModal = (el) => { if (el) el.style.display = "block"; };
  const closeModal = (el) => { if (el) el.style.display = "none"; };

  // Expose helpers for other modules
  window.showLoginPrompt = () => openModal(loginPromptModal);
  window.showUpdatePrompt = () => openModal(updatePromptModal);

  loginPromptLoginBtn?.addEventListener("click", () => {
    closeModal(loginPromptModal);
    window.location.href = "auth.html";
  });
  loginPromptDismissBtn?.addEventListener("click", () => closeModal(loginPromptModal));
  loginPromptModal?.addEventListener("click", (e) => {
    if (e.target === loginPromptModal || (e.target instanceof HTMLElement && e.target.hasAttribute("data-close-login"))) {
      closeModal(loginPromptModal);
    }
  });

  updatePromptReloadBtn?.addEventListener("click", () => {
    closeModal(updatePromptModal);
    window.location.reload();
  });
  updatePromptLaterBtn?.addEventListener("click", () => closeModal(updatePromptModal));
  updatePromptModal?.addEventListener("click", (e) => {
    if (e.target === updatePromptModal || (e.target instanceof HTMLElement && e.target.hasAttribute("data-close-update"))) {
      closeModal(updatePromptModal);
    }
  });

  let editorInstance;
  try {
    editorInstance = new HTMLEditor();
    window.editor = editorInstance;
    await editorInstance.loadFolders();

    const profileModal = document.getElementById("profileModal");
    const userProfileBtn = document.getElementById("userProfileBtn");
    const closeProfileBtn =
      profileModal?.querySelector(".close, .close-profile-btn");
    const currentUserIdSpan = document.getElementById("currentUserId");

    userProfileBtn?.addEventListener("click", () => {
      if (!currentUserIdSpan) return;
      currentUserIdSpan.textContent = currentUser.userId || "Unknown";
      if (profileModal) profileModal.style.display = "block";
    });

    closeProfileBtn?.addEventListener("click", () => {
      if (profileModal) profileModal.style.display = "none";
    });
  } catch (error) {
    console.error("Error initializing editor:", error);
  }

  const midiaURLContainer = document.getElementById("midiaURLContainer");
  const imgDisplay = document.getElementById("imgDisplay");

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (
      target.tagName === "IMG" ||
      target.tagName === "VIDEO" ||
      target.tagName === "AUDIO"
    ) {
      event.preventDefault();
      document.activeElement?.blur();
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      if (midiaURLContainer) {
        let url = target.getAttribute("src") ?? "";
        if (url.length > 200) {
          url = `${url.substring(0, 200)}...${url.slice(-10)}`;
        }
        midiaURLContainer.innerText = url;
        midiaURLContainer.classList.remove("hidden");
      }

      if (target.tagName === "IMG" && imgDisplay) {
        imgDisplay.src = target.getAttribute("src") ?? "";
        imgDisplay.classList.remove("hidden");
      }
      return;
    }

    if (target.id === "midiaURLContainer" && midiaURLContainer) {
      navigator.clipboard
        .writeText(midiaURLContainer.innerText)
        .then(() => {
          window.editor?.showToast?.("Copied to clipboard", "success");
          midiaURLContainer.classList.add("hidden");
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
          window.editor?.showToast?.("Failed to copy", "error");
        });
      return;
    }

    midiaURLContainer?.classList.add("hidden");
    imgDisplay?.classList.add("hidden");
  });

  let setEditableTimeoutID = 0;
  document.body.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    let blockElem = target;
    while (blockElem && blockElem !== document.body) {
      if (blockElem.classList?.contains("block")) {
        if (!blockElem.isContentEditable) {
          window.editor?.editor?.setAttribute("contenteditable", "false");
          clearTimeout(setEditableTimeoutID);
          setEditableTimeoutID = window.setTimeout(() => {
            window.editor?.editor?.setAttribute("contenteditable", "true");
          }, 500);
          break;
        }
      }
      blockElem = blockElem.parentElement;
    }
  });

  const topbarPinBtn = document.getElementById("topbarPinBtn");
  topbarPinBtn?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const currentBlock = range.startContainer.parentElement?.closest(".block");
    if (!currentBlock) return;

    if (currentBlock.classList.contains("pinned")) {
      currentBlock.classList.remove("pinned");
      window.setTimeout(() => {
        currentBlock.scrollIntoView({ behavior: "smooth", block: "start" });
        currentBlock.classList.add("highlight");
        window.setTimeout(() => {
          currentBlock.classList.remove("highlight");
        }, 1000);
      }, 200);
      return;
    }

    document.querySelectorAll(".pinned").forEach((element) => {
      element.classList.remove("pinned");
    });
    currentBlock.classList.add("pinned");
  });

  window.addEventListener("pointerup", () => {
    const selectionText = window.getSelection()?.toString() ?? "";
    console.log("current selection:", selectionText);
    if (selectionText.length > 0) {
      window.selectionText = selectionText;
    }
  });

  const updateAppBtn = document.querySelector("#updateAppBtn");
  updateAppBtn?.addEventListener("click", () => {
    caches
      .delete(DEFAULT_CACHE_NAME)
      .then(() => navigator.serviceWorker.getRegistrations())
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .then(() => {
        // Prompt the user in-app to reload once update is ready
        window.setTimeout(() => window.showUpdatePrompt?.(), 300);
      })
      .catch((err) => {
        console.warn("Update flow failed", err);
        window.editor?.showToast?.("Update failed. Try again.", "error");
      });
  });
});
