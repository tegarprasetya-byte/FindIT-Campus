const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = () => process.env.JWT_SECRET || 'super_secret_key_findcampus_unila_2026';

module.exports = async (req, res, next) => {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET());
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.' });
  }

  try {
    // Ambil data terbaru: akun yang dinonaktifkan admin langsung ditolak, role selalu dari database
    const [rows] = await db.query(
      'SELECT id_user, nama, email, role, status_akun, status_verifikasi FROM user WHERE id_user = ?',
      [decoded.id_user]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan. Silakan login kembali.' });
    }
    if (rows[0].status_akun === 'nonaktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan oleh Admin.' });
    }

    if (rows[0].role !== 'admin' && rows[0].status_verifikasi !== 'terverifikasi') {
      return res.status(403).json({
        success: false,
        code: rows[0].status_verifikasi === 'ditolak' ? 'DITOLAK' : 'MENUNGGU_VERIFIKASI',
        message: 'Akun Anda belum diverifikasi oleh Admin.'
      });
    }

    req.user = { id_user: rows[0].id_user, nama: rows[0].nama, email: rows[0].email, tipe: rows[0].role };
    next();
  } catch (error) {
    console.error('[Auth Middleware Error]', error.message);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa sesi login.' });
  }
};
