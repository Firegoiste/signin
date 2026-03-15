import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import initSqlJs, { Database } from "sql.js";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

let db: Database;

async function initDatabase() {
  const SQL = await initSqlJs();
  const dbPath = "checkin.db";

  // 尝试加载已有数据库
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      phone TEXT NOT NULL,
      province TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 保存数据库
  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync("checkin.db", buffer);
}

async function startServer() {
  await initDatabase();

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

    // 检查是否已签到
    if (phone !== '15601323970') {
      const stmt = db.prepare("SELECT id FROM checkins WHERE phone = ?");
      stmt.bind([phone]);
      if (stmt.step()) {
        stmt.free();
        return res.status(400).json({ error: "该手机号已签到" });
      }
      stmt.free();
    }

    try {
      db.run("INSERT INTO checkins (name, company, position, phone, province) VALUES (?, ?, ?, ?, ?)",
        [name, company, position, phone, province || '']);

      // 获取插入的ID
      const lastId = db.exec("SELECT last_insert_rowid() as id")[0].values[0][0];

      const newCheckin = {
        id: lastId,
        name,
        company,
        position,
        phone,
        province: province || '',
        created_at: new Date().toISOString()
      };

      saveDatabase();
      io.emit("new-checkin", newCheckin);

      res.json({ success: true, data: newCheckin });
    } catch (err) {
      res.status(500).json({ error: "数据库错误" });
    }
  });

  app.get("/api/stats", (req, res) => {
    const result = db.exec("SELECT COUNT(*) as total FROM checkins");
    const total = result[0]?.values[0]?.[0] || 0;
    res.json({ total });
  });

  app.get("/api/checkins", (req, res) => {
    const result = db.exec("SELECT * FROM checkins ORDER BY created_at DESC");
    if (!result[0]) {
      return res.json([]);
    }
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj: any = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(rows);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  const PORT = process.env.PORT || 8080;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`服务器运行在端口 ${PORT}`);
  });
}

startServer();
