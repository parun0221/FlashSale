/**
 * Memeriksa konsistensi sale setelah load test.
 *
 * TODO:
 *  - Bandingkan total_stock, remaining_stock, jumlah order confirmed, jumlah pembeli unik
 *  - Exit code non-zero bila tidak konsisten
 */

// Memeriksa konsistensi sebuah sale. Pemakaian: npm run verify:sale -- <saleId>
const { pool } = require('../config/db');

(async () => {
  const saleId = process.argv[2];
  if (!saleId) throw new Error('Usage: npm run verify:sale -- <saleId>');

  const { rows: [sale] } = await pool.query(
    'SELECT total_stock, remaining_stock FROM flash_sales WHERE id = $1', [saleId]);
  const { rows: [o] } = await pool.query(
    'SELECT count(*)::int AS orders, count(DISTINCT user_id)::int AS buyers FROM orders WHERE sale_id = $1', [saleId]);

  console.table({
    total_stock: sale.total_stock,
    remaining_stock: sale.remaining_stock,
    orders: o.orders,
    unique_buyers: o.buyers,
  });
  if (o.orders > sale.total_stock) console.log(`OVERSELL: ${o.orders} order untuk stok ${sale.total_stock}`);
  else if (o.orders !== sale.total_stock - sale.remaining_stock) console.log('INCONSISTENT: stok tidak cocok dengan jumlah order');
  else console.log('OK');
  await pool.end();
})().catch((err) => { console.error(err.message); process.exit(1); });