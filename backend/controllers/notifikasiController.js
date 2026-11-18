const db = require('../config/db');

exports.getNotifikasiSaya = async (req, res) => {
  const id_user = req.user.id_user;
  try {
    const [rows] = await db.query(
      'SELECT id_notifikasi, judul, pesan, id_laporan, status_baca, created_at FROM notifikasi WHERE id_user = ? ORDER BY id_notifikasi DESC LIMIT 30',
      [id_user]
    );
    const [unread] = await db.query('SELECT COUNT(*) AS total FROM notifikasi WHERE id_user = ? AND status_baca = 0', [id_user]);
    return res.status(200).json({ success: true, unread_count: unread[0].total, data: rows });
  } catch (error) {
    console.error('[Notif Error] Get:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data notifikasi.' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await db.query('UPDATE notifikasi SET status_baca = 1 WHERE id_notifikasi = ? AND id_user = ?', [req.params.id, req.user.id_user]);
    return res.status(200).json({ success: true, message: 'Notifikasi ditandai sudah dibaca.' });
  } catch (error) {
    console.error('[Notif Error] Read:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await db.query('UPDATE notifikasi SET status_baca = 1 WHERE id_user = ?', [req.user.id_user]);
    return res.status(200).json({ success: true, message: 'Semua notifikasi ditandai sudah dibaca.' });
  } catch (error) {
    console.error('[Notif Error] ReadAll:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
};
