const db = require('../config/db');

// Riwayat percakapan antara user login dan satu lawan bicara pada satu laporan
exports.getRiwayatChat = async (req, res) => {
  const { id_laporan } = req.params;
  const me = req.user.id_user;
  const lawan = parseInt(req.query.dengan);

  if (!lawan) return res.status(400).json({ success: false, message: 'Lawan bicara wajib ditentukan.' });

  try {
    const [rows] = await db.query(
      `SELECT c.id_chat, c.id_laporan, c.id_pengirim, c.id_penerima, c.pesan, c.gambar, c.tanggal_kirim AS created_at, u.nama AS nama_pengirim
       FROM chat c JOIN user u ON c.id_pengirim = u.id_user
       WHERE c.id_laporan = ?
         AND ((c.id_pengirim = ? AND c.id_penerima = ?) OR (c.id_pengirim = ? AND c.id_penerima = ?))
       ORDER BY c.id_chat ASC`,
      [id_laporan, me, lawan, lawan, me]
    );

    await db.query(
      'UPDATE chat SET status_baca = 1 WHERE id_laporan = ? AND id_pengirim = ? AND id_penerima = ? AND status_baca = 0',
      [id_laporan, lawan, me]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[Chat Error] Riwayat:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat pesan.' });
  }
};

// Daftar percakapan (satu baris per laporan + lawan bicara)
exports.getDaftarPercakapan = async (req, res) => {
  const me = req.user.id_user;
  try {
    const [rows] = await db.query(
      `SELECT c.id_laporan, l.nama_barang,
              o.id_user AS id_lawan_bicara, o.nama AS nama_lawan_bicara,
              o.role AS role_lawan_bicara, l.foto AS foto_barang,
              c.pesan AS pesan_terakhir, c.gambar AS gambar_terakhir, c.tanggal_kirim AS waktu_terakhir,
              (SELECT COUNT(*) FROM chat x
                WHERE x.id_laporan = c.id_laporan AND x.id_pengirim = o.id_user AND x.id_penerima = ? AND x.status_baca = 0) AS belum_dibaca
       FROM chat c
       JOIN laporan l ON c.id_laporan = l.id_laporan
       JOIN user o ON o.id_user = IF(c.id_pengirim = ?, c.id_penerima, c.id_pengirim)
       WHERE c.id_chat IN (
         SELECT MAX(id_chat) FROM chat
         WHERE id_pengirim = ? OR id_penerima = ?
         GROUP BY id_laporan, LEAST(id_pengirim, id_penerima), GREATEST(id_pengirim, id_penerima)
       )
       ORDER BY c.id_chat DESC`,
      [me, me, me, me]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[Chat Error] Percakapan:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar percakapan.' });
  }
};

// Unggah gambar untuk chat (dikirim lalu lewat socket sebagai nama file)
exports.uploadGambar = (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Pilih gambar terlebih dahulu.' });
  return res.status(201).json({ success: true, data: { nama_file: req.file.filename } });
};
