const { get, del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, uid } = req.body || {};
    if (!name || !uid) {
      return res.status(400).json({ error: 'Nama dan ID wajib diisi' });
    }

    const pathname = `users/${uid.trim()}.json`;

    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

    // Cek nama cocok dulu sebelum beneran dihapus (lapisan pengecekan tambahan)
    if (String(data.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Nama tidak cocok dengan ID ini' });
    }

    await del(pathname);
    await del(`names/${encodeURIComponent(String(data.name).trim().toLowerCase())}.json`);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete account error:', err);
    return res.status(500).json({ error: 'Gagal menghapus akun' });
  }
};
