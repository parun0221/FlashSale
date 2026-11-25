/**
 * Controller flash sale.
 *
 * Lapisan HTTP: baca req, panggil service, tulis res. TIDAK boleh berisi logika bisnis atau SQL.
 *
 * TODO:
 *  - list, get, create
 *  - placeOrder: balas 202 Accepted + orderId (pemrosesan ada di worker); teruskan req.id sebagai requestId
 */

const saleService = require('../services/sale.service');
const orderService = require('../services/order.service');
const asyncHandler = require('../utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await saleService.create(req.body) });
});

exports.get = asyncHandler(async (req, res) => {
  res.json({ data: await saleService.getById(req.params.id) });
});

exports.placeOrder = asyncHandler(async (req, res) => {
  const data = await orderService.placeOrder({ saleId: req.params.id, userId: req.user.id, priceCents: req.body.priceCents });
  res.status(201).json({ data });
});

exports.listUpcomingAndActive = asyncHandler(async (req, res) => {
  res.json({ data: await saleService.listUpcomingAndActive(req.query) });
});