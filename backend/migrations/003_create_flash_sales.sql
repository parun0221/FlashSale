CREATE TABLE flash_sales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid        NOT NULL REFERENCES products (id),
  sale_price_cents integer     NOT NULL CHECK (sale_price_cents >= 0),
  total_stock      integer     NOT NULL CHECK (total_stock > 0),
  remaining_stock  integer     NOT NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (remaining_stock >= 0 AND remaining_stock <= total_stock)
);