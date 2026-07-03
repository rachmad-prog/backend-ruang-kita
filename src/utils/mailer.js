const nodemailer = require('nodemailer');
require('dotenv').config();

// Transporter SMTP Gmail. Wajib pakai App Password (bukan password akun biasa):
// https://myaccount.google.com/apppasswords
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendOtpEmail(to, name, otp) {
  const fromName = process.env.MAIL_FROM_NAME || 'RuangKita';

  await transporter.sendMail({
    from: `"${fromName}" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Kode Verifikasi Email - RuangKita',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #e63946;">RuangKita</h2>
        <p>Halo <strong>${name}</strong>,</p>
        <p>Terima kasih sudah mendaftar. Gunakan kode berikut untuk memverifikasi alamat emailmu:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background: #f5f5f5; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 20px 0;">
          ${otp}
        </div>
        <p>Kode ini berlaku selama <strong>${process.env.OTP_EXPIRES_MINUTES || 10} menit</strong>. Jangan berikan kode ini ke siapa pun.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Jika kamu tidak merasa mendaftar di RuangKita, abaikan email ini.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
