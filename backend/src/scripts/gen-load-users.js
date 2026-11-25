/**
 * Membuat N user dan token untuk load test.
 *
 * TODO:
 *  - Insert massal dengan generate_series (hindari bcrypt ribuan kali)
 *  - Tulis access token ke loadtest/tokens.json
 */

// Membuat N user langsung di DB dan menulis token mereka ke loadtest/tokens.json.
// Pemakaian: npm run load:users -- 200
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signAccessToken } = require('../utils/tokens');

const count = Number(process.argv[2] || 200);

(async () => {
  const hash = await bcrypt.hash('loadtest-password', 4); // satu hash dipakai semua, supaya cepat
  await pool.query(
    `INSERT INTO users (name, email, password_hash)
     SELECT 'Load User ' || i, 'load' || i || '@example.com', $1 FROM generate_series(1, $2) AS i
     ON CONFLICT DO NOTHING`,
    [hash, count]
  );
  const { rows } = await pool.query(
    `SELECT id, role FROM users WHERE email ~ '^load[0-9]+@example[.]com$' LIMIT $1`,
    [count]
  );
  const tokens = rows.map((u) => signAccessToken(u));
  fs.writeFileSync(path.join(__dirname, '..', '..', 'loadtest', 'tokens.json'), JSON.stringify(tokens));
  console.log(`Wrote ${tokens.length} tokens (berlaku 15 menit)`);
  await pool.end();
})().catch((err) => { console.error(err); process.exit(1); });