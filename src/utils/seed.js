// Jalankan: npm run seed
// Membuat 1 akun admin dan 1 akun customer default untuk testing.
const bcrypt = require("bcryptjs");
const { pool } = require("./db"); // Sesuaikan path jika letak file ini di folder lain

async function seed() {
  const password = "password123";
  const hash = await bcrypt.hash(password, 10);

  const users = [
    ["Admin User", "admin@example.com", hash, "admin"],
    ["Customer Demo", "customer@example.com", hash, "customer"],
  ];

  for (const [name, email, password_hash, role] of users) {
    // Postgres: Ganti ? menjadi $1 dan baca via result.rows
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0) {
      console.log(`⏭️  Skip, sudah ada: ${email}`);
      continue;
    }

    // Postgres: Ganti ? menjadi $1, $2, $3, $4 dan berikan nilai default untuk email_verified (misal: 1 agar langsung aktif saat testing)
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, provider, email_verified) VALUES ($1, $2, $3, $4, $5, $6)",
      [name, email, password_hash, role, "local", 1],
    );
    console.log(`✅ Dibuat: ${email} (role: ${role}) — password: ${password}`);
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error("Gagal seeding:", err);
  process.exit(1);
});
