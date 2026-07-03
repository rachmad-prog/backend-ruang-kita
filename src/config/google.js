const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Verifikasi ID token yang dikirim frontend (Google Identity Services).
// Google sudah memastikan email ini valid & milik user, jadi tidak perlu OTP lagi.
async function verifyGoogleToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // { sub, email, email_verified, name, picture, ... }
}

module.exports = { verifyGoogleToken };
