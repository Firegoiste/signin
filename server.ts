import express from "express"; // 导入 Express 框架
import { createServer } from "http"; // 导入 HTTP 服务创建函数
import { Server } from "socket.io"; // 导入 Socket.io 服务端
import Database from "better-sqlite3"; // 导入 SQLite 数据库驱动
import path from "path"; // 导入路径处理模块
import { createServer as createViteServer } from "vite"; // 导入 Vite 开发服务器创建函数

const db = new Database("checkin.db"); // 初始化 SQLite 数据库文件

// 初始化数据库表结构
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
  // 列可能已经存在，忽略错误
}

async function startServer() {
  const app = express(); // 创建 Express 应用
  const httpServer = createServer(app); // 创建 HTTP 服务器
  // 初始化 Socket.io 并配置跨域和传输方式
  const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  });

  app.use(express.json()); // 启用 JSON 解析中间件

  // API 路由：提交签到信息
  app.post("/api/checkin", (req, res) => {
    const { name, company, position, phone, province } = req.body;
    
    // 基础参数验证
    if (!name || !company || !position || !phone || !province) {
      return res.status(400).json({ error: "所有字段均为必填" });
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: "请输入有效的11位手机号" });
    }

    // 检查是否已签到（特定手机号除外）
    if (phone !== '15601323970') {
      const existing = db.prepare("SELECT id FROM checkins WHERE phone = ?").get(phone);
      if (existing) {
        return res.status(400).json({ error: "该手机号已签到" });
      }
    }

    try {
      // 插入数据到数据库
      const stmt = db.prepare("INSERT INTO checkins (name, company, position, phone, province) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(name, company, position, phone, province);
      
      const newCheckin = {
        id: result.lastInsertRowid,
        name,
        company,
        position,
        phone,
        province,
        created_at: new Date().toISOString()
      };

      // 通过 Socket.io 实时广播给大屏和管理后台
      io.emit("new-checkin", newCheckin);
      
      res.json({ success: true, data: newCheckin });
    } catch (err) {
      res.status(500).json({ error: "数据库错误" });
    }
  });

  // API 路由：获取统计数据
  app.get("/api/stats", (req, res) => {
    const count = db.prepare("SELECT COUNT(*) as total FROM checkins").get() as { total: number };
    res.json(count);
  });

  // API 路由：获取所有签到记录
  app.get("/api/checkins", (req, res) => {
    const rows = db.prepare("SELECT * FROM checkins ORDER BY created_at DESC").all();
    res.json(rows);
  });

  // 开发环境下集成 Vite 中间件
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // 生产环境下提供静态文件服务
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  const PORT = 3000; // 绑定 3000 端口
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}

startServer(); // 启动服务器
