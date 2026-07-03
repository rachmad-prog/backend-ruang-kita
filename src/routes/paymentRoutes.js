const express = require('express');
const {
  createPayment,
  handleNotification,
  getPaymentByBooking,
} = require('../controllers/paymentController');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Webhook Midtrans HARUS publik (tidak pakai authRequired) karena dipanggil
// langsung oleh server Midtrans, bukan oleh browser user yang login.
router.post('/notification', handleNotification);

router.post('/', authRequired, createPayment);
router.get('/booking/:bookingId', authRequired, getPaymentByBooking);

module.exports = router;
