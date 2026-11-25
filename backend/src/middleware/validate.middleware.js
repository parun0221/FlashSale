/**
 * Validasi input dengan skema Joi.
 *
 * TODO:
 *  - validate(schema, source = 'body' | 'query' | 'params')
 *  - abortEarly: false, stripUnknown: true
 *  - Gagal -> ApiError 400 dengan daftar detail
 */

const ApiError = require('../utils/ApiError');

module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(new ApiError(400, 'Validation error', error.details.map((d) => d.message)));
  }
  req[source] = value;
  next();
};