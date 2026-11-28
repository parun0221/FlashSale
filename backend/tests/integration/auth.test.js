process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');
const { redis } = require('../../src/config/redis');

const email = `auth-test-${Date.now()}@example.com`;
const password = 'password';
let accessToken;

// Pembatas login hidup di Redis dan bertahan antar sesi tes. Direset agar tes tidak
// bergantung pada sesi sebelumnya, dan agar login manual Anda tidak ikut terblokir sesudahnya.
const resetAuthLimiter = async () => {
  const keys = await redis.keys('rl:auth:*');
  if (keys.length) await redis.del(...keys);
};

beforeAll(async () => {
  await redis.connect();
  await resetAuthLimiter();
});

afterAll(async () => {
  await resetAuthLimiter();
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await pool.end();
  await redis.quit();
});

describe('auth', () => {
  it('register berhasil, mengembalikan token, dan tidak membocorkan password', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Tester', email, password });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('register dengan email yang sama ditolak 409', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Tester', email, password });
    expect(res.status).toBe(409);
  });

  it('register dengan input tidak valid ditolak 400 beserta rincian', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bukan-email', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThanOrEqual(3);
  });

  it('login berhasil mengembalikan token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    accessToken = res.body.data.accessToken;
    expect(accessToken).toBeDefined();
  });

  it('login dengan password salah ditolak 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'salah-banget' });
    expect(res.status).toBe(401);
  });

  it('login dengan email yang tidak terdaftar memberi pesan yang sama (akun tidak bisa ditebak)', async () => {
    const wrongPassword = await request(app).post('/api/auth/login').send({ email, password: 'salah-banget' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: `tidak-ada-${Date.now()}@example.com`, password });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  it('/me dengan token valid mengembalikan profil', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });

  it('/me tanpa token ditolak 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it('/me dengan token rusak ditolak 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token.yang.rusak');
    expect(res.status).toBe(401);
  });

  // Letakkan paling akhir: tes ini menghabiskan ember pembatas milik IP ini.
  it('percobaan login berulang akhirnya ditolak 429 (anti brute force)', async () => {
    const statuses = [];
    for (let i = 0; i < 15; i += 1) {
      statuses.push((await request(app).post('/api/auth/login').send({ email, password: 'tebakan-ngawur' })).status);
    }
    expect(statuses).toContain(429);
  });
});