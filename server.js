const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
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

app.post("/api/messages", (req, res) => {
  const { sender, receiver, content } = req.body;
  const query =
    "INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)";
  db.run(query, [sender, receiver, content], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, sender, receiver, content });
  });
});

app.listen(3000, () => {});
