/**
 * INTI PROJECT: logika pembelian.
 *
 * Lapisan logika bisnis. TIDAK boleh tahu tentang req/res Express. Boleh memanggil repositories, cache, queue.
 *
 * TODO:
 *  - placeOrder (jalur cepat): cek jadwal sale -> reservasi stok atomik di Redis -> enqueue job; DB tidak disentuh
 *  - Bila enqueue gagal: kembalikan reservasi lalu balas 503
 *  - persistOrder (dipanggil worker): SATU transaksi = insert order + kurangi stok; harus idempoten bila job di-retry
 *  - Tangani kasus stok habis di DB (rollback, catat order failed)
 *  - releaseReservation dan markOrderFailed (kompensasi bila worker gagal permanen)
 *  - getOrder: bila belum ada di DB, cek apakah masih antre di queue (status pending)
 *  - listMine dengan cursor pagination
 */

const { randomUUID } = require('crypto');
const { redis } = require('../config/redis');
const { withTransaction } = require('../config/db');
const saleRepo = require('../repositories/sale.repository');
const orderRepo = require('../repositories/order.repository');
const saleService = require('./sale.service');
const { getOrderQueue } = require('../jobs/queue');
const ApiError = require('../utils/ApiError');
const KEYS = require('../constants/redisKeys');
const QUEUES = require('../constants/queues');
const { toOrderDTO } = require('../models/order.model');

const { ordersTotal } = require('../utils/metrics');

class SoldOutError extends Error {}



/**
 * JALUR CEPAT (dipanggil API): cek jadwal -> reservasi stok di Redis -> masukkan ke antrean.
 * Database tidak ditulis di sini.
 */

function reject(result, status, message) {
  ordersTotal.inc({ result });
  throw new ApiError(status, message);
}

exports.placeOrder = async ({ saleId, userId, requestId }) => {
  const sale = await saleService.getSaleRow(saleId);

  const now = Date.now();
  if (now < new Date(sale.starts_at).getTime()) reject('not_started', 409, 'Sale has not started yet');
  if (now > new Date(sale.ends_at).getTime()) reject('ended', 409, 'Sale has ended');

  const stockKey = KEYS.saleStock(saleId);
  const buyersKey = KEYS.saleBuyers(saleId);

  let reserved = await redis.reserveStock(stockKey, buyersKey, userId);
  if (reserved === -2) {
    await saleService.warmStock(saleId);
    reserved = await redis.reserveStock(stockKey, buyersKey, userId);
  }
  if (reserved === -1) reject('duplicate', 409, 'You have already purchased in this sale');
  if (reserved === 0) reject('sold_out', 409, 'Sold out');

  const orderId = randomUUID();
  try {
    await getOrderQueue().add(
      QUEUES.CREATE_ORDER_JOB,
      { orderId, saleId, userId, priceCents: sale.sale_price_cents, requestId },
      { jobId: orderId }
    );
  } catch (err) {
    await redis.releaseStock(stockKey, buyersKey, userId).catch(() => {});
    throw new ApiError(503, 'Order service temporarily unavailable');
  }

  ordersTotal.inc({ result: 'accepted' });
  return { orderId, status: 'pending' };
};

/**
 * JALUR LAMBAT (dipanggil worker): satu transaksi = simpan order + kurangi stok.
 * Harus IDEMPOTEN: job yang diulang tidak boleh membuat order ganda.
 */
exports.persistOrder = async ({ orderId, saleId, userId, priceCents }) => {
  try {
    return await withTransaction(async (client) => {
      const inserted = await orderRepo.insertConfirmed(client, { id: orderId, saleId, userId, priceCents });
      if (!inserted) {
        // Ada konflik. Jika id ini sudah ada, job ini pernah selesai (misalnya commit sukses
        // tetapi worker mati sebelum melapor), jadi anggap berhasil. Jika tidak, berarti
        // user ini sudah punya order lain di sale ini.
        const existing = await orderRepo.findById(orderId, client);
        return { status: existing ? 'confirmed' : 'duplicate' };
      }
      const updated = await saleRepo.decrementStock(client, saleId);
      if (!updated) throw new SoldOutError(); // melempar = ROLLBACK, order tadi ikut dibatalkan
      return { status: 'confirmed' };
    });
  } catch (err) {
    if (err instanceof SoldOutError) return { status: 'sold_out' };
    throw err; // error sementara (database mati, timeout): biarkan BullMQ mengulang
  }
};

exports.releaseReservation = (saleId, userId) =>
  redis.releaseStock(KEYS.saleStock(saleId), KEYS.saleBuyers(saleId), userId);

exports.getOrder = async (orderId, user) => {
  const row = await orderRepo.findById(orderId);
  if (row) {
    // 404, bukan 403: jangan membocorkan bahwa order milik orang lain itu ada
    if (row.user_id !== user.id && user.role !== 'admin') throw new ApiError(404, 'Order not found');
    return { ...toOrderDTO(row), status: 'confirmed' };
  }

  // belum ada di database: lihat status job-nya di antrean
  const job = await getOrderQueue().getJob(orderId);
  if (!job || job.data.userId !== user.id) throw new ApiError(404, 'Order not found');

  const state = await job.getState();
  const base = { id: orderId, saleId: job.data.saleId, userId: user.id };
  if (state === 'failed') return { ...base, status: 'failed', reason: job.failedReason };
  return { ...base, status: 'pending' };
};