const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Wajib untuk Supabase
  },
});

async function testConnection() {
  try {
    const conn = await pool.connect();
    console.log("✅ Database Supabase (PostgreSQL) terhubung.");
    conn.release();
  } catch (err) {
    console.error("❌ Gagal terhubung ke database:", err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
