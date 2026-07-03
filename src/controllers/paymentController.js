const crypto = require("crypto");
const { pool } = require("../config/db");
const { snap } = require("../config/midtrans");

function mapMidtransStatus(transaction_status, fraud_status) {
  if (transaction_status === "capture") {
    return fraud_status === "accept" ? "capture" : "pending";
  }
  if (transaction_status === "settlement") return "settlement";
  if (transaction_status === "pending") return "pending";
  if (["deny", "cancel", "expire", "failure"].includes(transaction_status)) {
    return transaction_status;
  }
  return "pending";
}

function isPaidStatus(status) {
  return status === "settlement" || status === "capture";
}

function isFailedStatus(status) {
  return ["deny", "cancel", "expire", "failure"].includes(status);
}

// POST /api/payments
async function createPayment(req, res, next) {
  try {
    const { booking_id } = req.body;
    if (!booking_id) {
      return res.status(400).json({ message: "booking_id wajib diisi." });
    }

    // Postgres: Ganti ? menjadi $1
    const bookingRows = await pool.query(
      `SELECT b.*, r.name AS room_name, u.name AS user_name, u.email AS user_email
       FROM bookings b
       JOIN rooms r ON r.id = b.room_id
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [booking_id],
    );

    if (bookingRows.rows.length === 0) {
      return res.status(404).json({ message: "Booking tidak ditemukan." });
    }
    const booking = bookingRows.rows[0];

    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak membayar booking ini." });
    }
    if (booking.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Booking ini sudah dibatalkan, tidak bisa dibayar." });
    }
    if (booking.payment_status === "paid") {
      return res.status(400).json({ message: "Booking ini sudah lunas." });
    }

    const order_id = `BOOKING-${booking.id}-${Date.now()}`;
    const gross_amount = Math.round(Number(booking.total_price));

    const parameter = {
      transaction_details: { order_id, gross_amount },
      customer_details: {
        first_name: booking.user_name,
        email: booking.user_email,
      },
      item_details: [
        {
          id: `ROOM-${booking.room_id}`,
          price: gross_amount,
          quantity: 1,
          name: `Booking ${booking.room_name}`.slice(0, 50),
        },
      ],
      callbacks: {
        finish: `${process.env.CLIENT_URL || "http://localhost:5173"}/bookings`,
      },
    };

    const transaction = await snap.createTransaction(parameter);

    // Postgres: Parameter berurutan $1, $2, $3, $4
    await pool.query(
      `INSERT INTO payments (booking_id, order_id, amount, status, snap_token)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [booking.id, order_id, gross_amount, transaction.token],
    );

    await pool.query(
      "UPDATE bookings SET payment_status = 'pending' WHERE id = $1",
      [booking.id],
    );

    res.status(201).json({
      snap_token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/notification (Webhook Midtrans)
async function handleNotification(req, res, next) {
  try {
    const body = req.body;
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id,
    } = body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return res
        .status(400)
        .json({ message: "Payload notifikasi tidak lengkap." });
    }

    const expectedSignature = crypto
      .createHash("sha512")
      .update(
        order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY,
      )
      .digest("hex");

    if (expectedSignature !== signature_key) {
      return res.status(401).json({ message: "Signature tidak valid." });
    }

    // Postgres: Ganti ? menjadi $1
    const paymentRows = await pool.query(
      "SELECT * FROM payments WHERE order_id = $1",
      [order_id],
    );
    if (paymentRows.rows.length === 0) {
      return res.status(404).json({ message: "Transaksi tidak ditemukan." });
    }
    const payment = paymentRows.rows[0];

    const mappedStatus = mapMidtransStatus(transaction_status, fraud_status);
    const paid = isPaidStatus(mappedStatus);
    const failed = isFailedStatus(mappedStatus);

    await pool.query(
      `UPDATE payments
       SET status = $1, payment_type = $2, transaction_id = $3, raw_response = $4, paid_at = $5
       WHERE order_id = $6`,
      [
        mappedStatus,
        payment_type || null,
        transaction_id || null,
        JSON.stringify(body),
        paid ? new Date() : null,
        order_id,
      ],
    );

    let bookingPaymentStatus = "pending";
    if (paid) bookingPaymentStatus = "paid";
    else if (failed) bookingPaymentStatus = "failed";

    await pool.query("UPDATE bookings SET payment_status = $1 WHERE id = $2", [
      bookingPaymentStatus,
      payment.booking_id,
    ]);

    if (paid) {
      await pool.query(
        "UPDATE bookings SET status = 'confirmed' WHERE id = $1 AND status != 'cancelled'",
        [payment.booking_id],
      );
    }

    res.status(200).json({ message: "Notifikasi diproses." });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/booking/:bookingId
async function getPaymentByBooking(req, res, next) {
  try {
    const { bookingId } = req.params;

    // Postgres: Ganti ? menjadi $1
    const bookingRows = await pool.query(
      "SELECT * FROM bookings WHERE id = $1",
      [bookingId],
    );
    if (bookingRows.rows.length === 0) {
      return res.status(404).json({ message: "Booking tidak ditemukan." });
    }
    const booking = bookingRows.rows[0];
    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Tidak berhak mengakses data ini." });
    }

    const result = await pool.query(
      "SELECT id, order_id, amount, status, payment_type, paid_at, created_at FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1",
      [bookingId],
    );

    res.json({
      payment: result.rows[0] || null,
      payment_status: booking.payment_status,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createPayment, handleNotification, getPaymentByBooking };
