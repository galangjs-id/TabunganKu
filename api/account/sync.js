const { put, get } = require('@vercel/blob');

const MAX_TXNS = 20000; // batas wajar transaksi per akun
const MAX_STRING_LEN = 300; // batas panjang category/note per transaksi
const MAX_AMOUNT = 1e15; // batas nominal wajar (mencegah nilai ekstrem/Infinity)

// sync.js bisa dipanggil langsung (bukan cuma dari UI), jadi field yang
// dikirim gak boleh dianggap otomatis "aman" cuma karena UI selalu ngirim
// bentuk yang benar. Validasi tipe + ukuran di sini juga nutup celah field
// kayak `category` yang dulu ke-render tanpa escape di index.html.
function isValidTxn(t) {
  if (!t || typeof t !== 'object') return false;
  if (typeof t.id !== 'string' || !t.id || t.id.length > 100) return false;
  if (t.type !== 'income' && t.type !== 'expense') return false;
  if (typeof t.amount !== 'number' || !Number.isFinite(t.amount) || t.amount <= 0 || t.amount > MAX_AMOUNT) return false;
  if (typeof t.category !== 'string' || t.category.length > MAX_STRING_LEN) return false;
  if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return false;
  if (t.note !== undefined && t.note !== null) {
    if (typeof t.note !== 'string' || t.note.length > MAX_STRING_LEN) return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { uid, name, txns, goal } = req.body || {};
    if (!uid || !name) {
      return res.status(400).json({ error: 'Sesi tidak valid' });
    }

    if (!Array.isArray(txns)) {
      return res.status(400).json({ error: 'Format transaksi tidak valid' });
    }
    if (txns.length > MAX_TXNS) {
      return res.status(400).json({ error: `Jumlah transaksi melebihi batas (${MAX_TXNS})` });
    }
    if (!txns.every(isValidTxn)) {
      return res.status(400).json({ error: 'Ada transaksi dengan format tidak valid' });
    }
    if (goal !== undefined && (typeof goal !== 'number' || !Number.isFinite(goal) || goal < 0 || goal > MAX_AMOUNT)) {
      return res.status(400).json({ error: 'Target tabungan tidak valid' });
    }

    // Pastikan akunnya beneran ada sebelum ditimpa
    const existing = await get(`users/${uid}.json`, { access: 'private', useCache: false });
    if (!existing) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const existingText = await new Response(existing.stream).text();
    const existingData = JSON.parse(existingText);

    // Nama harus cocok, sama kayak login/delete — biar UID doang nggak cukup buat nimpa data orang
    if (String(existingData.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Nama tidak cocok dengan ID ini' });
    }

    const data = {
      uid,
      name,
      txns,
      goal: typeof goal === 'number' ? goal : 0,
      sessionActive: true,
      updatedAt: new Date().toISOString(),
    };

    await put(`users/${uid}.json`, JSON.stringify(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('sync account error:', err);
    return res.status(500).json({ error: 'Gagal sinkronisasi' });
  }
};
