/**
 * Skema produk.
 *
 * TODO:
 *  - create, update (minimal satu field)
 */

const Joi = require('joi');

exports.create = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().max(2000).allow(''),
  priceCents: Joi.number().integer().min(0).required(),
});

exports.update = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  description: Joi.string().max(2000).allow(''),
  priceCents: Joi.number().integer().min(0),
}).min(1); // minimal satu field harus dikirim