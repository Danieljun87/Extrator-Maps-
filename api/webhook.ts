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
    const name = data.name || data.title || "Desconhecido";
    const address = data.address || data.full_address || "";
    const phone = data.phone || data.phone_number || "";
    const website = data.website || data.site || "";
    const instagram = data.instagram || data.ig || "";
    const image_url = data.image_url || data.image || data.photo || data.thumbnail || "";
    const raw_data = { ...data, _environment: env };

    const { data: insertedData, error } = await supabase
      .from('leads')
      .insert([{ name, address, phone, website, instagram, image_url, raw_data }])
      .select()
      .single();

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