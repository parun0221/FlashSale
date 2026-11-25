/**
 * Cursor pagination (keyset).
 *
 * TODO:
 *  - encodeCursor / decodeCursor (base64url, validasi ketat, error -> 400)
 *  - Perhatikan presisi timestamp: Date JS hanya milidetik, Postgres mikrodetik
 *  - toPage(rows, limit): ambil limit + 1 baris untuk tahu apakah ada halaman berikutnya
 */

const ApiError = require('./ApiError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Timestamp diambil sebagai TEKS berpresisi mikrodetik. Date milik JavaScript hanya
// milidetik, sehingga cursor yang dibuat dari Date bisa membuat baris terlewat atau dobel.
const cursorTs = (col = 'created_at') =>
  `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_ts`;

function encodeCursor(ts, id) {
  return Buffer.from(JSON.stringify([ts, id])).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [ts, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof ts !== 'string' || Number.isNaN(Date.parse(ts)) || !UUID_RE.test(id)) throw new Error();
    return { ts, id };
  } catch {
    throw new ApiError(400, 'Invalid cursor');
  }
}

// Query harus mengambil (limit + 1) baris. Kelebihan satu baris itu hanya penanda
// "masih ada halaman berikutnya"; barisnya sendiri tidak dikirim ke client.
function toPage(rows, limit) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items: items.map(({ cursor_ts, ...row }) => row),
    nextCursor: hasMore ? encodeCursor(last.cursor_ts, last.id) : null,
  };
}

module.exports = { cursorTs, encodeCursor, decodeCursor, toPage };