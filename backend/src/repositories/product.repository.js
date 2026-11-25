/**
 * Query tabel products.
 *
 * Lapisan akses data: satu-satunya tempat SQL ditulis. Selalu pakai query berparameter ($1, $2). TIDAK ada logika bisnis.
 *
 * TODO:
 *  - list dengan keyset pagination (created_at, id)
 *  - findById, create, update (kolom dinamis dari whitelist)
 */

const { pool } = require('../config/db');
const { cursorTs } = require('../utils/pagination');

const COLS = 'id, name, description, price_cents, created_at';

exports.list = async ({ limit, cursor }) => {
  const params = [limit + 1];
  let where = '';
  if (cursor) {
    params.push(cursor.ts, cursor.id);
    where = 'WHERE (created_at, id) < ($2::timestamptz, $3::uuid)';
  }
  const { rows } = await pool.query(
    `SELECT ${COLS}, ${cursorTs()} FROM products ${where}
     ORDER BY created_at DESC, id DESC LIMIT $1`,
    params
  );
  return rows;
};

exports.findById = async (id) => {
  const { rows } = await pool.query(`SELECT ${COLS} FROM products WHERE id = $1`, [id]);
  return rows[0] || null;
};

exports.create = async ({ name, description = '', priceCents }) => {
  const { rows } = await pool.query(
    `INSERT INTO products (name, description, price_cents)
     VALUES ($1, $2, $3) RETURNING ${COLS}`,
    [name, description, priceCents]
  );
  return rows[0];
};

// Nama kolom TIDAK boleh berasal dari input user. Daftar putih ini yang menentukan.
const UPDATABLE = { name: 'name', description: 'description', priceCents: 'price_cents' };

exports.update = async (id, data) => {
  const sets = [];
  const params = [id];
  for (const [key, column] of Object.entries(UPDATABLE)) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  if (sets.length === 0) return exports.findById(id);
  const { rows } = await pool.query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLS}`,
    params
  );
  return rows[0] || null;
};