/**
 * Endpoint operasional (bukan bagian /api).
 *
 * TODO:
 *  - GET /health: liveness
 *  - GET /ready: cek Postgres dan Redis, balas 503 bila salah satu mati
 *  - GET /metrics: keluaran Prometheus
 */


const router = require('express').Router();
const { pool } = require('../config/db');
const { redis } = require('../config/redis');

const asyncHandler = require('../utils/asyncHandler');
const { register } = require('../utils/metrics');

router.get('/metrics', asyncHandler(async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
}));


// liveness: cek bahwa proses hidup
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// readiness: apakah dependensi siap dipakai?
router.get('/ready', async (req, res) => {
  const checks = { postgres: 'ok', redis: 'ok' };
  await pool.query('SELECT 1').catch(() => { checks.postgres = 'down'; });
  await redis.ping().catch(() => { checks.redis = 'down'; });
  const ready = Object.values(checks).every((v) => v === 'ok');
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks });
});

module.exports = router;
