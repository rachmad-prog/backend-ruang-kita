const express = require('express');
const { register, login, me, verifyOtp, resendOtp, googleAuth, checkEmail } = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/check-email', checkEmail);
router.post('/register', register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/google', googleAuth);
router.post('/login', login);
router.get('/me', authRequired, me);

module.exports = router;
