import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import path from "path";
import { createServer as createViteServer } from "vite";

const db = new Database("checkin.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec(`ALTER TABLE checkins ADD COLUMN province TEXT NOT NULL DEFAULT ''`);
} catch (e) {
  // 列可能已经存在
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling']
  });

  app.use(express.json());

  app.post("/api/checkin", (req, res) => {
    const { name, company, position, phone, province } = req.body;
    if (!name || !company || !position || !phone || !province) {
      return res.status(400).json({ error: "所有字段均为必填" });
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: "请输入有效的11位手机号" });
    }
    if (phone !== '15601323970') {
      const existing = db.prepare("SELECT id FROM checkins WHERE phone = ?").get(phone);
      if (existing) {
        return res.status(400).json({ error: "该手机号已签到" });
      }
    }
    try {
      const stmt = db.prepare("INSERT INTO checkins (name, company, position, phone, province) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(name, company, position, phone, province);
      const newCheckin = { id: result.lastInsertRowid, name, company, position, phone, province, created_at: new Date().toISOString() };
      io.emit("new-checkin", newCheckin);
      res.json({ success: true, data: newCheckin });
    } catch (err) {
      res.status(500).json({ error: "数据库错误" });
    }
  });

  app.get("/api/stats", (req, res) => {
    const count = db.prepare("SELECT COUNT(*) as total FROM checkins").get() as { total: number };
    res.json(count);
  });

  app.get("/api/checkins", (req, res) => {
    const rows = db.prepare("SELECT * FROM checkins ORDER BY created_at DESC").all();
    res.json(rows);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: false, watch: null }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => { res.sendFile(path.join(process.cwd(), "dist/index.html")); });
  }

  const PORT = process.env.PORT || 8080;
  httpServer.listen(PORT, "0.0.0.0", () => { console.log(`服务器运行在端口 ${PORT}`); });
}

startServer();
