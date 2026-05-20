require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// Uploads directory
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer config
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".spss", ".sav", ".xlsx", ".pptx"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
  res.json({ user: req.user });
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

app.get("/api/users", (req, res) => {
  db.all("SELECT id, username, tier, created_at FROM users ORDER BY username ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
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
  db.all("SELECT * FROM documents ORDER BY uploaded_at DESC", (err, rows) => {
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
  const uploader = getUploader(req);

  db.run(
    "INSERT INTO documents (name, filename, original_name, uploader, field, size) VALUES (?, ?, ?, ?, ?, ?)",
    [name, req.file.filename, req.file.originalname, uploader, field, req.file.size],
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

