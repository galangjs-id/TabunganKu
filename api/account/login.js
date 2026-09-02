const { get } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, uid } = req.body || {};
    if (!name || !uid) {
      return res.status(400).json({ error: 'Nama dan ID wajib diisi' });
    }

    let result;
    try {
      result = await get(`users/${uid.trim()}.json`, { access: 'private' });
    } catch (err) {
      return res.status(404).json({ error: 'ID tidak ditemukan' });
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

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
