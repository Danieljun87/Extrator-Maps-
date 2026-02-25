import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, address, phone, website, rating, reviews, especialidades, idx, raw_data, created_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    
    if (id) {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } else {
      const { error } = await supabase.from('leads').delete().neq('id', 0);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}