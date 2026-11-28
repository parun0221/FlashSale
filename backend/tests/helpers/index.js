const { randomUUID } = require('crypto');
const { pool } = require('../../src/config/db');
const { redis } = require('../../src/config/redis');
const { signAccessToken } = require('../../src/utils/tokens');
const productRepo = require('../../src/repositories/product.repository');
const saleService = require('../../src/services/sale.service');
const KEYS = require('../../src/constants/redisKeys');

// Setiap kali tes dijalankan, semua data memakai runId baru agar tidak bentrok
// dengan data development maupun dengan tes sebelumnya.
const runId = randomUUID().slice(0, 8);
let batch = 0;
const saleIds = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Membuat N user langsung di database (tanpa bcrypt/login) beserta access token-nya. */
async function createUsers(count) {
  batch += 1;
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     SELECT 'Test ' || i, 'it-' || $1::text || '-' || $2::int || '-' || i || '@example.com', 'x', 'user'
       FROM generate_series(1, $3::int) AS i
     RETURNING id, role`,
    [runId, batch, count]
  );
  return rows.map((u) => ({ id: u.id, token: signAccessToken(u) }));
}

async function createSale({ stock, startsAt, endsAt } = {}) {
  const product = await productRepo.create({ name: `Test ${runId}`, priceCents: 100000 });
  const sale = await saleService.create({
    productId: product.id,
    salePriceCents: 50000,
    totalStock: stock,
    startsAt: startsAt || new Date(Date.now() - 60_000),
    endsAt: endsAt || new Date(Date.now() + 3_600_000),
  });
  saleIds.push(sale.id);
  return sale;
}

async function countOrders(saleId) {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM orders WHERE sale_id = $1', [saleId]);
  return rows[0].n;
}

async function countBuyers(saleId) {
  const { rows } = await pool.query('SELECT count(DISTINCT user_id)::int AS n FROM orders WHERE sale_id = $1', [saleId]);
  return rows[0].n;
}

async function remainingStock(saleId) {
  const { rows } = await pool.query('SELECT remaining_stock FROM flash_sales WHERE id = $1', [saleId]);
  return rows[0].remaining_stock;
}

/** Menunggu sampai fn() mengembalikan nilai truthy; gagal bila melewati batas waktu. */
async function waitFor(fn, { timeoutMs = 15_000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) throw new Error('waitFor: batas waktu terlampaui');
    await sleep(intervalMs);
  }
}

/** Menghapus semua data yang dibuat oleh jalannya tes ini. */
async function cleanup() {
  await pool.query('DELETE FROM orders WHERE sale_id = ANY($1::uuid[])', [saleIds]);
  await pool.query('DELETE FROM flash_sales WHERE id = ANY($1::uuid[])', [saleIds]);
  await pool.query('DELETE FROM products WHERE name = $1', [`Test ${runId}`]);
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`it-${runId}-%`]);
  for (const id of saleIds) {
    await redis.del(KEYS.saleStock(id), KEYS.saleBuyers(id), `cache:sale:${id}`).catch(() => {});
  }
}

module.exports = { runId, sleep, createUsers, createSale, countOrders, countBuyers, remainingStock, waitFor, cleanup };