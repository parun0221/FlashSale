/**
 * Membungkus handler async agar error diteruskan ke next().
 *
 * TODO:
 *  - Satu fungsi pendek; pahami kenapa Express 4 membutuhkannya
 */

module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);