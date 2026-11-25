/**
 * Koneksi PostgreSQL.
 *
 * TODO:
 *  - Buat SATU pg.Pool untuk seluruh proses (connection pooling)
 *  - Atur max, idleTimeoutMillis, connectionTimeoutMillis, statement_timeout, query_timeout
 *  - Tangani event 'error' pada pool
 *  - Helper withTransaction(fn): BEGIN, COMMIT, ROLLBACK, release client di finally
 *  - Ekspor { pool, withTransaction }
 */

const { Pool } = require('pg');
const config = require('./index');

// SATU pool untuk seluruh aplikasi: koneksi dipakai ulang, bukan dibuka per request.
const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,               // gagal cepat bila DB mati / pool penuh
  statement_timeout: config.db.statementTimeoutMs, // query lambat dihentikan oleh server
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release(); // WAJIB: tanpa ini koneksi tidak pernah kembali ke pool
  }
}

pool.on('error', (err) => console.error('Unexpected pg pool error:', err.message));

module.exports = { pool, withTransaction };