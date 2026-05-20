# Protocol

A university group project.

---

## Project Structure

```
Protocol_Project/
├── index.html               ← Homepage
├── server.js                ← Express backend (auth, docs, chat, static serving)
├── connects.db              ← SQLite database (auto-created, gitignored)
├── uploads/                 ← Uploaded files (auto-created, gitignored)
├── .env                     ← Environment variables (gitignored — see .env.example)
├── css/
│   └── style.css            ← Shared design system
├── js/
│   ├── config.js            ← Shared client config (API URL detection)
│   ├── auth.js              ← Client-side JWT helper (window.Auth)
│   ├── nav.js               ← Navbar + auth modals (injected on every page)
│   └── documents.js         ← Documents page logic
└── pages/
    ├── doc/
    │   └── documents.html   ← Document library page
    ├── forum/
    │   ├── forum.html       ← Discussion forum
    │   ├── navf.js          ← Forum logic (localStorage-backed posts)
    │   └── stylef.css       ← Forum-specific styles
    └── chat/
        ├── connects.html    ← Connect / chat page
        ├── navc.js          ← Connect page logic (real user list from DB)
        └── stylec.css       ← Connect page styles
```

---

## Setup (local development)

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Start the server
npm start
# Server runs at http://localhost:3000
```

Open **http://localhost:3000** in your browser, or use VS Code Live Server on any port — the client auto-detects the environment and talks to Node on :3000.

---

## Hosting on Mac mini (Docker + nginx + Tailscale)

### 1. Copy the project to the Mac mini

```bash
scp -r Protocol_Project/ user@mac-mini:/srv/protocol/
```

### 2. Install Node dependencies on the server

```bash
cd /srv/protocol
npm install --omit=dev
```

### 3. Set up `.env`

```bash
cp .env.example .env
# nano .env  →  set JWT_SECRET to a long random string
openssl rand -base64 48   # use output as JWT_SECRET
```

### 4. Run the Node server (behind nginx)

Use a process manager so it survives reboots:

```bash
# With PM2 (recommended)
npm install -g pm2
pm2 start server.js --name protocol
pm2 save && pm2 startup
```

Or add it to your Docker Compose setup.

### 5. nginx proxy config

Add this inside your server block (port 10000 or wherever you expose the site):

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /uploads/ {
    proxy_pass http://127.0.0.1:3000/uploads/;
}

location / {
    proxy_pass http://127.0.0.1:3000/;
    proxy_set_header Host $host;
}
```

The client-side JavaScript detects the environment automatically:
- `localhost` / `file://` → talks to `http://127.0.0.1:3000/api` directly
- Any other domain (Tailscale URL, etc.) → uses relative `/api` (nginx proxies it)

---

## User Tiers

| Tier    | Signup | Access |
|---------|--------|--------|
| member  | Auto on sign-up | Documents, Forum, Connect |
| premium | Manual upgrade (DB) | All above + shown as Mentor |

To promote a user to premium, run on the server:

```bash
sqlite3 connects.db "UPDATE users SET tier='premium' WHERE username='their_username';"
```

---

## Tech Stack

- **Frontend**: Vanilla HTML / CSS / JS (no framework)
- **Backend**: Node.js + Express
- **Database**: SQLite (via sqlite3)
- **Auth**: JWT (jsonwebtoken) + bcrypt
- **File uploads**: multer (50 MB limit; pdf, docx, xlsx, pptx, spss, sav)
- **Hosting**: Docker + nginx + Tailscale Funnel
