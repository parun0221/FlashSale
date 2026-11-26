/**
 * Mencatat durasi request ke histogram Prometheus.
 *
 * TODO:
 *  - Timer mulai di awal, berhenti pada event 'finish'
 *  - Normalisasi UUID di path agar jumlah label terkendali; rute tak dikenal = 'unmatched'
 */

const { httpDuration } = require('../utils/metrics');

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

module.exports = (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    // UUID diganti ":id". Tanpa ini setiap order menciptakan label baru dan memori Prometheus meledak.
    const route =
      res.statusCode === 404 && !req.route
        ? 'unmatched' // juga mencegah ledakan label dari URL ngawur
        : req.originalUrl.split('?')[0].replace(UUID_RE, ':id');
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
};