import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // CORS Headers
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const data = req.body;
    const env = req.query.env === 'test' ? 'test' : 'production';
    
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

    if (error) throw error;

    res.status(200).json({ success: true, data: insertedData });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
