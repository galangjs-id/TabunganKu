const { get, put } = require('@vercel/blob');

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
      return res.status(404).json({ error: 'ID tidak ditemukan' });
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

    // Nama harus cocok sebagai lapisan pengecekan tambahan (bukan password sungguhan)
    if (String(data.name).trim().toLowerCase() !== String(name).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Nama tidak cocok dengan ID ini' });
    }

    // Satu akun cuma boleh dipakai di satu perangkat dalam satu waktu.
    // Kalau masih ada sesi aktif (belum logout), tolak login baru.
    if (data.sessionActive) {
      return res.status(409).json({
        error: 'Akun sedang digunakan di perangkat lain',
        code: 'SESSION_ACTIVE',
      });
    }

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
    console.error('login account error:', err);
    return res.status(500).json({ error: 'Gagal login' });
  }
};
