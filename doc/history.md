# history

- 2025-11-07T00:56:30Z — by codex/gpt5
  - Replace native confirms with in‑app UI for login and update prompts. Added `#loginPromptModal` and `#updatePromptModal` in `index.html:`, wired handlers in `src/main.js`, and exposed `window.showLoginPrompt()` / `window.showUpdatePrompt()` for modules.
  - Updated `src/editor/HTMLEditor/auth.js` to show the login modal instead of `confirm()`. Updated the update flow in `src/main.js` to prompt for reload without auto‑reloading.
  - Added compact modal styles and minimal button styles in `styles.css` for a clean, modern look.
  - Enhanced docs: expanded Common Mistakes and noted app‑level modal control under project structure.
  - Moved from TODO: "when user login out or update app, it will prompt user to login use system confirm or prompt user reload now, the system prompt and login is not good, implement them in the UI now to replace them"

- 2025-11-06T16:50:09Z — by codex/gpt5
  - Improve the topbar Block button visibility and behavior. Increased `#addBlockBtn` size for better prominence and hit area. When the user selects text and clicks Block, the selection is wrapped into a new `.block` preserving formatting via `Range.cloneContents()`. Fallback still inserts an empty block when no selection.

- 2025-11-06T16:34:15Z — by codex/gpt5
  - Improve plain text formatting: preserve newlines in selection when stripping formatting. Updated `convertToPlainText()` to insert `<br>` between lines and keep caret position stable. Also enhanced docs with common pitfalls.

- 2025-11-06T16:22:26Z — by codex/cli (model: gpt-5 high)
  - this is first task, explore the whole project, init overview.md
