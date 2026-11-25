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

exports.create = async (data) => {
  const product = await productRepo.findById(data.productId);
  if (!product) throw new ApiError(404, 'Product not found');
  return toSaleDTO(await saleRepo.create(data));
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