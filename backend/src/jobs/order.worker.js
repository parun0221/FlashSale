/**
 * Worker (consumer) pemroses order.
 *
 * TODO:
 *  - processor: panggil orderService.persistOrder; bila hasil bukan confirmed, lepas reservasi Redis
 *  - concurrency dari config
 *  - Backoff kustom dengan jitter
 *  - Event 'failed': bila percobaan habis, panggil markOrderFailed
 *  - Log dengan jobId + requestId
 */

const { Worker, UnrecoverableError } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const QUEUES = require('../constants/queues');
const orderService = require('../services/order.service');

const { backoffWithJitter } = require('../utils/backoff');

const logger = require('../config/logger');

async function processOrderJob(job) {
  const { saleId, userId, requestId } = job.data;
  const log = logger.child({ jobId: job.id, requestId, saleId, userId }); // field ini melekat di setiap log
  const result = await orderService.persistOrder(job.data);

  if (result.status !== 'confirmed') {
    await orderService.releaseReservation(saleId, userId);
    log.warn({ result }, 'order ditolak oleh worker');
    throw new UnrecoverableError(result.status);
  }
  log.info('order tersimpan');
  return result;
}

function startOrderWorker() {

  const worker = new Worker(QUEUES.ORDERS, processOrderJob, {
    connection: createBullConnection(),
    concurrency: 10,
    settings: {
      // dipanggil BullMQ setiap kali job gagal dan perlu dijadwalkan ulang
      backoffStrategy: (attemptsMade, type, err, job) => {
        const base = (job && job.opts && job.opts.backoff && job.opts.backoff.delay) || 500;
        return backoffWithJitter(attemptsMade, base, 30_000);
      },
    },
  });

  worker.on('completed', (job) => console.log(`job ${job.id} selesai`));

  worker.on('failed', async (job, err) => {
    if (!job) return;
    logger.warn(
      { jobId: job.id, requestId: job.data.requestId, attempt: job.attemptsMade, maxAttempts: job.opts.attempts, err: err.message },
      'job gagal'
    );// Semua percobaan habis: pembelian ini tidak akan pernah jadi, kembalikan stok di Redis.
    if (job.attemptsMade >= job.opts.attempts) {
      await orderService
        .releaseReservation(job.data.saleId, job.data.userId)
        .catch((e) => logger.error({ err: e, jobId: job.id, requestId: job.data.requestId }, 'gagal mengembalikan reservasi'));
    }
  });

  worker.on('error', (err) => console.error('worker error:', err.message));
  return worker;
}

module.exports = { startOrderWorker };