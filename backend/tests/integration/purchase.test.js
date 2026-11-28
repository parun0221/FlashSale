process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { redis } = require('../../src/config/redis');
const { startOrderWorker } = require('../../src/jobs/order.worker');
const { closeOrderQueue } = require('../../src/jobs/queue');
const t = require('../helpers');

let worker;

beforeAll(async () => {
  await redis.connect();
  worker = startOrderWorker(); // worker berjalan di proses yang sama dengan tes
});

afterAll(async () => {
  await worker.close();
  await closeOrderQueue();
  await t.cleanup();
  await pool.end();
  await redis.quit();
});

const buy = (saleId, user, key) =>
  request(app)
    .post(`/api/sales/${saleId}/orders`)
    .set('Authorization', `Bearer ${user.token}`)
    .set('Idempotency-Key', `${t.runId}-${key}`);

describe('pembelian flash sale', () => {
  it('stok 20 diserbu 100 pembeli serentak: tepat 20 diterima, tidak ada oversell', async () => {
    const sale = await t.createSale({ stock: 20 });
    const users = await t.createUsers(100);

    const responses = await Promise.all(users.map((u, i) => buy(sale.id, u, `oversell-${i}`)));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 202)).toHaveLength(20);
    expect(statuses.filter((s) => s === 409)).toHaveLength(80);

    await t.waitFor(async () => (await t.countOrders(sale.id)) === 20);
    expect(await t.remainingStock(sale.id)).toBe(0);
    expect(await t.countBuyers(sale.id)).toBe(20); // 20 pembeli berbeda
  });

  it('Idempotency-Key yang sama: respons yang sama, tidak ada order ganda', async () => {
    const sale = await t.createSale({ stock: 5 });
    const [user] = await t.createUsers(1);

    const first = await buy(sale.id, user, 'idem-1');
    const second = await buy(sale.id, user, 'idem-1');

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(second.body.data.orderId).toBe(first.body.data.orderId);

    await t.waitFor(async () => (await t.countOrders(sale.id)) === 1);
    await t.sleep(300); // beri kesempatan bila ada order ganda yang terlambat muncul
    expect(await t.countOrders(sale.id)).toBe(1);
  });

  it('user yang sama dengan kunci berbeda ditolak 409', async () => {
    const sale = await t.createSale({ stock: 5 });
    const [user] = await t.createUsers(1);

    expect((await buy(sale.id, user, 'dup-a')).status).toBe(202);
    const second = await buy(sale.id, user, 'dup-b');
    expect(second.status).toBe(409);
    expect(second.body.message).toMatch(/already purchased/i);
  });

  it('tanpa Idempotency-Key ditolak 400', async () => {
    const sale = await t.createSale({ stock: 5 });
    const [user] = await t.createUsers(1);
    const res = await request(app)
      .post(`/api/sales/${sale.id}/orders`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(400);
  });

  it('tanpa token ditolak 401', async () => {
    const sale = await t.createSale({ stock: 5 });
    const res = await request(app).post(`/api/sales/${sale.id}/orders`).set('Idempotency-Key', 'x');
    expect(res.status).toBe(401);
  });

  it('sale yang belum mulai ditolak 409', async () => {
    const sale = await t.createSale({
      stock: 5,
      startsAt: new Date(Date.now() + 3_600_000),
      endsAt: new Date(Date.now() + 7_200_000),
    });
    const [user] = await t.createUsers(1);
    const res = await buy(sale.id, user, 'early');
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not started/i);
  });

  it('status order berubah dari pending menjadi confirmed, dan milik orang lain tidak terlihat', async () => {
    const sale = await t.createSale({ stock: 5 });
    const [owner, stranger] = await t.createUsers(2);

    const placed = await buy(sale.id, owner, 'status-1');
    expect(placed.body.data.status).toBe('pending');
    const orderId = placed.body.data.orderId;

    const getAs = (user) =>
      request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${user.token}`);

    await t.waitFor(async () => (await getAs(owner)).body.data?.status === 'confirmed');
    expect((await getAs(stranger)).status).toBe(404); // 404, bukan 403: keberadaannya tidak dibocorkan
  });

  it('rate limit: banyak request dari satu user menghasilkan 429 dengan Retry-After', async () => {
    const sale = await t.createSale({ stock: 5 });
    const [user] = await t.createUsers(1);

    const responses = await Promise.all(
      Array.from({ length: 30 }, (_, i) => buy(sale.id, user, `burst-${i}`))
    );
    const limited = responses.filter((r) => r.status === 429);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited[0].headers['retry-after']).toBeDefined();
  });
});