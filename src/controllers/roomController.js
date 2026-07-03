const { pool } = require("../config/db");
const cloudinary = require("../config/cloudinary");

// Kategori yang didukung. Dipakai untuk validasi ringan di createRoom/updateRoom.
const ALLOWED_CATEGORIES = [
  "Meeting Room",
  "Aula Konferensi",
  "Coworking Desk",
  "Lainnya",
];

// Ambil semua room lalu tempelkan array `images` untuk masing-masing (menghindari N+1 query).
async function attachImages(rooms) {
  if (rooms.length === 0) return rooms;
  const ids = rooms.map((r) => r.id);

  // Postgres: Gunakan ANY($1) untuk mencocokkan array dari ID, data diambil via .rows
  const imageRows = await pool.query(
    `SELECT * FROM room_images WHERE room_id = ANY($1) ORDER BY sort_order ASC, id ASC`,
    [ids],
  );

  const byRoom = {};
  for (const img of imageRows.rows) {
    if (!byRoom[img.room_id]) byRoom[img.room_id] = [];
    byRoom[img.room_id].push(img);
  }
  return rooms.map((r) => ({ ...r, images: byRoom[r.id] || [] }));
}

// GET /api/rooms
async function getRooms(req, res, next) {
  try {
    const { country, location, includeInactive } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (includeInactive !== "true") {
      conditions.push(`is_active = true`);
    }
    if (country) {
      conditions.push(`country LIKE $${paramIndex}`);
      params.push(`%${country}%`);
      paramIndex++;
    }
    if (location) {
      conditions.push(`location LIKE $${paramIndex}`);
      params.push(`%${location}%`);
      paramIndex++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM rooms ${where} ORDER BY name ASC`,
      params,
    );
    const rooms = await attachImages(result.rows);
    res.json({ rooms });
  } catch (err) {
    next(err);
  }
}

// GET /api/rooms/:id
async function getRoomById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM rooms WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Room tidak ditemukan." });
    }
    const rooms = await attachImages(result.rows);
    res.json({ room: rooms[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms (admin)
async function createRoom(req, res, next) {
  try {
    const {
      name,
      description,
      capacity,
      price_per_day,
      image_url,
      category,
      location,
      country,
      rating,
    } = req.body;
    if (!name || !capacity || price_per_day === undefined) {
      return res
        .status(400)
        .json({ message: "name, capacity, dan price_per_day wajib diisi." });
    }
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: `category harus salah satu dari: ${ALLOWED_CATEGORIES.join(", ")}`,
      });
    }
    if (rating !== undefined && (rating < 0 || rating > 5)) {
      return res.status(400).json({ message: "rating harus antara 0 dan 5." });
    }

    // Postgres: Tambahkan RETURNING id di akhir query
    const result = await pool.query(
      `INSERT INTO rooms (name, description, capacity, price_per_day, image_url, category, location, country, rating)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        name,
        description || null,
        capacity,
        price_per_day,
        image_url || null,
        category || "Lainnya",
        location || null,
        country || "Indonesia",
        rating || 0,
      ],
    );

    const insertedId = result.rows[0].id;
    const roomSelect = await pool.query("SELECT * FROM rooms WHERE id = $1", [
      insertedId,
    ]);
    const rooms = await attachImages(roomSelect.rows);
    res.status(201).json({ room: rooms[0] });
  } catch (err) {
    next(err);
  }
}

// PUT /api/rooms/:id (admin)
async function updateRoom(req, res, next) {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      capacity,
      price_per_day,
      image_url,
      category,
      location,
      country,
      rating,
      is_active,
    } = req.body;

    const existing = await pool.query("SELECT * FROM rooms WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Room tidak ditemukan." });
    }
    const current = existing.rows[0];

    if (category && !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: `category harus salah satu dari: ${ALLOWED_CATEGORIES.join(", ")}`,
      });
    }
    if (rating !== undefined && (rating < 0 || rating > 5)) {
      return res.status(400).json({ message: "rating harus antara 0 dan 5." });
    }

    await pool.query(
      `UPDATE rooms SET name = $1, description = $2, capacity = $3, price_per_day = $4, image_url = $5,
       category = $6, location = $7, country = $8, rating = $9, is_active = $10
       WHERE id = $11`,
      [
        name ?? current.name,
        description ?? current.description,
        capacity ?? current.capacity,
        price_per_day ?? current.price_per_day,
        image_url ?? current.image_url,
        category ?? current.category,
        location ?? current.location,
        country ?? current.country,
        rating ?? current.rating,
        is_active ?? current.is_active,
        id,
      ],
    );

    const roomSelect = await pool.query("SELECT * FROM rooms WHERE id = $1", [
      id,
    ]);
    const rooms = await attachImages(roomSelect.rows);
    res.json({ room: rooms[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rooms/:id (admin) - soft delete
async function deleteRoom(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT id FROM rooms WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Room tidak ditemukan." });
    }
    await pool.query("UPDATE rooms SET is_active = 0 WHERE id = $1", [id]);
    res.json({ message: "Room berhasil dinonaktifkan." });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms/:id/images (admin)
async function uploadRoomImages(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await pool.query("SELECT id FROM rooms WHERE id = $1", [
      id,
    ]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Room tidak ditemukan." });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "Tidak ada file yang diupload." });
    }

    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS "maxOrder" FROM room_images WHERE room_id = $1',
      [id],
    );

    let order = orderResult.rows[0].maxOrder + 1;
    const inserted = [];
    for (const file of files) {
      // file.path = secure_url dari Cloudinary (URL publik yang bisa langsung diakses)
      const imageUrl = file.path;
      const result = await pool.query(
        "INSERT INTO room_images (room_id, image_url, sort_order) VALUES ($1, $2, $3) RETURNING id",
        [id, imageUrl, order],
      );
      inserted.push({
        id: result.rows[0].id,
        room_id: Number(id),
        image_url: imageUrl,
        sort_order: order,
      });
      order += 1;
    }

    // Setelah upload foto baru, cek ulang urutan foto (sort_order ASC) supaya
    // kolom rooms.image_url (dipakai di halaman listing) selalu mengikuti foto
    // pertama yang berlaku saat ini -- bukan cuma diisi sekali waktu masih null.
    const firstImageResult = await pool.query(
      "SELECT image_url FROM room_images WHERE room_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1",
      [id],
    );
    if (firstImageResult.rows.length > 0) {
      await pool.query("UPDATE rooms SET image_url = $1 WHERE id = $2", [
        firstImageResult.rows[0].image_url,
        id,
      ]);
    }

    res.status(201).json({ images: inserted });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rooms/:id/images/:imageId (admin)
async function deleteRoomImage(req, res, next) {
  try {
    const { id, imageId } = req.params;
    const result = await pool.query(
      "SELECT * FROM room_images WHERE id = $1 AND room_id = $2",
      [imageId, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Foto tidak ditemukan." });
    }
    const image = result.rows[0];

    await pool.query("DELETE FROM room_images WHERE id = $1", [imageId]);

    // Hapus juga asset-nya di Cloudinary supaya storage tidak menumpuk.
    // Hanya coba hapus kalau URL memang dari Cloudinary (foto lama sebelum migrasi mungkin masih path lokal).
    if (image.image_url.includes("res.cloudinary.com")) {
      const match = image.image_url.match(
        /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/,
      );
      if (match) {
        const publicId = match[1];
        cloudinary.uploader.destroy(publicId).catch(() => {});
      }
    }

    // Kalau foto yang dihapus adalah cover (rooms.image_url), sinkronkan ulang
    // ke foto pertama yang tersisa (atau null kalau sudah tidak ada foto sama sekali)
    // supaya halaman listing tidak menampilkan foto yang sudah dihapus.
    const roomResult = await pool.query(
      "SELECT image_url FROM rooms WHERE id = $1",
      [id],
    );
    if (roomResult.rows[0].image_url === image.image_url) {
      const nextImage = await pool.query(
        "SELECT image_url FROM room_images WHERE room_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1",
        [id],
      );
      await pool.query("UPDATE rooms SET image_url = $1 WHERE id = $2", [
        nextImage.rows.length > 0 ? nextImage.rows[0].image_url : null,
        id,
      ]);
    }

    res.json({ message: "Foto berhasil dihapus." });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  uploadRoomImages,
  deleteRoomImage,
  ALLOWED_CATEGORIES,
};
