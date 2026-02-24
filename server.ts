import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

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
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

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
      const raw_data = JSON.stringify(data);

      const stmt = db.prepare(`
        INSERT INTO leads (name, address, phone, website, instagram, raw_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(name, address, phone, website, instagram, raw_data);
      
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
