const { put, get, list } = require('@vercel/blob');

// Hindari karakter yang gampang ketuker (0/O, 1/I/l) biar enak diketik ulang
const UID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genUid(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += UID_CHARS[Math.floor(Math.random() * UID_CHARS.length)];
  }
  return out;
}

async function uidExists(uid) {
  const result = await get(`users/${uid}.json`, { access: 'private', useCache: false });
  return result !== null;
}

// Satu nama cuma boleh dipakai satu akun. Field "name" udah ada di tiap
// users/*.json, jadi tinggal list semua user terus dicocokin — gak perlu index
// terpisah, otomatis kepakai buat akun lama juga.
async function nameTaken(name) {
  const target = name.trim().toLowerCase();
  const { blobs } = await list({ prefix: 'users/', access: 'private' });
  for (const blob of blobs) {
    const result = await get(blob.pathname, { access: 'private', useCache: false });
    if (!result) continue;
    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);
    if (String(data.name).trim().toLowerCase() === target) return true;
  }
  return false;
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

    if (await nameTaken(name)) {
      return res.status(409).json({ error: 'Nama telah digunakan', code: 'NAME_TAKEN' });
    }

    // Pastikan UID belum dipakai (super kecil kemungkinan collision, tapi dicek biar aman)
    let uid;
    let tries = 0;
    do {
      uid = genUid();
      tries++;
    } while (tries < 5 && (await uidExists(uid)));

    const data = {
      uid,
      name: name.trim(),
      txns: [],
      goal: 0,
      sessionActive: true, // device yang bikin akun otomatis jadi sesi aktif
      updatedAt: new Date().toISOString(),
    };

    await put(`users/${uid}.json`, JSON.stringify(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('create account error:', err);
    return res.status(500).json({ error: 'Gagal membuat akun' });
  }
};
