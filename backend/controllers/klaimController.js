const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { DIRS, removeFiles } = require('../middleware/uploadMiddleware');
const { notify, notifyAdmins } = require('../utils/notify');

// 1. AJUKAN KLAIM (oleh pengguna, hanya untuk barang temuan)
exports.createKlaim = async (req, res) => {
  const files = req.files || [];
  const { id_laporan, deskripsi_bukti } = req.body;
  const id_user = req.user.id_user;

  if (!id_laporan || !deskripsi_bukti || !deskripsi_bukti.trim()) {
    removeFiles(files, 'bukti');
    return res.status(400).json({ success: false, message: 'ID Laporan dan bukti kepemilikan wajib diisi.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [lap] = await conn.query('SELECT id_user, nama_barang, jenis_laporan, status FROM laporan WHERE id_laporan = ? FOR UPDATE', [id_laporan]);
    if (lap.length === 0) throw { http: 404, message: 'Laporan tidak ditemukan.' };
    const laporan = lap[0];

    if (laporan.jenis_laporan !== 'Ditemukan') throw { http: 400, message: 'Klaim hanya bisa diajukan pada laporan barang temuan.' };
    if (!['dipublikasikan', 'proses_klaim'].includes(laporan.status)) throw { http: 400, message: 'Laporan ini tidak sedang menerima klaim.' };
    if (laporan.id_user === id_user) throw { http: 400, message: 'Anda tidak dapat mengklaim laporan milik sendiri.' };

    const [dup] = await conn.query("SELECT id_klaim FROM klaim WHERE id_laporan = ? AND id_user = ? AND status_klaim = 'menunggu'", [id_laporan, id_user]);
    if (dup.length > 0) throw { http: 400, message: 'Anda sudah mengajukan klaim untuk barang ini dan masih menunggu verifikasi.' };

    const fotoBukti = files.map((f) => f.filename).join(',') || null;
    await conn.query(
      "INSERT INTO klaim (id_laporan, id_user, bukti_kepemilikan, foto_bukti, status_klaim) VALUES (?, ?, ?, ?, 'menunggu')",
      [id_laporan, id_user, deskripsi_bukti.trim(), fotoBukti]
    );
    await conn.query("UPDATE laporan SET status = 'proses_klaim' WHERE id_laporan = ?", [id_laporan]);

    await notify(laporan.id_user, 'Ada klaim untuk barang Anda', `Seseorang mengajukan klaim atas "${laporan.nama_barang}". Admin akan memverifikasinya.`, id_laporan, conn);
    await notifyAdmins('Klaim baru menunggu verifikasi', `${req.user.nama} mengklaim "${laporan.nama_barang}".`, id_laporan, conn);

    await conn.commit();
    return res.status(201).json({ success: true, message: 'Pengajuan klaim berhasil dikirim. Menunggu verifikasi Admin.' });
  } catch (error) {
    await conn.rollback();
    removeFiles(files, 'bukti');
    if (error.http) return res.status(error.http).json({ success: false, message: error.message });
    console.error('[Klaim Error] Create:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan klaim.' });
  } finally {
    conn.release();
  }
};

// 2. DAFTAR KLAIM (admin)
exports.getDaftarKlaimAdmin = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT k.id_klaim, k.id_laporan, k.bukti_kepemilikan, k.foto_bukti, k.status_klaim, k.alasan_penolakan, k.tanggal_klaim,
              l.nama_barang, pel.nama AS nama_pelapor, u.nama AS nama_pengaju, u.email AS email_pengaju
       FROM klaim k
       JOIN laporan l ON k.id_laporan = l.id_laporan
       JOIN user pel ON l.id_user = pel.id_user
       JOIN user u ON k.id_user = u.id_user
       ORDER BY (k.status_klaim = 'menunggu') DESC, k.id_klaim DESC`
    );
    const data = rows.map((r) => ({ ...r, foto_bukti: r.foto_bukti ? r.foto_bukti.split(',').filter(Boolean) : [] }));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[Klaim Error] List Admin:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar klaim.' });
  }
};

// 3. VERIFIKASI KLAIM (admin)
exports.verifikasiKlaim = async (req, res) => {
  const { id } = req.params;
  const { keputusan, alasan_tolak } = req.body;

  if (!['diterima', 'ditolak'].includes(keputusan)) {
    return res.status(400).json({ success: false, message: 'Keputusan harus diterima atau ditolak.' });
  }
  if (keputusan === 'ditolak' && (!alasan_tolak || !alasan_tolak.trim())) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT k.id_klaim, k.id_laporan, k.id_user, k.status_klaim, l.nama_barang, l.id_user AS id_pelapor
       FROM klaim k JOIN laporan l ON k.id_laporan = l.id_laporan WHERE k.id_klaim = ? FOR UPDATE`,
      [id]
    );
    if (rows.length === 0) throw { http: 404, message: 'Klaim tidak ditemukan.' };
    const klaim = rows[0];
    if (klaim.status_klaim !== 'menunggu') throw { http: 400, message: 'Klaim ini sudah diverifikasi sebelumnya.' };

    await conn.query(
      'UPDATE klaim SET status_klaim = ?, alasan_penolakan = ?, id_admin = ?, verified_at = NOW() WHERE id_klaim = ?',
      [keputusan, keputusan === 'ditolak' ? alasan_tolak.trim() : null, req.user.id_user, id]
    );

    if (keputusan === 'diterima') {
      await conn.query("UPDATE laporan SET status = 'dikembalikan' WHERE id_laporan = ?", [klaim.id_laporan]);

      // Klaim lain yang masih menunggu otomatis ditolak
      const [lain] = await conn.query("SELECT id_klaim, id_user FROM klaim WHERE id_laporan = ? AND status_klaim = 'menunggu'", [klaim.id_laporan]);
      for (const k of lain) {
        await conn.query(
          "UPDATE klaim SET status_klaim = 'ditolak', alasan_penolakan = 'Barang sudah diserahkan kepada pemilik yang terverifikasi.', id_admin = ?, verified_at = NOW() WHERE id_klaim = ?",
          [req.user.id_user, k.id_klaim]
        );
        await notify(k.id_user, 'Klaim ditolak', `Klaim Anda atas "${klaim.nama_barang}" ditolak karena barang sudah diserahkan kepada pemilik lain.`, klaim.id_laporan, conn);
      }

      await notify(klaim.id_user, 'Klaim diterima', `Klaim Anda atas "${klaim.nama_barang}" diterima. Hubungi pelapor melalui Chat untuk mengambil barang.`, klaim.id_laporan, conn);
      await notify(klaim.id_pelapor, 'Barang berhasil dikembalikan', `Klaim atas "${klaim.nama_barang}" telah diverifikasi. Silakan serahkan barang kepada pemiliknya.`, klaim.id_laporan, conn);
    } else {
      const [sisa] = await conn.query("SELECT COUNT(*) AS n FROM klaim WHERE id_laporan = ? AND status_klaim = 'menunggu'", [klaim.id_laporan]);
      if (sisa[0].n === 0) {
        await conn.query("UPDATE laporan SET status = 'dipublikasikan' WHERE id_laporan = ? AND status = 'proses_klaim'", [klaim.id_laporan]);
      }
      await notify(klaim.id_user, 'Klaim ditolak', `Klaim Anda atas "${klaim.nama_barang}" ditolak. Alasan: ${alasan_tolak.trim()}`, klaim.id_laporan, conn);
    }

    await conn.commit();
    return res.status(200).json({ success: true, message: `Klaim berhasil ${keputusan === 'diterima' ? 'diterima' : 'ditolak'}.` });
  } catch (error) {
    await conn.rollback();
    if (error.http) return res.status(error.http).json({ success: false, message: error.message });
    console.error('[Klaim Error] Verifikasi:', error);
    return res.status(500).json({ success: false, message: 'Gagal memverifikasi klaim.' });
  } finally {
    conn.release();
  }
};

// 4. LIHAT FILE BUKTI KLAIM (admin atau pengaju klaim)
exports.getBukti = async (req, res) => {
  const file = path.basename(req.params.file);
  try {
    const [rows] = await db.query('SELECT id_user FROM klaim WHERE FIND_IN_SET(?, foto_bukti) LIMIT 1', [file]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    if (req.user.tipe !== 'admin' && rows[0].id_user !== req.user.id_user) {
      return res.status(403).json({ success: false, message: 'Anda tidak berhak melihat file ini.' });
    }
    const filePath = path.join(DIRS.bukti, file);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    return res.sendFile(filePath);
  } catch (error) {
    console.error('[Klaim Error] Bukti:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuka file.' });
  }
};
