/**
 * Endpoint autentikasi.
 *
 * Lapisan: routes -> controllers -> services -> repositories -> database. Hanya boleh memanggil lapisan di bawahnya.
 *
 * TODO:
 *  - POST /register, /login, /refresh, /logout
 *  - Pasang rate limiter ketat untuk register/login (anti brute force)
 *  - Pasang validate(schema) sebelum controller
 */

const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const validators = require('../validators/auth.validator');
const rateLimit = require('../middleware/rateLimit.middleware');

const authLimiter = rateLimit({
  name: 'auth',
  capacity: 10,
  refillPerSec: 0.2,      // 1 token tiap 5 detik
  keyFn: (req) => req.ip,
});

router.post('/register', authLimiter, validate(validators.register), controller.register);
router.post('/login', authLimiter, validate(validators.login), controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', authenticate, controller.logout);

module.exports = router;