const { put, list } = require('@vercel/blob');

// Hindari karakter yang gampang ketuker (0/O, 1/I/l) biar enak diketik ulang
const UID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genUid(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += UID_CHARS[Math.floor(Math.random() * UID_CHARS.length)];
  }
  return out;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Nama wajib diisi' });
    }

    // Pastikan UID belum dipakai (super kecil kemungkinan collision, tapi dicek biar aman)
    let uid;
    let exists = true;
    let tries = 0;
    while (exists && tries < 5) {
      uid = genUid();
      const found = await list({ prefix: `users/${uid}.json`, limit: 1 });
      exists = found.blobs.length > 0;
      tries++;
    }

    const data = {
      uid,
      name: name.trim(),
      txns: [],
      goal: 0,
      updatedAt: new Date().toISOString(),
    };

    await put(`users/${uid}.json`, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return res.status(200).json({ uid, name: data.name });
  } catch (err) {
    console.error('create account error:', err);
    return res.status(500).json({ error: 'Gagal membuat akun' });
  }
};
