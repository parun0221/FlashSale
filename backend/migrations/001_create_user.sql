-- Rancang skema database di sini.
--
-- users        : id (uuid), name, email (UNIQUE), password_hash, role, created_at
-- products     : id, name, description, price_cents, created_at
-- flash_sales  : id, product_id (FK), sale_price_cents, total_stock, remaining_stock,
--                starts_at, ends_at, created_at
-- orders       : id, sale_id (FK), user_id (FK), status, failure_reason, created_at
--
-- TODO (constraint):
--   - flash_sales: CHECK remaining_stock >= 0 AND remaining_stock <= total_stock; CHECK ends_at > starts_at
--   - orders: satu user hanya boleh punya SATU order 'confirmed' per sale (partial unique index)
--
-- TODO (index): tentukan index untuk tiap query yang Anda tulis di repositories/.
--   Buktikan manfaatnya dengan EXPLAIN ANALYZE sebelum dan sesudah, lalu catat di docs/.
--   Petunjuk: keyset pagination butuh index pada (created_at DESC, id DESC).

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  role          text        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (email);