/**
 * Controller produk.
 *
 * Lapisan HTTP: baca req, panggil service, tulis res. TIDAK boleh berisi logika bisnis atau SQL.
 *
 * TODO:
 *  - list (data + pageInfo.nextCursor), get, create (201), update
 */

const productService = require('../services/product.service');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const { items, nextCursor } = await productService.list(req.query);
  res.json({ data: items, pageInfo: { nextCursor } });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ data: await productService.getById(req.params.id) });
});

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await productService.create(req.body) });
});

exports.update = asyncHandler(async (req, res) => {
  res.json({ data: await productService.update(req.params.id, req.body) });
});