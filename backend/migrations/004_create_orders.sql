CREATE TABLE orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     uuid       NOT NULL REFERENCES flash_sales (id),
  user_id     uuid       NOT NULL REFERENCES users (id),
  price_cents integer    NOT NULL CHECK (price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC, id DESC);
-- satu user hanya boleh punya satu order per sale; database yang menjamin ini
CREATE UNIQUE INDEX orders_one_per_user_per_sale ON orders (sale_id, user_id);