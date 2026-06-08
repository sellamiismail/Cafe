import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import dns from 'dns';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setDefaultResultOrder('verbatim');

const app = express();
const port = process.env.PORT || 5050;

/* ================= MIDDLEWARES ================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static files
app.use(express.static(path.join(__dirname, 'file')));

/* ================= SUPABASE CLIENT ================= */

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/* ================= DATABASE (Supabase PostgreSQL) ================= */

if (!process.env.DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL in environment variables.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ================= START SERVER ================= */

async function startServer() {
  try {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      const host = dbUrl.hostname;
      console.log('ℹ️ DATABASE_URL host:', JSON.stringify(host));
      const addresses = await dns.promises.lookup(host, { all: true });
      console.log('ℹ️ DNS lookup result:', addresses);
    } catch (e) {
      console.error('❌ Failed to parse/resolve DATABASE_URL host:', e?.message || e);
    }

    await client.connect();
    console.log('✅ Database connected (Supabase)');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
  });
}

startServer();

/* ================= ROUTES ================= */

// home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'file', 'html', 'index.html'));
});

app.get('/supabase-health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categorie').select('*').limit(1);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.json({ ok: true, sample: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'UNKNOWN_ERROR' });
  }
});

// get categories
app.get('/getdata', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM categorie');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// get products
app.get('/product', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM product');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB_ERROR' });
  }
});

// create order
app.post('/demander', async (req, res) => {
  const payload = req.body || {};
  const numtable =10;
 
  const items = Array.isArray(payload.items) ? payload.items : [];
  const totale = Number(payload.totale);
  
  if (!items.length){
    return res.status(400).json({ success: false, error: 'EMPTY_CART' });
    console.log('⚠️ Empty cart received');
    }
 
  if (!totale){
    console.log('⚠️ Invalid total received');
    return res.status(400).json({ success: false, error: 'INVALID_TOTAL' });
  }
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8);

  let idrecu;

  try {
    await client.query('BEGIN');

    const verifyTable = await client.query(
      'SELECT idrecu FROM recu WHERE id=$1 AND heurf IS NULL',
      [numtable]
    );

    if (verifyTable.rowCount === 0) {
      const recuInsert = await client.query(
        'INSERT INTO recu (id, totale, date, heurd, heurf, type) VALUES ($1,$2,$3,$4,$5,$6) RETURNING idrecu',
        [numtable, totale, dateStr, timeStr, null, 'pending']
        
      );
      

      idrecu = recuInsert.rows[0].idrecu;

    }  else {
    idrecu = verifyTable.rows[0].idrecu;
      
    const updateResult = await client.query(
        'UPDATE recu SET totale=totale+$1 , type=$3 WHERE idrecu=$2 RETURNING idrecu, totale',
        [Number(totale), idrecu, 'pending']
    );
console.log('ℹ️ Existing open recu found for table', numtable, 'with idrecu:', idrecu);
    if (updateResult.rowCount > 0) {
        console.log('✅ Updated existing recu:', updateResult.rows[0]);
    } else {
        console.log('⚠️ No recu was updated. Something went wrong.');
    }
} 
    for (const item of items) {
      await client.query(
        'INSERT INTO orderr (idrecu, id, idname, optionn,status,type) VALUES ($1,$2,$3,$4,$5,$6 )',
        [idrecu, numtable, String(item.idname), item.optionn ?? null, 'online', 'Pending']
      );
    }
console.log('ℹ️ Current idrecu:', idrecu);
    await client.query('COMMIT');

    res.json({ success: true, idrecu });
  } catch (err) {
    await client.query('ROLLBACK');         
    console.error(err);
    res.status(500).json({ success: false });
  }
}); 
