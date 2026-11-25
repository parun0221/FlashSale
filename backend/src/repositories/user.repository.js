/**
 * Query tabel users.
 *
 * Lapisan akses data: satu-satunya tempat SQL ditulis. Selalu pakai query berparameter ($1, $2). TIDAK ada logika bisnis.
 *
 * TODO:
 *  - create, findByEmail (termasuk password_hash), findById (tanpa hash)
 */

const { pool } = require('../config/db');

const PUBLIC_COLS = 'id, name, email, role, created_at';

exports.create = async ({ name, email, passwordHash }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3) RETURNING ${PUBLIC_COLS}`,
    [name, email, passwordHash]
  );
  return rows[0];
};

exports.findByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS}, password_hash FROM users WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
};

exports.findById = async (id) => {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
};