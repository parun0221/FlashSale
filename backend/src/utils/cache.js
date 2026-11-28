/**
 * Helper cache Redis.
 *
 * TODO:
 *  - getOrSet(key, ttl, loader): cache-aside, Redis error tidak boleh mematikan request
 *  - version/bump: invalidasi berbasis versi tanpa KEYS/SCAN
 */

const { redis } = require('../config/redis');
const { cacheRequests } = require('./metrics');

// Permintaan yang sedang memuat dari sumber asli, per key (khusus satu proses).
const inflight = new Map();

/**
 * Cache-aside: baca dari Redis; bila kosong, panggil loader lalu simpan dengan TTL.
 * Bila banyak request miss pada key yang sama bersamaan, hanya SATU yang memanggil loader.
 */
async function getOrSet(key, ttlSeconds, loader) {
  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      cacheRequests.inc({ result: 'hit' });
      return JSON.parse(hit);
    }
  } catch {
    /* Redis bermasalah: lanjut ke sumber asli. Cache tidak boleh mematikan request. */
  }

  cacheRequests.inc({ result: 'miss' });
  if (inflight.has(key)) return inflight.get(key); // sudah ada yang memuat: ikut menunggu

  const promise = (async () => {
    cacheRequests.inc({ result: 'load' }); // loader benar-benar dijalankan (database dibaca)
    const value = await loader();
    if (value !== null && value !== undefined) {
      redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
    }
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

// Invalidasi berbasis versi: menaikkan angka versi membuat semua key lama tidak terpakai lagi.
async function version(namespace) {
  try {
    return (await redis.get(`cache:ver:${namespace}`)) || '0';
  } catch {
    return '0';
  }
}

async function bump(namespace) {
  try {
    await redis.incr(`cache:ver:${namespace}`);
  } catch {
    /* abaikan */
  }
}

module.exports = { getOrSet, version, bump };