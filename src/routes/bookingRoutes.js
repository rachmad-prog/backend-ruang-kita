const express = require('express');
const {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  cancelBooking,
} = require('../controllers/bookingController');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired); // semua endpoint booking wajib login

router.get('/', getBookings);
router.get('/:id', getBookingById);
router.post('/', createBooking);
router.put('/:id/status', requireRole('admin'), updateBookingStatus);
router.delete('/:id', cancelBooking);

module.exports = router;
