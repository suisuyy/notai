# history

- 2025-11-06T16:50:09Z — by codex/gpt5
  - Improve the topbar Block button visibility and behavior. Increased `#addBlockBtn` size for better prominence and hit area. When the user selects text and clicks Block, the selection is wrapped into a new `.block` preserving formatting via `Range.cloneContents()`. Fallback still inserts an empty block when no selection.

- 2025-11-06T16:34:15Z — by codex/gpt5
  - Improve plain text formatting: preserve newlines in selection when stripping formatting. Updated `convertToPlainText()` to insert `<br>` between lines and keep caret position stable. Also enhanced docs with common pitfalls.

- 2025-11-06T16:22:26Z — by codex/cli (model: gpt-5 high)
  - this is first task, explore the whole project, init overview.md
