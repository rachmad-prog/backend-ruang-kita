const { pool } = require("../config/db");

const BOOKING_SELECT = `
  SELECT b.*, r.name AS room_name, r.price_per_day, u.name AS user_name, u.email AS user_email
  FROM bookings b
  JOIN rooms r ON r.id = b.room_id
  JOIN users u ON u.id = b.user_id
`;

// GET /api/bookings
async function getBookings(req, res, next) {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query(`${BOOKING_SELECT} ORDER BY b.start_time DESC`);
    } else {
      result = await pool.query(
        `${BOOKING_SELECT} WHERE b.user_id = $1 ORDER BY b.start_time DESC`,
        [req.user.id],
      );
    }
    res.json({ bookings: result.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
async function getBookingById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Booking tidak ditemukan." });
    }
    const booking = result.rows[0];
    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak melihat booking ini." });
    }
    res.json({ booking });
  } catch (err) {
    next(err);
  }
}

// POST /api/bookings
async function createBooking(req, res, next) {
  try {
    const { room_id, start_time, end_time, notes } = req.body;

    if (!room_id || !start_time || !end_time) {
      return res.status(400).json({
        message:
          "room_id, tanggal check-in, dan tanggal check-out wajib diisi.",
      });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Format tanggal tidak valid." });
    }
    if (end <= start) {
      return res
        .status(400)
        .json({ message: "Tanggal check-out harus setelah tanggal check-in." });
    }

    const todayDateOnly = new Date();
    todayDateOnly.setHours(0, 0, 0, 0);
    if (start < todayDateOnly) {
      return res.status(400).json({
        message: "Tidak bisa booking untuk tanggal yang sudah lewat.",
      });
    }

    // Postgres: Menggunakan is_active = true murni (bukan integer 1)
    const roomRows = await pool.query(
      "SELECT * FROM rooms WHERE id = $1 AND is_active = true",
      [room_id],
    );
    if (roomRows.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Room tidak ditemukan atau tidak aktif." });
    }
    const room = roomRows.rows[0];

    // Cek konflik jadwal ruangan
    const conflicts = await pool.query(
      `SELECT id FROM bookings
       WHERE room_id = $1
         AND status != 'cancelled'
         AND start_time < $2
         AND end_time > $3`,
      [room_id, end_time, start_time],
    );

    if (conflicts.rows.length > 0) {
      return res.status(409).json({
        message: "Room sudah dibooking pada rentang tanggal tersebut.",
      });
    }

    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const total_price =
      Math.round(days * Number(room.price_per_day) * 100) / 100;

    // Postgres: Menggunakan klausa RETURNING id di bagian akhir insert
    const result = await pool.query(
      `INSERT INTO bookings (user_id, room_id, start_time, end_time, status, notes, total_price)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6) RETURNING id`,
      [req.user.id, room_id, start_time, end_time, notes || null, total_price],
    );

    const insertedId = result.rows[0].id;

    // Ambil data lengkap booking yang baru dibuat untuk dikirim kembali ke frontend
    const bookingSelect = await pool.query(
      `${BOOKING_SELECT} WHERE b.id = $1`,
      [insertedId],
    );

    res.status(201).json({ booking: bookingSelect.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bookings/:id/status (admin)
async function updateBookingStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Status tidak valid." });
    }

    const existing = await pool.query("SELECT * FROM bookings WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Booking tidak ditemukan." });
    }

    await pool.query("UPDATE bookings SET status = $1 WHERE id = $2", [
      status,
      id,
    ]);
    const bookingSelect = await pool.query(
      `${BOOKING_SELECT} WHERE b.id = $1`,
      [id],
    );
    res.json({ booking: bookingSelect.rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:id
async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT * FROM bookings WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Booking tidak ditemukan." });
    }
    const booking = existing.rows[0];

    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak membatalkan booking ini." });
    }

    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [
      id,
    ]);
    res.json({ message: "Booking berhasil dibatalkan." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBookings,
  getBookingById,
  createBooking,
  updateBookingStatus,
  cancelBooking,
};
