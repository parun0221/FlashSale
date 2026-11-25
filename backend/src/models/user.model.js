/**
 * Mapper baris database ke bentuk JSON API untuk user.
 *
 * TODO:
 *  - toDTO: ubah snake_case ke camelCase, sembunyikan kolom sensitif
 */

exports.toUserDTO = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
});