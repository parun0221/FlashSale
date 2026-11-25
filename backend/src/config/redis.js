/**
 * Koneksi Redis dan Lua script.
 *
 * TODO:
 *  - Buat klien ioredis (lazyConnect, commandTimeout, retryStrategy)
 *  - Buat koneksi terpisah untuk BullMQ (maxRetriesPerRequest: null)
 *  - defineCommand reserveStock: cek sudah beli, cek stok, DECR, SADD (atomik)
 *  - defineCommand releaseStock: SREM, jika berhasil maka INCR (kompensasi)
 *  - defineCommand takeToken: algoritma token bucket (atomik)
 */

const IORedis = require('ioredis');
const config = require('./index');

const redis = new IORedis(config.redisUrl, {
  lazyConnect: true,           // koneksi dibuka eksplisit di server.js
  maxRetriesPerRequest: 2,
  commandTimeout: 2000,        // perintah Redis tidak boleh menggantung selamanya
  retryStrategy: (times) => Math.min(times * 100, 2000),
});

redis.on('error', (err) => console.error('Redis error:', err.message));

module.exports = { redis };