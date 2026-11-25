/**
 * Rate limiter token bucket berbasis Redis.
 *
 * TODO:
 *  - Factory: rateLimit({ name, capacity, refillPerSec, keyFn })
 *  - Panggil Lua takeToken; set header X-RateLimit-* dan Retry-After; 429 bila ditolak
 *  - Putuskan sendiri: fail-open atau fail-closed bila Redis mati, lalu catat alasannya di README
 */

const { redis } = require('../config/redis');
const ApiError = require('../utils/ApiError');

// Pemakaian: rateLimit({ name: 'order', capacity: 10, refillPerSec: 2, keyFn: (req) => req.user.id })
module.exports = ({ name, capacity, refillPerSec, keyFn }) => async (req, res, next) => {
  let result;
  try {
    result = await redis.takeToken(`rl:${name}:${keyFn(req)}`, capacity, refillPerSec, 1);
  } catch (err) {
    // FAIL-OPEN: bila Redis bermasalah, request tetap dilayani
    console.error('rate limiter unavailable, failing open:', err.message);
    return next();
  }

  const [allowed, remaining, retryMs] = result;
  res.set('X-RateLimit-Limit', String(capacity));
  res.set('X-RateLimit-Remaining', String(remaining));

  if (!allowed) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(retryMs / 1000))));
    return next(new ApiError(429, 'Too many requests'));
  }
  return next();
};