/**
 * Endpoint produk.
 *
 * Lapisan: routes -> controllers -> services -> repositories -> database. Hanya boleh memanggil lapisan di bawahnya.
 *
 * TODO:
 *  - GET / (cursor pagination), GET /:id
 *  - POST /, PATCH /:id khusus admin (authenticate + authorize)
 */

const router = require('express').Router();
const controller = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const validators = require('../validators/product.validator');
const { idParam, pagination } = require('../validators/common.validator');

router.get('/', validate(pagination, 'query'), controller.list);
router.get('/:id', validate(idParam, 'params'), controller.get);
router.post('/', authenticate, authorize('admin'), validate(validators.create), controller.create);
router.patch('/:id', authenticate, authorize('admin'), validate(idParam, 'params'), validate(validators.update), controller.update);

module.exports = router;