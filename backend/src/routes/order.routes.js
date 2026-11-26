/**
 * Endpoint order milik user.
 *
 * Lapisan: routes -> controllers -> services -> repositories -> database. Hanya boleh memanggil lapisan di bawahnya.
 *
 * TODO:
 *  - authenticate untuk semua route
 *  - GET / (cursor pagination), GET /:id
 */

const router = require('express').Router();
const controller = require('../controllers/order.controller');
const { authenticate } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { idParam } = require('../validators/common.validator');

router.get('/:id', authenticate, validate(idParam, 'params'), controller.get);

module.exports = router;