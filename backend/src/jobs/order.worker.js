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


async function processOrderJob(job) {
  const { saleId, userId } = job.data;
  const result = await orderService.persistOrder(job.data);

  if (result.status !== 'confirmed') {
    // Gagal secara pasti (stok habis di DB / pembeli ganda): lepas reservasi di Redis,
    // lalu tandai job gagal TANPA retry, karena mengulang tidak akan mengubah hasilnya.
    await orderService.releaseReservation(saleId, userId);
    throw new UnrecoverableError(result.status);
  }
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
    console.warn(`job ${job.id} gagal (percobaan ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`);
    // Semua percobaan habis: pembelian ini tidak akan pernah jadi, kembalikan stok di Redis.
    if (job.attemptsMade >= job.opts.attempts) {
      await orderService
        .releaseReservation(job.data.saleId, job.data.userId)
        .catch((e) => console.error('gagal mengembalikan reservasi:', e.message));
    }
  });

  worker.on('error', (err) => console.error('worker error:', err.message));
  return worker;
}

module.exports = { startOrderWorker };