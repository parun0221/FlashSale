/**
 * Membaca dan memvalidasi environment variable, mengekspor satu objek config.
 *
 * TODO:
 *  - Load dotenv
 *  - Validasi semua variabel dengan Joi (tipe, default, wajib/tidak)
 *  - Gagal cepat (throw) bila env tidak valid
 *  - Di production, tolak secret JWT yang masih bawaan
 *  - Kelompokkan: db, redisUrl, jwt, rateLimit, orderQueueConcurrency
 */

require('dotenv').config();
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().default('postgres://flashsale:flashsale@localhost:5433/flashsale'),
  DB_POOL_MAX: Joi.number().default(20),
  DB_STATEMENT_TIMEOUT_MS: Joi.number().default(5000),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  LOG_LEVEL: Joi.string().default('info'),
}).unknown(true);


const { value, error } = schema.validate(process.env, { abortEarly: false });
if (error) throw new Error(`Invalid environment: ${error.message}`);


module.exports = {
  env: value.NODE_ENV,
  port: value.PORT,
  logLevel: value.LOG_LEVEL,
  jwt: { 
    accessSecret: value.JWT_ACCESS_SECRET, 
    accessTtl: value.JWT_ACCESS_TTL
 },
  db: {
    url: value.DATABASE_URL,
    poolMax: value.DB_POOL_MAX,
    statementTimeoutMs: value.DB_STATEMENT_TIMEOUT_MS,
  },
  redisUrl: value.REDIS_URL,
};