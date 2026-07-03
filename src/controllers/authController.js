const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { signToken } = require("../utils/jwt");
const {
  generateOtp,
  hashOtp,
  compareOtp,
  getOtpExpiry,
} = require("../utils/otp");
const { sendOtpEmail } = require("../utils/mailer");
const { verifyGoogleToken } = require("../config/google");
const { checkEmailDeliverable } = require("../utils/emailCheck");

const MAX_OTP_ATTEMPTS = 5;

// POST /api/auth/check-email
async function checkEmail(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ valid: false, reason: "empty" });
    }

    const result = await checkEmailDeliverable(email);
    if (!result.valid) {
      return res.json(result);
    }

    // Postgres: Gunakan $1 dan ambil data dari .rows
    const existing = await pool.query(
      "SELECT id, email_verified FROM users WHERE email = $1",
      [email],
    );

    if (existing.rows.length > 0 && existing.rows[0].email_verified) {
      return res.json({ valid: true, alreadyRegistered: true });
    }

    res.json({ valid: true, alreadyRegistered: false });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Nama, email, dan password wajib diisi." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password minimal 6 karakter." });
    }

    const emailCheck = await checkEmailDeliverable(email);
    if (!emailCheck.valid) {
      const messages = {
        format: "Format email tidak valid.",
        disposable:
          "Email sementara/sekali-pakai tidak diperbolehkan. Gunakan email aktif kamu.",
        no_mx:
          "Domain email ini sepertinya tidak valid atau tidak bisa menerima email. Cek kembali penulisannya.",
      };
      return res
        .status(400)
        .json({ message: messages[emailCheck.reason] || "Email tidak valid." });
    }

    // Postgres: Gunakan $1
    const existing = await pool.query(
      "SELECT id, email_verified, provider FROM users WHERE email = $1",
      [email],
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.provider === "local" && !existingUser.email_verified) {
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);

        // Postgres: Gunakan urutan $1, $2, $3
        await pool.query(
          "UPDATE users SET otp_code = $1, otp_expires_at = $2, otp_attempts = 0 WHERE id = $3",
          [otpHash, getOtpExpiry(), existingUser.id],
        );
        await sendOtpEmail(email, name, otp);
        return res.status(200).json({
          message:
            "Email ini sudah terdaftar tapi belum diverifikasi. Kode OTP baru sudah dikirim.",
          email,
          needsVerification: true,
        });
      }
      return res.status(409).json({ message: "Email sudah terdaftar." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Postgres: Tambahkan RETURNING id di akhir query untuk mengambil ID yang baru dibuat
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role, provider, email_verified) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [name, email, password_hash, "customer", "local", 0],
    );

    const insertedId = result.rows[0].id;

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    await pool.query(
      "UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3",
      [otpHash, getOtpExpiry(), insertedId],
    );

    try {
      await sendOtpEmail(email, name, otp);
    } catch (mailErr) {
      console.error("Gagal mengirim email OTP:", mailErr.message);
      return res.status(502).json({
        message:
          "Akun dibuat, tapi gagal mengirim email verifikasi. Coba kirim ulang OTP dari halaman verifikasi.",
        email,
        needsVerification: true,
      });
    }

    res.status(201).json({
      message: "Pendaftaran berhasil. Kode OTP telah dikirim ke email kamu.",
      email,
      needsVerification: true,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email dan kode OTP wajib diisi." });
    }

    const rows = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.rows.length === 0) {
      return res.status(404).json({ message: "Akun tidak ditemukan." });
    }

    const userRow = rows.rows[0];

    if (userRow.email_verified) {
      return res
        .status(400)
        .json({ message: "Email ini sudah terverifikasi. Silakan login." });
    }

    if (!userRow.otp_code || !userRow.otp_expires_at) {
      return res
        .status(400)
        .json({
          message: "Tidak ada kode OTP aktif. Silakan minta kode baru.",
        });
    }

    if (userRow.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return res
        .status(429)
        .json({
          message: "Terlalu banyak percobaan salah. Minta kode OTP baru.",
        });
    }

    if (new Date(userRow.otp_expires_at) < new Date()) {
      return res
        .status(400)
        .json({
          message: "Kode OTP sudah kedaluwarsa. Silakan minta kode baru.",
        });
    }

    const isMatch = await compareOtp(otp, userRow.otp_code);
    if (!isMatch) {
      await pool.query(
        "UPDATE users SET otp_attempts = otp_attempts + 1 WHERE id = $1",
        [userRow.id],
      );
      return res.status(400).json({ message: "Kode OTP salah." });
    }

    // Postgres: Ubah email_verified menjadi boolean true atau angka 1 sesuai struktur DB kamu (di Postgres disarankan boolean/integer)
    await pool.query(
      "UPDATE users SET email_verified = 1, otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = $1",
      [userRow.id],
    );

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
    };
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ message: "Email berhasil diverifikasi.", user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email wajib diisi." });
    }

    const rows = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.rows.length === 0) {
      return res.status(404).json({ message: "Akun tidak ditemukan." });
    }

    const userRow = rows.rows[0];
    if (userRow.email_verified) {
      return res
        .status(400)
        .json({ message: "Email ini sudah terverifikasi. Silakan login." });
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    await pool.query(
      "UPDATE users SET otp_code = $1, otp_expires_at = $2, otp_attempts = 0 WHERE id = $3",
      [otpHash, getOtpExpiry(), userRow.id],
    );

    await sendOtpEmail(email, userRow.name, otp);

    res.json({ message: "Kode OTP baru telah dikirim ke email kamu." });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email dan password wajib diisi." });
    }

    const rows = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (rows.rows.length === 0) {
      return res.status(401).json({ message: "Email atau password salah." });
    }

    const userRow = rows.rows[0];

    if (userRow.provider === "google" || !userRow.password_hash) {
      return res
        .status(400)
        .json({
          message:
            'Akun ini terdaftar lewat Google. Silakan masuk dengan tombol "Masuk dengan Google".',
        });
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Email atau password salah." });
    }

    if (!userRow.email_verified) {
      return res.status(403).json({
        message:
          "Email belum diverifikasi. Silakan cek kode OTP yang sudah dikirim ke emailmu.",
        needsVerification: true,
        email: userRow.email,
      });
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
    };
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/google
async function googleAuth(req, res, next) {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Token Google tidak ditemukan." });
    }

    let payload;
    try {
      payload = await verifyGoogleToken(credential);
    } catch (err) {
      return res.status(401).json({ message: "Token Google tidak valid." });
    }

    if (!payload.email_verified) {
      return res
        .status(400)
        .json({ message: "Email Google ini belum terverifikasi oleh Google." });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Postgres menggunakan OR dengan penanda parameter $1 dan $2
    const rows = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR google_id = $2",
      [email, googleId],
    );

    let userRow;
    if (rows.rows.length > 0) {
      userRow = rows.rows[0];
      if (!userRow.google_id) {
        await pool.query(
          "UPDATE users SET google_id = $1, provider = $2, email_verified = 1 WHERE id = $3",
          [
            googleId,
            userRow.provider === "local" ? userRow.provider : "google",
            userRow.id,
          ],
        );
      }
    } else {
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash, role, provider, google_id, email_verified) VALUES ($1, $2, NULL, $3, $4, $5, 1) RETURNING id",
        [name || email.split("@")[0], email, "customer", "google", googleId],
      );
      userRow = {
        id: result.rows[0].id,
        name: name || email.split("@")[0],
        email,
        role: "customer",
      };
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role,
      picture,
    };
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const rows = await pool.query(
      "SELECT id, name, email, role, created_at FROM users WHERE id = $1",
      [req.user.id],
    );
    if (rows.rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }
    res.json({ user: rows.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  me,
  verifyOtp,
  resendOtp,
  googleAuth,
  checkEmail,
};
