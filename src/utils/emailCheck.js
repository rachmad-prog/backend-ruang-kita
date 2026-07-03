const dns = require('dns').promises;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Daftar kecil domain "sekali pakai" / disposable yang umum dipakai buat akun palsu.
// Bukan daftar lengkap, tapi lumayan buat nyaring kasus paling umum.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
]);

/**
 * Mengecek apakah sebuah alamat email formatnya valid DAN domainnya
 * benar-benar bisa menerima email (punya MX record, atau minimal A record
 * sebagai fallback sesuai standar SMTP).
 * Ini TIDAK memastikan mailbox spesifiknya ada — itu baru dipastikan lewat OTP.
 */
async function checkEmailDeliverable(email) {
  if (!email || !EMAIL_REGEX.test(email)) {
    return { valid: false, reason: 'format' };
  }

  const domain = email.split('@')[1].toLowerCase();

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, reason: 'disposable' };
  }

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      return { valid: true };
    }
  } catch (err) {
    // ENOTFOUND / ENODATA -> tidak ada MX record, lanjut cek fallback A record di bawah
  }

  // Sebagian domain kecil tidak punya MX record eksplisit tapi tetap bisa terima
  // email lewat A record (fallback sesuai RFC 5321). Coba cek ini sebelum menolak.
  try {
    const aRecords = await dns.resolve(domain);
    if (aRecords && aRecords.length > 0) {
      return { valid: true };
    }
  } catch (err) {
    // domain benar-benar tidak bisa di-resolve
  }

  return { valid: false, reason: 'no_mx' };
}

module.exports = { checkEmailDeliverable, EMAIL_REGEX };
