/**
 * Query tabel orders.
 *
 * Lapisan akses data: satu-satunya tempat SQL ditulis. Selalu pakai query berparameter ($1, $2). TIDAK ada logika bisnis.
 *
 * TODO:
 *  - insertConfirmed(client, ...) dengan ON CONFLICT DO NOTHING
 *  - insertFailed
 *  - findById
 *  - listByUser dengan cursor
 */

const { pool } = require('../config/db');


const COLS = 'id, sale_id, user_id, price_cents, created_at';

exports.create = async (client, { saleId, userId, priceCents }) => {
  const { rows } = await client.query(
    `INSERT INTO orders (sale_id, user_id, price_cents)
     VALUES ($1, $2, $3) RETURNING ${COLS}`,
    [saleId, userId, priceCents]
  );
  return rows[0];
};