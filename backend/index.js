import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { user, error } = await supabase.auth.api.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/measurements', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { from, to } = req.query;

  let query = supabase
    .from('measurements')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (from) {
    query = query.gte('date', from);
  }
  if (to) {
    query = query.lte('date', to);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json(data || []);
});

app.post('/api/measurements', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { date, systolic, diastolic, pulse, notes } = req.body;

  if (!date || !systolic || !diastolic || !pulse) {
    return res.status(400).json({ error: 'Date, systolic, diastolic and pulse are required' });
  }

  const { data, error } = await supabase.from('measurements').insert([
    {
      user_id: userId,
      date,
      systolic,
      diastolic,
      pulse,
      notes: notes || ''
    }
  ]);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data[0]);
});

app.put('/api/measurements/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { date, systolic, diastolic, pulse, notes } = req.body;

  const { data, error } = await supabase
    .from('measurements')
    .update({ date, systolic, diastolic, pulse, notes })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

app.delete('/api/measurements/:id', authenticate, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const { error } = await supabase.from('measurements').delete().eq('id', id).eq('user_id', userId);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(204).send();
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
