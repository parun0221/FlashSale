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

// Token bucket atomik.
// ARGV: capacity, refill per detik, cost
// Return: {diizinkan (1/0), sisa token, retry-after dalam ms}
redis.defineCommand('takeToken', {
  numberOfKeys: 1,
  lua: `
    local capacity = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local cost = tonumber(ARGV[3])

    -- waktu diambil dari Redis, bukan dari aplikasi, agar konsisten antar instance
    local t = redis.call('TIME')
    local now = t[1] * 1000 + math.floor(t[2] / 1000)

    local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
    local tokens = tonumber(data[1])
    local ts = tonumber(data[2])
    if tokens == nil then
      tokens = capacity
      ts = now
    end

    -- isi ulang sesuai waktu yang berlalu, maksimal sebesar kapasitas
    tokens = math.min(capacity, tokens + math.max(0, now - ts) * rate / 1000)

    local allowed = 0
    local retry = 0
    if tokens >= cost then
      tokens = tokens - cost
      allowed = 1
    else
      retry = math.ceil((cost - tokens) * 1000 / rate)
    end

    redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
    -- key hilang sendiri setelah ember pasti sudah penuh lagi
    redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate * 1000) + 1000)
    return {allowed, math.floor(tokens), retry}
  `,
});

// BullMQ mewajibkan maxRetriesPerRequest: null, jadi memakai koneksi sendiri.
const createBullConnection = () => new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// KEYS[1] = stok, KEYS[2] = set pembeli, ARGV[1] = userId
// Return: 1 berhasil, 0 stok habis, -1 sudah pernah beli, -2 key stok belum ada
redis.defineCommand('reserveStock', {
  numberOfKeys: 2,
  lua: `
    if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then return -1 end
    local stock = tonumber(redis.call('GET', KEYS[1]))
    if stock == nil then return -2 end
    if stock <= 0 then return 0 end
    redis.call('DECR', KEYS[1])
    redis.call('SADD', KEYS[2], ARGV[1])
    return 1
  `,
});

// Mengembalikan reservasi. Aman dipanggil berkali-kali untuk user yang sama.
redis.defineCommand('releaseStock', {
  numberOfKeys: 2,
  lua: `
    if redis.call('SREM', KEYS[2], ARGV[1]) == 1 then redis.call('INCR', KEYS[1]) end
    return 1
  `,
});

module.exports = { redis, createBullConnection };

