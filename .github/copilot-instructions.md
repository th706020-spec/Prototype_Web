# Copilot Instructions for Protocol

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

## 4. CSS Conventions

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

### Dark Mode
- Dark mode = `body.dark` class (toggled by nav.js, persisted in `localStorage("theme")`)
- **Every new component must have a `body.dark` override block**
- Pattern:
  ```css
  .my-component { background: var(--clr-surface); color: var(--clr-text); }
  body.dark .my-component { background: #1e293b; border-color: #334155; }
  ```

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

## 9. Navbar & `nav.js`

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

---

## 10. Server Routes Reference

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
| POST | `/api/docs/upload` | No | Upload document (multipart) |
| GET | `/api/docs/file/:filename` | No | Download file |
| DELETE | `/api/docs/:id` | Yes | Delete document |
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

## 11. Dark Mode Checklist

When adding any new UI component, verify:
- [ ] All backgrounds use `var(--clr-surface)` or `var(--clr-bg)` (not hardcoded)
- [ ] All text uses `var(--clr-text)` or `var(--clr-muted)`
- [ ] Borders use `var(--clr-border)`
- [ ] A `body.dark` override block exists for any component using hardcoded colors
- [ ] Inputs have dark background + light text in dark mode

---

## 12. Commit & Deploy Workflow

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

## 13. Code Style

- **No framework** — keep everything plain HTML/CSS/JS
- **No emoji in plain text, alerts, or code comments** — emoji OK in UI button labels and card icons
- **Comments only when clarification is needed** — avoid comment noise
- **Surgical edits** — change only what's needed; don't refactor unrelated code
- **CSS vars over hardcoded values** — always prefer the variable system
- **No inline styles** for toggling visibility — use CSS classes
- **Match existing naming conventions**: `clr-*` for colors, `--radius`/`--shadow-*`/`--transition` for shared tokens
- **Error messages** in API responses: plain lowercase English (e.g., `"Username already taken"`)
