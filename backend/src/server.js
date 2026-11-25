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

async function start() {
  await pool.query('SELECT 1'); // tidak tersambung = berhenti dengan pesan jelas
  console.log('Postgres connected');

  await redis.connect();
  console.log('Redis connected');

  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
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