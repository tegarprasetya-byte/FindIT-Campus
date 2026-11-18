const db = require('../config/db');
const { removeFiles } = require('../middleware/uploadMiddleware');
const { toMysqlDateTime } = require('../utils/validators');
const { notify, notifyAdmins } = require('../utils/notify');

const STATUS_PUBLIK = ['dipublikasikan', 'proses_klaim'];

const splitFoto = (foto) => (foto ? foto.split(',').filter(Boolean) : []);
const withFoto = (row) => {
  const fotos = splitFoto(row.foto);
  const { foto, ...rest } = row;
  return { ...rest, jenis: (row.jenis || '').toLowerCase(), foto_utama: fotos[0] || null, fotos: fotos.map((f, i) => ({ id_foto: i + 1, nama_file: f })) };
};

// 1. BUAT LAPORAN
exports.createLaporan = async (req, res) => {
  const files = req.files || [];
  const { jenis, nama_barang, id_kategori, id_lokasi, detail_lokasi, waktu_kejadian, deskripsi } = req.body;
  const id_user = req.user.id_user;

  if (!jenis || !nama_barang || !id_kategori || !id_lokasi || !waktu_kejadian || !deskripsi) {
    removeFiles(files);
    return res.status(400).json({ success: false, message: 'Semua kolom form wajib diisi.' });
  }
  if (!['hilang', 'temuan'].includes(jenis.toLowerCase())) {
    removeFiles(files);
    return res.status(400).json({ success: false, message: 'Jenis laporan tidak valid.' });
  }
  const waktu = toMysqlDateTime(waktu_kejadian);
  if (!waktu) {
    removeFiles(files);
    return res.status(400).json({ success: false, message: 'Format waktu kejadian tidak valid.' });
  }

  const jenisDb = jenis.toLowerCase() === 'hilang' ? 'Hilang' : 'Ditemukan';
  const foto = files.map((f) => f.filename).join(',') || null;

  try {
    const [result] = await db.query(
      `INSERT INTO laporan (id_user, id_kategori, id_lokasi, jenis_laporan, nama_barang, detail_lokasi, deskripsi, foto, waktu, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_verifikasi')`,
      [id_user, id_kategori, id_lokasi, jenisDb, nama_barang.trim(), (detail_lokasi || '').trim() || null, deskripsi.trim(), foto, waktu]
    );

    notifyAdmins('Laporan baru menunggu verifikasi', `${req.user.nama} membuat laporan "${nama_barang.trim()}".`, result.insertId).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Laporan berhasil dibuat dan sedang menunggu verifikasi dari Admin.',
      data: { id_laporan: result.insertId, nama_barang }
    });
  } catch (error) {
    removeFiles(files);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, message: 'Kategori atau lokasi tidak valid.' });
    }
    console.error('[Laporan Error] Create:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuat laporan baru.' });
  }
};

// 2. DAFTAR LAPORAN PUBLIK (hanya yang sudah diverifikasi admin)
exports.getLaporanPublik = async (req, res) => {
  try {
    const { keyword, id_kategori, id_lokasi, jenis } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    let query = `
      SELECT l.id_laporan, l.id_user, l.nama_barang, l.jenis_laporan AS jenis, l.deskripsi, l.foto,
             l.waktu AS waktu_kejadian, l.status, l.tanggal_laporan AS created_at,
             k.id_kategori, k.nama_kategori, loc.id_lokasi, loc.nama_lokasi, u.nama AS nama_pelapor
      FROM laporan l
      JOIN kategori k ON l.id_kategori = k.id_kategori
      JOIN lokasi loc ON l.id_lokasi = loc.id_lokasi
      JOIN user u ON l.id_user = u.id_user
      WHERE l.status IN (?)`;
    const params = [STATUS_PUBLIK];

    if (keyword) {
      query += ' AND (l.nama_barang LIKE ? OR l.deskripsi LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (id_kategori) { query += ' AND l.id_kategori = ?'; params.push(id_kategori); }
    if (id_lokasi) { query += ' AND l.id_lokasi = ?'; params.push(id_lokasi); }
    if (jenis && ['hilang', 'temuan'].includes(jenis.toLowerCase())) {
      query += ' AND l.jenis_laporan = ?';
      params.push(jenis.toLowerCase() === 'hilang' ? 'Hilang' : 'Ditemukan');
    }

    query += ' ORDER BY l.id_laporan DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);

    const [rows] = await db.query(query, params);
    return res.status(200).json({ success: true, data: rows.map(withFoto) });
  } catch (error) {
    console.error('[Laporan Error] Get Publik:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar laporan.' });
  }
};

// 3. DETAIL LAPORAN
exports.getLaporanDetail = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT l.id_laporan, l.id_user, l.nama_barang, l.jenis_laporan AS jenis, l.deskripsi, l.foto, l.detail_lokasi,
              l.waktu AS waktu_kejadian, l.status, l.alasan_tolak, l.id_kategori, l.tanggal_laporan, l.tanggal_publikasi,
              k.nama_kategori, loc.nama_lokasi, u.nama AS nama_pelapor
       FROM laporan l
       JOIN kategori k ON l.id_kategori = k.id_kategori
       JOIN lokasi loc ON l.id_lokasi = loc.id_lokasi
       JOIN user u ON l.id_user = u.id_user
       WHERE l.id_laporan = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
    }

    const item = withFoto(rows[0]);
    const isOwner = item.id_user === req.user.id_user;
    const isAdmin = req.user.tipe === 'admin';

    const [klaim] = await db.query(
      'SELECT status_klaim FROM klaim WHERE id_laporan = ? AND id_user = ? ORDER BY id_klaim DESC LIMIT 1',
      [id, req.user.id_user]
    );
    item.klaim_saya = klaim.length ? klaim[0].status_klaim : null;

    // Laporan yang belum/tidak dipublikasikan hanya boleh dilihat pemilik, admin, dan pengaju klaim
    if (!STATUS_PUBLIK.includes(item.status) && !isOwner && !isAdmin && !item.klaim_saya) {
      return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
    }
    if (!isOwner && !isAdmin) delete item.alasan_tolak;

    item.is_owner = isOwner;

    const [[jk]] = await db.query('SELECT COUNT(*) AS n FROM klaim WHERE id_laporan = ?', [id]);
    item.jumlah_klaim = jk.n;

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error('[Laporan Error] Get Detail:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail laporan.' });
  }
};

// 4. RIWAYAT LAPORAN SAYA
exports.getRiwayatSaya = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id_laporan, l.nama_barang, l.jenis_laporan AS jenis, l.waktu AS waktu_kejadian, l.status, l.alasan_tolak, l.foto,
              k.nama_kategori, loc.nama_lokasi
       FROM laporan l
       JOIN kategori k ON l.id_kategori = k.id_kategori
       JOIN lokasi loc ON l.id_lokasi = loc.id_lokasi
       WHERE l.id_user = ?
       ORDER BY l.id_laporan DESC`,
      [req.user.id_user]
    );
    return res.status(200).json({ success: true, data: rows.map(withFoto) });
  } catch (error) {
    console.error('[Laporan Error] Get Riwayat Saya:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat laporan Anda.' });
  }
};

// 5. SARAN LAPORAN MIRIP (kategori sama, jenis berlawanan)
exports.getSaranMirip = async (req, res) => {
  const { id_laporan } = req.query;
  if (!id_laporan) return res.status(400).json({ success: false, message: 'id_laporan wajib diisi.' });

  try {
    const [base] = await db.query('SELECT id_kategori, jenis_laporan FROM laporan WHERE id_laporan = ?', [id_laporan]);
    if (base.length === 0) return res.status(200).json({ success: true, data: [] });

    const jenisLawan = base[0].jenis_laporan === 'Hilang' ? 'Ditemukan' : 'Hilang';
    const [rows] = await db.query(
      `SELECT l.id_laporan, l.nama_barang, l.jenis_laporan AS jenis, l.foto, l.waktu AS waktu_kejadian, loc.nama_lokasi
       FROM laporan l
       JOIN lokasi loc ON l.id_lokasi = loc.id_lokasi
       WHERE l.id_kategori = ? AND l.jenis_laporan = ? AND l.status IN (?) AND l.id_laporan <> ?
       ORDER BY l.id_laporan DESC LIMIT 4`,
      [base[0].id_kategori, jenisLawan, STATUS_PUBLIK, id_laporan]
    );
    return res.status(200).json({ success: true, data: rows.map(withFoto) });
  } catch (error) {
    console.error('[Laporan Error] Saran:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil saran laporan.' });
  }
};

// 6. UBAH LAPORAN (hanya pemilik, selama belum dipublikasikan)
exports.updateLaporan = async (req, res) => {
  const { id } = req.params;
  const { nama_barang, id_kategori, id_lokasi, detail_lokasi, waktu_kejadian, deskripsi } = req.body;

  try {
    const [rows] = await db.query('SELECT id_user, status FROM laporan WHERE id_laporan = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
    if (rows[0].id_user !== req.user.id_user) return res.status(403).json({ success: false, message: 'Anda bukan pemilik laporan ini.' });
    if (!['menunggu_verifikasi', 'ditolak'].includes(rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Laporan yang sudah dipublikasikan tidak dapat diubah.' });
    }

    const sets = [];
    const params = [];
    const add = (col, val) => { if (val !== undefined && val !== '') { sets.push(`${col} = ?`); params.push(val); } };
    add('nama_barang', nama_barang && nama_barang.trim());
    add('id_kategori', id_kategori);
    add('id_lokasi', id_lokasi);
    add('detail_lokasi', detail_lokasi && detail_lokasi.trim());
    add('deskripsi', deskripsi && deskripsi.trim());
    if (waktu_kejadian) {
      const waktu = toMysqlDateTime(waktu_kejadian);
      if (!waktu) return res.status(400).json({ success: false, message: 'Format waktu kejadian tidak valid.' });
      add('waktu', waktu);
    }
    if (sets.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });

    // Laporan yang pernah ditolak diajukan ulang ke antrean verifikasi
    sets.push("status = 'menunggu_verifikasi'", 'alasan_tolak = NULL');
    await db.query(`UPDATE laporan SET ${sets.join(', ')} WHERE id_laporan = ?`, [...params, id]);
    return res.status(200).json({ success: true, message: 'Laporan berhasil diperbarui.' });
  } catch (error) {
    console.error('[Laporan Error] Update:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui laporan.' });
  }
};

// 7. BATALKAN LAPORAN (hanya pemilik, selama belum dipublikasikan)
exports.cancelLaporan = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT id_user, status, foto FROM laporan WHERE id_laporan = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
    if (rows[0].id_user !== req.user.id_user) return res.status(403).json({ success: false, message: 'Anda bukan pemilik laporan ini.' });
    if (!['menunggu_verifikasi', 'ditolak'].includes(rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Laporan yang sudah dipublikasikan tidak dapat dibatalkan.' });
    }

    await db.query('DELETE FROM laporan WHERE id_laporan = ?', [id]);
    removeFiles(splitFoto(rows[0].foto));
    return res.status(200).json({ success: true, message: 'Laporan berhasil dibatalkan.' });
  } catch (error) {
    console.error('[Laporan Error] Cancel:', error);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan laporan.' });
  }
};

// 8. STATISTIK RINGKAS UNTUK BERANDA
exports.getStatistik = async (req, res) => {
  try {
    const [[r]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM laporan WHERE status IN ('dipublikasikan','proses_klaim')) AS aktif,
         (SELECT COUNT(*) FROM laporan WHERE status = 'dikembalikan') AS dikembalikan,
         (SELECT COUNT(*) FROM user WHERE role <> 'admin' AND status_akun = 'aktif') AS pengguna,
         (SELECT COUNT(*) FROM laporan WHERE jenis_laporan = 'Hilang' AND status IN ('dipublikasikan','proses_klaim')) AS hilang,
         (SELECT COUNT(*) FROM laporan WHERE jenis_laporan = 'Ditemukan' AND status IN ('dipublikasikan','proses_klaim')) AS temuan`
    );
    return res.status(200).json({ success: true, data: r });
  } catch (error) {
    console.error('[Laporan Error] Statistik:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik.' });
  }
};

// 9. TANDAI BARANG HILANG SUDAH DITEMUKAN (oleh pemilik laporan hilang)
exports.tandaiDitemukan = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT id_user, nama_barang, jenis_laporan, status FROM laporan WHERE id_laporan = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
    const l = rows[0];

    if (l.id_user !== req.user.id_user) return res.status(403).json({ success: false, message: 'Hanya pemilik laporan yang bisa menandai barang ini.' });
    if (l.jenis_laporan !== 'Hilang') return res.status(400).json({ success: false, message: 'Fitur ini hanya untuk laporan barang hilang.' });
    if (l.status !== 'dipublikasikan') return res.status(400).json({ success: false, message: 'Laporan ini belum/tidak dalam status aktif.' });

    await db.query("UPDATE laporan SET status = 'dikembalikan' WHERE id_laporan = ?", [id]);

    // Beri tahu admin dan orang yang sempat chat (kemungkinan penemu)
    await notifyAdmins('Barang hilang ditemukan', `${req.user.nama} menandai "${l.nama_barang}" sudah ditemukan.`, id);
    const [penemu] = await db.query('SELECT DISTINCT IF(id_pengirim = ?, id_penerima, id_pengirim) AS id_user FROM chat WHERE id_laporan = ?', [req.user.id_user, id]);
    for (const p of penemu) {
      await notify(p.id_user, 'Terima kasih sudah membantu', `Pemilik menandai "${l.nama_barang}" sudah ditemukan.`, id);
    }
    return res.status(200).json({ success: true, message: 'Syukurlah! Laporan ditandai sudah ditemukan.' });
  } catch (error) {
    console.error('[Laporan Error] Tandai Ditemukan:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status laporan.' });
  }
};
