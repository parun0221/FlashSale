/**
 * Perhitungan delay retry.
 *
 * TODO:
 *  - Exponential backoff dengan jitter, dibatasi maxMs
 *  - Tulis unit test-nya lebih dulu
 */

/**
 * Exponential backoff dengan "equal jitter".
 * @param {number} attempt percobaan ke-n, mulai dari 1
 * @param {function} rand   bisa diganti saat tes agar hasilnya deterministik
 */
function backoffWithJitter(attempt, baseMs, maxMs = 30_000, rand = Math.random) {
  const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1)); // 400, 800, 1600, ...
  return Math.round(exp / 2 + (rand() * exp) / 2);          // acak di antara separuh dan penuh
}

module.exports = { backoffWithJitter };