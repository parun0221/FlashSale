/**
 * Endpoint flash sale dan pembelian.
 *
 * Lapisan: routes -> controllers -> services -> repositories -> database. Hanya boleh memanggil lapisan di bawahnya.
 *
 * TODO:
 *  - GET /, GET /:id
 *  - POST / khusus admin
 *  - POST /:id/orders dengan urutan: authenticate, rate limiter per user, validate params, idempotency, controller
 */

const router = require('express').Router();
const controller = require('../controllers/sale.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const validators = require('../validators/sale.validator');
const { idParam } = require('../validators/common.validator');

router.get('/:id', validate(idParam, 'params'), controller.get);
router.post('/', authenticate, authorize('admin'), validate(validators.create), controller.create);
router.post('/:id/orders', authenticate, validate(idParam, 'params'), controller.placeOrder);
router.get('/', controller.listUpcomingAndActive);

module.exports = router;