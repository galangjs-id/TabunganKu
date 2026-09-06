const { get, put, del } = require('@vercel/blob');

// Sebelumnya, cek nama unik scan SEMUA blob users/*.json satu-satu tiap ada
// pendaftaran (O(n), makin lambat & makin mahal makin banyak user). Di sini
// kita simpen index kecil terpisah: names/{nama-dinormalisasi}.json -> { uid }
// biar cek "nama udah dipake belum" tinggal satu kali get() (O(1)).
//
// CATATAN MIGRASI: kalau sebelum update ini udah ada akun yang dibikin lewat
// create.js versi lama (yang belum nulis index ini), akun2 itu TIDAK bakal
// kedeteksi lewat nameTaken() yang baru. Kalau perlu, jalanin migrasi sekali
// buat generate `names/*.json` dari seluruh `users/*.json` yang udah ada.

function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

function nameIndexPath(name) {
  // Encode biar nama dengan karakter aneh/spasi tetep jadi path Blob yang valid
  return `names/${encodeURIComponent(normalizeName(name))}.json`;
}

async function isNameTaken(name) {
  const result = await get(nameIndexPath(name), { access: 'private', useCache: false });
  return result !== null;
}

async function reserveName(name, uid) {
  await put(nameIndexPath(name), JSON.stringify({ uid }), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

async function releaseName(name) {
  try {
    await del(nameIndexPath(name));
  } catch (e) {
    // Gapapa kalau index-nya emang udah gak ada
  }
}

module.exports = { isNameTaken, reserveName, releaseName, normalizeName };
