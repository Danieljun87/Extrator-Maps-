import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import cors from "cors";

const db = new Database("data.db");

// Create the table for the leads
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    instagram TEXT,
    image_url TEXT,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Try to add image_url column if it doesn't exist (for existing DBs)
try {
  db.exec("ALTER TABLE leads ADD COLUMN image_url TEXT");
} catch (e) {
  // Column already exists, ignore
}

// Store connected SSE clients
const clients = new Set<express.Response>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow CORS from anywhere for the webhook
  app.use(cors());

  // Middleware to parse JSON and URL-encoded bodies with larger limits for images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // SSE endpoint for real-time updates
  app.get("/api/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  // Webhook endpoint to receive data
  app.post("/api/webhook", (req, res) => {
    try {
      const data = req.body;
      
      // Try to extract common fields from typical Google Maps scrapers
      const name = data.name || data.title || "Desconhecido";
      const address = data.address || data.full_address || "";
      const phone = data.phone || data.phone_number || "";
      const website = data.website || data.site || "";
      const instagram = data.instagram || data.ig || "";
      const image_url = data.image_url || data.image || data.photo || data.thumbnail || "";
      const raw_data = JSON.stringify(data);

      const stmt = db.prepare(`
        INSERT INTO leads (name, address, phone, website, instagram, image_url, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run(name, address, phone, website, instagram, image_url, raw_data);
      
      // Fetch the newly inserted lead
      const newLead = db.prepare("SELECT * FROM leads WHERE id = ?").get(info.lastInsertRowid);

      // Notify all connected clients
      for (const client of clients) {
        client.write(`data: ${JSON.stringify(newLead)}\n\n`);
      }
      
      res.status(200).json({ success: true, message: "Dados recebidos com sucesso" });
    } catch (error) {
      console.error("Erro no Webhook:", error);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  });

  // API to fetch leads for the frontend
  app.get("/api/leads", (req, res) => {
    try {
      const stmt = db.prepare("SELECT * FROM leads ORDER BY created_at DESC");
      const leads = stmt.all();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar os dados" });
    }
  });

  // API to clear all leads
  app.delete("/api/leads", (req, res) => {
    try {
      db.prepare("DELETE FROM leads").run();
      
      // Notify clients to clear
      for (const client of clients) {
        client.write(`event: clear\ndata: {}\n\n`);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Erro ao limpar os dados" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
