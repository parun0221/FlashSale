/**
 * Definisi queue BullMQ (producer).
 *
 * TODO:
 *  - getOrderQueue() dibuat lazy (memoized)
 *  - defaultJobOptions: attempts, backoff, removeOnComplete/Fail
 *  - closeOrderQueue() untuk shutdown/test
 */

const { Queue } = require('bullmq');
const { createBullConnection } = require('../config/redis');
const QUEUES = require('../constants/queues');

let queue;

// Dibuat saat pertama dipakai (lazy), supaya sekadar meng-import file ini tidak membuka koneksi.
function getOrderQueue() {
  if (!queue) {
    queue = new Queue(QUEUES.ORDERS, {
      connection: createBullConnection(),
      defaultJobOptions: {
        attempts: 5,                                  // total percobaan per job
        backoff: { type: 'exponentialJitter', delay: 500 }, // jeda 0.5s, 1s, 2s, 4s
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 24 * 3600 },             // job gagal disimpan 24 jam
      },
    });
  }
  return queue;
}

async function closeOrderQueue() {
  if (queue) await queue.close();
  queue = undefined;
}

module.exports = { getOrderQueue, closeOrderQueue };