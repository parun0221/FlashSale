/**
 * Logika produk.
 *
 * Lapisan logika bisnis. TIDAK boleh tahu tentang req/res Express. Boleh memanggil repositories, cache, queue.
 *
 * TODO:
 *  - list dengan cache-aside + invalidasi berbasis versi
 *  - getById dengan cache + TTL
 *  - create/update lalu invalidasi cache
 */

const productRepo = require('../repositories/product.repository');
const ApiError = require('../utils/ApiError');
const { decodeCursor, toPage } = require('../utils/pagination');
const { toProductDTO } = require('../models/product.model');

exports.list = async ({ limit, cursor }) => {
  const rows = await productRepo.list({ limit, cursor: decodeCursor(cursor) });
  const page = toPage(rows, limit);
  return { items: page.items.map(toProductDTO), nextCursor: page.nextCursor };
};

exports.getById = async (id) => {
  const row = await productRepo.findById(id);
  if (!row) throw new ApiError(404, 'Product not found');
  return toProductDTO(row);
};

exports.create = async (data) => toProductDTO(await productRepo.create(data));

exports.update = async (id, data) => {
  const row = await productRepo.update(id, data);
  if (!row) throw new ApiError(404, 'Product not found');
  return toProductDTO(row);
};