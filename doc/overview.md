# Project Overview

A lightweight, browser-based notes editor with AI-assisted tooling. The app is a pure front‑end (HTML/CSS/JS) PWA: it runs from static files, warms a runtime cache for offline use, and talks to a simple REST API for folders, notes, and media.

## Project Structure

Top-level
- `index.html` — Main editor UI and modals.
- `auth.html` — Login/Register page.
- `styles.css` — Global, minimal styles for a clean modern UI.
- `service-worker.js` — PWA service worker and caching logic.
- `manifest.json` — PWA manifest.
- `icons/` — App icons.
- `README.md` — End-user guide and feature tour.
- `doc/` — Internal docs: overview, TODOs, and history.
- `demo/audiochat/` — Small demo for audio chat worker.

Source (`src/`)
- `src/main.js` — App bootstrap: editor init, cache warming, global listeners.
  - Controls global in‑app modals (login, update) via `window.showLoginPrompt()` and `window.showUpdatePrompt()`.
- `src/config.js` — Configuration constants (API endpoints, cache name, proxy URL).
- `src/utils/index.js` — Small utility helpers used across modules.
- `src/state/` — Simple “model” layer for runtime state.
  - `currentUser.js` — Current user id/credentials helpers.
  - `globalDevices.js` — Media device/stream handling (start/stop tracks, cleanup).
- `src/pages/`
  - `auth.js` — Script for `auth.html` (login/register flows).
- `src/editor/HTMLEditor/` — Editor “controller + view logic” modules.
  - `index.js` — Editor class entry; wires submodules and UI.
  - `core.js` — Core UI behaviors, selection, toolbar wiring, spinners, copy button.
  - `constants.js` — Shared constants used by editor modules.
  - `ai.js` — AI tools orchestration and streaming handling.
  - `api.js` — Fetch wrappers to the backend API (folders, notes, files).
  - `auth.js` — Editor-level auth helpers (logout, etc.).
  - `blocks.js` — Block-level editing helpers.
  - `comments.js` — Comment add/edit/remove logic.
  - `files.js` / `media.js` — File upload, media preview and capture.
  - `folders.js` — Folder tree UI and CRUD handlers.
  - `history.js` — Simple change history.
  - `notes.js` — Note list and editor wiring.

## Conventions
- Use modules under `src/editor/HTMLEditor/` for UI behavior; avoid inline `<script>` logic.
- Treat `src/state` + `src/editor/HTMLEditor/api.js` as the “model” boundary. UI should call through these abstractions.
- Keep UI minimal and consistent with `styles.css`. Prefer small, focused CSS over large frameworks.
- When adding static files that must be available offline, update both `src/main.js` `CORE_CACHE_ITEMS` and the service worker if needed.

## Run/Develop
- Serve the directory with any static server or open `auth.html` / `index.html` directly in a modern browser.
- Configure API endpoints in `src/config.js` when pointing to different backends.

## Common Mistakes
- Using native `alert/confirm/prompt` for core flows (login, update). Prefer in‑app modals for a non‑blocking, consistent UX.
- Forcing automatic reload after an update. Prompt the user to reload instead and only act on explicit confirmation.
- Duplicate element IDs in HTML cause event/selector conflicts. Prefer classes or unique IDs per page.
- Bypassing `src/editor/HTMLEditor/api.js` and calling `fetch` directly leads to inconsistent error handling. Route network calls through the API helpers.
- Forgetting to refresh UI after mutations. For example, call `loadFolders()` after folder CRUD, and re-render note lists after note changes.
- Adding new static files without updating the warm cache list (`CORE_CACHE_ITEMS`) breaks offline behavior.
- Mixing inline styles/scripts with module code. Keep behavior in JS modules and styles in `styles.css`.
- Blocking the UI during long AI operations without using the spinner/toolbar state handlers from `core.js`.
- Leaking media streams. Always call `stopMediaTracks` (wired in `src/main.js`) when leaving the page or hiding media.
- Inconsistent localStorage keys (e.g., AI model preferences). Reuse existing keys and patterns (`aiModelPreferences`, etc.).
- Changing CSS used by dynamic components (dropdowns, toolbar) without checking class hooks expected by JS.
- Hardcoding endpoints in modules. Always import from `src/config.js`.
 - Collapsing newlines when converting selection to plain text. Use newline-preserving fragments (`<br>` between lines) instead of a single text node. See `convertToPlainText()` in `src/editor/HTMLEditor/notes.js`.
 - Replacing selections with `innerHTML` strings. Prefer `textContent` to strip formatting safely, then explicitly add structural nodes (e.g., `<br>`) as needed.
 - Losing caret position after DOM surgery. After inserts/replacements, programmatically place the selection at a sensible position using `Range` and `Selection` APIs.
 - Attaching duplicate event listeners on re-init. Remove or de-dupe listeners when re-rendering toolbars or switching views.
- Invoking `document.execCommand('removeFormat')` outside a selection. Ensure the intended content is selected first; this API is legacy and should be used carefully.
 - Wrapping selections with strings. Avoid `innerHTML = selectedText`; use `Range.cloneContents()` and `appendChild(fragment)` to preserve formatting safely.
 - Not checking selection containment. Before DOM surgery, verify the selection lives under the editor container to prevent exceptions or misplaced inserts.
 - Inconsistent hit targets in the toolbar. Keep interactive buttons at least ~32px tall/wide for usability; use targeted selectors (e.g., `#addBlockBtn`) rather than broad rules that affect all buttons.
- Overriding CSS hooks used by JS. Do not remove or rename classes/IDs (like `.block`, `.dropdown`, `#addBlockBtn`) that scripts depend on; instead, extend styles with additive rules.
 - Adding UI without keyboard and dismissal affordances. Provide close buttons and backdrop click to dismiss modals when appropriate.
 - Not exposing small interop hooks when needed. When a module needs to trigger an app‑level UI (e.g., auth prompt), expose a minimal global function instead of sprinkling DOM logic throughout modules.
