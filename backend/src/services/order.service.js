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

const { withTransaction } = require('../config/db');
const saleRepo = require('../repositories/sale.repository');
const orderRepo = require('../repositories/order.repository');
const ApiError = require('../utils/ApiError');
const { toOrderDTO } = require('../models/order.model');

exports.placeOrder = async ({ saleId, userId }) => {
  const sale = await saleRepo.findById(saleId);
  if (!sale) throw new ApiError(404, 'Sale not found');

  const now = Date.now();
  if (now < new Date(sale.starts_at).getTime()) throw new ApiError(409, 'Sale has not started yet');
  if (now > new Date(sale.ends_at).getTime()) throw new ApiError(409, 'Sale has ended');

  try {
    const order = await withTransaction(async (client) => {
      const updated = await saleRepo.decrementStock(client, saleId);
      if (!updated) throw new ApiError(409, 'Sold out'); // melempar error = ROLLBACK
      return orderRepo.create(client, { saleId, userId, priceCents: sale.sale_price_cents });
    });
    return toOrderDTO(order);
  } catch (err) {
    // 23505 = pelanggaran UNIQUE; transaksi sudah di-rollback, jadi stok yang tadi
    // dikurangi otomatis kembali
    if (err.code === '23505') throw new ApiError(409, 'You have already purchased in this sale');
    throw err;
  }
};