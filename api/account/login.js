const { list } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, uid } = req.body || {};
    if (!name || !uid) {
      return res.status(400).json({ error: 'Nama dan ID wajib diisi' });
    }

    const found = await list({ prefix: `users/${uid.trim()}.json`, limit: 1 });
    if (!found.blobs.length) {
      return res.status(404).json({ error: 'ID tidak ditemukan' });
    }

    const fileRes = await fetch(found.blobs[0].url);
    if (!fileRes.ok) {
      return res.status(500).json({ error: 'Gagal mengambil data akun' });
    }
    const data = await fileRes.json();

    // Nama harus cocok sebagai lapisan pengecekan tambahan (bukan password sungguhan)
    if (String(data.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Nama tidak cocok dengan ID ini' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('login account error:', err);
    return res.status(500).json({ error: 'Gagal login' });
  }
};
