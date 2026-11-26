/**
 * Menggabungkan semua router API.
 *
 * Lapisan: routes -> controllers -> services -> repositories -> database. Hanya boleh memanggil lapisan di bawahnya.
 *
 * TODO:
 *  - router.use('/auth' | '/products' | '/sales' | '/orders')
 */

const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/sales', require('./sale.routes'));
router.use('/orders', require('./order.routes'));

module.exports = router;