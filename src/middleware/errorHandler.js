// Middleware penangkap error terakhir (dipasang paling bawah di server.js)
function errorHandler(err, req, res, next) {
  console.error("🔥 Error:", err.message);

  // Postgres menggunakan kode '23505' untuk error data unik/duplikat (Unique Violation)
  if (err.code === "23505" || err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ message: "Data sudah ada (duplikat)." });
  }

  // Error dari multer (upload foto): file terlalu besar, terlalu banyak, dll.
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "Ukuran file maksimal 5MB per foto." });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ message: "Maksimal 10 foto per upload." });
    }
    return res.status(400).json({ message: `Upload gagal: ${err.message}` });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Terjadi kesalahan pada server.",
  });
}

function notFound(req, res) {
  res
    .status(404)
    .json({
      message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`,
    });
}

module.exports = { errorHandler, notFound };
