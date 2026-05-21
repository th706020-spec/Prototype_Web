require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const mammoth = require("mammoth");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// Uploads directories
const uploadsDir = path.join(__dirname, "uploads");
const avatarsDir = path.join(uploadsDir, "avatars");
const chatFilesDir = path.join(uploadsDir, "chat-files");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);
if (!fs.existsSync(chatFilesDir)) fs.mkdirSync(chatFilesDir);

// Multer — documents
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".spss", ".sav", ".xlsx", ".pptx"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Multer — avatars
const avatarStorage = multer.diskStorage({
  destination: avatarsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, "avatar-" + Date.now() + ext);
  },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// Multer — chat files
const chatFileStorage = multer.diskStorage({
  destination: chatFilesDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadChatFile = multer({
  storage: chatFileStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./connects.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      tier TEXT DEFAULT 'member',
      avatar_url TEXT,
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns to existing users table if they don't exist yet
  db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN last_seen DATETIME", () => {});
  // Add columns to existing documents table if they don't exist yet
  db.run("ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT 'General'", () => {});
  db.run("ALTER TABLE documents ADD COLUMN univ TEXT DEFAULT ''", () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filename TEXT UNIQUE NOT NULL,
      original_name TEXT NOT NULL,
      uploader TEXT NOT NULL,
      field TEXT DEFAULT 'Tài liệu cá nhân',
      size INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      tags TEXT DEFAULT '[]',
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forum_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      content TEXT NOT NULL,
      parent_comment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
    )
  `);
});

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ error: "No token provided" });

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// --- Auth routes ---
app.post("/api/auth/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, hash],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Username or email already exists" });
          }
          return res.status(500).json({ error: err.message });
        }
        const token = jwt.sign(
          { id: this.lastID, username, email, tier: "member" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        res.json({ token, user: { id: this.lastID, username, email, tier: "member" } });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  db.get(
    "SELECT * FROM users WHERE email = ? OR username = ?",
    [identifier, identifier],
    async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, tier: user.tier },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, tier: user.tier },
      });
    }
  );
});

app.get("/api/auth/check-username/:username", (req, res) => {
  const { username } = req.params;
  db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ available: !row });
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  db.get("SELECT id, username, email, tier, avatar_url, created_at FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) return res.json({ user: req.user });
    res.json({ user: { ...req.user, avatar_url: user.avatar_url, created_at: user.created_at } });
  });
});

app.patch("/api/auth/username", requireAuth, async (req, res) => {
  const { newUsername, password } = req.body;
  if (!newUsername || !password) return res.status(400).json({ error: "New username and current password required" });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(newUsername)) return res.status(400).json({ error: "Username must be 3-30 alphanumeric/underscore characters" });

  db.get("SELECT * FROM users WHERE id = ?", [req.user.id], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "User not found" });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    db.run("UPDATE users SET username = ? WHERE id = ?", [newUsername, req.user.id], function(err2) {
      if (err2) {
        if (err2.message.includes("UNIQUE")) return res.status(409).json({ error: "Username already taken" });
        return res.status(500).json({ error: err2.message });
      }
      const token = jwt.sign(
        { id: user.id, username: newUsername, email: user.email, tier: user.tier },
        JWT_SECRET, { expiresIn: "7d" }
      );
      res.json({ token, user: { id: user.id, username: newUsername, email: user.email, tier: user.tier } });
    });
  });
});

app.patch("/api/auth/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both current and new password required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

  db.get("SELECT * FROM users WHERE id = ?", [req.user.id], async (err, user) => {
    if (err || !user) return res.status(500).json({ error: "User not found" });
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Incorrect current password" });

    const hash = await bcrypt.hash(newPassword, 10);
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: "Password updated successfully" });
    });
  });
});

app.patch("/api/auth/upgrade", requireAuth, (req, res) => {
  db.run("UPDATE users SET tier = 'premium' WHERE id = ?", [req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, email: req.user.email, tier: "premium" },
      JWT_SECRET, { expiresIn: "7d" }
    );
    res.json({ token, user: { ...req.user, tier: "premium" } });
  });
});

app.post("/api/auth/avatar", requireAuth, uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const avatarUrl = "/uploads/avatars/" + req.file.filename;
  db.run("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ avatar_url: avatarUrl });
  });
});

// --- Chat routes ---
app.get("/api/messages/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;
  const query = `
    SELECT * FROM messages
    WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
    ORDER BY timestamp ASC
  `;
  db.all(query, [user1, user2, user2, user1], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/messages", (req, res) => {
  const { sender, receiver, content } = req.body;
  const query = "INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)";
  db.run(query, [sender, receiver, content], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, sender, receiver, content });
  });
});

app.put("/api/users/heartbeat", requireAuth, (req, res) => {
  db.run("UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

app.get("/api/users", (req, res) => {
  db.all(
    `SELECT id, username, tier, avatar_url, created_at,
      CASE WHEN last_seen > datetime('now', '-2 minutes') THEN 1 ELSE 0 END AS is_online
     FROM users ORDER BY username ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// --- Document routes ---

// Helper: extract uploader username from JWT (optional auth)
function getUploader(req) {
  try {
    const header = req.headers["authorization"];
    if (!header) return "Anonymous";
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.username;
  } catch {
    return "Anonymous";
  }
}

app.get("/api/docs", (req, res) => {
  const { type, date, sort } = req.query;
  const conditions = [];
  const params = [];

  if (type && type !== 'all') {
    conditions.push("doc_type = ?");
    params.push(type);
  }
  if (date) {
    conditions.push("DATE(uploaded_at) = ?");
    params.push(date);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const orderCol = sort === 'name' ? 'name' : sort === 'type' ? 'doc_type' : 'uploaded_at';
  const orderDir = orderCol === 'name' || orderCol === 'doc_type' ? 'ASC' : 'DESC';

  db.all(`SELECT * FROM documents ${where} ORDER BY ${orderCol} ${orderDir}`, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/docs/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded or file type not allowed" });
  }

  const name = (req.body.name || req.file.originalname).trim();
  const field = req.body.field || "Tài liệu cá nhân";
  const doc_type = req.body.doc_type || "General";
  const univ = req.body.univ || "";
  const uploader = getUploader(req);

  db.run(
    "INSERT INTO documents (name, filename, original_name, uploader, field, size, doc_type, univ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [name, req.file.filename, req.file.originalname, uploader, field, req.file.size, doc_type, univ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        id: this.lastID,
        name,
        filename: req.file.filename,
        original_name: req.file.originalname,
        uploader,
        field,
        size: req.file.size,
        doc_type,
        univ,
      });
    }
  );
});

app.get("/api/docs/file/:filename", (req, res) => {
  const { filename } = req.params;
  if (!/^[\w\-.]+$/.test(filename)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const filePath = path.join(uploadsDir, filename);
  db.get("SELECT * FROM documents WHERE filename = ?", [filename], (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: "File not found" });
    res.download(filePath, doc.original_name);
  });
});

app.delete("/api/docs/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM documents WHERE id = ?", [id], (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: "Document not found" });
    db.run("DELETE FROM documents WHERE id = ?", [id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const filePath = path.join(uploadsDir, doc.filename);
      fs.unlink(filePath, () => {}); // delete file, ignore errors
      res.json({ success: true });
    });
  });
});

app.post("/api/messages/file", requireAuth, uploadChatFile.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const { receiver } = req.body;
  if (!receiver) return res.status(400).json({ error: "receiver required" });
  const fileUrl = `/uploads/chat-files/${req.file.filename}`;
  const content = `[file:${req.file.originalname}:${fileUrl}]`;
  db.run(
    "INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)",
    [req.user.username, receiver, content],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, sender: req.user.username, receiver, content, file_url: fileUrl, file_name: req.file.originalname });
    }
  );
});

// --- Forum routes ---
app.get("/api/forum/posts", (req, res) => {
  const { tag, sort } = req.query;
  let query = "SELECT * FROM forum_posts";
  const params = [];
  if (tag) {
    query += " WHERE tags LIKE ?";
    params.push(`%"${tag}"%`);
  }
  const orderMap = { hot: "upvotes DESC", new: "created_at DESC", old: "created_at ASC" };
  query += " ORDER BY is_pinned DESC, " + (orderMap[sort] || "last_active DESC");
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, tags: JSON.parse(r.tags || "[]") })));
  });
});

app.post("/api/forum/posts", requireAuth, (req, res) => {
  const { title, content, tags } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content required" });
  const author = req.user;
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  db.get("SELECT avatar_url FROM users WHERE id = ?", [author.id], (err, user) => {
    const avatarUrl = user?.avatar_url || null;
    db.run(
      "INSERT INTO forum_posts (title, content, author_id, author_name, author_avatar, tags) VALUES (?, ?, ?, ?, ?, ?)",
      [title, content, author.id, author.username, avatarUrl, tagsJson],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ id: this.lastID, title, content, author_name: author.username, tags, upvotes: 0, downvotes: 0, is_pinned: 0 });
      }
    );
  });
});

app.get("/api/forum/posts/:id", (req, res) => {
  db.get("SELECT * FROM forum_posts WHERE id = ?", [req.params.id], (err, post) => {
    if (err || !post) return res.status(404).json({ error: "Post not found" });
    db.all("SELECT * FROM forum_comments WHERE post_id = ? ORDER BY created_at ASC", [post.id], (err2, comments) => {
      res.json({ ...post, tags: JSON.parse(post.tags || "[]"), comments: comments || [] });
    });
  });
});

app.put("/api/forum/posts/:id/vote", requireAuth, (req, res) => {
  const { direction } = req.body; // 'up' or 'down'
  const col = direction === "up" ? "upvotes" : "downvotes";
  db.run(`UPDATE forum_posts SET ${col} = ${col} + 1 WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT upvotes, downvotes FROM forum_posts WHERE id = ?", [req.params.id], (e, r) => {
      res.json(r || {});
    });
  });
});

app.post("/api/forum/posts/:id/comments", requireAuth, (req, res) => {
  const { content, parent_comment_id } = req.body;
  if (!content) return res.status(400).json({ error: "content required" });
  const author = req.user;
  db.get("SELECT avatar_url FROM users WHERE id = ?", [author.id], (err, user) => {
    const avatarUrl = user?.avatar_url || null;
    db.run(
      "INSERT INTO forum_comments (post_id, author_id, author_name, author_avatar, content, parent_comment_id) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, author.id, author.username, avatarUrl, content, parent_comment_id || null],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.run("UPDATE forum_posts SET last_active = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
        res.json({ id: this.lastID, post_id: req.params.id, author_name: author.username, content });
      }
    );
  });
});

app.delete("/api/forum/posts/:id", requireAuth, (req, res) => {
  db.get("SELECT * FROM forum_posts WHERE id = ?", [req.params.id], (err, post) => {
    if (err || !post) return res.status(404).json({ error: "Post not found" });
    if (post.author_id !== req.user.id && req.user.tier !== "mentor") {
      return res.status(403).json({ error: "Not authorized" });
    }
    db.run("DELETE FROM forum_posts WHERE id = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// --- Document viewer ---
app.get("/api/docs/:id/view", (req, res) => {
  db.get("SELECT * FROM documents WHERE id = ?", [req.params.id], async (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: "Document not found" });
    const filePath = path.join(uploadsDir, doc.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });
    const ext = path.extname(doc.original_name).toLowerCase();
    if (ext === ".pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${doc.original_name}"`);
      return fs.createReadStream(filePath).pipe(res);
    }
    if (ext === ".docx") {
      try {
        const result = await mammoth.convertToHtml({ path: filePath });
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:1.7}</style></head><body>${result.value}</body></html>`);
      } catch (e) {
        return res.status(500).json({ error: "Could not convert document" });
      }
    }
    if (ext === ".txt") {
      const text = fs.readFileSync(filePath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:monospace;max-width:900px;margin:40px auto;padding:0 24px}pre{white-space:pre-wrap}</style></head><body><pre>${text.replace(/</g,"&lt;")}</pre></body></html>`);
    }
    // For other types, force download
    res.download(filePath, doc.original_name);
  });
});

// Serve uploads (avatars, chat-files, etc.)
app.use("/uploads", express.static(uploadsDir));

// Serve static files — access the site at http://localhost:3000
app.use(express.static(path.join(__dirname)));

// Global error handler — catches multer errors and any uncaught route errors
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const msg = err.message || "Internal server error";
  res.status(err.status || 400).json({ error: msg });
});

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});

