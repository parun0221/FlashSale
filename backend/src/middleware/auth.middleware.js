/**
 * Autentikasi dan otorisasi.
 *
 * TODO:
 *  - authenticate: baca Bearer token, verifikasi, isi req.user = { id, role }
 *  - authorize(...roles): 403 bila role tidak cocok
 */

const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/tokens');

exports.authenticate = (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or malformed Authorization header'));
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, 'Invalid or expired access token'));
  }
};

exports.authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new ApiError(403, 'Forbidden'));