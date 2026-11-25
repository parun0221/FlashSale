/**
 * Skema flash sale.
 *
 * TODO:
 *  - create: productId, salePriceCents, totalStock, startsAt, endsAt (harus setelah startsAt)
 */

const Joi = require('joi');

exports.create = Joi.object({
  productId: Joi.string().guid().required(),
  salePriceCents: Joi.number().integer().min(0).required(),
  totalStock: Joi.number().integer().min(1).max(1_000_000).required(),
  startsAt: Joi.date().iso().required(),
  endsAt: Joi.date().iso().greater(Joi.ref('startsAt')).required(),
});