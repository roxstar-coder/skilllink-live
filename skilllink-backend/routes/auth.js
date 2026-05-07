const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-login-otp', authController.verifyLoginOtp);
router.get('/me', auth, authController.getCurrentUser);

module.exports = router;
