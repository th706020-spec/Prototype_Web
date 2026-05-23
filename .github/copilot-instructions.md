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
├── .env                    # JWT_SECRET etc. (git-ignored)
├── css/
│   ├── style.css           # Global shared styles + CSS variable system
│   └── documents.css       # Document page styles
├── js/
│   ├── config.js           # window.AppConfig.API — the only place to set the API base URL
│   ├── auth.js             # window.Auth JWT helpers
│   ├── nav.js              # Shared navbar, footer, auth modals, theme toggle, user dropdown
│   └── documents.js        # Document page logic
├── pages/
│   ├── AIs/                # ais.html, ais.css, ais.js — AI tools hub
│   ├── chat/               # connects.html, navc.js, stylec.css — real-time chat
│   ├── doc/                # documents.html — document library
│   ├── forum/              # forum.html, forum.js, forum.css — forum
│   └── premium/            # premium.html, premium.css — upgrade page
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

### Multi-Theme System (Batch 8)
Protocol now supports **6 themes** instead of simple dark/light:
1. **Light** 🌙 — Blue accent `#3a6cf4`
2. **Dark** ☀️ — Lighter blue `#5b85f6`
3. **Gruvbox** 🟤 — Amber `#d79921`
4. **Sage** 🌿 — Green `#5d8a5e`
5. **Nord** ❄️ — Cyan `#88c0d0`
6. **Tokyo Night** 🌸 — Blue-purple `#7aa2f7`

**Implementation:**
- Theme name stored in `localStorage.getItem('theme')`
- Body gets class: `theme-{name}` for non-light themes, `dark` for dark theme, nothing for light
- Each theme has its own CSS `body.theme-{name}` block in `css/style.css` that overrides color vars
- `nav.js` has `applyTheme(name)` function; theme button cycles through all 6
- bfcache fix: `pageshow` event re-applies theme class to prevent revert on browser back/forward

**ASCII animations** are **theme-aware**:
- All inline scripts (donut, card hover, background wave) call `getThemeRGB()` helper
- This reads the current theme and returns `[r, g, b]` for that theme's accent color
- Animations update color in real-time when theme switches

**When adding new UI components:**
- Use CSS vars for colors
- Add `body.theme-gruvbox`, `body.theme-nord`, `body.theme-tokyo` overrides if using hardcoded colors (sage/light auto-inherit from light theme vars)
- For ASCII/canvas animations: use the `getThemeRGB()` pattern (see `index.html` line 116+)

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
1. Injects navbar HTML (logo, links, user box or login/signup buttons, theme toggle)
2. Injects footer
3. Injects auth modals (login, signup, settings)
4. Sets up: theme toggle, avatar upload, user dropdown, logout, settings forms

**User dropdown** (logged-in state):
- `.nav-user-box` wraps avatar + username + `▾` chevron
- `.nav-user-dropdown.is-open` shows the dropdown panel
- Dropdown includes avatar (clickable to change), name, email, joined date, tier badge, Settings button, Log Out

**Settings modal** (`#nav-settings-modal`):
- Change Username (PATCH `/api/auth/username`)
- Change Password (PATCH `/api/auth/password`)
- Member Status + upgrade link to `/pages/premium/premium.html`

**Theme toggle:**
- Navbar button cycles through 6 themes with emoji indicator
- `applyTheme(name)` removes all theme classes, adds the new one
- Persists to `localStorage.setItem('theme', name)`
- Auto-restores on page load via bfcache `pageshow` handler

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
| POST | `/api/messages/file` | Yes | Send file in chat |
| GET | `/api/forum/posts` | No | List forum posts |
| POST | `/api/forum/posts` | Yes | Create post |
| GET | `/api/forum/posts/:id` | No | Get post + comments |
| PUT | `/api/forum/posts/:id/vote` | Yes | Vote on post |
| POST | `/api/forum/posts/:id/comments` | Yes | Add comment |
| DELETE | `/api/forum/posts/:id` | Yes | Delete post |

---

## 13. Dark Mode Checklist

When adding any new UI component, verify:
- [ ] All backgrounds use `var(--clr-surface)` or `var(--clr-bg)` (not hardcoded)
- [ ] All text uses `var(--clr-text)` or `var(--clr-muted)`
- [ ] Borders use `var(--clr-border)`
- [ ] A `body.dark` override block exists for any component using hardcoded colors
- [ ] Inputs have dark background + light text in dark mode

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
