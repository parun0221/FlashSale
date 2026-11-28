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

const cache = require('../utils/cache');
const { redis } = require('../config/redis');

exports.list = async ({ limit, cursor }) => {
  const decoded = decodeCursor(cursor); // validasi dulu: cursor ngawur tetap 400
  const ver = await cache.version('products');
  const key = `cache:products:${ver}:${limit}:${cursor || 'first'}`;
  return cache.getOrSet(key, 30, async () => {
    const page = toPage(await productRepo.list({ limit, cursor: decoded }), limit);
    return { items: page.items.map(toProductDTO), nextCursor: page.nextCursor };
  });
};

exports.getById = async (id) => {
  const row = await cache.getOrSet(`cache:product:${id}`, 60, () => productRepo.findById(id));
  if (!row) throw new ApiError(404, 'Product not found');
  return toProductDTO(row);
};

exports.create = async (data) => {
  const row = await productRepo.create(data);
  await cache.bump('products'); // semua halaman daftar produk dianggap kedaluwarsa
  return toProductDTO(row);
};

exports.update = async (id, data) => {
  const row = await productRepo.update(id, data);
  if (!row) throw new ApiError(404, 'Product not found');
  await cache.bump('products');
  await redis.del(`cache:product:${id}`).catch(() => {});
  return toProductDTO(row);
};
