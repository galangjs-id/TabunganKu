const { put, get } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { uid, name, txns, goal } = req.body || {};
    if (!uid || !name) {
      return res.status(400).json({ error: 'Sesi tidak valid' });
    }

    // Pastikan akunnya beneran ada sebelum ditimpa
    const existing = await get(`users/${uid}.json`, { access: 'private', useCache: false });
    if (!existing) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    const data = {
      uid,
      name,
      txns: Array.isArray(txns) ? txns : [],
      goal: typeof goal === 'number' ? goal : 0,
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
