const express = require('express');
const {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  uploadRoomImages,
  deleteRoomImage,
} = require('../controllers/roomController');
const { authRequired, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/', getRooms);
router.get('/:id', getRoomById);
router.post('/', authRequired, requireRole('admin'), createRoom);
router.put('/:id', authRequired, requireRole('admin'), updateRoom);
router.delete('/:id', authRequired, requireRole('admin'), deleteRoom);

// Multi-foto per room
router.post('/:id/images', authRequired, requireRole('admin'), upload.array('images', 10), uploadRoomImages);
router.delete('/:id/images/:imageId', authRequired, requireRole('admin'), deleteRoomImage);

module.exports = router;
