# AIs plan

## Purpose
Planning and progress notes for the AIs feature area. Update this file after changes in `pages\AIs`.

## Current scope
- AI chat
- Plagiarism check
- Reference generator (IEEE + APA) via DOI/URL + user input
- File upload + read (PDF/DOCX/TXT) with cloud upload placeholders

## Summary
Built the AIs mini-app with a landing page and four feature pages (chat, plagiarism, references, upload). Added shared styling and JS utilities, then iterated on UI polish: ChatGPT-style full-screen chat with sidebar and dark/light toggle, animated custom selects, input toggles, hidden result panels until actions, and UX tweaks across buttons and layouts.

## Work log
- 2026-05-20: Added AI Tools landing page, feature pages (chat, plagiarism, references, upload), shared styles, and client-side logic with configurable API placeholders.
- 2026-05-20: Polished UI with ChatGPT-style chat layout, dropdown input selectors for plagiarism/references/upload, and styled text/file inputs with fixed-height scrollable text areas.
- 2026-05-20: Fixed dropdown visibility with focus-within fallback and added null guards in ui helpers.
- 2026-05-20: Fixed dropdown option clicks by handling text-node targets in the dropdown click handler.
- 2026-05-20: Replaced custom dropdowns with native selects for input type switching (plagiarism, references, upload) and wired change handlers to show/hide sections.
- 2026-05-20: Added inline non-module scripts in the HTML pages to toggle input sections even if module scripts fail to load.
- 2026-05-20: Updated chat styling to feel like a modern messenger UI and added animated transitions for input-type section toggles/select focus.
- 2026-05-20: Rebuilt chat layout to full-screen with collapsible sidebar, chat history list, and new chat control.
- 2026-05-20: Added empty-state handling when the first message is sent so the placeholder clears.
- 2026-05-20: Switched to animated custom select menus, added inline sidebar toggle, and refreshed chat input to a bottom bar with auto-resizing text.
- 2026-05-20: Removed chat footer, hid conversation header, pinned the input bar to the bottom, and added navbar auto-hide with a dark/light toggle on the chat page.
- 2026-05-20: Disabled global footer injection, refined dark-mode colors for chat, simplified the composer styling, and fixed nav hide spacing with a body class toggle.
- 2026-05-21: Removed footer placeholders in AIs pages, fixed chat auto-hide spacing, simplified the composer to just the input bar, and improved dark-mode readability.
- 2026-05-21: Normalized sidebar and collapse button colors in light/dark mode and aligned send/clear buttons with the chat input.
- 2026-05-21: Adjusted send/clear button alignment to bottom-align with the input and fixed dark-mode sidebar text color.
- 2026-05-21: Switched the chat input row to a grid layout so the send/clear buttons align with the textarea edge.
- 2026-05-21: Nudged send/clear buttons upward by centering in the grid row with a slight translate to avoid corner alignment.
- 2026-05-21: Fine-tuned send/clear button alignment by matching heights and reducing the vertical offset.
- 2026-05-21: Shifted send/clear button offset downward slightly to align both buttons at the same height.
- 2026-05-21: Applied a dedicated offset to the clear button to bring it up to the send button alignment.
- 2026-05-21: Standardized send/clear button sizing with fixed height, padding, and line-height to eliminate border-driven misalignment.
- 2026-05-21: Removed the clear button and switched the send control to a circular arrow icon.
- 2026-05-21: Added an animated reveal for the references results section after generating citations.
- 2026-05-21: Collapsed the references results container when hidden so it doesn’t occupy space until revealed.
- 2026-05-21: Hid the entire references results panel by default and only showed it once generation starts.
- 2026-05-21: Hid upload preview/result panels until actions occur and aligned the Read/Upload buttons with consistent height.
- 2026-05-21: Hid the upload status line until actions run and enforced fixed sizing for the Read/Upload buttons.
