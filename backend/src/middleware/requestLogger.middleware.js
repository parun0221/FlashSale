/**
 * Logging request + request id.
 *
 * TODO:
 *  - pino-http; ambil X-Request-Id dari header atau buat UUID
 *  - Set header response X-Request-Id
 *  - Abaikan /health dan /metrics
 */

const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');
const logger = require('../config/logger');

module.exports = pinoHttp({
  logger,
  genReqId: (req, res) => {
    // hormati id dari client/gateway bila bentuknya aman; selain itu buat sendiri
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && /^[\w.-]{1,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // PENTING: tanpa ini, pino-http mencetak SEMUA header request, termasuk Authorization (token user)
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
});