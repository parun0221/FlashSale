/**
 * Pembuat nama key Redis di satu tempat.
 *
 * Mencegah typo dan key yang tersebar di banyak file.
 *
 * TODO:
 *  - Key stok sale
 *  - Key set pembeli sale
 *  - Key refresh token
 */

module.exports = Object.freeze({
  saleStock: (saleId) => `sale:${saleId}:stock`,
  saleBuyers: (saleId) => `sale:${saleId}:buyers`,
  refreshToken: (userId) => `refresh-token:${userId}`,
});