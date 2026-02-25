import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Store connected SSE clients
const clients = new Set<express.Response>();

// Store recent logs in memory for the preview environment
const systemLogs: any[] = [];
const addLog = (type: 'info' | 'success' | 'error', message: string, details?: any) => {
  const log = { id: Date.now(), time: new Date().toISOString(), type, message, details };
  systemLogs.unshift(log);
  if (systemLogs.length > 50) systemLogs.pop();
  
  for (const client of clients) {
    client.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
  }
};

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

  // Status endpoint to check Supabase connection
  app.get("/api/status", async (req, res) => {
    if (!supabaseUrl || !supabaseKey) {
      return res.json({ configured: false, error: "Variáveis SUPABASE_URL e SUPABASE_ANON_KEY não encontradas nos Secrets." });
    }
    try {
      const { error } = await supabase.from('leads').select('id').limit(1);
      if (error) {
        return res.json({ configured: false, error: `Erro de conexão com a tabela: ${error.message}` });
      }
      res.json({ configured: true, message: "Conectado com sucesso!" });
    } catch (err: any) {
      res.json({ configured: false, error: err.message });
    }
  });

  // Webhook endpoint to receive data (supports /api/webhook and /api/webhook/test)
  app.post(["/api/webhook", "/api/webhook/:env"], async (req, res) => {
    try {
      const env = req.params.env === 'test' ? 'test' : 'production';
      const data = req.body;
      
      addLog('info', `Recebendo requisição no webhook (${env})`, data);
      
      let itemsToProcess: any[] = [];
      if (Array.isArray(data)) {
        itemsToProcess = data;
      } else if (typeof data === 'object' && data !== null) {
        if (data.nome_empresa || data.name || data.title) {
          itemsToProcess = [data];
        } else {
          itemsToProcess = Object.values(data).filter(item => typeof item === 'object' && item !== null);
          if (itemsToProcess.length === 0) {
            itemsToProcess = [data];
          }
        }
      } else {
        itemsToProcess = [{ raw: data }];
      }

      if (!supabaseUrl || !supabaseKey) {
        addLog('error', 'Supabase não configurado. Verifique os Secrets.');
        return res.status(500).json({ success: false, error: "Supabase não configurado" });
      }

      const recordsToInsert = itemsToProcess.map((item: any) => {
        const name = item.nome_empresa || item.name || item.title || "Desconhecido";
        const address = item.endereco || item.address || item.full_address || "";
        const phone = item.telefone || item.phone || item.phone_number || "";
        const website = item.website || item.site || "";
        const instagram = item.instagram || item.ig || "";
        const image_url = item.image_url || item.image || item.photo || item.thumbnail || "";
        const rating = item.rating || "";
        const reviews = item.reviews || "";
        const especialidades = item.especialidades || "";
        const idx = item.idx || item.id || "";
        const raw_data = { ...item, _environment: env };
        
        return { name, address, phone, website, instagram, image_url, rating, reviews, especialidades, idx, raw_data };
      });

      const { data: insertedData, error } = await supabase
        .from('leads')
        .insert(recordsToInsert)
        .select();

      if (error) {
        addLog('error', `Erro ao inserir no Supabase: ${error.message}`, error);
        console.error("Erro no Supabase:", error);
        throw error;
      }
      
      addLog('success', `${insertedData?.length || 0} leads salvos com sucesso!`, insertedData);
      
      // Notify all connected clients
      for (const client of clients) {
        if (insertedData) {
          insertedData.forEach(lead => {
            client.write(`data: ${JSON.stringify(lead)}\n\n`);
          });
        }
      }
      
      res.status(200).json({ success: true, message: "Dados recebidos com sucesso" });
    } catch (error: any) {
      addLog('error', `Erro interno no webhook: ${error.message}`, error);
      console.error("Erro no Webhook:", error);
      res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
  });

  // API to fetch logs
  app.get("/api/logs", (req, res) => {
    res.json(systemLogs);
  });

  // API to fetch leads for the frontend
  app.get("/api/leads", async (req, res) => {
    try {
      if (!supabaseUrl || !supabaseKey) {
        return res.json([]);
      }

      const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      res.json(leads || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      res.status(500).json({ error: "Erro ao buscar os dados" });
    }
  });

  // API to clear all leads
  app.delete("/api/leads", async (req, res) => {
    try {
      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "Supabase não configurado" });
      }

      // Supabase requires a filter to delete, we delete where id is not null
      const { error } = await supabase
        .from('leads')
        .delete()
        .not('id', 'is', null);

      if (error) throw error;
      
      // Notify clients to clear
      for (const client of clients) {
        client.write(`event: clear\ndata: {}\n\n`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Erro ao limpar dados:", error);
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
