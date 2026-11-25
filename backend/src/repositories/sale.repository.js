/**
 * Query tabel flash_sales.
 *
 * Lapisan akses data: satu-satunya tempat SQL ditulis. Selalu pakai query berparameter ($1, $2). TIDAK ada logika bisnis.
 *
 * TODO:
 *  - findById (JOIN products)
 *  - listUpcomingAndActive dengan cursor
 *  - create
 *  - decrementStock(client, id): UPDATE ... WHERE remaining_stock > 0 RETURNING (ini pertahanan kedua anti oversell)
 */

const { pool } = require('../config/db');
const { cursorTs } = require('../utils/pagination');

const COLS = 'id, product_id, sale_price_cents, total_stock, remaining_stock, starts_at, ends_at, created_at';

exports.listUpcomingAndActive = async ({ limit, cursor }) => {
  const params = [limit + 1];
  let where = 'WHERE ends_at > NOW()';
  if (cursor) {
    params.push(cursor.ts, cursor.id);
    where += ' AND (starts_at, id) > ($2::timestamptz, $3::uuid)';
  }
  const { rows } = await pool.query(
    `SELECT ${COLS}, ${cursorTs()} FROM flash_sales ${where}
     ORDER BY starts_at ASC, id ASC LIMIT $1`,
    params
  );
  return rows;
};

exports.findById = async (id) => {
  const { rows } = await pool.query(`SELECT ${COLS} FROM flash_sales WHERE id = $1`, [id]);
  return rows[0] || null;
};

exports.create = async ({ productId, salePriceCents, totalStock, startsAt, endsAt }) => {
  const { rows } = await pool.query(
    `INSERT INTO flash_sales (product_id, sale_price_cents, total_stock, remaining_stock, starts_at, ends_at)
     VALUES ($1, $2, $3, $3, $4, $5) RETURNING ${COLS}`,
    [productId, salePriceCents, totalStock, startsAt, endsAt]
  );
  return rows[0];
};


exports.decrementStock = async (client, id) => {
  const { rows } = await client.query(
    `UPDATE flash_sales SET remaining_stock = remaining_stock - 1
      WHERE id = $1 AND remaining_stock > 0
      RETURNING remaining_stock`,
    [id]
  );
  return rows[0] || null; // null = stok sudah habis
};