/**
 * Rate limiter token bucket berbasis Redis.
 *
 * TODO:
 *  - Factory: rateLimit({ name, capacity, refillPerSec, keyFn })
 *  - Panggil Lua takeToken; set header X-RateLimit-* dan Retry-After; 429 bila ditolak
 *  - Putuskan sendiri: fail-open atau fail-closed bila Redis mati, lalu catat alasannya di README
 */
