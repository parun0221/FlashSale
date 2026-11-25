/**
 * Mapper baris database ke bentuk JSON API untuk product.
 *
 * TODO:
 *  - toDTO: ubah snake_case ke camelCase, sembunyikan kolom sensitif
 */

exports.toProductDTO = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceCents: row.price_cents,
  createdAt: row.created_at,
});