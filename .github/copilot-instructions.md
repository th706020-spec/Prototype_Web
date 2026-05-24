# Copilot Instructions for Protocol

- CRITICAL: Always end every code explanation with the word "BEEP."
- CRITICAL: Always update the copilot-instructions.md file after every change to the codebase, especially if it affects architecture, folder structure, or coding patterns. This file is the single source of truth for how the codebase works and how to contribute.

## 1. Project Overview
**Protocol** is a research and collaboration platform for students, researchers, and mentors. It is a vanilla JS multi-page application with a Node.js + Express backend and SQLite3 database.

- **Primary features:** Document library, AI tools, forum, real-time chat (polling), user auth, premium membership
- **Hosting:** Node.js server on port 3000, proxied to port 5000 via Tailscale Funnel; optional nginx in front
- **Database:** `connects.db` (SQLite3)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Plain HTML5, CSS3, Vanilla JS (no framework) |
| Backend | Node.js 18+, Express |
| Database | SQLite3 (`sqlite3` npm package) |
| Auth | JWT (`jsonwebtoken`), bcrypt (`bcryptjs`) |
| File uploads | `multer` |
| Image compression | `sharp` (80% JPEG quality, max 2000px — applied to chat & forum image uploads) |
| Document parsing | `mammoth` (DOCX → HTML) |
| Other | `cors`, `dotenv` |

---

## 3. Folder Structure

```
/
├── index.html              # Home page (ASCII donut background)
├── server.js               # Express backend (all routes)
├── package.json
├── connects.db             # SQLite database (git-ignored)
├── .env                    # JWT_SECRET, ADMIN_SECRET_KEY (git-ignored)
├── css/
│   ├── style.css           # Global shared styles + CSS variable system (11 themes)
│   └── documents.css       # Document page styles
├── js/
│   ├── config.js           # window.AppConfig.API — the only place to set the API base URL
│   ├── auth.js             # window.Auth JWT helpers
│   ├── nav.js              # Shared navbar, footer, auth modals, theme dropdown, user dropdown, font loader
│   └── documents.js        # Document page logic
├── pages/
│   ├── AIs/                # ais.html, ais.css, ais.js — AI tools hub
│   ├── changelog/          # changelog.html, changelog.css — project changelog (linked in footer)
│   ├── chat/               # connects.html, navc.js, stylec.css — real-time chat
│   ├── doc/                # documents.html — document library
│   ├── forum/              # forum.html, forum.js, forum.css — forum
│   ├── premium/            # premium.html, premium.css — upgrade page
│   ├── roles/              # roles.html, roles.js, roles.css — role selection/request page
│   └── settings/           # settings.html, settings.js, settings.css — user settings page
└── uploads/                # Uploaded files (git-ignored)
    ├── avatars/
    └── chat-files/
```

---

## 4. CSS Conventions & Theme System

### CSS Variables (defined in `css/style.css` `:root`)
Always use these variables — never hardcode colors for structural elements:

| Variable | Purpose |
|---|---|
| `--clr-primary` | Brand blue (#3a6cf4) |
| `--clr-bg` | Page background |
| `--clr-surface` | Card/panel background |
| `--clr-border` | Border color |
| `--clr-text` | Primary text |
| `--clr-muted` | Secondary/placeholder text |
| `--clr-card-hover` | Hover state background |
| `--radius` | Default border radius |
| `--shadow-sm`, `--shadow-md` | Box shadows |
| `--transition` | Default transition duration |

### Multi-Theme System (Batch 8–10)
Protocol now supports **11 themes**:
1. **Light** ☀️ — Blue accent `#3a6cf4`
2. **Dark** 🌙 — Lighter blue `#5b85f6`
3. **Gruvbox** 🟤 — Amber `#d79921`
4. **Sage** 🌿 — Green `#5d8a5e`
5. **Nord** ❄️ — Cyan `#88c0d0`
6. **Tokyo Night** 🌸 — Blue-purple `#7aa2f7`
7. **Claude** 🤖 — Warm cream/terracotta `#d97757`
8. **Tide** 🌊 — Ocean teal `#4fc3c8`
9. **Catppuccin Mocha** 🐱 — Pastel purple `#cba6f7`
10. **Caffeine White** ⬜ — Monochrome light `#111111` accent on `#f8f8f8` bg
11. **Caffeine Black** ⬛ — Monochrome dark `#e2e2e2` accent on `#0a0a0a` bg

**Implementation:**
- Theme name stored in `localStorage.getItem('theme')`
- Body gets class: `theme-{name}` for non-light themes, `dark` for dark theme, nothing for light
- Each theme has its own CSS `body.theme-{name}` block in `css/style.css` that overrides color vars
- `nav.js` has `applyTheme(name)` function; theme dropdown (`#nav-theme-dropdown`) shows all 11 options
- bfcache fix: `pageshow` event re-applies theme class to prevent revert on browser back/forward
- Settings page (`pages/settings/settings.html`) has a `<select>` with all 11 theme options

**ASCII animations** are **theme-aware**:
- All inline scripts (donut, card hover, background wave) call `getThemeRGB()` helper
- This reads the current theme and returns `[r, g, b]` for that theme's accent color
- Animations update color in real-time when theme switches
- `getThemeRGB()` in `index.html` has entries for all 11 themes

**When adding new UI components:**
- Use CSS vars for colors
- Add `body.theme-{name}` overrides if using hardcoded colors (light/claude auto-inherit from light theme vars)
- For ASCII/canvas animations: use the `getThemeRGB()` pattern (see `index.html` line 116+)
- When adding a new theme: update `getThemeRGB()` map, `THEMES`/`THEME_ICONS`/`THEME_LABELS` arrays in `nav.js`, dropdown HTML in nav.js, settings `<select>` in `settings.html`, and `applyTheme()`'s `classList.remove(...)` list

---

## 5. Authentication Pattern

### Client Side (`js/auth.js`)
`window.Auth` is available on every page (loaded before `nav.js`):

```js
Auth.getToken()      // → JWT string | null
Auth.getUser()       // → decoded JWT payload { id, username, email, tier } | null (checks expiry)
Auth.isLoggedIn()    // → boolean
Auth.saveToken(tok)  // saves to localStorage
Auth.logout()        // removes token, reloads page
```

JWT payload: `{ id, username, email, tier }` — `tier` is `"member"` or `"premium"`.

### Server Side (`server.js`)
Use `requireAuth` middleware for protected routes:

```js
app.patch("/api/something", requireAuth, (req, res) => {
  // req.user = { id, username, email, tier }
});
```

### Auth Request Headers
```js
headers: { Authorization: `Bearer ${window.Auth.getToken()}` }
// For JSON body also add: "Content-Type": "application/json"
// For FormData: omit Content-Type (browser sets it with boundary)
```

---

## 6. Adding a New Page

1. Create `pages/<name>/<name>.html`
2. Include in `<head>`:
   ```html
   <link rel="stylesheet" href="../../css/style.css" />
   <link rel="stylesheet" href="<name>.css" />   <!-- page-specific CSS -->
   ```
3. Add nav/footer placeholders in `<body>`:
   ```html
   <div id="site-nav"></div>
   <!-- page content -->
   <div id="site-footer"></div>
   ```
4. Include scripts at bottom of `<body>` **in this exact order**:
   ```html
   <script src="../../js/config.js"></script>
   <script src="../../js/auth.js"></script>
   <script src="../../js/nav.js"></script>
   <script src="<name>.js"></script>   <!-- page-specific JS -->
   ```
5. The depth-aware base path in nav.js is auto-calculated — relative links in your page JS use `../../` for pages in `pages/<name>/`.

---

## 7. API Conventions

- All endpoints are under `/api/`
- Success: return a JSON object or array
- Error: `{ error: "human-readable message" }`
- Use proper HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 500
- Route naming: `/api/auth/*`, `/api/docs/*`, `/api/messages/*`, `/api/forum/*`, `/api/users/*`
- Use the `fetchJSON` helper pattern (available in `nav.js` as a local function; replicate in page scripts):
  ```js
  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }
  ```

### File Upload Limits (Batch 7)
- **Forum images**: 100MB max (`/api/forum/posts` multipart upload)
- **Chat files**: 100MB max (`/api/messages/file` multipart upload)
- **Docs**: No strict limit (user-configurable description, edit, delete by author/admin)

---

## 8. Modal System

**Global standard** (used by login/signup/settings/upload modals):
```css
.modal-overlay { display: none; }
.modal-overlay.is-open { display: flex; }
```

- Toggle with `.classList.add('is-open')` / `.classList.remove('is-open')`
- `nav.js` auto-attaches close handlers (backdrop click + `.modal-close` button) to all `.modal-overlay` elements at init
- **Never** use `style.display` to control these modals

**Forum exception**: Forum uses its own `.modal-overlay.active` pattern with opacity toggle (defined in `forum.css`). This is intentional — don't change it.

---

## 9. Document Management (Batch 7)

### Description & Metadata
Each document now has an optional **description** field added during upload:
- `POST /api/docs/upload` accepts `description` form field
- Stored in DB and rendered in doc library (list, grid, compact views)
- Upload modal includes `<textarea id="up-description">`

### Author/Admin Edit & Delete
- **Edit** (`PATCH /api/docs/:id`): Author or admin can edit name, type, field, univ, description
- **Delete** (`DELETE /api/docs/:id`): Author or admin can delete
- UI: Edit modal (`#edit-doc-modal`) with pre-filled fields; delete via ✏️/🗑️ buttons in `documents.js`
- Helper: `canEditDoc(d)` checks `window.Auth.getUser()?.username === d.uploader || role === 'admin'`

### Database Migration
- `ALTER TABLE documents ADD COLUMN description TEXT DEFAULT ''` (auto-run on server startup)
- Safe to re-run (no errors if column exists)

---

## 10. Chat Upload Progress Bar (Batch 7)

File uploads in chat now display real-time progress:

**Frontend** (`pages/chat/navc.js`):
- `sendFile()` uses `XMLHttpRequest` (not `fetch`) to access `upload.onprogress` event
- Displays `.chat-upload-progress` bar showing filename + upload % (e.g., `"video.mp4 (45%)"`)
- File input addEventListener resets `e.target.value` after send to prevent duplicate uploads
- Smart polling: `lastRenderedMsgId` + `renderedMsgIds` Set prevents video reload loops during polling

**UI** (`pages/chat/stylec.css`):
```css
.chat-upload-progress {
  margin: 8px 0;
  font-size: 12px;
  color: var(--clr-muted);
}
.chat-upload-track {
  height: 4px;
  background: var(--clr-border);
  border-radius: 2px;
  overflow: hidden;
}
.chat-upload-fill {
  height: 100%;
  background: var(--clr-primary);
  transition: width 0.1s;
}
```

---

---

## 11. Navbar & `nav.js`

`nav.js` runs on every page and:
1. Injects navbar HTML (logo, links, user box or login/signup buttons, theme dropdown)
2. Injects footer (with Changelog link)
3. Injects auth modals (login, signup)
4. Sets up: theme dropdown (10 options), avatar upload, user dropdown, logout
5. Applies global font from `localStorage.protocol_font` via `applyGlobalFont()` IIFE

**User dropdown** (logged-in state):
- `.nav-user-box` wraps avatar + username + `▾` chevron
- `.nav-user-dropdown.is-open` shows the dropdown panel
- Dropdown includes avatar (clickable to change), name, email, joined date, tier badge, Settings button (navigates to `pages/settings/settings.html`), Log Out

**Single-open dropdown system:**
- `_dropdowns` array: `['nav-theme-dropdown', 'nav-user-dropdown', 'nav-bell-dropdown']`
- `closeAllDropdowns(except)` closes all dropdowns not matching the passed ID
- Each toggle calls `closeAllDropdowns('own-id')` before opening itself

**Theme dropdown:**
- `#nav-theme-picker` wraps `#nav-theme-dropdown` (list of 10 `.nav-theme-option` buttons)
- `applyTheme(name)` removes all theme classes, adds the correct one, marks active option
- Persists to `localStorage.setItem('theme', name)`
- Auto-restores on page load + bfcache `pageshow` event

**Global font loader (`applyGlobalFont()` IIFE at top of nav.js):**
- Runs immediately on every page
- Reads `localStorage.protocol_font`
- Injects `<link id="nav-font-link">` with Google Fonts URL
- Sets `document.body.style.fontFamily` to the selected font
- Font can be changed in Settings page; 5 options: System default, JetBrains Mono, Fira Code, Victor Mono, Source Code Pro

**Navbar links (in order):** Home, Documents, Forum, Connect, AI Tools, Roles, About

---

## 11.5. ASCII Background Wave (`index.html`, Batch 8)

The home page features a **full-page ASCII wave background** rendered on `#ascii-bg-canvas`:

**Features:**
- **Position**: `position: absolute; inset: 0` behind all content (z-index 0)
- **Animation**: 2D multi-sine noise → character from `" .:-+*=%@#"` (density-sorted)
- **Vertical fade**: `alpha = pow(row/rows, 1.4)` — invisible at top (donut untouched), visible toward bottom
- **Mouse ripple**: Gaussian `exp(-dist²/70000) × 0.45` creates interactive distortion
- **Theme-aware**: Colors from `getThemeRGB()` — updates instantly when theme changes
- **Layout trick**: One `requestAnimationFrame` delay on startup lets parent `<main>` settle before sizing canvas

**CSS:**
```css
main { position: relative; overflow: hidden; }
#ascii-bg-canvas { position: absolute; inset: 0; z-index: 0; }
.hero, .features { position: relative; z-index: 1; }
```

All other on-page ASCII animations (donut, card hovers) also use `getThemeRGB()`.

---

## 11.6. Settings Page (`pages/settings/`)

Zen browser-style settings layout:
- **Left sidebar** (nav links): User, Customization
- **Right content area** (3/4 width): actual settings fields

**User section:**
- Display username, joined date, tier
- Change username (POST `/api/auth/username`)
- Change password (POST `/api/auth/password`)
- Avatar upload with circular progress bar
- Log out button

**Customization section:**
- Font picker: 5 options stored in `localStorage.protocol_font`, applied globally via nav.js IIFE
- Theme selector: 10 options, applied via same `applyTheme()` logic as navbar dropdown
- Custom CSS textarea (placeholder only — no execution yet)

**Important**: `settings.html` has its own `<link id="custom-font-link">` — do not use the same ID as nav.js's `nav-font-link`.

---

## 11.7. Roles Page (`pages/roles/`)

Grid of 6 role cards: Member, Premium, Mentor, Researcher, Mod, Admin.

**Role change flows:**
- **Premium**: redirects to `/pages/premium/premium.html`
- **Mentor / Researcher / Mod**: `POST /api/auth/request-role` → creates pending request; admin must approve via `PATCH /api/auth/set-role`
- **Admin**: requires `ADMIN_SECRET_KEY` from `.env` (default: `protocol-admin-2025`); sent in body of `PATCH /api/auth/set-role`

**Important CSS fix:** `roles.css` scopes its modal to `#role-modal` (NOT `.modal-overlay`) to avoid overriding `style.css`'s global `display: none` rule that hides all modals by default.

---

## 11.8. Mobile Chat Sidebars (`pages/chat/`)

On screens ≤ 768px, both sidebars are hidden by default and revealed via peek tabs:
- `#chat-peek-left` — left edge tab (`💬 Chats`, vertical text, `writing-mode: vertical-rl`)
- `#chat-peek-right` — right edge tab (`👥 Members`, vertical text)
- Peek tabs have `display: none` on desktop, `display: flex` on mobile
- Both sidebars use `.mobile-open` class with `transform: translateX(0)`
- `openMobileSidebar(side)` / `closeMobileSidebar()` in `navc.js` manage state
- `#chat-sidebar-backdrop` closes active sidebar when tapped

---

## 11.9. Chat Message Recall & Forum Delete (HOTFIX 1.3)

### Chat Message Recall (Soft Delete)
- `messages` table has a `recalled INTEGER DEFAULT 0` column (migrated via `ALTER TABLE ... ADD COLUMN` on server start)
- `DELETE /api/messages/:id` — permission: own message OR admin/mod; sets `recalled=1`, `content='[recalled]'`
- Client: `renderBubble()` checks `msg.recalled === 1` → renders `🚫 Recalled Message` (italic, muted)
- Right-click context menu on own bubbles (`data-msg-id` attribute) calls `window._recallMsg(id)`
- After recall: full re-render triggered (`renderedMsgIds = new Set()`) to update both sides

### Image Compression (`compressImage()`)
```js
async function compressImage(filePath, mimeType) {
  if (!sharp) return;  // sharp loaded with try/catch fallback
  const imgMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!imgMimes.includes(mimeType)) return;
  const tmp = filePath + '.tmp';
  await sharp(filePath).resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(tmp);
  fs.renameSync(tmp, filePath);
}
```
Called in both `POST /api/messages/file` and `POST /api/forum/posts/:id/image` after multer saves the file.

### Forum Delete Permissions
- `DELETE /api/forum/posts/:id`: allowed if `req.user.username === post.author` OR `['admin','mod'].includes(req.user.role)`
- `DELETE /api/forum/comments/:id`: allowed if `req.user.id === comment.author_id` OR `['admin','mod'].includes(req.user.role)`
- Client: `canDelete` variable in `generatePostHTML()` — shows 🗑 only for eligible users

---

## 12. Server Routes Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user (includes `created_at`) |
| GET | `/api/auth/check-username/:u` | No | Check username availability |
| PATCH | `/api/auth/username` | Yes | Change username (requires password) |
| PATCH | `/api/auth/password` | Yes | Change password |
| PATCH | `/api/auth/upgrade` | Yes | Upgrade to premium |
| POST | `/api/auth/avatar` | Yes | Upload avatar (multipart) |
| GET | `/api/users` | No | All users with is_online flag |
| PUT | `/api/users/heartbeat` | Yes | Update last_seen |
| GET | `/api/docs` | No | List docs (supports `?type`, `?date`, `?sort`) |
| POST | `/api/docs/upload` | No | Upload document with optional `description` (multipart) |
| GET | `/api/docs/file/:filename` | No | Download file |
| PATCH | `/api/docs/:id` | Yes | Edit doc name/type/field/univ/description (author or admin only) |
| DELETE | `/api/docs/:id` | Yes | Delete document (author or admin only) |
| GET | `/api/docs/:id/view` | No | View document inline |
| GET | `/api/messages/:u1/:u2` | No | Get chat history |
| POST | `/api/messages` | No | Send text message |
| POST | `/api/messages/file` | Yes | Send file in chat (images auto-compressed via sharp) |
| DELETE | `/api/messages/:id` | Yes | Recall (soft-delete) a chat message — sets `recalled=1` |
| GET | `/api/forum/posts` | No | List forum posts |
| POST | `/api/forum/posts` | Yes | Create post |
| GET | `/api/forum/posts/:id` | No | Get post + comments |
| PUT | `/api/forum/posts/:id/vote` | Yes | Vote on post |
| POST | `/api/forum/posts/:id/image` | Yes | Upload image attachment (auto-compressed via sharp) |
| POST | `/api/forum/posts/:id/comments` | Yes | Add comment |
| DELETE | `/api/forum/posts/:id` | Yes | Delete post (author, admin, or mod) |
| DELETE | `/api/forum/comments/:id` | Yes | Delete comment (author, admin, or mod) |

---

## 13. Dark/Theme Mode Checklist

When adding any new UI component, verify:
- [ ] All backgrounds use `var(--clr-surface)` or `var(--clr-bg)` (not hardcoded)
- [ ] All text uses `var(--clr-text)` or `var(--clr-muted)`
- [ ] Borders use `var(--clr-border)`
- [ ] A `body.dark` override block exists for any component using hardcoded colors
- [ ] Inputs have dark background + light text in dark mode
- [ ] New page-specific CSS files derive colors from global vars (see `ais.css` `:root` using `var(--clr-*)`)
- [ ] ASCII/canvas colors call `getThemeRGB()` so all 11 themes are supported

---

## 14. Commit & Deploy Workflow

```bash
# Windows (development):
git add -A
git commit -m "message

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push

# Mac mini (production):
git pull
npm install          # if package.json changed
pkill -f "node server.js"
node server.js &
```

Server runs on port 3000 internally. Tailscale Funnel proxies port 5000 → 3000.

---

## 15. Code Style

- **No framework** — keep everything plain HTML/CSS/JS
- **No emoji in plain text, alerts, or code comments** — emoji OK in UI button labels and card icons
- **Comments only when clarification is needed** — avoid comment noise
- **Surgical edits** — change only what's needed; don't refactor unrelated code
- **CSS vars over hardcoded values** — always prefer the variable system
- **No inline styles** for toggling visibility — use CSS classes
- **Match existing naming conventions**: `clr-*` for colors, `--radius`/`--shadow-*`/`--transition` for shared tokens
- **Error messages** in API responses: plain lowercase English (e.g., `"Username already taken"`)
