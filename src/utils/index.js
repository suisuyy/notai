const utils = {
  getCurrentTimeString() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  },

  underlineSelectedText() {
    if (!window.getSelection) {
      return null;
    }

    const selection = window.getSelection();

    if (!selection.rangeCount || selection.isCollapsed) {
      alert("Please select some text first.");
      return null;
    }

    const range = selection.getRangeAt(0);
    if (range.startContainer.parentNode?.nodeName === "U") {
      return null;
    }

    const uElement = document.createElement("u");
    uElement.id = `u${Date.now()}`;
    const spaceText = document.createTextNode("\u00A0\u00A0");

    try {
      range.surroundContents(uElement);
      uElement.after(spaceText);
      return uElement;
    } catch (error) {
      console.error("Cannot wrap selection that crosses multiple nodes:", error);
      alert(
        "Cannot underline text that spans across different elements or already includes formatting. Try selecting text within a single paragraph.",
      );
      return null;
    }
  },

  insertTextAtCursor(insertedText, removeSelectionDelay = 1000) {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    if (activeElement.isContentEditable) {
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      selection.deleteFromDocument();
      const range = selection.getRangeAt(0);
      const lines = insertedText.split("\n");

      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        if (i < lines.length - 1) {
          range.insertNode(document.createElement("br"));
        }
        range.insertNode(document.createTextNode(`${line} `));
      }

      selection.removeAllRanges();
      selection.addRange(range);
      setTimeout(() => {
        selection.removeAllRanges();
        range.collapse(false);
        selection.addRange(range);
      }, removeSelectionDelay);
      return true;
    }

    if (
      activeElement.tagName === "TEXTAREA" ||
      activeElement.tagName === "INPUT"
    ) {
      const startPos = activeElement.selectionStart;
      const endPos = activeElement.selectionEnd;
      const beforeText = activeElement.value.substring(0, startPos);
      const afterText = activeElement.value.substring(endPos);
      activeElement.value = beforeText + insertedText + afterText;

      const cursorPosition = startPos + insertedText.length;
      activeElement.setSelectionRange(cursorPosition, cursorPosition);
      activeElement.focus();
      return true;
    }

    console.warn("The active element is neither contenteditable nor a textarea/input.");
    return false;
  },

  base64ToBlob(base64String) {
    let mimeType;
    let base64Data;

    if (base64String.startsWith("data:")) {
      const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error("Invalid data URL format");
      }
      [, mimeType, base64Data] = matches;
    } else {
      base64Data = base64String;
      mimeType = utils.detectMimeTypeFromBase64(base64Data);
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
  },

  detectMimeTypeFromBase64(base64String) {
    const sample = atob(base64String.substring(0, 24));
    const bytes = new Uint8Array(sample.length);
    for (let i = 0; i < sample.length; i += 1) {
      bytes[i] = sample.charCodeAt(i);
    }

    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      return "image/png";
    }

    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return "image/jpeg";
    }

    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return "image/gif";
    }

    if (
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46
    ) {
      return "application/pdf";
    }

    if (
      (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && bytes[1] === 0xfb)
    ) {
      return "audio/mpeg";
    }

    if (
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return "video/mp4";
    }

    if (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    ) {
      return "video/webm";
    }

    if (
      bytes[0] === 0x4f &&
      bytes[1] === 0x67 &&
      bytes[2] === 0x67 &&
      bytes[3] === 0x53
    ) {
      return "audio/ogg";
    }

    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return "image/webp";
    }

    return "application/octet-stream";
  },
};

export const {
  getCurrentTimeString,
  underlineSelectedText,
  insertTextAtCursor,
  base64ToBlob,
  detectMimeTypeFromBase64,
} = utils;

export default utils;

