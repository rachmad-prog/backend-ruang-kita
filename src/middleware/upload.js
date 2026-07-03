const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// File diupload langsung ke Cloudinary (bukan disimpan di disk server),
// karena di Vercel folder project bersifat read-only saat runtime.
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ruang-kita/rooms",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
    transformation: [{ width: 1600, crop: "limit" }], // batasi lebar maksimal, hemat storage
  },
});

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error("Format file harus JPG, PNG, WEBP, atau GIF."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // maks 5MB/file, 10 file sekaligus
});

module.exports = upload;
