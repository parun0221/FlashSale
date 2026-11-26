/**
 * Entry point proses worker (terpisah dari API).
 *
 * Dijalankan sebagai proses/container sendiri agar bisa di-scale terpisah dari API.
 *
 * TODO:
 *  - Sambungkan Postgres dan Redis dengan retry
 *  - Jalankan startOrderWorker()
 *  - Graceful shutdown: tunggu job yang sedang berjalan selesai (worker.close)
 */

const { pool } = require('./config/db');
const { redis } = require('./config/redis');
const { startOrderWorker } = require('./jobs/order.worker');
const { retry } = require('./utils/retry');

const onRetry = (name) => (err, attempt, delay) =>
  console.warn(`${name} belum siap (percobaan ${attempt}): ${err.message}. Coba lagi dalam ${delay}ms`);

async function start() {
  await retry(() => pool.query('SELECT 1'), { retries: 10, baseDelayMs: 300, onRetry: onRetry('Postgres') });
  redis.connect().catch(() => {})
  await retry(() => redis.ping(), { retries: 10, baseDelayMs: 300, onRetry: onRetry('Redis') });
  const worker = startOrderWorker();
  console.log('Order worker started');

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, closing worker...`);
    await worker.close(); // menunggu job yang sedang berjalan selesai dulu
    await pool.end();
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Worker failed to start:', err.message);
  process.exit(1);
});