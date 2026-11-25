/**
 * Mapper baris database ke bentuk JSON API untuk order.
 *
 * TODO:
 *  - toDTO: ubah snake_case ke camelCase, sembunyikan kolom sensitif
 */

exports.toOrderDTO = (row) => ({
  id: row.id,
  saleId: row.sale_id,
  userId: row.user_id,
  priceCents: row.price_cents,
  createdAt: row.created_at,
});