// Menembak endpoint pembelian dengan banyak user sekaligus.
// Pemakaian: node loadtest/rush.js <saleId>
const tokens = require('./tokens.json');
const saleId = process.argv[2];
if (!saleId) { console.error('Usage: node loadtest/rush.js <saleId>'); process.exit(1); }

const CONCURRENCY = 100; // jumlah request yang "terbang" bersamaan
const counts = {};
let next = 0;

async function worker() {
  while (next < tokens.length) {
    const i = next++;
    const res = await fetch(`http://localhost:3000/api/sales/${saleId}/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokens[i]}` },
    });
    counts[res.status] = (counts[res.status] || 0) + 1;
    await res.arrayBuffer();
  }
}

(async () => {
  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log('status counts:', counts, `(${Date.now() - t0} ms)`);
})();