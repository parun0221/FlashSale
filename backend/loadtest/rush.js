// Menembakkan satu percobaan pembelian per user ke sebuah sale, lalu melaporkan hasil dan latensi.
// Pemakaian:  node loadtest/rush.js <saleId>
// Opsi (environment): BASE_URL (default http://localhost:3000), CONCURRENCY (default 100),
//                     LABEL (nama skenario untuk baris tabel README)
const tokens = require('./tokens.json');

const saleId = process.argv[2];
if (!saleId) {
  console.error('Usage: node loadtest/rush.js <saleId>');
  process.exit(1);
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENCY = Number(process.env.CONCURRENCY || 100); // jumlah request yang "terbang" bersamaan
const LABEL = process.env.LABEL || 'rush';

const counts = {};
const latencies = [];
let next = 0;

async function worker() {
  while (next < tokens.length) {
    const i = next++;
    const t0 = performance.now();
    let status;
    try {
      const res = await fetch(`${BASE_URL}/api/sales/${saleId}/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens[i]}`,
          'Idempotency-Key': `rush-${saleId}-${i}`,
        },
      });
      status = res.status;
      await res.arrayBuffer();
    } catch {
      status = 'ERR'; // koneksi gagal / timeout
    }
    latencies.push(performance.now() - t0);
    counts[status] = (counts[status] || 0) + 1;
  }
}

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

(async () => {
  const start = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - start) / 1000;

  latencies.sort((a, b) => a - b);
  const p50 = Math.round(percentile(latencies, 50));
  const p95 = Math.round(percentile(latencies, 95));
  const p99 = Math.round(percentile(latencies, 99));
  const max = Math.round(latencies[latencies.length - 1]);
  const rps = Math.round(tokens.length / seconds);

  console.log('status counts:', counts);
  console.log(`total ${tokens.length} request dalam ${seconds.toFixed(2)} detik (${rps} req/detik)`);
  console.log(`latensi: p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  max=${max}ms`);
  if (counts[401]) console.log('PERINGATAN: ada 401, token kedaluwarsa. Jalankan ulang npm run load:users.');
  if (counts.ERR) console.log('PERINGATAN: ada request gagal koneksi (ERR).');

  console.log('\nBaris untuk README:');
  console.log(`| ${LABEL} | ${tokens.length} | ${counts[202] || 0} | ${counts[409] || 0} | ${counts[429] || 0} | ${p50} ms | ${p95} ms | ${p99} ms | ${rps} |`);
})();