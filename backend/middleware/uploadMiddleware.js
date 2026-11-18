const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '../..');
const DIRS = {
  foto: path.join(ROOT, 'uploads'),          // foto barang (publik)
  kartu: path.join(ROOT, 'private', 'kartu'), // kartu identitas (privat, hanya admin)
  bukti: path.join(ROOT, 'private', 'bukti')  // bukti klaim (privat, admin + pengaju)
};
Object.values(DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_EXT_BUKTI = [...ALLOWED_EXT, '.pdf'];

const makeUpload = (dirKey, { allowPdf = false, maxSizeMB = 5 } = {}) => {
  const allowed = allowPdf ? ALLOWED_EXT_BUKTI : ALLOWED_EXT;
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, DIRS[dirKey]),
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname).toLowerCase());
      }
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: 3 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new Error(allowPdf ? 'File harus berupa gambar (JPG/PNG/WEBP) atau PDF.' : 'File harus berupa gambar (JPG/PNG/WEBP).'));
      }
      cb(null, true);
    }
  });
};

// Bungkus agar error multer jadi respons JSON yang rapi
const handle = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    let message = err.message || 'Gagal mengunggah file.';
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Ukuran file terlalu besar (maksimal 5MB per file).';
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') message = 'Jumlah file melebihi batas (maksimal 3 file).';
    return res.status(400).json({ success: false, message });
  });
};

const removeFiles = (files, dirKey = 'foto') => {
  (files || []).forEach((f) => {
    const name = typeof f === 'string' ? f : f.filename;
    if (!name) return;
    const p = path.join(DIRS[dirKey], path.basename(name));
    if (fs.existsSync(p)) fs.unlink(p, () => {});
  });
};

module.exports = {
  DIRS,
  removeFiles,
  fotoBarang: handle(makeUpload('foto').array('files', 3)),
  kartuIdentitas: handle(makeUpload('kartu').single('kartu')),
  gambarChat: handle(makeUpload('foto').single('gambar')),
  buktiKlaim: handle(makeUpload('bukti', { allowPdf: true }).array('files', 3))
};
