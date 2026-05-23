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
  limits: { fileSize: 100 * 1024 * 1024 },
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

  // Add columns to existing tables if they don't exist yet (safe — errors are swallowed)
  db.run("ALTER TABLE users ADD COLUMN avatar_url TEXT", () => {});
  db.run("ALTER TABLE users ADD COLUMN last_seen DATETIME", () => {});
  db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'", () => {});
  db.run("ALTER TABLE documents ADD COLUMN doc_type TEXT DEFAULT 'General'", () => {});
  db.run("ALTER TABLE documents ADD COLUMN univ TEXT DEFAULT ''", () => {});
  db.run("ALTER TABLE forum_posts ADD COLUMN image_url TEXT", () => {});
  db.run("ALTER TABLE forum_posts ADD COLUMN comment_count INTEGER DEFAULT 0", () => {});
  db.run("ALTER TABLE forum_posts ADD COLUMN type TEXT DEFAULT 'post'", () => {});
  db.run("ALTER TABLE notifications ADD COLUMN sender_name TEXT", () => {});
  db.run("ALTER TABLE notifications ADD COLUMN link_data TEXT", () => {});
  db.run("ALTER TABLE documents ADD COLUMN description TEXT DEFAULT ''", () => {});

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
      image_url TEXT,
      type TEXT DEFAULT 'post',
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

  db.run(`
    CREATE TABLE IF NOT EXISTS forum_post_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forum_polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forum_poll_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      option_index INTEGER NOT NULL,
      UNIQUE(poll_id, user_id),
      FOREIGN KEY (poll_id) REFERENCES forum_polls(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS role_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      requested_role TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      ref_id INTEGER,
      message TEXT NOT NULL,
      sender_name TEXT,
      link_data TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
          { id: this.lastID, username, email, tier: "member", role: "member" },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        res.json({ token, user: { id: this.lastID, username, email, tier: "member", role: "member" } });
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
        { id: user.id, username: user.username, email: user.email, tier: user.tier, role: user.role || "member" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({
        token,
        user: { id: user.id, username: user.username, email: user.email, tier: user.tier, role: user.role || "member" },
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
  db.get("SELECT id, username, email, tier, role, avatar_url, created_at FROM users WHERE id = ?", [req.user.id], (err, user) => {
    if (err || !user) return res.json({ user: req.user });
    res.json({ user: { ...req.user, role: user.role || "member", avatar_url: user.avatar_url, created_at: user.created_at } });
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
          { id: user.id, username: newUsername, email: user.email, tier: user.tier, role: user.role || "member" },
          JWT_SECRET, { expiresIn: "7d" }
        );
        res.json({ token, user: { id: user.id, username: newUsername, email: user.email, tier: user.tier, role: user.role || "member" } });
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

const DEV_UPGRADE_KEY = process.env.DEV_UPGRADE_KEY || "protocol-dev-2025";
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "protocol-admin-2025";

app.patch("/api/auth/upgrade", requireAuth, (req, res) => {
  const { devKey } = req.body;
  if (!devKey || devKey !== DEV_UPGRADE_KEY) {
    return res.status(402).json({ error: "Payment required. Contact admin for dev access key." });
  }
  db.run("UPDATE users SET tier = 'premium' WHERE id = ?", [req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, email: req.user.email, tier: "premium", role: req.user.role || "member" },
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

// --- Role management routes ---
const ALLOWED_ROLES = ["member", "mentor", "researcher", "mod", "admin", "premium"];
const REQUEST_ROLES = ["mentor", "researcher", "mod"]; // need admin approval

app.patch("/api/auth/set-role", requireAuth, (req, res) => {
  const { adminKey, userId, role } = req.body;
  if (!adminKey || adminKey !== ADMIN_SECRET_KEY) return res.status(403).json({ error: "Invalid admin key" });
  if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
  const targetId = userId || req.user.id;
  db.run("UPDATE users SET role = ? WHERE id = ?", [role, targetId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, role });
  });
});

app.post("/api/auth/request-role", requireAuth, (req, res) => {
  const { role } = req.body;
  if (!REQUEST_ROLES.includes(role)) return res.status(400).json({ error: "Role cannot be self-assigned" });
  db.get("SELECT id FROM role_requests WHERE user_id = ? AND status = 'pending'", [req.user.id], (err, existing) => {
    if (existing) return res.status(409).json({ error: "You already have a pending request" });
    db.run("INSERT INTO role_requests (user_id, requested_role) VALUES (?, ?)", [req.user.id, role], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ id: this.lastID, role, status: "pending" });
    });
  });
});

app.get("/api/admin/role-requests", requireAuth, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  db.all(
    `SELECT rr.*, u.username, u.email FROM role_requests rr
     JOIN users u ON rr.user_id = u.id WHERE rr.status = 'pending' ORDER BY rr.created_at ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.patch("/api/admin/role-requests/:id", requireAuth, (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const { action } = req.body; // 'approve' or 'deny'
  if (!["approve", "deny"].includes(action)) return res.status(400).json({ error: "action must be approve or deny" });

  db.get("SELECT * FROM role_requests WHERE id = ?", [req.params.id], (err, rr) => {
    if (err || !rr) return res.status(404).json({ error: "Request not found" });
    const status = action === "approve" ? "approved" : "denied";
    db.run("UPDATE role_requests SET status = ?, reviewed_by = ? WHERE id = ?", [status, req.user.id, rr.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (action === "approve") {
        db.run("UPDATE users SET role = ? WHERE id = ?", [rr.requested_role, rr.user_id]);
      }
      res.json({ success: true, status });
    });
  });
});

// --- Notification routes ---
app.get("/api/notifications", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.patch("/api/notifications/read", requireAuth, (req, res) => {
  db.run("UPDATE notifications SET read = 1 WHERE user_id = ?", [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true });
  });
});

// --- Chat routes ---
app.get("/api/messages/conversations", requireAuth, (req, res) => {
  const me = req.user.username;
  const query = `
    SELECT
      CASE WHEN sender = ? THEN receiver ELSE sender END AS peer,
      content AS last_message,
      MAX(timestamp) AS last_at
    FROM messages
    WHERE sender = ? OR receiver = ?
    GROUP BY CASE WHEN sender = ? THEN receiver ELSE sender END
    ORDER BY last_at DESC
  `;
  db.all(query, [me, me, me, me], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Enrich with avatar
    const peers = rows.map(r => r.peer);
    if (!peers.length) return res.json([]);
    const placeholders = peers.map(() => "?").join(",");
    db.all(`SELECT username, avatar_url FROM users WHERE username IN (${placeholders})`, peers, (err2, users) => {
      const userMap = {};
      (users || []).forEach(u => { userMap[u.username] = u.avatar_url; });
      res.json(rows.map(r => ({ ...r, avatar_url: userMap[r.peer] || null })));
    });
  });
});

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

app.post("/api/messages", requireAuth, (req, res) => {
  const sender = req.user.username;
  const { receiver, content } = req.body;
  if (!receiver || !content) return res.status(400).json({ error: "receiver and content required" });
  const query = "INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)";
  db.run(query, [sender, receiver, content], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const msgId = this.lastID;
    // Notify recipient
    db.get("SELECT id FROM users WHERE username = ?", [receiver], (e, u) => {
      if (u) {
        db.run(
          "INSERT INTO notifications (user_id, type, ref_id, message, sender_name, link_data) VALUES (?, 'message', ?, ?, ?, ?)",
          [u.id, msgId, content.length > 80 ? content.slice(0, 80) + "…" : content, sender, JSON.stringify({ peer: sender })]
        );
      }
    });
    res.json({ id: msgId, sender, receiver, content });
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
    `SELECT id, username, tier, role, avatar_url, created_at,
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
  const description = req.body.description || "";
  const uploader = getUploader(req);

  db.run(
    "INSERT INTO documents (name, filename, original_name, uploader, field, size, doc_type, univ, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, req.file.filename, req.file.originalname, uploader, field, req.file.size, doc_type, univ, description],
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
        description,
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
    // Allow: uploader OR admin role
    if (doc.uploader !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    db.run("DELETE FROM documents WHERE id = ?", [id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const filePath = path.join(uploadsDir, doc.filename);
      fs.unlink(filePath, () => {}); // delete file, ignore errors
      res.json({ success: true });
    });
  });
});

app.patch("/api/docs/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM documents WHERE id = ?", [id], (err, doc) => {
    if (err || !doc) return res.status(404).json({ error: "Document not found" });
    if (doc.uploader !== req.user.username && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Not authorized" });
    }
    const name = req.body.name || doc.name;
    const doc_type = req.body.doc_type || doc.doc_type;
    const field = req.body.field || doc.field;
    const univ = req.body.univ !== undefined ? req.body.univ : doc.univ;
    const description = req.body.description !== undefined ? req.body.description : doc.description;
    db.run(
      "UPDATE documents SET name=?, doc_type=?, field=?, univ=?, description=? WHERE id=?",
      [name, doc_type, field, univ, description, id],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true, name, doc_type, field, univ, description });
      }
    );
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
  let query = `SELECT fp.*,
    (SELECT COUNT(*) FROM forum_comments WHERE post_id = fp.id) AS comment_count,
    fp2.id AS poll_id,
    fp2.question AS poll_question,
    fp2.options AS poll_options_json
    FROM forum_posts fp
    LEFT JOIN forum_polls fp2 ON fp2.post_id = fp.id`;
  const params = [];
  if (tag) {
    query += " WHERE fp.tags LIKE ?";
    params.push(`%"${tag}"%`);
  }
  const orderMap = { hot: "fp.upvotes DESC", new: "fp.created_at DESC", old: "fp.created_at ASC" };
  query += " ORDER BY fp.is_pinned DESC, " + (orderMap[sort] || "fp.last_active DESC");
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      ...r,
      tags: JSON.parse(r.tags || "[]"),
      poll_options: r.poll_options_json ? JSON.parse(r.poll_options_json) : null,
    })));
  });
});

app.post("/api/forum/posts", requireAuth, (req, res) => {
  const { title, content, tags, type } = req.body;
  if (!title || !content) return res.status(400).json({ error: "title and content required" });
  const author = req.user;
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  const postType = ["post", "poll"].includes(type) ? type : "post";
  db.get("SELECT avatar_url FROM users WHERE id = ?", [author.id], (err, user) => {
    const avatarUrl = user?.avatar_url || null;
    db.run(
      "INSERT INTO forum_posts (title, content, author_id, author_name, author_avatar, tags, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [title, content, author.id, author.username, avatarUrl, tagsJson, postType],
      function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ id: this.lastID, title, content, author_name: author.username, tags, type: postType, upvotes: 0, downvotes: 0, is_pinned: 0 });
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
  const postId = req.params.id;
  const userId = req.user.id;
  const { direction } = req.body;
  if (!["up", "down"].includes(direction)) return res.status(400).json({ error: "direction must be up or down" });

  db.get("SELECT * FROM forum_post_votes WHERE post_id = ? AND user_id = ?", [postId, userId], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });

    const getAndReturn = () => {
      db.get("SELECT upvotes, downvotes FROM forum_posts WHERE id = ?", [postId], (e, r) => res.json(r || {}));
    };

    if (existing && existing.direction === direction) {
      // Same direction — un-vote
      const col = direction === "up" ? "upvotes" : "downvotes";
      db.run(`UPDATE forum_posts SET ${col} = MAX(0, ${col} - 1) WHERE id = ?`, [postId], () => {
        db.run("DELETE FROM forum_post_votes WHERE post_id = ? AND user_id = ?", [postId, userId], getAndReturn);
      });
    } else if (existing) {
      // Opposite direction — switch vote
      const oldCol = existing.direction === "up" ? "upvotes" : "downvotes";
      const newCol = direction === "up" ? "upvotes" : "downvotes";
      db.run(`UPDATE forum_posts SET ${oldCol} = MAX(0, ${oldCol} - 1), ${newCol} = ${newCol} + 1 WHERE id = ?`, [postId], () => {
        db.run("UPDATE forum_post_votes SET direction = ? WHERE post_id = ? AND user_id = ?", [direction, postId, userId], getAndReturn);
      });
    } else {
      // New vote
      const col = direction === "up" ? "upvotes" : "downvotes";
      db.run(`UPDATE forum_posts SET ${col} = ${col} + 1 WHERE id = ?`, [postId], () => {
        db.run("INSERT INTO forum_post_votes (post_id, user_id, direction) VALUES (?, ?, ?)", [postId, userId, direction], getAndReturn);
      });
    }
  });
});

app.patch("/api/forum/posts/:id/pin", requireAuth, (req, res) => {
  db.get("SELECT * FROM forum_posts WHERE id = ?", [req.params.id], (err, post) => {
    if (err || !post) return res.status(404).json({ error: "Post not found" });
    const role = req.user.role || "member";
    const isOwner = post.author_id === req.user.id;
    const isMod = ["admin", "mod"].includes(role);
    if (!isOwner && !isMod) return res.status(403).json({ error: "Only the post author or moderators can pin posts" });
    const newPin = post.is_pinned ? 0 : 1;
    db.run("UPDATE forum_posts SET is_pinned = ? WHERE id = ?", [newPin, post.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ is_pinned: newPin });
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
        // Notify post owner
        db.get("SELECT author_id, title FROM forum_posts WHERE id = ?", [req.params.id], (e, post) => {
          if (post && post.author_id !== author.id) {
            db.run(
              "INSERT INTO notifications (user_id, type, ref_id, message, sender_name, link_data) VALUES (?, 'comment', ?, ?, ?, ?)",
              [post.author_id, req.params.id, content.length > 80 ? content.slice(0, 80) + "…" : content, author.username, JSON.stringify({ post_id: req.params.id })]
            );
          }
        });
        res.json({ id: this.lastID, post_id: req.params.id, author_name: author.username, content });
      }
    );
  });
});

// --- Forum polls ---
app.post("/api/forum/polls", requireAuth, (req, res) => {
  const { post_id, question, options } = req.body;
  if (!post_id || !question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: "post_id, question and at least 2 options required" });
  }
  db.run(
    "INSERT INTO forum_polls (post_id, question, options) VALUES (?, ?, ?)",
    [post_id, question, JSON.stringify(options)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, post_id, question, options });
    }
  );
});

app.get("/api/forum/polls/:postId", (req, res) => {
  const userId = (() => {
    try {
      const h = req.headers["authorization"];
      return h ? jwt.verify(h.split(" ")[1], JWT_SECRET).id : null;
    } catch { return null; }
  })();
  db.get("SELECT * FROM forum_polls WHERE post_id = ?", [req.params.postId], (err, poll) => {
    if (err || !poll) return res.json(null);
    const opts = JSON.parse(poll.options || "[]");
    db.all("SELECT option_index FROM forum_poll_votes WHERE poll_id = ?", [poll.id], (e, votes) => {
      const counts = opts.map((_, i) => votes.filter(v => v.option_index === i).length);
      const myVote = userId ? (votes.find(v => v.user_id === userId)?.option_index ?? null) : null;
      // note: myVote from direct query — fix below
      db.get("SELECT option_index FROM forum_poll_votes WHERE poll_id = ? AND user_id = ?", [poll.id, userId || 0], (e2, myRow) => {
        res.json({ ...poll, options: opts, vote_counts: counts, my_vote: myRow ? myRow.option_index : null, total_votes: votes.length });
      });
    });
  });
});

app.post("/api/forum/polls/:id/vote", requireAuth, (req, res) => {
  const { option_index } = req.body;
  if (option_index === undefined) return res.status(400).json({ error: "option_index required" });
  db.get("SELECT * FROM forum_polls WHERE id = ?", [req.params.id], (err, poll) => {
    if (err || !poll) return res.status(404).json({ error: "Poll not found" });
    db.run(
      "INSERT OR REPLACE INTO forum_poll_votes (poll_id, user_id, option_index) VALUES (?, ?, ?)",
      [poll.id, req.user.id, option_index],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        // Return updated counts
        db.all("SELECT option_index FROM forum_poll_votes WHERE poll_id = ?", [poll.id], (e, votes) => {
          const opts = JSON.parse(poll.options || "[]");
          const counts = opts.map((_, i) => votes.filter(v => v.option_index === i).length);
          res.json({ my_vote: option_index, vote_counts: counts, total_votes: votes.length });
        });
      }
    );
  });
});

// --- Forum image upload ---
const forumImagesDir = path.join(uploadsDir, "forum");
if (!fs.existsSync(forumImagesDir)) fs.mkdirSync(forumImagesDir);
const uploadForumImage = multer({
  storage: multer.diskStorage({
    destination: forumImagesDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, "forum-" + Date.now() + ext);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      ".jpg", ".jpeg", ".png", ".gif", ".webp",
      ".mp4", ".webm", ".mov", ".ogg",
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
    ];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

app.post("/api/forum/posts/:id/image", requireAuth, uploadForumImage.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const imageUrl = "/uploads/forum/" + req.file.filename;
  db.run("UPDATE forum_posts SET image_url = ? WHERE id = ? AND author_id = ?", [imageUrl, req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(403).json({ error: "Not authorized or post not found" });
    res.json({ image_url: imageUrl });
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

