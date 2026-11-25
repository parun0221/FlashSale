/**
 * Mapper baris database ke bentuk JSON API untuk sale.
 *
 * TODO:
 *  - toDTO: ubah snake_case ke camelCase, sembunyikan kolom sensitif
 */

exports.toSaleDTO = (row) => ({
  id: row.id,
  productId: row.product_id,
  salePriceCents: row.sale_price_cents,
  totalStock: row.total_stock,
  remainingStock: row.remaining_stock,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdAt: row.created_at,
});