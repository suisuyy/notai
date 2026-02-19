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
          "https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.js",
          "https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/codemirror.min.css",
          "https://cdn.jsdelivr.net/npm/prettier@2.3.2/standalone.js",
          "https://cdn.jsdelivr.net/npm/prettier@2.3.2/parser-html.js",
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
  const imageZoomBtn = document.getElementById("imageZoomBtn");
  const imageViewerOverlay = document.getElementById("imageViewerOverlay");
  const closeImageViewerBtn = document.getElementById("closeImageViewerBtn");
  const imageViewerImage = document.getElementById("imageViewerImage");
  const imageZoomOutBtn = document.getElementById("imageZoomOutBtn");
  const imageZoomInBtn = document.getElementById("imageZoomInBtn");
  const imageViewerInfo = document.getElementById("imageViewerInfo");

  const imageMetadataCache = new Map();
  let selectedImageElement = null;
  let imageViewerScale = 1;
  let viewerInfoRequestId = 0;

  const formatFileSize = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "-";
    }
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const inferTypeFromSrc = (src) => {
    if (!src) return "-";
    if (src.startsWith("data:")) {
      const mimeType = src.slice(5).split(";")[0].trim();
      return mimeType || "-";
    }
    try {
      const parsed = new URL(src, window.location.href);
      const extension = parsed.pathname.split(".").pop()?.toLowerCase() || "";
      const extensionToMime = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",
        avif: "image/avif",
      };
      return extensionToMime[extension] || "-";
    } catch {
      return "-";
    }
  };

  const getDataUrlSize = (src) => {
    const commaIndex = src.indexOf(",");
    if (commaIndex === -1) return null;
    const payload = src.slice(commaIndex + 1);
    const isBase64 = src.slice(0, commaIndex).includes(";base64");
    if (!isBase64) {
      try {
        return new TextEncoder().encode(decodeURIComponent(payload)).length;
      } catch {
        return new TextEncoder().encode(payload).length;
      }
    }
    const padding = (payload.match(/=*$/)?.[0].length ?? 0);
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  };

  const getImageFileMetadata = async (imageElement) => {
    const src = imageElement.currentSrc || imageElement.getAttribute("src") || "";
    const resolution = `${imageElement.naturalWidth || "-"} x ${imageElement.naturalHeight || "-"}`;
    if (!src) {
      return { resolution, sizeText: "-", typeText: "-" };
    }

    const cached = imageMetadataCache.get(src);
    if (cached) {
      return {
        resolution,
        sizeText: cached.sizeText,
        typeText: cached.typeText,
      };
    }

    let sizeBytes = null;
    let typeText = inferTypeFromSrc(src);

    if (src.startsWith("data:")) {
      sizeBytes = getDataUrlSize(src);
    }

    if (sizeBytes == null) {
      const perfEntries = performance.getEntriesByName(src);
      const perfEntry = perfEntries[perfEntries.length - 1];
      if (perfEntry && typeof perfEntry.decodedBodySize === "number" && perfEntry.decodedBodySize > 0) {
        sizeBytes = perfEntry.decodedBodySize;
      }
    }

    let isFetchableSrc = src.startsWith("blob:");
    if (!isFetchableSrc) {
      try {
        const parsedUrl = new URL(src, window.location.href);
        isFetchableSrc = parsedUrl.origin === window.location.origin;
      } catch {
        isFetchableSrc = false;
      }
    }

    if ((sizeBytes == null || typeText === "-") && isFetchableSrc) {
      try {
        const response = await fetch(src);
        if (response.ok) {
          const blob = await response.blob();
          if (sizeBytes == null && Number.isFinite(blob.size)) {
            sizeBytes = blob.size;
          }
          if (typeText === "-" && blob.type) {
            typeText = blob.type;
          }
        }
      } catch {
        // Best effort only; keep fallback metadata if fetching is blocked.
      }
    }

    const resolved = {
      sizeText: formatFileSize(sizeBytes),
      typeText: typeText || "-",
    };
    imageMetadataCache.set(src, resolved);
    return {
      resolution,
      ...resolved,
    };
  };

  const positionImageZoomButton = () => {
    if (
      !imageZoomBtn ||
      imageZoomBtn.classList.contains("hidden") ||
      !(selectedImageElement instanceof HTMLImageElement) ||
      !selectedImageElement.isConnected
    ) {
      return;
    }
    const rect = selectedImageElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      imageZoomBtn.classList.add("hidden");
      return;
    }
    const buttonSize = 34;
    const margin = 8;
    const top = Math.max(margin, rect.top + margin);
    const left = Math.min(
      window.innerWidth - buttonSize - margin,
      Math.max(margin, rect.right - buttonSize - margin),
    );
    imageZoomBtn.style.top = `${top}px`;
    imageZoomBtn.style.left = `${left}px`;
  };

  const showImageZoomButton = (imageElement) => {
    if (!(imageElement instanceof HTMLImageElement) || !imageZoomBtn) {
      return;
    }
    selectedImageElement = imageElement;
    imageZoomBtn.classList.remove("hidden");
    positionImageZoomButton();
  };

  const hideImageZoomButton = () => {
    imageZoomBtn?.classList.add("hidden");
    selectedImageElement = null;
  };

  const applyImageViewerScale = () => {
    if (!imageViewerImage) return;
    imageViewerScale = Math.min(5, Math.max(0.25, imageViewerScale));
    imageViewerImage.style.transform = `scale(${imageViewerScale})`;
  };

  const setImageViewerInfo = async (imageElement) => {
    if (!imageViewerInfo) return;
    viewerInfoRequestId += 1;
    const requestId = viewerInfoRequestId;
    imageViewerInfo.textContent = "Resolution: - | Size: - | Type: -";
    const metadata = await getImageFileMetadata(imageElement);
    if (requestId !== viewerInfoRequestId) return;
    imageViewerInfo.textContent = `Resolution: ${metadata.resolution} | Size: ${metadata.sizeText} | Type: ${metadata.typeText}`;
  };

  const openImageViewer = (imageElement) => {
    if (
      !(imageElement instanceof HTMLImageElement) ||
      !imageViewerOverlay ||
      !imageViewerImage
    ) {
      return;
    }
    const src = imageElement.currentSrc || imageElement.getAttribute("src") || "";
    if (!src) return;

    imageViewerScale = 1;
    imageViewerImage.src = src;
    applyImageViewerScale();
    imageViewerOverlay.classList.remove("hidden");
    midiaURLContainer?.classList.add("hidden");
    imageZoomBtn?.classList.add("hidden");
    setImageViewerInfo(imageElement);
  };

  const closeImageViewer = () => {
    imageViewerOverlay?.classList.add("hidden");
    if (imageViewerImage) {
      imageViewerImage.src = "";
      imageViewerImage.style.transform = "";
    }
  };

  imageZoomBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectedImageElement) {
      openImageViewer(selectedImageElement);
    }
  });

  closeImageViewerBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeImageViewer();
  });

  imageZoomInBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    imageViewerScale += 0.2;
    applyImageViewerScale();
  });

  imageZoomOutBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    imageViewerScale -= 0.2;
    applyImageViewerScale();
  });

  imageViewerOverlay?.addEventListener("click", (event) => {
    if (event.target === imageViewerOverlay) {
      closeImageViewer();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && imageViewerOverlay && !imageViewerOverlay.classList.contains("hidden")) {
      closeImageViewer();
    }
  });

  window.addEventListener("scroll", positionImageZoomButton, true);
  window.addEventListener("resize", positionImageZoomButton);

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (imageViewerOverlay?.contains(target)) {
      return;
    }

    if (target.closest("#imageZoomBtn")) {
      event.preventDefault();
      if (selectedImageElement) {
        openImageViewer(selectedImageElement);
      }
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

      if (target.tagName === "IMG") {
        showImageZoomButton(target);
      } else {
        hideImageZoomButton();
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
    hideImageZoomButton();
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
