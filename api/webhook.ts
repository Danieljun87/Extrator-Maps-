import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false, // desativa o parser automático
  },
};

// função para ler o body manualmente
async function getRawBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // lê o body bruto e parseia manualmente
    const rawBody = await getRawBody(req);
    console.log('Raw body recebido:', rawBody);

    let data: any = {};
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      // se não for JSON, tenta pegar como form-urlencoded
      console.log('Não é JSON, tentando como texto puro');
      data = { raw: rawBody };
    }

    console.log('Data parseada:', JSON.stringify(data));

    const env = req.query?.env === 'test' ? 'test' : 'production';
    
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

    const recordsToInsert = itemsToProcess.map((item: any) => {
      const name = item.nome_empresa || item.name || item.title || "Desconhecido";
      const address = item.endereco || item.address || item.full_address || "";
      const phone = item.telefone || item.phone || item.phone_number || "";
      const website = item.website || item.site || "";
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
      console.error('Supabase error:', JSON.stringify(error));
      return res.status(500).json({ success: false, error: error.message });
    }

    res.status(200).json({ success: true, data: insertedData });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}