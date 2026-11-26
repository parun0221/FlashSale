/**
 * Controller order.
 *
 * Lapisan HTTP: baca req, panggil service, tulis res. TIDAK boleh berisi logika bisnis atau SQL.
 *
 * TODO:
 *  - list milik user, get by id
 */

const orderService = require('../services/order.service');
const asyncHandler = require('../utils/asyncHandler');

exports.get = asyncHandler(async (req, res) => {
  res.json({ data: await orderService.getOrder(req.params.id, req.user) });
});