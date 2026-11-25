CREATE TABLE products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  price_cents integer     NOT NULL CHECK (price_cents >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- mendukung ORDER BY created_at DESC, id DESC (dasar cursor pagination)
CREATE INDEX products_created_idx ON products (created_at DESC, id DESC);