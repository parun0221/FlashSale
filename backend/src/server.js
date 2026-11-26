/**
 * Entry point proses API.
 *
 * TODO:
 *  - Sambungkan Postgres dan Redis dengan retry (backoff + jitter) karena dependensi bisa belum siap
 *  - app.listen, atur server.requestTimeout / headersTimeout / keepAliveTimeout
 *  - Graceful shutdown pada SIGTERM/SIGINT: server.close, tutup queue, pool.end, redis.quit
 *  - Paksa keluar bila shutdown macet lebih dari N detik
 */

const app = require('./app');
const config = require('./config');
const { pool } = require('./config/db');
const { redis } = require('./config/redis');
const { retry } = require('./utils/retry');

const onRetry = (name) => (err, attempt, delay) =>
  console.warn(`${name} belum siap (percobaan ${attempt}): ${err.message}. Coba lagi dalam ${delay}ms`);


async function start() {
  await retry(() => pool.query('SELECT 1'), { retries: 10, baseDelayMs: 300, onRetry: onRetry('Postgres') }); // tidak tersambung = berhenti dengan pesan jelas
  console.log('Postgres connected');

  redis.connect().catch(() => {})
  await retry(() => redis.ping(), { retries: 10, baseDelayMs: 300, onRetry: onRetry('Redis') });
  console.log('Redis connected');

  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  

  let shuttingDown = false;

  const { closeOrderQueue } = require('./jobs/queue');
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await closeOrderQueue(); // tutup queue, tunggu job yang sedang berjalan selesai
      await pool.end();           // tutup koneksi database
      await redis.quit();         // tutup koneksi Redis
      console.log('Shutdown complete.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});