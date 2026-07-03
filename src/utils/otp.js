const bcrypt = require('bcryptjs');

function generateOtp() {
  // Kode 6 digit, contoh: "042817"
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, hash) {
  return bcrypt.compare(otp, hash);
}

function getOtpExpiry() {
  const minutes = Number(process.env.OTP_EXPIRES_MINUTES || 10);
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = { generateOtp, hashOtp, compareOtp, getOtpExpiry };
