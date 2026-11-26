/**
 * Logika flash sale.
 *
 * Lapisan logika bisnis. TIDAK boleh tahu tentang req/res Express. Boleh memanggil repositories, cache, queue.
 *
 * TODO:
 *  - getSaleRow (cache metadata sale; jangan cache stok)
 *  - create: validasi produk ada, simpan, inisialisasi stok di Redis, invalidasi cache
 *  - warmStock: isi ulang stok Redis dari DB bila key hilang (restart/flush)
 *  - list sale aktif/akan datang
 */

const saleRepo = require('../repositories/sale.repository');
const productRepo = require('../repositories/product.repository');
const ApiError = require('../utils/ApiError');
const { toSaleDTO } = require('../models/sale.model');
const { redis } = require('../config/redis');
const KEYS = require('../constants/redisKeys');

exports.create = async (data) => {
  const product = await productRepo.findById(data.productId);
  if (!product) throw new ApiError(404, 'Product not found');
  const row = await saleRepo.create(data);
  // pasang penghitung stok di Redis
  await redis.set(KEYS.saleStock(row.id), row.total_stock);
  await redis.del(KEYS.saleBuyers(row.id));
  return toSaleDTO(row);
};

exports.getById = async (id) => {
  const row = await saleRepo.findById(id);
  if (!row) throw new ApiError(404, 'Sale not found');
  return toSaleDTO(row);
};

exports.listUpcomingAndActive = async ({ limit, cursor }) => {
  const rows = await saleRepo.listUpcomingAndActive({ limit, cursor });
  return rows.map(toSaleDTO);
};

// Bila key stok hilang (Redis di-restart, atau sale dibuat sebelum tahap ini),
// isi ulang dari database. NX = hanya bila key memang belum ada.
exports.warmStock = async (saleId) => {
  const row = await saleRepo.findById(saleId);
  if (!row) throw new ApiError(404, 'Sale not found');
  await redis.set(KEYS.saleStock(saleId), row.remaining_stock, 'NX');
};