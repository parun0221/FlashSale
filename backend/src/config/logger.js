/**
 * Instance logger terstruktur (pino).
 *
 * TODO:
 *  - Level dari config; 'silent' saat NODE_ENV=test
 *  - Output JSON di production, pino-pretty di development
 */

const pino = require('pino');
const config = require('./index');

module.exports = pino({
  level: config.env === 'test' ? 'silent' : config.logLevel, // tes tidak dibanjiri log
  // tampilan berwarna dan mudah dibaca hanya saat development; production tetap JSON
  ...(config.env === 'development' && { transport: { target: 'pino-pretty' } }),
});