/**
 * Idempotency-Key untuk endpoint yang mengubah data.
 *
 * TODO:
 *  - Wajibkan header Idempotency-Key
 *  - Klaim key secara atomik (SET NX + TTL) per user + method + URL
 *  - Key sudah selesai -> replay response tersimpan; masih diproses -> 409
 *  - Bungkus res.json untuk menyimpan hasil; error 5xx -> hapus key agar bisa diulang
 */

const { redis } = require('../config/redis');
const ApiError = require('../utils/ApiError');

const PROCESSING_TTL = 60;        // detik: batas waktu "sedang diproses"
const COMPLETED_TTL = 24 * 3600;  // hasil disimpan 24 jam

module.exports = () => async (req, res, next) => {
  try {
    const key = req.get('Idempotency-Key');
    if (!key || key.length > 128) {
      return next(new ApiError(400, 'Idempotency-Key header is required (max 128 chars)'));
    }
    // kunci dibatasi per user + method + URL, jadi user lain tidak bisa "menabrak" kunci Anda
    const redisKey = `idem:${req.user.id}:${req.method}:${req.originalUrl}:${key}`;

    // SET ... NX = hanya berhasil bila key belum ada. Atomik: bila dua request
    // datang bersamaan, tepat satu yang "menang" mengklaim kunci itu.
    const claimed = await redis.set(redisKey, JSON.stringify({ state: 'processing' }), 'EX', PROCESSING_TTL, 'NX');

    if (!claimed) {
      const saved = JSON.parse((await redis.get(redisKey)) || 'null');
      if (saved && saved.state === 'completed') {
        res.set('Idempotent-Replay', 'true');
        return res.status(saved.status).json(saved.body);   // putar ulang hasil lama
      }
      return next(new ApiError(409, 'A request with this Idempotency-Key is still being processed'));
    }

    // Bungkus res.json untuk menangkap hasil akhirnya sebelum dikirim ke client
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 500) {
        redis.del(redisKey).catch(() => {}); // error server: izinkan client mengulang
      } else {
        redis
          .set(redisKey, JSON.stringify({ state: 'completed', status: res.statusCode, body }), 'EX', COMPLETED_TTL)
          .catch(() => {});
      }
      return originalJson(body);
    };
    return next();
  } catch (err) {
    return next(err); // Express 4 tidak menangkap error dari middleware async otomatis
  }
};