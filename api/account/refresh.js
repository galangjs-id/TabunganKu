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
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

    if (String(data.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Sesi tidak valid' });
    }

    // Device ini udah lolos cek nama+ID (berarti emang pegang kredensial akun ini),
    // jadi sekalian "klaim ulang" sessionActive tiap refresh. Ini juga otomatis
    // nge-migrasi akun lama yang filenya belum pernah punya field sessionActive.
    data.sessionActive = true;
    data.updatedAt = new Date().toISOString();
    await put(pathname, JSON.stringify(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('refresh account error:', err);
    return res.status(500).json({ error: 'Gagal memuat data' });
  }
};
