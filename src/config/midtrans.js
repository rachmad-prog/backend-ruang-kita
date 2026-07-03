const midtransClient = require('midtrans-client');
require('dotenv').config();

if (!process.env.MIDTRANS_SERVER_KEY || !process.env.MIDTRANS_CLIENT_KEY) {
  console.warn(
    '⚠️  MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY belum diset di .env — fitur pembayaran tidak akan berfungsi.'
  );
}

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// Snap dipakai untuk membuat transaksi (Snap Token) yang dibuka sebagai popup di frontend
const snap = new midtransClient.Snap({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

module.exports = { snap };
