const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { DIRS } = require('../middleware/uploadMiddleware');
const { notify } = require('../utils/notify');

// 1. DASHBOARD
exports.getDashboardStats = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM v_dashboard LIMIT 1');
    const [[u]] = await db.query("SELECT COUNT(*) AS n FROM user WHERE role <> 'admin' AND status_verifikasi = 'menunggu'");
    return res.status(200).json({ success: true, data: { ...(rows[0] || {}), total_user_menunggu: u.n } });
  } catch (error) {
    console.error('[Admin Error] Dashboard:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik dashboard.' });
  }
};

// 2. ANTREAN VERIFIKASI LAPORAN
exports.getLaporanMenunggu = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id_laporan, l.nama_barang, l.jenis_laporan AS jenis, l.waktu AS waktu_kejadian, l.deskripsi,
              loc.nama_lokasi, l.detail_lokasi, u.nama AS nama_pelapor, u.status_verifikasi AS status_verifikasi_pelapor
       FROM laporan l
       JOIN lokasi loc ON l.id_lokasi = loc.id_lokasi
       JOIN user u ON l.id_user = u.id_user
       WHERE l.status = 'menunggu_verifikasi'
       ORDER BY l.id_laporan ASC`
    );
    return res.status(200).json({ success: true, data: rows.map((r) => ({ ...r, jenis: r.jenis.toLowerCase() })) });
  } catch (error) {
    console.error('[Admin Error] Antrean:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil antrean verifikasi.' });
  }
};

// 3. VERIFIKASI LAPORAN (setujui / tolak)
exports.verifikasiLaporan = async (req, res) => {
  const { id } = req.params;
  const { tindakan, alasan_tolak } = req.body;

  if (!['setujui', 'tolak'].includes(tindakan)) {
    return res.status(400).json({ success: false, message: 'Tindakan harus setujui atau tolak.' });
  }
  if (tindakan === 'tolak' && (!alasan_tolak || !alasan_tolak.trim())) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT id_user, nama_barang, status FROM laporan WHERE id_laporan = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw { http: 404, message: 'Laporan tidak ditemukan.' };
    if (rows[0].status !== 'menunggu_verifikasi') throw { http: 400, message: 'Laporan ini sudah diverifikasi sebelumnya.' };

    const setuju = tindakan === 'setujui';
    const catatan = setuju ? 'Laporan telah diverifikasi dan disetujui oleh Admin.' : alasan_tolak.trim();

    if (setuju) {
      await conn.query("UPDATE laporan SET status = 'dipublikasikan', tanggal_publikasi = NOW(), alasan_tolak = NULL WHERE id_laporan = ?", [id]);
    } else {
      await conn.query("UPDATE laporan SET status = 'ditolak', alasan_tolak = ? WHERE id_laporan = ?", [catatan, id]);
    }

    await conn.query(
      'INSERT INTO verifikasi (id_laporan, id_admin, status_verifikasi, catatan) VALUES (?, ?, ?, ?)',
      [id, req.user.id_user, setuju ? 'disetujui' : 'ditolak', catatan]
    );

    await notify(
      rows[0].id_user,
      setuju ? 'Laporan disetujui' : 'Laporan ditolak',
      setuju ? `Laporan "${rows[0].nama_barang}" sudah dipublikasikan.` : `Laporan "${rows[0].nama_barang}" ditolak. Alasan: ${catatan}`,
      id,
      conn
    );

    await conn.commit();
    return res.status(200).json({ success: true, message: setuju ? `Laporan #${id} disetujui dan dipublikasikan.` : `Laporan #${id} ditolak.` });
  } catch (error) {
    await conn.rollback();
    if (error.http) return res.status(error.http).json({ success: false, message: error.message });
    console.error('[Admin Error] Verifikasi Laporan:', error);
    return res.status(500).json({ success: false, message: 'Gagal memverifikasi laporan.' });
  } finally {
    conn.release();
  }
};

// 4. PENGGUNA
exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id_user, nama, email, role AS tipe, no_hp, status_akun, status_verifikasi,
              (kartu_identitas IS NOT NULL) AS punya_kartu, created_at
       FROM user ORDER BY id_user DESC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[Admin Error] Users:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar pengguna.' });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status_akun } = req.body;

  if (!['aktif', 'nonaktif'].includes(status_akun)) {
    return res.status(400).json({ success: false, message: 'Status akun harus aktif atau nonaktif.' });
  }
  if (parseInt(id) === req.user.id_user) {
    return res.status(400).json({ success: false, message: 'Anda tidak bisa mengubah status akun Anda sendiri.' });
  }

  try {
    const [r] = await db.query('UPDATE user SET status_akun = ? WHERE id_user = ?', [status_akun, id]);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    return res.status(200).json({ success: true, message: `Status pengguna diubah menjadi ${status_akun}.` });
  } catch (error) {
    console.error('[Admin Error] Status User:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status pengguna.' });
  }
};

exports.verifikasiUser = async (req, res) => {
  const { id } = req.params;
  const { status_verifikasi } = req.body;

  if (!['terverifikasi', 'ditolak'].includes(status_verifikasi)) {
    return res.status(400).json({ success: false, message: 'Status verifikasi tidak valid.' });
  }

  try {
    const [r] = await db.query("UPDATE user SET status_verifikasi = ? WHERE id_user = ? AND role <> 'admin'", [status_verifikasi, id]);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });

    await notify(
      id,
      status_verifikasi === 'terverifikasi' ? 'Identitas terverifikasi' : 'Verifikasi identitas ditolak',
      status_verifikasi === 'terverifikasi'
        ? 'Kartu identitas Anda telah diverifikasi oleh Admin.'
        : 'Kartu identitas Anda ditolak. Hubungi Admin untuk informasi lebih lanjut.'
    );
    return res.status(200).json({ success: true, message: `Pengguna ${status_verifikasi}.` });
  } catch (error) {
    console.error('[Admin Error] Verifikasi User:', error);
    return res.status(500).json({ success: false, message: 'Gagal memverifikasi pengguna.' });
  }
};

exports.getKartuUser = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT kartu_identitas FROM user WHERE id_user = ?', [req.params.id]);
    if (rows.length === 0 || !rows[0].kartu_identitas) {
      return res.status(404).json({ success: false, message: 'Kartu identitas tidak ditemukan.' });
    }
    const filePath = path.join(DIRS.kartu, path.basename(rows[0].kartu_identitas));
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File kartu tidak ditemukan.' });
    return res.sendFile(filePath);
  } catch (error) {
    console.error('[Admin Error] Kartu:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuka kartu identitas.' });
  }
};

// 5. MASTER LOKASI
exports.addLokasi = async (req, res) => {
  const nama = (req.body.nama_lokasi || '').trim();
  if (!nama) return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi.' });

  try {
    const [result] = await db.query('INSERT INTO lokasi (nama_lokasi) VALUES (?)', [nama]);
    return res.status(201).json({ success: true, message: 'Lokasi berhasil ditambahkan.', data: { id_lokasi: result.insertId, nama_lokasi: nama } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Nama lokasi sudah ada.' });
    console.error('[Admin Error] Add Lokasi:', error);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan lokasi.' });
  }
};

exports.deleteLokasi = async (req, res) => {
  try {
    await db.query('DELETE FROM lokasi WHERE id_lokasi = ?', [req.params.id]);
    return res.status(200).json({ success: true, message: 'Lokasi berhasil dihapus.' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ success: false, message: 'Lokasi tidak bisa dihapus karena masih dipakai oleh laporan.' });
    }
    console.error('[Admin Error] Delete Lokasi:', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus lokasi.' });
  }
};

// 6. ABUSE
exports.createAbuseReport = async (req, res) => {
  const { id_laporan, alasan } = req.body;
  if (!alasan || !alasan.trim()) {
    return res.status(400).json({ success: false, message: 'Alasan pelaporan wajib diisi.' });
  }

  try {
    let id_terlapor = null;
    if (id_laporan) {
      const [lap] = await db.query('SELECT id_user FROM laporan WHERE id_laporan = ?', [id_laporan]);
      if (lap.length === 0) return res.status(404).json({ success: false, message: 'Laporan tidak ditemukan.' });
      id_terlapor = lap[0].id_user;
    }
    await db.query(
      "INSERT INTO laporan_abuse (id_pelapor, id_laporan, id_terlapor, alasan, status) VALUES (?, ?, ?, ?, 'baru')",
      [req.user.id_user, id_laporan || null, id_terlapor, alasan.trim()]
    );
    return res.status(201).json({ success: true, message: 'Laporan penyalahgunaan berhasil dikirim ke Admin.' });
  } catch (error) {
    console.error('[Admin Error] Create Abuse:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengirim laporan penyalahgunaan.' });
  }
};

exports.getAbuseReports = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id_abuse, a.id_laporan, a.alasan, a.status, a.created_at,
              u1.nama AS nama_pelapor, u2.nama AS nama_terlapor, l.nama_barang
       FROM laporan_abuse a
       JOIN user u1 ON a.id_pelapor = u1.id_user
       LEFT JOIN user u2 ON a.id_terlapor = u2.id_user
       LEFT JOIN laporan l ON a.id_laporan = l.id_laporan
       ORDER BY (a.status = 'selesai') ASC, a.created_at DESC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[Admin Error] Get Abuse:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar laporan abuse.' });
  }
};

exports.updateAbuseStatus = async (req, res) => {
  const { status } = req.body;
  if (!['ditinjau', 'selesai'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status harus ditinjau atau selesai.' });
  }
  try {
    const [r] = await db.query('UPDATE laporan_abuse SET status = ? WHERE id_abuse = ?', [status, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Laporan abuse tidak ditemukan.' });
    return res.status(200).json({ success: true, message: `Status laporan diubah menjadi ${status}.` });
  } catch (error) {
    console.error('[Admin Error] Update Abuse:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status laporan.' });
  }
};

// 7. DATA GRAFIK DASHBOARD (8 minggu terakhir + sebaran status)
exports.getGrafik = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT YEARWEEK(tanggal_laporan, 1) AS minggu, MIN(DATE(tanggal_laporan)) AS awal, jenis_laporan, COUNT(*) AS total
       FROM laporan
       WHERE tanggal_laporan >= (NOW() - INTERVAL 8 WEEK)
       GROUP BY YEARWEEK(tanggal_laporan, 1), jenis_laporan
       ORDER BY minggu ASC`
    );
    const [status] = await db.query('SELECT status, COUNT(*) AS total FROM laporan GROUP BY status');

    // Susun 8 minggu terakhir (termasuk minggu kosong); tanggal memakai komponen lokal agar tidak geser hari
    const pad = (n) => String(n).padStart(2, '0');
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const minggu = [];
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    for (let i = 7; i >= 0; i--) {
      const d = new Date(monday);
      d.setDate(monday.getDate() - i * 7);
      minggu.push({ awal: ymd(d), hilang: 0, temuan: 0 });
    }
    rows.forEach((r) => {
      const d = new Date(`${ymd(new Date(r.awal))}T00:00:00`);
      const m = new Date(d);
      m.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const slot = minggu.find((x) => x.awal === ymd(m));
      if (slot) slot[r.jenis_laporan === 'Hilang' ? 'hilang' : 'temuan'] += r.total;
    });

    return res.status(200).json({ success: true, data: { minggu, status } });
  } catch (error) {
    console.error('[Admin Error] Grafik:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data grafik.' });
  }
};
