const db = require('../config/db');

// Buat notifikasi untuk satu user. `conn` boleh koneksi transaksi atau pool (default).
const notify = async (id_user, judul, pesan, id_laporan = null, conn = db) => {
  await conn.query(
    'INSERT INTO notifikasi (id_user, judul, pesan, id_laporan) VALUES (?, ?, ?, ?)',
    [id_user, judul, pesan, id_laporan]
  );
};

// Notifikasi ke semua admin aktif
const notifyAdmins = async (judul, pesan, id_laporan = null, conn = db) => {
  const [admins] = await conn.query("SELECT id_user FROM user WHERE role = 'admin' AND status_akun = 'aktif'");
  for (const a of admins) {
    await notify(a.id_user, judul, pesan, id_laporan, conn);
  }
};

module.exports = { notify, notifyAdmins };
