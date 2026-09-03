const { get, put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { name, uid } = req.body || {};
    if (!name || !uid) {
      return res.status(400).json({ error: 'Sesi tidak valid' });
    }

    const pathname = `users/${uid.trim()}.json`;
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result) {
      // Akun udah gak ada (misal kehapus) -> anggap logout berhasil
      return res.status(200).json({ ok: true });
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

    if (String(data.name).trim().toLowerCase() === String(name).trim().toLowerCase()) {
      data.sessionActive = false;
      data.updatedAt = new Date().toISOString();
      await put(pathname, JSON.stringify(data), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('logout account error:', err);
    return res.status(500).json({ error: 'Gagal logout' });
  }
};
