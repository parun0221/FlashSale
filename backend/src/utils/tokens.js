/**
 * Penerbitan dan verifikasi JWT.
 *
 * TODO:
 *  - signAccessToken, signRefreshToken (dengan jti), verifyAccessToken, verifyRefreshToken
 *  - Tentukan algoritma secara eksplisit
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

exports.signAccessToken = (user) =>
  jwt.sign({ role: user.role }, config.jwt.accessSecret, {
    subject: user.id,
    expiresIn: config.jwt.accessTtl,
    algorithm: 'HS256',
  });

exports.verifyAccessToken = (token) =>
  jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });