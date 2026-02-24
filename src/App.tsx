import React, { useEffect, useState } from 'react';
import { MapPin, Phone, Instagram, Globe, Trash2, Copy, CheckCircle2, Settings, Activity, Server, Play, AlertCircle, CheckCircle } from 'lucide-react';

type Lead = {
  id: number;
  name: string;
  address: string;
  phone: string;
  website: string;
  instagram: string;
  image_url: string;
  created_at: string;
  raw_data: string;
};

type FilterType = 'all' | 'with_instagram' | 'without_website' | 'with_website';

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [webhookMode, setWebhookMode] = useState<'test' | 'production'>('test');
  const [dbStatus, setDbStatus] = useState<{configured: boolean, message?: string, error?: string} | null>(null);

  // The webhook URL based on the current app URL and mode
  const webhookUrl = `${window.location.origin}/api/webhook${webhookMode === 'test' ? '/test' : ''}`;

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/status');
      setDbStatus(await res.json());
    } catch (error) {
      setDbStatus({ configured: false, error: "Servidor offline ou inacessível." });
    }
  };

  const simulateWebhook = async () => {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: "Local de Teste " + Math.floor(Math.random() * 1000),
          address: "Rua Fictícia, 123 - Centro",
          phone: "(11) 99999-9999",
          website: "https://exemplo.com",
          instagram: "@exemplo_teste",
          image_url: `https://picsum.photos/seed/${Math.random()}/400/300`,
          simulated: true
        })
      });
    } catch (error) {
      console.error("Erro ao simular:", error);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      setLeads(data);
    } catch (error) {
      console.error("Failed to fetch leads", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkDbStatus();
    fetchLeads();
    
    // Connect to SSE for real-time updates
    const eventSource = new EventSource('/api/stream');
    
    eventSource.onmessage = (event) => {
      const newLead = JSON.parse(event.data);
      setLeads((prev) => [newLead, ...prev]);
      
      // Show receiving animation
      setIsReceiving(true);
      setTimeout(() => setIsReceiving(false), 2000);
    };

    eventSource.addEventListener('clear', () => {
      setLeads([]);
    });

    return () => eventSource.close();
  }, []);

  const clearLeads = async () => {
    if (!confirm('Tem certeza que deseja limpar todos os dados recebidos?')) return;
    try {
      await fetch('/api/leads', { method: 'DELETE' });
      setLeads([]);
    } catch (error) {
      console.error("Failed to clear leads", error);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLeads = leads.filter(lead => {
    if (filter === 'with_instagram') {
      return lead.instagram && lead.instagram.trim() !== '';
    }
    if (filter === 'without_website') {
      return !lead.website || lead.website.trim() === '';
    }
    if (filter === 'with_website') {
      return lead.website && lead.website.trim() !== '';
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto p-6">
        <header className="mb-10 border-b border-blue-900/30 pb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                <MapPin className="text-blue-500" size={32} />
                Google Maps Leads
              </h1>
              <p className="text-slate-400 mb-6">
                Receba e filtre dados do Google Maps via Webhook em tempo real.
              </p>
            </div>
            
            {isReceiving && (
              <div className="flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full border border-blue-500/30 animate-pulse">
                <Settings className="animate-spin" size={18} />
                <span className="text-sm font-medium">Recebendo dados...</span>
              </div>
            )}
          </div>
          
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button 
                  onClick={() => setWebhookMode('test')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${webhookMode === 'test' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Activity size={16} />
                  URL de Teste
                </button>
                <button 
                  onClick={() => setWebhookMode('production')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${webhookMode === 'production' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  <Server size={16} />
                  URL de Produção
                </button>
              </div>
              
              <button 
                onClick={simulateWebhook}
                className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 border border-slate-700"
              >
                <Play size={14} />
                Simular Envio
              </button>
            </div>

            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Sua URL de Webhook (Método POST)</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <code className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-blue-300 font-mono text-sm overflow-x-auto whitespace-nowrap">
                {webhookUrl}
              </code>
              <button 
                onClick={copyWebhook}
                className={`${webhookMode === 'test' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap`}
              >
                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copied ? 'Copiado!' : 'Copiar URL'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Configure sua ferramenta para enviar um POST para esta URL. Campos suportados: <code className="text-slate-400">name, address, phone, website, instagram, image_url</code>.
            </p>
          </div>

          {dbStatus && (
            <div className={`mt-6 border rounded-xl p-4 flex items-start gap-3 ${dbStatus.configured ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-amber-900/20 border-amber-500/30'}`}>
              <div className="mt-0.5">
                {dbStatus.configured ? <CheckCircle className="text-emerald-500" size={20} /> : <AlertCircle className="text-amber-500" size={20} />}
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${dbStatus.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Status do Banco de Dados: {dbStatus.configured ? 'Conectado' : 'Não Configurado ou Erro'}
                </h3>
                <p className={`text-xs mt-1 ${dbStatus.configured ? 'text-emerald-200/70' : 'text-amber-200/70'}`}>
                  {dbStatus.configured 
                    ? "O Supabase está conectado e pronto para receber dados." 
                    : dbStatus.error}
                </p>
                
                {!dbStatus.configured && (
                  <div className="mt-3">
                    <p className="text-xs text-amber-200/70 mb-2">
                      1. Adicione <strong>SUPABASE_URL</strong> e <strong>SUPABASE_ANON_KEY</strong> no painel de Secrets (cadeado).<br/>
                      2. Rode este SQL no seu Supabase:
                    </p>
                    <code className="block bg-black/30 p-2 rounded text-xs text-amber-100/60 font-mono overflow-x-auto">
                      CREATE TABLE leads (<br/>
                      &nbsp;&nbsp;id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,<br/>
                      &nbsp;&nbsp;name TEXT,<br/>
                      &nbsp;&nbsp;address TEXT,<br/>
                      &nbsp;&nbsp;phone TEXT,<br/>
                      &nbsp;&nbsp;website TEXT,<br/>
                      &nbsp;&nbsp;instagram TEXT,<br/>
                      &nbsp;&nbsp;image_url TEXT,<br/>
                      &nbsp;&nbsp;raw_data JSONB,<br/>
                      &nbsp;&nbsp;created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL<br/>
                      );
                    </code>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        <main>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilter('with_instagram')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'with_instagram' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                <Instagram size={16} />
                Com Instagram
              </button>
              <button
                onClick={() => setFilter('with_website')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'with_website' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                <Globe size={16} />
                Com Site
              </button>
              <button
                onClick={() => setFilter('without_website')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${filter === 'without_website' ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
              >
                Sem Site
              </button>
            </div>

            <button 
              onClick={clearLeads}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Limpar Dados
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
              <MapPin className="mx-auto h-12 w-12 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-1">Nenhum dado encontrado</h3>
              <p className="text-slate-500">
                {leads.length === 0 
                  ? (dbStatus?.configured ? "Banco conectado! Aguardando o envio dos dados via Webhook..." : "Configure o banco de dados para começar a receber informações.")
                  : "Nenhum resultado para o filtro selecionado."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLeads.map(lead => (
                <div key={lead.id} className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl overflow-hidden transition-all group flex flex-col h-full">
                  {lead.image_url && (
                    <div className="w-full h-48 bg-slate-800 relative overflow-hidden">
                      <img 
                        src={lead.image_url} 
                        alt={lead.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start gap-2 mb-4">
                      <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">{lead.name}</h3>
                      {lead.raw_data && typeof lead.raw_data === 'object' && (lead.raw_data as any)._environment === 'test' && (
                        <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-blue-500/30 shrink-0">
                          Teste
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-3 text-sm flex-1">
                    {lead.address && (
                      <div className="flex items-start gap-3 text-slate-400">
                        <MapPin size={16} className="mt-0.5 text-blue-500 shrink-0" />
                        <span className="line-clamp-2">{lead.address}</span>
                      </div>
                    )}
                    
                    {lead.phone && (
                      <div className="flex items-center gap-3 text-slate-400">
                        <Phone size={16} className="text-blue-500 shrink-0" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    
                    {lead.website && (
                      <div className="flex items-center gap-3 text-slate-400">
                        <Globe size={16} className="text-blue-500 shrink-0" />
                        <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">
                          {lead.website.replace(/^https?:\/\//i, '')}
                        </a>
                      </div>
                    )}
                    
                    {lead.instagram && (
                      <div className="flex items-center gap-3 text-slate-400">
                        <Instagram size={16} className="text-blue-500 shrink-0" />
                        <a href={lead.instagram.startsWith('http') ? lead.instagram : `https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">
                          {lead.instagram}
                        </a>
                      </div>
                    )}
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-500 flex justify-between items-center">
                      <span>Recebido em:</span>
                      <span>{new Date(lead.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
