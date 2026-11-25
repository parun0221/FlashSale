/**
 * Menjalankan file SQL di /migrations secara berurutan.
 *
 * TODO:
 *  - Tabel schema_migrations untuk mencatat yang sudah dijalankan
 *  - Advisory lock agar dua proses tidak migrasi bersamaan
 *  - Tiap file dalam satu transaksi
 *  - Ekspor runMigrations() agar bisa dipakai test
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('Migrations up to date.');
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });