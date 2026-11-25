/**
 * 404 dan error handler global.
 *
 * TODO:
 *  - notFound
 *  - errorHandler: JSON malformed -> 400, ApiError -> status-nya, lainnya -> 500
 *  - Jangan bocorkan detail internal pada 5xx; sertakan requestId
 */

exports.notFound = (req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
};

// Express mengenali error handler dari jumlah parameternya: harus 4
exports.errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  const status = err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message,
    ...(err.details && { details: err.details }),
  });
};