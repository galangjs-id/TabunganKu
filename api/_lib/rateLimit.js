const { get, put } = require('@vercel/blob');

// Rate limiter sederhana berbasis Vercel Blob (biar gak nambah dependency/
// service baru). Bukan yang paling presisi (ada kemungkinan race condition
// kecil kalau ada 2 request bersamaan super cepat dari IP yang sama), tapi
// cukup buat nahan brute-force/spam kasar ke endpoint akun.
//
// Setiap bucket (mis. "login") + IP disimpen sebagai satu file kecil di
// `ratelimit/{bucket}/{ip}.json` berisi { count, resetAt }.

const WINDOW_MS = 60 * 1000; // window 1 menit

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function sanitizeIpForPath(ip) {
  // Path Blob gak boleh aneh-aneh; ganti karakter non alfanumerik jadi '_'
  return String(ip).replace(/[^a-zA-Z0-9.:-]/g, '_');
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {string} bucket - nama endpoint, mis. 'login', 'create', 'delete'
 * @param {number} maxRequests - batas jumlah request per window per IP
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
async function checkRateLimit(req, bucket, maxRequests) {
  const ip = sanitizeIpForPath(getClientIp(req));
  const pathname = `ratelimit/${bucket}/${ip}.json`;
  const now = Date.now();

  let state = { count: 0, resetAt: now + WINDOW_MS };
  try {
    const existing = await get(pathname, { access: 'private', useCache: false });
    if (existing) {
      const text = await new Response(existing.stream).text();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.resetAt === 'number' && parsed.resetAt > now) {
        state = parsed;
      }
    }
  } catch (e) {
    // Kalau gagal baca (mis. belum pernah ada), anggap aja belum ada request
  }

  state.count += 1;
  const allowed = state.count <= maxRequests;

  try {
    await put(pathname, JSON.stringify(state), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
  } catch (e) {
    // Kalau gagal nyimpen state, biarin request tetep lanjut (fail-open)
    // daripada nge-block user gara-gara masalah infra rate limiter-nya sendiri.
    console.error('rateLimit write error:', e);
  }

  return { allowed, remaining: Math.max(0, maxRequests - state.count) };
}

module.exports = { checkRateLimit };
