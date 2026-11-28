process.env.NODE_ENV = 'test';
const { redis } = require('../../src/config/redis');
const { getOrSet } = require('../../src/utils/cache');

const key = `cache:test:${Date.now()}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(() => redis.connect());
afterAll(async () => {
  await redis.del(key);
  await redis.quit();
});

describe('cache-aside', () => {
  it('100 request serentak pada key kosong hanya memuat satu kali (single-flight)', async () => {
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await sleep(200);
      return { ok: true };
    };
    const results = await Promise.all(Array.from({ length: 100 }, () => getOrSet(key, 5, loader)));
    expect(calls).toBe(1);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('request berikutnya dilayani dari cache, loader tidak dipanggil', async () => {
    const loader = jest.fn().mockResolvedValue({ ok: false });
    const result = await getOrSet(key, 5, loader);
    expect(loader).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('hasil null tidak disimpan', async () => {
    const k = `${key}:null`;
    await getOrSet(k, 5, async () => null);
    expect(await redis.exists(k)).toBe(0);
  });

  it('Redis error saat membaca: request tetap dilayani dari sumber asli', async () => {
    const original = redis.get;
    redis.get = async () => { throw new Error('redis down'); };
    try {
      const result = await getOrSet(`${key}:down`, 5, async () => ({ dari: 'database' }));
      expect(result).toEqual({ dari: 'database' });
    } finally {
      redis.get = original;
    }
  });
});