/**
 * Skema autentikasi.
 *
 * TODO:
 *  - register: name, email (lowercase), password (min 8, max 72 karena batas bcrypt)
 *  - login, refresh
 */

const Joi = require('joi');

const email = Joi.string().email().lowercase().trim().max(254);

exports.register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: email.required(),
  password: Joi.string().min(8).max(72).required(), // 72 = batas bcrypt
});

exports.login = Joi.object({
  email: email.required(),
  password: Joi.string().max(72).required(),
});