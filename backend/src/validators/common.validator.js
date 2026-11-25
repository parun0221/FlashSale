/**
 * Skema bersama.
 *
 * TODO:
 *  - idParam (UUID)
 *  - pagination: limit (1-100, default 20) dan cursor
 */

const Joi = require('joi');

exports.idParam = Joi.object({ id: Joi.string().guid().required() });

exports.pagination = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  cursor: Joi.string().max(300),
});