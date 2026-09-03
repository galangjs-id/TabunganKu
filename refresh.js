const { get } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, uid } = req.body || {};
    if (!name || !uid) {
      return res.status(400).json({ error: 'Sesi tidak valid' });
    }

    const result = await get(`users/${uid.trim()}.json`, { access: 'private', useCache: false });
    if (!result) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

    if (String(data.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Sesi tidak valid' });
    }

    // Endpoint ini sengaja TIDAK cek/ubah sessionActive — cuma buat device yang
    // udah pegang sesi narik data terbaru pas buka app, bukan buat login baru.
    return res.status(200).json(data);
  } catch (err) {
    console.error('refresh account error:', err);
    return res.status(500).json({ error: 'Gagal memuat data' });
  }
};
