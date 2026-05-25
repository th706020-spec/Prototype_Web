# AIs plan

## Summary
Single-page AIs experience with chat, plagiarism, references, and upload tools consolidated into `index.html`. The landing cards now open full-page modal overlays per tool (one tool visible at a time), while shared CSS/JS utilities power UI, dropdowns, and API placeholders.

## Work log
- 2026-05-24: Consolidated all tool UIs into `index.html` with in-page anchors and removed the separate feature HTML files.
- 2026-05-24: Added section navigation so only one tool is visible at a time, toggling the chat layout and navbar behavior accordingly.
- 2026-05-24: Replaced section navigation with modal overlays so each tool opens as a full-page popup above the menu.
- 2026-05-24: Converted tool cards to modal launchers and wrapped each tool inside a full-screen overlay with close controls.
- 2026-05-24: Made all tool modals full-screen like chat, restored card outlines, and added modal open animations.
