/**
 * Helper retry untuk operasi async (pakai backoff.js).
 *
 * TODO:
 *  - retry(fn, { retries, baseDelayMs, maxDelayMs, onRetry })
 */

const { backoffWithJitter } = require('./backoff');

async function retry(fn, { retries = 5, baseDelayMs = 200, maxDelayMs = 5_000, onRetry } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt > retries) throw err; // percobaan habis: lempar error aslinya
      const delay = backoffWithJitter(attempt, baseDelayMs, maxDelayMs);
      if (onRetry) onRetry(err, attempt, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

module.exports = { retry };